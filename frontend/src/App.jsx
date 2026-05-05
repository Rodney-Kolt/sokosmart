/**
 * App.jsx – Root component for Sokoni Chat.
 *
 * KEY CHANGE: VendorDashboard is now rendered INSIDE the tab shell
 * so the bottom nav is always visible. The "profile" tab shows either
 * ProfileScreen or VendorDashboard depending on role.
 *
 * Layout: h-[100dvh] flex-col
 *   ├── flex-1 overflow-hidden  (tab content)
 *   └── BottomNav flex-shrink-0 (always visible)
 */

import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoadingScreen   from "./components/LoadingScreen";
import BottomNav       from "./components/BottomNav";
import MarketScreen    from "./components/MarketScreen";
import AssistantScreen from "./components/AssistantScreen";
import ProfileScreen   from "./components/ProfileScreen";
import VendorDashboard from "./components/VendorDashboard";
import WelcomePage     from "./components/WelcomePage";
import ResetPasswordPage from "./components/ResetPasswordPage";
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

// ── Main tabbed shell ─────────────────────────────────────────────────────
function MainShell() {
  const [activeTab, setActiveTab]           = useState("assistant");
  const [pendingMessage, setPendingMessage] = useState(null);
  const [badges, setBadges]                 = useState({ assistant: 0, profile: 0 });
  // "profile" tab can show either ProfileScreen or VendorDashboard
  const [profileView, setProfileView]       = useState("profile"); // "profile" | "dashboard"

  const userId = localStorage.getItem("sokoni_guest_id") || localStorage.getItem("sokoni_vendor_id") || "";
  const role   = localStorage.getItem("sokoni_role") || "consumer";

  // ── Poll unread counts ────────────────────────────────────────────────
  const pollUnread = useCallback(async () => {
    if (!userId) return;
    try {
      const msgCount = await getUnreadCount(userId, role);
      setBadges((prev) => ({ ...prev, assistant: msgCount }));
    } catch { /* silent */ }
    try {
      const notifCount = await getNotificationCount(userId);
      setBadges((prev) => ({ ...prev, profile: notifCount }));
    } catch { /* notifications table may not exist yet */ }
  }, [userId, role]);

  useEffect(() => {
    pollUnread();
    const interval = setInterval(pollUnread, 10000);
    return () => clearInterval(interval);
  }, [pollUnread]);

  // Realtime notification badge
  useEffect(() => {
    if (!userId) return;
    let unsub = () => {};
    try {
      unsub = subscribeToNotifications(userId, () => {
        setBadges((prev) => ({ ...prev, profile: (prev.profile || 0) + 1 }));
      });
    } catch { /* realtime not available */ }
    return unsub;
  }, [userId]);

  // Clear badges when tab opened
  useEffect(() => {
    if (activeTab === "assistant") setBadges((p) => ({ ...p, assistant: 0 }));
    if (activeTab === "profile")   setBadges((p) => ({ ...p, profile: 0 }));
  }, [activeTab]);

  // When switching away from profile tab, reset to profile view
  useEffect(() => {
    if (activeTab !== "profile") setProfileView("profile");
  }, [activeTab]);

  function handleSendToAssistant(message) {
    setPendingMessage(message);
    setActiveTab("assistant");
  }

  // Navigate to vendor dashboard (stays within tab shell)
  function handleNavigateDashboard() {
    setProfileView("dashboard");
    setActiveTab("profile");
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Tab content ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">

        {/* Market */}
        {activeTab === "market" && (
          <MarketScreen onSendToAssistant={handleSendToAssistant} />
        )}

        {/* Assistant – always mounted */}
        <AssistantScreen
          visible={activeTab === "assistant"}
          initialMessage={activeTab === "assistant" ? pendingMessage : null}
          onInitialMessageConsumed={() => setPendingMessage(null)}
        />

        {/* Profile tab – shows either ProfileScreen or VendorDashboard */}
        {activeTab === "profile" && (
          profileView === "dashboard"
            ? <VendorDashboard onBack={() => setProfileView("profile")} />
            : <ProfileScreen onNavigateDashboard={handleNavigateDashboard} />
        )}
      </div>

      {/* ── Bottom nav – ALWAYS visible ──────────────────────────────── */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        badges={badges}
      />
    </div>
  );
}

// ── Root app ──────────────────────────────────────────────────────────────
export default function App() {
  const [appReady, setAppReady] = useState(false);
  useWakeUpBackend();

  return (
    <>
      {!appReady && <LoadingScreen onDone={() => setAppReady(true)} />}

      <div
        className="flex justify-center bg-[#0d1117] h-[100dvh]"
        style={{ visibility: appReady ? "visible" : "hidden" }}
      >
        <div className="w-full max-w-md bg-[#0d1117] h-full flex flex-col shadow-2xl overflow-hidden">
          <BrowserRouter>
            <Routes>
              {/* Email auth redirect pages – no bottom nav */}
              <Route path="/welcome"        element={<WelcomePage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Legacy redirects */}
              <Route path="/dashboard"  element={<Navigate to="/" replace />} />
              <Route path="/chat"       element={<Navigate to="/" replace />} />
              <Route path="/onboarding" element={<Navigate to="/" replace />} />
              {/* Everything → tabbed shell with nav */}
              <Route path="/*" element={<MainShell />} />
            </Routes>
          </BrowserRouter>
        </div>
      </div>
    </>
  );
}
