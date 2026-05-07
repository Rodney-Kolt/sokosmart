/**
 * MyListings.jsx
 * Vendor listing management screen.
 * Shows all listings with status toggles and view counts.
 */

import React, { useState, useEffect, useCallback } from "react";
import { getVendorListings, updateListingStatus } from "../utils/api";
import CreateListing from "./CreateListing";

const STATUS_COLORS = {
  active: "text-green-400 border-green-700/40 bg-green-900/20",
  paused: "text-yellow-400 border-yellow-700/40 bg-yellow-900/20",
  sold:   "text-gray-400 border-gray-700/40 bg-gray-900/20",
  draft:  "text-blue-400 border-blue-700/40 bg-blue-900/20",
};

const STATUS_NEXT = {
  active: ["paused", "sold"],
  paused: ["active", "sold"],
  sold:   ["active"],
  draft:  ["active"],
};

export default function MyListings({ vendorId, onClose }) {
  const [listings, setListings]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter]       = useState("all");

  const load = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const data = await getVendorListings(vendorId);
      setListings(data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(listingId, newStatus) {
    await updateListingStatus(listingId, newStatus);
    setListings((prev) => prev.map((l) => l.id === listingId ? { ...l, status: newStatus } : l));
  }

  const filtered = filter === "all" ? listings : listings.filter((l) => l.status === filter);

  if (showCreate) {
    return (
      <CreateListing
        vendorId={vendorId}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); load(); }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Header */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onClose} className="text-gray-400 hover:text-white">←</button>
        <h2 className="text-white font-bold text-base flex-1">My Listings</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-[#25D366] text-[#0d1117] font-semibold text-xs px-3 py-1.5 rounded-full"
        >
          + New
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 bg-[#161b22] border-b border-[#30363d] flex-shrink-0 overflow-x-auto no-scrollbar">
        {["all","active","paused","sold","draft"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 transition-colors ${
              filter === f ? "bg-[#25D366] text-[#0d1117]" : "bg-[#0d1117] text-gray-400"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && ` (${listings.filter((l) => l.status === f).length})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading && [1,2,3].map((i) => (
          <div key={i} className="bg-[#161b22] rounded-2xl p-4 border border-[#30363d]">
            <div className="shimmer h-4 w-1/2 rounded-full mb-2" />
            <div className="shimmer h-3 w-full rounded-full" />
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <span className="text-5xl">📦</span>
            <p className="text-white font-semibold">No listings yet</p>
            <button onClick={() => setShowCreate(true)} className="bg-[#25D366] text-[#0d1117] font-semibold px-5 py-2 rounded-xl text-sm">
              Create your first listing
            </button>
          </div>
        )}

        {!loading && filtered.map((listing) => (
          <div key={listing.id} className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{listing.title}</p>
                <p className="text-gray-500 text-xs capitalize">{listing.category}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${STATUS_COLORS[listing.status]}`}>
                {listing.status}
              </span>
            </div>

            {listing.price && (
              <p className="text-[#25D366] text-sm font-semibold mb-2">
                UGX {Number(listing.price).toLocaleString()}
              </p>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-4 mb-3 text-gray-500 text-xs">
              <span>👁 {listing.views || 0} views</span>
              <span>📅 {new Date(listing.created_at).toLocaleDateString("en-UG", { day: "numeric", month: "short" })}</span>
            </div>

            {/* Status actions */}
            <div className="flex gap-2 flex-wrap">
              {(STATUS_NEXT[listing.status] || []).map((next) => (
                <button
                  key={next}
                  onClick={() => handleStatusChange(listing.id, next)}
                  className="text-xs px-3 py-1.5 rounded-full border border-[#30363d] text-gray-300 hover:border-[#25D366] hover:text-[#25D366] transition-colors capitalize"
                >
                  Mark as {next}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
