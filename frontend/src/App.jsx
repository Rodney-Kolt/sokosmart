/**
 * App.jsx – Sokoni Smart root component.
 *
 * Layout:
 *   Splash → Auth check → AuthWizard (unauthenticated) → MainShell (3-tab)
 *
 * MainShell tabs:
 *   market    → MarketScreen  (TikTok-style vendor reels)
 *   assistant → AssistantScreen (AI chat)
 *   profile   → ProfileScreen / VendorDashboard
 */

import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";
import ErrorBoundary     from "./components/ErrorBoundary";
import LoadingScreen     from "./components/LoadingScreen";
import BottomNav         from "./components/BottomNav";
import MarketScreen      from "./components/MarketScreen";
import AssistantScreen   from "./components/AssistantScreen";
import ProfileScreen     from "./components/ProfileScreen";
import VendorDashboard   from "./components/VendorDashboard";
import WelcomePage       from "./components/WelcomePage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import AuthWizard        from "./components/auth/AuthWizard";
import SignUpPromptModal from "./components/SignUpPromptModal";
import OTPModal          from "./components/OTPModal";
import ErrorDashboard    from "./components/ErrorDashboard";
import { getUnreadCount, getNotificationCount, subscribeToNotifications } from "./utils/api";

// ── Keep Render backend awake ─────────────────────────────────────────────
function useWakeUpBackend() {
  useEffect(() => {
    const url = import.meta.env.VITE_API_URL;
    if (!url) return;
    const ping = () => fetch(`${url}/health`, { method: "GET" }).catch(() => {});
    ping();
    const interval = setInterval(ping, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
}

// ── Main three-tab shell ──────────────────────────────────────────────────
function MainShell() {
  const { otpModal, hideOTPModal } = useAuth();

  const [activeTab,   setActiveTab]   = useState("assistant");
  const [pendingMsg,  setPendingMsg]  = useState(null);
  const [badges,      setBadges]      = useState({ assistant: 0, profile: 0 });
  const [profileView, setProfileView] = useState("profile");
  const [showOnboard, setShowOnboard] = useState(false);

  const userId = localStorage.getItem("sokoni_guest_id") || localStorage.getItem("sokoni_vendor_id") || "";
  const role   = localStorage.getItem("sokoni_role") || "consumer";

  // ── Badge polling ─────────────────────────────────────────────────────
  const pollUnread = useCallback(async () => {
    if (!userId) return;
    try {
      const c = await getUnreadCount(userId, role);
      setBadges((p) => ({ ...p, assistant: c }));
    } catch { /* silent */ }
    try {
      const n = await getNotificationCount(userId);
      setBadges((p) => ({ ...p, profile: n }));
    } catch { /* silent */ }
  }, [userId, role]);

  useEffect(() => {
    pollUnread();
    const iv = setInterval(pollUnread, 10000);
    return () => clearInterval(iv);
  }, [pollUnread]);

  useEffect(() => {
    if (!userId) return;
    let unsub = () => {};
    try {
      unsub = subscribeToNotifications(userId, () => {
        setBadges((p) => ({ ...p, profile: (p.profile || 0) + 1 }));
      });
    } catch { /* silent */ }
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (activeTab === "assistant") setBadges((p) => ({ ...p, assistant: 0 }));
    if (activeTab === "profile")   setBadges((p) => ({ ...p, profile: 0 }));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "profile") setProfileView("profile");
  }, [activeTab]);

  function handleSendToAssistant(msg) {
    setPendingMsg(msg);
    setActiveTab("assistant");
  }

  // Auth wizard overlay (triggered from SignUpPromptModal)
  if (showOnboard) {
    return (
      <div className="flex flex-col h-full bg-[#0A0E14]">
        <AuthWizard onDone={() => setShowOnboard(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">

        {/* Market tab */}
        {activeTab === "market" && (
          <MarketScreen onSendToAssistant={handleSendToAssistant} />
        )}

        {/* Assistant tab — always mounted, shown/hidden via visible prop */}
        <AssistantScreen
          visible={activeTab === "assistant"}
          initialMessage={activeTab === "assistant" ? pendingMsg : null}
          onInitialMessageConsumed={() => setPendingMsg(null)}
        />

        {/* Profile tab */}
        {activeTab === "profile" && (
          profileView === "dashboard"
            ? <VendorDashboard onBack={() => setProfileView("profile")} />
            : <ProfileScreen onNavigateDashboard={() => { setProfileView("dashboard"); setActiveTab("profile"); }} />
        )}
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} badges={badges} />

      {/* Global sign-up prompt modal */}
      <SignUpPromptModal onCreateAccount={() => setShowOnboard(true)} />

      {/* Global OTP modal */}
      <OTPModal
        isOpen={otpModal.visible}
        onClose={hideOTPModal}
        onVerified={(email) => { otpModal.onVerified?.(email); }}
        action={otpModal.action}
        prefillEmail={otpModal.prefillEmail}
      />
    </div>
  );
}

// ── Inner app ─────────────────────────────────────────────────────────────
function InnerApp() {
  const { isLoading, isAuthenticated, isGuest } = useAuth();
  const [splashDone,  setSplashDone]  = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  useWakeUpBackend();

  useEffect(() => {
    if (splashDone && !isLoading && !isAuthenticated && !isGuest) {
      setShowOnboard(true);
    }
  }, [splashDone, isLoading, isAuthenticated, isGuest]);

  // Always show splash until both splash animation AND auth check are done
  if (!splashDone || isLoading) {
    return <LoadingScreen onDone={() => setSplashDone(true)} />;
  }

  return (
    <div className="flex justify-center bg-[#0A0E14] h-[100dvh]">
      <div className="w-full max-w-md bg-[#0A0E14] h-full flex flex-col shadow-2xl overflow-hidden">
        <BrowserRouter>
          <Routes>
            <Route path="/welcome"        element={<WelcomePage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/error"          element={<ErrorDashboard />} />
            <Route path="/dashboard"      element={<Navigate to="/" replace />} />
            <Route path="/chat"           element={<Navigate to="/" replace />} />
            <Route path="/onboarding"     element={<Navigate to="/" replace />} />
            <Route path="/*" element={
              showOnboard
                ? <AuthWizard onDone={() => setShowOnboard(false)} />
                : <MainShell />
            } />
          </Routes>
        </BrowserRouter>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}
