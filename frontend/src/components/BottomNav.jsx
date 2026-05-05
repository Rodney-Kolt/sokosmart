/**
 * BottomNav.jsx
 * Persistent bottom navigation bar with three tabs:
 *   Market | Assistant | Profile
 * Uses a simple activeTab prop + setActiveTab callback (no router needed).
 */

import React from "react";

const TABS = [
  {
    id: "market",
    label: "Market",
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? "#25D366" : "#6b7280"} className="w-6 h-6">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" opacity="0.2"/>
        <path fillRule="evenodd" clipRule="evenodd"
          d="M2.25 9.75a.75.75 0 01.28-.585l9-7a.75.75 0 01.94 0l9 7a.75.75 0 01.28.585V20a2 2 0 01-2 2H4a2 2 0 01-2-2V9.75zm1.5.415V20a.5.5 0 00.5.5h4.25v-5.25a.75.75 0 01.75-.75h3.5a.75.75 0 01.75.75V20.5H19a.5.5 0 00.5-.5V10.165L12 4.22 3.75 10.165z"
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
          stroke={active ? "#25D366" : "#6b7280"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
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
          d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"
          stroke={active ? "#25D366" : "#6b7280"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function BottomNav({ activeTab, setActiveTab }) {
  return (
    <div className="flex-shrink-0 bg-[#161b22] border-t border-[#30363d] bottom-nav-safe">
      <div className="flex items-stretch h-16">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? "text-[#25D366]" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.icon(isActive)}
              <span className={`text-[10px] font-medium ${isActive ? "text-[#25D366]" : "text-gray-500"}`}>
                {tab.label}
              </span>
              {/* Active indicator dot */}
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-[#25D366]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
