/**
 * api.js – Axios wrapper for all backend calls.
 * The base URL is read from the VITE_API_URL env variable.
 * During local dev, Vite proxies /api → localhost:8000.
 */

import axios from "axios";
import { supabase } from "./supabaseClient";

const BASE_URL = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 90000,   // 90s – Render free tier can take ~30-50s to wake from sleep
  headers: { "Content-Type": "application/json" },
});

// Intercept network errors and give a friendlier message
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!err.response) {
      err.message =
        "The server is waking up (Render free tier). Please wait 30 seconds and try again.";
    }
    return Promise.reject(err);
  }
);

// ── Chat ─────────────────────────────────────────────────────────────────

export async function sendChatMessage(userId, message, latitude, longitude, conversationHistory = []) {
  const { data } = await api.post("/chat", {
    user_id: userId,
    message,
    latitude,
    longitude,
    conversation_history: conversationHistory,
  });
  return data;
}

// ── Service Requests ─────────────────────────────────────────────────────

export async function requestService(consumerId, vendorId, message, consumerName = "Guest") {
  const { data } = await api.post("/request-service", {
    consumer_id:   consumerId,
    vendor_id:     vendorId,
    message,
    consumer_name: consumerName,
  });
  return data;
}

// ── Vendor (backend) ─────────────────────────────────────────────────────

export async function getVendorMessages(vendorId) {
  const { data } = await api.get(`/vendor/${vendorId}/messages`);
  return data.messages || [];
}

export async function getConversation(consumerId, vendorId) {
  const { data } = await api.get(`/conversation/${consumerId}/${vendorId}`);
  return data.thread || [];
}

export async function sendVendorReply(vendorId, consumerId, message) {
  const { data } = await api.post("/vendor/reply", {
    vendor_id:   vendorId,
    consumer_id: consumerId,
    message,
  });
  return data;
}

export async function getVendorProfile(vendorId) {
  const { data } = await api.get(`/vendor/${vendorId}/profile`);
  return data.profile;
}

// ── Vendors (Supabase direct – for MarketScreen) ──────────────────────────

/**
 * Fetch all active vendors from Supabase, optionally filtered by category.
 * @param {string|null} category – partial match, e.g. "salon". Pass null for all.
 * @returns {Promise<Array>}
 */
export async function fetchVendors(category = null) {
  let query = supabase
    .from("vendors")
    .select("*")
    .eq("is_active", true)
    .order("rating", { ascending: false });

  if (category && category !== "All") {
    query = query.ilike("category", `%${category}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ── Recent searches (localStorage) ───────────────────────────────────────

const RECENT_KEY = "sokoni_recent_searches";

export function saveRecentSearch(term) {
  try {
    const existing = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    const updated  = [term, ...existing.filter((t) => t !== term)].slice(0, 10);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

export function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

// ── Feature 1: Vendor status ──────────────────────────────────────────────

export async function updateVendorStatus(vendorOwnerId, status) {
  const { data } = await api.put("/vendor/status", {
    vendor_owner_id: vendorOwnerId,
    status,
  });
  return data;
}

// ── Feature 2: Orders ─────────────────────────────────────────────────────

export async function getOrderStatus(orderId) {
  const { data } = await api.get(`/order/${orderId}`);
  return data.order;
}

export async function updateOrderStatus(orderId, status) {
  const { data } = await api.put(`/order/${orderId}/status`, { status });
  return data;
}

export async function getVendorOrders(vendorId) {
  const { data } = await api.get(`/vendor/${vendorId}/orders`);
  return data.orders || [];
}

// ── Feature 3: Reviews ────────────────────────────────────────────────────

export async function submitReview(payload) {
  const { data } = await api.post(`/order/${payload.order_id}/review`, payload);
  return data;
}

// ── Feature 4: Unread count ───────────────────────────────────────────────

export async function getUnreadCount(userId, role = "consumer") {
  const { data } = await api.get("/unread-count", { params: { user_id: userId, role } });
  return data.count || 0;
}

// ── v3: Follow system ─────────────────────────────────────────────────────

export async function followVendor(followerId, followingId) {
  const { data } = await api.post("/follow", { follower_id: followerId, following_id: followingId });
  return data;
}

export async function unfollowVendor(followerId, followingId) {
  const { data } = await api.delete("/unfollow", { data: { follower_id: followerId, following_id: followingId } });
  return data;
}

export async function checkIsFollowing(followerId, followingId) {
  const { data } = await api.get("/is-following", { params: { follower_id: followerId, following_id: followingId } });
  return data.is_following || false;
}

export async function getFollowers(userId) {
  const { data } = await api.get(`/followers/${userId}`);
  return data;
}

export async function getFollowing(userId) {
  const { data } = await api.get(`/following/${userId}`);
  return data;
}

// ── v3: Listings ──────────────────────────────────────────────────────────

export async function createListing(payload) {
  const { data } = await api.post("/listing", payload);
  return data;
}

export async function getVendorListings(vendorId, status = null) {
  const params = status ? { status } : {};
  const { data } = await api.get(`/vendor/${vendorId}/listings`, { params });
  return data.listings || [];
}

export async function updateListingStatus(listingId, status) {
  const { data } = await api.put(`/listing/${listingId}/status`, { status });
  return data;
}

export async function generateListingDescription(title, category = "") {
  const { data } = await api.post("/generate-listing-description", { title, category });
  return data.description || "";
}

// ── v3: Profile views ─────────────────────────────────────────────────────

export async function trackProfileView(profileId, viewerId = null) {
  const params = viewerId ? { viewer_id: viewerId } : {};
  const { data } = await api.post(`/profile/${profileId}/view`, null, { params });
  return data;
}

// ── v3: Notifications ─────────────────────────────────────────────────────

export async function getNotifications(userId) {
  const { data } = await api.get(`/notifications/${userId}`);
  return data;
}

export async function markNotificationsRead(userId) {
  const { data } = await api.post(`/notifications/${userId}/read`);
  return data;
}

export async function getNotificationCount(userId) {
  const { data } = await api.get(`/notifications/${userId}/count`);
  return data.count || 0;
}

// ── v3: Analytics ─────────────────────────────────────────────────────────

export async function getVendorAnalytics(vendorId) {
  const { data } = await api.get("/vendor/analytics", { params: { vendor_id: vendorId } });
  return data;
}

export async function getVendorRank(vendorId) {
  const { data } = await api.get("/vendor/rank", { params: { vendor_id: vendorId } });
  return data;
}

// ── v3: Supabase Realtime notifications ──────────────────────────────────

export function subscribeToNotifications(userId, onNotification) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "notifications",
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      onNotification(payload.new);
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}
