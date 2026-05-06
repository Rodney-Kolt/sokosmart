/**
 * SignUpPromptModal.jsx
 * Bottom sheet that appears when a guest tries a gated action.
 * Slides up with backdrop blur.
 */

import React from "react";
import { useAuth } from "../context/AuthContext";

export default function SignUpPromptModal({ onCreateAccount }) {
  const { signUpPrompt, hideSignUp } = useAuth();

  if (!signUpPrompt.visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60"
        style={{ backdropFilter: "blur(4px)" }}
        onClick={hideSignUp}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 bg-[#141920] rounded-t-3xl border-t border-slate-800 shadow-2xl"
        style={{ animation: "slideUp 0.3s ease-out" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-700" />
        </div>

        <div className="px-6 pb-10 pt-4 text-center">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-3xl shadow-lg shadow-orange-500/20">
            🔐
          </div>

          <h2 className="text-white font-bold text-xl mb-2 font-display">
            Sign up to continue
          </h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            {signUpPrompt.message}
            {" "}It only takes a minute and it's completely free.
          </p>

          {/* CTA buttons */}
          <button
            onClick={() => { hideSignUp(); onCreateAccount?.(); }}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl text-sm shadow-lg shadow-orange-500/20 hover:opacity-90 transition-all active:scale-[0.98] mb-3"
          >
            Create Free Account →
          </button>

          <button
            onClick={hideSignUp}
            className="w-full py-3 bg-[#0A0E14] border border-slate-800 text-slate-400 font-medium rounded-2xl text-sm hover:border-slate-600 transition-all"
          >
            Continue Browsing
          </button>
        </div>
      </div>
    </>
  );
}
