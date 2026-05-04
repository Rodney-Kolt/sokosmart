/**
 * App.jsx – Root component and routing for Sokoni Chat.
 * Routes:
 *   /           → Onboarding (role selection)
 *   /chat       → Consumer chat with Sokoni AI
 *   /dashboard  → Vendor dashboard (messages & replies)
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Onboarding from "./components/Onboarding";
import ChatScreen from "./components/ChatScreen";
import VendorDashboard from "./components/VendorDashboard";

export default function App() {
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
