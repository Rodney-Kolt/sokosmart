/**
 * VendorProfileScreen.jsx
 * Step 4b: vendor category → business details → upsert profiles + register vendor.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../context/AuthContext";

const inputCls = "w-full bg-[#0A0E14] border border-slate-800 text-white rounded-2xl px-4 py-3.5 text-sm placeholder-slate-600 focus:outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/20 transition-all";

const CATEGORIES = [
  { label: "Fresh Food",    emoji: "🥦", value: "fresh food" },
  { label: "Bakery",        emoji: "🍞", value: "bakery" },
  { label: "Tailoring",     emoji: "🧵", value: "tailoring" },
  { label: "Phone Repair",  emoji: "📱", value: "phone repair" },
  { label: "Electronics",   emoji: "🔧", value: "electronics repair" },
  { label: "Plumbing",      emoji: "🚿", value: "plumbing" },
  { label: "Handyman",      emoji: "🔨", value: "handyman" },
  { label: "Salon & Beauty",emoji: "💇", value: "salon" },
  { label: "Cleaning",      emoji: "🧹", value: "cleaning" },
  { label: "Grocery",       emoji: "🛒", value: "grocery" },
  { label: "Catering",      emoji: "🍽️", value: "catering" },
  { label: "Photography",   emoji: "📷", value: "photography" },
  { label: "Tutoring",      emoji: "📚", value: "tutoring" },
  { label: "Transport",     emoji: "🛵", value: "transport" },
];

export default function VendorProfileScreen({ onDone, onBack }) {
  const { setProfile } = useAuth();

  const [step,        setStep]        = useState("category");
  const [category,    setCategory]    = useState(null);
  const [bizName,     setBizName]     = useState("");
  const [description, setDescription] = useState("");
  const [location,    setLocation]    = useState("");
  const [locStatus,   setLocStatus]   = useState("idle");
  const [coords,      setCoords]      = useState({ lat: null, lng: null });
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  const API_URL = import.meta.env.VITE_API_URL || "";

  function requestLocation() {
    setLocStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocStatus("done"); },
      () => setLocStatus("error"),
      { timeout: 8000 }
    );
  }

  async function handleFinish() {
    if (!bizName.trim()) { setError("Please enter your business name."); return; }
    setLoading(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated. Please sign in again.");

      // 1. Upsert into profiles table
      const profileData = {
        id:                   uid,
        full_name:            bizName.trim(),
        role:                 "vendor",
        business_name:        bizName.trim(),
        business_category:    category,
        business_description: description.trim() || null,
        location:             location.trim() || null,
        avatar_emoji:         "🏪",
        updated_at:           new Date().toISOString(),
      };
      const { error: profErr } = await supabase.from("profiles").upsert(profileData);
      if (profErr) console.warn("Profile upsert:", profErr.message);

      // 2. Register in vendors table via backend
      const params = new URLSearchParams({
        owner_id:    uid,
        name:        bizName.trim(),
        category:    category,
        description: description.trim(),
        ...(coords.lat && { latitude: String(coords.lat), longitude: String(coords.lng) }),
      });
      const res = await fetch(`${API_URL}/vendor/register?${params}`, { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Registration failed."); }

      // 3. Update AuthContext + localStorage
      setProfile?.(profileData);
      localStorage.setItem("sokoni_role",         "vendor");
      localStorage.setItem("sokoni_vendor_id",    uid);
      localStorage.setItem("sokoni_display_name", bizName.trim());

      onDone();
    } catch (err) {
      setError(err.message || "Failed to register vendor.");
    } finally { setLoading(false); }
  }

  // ── Category selection ────────────────────────────────────────────────
  if (step === "category") {
    return (
      <div className="min-h-screen bg-[#0A0E14] flex flex-col px-5 py-10 overflow-y-auto">
        <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-1 active:scale-[0.98] transition-all">
          ← Back
        </button>
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl blur-xl opacity-40 animate-pulse" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg">🏪</div>
          </div>
          <h1 className="text-white text-2xl font-bold">What do you sell?</h1>
          <p className="text-slate-400 text-sm mt-1">Pick your main category</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {CATEGORIES.map((cat, i) => (
            <motion.button key={cat.value}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => { setCategory(cat.value); setStep("details"); }}
              className="flex flex-col items-center gap-2 p-3 bg-[#141920] border border-slate-800 rounded-2xl hover:border-violet-500/40 active:scale-95 transition-all">
              <span className="text-2xl">{cat.emoji}</span>
              <span className="text-xs text-slate-300 text-center leading-tight">{cat.label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  // ── Business details ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <button onClick={() => { setStep("category"); setError(""); }}
          className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-1 active:scale-[0.98] transition-all">
          ← Back
        </button>
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl blur-xl opacity-40 animate-pulse" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
              {CATEGORIES.find((c) => c.value === category)?.emoji || "🏪"}
            </div>
          </div>
          <h1 className="text-white text-2xl font-bold">Your Business</h1>
          <p className="text-slate-400 text-sm mt-1">Category: <span className="text-white capitalize">{category}</span></p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="sr-only" htmlFor="biz-name">Business name</label>
            <input id="biz-name" className={inputCls} placeholder="Business name"
              value={bizName} onChange={(e) => { setBizName(e.target.value); setError(""); }} autoFocus />
          </div>
          <div>
            <label className="sr-only" htmlFor="biz-desc">Description</label>
            <textarea id="biz-desc" className={`${inputCls} resize-none`} rows={3}
              placeholder="Short description of your services"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="sr-only" htmlFor="biz-loc">Location</label>
            <input id="biz-loc" className={inputCls} placeholder="Location (e.g. Wandegeya, Nakawa)"
              value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <button onClick={requestLocation} disabled={locStatus === "loading"}
            className="text-orange-500 text-sm flex items-center gap-2 active:scale-[0.98] transition-all">
            📍 {locStatus === "idle"    && "Auto-detect my location (optional)"}
                {locStatus === "loading" && "Getting location…"}
                {locStatus === "done"    && "✅ Location detected"}
                {locStatus === "error"   && "⚠️ Couldn't detect — type it above"}
          </button>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-red-400 text-sm">{error}</motion.p>
            )}
          </AnimatePresence>

          <button onClick={handleFinish} disabled={loading || !bizName.trim()}
            className="w-full py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold rounded-2xl shadow-lg shadow-violet-500/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50">
            {loading
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</span>
              : "Finish Setup →"}
          </button>
        </div>
      </div>
    </div>
  );
}
