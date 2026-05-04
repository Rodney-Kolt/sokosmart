/**
 * speech.js – Web Speech API helpers for voice input and output.
 * Uses the browser's built-in SpeechRecognition and SpeechSynthesis.
 * No external APIs required.
 */

// ── Voice Input (Speech → Text) ──────────────────────────────────────────

/**
 * Start speech recognition and return the transcript via a callback.
 * @param {function} onResult  – called with the transcript string
 * @param {function} onError   – called with an error message string
 * @param {string}   lang      – BCP-47 language tag, e.g. "en-UG", "lg-UG"
 * @returns {SpeechRecognition} – call .stop() to cancel
 */
export function startListening(onResult, onError, lang = "en-UG") {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onError("Voice input is not supported in this browser. Try Chrome.");
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    onResult(transcript);
  };

  recognition.onerror = (event) => {
    onError(`Voice error: ${event.error}`);
  };

  recognition.start();
  return recognition;
}

// ── Voice Output (Text → Speech) ─────────────────────────────────────────

/**
 * Speak a text string aloud using the browser's TTS engine.
 * @param {string} text
 * @param {string} lang – BCP-47 language tag
 */
export function speak(text, lang = "en-UG") {
  if (!window.speechSynthesis) return;

  // Cancel any ongoing speech first
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  // Pick a voice that matches the language if available
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find((v) => v.lang.startsWith(lang.split("-")[0]));
  if (match) utterance.voice = match;

  window.speechSynthesis.speak(utterance);
}

/**
 * Stop any currently playing speech.
 */
export function stopSpeaking() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

/**
 * Check if the browser supports speech synthesis.
 */
export function isSpeechSupported() {
  return "speechSynthesis" in window;
}

/**
 * Check if the browser supports speech recognition.
 */
export function isRecognitionSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
