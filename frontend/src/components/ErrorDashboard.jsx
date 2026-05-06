/**
 * ErrorDashboard.jsx – Live diagnostic page at /error
 * Tests all critical app systems and shows pass/fail with fix instructions.
 * Access at: https://sokosmart-two.vercel.app/error
 */

import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabaseClient";

const API_URL = import.meta.env.VITE_API_URL || "";

// ── Individual check ──────────────────────────────────────────────────────
function Check({ label, status, detail, fix }) {
  const colors = {
    pass:    "text-emerald-400 border-emerald-700/40 bg-emerald-900/20",
    fail:    "text-red-400    border-red-700/40    bg-red-900/20",
    warn:    "text-yellow-400 border-yellow-700/40 bg-yellow-900/20",
    loading: "text-slate-400  border-slate-700/40  bg-slate-900/20",
  };
  const icons = { pass: "✅", fail: "❌", warn: "⚠️", loading: "⏳" };

  return (
    <div className={`rounded-2xl border p-4 ${colors[status]}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-semibold text-sm">{icons[status]} {label}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[status]}`}>
          {status.toUpperCase()}
        </span>
      </div>
      {detail && <p className="text-xs opacity-80 mt-1 leading-relaxed">{detail}</p>}
      {fix && status !== "pass" && (
        <div className="mt-2 bg-black/30 rounded-xl p-3">
          <p className="text-xs font-semibold mb-1">🔧 Fix:</p>
          <p className="text-xs opacity-90 leading-relaxed whitespace-pre-wrap">{fix}</p>
        </div>
      )}
    </div>
  );
}

// ── Run all checks ────────────────────────────────────────────────────────
async function runChecks(setChecks) {
  const update = (id, data) =>
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));

  // 1. Backend health
  try {
    const r = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(10000) });
    const d = await r.json();
    update("backend", {
      status: r.ok ? "pass" : "fail",
      detail: r.ok ? `${d.service} is awake` : `HTTP ${r.status}`,
    });
  } catch (e) {
    update("backend", {
      status: "fail",
      detail: e.message,
      fix: "Check Render dashboard → your service → Logs. Make sure the start command is:\nuvicorn main:app --host 0.0.0.0 --port $PORT",
    });
  }

  // 2. Supabase connection
  try {
    const { error } = await supabase.from("vendors").select("id").limit(1);
    update("supabase", {
      status: error ? "fail" : "pass",
      detail: error ? error.message : "vendors table accessible",
      fix: error ? "Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel env vars." : "",
    });
  } catch (e) {
    update("supabase", { status: "fail", detail: e.message });
  }

  // 3. Supabase auth (email sending)
  try {
    // Try a dummy sign-up to a mailinator address to test SMTP
    const { error } = await supabase.auth.signUp({
      email: `test-diag-${Date.now()}@mailinator.com`,
      password: "TestPass123!",
    });
    if (error) {
      const isSmtp = error.message?.toLowerCase().includes("email") ||
                     error.message?.toLowerCase().includes("smtp") ||
                     error.message?.toLowerCase().includes("sending");
      update("smtp", {
        status: isSmtp ? "fail" : "warn",
        detail: error.message,
        fix: isSmtp
          ? "Supabase SMTP is not configured.\n\nFix options:\n1. Go to Supabase → Project Settings → Auth → SMTP Settings → enable Custom SMTP and enter Brevo credentials.\n\nOR\n\n2. Go to Supabase → Auth → Settings → disable 'Enable email confirmations' for testing."
          : `Auth error (not SMTP): ${error.message}`,
      });
    } else {
      update("smtp", { status: "pass", detail: "Auth signup succeeded (email queued)" });
    }
  } catch (e) {
    update("smtp", { status: "fail", detail: e.message });
  }

  // 4. Gemini AI
  try {
    const r = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "diag", message: "hi", conversation_history: [] }),
      signal: AbortSignal.timeout(30000),
    });
    const d = await r.json();
    if (!r.ok) {
      const isQuota = JSON.stringify(d).includes("quota") || JSON.stringify(d).includes("429");
      update("gemini", {
        status: isQuota ? "warn" : "fail",
        detail: d.detail || JSON.stringify(d).slice(0, 120),
        fix: isQuota
          ? "Gemini free tier quota exceeded (20 req/day for 2.5-flash).\nThe app uses gemini-2.0-flash which has 1500/day. Wait until midnight Pacific or get a new API key at aistudio.google.com."
          : "Check GEMINI_API_KEY in Render environment variables.",
      });
    } else {
      update("gemini", { status: "pass", detail: `Response type: ${d.type}` });
    }
  } catch (e) {
    update("gemini", { status: "fail", detail: e.message });
  }

  // 5. Env vars (frontend)
  const envChecks = [
    { key: "VITE_API_URL",          val: import.meta.env.VITE_API_URL },
    { key: "VITE_SUPABASE_URL",     val: import.meta.env.VITE_SUPABASE_URL },
    { key: "VITE_SUPABASE_ANON_KEY",val: import.meta.env.VITE_SUPABASE_ANON_KEY },
    { key: "VITE_REDIRECT_URL",     val: import.meta.env.VITE_REDIRECT_URL },
  ];
  const missing = envChecks.filter((e) => !e.val).map((e) => e.key);
  update("envvars", {
    status: missing.length === 0 ? "pass" : "fail",
    detail: missing.length === 0
      ? "All 4 frontend env vars present"
      : `Missing: ${missing.join(", ")}`,
    fix: missing.length > 0
      ? `Add these to Vercel → Project Settings → Environment Variables:\n${missing.join("\n")}`
      : "",
  });

  // 6. PWA / Service Worker
  const hasSW = "serviceWorker" in navigator;
  const swReg = hasSW ? await navigator.serviceWorker.getRegistration() : null;
  update("pwa", {
    status: swReg ? "pass" : hasSW ? "warn" : "fail",
    detail: swReg
      ? `SW active: ${swReg.active?.scriptURL?.split("/").pop()}`
      : hasSW ? "Service worker not yet registered" : "Browser doesn't support service workers",
    fix: !swReg ? "Open the app in Chrome and wait a few seconds for the SW to register." : "",
  });

  // 7. assetlinks.json (TWA)
  try {
    const r = await fetch("/.well-known/assetlinks.json");
    const d = await r.json();
    const hasFingerprint = JSON.stringify(d).includes("sha256_cert_fingerprints");
    update("assetlinks", {
      status: hasFingerprint ? "pass" : "warn",
      detail: hasFingerprint ? "assetlinks.json has SHA256 fingerprint" : "File exists but missing fingerprint",
      fix: !hasFingerprint ? "Run: keytool -list -v -keystore android.keystore -alias android\nCopy the SHA256 line into frontend/public/.well-known/assetlinks.json" : "",
    });
  } catch {
    update("assetlinks", {
      status: "warn",
      detail: "assetlinks.json not found (only needed for APK)",
      fix: "This is only required for the Android TWA. Ignore if not building APK.",
    });
  }
}

