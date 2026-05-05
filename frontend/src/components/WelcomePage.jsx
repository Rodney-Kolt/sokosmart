/**
 * WelcomePage.jsx
 * Handles email confirmation redirects from Supabase.
 * Supabase appends #access_token=... to the URL after email verification.
 * This page reads the session, stores it, and redirects to the app.
 */

import React, { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { getSession } from "../utils/auth";

export default function WelcomePage() {
  const [status, setStatus] = useState("verifying"); // verifying | success | error

  useEffect(() => {
    async function handleRedirect() {
      try {
        // Wait a tick for Supabase to process the URL hash token
        await new Promise((r) => setTimeout(r, 500));
        const session = await getSession();

        if (session) {
          const user = session.user;
          // Check if this user is a vendor
          const { data: vendor } = await supabase
            .from("vendors")
            .select("owner_id, name")
            .eq("owner_id", user.id)
            .single();

          if (vendor) {
            localStorage.setItem("sokoni_role", "vendor");
            localStorage.setItem("sokoni_vendor_id", user.id);
            localStorage.setItem("sokoni_display_name", vendor.name);
          }

          setStatus("success");
          setTimeout(() => { window.location.href = "/"; }, 2000);
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    }

    handleRedirect();
  }, []);

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-4xl mb-6 shadow-xl">
        🛍️
      </div>

      {status === "verifying" && (
        <>
          <h1 className="text-white font-bold text-2xl mb-2">Verifying your account…</h1>
          <p className="text-gray-400 text-sm">Just a moment</p>
          <div className="flex gap-2 mt-6">
            <div className="typing-dot" style={{ background: "#25D366" }} />
            <div className="typing-dot" style={{ background: "#25D366" }} />
            <div className="typing-dot" style={{ background: "#25D366" }} />
          </div>
        </>
      )}

      {status === "success" && (
        <>
          <h1 className="text-white font-bold text-2xl mb-2">✅ Email verified!</h1>
          <p className="text-gray-400 text-sm mb-4">Welcome to Sokoni Chat. Taking you to the app…</p>
          <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
        </>
      )}

      {status === "error" && (
        <>
          <h1 className="text-white font-bold text-2xl mb-2">⚠️ Verification failed</h1>
          <p className="text-gray-400 text-sm mb-6">The link may have expired. Please try signing in again.</p>
          <button
            onClick={() => window.location.href = "/"}
            className="bg-[#25D366] text-[#0d1117] font-bold px-6 py-3 rounded-xl"
          >
            Go to App →
          </button>
        </>
      )}
    </div>
  );
}
