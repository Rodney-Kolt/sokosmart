/**
 * LoadingScreen.jsx
 * Full-screen splash shown on app launch.
 * Fades out after 2.2s and calls onDone() to reveal the main app.
 */

import React, { useEffect, useState } from "react";

export default function LoadingScreen({ onDone }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Start exit animation after 1.8s, call onDone after animation completes
    const exitTimer  = setTimeout(() => setExiting(true), 1800);
    const doneTimer  = setTimeout(() => onDone(), 2400);
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0d1117] ${
        exiting ? "splash-exit" : ""
      }`}
    >
      {/* Logo mark */}
      <div className="logo-pulse mb-6 relative">
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-full bg-[#25D366] opacity-20 blur-xl scale-150" />
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center shadow-2xl">
          <span className="text-5xl select-none">🛍️</span>
        </div>
      </div>

      {/* Brand name */}
      <h1 className="text-white text-3xl font-bold tracking-tight mb-1">
        Sokoni Chat
      </h1>
      <p className="text-[#25D366] text-sm font-medium tracking-wide">
        Your hyperlocal marketplace
      </p>

      {/* Fake typing dots */}
      <div className="flex gap-2 mt-10">
        <div className="typing-dot" style={{ background: "#25D366" }} />
        <div className="typing-dot" style={{ background: "#25D366" }} />
        <div className="typing-dot" style={{ background: "#25D366" }} />
      </div>
    </div>
  );
}
