/**
 * VendorDashboard.jsx
 * Vendor-facing dashboard showing incoming service requests and conversation threads.
 * Features:
 *  - Auto-polls for new messages every 5 seconds
 *  - Red badge with unread count
 *  - Conversation thread view with reply input
 *  - No consumer contact info is ever shown
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getVendorMessages, getConversation, sendVendorReply } from "../utils/api";
import { supabase } from "../utils/supabaseClient";

export default function VendorDashboard() {
  const navigate  = useNavigate();
  const vendorId  = localStorage.getItem("sokoni_vendor_id");
  const vendorName = localStorage.getItem("sokoni_display_name") || "Vendor";

  const [requests, setRequests]         = useState([]);
  const [activeThread, setActiveThread] = useState(null); // { consumerId, consumerName }
  const [thread, setThread]             = useState([]);
  const [replyText, setReplyText]       = useState("");
  const [loading, setLoading]           = useState(false);
  const [unreadCount, setUnreadCount]   = useState(0);
  const [view, setView]                 = useState("list"); // "list" | "thread"
  const pollRef  = useRef(null);
  const bottomRef = useRef(null);

  // ── Redirect if not a vendor ──────────────────────────────────────────
  useEffect(() => {
    if (!vendorId) navigate("/");
  }, [vendorId, navigate]);

  // ── Fetch requests ────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    if (!vendorId) return;
    try {
      const msgs = await getVendorMessages(vendorId);
      setRequests(msgs);
      const unread = msgs.filter((m) => !m.is_read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  }, [vendorId]);

  // ── Poll every 5 seconds ──────────────────────────────────────────────
  useEffect(() => {
    fetchRequests();
    pollRef.current = setInterval(fetchRequests, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchRequests]);

  // ── Auto-scroll thread ────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  // ── Open a conversation thread ────────────────────────────────────────
  async function openThread(consumerId, consumerName) {
    setActiveThread({ consumerId, consumerName });
    setView("thread");
    try {
      const msgs = await getConversation(consumerId, vendorId);
      setThread(msgs);
    } catch (err) {
      console.error("Failed to load thread:", err);
    }
  }

  // ── Send a reply ──────────────────────────────────────────────────────
  async function handleReply() {
    if (!replyText.trim() || !activeThread) return;
    setLoading(true);
    try {
      await sendVendorReply(vendorId, activeThread.consumerId, replyText.trim());
      setReplyText("");
      // Refresh thread
      const msgs = await getConversation(activeThread.consumerId, vendorId);
      setThread(msgs);
    } catch (err) {
      console.error("Reply failed:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Sign out ──────────────────────────────────────────────────────────
  async function handleSignOut() {
    await supabase.auth.signOut();
    localStorage.removeItem("sokoni_role");
    localStorage.removeItem("sokoni_vendor_id");
    localStorage.removeItem("sokoni_display_name");
    navigate("/");
  }

  // ── Format date ───────────────────────────────────────────────────────
  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-UG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  // ── Group requests by consumer ────────────────────────────────────────
  const grouped = requests.reduce((acc, msg) => {
    const key = msg.consumer_id;
    if (!acc[key]) {
      acc[key] = {
        consumerId:   msg.consumer_id,
        consumerName: msg.consumer_name || "Guest",
        latestMsg:    msg.content,
        latestDate:   msg.created_at,
        unread:       !msg.is_read,
      };
    } else if (new Date(msg.created_at) > new Date(acc[key].latestDate)) {
      acc[key].latestMsg  = msg.content;
      acc[key].latestDate = msg.created_at;
      if (!msg.is_read) acc[key].unread = true;
    }
    return acc;
  }, {});

  const conversations = Object.values(grouped).sort(
    (a, b) => new Date(b.latestDate) - new Date(a.latestDate)
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-sokoni-header text-white px-4 py-3 flex items-center gap-3 shadow-md flex-shrink-0">
        {view === "thread" ? (
          <button onClick={() => setView("list")} className="text-green-300 hover:text-white mr-1">
            ←
          </button>
        ) : (
          <div className="w-10 h-10 rounded-full bg-sokoni-green flex items-center justify-center text-xl font-bold">
            🏪
          </div>
        )}

        <div className="flex-1">
          <p className="font-semibold text-base leading-tight">
            {view === "thread" ? activeThread?.consumerName || "Conversation" : vendorName}
          </p>
          <p className="text-green-300 text-xs">
            {view === "thread" ? "Conversation thread" : "Vendor Dashboard"}
          </p>
        </div>

        {/* Unread badge */}
        {view === "list" && unreadCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full badge-pulse">
            {unreadCount}
          </span>
        )}

        <button
          onClick={handleSignOut}
          className="text-green-300 hover:text-white text-xs ml-2"
        >
          Sign out
        </button>
      </div>

      {/* ── List view ──────────────────────────────────────────────────── */}
      {view === "list" && (
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 px-8 text-center">
              <span className="text-5xl">📭</span>
              <p className="font-medium text-gray-600">No requests yet</p>
              <p className="text-sm">When consumers request your service, they'll appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {conversations.map((conv) => (
                <li key={conv.consumerId}>
                  <button
                    onClick={() => openThread(conv.consumerId, conv.consumerName)}
                    className="w-full flex items-start gap-3 px-4 py-4 hover:bg-gray-100 transition-colors text-left"
                  >
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full bg-sokoni-green flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {conv.consumerName.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`font-medium text-gray-900 truncate ${conv.unread ? "font-semibold" : ""}`}>
                          {conv.consumerName}
                        </p>
                        <p className="text-gray-400 text-xs flex-shrink-0">{formatDate(conv.latestDate)}</p>
                      </div>
                      <p className="text-gray-500 text-sm truncate mt-0.5">{conv.latestMsg}</p>
                    </div>

                    {conv.unread && (
                      <div className="w-2.5 h-2.5 rounded-full bg-sokoni-green flex-shrink-0 mt-2" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Thread view ────────────────────────────────────────────────── */}
      {view === "thread" && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-2 bg-sokoni-bg">
            {thread.length === 0 && (
              <p className="text-center text-gray-400 text-sm mt-8">No messages yet.</p>
            )}
            {thread.map((msg, i) => {
              const isVendor = msg.sender === "vendor";
              return (
                <div key={i} className={`flex msg-enter ${isVendor ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm whitespace-pre-wrap ${
                      isVendor
                        ? "bg-sokoni-light text-gray-800 rounded-br-sm"
                        : "bg-white text-gray-800 rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                    <p className="text-gray-400 text-xs mt-1 text-right">{formatDate(msg.created_at)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply input */}
          <div className="bg-white border-t border-gray-200 px-3 py-2 flex items-end gap-2 flex-shrink-0">
            <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2">
              <textarea
                rows={1}
                value={replyText}
                onChange={(e) => {
                  setReplyText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
                placeholder="Type your reply…"
                className="w-full bg-transparent text-gray-800 text-sm resize-none focus:outline-none max-h-28 leading-relaxed"
                style={{ height: "24px" }}
              />
            </div>
            <button
              onClick={handleReply}
              disabled={!replyText.trim() || loading}
              className="w-10 h-10 rounded-full bg-sokoni-green flex items-center justify-center text-white hover:bg-sokoni-darkgreen transition-colors disabled:opacity-40 flex-shrink-0"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
