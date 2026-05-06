/**
 * ProfileScreen.jsx – Enhanced profile for both consumers and vendors.
 *
 * Views:
 *   "my"      – current user's own profile (stats, settings, dashboard links)
 *   "public"  – another user's profile (follow button, listings grid)
 *   "notifs"  – notifications overlay
 *   "listings"– vendor's listing management
 *   "insights"– vendor analytics
 */

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";
import Onboarding from "./Onboarding";
import NotificationsScreen from "./NotificationsScreen";
import MyListings from "./MyListings";
import Insights from "./Insights";
import { useAuth } from "../context/AuthContext";
import {
  getFollowers, getFollowing,
  getVendorListings,
  getNotificationCount, subscribeToNotifications,
} from "../utils/api";

const REDIRECT_BASE = import.meta.env.VITE_REDIRECT_URL || "https://sokosmart-two.vercel.app";

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 bg-[#161b22] border border-[#30363d] rounded-2xl py-3 px-2 text-center hover:border-[#25D366] transition-colors"
    >
      <p className="text-white font-bold text-xl">{value ?? "–"}</p>
      <p className="text-gray-500 text-xs mt-0.5">{label}</p>
    </button>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────
function Avatar({ name, size = "lg", isOnline = false }) {
  const sz = size === "lg" ? "w-20 h-20 text-3xl" : "w-12 h-12 text-lg";
  return (
    <div className="relative inline-block">
      <div className={`${sz} rounded-full bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center font-bold text-white`}>
        {name?.charAt(0)?.toUpperCase() || "?"}
      </div>
      {isOnline && (
        <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-[#0d1117]" />
      )}
    </div>
  );
}

export default function ProfileScreen({ onNavigateDashboard }) {
  const { user, signOutAll } = useAuth();
  const role        = localStorage.getItem("sokoni_role");
  const displayName = localStorage.getItem("sokoni_display_name") || "Guest";
  const vendorId    = localStorage.getItem("sokoni_vendor_id");
  const userId      = localStorage.getItem("sokoni_guest_id") || vendorId || "";

  const [view, setView]                 = useState("my");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [followers, setFollowers]       = useState(0);
  const [following, setFollowing]       = useState(0);
  const [notifCount, setNotifCount]     = useState(0);
  const [listings, setListings]         = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailResent,    setEmailResent]    = useState(false);

  // Is email unconfirmed?
  const emailUnconfirmed = user && !user.email_confirmed_at && !user.confirmed_at;

  async function handleResendConfirmation() {
    if (!user?.email) return;
    setResendingEmail(true);
    try {
      await supabase.auth.resend({
        type: "signup",
        email: user.email,
        options: { emailRedirectTo: `${REDIRECT_BASE}/welcome` },
      });
      setEmailResent(true);
    } catch { /* silent */ } finally {
      setResendingEmail(false);
    }
  }

  // ── Load stats ────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    if (!userId) return;
    setLoadingStats(true);
    try {
      // Load each stat independently so one failure doesn't block the rest
      const [frs, fng, nc] = await Promise.allSettled([
        getFollowers(userId),
        getFollowing(userId),
        getNotificationCount(userId),
      ]);
      if (frs.status === "fulfilled") setFollowers(frs.value?.count || 0);
      if (fng.status === "fulfilled") setFollowing(fng.value?.count || 0);
      if (nc.status  === "fulfilled") setNotifCount(nc.value || 0);

      if (role === "vendor" && vendorId) {
        try {
          const ls = await getVendorListings(vendorId, "active");
          setListings(ls);
        } catch { /* listings table may not exist yet */ }
      }
    } catch { /* silent */ } finally {
      setLoadingStats(false);
    }
  }, [userId, role, vendorId]);

  useEffect(() => {
    loadStats();
    // Subscribe to realtime notifications for badge
    if (!userId) return;
    let unsub = () => {};
    try {
      unsub = subscribeToNotifications(userId, () => {
        setNotifCount((c) => c + 1);
      });
    } catch { /* realtime not available */ }
    return unsub;
  }, [userId, loadStats]);

  async function handleSignOut() {
    await signOutAll();
    window.location.reload();
  }

  // ── Sub-screens ───────────────────────────────────────────────────────
  if (showOnboarding) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <button onClick={() => setShowOnboarding(false)} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-[#30363d] flex items-center justify-center text-gray-300">✕</button>
        <OnboardingWrapper onClose={() => { setShowOnboarding(false); loadStats(); }} />
      </div>
    );
  }

  if (view === "notifs") {
    return <NotificationsScreen onClose={() => { setView("my"); setNotifCount(0); }} />;
  }

  if (view === "listings" && vendorId) {
    return <MyListings vendorId={vendorId} onClose={() => { setView("my"); loadStats(); }} />;
  }

  if (view === "insights" && vendorId) {
    return <Insights vendorId={vendorId} onClose={() => setView("my")} />;
  }

  // ── Main profile view ─────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-[#0d1117]">

      {/* Header */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-3 flex items-center justify-between">
        <h1 className="text-white font-bold text-lg">Profile</h1>
        <div className="flex items-center gap-2">
          {/* Notifications bell */}
          <button
            onClick={() => setView("notifs")}
            className="relative w-9 h-9 rounded-full bg-[#0d1117] flex items-center justify-center text-gray-400 hover:text-white"
          >
            🔔
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 badge-pulse">
                {notifCount > 99 ? "99+" : notifCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">

        {/* ── Unconfirmed email banner ───────────────────────────────── */}
        {emailUnconfirmed && (
          <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-2xl p-4">
            <p className="text-yellow-300 font-semibold text-sm mb-1">📧 Email not confirmed</p>
            <p className="text-yellow-200/70 text-xs mb-3 leading-relaxed">
              Check your inbox for a confirmation email from Sokoni Chat.
            </p>
            {emailResent ? (
              <p className="text-emerald-400 text-xs font-medium">✅ New email sent! Check your inbox.</p>
            ) : (
              <button
                onClick={handleResendConfirmation}
                disabled={resendingEmail}
                className="text-orange-400 text-xs font-semibold underline hover:text-orange-300 disabled:opacity-50"
              >
                {resendingEmail ? "Sending…" : "Resend confirmation email"}
              </button>
            )}
          </div>
        )}

        {/* ── Avatar + name ─────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <Avatar name={displayName} size="lg" isOnline={role === "vendor"} />
          <div className="flex-1">
            <p className="text-white font-bold text-lg leading-tight">{displayName}</p>
            <div className="flex items-center gap-2 mt-1">
              {role === "vendor" && (
                <span className="inline-flex items-center gap-1 bg-[#25D366]/10 text-[#25D366] text-xs px-2 py-0.5 rounded-full border border-[#25D366]/30">
                  🏪 Vendor
                </span>
              )}
              {role === "consumer" && (
                <span className="inline-flex items-center gap-1 bg-gray-700/50 text-gray-400 text-xs px-2 py-0.5 rounded-full border border-gray-600/30">
                  👤 Consumer
                </span>
              )}
              {localStorage.getItem("sokoni_lat") && (
                <span className="inline-flex items-center gap-1 bg-blue-900/30 text-blue-400 text-xs px-2 py-0.5 rounded-full border border-blue-700/30">
                  📍 Verified Neighbour
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────────────────────── */}
        {userId && (
          <div className="flex gap-2">
            <StatCard label="Following" value={following} onClick={() => {}} />
            <StatCard label="Followers" value={followers} onClick={() => {}} />
            <StatCard label="Listings"  value={listings.length} onClick={() => role === "vendor" && setView("listings")} />
          </div>
        )}

        {/* ── Vendor actions ─────────────────────────────────────────── */}
        {role === "vendor" && (
          <>
            <button
              onClick={onNavigateDashboard}
              className="w-full flex items-center gap-3 bg-[#161b22] border border-[#30363d] hover:border-[#25D366] rounded-2xl p-4 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center text-xl">📬</div>
              <div className="flex-1">
                <p className="text-white font-medium text-sm">Vendor Dashboard</p>
                <p className="text-gray-500 text-xs mt-0.5">Messages, orders & status</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" className="w-4 h-4"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>

            <button
              onClick={() => setView("listings")}
              className="w-full flex items-center gap-3 bg-[#161b22] border border-[#30363d] hover:border-[#25D366] rounded-2xl p-4 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-900/30 flex items-center justify-center text-xl">🛍️</div>
              <div className="flex-1">
                <p className="text-white font-medium text-sm">My Listings</p>
                <p className="text-gray-500 text-xs mt-0.5">Manage products & services</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" className="w-4 h-4"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>

            <button
              onClick={() => setView("insights")}
              className="w-full flex items-center gap-3 bg-[#161b22] border border-[#30363d] hover:border-[#25D366] rounded-2xl p-4 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-900/30 flex items-center justify-center text-xl">📊</div>
              <div className="flex-1">
                <p className="text-white font-medium text-sm">Insights & Analytics</p>
                <p className="text-gray-500 text-xs mt-0.5">Views, followers, rank</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" className="w-4 h-4"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </>
        )}

        {/* ── Consumer upgrade prompt ────────────────────────────────── */}
        {role === "consumer" && (
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
        )}

        {/* ── Not set up ─────────────────────────────────────────────── */}
        {!role && (
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
        )}

        {/* ── Sign out ───────────────────────────────────────────────── */}
        {role && (
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 bg-[#161b22] border border-[#30363d] hover:border-red-500/50 rounded-2xl p-4 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-xl">🚪</div>
            <div>
              <p className="text-red-400 font-medium text-sm">{role === "consumer" ? "Clear Session" : "Sign Out"}</p>
              <p className="text-gray-500 text-xs mt-0.5">Log out of your account</p>
            </div>
          </button>
        )}

        <div className="text-center pt-2 pb-4">
          <p className="text-gray-700 text-xs">Sokoni Chat v2.0 · Hyperlocal. Private. Yours.</p>
        </div>
      </div>
    </div>
  );
}

function OnboardingWrapper({ onClose }) {
  React.useEffect(() => {
    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      orig(key, value);
      if (key === "sokoni_role") setTimeout(onClose, 100);
    };
    return () => { localStorage.setItem = orig; };
  }, [onClose]);
  return <div className="flex-1 overflow-y-auto"><Onboarding /></div>;
}
