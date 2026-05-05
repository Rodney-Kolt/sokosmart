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
