/**
 * OTPModal.jsx
 * A modal overlay that gates sensitive actions behind email OTP verification.
 *
 * Usage:
 *   <OTPModal
 *     isOpen={showModal}
 *     onClose={() => setShowModal(false)}
 *     onVerified={(email) => { ... proceed with action ... }}
 *     action="send a service request"
 *     prefillEmail={user?.email}
 *   />
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "";

// ── Digit box ─────────────────────────────────────────────────────────────────
function DigitBox({ value, isFocused, inputRef, onChange, onKeyDown, onPaste, index }) {
  return (
    <motion.input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      maxLength={1}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={value ? { scale: [1, 1.1, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 20 }}
      className={`w-10 h-12 text-center text-xl font-bold rounded-xl border-2 bg-[#0A0E14] text-white outline-none transition-all duration-200 ${
        isFocused
          ? "border-orange-500 shadow-md shadow-orange-500/30"
          : value
          ? "border-orange-500/50"
          : "border-slate-700"
      }`}
    />
  );
}

// ── Animated checkmark ────────────────────────────────────────────────────────
function MiniCheck() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      className="flex flex-col items-center gap-4 py-4"
    >
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-500/30">
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-8 h-8"
        >
          <motion.path
            d="M5 13l4 4L19 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
          />
        </motion.svg>
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-lg">Verified!</p>
        <p className="text-slate-400 text-sm">Continuing…</p>
      </div>
    </motion.div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function OTPModal({ isOpen, onClose, onVerified, action = "continue", prefillEmail = "" }) {
  const [step,      setStep]      = useState("email"); // email | otp | success
  const [email,     setEmail]     = useState(prefillEmail);
  const [digits,    setDigits]    = useState(["", "", "", "", "", ""]);
  const [focused,   setFocused]   = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [countdown, setCountdown] = useState(0);

  const inputRefs = useRef([]);
  const timerRef  = useRef(null);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("email");
      setEmail(prefillEmail);
      setDigits(["", "", "", "", "", ""]);
      setError("");
      setCountdown(0);
    }
  }, [isOpen, prefillEmail]);

  // Countdown
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

  // Focus first digit when OTP step mounts
  useEffect(() => {
    if (step === "otp") setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, [step]);

  function startCountdown() { setCountdown(60); }

  // ── Send OTP ──────────────────────────────────────────────────────────
  async function handleSend() {
    const target = email.trim().toLowerCase();
    if (!target) { setError("Please enter your email address."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API_URL}/otp/send`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send code.");
      setEmail(target);
      setDigits(["", "", "", "", "", ""]);
      setStep("otp");
      startCountdown();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Verify OTP ────────────────────────────────────────────────────────
  async function handleVerifyCode(codeOverride) {
    const code = codeOverride || digits.join("");
    if (code.length < 6) { setError("Please enter all 6 digits."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API_URL}/otp/verify`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid code.");
      setStep("success");
      setTimeout(() => onVerified?.(email), 1600);
    } catch (err) {
      setError(err.message);
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  }

  // ── Digit handlers ────────────────────────────────────────────────────
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
    if (char && index === 5) {
      const full = next.join("");
      if (full.length === 6) setTimeout(() => handleVerifyCode(full), 100);
    }
  }, [digits]); // eslint-disable-line

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits]; next[index] = ""; setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus(); setFocused(index - 1);
      }
    } else if (e.key === "Enter") {
      handleVerifyCode();
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#141920] rounded-t-3xl border-t border-slate-800 px-6 pt-4 pb-10 max-w-lg mx-auto"
          >
            {/* Drag handle */}
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-6" />

            <AnimatePresence mode="wait">
              {/* ── Success ── */}
              {step === "success" && (
                <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <MiniCheck />
                </motion.div>
              )}

              {/* ── Email step ── */}
              {step === "email" && (
                <motion.div key="email" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-lg">
                      🔒
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-base">Verify to {action}</h3>
                      <p className="text-slate-400 text-xs">We'll send a code to your email</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      autoFocus
                      className="w-full bg-[#0A0E14] border border-slate-800 text-white rounded-2xl px-4 py-3.5 text-sm placeholder-slate-600 focus:outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/20 transition-all"
                    />

                    <AnimatePresence>
                      {error && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-400 text-sm">
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <button
                      onClick={handleSend}
                      disabled={loading}
                      className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending…
                        </span>
                      ) : "Send Code →"}
                    </button>

                    <button onClick={onClose} className="w-full py-2 text-slate-500 text-sm hover:text-slate-300 transition-colors">
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── OTP step ── */}
              {step === "otp" && (
                <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-lg">
                      📧
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-base">Enter the code</h3>
                      <p className="text-slate-400 text-xs">Sent to {email}</p>
                    </div>
                  </div>

                  {/* Digit boxes */}
                  <motion.div
                    className="flex justify-center gap-2 mb-5"
                    animate={error ? { x: [-5, 5, -5, 5, 0] } : {}}
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

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 mb-4 text-center"
                      >
                        <p className="text-red-400 text-sm">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={() => handleVerifyCode()}
                    disabled={loading || digits.join("").length < 6}
                    className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-40 mb-3"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Verifying…
                      </span>
                    ) : "Verify →"}
                  </button>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => { setStep("email"); setError(""); setDigits(["","","","","",""]); }}
                      className="text-slate-500 text-sm hover:text-slate-300 transition-colors"
                    >
                      ← Change email
                    </button>
                    {countdown > 0 ? (
                      <p className="text-slate-500 text-sm">
                        Resend in <span className="text-orange-400 font-semibold tabular-nums">{countdown}s</span>
                      </p>
                    ) : (
                      <button
                        onClick={handleSend}
                        disabled={loading}
                        className="text-orange-500 text-sm hover:underline disabled:opacity-50"
                      >
                        Resend code
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
