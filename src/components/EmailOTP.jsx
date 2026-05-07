/**
 * EmailOTP.jsx
 * Passwordless email sign-in via custom backend OTP (Brevo API).
 * Uses /otp/send and /otp/verify on the FastAPI backend.
 * After verification, signs into Supabase with email+password fallback
 * or simply calls onVerified() for guest-style session handling.
 *
 * Flow:
 *   1. Email entry  – user types email, hits "Send Code"
 *   2. OTP entry    – six digit boxes, 60s countdown, resend with toast
 *   3. Success      – animated checkmark → onVerified()
 *
 * Props:
 *   onVerified()  – called after successful verification
 *   onBack()      – called when user taps ← Back on email screen
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../utils/supabaseClient";

const API_URL = import.meta.env.VITE_API_URL || "";

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
        <h2 className="text-white text-2xl font-bold">Verified!</h2>
        <p className="text-slate-400 text-sm mt-1">You're signed in.</p>
      </motion.div>
    </motion.div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-sm font-medium px-5 py-2.5 rounded-2xl shadow-xl z-50 whitespace-nowrap"
        >
          ✓ {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EmailOTP({ onVerified, onBack }) {
  const [screen,    setScreen]    = useState("email");
  const [email,     setEmail]     = useState("");
  const [digits,    setDigits]    = useState(["", "", "", "", "", ""]);
  const [focused,   setFocused]   = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [countdown, setCountdown] = useState(0);
  const [success,   setSuccess]   = useState(false);
  const [toast,     setToast]     = useState(false);

  const inputRefs = useRef([]);
  const timerRef  = useRef(null);
  const toastRef  = useRef(null);

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

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(false), 2500);
  }

  function isValidEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  // ── Send OTP via custom backend (Brevo API) ──────────────────────────
  async function handleSendCode(isResend = false) {
    const target = email.trim().toLowerCase();
    if (!target || !isValidEmail(target)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`${API_URL}/otp/send`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send code.");

      if (isResend) {
        showToast("Code resent!");
        setDigits(["", "", "", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      } else {
        setScreen("otp");
      }
      startCountdown();
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("wait") || msg.includes("429")) {
        setError("Please wait before requesting a new code.");
      } else {
        setError(msg || "Failed to send code. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Verify OTP via custom backend, then sync Supabase session ────────
  async function handleVerifyCode(codeOverride) {
    const token = codeOverride || digits.join("");
    if (token.length < 6) { setError("Please enter all 6 digits."); return; }
    setLoading(true);
    setError("");
    try {
      // 1. Verify code against our backend
      const res  = await fetch(`${API_URL}/otp/verify`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), code: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid code.");

      // 2. Code is valid — persist email for session, check vendor status
      const target = email.trim().toLowerCase();
      localStorage.setItem("sokoni_verified_email", target);

      const { data: vendor } = await supabase
        .from("vendors")
        .select("owner_id, name")
        .eq("owner_id", target)   // try by email as fallback
        .maybeSingle();

      // Try to find user by email in vendors table via owner lookup
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (uid) {
        const { data: vendorByUid } = await supabase
          .from("vendors")
          .select("owner_id, name")
          .eq("owner_id", uid)
          .maybeSingle();
        if (vendorByUid) {
          localStorage.setItem("sokoni_role",         "vendor");
          localStorage.setItem("sokoni_vendor_id",    uid);
          localStorage.setItem("sokoni_display_name", vendorByUid.name);
        } else {
          localStorage.setItem("sokoni_role",         "consumer");
          localStorage.setItem("sokoni_display_name", target.split("@")[0]);
        }
      } else {
        // No Supabase session yet — set as consumer, session will be created on next login
        localStorage.setItem("sokoni_role",         "consumer");
        localStorage.setItem("sokoni_display_name", target.split("@")[0]);
        // Create a guest-style ID so the app can function
        if (!localStorage.getItem("sokoni_guest_id")) {
          const { v4: uuidv4 } = await import("uuid");
          localStorage.setItem("sokoni_guest_id", uuidv4());
        }
      }

      setSuccess(true);
      setTimeout(() => onVerified?.(), 1800);
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("expired")) {
        setError("Code expired. Please request a new one.");
      } else if (msg.includes("attempts") || msg.includes("wait")) {
        setError("Too many attempts. Please wait 60 seconds.");
      } else {
        setError(msg || "Invalid code. Please try again.");
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

  // ── Success ───────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex items-center justify-center py-16">
        <SuccessCheck />
      </div>
    );
  }

  // ── Email entry ───────────────────────────────────────────────────────
  if (screen === "email") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
          autoFocus
          className="w-full bg-[#0A0E14] border border-slate-800 text-white rounded-2xl px-4 py-3.5 text-sm placeholder-slate-600 focus:outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/20 transition-all"
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
          onClick={() => handleSendCode(false)}
          disabled={loading || !email.trim()}
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
      </motion.div>
    );
  }

  // ── OTP entry ─────────────────────────────────────────────────────────
  return (
    <>
      <Toast message={toast} visible={!!toast} />

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-4"
      >
        {/* Info */}
        <div className="text-center">
          <p className="text-slate-400 text-sm">
            Code sent to{" "}
            <span className="text-white font-medium">{email}</span>
          </p>
          <button
            onClick={() => { setScreen("email"); setError(""); setDigits(["","","","","",""]); }}
            className="text-orange-500 text-xs hover:underline mt-0.5"
          >
            Change email
          </button>
        </div>

        {/* Digit boxes */}
        <motion.div
          className="flex justify-center gap-2"
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
              className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-center"
            >
              <p className="text-red-400 text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verify button */}
        <button
          onClick={() => handleVerifyCode()}
          disabled={loading || digits.join("").length < 6}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-40"
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
              Resend in{" "}
              <span className="text-orange-400 font-semibold tabular-nums">{countdown}s</span>
            </p>
          ) : (
            <button
              onClick={() => handleSendCode(true)}
              disabled={loading}
              className="text-orange-500 text-sm hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}
