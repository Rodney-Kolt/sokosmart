import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// PWA plugin removed — it was generating a Workbox SW that overwrote
// public/sw.js and caused stale-cache blank screens on every deploy.
// The app still works as a PWA via the manifest.webmanifest in /public.

export default defineConfig({
  base: "/",
  plugins: [
    react(),
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
