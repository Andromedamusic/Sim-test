import React, { useState } from "react";
import { prognose } from "../../core";
import { C, mono } from "../theme";
import { Card, SubH } from "../components";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, step, unit, onChange }: SliderProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 180px", minWidth: 180 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ color: C.dim, fontSize: 10, fontFamily: mono }}>{label}</span>
        <span style={{ color: C.amber, fontFamily: mono, fontWeight: 700, fontSize: 14 }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ accentColor: C.amber, width: "100%", cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: C.dimmer, fontSize: 9, fontFamily: mono }}>{min}{unit}</span>
        <span style={{ color: C.dimmer, fontSize: 9, fontFamily: mono }}>{max}{unit}</span>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  color?: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div style={{
      background: C.panel2,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: "12px 16px",
      flex: "1 1 140px",
      minWidth: 140,
    }}>
      <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ color: color ?? C.text, fontSize: 20, fontFamily: mono, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

/** Build SVG path for temp vs load current 0..20A */
function buildCurve(R: number, amb: number): string {
  // Tterm = amb + A*A*R*RTH_TERM  where RTH_TERM = 12
  const RTH = 12;
  const W = 320;
  const H = 220;
  const padL = 36;
  const padR = 12;
  const padT = 14;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxT = 200; // y axis max °C
  const maxA = 20;

  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * maxA;
    const t = Math.min(amb + a * a * R * RTH, maxT);
    const x = padL + (a / maxA) * plotW;
    const y = padT + plotH - (t / maxT) * plotH;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return "M " + pts.join(" L ");
}

function tempToY(t: number, padT: number, plotH: number, maxT: number): number {
  return padT + plotH - (Math.min(t, maxT) / maxT) * plotH;
}

