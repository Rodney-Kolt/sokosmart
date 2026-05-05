/**
 * ProfileScreen.jsx
 * Shows different content based on auth state:
 *   - Guest: name card + upgrade prompt
 *   - Vendor: business info + dashboard button + logout
 *   - Not set up: sign in / register prompt
 */

import React, { useState } from "react";
import { supabase } from "../utils/supabaseClient";
import Onboarding from "./Onboarding";

export default function ProfileScreen({ onNavigateDashboard }) {
  const role        = localStorage.getItem("sokoni_role");
  const displayName = localStorage.getItem("sokoni_display_name") || "Guest";
  const vendorId    = localStorage.getItem("sokoni_vendor_id");

  const [showOnboarding, setShowOnboarding] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    localStorage.removeItem("sokoni_role");
    localStorage.removeItem("sokoni_vendor_id");
    localStorage.removeItem("sokoni_display_name");
    localStorage.removeItem("sokoni_guest_id");
    window.location.reload();
  }

  // ── Onboarding modal overlay ──────────────────────────────────────────
  if (showOnboarding) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Close button */}
        <button
          onClick={() => setShowOnboarding(false)}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-[#30363d] flex items-center justify-center text-gray-300 hover:text-white"
        >
          ✕
        </button>
        {/* Render Onboarding but intercept navigation */}
        <OnboardingWrapper onClose={() => setShowOnboarding(false)} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0d1117]">

      {/* Header */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-4">
        <h1 className="text-white font-bold text-lg">Profile</h1>
      </div>

      <div className="px-4 py-6 space-y-4">

        {/* ── Vendor profile ─────────────────────────────────────────── */}
        {role === "vendor" && (
          <>
            {/* Avatar card */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold text-base">{displayName}</p>
                <span className="inline-flex items-center gap-1 bg-[#25D366]/10 text-[#25D366] text-xs px-2 py-0.5 rounded-full border border-[#25D366]/30 mt-1">
                  🏪 Vendor
                </span>
              </div>
            </div>

            {/* Vendor dashboard button */}
            <button
              onClick={onNavigateDashboard}
              className="w-full flex items-center gap-3 bg-[#161b22] border border-[#30363d] hover:border-[#25D366] rounded-2xl p-4 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center text-xl">
                📬
              </div>
              <div className="flex-1">
                <p className="text-white font-medium text-sm">Vendor Dashboard</p>
                <p className="text-gray-500 text-xs mt-0.5">View requests & reply to customers</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" className="w-4 h-4">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 bg-[#161b22] border border-[#30363d] hover:border-red-500/50 rounded-2xl p-4 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-xl">
                🚪
              </div>
              <div>
                <p className="text-red-400 font-medium text-sm">Sign Out</p>
                <p className="text-gray-500 text-xs mt-0.5">Log out of your vendor account</p>
              </div>
            </button>
          </>
        )}

        {/* ── Guest profile ──────────────────────────────────────────── */}
        {role === "consumer" && (
          <>
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#30363d] flex items-center justify-center text-2xl">
                👤
              </div>
              <div>
                <p className="text-white font-semibold text-base">{displayName}</p>
                <span className="inline-flex items-center gap-1 bg-gray-700/50 text-gray-400 text-xs px-2 py-0.5 rounded-full border border-gray-600/30 mt-1">
                  Guest
                </span>
              </div>
            </div>

            {/* Upgrade prompt */}
            <div className="bg-gradient-to-br from-[#0d2818] to-[#0d1117] border border-[#25D366]/30 rounded-2xl p-5">
              <p className="text-white font-semibold text-sm mb-1">Sell on Sokoni?</p>
              <p className="text-gray-400 text-xs mb-4 leading-relaxed">
                Create a vendor account to list your business and receive customer requests.
              </p>
              <button
                onClick={() => setShowOnboarding(true)}
                className="w-full bg-[#25D366] text-[#0d1117] font-semibold py-2.5 rounded-xl text-sm hover:bg-[#128C7E] hover:text-white transition-colors"
              >
                Register as Vendor →
              </button>
            </div>

            {/* Sign out guest */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 bg-[#161b22] border border-[#30363d] hover:border-red-500/50 rounded-2xl p-4 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-xl">
                🚪
              </div>
              <div>
                <p className="text-red-400 font-medium text-sm">Clear Session</p>
                <p className="text-gray-500 text-xs mt-0.5">Reset guest data and start fresh</p>
              </div>
            </button>
          </>
        )}

        {/* ── Not set up ─────────────────────────────────────────────── */}
        {!role && (
          <>
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 text-center">
              <div className="text-5xl mb-3">👋</div>
              <h2 className="text-white font-bold text-lg mb-1">Welcome to Sokoni</h2>
              <p className="text-gray-400 text-sm mb-5 leading-relaxed">
                Sign in or create an account to get the most out of your local marketplace.
              </p>
              <button
                onClick={() => setShowOnboarding(true)}
                className="w-full bg-[#25D366] text-[#0d1117] font-semibold py-3 rounded-xl text-sm hover:bg-[#128C7E] hover:text-white transition-colors"
              >
                Get Started →
              </button>
            </div>
          </>
        )}

        {/* App info footer */}
        <div className="text-center pt-4 pb-2">
          <p className="text-gray-600 text-xs">Sokoni Chat v1.0</p>
          <p className="text-gray-700 text-xs mt-0.5">Hyperlocal. Private. Yours.</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Wraps Onboarding and intercepts the navigate("/chat") and navigate("/dashboard")
 * calls so they don't break the single-page tab layout.
 */
function OnboardingWrapper({ onClose }) {
  // We monkey-patch localStorage writes to detect when onboarding completes
  // then call onClose to return to the profile tab.
  // The simplest approach: just render Onboarding and let it navigate normally —
  // the user will land on /chat or /dashboard which still works via the router.
  // For the tab-based layout, we just close the modal on role set.
  React.useEffect(() => {
    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      orig(key, value);
      if (key === "sokoni_role") {
        // Role was set — onboarding completed, close modal after a tick
        setTimeout(onClose, 100);
      }
    };
    return () => { localStorage.setItem = orig; };
  }, [onClose]);

  return (
    <div className="flex-1 overflow-y-auto">
      <Onboarding />
    </div>
  );
}
