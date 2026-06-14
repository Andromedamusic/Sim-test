/* ════════════════════════════════════════════════════════════════════════════
   OutletMarker — SVG <g> representing one outlet on the floorplan.
   Color-coded by verdictCode; glowing pulsing halo for lethal/hold outlets;
   highlighted/dimmed variants for circuit-selector focus mode.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import type { OutletNode } from "../../../core";
import { VERDICT_COLOR } from "../../theme";

/** Fault IDs considered immediately lethal. */
const LETHAL_IDS = new Set(["reversed_pol", "bootleg_gnd", "reverse_bootleg"]);

function isLethal(outlet: OutletNode): boolean {
  if (!outlet.inference) return false;
  if (outlet.inference.hold) return true;
  const top = outlet.inference.topFault;
  return LETHAL_IDS.has(top) && (outlet.inference.ranked[0]?.[1] ?? 0) > 0.4;
}

export interface OutletMarkerProps {
  outlet: OutletNode;
  x: number;
  y: number;
  /** Highlighted by the circuit selector — enlarged + glow. */
  highlighted?: boolean;
  /** Dimmed because another circuit is selected. */
  dimmed?: boolean;
  /** When true, suppress SVG <animate> elements for prefers-reduced-motion. */
  reduced?: boolean;
  onTap: () => void;
}

export function OutletMarker({ outlet, x, y, highlighted = false, dimmed = false, reduced = false, onTap }: OutletMarkerProps) {
  const v = outlet.inference?.verdictCode;
  // Unobserved → gray dashed ring
  const observed = !!outlet.inference;
  const color = observed ? (v ? (VERDICT_COLOR[v] ?? "#9CA3AF") : "#9CA3AF") : "#52525B";
  const lethal = isLethal(outlet);

  // Radius scales: normal=0.18, highlighted=0.24, dimmed=0.14
  const r = highlighted ? 0.24 : dimmed ? 0.14 : 0.18;
  const ringR = r + 0.06;
  const opacity = dimmed ? 0.35 : 1;

  return (
    <g
      style={{ cursor: "pointer", opacity, transition: "opacity 0.25s" }}
      onClick={onTap}
      aria-label={outlet.label}
    >
      {/* ── lethal pulsing danger halo (two expanding rings for drama) ── */}
      {lethal && !dimmed && (
        <>
          <circle
            cx={x}
            cy={y}
            r={ringR + 0.1}
            fill="none"
            stroke="#DC2626"
            strokeWidth={0.05}
            className="oi-pulse"
            style={{ opacity: 0.7, transformOrigin: `${x}px ${y}px` }}
          />
          <circle cx={x} cy={y} r={ringR + 0.06} fill="none" stroke="#DC2626" strokeWidth={0.03}>
            {!reduced && <animate attributeName="r" values={`${ringR};${ringR + 0.22};${ringR}`} dur="1.5s" repeatCount="indefinite" />}
            {!reduced && <animate attributeName="opacity" values="0.8;0;0.8" dur="1.5s" repeatCount="indefinite" />}
          </circle>
        </>
      )}

      {/* ── outer glow ring ── */}
      {observed && (
        <circle
          cx={x}
          cy={y}
          r={ringR}
          fill="none"
          stroke={color}
          strokeWidth={highlighted ? 0.055 : 0.03}
          opacity={highlighted ? 0.85 : 0.45}
          style={{
            filter: highlighted ? `drop-shadow(0 0 0.12px ${color})` : undefined,
            transition: "r 0.2s, stroke-width 0.2s, opacity 0.2s",
          }}
        />
      )}

      {/* ── main body circle ── */}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={color}
        stroke="#0A0A0C"
        strokeWidth={observed ? 0.04 : 0}
        strokeDasharray={observed ? undefined : "0.15 0.08"}
        style={{
          transition: "r 0.2s, fill 0.3s",
          filter: highlighted && observed ? `drop-shadow(0 0 0.18px ${color}aa)` : undefined,
        }}
      />

      {/* ── unobserved: dashed gray ring instead of fill ── */}
      {!observed && (
        <circle
          cx={x}
          cy={y}
          r={r}
          fill="#0A0A0C"
          stroke="#52525B"
          strokeWidth={0.04}
          strokeDasharray="0.18 0.1"
        />
      )}

      {/* ── center dot (outlet face illusion) ── */}
      <circle cx={x} cy={y} r={r * 0.38} fill="#0A0A0C" opacity={0.9} />

      {/* ── highlight ring accent ── */}
      {highlighted && (
        <circle
          cx={x}
          cy={y}
          r={r + 0.11}
          fill="none"
          stroke={color}
          strokeWidth={0.025}
          opacity={0.5}
          className="oi-glow"
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      )}
    </g>
  );
}
