/**
 * App.jsx – Root component for Sokoni Chat.
 *
 * Layout (Feature 5 – sticky nav):
 *   The outer container is h-[100dvh] flex-col.
 *   Tab content area is flex-1 overflow-hidden (each tab manages its own scroll).
 *   BottomNav is flex-shrink-0 – always visible, never pushed off screen.
 *
 * Feature 4 – Notification badges:
 *   Polls /unread-count every 10 seconds and passes counts to BottomNav.
 */

import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoadingScreen   from "./components/LoadingScreen";
import BottomNav       from "./components/BottomNav";
import MarketScreen    from "./components/MarketScreen";
import AssistantScreen from "./components/AssistantScreen";
import ProfileScreen   from "./components/ProfileScreen";
import VendorDashboard from "./components/VendorDashboard";
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
  const [badges, setBadges]                 = useState({ assistant: 0 });

  const userId = localStorage.getItem("sokoni_guest_id") || localStorage.getItem("sokoni_vendor_id") || "";
  const role   = localStorage.getItem("sokoni_role") || "consumer";

  // ── Feature 4: Poll unread count every 10 seconds ────────────────────
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

  // Subscribe to realtime notifications for instant badge update
  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToNotifications(userId, () => {
      setBadges((prev) => ({ ...prev, profile: (prev.profile || 0) + 1 }));
    });
    return unsub;
  }, [userId]);

  // Clear badge when user opens the assistant tab
  useEffect(() => {
    if (activeTab === "assistant") {
      setBadges((prev) => ({ ...prev, assistant: 0 }));
    }
    if (activeTab === "profile") {
      setBadges((prev) => ({ ...prev, profile: 0 }));
    }
  }, [activeTab]);

  function handleSendToAssistant(message) {
    setPendingMessage(message);
    setActiveTab("assistant");
  }

  return (
    // Feature 5: h-full flex-col – content scrolls inside, nav stays fixed
    <div className="flex flex-col h-full">

      {/* ── Tab content area – each tab manages its own internal scroll ── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">

        {activeTab === "market" && (
          <MarketScreen onSendToAssistant={handleSendToAssistant} />
        )}

        {/* AssistantScreen always mounted – hidden via CSS when inactive */}
        <AssistantScreen
          visible={activeTab === "assistant"}
          initialMessage={activeTab === "assistant" ? pendingMessage : null}
          onInitialMessageConsumed={() => setPendingMessage(null)}
        />

        {activeTab === "profile" && (
          <ProfileScreen
            onNavigateDashboard={() => window.location.href = "/dashboard"}
          />
        )}
      </div>

      {/* ── Bottom nav – always visible, never scrolls away ─────────────── */}
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

      {/* Feature 5: h-[100dvh] ensures the app never exceeds viewport height */}
      <div
        className="flex justify-center bg-[#0d1117] h-[100dvh]"
        style={{ visibility: appReady ? "visible" : "hidden" }}
      >
        <div className="w-full max-w-md bg-[#0d1117] h-full flex flex-col shadow-2xl overflow-hidden">
          <BrowserRouter>
            <Routes>
              {/* Vendor dashboard – full screen, no bottom nav */}
              <Route path="/dashboard" element={<VendorDashboard />} />

              {/* Legacy redirects */}
              <Route path="/chat"       element={<Navigate to="/" replace />} />
              <Route path="/onboarding" element={<Navigate to="/" replace />} />

              {/* Everything else → tabbed shell */}
              <Route path="/*" element={<MainShell />} />
            </Routes>
          </BrowserRouter>
        </div>
      </div>
    </>
  );
}
