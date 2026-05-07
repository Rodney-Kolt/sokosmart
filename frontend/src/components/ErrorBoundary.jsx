/**
 * ErrorBoundary.jsx
 * Catches any JS crash and shows a friendly fallback instead of a white screen.
 */

import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100dvh",
            background: "#0A0E14",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: "#fff", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8, maxWidth: 320 }}>
            The app hit an unexpected error. This is usually fixed by refreshing.
          </p>
          <p style={{
            color: "#f87171", fontSize: 11, fontFamily: "monospace",
            background: "#1a1f2e", padding: "8px 12px", borderRadius: 8,
            maxWidth: 320, wordBreak: "break-all", marginBottom: 20,
          }}>
            {this.state.error?.message || String(this.state.error)}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "linear-gradient(135deg, #f97316, #ef4444)",
              color: "#fff", fontWeight: 700, fontSize: 15,
              padding: "12px 28px", borderRadius: 16, border: "none",
              cursor: "pointer",
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
