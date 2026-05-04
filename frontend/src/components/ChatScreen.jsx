/**
 * ChatScreen.jsx
 * Consumer-facing chat interface with Sokoni AI.
 * Features:
 *  - Text + voice input (Web Speech API)
 *  - AI responses with quick-reply buttons
 *  - Vendor card rendering
 *  - Service request flow (privacy-preserving)
 *  - Voice output toggle (SpeechSynthesis)
 *  - Auto-scroll to latest message
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import VendorCard from "./VendorCard";
import QuickReply from "./QuickReply";
import { sendChatMessage, requestService } from "../utils/api";
import { startListening, speak, stopSpeaking, isRecognitionSupported, isSpeechSupported } from "../utils/speech";

// ── Message types ─────────────────────────────────────────────────────────
// { id, role: "user"|"assistant", type: "text"|"vendor_list"|"quick_reply"|"service_request", content, vendors, buttons }

let msgCounter = 0;
function newMsg(role, type, content, extras = {}) {
  return { id: ++msgCounter, role, type, content, ...extras };
}

const WELCOME_MSG = newMsg(
  "assistant",
  "text",
  "Hi! I'm Sokoni, your market assistant. 👋\n\nTell me what you need and where you are — I'll find the best local vendors for you!"
);

export default function ChatScreen() {
  const navigate = useNavigate();

  // ── User identity ─────────────────────────────────────────────────────
  const userId      = localStorage.getItem("sokoni_guest_id") || "guest";
  const displayName = localStorage.getItem("sokoni_display_name") || "Guest";
  const userLat     = parseFloat(localStorage.getItem("sokoni_lat")) || null;
  const userLng     = parseFloat(localStorage.getItem("sokoni_lng")) || null;

  // ── State ─────────────────────────────────────────────────────────────
  const [messages, setMessages]         = useState([WELCOME_MSG]);
  const [inputText, setInputText]       = useState("");
  const [isLoading, setIsLoading]       = useState(false);
  const [isListening, setIsListening]   = useState(false);
  const [autoSpeak, setAutoSpeak]       = useState(false);
  const [pendingVendor, setPendingVendor] = useState(null); // vendor awaiting service request
  const [serviceMsg, setServiceMsg]     = useState("");

  // Conversation history for Gemini context
  const historyRef = useRef([]);
  const bottomRef  = useRef(null);
  const recognitionRef = useRef(null);

  // ── Auto-scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send a message ────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    // Add user bubble
    setMessages((prev) => [...prev, newMsg("user", "text", trimmed)]);
    setInputText("");
    setIsLoading(true);

    // Update history
    historyRef.current.push({ role: "user", content: trimmed });

    try {
      const response = await sendChatMessage(
        userId,
        trimmed,
        userLat,
        userLng,
        historyRef.current.slice(-10) // send last 10 turns for context
      );

      let assistantMsg;

      if (response.type === "vendor_list") {
        assistantMsg = newMsg("assistant", "vendor_list", response.reply, {
          vendors: response.vendors || [],
        });
        historyRef.current.push({ role: "model", content: response.reply });
      } else if (response.type === "quick_reply") {
        assistantMsg = newMsg("assistant", "quick_reply", response.reply, {
          buttons: response.buttons || [],
        });
        historyRef.current.push({ role: "model", content: response.reply });
      } else {
        assistantMsg = newMsg("assistant", "text", response.reply || response.message || "…");
        historyRef.current.push({ role: "model", content: assistantMsg.content });
      }

      setMessages((prev) => [...prev, assistantMsg]);

      // Auto-speak the reply text
      if (autoSpeak && isSpeechSupported()) {
        speak(assistantMsg.content);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        newMsg("assistant", "text", "⚠️ Sorry, I couldn't connect to the server. Please check your connection and try again."),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, userLat, userLng, isLoading, autoSpeak]);

  // ── Voice input ───────────────────────────────────────────────────────
  function toggleVoiceInput() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    if (!isRecognitionSupported()) {
      alert("Voice input is not supported in this browser. Please use Chrome.");
      return;
    }
    setIsListening(true);
    recognitionRef.current = startListening(
      (transcript) => {
        setIsListening(false);
        sendMessage(transcript);
      },
      (err) => {
        setIsListening(false);
        console.warn(err);
      }
    );
  }

  // ── Service request flow ──────────────────────────────────────────────
  function handleRequestService(vendor) {
    setPendingVendor(vendor);
    setMessages((prev) => [
      ...prev,
      newMsg("assistant", "service_request", `Great choice! 🎉 You're requesting service from **${vendor.vname}**.\n\nWhat details would you like to share? (e.g. measurements, urgency, colour preference)`),
    ]);
  }

  async function submitServiceRequest() {
    if (!serviceMsg.trim() || !pendingVendor) return;
    setIsLoading(true);
    try {
      await requestService(userId, pendingVendor.id, serviceMsg.trim(), displayName);
      setMessages((prev) => [
        ...prev,
        newMsg("user", "text", serviceMsg.trim()),
        newMsg("assistant", "text", `✅ Your request has been sent to **${pendingVendor.vname}**! They'll reply shortly. You can check replies in your conversation thread.`),
      ]);
      setServiceMsg("");
      setPendingVendor(null);
    } catch {
      setMessages((prev) => [
        ...prev,
        newMsg("assistant", "text", "⚠️ Couldn't send the request. Please try again."),
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────

  function renderMessage(msg) {
    const isUser = msg.role === "user";

    return (
      <div
        key={msg.id}
        className={`flex msg-enter ${isUser ? "justify-end" : "justify-start"} mb-1`}
      >
        {/* Avatar for assistant */}
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-sokoni-green flex items-center justify-center text-white text-sm font-bold mr-2 flex-shrink-0 self-end mb-1">
            S
          </div>
        )}

        <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
          {/* Bubble */}
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
              isUser
                ? "bg-sokoni-light text-gray-800 rounded-br-sm"
                : "bg-white text-gray-800 rounded-bl-sm"
            }`}
          >
            {/* Render bold markdown-style **text** */}
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

          {/* Quick reply buttons */}
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
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sokoni-green"
              />
              <button
                onClick={submitServiceRequest}
                disabled={isLoading}
                className="bg-sokoni-green text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-sokoni-darkgreen transition-colors disabled:opacity-60"
              >
                Send
              </button>
            </div>
          )}

          {/* Speak button for assistant messages */}
          {!isUser && isSpeechSupported() && (
            <button
              onClick={() => speak(msg.content)}
              className="mt-1 text-gray-400 hover:text-sokoni-teal text-xs flex items-center gap-1 transition-colors"
              title="Read aloud"
            >
              🔊 <span>Listen</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderTextWithBold(text) {
    if (!text) return null;
    // Simple **bold** renderer
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    );
  }

  // ── Main render ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-sokoni-bg">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-sokoni-header text-white px-4 py-3 flex items-center gap-3 shadow-md flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-sokoni-green flex items-center justify-center text-xl font-bold">
          S
        </div>
        <div className="flex-1">
          <p className="font-semibold text-base leading-tight">Sokoni</p>
          <p className="text-green-300 text-xs">Your market assistant</p>
        </div>

        {/* Auto-speak toggle */}
        {isSpeechSupported() && (
          <button
            onClick={() => { setAutoSpeak((v) => !v); stopSpeaking(); }}
            title={autoSpeak ? "Mute auto-read" : "Enable auto-read"}
            className={`text-xl transition-opacity ${autoSpeak ? "opacity-100" : "opacity-40"}`}
          >
            🔊
          </button>
        )}

        {/* Back to home */}
        <button
          onClick={() => navigate("/")}
          className="text-green-300 hover:text-white text-sm ml-1"
          title="Home"
        >
          ✕
        </button>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-2">
        {messages.map(renderMessage)}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-end gap-2 msg-enter">
            <div className="w-8 h-8 rounded-full bg-sokoni-green flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              S
            </div>
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex gap-1 items-center">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ──────────────────────────────────────────────────── */}
      <div className="bg-white border-t border-gray-200 px-3 py-2 flex items-end gap-2 flex-shrink-0">
        <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 flex items-end gap-2">
          <textarea
            rows={1}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              // Auto-grow
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(inputText);
              }
            }}
            placeholder="Type a message…"
            className="flex-1 bg-transparent text-gray-800 text-sm resize-none focus:outline-none max-h-28 leading-relaxed"
            style={{ height: "24px" }}
          />
        </div>

        {/* Mic button */}
        {isRecognitionSupported() && (
          <button
            onClick={toggleVoiceInput}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
              isListening
                ? "bg-red-500 text-white animate-pulse"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
            title={isListening ? "Stop listening" : "Voice input"}
          >
            🎤
          </button>
        )}

        {/* Send button */}
        <button
          onClick={() => sendMessage(inputText)}
          disabled={!inputText.trim() || isLoading}
          className="w-10 h-10 rounded-full bg-sokoni-green flex items-center justify-center text-white hover:bg-sokoni-darkgreen transition-colors disabled:opacity-40 flex-shrink-0"
          title="Send"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