export function PrognosisView() {
  const [R, setR] = useState(0.5);
  const [A, setA] = useState(12);
  const [amb, setAmb] = useState(25);

  const p = prognose(R, A, amb);

  const runawaySuffix = p.runaway ? "IMMINENT" : `~${p.months} months`;

  // SVG geometry
  const W = 320;
  const H = 220;
  const padL = 36;
  const padR = 12;
  const padT = 14;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxT = 200;
  const maxA = 20;
  const RTH = 12;

  const curvePath = buildCurve(R, amb);

  // Marker dot at current A
  const markerT = Math.min(amb + A * A * R * RTH, maxT);
  const markerX = padL + (A / maxA) * plotW;
  const markerY = tempToY(markerT, padT, plotH, maxT);

  // Band y positions
  const y60 = tempToY(60, padT, plotH, maxT);
  const y90 = tempToY(90, padT, plotH, maxT);
  const y120 = tempToY(120, padT, plotH, maxT);
  const y150 = tempToY(150, padT, plotH, maxT);
  const yBottom = padT + plotH;

  // X-axis tick helpers
  const xTicks = [0, 5, 10, 15, 20];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: 16, boxSizing: "border-box", width: "100%" }}>
      {/* ── Left: controls + stats ── */}
      <div style={{ flex: "1 1 300px", minWidth: 300, display: "flex", flexDirection: "column", gap: 14 }}>
        <Card title="ARRHENIUS THERMAL-RUNAWAY EXPLORER">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 4 }}>
            <Slider label="Terminal resistance R" value={R} min={0.05} max={8} step={0.05} unit=" Ω" onChange={setR} />
            <Slider label="Load current" value={A} min={1} max={20} step={1} unit=" A" onChange={setA} />
            <Slider label="Ambient temperature" value={amb} min={10} max={50} step={1} unit=" °C" onChange={setAmb} />
          </div>
        </Card>

        {/* Stat cards */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <StatCard label="POWER DISSIPATED" value={`${p.P} W`} />
          <StatCard label="TERMINAL TEMP" value={`${p.Tterm} °C`} color={p.sColor} />
          <StatCard
            label="EST. TIME TO RUNAWAY"
            value={runawaySuffix}
            color={p.runaway ? C.danger : C.text}
          />
        </div>

        {/* Status banner */}
        <div style={{
          background: p.sColor + "18",
          border: `1px solid ${p.sColor}`,
          borderRadius: 10,
          padding: "10px 14px",
        }}>
          <div style={{ color: p.sColor, fontFamily: mono, fontWeight: 800, fontSize: 13, marginBottom: 5 }}>
            {p.status}
          </div>
          <div style={{ color: C.dim, fontSize: 10, fontFamily: mono, lineHeight: 1.6 }}>
            I²R heating (P = {p.P} W) raises terminal temp via thermal resistance. Copper-oxide
            growth rate follows Arrhenius kinetics (Ea ≈ 0.7 eV) — resistance increases
            with temperature in positive feedback. Above ~120–150 °C, oxide bridges fail
            and runaway ignition becomes imminent.
          </div>
        </div>
      </div>

      {/* ── Right: SVG chart ── */}
      <div style={{ flex: "1 1 320px", minWidth: 280 }}>
        <Card title="TERMINAL TEMP vs LOAD CURRENT">
          <div style={{ overflowX: "auto" }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, display: "block", fontFamily: mono }}>
              {/* Danger band 60–90°C: warm */}
              <rect x={padL} y={y90} width={plotW} height={y60 - y90}
                fill={C.warn + "22"} />
              {/* Band 90–120°C: hot */}
              <rect x={padL} y={y120} width={plotW} height={y90 - y120}
                fill={C.bad + "22"} />
              {/* Band 120+°C: danger */}
              <rect x={padL} y={padT} width={plotW} height={y120 - padT}
                fill={C.danger + "28"} />

              {/* 60°C line */}
              <line x1={padL} y1={y60} x2={padL + plotW} y2={y60}
                stroke={C.warn} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
              <text x={padL + 2} y={y60 - 3} fill={C.warn} fontSize={8}>60°C</text>

              {/* 90°C line */}
              <line x1={padL} y1={y90} x2={padL + plotW} y2={y90}
                stroke={C.bad} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
              <text x={padL + 2} y={y90 - 3} fill={C.bad} fontSize={8}>90°C</text>

              {/* 120°C line */}
              <line x1={padL} y1={y120} x2={padL + plotW} y2={y120}
                stroke={C.danger} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
              <text x={padL + 2} y={y120 - 3} fill={C.danger} fontSize={8}>120°C</text>

              {/* 150°C runaway line — dashed */}
              <line x1={padL} y1={y150} x2={padL + plotW} y2={y150}
                stroke={C.danger} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.9} />
              <text x={padL + 2} y={y150 - 3} fill={C.danger} fontSize={8} fontWeight="bold">150°C RUNAWAY</text>

              {/* Bottom + left axes */}
              <line x1={padL} y1={yBottom} x2={padL + plotW} y2={yBottom} stroke={C.border} strokeWidth={1} />
              <line x1={padL} y1={padT} x2={padL} y2={yBottom} stroke={C.border} strokeWidth={1} />

              {/* X-axis ticks */}
              {xTicks.map((a) => {
                const x = padL + (a / maxA) * plotW;
                return (
                  <g key={a}>
                    <line x1={x} y1={yBottom} x2={x} y2={yBottom + 4} stroke={C.dimmer} strokeWidth={1} />
                    <text x={x} y={yBottom + 12} fill={C.dimmer} fontSize={8} textAnchor="middle">{a}A</text>
                  </g>
                );
              })}

              {/* Y-axis ticks */}
              {[0, 50, 100, 150, 200].map((t) => {
                const y = tempToY(t, padT, plotH, maxT);
                return (
                  <g key={t}>
                    <line x1={padL - 3} y1={y} x2={padL} y2={y} stroke={C.dimmer} strokeWidth={1} />
                    <text x={padL - 5} y={y + 3} fill={C.dimmer} fontSize={7} textAnchor="end">{t}</text>
                  </g>
                );
              })}

              {/* The curve */}
              <path d={curvePath} fill="none" stroke={C.amber} strokeWidth={2} />

              {/* Marker dot at current A */}
              <circle cx={markerX} cy={markerY} r={5} fill={p.sColor} stroke="#0A0A0C" strokeWidth={2} />
              <line x1={markerX} y1={markerY} x2={markerX} y2={yBottom}
                stroke={p.sColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
            </svg>
          </div>
          <SubH text="LEGEND" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {[
              { color: C.amber, label: "Tterm curve" },
              { color: C.warn, label: "60–90°C elevated" },
              { color: C.bad, label: "90–120°C accelerated" },
              { color: C.danger, label: ">120°C / runaway" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 12, height: 3, background: color, borderRadius: 2 }} />
                <span style={{ color: C.dimmer, fontSize: 9, fontFamily: mono }}>{label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
