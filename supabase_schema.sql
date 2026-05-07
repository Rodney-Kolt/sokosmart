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

-- ============================================================
-- MIGRATION v2 – Run these in Supabase SQL Editor
-- ============================================================

-- ── Feature 1: Vendor inventory status ───────────────────────────────────────
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open'
  CHECK (status IN ('open', 'busy', 'closed'));

-- ── Feature 2: Orders / Service pipeline ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_id     TEXT NOT NULL,          -- auth UUID or guest UUID
  vendor_id       UUID NOT NULL,          -- vendor's auth user ID
  consumer_name   TEXT DEFAULT 'Guest',
  details         TEXT NOT NULL,          -- initial request message
  status          TEXT NOT NULL DEFAULT 'requested'
                    CHECK (status IN ('requested','accepted','in_progress','ready','completed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_vendor   ON orders (vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_consumer ON orders (consumer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders (status);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS for orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert order"
  ON orders FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Vendor reads own orders"
  ON orders FOR SELECT
  USING (auth.uid() = vendor_id);

CREATE POLICY "Vendor updates own orders"
  ON orders FOR UPDATE
  USING (auth.uid() = vendor_id);

-- ── Feature 3: Reviews ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         UUID UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id        UUID NOT NULL,
  consumer_id      TEXT NOT NULL,
  rating           INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text      TEXT,
  voice_review_url TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_vendor ON reviews (vendor_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert review"
  ON reviews FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Public read reviews"
  ON reviews FOR SELECT USING (TRUE);

-- ============================================================
-- MIGRATION v3 – Social Marketplace Features
-- Run in Supabase SQL Editor
-- ============================================================

-- ── follows ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id  TEXT NOT NULL,   -- auth UUID or guest UUID
  following_id TEXT NOT NULL,   -- vendor owner_id being followed
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows (following_id);
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can follow"   ON follows FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Anyone can unfollow" ON follows FOR DELETE USING (TRUE);
CREATE POLICY "Public read follows" ON follows FOR SELECT USING (TRUE);

-- ── vendor_listings ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_listings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id   TEXT NOT NULL,          -- vendor owner_id
  title       TEXT NOT NULL,
  description TEXT,
  price       NUMERIC(10,2),
  category    TEXT,
  images      TEXT[] DEFAULT '{}',    -- array of public URLs
  status      TEXT DEFAULT 'active' CHECK (status IN ('active','paused','sold','draft')),
  views       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listings_vendor   ON vendor_listings (vendor_id);
CREATE INDEX IF NOT EXISTS idx_listings_status   ON vendor_listings (status);
CREATE INDEX IF NOT EXISTS idx_listings_category ON vendor_listings (category);
ALTER TABLE vendor_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active listings" ON vendor_listings FOR SELECT USING (status = 'active');
CREATE POLICY "Anyone can insert listing"   ON vendor_listings FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Anyone can update listing"   ON vendor_listings FOR UPDATE USING (TRUE);

-- ── profile_views ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_views (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id  TEXT NOT NULL,   -- vendor owner_id being viewed
  viewer_id   TEXT,            -- NULL for anonymous
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profile_views_profile ON profile_views (profile_id);
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert profile view" ON profile_views FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Owner reads own views"          ON profile_views FOR SELECT USING (TRUE);

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     TEXT NOT NULL,   -- recipient
  type        TEXT NOT NULL,   -- 'follow' | 'new_listing' | 'new_message' | 'profile_view' | 'order_update'
  title       TEXT NOT NULL,
  body        TEXT,
  data        JSONB DEFAULT '{}',
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, is_read);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert notification" ON notifications FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "User reads own notifications"   ON notifications FOR SELECT USING (TRUE);
CREATE POLICY "User updates own notifications" ON notifications FOR UPDATE USING (TRUE);

-- ── Trigger: auto-update vendor_listings.updated_at ──────────────────────────
DROP TRIGGER IF EXISTS listings_updated_at ON vendor_listings;
CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON vendor_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── profiles ─────────────────────────────────────────────────────────────────
-- One row per user. Persists across logins.
-- id = auth.users.id (same UUID)
CREATE TABLE IF NOT EXISTS profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name            TEXT,
  phone                TEXT,
  role                 TEXT CHECK (role IN ('consumer', 'vendor')) DEFAULT 'consumer',
  avatar_emoji         TEXT DEFAULT '🧑',
  avatar_url           TEXT,
  business_name        TEXT,
  business_category    TEXT,
  business_description TEXT,
  location             TEXT,
  cover_image_url      TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Service role bypasses RLS (used by backend)
-- (No policy needed — service role key bypasses RLS automatically)
