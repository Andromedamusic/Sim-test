/* ════════════════════════════════════════════════════════════════════════════
   PICTURE-IN-PICTURE LIVE DIAGNOSTIC — a floating, draggable HUD that mirrors
   the live scratch reading (verdict gauge + key voltages + safety state) and
   stays visible across every menu. Portaled to <body>, glassy, with corner
   brackets and a pulsing LIVE indicator. Minimise / close / drag.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../../state/store";
import { analyzeOutlet, FAULTS, num } from "../../core";
import { C, mono, HUD, glow } from "../theme";
import { RadialGauge, useReducedMotion } from "../anim";
import { Bracket } from "../hud/Bracket";

const SHORT: Record<string, string> = { "SAFETY HOLD": "HOLD", CONDEMN: "CONDEMN", DEFECT: "DEFECT", MINOR: "MINOR", PASS: "PASS", INCONCLUSIVE: "WAIT" };

export function LiveDiagnostic({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scratchObs = useStore((s) => s.scratchObs);
  const scratchMeta = useStore((s) => s.scratchMeta);
  const reduced = useReducedMotion();
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({ x: -1, y: -1 }));
  const [min, setMin] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // default dock: bottom-right, once mounted
  useEffect(() => {
    if (pos.x < 0 && typeof window !== "undefined") {
      setPos({ x: window.innerWidth - 286, y: window.innerHeight - (min ? 96 : 300) });
    }
  }, [pos.x, min]);

  if (!open || typeof document === "undefined") return null;
  const r = analyzeOutlet(scratchObs, scratchMeta);
  const color = r.vColor;
  const top = FAULTS[r.topFault];

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const w = min ? 220 : 270, h = min ? 78 : 290;
    setPos({
      x: Math.max(6, Math.min(window.innerWidth - w - 6, e.clientX - drag.current.dx)),
      y: Math.max(6, Math.min(window.innerHeight - h - 6, e.clientY - drag.current.dy)),
    });
  };
  const onUp = () => { drag.current = null; };

  const reading = (label: string, v: unknown, ok: (n: number) => boolean) => {
    const n = num(v as never);
    const c = n == null ? C.dimmer : ok(n) ? C.good : C.bad;
    return (
      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{ color: C.dimmer, fontSize: 7.5, fontFamily: mono, letterSpacing: 1 }}>{label}</div>
        <div style={{ color: c, fontSize: 13, fontFamily: mono, fontWeight: 800 }}>{n == null ? "—" : n.toFixed(0)}</div>
      </div>
    );
  };

  return createPortal(
    <div
      className="oi-popin"
      style={{
        position: "fixed", left: pos.x < 0 ? undefined : pos.x, top: pos.y < 0 ? undefined : pos.y,
        right: pos.x < 0 ? 12 : undefined, bottom: pos.y < 0 ? 76 : undefined,
        width: min ? 220 : 270, zIndex: 80, fontFamily: mono,
        background: HUD.glass, backdropFilter: "blur(12px)",
        border: `1px solid ${color}66`, borderRadius: 12,
        boxShadow: `${glow(color, 0.5)}, 0 20px 50px -16px #000`,
        clipPath: "polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)",
        overflow: "hidden",
      }}
      onPointerMove={onMove} onPointerUp={onUp}
    >
      <Bracket color={color} />
      {/* title bar (drag handle) */}
      <div onPointerDown={onDown} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 9px", cursor: "grab", background: `linear-gradient(90deg,${color}1f,transparent)`, borderBottom: `1px solid ${color}33`, touchAction: "none" }}>
        <span className={reduced ? "" : "oi-pulse"} style={{ width: 7, height: 7, borderRadius: 99, background: color, boxShadow: `0 0 8px ${color}` }} />
        <span style={{ color, fontSize: 9, fontWeight: 800, letterSpacing: 2 }}>LIVE DIAGNOSTIC</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button onClick={() => setMin((m) => !m)} title="Minimise" style={iconBtn}>{min ? "▢" : "—"}</button>
          <button onClick={onClose} title="Close" style={iconBtn}>✕</button>
        </span>
      </div>

      {min ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px" }}>
          <span style={{ width: 11, height: 11, borderRadius: 99, background: color, boxShadow: `0 0 10px ${color}` }} />
          <span style={{ color, fontSize: 14, fontWeight: 800 }}>{SHORT[r.verdictCode] ?? r.verdictCode}</span>
          <span style={{ marginLeft: "auto", color: C.dim, fontSize: 10 }}>{(r.confidence * 100).toFixed(0)}%</span>
        </div>
      ) : (
        <div style={{ padding: "12px 12px 13px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <RadialGauge value={r.confidence} size={92} thickness={8} color={color} label={SHORT[r.verdictCode] ?? ""} sublabel="CONF" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.dimmer, fontSize: 8, letterSpacing: 1.5 }}>LEADING</div>
              <div style={{ color: top?.color ?? C.text, fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>{top?.name ?? "—"}{top?.lethal ? " ☠" : ""}</div>
              <div style={{ marginTop: 6, color: C.dimmer, fontSize: 8, letterSpacing: 1.5 }}>SEVERITY</div>
              <div style={{ color, fontSize: 12, fontWeight: 800 }}>{top?.sev ?? 0}/10</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 11, borderTop: `1px solid ${HUD.line}`, paddingTop: 9 }}>
            {reading("H→N", scratchObs.VHN, (n) => n >= 110 && n <= 130)}
            {reading("H→G", scratchObs.VHG, (n) => n >= 108)}
            {reading("N→G", scratchObs.VNG, (n) => n <= 3)}
          </div>
          {r.hold && (
            <div style={{ marginTop: 9, background: "#2a0808", border: "1px solid #7f1d1d", borderRadius: 6, padding: "6px 8px", color: "#fecaca", fontSize: 9, lineHeight: 1.4 }}>
              ☠ SAFETY HOLD — {r.demand[0] ?? "do not clear"}
            </div>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

const iconBtn: React.CSSProperties = { background: "transparent", border: "none", color: "#9fb0c8", fontSize: 11, cursor: "pointer", padding: "2px 5px", fontFamily: mono, lineHeight: 1 };
