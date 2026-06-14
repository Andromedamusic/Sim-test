/* ════════════════════════════════════════════════════════════════════════════
   CircuitTrace — SVG <g> that draws animated "current flow" polylines
   connecting all outlets belonging to one circuit. Outlets are sorted by
   position (x then y) to give a coherent wiring-run visual. Uses the
   oi-flow CSS class from anim.tsx for animated dash offset (oi-dash keyframe).
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import type { OutletNode } from "../../../core";

export interface CircuitTraceProps {
  /** All outlets on this circuit that are on the current floor. */
  outlets: OutletNode[];
  /** World-coordinate map keyed by outlet id. */
  positions: Map<string, { x: number; y: number }>;
  /** Stroke colour — typically the circuit's dominant verdict colour. */
  color: string;
}

export function CircuitTrace({ outlets, positions, color }: CircuitTraceProps) {
  if (outlets.length < 2) return null;

  // Collect valid positioned points
  const pts: Array<{ x: number; y: number; id: string }> = [];
  for (const o of outlets) {
    const p = positions.get(o.id);
    if (p) pts.push({ ...p, id: o.id });
  }
  if (pts.length < 2) return null;

  // Sort by x first, then y — approximates a wiring run order
  pts.sort((a, b) => a.x - b.x || a.y - b.y);

  const pointsAttr = pts.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <g aria-label="circuit-trace">
      {/* ── dim shadow for contrast behind the animated line ── */}
      <polyline
        points={pointsAttr}
        fill="none"
        stroke="#0A0A0C"
        strokeWidth={0.12}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
      />

      {/* ── animated current-flow line ── */}
      <polyline
        points={pointsAttr}
        fill="none"
        stroke={color}
        strokeWidth={0.06}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
        className="oi-flow"
      />

      {/* ── junction dots at each outlet location ── */}
      {pts.map((p) => (
        <circle
          key={p.id}
          cx={p.x}
          cy={p.y}
          r={0.07}
          fill={color}
          opacity={0.6}
        />
      ))}
    </g>
  );
}
