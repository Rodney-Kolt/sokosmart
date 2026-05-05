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
