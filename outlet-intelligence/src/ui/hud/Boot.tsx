/* Boot intro — a brief command-suite power-on, dismissible by tap. */
import React, { useEffect, useState } from "react";
import { C, mono, HUD, holoGrad } from "../theme";
import { useReducedMotion } from "../anim";

export function Boot() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");
  useEffect(() => {
    if (reduced) { setPhase("gone"); return; }
    const a = setTimeout(() => setPhase("out"), 1400);
    const b = setTimeout(() => setPhase("gone"), 1950);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [reduced]);
  if (phase === "gone") return null;
  return (
    <div onClick={() => setPhase("gone")} style={{
      position: "fixed", inset: 0, zIndex: 200, background: HUD.void,
      display: "grid", placeItems: "center", cursor: "pointer",
      opacity: phase === "out" ? 0 : 1, transition: "opacity .5s ease",
      pointerEvents: phase === "out" ? "none" : "auto",
    }}>
      <div style={{ textAlign: "center", fontFamily: mono }}>
        <div className="oi-spin-slow" style={{ width: 64, height: 64, margin: "0 auto 16px", borderRadius: "50%", border: `2px solid ${C.blue}22`, borderTopColor: C.blue, boxShadow: `0 0 24px -4px ${C.blue}` }} />
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: 4, background: holoGrad, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>OUTLET&nbsp;INTELLIGENCE</div>
        <div style={{ marginTop: 6, color: C.dim, fontSize: 9.5, letterSpacing: 3 }}>DIAGNOSTIC SUITE</div>
        <div style={{ width: 200, height: 2, background: HUD.line, borderRadius: 2, margin: "16px auto 6px", overflow: "hidden" }}>
          <div className="oi-bootbar" style={{ height: "100%", background: holoGrad }} />
        </div>
        <div style={{ color: HUD.dimmer, fontSize: 8, letterSpacing: 2 }}>INITIALIZING · TAP TO SKIP</div>
      </div>
    </div>
  );
}
