/* ════════════════════════════════════════════════════════════════════════════
   OUTLET PHYSICS SVG — "SENSOR FEED" panel. NEMA 5-15 receptacle face with
   live voltage overlays, corner Bracket frame, and a subtle live-scan stripe.
   Animations preserved: ghost-voltage shimmer, fritting decay, reversed-pol.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../anim";
import { C, HUD, mono } from "../../theme";
import { Bracket } from "../../hud/Bracket";
import type { Observation, Meta } from "../../../core";
import type { analyzeOutlet } from "../../../core";

type Result = ReturnType<typeof analyzeOutlet>;

// ─── NEMA 5-15 geometry constants ─────────────────────────────────────────────
const W = 180, H = 220;
const CX = W / 2;
const SLOT_W = 7, SLOT_H = 26;
const HOT_X = CX + 22, NEU_X = CX - 22, SLOT_Y = 70;
const GND_X = CX, GND_Y = 118, GND_R = 7;
const SCR1 = { x: CX, y: 36 };
const SCR2 = { x: CX, y: 150 };
const BODY_RX = 68, BODY_RY = 82, BODY_CY = 94;

// ─── Slot colors ───────────────────────────────────────────────────────────────
const HOT_COLOR     = "#FCA5A5";
const NEU_COLOR     = "#93C5FD";
const GND_COLOR     = "#86EFAC";
const OPEN_COLOR    = "#52525B";
const PHANTOM_COLOR = "#FBBF24";

interface Props {
  obs: Observation;
  meta: Meta;
  result: Result;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function isOpenGroundFamily(topFault: string): boolean {
  return topFault === "open_ground_cont" || topFault === "open_ground_frit" || topFault === "high_r_ground";
}

function isReversed(result: Result, obs: Observation): boolean {
  return result.topFault === "reversed_pol" || obs.reversePolarity === true;
}

// ─── Fritting counter ─────────────────────────────────────────────────────────
function useFrittingValue(active: boolean, reduced: boolean): string {
  const SEQUENCE = [33, 28, 19, 10, 4, 1.2, 0.3, 0.3, 0.3, 28, 33];
  const [idx, setIdx] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!active || reduced) { setIdx(0); return; }
    const tick = () => {
      setIdx((i) => (i + 1) % SEQUENCE.length);
      timer.current = setTimeout(tick, 280 + Math.random() * 180);
    };
    timer.current = setTimeout(tick, 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [active, reduced]);
  return active ? `${SEQUENCE[idx].toFixed(1)} Ω` : "";
}

// ─── Ghost-voltage shimmer opacity ────────────────────────────────────────────
function useGhostOpacity(active: boolean, reduced: boolean): number {
  const [op, setOp] = useState(0.5);
  const raf = useRef(0);
  useEffect(() => {
    if (!active || reduced) { setOp(active ? 0.5 : 0); return; }
    const tick = (t: number) => {
      setOp(0.38 + 0.32 * Math.sin(t / 600));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [active, reduced]);
  return op;
}

// ─── Scan-line y% oscillator ──────────────────────────────────────────────────
function useScanY(active: boolean): number {
  const [y, setY] = useState(0);
  const raf = useRef(0);
  const t0 = useRef(0);
  useEffect(() => {
    if (!active) return;
    const tick = (t: number) => {
      if (!t0.current) t0.current = t;
      setY(((t - t0.current) % 3200) / 3200);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [active]);
  return y;
}

export function OutletPhysicsSVG({ obs, result }: Props) {
  const reduced = useReducedMotion();

  const VHN = num(obs.VHN);
  const VHG = num(obs.VHG);
  const VNG = num(obs.VNG);

  const reversed    = isReversed(result, obs);
  const openGnd     = isOpenGroundFamily(result.topFault);
  const fritting    = obs.frittingObs === true;
  const ghostVoltage = openGnd && VHG !== null && VHG < 70;

  const ghostOp    = useGhostOpacity(ghostVoltage, reduced);
  const frittingVal = useFrittingValue(fritting, reduced);
  const scanY       = useScanY(!reduced);

  const hotColor     = reversed ? NEU_COLOR  : HOT_COLOR;
  const neuColor     = reversed ? HOT_COLOR  : NEU_COLOR;
  const gndColor     = openGnd  ? OPEN_COLOR : GND_COLOR;
  const gndGlowColor = ghostVoltage ? PHANTOM_COLOR : GND_COLOR;
  const fmtV = (v: number | null) => v !== null ? `${v.toFixed(1)}V` : "—";

  const [revFlash, setRevFlash] = useState(true);
  useEffect(() => {
    if (!reversed || reduced) return;
    const id = setInterval(() => setRevFlash((f) => !f), 550);
    return () => clearInterval(id);
  }, [reversed, reduced]);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "14px 12px 10px",
        background: `linear-gradient(160deg,${HUD.void}cc,#0A0E18cc)`,
        border: `1px solid ${HUD.cyan}33`,
        borderRadius: 12,
        backdropFilter: "blur(8px)",
        boxShadow: `0 0 0 1px ${HUD.cyan}11, 0 8px 30px -12px ${HUD.cyan}33`,
        overflow: "hidden",
      }}
    >
      {/* Corner brackets */}
      <Bracket color={HUD.cyan} size={12} inset={4} weight={1.5} opacity={0.7} />

      {/* Live-scan stripe (horizontal sweep) */}
      {!reduced && (
        <div
          style={{
            position: "absolute",
            top: `${scanY * 100}%`,
            left: 0,
            right: 0,
            height: 1,
            background: `linear-gradient(90deg,transparent,${HUD.cyan}55,transparent)`,
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}

      {/* Section label */}
      <div style={{
        color: C.dimmer,
        fontSize: 8.5,
        fontFamily: mono,
        letterSpacing: 2,
        fontWeight: 700,
        alignSelf: "flex-start",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}>
        <span style={{ color: HUD.cyan, fontSize: 7 }}>◆</span>
        SENSOR FEED · RECEPTACLE
        {/* Live indicator dot */}
        <span style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: C.good,
          display: "inline-block",
          marginLeft: 4,
          boxShadow: `0 0 5px ${C.good}`,
          animation: reduced ? "none" : "oi-pulse 2s ease-in-out infinite",
        }} />
      </div>

      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ overflow: "visible" }}
        aria-label="NEMA 5-15 receptacle diagram"
      >
        <defs>
          <radialGradient id="opsvg-ghost" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={PHANTOM_COLOR} stopOpacity={ghostOp} />
            <stop offset="100%" stopColor={PHANTOM_COLOR} stopOpacity={0} />
          </radialGradient>
          <filter id="opsvg-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="opsvg-shimmer" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={PHANTOM_COLOR} stopOpacity="0" />
            <stop offset="50%" stopColor={PHANTOM_COLOR} stopOpacity="0.6" />
            <stop offset="100%" stopColor={PHANTOM_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Receptacle body */}
        <ellipse cx={CX} cy={BODY_CY} rx={BODY_RX} ry={BODY_RY}
          fill="#1a1a20" stroke={C.border} strokeWidth={2} />
        <ellipse cx={CX} cy={BODY_CY} rx={BODY_RX - 8} ry={BODY_RY - 8}
          fill="none" stroke={C.border} strokeWidth={1} opacity={0.4} />

        {/* Mounting screws */}
        <ScrewHead cx={SCR1.x} cy={SCR1.y} />
        <ScrewHead cx={SCR2.x} cy={SCR2.y} />

        {/* Neutral slot */}
        <rect
          x={NEU_X - SLOT_W / 2 - 1} y={SLOT_Y - SLOT_H / 2}
          width={SLOT_W + 2} height={SLOT_H} rx={3}
          fill={neuColor} opacity={0.88}
          style={{ filter: `drop-shadow(0 0 4px ${neuColor}99)` }}
        />
        <SlotLabel x={NEU_X - 20} y={SLOT_Y} label={reversed ? "HOT" : "NEU"} val={fmtV(VNG)} color={neuColor} align="end" />

        {/* Hot slot */}
        <rect
          x={HOT_X - SLOT_W / 2} y={SLOT_Y - SLOT_H / 2}
          width={SLOT_W} height={SLOT_H} rx={3}
          fill={hotColor} opacity={0.88}
          style={{ filter: `drop-shadow(0 0 4px ${hotColor}99)` }}
        />
        <SlotLabel x={HOT_X + 17} y={SLOT_Y} label={reversed ? "NEU" : "HOT"} val={fmtV(VHN)} color={hotColor} align="start" />

        {/* Ghost glow halo */}
        {ghostVoltage && (
          <circle cx={GND_X} cy={GND_Y} r={GND_R + 8}
            fill="url(#opsvg-ghost)" opacity={ghostOp} />
        )}

        {/* Ground pin */}
        <circle
          cx={GND_X} cy={GND_Y} r={GND_R}
          fill={openGnd ? OPEN_COLOR : gndColor}
          opacity={openGnd ? 0.5 : 0.88}
          style={{
            filter: ghostVoltage
              ? `drop-shadow(0 0 7px ${PHANTOM_COLOR})`
              : openGnd ? "none" : `drop-shadow(0 0 4px ${GND_COLOR}88)`,
          }}
        />

        {/* Shimmer overlay */}
        {ghostVoltage && !reduced && (
          <circle cx={GND_X} cy={GND_Y} r={GND_R}
            fill="url(#opsvg-shimmer)" className="oi-shimmer" />
        )}

        {/* Dashed coupling line from Hot to Ground when ghost */}
        {ghostVoltage && (
          <line
            x1={HOT_X} y1={SLOT_Y + SLOT_H / 2 + 4}
            x2={GND_X} y2={GND_Y - GND_R - 4}
            stroke={PHANTOM_COLOR} strokeWidth={1.2} strokeDasharray="3 4"
            opacity={ghostOp * 0.9}
            className={reduced ? undefined : "oi-flow"}
          />
        )}

        {/* Ground label */}
        <SlotLabel
          x={GND_X} y={GND_Y + GND_R + 14}
          label={openGnd ? "OPEN GND" : "GND"}
          val={fritting ? frittingVal : fmtV(VHG)}
          color={ghostVoltage ? PHANTOM_COLOR : gndGlowColor}
          align="middle"
          sublabel={ghostVoltage ? "phantom" : undefined}
        />

        {/* H→N voltage (face centre) */}
        {VHN !== null && (
          <text x={CX} y={BODY_CY + BODY_RY - 14}
            textAnchor="middle" fontFamily={mono} fontSize={9} fill={C.dimmer}>
            H↔N: {fmtV(VHN)}
          </text>
        )}

        {/* REV polarity badge */}
        {reversed && (
          <g>
            <rect
              x={CX - 20} y={BODY_CY - 14} width={40} height={17} rx={5}
              fill={revFlash ? "#7F1D1D" : "#1A0404"} stroke="#DC2626" strokeWidth={1.5}
            />
            <text
              x={CX} y={BODY_CY - 1} textAnchor="middle"
              fontFamily={mono} fontSize={10} fontWeight="bold"
              fill={revFlash ? "#FCA5A5" : "#DC262688"}>
              ⚡ REV
            </text>
          </g>
        )}

        {/* Fritting arc spark */}
        {fritting && !reduced && (
          <FrittingArc cx={GND_X} cy={GND_Y - GND_R - 6} />
        )}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <LegendDot color={HOT_COLOR} label="Hot" />
        <LegendDot color={NEU_COLOR} label="Neutral" />
        <LegendDot color={GND_COLOR} label="Ground" />
        {ghostVoltage && <LegendDot color={PHANTOM_COLOR} label="Ghost voltage" />}
        {openGnd && <LegendDot color={OPEN_COLOR} label="Open ground" />}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ScrewHead({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#252530" stroke={C.border} strokeWidth={1} />
      <line x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} stroke={C.dimmer} strokeWidth={1.2} />
      <line x1={cx} y1={cy - 3} x2={cx} y2={cy + 3} stroke={C.dimmer} strokeWidth={1.2} />
    </g>
  );
}

