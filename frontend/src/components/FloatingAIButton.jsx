/**
 * FloatingAIButton.jsx
 * Persistent FAB that opens the AI assistant bottom sheet.
 */

import React from "react";
import { motion } from "framer-motion";

export default function FloatingAIButton({ onClick }) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label="Open AI Assistant"
      className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-red-500 shadow-2xl shadow-orange-500/40 flex items-center justify-center"
    >
      {/* Pulse ring */}
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500 to-red-500 animate-ping opacity-20" />
      <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 relative z-10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </motion.button>
  );
}
