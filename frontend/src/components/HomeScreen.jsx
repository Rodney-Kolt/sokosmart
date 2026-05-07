/**
 * HomeScreen.jsx
 * Main home view after login.
 * - Greeting bar with avatar + name
 * - Search bar (opens AI bottom sheet)
 * - Quick Actions grid
 * - "For You" horizontal strip (recent search vendors)
 * - "Nearby Pulse" strip (active vendors)
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "../utils/supabaseClient";
import { fetchVendors, getRecentSearches } from "../utils/api";
import QuickActionCard from "./QuickActionCard";

const GREETINGS = ["Good morning", "Good afternoon", "Good evening"];
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? GREETINGS[0] : h < 17 ? GREETINGS[1] : GREETINGS[2];
}

// ── Vendor pill card for strips ───────────────────────────────────────────
function VendorPill({ vendor, onClick }) {
  const EMOJIS = { tailoring:"👗", "phone repair":"📱", plumbing:"🚿", bakery:"🍞", salon:"💇", cleaning:"🧹", grocery:"🛒", catering:"🍽️", transport:"🛵", tutoring:"📚", photography:"📷", handyman:"🔨", "fresh food":"🥦", "electronics repair":"🔧" };
  const emoji = EMOJIS[vendor.category?.toLowerCase()] || "🏪";
  const isActive = vendor.status === "open";

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={() => onClick(vendor)}
      className="flex-shrink-0 w-36 bg-[#141920] border border-slate-800 rounded-2xl p-3 text-left hover:border-orange-500/30 active:scale-[0.96] transition-all"
    >
      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl mb-2">{emoji}</div>
      <p className="text-slate-100 text-xs font-semibold leading-tight truncate">{vendor.name || vendor.vname}</p>
      <p className="text-slate-500 text-[10px] mt-0.5 truncate">{vendor.category || vendor.vcategory}</p>
      <div className="flex items-center gap-1 mt-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-slate-600"}`} />
        <span className={`text-[10px] ${isActive ? "text-emerald-400" : "text-slate-600"}`}>{isActive ? "Open" : "Closed"}</span>
      </div>
    </motion.button>
  );
}

export default function HomeScreen({ onOpenMarket, onOpenAssistant, onOpenOrders, onVendorSelect }) {
  const displayName = localStorage.getItem("sokoni_display_name") || "there";
  const role        = localStorage.getItem("sokoni_role") || "consumer";
  const userId      = localStorage.getItem("sokoni_guest_id") || localStorage.getItem("sokoni_vendor_id") || "";

  const [profile,       setProfile]       = useState(null);
  const [nearbyVendors, setNearbyVendors] = useState([]);
  const [forYouVendors, setForYouVendors] = useState([]);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [isFirstVisit,  setIsFirstVisit]  = useState(false);

  // First-visit overlay
  useEffect(() => {
    if (!localStorage.getItem("sokoni_visited")) {
      setIsFirstVisit(true);
      localStorage.setItem("sokoni_visited", "1");
    }
  }, []);

  // Load profile from Supabase
  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (data) setProfile(data);
    }
    loadProfile();
  }, []);

  // Load nearby vendors
  const loadVendors = useCallback(async () => {
    try {
      const vendors = await fetchVendors(null);
      setNearbyVendors(vendors.slice(0, 8));

      // "For You" — based on recent searches
      const recent = getRecentSearches();
      if (recent.length > 0) {
        const forYou = await fetchVendors(recent[0]);
        setForYouVendors(forYou.slice(0, 6));
      } else {
        setForYouVendors(vendors.slice(0, 6));
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadVendors(); }, [loadVendors]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (searchQuery.trim()) onOpenAssistant(searchQuery.trim());
  }

  const avatarEmoji = profile?.avatar_emoji || (role === "vendor" ? "🏪" : "🧑");
  const name = profile?.display_name || displayName;

  return (
    <div className="flex flex-col h-full bg-[#0A0E14] overflow-y-auto">

      {/* ── First-visit overlay ─────────────────────────────────────── */}
      {isFirstVisit && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 z-50 flex flex-col items-center justify-end pb-32 px-6"
          onClick={() => setIsFirstVisit(false)}
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-[#141920] border border-slate-700 rounded-3xl p-6 text-center max-w-sm w-full"
          >
            <div className="text-4xl mb-3">👋</div>
            <h2 className="text-white font-bold text-lg mb-1">Welcome to Sokoni Smart!</h2>
            <p className="text-slate-400 text-sm mb-4">Use the quick actions to browse, chat with AI, or track your orders. Tap the orange button anytime to ask Sokoni.</p>
            <button
              onClick={() => setIsFirstVisit(false)}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl active:scale-[0.98] transition-all"
            >
              Let's go! →
            </button>
          </motion.div>
        </motion.div>
      )}

      {/* ── Header: greeting ────────────────────────────────────────── */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-slate-400 text-sm">{greeting()},</p>
          <h1 className="text-slate-100 text-xl font-bold leading-tight">{name} {role === "vendor" ? "🏪" : ""}</h1>
        </div>
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-2xl shadow-lg shadow-orange-500/20 flex-shrink-0">
          {avatarEmoji}
        </div>
      </div>

      {/* ── Search bar ──────────────────────────────────────────────── */}
      <div className="px-5 mb-5 flex-shrink-0">
        <form onSubmit={handleSearchSubmit}>
          <button
            type="button"
            onClick={() => onOpenAssistant("")}
            className="w-full flex items-center gap-3 bg-[#141920] border border-slate-800 rounded-2xl px-4 py-3.5 text-slate-500 text-sm hover:border-orange-500/40 active:scale-[0.98] transition-all text-left"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <span>Ask Sokoni or search vendors…</span>
          </button>
        </form>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────────── */}
      <div className="px-5 mb-6 flex-shrink-0">
        <h2 className="text-slate-100 font-semibold text-sm mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-3">
          <QuickActionCard
            emoji="🛍️"
            title="Browse Market"
            subtitle="Find vendors"
            gradient="from-orange-500 to-red-500"
            onClick={onOpenMarket}
          />
          <QuickActionCard
            emoji="🤖"
            title="Ask Sokoni"
            subtitle="AI assistant"
            gradient="from-violet-500 to-purple-600"
            onClick={() => onOpenAssistant("")}
          />
          <QuickActionCard
            emoji="📦"
            title="My Orders"
            subtitle="Track requests"
            gradient="from-emerald-500 to-teal-600"
            onClick={onOpenOrders}
          />
        </div>
      </div>

      {/* ── For You strip ────────────────────────────────────────────── */}
      {forYouVendors.length > 0 && (
        <div className="mb-6 flex-shrink-0">
          <div className="px-5 flex items-center justify-between mb-3">
            <h2 className="text-slate-100 font-semibold text-sm">For You</h2>
            <button onClick={onOpenMarket} className="text-orange-500 text-xs hover:underline active:scale-95 transition-all">See all</button>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
            {forYouVendors.map((v, i) => (
              <VendorPill key={v.id || i} vendor={v} onClick={onVendorSelect} />
            ))}
          </div>
        </div>
      )}

      {/* ── Nearby Pulse strip ───────────────────────────────────────── */}
      {nearbyVendors.length > 0 && (
        <div className="mb-24 flex-shrink-0">
          <div className="px-5 flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-slate-100 font-semibold text-sm">Nearby Pulse</h2>
            </div>
            <button onClick={onOpenMarket} className="text-orange-500 text-xs hover:underline active:scale-95 transition-all">See all</button>
          </div>
          <div className="flex gap-3 overflow-x-auto px-5 pb-1 no-scrollbar">
            {nearbyVendors.filter((v) => v.status === "open" || v.vstatus === "open").map((v, i) => (
              <VendorPill key={v.id || i} vendor={v} onClick={onVendorSelect} />
            ))}
            {nearbyVendors.filter((v) => v.status !== "open" && v.vstatus !== "open").map((v, i) => (
              <VendorPill key={`c-${v.id || i}`} vendor={v} onClick={onVendorSelect} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
