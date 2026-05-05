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
// Also pings every 4 minutes to prevent Render free tier from sleeping.
function useWakeUpBackend() {
  useEffect(() => {
    const url = import.meta.env.VITE_API_URL;
    if (!url) return;

    const ping = () => fetch(`${url}/health`, { method: "GET" }).catch(() => {});

    // Immediate ping on load
    ping();

    // Keep-alive ping every 4 minutes (Render sleeps after 15 min)
    const interval = setInterval(ping, 4 * 60 * 1000);
    return () => clearInterval(interval);
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
