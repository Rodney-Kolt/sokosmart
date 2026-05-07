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
import OrderCard from "./OrderCard";
import RatingModal from "./RatingModal";
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
  const [ratingOrder, setRatingOrder] = useState(null); // order to rate

  const historyRef     = useRef([]);
  const bottomRef      = useRef(null);
  const recognitionRef = useRef(null);
  const chatInputRef   = useRef(null);
  const audioRef       = useRef(null);

  const [speakingId, setSpeakingId] = useState(null);

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
      const result = await requestService(userId, pendingVendor.id, serviceMsg.trim(), displayName);
      const orderId = result?.order_id;
      setMessages((prev) => [
        ...prev,
        newMsg("user", "text", serviceMsg.trim()),
        // Show order tracking card if we got an order_id back
        ...(orderId
          ? [newMsg("assistant", "order_card", `✅ Request sent to **${pendingVendor.vname}**! Track your order below:`, {
              orderId,
              vendorName: pendingVendor.vname,
            })]
          : [newMsg("assistant", "text", `✅ Request sent to **${pendingVendor.vname}**! They'll reply shortly.`)]),
      ]);
      setServiceMsg("");
      setPendingVendor(null);
    } catch {
      setMessages((prev) => [...prev, newMsg("assistant", "text", "⚠️ Couldn't send the request. Please try again.")]);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Text-to-speech (Google Cloud TTS with browser fallback) ─────────
  const [speakingId, setSpeakingId] = useState(null);
  const audioRef = useRef(null);

  async function handleListen(msg) {
    // Stop any currently playing audio
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (speakingId === msg.id) { setSpeakingId(null); stopSpeaking(); return; }

    setSpeakingId(msg.id);

    // Detect language from content (simple heuristic)
    const text = msg.content || "";
    const isLuganda = /\b(oli|otya|webale|kale|nnyambye|omutembezi|emmere|essimu)\b/i.test(text);
    const isSwahili = /\b(habari|asante|sawa|karibu|tafadhali|omutembezi)\b/i.test(text);
    const language  = isLuganda ? "luganda" : isSwahili ? "swahili" : "english";

    const apiUrl = import.meta.env.VITE_API_URL || "";
    try {
      const res = await fetch(`${apiUrl}/api/tts`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, language }),
      });

      if (res.status === 204) {
        // Backend TTS not configured — fall back to browser TTS
        speak(text);
        setSpeakingId(null);
        return;
      }

      if (!res.ok) throw new Error("TTS request failed");

      const data = await res.json();
      const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
      audioRef.current = audio;
      audio.onended = () => { setSpeakingId(null); audioRef.current = null; };
      audio.onerror = () => { setSpeakingId(null); speak(text); }; // fallback
      audio.play();
    } catch {
      // Any error → fall back to browser TTS
      speak(text);
      setSpeakingId(null);
    }
  }
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
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-sm font-bold mr-2 flex-shrink-0 self-end mb-1 shadow-lg shadow-orange-500/20">
            S
          </div>
        )}
        <div className={`max-w-[82%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
          {/* Bubble */}
          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-md ${
            isUser
              ? "bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/20 text-white rounded-br-sm"
              : "bg-[#141920] border border-slate-800 text-slate-100 rounded-bl-sm"
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

          {/* Order tracking card */}
          {msg.type === "order_card" && msg.orderId && (
            <div className="mt-2 w-full">
              <OrderCard
                orderId={msg.orderId}
                vendorName={msg.vendorName}
                onRate={(order) => setRatingOrder(order)}
              />
            </div>
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

          {/* Listen button — Google Cloud TTS with browser fallback */}
          {!isUser && (
            <button
              onClick={() => handleListen(msg)}
              className={`mt-1 text-xs flex items-center gap-1 transition-colors ${
                speakingId === msg.id
                  ? "text-orange-400 animate-pulse"
                  : "text-gray-600 hover:text-orange-400"
              }`}
            >
              🔊 <span>{speakingId === msg.id ? "Playing…" : "Listen"}</span>
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
    <>
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ display: visible ? "flex" : "none" }}
    >
      {/* ══════════════════════════════════════════════════════════════
          IDLE STATE – Premium ChatGPT-style centered search
      ══════════════════════════════════════════════════════════════ */}
      {mode === "idle" && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 bg-[#0A0E14] overflow-y-auto fade-in">

          {/* Logo + greeting */}
          <div className="flex flex-col items-center mb-10">
            <div className="relative mb-5">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-40 animate-pulse" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center">
                <span className="text-3xl">🤖</span>
              </div>
            </div>
            <h2 className="text-white text-2xl font-bold text-center font-display">
              What can I find for you?
            </h2>
            <p className="text-slate-400 text-sm mt-2 text-center">
              Your AI-powered local market assistant
            </p>
          </div>

          {/* Glowing search bar */}
          <div className="w-full max-w-sm">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl blur opacity-30 group-focus-within:opacity-60 transition duration-300" />
              <div className="relative bg-[#141920] rounded-3xl shadow-2xl flex items-center px-5 py-4 border border-slate-800">
                <input
                  type="text"
                  value={idleInput}
                  onChange={(e) => setIdleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && idleInput.trim()) sendMessage(idleInput);
                  }}
                  placeholder="e.g. plumber near Nakawa…"
                  className="flex-1 bg-transparent text-white text-base placeholder-slate-500 focus:outline-none"
                  autoFocus
                />
                {isRecognitionSupported() && (
                  <button
                    onClick={toggleVoice}
                    className={`ml-3 w-9 h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                      isListening
                        ? "bg-red-500 animate-pulse"
                        : "text-orange-500 hover:text-orange-400 hover:bg-orange-500/10"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2H3v2a9 9 0 008 8.94V23h2v-2.06A9 9 0 0021 12v-2h-2z"/>
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => idleInput.trim() && sendMessage(idleInput)}
                  disabled={!idleInput.trim()}
                  className="ml-2 w-9 h-9 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-all flex-shrink-0 shadow-lg shadow-orange-500/20"
                >
                  <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Suggestion pills */}
          <div className="w-full max-w-sm mt-8">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-4 text-center">
              People often ask…
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => sendMessage(s.text)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#141920] border border-slate-700/50 rounded-full text-sm text-slate-300 hover:border-orange-500/50 hover:text-orange-400 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                >
                  <span className="text-base">{s.emoji}</span>
                  <span>{s.text}</span>
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
          <div className="bg-[#141920] border-b border-slate-800/60 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <button
              onClick={resetToIdle}
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1"
              title="New chat"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-orange-500/20">
              S
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm leading-tight font-display">Sokoni</p>
              <p className="text-orange-500/80 text-xs">Market assistant</p>
            </div>

            {isSpeechSupported() && (
              <button
                onClick={() => { setAutoSpeak((v) => !v); stopSpeaking(); }}
                className={`text-lg transition-opacity ${autoSpeak ? "opacity-100 text-orange-500" : "opacity-30 text-slate-400"}`}
                title={autoSpeak ? "Mute" : "Auto-read"}
              >
                🔊
              </button>
            )}

            <button
              onClick={resetToIdle}
              className="text-slate-400 hover:text-orange-500 transition-colors ml-1"
              title="New conversation"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Server waking banner */}
          {serverWaking && (
            <div className="bg-orange-900/30 border-b border-orange-700/30 px-4 py-2 flex items-center gap-2 text-orange-300 text-xs flex-shrink-0">
              <span className="animate-spin">⏳</span>
              <span>Server waking up (~30s). Your message will go through.</span>
              <button onClick={() => setServerWaking(false)} className="ml-auto font-bold">✕</button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-3 bg-[#0A0E14]">
            {messages.map(renderMessage)}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex items-end gap-2 msg-enter">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-lg shadow-orange-500/20">
                  S
                </div>
                <div className="bg-[#141920] border border-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                  {[0,1,2].map((i) => (
                    <div key={i} className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Chat input bar */}
          <div className="bg-[#141920] border-t border-slate-800/60 px-3 py-3 flex items-end gap-2 flex-shrink-0">
            <div className="flex-1 bg-[#0A0E14] border border-slate-800 rounded-2xl px-4 py-2.5 flex items-end gap-2 focus-within:border-orange-500/40 transition-colors">
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
                className="flex-1 bg-transparent text-slate-100 text-sm resize-none focus:outline-none max-h-28 leading-relaxed placeholder-slate-600"
                style={{ height: "24px" }}
              />
            </div>

            {isRecognitionSupported() && (
              <button
                onClick={toggleVoice}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                  isListening
                    ? "bg-red-500 animate-pulse"
                    : "bg-[#141920] border border-slate-800 text-orange-500 hover:border-orange-500/40"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2H3v2a9 9 0 008 8.94V23h2v-2.06A9 9 0 0021 12v-2h-2z"/>
                </svg>
              </button>
            )}

            <button
              onClick={() => sendMessage(chatInput)}
              disabled={!chatInput.trim() || isLoading}
              className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-30 flex-shrink-0 shadow-lg shadow-orange-500/20 active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>

    {/* Rating modal – rendered outside the scroll container */}
    {ratingOrder && (
      <RatingModal
        order={ratingOrder}
        vendorName={ratingOrder.vendor_name || "Vendor"}
        consumerId={userId}
        onClose={() => setRatingOrder(null)}
        onSubmitted={() => {
          setMessages((prev) => [
            ...prev,
            newMsg("assistant", "text", "⭐ Thank you for your review! It helps the community."),
          ]);
        }}
      />
    )}
    </>
  );
}
