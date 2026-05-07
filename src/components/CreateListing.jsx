/**
 * CreateListing.jsx
 * Mobile-friendly form for vendors to create product/service listings.
 * Features: image upload to Supabase Storage, AI description generation.
 */

import React, { useState, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import { createListing, generateListingDescription } from "../utils/api";

const CATEGORIES = [
  "tailoring","phone repair","electronics repair","plumbing","handyman",
  "fresh food","bakery","cleaning","laundry","salon","beauty","grocery",
  "catering","photography","tutoring","transport","mechanic",
];

export default function CreateListing({ vendorId, onClose, onCreated }) {
  const [title, setTitle]           = useState("");
  const [description, setDesc]      = useState("");
  const [price, setPrice]           = useState("");
  const [category, setCategory]     = useState("");
  const [status, setStatus]         = useState("active");
  const [images, setImages]         = useState([]); // uploaded URLs
  const [uploading, setUploading]   = useState(false);
  const [aiLoading, setAiLoading]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const fileRef = useRef(null);

  // ── Image upload ──────────────────────────────────────────────────────
  async function handleImageUpload(e) {
    const files = Array.from(e.target.files).slice(0, 3 - images.length);
    if (!files.length) return;
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const name = `listing_${Date.now()}_${file.name}`;
      const { data, error: upErr } = await supabase.storage
        .from("listings")
        .upload(name, file, { upsert: true });
      if (!upErr && data) {
        const { data: urlData } = supabase.storage.from("listings").getPublicUrl(name);
        if (urlData?.publicUrl) urls.push(urlData.publicUrl);
      }
    }
    setImages((prev) => [...prev, ...urls].slice(0, 3));
    setUploading(false);
  }

  // ── AI description ────────────────────────────────────────────────────
  async function handleAiDescription() {
    if (!title.trim()) { setError("Enter a title first."); return; }
    setAiLoading(true);
    setError("");
    try {
      const text = await generateListingDescription(title, category);
      setDesc(text);
    } catch {
      setError("AI generation failed. Try again.");
    } finally {
      setAiLoading(false);
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────
  async function handleSave(publishStatus) {
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    try {
      const result = await createListing({
        vendor_id:   vendorId,
        title:       title.trim(),
        description: description.trim(),
        price:       price ? parseFloat(price) : null,
        category,
        images,
        status:      publishStatus,
      });
      onCreated?.(result.listing);
      onClose?.();
    } catch (err) {
      setError(err.message || "Failed to create listing.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Header */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        <h2 className="text-white font-bold text-base flex-1">New Listing</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {/* Title */}
        <div>
          <label className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. African print dress tailoring"
            className="w-full bg-[#161b22] border border-[#30363d] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] placeholder-gray-600"
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-[#161b22] border border-[#30363d] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
          >
            <option value="">Select category…</option>
            {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        </div>

        {/* Price */}
        <div>
          <label className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">Price (UGX)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 50000"
            className="w-full bg-[#161b22] border border-[#30363d] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] placeholder-gray-600"
          />
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-gray-400 text-xs font-medium uppercase tracking-wider">Description</label>
            <button
              onClick={handleAiDescription}
              disabled={aiLoading || !title.trim()}
              className="flex items-center gap-1 text-[#25D366] text-xs font-medium disabled:opacity-40"
            >
              {aiLoading ? "⏳ Generating…" : "✨ Ask AI to write"}
            </button>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Describe your product or service…"
            rows={4}
            className="w-full bg-[#161b22] border border-[#30363d] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] resize-none placeholder-gray-600"
          />
        </div>

        {/* Images */}
        <div>
          <label className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1.5 block">
            Images ({images.length}/3)
          </label>
          <div className="flex gap-2 flex-wrap">
            {images.map((url, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#30363d]">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full text-white text-xs flex items-center justify-center"
                >✕</button>
              </div>
            ))}
            {images.length < 3 && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-[#30363d] flex flex-col items-center justify-center text-gray-500 hover:border-[#25D366] transition-colors"
              >
                {uploading ? <span className="text-xs">…</span> : <><span className="text-2xl">+</span><span className="text-[10px] mt-1">Photo</span></>}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-6 pt-3 flex gap-3 flex-shrink-0 border-t border-[#30363d]">
        <button
          onClick={() => handleSave("draft")}
          disabled={saving}
          className="flex-1 border border-[#30363d] text-gray-300 font-medium py-3 rounded-xl text-sm hover:border-gray-500 transition-colors disabled:opacity-40"
        >
          Save Draft
        </button>
        <button
          onClick={() => handleSave("active")}
          disabled={saving || !title.trim()}
          className="flex-1 bg-[#25D366] text-[#0d1117] font-bold py-3 rounded-xl text-sm hover:bg-[#128C7E] hover:text-white transition-colors disabled:opacity-40"
        >
          {saving ? "Publishing…" : "Publish →"}
        </button>
      </div>
    </div>
  );
}
