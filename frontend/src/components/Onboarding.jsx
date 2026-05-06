/**
 * Onboarding.jsx – Beautiful full-screen auth with Login / Register tabs.
 * Dark theme, orange accent, Space Grotesk headings.
 * Supports: Login, Register (consumer/vendor), Guest mode, Forgot password.
 */

import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { signUp, signIn, resetPassword } from "../utils/auth";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "../context/AuthContext";

const VENDOR_CATEGORIES = [
  { label: "Fresh Food",         emoji: "🥦", value: "fresh food" },
  { label: "Bakery",             emoji: "🍞", value: "bakery" },
  { label: "Tailoring",          emoji: "🧵", value: "tailoring" },
  { label: "Phone Repair",       emoji: "📱", value: "phone repair" },
  { label: "Electronics",        emoji: "🔧", value: "electronics repair" },
  { label: "Plumbing",           emoji: "🚿", value: "plumbing" },
  { label: "Handyman",           emoji: "🔨", value: "handyman" },
  { label: "Salon & Beauty",     emoji: "💇", value: "salon" },
  { label: "Cleaning",           emoji: "🧹", value: "cleaning" },
  { label: "Grocery",            emoji: "🛒", value: "grocery" },
  { label: "Catering",           emoji: "🍽️", value: "catering" },
  { label: "Photography",        emoji: "📷", value: "photography" },
  { label: "Tutoring",           emoji: "📚", value: "tutoring" },
  { label: "Transport",          emoji: "🛵", value: "transport" },
];

const GUEST_NAMES = [
  "Friendly Buyer","Quick Shopper","Market Explorer",
  "Savvy Customer","Local Finder","Smart Seeker",
];

function randomGuestName() {
  return GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
}

// ── Shared input style ────────────────────────────────────────────────────
const inputCls = "w-full bg-[#0A0E14] border border-slate-800 text-white rounded-2xl px-4 py-3.5 text-sm placeholder-slate-600 focus:outline-none focus:border-orange-500/50 transition-colors";

