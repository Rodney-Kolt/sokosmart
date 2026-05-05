/**
 * MarketScreen.jsx – TikTok/Reels-style full-screen vertical feed.
 *
 * Layout:
 *   ┌──────────────────────────────┐
 *   │  Sticky search + filter bar  │  ← always visible
 *   ├──────────────────────────────┤
 *   │  Snap-scroll feed            │  ← each slide = 100% height
 *   │  ┌────────────────────────┐  │
 *   │  │  Gradient media card   │  │
 *   │  │  ┌──────────────────┐  │  │
 *   │  │  │ Floating actions │  │  │
 *   │  │  └──────────────────┘  │  │
 *   │  │  Bottom overlay info   │  │
 *   │  └────────────────────────┘  │
 *   └──────────────────────────────┘
 *
 * Each slide is scroll-snap-aligned so swiping snaps to the next vendor.
 * A bottom sheet slides up with full vendor details + voice intro + quick replies.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { fetchVendors, getRecentSearches, requestService, followVendor, unfollowVendor, checkIsFollowing } from "../utils/api";
import { startListening, isRecognitionSupported } from "../utils/speech";
import VendorPublicProfile from "./VendorPublicProfile";

// ── Category → visual config ──────────────────────────────────────────────
const CATEGORY_VISUALS = {
  "tailoring":          { grad: ["#4a1d96","#831843"], emoji: "👗", accent: "#c084fc" },
  "phone repair":       { grad: ["#1e3a5f","#0c4a6e"], emoji: "📱", accent: "#38bdf8" },
  "electronics repair": { grad: ["#1e3a5f","#312e81"], emoji: "🔧", accent: "#818cf8" },
  "plumbing":           { grad: ["#134e4a","#14532d"], emoji: "🚿", accent: "#34d399" },
  "handyman":           { grad: ["#7c2d12","#78350f"], emoji: "🔨", accent: "#fb923c" },
  "fresh food":         { grad: ["#14532d","#365314"], emoji: "🥦", accent: "#86efac" },
  "bakery":             { grad: ["#78350f","#7c2d12"], emoji: "🍞", accent: "#fbbf24" },
  "cleaning":           { grad: ["#0c4a6e","#1e3a5f"], emoji: "🧹", accent: "#7dd3fc" },
  "laundry":            { grad: ["#0c4a6e","#312e81"], emoji: "👕", accent: "#a5b4fc" },
  "salon":              { grad: ["#831843","#701a75"], emoji: "💇", accent: "#f0abfc" },
  "beauty":             { grad: ["#831843","#4a1d96"], emoji: "💄", accent: "#e879f9" },
  "grocery":            { grad: ["#14532d","#134e4a"], emoji: "🛒", accent: "#4ade80" },
  "catering":           { grad: ["#7f1d1d","#7c2d12"], emoji: "🍽️", accent: "#fca5a5" },
  "photography":        { grad: ["#1e293b","#0f172a"], emoji: "📷", accent: "#94a3b8" },
  "tutoring":           { grad: ["#312e81","#4a1d96"], emoji: "📚", accent: "#a5b4fc" },
  "transport":          { grad: ["#713f12","#78350f"], emoji: "🛵", accent: "#fde68a" },
  "mechanic":           { grad: ["#27272a","#18181b"], emoji: "🔩", accent: "#a1a1aa" },
};

function getVisual(category = "") {
  const key = category.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_VISUALS)) {
    if (key.includes(k.split(" ")[0])) return v;
  }
  return { grad: ["#1c2128","#0d1117"], emoji: "🏪", accent: "#25D366" };
}

// Deterministic helpers
function isOpen(id = "") {
  return (id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % 3 !== 0;
}
function trustScore(id = "") {
  return ((id.charCodeAt(0) || 10) % 46) + 5;
}

// ── Toast notification ────────────────────────────────────────────────────
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#25D366] text-[#0d1117] font-semibold text-sm px-5 py-2.5 rounded-full shadow-xl fade-in">
      {message}
    </div>
  );
}

// ── Voice intro player (compact) ──────────────────────────────────────────
function VoicePlayer({ url }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  function toggle() {
    if (!ref.current) return;
    if (playing) { ref.current.pause(); ref.current.currentTime = 0; setPlaying(false); }
    else { ref.current.play(); setPlaying(true); }
  }
  return (
    <>
      <audio ref={ref} src={url} onEnded={() => setPlaying(false)} preload="none" />
      <button
        onClick={toggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
          playing ? "bg-[#25D366]/20 border-[#25D366] text-[#25D366]" : "bg-black/40 border-white/20 text-white"
        }`}
      >
        {playing ? "⏸ Playing…" : "▶ Voice intro"}
      </button>
    </>
  );
}

// ── Star rating ───────────────────────────────────────────────────────────
function Stars({ rating, size = "sm" }) {
  const n = parseFloat(rating) || 0;
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <span key={s} className={`${size === "sm" ? "text-xs" : "text-base"} ${s <= Math.round(n) ? "text-yellow-400" : "text-gray-700"}`}>★</span>
      ))}
      <span className="text-gray-400 text-xs ml-1">{n.toFixed(1)}</span>
    </span>
  );
}

// ── Bottom sheet ──────────────────────────────────────────────────────────
function BottomSheet({ vendor, onClose, onChat, onAsk, onVisitProfile }) {
  const visual = getVisual(vendor.category);
  const open   = isOpen(vendor.id || "");
  const score  = trustScore(vendor.id || "");

  // Quick-reply suggestions based on category
  const quickReplies = [
    `What's your price range?`,
    `Are you available today?`,
    `Do you offer delivery?`,
    `How long does it take?`,
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 bg-[#161b22] rounded-t-3xl border-t border-[#30363d] shadow-2xl"
        style={{ animation: "slideUp 0.3s ease-out" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#30363d]" />
        </div>

        <div className="px-5 pb-8 overflow-y-auto max-h-[75vh]">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4 pt-2">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${visual.grad[0]}, ${visual.grad[1]})` }}
            >
              {visual.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-lg leading-tight">{vendor.name}</h2>
              <p className="text-gray-400 text-sm capitalize">{vendor.category}</p>
              <div className="flex items-center gap-2 mt-1">
                <Stars rating={vendor.rating} />
                <span className="text-gray-600 text-xs">·</span>
                <span className="text-gray-400 text-xs">👥 {score} neighbours</span>
              </div>
            </div>
            {/* Status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border flex-shrink-0 ${
              open ? "bg-green-900/40 border-green-700/40" : "bg-gray-800/60 border-gray-700/40"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
              <span className={`text-xs font-medium ${open ? "text-green-400" : "text-gray-400"}`}>
                {open ? "Open" : "Closed"}
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            {vendor.description || "Quality service near you. Tap Chat to get started."}
          </p>

          {/* Voice intro */}
          {vendor.voice_intro_url && (
            <div className="mb-4">
              <VoicePlayer url={vendor.voice_intro_url} />
            </div>
          )}

          {/* Quick replies */}
          <div className="mb-5">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">Quick questions</p>
            <div className="flex flex-wrap gap-2">
              {quickReplies.map((q) => (
                <button
                  key={q}
                  onClick={() => onAsk(vendor, q)}
                  className="bg-[#0d1117] border border-[#30363d] hover:border-[#25D366] text-gray-300 text-xs px-3 py-1.5 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => onChat(vendor)}
              className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-[#0d1117] hover:text-white font-bold py-3.5 rounded-2xl text-sm transition-colors"
            >
              🛒 Request Service
            </button>
            <button
              onClick={() => onAsk(vendor)}
              className="flex-1 flex items-center justify-center gap-2 bg-[#30363d] hover:bg-[#444c56] text-white font-semibold py-3.5 rounded-2xl text-sm transition-colors border border-[#444c56]"
            >
              🤖 Ask Sokoni
            </button>
          </div>

          {/* Visit profile */}
          <button
            onClick={() => onVisitProfile(vendor)}
            className="w-full mt-3 flex items-center justify-center gap-2 border border-[#30363d] hover:border-[#25D366] text-gray-300 font-medium py-3 rounded-2xl text-sm transition-colors"
          >
            👤 Visit Full Profile
          </button>
        </div>
      </div>
    </>
  );
}

// ── Full-screen vendor slide ──────────────────────────────────────────────
function VendorSlide({ vendor, onAsk, onRequest, onOpenSheet, isActive }) {
  const visual  = getVisual(vendor.category);
  const open    = isOpen(vendor.id || "");
  const score   = trustScore(vendor.id || "");
  const initials = vendor.name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "??";

  // Decorative floating particles (category-themed)
  const particles = [visual.emoji, "⭐", "📍", visual.emoji, "✨"];

  return (
    <div
      className="relative w-full flex-shrink-0 overflow-hidden"
      style={{
        // Each slide takes exactly the feed height (set by parent)
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
        height: "100%",
      }}
    >
      {/* ── Background: gradient + floating emoji particles ─────────── */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(160deg, ${visual.grad[0]} 0%, ${visual.grad[1]} 60%, #0d1117 100%)` }}
      />

      {/* Decorative large emoji (background) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span
          className="text-[160px] opacity-10"
          style={{ filter: "blur(2px)" }}
        >
          {visual.emoji}
        </span>
      </div>

      {/* Floating particles */}
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute text-2xl opacity-20 pointer-events-none select-none"
          style={{
            top:  `${15 + i * 16}%`,
            left: `${5 + i * 18}%`,
            animation: `float ${3 + i * 0.7}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.4}s`,
          }}
        >
          {p}
        </span>
      ))}

      {/* ── Centre hero emoji ────────────────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div
          className="w-32 h-32 rounded-3xl flex items-center justify-center text-7xl shadow-2xl mb-4"
          style={{
            background: `linear-gradient(135deg, ${visual.grad[0]}cc, ${visual.grad[1]}cc)`,
            border: `2px solid ${visual.accent}33`,
            boxShadow: `0 0 60px ${visual.accent}22`,
          }}
        >
          {visual.emoji}
        </div>
        {/* Category label */}
        <span
          className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
          style={{ background: `${visual.accent}22`, color: visual.accent, border: `1px solid ${visual.accent}44` }}
        >
          {vendor.category}
        </span>
      </div>

      {/* ── Bottom gradient overlay ──────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 h-2/3 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(13,17,23,0.98) 0%, rgba(13,17,23,0.7) 50%, transparent 100%)" }}
      />

      {/* ── Right-side floating action buttons ──────────────────────── */}
      <div className="absolute right-4 bottom-40 flex flex-col gap-4 items-center z-10">
        {/* Vendor avatar */}
        <button
          onClick={() => onOpenSheet(vendor)}
          className="flex flex-col items-center gap-1"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base border-2"
            style={{
              background: `linear-gradient(135deg, ${visual.grad[0]}, ${visual.grad[1]})`,
              borderColor: visual.accent,
            }}
          >
            {initials}
          </div>
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center -mt-3 border-2 border-[#0d1117]"
            style={{ background: visual.accent }}
          >
            <span className="text-[8px] text-black font-bold">+</span>
          </div>
        </button>

        {/* Ask Sokoni */}
        <button
          onClick={() => onAsk(vendor)}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-2xl hover:bg-black/70 transition-colors active:scale-95">
            🤖
          </div>
          <span className="text-white text-[10px] font-medium drop-shadow">Ask AI</span>
        </button>

        {/* Request service */}
        <button
          onClick={() => onRequest(vendor)}
          className="flex flex-col items-center gap-1"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl hover:opacity-90 transition-opacity active:scale-95"
            style={{ background: "#25D366" }}
          >
            🛒
          </div>
          <span className="text-white text-[10px] font-medium drop-shadow">Request</span>
        </button>

        {/* Info / details */}
        <button
          onClick={() => onOpenSheet(vendor)}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-2xl hover:bg-black/70 transition-colors active:scale-95">
            ℹ️
          </div>
          <span className="text-white text-[10px] font-medium drop-shadow">Details</span>
        </button>

        {/* Rating */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-yellow-400 text-xl">★</span>
          <span className="text-white text-[10px] font-bold">{parseFloat(vendor.rating || 4).toFixed(1)}</span>
        </div>
      </div>

      {/* ── Bottom info overlay ──────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 z-10">
        {/* Status badge */}
        <div className="flex items-center gap-2 mb-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
            open ? "bg-green-900/60 border-green-600/60" : "bg-gray-900/60 border-gray-600/40"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
            <span className={`text-xs font-medium ${open ? "text-green-400" : "text-gray-400"}`}>
              {open ? "Open now" : "Closed"}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-black/40 px-2.5 py-1 rounded-full border border-white/10">
            <span className="text-[#25D366] text-xs">👥</span>
            <span className="text-white text-xs">{score}</span>
          </div>
        </div>

        {/* Vendor name */}
        <button
          onClick={() => onOpenSheet(vendor)}
          className="text-left w-full mb-1"
        >
          <h2 className="text-white font-bold text-xl leading-tight drop-shadow-lg">
            {vendor.name}
          </h2>
        </button>

        {/* Description */}
        <p className="text-gray-300 text-sm leading-snug mb-3 line-clamp-2 drop-shadow">
          {vendor.description || "Quality service near you."}
        </p>

        {/* Bottom action bar */}
        <div className="flex gap-2">
          <button
            onClick={() => onRequest(vendor)}
            className="flex-1 flex items-center justify-center gap-2 font-bold py-3 rounded-2xl text-sm transition-all active:scale-95"
            style={{ background: "#25D366", color: "#0d1117" }}
          >
            🛒 Request Service
          </button>
          <button
            onClick={() => onAsk(vendor)}
            className="flex items-center justify-center gap-2 bg-black/50 backdrop-blur-sm border border-white/20 text-white font-semibold px-4 py-3 rounded-2xl text-sm transition-all active:scale-95 hover:bg-black/70"
          >
            🤖 Ask
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main MarketScreen ─────────────────────────────────────────────────────
export default function MarketScreen({ onSendToAssistant }) {
  const [vendors, setVendors]         = useState([]);
  const [filtered, setFiltered]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSheet, setActiveSheet] = useState(null);
  const [publicProfile, setPublicProfile] = useState(null); // full profile view
  const [toast, setToast]             = useState(null);
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [isListening, setIsListening] = useState(false);

  const feedRef       = useRef(null);
  const recognitionRef = useRef(null);
  const userId        = localStorage.getItem("sokoni_guest_id") || "guest";
  const displayName   = localStorage.getItem("sokoni_display_name") || "Guest";

  // ── Fetch all vendors once ────────────────────────────────────────────
  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVendors(null); // fetch all
      setVendors(data);
      setFiltered(data);
    } catch {
      setError("Couldn't load vendors. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVendors(); }, [loadVendors]);

  // ── Filter by search query ────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFiltered(vendors);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFiltered(
      vendors.filter((v) =>
        v.name?.toLowerCase().includes(q) ||
        v.category?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q)
      )
    );
    setCurrentIdx(0);
    // Scroll feed back to top
    if (feedRef.current) feedRef.current.scrollTop = 0;
  }, [searchQuery, vendors]);

  // ── Track current slide via IntersectionObserver ──────────────────────
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const slides = feed.querySelectorAll("[data-slide]");
    if (!slides.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setCurrentIdx(parseInt(entry.target.dataset.slide, 10));
          }
        });
      },
      { root: feed, threshold: 0.6 }
    );
    slides.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [filtered]);

  // ── Voice search ──────────────────────────────────────────────────────
  function toggleVoiceSearch() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    if (!isRecognitionSupported()) {
      alert("Voice search requires Chrome.");
      return;
    }
    setIsListening(true);
    recognitionRef.current = startListening(
      (transcript) => {
        setIsListening(false);
        setSearchQuery(transcript);
      },
      () => setIsListening(false)
    );
  }

  // ── Navigation helpers ────────────────────────────────────────────────
  function handleAsk(vendor, prefill = "") {
    const msg = prefill
      ? `About ${vendor.name} (${vendor.category}): ${prefill}`
      : `Tell me more about ${vendor.name} (${vendor.category}) and compare them with similar vendors near me.`;
    setActiveSheet(null);
    onSendToAssistant?.(msg);
  }

  async function handleRequest(vendor) {
    setActiveSheet(null);
    try {
      await requestService(userId, vendor.owner_id || vendor.id, `Hi! I'm interested in your ${vendor.category} service.`, displayName);
      setToast(`✅ Request sent to ${vendor.name}!`);
    } catch {
      onSendToAssistant?.(`Hi! I saw ${vendor.name}'s profile and I'm interested in their ${vendor.category} service.`);
    }
  }

  // ── Slide navigation dots ─────────────────────────────────────────────
  function scrollToSlide(idx) {
    const feed = feedRef.current;
    if (!feed) return;
    const slide = feed.querySelector(`[data-slide="${idx}"]`);
    slide?.scrollIntoView({ behavior: "smooth" });
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117] relative">

      {/* ── Sticky search bar ──────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 pb-2"
        style={{ background: "linear-gradient(to bottom, rgba(13,17,23,0.95) 70%, transparent)" }}
      >
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2.5 focus-within:border-[#25D366]/60 transition-colors">
          {/* Search icon */}
          <svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" className="w-4 h-4 flex-shrink-0">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
          </svg>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendors, services… e.g. gomesi"
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none"
          />

          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-gray-500 hover:text-white text-sm">✕</button>
          )}

          {/* Voice search */}
          {isRecognitionSupported() && (
            <button
              onClick={toggleVoiceSearch}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                isListening ? "bg-red-500 animate-pulse" : "hover:bg-white/10"
              }`}
            >
              <span className="text-sm">🎤</span>
            </button>
          )}
        </div>

        {/* Result count */}
        {searchQuery && (
          <p className="text-gray-500 text-xs mt-1.5 px-1">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""} for "{searchQuery}"
          </p>
        )}
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl shimmer" />
          <div className="space-y-2 w-48">
            <div className="shimmer h-3 rounded-full" />
            <div className="shimmer h-3 w-3/4 rounded-full" />
          </div>
          <p className="text-gray-500 text-sm">Loading market…</p>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="text-5xl">📡</span>
          <p className="text-gray-400 text-sm">{error}</p>
          <button onClick={loadVendors} className="bg-[#25D366] text-[#0d1117] font-semibold px-5 py-2 rounded-xl text-sm">
            Retry
          </button>
        </div>
      )}

      {/* ── Empty ───────────────────────────────────────────────────────── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="text-5xl">🔍</span>
          <p className="text-white font-semibold">No vendors found</p>
          <p className="text-gray-500 text-sm">Try a different search term</p>
          <button onClick={() => setSearchQuery("")} className="border border-[#25D366] text-[#25D366] font-medium px-5 py-2 rounded-xl text-sm">
            Clear search
          </button>
        </div>
      )}

      {/* ── Snap-scroll feed ────────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div
          ref={feedRef}
          className="flex-1 overflow-y-scroll no-scrollbar"
          style={{
            scrollSnapType: "y mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {filtered.map((vendor, i) => (
            <div
              key={vendor.id}
              data-slide={i}
              style={{ height: "100%", scrollSnapAlign: "start", scrollSnapStop: "always" }}
            >
              <VendorSlide
                vendor={vendor}
                isActive={i === currentIdx}
                onAsk={handleAsk}
                onRequest={handleRequest}
                onOpenSheet={setActiveSheet}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Slide indicator dots (right side) ───────────────────────────── */}
      {!loading && filtered.length > 1 && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1.5">
          {filtered.slice(0, Math.min(filtered.length, 8)).map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToSlide(i)}
              className={`rounded-full transition-all ${
                i === currentIdx ? "w-1.5 h-4 bg-white" : "w-1.5 h-1.5 bg-white/30"
              }`}
            />
          ))}
          {filtered.length > 8 && (
            <span className="text-white/40 text-[8px] text-center">+{filtered.length - 8}</span>
          )}
        </div>
      )}

      {/* ── Swipe hint (shown briefly on first load) ─────────────────────── */}
      {!loading && filtered.length > 1 && currentIdx === 0 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 pointer-events-none"
          style={{ animation: "fadeIn 0.5s ease-out 1.5s both" }}
        >
          <div className="text-white/60 text-xs">Swipe up</div>
          <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" className="w-5 h-5 animate-bounce">
            <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      {/* ── Bottom sheet ────────────────────────────────────────────────── */}
      {activeSheet && (
        <BottomSheet
          vendor={activeSheet}
          onClose={() => setActiveSheet(null)}
          onChat={handleRequest}
          onAsk={handleAsk}
          onVisitProfile={(v) => { setActiveSheet(null); setPublicProfile(v); }}
        />
      )}

      {/* ── Public vendor profile overlay ───────────────────────────────── */}
      {publicProfile && (
        <div className="absolute inset-0 z-50 bg-[#0d1117]">
          <VendorPublicProfile
            vendor={publicProfile}
            onClose={() => setPublicProfile(null)}
            onChat={(v, msg) => {
              setPublicProfile(null);
              handleRequest(v, msg);
            }}
            onAsk={(v) => {
              setPublicProfile(null);
              handleAsk(v);
            }}
          />
        </div>
      )}

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
