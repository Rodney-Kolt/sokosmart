/**
 * CustomerProfileScreen.jsx
 * Step 4a: collect customer name + phone, upsert to profiles table.
 * Uses full_name (consistent with schema) and updates AuthContext profile.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../utils/supabaseClient";
import { useAuth } from "../../context/AuthContext";

const inputCls = "w-full bg-[#0A0E14] border border-slate-800 text-white rounded-2xl px-4 py-3.5 text-sm placeholder-slate-600 focus:outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/20 transition-all";

const AVATARS = ["🧑", "👩", "👨", "🧒", "👴", "👵", "🧔", "👩‍💼", "👨‍💼", "🧑‍🌾"];

export default function CustomerProfileScreen({ onDone, onBack }) {
  const { setProfile } = useAuth();

  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [avatar,  setAvatar]  = useState("🧑");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleFinish() {
    if (!name.trim()) { setError("Please enter your name."); return; }
    setLoading(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not signed in. Please try again.");

      const profileData = {
        id:           uid,
        full_name:    name.trim(),
        phone:        phone.trim() || null,
        avatar_emoji: avatar,
        role:         "consumer",
        updated_at:   new Date().toISOString(),
      };

      const { error: dbErr } = await supabase.from("profiles").upsert(profileData);
      if (dbErr) throw new Error(dbErr.message);

      // Update AuthContext so profile is available immediately
      setProfile?.(profileData);

      // Sync localStorage
      localStorage.setItem("sokoni_role",         "consumer");
      localStorage.setItem("sokoni_display_name", name.trim());
      localStorage.setItem("sokoni_guest_id",     uid);

      onDone();
    } catch (err) {
      setError(err.message || "Failed to save profile.");
    } finally { setLoading(false); }
  }

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
              🛒
            </div>
          </div>
          <h1 className="text-white text-2xl font-bold">Your profile</h1>
          <p className="text-slate-400 text-sm mt-1 text-center">Just a few details to get started.</p>
        </div>

        {/* Avatar picker */}
        <div className="mb-5">
          <p className="text-slate-400 text-xs mb-2">Choose an avatar</p>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button key={a} onClick={() => setAvatar(a)}
                className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all active:scale-95 ${
                  avatar === a ? "bg-orange-500/20 border-2 border-orange-500" : "bg-[#141920] border border-slate-800 hover:border-slate-600"
                }`}>
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="sr-only" htmlFor="cust-name">Full name</label>
            <input id="cust-name" className={inputCls} placeholder="Full name"
              value={name} onChange={(e) => { setName(e.target.value); setError(""); }} autoFocus />
          </div>

          <div className="flex gap-2">
            <div className="bg-[#0A0E14] border border-slate-800 text-slate-400 rounded-2xl px-3 py-3.5 text-sm flex items-center whitespace-nowrap">
              🇺🇬 +256
            </div>
            <div className="flex-1">
              <label className="sr-only" htmlFor="cust-phone">Phone number</label>
              <input id="cust-phone" className={inputCls} type="tel" placeholder="7XX XXX XXX (optional)"
                value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-red-400 text-sm">{error}</motion.p>
            )}
          </AnimatePresence>

          <button onClick={handleFinish} disabled={loading || !name.trim()}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50">
            {loading
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</span>
              : "Finish Setup →"}
          </button>
        </div>
      </div>
    </div>
  );
}
