import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,       // we register manually in index.html
      strategies: "generateSW",
      // Include all assets in the precache
      includeAssets: ["favicon.ico", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "screenshot-mobile.png", "offline.html"],
      manifest: {
        name: "Sokoni Chat",
        short_name: "Sokoni",
        description: "Your AI-powered, hyperlocal marketplace in Uganda",
        theme_color: "#0d1117",
        background_color: "#0d1117",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        id: "/",          // stable app identity — never change this
        prefer_related_applications: false,  // always prefer the PWA over any native app
        scope: "/",
        lang: "en-UG",
        categories: ["shopping", "social", "utilities"],
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        screenshots: [
          {
            src: "/screenshot-mobile.png",
            sizes: "390x844",
            type: "image/png",
            form_factor: "narrow",
            label: "Sokoni Chat – hyperlocal marketplace",
          },
        ],
        shortcuts: [
          {
            name: "Open Assistant",
            short_name: "Assistant",
            description: "Ask Sokoni AI for help",
            url: "/?tab=assistant",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "Browse Market",
            short_name: "Market",
            description: "Browse local vendors",
            url: "/?tab=market",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        // Serve offline.html when navigation fails (no network + not cached)
        navigateFallback: "/offline.html",
        navigateFallbackDenylist: [/^\/api/, /^\/health/],
        // Cache strategies
        runtimeCaching: [
          {
            // Cache Supabase API calls for 1 hour
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 3600 },
            },
          },
          {
            // Cache backend API calls for 5 minutes
            urlPattern: /^https:\/\/sokosmart.*\.onrender\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 30, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
