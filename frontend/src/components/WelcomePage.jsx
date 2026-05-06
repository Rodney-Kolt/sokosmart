/**
 * WelcomePage.jsx
 * Handles email confirmation links from Supabase/Brevo.
 *
 * Supabase sends links in two formats:
 *   1. Hash-based:  /welcome#access_token=...&type=signup
 *   2. Query-based: /welcome?token_hash=...&type=email
 *
 * We try verifyOtp first (query params), then fall back to getSession (hash).
 */

import React, { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

const REDIRECT_BASE = import.meta.env.VITE_REDIRECT_URL || "https://sokosmart-two.vercel.app";

export default function WelcomePage() {
  const [status,    setStatus]    = useState("verifying"); // verifying | success | error
  const [email,     setEmail]     = useState("");
  const [resending, setResending] = useState(false);
  const [resent,    setResent]    = useState(false);

  useEffect(() => {
    async function verify() {
      try {
        // ── Method 1: token_hash in query string (Supabase v2 PKCE flow) ──
        const params     = new URLSearchParams(window.location.search);
        const tokenHash  = params.get("token_hash");
        const type       = params.get("type") || "email";

        if (tokenHash) {
          const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (error) throw error;
          if (data.session) {
            await syncUser(data.session);
            setStatus("success");
            setTimeout(() => { window.location.href = "/"; }, 2000);
            return;
          }
        }

        // ── Method 2: access_token in URL hash (legacy flow) ─────────────
        await new Promise((r) => setTimeout(r, 600)); // let Supabase parse hash
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          await syncUser(sessionData.session);
          setStatus("success");
          setTimeout(() => { window.location.href = "/"; }, 2000);
          return;
        }

        setStatus("error");
      } catch (err) {
        console.error("WelcomePage verify error:", err);
        setStatus("error");
      }
    }

    verify();
  }, []);

  async function syncUser(session) {
    const uid = session.user.id;
    setEmail(session.user.email || "");
    const { data: vendor } = await supabase
      .from("vendors").select("owner_id, name").eq("owner_id", uid).single();
    if (vendor) {
      localStorage.setItem("sokoni_role",         "vendor");
      localStorage.setItem("sokoni_vendor_id",    uid);
      localStorage.setItem("sokoni_display_name", vendor.name);
    } else {
      if (!localStorage.getItem("sokoni_role")) {
        localStorage.setItem("sokoni_role", "consumer");
      }
      localStorage.setItem("sokoni_guest_id", uid);
    }
  }

  async function handleResend() {
    const userEmail = email || prompt("Enter your email address:");
    if (!userEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type:  "signup",
        email: userEmail,
        options: { emailRedirectTo: `${REDIRECT_BASE}/welcome` },
      });
      if (error) throw error;
      setResent(true);
    } catch (err) {
      alert(err.message || "Failed to resend. Try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-6 text-center">

      {/* Logo */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-40 animate-pulse" />
        <div className="relative w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center text-4xl shadow-xl">
          🛍️
        </div>
      </div>

      {/* Verifying */}
      {status === "verifying" && (
        <>
          <h1 className="text-white font-bold text-2xl mb-2 font-display">Verifying your email…</h1>
          <p className="text-slate-400 text-sm mb-8">Just a moment</p>
          <div className="flex gap-2">
            {[0,1,2].map((i) => (
              <div key={i} className="w-3 h-3 bg-orange-500 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </>
      )}

      {/* Success */}
      {status === "success" && (
        <>
          <h1 className="text-white font-bold text-2xl mb-2 font-display">
            Your email has been verified! 🎉
          </h1>
          <p className="text-slate-400 text-sm mb-6">
            Welcome to Sokoni Chat. Taking you to the app…
          </p>
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </>
      )}

      {/* Error */}
      {status === "error" && (
        <>
          <h1 className="text-white font-bold text-2xl mb-2 font-display">Link expired</h1>
          <p className="text-slate-400 text-sm mb-6 max-w-xs leading-relaxed">
            This confirmation link is invalid or has expired.
            Request a new one below.
          </p>

          {resent ? (
            <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-2xl px-5 py-4 mb-4 max-w-xs">
              <p className="text-emerald-400 font-semibold text-sm">📧 New email sent!</p>
              <p className="text-slate-400 text-xs mt-1">Check your inbox and click the link.</p>
            </div>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full max-w-xs py-3.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl text-sm shadow-lg shadow-orange-500/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 mb-3"
            >
              {resending ? "Sending…" : "Resend Confirmation Email"}
            </button>
          )}

          <button
            onClick={() => window.location.href = "/"}
            className="w-full max-w-xs py-3 bg-[#141920] border border-slate-800 text-slate-400 rounded-2xl text-sm hover:border-slate-600 transition-all"
          >
            Back to App
          </button>
        </>
      )}
    </div>
  );
}
