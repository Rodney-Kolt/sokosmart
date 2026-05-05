/**
 * AssistantScreen.jsx
 * ChatGPT-style assistant interface with two states:
 *   "idle"     – centered search bar + suggestion chips
 *   "chatting" – full chat view (messages, vendor cards, quick replies)
 *
 * State is kept in this component so it persists when switching tabs.
 * The parent renders this with display:block/none to avoid unmounting.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import VendorCard from "./VendorCard";
import QuickReply from "./QuickReply";
import { sendChatMessage, requestService, saveRecentSearch } from "../utils/api";
import {
  startListening, speak, stopSpeaking,
  isRecognitionSupported, isSpeechSupported,
} from "../utils/speech";

// ── Helpers ───────────────────────────────────────────────────────────────
let msgCounter = 0;
function newMsg(role, type, content, extras = {}) {
  return { id: ++msgCounter, role, type, content, ...extras };
}

const SUGGESTIONS = [
  { emoji: "🧵", text: "Tailor for African print dress" },
  { emoji: "🚿", text: "Plumber near Nakawa" },
  { emoji: "🥦", text: "Fresh fruits near me" },
  { emoji: "⚡", text: "Electrician for house wiring" },
  { emoji: "🍰", text: "Bakery birthday cake" },
  { emoji: "📱", text: "Smartphone screen repair" },
];

function renderTextWithBold(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

export default function AssistantScreen({ visible, initialMessage, onInitialMessageConsumed }) {
  // ── User identity ─────────────────────────────────────────────────────
  const userId      = localStorage.getItem("sokoni_guest_id") || "guest";
  const displayName = localStorage.getItem("sokoni_display_name") || "Guest";
  const userLat     = parseFloat(localStorage.getItem("sokoni_lat")) || null;
  const userLng     = parseFloat(localStorage.getItem("sokoni_lng")) || null;

  // ── Screen state ──────────────────────────────────────────────────────
  const [mode, setMode]             = useState("idle"); // "idle" | "chatting"
  const [idleInput, setIdleInput]   = useState("");
  const [messages, setMessages]     = useState([]);
  const [chatInput, setChatInput]   = useState("");
  const [isLoading, setIsLoading]   = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak]   = useState(false);
  const [serverWaking, setServerWaking] = useState(false);
  const [pendingVendor, setPendingVendor] = useState(null);
  const [serviceMsg, setServiceMsg] = useState("");

  const historyRef     = useRef([]);
  const bottomRef      = useRef(null);
  const recognitionRef = useRef(null);
  const chatInputRef   = useRef(null);

  // ── Auto-scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Handle initialMessage from Market tab ─────────────────────────────
  useEffect(() => {
    if (initialMessage && visible) {
      sendMessage(initialMessage);
      onInitialMessageConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage, visible]);

  // ── Core send function ────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    // Switch to chatting mode on first message
    if (mode === "idle") {
      setMode("chatting");
      setIdleInput("");
    }

    setMessages((prev) => [...prev, newMsg("user", "text", trimmed)]);
    setChatInput("");
    setIsLoading(true);
    const wakeTimer = setTimeout(() => setServerWaking(true), 8000);
    historyRef.current.push({ role: "user", content: trimmed });

    try {
      const response = await sendChatMessage(
        userId, trimmed, userLat, userLng,
        historyRef.current.slice(-10)
      );

      let assistantMsg;
      if (response.type === "vendor_list") {
        assistantMsg = newMsg("assistant", "vendor_list", response.reply, { vendors: response.vendors || [] });
        historyRef.current.push({ role: "model", content: response.reply });
        // Save the search term for Market personalisation
        saveRecentSearch(trimmed);
      } else if (response.type === "quick_reply") {
        assistantMsg = newMsg("assistant", "quick_reply", response.reply, { buttons: response.buttons || [] });
        historyRef.current.push({ role: "model", content: response.reply });
      } else {
        assistantMsg = newMsg("assistant", "text", response.reply || "…");
        historyRef.current.push({ role: "model", content: assistantMsg.content });
      }

      setMessages((prev) => [...prev, assistantMsg]);
      if (autoSpeak && isSpeechSupported()) speak(assistantMsg.content);
    } catch (err) {
      const isWaking = err.message?.includes("waking up") || err.code === "ECONNABORTED";
      if (isWaking) setServerWaking(true);
      setMessages((prev) => [...prev, newMsg("assistant", "text",
        isWaking
          ? "⏳ Server is waking up (~30s on free hosting). Please try again in a moment."
          : "⚠️ Couldn't connect to the server. Please check your connection."
      )]);
    } finally {
      clearTimeout(wakeTimer);
      setServerWaking(false);
      setIsLoading(false);
    }
  }, [userId, userLat, userLng, isLoading, autoSpeak, mode]);

  // ── Voice input ───────────────────────────────────────────────────────
  function toggleVoice() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    if (!isRecognitionSupported()) {
      alert("Voice input requires Chrome browser.");
      return;
    }
    setIsListening(true);
    recognitionRef.current = startListening(
      (transcript) => { setIsListening(false); sendMessage(transcript); },
      () => setIsListening(false)
    );
  }

  // ── Service request ───────────────────────────────────────────────────
  function handleRequestService(vendor) {
    setPendingVendor(vendor);
    setMessages((prev) => [...prev, newMsg("assistant", "service_request",
      `Great choice! 🎉 You're requesting service from **${vendor.vname}**.\n\nWhat details would you like to share? (e.g. measurements, urgency, colour preference)`
    )]);
  }

  async function submitServiceRequest() {
    if (!serviceMsg.trim() || !pendingVendor) return;
    setIsLoading(true);
    try {
      await requestService(userId, pendingVendor.id, serviceMsg.trim(), displayName);
      setMessages((prev) => [...prev,
        newMsg("user", "text", serviceMsg.trim()),
        newMsg("assistant", "text", `✅ Request sent to **${pendingVendor.vname}**! They'll reply shortly.`),
      ]);
      setServiceMsg("");
      setPendingVendor(null);
    } catch {
      setMessages((prev) => [...prev, newMsg("assistant", "text", "⚠️ Couldn't send the request. Please try again.")]);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Reset to idle ─────────────────────────────────────────────────────
  function resetToIdle() {
    if (messages.length > 0) {
      if (!window.confirm("Start a new conversation? This will clear the current chat.")) return;
    }
    setMode("idle");
    setMessages([]);
    setIdleInput("");
    setChatInput("");
    historyRef.current = [];
    setPendingVendor(null);
    setServiceMsg("");
    stopSpeaking();
  }

  // ── Render a single message bubble ───────────────────────────────────
  function renderMessage(msg) {
    const isUser = msg.role === "user";
    return (
      <div key={msg.id} className={`flex msg-enter ${isUser ? "justify-end" : "justify-start"} mb-1`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-white text-sm font-bold mr-2 flex-shrink-0 self-end mb-1">
            S
          </div>
        )}
        <div className={`max-w-[82%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
            isUser
              ? "bg-[#25D366] text-[#0d1117] font-medium rounded-br-sm"
              : "bg-[#161b22] text-gray-100 border border-[#30363d] rounded-bl-sm"
          }`}>
            {renderTextWithBold(msg.content)}
          </div>

          {/* Vendor cards */}
          {msg.type === "vendor_list" && msg.vendors?.length > 0 && (
            <div className="mt-2 flex flex-col gap-3 w-full">
              {msg.vendors.map((v, i) => (
                <VendorCard key={i} vendor={v} onRequest={handleRequestService} />
              ))}
            </div>
          )}

          {/* Quick replies */}
          {msg.type === "quick_reply" && msg.buttons?.length > 0 && (
            <QuickReply buttons={msg.buttons} onSelect={sendMessage} />
          )}

          {/* Service request input */}
          {msg.type === "service_request" && pendingVendor && (
            <div className="mt-2 w-full flex gap-2">
              <input
                type="text"
                value={serviceMsg}
                onChange={(e) => setServiceMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitServiceRequest()}
                placeholder="Describe your request…"
                className="flex-1 bg-[#161b22] border border-[#30363d] text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
              <button
                onClick={submitServiceRequest}
                disabled={isLoading}
                className="bg-[#25D366] text-[#0d1117] px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#128C7E] hover:text-white transition-colors disabled:opacity-60"
              >
                Send
              </button>
            </div>
          )}

          {/* Speak button */}
          {!isUser && isSpeechSupported() && (
            <button
              onClick={() => speak(msg.content)}
              className="mt-1 text-gray-600 hover:text-[#25D366] text-xs flex items-center gap-1 transition-colors"
            >
              🔊 <span>Listen</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ display: visible ? "flex" : "none" }}
    >
      {/* ══════════════════════════════════════════════════════════════
          IDLE STATE – ChatGPT-style centered search
      ══════════════════════════════════════════════════════════════ */}
      {mode === "idle" && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 bg-[#0d1117] overflow-y-auto fade-in">

          {/* Logo + greeting */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-3xl shadow-lg mb-4">
              🛍️
            </div>
            <h2 className="text-white text-2xl font-bold text-center">
              What can I find for you?
            </h2>
            <p className="text-gray-400 text-sm mt-1 text-center">
              Your local market assistant
            </p>
          </div>

          {/* Search bar */}
          <div className="w-full max-w-sm">
            <div className="flex items-center gap-2 bg-[#161b22] border border-[#30363d] rounded-2xl px-4 py-3 focus-within:border-[#25D366] transition-colors shadow-lg">
              <input
                type="text"
                value={idleInput}
                onChange={(e) => setIdleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && idleInput.trim()) sendMessage(idleInput);
                }}
                placeholder="Ask for anything… e.g. 'plumber near Wandegeya'"
                className="flex-1 bg-transparent text-gray-100 text-sm placeholder-gray-500 focus:outline-none"
                autoFocus
              />
              {/* Mic button */}
              {isRecognitionSupported() && (
                <button
                  onClick={toggleVoice}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                    isListening ? "bg-red-500 animate-pulse" : "hover:bg-[#30363d]"
                  }`}
                >
                  <span className="text-base">🎤</span>
                </button>
              )}
              {/* Send button */}
              <button
                onClick={() => idleInput.trim() && sendMessage(idleInput)}
                disabled={!idleInput.trim()}
                className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center disabled:opacity-30 hover:bg-[#128C7E] transition-colors flex-shrink-0"
              >
                <svg viewBox="0 0 24 24" fill="#0d1117" className="w-4 h-4">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Suggestion chips */}
          <div className="w-full max-w-sm mt-6">
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-3 text-center">
              People often ask…
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => sendMessage(s.text)}
                  className="flex items-center gap-2 bg-[#161b22] border border-[#30363d] hover:border-[#25D366] hover:bg-[#0d2818] text-gray-300 text-xs px-3 py-2.5 rounded-xl transition-colors text-left"
                >
                  <span className="text-base flex-shrink-0">{s.emoji}</span>
                  <span className="leading-tight">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CHATTING STATE – full chat view
      ══════════════════════════════════════════════════════════════ */}
      {mode === "chatting" && (
        <div className="flex-1 flex flex-col overflow-hidden fade-in">

          {/* Chat header */}
          <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <button
              onClick={resetToIdle}
              className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1"
              title="New chat"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-white text-sm font-bold">
              S
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm leading-tight">Sokoni</p>
              <p className="text-[#25D366] text-xs">Market assistant</p>
            </div>

            {/* Auto-speak toggle */}
            {isSpeechSupported() && (
              <button
                onClick={() => { setAutoSpeak((v) => !v); stopSpeaking(); }}
                className={`text-lg transition-opacity ${autoSpeak ? "opacity-100" : "opacity-30"}`}
                title={autoSpeak ? "Mute" : "Auto-read"}
              >
                🔊
              </button>
            )}

            {/* New chat button */}
            <button
              onClick={resetToIdle}
              className="text-gray-400 hover:text-[#25D366] transition-colors ml-1"
              title="New conversation"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Server waking banner */}
          {serverWaking && (
            <div className="bg-yellow-900/40 border-b border-yellow-700/40 px-4 py-2 flex items-center gap-2 text-yellow-300 text-xs flex-shrink-0">
              <span className="animate-spin">⏳</span>
              <span>Server waking up (~30s). Your message will go through.</span>
              <button onClick={() => setServerWaking(false)} className="ml-auto font-bold">✕</button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-2 bg-[#0d1117]">
            {messages.map(renderMessage)}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex items-end gap-2 msg-enter">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  S
                </div>
                <div className="bg-[#161b22] border border-[#30363d] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Chat input bar */}
          <div className="bg-[#161b22] border-t border-[#30363d] px-3 py-2 flex items-end gap-2 flex-shrink-0">
            <div className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-2xl px-4 py-2 flex items-end gap-2 focus-within:border-[#25D366] transition-colors">
              <textarea
                ref={chatInputRef}
                rows={1}
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(chatInput);
                  }
                }}
                placeholder="Type a message…"
                className="flex-1 bg-transparent text-gray-100 text-sm resize-none focus:outline-none max-h-28 leading-relaxed placeholder-gray-600"
                style={{ height: "24px" }}
              />
            </div>

            {isRecognitionSupported() && (
              <button
                onClick={toggleVoice}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                  isListening ? "bg-red-500 animate-pulse" : "bg-[#30363d] hover:bg-[#444c56]"
                }`}
              >
                🎤
              </button>
            )}

            <button
              onClick={() => sendMessage(chatInput)}
              disabled={!chatInput.trim() || isLoading}
              className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center hover:bg-[#128C7E] transition-colors disabled:opacity-30 flex-shrink-0"
            >
              <svg viewBox="0 0 24 24" fill="#0d1117" className="w-5 h-5">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
