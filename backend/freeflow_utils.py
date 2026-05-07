"""
freeflow_utils.py – Multi-provider AI fallback for Sokoni Smart.

Provider chain (tries in order until one succeeds):
  1. Groq        – llama-3.3-70b-versatile  (fastest, generous free tier)
  2. Gemini      – gemini-2.0-flash          (Google free tier)
  3. DeepSeek    – deepseek-chat             (fallback)

Each provider is skipped if its API key is not set.
On rate-limit (429) or quota error, the next provider is tried automatically.
"""

import os
import httpx
from dotenv import load_dotenv

load_dotenv()

# ── System prompt ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """
You are Sokoni, a friendly and highly capable AI marketplace assistant for Sokoni Smart,
a hyperlocal community marketplace in Uganda.

Your primary goal is to connect users (consumers) with nearby vendors for products and
services, while keeping privacy, clarity, and local relevance at the core.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE & MULTILINGUAL SUPPORT (UGANDA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Automatically detect the language of the user's message.
- ALWAYS reply in the SAME language the user used — English, Luganda, Swahili,
  Runyankore, Luo, or any other language common in Uganda.
- If the user switches languages mid-conversation, switch seamlessly with them.
- Use natural, local variants for greetings and common phrases:
    Luganda:    "Oli otya?" (How are you?), "Webale" (Thank you), "Kale" (OK)
    Swahili:    "Habari?" (How are you?), "Asante" (Thank you), "Sawa" (OK)
    Runyankore: "Agandi?" (How are you?), "Webare" (Thank you)
    Luo:        "Itye nining?" (How are you?), "Apwoyo" (Thank you)
- Never change the user's language choice.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STATE MEMORY (Critical)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Remember the user's last search intent until they explicitly change it.
- If the user previously asked about a product/service and now only gives a location,
  combine that location with the PREVIOUS product/service and run a new search.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE BEHAVIOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Understand Intent: Extract product/service and location. If either is missing, ask.
2. Privacy: NEVER show or request phone numbers, emails, or personal contact info.
3. Vendor Lookups: When you have BOTH category AND location, output search_intent JSON.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIALOGUE & CLARIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Ask ONE clarifying question at a time using clickable buttons in the user's language.
- English: "I need a phone repairer" →
  {"type":"quick_reply","reply":"Sure! What type of device?","buttons":["Smartphone Repair","Laptop Repair","Feature Phone","General Electronics"]}
- Luganda: "Neta omutembezi" →
  {"type":"quick_reply","reply":"Nnyambye! Owa kika ki?","buttons":["Omuwala","Omusajja","Yunifomu","Okuddaabiriza"]}
- Welcome new users: "Hi! I'm Sokoni, your market assistant. What do you need and where are you?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXACT CATEGORY MAPPING (backend uses these strings verbatim)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
tailoring, phone repair, electronics repair, plumbing, handyman, fresh food,
bakery, cleaning, laundry, salon, beauty, grocery, catering, photography,
tutoring, transport, mechanic

Mapping rules:
- "electrician", "wiring"          → handyman
- "plumber", "pipe"                → plumbing
- "tailor", "dress", "omutembezi"  → tailoring
- "phone", "smartphone"            → phone repair
- "laptop", "TV", "fridge"         → electronics repair
- "hair", "nails", "omusumba"      → salon
- "clean", "fumigation", "laundry" → cleaning
- "food", "vegetables", "emmere"   → fresh food
- "cake", "bread"                  → bakery
- "boda", "delivery"               → transport

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMATS — ALWAYS OUTPUT VALID JSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A. SEARCH INTENT (have both category + location):
{"type":"search_intent","category":"<exact>","location":"<area>","clarifying_reply":"<friendly sentence>"}

B. QUICK REPLY (clarification with buttons):
{"type":"quick_reply","reply":"<message>","buttons":["Option1","Option2"]}

C. TEXT ONLY:
{"type":"text","reply":"<message>"}

NEVER output raw text outside a JSON object. Keep replies short — users are on mobile.
For non-market questions: {"type":"text","reply":"I'm best at helping you find services nearby. What are you looking for?"}
Never invent vendor names or details.
"""


# ── Provider implementations ──────────────────────────────────────────────────

async def _try_groq(messages: list) -> str:
    """Groq: llama-3.3-70b-versatile — fastest, generous free tier."""
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set")

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile", "messages": messages,
                  "temperature": 0.7, "max_tokens": 1024},
        )
    if resp.status_code == 429:
        raise RuntimeError("Groq rate limit")
    if resp.status_code != 200:
        raise RuntimeError(f"Groq error {resp.status_code}: {resp.text[:200]}")
    return resp.json()["choices"][0]["message"]["content"]


async def _try_gemini(messages: list) -> str:
    """Gemini 2.0 Flash via OpenAI-compatible endpoint."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "gemini-2.0-flash", "messages": messages,
                  "temperature": 0.7, "max_tokens": 1024},
        )
    if resp.status_code == 429:
        raise RuntimeError("Gemini rate limit")
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Gemini error {resp.status_code}: {resp.text[:200]}")
    return resp.json()["choices"][0]["message"]["content"]


async def _try_deepseek(messages: list) -> str:
    """DeepSeek chat — last resort fallback."""
    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not api_key:
        raise ValueError("DEEPSEEK_API_KEY not set")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "deepseek-chat", "messages": messages,
                  "temperature": 0.7, "max_tokens": 1024},
        )
    if resp.status_code == 429:
        raise RuntimeError("DeepSeek rate limit")
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"DeepSeek error {resp.status_code}: {resp.text[:200]}")
    return resp.json()["choices"][0]["message"]["content"]


# ── Public interface ──────────────────────────────────────────────────────────

PROVIDERS = [
    ("Groq",     _try_groq),
    ("Gemini",   _try_gemini),
    ("DeepSeek", _try_deepseek),
]


async def get_gemini_response(user_message: str, conversation_history: list) -> str:
    """
    Try each provider in order. Return the first successful response.
    Function name kept as get_gemini_response for drop-in compatibility with main.py.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    for turn in (conversation_history or []):
        role = turn.get("role", "user")
        if role == "model":
            role = "assistant"   # Gemini uses "model"; OpenAI-style uses "assistant"
        content = turn.get("content", "")
        if content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_message})

    last_error = None
    for name, provider_fn in PROVIDERS:
        try:
            result = await provider_fn(messages)
            print(f"[AI] Responded via {name}")
            return result
        except ValueError:
            # API key not configured — skip silently
            continue
        except Exception as e:
            last_error = e
            print(f"[AI] {name} failed: {e} — trying next provider")
            continue

    # All providers failed
    raise RuntimeError(
        f"All AI providers failed. Last error: {last_error}. "
        "Please check API keys and quotas."
    )
