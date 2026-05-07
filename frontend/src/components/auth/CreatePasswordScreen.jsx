/**
 * CreatePasswordScreen.jsx
 * Step 2 of sign-up: set password → supabase.auth.signUp()
 * Email confirmations must be OFF in Supabase for immediate session.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../utils/supabaseClient";

const inputCls = "w-full bg-[#0A0E14] border border-slate-800 text-white rounded-2xl px-4 py-3.5 text-sm placeholder-slate-600 focus:outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/20 transition-all";

export default function CreatePasswordScreen({ email, onDone, onBack }) {
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  async function handleContinue() {
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true); setError("");
    try {
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      if (err) throw err;

      // Persist basic session info
      const uid = data.user?.id;
      if (uid) {
        localStorage.setItem("sokoni_guest_id", uid);
        localStorage.setItem("sokoni_role", "consumer");
        localStorage.setItem("sokoni_display_name", email.split("@")[0]);
      }
      onDone();
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("already registered") || msg.includes("already exists")) {
        setError("This email is already registered. Please sign in instead.");
      } else {
        setError(msg || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const strength = password.length === 0 ? 0
    : password.length < 8 ? 1
    : password.length < 12 && !/[^a-zA-Z0-9]/.test(password) ? 2
    : 3;
  const strengthLabel = ["", "Weak", "Fair", "Strong"];
  const strengthColor = ["", "bg-red-500", "bg-yellow-500", "bg-emerald-500"];

  return (
    <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">

        <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-1 active:scale-[0.98] transition-all">
          ← Back
        </button>

        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-40 animate-pulse" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
              🔑
            </div>
          </div>
          <h1 className="text-white text-2xl font-bold">Create a password</h1>
          <p className="text-slate-400 text-sm mt-1 text-center">
            For <span className="text-white font-medium">{email}</span>
          </p>
        </div>

        <div className="space-y-3">
          {/* Password */}
          <div className="relative">
            <label className="sr-only" htmlFor="pw">Password</label>
            <input
              id="pw"
              className={inputCls}
              type={showPw ? "text" : "password"}
              placeholder="Password (min. 8 characters)"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>

          {/* Strength bar */}
          {password.length > 0 && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1,2,3].map((n) => (
                  <div key={n} className={`h-1 flex-1 rounded-full transition-all duration-300 ${strength >= n ? strengthColor[strength] : "bg-slate-800"}`} />
                ))}
              </div>
              <p className={`text-xs ${strength === 1 ? "text-red-400" : strength === 2 ? "text-yellow-400" : "text-emerald-400"}`}>
                {strengthLabel[strength]}
              </p>
            </div>
          )}

          {/* Confirm */}
          <div>
            <label className="sr-only" htmlFor="confirm-pw">Confirm password</label>
            <input
              id="confirm-pw"
              className={inputCls}
              type={showPw ? "text" : "password"}
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleContinue()}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-red-400 text-sm">
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            onClick={handleContinue}
            disabled={loading || !password || !confirm}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account…</span>
              : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}
