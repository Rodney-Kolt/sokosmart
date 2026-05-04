/**
 * VendorCard.jsx
 * Displays a single vendor result card inside the chat.
 * Shows name, description, distance, star rating, and a "Request Service" button.
 * No contact info is ever shown.
 */

import React from "react";

function StarRating({ rating }) {
  const num = parseFloat(rating) || 0;
  const full  = Math.floor(num);
  const half  = num - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);

  return (
    <span className="flex items-center gap-0.5 text-yellow-400 text-sm">
      {"★".repeat(full)}
      {half && "½"}
      <span className="text-gray-300">{"★".repeat(empty)}</span>
      <span className="text-gray-500 text-xs ml-1">{num.toFixed(1)}</span>
    </span>
  );
}

export default function VendorCard({ vendor, onRequest }) {
  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100 w-full">
      {/* Coloured top strip based on category */}
      <div className="h-2 bg-gradient-to-r from-sokoni-green to-sokoni-darkgreen" />

      <div className="p-4">
        {/* Name + category badge */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 text-base leading-tight">{vendor.vname}</h3>
          {vendor.vcategory && (
            <span className="text-xs bg-green-100 text-sokoni-teal px-2 py-0.5 rounded-full whitespace-nowrap capitalize">
              {vendor.vcategory}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-gray-600 text-sm mb-3 leading-snug">{vendor.vdescription}</p>

        {/* Distance + rating row */}
        <div className="flex items-center justify-between mb-4">
          <span className="flex items-center gap-1 text-gray-500 text-xs">
            📍 {vendor.vdistance}
          </span>
          <StarRating rating={vendor.vrating} />
        </div>

        {/* CTA button */}
        <button
          onClick={() => onRequest(vendor)}
          className="w-full bg-sokoni-green hover:bg-sokoni-darkgreen text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
        >
          {vendor.vrequest || "Request Service"}
        </button>
      </div>
    </div>
  );
}
