/**
 * NotificationsScreen.jsx
 * Lists all in-app notifications with mark-as-read functionality.
 * Subscribes to Supabase Realtime for live updates.
 */

import React, { useState, useEffect, useCallback } from "react";
import { getNotifications, markNotificationsRead, subscribeToNotifications } from "../utils/api";

const TYPE_ICONS = {
  follow:       "👥",
  new_listing:  "🛍️",
  new_message:  "💬",
  profile_view: "👁️",
  order_update: "📦",
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsScreen({ onClose }) {
  const userId = localStorage.getItem("sokoni_guest_id") || localStorage.getItem("sokoni_vendor_id") || "";
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getNotifications(userId);
      setNotifications(data.notifications || []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
    // Mark all as read when screen opens
    if (userId) markNotificationsRead(userId).catch(() => {});

    // Subscribe to realtime
    const unsub = subscribeToNotifications(userId, (notif) => {
      setNotifications((prev) => [notif, ...prev]);
    });
    return unsub;
  }, [userId, load]);

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Header */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onClose} className="text-gray-400 hover:text-white">←</button>
        <h2 className="text-white font-bold text-base flex-1">Notifications</h2>
        {notifications.length > 0 && (
          <button
            onClick={() => { markNotificationsRead(userId); setNotifications((p) => p.map((n) => ({ ...n, is_read: true }))); }}
            className="text-[#25D366] text-xs"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="space-y-3 p-4">
            {[1,2,3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="shimmer w-10 h-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="shimmer h-3 w-3/4 rounded-full" />
                  <div className="shimmer h-3 w-1/2 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <span className="text-5xl">🔔</span>
            <p className="text-white font-semibold">No notifications yet</p>
            <p className="text-gray-500 text-sm">When someone follows you or messages you, it'll appear here.</p>
          </div>
        )}

        {!loading && notifications.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 px-4 py-3 border-b border-[#30363d] ${!n.is_read ? "bg-[#161b22]" : ""}`}
          >
            <div className="w-10 h-10 rounded-full bg-[#30363d] flex items-center justify-center text-xl flex-shrink-0">
              {TYPE_ICONS[n.type] || "🔔"}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-tight ${!n.is_read ? "text-white font-medium" : "text-gray-300"}`}>
                {n.title}
              </p>
              {n.body && <p className="text-gray-500 text-xs mt-0.5">{n.body}</p>}
              <p className="text-gray-600 text-xs mt-1">{timeAgo(n.created_at)}</p>
            </div>
            {!n.is_read && (
              <div className="w-2 h-2 rounded-full bg-[#25D366] flex-shrink-0 mt-2" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
