"""
Supabase database utilities for Sokoni Chat.
Handles vendor search, messaging, orders, reviews, and unread counts.
"""

import os
import math
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ── Geo helpers ───────────────────────────────────────────────────────────────

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi    = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Vendor search ─────────────────────────────────────────────────────────────

async def search_vendors(
    category: str,
    lat: float,
    lng: float,
    radius_km: float = 5.0,
    limit: int = 6,
    only_open: bool = False,
) -> list:
    """Search vendors by category near a location. Optionally filter to open-only."""
    query = (
        supabase.table("vendors")
        .select("*")
        .ilike("category", f"%{category}%")
        .eq("is_active", True)
    )
    if only_open:
        query = query.eq("status", "open")

    response = query.execute()
    vendors  = response.data or []

    nearby = []
    for v in vendors:
        v_lat = v.get("latitude")
        v_lng = v.get("longitude")
        if v_lat is None or v_lng is None:
            continue
        dist = haversine_km(lat, lng, float(v_lat), float(v_lng))
        if dist <= radius_km:
            nearby.append({**v, "_distance_km": dist})

    # Fallback: expand to all if nothing within radius
    if not nearby:
        for v in vendors:
            v_lat = v.get("latitude")
            v_lng = v.get("longitude")
            if v_lat is None or v_lng is None:
                continue
            dist = haversine_km(lat, lng, float(v_lat), float(v_lng))
            nearby.append({**v, "_distance_km": dist})

    nearby.sort(key=lambda x: (x["_distance_km"], -float(x.get("rating", 0))))

    result = []
    for v in nearby[:limit]:
        dist_km  = v["_distance_km"]
        dist_str = f"{dist_km:.1f} km" if dist_km >= 1 else f"{int(dist_km * 1000)} m"
        result.append({
            "id":           v.get("id"),
            "vname":        v.get("name", "Unknown"),
            "vcategory":    v.get("category", ""),
            "vdescription": v.get("description", ""),
            "vdistance":    dist_str,
            "vrating":      str(v.get("rating", "4.0")),
            "vstatus":      v.get("status", "open"),
            "vrequest":     "Request Service",
            "owner_id":     v.get("owner_id"),
        })
    return result


# ── Vendor status ─────────────────────────────────────────────────────────────

async def update_vendor_status(vendor_owner_id: str, status: str) -> bool:
    """Update a vendor's open/busy/closed status by their owner_id."""
    response = (
        supabase.table("vendors")
        .update({"status": status})
        .eq("owner_id", vendor_owner_id)
        .execute()
    )
    return bool(response.data)


# ── Messages ──────────────────────────────────────────────────────────────────

async def save_message(
    consumer_id: str,
    vendor_id: str,
    message: str,
    consumer_name: str = "Guest",
    sender: str = "consumer",
) -> Optional[str]:
    response = (
        supabase.table("messages")
        .insert({
            "consumer_id":   consumer_id,
            "vendor_id":     vendor_id,
            "content":       message,
            "consumer_name": consumer_name,
            "sender":        sender,
            "is_read":       False,
        })
        .execute()
    )
    data = response.data
    return data[0]["id"] if data else None


