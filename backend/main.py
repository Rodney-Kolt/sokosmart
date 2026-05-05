"""
Sokoni Chat - FastAPI Backend
Connects consumers with nearby vendors via AI-powered chat.
"""

import os
import json
import re
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
    update_vendor_status,
    create_order,
    get_order,
    update_order_status,
    get_vendor_orders,
    create_review,
    get_unread_count_for_consumer,
    get_unread_count_for_vendor,
)

load_dotenv()

app = FastAPI(title="Sokoni Chat API", version="2.0.0")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Location map ──────────────────────────────────────────────────────────────
LOCATION_MAP = {
    "wandegeya":   (0.3394, 32.5706),
    "nakawa":      (0.3390, 32.6110),
    "kisasi":      (0.3667, 32.5833),
    "old kampala": (0.3136, 32.5811),
    "kalerwe":     (0.3600, 32.5700),
    "ntinda":      (0.3500, 32.6200),
    "bukoto":      (0.3450, 32.5950),
    "kololo":      (0.3200, 32.5900),
    "makerere":    (0.3350, 32.5680),
    "mulago":      (0.3380, 32.5760),
    "bwaise":      (0.3550, 32.5650),
    "kawempe":     (0.3700, 32.5600),
    "nansana":     (0.3800, 32.5300),
    "kireka":      (0.3300, 32.6400),
    "luzira":      (0.2900, 32.6300),
    "muyenga":     (0.2900, 32.6000),
    "bugolobi":    (0.3100, 32.6100),
    "naguru":      (0.3300, 32.6000),
    "kampala":     (0.3136, 32.5811),
}
DEFAULT_LAT, DEFAULT_LNG = 0.3136, 32.5811


def resolve_location(location_str: str, user_lat, user_lng):
    if location_str:
        key = location_str.strip().lower()
        for place, coords in LOCATION_MAP.items():
            if place in key:
                return coords
    if user_lat is not None and user_lng is not None:
        return (user_lat, user_lng)
    return (DEFAULT_LAT, DEFAULT_LNG)


# ── Pydantic models ───────────────────────────────────────────────────────────

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


class VendorStatusUpdate(BaseModel):
    vendor_owner_id: str
    status: str  # "open" | "busy" | "closed"


class OrderStatusUpdate(BaseModel):
    status: str  # "accepted" | "in_progress" | "ready" | "completed"


class ReviewSubmit(BaseModel):
    order_id: str
    vendor_id: str
    consumer_id: str
    rating: int
    review_text: Optional[str] = ""
    voice_review_url: Optional[str] = ""


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "OK", "service": "Sokoni Chat API"}


@app.get("/health")
async def health_check():
    return {"status": "OK", "service": "Sokoni Chat API", "awake": True}


# ── Vendor registration ───────────────────────────────────────────────────────

