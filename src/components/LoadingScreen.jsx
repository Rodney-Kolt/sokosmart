/**
 * LoadingScreen.jsx – Immersive entry splash screen.
 * Dark background, glowing logo, Space Grotesk heading, bouncing dots.
 */

import React, { useEffect, useState } from "react";

export default function LoadingScreen({ onDone }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 2000);
    const doneTimer = setTimeout(() => onDone(), 2600);
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0A0E14] ${
        exiting ? "splash-exit" : ""
      }`}
    >
      {/* Glowing logo */}
      <div className="relative mb-8">
        {/* Animated glow ring */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl blur-2xl opacity-30 animate-pulse scale-150" />
        {/* Logo card */}
        <div className="relative w-24 h-24 bg-[#141920] rounded-3xl shadow-2xl flex items-center justify-center border border-orange-500/20">
          <span className="text-5xl select-none">🛍️</span>
        </div>
      </div>

      {/* Brand name */}
      <h1 className="text-4xl font-bold text-white tracking-tight font-display mb-2">
        Sokoni
      </h1>
      <p className="text-slate-400 text-base font-medium tracking-wide">
        Your market, your language
      </p>

      {/* Bouncing dots */}
      <div className="flex gap-2 mt-10">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-3 h-3 bg-orange-500 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
