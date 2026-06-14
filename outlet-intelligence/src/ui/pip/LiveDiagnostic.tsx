/* ════════════════════════════════════════════════════════════════════════════
   PICTURE-IN-PICTURE LIVE DIAGNOSTIC — a floating, draggable HUD that mirrors
   the live scratch reading (verdict gauge + key voltages + safety state) and
   stays visible across every menu. Portaled to <body>. Snaps to the nearest
   corner on release; auto-minimises on phones; whole panel is a drag handle.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../../state/store";
import { analyzeOutlet, FAULTS, num } from "../../core";
import { C, mono, HUD, glow } from "../theme";
import { RadialGauge, useReducedMotion } from "../anim";
import { Bracket } from "../hud/Bracket";
import { OIcon } from "../icons/OIcon";

const SHORT: Record<string, string> = { "SAFETY HOLD": "HOLD", CONDEMN: "CONDEMN", DEFECT: "DEFECT", MINOR: "MINOR", PASS: "PASS", INCONCLUSIVE: "WAIT" };
const DOCK = 66;

export function LiveDiagnostic({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scratchObs = useStore((s) => s.scratchObs);
  const scratchMeta = useStore((s) => s.scratchMeta);
  const reduced = useReducedMotion();
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({ x: -1, y: -1 }));
  const [min, setMin] = useState(false);
  const [snap, setSnap] = useState(false);
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  const dims = () => ({ w: min ? 218 : 268, h: min ? 80 : 286 });

  // initial dock: bottom-right; auto-minimise on phones
  useEffect(() => {
    if (typeof window === "undefined") return;
    const small = window.innerWidth < 480;
    if (small) setMin(true);
    const { w, h } = { w: small ? 218 : 268, h: small ? 80 : 286 };
    setPos({ x: window.innerWidth - w - 8, y: window.innerHeight - h - DOCK - 8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open || typeof document === "undefined") return null;
  const r = analyzeOutlet(scratchObs, scratchMeta);
  const color = r.vColor;
  const top = FAULTS[r.topFault];

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSnap(false);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current.moved = true;
    const { w, h } = dims();
    setPos({
      x: Math.max(6, Math.min(window.innerWidth - w - 6, e.clientX - drag.current.dx)),
      y: Math.max(6, Math.min(window.innerHeight - h - 6, e.clientY - drag.current.dy)),
    });
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    const { w, h } = dims();
    setSnap(true);
    setPos((p) => {
      const cx = p.x + w / 2, cy = p.y + h / 2;
      const x = cx < window.innerWidth / 2 ? 8 : window.innerWidth - w - 8;
      const y = cy < window.innerHeight / 2 ? 54 : window.innerHeight - h - DOCK - 8;
      return { x, y };
    });
  };

  const reading = (label: string, v: unknown, ok: (n: number) => boolean) => {
    const n = num(v as never);
    const c = n == null ? C.dim : ok(n) ? C.good : C.bad;
    return (
      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{ color: C.dim, fontSize: 8.5, fontFamily: mono, letterSpacing: 0.5 }}>{label}</div>
        <div style={{ color: c, fontSize: 14, fontFamily: mono, fontWeight: 800 }}>{n == null ? "—" : n.toFixed(0)}</div>
      </div>
    );
  };

  const { w } = dims();
  return createPortal(
    <div
      style={{
        position: "fixed", left: pos.x < 0 ? undefined : pos.x, top: pos.y < 0 ? undefined : pos.y,
        right: pos.x < 0 ? 8 : undefined, bottom: pos.y < 0 ? DOCK + 8 : undefined,
        width: w, zIndex: 85, fontFamily: mono, touchAction: "none",
        transition: snap ? "left .2s ease, top .2s ease" : "none",
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
      <div onPointerDown={onDown} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 8px 8px 10px", cursor: "grab", background: `linear-gradient(90deg,${color}1f,transparent)`, borderBottom: `1px solid ${color}33` }}>
        <span className={reduced ? "" : "oi-pulse"} style={{ width: 7, height: 7, borderRadius: 99, background: color, boxShadow: `0 0 8px ${color}` }} />
        <span style={{ color, fontSize: 9.5, fontWeight: 800, letterSpacing: 1.5 }}>LIVE</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setMin((m) => !m)} title="Minimise" style={iconBtn}>{min ? <span style={{ display: "inline-block", width: 9, height: 9, border: `1.5px solid currentColor`, borderRadius: 1, verticalAlign: "middle" }} /> : "—"}</button>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} title="Close" style={iconBtn}>×</button>
        </span>
      </div>

      {min ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px" }}>
          <span style={{ width: 12, height: 12, borderRadius: 99, background: color, boxShadow: `0 0 10px ${color}`, flexShrink: 0 }} />
          <span style={{ color, fontSize: 15, fontWeight: 800 }}>{SHORT[r.verdictCode] ?? r.verdictCode}</span>
          <span style={{ marginLeft: "auto", color: C.dim, fontSize: 11 }}>{(r.confidence * 100).toFixed(0)}%</span>
        </div>
      ) : (
        <div style={{ padding: "12px 12px 13px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <RadialGauge value={r.confidence} size={90} thickness={8} color={color} label={SHORT[r.verdictCode] ?? ""} sublabel="CONF" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.dim, fontSize: 9, letterSpacing: 1 }}>LEADING</div>
              <div style={{ color: top?.color ?? C.text, fontSize: 12.5, fontWeight: 700, lineHeight: 1.2, display: "flex", alignItems: "center", gap: 5 }}>{top?.name ?? "—"}{top?.lethal ? <OIcon name="verdictHold" size={14} color={C.danger} accent={C.danger} /> : null}</div>
              <div style={{ marginTop: 6, color: C.dim, fontSize: 9, letterSpacing: 1 }}>SEVERITY</div>
              <div style={{ color, fontSize: 13, fontWeight: 800 }}>{top?.sev ?? 0}/10</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 11, borderTop: `1px solid ${HUD.line}`, paddingTop: 9 }}>
            {reading("H→N", scratchObs.VHN, (n) => n >= 110 && n <= 130)}
            {reading("H→G", scratchObs.VHG, (n) => n >= 108)}
            {reading("N→G", scratchObs.VNG, (n) => n <= 3)}
          </div>
          {r.hold && (
            <div style={{ marginTop: 9, background: "#2a0808", border: "1px solid #7f1d1d", borderRadius: 6, padding: "6px 8px", color: "#fecaca", fontSize: 9.5, lineHeight: 1.4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><OIcon name="shield" size={13} color="#fecaca" accent="#fecaca" /> SAFETY HOLD — {r.demand[0] ?? "do not clear"}</span>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

const iconBtn: React.CSSProperties = { background: "transparent", border: "none", color: C.dim, fontSize: 14, cursor: "pointer", width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: mono, lineHeight: 1 };
