/**
 * AuthContext.jsx
 * Global auth state for Sokoni Chat.
 *
 * Provides:
 *   session      – Supabase session (null if not logged in)
 *   user         – Supabase user object
 *   isGuest      – true if browsing with a guest UUID (no Supabase session)
 *   isLoading    – true while checking session on app launch
 *   showSignUp   – function to trigger the SignUpPromptModal
 *   hideSignUp   – function to dismiss the modal
 *   signUpPrompt – { visible, action, message } for the modal
 *   signOutAll   – clears session + localStorage
 *   showOTPModal – function to open the OTP verification modal
 *   hideOTPModal – function to close the OTP modal
 *   otpModal     – { visible, action, prefillEmail } for OTPModal
 *   isEmailVerified – true once user has completed OTP verification this session
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../utils/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session,   setSession]   = useState(null);
  const [user,      setUser]      = useState(null);
  const [profile,   setProfile]   = useState(null); // from profiles table
  const [isGuest,   setIsGuest]   = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Sign-up prompt modal state
  const [signUpPrompt, setSignUpPrompt] = useState({
    visible: false,
    action:  "",
    message: "Create a free account to continue.",
  });

  // OTP modal state
  const [otpModal, setOtpModal] = useState({
    visible:      false,
    action:       "continue",
    prefillEmail: "",
    onVerified:   null,
  });

  // Track whether the user has verified their email via OTP this session
  const [isEmailVerified, setIsEmailVerified] = useState(
    () => sessionStorage.getItem("sokoni_email_verified") === "true"
  );

  // ── Bootstrap: check session on mount ────────────────────────────────
  useEffect(() => {
    // Safety timeout — if auth check takes >8s, unblock the UI anyway
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
      console.warn("[AuthContext] Session check timed out — unblocking UI");
    }, 8000);

    async function bootstrap() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("[AuthContext] getSession error:", error.message);
          // Don't crash — just treat as no session
        }
        if (data?.session) {
          setSession(data.session);
          setUser(data.session.user);
          const uid = data.session.user.id;

          // Fetch profile — wrapped separately so a DB error doesn't block auth
          try {
            const { data: prof } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", uid)
              .maybeSingle();
            if (prof) {
              setProfile(prof);
              localStorage.setItem("sokoni_display_name",
                prof.full_name || prof.business_name ||
                data.session.user.email?.split("@")[0] || "User");
              if (prof.role) localStorage.setItem("sokoni_role", prof.role);
            }
          } catch (profileErr) {
            console.warn("[AuthContext] Profile fetch failed:", profileErr.message);
          }

          // Sync vendor status
          try {
            if (!localStorage.getItem("sokoni_vendor_id")) {
              const { data: vendor } = await supabase
                .from("vendors")
                .select("owner_id, name")
                .eq("owner_id", uid)
                .maybeSingle();
              if (vendor) {
                localStorage.setItem("sokoni_role",         "vendor");
                localStorage.setItem("sokoni_vendor_id",    uid);
                localStorage.setItem("sokoni_display_name", vendor.name);
              }
            }
          } catch (vendorErr) {
            console.warn("[AuthContext] Vendor sync failed:", vendorErr.message);
          }
        } else {
          // No session — check for guest
          const guestId = localStorage.getItem("sokoni_guest_id");
          if (guestId) setIsGuest(true);
        }
      } catch (err) {
        // Catch-all — never leave the app stuck on loading
        console.error("[AuthContext] Bootstrap failed:", err.message);
      } finally {
        clearTimeout(safetyTimer);
        setIsLoading(false);
      }
    }
    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (event === "SIGNED_IN" && newSession) {
          setSession(newSession);
          setUser(newSession.user);
          setIsGuest(false);
          // Fetch profile on sign-in
          const { data: prof } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", newSession.user.id)
            .maybeSingle();
          if (prof) {
            setProfile(prof);
            localStorage.setItem("sokoni_display_name", prof.display_name || newSession.user.email?.split("@")[0] || "User");
            if (prof.role) localStorage.setItem("sokoni_role", prof.role);
          }
        } else if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsGuest(false);
        } else if (event === "TOKEN_REFRESHED" && newSession) {
          setSession(newSession);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // ── Guest mode helpers ────────────────────────────────────────────────
  function enterGuestMode(displayName) {
    let id = localStorage.getItem("sokoni_guest_id");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("sokoni_guest_id", id);
    }
    localStorage.setItem("sokoni_display_name", displayName || "Guest");
    localStorage.setItem("sokoni_role", "consumer");
    setIsGuest(true);
  }

  // ── Sign-up prompt ────────────────────────────────────────────────────
  function showSignUp(action = "", message = "Create a free account to continue.") {
    setSignUpPrompt({ visible: true, action, message });
  }

  function hideSignUp() {
    setSignUpPrompt((p) => ({ ...p, visible: false }));
  }

  // ── OTP modal ─────────────────────────────────────────────────────────
  /**
   * showOTPModal(action, prefillEmail, onVerified)
   * Opens the OTP modal. onVerified is called with the verified email.
   */
  function showOTPModal(action = "continue", prefillEmail = "", onVerified = null) {
    setOtpModal({ visible: true, action, prefillEmail, onVerified });
  }

  function hideOTPModal() {
    setOtpModal((m) => ({ ...m, visible: false }));
  }

  function markEmailVerified() {
    sessionStorage.setItem("sokoni_email_verified", "true");
    setIsEmailVerified(true);
  }

  /**
   * requireEmailVerification(action, onVerified)
   * If the user hasn't verified their email this session, opens the OTP modal.
   * Returns true if already verified (caller can proceed), false if modal was shown.
   */
  function requireEmailVerification(action, onVerified) {
    if (isEmailVerified) return true;
    const email = user?.email || localStorage.getItem("sokoni_email") || "";
    showOTPModal(action, email, (verifiedEmail) => {
      markEmailVerified();
      hideOTPModal();
      onVerified?.(verifiedEmail);
    });
    return false;
  }

  // ── Sign out ──────────────────────────────────────────────────────────
  async function signOutAll() {
    await supabase.auth.signOut();
    [
      "sokoni_role", "sokoni_vendor_id", "sokoni_display_name",
      "sokoni_guest_id", "sokoni_lat", "sokoni_lng", "sokoni_verified_email",
    ].forEach((k) => localStorage.removeItem(k));
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsGuest(false);
  }

  // ── Gate helper: call before any sensitive action ─────────────────────
  /**
   * requireAuth(action, message) → returns true if allowed, false if blocked.
   * If blocked, shows the sign-up prompt modal.
   */
  function requireAuth(action, message) {
    if (session || !isGuest) return true; // authenticated
    showSignUp(action, message);
    return false;
  }

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      setProfile,
      isGuest,
      isLoading,
      isAuthenticated: !!session,
      isEmailVerified,
      enterGuestMode,
      showSignUp,
      hideSignUp,
      signUpPrompt,
      otpModal,
      showOTPModal,
      hideOTPModal,
      markEmailVerified,
      requireEmailVerification,
      signOutAll,
      requireAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
