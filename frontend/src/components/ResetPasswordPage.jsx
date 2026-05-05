/**
 * ResetPasswordPage.jsx
 * Handles password reset links from Supabase emails.
 * User lands here after clicking "Reset Password" in their email.
 */

import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabaseClient";

export default function ResetPasswordPage() {
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [status, setStatus]       = useState("idle"); // idle | loading | success | error
  const [error, setError]         = useState("");
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Supabase picks up the recovery token from the URL hash automatically
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setHasSession(true);
    });
  }, []);

  async function handleReset() {
    if (!password.trim()) { setError("Enter a new password."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setStatus("loading");
    setError("");
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setStatus("success");
      setTimeout(() => { window.location.href = "/"; }, 2500);
    } catch (err) {
      setError(err.message || "Failed to reset password.");
      setStatus("idle");
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-3xl mb-4">
            🔐
          </div>
          <h1 className="text-white font-bold text-2xl">Reset Password</h1>
          <p className="text-gray-400 text-sm mt-1">Enter your new password below</p>
        </div>

        {status === "success" ? (
          <div className="text-center">
            <p className="text-[#25D366] font-semibold text-lg mb-2">✅ Password updated!</p>
            <p className="text-gray-400 text-sm">Taking you back to the app…</p>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full bg-[#161b22] border border-[#30363d] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] placeholder-gray-600"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="w-full bg-[#161b22] border border-[#30363d] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] placeholder-gray-600"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleReset}
              disabled={status === "loading"}
              className="w-full bg-[#25D366] text-[#0d1117] font-bold py-3 rounded-xl text-sm hover:bg-[#128C7E] hover:text-white transition-colors disabled:opacity-50"
            >
              {status === "loading" ? "Updating…" : "Update Password →"}
            </button>
            <button
              onClick={() => window.location.href = "/"}
              className="w-full text-gray-500 text-sm py-2"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
