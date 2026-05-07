"""
Sokoni Chat - FastAPI Backend
Connects consumers with nearby vendors via AI-powered chat.
"""

import os
import json
import re
import secrets
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import FastAPI, HTTPException, Request, Header
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
    # v3 social features
    follow_vendor,
    unfollow_vendor,
    get_followers,
    get_following,
    is_following,
    create_listing,
    get_vendor_listings,
    update_listing_status,
    record_profile_view,
    get_profile_view_count,
    get_notifications,
    mark_notifications_read,
    get_unread_notification_count,
    get_vendor_analytics,
    create_notification,
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


class FollowRequest(BaseModel):
    follower_id: str
    following_id: str


class ListingCreate(BaseModel):
    vendor_id: str
    title: str
    description: Optional[str] = ""
    price: Optional[float] = None
    category: Optional[str] = ""
    images: Optional[list] = []
    status: Optional[str] = "active"


class ListingStatusUpdate(BaseModel):
    status: str  # active | paused | sold | draft


class GenerateDescriptionRequest(BaseModel):
    title: str
    category: Optional[str] = ""


class OTPRequest(BaseModel):
    email: str


class OTPVerify(BaseModel):
    email: str
    code: str


# ── In-memory OTP store ───────────────────────────────────────────────────────
# { email: { code, expires_at, attempts } }
_otp_store: dict = {}


# ── MessageCentral CPaaS SMS Hook ────────────────────────────────────────────

