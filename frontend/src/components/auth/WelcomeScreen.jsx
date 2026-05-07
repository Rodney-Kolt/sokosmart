/**
 * WelcomeScreen.jsx
 * First screen — Sign Up / Log In / Guest
 */

import React from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";

export default function WelcomeScreen({ onSignUp, onLogin, onGuest }) {
  const { enterGuestMode } = useAuth();

  function handleGuest() {
    const names = ["Friendly Buyer","Quick Shopper","Market Explorer","Savvy Customer","Local Finder"];
    enterGuestMode(names[Math.floor(Math.random() * names.length)]);
    onGuest?.();
  }
  return (
    <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-between px-6 py-12">

      {/* Top: logo + tagline */}
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl blur-2xl opacity-40 animate-pulse" />
          <div className="relative w-24 h-24 bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl flex items-center justify-center text-5xl shadow-2xl">
            🛍️
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h1 className="text-white text-3xl font-bold tracking-tight">Sokoni Smart</h1>
          <p className="text-slate-400 text-base mt-2 leading-relaxed max-w-xs">
            Your hyperlocal AI marketplace.<br />Find vendors, order services, grow your business.
          </p>
        </motion.div>
      </div>

      {/* Bottom: action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="w-full max-w-sm space-y-3"
      >
        <button
          onClick={onSignUp}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/25 hover:opacity-90 active:scale-[0.98] transition-all text-base"
        >
          Create Account
        </button>

        <button
          onClick={onLogin}
          className="w-full py-4 bg-[#141920] border border-slate-700 text-white font-semibold rounded-2xl hover:border-orange-500/40 active:scale-[0.98] transition-all text-base"
        >
          Sign In
        </button>

        <button
          onClick={handleGuest}
          className="w-full py-3 text-slate-500 text-sm hover:text-slate-300 active:scale-[0.98] transition-all"
        >
          👤 Continue as Guest
        </button>

        <p className="text-slate-600 text-xs text-center pt-1">
          Guests can browse freely. Sign up to request services.
        </p>
      </motion.div>
    </div>
  );
}
