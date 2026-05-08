/**
 * LoginScreen.jsx
 * Email + password login with 10s timeout, env var check, and full error display.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, isSupabaseConfigured } from "../../utils/supabaseClient";
import { resetPassword } from "../../utils/auth";

const inputCls = "w-full bg-[#0A0E14] border border-slate-800 text-white rounded-2xl px-4 py-3.5 text-sm placeholder-slate-600 focus:outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/20 transition-all";

// Wraps a promise with a timeout
function withTimeout(promise, ms, msg) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(msg)), ms)
    ),
  ]);
}

export default function LoginScreen({ onDone, onBack }) {
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    // Catch misconfigured env vars before even trying
    if (!isSupabaseConfigured) {
      setError(
        "App is not configured correctly. " +
        "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in Vercel environment variables."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: err } = await withTimeout(
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        10000,
        "Request timed out. Please check your internet connection and try again."
      );

      if (err) throw err;
      if (!data?.user) throw new Error("Sign in succeeded but no user was returned. Please try again.");

      const uid = data.user.id;

      // Check vendor status (non-blocking — don't let this hang login)
      try {
        const { data: vendor } = await withTimeout(
          supabase.from("vendors").select("owner_id,name").eq("owner_id", uid).maybeSingle(),
          5000,
          "vendor check timeout"
        );
        if (vendor) {
          localStorage.setItem("sokoni_role",         "vendor");
          localStorage.setItem("sokoni_vendor_id",    uid);
          localStorage.setItem("sokoni_display_name", vendor.name);
        } else {
          localStorage.setItem("sokoni_role",         "consumer");
          localStorage.setItem("sokoni_display_name", data.user.email?.split("@")[0] || "User");
        }
      } catch {
        // Vendor check failed — still let the user in as consumer
        localStorage.setItem("sokoni_role",         "consumer");
        localStorage.setItem("sokoni_display_name", data.user.email?.split("@")[0] || "User");
      }

      // AuthContext onAuthStateChange will pick up the session automatically.
      // Call onDone to close the wizard.
      onDone();

    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("timed out") || msg.includes("fetch") || msg.includes("network")) {
        setError("Connection failed. Check your internet and try again.");
      } else if (msg.includes("Invalid login") || msg.includes("credentials") || msg.includes("invalid")) {
        setError("Incorrect email or password. Please try again.");
      } else if (msg.includes("confirmed") || msg.includes("verify") || msg.includes("not confirmed")) {
        setError("Email not confirmed. Check your inbox for a verification email.");
      } else if (msg.includes("rate") || msg.includes("too many")) {
        setError("Too many attempts. Please wait a minute and try again.");
      } else {
        setError(msg || "Sign in failed. Please try again.");
      }
      console.error("[LoginScreen] Sign in error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!email.trim()) { setError("Enter your email address first."); return; }
    setLoading(true); setError("");
    try {
      await withTimeout(resetPassword(email.trim()), 10000, "Reset request timed out.");
      setResetSent(true);
    } catch (err) {
      setError(err.message || "Failed to send reset email.");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">

        <button onClick={onBack}
          className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-1 active:scale-[0.98] transition-all">
          ← Back
        </button>

        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-40 animate-pulse" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
              🛍️
            </div>
          </div>
          <h1 className="text-white text-2xl font-bold">Welcome back</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your Sokoni account</p>
        </div>

        {/* Env var warning — only shows if misconfigured */}
        {!isSupabaseConfigured && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-2xl p-4 mb-4 text-center">
            <p className="text-red-400 text-xs font-semibold">⚠️ App not configured</p>
            <p className="text-red-300/70 text-xs mt-1">
              Supabase environment variables are missing. Add VITE_SUPABASE_URL and
              VITE_SUPABASE_ANON_KEY in Vercel → Settings → Environment Variables.
            </p>
          </div>
        )}

        {resetSent ? (
          <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-2xl p-5 text-center">
            <p className="text-emerald-400 font-semibold">📧 Reset email sent!</p>
            <p className="text-slate-400 text-xs mt-1">Check your inbox and follow the link.</p>
            <button onClick={() => { setResetSent(false); setResetMode(false); }}
              className="text-orange-500 text-xs mt-3 hover:underline">
              Back to sign in
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="sr-only" htmlFor="login-email">Email</label>
              <input id="login-email" className={inputCls} type="email" placeholder="Email address"
                value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
                autoFocus />
            </div>

            {!resetMode && (
              <div className="relative">
                <label className="sr-only" htmlFor="login-pw">Password</label>
                <input id="login-pw" className={inputCls}
                  type={showPw ? "text" : "password"} placeholder="Password"
                  value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            )}

            <button onClick={() => { setResetMode((v) => !v); setError(""); }}
              className="text-orange-500 text-xs text-right w-full hover:underline">
              {resetMode ? "← Back to sign in" : "Forgot password?"}
            </button>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3"
                >
                  <p className="text-red-400 text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={resetMode ? handleReset : handleLogin}
              disabled={loading || !isSupabaseConfigured}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {resetMode ? "Sending…" : "Signing in…"}
                  </span>
                : resetMode ? "Send Reset Link →" : "Sign In →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
