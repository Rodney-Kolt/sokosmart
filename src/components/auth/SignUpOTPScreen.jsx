/**
 * SignUpOTPScreen.jsx
 * Step 1 of sign-up: email entry → OTP verification via custom backend.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "";

const inputCls = "w-full bg-[#0A0E14] border border-slate-800 text-white rounded-2xl px-4 py-3.5 text-sm placeholder-slate-600 focus:outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/20 transition-all";

// ── Digit box ─────────────────────────────────────────────────────────────────
function DigitBox({ value, isFocused, inputRef, onChange, onKeyDown, onPaste, index }) {
  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 320, damping: 22 }}
    >
      <motion.input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        maxLength={1}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        aria-label={`Digit ${index + 1}`}
        animate={value ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 0.15 }}
        className={`w-12 h-14 text-center text-2xl font-bold rounded-2xl border-2 bg-[#141920] text-white outline-none transition-all duration-200 ${
          isFocused
            ? "border-orange-500 shadow-lg shadow-orange-500/30"
            : value
            ? "border-orange-500/50 bg-orange-500/5"
            : "border-slate-700"
        }`}
      />
    </motion.div>
  );
}

export default function SignUpOTPScreen({ onVerified, onBack }) {
  const [screen,    setScreen]    = useState("email"); // email | otp
  const [email,     setEmail]     = useState("");
  const [digits,    setDigits]    = useState(["","","","","",""]);
  const [focused,   setFocused]   = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [countdown, setCountdown] = useState(0);

  const inputRefs = useRef([]);
  const timerRef  = useRef(null);

  useEffect(() => {
    if (countdown <= 0) return;
    timerRef.current = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { clearInterval(timerRef.current); return 0; } return c - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [countdown]);

  useEffect(() => {
    if (screen === "otp") setTimeout(() => inputRefs.current[0]?.focus(), 120);
  }, [screen]);

  function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

  async function handleSend(isResend = false) {
    const target = email.trim().toLowerCase();
    if (!isValidEmail(target)) { setError("Please enter a valid email address."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API_URL}/otp/send`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send code.");
      if (isResend) {
        setDigits(["","","","","",""]); setTimeout(() => inputRefs.current[0]?.focus(), 50);
      } else { setScreen("otp"); }
      setCountdown(60);
    } catch (err) {
      setError(err.message.includes("wait") ? "Please wait before requesting a new code." : err.message);
    } finally { setLoading(false); }
  }

  async function handleVerify(codeOverride) {
    const code = codeOverride || digits.join("");
    if (code.length < 6) { setError("Please enter all 6 digits."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch(`${API_URL}/otp/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid code.");
      onVerified(email.trim().toLowerCase());
    } catch (err) {
      setError(err.message);
      setDigits(["","","","","",""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally { setLoading(false); }
  }

  const handleDigitChange = useCallback((i, val) => {
    const char = val.replace(/\D/g, "").slice(-1);
    const next = [...digits]; next[i] = char; setDigits(next); setError("");
    if (char && i < 5) { inputRefs.current[i + 1]?.focus(); setFocused(i + 1); }
    if (char && i === 5 && next.join("").length === 6) setTimeout(() => handleVerify(next.join("")), 80);
  }, [digits]); // eslint-disable-line

  const handleKeyDown = useCallback((i, e) => {
    if (e.key === "Backspace") {
      if (digits[i]) { const n = [...digits]; n[i] = ""; setDigits(n); }
      else if (i > 0) { inputRefs.current[i - 1]?.focus(); setFocused(i - 1); }
    } else if (e.key === "Enter") handleVerify();
  }, [digits]); // eslint-disable-line

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!p) return;
    const next = ["","","","","",""];
    p.split("").forEach((c, i) => { next[i] = c; });
    setDigits(next);
    const last = Math.min(p.length, 5);
    inputRefs.current[last]?.focus(); setFocused(last);
    if (p.length === 6) setTimeout(() => handleVerify(p), 80);
  }, []); // eslint-disable-line

  return (
    <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">

        {/* Back */}
        <button onClick={screen === "otp" ? () => { setScreen("email"); setError(""); setDigits(["","","","","",""]); } : onBack}
          className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-1 active:scale-[0.98] transition-all">
          ← Back
        </button>

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-40 animate-pulse" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
              {screen === "email" ? "📧" : "🔐"}
            </div>
          </div>
          <h1 className="text-white text-2xl font-bold">
            {screen === "email" ? "Create your account" : "Enter the code"}
          </h1>
          <p className="text-slate-400 text-sm mt-1 text-center">
            {screen === "email"
              ? "We'll send a 6-digit code to verify your email."
              : <>Sent to <span className="text-white font-medium">{email}</span></>}
          </p>
        </div>

        {/* Email step */}
        {screen === "email" && (
          <div className="space-y-3">
            <label className="sr-only" htmlFor="signup-email">Email address</label>
            <input
              id="signup-email"
              className={inputCls}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              autoFocus
            />
            <AnimatePresence>
              {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 text-sm">{error}</motion.p>}
            </AnimatePresence>
            <button onClick={() => handleSend()} disabled={loading || !email.trim()}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50">
              {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</span> : "Send Verification Code →"}
            </button>
          </div>
        )}

        {/* OTP step */}
        {screen === "otp" && (
          <div className="space-y-5">
            <motion.div
              className="flex justify-center gap-2"
              animate={error ? { x: [-6, 6, -6, 6, 0] } : {}}
              transition={{ duration: 0.3 }}
            >
              {digits.map((d, i) => (
                <DigitBox key={i} index={i} value={d} isFocused={focused === i}
                  inputRef={(el) => (inputRefs.current[i] = el)}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                />
              ))}
            </motion.div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-center">
                  <p className="text-red-400 text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button onClick={() => handleVerify()} disabled={loading || digits.join("").length < 6}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40">
              {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying…</span> : "Verify Code →"}
            </button>

            <div className="text-center">
              {countdown > 0
                ? <p className="text-slate-500 text-sm">Resend in <span className="text-orange-400 font-semibold tabular-nums">{countdown}s</span></p>
                : <button onClick={() => handleSend(true)} disabled={loading} className="text-orange-500 text-sm hover:underline disabled:opacity-50">Resend code</button>
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