// ── Main component ────────────────────────────────────────────────────────
export default function ErrorDashboard() {
  const [checks, setChecks] = useState([
    { id: "backend",    label: "Backend (Render)",        status: "loading", detail: "Checking…" },
    { id: "supabase",   label: "Supabase DB",             status: "loading", detail: "Checking…" },
    { id: "smtp",       label: "Email / SMTP (Brevo)",    status: "loading", detail: "Checking…" },
    { id: "gemini",     label: "Gemini AI",               status: "loading", detail: "Checking…" },
    { id: "envvars",    label: "Frontend Env Vars",       status: "loading", detail: "Checking…" },
    { id: "pwa",        label: "PWA / Service Worker",    status: "loading", detail: "Checking…" },
    { id: "assetlinks", label: "Android assetlinks.json", status: "loading", detail: "Checking…" },
  ]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  async function run() {
    setRunning(true);
    setChecks((p) => p.map((c) => ({ ...c, status: "loading", detail: "Checking…", fix: undefined })));
    await runChecks(setChecks);
    setLastRun(new Date().toLocaleTimeString());
    setRunning(false);
  }

  useEffect(() => { run(); }, []);

  const passed  = checks.filter((c) => c.status === "pass").length;
  const failed  = checks.filter((c) => c.status === "fail").length;
  const warned  = checks.filter((c) => c.status === "warn").length;

  return (
    <div className="min-h-screen bg-[#0A0E14] px-4 py-8 overflow-y-auto">
      <div className="max-w-md mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white font-bold text-xl font-display">🔍 App Diagnostics</h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {lastRun ? `Last run: ${lastRun}` : "Running checks…"}
            </p>
          </div>
          <button
            onClick={run}
            disabled={running}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50 active:scale-95 transition-all"
          >
            {running ? "Running…" : "Re-run"}
          </button>
        </div>

        {/* Summary */}
        <div className="flex gap-3 mb-6">
          {[
            { label: "Passed", count: passed, color: "text-emerald-400" },
            { label: "Failed", count: failed, color: "text-red-400" },
            { label: "Warnings", count: warned, color: "text-yellow-400" },
          ].map((s) => (
            <div key={s.label} className="flex-1 bg-[#141920] border border-slate-800 rounded-2xl p-3 text-center">
              <p className={`font-bold text-2xl ${s.color}`}>{s.count}</p>
              <p className="text-slate-500 text-xs">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Checks */}
        <div className="space-y-3">
          {checks.map((c) => <Check key={c.id} {...c} />)}
        </div>

        {/* Back link */}
        <button
          onClick={() => window.location.href = "/"}
          className="w-full mt-6 py-3 bg-[#141920] border border-slate-800 text-slate-400 rounded-2xl text-sm hover:border-slate-600 transition-all"
        >
          ← Back to App
        </button>
      </div>
    </div>
  );
}
