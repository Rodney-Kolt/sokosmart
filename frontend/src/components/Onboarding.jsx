/**
 * Onboarding.jsx
 * First screen: role selection → consumer or vendor path.
 * Consumer path: display name / guest mode + optional location.
 * Vendor path: category selection → business details.
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../utils/supabaseClient";

// Vendor categories with emoji icons
const VENDOR_CATEGORIES = [
  { label: "Fresh Food",          emoji: "🥦", value: "fresh food" },
  { label: "Bakery",              emoji: "🍞", value: "bakery" },
  { label: "Tailoring",           emoji: "🧵", value: "tailoring" },
  { label: "Phone Repair",        emoji: "📱", value: "phone repair" },
  { label: "Electronics Repair",  emoji: "🔧", value: "electronics repair" },
  { label: "Plumbing",            emoji: "🚿", value: "plumbing" },
  { label: "Handyman",            emoji: "🔨", value: "handyman" },
  { label: "Salon & Beauty",      emoji: "💇", value: "salon" },
  { label: "Cleaning",            emoji: "🧹", value: "cleaning" },
  { label: "Laundry",             emoji: "👕", value: "laundry" },
  { label: "Grocery",             emoji: "🛒", value: "grocery" },
  { label: "Catering",            emoji: "🍽️", value: "catering" },
  { label: "Photography",         emoji: "📷", value: "photography" },
  { label: "Tutoring",            emoji: "📚", value: "tutoring" },
  { label: "Transport",           emoji: "🛵", value: "transport" },
];

// Random guest nicknames
const GUEST_NAMES = [
  "Friendly Buyer", "Quick Shopper", "Market Explorer",
  "Savvy Customer", "Local Finder", "Smart Seeker",
];

function randomGuestName() {
  return GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
}

export default function Onboarding() {
  const navigate = useNavigate();

  // ── State machine: "role" | "consumer" | "vendor-category" | "vendor-details"
  const [step, setStep]               = useState("role");
  const [displayName, setDisplayName] = useState("");
  const [vendorCategory, setVendorCategory] = useState(null);
  const [businessName, setBusinessName]     = useState("");
  const [description, setDescription]       = useState("");
  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");
  const [locationStatus, setLocationStatus] = useState("idle"); // idle | loading | done | error
  const [coords, setCoords]                 = useState({ lat: null, lng: null });

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getOrCreateGuestId() {
    let id = localStorage.getItem("sokoni_guest_id");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("sokoni_guest_id", id);
    }
    return id;
  }

  function requestLocation() {
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus("done");
      },
      () => setLocationStatus("error"),
      { timeout: 8000 }
    );
  }

  // ── Consumer: continue as guest ──────────────────────────────────────────
  function handleGuestContinue() {
    const guestId   = getOrCreateGuestId();
    const guestName = randomGuestName();
    localStorage.setItem("sokoni_display_name", guestName);
    localStorage.setItem("sokoni_role", "consumer");
    if (coords.lat) {
      localStorage.setItem("sokoni_lat", coords.lat);
      localStorage.setItem("sokoni_lng", coords.lng);
    }
    navigate("/chat");
  }

  // ── Consumer: continue with name ─────────────────────────────────────────
  function handleConsumerContinue() {
    if (!displayName.trim()) { setError("Please enter a display name."); return; }
    getOrCreateGuestId();
    localStorage.setItem("sokoni_display_name", displayName.trim());
    localStorage.setItem("sokoni_role", "consumer");
    if (coords.lat) {
      localStorage.setItem("sokoni_lat", coords.lat);
      localStorage.setItem("sokoni_lng", coords.lng);
    }
    navigate("/chat");
  }

  // ── Vendor: sign up with Supabase Auth ───────────────────────────────────
  async function handleVendorSignUp() {
    if (!businessName.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // 1. Create auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
      });
      if (authErr) throw authErr;

      const userId = authData.user?.id;

      // 2. Insert vendor record
      const { error: dbErr } = await supabase.from("vendors").insert({
        owner_id:    userId,
        name:        businessName.trim(),
        category:    vendorCategory,
        description: description.trim(),
        latitude:    coords.lat,
        longitude:   coords.lng,
        rating:      4.0,
        is_active:   true,
      });
      if (dbErr) throw dbErr;

      // 3. Store session info
      localStorage.setItem("sokoni_role",         "vendor");
      localStorage.setItem("sokoni_vendor_id",    userId);
      localStorage.setItem("sokoni_display_name", businessName.trim());

      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Sign-up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Vendor: log in ───────────────────────────────────────────────────────
  async function handleVendorLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) throw authErr;

      localStorage.setItem("sokoni_role",      "vendor");
      localStorage.setItem("sokoni_vendor_id", data.user.id);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-sokoni-teal">
      {/* Header */}
      <div className="flex flex-col items-center pt-12 pb-6 px-6">
        <div className="w-20 h-20 rounded-full bg-sokoni-green flex items-center justify-center text-4xl shadow-lg mb-4">
          🛍️
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Sokoni Chat</h1>
        <p className="text-green-200 text-sm mt-1">Your hyperlocal marketplace</p>
      </div>

      {/* Card */}
      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-10 overflow-y-auto">

        {/* ── Step: Role selection ─────────────────────────────────────── */}
        {step === "role" && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-gray-800 text-center mb-2">
              Welcome! How can we help?
            </h2>

            <button
              onClick={() => setStep("consumer")}
              className="flex items-center gap-4 p-5 rounded-2xl border-2 border-sokoni-green bg-green-50 hover:bg-green-100 transition-colors text-left"
            >
              <span className="text-4xl">🛒</span>
              <div>
                <p className="font-semibold text-gray-800 text-lg">I'm looking for something</p>
                <p className="text-gray-500 text-sm">Find products & services near you</p>
              </div>
            </button>

            <button
              onClick={() => setStep("vendor-login")}
              className="flex items-center gap-4 p-5 rounded-2xl border-2 border-blue-400 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
            >
              <span className="text-4xl">🏪</span>
              <div>
                <p className="font-semibold text-gray-800 text-lg">I sell a product / service</p>
                <p className="text-gray-500 text-sm">List your business and get customers</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Step: Consumer onboarding ────────────────────────────────── */}
        {step === "consumer" && (
          <div className="flex flex-col gap-4">
            <button onClick={() => setStep("role")} className="text-sokoni-teal text-sm flex items-center gap-1 mb-1">
              ← Back
            </button>
            <h2 className="text-xl font-semibold text-gray-800">What should we call you?</h2>
            <p className="text-gray-500 text-sm">No account needed. Just a name to get started.</p>

            <input
              type="text"
              placeholder="Your display name (e.g. Sarah)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="border border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-sokoni-green"
            />

            {/* Location */}
            <button
              onClick={requestLocation}
              disabled={locationStatus === "loading"}
              className="flex items-center gap-2 text-sokoni-teal text-sm font-medium"
            >
              📍{" "}
              {locationStatus === "idle"    && "Share my location (optional)"}
              {locationStatus === "loading" && "Getting location…"}
              {locationStatus === "done"    && "✅ Location shared"}
              {locationStatus === "error"   && "⚠️ Couldn't get location – that's OK"}
            </button>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleConsumerContinue}
              className="bg-sokoni-green text-white font-semibold py-3 rounded-xl hover:bg-sokoni-darkgreen transition-colors"
            >
              Continue →
            </button>

            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-gray-400 text-xs">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <button
              onClick={handleGuestContinue}
              className="border border-gray-300 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Continue as Guest 👤
            </button>
          </div>
        )}

        {/* ── Step: Vendor login / register choice ─────────────────────── */}
        {step === "vendor-login" && (
          <div className="flex flex-col gap-4">
            <button onClick={() => setStep("role")} className="text-sokoni-teal text-sm flex items-center gap-1 mb-1">
              ← Back
            </button>
            <h2 className="text-xl font-semibold text-gray-800">Vendor Account</h2>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("vendor-category")}
                className="flex-1 bg-sokoni-green text-white font-semibold py-3 rounded-xl hover:bg-sokoni-darkgreen transition-colors"
              >
                Register New
              </button>
              <button
                onClick={() => setStep("vendor-signin")}
                className="flex-1 border border-sokoni-green text-sokoni-teal font-semibold py-3 rounded-xl hover:bg-green-50 transition-colors"
              >
                Sign In
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Vendor sign-in ─────────────────────────────────────── */}
        {step === "vendor-signin" && (
          <div className="flex flex-col gap-4">
            <button onClick={() => setStep("vendor-login")} className="text-sokoni-teal text-sm flex items-center gap-1 mb-1">
              ← Back
            </button>
            <h2 className="text-xl font-semibold text-gray-800">Sign In</h2>

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sokoni-green"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sokoni-green"
            />

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleVendorLogin}
              disabled={loading}
              className="bg-sokoni-green text-white font-semibold py-3 rounded-xl hover:bg-sokoni-darkgreen transition-colors disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </div>
        )}

        {/* ── Step: Vendor category selection ──────────────────────────── */}
        {step === "vendor-category" && (
          <div className="flex flex-col gap-4">
            <button onClick={() => setStep("vendor-login")} className="text-sokoni-teal text-sm flex items-center gap-1 mb-1">
              ← Back
            </button>
            <h2 className="text-xl font-semibold text-gray-800">What do you sell?</h2>
            <p className="text-gray-500 text-sm">Pick the category that best fits your business.</p>

            <div className="grid grid-cols-3 gap-2">
              {VENDOR_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => { setVendorCategory(cat.value); setStep("vendor-details"); }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-gray-200 hover:border-sokoni-green hover:bg-green-50 transition-colors"
                >
                  <span className="text-2xl">{cat.emoji}</span>
                  <span className="text-xs text-gray-700 text-center leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step: Vendor business details ────────────────────────────── */}
        {step === "vendor-details" && (
          <div className="flex flex-col gap-4">
            <button onClick={() => setStep("vendor-category")} className="text-sokoni-teal text-sm flex items-center gap-1 mb-1">
              ← Back
            </button>
            <h2 className="text-xl font-semibold text-gray-800">Your Business Details</h2>
            <p className="text-gray-500 text-sm capitalize">Category: <strong>{vendorCategory}</strong></p>

            <input
              type="text"
              placeholder="Business name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sokoni-green"
            />
            <textarea
              placeholder="Short description (e.g. 'Expert in African print dresses, fast delivery')"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sokoni-green resize-none"
            />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sokoni-green"
            />
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sokoni-green"
            />

            {/* Location */}
            <button
              onClick={requestLocation}
              disabled={locationStatus === "loading"}
              className="flex items-center gap-2 text-sokoni-teal text-sm font-medium"
            >
              📍{" "}
              {locationStatus === "idle"    && "Use my current location"}
              {locationStatus === "loading" && "Getting location…"}
              {locationStatus === "done"    && "✅ Location captured"}
              {locationStatus === "error"   && "⚠️ Couldn't get location"}
            </button>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleVendorSignUp}
              disabled={loading}
              className="bg-sokoni-green text-white font-semibold py-3 rounded-xl hover:bg-sokoni-darkgreen transition-colors disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create Account →"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
