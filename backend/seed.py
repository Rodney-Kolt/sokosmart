"""
Seed script – populates the Supabase `vendors` table with 20+ demo vendors
across various categories and Kampala neighbourhoods.

Usage:
    python seed.py

Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
"""

import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_SERVICE_KEY", ""),
)

# ---------------------------------------------------------------------------
# Demo vendor data
# ---------------------------------------------------------------------------
VENDORS = [
    # ── Fresh Food ──────────────────────────────────────────────────────────
    {
        "name": "Mama Nakato's Fresh Produce",
        "category": "fresh food",
        "description": "Fresh vegetables, fruits, and matooke delivered daily from the garden.",
        "latitude": 0.3394, "longitude": 32.5706,   # Wandegeya
        "rating": 4.7, "is_active": True,
    },
    {
        "name": "Kalerwe Market Greens",
        "category": "fresh food",
        "description": "Wholesale and retail fresh produce. Best prices in Kalerwe.",
        "latitude": 0.3600, "longitude": 32.5700,   # Kalerwe
        "rating": 4.3, "is_active": True,
    },
    # ── Bakery ──────────────────────────────────────────────────────────────
    {
        "name": "Golden Crust Bakery",
        "category": "bakery",
        "description": "Freshly baked bread, cakes, and mandazi every morning.",
        "latitude": 0.3390, "longitude": 32.6110,   # Nakawa
        "rating": 4.8, "is_active": True,
    },
    {
        "name": "Ntinda Sweet Bakes",
        "category": "bakery",
        "description": "Custom cakes for weddings, birthdays, and corporate events.",
        "latitude": 0.3500, "longitude": 32.6200,   # Ntinda
        "rating": 4.6, "is_active": True,
    },
    # ── Tailoring ───────────────────────────────────────────────────────────
    {
        "name": "Stylish Stitches",
        "category": "tailoring",
        "description": "Expert in African print dresses, suits, and school uniforms.",
        "latitude": 0.3394, "longitude": 32.5710,   # Wandegeya
        "rating": 4.5, "is_active": True,
    },
    {
        "name": "Nakawa Fashion Hub",
        "category": "tailoring",
        "description": "Men's and women's tailoring. Quick turnaround, fair prices.",
        "latitude": 0.3395, "longitude": 32.6115,   # Nakawa
        "rating": 4.2, "is_active": True,
    },
    {
        "name": "Kisasi Couture",
        "category": "tailoring",
        "description": "Bridal wear, gomesi, and kanzus. 10+ years experience.",
        "latitude": 0.3667, "longitude": 32.5833,   # Kisasi
        "rating": 4.9, "is_active": True,
    },
    # ── Phone & Electronics Repair ──────────────────────────────────────────
    {
        "name": "TechFix Wandegeya",
        "category": "phone repair",
        "description": "Smartphone screen replacements, battery swaps, software fixes.",
        "latitude": 0.3390, "longitude": 32.5700,   # Wandegeya
        "rating": 4.4, "is_active": True,
    },
    {
        "name": "Nakawa Electronics Clinic",
        "category": "electronics repair",
        "description": "Laptops, TVs, fridges, and all home electronics repaired.",
        "latitude": 0.3385, "longitude": 32.6108,   # Nakawa
        "rating": 4.1, "is_active": True,
    },
    {
        "name": "Gadget Doctor Ntinda",
        "category": "phone repair",
        "description": "All brands of phones repaired. Genuine spare parts available.",
        "latitude": 0.3505, "longitude": 32.6195,   # Ntinda
        "rating": 4.6, "is_active": True,
    },
    # ── Plumbing / Handyman ─────────────────────────────────────────────────
    {
        "name": "Quick Fix Plumbing",
        "category": "plumbing",
        "description": "Pipe repairs, installations, and emergency plumbing 24/7.",
        "latitude": 0.3136, "longitude": 32.5811,   # Old Kampala
        "rating": 4.3, "is_active": True,
    },
    {
        "name": "Bwaise Handyman Services",
        "category": "handyman",
        "description": "Painting, tiling, carpentry, and general home repairs.",
        "latitude": 0.3550, "longitude": 32.5650,   # Bwaise
        "rating": 4.0, "is_active": True,
    },
    {
        "name": "Kololo Home Solutions",
        "category": "plumbing",
        "description": "Professional plumbing and electrical work for homes and offices.",
        "latitude": 0.3200, "longitude": 32.5900,   # Kololo
        "rating": 4.7, "is_active": True,
    },
    # ── Salon & Beauty ──────────────────────────────────────────────────────
    {
        "name": "Glam Queens Salon",
        "category": "salon",
        "description": "Hair braiding, weaves, nails, and facials. Walk-ins welcome.",
        "latitude": 0.3450, "longitude": 32.5950,   # Bukoto
        "rating": 4.5, "is_active": True,
    },
    {
        "name": "Kisasi Beauty Lounge",
        "category": "beauty",
        "description": "Lashes, brows, makeup, and skincare treatments.",
        "latitude": 0.3670, "longitude": 32.5830,   # Kisasi
        "rating": 4.8, "is_active": True,
    },
    # ── Cleaning Services ───────────────────────────────────────────────────
    {
        "name": "Sparkle Clean Kampala",
        "category": "cleaning",
        "description": "Home and office deep cleaning. Eco-friendly products used.",
        "latitude": 0.3300, "longitude": 32.6000,   # Naguru
        "rating": 4.4, "is_active": True,
    },
    {
        "name": "Nakawa Laundry Express",
        "category": "laundry",
        "description": "Same-day laundry and dry cleaning. Free pick-up within 2 km.",
        "latitude": 0.3392, "longitude": 32.6112,   # Nakawa
        "rating": 4.2, "is_active": True,
    },
    # ── Grocery / Hardware ──────────────────────────────────────────────────
    {
        "name": "Makerere Mini Mart",
        "category": "grocery",
        "description": "Everyday groceries, snacks, and household items. Open 7am–10pm.",
        "latitude": 0.3350, "longitude": 32.5680,   # Makerere
        "rating": 4.1, "is_active": True,
    },
    {
        "name": "Kawempe Hardware Store",
        "category": "hardware",
        "description": "Building materials, tools, and electrical supplies.",
        "latitude": 0.3700, "longitude": 32.5600,   # Kawempe
        "rating": 4.0, "is_active": True,
    },
    # ── Catering / Photography ──────────────────────────────────────────────
    {
        "name": "Taste of Uganda Catering",
        "category": "catering",
        "description": "Traditional and modern Ugandan cuisine for events of all sizes.",
        "latitude": 0.3136, "longitude": 32.5815,   # Old Kampala
        "rating": 4.9, "is_active": True,
    },
    {
        "name": "Lens & Light Photography",
        "category": "photography",
        "description": "Wedding, event, and portrait photography. Drone shots available.",
        "latitude": 0.3100, "longitude": 32.6100,   # Bugolobi
        "rating": 4.7, "is_active": True,
    },
    # ── Tutoring / Transport ────────────────────────────────────────────────
    {
        "name": "Bright Minds Tutoring",
        "category": "tutoring",
        "description": "Primary and secondary school tutoring. All subjects covered.",
        "latitude": 0.3380, "longitude": 32.5760,   # Mulago
        "rating": 4.6, "is_active": True,
    },
    {
        "name": "Kampala Boda Express",
        "category": "transport",
        "description": "Fast and reliable boda-boda delivery and passenger transport.",
        "latitude": 0.3136, "longitude": 32.5800,   # Old Kampala
        "rating": 4.3, "is_active": True,
    },
]


def seed():
    print("🌱 Seeding vendors table…")
    # Clear existing demo data (optional – comment out to keep existing records)
    supabase.table("vendors").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    inserted = 0
    for vendor in VENDORS:
        try:
            supabase.table("vendors").insert(vendor).execute()
            inserted += 1
            print(f"  ✅ {vendor['name']}")
        except Exception as e:
            print(f"  ❌ {vendor['name']}: {e}")

    print(f"\n✨ Done! Inserted {inserted}/{len(VENDORS)} vendors.")


if __name__ == "__main__":
    seed()
