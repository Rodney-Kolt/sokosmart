/**
 * VendorCard.jsx – Premium vendor result card inside the chat.
 * Dark surface, emerald accent, integrated CTA.
 */

import React from "react";
import { useAuth } from "../context/AuthContext";

function StarRating({ rating }) {
  const num  = parseFloat(rating) || 0;
  const full = Math.floor(num);
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <span key={s} className={`text-sm ${s <= full ? "text-yellow-400" : "text-slate-700"}`}>★</span>
      ))}
      <span className="text-slate-400 text-xs ml-1">{num.toFixed(1)}</span>
    </span>
  );
}

export default function VendorCard({ vendor, onRequest }) {
  const { requireAuth } = useAuth();
  const isOpen = vendor.vstatus === "open" || vendor.vstatus == null;

  function handleRequest() {
    if (!requireAuth("request_service", `To request service from ${vendor.vname}, create a free account.`)) return;
    onRequest(vendor);
  }

  return (
    <div className="bg-[#141920] border border-slate-800 rounded-2xl overflow-hidden w-full shadow-lg">
      {/* Emerald top strip */}
      <div className="h-1 bg-gradient-to-r from-emerald-600 to-emerald-400" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
            🏪
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white text-base leading-tight truncate font-display">
              {vendor.vname}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <StarRating rating={vendor.vrating} />
            </div>
          </div>
          {/* Open/closed badge */}
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${
            isOpen
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-slate-800 text-slate-400 border border-slate-700"
          }`}>
            {isOpen ? "● Open" : "Closed"}
          </span>
        </div>

        {/* Description */}
        <p className="text-slate-400 text-sm mb-3 leading-snug line-clamp-2">
          {vendor.vdescription}
        </p>

        {/* Distance */}
        <p className="text-slate-500 text-xs mb-4 flex items-center gap-1">
          <span>📍</span> {vendor.vdistance}
        </p>

        {/* CTA */}
        <button
          onClick={handleRequest}
          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:opacity-95 transition-all duration-300 active:scale-[0.98]"
        >
          {vendor.vrequest || "Request Service"}
        </button>
      </div>
    </div>
  );
}
