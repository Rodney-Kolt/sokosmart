"""
tts_server.py – Standalone Spark-TTS FastAPI service for Sokoni Smart.

Runs LOCALLY on your machine (not on Render — requires GPU/CPU + 4GB RAM).

Setup:
    1. Clone Spark-TTS and install deps (see README)
    2. Download models:
         from huggingface_hub import snapshot_download
         snapshot_download("unsloth/Spark-TTS-0.5B",
             allow_patterns=["BiCodecTokenizer/*", "BiCodec/*"],
             local_dir="./pretrained_models/tokenizer")
         snapshot_download("jq/spark-tts-salt",
             local_dir="./pretrained_models/salt_model")
    3. Set PYTHONPATH:
         export PYTHONPATH=$PYTHONPATH:/path/to/Spark-TTS
    4. Run:
         uvicorn tts_server:app --host 0.0.0.0 --port 8001

Then set VITE_TTS_URL=http://localhost:8001 in your frontend .env
"""

import os
import uuid
import logging
from pathlib import Path

import torch
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR       = Path(__file__).parent
TOKENIZER_PATH = BASE_DIR / "pretrained_models" / "tokenizer"
MODEL_PATH     = BASE_DIR / "pretrained_models" / "salt_model"
OUTPUT_DIR     = BASE_DIR / "audio_output"
OUTPUT_DIR.mkdir(exist_ok=True)

# ── Device ────────────────────────────────────────────────────────────────────
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
log.info(f"Using device: {DEVICE}")

# ── Speaker mapping ───────────────────────────────────────────────────────────
# Maps friendly speaker IDs to model-internal speaker tokens.
# Adjust these based on the actual speakers in jq/spark-tts-salt.
SPEAKER_MAP = {
    "female_1": "spk_female_ug_1",
    "female_2": "spk_female_ug_2",
    "male_1":   "spk_male_ug_1",
    "male_2":   "spk_male_ug_2",
}
DEFAULT_SPEAKER = "female_1"

# ── Model loading (done once at startup) ─────────────────────────────────────
tokenizer = None
model     = None
SAMPLE_RATE = 16000  # Spark-TTS default; adjust if model differs


def load_models():
    """Load the BiCodec tokenizer and SALT TTS model."""
    global tokenizer, model, SAMPLE_RATE

    if not TOKENIZER_PATH.exists():
        raise RuntimeError(
            f"Tokenizer not found at {TOKENIZER_PATH}. "
            "Run the snapshot_download commands in the docstring first."
        )
    if not MODEL_PATH.exists():
        raise RuntimeError(
            f"Model not found at {MODEL_PATH}. "
            "Run the snapshot_download commands in the docstring first."
        )

    log.info("Loading BiCodec tokenizer…")
    try:
        # Spark-TTS uses its own BiCodec tokenizer class
        import sys
        spark_tts_root = os.environ.get("SPARK_TTS_ROOT", str(BASE_DIR.parent / "Spark-TTS"))
        if spark_tts_root not in sys.path:
            sys.path.insert(0, spark_tts_root)

        from sparktts.models.bicodec import BiCodec
        tokenizer = BiCodec.load_from_checkpoint(str(TOKENIZER_PATH)).to(DEVICE)
        tokenizer.eval()
        log.info("BiCodec tokenizer loaded.")
    except ImportError as e:
        raise RuntimeError(
            f"Could not import Spark-TTS modules: {e}. "
            "Make sure SPARK_TTS_ROOT env var points to the cloned Spark-TTS directory "
            "and all dependencies are installed."
        )

    log.info("Loading SALT TTS model…")
    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer
        model_tokenizer = AutoTokenizer.from_pretrained(str(MODEL_PATH))
        model = AutoModelForCausalLM.from_pretrained(
            str(MODEL_PATH),
            torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32,
        ).to(DEVICE)
        model.eval()
        # Store the text tokenizer alongside the model for convenience
        model._text_tokenizer = model_tokenizer
        log.info("SALT TTS model loaded.")
    except Exception as e:
        raise RuntimeError(f"Failed to load SALT model: {e}")


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="Sokoni Spark-TTS Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Load models when the server starts."""
    try:
        load_models()
        log.info("✅ Models loaded successfully. Server ready.")
    except Exception as e:
        log.error(f"❌ Model loading failed: {e}")
        log.warning("Server will start but /generate will return 503 until models are available.")


