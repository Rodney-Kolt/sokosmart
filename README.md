# 🛍️ Sokoni Chat

**A hyperlocal, AI-powered marketplace connecting consumers with nearby vendors via a privacy-first chat interface.**

Built with React + Vite, FastAPI, Supabase, and Google Gemini 2.5 Flash.

---

## ✨ Features

- 🤖 **AI Assistant** – Gemini 2.5 Flash understands natural language requests in any language
- 🗺️ **Hyperlocal Search** – Finds vendors within 5 km using GPS coordinates
- 🔒 **Privacy-First** – No phone numbers or emails ever shown; all contact via in-app messaging
- 🎤 **Voice Input/Output** – Browser Web Speech API (no external API needed)
- 👤 **Guest Mode** – Consumers can search without creating an account
- 📱 **Mobile-First** – WhatsApp-style UI, works great on phones
- 🌍 **Multilingual** – Gemini auto-detects and replies in the user's language

---

## 🏗️ Project Structure

```
sokoni-chat/
├── frontend/          # React + Vite + Tailwind CSS
│   └── src/
│       ├── components/
│       │   ├── Onboarding.jsx      # Role selection & registration
│       │   ├── ChatScreen.jsx      # Consumer AI chat interface
│       │   ├── VendorDashboard.jsx # Vendor messages & replies
│       │   ├── VendorCard.jsx      # Vendor result card
│       │   └── QuickReply.jsx      # Tappable quick-reply buttons
│       └── utils/
│           ├── api.js              # Axios calls to backend
│           ├── supabaseClient.js   # Supabase JS client
│           └── speech.js           # Web Speech API helpers
├── backend/           # Python FastAPI
│   ├── main.py        # API routes
│   ├── gemini_utils.py # Gemini integration
│   ├── db_utils.py    # Supabase queries
│   ├── seed.py        # Demo data seeder
│   └── requirements.txt
└── supabase_schema.sql # Database schema
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- Python 3.11+
- A Supabase project (free)
- A Google AI Studio API key (free)

---

### 1. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Open **SQL Editor** and run the contents of `supabase_schema.sql`
3. Note your **Project URL** and two keys from **Project Settings → API**:
   - `anon` (public) key → used in the frontend
   - `service_role` (secret) key → used in the backend only

---

### 2. Get a Gemini API Key

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **Create API Key** → copy it

---

### 3. Backend Setup

```bash
cd sokoni-chat/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and fill in GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

# Seed demo vendors
python seed.py

# Start the server
uvicorn main:app --reload --port 8000
```

Backend runs at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

---

### 4. Frontend Setup

```bash
cd sokoni-chat/frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and fill in VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# Start dev server
npm run dev
```

Frontend runs at: `http://localhost:3000`

---

## ☁️ Deployment

### Backend → Render (Free Tier)

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your repo, set:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add **Environment Variables**:
   ```
   GEMINI_API_KEY=...
   SUPABASE_URL=...
   SUPABASE_SERVICE_KEY=...
   ALLOWED_ORIGINS=https://your-app.vercel.app
   ```
5. Deploy → note your Render URL (e.g. `https://sokoni-chat.onrender.com`)

