"""
test_brevo_api.py
─────────────────
Tests Brevo Transactional Email API (no SMTP, no IP restrictions).

Run:
    venv\\Scripts\\python.exe test_brevo_smtp.py   (Windows)
    venv/bin/python test_brevo_smtp.py             (Mac/Linux)
"""

import os
import traceback

try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Loaded .env file")
except ImportError:
    print("ℹ️  python-dotenv not available — using hardcoded values below")

try:
    import httpx
except ImportError:
    print("❌ httpx not installed. Run: pip install httpx")
    exit(1)

# ── Credentials ───────────────────────────────────────────────────────────────
API_KEY      = os.getenv("BREVO_API_KEY",      "REPLACE_WITH_YOUR_API_KEY")
SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "rodynaine@gmail.com")
SENDER_NAME  = os.getenv("BREVO_SENDER_NAME",  "Sokoni Smart")
TO_EMAIL     = "rodynaine@gmail.com"

print("\n" + "="*60)
print("BREVO API DIAGNOSTIC")
print("="*60)
print(f"  API Key    : {'*' * 10 + API_KEY[-6:] if len(API_KEY) > 10 else '⚠️  NOT SET'}")
print(f"  From       : {SENDER_NAME} <{SENDER_EMAIL}>")
print(f"  To         : {TO_EMAIL}")
print("="*60 + "\n")

if API_KEY == "REPLACE_WITH_YOUR_API_KEY":
    print("❌ BREVO_API_KEY not set. Add it to your .env file.")
    exit(1)

# ── Send test email ───────────────────────────────────────────────────────────
payload = {
    "sender":      {"name": SENDER_NAME, "email": SENDER_EMAIL},
    "to":          [{"email": TO_EMAIL}],
    "subject":     "✅ Sokoni Smart – Brevo API Test",
    "htmlContent": """
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0A0E14;
                color:#fff;padding:32px;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:40px;">🛍️</span>
        <h2 style="color:#fff;margin:8px 0 4px;">Sokoni Smart</h2>
        <p style="color:#94a3b8;font-size:13px;margin:0;">API Test Email</p>
      </div>
      <div style="background:linear-gradient(135deg,#f97316,#ef4444);border-radius:12px;
                  padding:20px;text-align:center;margin:16px 0;">
        <span style="font-size:24px;font-weight:900;color:#fff;">✅ API Working!</span>
      </div>
      <p style="color:#64748b;font-size:13px;text-align:center;">
        Brevo API is correctly configured for Sokoni Smart.
      </p>
    </div>
    """,
    "textContent": "Brevo API test from Sokoni Smart. If you received this, it's working!",
}

exit_code = 0
try:
    print("STEP 1 — Calling Brevo API…")
    resp = httpx.post(
        "https://api.brevo.com/v3/smtp/email",
        json=payload,
        headers={
            "accept":       "application/json",
            "content-type": "application/json",
            "api-key":      API_KEY,
        },
        timeout=15.0,
    )
    print(f"  Status: {resp.status_code}")
    print(f"  Body  : {resp.text}\n")

    if resp.status_code in (200, 201):
        print(f"✅ Email sent successfully to {TO_EMAIL}")
    elif resp.status_code == 401:
        exit_code = 1
        print("❌ 401 Unauthorized — API key is invalid or missing.")
        print("   Go to Brevo → SMTP & API → API Keys and create/copy a key.")
    elif resp.status_code == 400:
        exit_code = 1
        print("❌ 400 Bad Request — check the sender email is verified in Brevo.")
        print("   Go to Brevo → Senders & IPs → Senders → verify the address.")
    else:
        exit_code = 1
        print(f"❌ Unexpected status {resp.status_code}")

except httpx.TimeoutException:
    exit_code = 1
    print("❌ Request timed out — check your internet connection.")
except Exception as e:
    exit_code = 1
    print(f"❌ Unexpected error: {type(e).__name__}: {e}")
    traceback.print_exc()

print("\n" + "="*60)
if exit_code == 0:
    print(f"✅ ALL GOOD — check {TO_EMAIL} inbox (and spam folder).")
else:
    print("❌ TEST FAILED — see diagnosis above.")
print("="*60 + "\n")
exit(exit_code)
