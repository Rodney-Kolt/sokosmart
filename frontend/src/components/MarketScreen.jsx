/**
 * MarketScreen.jsx
 * Placeholder for the upcoming hyperlocal marketplace.
 * Shows shimmer skeleton cards to hint at future functionality.
 */

import React from "react";

function ShimmerCard() {
  return (
    <div className="rounded-2xl overflow-hidden border border-[#30363d]">
      <div className="shimmer h-28 w-full" />
      <div className="p-3 bg-[#161b22] space-y-2">
        <div className="shimmer h-3 w-3/4 rounded-full" />
        <div className="shimmer h-3 w-1/2 rounded-full" />
        <div className="shimmer h-7 w-full rounded-xl mt-3" />
      </div>
    </div>
  );
}

export default function MarketScreen() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#0d1117] flex flex-col">

      {/* Header */}
      <div className="px-4 pt-6 pb-4 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-xl">
            🛒
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Sokoni Market</h1>
            <p className="text-gray-400 text-xs">Hyperlocal. Private. Yours.</p>
          </div>
        </div>
      </div>

      {/* Coming soon hero */}
      <div className="mx-4 mt-6 rounded-2xl bg-gradient-to-br from-[#0d2818] to-[#0d1117] border border-[#25D366]/30 p-6 text-center">
        <div className="text-5xl mb-4">🏪</div>
        <h2 className="text-white font-bold text-xl mb-2">Marketplace Coming Soon</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          We're building a hyperlocal market that's nothing like Jiji or Jumia.
          Browse, buy, and sell — all within your neighbourhood.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-xs font-medium px-4 py-2 rounded-full">
          <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
          In development
        </div>
      </div>

      {/* Feature teasers */}
      <div className="px-4 mt-6">
        <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">What's coming</p>
        <div className="space-y-3">
          {[
            { icon: "📍", title: "Hyperlocal listings", desc: "Products & services within 5 km of you" },
            { icon: "🔒", title: "Privacy-first", desc: "No phone numbers exposed. Chat in-app." },
            { icon: "🤖", title: "AI-powered discovery", desc: "Sokoni finds the best match for you" },
            { icon: "⚡", title: "Instant requests", desc: "One tap to connect with a vendor" },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-3 bg-[#161b22] rounded-xl p-3 border border-[#30363d]">
              <span className="text-2xl flex-shrink-0">{f.icon}</span>
              <div>
                <p className="text-white text-sm font-medium">{f.title}</p>
                <p className="text-gray-500 text-xs mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shimmer skeleton preview */}
      <div className="px-4 mt-6 mb-6">
        <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">Preview</p>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <ShimmerCard key={i} />)}
        </div>
      </div>
    </div>
  );
}