@app.post("/vendor/register")
async def register_vendor(
    owner_id: str,
    name: str,
    category: str,
    description: str = "",
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
):
    """Insert a new vendor record (bypasses RLS via service role key)."""
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
            "status":      "open",
        }).execute()
        return {"success": True, "vendor": result.data[0] if result.data else {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Feature 1: Vendor status toggle ──────────────────────────────────────────

@app.put("/vendor/status")
async def set_vendor_status(req: VendorStatusUpdate):
    """Vendor updates their open/busy/closed status."""
    if req.status not in ("open", "busy", "closed"):
        raise HTTPException(status_code=400, detail="Invalid status value")
    try:
        ok = await update_vendor_status(req.vendor_owner_id, req.status)
        return {"success": ok}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Chat ──────────────────────────────────────────────────────────────────────

@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        ai_response_text = await get_gemini_response(
            user_message=req.message,
            conversation_history=req.conversation_history or [],
        )

        parsed = None
        clean  = ai_response_text.strip()

        # Strip markdown fences
        if "```" in clean:
            fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", clean, re.DOTALL)
            if fence_match:
                clean = fence_match.group(1)

        # Extract first JSON block
        if not clean.startswith("{"):
            json_match = re.search(r"\{.*\}", clean, re.DOTALL)
            if json_match:
                clean = json_match.group(0)

        try:
            parsed = json.loads(clean)
        except json.JSONDecodeError:
            pass

        # Case 1: search intent
        if parsed and parsed.get("type") == "search_intent":
            category  = parsed.get("category", "")
            location  = parsed.get("location", "")
            only_open = parsed.get("only_open", False)
            reply_text = parsed.get("clarifying_reply", "Let me find that for you…")

            lat, lng = resolve_location(location, req.latitude, req.longitude)
            vendors  = await search_vendors(
                category=category, lat=lat, lng=lng,
                radius_km=5, only_open=only_open
            )

            if vendors:
                return {"type": "vendor_list", "reply": reply_text, "vendors": vendors}
            else:
                return {
                    "type": "text",
                    "reply": (
                        f"{reply_text}\n\nUnfortunately I couldn't find any "
                        f"{category} vendors near {location or 'your area'} right now. "
                        "Try a different area or check back later!"
                    ),
                }

        # Case 2: quick reply
        if parsed and parsed.get("type") == "quick_reply":
            return parsed

        # Case 3: plain text JSON
        if parsed and parsed.get("type") == "text":
            return {"type": "text", "reply": parsed.get("reply", ai_response_text)}

        # Case 4: fallback
        return {"type": "text", "reply": ai_response_text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Feature 2: Service request → creates order ───────────────────────────────

@app.post("/request-service")
async def request_service(req: ServiceRequest):
    """Consumer sends a service request. Creates a message AND an order."""
    try:
        # Save the chat message (existing behaviour)
        msg_id = await save_message(
            consumer_id=req.consumer_id,
            vendor_id=req.vendor_id,
            message=req.message,
            consumer_name=req.consumer_name,
            sender="consumer",
        )
        # Also create a formal order
        order = await create_order(
            consumer_id=req.consumer_id,
            vendor_id=req.vendor_id,
            details=req.message,
            consumer_name=req.consumer_name,
        )
        return {
            "success":    True,
            "message_id": msg_id,
            "order_id":   order["id"] if order else None,
            "order":      order,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/order/{order_id}")
async def get_order_status(order_id: str):
    """Consumer polls for order status updates."""
    try:
        order = await get_order(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return {"order": order}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/order/{order_id}/status")
async def update_order(order_id: str, req: OrderStatusUpdate):
    """Vendor updates the order status."""
    valid = {"accepted", "in_progress", "ready", "completed"}
    if req.status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid}")
    try:
        ok = await update_order_status(order_id, req.status)
        return {"success": ok}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/vendor/{vendor_id}/orders")
async def vendor_orders(vendor_id: str):
    """Vendor fetches all their orders."""
    try:
        orders = await get_vendor_orders(vendor_id)
        return {"orders": orders}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Feature 3: Reviews ────────────────────────────────────────────────────────

@app.post("/order/{order_id}/review")
async def submit_review(order_id: str, req: ReviewSubmit):
    """Consumer submits a star rating + optional review after order completion."""
    try:
        # Verify order is completed
        order = await get_order(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order["status"] != "completed":
            raise HTTPException(status_code=400, detail="Order is not yet completed")

        review = await create_review(
            order_id=order_id,
            vendor_id=req.vendor_id,
            consumer_id=req.consumer_id,
            rating=req.rating,
            review_text=req.review_text or "",
            voice_review_url=req.voice_review_url or "",
        )
        return {"success": True, "review": review}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Feature 4: Unread count ───────────────────────────────────────────────────

@app.get("/unread-count")
async def unread_count(user_id: str, role: str = "consumer"):
    """
    Returns unread message count for a user.
    role: "consumer" | "vendor"
    """
    try:
        if role == "vendor":
            count = await get_unread_count_for_vendor(user_id)
        else:
            count = await get_unread_count_for_consumer(user_id)
        return {"count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Existing endpoints ────────────────────────────────────────────────────────

@app.get("/vendor/{vendor_id}/messages")
async def get_messages(vendor_id: str):
    try:
        messages = await get_vendor_messages(vendor_id)
        return {"messages": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/conversation/{consumer_id}/{vendor_id}")
async def get_thread(consumer_id: str, vendor_id: str):
    try:
        thread = await get_conversation(consumer_id, vendor_id)
        return {"thread": thread}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/vendor/reply")
async def vendor_reply(req: VendorReply):
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
    try:
        profile = await get_vendor_profile(vendor_id)
        return {"profile": profile}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
