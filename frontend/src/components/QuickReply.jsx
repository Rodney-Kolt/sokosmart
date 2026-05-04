/**
 * QuickReply.jsx
 * Renders a row of tappable quick-reply buttons below an AI message.
 * Clicking a button sends its label as the next user message.
 */

import React from "react";

export default function QuickReply({ buttons = [], onSelect }) {
  if (!buttons || buttons.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2 px-1">
      {buttons.map((label, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(label)}
          className="bg-white border border-sokoni-green text-sokoni-teal text-sm font-medium px-3 py-1.5 rounded-full hover:bg-green-50 active:bg-green-100 transition-colors shadow-sm"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
