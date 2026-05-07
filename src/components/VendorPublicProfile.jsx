/**
 * VendorPublicProfile.jsx
 * Full public profile for a vendor.
 * Shows: avatar, follow button, stats, listings, services, description, chat, ratings.
 * Accessible from MarketScreen bottom sheet "Visit Profile" button.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  followVendor, unfollowVendor, checkIsFollowing,
  getFollowers, getVendorListings, trackProfileView,
} from "../utils/api";

const CATEGORY_VISUALS = {
  "tailoring":    { grad: ["#4a1d96","#831843"], emoji: "👗" },
  "phone repair": { grad: ["#1e3a5f","#0c4a6e"], emoji: "📱" },
  "plumbing":     { grad: ["#134e4a","#14532d"], emoji: "🚿" },
  "salon":        { grad: ["#831843","#701a75"], emoji: "💇" },
  "bakery":       { grad: ["#78350f","#7c2d12"], emoji: "🍞" },
  "fresh food":   { grad: ["#14532d","#365314"], emoji: "🥦" },
  "cleaning":     { grad: ["#0c4a6e","#1e3a5f"], emoji: "🧹" },
  "transport":    { grad: ["#713f12","#78350f"], emoji: "🛵" },
};
function getVisual(cat = "") {
  const k = cat.toLowerCase();
  for (const [key, v] of Object.entries(CATEGORY_VISUALS)) {
    if (k.includes(key.split(" ")[0])) return v;
  }
  return { grad: ["#1c2128","#0d1117"], emoji: "🏪" };
}

function Stars({ rating }) {
  const n = parseFloat(rating) || 0;
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <span key={s} className={`text-sm ${s <= Math.round(n) ? "text-yellow-400" : "text-gray-700"}`}>★</span>
      ))}
      <span className="text-gray-400 text-xs ml-1">{n.toFixed(1)}</span>
    </span>
  );
}

export default function VendorPublicProfile({ vendor, onClose, onChat, onAsk }) {
  const visual   = getVisual(vendor.category);
  const userId   = localStorage.getItem("sokoni_guest_id") || localStorage.getItem("sokoni_vendor_id") || "";
  const isOwn    = userId === vendor.owner_id;

  const [following, setFollowing]   = useState(false);
  const [followers, setFollowers]   = useState(0);
  const [listings, setListings]     = useState([]);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [activeTab, setActiveTab]   = useState("about");

  const load = useCallback(async () => {
    if (!vendor.owner_id) return;
    try {
      const [frs, isF] = await Promise.allSettled([
        getFollowers(vendor.owner_id),
        userId ? checkIsFollowing(userId, vendor.owner_id) : Promise.resolve(false),
      ]);
      if (frs.status === "fulfilled") setFollowers(frs.value?.count || 0);
      if (isF.status === "fulfilled") setFollowing(isF.value || false);

      const ls = await getVendorListings(vendor.owner_id, "active").catch(() => []);
      setListings(ls);

      // Track profile view
      if (!isOwn && vendor.owner_id) {
        trackProfileView(vendor.owner_id, userId || null).catch(() => {});
      }
    } catch { /* silent */ }
  }, [vendor.owner_id, userId, isOwn]);

  useEffect(() => { load(); }, [load]);

  async function handleFollow() {
    if (!userId) { alert("Sign in to follow vendors."); return; }
    setLoadingFollow(true);
    try {
      if (following) {
        await unfollowVendor(userId, vendor.owner_id);
        setFollowing(false);
        setFollowers((f) => Math.max(0, f - 1));
      } else {
        await followVendor(userId, vendor.owner_id);
        setFollowing(true);
        setFollowers((f) => f + 1);
      }
    } catch { /* silent */ } finally {
      setLoadingFollow(false);
    }
  }

  const isOpen = vendor.status === "open" || vendor.status == null;

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">

      {/* ── Hero banner ─────────────────────────────────────────────── */}
      <div
        className="relative h-36 flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${visual.grad[0]}, ${visual.grad[1]})` }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white"
        >←</button>
        <div className="absolute inset-0 flex items-center justify-center text-7xl opacity-20 select-none">
          {visual.emoji}
        </div>
      </div>

      {/* ── Profile header ──────────────────────────────────────────── */}
      <div className="px-4 pb-4 bg-[#0d1117] flex-shrink-0">
        <div className="flex items-end justify-between -mt-8 mb-3">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border-4 border-[#0d1117] shadow-xl"
            style={{ background: `linear-gradient(135deg, ${visual.grad[0]}, ${visual.grad[1]})` }}
          >
            {visual.emoji}
          </div>

          {/* Follow / Chat buttons */}
          <div className="flex gap-2 mt-2">
            {!isOwn && (
              <button
                onClick={handleFollow}
                disabled={loadingFollow}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  following
                    ? "bg-[#30363d] text-gray-300 border border-[#444c56]"
                    : "bg-[#25D366] text-[#0d1117]"
                }`}
              >
                {loadingFollow ? "…" : following ? "✓ Following" : "+ Follow"}
              </button>
            )}
            <button
              onClick={() => onChat(vendor)}
              className="px-4 py-2 rounded-full text-sm font-semibold bg-[#161b22] border border-[#30363d] text-white hover:border-[#25D366] transition-colors"
            >
              💬 Chat
            </button>
          </div>
        </div>

        {/* Name + status */}
        <h2 className="text-white font-bold text-xl leading-tight">{vendor.name}</h2>
        <p className="text-gray-400 text-sm capitalize mb-2">{vendor.category}</p>

        <div className="flex items-center gap-3 flex-wrap">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
            isOpen ? "bg-green-900/40 border-green-700/40" : "bg-gray-800/60 border-gray-700/40"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
            <span className={`text-xs font-medium ${isOpen ? "text-green-400" : "text-gray-400"}`}>
              {isOpen ? "Open now" : "Closed"}
            </span>
          </div>
          <Stars rating={vendor.rating} />
          <span className="text-gray-500 text-xs">👥 {followers} followers</span>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex border-b border-[#30363d] flex-shrink-0 bg-[#0d1117]">
        {["about","listings","contact"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors ${
              activeTab === tab
                ? "text-[#25D366] border-b-2 border-[#25D366]"
                : "text-gray-500"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* About tab */}
        {activeTab === "about" && (
          <div className="px-4 py-4 space-y-4">
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">About</p>
              <p className="text-gray-200 text-sm leading-relaxed">
                {vendor.description || "Quality service near you. Tap Chat to get started."}
              </p>
            </div>

            {/* Business hours (simulated) */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">Hours</p>
              {["Mon–Fri","Saturday","Sunday"].map((day, i) => (
                <div key={day} className="flex justify-between py-1.5 border-b border-[#30363d] last:border-0">
                  <span className="text-gray-300 text-sm">{day}</span>
                  <span className={`text-sm ${i === 2 ? "text-gray-500" : "text-[#25D366]"}`}>
                    {i === 2 ? "Closed" : "8:00 AM – 6:00 PM"}
                  </span>
                </div>
              ))}
            </div>

            {/* Ask AI */}
            <button
              onClick={() => onAsk(vendor)}
              className="w-full flex items-center gap-3 bg-[#161b22] border border-[#30363d] hover:border-[#25D366] rounded-2xl p-4 transition-colors"
            >
              <span className="text-2xl">🤖</span>
              <div className="text-left">
                <p className="text-white font-medium text-sm">Ask Sokoni AI</p>
                <p className="text-gray-500 text-xs">Compare with similar vendors near you</p>
              </div>
            </button>
          </div>
        )}

        {/* Listings tab */}
        {activeTab === "listings" && (
          <div className="px-4 py-4">
            {listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <span className="text-4xl">📦</span>
                <p className="text-gray-400 text-sm">No active listings yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {listings.map((listing) => (
                  <div key={listing.id} className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-white font-semibold text-sm">{listing.title}</p>
                      {listing.price && (
                        <span className="text-[#25D366] font-bold text-sm flex-shrink-0">
                          UGX {Number(listing.price).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {listing.description && (
                      <p className="text-gray-400 text-xs leading-relaxed mb-3 line-clamp-2">{listing.description}</p>
                    )}
                    <button
                      onClick={() => onChat(vendor, `I'm interested in your listing: ${listing.title}`)}
                      className="w-full bg-[#25D366] text-[#0d1117] font-semibold py-2 rounded-xl text-xs hover:bg-[#128C7E] hover:text-white transition-colors"
                    >
                      💬 Enquire about this
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contact tab */}
        {activeTab === "contact" && (
          <div className="px-4 py-4 space-y-3">
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 text-center">
              <p className="text-gray-400 text-xs mb-3">All contact is private and in-app. No phone numbers or emails are shared.</p>
              <button
                onClick={() => onChat(vendor)}
                className="w-full bg-[#25D366] text-[#0d1117] font-bold py-3 rounded-xl text-sm hover:bg-[#128C7E] hover:text-white transition-colors"
              >
                🛒 Request Service
              </button>
            </div>
            <button
              onClick={() => onAsk(vendor)}
              className="w-full bg-[#161b22] border border-[#30363d] text-white font-medium py-3 rounded-xl text-sm hover:border-[#25D366] transition-colors"
            >
              🤖 Ask Sokoni about this vendor
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
