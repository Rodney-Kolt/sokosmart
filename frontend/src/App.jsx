/**
 * App.jsx – Root component for Sokoni Chat.
 *
 * Layout:
 *   1. LoadingScreen (shown for ~2s on first load)
 *   2. Main app shell:
 *      ┌─────────────────────┐
 *      │  Tab content area   │  ← flex-1, scrollable per tab
 *      ├─────────────────────┤
 *      │    BottomNav        │  ← fixed 64px bar
 *      └─────────────────────┘
 *
 * Tabs: market | assistant | profile
 * VendorDashboard is a separate full-screen route (no bottom nav).
 * Onboarding is accessible via Profile tab modal.
 *
 * AssistantScreen is always mounted (display:none when inactive)
 * so chat state persists across tab switches.
 */

import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";

import LoadingScreen    from "./components/LoadingScreen";
import BottomNav        from "./components/BottomNav";
import MarketScreen     from "./components/MarketScreen";
import AssistantScreen  from "./components/AssistantScreen";
import ProfileScreen    from "./components/ProfileScreen";
import VendorDashboard  from "./components/VendorDashboard";

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
  const navigate  = useNavigate();
  const [activeTab, setActiveTab] = useState("assistant");

  return (
    <div className="flex flex-col h-full">
      {/* Tab content – AssistantScreen stays mounted to preserve state */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Market */}
        {activeTab === "market" && <MarketScreen />}

        {/* Assistant – always mounted, hidden via CSS when inactive */}
        <AssistantScreen visible={activeTab === "assistant"} />

        {/* Profile */}
        {activeTab === "profile" && (
          <ProfileScreen
            onNavigateDashboard={() => navigate("/dashboard")}
          />
        )}
      </div>

      {/* Bottom navigation */}
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
      {/* Splash screen – rendered on top until dismissed */}
      {!appReady && <LoadingScreen onDone={() => setAppReady(true)} />}

      {/* Main app – rendered underneath (invisible until splash exits) */}
      <div
        className="min-h-screen flex justify-center bg-[#0d1117]"
        style={{ visibility: appReady ? "visible" : "hidden" }}
      >
        <div className="w-full max-w-md bg-[#0d1117] min-h-screen flex flex-col shadow-2xl relative overflow-hidden">
          <BrowserRouter>
            <Routes>
              {/* Vendor dashboard – full screen, no bottom nav */}
              <Route path="/dashboard" element={<VendorDashboard />} />

              {/* Legacy routes – redirect to main shell */}
              <Route path="/chat"      element={<Navigate to="/" replace />} />
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
