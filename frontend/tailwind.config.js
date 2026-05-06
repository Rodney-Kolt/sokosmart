/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Legacy Sokoni green palette (kept for backward compat)
        sokoni: {
          green:     "#25D366",
          darkgreen: "#128C7E",
          teal:      "#075E54",
          light:     "#DCF8C6",
          bubble:    "#FFFFFF",
          bg:        "#ECE5DD",
          header:    "#075E54",
        },
        // New design system
        dark: {
          bg:      "#0A0E14",
          surface: "#141920",
          card:    "#1A2030",
          border:  "#1E2A3A",
          muted:   "#64748b",
        },
        brand: {
          orange: "#f97316",
          red:    "#ef4444",
          ember:  "#fb923c",
        },
        vendor: {
          green:  "#10b981",
          dark:   "#059669",
        },
      },
      fontFamily: {
        sans:    ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "float-up":   "floatUp 0.4s ease-out",
        "slide-up":   "slideUp 0.3s ease-out",
      },
      keyframes: {
        glowPulse: {
          "0%, 100%": { opacity: "0.3" },
          "50%":      { opacity: "0.7" },
        },
        floatUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          from: { transform: "translateY(100%)" },
          to:   { transform: "translateY(0)" },
        },
      },
      boxShadow: {
        "glow-orange": "0 0 30px rgba(249,115,22,0.25)",
        "glow-green":  "0 0 30px rgba(16,185,129,0.25)",
        "glow-sm":     "0 0 15px rgba(249,115,22,0.15)",
      },
    },
  },
  plugins: [],
};
