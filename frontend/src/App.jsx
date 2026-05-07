/**
 * App.jsx – Sokoni Smart root component.
 *
 * Layout:
 *   Splash → Auth check → AuthWizard (if not logged in) → MainShell
 *
 * MainShell:
 *   Two-tab BottomNav: Home | Profile
 *   Floating AI Button (FAB) → AIAssistantBottomSheet
 *   Market opens as full-screen overlay with close button
 */

import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth }    from "./context/AuthContext";
import LoadingScreen                from "./components/LoadingScreen";
import BottomNav                    from "./components/BottomNav";
import HomeScreen                   from "./components/HomeScreen";
import MarketScreen                 from "./components/MarketScreen";
import ProfileScreen                from "./components/ProfileScreen";
import VendorDashboard              from "./components/VendorDashboard";
import WelcomePage                  from "./components/WelcomePage";
import ResetPasswordPage            from "./components/ResetPasswordPage";
import AuthWizard                   from "./components/auth/AuthWizard";
import SignUpPromptModal            from "./components/SignUpPromptModal";
import OTPModal                     from "./components/OTPModal";
import FloatingAIButton             from "./components/FloatingAIButton";
import AIAssistantBottomSheet       from "./components/AIAssistantBottomSheet";
import ErrorDashboard               from "./components/ErrorDashboard";
import { getNotificationCount, subscribeToNotifications } from "./utils/api";

// ── Error boundary ────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-6 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-white font-bold text-xl mb-2">Something went wrong</h2>
          <p className="text-red-400 text-sm mb-4 font-mono break-all max-w-sm">
            {this.state.error?.message || String(this.state.error)}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl"
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

// ── Main shell ────────────────────────────────────────────────────────────
function MainShell() {
  const { isGuest, isAuthenticated, otpModal, hideOTPModal } = useAuth();

  const [activeTab,      setActiveTab]      = useState("home");
  const [showMarket,     setShowMarket]      = useState(false);
  const [showAI,         setShowAI]          = useState(false);
  const [aiInitialMsg,   setAiInitialMsg]    = useState(null);
  const [profileView,    setProfileView]     = useState("profile");
  const [showOnboard,    setShowOnboard]     = useState(false);
  const [badges,         setBadges]          = useState({ home: 0, profile: 0 });

  const userId = localStorage.getItem("sokoni_guest_id") || localStorage.getItem("sokoni_vendor_id") || "";

  // ── Badge polling ─────────────────────────────────────────────────────
  const pollBadges = useCallback(async () => {
    if (!userId) return;
    try {
      const n = await getNotificationCount(userId);
      setBadges((p) => ({ ...p, profile: n }));
    } catch { /* silent */ }
  }, [userId]);

  useEffect(() => {
    pollBadges();
    const iv = setInterval(pollBadges, 15000);
    return () => clearInterval(iv);
  }, [pollBadges]);

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
    if (activeTab === "profile") setBadges((p) => ({ ...p, profile: 0 }));
  }, [activeTab]);

  // ── AI sheet helpers ──────────────────────────────────────────────────
  function openAssistant(msg = "") {
    setAiInitialMsg(msg || null);
    setShowAI(true);
  }

  // ── Auth wizard overlay ───────────────────────────────────────────────
  if (showOnboard) {
    return (
      <div className="flex flex-col h-full bg-[#0A0E14]">
        <AuthWizard onDone={() => setShowOnboard(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative">

        {/* ── Home tab ─────────────────────────────────────────────── */}
        <div className={`absolute inset-0 ${activeTab === "home" ? "block" : "hidden"}`}>
          <HomeScreen
            onOpenMarket={() => setShowMarket(true)}
            onOpenAssistant={openAssistant}
            onOpenOrders={() => setActiveTab("profile")}
            onVendorSelect={(vendor) => {
              openAssistant(`Tell me about ${vendor.name || vendor.vname}, a ${vendor.category || vendor.vcategory} vendor`);
            }}
          />
        </div>

        {/* ── Profile tab ──────────────────────────────────────────── */}
        {activeTab === "profile" && (
          profileView === "dashboard"
            ? <VendorDashboard onBack={() => setProfileView("profile")} />
            : <ProfileScreen onNavigateDashboard={() => { setProfileView("dashboard"); setActiveTab("profile"); }} />
        )}

        {/* ── Market full-screen overlay ────────────────────────────── */}
        {showMarket && (
          <div className="absolute inset-0 z-30 bg-[#0d1117]">
            <MarketScreen
              onSendToAssistant={(msg) => { setShowMarket(false); openAssistant(msg); }}
              onClose={() => setShowMarket(false)}
            />
          </div>
        )}
      </div>

      {/* ── Bottom nav ───────────────────────────────────────────────── */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); if (tab !== "profile") setProfileView("profile"); }}
        badges={badges}
      />

      {/* ── Floating AI button ────────────────────────────────────────── */}
      {!showMarket && !showAI && (
        <FloatingAIButton onClick={() => openAssistant("")} />
      )}

      {/* ── AI assistant bottom sheet ─────────────────────────────────── */}
      <AIAssistantBottomSheet
        isOpen={showAI}
        onClose={() => setShowAI(false)}
        initialMessage={aiInitialMsg}
        onInitialMessageConsumed={() => setAiInitialMsg(null)}
      />

      {/* ── Global sign-up prompt modal ───────────────────────────────── */}
      <SignUpPromptModal onCreateAccount={() => setShowOnboard(true)} />

      {/* ── Global OTP modal ──────────────────────────────────────────── */}
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

  const appReady = splashDone && !isLoading;

  return (
    <>
      {!splashDone && <LoadingScreen onDone={() => setSplashDone(true)} />}

      <div
        className="flex justify-center bg-[#0A0E14] h-[100dvh]"
        style={{ visibility: appReady ? "visible" : "hidden" }}
      >
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
    </>
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