export default function Onboarding({ onDone }) {
  const { enterGuestMode } = useAuth();

  // "tabs" | "login" | "register" | "vendor-category" | "vendor-details" | "forgot"
  const [screen, setScreen]   = useState("tabs");
  const [tab,    setTab]      = useState("login"); // login | register

  // Form fields
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [displayName,  setDisplayName]  = useState("");
  const [role,         setRole]         = useState("consumer"); // consumer | vendor
  const [vendorCat,    setVendorCat]    = useState(null);
  const [businessName, setBusinessName] = useState("");
  const [description,  setDescription]  = useState("");
  const [coords,       setCoords]       = useState({ lat: null, lng: null });
  const [locStatus,    setLocStatus]    = useState("idle");

  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  function clearError() { setError(""); }

  // ── Location ──────────────────────────────────────────────────────────
  function requestLocation() {
    setLocStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocStatus("done"); },
      () => setLocStatus("error"),
      { timeout: 8000 }
    );
  }

  // ── Guest mode ────────────────────────────────────────────────────────
  function handleGuest() {
    const name = randomGuestName();
    enterGuestMode(name);
    onDone?.();
  }

  // ── Login ─────────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!email.trim() || !password.trim()) { setError("Enter your email and password."); return; }
    setLoading(true); clearError();
    try {
      const data = await signIn(email.trim(), password);
      const uid  = data.user.id;
      // Check if vendor
      const { data: vendor } = await supabase.from("vendors").select("owner_id,name").eq("owner_id", uid).single();
      if (vendor) {
        localStorage.setItem("sokoni_role",         "vendor");
        localStorage.setItem("sokoni_vendor_id",    uid);
        localStorage.setItem("sokoni_display_name", vendor.name);
      } else {
        localStorage.setItem("sokoni_role",         "consumer");
        localStorage.setItem("sokoni_display_name", data.user.email?.split("@")[0] || "User");
      }
      onDone?.();
    } catch (err) {
      setError(err.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  // ── Register (consumer) ───────────────────────────────────────────────
  async function handleRegisterConsumer() {
    if (!email.trim() || !password.trim() || !displayName.trim()) {
      setError("Please fill in all fields."); return;
    }
    setLoading(true); clearError();
    try {
      const data = await signUp(email.trim(), password);
      const uid  = data.user?.id;
      if (uid) {
        localStorage.setItem("sokoni_role",         "consumer");
        localStorage.setItem("sokoni_display_name", displayName.trim());
        // Store guest id as user id for messaging
        localStorage.setItem("sokoni_guest_id",     uid);
      }
      // Show email verification notice
      setScreen("verify-notice");
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  // ── Register (vendor) ─────────────────────────────────────────────────
  async function handleRegisterVendor() {
    if (!businessName.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields."); return;
    }
    setLoading(true); clearError();
    try {
      const data   = await signUp(email.trim(), password);
      const userId = data.user?.id;
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const params = new URLSearchParams({
        owner_id: userId, name: businessName.trim(),
        category: vendorCat, description: description.trim(),
        ...(coords.lat && { latitude: coords.lat, longitude: coords.lng }),
      });
      const res = await fetch(`${apiUrl}/vendor/register?${params}`, { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
      localStorage.setItem("sokoni_role",         "vendor");
      localStorage.setItem("sokoni_vendor_id",    userId);
      localStorage.setItem("sokoni_display_name", businessName.trim());
      setScreen("verify-notice");
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot password ───────────────────────────────────────────────────
  async function handleForgot() {
    if (!email.trim()) { setError("Enter your email first."); return; }
    setLoading(true); clearError();
    try {
      await resetPassword(email.trim());
      setForgotSent(true);
    } catch (err) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  }

  // ── Shared header ─────────────────────────────────────────────────────
  const Header = ({ back, title, subtitle }) => (
    <div className="flex flex-col items-center mb-8">
      {back && (
        <button onClick={back} className="self-start text-slate-400 hover:text-white text-sm mb-4 flex items-center gap-1">
          ← Back
        </button>
      )}
      <div className="relative mb-5">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-40 animate-pulse" />
        <div className="relative w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
          🛍️
        </div>
      </div>
      <h1 className="text-white text-2xl font-bold font-display">{title}</h1>
      {subtitle && <p className="text-slate-400 text-sm mt-1 text-center">{subtitle}</p>}
    </div>
  );

  // ── Email verification notice ─────────────────────────────────────────
  if (screen === "verify-notice") {
    return (
      <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-6">📧</div>
        <h2 className="text-white font-bold text-2xl mb-2 font-display">Check your inbox!</h2>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed max-w-xs">
          We sent a verification link to <strong className="text-white">{email}</strong>.
          Click it to activate your account.
        </p>
        <button
          onClick={handleGuest}
          className="w-full max-w-xs py-3 bg-[#141920] border border-slate-800 text-slate-300 rounded-2xl text-sm hover:border-orange-500/40 transition-all"
        >
          Continue as Guest for now
        </button>
      </div>
    );
  }

  // ── Vendor category selection ─────────────────────────────────────────
  if (screen === "vendor-category") {
    return (
      <div className="min-h-screen bg-[#0A0E14] flex flex-col px-5 py-8 overflow-y-auto">
        <Header back={() => setScreen("tabs")} title="What do you sell?" subtitle="Pick your main category" />
        <div className="grid grid-cols-3 gap-3">
          {VENDOR_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => { setVendorCat(cat.value); setScreen("vendor-details"); }}
              className="flex flex-col items-center gap-2 p-3 bg-[#141920] border border-slate-800 rounded-2xl hover:border-orange-500/40 transition-all active:scale-95"
            >
              <span className="text-2xl">{cat.emoji}</span>
              <span className="text-xs text-slate-300 text-center leading-tight">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Vendor details ────────────────────────────────────────────────────
  if (screen === "vendor-details") {
    return (
      <div className="min-h-screen bg-[#0A0E14] flex flex-col px-5 py-8 overflow-y-auto">
        <Header back={() => setScreen("vendor-category")} title="Your Business" subtitle={`Category: ${vendorCat}`} />
        <div className="space-y-3">
          <input className={inputCls} placeholder="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className={inputCls} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={inputCls} type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={requestLocation} disabled={locStatus === "loading"} className="text-orange-500 text-sm flex items-center gap-2">
            📍 {locStatus === "idle" && "Add my location (optional)"}
               {locStatus === "loading" && "Getting location…"}
               {locStatus === "done" && "✅ Location added"}
               {locStatus === "error" && "⚠️ Couldn't get location"}
          </button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={handleRegisterVendor} disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50">
            {loading ? "Creating account…" : "Create Vendor Account →"}
          </button>
        </div>
      </div>
    );
  }

  // ── Forgot password ───────────────────────────────────────────────────
  if (screen === "forgot") {
    return (
      <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <Header back={() => { setScreen("tabs"); setForgotSent(false); }} title="Reset Password" subtitle="We'll send a link to your email" />
          {forgotSent ? (
            <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-2xl p-5 text-center">
              <p className="text-emerald-400 font-semibold">📧 Reset email sent!</p>
              <p className="text-slate-400 text-xs mt-1">Check your inbox and click the link.</p>
              <button onClick={() => { setScreen("tabs"); setForgotSent(false); }} className="text-orange-500 text-xs mt-3 underline">Back to sign in</button>
            </div>
          ) : (
            <div className="space-y-3">
              <input className={inputCls} type="email" placeholder="Your email address" value={email} onChange={(e) => setEmail(e.target.value)} />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button onClick={handleForgot} disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50">
                {loading ? "Sending…" : "Send Reset Link →"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Main tabs: Login / Register ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        <Header title="Welcome to Sokoni" subtitle="Your hyperlocal AI marketplace" />

        {/* Tab switcher */}
        <div className="flex bg-[#141920] rounded-2xl p-1 mb-6 border border-slate-800">
          {["login","register"].map((t) => (
            <button key={t} onClick={() => { setTab(t); clearError(); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 capitalize ${
                tab === t
                  ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/20"
                  : "text-slate-400 hover:text-white"
              }`}>
              {t === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {/* ── Login form ─────────────────────────────────────────────── */}
        {tab === "login" && (
          <div className="space-y-3">
            <input className={inputCls} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={inputCls} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
            <button onClick={() => { setScreen("forgot"); clearError(); }} className="text-orange-500 text-xs text-right w-full hover:underline">
              Forgot password?
            </button>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleLogin} disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50">
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </div>
        )}

        {/* ── Register form ──────────────────────────────────────────── */}
        {tab === "register" && (
          <div className="space-y-3">
            <input className={inputCls} placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <input className={inputCls} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={inputCls} type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} />

            {/* Role selector */}
            <div className="flex gap-2">
              {[
                { v: "consumer", label: "🛒 Consumer", sub: "Find services" },
                { v: "vendor",   label: "🏪 Vendor",   sub: "Sell services" },
              ].map((r) => (
                <button key={r.v} onClick={() => setRole(r.v)}
                  className={`flex-1 py-3 rounded-2xl border text-sm transition-all ${
                    role === r.v
                      ? "border-orange-500/50 bg-orange-500/10 text-orange-400"
                      : "border-slate-800 bg-[#141920] text-slate-400 hover:border-slate-600"
                  }`}>
                  <div className="font-semibold">{r.label}</div>
                  <div className="text-xs opacity-70">{r.sub}</div>
                </button>
              ))}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={() => {
                if (role === "vendor") { setScreen("vendor-category"); clearError(); }
                else handleRegisterConsumer();
              }}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50">
              {loading ? "Creating account…" : role === "vendor" ? "Next: Business Details →" : "Create Account →"}
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-slate-600 text-xs">or</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        {/* Guest button */}
        <button onClick={handleGuest}
          className="w-full py-3.5 bg-[#141920] border border-slate-800 text-slate-300 font-medium rounded-2xl text-sm hover:border-slate-600 hover:text-white transition-all active:scale-[0.98]">
          👤 Continue as Guest
        </button>

        <p className="text-slate-600 text-xs text-center mt-4">
          Guests can browse freely. Sign up to request services.
        </p>
      </div>
    </div>
  );
}