> **⚠️ Keep Render Awake**: Render free tier spins down after 15 minutes of inactivity.
> Sign up for [UptimeRobot](https://uptimerobot.com) (free) and add a monitor:
> - Monitor Type: HTTP(s)
> - URL: `https://your-sokoni-backend.onrender.com/health`
> - Interval: every 5 minutes
> This pings the `/health` endpoint and keeps your backend alive.

---

### Frontend → Vercel (Free Tier)

1. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
2. Set **Root Directory** to `frontend`
3. Add **Environment Variables**:
   ```
   VITE_API_URL=https://your-sokoni-backend.onrender.com
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
4. Deploy → share the Vercel URL with judges 🎉

---

## 🔑 Environment Variables Reference

### Backend (`.env`)

| Variable | Description | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `SUPABASE_URL` | Supabase project URL | Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (secret!) | Project Settings → API |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins | Your Vercel URL |
| `BREVO_SMTP_HOST` | Brevo SMTP host | `smtp-relay.brevo.com` |
| `BREVO_SMTP_PORT` | Brevo SMTP port | `587` |
| `BREVO_SMTP_USER` | Brevo login email | Brevo → SMTP & API |
| `BREVO_SMTP_PASS` | Brevo SMTP key | Brevo → SMTP & API |
| `BREVO_SENDER_EMAIL` | Verified sender email | Brevo → Senders |
| `BREVO_SENDER_NAME` | Sender display name | e.g. `Sokoni Smart` |
| `MESSAGECENTRAL_API_KEY` | MessageCentral CPaaS API key | cpaas.messagecentral.com → API Settings |
| `MESSAGECENTRAL_CUSTOMER_ID` | MessageCentral customer ID | cpaas.messagecentral.com → Account |
| `MESSAGECENTRAL_SENDER_ID` | SMS sender name (optional) | e.g. `SOKONI` — omit until approved |
| `SMS_HOOK_SECRET` | Shared secret for Supabase hook | Generate any random string |
| `RENDER_EXTERNAL_URL` | Your Render backend URL | Render dashboard |

### Frontend (`.env`)

| Variable | Description | Where to get it |
|---|---|---|
| `VITE_API_URL` | Backend URL | Your Render URL |
| `VITE_SUPABASE_URL` | Supabase project URL | Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key | Project Settings → API |

---

## 📱 Phone OTP Setup (Africala + Supabase Hook)

Sokoni Smart supports phone number verification for Uganda (+256) via Africala SMS, routed through a Supabase Auth Hook.

### 1. Enable Phone Auth in Supabase

1. Go to **Authentication → Providers → Phone**
2. Toggle **Enable Phone provider** on
3. Set **OTP Expiry** to `600` (10 minutes)
4. Save

### 2. Configure the Send SMS Hook

1. Go to **Authentication → Hooks**
2. Click **Add hook** → choose **Send SMS**
3. Set the endpoint to: `https://your-backend.onrender.com/send-sms-hook`
4. Set the **HTTP Headers**: `Authorization: Bearer your_SMS_HOOK_SECRET`
5. Save

### 3. Add Redirect URL

1. Go to **Authentication → URL Configuration**
2. Add `https://sokosmart-two.vercel.app/**` to **Redirect URLs**

### 4. Add Environment Variables to Render

Add these in your Render service → **Environment**:

| Key | Value |
|---|---|
| `MESSAGECENTRAL_API_KEY` | Your MessageCentral CPaaS API key |
| `MESSAGECENTRAL_CUSTOMER_ID` | Your MessageCentral customer ID |
| `MESSAGECENTRAL_SENDER_ID` | `SOKONI` (optional — omit until alphanumeric sender approved) |
| `SMS_HOOK_SECRET` | Same secret you set in Supabase hook |
| `RENDER_EXTERNAL_URL` | `https://your-backend.onrender.com` |

---

## 🧪 Demo Flow

1. Open the app → tap **"I'm looking for something"**
2. Enter a name or tap **"Continue as Guest"**
3. Type: *"I need a tailor near Wandegeya"*
4. Sokoni AI responds and shows vendor cards
5. Tap **"Request Service"** on a vendor → send a message
6. Open a new tab → go to `/` → tap **"I sell a product/service"** → **Sign In** with a demo vendor account
7. See the incoming request in the Vendor Dashboard → reply

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18 + Vite | Fast, modern, great DX |
| Styling | Tailwind CSS | Mobile-first utility classes |
| Routing | React Router v6 | SPA navigation |
| Backend | Python FastAPI | Async, fast, auto-docs |
| AI | Google Gemini 2.5 Flash | Multilingual, free tier |
| Database | Supabase (PostgreSQL) | Auth + DB + free tier |
| Voice | Web Speech API | Zero cost, built into browser |
| Frontend hosting | Vercel | Free, instant deploys |
| Backend hosting | Render | Free tier Python support |

---

## 📝 Notes

- Voice input works best in **Chrome** (Web Speech API support varies by browser)
- The Gemini free tier has rate limits; for production, consider caching common queries
- Guest consumer IDs are stored in `localStorage` – clearing browser data resets the guest session
- The seed script deletes all existing vendors before inserting demo data; comment out the delete line to preserve existing records
