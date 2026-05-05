"""
Sokoni Chat - FastAPI Backend
Connects consumers with nearby vendors via AI-powered chat.
"""

import os
import json
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

from gemini_utils import get_gemini_response
from db_utils import (
    search_vendors,
    save_message,
    get_vendor_messages,
    get_conversation,
    save_vendor_reply,
    get_vendor_profile,
)

load_dotenv()

app = FastAPI(title="Sokoni Chat API", version="1.0.0")

# ---------------------------------------------------------------------------
# CORS – allow the Vercel frontend (and localhost for dev)
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,https://*.vercel.app",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Location dictionary – maps common Kampala area names → (lat, lng)
# ---------------------------------------------------------------------------
LOCATION_MAP = {
    "wandegeya":   (0.3394,  32.5706),
    "nakawa":      (0.3390,  32.6110),
    "kisasi":      (0.3667,  32.5833),
    "old kampala": (0.3136,  32.5811),
    "kalerwe":     (0.3600,  32.5700),
    "ntinda":      (0.3500,  32.6200),
    "bukoto":      (0.3450,  32.5950),
    "kololo":      (0.3200,  32.5900),
    "makerere":    (0.3350,  32.5680),
    "mulago":      (0.3380,  32.5760),
    "bwaise":      (0.3550,  32.5650),
    "kawempe":     (0.3700,  32.5600),
    "nansana":     (0.3800,  32.5300),
    "kireka":      (0.3300,  32.6400),
    "luzira":      (0.2900,  32.6300),
    "muyenga":     (0.2900,  32.6000),
    "bugolobi":    (0.3100,  32.6100),
    "naguru":      (0.3300,  32.6000),
    "kampala":     (0.3136,  32.5811),
}

DEFAULT_LAT = 0.3136
DEFAULT_LNG = 32.5811


def resolve_location(location_str: str, user_lat: Optional[float], user_lng: Optional[float]):
    """Return (lat, lng) from a location string or fall back to user coords."""
    if location_str:
        key = location_str.strip().lower()
        for place, coords in LOCATION_MAP.items():
            if place in key:
                return coords
    if user_lat is not None and user_lng is not None:
        return (user_lat, user_lng)
    return (DEFAULT_LAT, DEFAULT_LNG)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    user_id: str
    message: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    conversation_history: Optional[list] = []


class ServiceRequest(BaseModel):
    consumer_id: str
    vendor_id: str
    message: str
    consumer_name: Optional[str] = "Guest"


class VendorReply(BaseModel):
    vendor_id: str
    consumer_id: str
    message: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/vendor/register")
async def register_vendor(
    owner_id: str,
    name: str,
    category: str,
    description: str = "",
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
):
    """
    Insert a new vendor record using the service role key (bypasses RLS).
    Called by the frontend after Supabase Auth signup.
    """
    try:
        from db_utils import supabase as sb
        result = sb.table("vendors").insert({
            "owner_id":    owner_id,
            "name":        name,
            "category":    category,
            "description": description,
            "latitude":    latitude,
            "longitude":   longitude,
            "rating":      4.0,
            "is_active":   True,
        }).execute()
        return {"success": True, "vendor": result.data[0] if result.data else {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    return {"status": "OK", "service": "Sokoni Chat API"}


@app.get("/health")
async def health_check():
    """
    Health check endpoint – pinged by UptimeRobot every minute to keep Render awake.
    """
    return {"status": "OK", "service": "Sokoni Chat API", "awake": True}


@app.post("/chat")
async def chat(req: ChatRequest):
    """
    Main chat endpoint.
    1. Sends user message + history to Gemini.
    2. Parses Gemini's response.
    3. If Gemini returns a search_intent, queries Supabase for nearby vendors.
    4. Returns either a text reply, quick-reply buttons, or a vendor list.
    """
    try:
        ai_response_text = await get_gemini_response(
            user_message=req.message,
            conversation_history=req.conversation_history or [],
        )

        # Try to parse as JSON (search_intent or quick_reply)
        # Gemini sometimes wraps JSON in markdown fences or adds text before/after it
        parsed = None
        clean = ai_response_text.strip()

        # 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
        if "```" in clean:
            import re
            fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", clean, re.DOTALL)
            if fence_match:
                clean = fence_match.group(1)

        # 2. Extract the first {...} JSON block from anywhere in the response
        if not clean.startswith("{"):
            import re
            json_match = re.search(r"\{.*\}", clean, re.DOTALL)
            if json_match:
                clean = json_match.group(0)

        try:
            parsed = json.loads(clean)
        except json.JSONDecodeError:
            pass

        # ── Case 1: AI wants to search for vendors ──────────────────────────
        if parsed and parsed.get("type") == "search_intent":
            category   = parsed.get("category", "")
            location   = parsed.get("location", "")
            reply_text = parsed.get("clarifying_reply", "Let me find that for you…")

            lat, lng = resolve_location(location, req.latitude, req.longitude)
            vendors = await search_vendors(category=category, lat=lat, lng=lng, radius_km=5)

            if vendors:
                return {
                    "type": "vendor_list",
                    "reply": reply_text,
                    "vendors": vendors,
                }
            else:
                return {
                    "type": "text",
                    "reply": (
                        f"{reply_text}\n\nUnfortunately I couldn't find any "
                        f"{category} vendors near {location or 'your area'} right now. "
                        "Try a different area or check back later!"
                    ),
                }

        # ── Case 2: AI returns quick-reply buttons ───────────────────────────
        if parsed and parsed.get("type") == "quick_reply":
            return parsed

        # ── Case 3: Plain text reply ─────────────────────────────────────────
        return {"type": "text", "reply": ai_response_text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/request-service")
async def request_service(req: ServiceRequest):
    """Consumer sends a service request message to a vendor."""
    try:
        msg_id = await save_message(
            consumer_id=req.consumer_id,
            vendor_id=req.vendor_id,
            message=req.message,
            consumer_name=req.consumer_name,
            sender="consumer",
        )
        return {"success": True, "message_id": msg_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/vendor/{vendor_id}/messages")
async def get_messages(vendor_id: str):
    """Vendor fetches all incoming service requests."""
    try:
        messages = await get_vendor_messages(vendor_id)
        return {"messages": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/conversation/{consumer_id}/{vendor_id}")
async def get_thread(consumer_id: str, vendor_id: str):
    """Fetch the full conversation thread between a consumer and vendor."""
    try:
        thread = await get_conversation(consumer_id, vendor_id)
        return {"thread": thread}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/vendor/reply")
async def vendor_reply(req: VendorReply):
    """Vendor sends a reply to a consumer."""
    try:
        msg_id = await save_vendor_reply(
            vendor_id=req.vendor_id,
            consumer_id=req.consumer_id,
            message=req.message,
        )
        return {"success": True, "message_id": msg_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/vendor/{vendor_id}/profile")
async def vendor_profile(vendor_id: str):
    """Fetch vendor profile details."""
    try:
        profile = await get_vendor_profile(vendor_id)
        return {"profile": profile}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
