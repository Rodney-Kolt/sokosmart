/**
 * BottomNav.jsx – Frosted glass bottom navigation with active glow.
 * Market | Assistant | Profile
 */

import React from "react";

const TABS = [
  {
    id: "market",
    label: "Market",
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path
          d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
          fill={active ? "rgba(249,115,22,0.15)" : "transparent"}
          stroke={active ? "#f97316" : "#64748b"}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M9 21V12h6v9"
          stroke={active ? "#f97316" : "#64748b"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "assistant",
    label: "Assistant",
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          stroke={active ? "#f97316" : "#64748b"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={active ? "rgba(249,115,22,0.08)" : "transparent"}
        />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Profile",
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path
          d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
          stroke={active ? "#f97316" : "#64748b"}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle
          cx="12" cy="7" r="4"
          stroke={active ? "#f97316" : "#64748b"}
          strokeWidth="1.5"
          fill={active ? "rgba(249,115,22,0.1)" : "transparent"}
        />
      </svg>
    ),
  },
];

export default function BottomNav({ activeTab, setActiveTab, badges = {} }) {
  return (
    <div
      className="flex-shrink-0 border-t border-slate-800/50 bottom-nav-safe"
      style={{
        background: "rgba(20,25,32,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {TABS.map((tab) => {
          const isActive   = activeTab === tab.id;
          const badgeCount = badges[tab.id] || 0;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center gap-1 flex-1 py-2 transition-all duration-300 active:scale-95 relative"
            >
              {/* Icon with active background pill */}
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                isActive ? "bg-orange-500/10" : ""
              }`}>
                {tab.icon(isActive)}
                {/* Badge */}
                {badgeCount > 0 && (
                  <span className="absolute top-0 right-1/4 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-semibold transition-colors duration-300 ${
                isActive ? "text-orange-500" : "text-slate-500"
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
