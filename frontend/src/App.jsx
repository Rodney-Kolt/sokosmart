/**
 * App.jsx – Root component for Sokoni Chat.
 *
 * Layout:
 *   1. LoadingScreen (~2s splash)
 *   2. Main tabbed shell:
 *      ┌─────────────────────┐
 *      │  Tab content area   │
 *      ├─────────────────────┤
 *      │    BottomNav        │
 *      └─────────────────────┘
 *
 * Tabs: market | assistant | profile
 * VendorDashboard → separate full-screen route /dashboard (no bottom nav).
 *
 * AssistantScreen is ALWAYS mounted (display:none when inactive) so chat
 * state persists across tab switches.
 *
 * Market → Assistant handoff:
 *   MarketScreen calls onSendToAssistant(message) which sets pendingMessage
 *   in MainShell. When AssistantScreen becomes visible it fires the message
 *   automatically, then clears pendingMessage.
 */

import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoadingScreen   from "./components/LoadingScreen";
import BottomNav       from "./components/BottomNav";
import MarketScreen    from "./components/MarketScreen";
import AssistantScreen from "./components/AssistantScreen";
import ProfileScreen   from "./components/ProfileScreen";
import VendorDashboard from "./components/VendorDashboard";

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
  const [activeTab, setActiveTab]       = useState("assistant");
  // Message queued from Market tab to be auto-sent in Assistant
  const [pendingMessage, setPendingMessage] = useState(null);

  /**
   * Called by MarketScreen when user taps "Chat with Vendor" or "Ask Assistant".
   * Switches to the assistant tab and queues the message.
   */
  function handleSendToAssistant(message) {
    setPendingMessage(message);
    setActiveTab("assistant");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Market tab */}
        {activeTab === "market" && (
          <MarketScreen onSendToAssistant={handleSendToAssistant} />
        )}

        {/* Assistant – always mounted, hidden via CSS when not active */}
        <AssistantScreen
          visible={activeTab === "assistant"}
          initialMessage={activeTab === "assistant" ? pendingMessage : null}
          onInitialMessageConsumed={() => setPendingMessage(null)}
        />

        {/* Profile tab */}
        {activeTab === "profile" && (
          <ProfileScreen
            onNavigateDashboard={() => window.location.href = "/dashboard"}
          />
        )}
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
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
        className="min-h-screen flex justify-center bg-[#0d1117]"
        style={{ visibility: appReady ? "visible" : "hidden" }}
      >
        <div className="w-full max-w-md bg-[#0d1117] min-h-screen flex flex-col shadow-2xl relative overflow-hidden">
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
