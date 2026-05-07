import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      strategies: "generateSW",
      includeAssets: ["favicon.ico", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "screenshot-mobile.png", "screenshot-wide.png", "offline.html"],
      manifest: {
        name: "Sokoni Chat",
        short_name: "Sokoni",
        description: "Your AI-powered, hyperlocal marketplace in Uganda",
        theme_color: "#0d1117",
        background_color: "#0d1117",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        id: "/",
        prefer_related_applications: false,
        scope: "/",
        lang: "en-UG",
        dir: "ltr",
        iarc_rating_id: "e84b072d-71b3-4d3e-86ae-31a8ce4e53b7",
        display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
        categories: ["shopping", "social", "utilities"],
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
        screenshots: [
          { src: "/screenshot-mobile.png", sizes: "390x844", type: "image/png", form_factor: "narrow", label: "Sokoni Chat – hyperlocal marketplace" },
          { src: "/screenshot-wide.png", sizes: "1280x800", type: "image/png", form_factor: "wide", label: "Sokoni Chat – desktop view" },
        ],
        shortcuts: [
          { name: "Open Assistant", short_name: "Assistant", description: "Ask Sokoni AI for help", url: "/?tab=assistant", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "Browse Market", short_name: "Market", description: "Browse local vendors", url: "/?tab=market", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        additionalManifestEntries: [],
        // Only use offline fallback for actual navigation failures — NOT for the app shell
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: { cacheName: "supabase-cache", expiration: { maxEntries: 50, maxAgeSeconds: 3600 } },
          },
          {
            urlPattern: /^https:\/\/sokosmart.*\.onrender\.com\/.*/i,
            handler: "NetworkFirst",
            options: { cacheName: "api-cache", expiration: { maxEntries: 30, maxAgeSeconds: 300 }, networkTimeoutSeconds: 10 },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
