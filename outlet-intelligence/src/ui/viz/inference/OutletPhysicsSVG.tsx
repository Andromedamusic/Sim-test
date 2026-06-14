/* ════════════════════════════════════════════════════════════════════════════
   OUTLET PHYSICS SVG — NEMA 5-15 receptacle face with live voltage overlays.
   Visual physics:
   · Ghost-voltage shimmer on ground when open-ground family + phantom VHG
   · Fritting decay animation (flickering arc) when frittingObs===true
   · Reversed-polarity: H/N swap flash + REV badge
   · Slots coloured by measured role (hot / neutral / ground / unknown / open)
   Respects prefers-reduced-motion (no infinite animation when reduced).
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../anim";
import { C, mono } from "../../theme";
import type { Observation, Meta } from "../../../core";
import type { analyzeOutlet } from "../../../core";

type Result = ReturnType<typeof analyzeOutlet>;

// ─── NEMA 5-15 geometry constants (220px tall SVG, centred) ───────────────────
const W = 180, H = 220;
const CX = W / 2;
// Slot dimensions
const SLOT_W = 7, SLOT_H = 26;
// Hot (right / narrow), Neutral (left / wide)
const HOT_X = CX + 22, NEU_X = CX - 22, SLOT_Y = 70;
// Ground hole (round)
const GND_X = CX, GND_Y = 118, GND_R = 7;
// Screw positions
const SCR1 = { x: CX, y: 36 };
const SCR2 = { x: CX, y: 150 };
// Receptacle body
const BODY_RX = 68, BODY_RY = 82, BODY_CY = 94;

// ─── Color helpers ─────────────────────────────────────────────────────────────
const HOT_COLOR    = "#FCA5A5"; // red-200
const NEU_COLOR    = "#93C5FD"; // blue-200
const GND_COLOR    = "#86EFAC"; // green-200
const OPEN_COLOR   = "#52525B"; // dimmer
const PHANTOM_COLOR = "#FBBF24"; // amber — phantom / ghost voltage

interface Props {
  obs: Observation;
  meta: Meta;
  result: Result;
}

// parse a reading to number | null
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

// ─── Fritting counter: simulates 33→4→0.3 Ω decay for display ────────────────
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

// ─── Ghost-voltage shimmer opacity oscillator ─────────────────────────────────
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

export function OutletPhysicsSVG({ obs, result }: Props) {
  const reduced = useReducedMotion();

  const VHN = num(obs.VHN);
  const VHG = num(obs.VHG);
  const VNG = num(obs.VNG);

  const reversed = isReversed(result, obs);
  const openGnd   = isOpenGroundFamily(result.topFault);
  const fritting  = obs.frittingObs === true;

  // Ghost: open-ground family AND phantom VHG (<70V measured, not null)
  const ghostVoltage = openGnd && VHG !== null && VHG < 70;

  const ghostOp = useGhostOpacity(ghostVoltage, reduced);
  const frittingVal = useFrittingValue(fritting, reduced);

  // Slot colors
  const hotColor  = reversed ? NEU_COLOR  : HOT_COLOR;
  const neuColor  = reversed ? HOT_COLOR  : NEU_COLOR;
  const gndColor  = openGnd  ? OPEN_COLOR : GND_COLOR;
  const gndGlowColor = ghostVoltage ? PHANTOM_COLOR : GND_COLOR;

  // Label voltage values
  const fmtV = (v: number | null) => v !== null ? `${v.toFixed(1)}V` : "—";

  // Flashing REV badge
  const [revFlash, setRevFlash] = useState(true);
  useEffect(() => {
    if (!reversed || reduced) return;
    const id = setInterval(() => setRevFlash((f) => !f), 550);
    return () => clearInterval(id);
  }, [reversed, reduced]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {/* Title row */}
      <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, letterSpacing: 1.5, fontWeight: 700, alignSelf: "flex-start" }}>
        RECEPTACLE PHYSICS
      </div>

      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ overflow: "visible" }}
        aria-label="NEMA 5-15 receptacle diagram"
      >
        <defs>
          {/* Ghost voltage gradient on ground */}
          <radialGradient id="opsvg-ghost" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={PHANTOM_COLOR} stopOpacity={ghostOp} />
            <stop offset="100%" stopColor={PHANTOM_COLOR} stopOpacity={0} />
          </radialGradient>
          {/* Glow filter */}
          <filter id="opsvg-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Shimmer gradient for ghost */}
          <linearGradient id="opsvg-shimmer" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={PHANTOM_COLOR} stopOpacity="0" />
            <stop offset="50%" stopColor={PHANTOM_COLOR} stopOpacity="0.6" />
            <stop offset="100%" stopColor={PHANTOM_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ── Receptacle body ── */}
        <ellipse
          cx={CX}
          cy={BODY_CY}
          rx={BODY_RX}
          ry={BODY_RY}
          fill="#1a1a20"
          stroke={C.border}
          strokeWidth={2}
        />
        {/* Face plate inner ring */}
        <ellipse
          cx={CX}
          cy={BODY_CY}
          rx={BODY_RX - 8}
          ry={BODY_RY - 8}
          fill="none"
          stroke={C.border}
          strokeWidth={1}
          opacity={0.4}
        />

        {/* ── Mounting screws ── */}
        <ScrewHead cx={SCR1.x} cy={SCR1.y} />
        <ScrewHead cx={SCR2.x} cy={SCR2.y} />

        {/* ── Neutral slot (left / wide) ── */}
        <rect
          x={NEU_X - SLOT_W / 2 - 1}
          y={SLOT_Y - SLOT_H / 2}
          width={SLOT_W + 2}
          height={SLOT_H}
          rx={3}
          fill={neuColor}
          opacity={0.88}
          style={{ filter: `drop-shadow(0 0 4px ${neuColor}99)` }}
        />
        <SlotLabel x={NEU_X - 20} y={SLOT_Y} label={reversed ? "HOT" : "NEU"} val={fmtV(VNG)} color={neuColor} align="end" />

        {/* ── Hot slot (right / narrow) ── */}
        <rect
          x={HOT_X - SLOT_W / 2}
          y={SLOT_Y - SLOT_H / 2}
          width={SLOT_W}
          height={SLOT_H}
          rx={3}
          fill={hotColor}
          opacity={0.88}
          style={{ filter: `drop-shadow(0 0 4px ${hotColor}99)` }}
        />
        <SlotLabel x={HOT_X + 17} y={SLOT_Y} label={reversed ? "NEU" : "HOT"} val={fmtV(VHN)} color={hotColor} align="start" />

        {/* ── Ground hole ── */}
        {/* Ghost glow halo when phantom voltage */}
        {ghostVoltage && (
          <circle
            cx={GND_X}
            cy={GND_Y}
            r={GND_R + 8}
            fill="url(#opsvg-ghost)"
            opacity={ghostOp}
          />
        )}
        {/* Ground pin */}
        <circle
          cx={GND_X}
          cy={GND_Y}
          r={GND_R}
          fill={openGnd ? OPEN_COLOR : gndColor}
          opacity={openGnd ? 0.5 : 0.88}
          style={{
            filter: ghostVoltage
              ? `drop-shadow(0 0 7px ${PHANTOM_COLOR})`
              : openGnd ? "none" : `drop-shadow(0 0 4px ${GND_COLOR}88)`,
          }}
        />
        {/* Shimmer overlay on ground when ghost */}
        {ghostVoltage && !reduced && (
          <circle
            cx={GND_X}
            cy={GND_Y}
            r={GND_R}
            fill="url(#opsvg-shimmer)"
            className="oi-shimmer"
          />
        )}
        {/* Dashed coupling line from Hot to Ground when ghost voltage */}
        {ghostVoltage && (
          <line
            x1={HOT_X}
            y1={SLOT_Y + SLOT_H / 2 + 4}
            x2={GND_X}
            y2={GND_Y - GND_R - 4}
            stroke={PHANTOM_COLOR}
            strokeWidth={1.2}
            strokeDasharray="3 4"
            opacity={ghostOp * 0.9}
            className={reduced ? undefined : "oi-flow"}
          />
        )}
        {/* Ground label */}
        <SlotLabel
          x={GND_X}
          y={GND_Y + GND_R + 14}
          label={openGnd ? "OPEN GND" : "GND"}
          val={fritting ? frittingVal : fmtV(VHG)}
          color={ghostVoltage ? PHANTOM_COLOR : gndGlowColor}
          align="middle"
          sublabel={ghostVoltage ? "phantom" : undefined}
        />

        {/* ── H→N voltage label (centre of face) ── */}
        {VHN !== null && (
          <text
            x={CX}
            y={BODY_CY + BODY_RY - 14}
            textAnchor="middle"
            fontFamily={mono}
            fontSize={9}
            fill={C.dimmer}
          >
            H↔N: {fmtV(VHN)}
          </text>
        )}

        {/* ── REV polarity badge ── */}
        {reversed && (
          <g>
            <rect
              x={CX - 20}
              y={BODY_CY - 14}
              width={40}
              height={17}
              rx={5}
              fill={revFlash ? "#7F1D1D" : "#1A0404"}
              stroke="#DC2626"
              strokeWidth={1.5}
            />
            <text
              x={CX}
              y={BODY_CY - 1}
              textAnchor="middle"
              fontFamily={mono}
              fontSize={10}
              fontWeight="bold"
              fill={revFlash ? "#FCA5A5" : "#DC262688"}
            >
              ⚡ REV
            </text>
          </g>
        )}

        {/* ── Fritting arc spark (decorative) ── */}
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

