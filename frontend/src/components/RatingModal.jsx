/**
 * RatingModal.jsx
 * Post-transaction rating modal.
 * Allows consumer to give 1-5 stars, optional text, and optional voice note.
 * Voice note uses MediaRecorder API to capture audio as a Blob,
 * then uploads to Supabase Storage bucket "reviews".
 */

import React, { useState, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import { submitReview } from "../utils/api";

export default function RatingModal({ order, vendorName, consumerId, onClose, onSubmitted }) {
  const [rating, setRating]       = useState(0);
  const [hovered, setHovered]     = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl]   = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState("");
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  // ── Voice recording ───────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      setError("Microphone access denied.");
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  // ── Submit ────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (rating === 0) { setError("Please select a star rating."); return; }
    setUploading(true);
    setError("");

    let voiceUrl = "";
    try {
      // Upload voice note to Supabase Storage if recorded
      if (audioBlob) {
        const fileName = `review_${order.id}_${Date.now()}.webm`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("reviews")
          .upload(fileName, audioBlob, { contentType: "audio/webm", upsert: true });

        if (!uploadErr && uploadData) {
          const { data: urlData } = supabase.storage.from("reviews").getPublicUrl(fileName);
          voiceUrl = urlData?.publicUrl || "";
        }
      }

      await submitReview({
        order_id:         order.id,
        vendor_id:        order.vendor_id,
        consumer_id:      consumerId,
        rating,
        review_text:      reviewText,
        voice_review_url: voiceUrl,
      });

      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to submit review.");
    } finally {
      setUploading(false);
    }
  }

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4">
      <div className="w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-2xl p-5 fade-in">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-bold text-base">Rate your experience</h3>
            <p className="text-gray-400 text-xs mt-0.5">{vendorName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {/* Stars */}
        <div className="flex justify-center gap-3 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(star)}
              className="text-4xl transition-transform hover:scale-110"
            >
              <span className={(hovered || rating) >= star ? "text-yellow-400" : "text-gray-700"}>
                ★
              </span>
            </button>
          ))}
        </div>

        {/* Text review */}
        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="Share your experience (optional)…"
          rows={3}
          className="w-full bg-[#0d1117] border border-[#30363d] text-gray-100 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#25D366] mb-3 placeholder-gray-600"
        />

        {/* Voice note */}
        <div className="flex items-center gap-3 mb-4">
          {!audioBlob ? (
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                recording
                  ? "bg-red-900/40 border-red-700 text-red-400 animate-pulse"
                  : "bg-[#0d1117] border-[#30363d] text-gray-300 hover:border-[#25D366]"
              }`}
            >
              🎤 {recording ? "Stop recording" : "Add voice note"}
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <audio src={audioUrl} controls className="flex-1 h-8" />
              <button
                onClick={() => { setAudioBlob(null); setAudioUrl(null); }}
                className="text-gray-500 hover:text-red-400 text-sm"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={uploading || rating === 0}
          className="w-full bg-[#25D366] text-[#0d1117] font-bold py-3 rounded-xl text-sm hover:bg-[#128C7E] hover:text-white transition-colors disabled:opacity-40"
        >
          {uploading ? "Submitting…" : "Submit Review"}
        </button>
      </div>
    </div>
  );
}
