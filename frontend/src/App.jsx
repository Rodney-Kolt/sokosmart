/**
 * App.jsx – Root component and routing for Sokoni Chat.
 * Routes:
 *   /           → Onboarding (role selection)
 *   /chat       → Consumer chat with Sokoni AI
 *   /dashboard  → Vendor dashboard (messages & replies)
 */

import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Onboarding from "./components/Onboarding";
import ChatScreen from "./components/ChatScreen";
import VendorDashboard from "./components/VendorDashboard";

// Ping the backend as soon as the app loads so Render wakes up
// before the user sends their first message.
function useWakeUpBackend() {
  useEffect(() => {
    const url = import.meta.env.VITE_API_URL;
    if (!url) return;
    fetch(`${url}/health`, { method: "GET" }).catch(() => {
      // Silently retry after 20s if first ping fails (server still waking)
      setTimeout(() => fetch(`${url}/health`).catch(() => {}), 20000);
    });
  }, []);
}

export default function App() {
  useWakeUpBackend();

  return (
    <BrowserRouter>
      {/* Max-width wrapper keeps it phone-sized on desktop */}
      <div className="min-h-screen flex justify-center bg-gray-200">
        <div className="w-full max-w-md bg-sokoni-bg min-h-screen flex flex-col shadow-2xl relative overflow-hidden">
          <Routes>
            <Route path="/"          element={<Onboarding />} />
            <Route path="/chat"      element={<ChatScreen />} />
            <Route path="/dashboard" element={<VendorDashboard />} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