function SlotLabel({ x, y, label, val, color, align, sublabel }: {
  x: number; y: number; label: string; val: string; color: string;
  align: "start" | "end" | "middle"; sublabel?: string;
}) {
  const anch = align === "start" ? "start" : align === "end" ? "end" : "middle";
  return (
    <g>
      <text x={x} y={y - 6} textAnchor={anch} fontFamily={mono} fontSize={8}
        fill={color} fontWeight="bold" opacity={0.9}>
        {label}
      </text>
      <text x={x} y={y + 8} textAnchor={anch} fontFamily={mono} fontSize={9}
        fill={color} fontWeight="600">
        {val}
      </text>
      {sublabel && (
        <text x={x} y={y + 20} textAnchor={anch} fontFamily={mono} fontSize={7.5}
          fill={color} opacity={0.7} fontStyle="italic">
          {sublabel}
        </text>
      )}
    </g>
  );
}

function FrittingArc({ cx, cy }: { cx: number; cy: number }) {
  const spark = `M${cx - 6},${cy} l4,-5 l-3,3 l5,-7 l-3,4 l4,-3 l-3,5 l2,-2 l-6,6`;
  return (
    <path d={spark} fill="none" stroke="#FBBF24" strokeWidth={1.5}
      strokeLinecap="round" opacity={0.85} className="oi-glow" />
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ color: C.dimmer, fontFamily: mono, fontSize: 8.5 }}>{label}</span>
    </div>
  );
}