async def get_vendor_messages(vendor_id: str) -> list:
    response = (
        supabase.table("messages")
        .select("*")
        .eq("vendor_id", vendor_id)
        .eq("sender", "consumer")
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


async def get_conversation(consumer_id: str, vendor_id: str) -> list:
    response = (
        supabase.table("messages")
        .select("*")
        .eq("consumer_id", consumer_id)
        .eq("vendor_id", vendor_id)
        .order("created_at", desc=False)
        .execute()
    )
    return response.data or []


async def save_vendor_reply(vendor_id: str, consumer_id: str, message: str) -> Optional[str]:
    response = (
        supabase.table("messages")
        .insert({
            "consumer_id": consumer_id,
            "vendor_id":   vendor_id,
            "content":     message,
            "sender":      "vendor",
            "is_read":     False,
        })
        .execute()
    )
    data = response.data
    return data[0]["id"] if data else None


async def get_vendor_profile(vendor_id: str) -> Optional[dict]:
    response = (
        supabase.table("vendors")
        .select("*")
        .eq("owner_id", vendor_id)
        .single()
        .execute()
    )
    return response.data


# ── Orders ────────────────────────────────────────────────────────────────────

async def create_order(
    consumer_id: str,
    vendor_id: str,
    details: str,
    consumer_name: str = "Guest",
) -> Optional[dict]:
    """Create a new service order with status 'requested'."""
    response = (
        supabase.table("orders")
        .insert({
            "consumer_id":   consumer_id,
            "vendor_id":     vendor_id,
            "details":       details,
            "consumer_name": consumer_name,
            "status":        "requested",
        })
        .execute()
    )
    data = response.data
    return data[0] if data else None


async def get_order(order_id: str) -> Optional[dict]:
    """Fetch a single order by ID."""
    response = (
        supabase.table("orders")
        .select("*")
        .eq("id", order_id)
        .single()
        .execute()
    )
    return response.data


async def update_order_status(order_id: str, status: str) -> bool:
    """Update an order's status. Called by vendor."""
    response = (
        supabase.table("orders")
        .update({"status": status})
        .eq("id", order_id)
        .execute()
    )
    return bool(response.data)


async def get_vendor_orders(vendor_id: str) -> list:
    """Fetch all orders for a vendor, newest first."""
    response = (
        supabase.table("orders")
        .select("*")
        .eq("vendor_id", vendor_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


# ── Reviews ───────────────────────────────────────────────────────────────────

async def create_review(
    order_id: str,
    vendor_id: str,
    consumer_id: str,
    rating: int,
    review_text: str = "",
    voice_review_url: str = "",
) -> Optional[dict]:
    """Submit a review for a completed order."""
    response = (
        supabase.table("reviews")
        .insert({
            "order_id":        order_id,
            "vendor_id":       vendor_id,
            "consumer_id":     consumer_id,
            "rating":          rating,
            "review_text":     review_text or None,
            "voice_review_url": voice_review_url or None,
        })
        .execute()
    )
    data = response.data
    if not data:
        return None

    # Recalculate and update vendor's average rating
    await _recalculate_vendor_rating(vendor_id)
    return data[0]


async def _recalculate_vendor_rating(vendor_id: str):
    """Recompute average rating from all reviews and update vendors table."""
    response = (
        supabase.table("reviews")
        .select("rating")
        .eq("vendor_id", vendor_id)
        .execute()
    )
    ratings = [r["rating"] for r in (response.data or []) if r.get("rating")]
    if ratings:
        avg = round(sum(ratings) / len(ratings), 1)
        supabase.table("vendors").update({"rating": avg}).eq("owner_id", vendor_id).execute()


# ── Unread counts ─────────────────────────────────────────────────────────────

async def get_unread_count_for_consumer(consumer_id: str) -> int:
    """Count unread vendor→consumer messages for a consumer."""
    response = (
        supabase.table("messages")
        .select("id")
        .eq("consumer_id", consumer_id)
        .eq("sender", "vendor")
        .eq("is_read", False)
        .execute()
    )
    return len(response.data or [])


async def get_unread_count_for_vendor(vendor_id: str) -> int:
    """Count unread consumer→vendor messages for a vendor."""
    response = (
        supabase.table("messages")
        .select("id")
        .eq("vendor_id", vendor_id)
        .eq("sender", "consumer")
        .eq("is_read", False)
        .execute()
    )
    return len(response.data or [])


# ── Follows ───────────────────────────────────────────────────────────────────

async def follow_vendor(follower_id: str, following_id: str) -> bool:
    try:
        supabase.table("follows").insert({
            "follower_id": follower_id,
            "following_id": following_id,
        }).execute()
        return True
    except Exception:
        return False  # likely duplicate


async def unfollow_vendor(follower_id: str, following_id: str) -> bool:
    response = (
        supabase.table("follows")
        .delete()
        .eq("follower_id", follower_id)
        .eq("following_id", following_id)
        .execute()
    )
    return True


async def get_followers(user_id: str) -> list:
    response = (
        supabase.table("follows")
        .select("follower_id, created_at")
        .eq("following_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


async def get_following(user_id: str) -> list:
    response = (
        supabase.table("follows")
        .select("following_id, created_at")
        .eq("follower_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


async def is_following(follower_id: str, following_id: str) -> bool:
    response = (
        supabase.table("follows")
        .select("id")
        .eq("follower_id", follower_id)
        .eq("following_id", following_id)
        .execute()
    )
    return bool(response.data)


# ── Vendor listings ───────────────────────────────────────────────────────────

async def create_listing(
    vendor_id: str,
    title: str,
    description: str = "",
    price: float = None,
    category: str = "",
    images: list = None,
    status: str = "active",
) -> Optional[dict]:
    response = (
        supabase.table("vendor_listings")
        .insert({
            "vendor_id":   vendor_id,
            "title":       title,
            "description": description,
            "price":       price,
            "category":    category,
            "images":      images or [],
            "status":      status,
        })
        .execute()
    )
    data = response.data
    return data[0] if data else None


async def get_vendor_listings(vendor_id: str, status: str = None) -> list:
    query = (
        supabase.table("vendor_listings")
        .select("*")
        .eq("vendor_id", vendor_id)
        .order("created_at", desc=True)
    )
    if status:
        query = query.eq("status", status)
    response = query.execute()
    return response.data or []


async def update_listing_status(listing_id: str, status: str) -> bool:
    response = (
        supabase.table("vendor_listings")
        .update({"status": status})
        .eq("id", listing_id)
        .execute()
    )
    return bool(response.data)


async def increment_listing_views(listing_id: str):
    # Use RPC or raw update; simple approach:
    supabase.rpc("increment_listing_views", {"listing_id": listing_id}).execute()


# ── Profile views ─────────────────────────────────────────────────────────────

async def record_profile_view(profile_id: str, viewer_id: str = None):
    supabase.table("profile_views").insert({
        "profile_id": profile_id,
        "viewer_id":  viewer_id,
    }).execute()


async def get_profile_view_count(profile_id: str) -> int:
    response = (
        supabase.table("profile_views")
        .select("id")
        .eq("profile_id", profile_id)
        .execute()
    )
    return len(response.data or [])


async def get_profile_views_last_7_days(profile_id: str) -> list:
    """Returns daily view counts for the last 7 days."""
    from datetime import datetime, timedelta
    cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat()
    response = (
        supabase.table("profile_views")
        .select("created_at")
        .eq("profile_id", profile_id)
        .gte("created_at", cutoff)
        .execute()
    )
    # Group by day
    from collections import defaultdict
    counts = defaultdict(int)
    for row in (response.data or []):
        day = row["created_at"][:10]
        counts[day] += 1
    # Fill last 7 days
    result = []
    for i in range(6, -1, -1):
        day = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        result.append({"date": day, "views": counts.get(day, 0)})
    return result


# ── Notifications ─────────────────────────────────────────────────────────────

async def create_notification(
    user_id: str,
    type_: str,
    title: str,
    body: str = "",
    data: dict = None,
) -> Optional[dict]:
    response = (
        supabase.table("notifications")
        .insert({
            "user_id": user_id,
            "type":    type_,
            "title":   title,
            "body":    body,
            "data":    data or {},
        })
        .execute()
    )
    d = response.data
    return d[0] if d else None


async def get_notifications(user_id: str, limit: int = 30) -> list:
    response = (
        supabase.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data or []


async def mark_notifications_read(user_id: str):
    supabase.table("notifications").update({"is_read": True}).eq("user_id", user_id).execute()


async def get_unread_notification_count(user_id: str) -> int:
    response = (
        supabase.table("notifications")
        .select("id")
        .eq("user_id", user_id)
        .eq("is_read", False)
        .execute()
    )
    return len(response.data or [])


# ── Vendor analytics ──────────────────────────────────────────────────────────

async def get_vendor_analytics(vendor_id: str) -> dict:
    """Aggregate analytics for a vendor's dashboard."""
    # Profile views
    total_views = await get_profile_view_count(vendor_id)
    views_7d    = await get_profile_views_last_7_days(vendor_id)

    # Follower count
    followers_resp = (
        supabase.table("follows")
        .select("id")
        .eq("following_id", vendor_id)
        .execute()
    )
    follower_count = len(followers_resp.data or [])

    # Completed orders
    orders_resp = (
        supabase.table("orders")
        .select("id")
        .eq("vendor_id", vendor_id)
        .eq("status", "completed")
        .execute()
    )
    completed_orders = len(orders_resp.data or [])

    # Rating
    vendor_resp = (
        supabase.table("vendors")
        .select("rating")
        .eq("owner_id", vendor_id)
        .single()
        .execute()
    )
    rating = float(vendor_resp.data.get("rating", 4.0)) if vendor_resp.data else 4.0

    # Listing impressions
    listings_resp = (
        supabase.table("vendor_listings")
        .select("views")
        .eq("vendor_id", vendor_id)
        .execute()
    )
    total_impressions = sum(r.get("views", 0) for r in (listings_resp.data or []))

    # Community rank score
    rank_score = int(rating * 20) + (follower_count * 2) + (completed_orders * 5)

    return {
        "total_profile_views": total_views,
        "views_7d":            views_7d,
        "follower_count":      follower_count,
        "completed_orders":    completed_orders,
        "rating":              rating,
        "total_impressions":   total_impressions,
        "rank_score":          rank_score,
    }