@app.post("/send-sms-hook")
async def send_sms_hook(
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    """
    Supabase 'Send SMS' hook endpoint.
    Supabase calls this when a phone OTP needs to be delivered.
    We forward the SMS to MessageCentral CPaaS REST API.
    """
    # ── Verify shared secret ──────────────────────────────────────────────
    hook_secret = os.getenv("SMS_HOOK_SECRET", "")
    if hook_secret:
        expected = f"Bearer {hook_secret}"
        if not authorization or authorization != expected:
            raise HTTPException(status_code=401, detail="Unauthorized")

    # ── Parse Supabase payload ────────────────────────────────────────────
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    phone = payload.get("user", {}).get("phone", "")
    otp   = payload.get("sms",  {}).get("otp",   "")

    if not phone or not otp:
        raise HTTPException(status_code=400, detail="Missing phone or otp in payload")

    # ── Send via MessageCentral CPaaS ─────────────────────────────────────
    api_key     = os.getenv("MESSAGECENTRAL_API_KEY", "")
    customer_id = os.getenv("MESSAGECENTRAL_CUSTOMER_ID", "")
    backend_url = os.getenv("RENDER_EXTERNAL_URL", "https://your-backend.onrender.com")

    if not api_key or not customer_id:
        raise HTTPException(
            status_code=500,
            detail="MESSAGECENTRAL_API_KEY and MESSAGECENTRAL_CUSTOMER_ID must be set"
        )

    sms_body = {
        "customerId": customer_id,
        "to":         phone,
        "text":       f"Sokoni Smart: Your verification code is {otp}. Valid for 10 minutes.",
        "dlrUrl":     f"{backend_url}/sms-webhook",
    }

    # Only include "from" if a sender ID is configured — omit for shared shortcode
    sender_id = os.getenv("MESSAGECENTRAL_SENDER_ID", "")
    if sender_id:
        sms_body["from"] = sender_id

    import httpx
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://cpaas.messagecentral.com/rest/v2/send-sms",
                json=sms_body,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key":    api_key,
                },
            )
        if resp.status_code != 200:
            print(f"[SMS Hook] MessageCentral error {resp.status_code}: {resp.text}")
            raise HTTPException(
                status_code=500,
                detail=f"MessageCentral API error {resp.status_code}: {resp.text}"
            )
        print(f"[SMS Hook] Sent to {phone}: {resp.text}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"SMS delivery failed: {str(e)}")

    # Supabase expects an empty 200 response
    return {}

    # Supabase expects an empty 200 response
    return {}


@app.post("/sms-webhook")
async def sms_delivery_webhook(request: Request):
    """
    MessageCentral delivery receipt callback.
    Logs the delivery status — extend this to store in DB if needed.
    """
    try:
        data = await request.json()
        print(f"[SMS Webhook] Delivery receipt: {data}")
    except Exception:
        pass
    return {"received": True}


# ── OTP: Email verification ───────────────────────────────────────────────────

OTP_TTL_SECONDS   = 600   # 10 minutes
OTP_MAX_ATTEMPTS  = 5


def _send_otp_email(to_email: str, code: str):
    """Send OTP via Brevo SMTP relay."""
    smtp_host   = os.getenv("BREVO_SMTP_HOST",   "smtp-relay.brevo.com")
    smtp_port   = int(os.getenv("BREVO_SMTP_PORT", "587"))
    smtp_user   = os.getenv("BREVO_SMTP_USER",   "")
    smtp_pass   = os.getenv("BREVO_SMTP_PASS",   "")
    sender_email = os.getenv("BREVO_SENDER_EMAIL", smtp_user)
    sender_name  = os.getenv("BREVO_SENDER_NAME",  "Sokoni Smart")

    if not smtp_user or not smtp_pass:
        raise RuntimeError("BREVO_SMTP_USER and BREVO_SMTP_PASS must be set in .env")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{code} is your Sokoni verification code"
    msg["From"]    = f"{sender_name} <{sender_email}>"
    msg["To"]      = to_email

    text_body = f"Your Sokoni verification code is: {code}\n\nThis code expires in 10 minutes. Do not share it with anyone."
    html_body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0A0E14;color:#fff;padding:32px;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:40px;">🛍️</span>
        <h2 style="color:#fff;margin:8px 0 4px;font-size:22px;">Sokoni Smart</h2>
        <p style="color:#94a3b8;font-size:13px;margin:0;">Your hyperlocal AI marketplace</p>
      </div>
      <p style="color:#cbd5e1;font-size:15px;margin-bottom:8px;">Your verification code is:</p>
      <div style="background:linear-gradient(135deg,#f97316,#ef4444);border-radius:12px;padding:20px;text-align:center;margin:16px 0;">
        <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#fff;">{code}</span>
      </div>
      <p style="color:#64748b;font-size:13px;text-align:center;">Expires in 10 minutes &nbsp;·&nbsp; Do not share this code</p>
    </div>
    """

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(sender_email, to_email, msg.as_string())


@app.post("/otp/send")
async def send_otp(req: OTPRequest):
    """Generate a 6-digit OTP and email it to the user."""
    email = req.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    # Rate-limit: if a valid OTP already exists and was issued < 60s ago, reject
    existing = _otp_store.get(email)
    if existing and existing["expires_at"] - OTP_TTL_SECONDS + 60 > time.time():
        raise HTTPException(status_code=429, detail="Please wait before requesting a new code.")

    code = str(secrets.randbelow(900000) + 100000)  # 100000–999999
    _otp_store[email] = {
        "code":       code,
        "expires_at": time.time() + OTP_TTL_SECONDS,
        "attempts":   0,
    }

    try:
        _send_otp_email(email, code)
    except Exception as e:
        # Clean up so user can retry
        _otp_store.pop(email, None)
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

    return {"success": True, "message": "Verification code sent"}


@app.post("/otp/verify")
async def verify_otp(req: OTPVerify):
    """Verify a 6-digit OTP. Returns success or error."""
    email = req.email.strip().lower()
    code  = req.code.strip()

    record = _otp_store.get(email)
    if not record:
        raise HTTPException(status_code=400, detail="No code found. Please request a new one.")

    if time.time() > record["expires_at"]:
        _otp_store.pop(email, None)
        raise HTTPException(status_code=400, detail="Code expired. Please request a new one.")

    record["attempts"] += 1
    if record["attempts"] > OTP_MAX_ATTEMPTS:
        _otp_store.pop(email, None)
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new code.")

    if record["code"] != code:
        remaining = OTP_MAX_ATTEMPTS - record["attempts"]
        raise HTTPException(
            status_code=400,
            detail=f"Invalid code. {remaining} attempt{'s' if remaining != 1 else ''} remaining."
        )

    # ✅ Correct — invalidate and return success
    _otp_store.pop(email, None)
    return {"success": True, "message": "Email verified successfully"}


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
        err_str = str(e)
        # Gemini quota exceeded — return friendly message instead of 500
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
            return {
                "type": "text",
                "reply": "⏳ The AI assistant has reached its daily limit. It resets every 24 hours. Please try again tomorrow, or browse vendors directly in the Market tab!"
            }
        raise HTTPException(status_code=500, detail=err_str)


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


# ── Feature: Follow / Unfollow ────────────────────────────────────────────────

@app.post("/follow")
async def follow(req: FollowRequest):
    try:
        ok = await follow_vendor(req.follower_id, req.following_id)
        if ok:
            await create_notification(
                user_id=req.following_id,
                type_="follow",
                title="New follower",
                body="Someone started following you on Sokoni!",
                data={"follower_id": req.follower_id},
            )
        return {"success": ok}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/unfollow")
async def unfollow(req: FollowRequest):
    try:
        ok = await unfollow_vendor(req.follower_id, req.following_id)
        return {"success": ok}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/followers/{user_id}")
async def get_user_followers(user_id: str):
    try:
        data = await get_followers(user_id)
        return {"followers": data, "count": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/following/{user_id}")
async def get_user_following(user_id: str):
    try:
        data = await get_following(user_id)
        return {"following": data, "count": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/is-following")
async def check_following(follower_id: str, following_id: str):
    try:
        result = await is_following(follower_id, following_id)
        return {"is_following": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Feature: Listings ─────────────────────────────────────────────────────────

@app.post("/listing")
async def create_vendor_listing(req: ListingCreate):
    try:
        listing = await create_listing(
            vendor_id=req.vendor_id,
            title=req.title,
            description=req.description or "",
            price=req.price,
            category=req.category or "",
            images=req.images or [],
            status=req.status or "active",
        )
        # Notify followers of new listing
        if listing and req.status == "active":
            followers = await get_followers(req.vendor_id)
            for f in followers:
                await create_notification(
                    user_id=f["follower_id"],
                    type_="new_listing",
                    title=f"New listing: {req.title}",
                    body=f"A vendor you follow just posted a new item.",
                    data={"listing_id": listing["id"], "vendor_id": req.vendor_id},
                )
        return {"success": True, "listing": listing}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/vendor/{vendor_id}/listings")
async def vendor_listings(vendor_id: str, status: Optional[str] = None):
    try:
        listings = await get_vendor_listings(vendor_id, status)
        return {"listings": listings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/listing/{listing_id}/status")
async def update_listing(listing_id: str, req: ListingStatusUpdate):
    valid = {"active", "paused", "sold", "draft"}
    if req.status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid}")
    try:
        ok = await update_listing_status(listing_id, req.status)
        return {"success": ok}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-listing-description")
async def generate_description(req: GenerateDescriptionRequest):
    """Use Gemini to generate a compelling listing description."""
    try:
        prompt = (
            f"Write a short, compelling product/service listing description (2-3 sentences) "
            f"for a hyperlocal marketplace in Uganda. "
            f"Title: '{req.title}'. Category: '{req.category}'. "
            f"Be friendly, specific, and mention quality. Do not use emojis. "
            f"Return only the description text, nothing else."
        )
        from gemini_utils import _client, types
        response = await _client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=[types.Content(role="user", parts=[types.Part(text=prompt)])],
        )
        return {"description": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Feature: Profile views ────────────────────────────────────────────────────

@app.post("/profile/{profile_id}/view")
async def track_profile_view(profile_id: str, viewer_id: Optional[str] = None):
    """Record a profile view. Skips if viewer == profile owner."""
    try:
        if viewer_id and viewer_id == profile_id:
            return {"recorded": False}
        await record_profile_view(profile_id, viewer_id)
        await create_notification(
            user_id=profile_id,
            type_="profile_view",
            title="Someone viewed your profile",
            body="Your profile is getting attention!",
            data={"viewer_id": viewer_id},
        )
        return {"recorded": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Feature: Notifications ────────────────────────────────────────────────────

@app.get("/notifications/{user_id}")
async def get_user_notifications(user_id: str):
    try:
        notifs = await get_notifications(user_id)
        unread = sum(1 for n in notifs if not n.get("is_read"))
        return {"notifications": notifs, "unread_count": unread}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/notifications/{user_id}/read")
async def mark_read(user_id: str):
    try:
        await mark_notifications_read(user_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/notifications/{user_id}/count")
async def notification_count(user_id: str):
    try:
        count = await get_unread_notification_count(user_id)
        return {"count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Feature: Vendor analytics & rank ─────────────────────────────────────────

@app.get("/vendor/analytics")
async def vendor_analytics(vendor_id: str):
    try:
        data = await get_vendor_analytics(vendor_id)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/vendor/rank")
async def vendor_rank(vendor_id: str):
    """Calculate community rank for a vendor."""
    try:
        analytics = await get_vendor_analytics(vendor_id)
        score = analytics["rank_score"]

        # Determine rank label
        if score >= 200:
            label = "🏆 Top Vendor"
        elif score >= 100:
            label = "⭐ Rising Star"
        elif score >= 50:
            label = "🌱 Growing Business"
        else:
            label = "🆕 New on Sokoni"

        return {
            "score":      score,
            "label":      label,
            "breakdown": {
                "rating_pts":   int(analytics["rating"] * 20),
                "follower_pts": analytics["follower_count"] * 2,
                "order_pts":    analytics["completed_orders"] * 5,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
