/**
 * MarketScreen.jsx
 * AI-curated, feed-style hyperlocal marketplace.
 *
 * Sections:
 *   1. "For You" header – personalised category chips + subtitle
 *   2. "Market Pulse" – full-width vendor story cards
 *   3. "Nearby Pulse" – horizontal strip of active vendor avatars
 *
 * Data: fetched directly from Supabase via fetchVendors().
 * Navigation: calls onSendToAssistant(message) to hand off to AssistantScreen.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { fetchVendors, getRecentSearches } from "../utils/api";

// ── Category config ───────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { label: "All",         emoji: "✨" },
  { label: "fresh food",  emoji: "🥦" },
  { label: "tailoring",   emoji: "🧵" },
  { label: "salon",       emoji: "💇" },
  { label: "phone repair",emoji: "📱" },
  { label: "plumbing",    emoji: "🚿" },
  { label: "bakery",      emoji: "🍞" },
  { label: "cleaning",    emoji: "🧹" },
  { label: "transport",   emoji: "🛵" },
];

// Category → gradient + emoji for the visual highlight strip
const CATEGORY_VISUALS = {
  "tailoring":    { gradient: "from-purple-900 to-pink-900",   emoji: "👗", bg: "#4a1d96" },
  "phone repair": { gradient: "from-blue-900 to-cyan-900",     emoji: "📱", bg: "#1e3a5f" },
  "electronics repair": { gradient: "from-blue-900 to-indigo-900", emoji: "🔧", bg: "#1e3a5f" },
  "plumbing":     { gradient: "from-teal-900 to-green-900",    emoji: "🚿", bg: "#134e4a" },
  "handyman":     { gradient: "from-orange-900 to-yellow-900", emoji: "🔨", bg: "#7c2d12" },
  "fresh food":   { gradient: "from-green-900 to-lime-900",    emoji: "🥦", bg: "#14532d" },
  "bakery":       { gradient: "from-amber-900 to-orange-900",  emoji: "🍞", bg: "#78350f" },
  "cleaning":     { gradient: "from-sky-900 to-blue-900",      emoji: "🧹", bg: "#0c4a6e" },
  "laundry":      { gradient: "from-sky-900 to-indigo-900",    emoji: "👕", bg: "#0c4a6e" },
  "salon":        { gradient: "from-pink-900 to-rose-900",     emoji: "💇", bg: "#831843" },
  "beauty":       { gradient: "from-pink-900 to-fuchsia-900",  emoji: "💄", bg: "#831843" },
  "grocery":      { gradient: "from-green-900 to-emerald-900", emoji: "🛒", bg: "#14532d" },
  "catering":     { gradient: "from-red-900 to-orange-900",    emoji: "🍽️", bg: "#7f1d1d" },
  "photography":  { gradient: "from-gray-800 to-slate-900",    emoji: "📷", bg: "#1e293b" },
  "tutoring":     { gradient: "from-indigo-900 to-violet-900", emoji: "📚", bg: "#312e81" },
  "transport":    { gradient: "from-yellow-900 to-amber-900",  emoji: "🛵", bg: "#713f12" },
  "mechanic":     { gradient: "from-zinc-800 to-gray-900",     emoji: "🔩", bg: "#27272a" },
};

function getCategoryVisual(category = "") {
  const key = category.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_VISUALS)) {
    if (key.includes(k)) return v;
  }
  return { gradient: "from-gray-800 to-slate-900", emoji: "🏪", bg: "#1e293b" };
}

// Simulate is_open based on vendor id (deterministic random)
function simulateIsOpen(id = "") {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return n % 3 !== 0; // ~67% open
}

// Simulate trust score (5–50 neighbours)
function trustScore(id = "") {
  const n = (id.charCodeAt(0) || 10) % 46;
  return n + 5;
}

// ── Highlight strip placeholder images ───────────────────────────────────
function HighlightStrip({ category }) {
  const visual = getCategoryVisual(category);
  const items  = [visual.emoji, "⭐", "📍", "✅"];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {items.map((icon, i) => (
        <div
          key={i}
          className={`flex-shrink-0 w-24 h-20 rounded-xl bg-gradient-to-br ${visual.gradient} flex items-center justify-center text-3xl border border-white/5`}
        >
          {icon}
        </div>
      ))}
    </div>
  );
}

// ── Voice intro player ────────────────────────────────────────────────────
function VoiceIntroButton({ url }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        src={url}
        onEnded={() => setPlaying(false)}
        preload="none"
      />
      <button
        onClick={toggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
          playing
            ? "bg-[#25D366]/20 border-[#25D366] text-[#25D366]"
            : "bg-[#30363d] border-[#444c56] text-gray-300 hover:border-[#25D366]"
        }`}
      >
        {/* Waveform icon */}
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
          {playing
            ? <path d="M5 4a1 1 0 00-1 1v10a1 1 0 002 0V5a1 1 0 00-1-1zm4-2a1 1 0 00-1 1v14a1 1 0 002 0V3a1 1 0 00-1-1zm4 4a1 1 0 00-1 1v6a1 1 0 002 0V7a1 1 0 00-1-1z"/>
            : <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/>
          }
        </svg>
        {playing ? "Playing…" : "Voice intro"}
      </button>
    </div>
  );
}

