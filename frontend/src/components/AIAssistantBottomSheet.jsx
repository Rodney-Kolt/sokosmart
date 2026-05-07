/**
 * AIAssistantBottomSheet.jsx
 * Slides up from the bottom covering ~72% of the screen.
 * Embeds the full AssistantScreen so all chat logic is preserved.
 */

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AssistantScreen from "./AssistantScreen";

export default function AIAssistantBottomSheet({ isOpen, onClose, initialMessage, onInitialMessageConsumed }) {
  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else        document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#0A0E14] rounded-t-3xl border-t border-slate-800 overflow-hidden"
            style={{ height: "72dvh", maxWidth: "448px", margin: "0 auto" }}
          >
            {/* Handle + header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-2 border-b border-slate-800/60 flex-shrink-0">
              <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
              <div className="flex items-center gap-2 mt-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-sm font-bold text-white shadow">S</div>
                <span className="text-white font-semibold text-sm">Sokoni AI</span>
              </div>
              <button
                onClick={onClose}
                aria-label="Close assistant"
                className="mt-2 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors active:scale-95"
              >
                ✕
              </button>
            </div>

            {/* Chat — always mounted so state persists */}
            <div className="flex-1 overflow-hidden" style={{ height: "calc(72dvh - 56px)" }}>
              <AssistantScreen
                visible={isOpen}
                initialMessage={initialMessage}
                onInitialMessageConsumed={onInitialMessageConsumed}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
