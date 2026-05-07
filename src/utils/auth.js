/**
 * auth.js – Centralised Supabase auth helpers for Sokoni Chat.
 *
 * All functions include emailRedirectTo so Supabase emails point
 * to the correct pages inside the app.
 *
 * VITE_REDIRECT_URL should be set in .env:
 *   Development:  http://localhost:3000
 *   Production:   https://sokosmart-two.vercel.app
 */

import { supabase } from "./supabaseClient";

// Base URL for email redirects – falls back to the live Vercel URL
const REDIRECT_BASE =
  import.meta.env.VITE_REDIRECT_URL ||
  "https://sokosmart-two.vercel.app";

// ── Sign Up ───────────────────────────────────────────────────────────────

/**
 * Register a new user (vendor or consumer).
 * Sends a confirmation email that redirects to /welcome.
 */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${REDIRECT_BASE}/welcome`,
    },
  });
  if (error) throw error;
  return data;
}

// ── Sign In ───────────────────────────────────────────────────────────────

/**
 * Sign in with email + password.
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

// ── Reset Password ────────────────────────────────────────────────────────

/**
 * Send a password reset email.
 * The link in the email redirects to /reset-password.
 */
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${REDIRECT_BASE}/reset-password`,
  });
  if (error) throw error;
}

// ── Update Password ───────────────────────────────────────────────────────

/**
 * Update the current user's password.
 * Call this from the ResetPasswordPage after the user enters a new password.
 */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ── Sign Out ──────────────────────────────────────────────────────────────

export async function signOut() {
  await supabase.auth.signOut();
}

// ── Get current session ───────────────────────────────────────────────────

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
