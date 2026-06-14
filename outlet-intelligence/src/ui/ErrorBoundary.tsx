/* ════════════════════════════════════════════════════════════════════════════
   ERROR BOUNDARY — a single view crash must never white-screen the instrument.
   Keyed by tab in App so switching tabs recovers. The deterministic engine and
   persisted data are untouched by a render fault.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import { C, mono } from "./theme";

interface Props { children: React.ReactNode; onReset?: () => void }
interface State { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[Outlet Intelligence] a view crashed:", error, info.componentStack);
  }
  reset = () => { this.setState({ error: null }); this.props.onReset?.(); };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ display: "grid", placeItems: "center", padding: 32, minHeight: 300 }}>
        <div style={{ maxWidth: 460, textAlign: "center", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
          <div style={{ fontSize: 30 }}>⚠️</div>
          <div style={{ color: C.text, fontFamily: mono, fontWeight: 800, fontSize: 15, margin: "8px 0" }}>This view hit a snag</div>
          <div style={{ color: C.dim, fontSize: 12, lineHeight: 1.6 }}>
            Your measurements and home map are safe — they live in local storage and the diagnostic engine is unaffected. Try again or switch tabs.
          </div>
          <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 10, marginTop: 10, wordBreak: "break-word" }}>{String(this.state.error.message || this.state.error)}</div>
          <button onClick={this.reset} style={{ marginTop: 14, background: C.amber, color: "#0A0A0C", border: "none", borderRadius: 8, padding: "9px 16px", fontFamily: mono, fontWeight: 800, cursor: "pointer" }}>↻ Retry</button>
        </div>
      </div>
    );
  }
}
