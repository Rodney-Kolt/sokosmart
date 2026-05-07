/**
 * QuickReply.jsx – Premium pill buttons for AI quick replies.
 */

import React from "react";

export default function QuickReply({ buttons = [], onSelect }) {
  if (!buttons || buttons.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3 px-1">
      {buttons.map((label, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(label)}
          className="px-4 py-2 bg-[#141920] border border-slate-700/50 text-slate-300 text-sm rounded-full hover:border-orange-500/50 hover:text-orange-400 transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-sm"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
