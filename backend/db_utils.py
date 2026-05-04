"""
Supabase database utilities for Sokoni Chat.
Handles vendor search, messaging, and profile queries.
"""

import os
import math
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")  # Use service key on backend

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate the great-circle distance between two points in kilometres."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def search_vendors(
    category: str,
    lat: float,
    lng: float,
    radius_km: float = 5.0,
    limit: int = 6,
) -> list:
    """
    Search vendors by category near a given location.
    Returns a list of vendor dicts formatted for the frontend.
    """
    # Fetch vendors matching the category (case-insensitive partial match)
    response = (
        supabase.table("vendors")
        .select("*")
        .ilike("category", f"%{category}%")
        .eq("is_active", True)
        .execute()
    )

    vendors = response.data or []

    # Filter by radius and compute distance
    nearby = []
    for v in vendors:
        v_lat = v.get("latitude")
        v_lng = v.get("longitude")
        if v_lat is None or v_lng is None:
            continue
        dist = haversine_km(lat, lng, float(v_lat), float(v_lng))
        if dist <= radius_km:
            nearby.append({**v, "_distance_km": dist})

    # Sort by distance, then rating
    nearby.sort(key=lambda x: (x["_distance_km"], -float(x.get("rating", 0))))

    # Format for frontend
    result = []
    for v in nearby[:limit]:
        dist_km = v["_distance_km"]
        dist_str = f"{dist_km:.1f} km" if dist_km >= 1 else f"{int(dist_km * 1000)} m"
        result.append({
            "id":           v.get("id"),
            "vname":        v.get("name", "Unknown"),
            "vcategory":    v.get("category", ""),
            "vdescription": v.get("description", ""),
            "vdistance":    dist_str,
            "vrating":      str(v.get("rating", "4.0")),
            "vrequest":     "Request Service",
            "owner_id":     v.get("owner_id"),
        })

    return result


async def save_message(
    consumer_id: str,
    vendor_id: str,
    message: str,
    consumer_name: str = "Guest",
    sender: str = "consumer",
) -> Optional[str]:
    """Save a consumer → vendor service request message."""
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
    """Fetch all unread/recent service requests for a vendor."""
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
    """Fetch the full message thread between a consumer and vendor."""
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
    """Save a vendor → consumer reply."""
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
    """Fetch a vendor's profile from the vendors table by owner_id."""
    response = (
        supabase.table("vendors")
        .select("*")
        .eq("owner_id", vendor_id)
        .single()
        .execute()
    )
    return response.data