// ── Star rating ───────────────────────────────────────────────────────────
function Stars({ rating }) {
  const n     = parseFloat(rating) || 0;
  const full  = Math.floor(n);
  const empty = 5 - full;
  return (
    <span className="flex items-center gap-0.5">
      {"★".repeat(full)
        .split("")
        .map((s, i) => <span key={i} className="text-yellow-400 text-sm">{s}</span>)}
      {"★".repeat(empty)
        .split("")
        .map((s, i) => <span key={i} className="text-gray-700 text-sm">{s}</span>)}
      <span className="text-gray-400 text-xs ml-1">{n.toFixed(1)}</span>
    </span>
  );
}

// ── Vendor card ───────────────────────────────────────────────────────────
function VendorStoryCard({ vendor, onChat, onAsk, index }) {
  const isOpen  = simulateIsOpen(vendor.id || "");
  const score   = trustScore(vendor.id || "");
  const visual  = getCategoryVisual(vendor.category || "");

  // Entrance animation delay based on index
  const delay = `${index * 80}ms`;

  return (
    <div
      className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden fade-in"
      style={{ animationDelay: delay }}
    >
      {/* Category colour bar */}
      <div className={`h-1.5 bg-gradient-to-r ${visual.gradient}`} />

      <div className="p-4">
        {/* Header row: name + open status */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-base leading-tight truncate">
              {vendor.name}
            </h3>
            <span className="text-gray-500 text-xs capitalize">{vendor.category}</span>
          </div>

          {/* Live status badge */}
          {isOpen ? (
            <div className="flex items-center gap-1.5 bg-green-900/40 border border-green-700/40 px-2.5 py-1 rounded-full flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-medium">Open now</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-gray-800/60 border border-gray-700/40 px-2.5 py-1 rounded-full flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
              <span className="text-gray-400 text-xs">Opens 8 AM</span>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-gray-400 text-sm leading-relaxed mb-3 line-clamp-2">
          {vendor.description || "Quality service near you."}
        </p>

        {/* Voice intro (if available) */}
        {vendor.voice_intro_url && (
          <div className="mb-3">
            <VoiceIntroButton url={vendor.voice_intro_url} />
          </div>
        )}

        {/* Highlight strip */}
        <div className="mb-4">
          <HighlightStrip category={vendor.category} />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => onChat(vendor)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#128C7E] text-[#0d1117] hover:text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            <span>💬</span>
            <span>Chat</span>
          </button>
          <button
            onClick={() => onAsk(vendor)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#30363d] hover:bg-[#444c56] text-gray-200 font-medium py-2.5 rounded-xl text-sm transition-colors border border-[#444c56]"
          >
            <span>🤖</span>
            <span>Ask AI</span>
          </button>
        </div>

        {/* Trust row */}
        <div className="flex items-center justify-between pt-2 border-t border-[#30363d]">
          <Stars rating={vendor.rating} />
          <div className="flex items-center gap-1 bg-[#0d2818] border border-[#25D366]/20 px-2.5 py-1 rounded-full">
            <span className="text-[#25D366] text-xs">👥</span>
            <span className="text-[#25D366] text-xs font-medium">{score} happy neighbours</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Nearby pulse strip ────────────────────────────────────────────────────
function NearbyPulseStrip({ vendors, onChat }) {
  // Pick up to 8 "active" vendors (simulate with first 8)
  const active = vendors.slice(0, 8);

  if (active.length === 0) return null;

  return (
    <div className="px-4 pb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white font-semibold text-sm">Nearby Active Vendors</p>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
          <span className="text-[#25D366] text-xs">Live</span>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {active.map((v) => {
          const visual  = getCategoryVisual(v.category || "");
          const initials = v.name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "??";
          const isOpen  = simulateIsOpen(v.id || "");

          return (
            <div key={v.id} className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="relative">
                {/* Avatar circle */}
                <button
                  onClick={() => onChat(v)}
                  className={`w-14 h-14 rounded-full bg-gradient-to-br ${visual.gradient} flex items-center justify-center text-white font-bold text-base border-2 transition-transform active:scale-95 ${
                    isOpen ? "border-[#25D366]" : "border-[#30363d]"
                  }`}
                >
                  {initials}
                </button>
                {/* Online dot */}
                {isOpen && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#25D366] border-2 border-[#0d1117]" />
                )}
              </div>
              <span className="text-gray-400 text-[10px] text-center leading-tight max-w-[56px] truncate">
                {v.name?.split(" ")[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function MarketScreen({ onSendToAssistant }) {
  const [vendors, setVendors]           = useState([]);
  const [filtered, setFiltered]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [categories, setCategories]     = useState(DEFAULT_CATEGORIES);

  // ── Build personalised category chips from recent searches ────────────
  useEffect(() => {
    const recent = getRecentSearches(); // e.g. ["tailor near Nakawa", "plumber"]
    if (recent.length === 0) return;

    // Extract keywords that match our known categories
    const matched = new Set();
    const keywords = ["tailoring","salon","bakery","cleaning","plumbing","phone repair",
                      "fresh food","transport","grocery","catering","handyman","beauty"];
    recent.forEach((term) => {
      keywords.forEach((kw) => {
        if (term.toLowerCase().includes(kw.split(" ")[0])) matched.add(kw);
      });
    });

    if (matched.size === 0) return;

    // Prepend matched categories (deduplicated) to the default list
    const extra = [...matched].slice(0, 3).map((label) => ({
      label,
      emoji: CATEGORY_VISUALS[label]?.emoji || "🔍",
      personalised: true,
    }));

    setCategories([
      DEFAULT_CATEGORIES[0], // "All"
      ...extra,
      ...DEFAULT_CATEGORIES.slice(1).filter((c) => !matched.has(c.label)),
    ]);
  }, []);

  // ── Fetch vendors ─────────────────────────────────────────────────────
  const loadVendors = useCallback(async (category) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVendors(category === "All" ? null : category);
      setVendors(data);
      setFiltered(data);
    } catch (err) {
      setError("Couldn't load vendors. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVendors(activeCategory); }, [activeCategory, loadVendors]);

  // ── Navigation helpers ────────────────────────────────────────────────
  function openChatWithVendor(vendor) {
    const msg = `Hi! I saw ${vendor.name}'s profile on Sokoni Market and I'm interested in their ${vendor.category} service. Can you help me connect?`;
    onSendToAssistant?.(msg);
  }

  function askAssistantAboutVendor(vendor) {
    const msg = `Tell me more about ${vendor.name} (${vendor.category}) and compare them with similar vendors near me.`;
    onSendToAssistant?.(msg);
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">

      {/* ── Sticky header ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-[#0d1117] border-b border-[#30363d] pt-4 pb-3">
        {/* Title */}
        <div className="flex items-center gap-3 px-4 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-lg">
            🛒
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Sokoni Market</h1>
            <p className="text-gray-500 text-xs">Curated for you · based on your chats</p>
          </div>
        </div>

        {/* Category chips – horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.label;
            return (
              <button
                key={cat.label}
                onClick={() => setActiveCategory(cat.label)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-colors border ${
                  isActive
                    ? "bg-[#25D366] text-[#0d1117] border-[#25D366]"
                    : "bg-[#161b22] text-gray-300 border-[#30363d] hover:border-[#25D366]"
                }`}
              >
                <span>{cat.emoji}</span>
                <span className="capitalize">{cat.label === "All" ? "All" : cat.label}</span>
                {cat.personalised && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] ml-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable feed ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Loading skeleton */}
        {loading && (
          <div className="px-4 pt-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#161b22] rounded-2xl overflow-hidden border border-[#30363d]">
                <div className="shimmer h-1.5 w-full" />
                <div className="p-4 space-y-3">
                  <div className="flex justify-between">
                    <div className="shimmer h-4 w-1/2 rounded-full" />
                    <div className="shimmer h-6 w-20 rounded-full" />
                  </div>
                  <div className="shimmer h-3 w-full rounded-full" />
                  <div className="shimmer h-3 w-3/4 rounded-full" />
                  <div className="flex gap-2 mt-2">
                    <div className="shimmer h-20 w-24 rounded-xl flex-shrink-0" />
                    <div className="shimmer h-20 w-24 rounded-xl flex-shrink-0" />
                    <div className="shimmer h-20 w-24 rounded-xl flex-shrink-0" />
                  </div>
                  <div className="flex gap-2">
                    <div className="shimmer h-10 flex-1 rounded-xl" />
                    <div className="shimmer h-10 flex-1 rounded-xl" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <span className="text-4xl mb-3">📡</span>
            <p className="text-gray-400 text-sm">{error}</p>
            <button
              onClick={() => loadVendors(activeCategory)}
              className="mt-4 bg-[#25D366] text-[#0d1117] font-semibold px-5 py-2 rounded-xl text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <span className="text-4xl mb-3">🔍</span>
            <p className="text-white font-semibold mb-1">No vendors found</p>
            <p className="text-gray-500 text-sm">
              No {activeCategory === "All" ? "" : activeCategory + " "}vendors in the database yet.
            </p>
            <button
              onClick={() => setActiveCategory("All")}
              className="mt-4 border border-[#25D366] text-[#25D366] font-medium px-5 py-2 rounded-xl text-sm"
            >
              Show all
            </button>
          </div>
        )}

        {/* Vendor story cards */}
        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="px-4 pt-4 space-y-4">
              {filtered.map((vendor, i) => (
                <VendorStoryCard
                  key={vendor.id}
                  vendor={vendor}
                  index={i}
                  onChat={openChatWithVendor}
                  onAsk={askAssistantAboutVendor}
                />
              ))}
            </div>

            {/* Nearby pulse strip */}
            <div className="mt-6">
              <div className="px-4 mb-3">
                <div className="h-px bg-[#30363d]" />
              </div>
              <NearbyPulseStrip
                vendors={filtered}
                onChat={openChatWithVendor}
              />
            </div>
          </>
        )}

        {/* Bottom padding for nav bar */}
        <div className="h-4" />
      </div>
    </div>
  );
}
