/**
 * api.js – Axios wrapper for all backend calls.
 * The base URL is read from the VITE_API_URL env variable.
 * During local dev, Vite proxies /api → localhost:8000.
 */

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// ── Chat ─────────────────────────────────────────────────────────────────

/**
 * Send a chat message to the Sokoni AI.
 * @param {string} userId
 * @param {string} message
 * @param {number|null} latitude
 * @param {number|null} longitude
 * @param {Array} conversationHistory  – [{role, content}]
 */
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

/**
 * Consumer sends a service request to a vendor.
 */
export async function requestService(consumerId, vendorId, message, consumerName = "Guest") {
  const { data } = await api.post("/request-service", {
    consumer_id:   consumerId,
    vendor_id:     vendorId,
    message,
    consumer_name: consumerName,
  });
  return data;
}

// ── Vendor ───────────────────────────────────────────────────────────────

/**
 * Fetch all incoming messages for a vendor.
 */
export async function getVendorMessages(vendorId) {
  const { data } = await api.get(`/vendor/${vendorId}/messages`);
  return data.messages || [];
}

/**
 * Fetch the full conversation thread between a consumer and vendor.
 */
export async function getConversation(consumerId, vendorId) {
  const { data } = await api.get(`/conversation/${consumerId}/${vendorId}`);
  return data.thread || [];
}

/**
 * Vendor sends a reply to a consumer.
 */
export async function sendVendorReply(vendorId, consumerId, message) {
  const { data } = await api.post("/vendor/reply", {
    vendor_id:   vendorId,
    consumer_id: consumerId,
    message,
  });
  return data;
}

/**
 * Fetch vendor profile by owner_id.
 */
export async function getVendorProfile(vendorId) {
  const { data } = await api.get(`/vendor/${vendorId}/profile`);
  return data.profile;
}
