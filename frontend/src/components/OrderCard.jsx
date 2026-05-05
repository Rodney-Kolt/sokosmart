/**
 * OrderCard.jsx
 * Displays the current status of a service order inside the chat.
 * Polls the backend every 5 seconds for status updates.
 * When status reaches "completed", shows a "Rate this vendor" button.
 */

import React, { useState, useEffect, useRef } from "react";
import { getOrderStatus } from "../utils/api";

const STEPS = ["requested", "accepted", "in_progress", "ready", "completed"];

const STEP_LABELS = {
  requested:   "Requested",
  accepted:    "Accepted",
  in_progress: "In Progress",
  ready:       "Ready",
  completed:   "Completed ✅",
};

const STEP_ICONS = {
  requested:   "📨",
  accepted:    "✅",
  in_progress: "⚙️",
  ready:       "🎉",
  completed:   "⭐",
};

export default function OrderCard({ orderId, vendorName, onRate }) {
  const [order, setOrder]     = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef               = useRef(null);

  async function fetchOrder() {
    try {
      const data = await getOrderStatus(orderId);
      setOrder(data);
      setLoading(false);
      // Stop polling once completed
      if (data?.status === "completed") {
        clearInterval(pollRef.current);
      }
    } catch {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrder();
    pollRef.current = setInterval(fetchOrder, 5000);
    return () => clearInterval(pollRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (loading) {
    return (
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 w-full">
        <div className="shimmer h-4 w-1/2 rounded-full mb-2" />
        <div className="shimmer h-3 w-full rounded-full" />
      </div>
    );
  }

  if (!order) return null;

  const currentIdx = STEPS.indexOf(order.status);

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 w-full msg-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-white font-semibold text-sm">Service Request</p>
          <p className="text-gray-500 text-xs">{vendorName}</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
          order.status === "completed"
            ? "bg-green-900/40 border-green-700/40 text-green-400"
            : order.status === "ready"
            ? "bg-blue-900/40 border-blue-700/40 text-blue-400"
            : "bg-yellow-900/40 border-yellow-700/40 text-yellow-400"
        }`}>
          {STEP_ICONS[order.status]} {STEP_LABELS[order.status]}
        </span>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-1 mb-3">
        {STEPS.map((step, i) => (
          <React.Fragment key={step}>
            <div className={`flex flex-col items-center gap-1 flex-shrink-0 ${
              i <= currentIdx ? "opacity-100" : "opacity-30"
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 ${
                i < currentIdx
                  ? "bg-[#25D366] border-[#25D366] text-[#0d1117]"
                  : i === currentIdx
                  ? "bg-[#0d1117] border-[#25D366] text-[#25D366]"
                  : "bg-[#0d1117] border-[#30363d] text-gray-600"
              }`}>
                {i < currentIdx ? "✓" : i + 1}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 ${i < currentIdx ? "bg-[#25D366]" : "bg-[#30363d]"}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step labels */}
      <div className="flex justify-between mb-3">
        {STEPS.map((step, i) => (
          <span key={step} className={`text-[9px] text-center leading-tight ${
            i === currentIdx ? "text-[#25D366] font-medium" : "text-gray-600"
          }`} style={{ width: "18%" }}>
            {STEP_LABELS[step].replace(" ✅", "")}
          </span>
        ))}
      </div>

      {/* Details */}
      {order.details && (
        <p className="text-gray-400 text-xs bg-[#0d1117] rounded-xl px-3 py-2 mb-3 line-clamp-2">
          "{order.details}"
        </p>
      )}

      {/* Rate button when completed */}
      {order.status === "completed" && onRate && (
        <button
          onClick={() => onRate(order)}
          className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 text-white font-semibold py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
        >
          ⭐ Rate this vendor
        </button>
      )}
    </div>
  );
}
