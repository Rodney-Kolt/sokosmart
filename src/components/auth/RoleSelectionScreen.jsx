/**
 * RoleSelectionScreen.jsx
 * Step 3: choose Consumer or Vendor role.
 */

import React from "react";
import { motion } from "framer-motion";

const roles = [
  {
    id:       "consumer",
    emoji:    "🛒",
    title:    "I'm a Customer",
    subtitle: "Find local vendors, order services, and get things done.",
    gradient: "from-orange-500 to-red-500",
    glow:     "shadow-orange-500/20",
  },
  {
    id:       "vendor",
    emoji:    "🏪",
    title:    "I'm a Vendor",
    subtitle: "List your services, receive orders, and grow your business.",
    gradient: "from-violet-500 to-purple-600",
    glow:     "shadow-violet-500/20",
  },
];

export default function RoleSelectionScreen({ onSelect, onBack }) {
  return (
    <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">

        <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-1 active:scale-[0.98] transition-all">
          ← Back
        </button>

        <div className="flex flex-col items-center mb-10">
          <h1 className="text-white text-2xl font-bold text-center">How will you use Sokoni?</h1>
          <p className="text-slate-400 text-sm mt-2 text-center">You can always change this later.</p>
        </div>

        <div className="space-y-4">
          {roles.map((r, i) => (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => onSelect(r.id)}
              className={`w-full p-5 bg-[#141920] border border-slate-800 rounded-2xl text-left hover:border-slate-600 active:scale-[0.98] transition-all group`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${r.gradient} flex items-center justify-center text-3xl shadow-lg ${r.glow} group-hover:scale-105 transition-transform`}>
                  {r.emoji}
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-base">{r.title}</p>
                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{r.subtitle}</p>
                </div>
                <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-lg">→</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
