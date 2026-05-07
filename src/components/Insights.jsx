/**
 * Insights.jsx
 * Vendor analytics dashboard card.
 * Shows profile views (7-day sparkline), followers, orders, rank.
 * Uses a pure CSS/SVG sparkline — no external chart library needed.
 */

import React, { useState, useEffect } from "react";
import { getVendorAnalytics, getVendorRank } from "../utils/api";

// Simple SVG sparkline from an array of numbers
function Sparkline({ data, color = "#25D366", height = 32 }) {
  if (!data || data.length < 2) return null;
  const values = data.map((d) => d.views);
  const max    = Math.max(...values, 1);
  const w      = 100;
  const h      = height;
  const pts    = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Area fill */}
      <polyline
        points={`0,${h} ${pts} ${w},${h}`}
        fill={`${color}22`}
        stroke="none"
      />
    </svg>
  );
}

export default function Insights({ vendorId, onClose }) {
  const [analytics, setAnalytics] = useState(null);
  const [rank, setRank]           = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!vendorId) return;
    Promise.all([
      getVendorAnalytics(vendorId),
      getVendorRank(vendorId),
    ]).then(([a, r]) => {
      setAnalytics(a);
      setRank(r);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [vendorId]);

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Header */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onClose} className="text-gray-400 hover:text-white">←</button>
        <h2 className="text-white font-bold text-base flex-1">Insights</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {loading && (
          <div className="space-y-4">
            {[1,2,3].map((i) => <div key={i} className="shimmer h-24 rounded-2xl" />)}
          </div>
        )}

        {!loading && analytics && (
          <>
            {/* Rank card */}
            {rank && (
              <div className="bg-gradient-to-br from-[#0d2818] to-[#0d1117] border border-[#25D366]/30 rounded-2xl p-5 text-center">
                <p className="text-3xl mb-1">{rank.label.split(" ")[0]}</p>
                <p className="text-white font-bold text-lg">{rank.label.slice(2)}</p>
                <p className="text-[#25D366] text-sm mt-1">Score: {rank.score} pts</p>
                <div className="flex justify-center gap-4 mt-3 text-xs text-gray-400">
                  <span>⭐ {rank.breakdown.rating_pts} pts</span>
                  <span>👥 {rank.breakdown.follower_pts} pts</span>
                  <span>📦 {rank.breakdown.order_pts} pts</span>
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Followers",  value: analytics.follower_count,    icon: "👥" },
                { label: "Orders",     value: analytics.completed_orders,  icon: "📦" },
                { label: "Rating",     value: analytics.rating?.toFixed(1), icon: "⭐" },
              ].map((s) => (
                <div key={s.label} className="bg-[#161b22] border border-[#30363d] rounded-2xl p-3 text-center">
                  <p className="text-2xl mb-1">{s.icon}</p>
                  <p className="text-white font-bold text-lg">{s.value}</p>
                  <p className="text-gray-500 text-xs">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Profile views chart */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-semibold text-sm">Profile Views (7 days)</p>
                <p className="text-[#25D366] font-bold text-sm">{analytics.total_profile_views} total</p>
              </div>
              <Sparkline data={analytics.views_7d} />
              <div className="flex justify-between mt-1">
                {analytics.views_7d?.map((d) => (
                  <span key={d.date} className="text-gray-600 text-[9px]">
                    {new Date(d.date).toLocaleDateString("en-UG", { weekday: "short" }).slice(0,2)}
                  </span>
                ))}
              </div>
            </div>

            {/* Listing impressions */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center text-2xl">
                🛍️
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Listing Impressions</p>
                <p className="text-[#25D366] font-bold text-xl">{analytics.total_impressions}</p>
                <p className="text-gray-500 text-xs">Total views across all listings</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
