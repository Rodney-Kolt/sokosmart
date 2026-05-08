/**
 * supabaseClient.js – Initialises the Supabase JS client.
 * Uses the PUBLIC anon key (safe to expose in the browser).
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Warn loudly in dev if env vars are missing — silent failure causes infinite hangs
if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error(
    "[Supabase] MISSING ENV VARS!\n" +
    "VITE_SUPABASE_URL:", SUPABASE_URL ? "✅" : "❌ NOT SET",
    "\nVITE_SUPABASE_ANON_KEY:", SUPABASE_ANON ? "✅" : "❌ NOT SET",
    "\nAdd these to Vercel → Settings → Environment Variables"
  );
}

export const supabase = createClient(
  SUPABASE_URL  || "https://placeholder.supabase.co",
  SUPABASE_ANON || "placeholder-anon-key",
  {
    auth: {
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: true,
    },
  }
);

// Export a flag so components can check if Supabase is properly configured
export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON);
