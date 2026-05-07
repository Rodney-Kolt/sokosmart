/**
 * PhoneAuth.jsx
 * Phone OTP verification via Supabase Auth + Africala SMS.
 *
 * Flow:
 *   1. Phone entry  – +256 pre-selected, user enters local number
 *   2. OTP entry    – six digit boxes, 60s countdown, resend
 *   3. Success      – animated checkmark → onVerified()
 *
 * Props:
 *   onVerified()  – called after successful phone verification
 *   onBack()      – called when user taps ← Back on phone screen
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../utils/supabaseClient";

// ── Country codes ─────────────────────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "+250", flag: "🇷🇼", name: "Rwanda" },
  { code: "+251", flag: "🇪🇹", name: "Ethiopia" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+233", flag: "🇬🇭", name: "Ghana" },
  { code: "+27",  flag: "🇿🇦", name: "South Africa" },
];

// ── Digit box ─────────────────────────────────────────────────────────────────
function DigitBox({ value, isFocused, inputRef, onChange, onKeyDown, onPaste, index }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 20 }}
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
        animate={value ? { scale: [1, 1.12, 1] } : {}}
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

// ── Success checkmark ─────────────────────────────────────────────────────────
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
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
            <motion.path
              d="M5 13l4 4L19 7"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
            />
          </svg>
        </motion.div>
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
        <h2 className="text-white text-2xl font-bold">Phone Verified!</h2>
        <p className="text-slate-400 text-sm mt-1">You're all set.</p>
      </motion.div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PhoneAuth({ onVerified, onBack }) {
  const [screen,    setScreen]    = useState("phone"); // phone | otp | success
  const [country,   setCountry]   = useState(COUNTRY_CODES[0]);
  const [phone,     setPhone]     = useState("");
  const [digits,    setDigits]    = useState(["", "", "", "", "", ""]);
  const [focused,   setFocused]   = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [countdown, setCountdown] = useState(0);
  const [success,   setSuccess]   = useState(false);
  const [showCodes, setShowCodes] = useState(false);

  const inputRefs = useRef([]);
  const timerRef  = useRef(null);

  // Format full phone number: strip leading 0, prepend country code
  const fullPhone = `${country.code}${phone.replace(/^0/, "").replace(/\s/g, "")}`;

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

  // Focus first digit when OTP screen mounts
  useEffect(() => {
    if (screen === "otp") setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, [screen]);

  function startCountdown() { setCountdown(60); }

  // ── Send OTP via Supabase (routed through Africala hook) ──────────────
  async function handleSendCode() {
    const local = phone.replace(/\s/g, "").replace(/^0/, "");
    if (!local || local.length < 7) {
      setError("Please enter a valid phone number.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
        options: { channel: "sms" },
      });
      if (err) throw err;
      setDigits(["", "", "", "", "", ""]);
      setScreen("otp");
      startCountdown();
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("rate") || msg.includes("limit")) {
        setError("Too many attempts. Please wait a minute and try again.");
      } else {
        setError(msg || "Failed to send code. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Verify OTP via Supabase ───────────────────────────────────────────
  async function handleVerifyCode(codeOverride) {
    const token = codeOverride || digits.join("");
    if (token.length < 6) { setError("Please enter all 6 digits."); return; }
    setLoading(true);
    setError("");
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token,
        type: "sms",
      });
      if (err) throw err;
      setSuccess(true);
      setTimeout(() => onVerified?.(), 1800);
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("expired")) {
        setError("Code expired. Please request a new one.");
      } else if (msg.includes("attempts") || msg.includes("rate")) {
        setError("Too many attempts. Please wait 60 seconds.");
      } else {
        setError("Invalid code. Please try again.");
      }
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

  // ── Success screen ────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-[#0A0E14] flex items-center justify-center px-6">
        <SuccessCheck />
      </div>
    );
  }

  // ── Phone entry screen ────────────────────────────────────────────────
  if (screen === "phone") {
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

          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-5">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-40 animate-pulse" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                📱
              </div>
            </div>
            <h1 className="text-white text-2xl font-bold">Verify your phone</h1>
            <p className="text-slate-400 text-sm mt-1 text-center">
              We'll send a 6-digit code via SMS.
            </p>
          </div>

          <div className="space-y-3">
            {/* Phone input row */}
            <div className="flex gap-2">
              {/* Country code picker */}
              <div className="relative">
                <button
                  onClick={() => setShowCodes((v) => !v)}
                  className="h-full px-3 bg-[#0A0E14] border border-slate-800 text-white rounded-2xl flex items-center gap-1.5 text-sm hover:border-orange-500/50 transition-colors whitespace-nowrap focus:outline-none focus:border-orange-500/60"
                >
                  <span>{country.flag}</span>
                  <span className="font-medium">{country.code}</span>
                  <span className="text-slate-500 text-xs">▾</span>
                </button>

                <AnimatePresence>
                  {showCodes && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-1 w-52 bg-[#141920] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl z-50"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => { setCountry(c); setShowCodes(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-800/50 transition-colors ${
                            country.code === c.code ? "text-orange-400 bg-orange-500/5" : "text-slate-300"
                          }`}
                        >
                          <span className="text-lg">{c.flag}</span>
                          <span className="flex-1 text-left">{c.name}</span>
                          <span className="text-slate-500">{c.code}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Number input */}
              <input
                type="tel"
                placeholder="7XX XXX XXX"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                autoFocus
                className="flex-1 bg-[#0A0E14] border border-slate-800 text-white rounded-2xl px-4 py-3.5 text-sm placeholder-slate-600 focus:outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
            </div>

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
              onClick={handleSendCode}
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

  // ── OTP entry screen ──────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-6"
    >
      <div className="w-full max-w-sm">
        <button
          onClick={() => { setScreen("phone"); setError(""); setDigits(["","","","","",""]); }}
          className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-1"
        >
          ← Back
        </button>

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-5">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-40 animate-pulse" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
              💬
            </div>
          </div>
          <h1 className="text-white text-2xl font-bold">Enter the code</h1>
          <p className="text-slate-400 text-sm mt-1 text-center">
            Sent via SMS to{" "}
            <span className="text-white font-medium">{fullPhone}</span>
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
          onClick={() => handleVerifyCode()}
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
              onClick={handleSendCode}
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
