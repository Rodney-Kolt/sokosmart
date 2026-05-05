-- ============================================================
-- Sokoni Chat – Supabase Database Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── vendors ─────────────────────────────────────────────────────────────────
-- Stores vendor business listings.
-- owner_id links to auth.users (set when vendor registers).
CREATE TABLE IF NOT EXISTS vendors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT,
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  rating      NUMERIC(3,1) DEFAULT 4.0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast category searches
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors (category);
CREATE INDEX IF NOT EXISTS idx_vendors_owner    ON vendors (owner_id);

-- ── messages ─────────────────────────────────────────────────────────────────
-- Stores all consumer ↔ vendor messages.
-- consumer_id can be a UUID from auth.users OR a guest UUID from localStorage.
-- vendor_id is the UUID of the vendor's auth user (owner_id in vendors table).
CREATE TABLE IF NOT EXISTS messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_id   TEXT NOT NULL,          -- UUID string (auth or guest)
  vendor_id     UUID NOT NULL,          -- vendor's auth user ID
  content       TEXT NOT NULL,
  sender        TEXT NOT NULL CHECK (sender IN ('consumer', 'vendor')),
  consumer_name TEXT DEFAULT 'Guest',
  is_read       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_vendor   ON messages (vendor_id);
CREATE INDEX IF NOT EXISTS idx_messages_consumer ON messages (consumer_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread   ON messages (consumer_id, vendor_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Vendors can only read their own messages.
-- The backend uses the SERVICE ROLE key which bypasses RLS.
-- These policies protect direct client-side access.

ALTER TABLE vendors  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Vendors: anyone can read active listings (for search)
CREATE POLICY "Public read active vendors"
  ON vendors FOR SELECT
  USING (is_active = TRUE);

-- Vendors: only the owner can update/delete their listing
CREATE POLICY "Vendor owner can update"
  ON vendors FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Vendor owner can delete"
  ON vendors FOR DELETE
  USING (auth.uid() = owner_id);

-- Vendors: authenticated users can insert (during registration)
-- NOTE: vendor inserts go through the backend service role key which bypasses RLS.
-- This policy is a fallback for direct client inserts.
CREATE POLICY "Authenticated can insert vendor"
  ON vendors FOR INSERT
  WITH CHECK (auth.uid() = owner_id OR auth.role() = 'service_role');

-- Messages: vendor can read messages addressed to them
CREATE POLICY "Vendor reads own messages"
  ON messages FOR SELECT
  USING (auth.uid() = vendor_id);

-- Messages: anyone can insert (consumers send requests)
CREATE POLICY "Anyone can send message"
  ON messages FOR INSERT
  WITH CHECK (TRUE);
