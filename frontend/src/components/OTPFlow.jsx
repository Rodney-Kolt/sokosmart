/**
 * OTPFlow.jsx
 * Full-screen email OTP verification flow.
 *
 * Screens:
 *   1. Email entry  – user types their email, hits "Send Code"
 *   2. OTP entry    – six individual digit boxes, 60s countdown, resend
 *   3. Success      – animated checkmark, then calls onVerified()
 *
 * Props:
 *   onVerified(email)  – called when OTP is confirmed
 *   onBack()           – called when user taps ← Back on email screen
 *   prefillEmail       – optional email to pre-fill (e.g. from registration)
 *   hideEmailStep      – skip email entry (use prefillEmail directly)
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "";

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputCls =
  "w-full bg-[#0A0E14] border border-slate-800 text-white rounded-2xl px-4 py-3.5 text-sm placeholder-slate-600 focus:outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/20 transition-all";

// ── Digit box component ───────────────────────────────────────────────────────
function DigitBox({ value, isFocused, inputRef, onChange, onKeyDown, onPaste, index }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 20 }}
      className="relative"
    >
      <motion.div
        animate={value ? { scale: [1, 1.12, 1] } : {}}
        transition={{ duration: 0.2 }}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          className={`w-12 h-14 text-center text-2xl font-bold rounded-2xl border-2 bg-[#141920] text-white outline-none transition-all duration-200 ${
            isFocused
              ? "border-orange-500 shadow-lg shadow-orange-500/30"
              : value
              ? "border-orange-500/50 bg-orange-500/5"
              : "border-slate-700"
          }`}
        />
      </motion.div>
    </motion.div>
  );
}

// ── Animated checkmark ────────────────────────────────────────────────────────
function SuccessCheck() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      className="flex flex-col items-center gap-6"
    >
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40"
        >
          <motion.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-12 h-12"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
          >
            <motion.path
              d="M5 13l4 4L19 7"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
            />
          </motion.svg>
        </motion.div>
        {/* Ripple rings */}
        {[0, 1].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border-2 border-emerald-500/40"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ delay: 0.4 + i * 0.2, duration: 0.8, ease: "easeOut" }}
          />
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        <h2 className="text-white text-2xl font-bold font-display">Verified!</h2>
        <p className="text-slate-400 text-sm mt-1">Your email has been confirmed.</p>
      </motion.div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OTPFlow({ onVerified, onBack, prefillEmail = "", hideEmailStep = false }) {
  const [screen, setScreen]     = useState(hideEmailStep ? "otp" : "email");
  const [email,  setEmail]      = useState(prefillEmail);
  const [digits, setDigits]     = useState(["", "", "", "", "", ""]);
  const [focused, setFocused]   = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState("");
  const [countdown, setCountdown] = useState(0);
  const [success, setSuccess]   = useState(false);

  const inputRefs = useRef([]);
  const timerRef  = useRef(null);

  // Auto-send if email is prefilled and we skip email step
  useEffect(() => {
    if (hideEmailStep && prefillEmail) {
      handleSendCode(prefillEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [countdown]);

  // Focus first digit box when OTP screen mounts
  useEffect(() => {
    if (screen === "otp") {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [screen]);

  function startCountdown() { setCountdown(60); }

  // ── Send OTP ──────────────────────────────────────────────────────────
  async function handleSendCode(emailOverride) {
    const target = (emailOverride || email).trim().toLowerCase();
    if (!target) { setError("Please enter your email address."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/otp/send`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send code.");
      setEmail(target);
      setDigits(["", "", "", "", "", ""]);
      setScreen("otp");
      startCountdown();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Verify OTP ────────────────────────────────────────────────────────
  async function handleVerify() {
    const code = digits.join("");
    if (code.length < 6) { setError("Please enter all 6 digits."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/otp/verify`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid code.");
      setSuccess(true);
      setTimeout(() => onVerified?.(email), 1800);
    } catch (err) {
      setError(err.message);
      // Shake the digit boxes on error
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  }

  // ── Digit input handlers ──────────────────────────────────────────────
  const handleDigitChange = useCallback((index, value) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setError("");
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
      setFocused(index + 1);
    }
    // Auto-submit when all filled
    if (char && index === 5) {
      const full = [...next].join("");
      if (full.length === 6) setTimeout(() => handleVerifyCode(full), 100);
    }
  }, [digits]); // eslint-disable-line

  async function handleVerifyCode(code) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/otp/verify`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid code.");
      setSuccess(true);
      setTimeout(() => onVerified?.(email), 1800);
    } catch (err) {
      setError(err.message);
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        setFocused(index - 1);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === "Enter") {
      handleVerify();
    }
  }, [digits]); // eslint-disable-line

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((c, i) => { next[i] = c; });
    setDigits(next);
    const lastFilled = Math.min(pasted.length, 5);
    inputRefs.current[lastFilled]?.focus();
    setFocused(lastFilled);
    if (pasted.length === 6) setTimeout(() => handleVerifyCode(pasted), 100);
  }, []); // eslint-disable-line

  // ── Render: Success ───────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-[#0A0E14] flex items-center justify-center px-6">
        <SuccessCheck />
      </div>
    );
  }

  // ── Render: Email entry ───────────────────────────────────────────────
  if (screen === "email") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-6"
      >
        <div className="w-full max-w-sm">
          {onBack && (
            <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-1">
              ← Back
            </button>
          )}

          {/* Icon */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-5">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-40 animate-pulse" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                📧
              </div>
            </div>
            <h1 className="text-white text-2xl font-bold font-display">Verify your email</h1>
            <p className="text-slate-400 text-sm mt-1 text-center">
              We'll send a 6-digit code to confirm it's you.
            </p>
          </div>

          <div className="space-y-3">
            <input
              className={inputCls}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
              autoFocus
            />

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-400 text-sm"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              onClick={() => handleSendCode()}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending…
                </span>
              ) : (
                "Send Code →"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Render: OTP entry ─────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-6"
    >
      <div className="w-full max-w-sm">
        <button
          onClick={() => { setScreen("email"); setError(""); setDigits(["","","","","",""]); }}
          className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-1"
        >
          ← Back
        </button>

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-5">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-40 animate-pulse" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
              🔐
            </div>
          </div>
          <h1 className="text-white text-2xl font-bold font-display">Enter the code</h1>
          <p className="text-slate-400 text-sm mt-1 text-center">
            Sent to <span className="text-white font-medium">{email}</span>
          </p>
        </div>

        {/* Digit boxes */}
        <motion.div
          className="flex justify-center gap-2 mb-6"
          animate={error ? { x: [-6, 6, -6, 6, 0] } : {}}
          transition={{ duration: 0.3 }}
        >
          {digits.map((d, i) => (
            <DigitBox
              key={i}
              index={i}
              value={d}
              isFocused={focused === i}
              inputRef={(el) => (inputRefs.current[i] = el)}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
            />
          ))}
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4 text-center"
            >
              <p className="text-red-400 text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verify button */}
        <button
          onClick={handleVerify}
          disabled={loading || digits.join("").length < 6}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-40 mb-4"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Verifying…
            </span>
          ) : (
            "Verify Code →"
          )}
        </button>

        {/* Resend / countdown */}
        <div className="text-center">
          {countdown > 0 ? (
            <p className="text-slate-500 text-sm">
              Resend code in{" "}
              <span className="text-orange-400 font-semibold tabular-nums">{countdown}s</span>
            </p>
          ) : (
            <button
              onClick={() => handleSendCode(email)}
              disabled={loading}
              className="text-orange-500 text-sm hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
