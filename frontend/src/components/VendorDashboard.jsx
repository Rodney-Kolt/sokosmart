/**
 * VendorDashboard.jsx
 * Vendor-facing dashboard.
 * Features:
 *  - Feature 1: Open/Busy/Closed status toggle at the top
 *  - Feature 2: Order management (accept → in_progress → ready → completed)
 *  - Existing: message threads with reply input
 *  - Feature 5: Sticky layout – header + input bar never scroll off screen
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getVendorMessages, getConversation, sendVendorReply,
  updateVendorStatus, getVendorOrders, updateOrderStatus,
  getVendorListings, updateListingStatus,
} from "../utils/api";
import { supabase } from "../utils/supabaseClient";
import CreateListing from "./CreateListing";

const STATUS_OPTIONS = [
  { value: "open",   label: "Open",   color: "bg-green-500",  text: "text-green-400",  border: "border-green-600" },
  { value: "busy",   label: "Busy",   color: "bg-orange-500", text: "text-orange-400", border: "border-orange-600" },
  { value: "closed", label: "Closed", color: "bg-gray-500",   text: "text-gray-400",   border: "border-gray-600" },
];

const ORDER_NEXT_STATUS = {
  requested:   { label: "Accept",      next: "accepted" },
  accepted:    { label: "Start Work",  next: "in_progress" },
  in_progress: { label: "Mark Ready",  next: "ready" },
  ready:       { label: "Complete",    next: "completed" },
  completed:   null,
};

const ORDER_STATUS_COLORS = {
  requested:   "text-yellow-400 border-yellow-700/40 bg-yellow-900/20",
  accepted:    "text-blue-400   border-blue-700/40   bg-blue-900/20",
  in_progress: "text-purple-400 border-purple-700/40 bg-purple-900/20",
  ready:       "text-green-400  border-green-700/40  bg-green-900/20",
  completed:   "text-gray-400   border-gray-700/40   bg-gray-900/20",
};

export default function VendorDashboard({ onBack }) {
  const navigate   = useNavigate();
  const vendorId   = localStorage.getItem("sokoni_vendor_id");
  const vendorName = localStorage.getItem("sokoni_display_name") || "Vendor";

  const [view, setView]                 = useState("messages"); // "messages" | "orders" | "thread" | "feed"
  const [requests, setRequests]         = useState([]);
  const [orders, setOrders]             = useState([]);
  const [listings, setListings]         = useState([]);
  const [showCreateListing, setShowCreateListing] = useState(false);
  const [activeThread, setActiveThread] = useState(null);
  const [thread, setThread]             = useState([]);
  const [replyText, setReplyText]       = useState("");
  const [loading, setLoading]           = useState(false);
  const [unreadCount, setUnreadCount]   = useState(0);
  const [vendorStatus, setVendorStatus] = useState("open");
  const [statusLoading, setStatusLoading] = useState(false);

  const pollRef  = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => { if (!vendorId) navigate("/"); }, [vendorId, navigate]);

  // ── Fetch messages ────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    if (!vendorId) return;
    try {
      const msgs  = await getVendorMessages(vendorId);
      setRequests(msgs);
      setUnreadCount(msgs.filter((m) => !m.is_read).length);
    } catch { /* silent */ }
  }, [vendorId]);

  // ── Fetch orders ──────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    if (!vendorId) return;
    try {
      const data = await getVendorOrders(vendorId);
      setOrders(data);
    } catch { /* silent */ }
  }, [vendorId]);

  // ── Fetch listings ────────────────────────────────────────────────────
  const fetchListings = useCallback(async () => {
    if (!vendorId) return;
    try {
      const data = await getVendorListings(vendorId);
      setListings(data);
    } catch { /* silent */ }
  }, [vendorId]);

  useEffect(() => {
    fetchRequests();
    fetchOrders();
    fetchListings();
    pollRef.current = setInterval(() => { fetchRequests(); fetchOrders(); }, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchRequests, fetchOrders, fetchListings]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  // ── Feature 1: Status toggle ──────────────────────────────────────────
  async function handleStatusChange(newStatus) {
    setStatusLoading(true);
    try {
      await updateVendorStatus(vendorId, newStatus);
      setVendorStatus(newStatus);
    } catch { /* silent */ } finally {
      setStatusLoading(false);
    }
  }

  // ── Feature 2: Order status advance ──────────────────────────────────
  async function advanceOrder(orderId, nextStatus) {
    try {
      await updateOrderStatus(orderId, nextStatus);
      await fetchOrders();
    } catch { /* silent */ }
  }

  // ── Thread ────────────────────────────────────────────────────────────
  async function openThread(consumerId, consumerName) {
    setActiveThread({ consumerId, consumerName });
    setView("thread");
    try {
      const msgs = await getConversation(consumerId, vendorId);
      setThread(msgs);
    } catch { /* silent */ }
  }

  async function handleReply() {
    if (!replyText.trim() || !activeThread) return;
    setLoading(true);
    try {
      await sendVendorReply(vendorId, activeThread.consumerId, replyText.trim());
      setReplyText("");
      const msgs = await getConversation(activeThread.consumerId, vendorId);
      setThread(msgs);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    ["sokoni_role","sokoni_vendor_id","sokoni_display_name"].forEach((k) => localStorage.removeItem(k));
    navigate("/");
  }

  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-UG", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  }

  // Group messages by consumer
  const grouped = requests.reduce((acc, msg) => {
    const key = msg.consumer_id;
    if (!acc[key]) {
      acc[key] = { consumerId: msg.consumer_id, consumerName: msg.consumer_name || "Guest",
                   latestMsg: msg.content, latestDate: msg.created_at, unread: !msg.is_read };
    } else if (new Date(msg.created_at) > new Date(acc[key].latestDate)) {
      acc[key].latestMsg  = msg.content;
      acc[key].latestDate = msg.created_at;
      if (!msg.is_read) acc[key].unread = true;
    }
    return acc;
  }, {});
  const conversations = Object.values(grouped).sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));

  const activeStatus = STATUS_OPTIONS.find((s) => s.value === vendorStatus) || STATUS_OPTIONS[0];

  // ── Render ────────────────────────────────────────────────────────────
  return (
    // Feature 5: h-screen flex-col – header + input never scroll away
    <div className="flex flex-col h-screen bg-[#0d1117]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          {view === "thread" || view === "orders" ? (
            <button onClick={() => setView("messages")} className="text-gray-400 hover:text-white">←</button>
          ) : (
            <button
              onClick={onBack || (() => navigate("/"))}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-lg font-bold text-white"
            >
              🏪
            </button>
          )}
          <div className="flex-1">
            <p className="text-white font-semibold text-sm leading-tight">
              {view === "thread" ? activeThread?.consumerName : vendorName}
            </p>
            <p className="text-gray-500 text-xs">
              {view === "thread" ? "Conversation" : view === "orders" ? "Orders" : "Vendor Dashboard"}
            </p>
          </div>
          {unreadCount > 0 && view !== "thread" && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full badge-pulse">
              {unreadCount}
            </span>
          )}
          <button onClick={handleSignOut} className="text-gray-500 hover:text-white text-xs">Sign out</button>
        </div>

        {/* Feature 1: Status toggle */}
        {view !== "thread" && (
          <div className="flex gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                disabled={statusLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  vendorStatus === opt.value
                    ? `${opt.border} ${opt.text} bg-opacity-20 bg-current`
                    : "border-[#30363d] text-gray-500 hover:border-gray-500"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${vendorStatus === opt.value ? opt.color : "bg-gray-600"}`} />
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Tab switcher: Messages | Orders | Feed */}
        {view !== "thread" && (
          <div className="flex gap-1 mt-3">
            {[
              { id: "messages", label: `Messages${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
              { id: "orders",   label: `Orders${orders.filter(o => o.status !== "completed").length > 0 ? ` (${orders.filter(o => o.status !== "completed").length})` : ""}` },
              { id: "feed",     label: `My Feed` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  view === tab.id
                    ? "bg-[#25D366] text-[#0d1117]"
                    : "bg-[#0d1117] text-gray-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Messages list ───────────────────────────────────────────────── */}
      {view === "messages" && (
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3 px-8 text-center">
              <span className="text-5xl">📭</span>
              <p className="font-medium text-gray-400">No messages yet</p>
              <p className="text-sm">Customer requests will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#30363d]">
              {conversations.map((conv) => (
                <li key={conv.consumerId}>
                  <button
                    onClick={() => openThread(conv.consumerId, conv.consumerName)}
                    className="w-full flex items-start gap-3 px-4 py-4 hover:bg-[#161b22] transition-colors text-left"
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {conv.consumerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${conv.unread ? "text-white font-semibold" : "text-gray-300"}`}>
                          {conv.consumerName}
                        </p>
                        <p className="text-gray-600 text-xs flex-shrink-0">{formatDate(conv.latestDate)}</p>
                      </div>
                      <p className="text-gray-500 text-xs truncate mt-0.5">{conv.latestMsg}</p>
                    </div>
                    {conv.unread && <div className="w-2.5 h-2.5 rounded-full bg-[#25D366] flex-shrink-0 mt-2" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Orders list ─────────────────────────────────────────────────── */}
      {view === "orders" && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3 text-center">
              <span className="text-5xl">📋</span>
              <p className="font-medium text-gray-400">No orders yet</p>
            </div>
          ) : (
            orders.map((order) => {
              const nextAction = ORDER_NEXT_STATUS[order.status];
              return (
                <div key={order.id} className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-white font-semibold text-sm">{order.consumer_name || "Guest"}</p>
                      <p className="text-gray-500 text-xs">{formatDate(order.created_at)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${ORDER_STATUS_COLORS[order.status] || ""}`}>
                      {order.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-3 line-clamp-2">"{order.details}"</p>
                  {nextAction && (
                    <button
                      onClick={() => advanceOrder(order.id, nextAction.next)}
                      className="w-full bg-[#25D366] text-[#0d1117] font-semibold py-2 rounded-xl text-sm hover:bg-[#128C7E] hover:text-white transition-colors"
                    >
                      {nextAction.label} →
                    </button>
                  )}
                  {order.status === "completed" && (
                    <p className="text-center text-gray-500 text-xs mt-1">✅ Completed</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Thread view ─────────────────────────────────────────────────── */}
      {view === "thread" && (
        <>
          {/* Scrollable messages */}
          <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-2 bg-[#0d1117]">
            {thread.length === 0 && (
              <p className="text-center text-gray-600 text-sm mt-8">No messages yet.</p>
            )}
            {thread.map((msg, i) => {
              const isVendor = msg.sender === "vendor";
              return (
                <div key={i} className={`flex msg-enter ${isVendor ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm whitespace-pre-wrap ${
                    isVendor
                      ? "bg-[#25D366] text-[#0d1117] font-medium rounded-br-sm"
                      : "bg-[#161b22] text-gray-100 border border-[#30363d] rounded-bl-sm"
                  }`}>
                    {msg.content}
                    <p className="text-xs mt-1 text-right opacity-60">{formatDate(msg.created_at)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Feature 5: Sticky reply input */}
          <div className="bg-[#161b22] border-t border-[#30363d] px-3 py-2 flex items-end gap-2 flex-shrink-0">
            <div className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-2xl px-4 py-2 focus-within:border-[#25D366] transition-colors">
              <textarea
                rows={1}
                value={replyText}
                onChange={(e) => {
                  setReplyText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                placeholder="Type your reply…"
                className="w-full bg-transparent text-gray-100 text-sm resize-none focus:outline-none max-h-28 leading-relaxed placeholder-gray-600"
                style={{ height: "24px" }}
              />
            </div>
            <button
              onClick={handleReply}
              disabled={!replyText.trim() || loading}
              className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-[#0d1117] hover:bg-[#128C7E] hover:text-white transition-colors disabled:opacity-40 flex-shrink-0"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </>
      )}
      {/* ── Market Feed / Listings ──────────────────────────────────── */}
      {view === "feed" && !showCreateListing && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white font-semibold text-sm">Your Market Listings</p>
            <button
              onClick={() => setShowCreateListing(true)}
              className="bg-[#25D366] text-[#0d1117] font-semibold text-xs px-3 py-1.5 rounded-full"
            >
              + New Listing
            </button>
          </div>

          {listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <span className="text-5xl">🛍️</span>
              <p className="text-white font-semibold">No listings yet</p>
              <p className="text-gray-500 text-sm">Create a listing to advertise your products and services on the market feed.</p>
              <button
                onClick={() => setShowCreateListing(true)}
                className="bg-[#25D366] text-[#0d1117] font-semibold px-5 py-2.5 rounded-xl text-sm mt-2"
              >
                Create First Listing →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {listings.map((listing) => (
                <div key={listing.id} className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-white font-semibold text-sm">{listing.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                      listing.status === "active" ? "text-green-400 border-green-700/40 bg-green-900/20"
                      : listing.status === "sold" ? "text-gray-400 border-gray-700/40 bg-gray-900/20"
                      : "text-yellow-400 border-yellow-700/40 bg-yellow-900/20"
                    }`}>{listing.status}</span>
                  </div>
                  {listing.price && (
                    <p className="text-[#25D366] font-bold text-sm mb-1">UGX {Number(listing.price).toLocaleString()}</p>
                  )}
                  <p className="text-gray-500 text-xs mb-3 line-clamp-2">{listing.description}</p>
                  <div className="flex gap-2">
                    {listing.status !== "sold" && (
                      <button
                        onClick={() => updateListingStatus(listing.id, listing.status === "active" ? "paused" : "active").then(fetchListings)}
                        className="flex-1 text-xs py-1.5 rounded-lg border border-[#30363d] text-gray-300 hover:border-[#25D366] transition-colors"
                      >
                        {listing.status === "active" ? "Pause" : "Activate"}
                      </button>
                    )}
                    <button
                      onClick={() => updateListingStatus(listing.id, "sold").then(fetchListings)}
                      className="flex-1 text-xs py-1.5 rounded-lg border border-[#30363d] text-gray-300 hover:border-yellow-500 transition-colors"
                    >
                      Mark Sold
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create listing overlay */}
      {view === "feed" && showCreateListing && (
        <CreateListing
          vendorId={vendorId}
          onClose={() => setShowCreateListing(false)}
          onCreated={() => { setShowCreateListing(false); fetchListings(); }}
        />
      )}
    </div>
  );
}