# ── Request / Response models ─────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text:       str
    speaker_id: Optional[str] = DEFAULT_SPEAKER


class TTSResponse(BaseModel):
    file_path:  str
    duration_s: float
    speaker_id: str
    device:     str


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status":        "ok" if model is not None else "models_not_loaded",
        "device":        DEVICE,
        "models_loaded": model is not None,
    }


# ── Generate endpoint ─────────────────────────────────────────────────────────

@app.post("/generate", response_model=TTSResponse)
async def generate(req: TTSRequest):
    """
    Generate speech audio from text.

    Body:
        text       – The text to synthesise (Luganda, Swahili, English, etc.)
        speaker_id – One of: female_1, female_2, male_1, male_2

    Returns:
        JSON with the path to the generated WAV file and metadata.
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="text field is required and cannot be empty.")

    if model is None or tokenizer is None:
        raise HTTPException(
            status_code=503,
            detail="Models are not loaded. Check server logs for errors."
        )

    speaker_id     = req.speaker_id or DEFAULT_SPEAKER
    speaker_token  = SPEAKER_MAP.get(speaker_id, SPEAKER_MAP[DEFAULT_SPEAKER])
    text           = req.text.strip()[:500]  # cap at 500 chars per request

    log.info(f"Generating audio | speaker={speaker_id} | text={text[:60]}…")

    try:
        audio_tensor = _generate_audio(text, speaker_token)
    except Exception as e:
        log.error(f"Generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Audio generation failed: {str(e)}")

    # Save to file
    filename   = f"{uuid.uuid4().hex}.wav"
    file_path  = OUTPUT_DIR / filename
    audio_np   = audio_tensor.squeeze().cpu().numpy()
    sf.write(str(file_path), audio_np, SAMPLE_RATE)

    duration = len(audio_np) / SAMPLE_RATE
    log.info(f"Audio saved: {file_path} ({duration:.1f}s)")

    return TTSResponse(
        file_path  = str(file_path),
        duration_s = round(duration, 2),
        speaker_id = speaker_id,
        device     = DEVICE,
    )


@app.get("/audio/{filename}")
async def serve_audio(filename: str):
    """Serve a generated WAV file by filename."""
    file_path = OUTPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found.")
    return FileResponse(str(file_path), media_type="audio/wav")


# ── Core generation logic ─────────────────────────────────────────────────────

def _generate_audio(text: str, speaker_token: str) -> torch.Tensor:
    """
    Run the Spark-TTS pipeline:
      1. Encode text with the SALT language model → discrete audio tokens
      2. Decode audio tokens with BiCodec → waveform tensor

    Returns a 1D float32 tensor of audio samples at SAMPLE_RATE Hz.
    """
    text_tokenizer = model._text_tokenizer

    # Format prompt with speaker token (adjust format to match SALT model's training)
    prompt = f"<|speaker|>{speaker_token}<|text|>{text}<|endoftext|>"

    inputs = text_tokenizer(prompt, return_tensors="pt").to(DEVICE)

    with torch.no_grad():
        # Generate discrete audio token IDs
        output_ids = model.generate(
            **inputs,
            max_new_tokens=1024,
            do_sample=True,
            temperature=0.8,
            top_p=0.95,
            pad_token_id=text_tokenizer.eos_token_id,
        )

    # Extract only the newly generated tokens (skip the prompt)
    new_tokens = output_ids[0, inputs["input_ids"].shape[1]:]

    # Decode audio tokens → waveform using BiCodec
    with torch.no_grad():
        audio_tensor = tokenizer.decode(new_tokens.unsqueeze(0))

    return audio_tensor


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("tts_server:app", host="0.0.0.0", port=8001, reload=False)
