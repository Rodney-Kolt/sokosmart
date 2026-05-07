/**
 * QuickActionCard.jsx
 * Large tappable card for the Home screen quick actions grid.
 */

import React from "react";
import { motion } from "framer-motion";

export default function QuickActionCard({ emoji, title, subtitle, gradient, onClick, badge }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative flex flex-col items-start gap-2 p-4 bg-[#141920] border border-slate-800 rounded-2xl text-left hover:border-slate-700 active:scale-[0.97] transition-all w-full min-h-[96px]"
    >
      {badge > 0 && (
        <span className="absolute top-3 right-3 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl shadow-lg`}>
        {emoji}
      </div>
      <div>
        <p className="text-slate-100 font-semibold text-sm leading-tight">{title}</p>
        {subtitle && <p className="text-slate-500 text-xs mt-0.5 leading-tight">{subtitle}</p>}
      </div>
    </motion.button>
  );
}