function SlotLabel({
  x, y, label, val, color, align, sublabel,
}: {
  x: number;
  y: number;
  label: string;
  val: string;
  color: string;
  align: "start" | "end" | "middle";
  sublabel?: string;
}) {
  const anch = align === "start" ? "start" : align === "end" ? "end" : "middle";
  return (
    <g>
      <text x={x} y={y - 6} textAnchor={anch} fontFamily={mono} fontSize={8} fill={color} fontWeight="bold" opacity={0.9}>
        {label}
      </text>
      <text x={x} y={y + 8} textAnchor={anch} fontFamily={mono} fontSize={9} fill={color} fontWeight="600">
        {val}
      </text>
      {sublabel && (
        <text x={x} y={y + 20} textAnchor={anch} fontFamily={mono} fontSize={7.5} fill={color} opacity={0.7} fontStyle="italic">
          {sublabel}
        </text>
      )}
    </g>
  );
}

function FrittingArc({ cx, cy }: { cx: number; cy: number }) {
  // A small jagged spark path to suggest arc discharge
  const spark = `M${cx - 6},${cy} l4,-5 l-3,3 l5,-7 l-3,4 l4,-3 l-3,5 l2,-2 l-6,6`;
  return (
    <path
      d={spark}
      fill="none"
      stroke="#FBBF24"
      strokeWidth={1.5}
      strokeLinecap="round"
      opacity={0.85}
      className="oi-glow"
    />
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ color: C.dimmer, fontFamily: mono, fontSize: 8.5 }}>{label}</span>
    </div>
  );
}
