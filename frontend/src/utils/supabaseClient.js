/**
 * supabaseClient.js – Initialises the Supabase JS client.
 * Uses the PUBLIC anon key (safe to expose in the browser).
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
