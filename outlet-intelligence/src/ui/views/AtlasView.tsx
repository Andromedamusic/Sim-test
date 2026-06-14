import React, { useState } from "react";
import { FAULTS, FK, PHYSICS } from "../../core";
import type { Fault } from "../../core";
import { C, mono } from "../theme";
import { Card, SubH, Row, Tag } from "../components";

const SIG_ROWS: Array<{ key: keyof Fault["sig"]; label: string }> = [
  { key: "VHN", label: "V H→N" },
  { key: "VHG", label: "V H→G" },
  { key: "VNG", label: "V N→G" },
  { key: "Gcont", label: "Ground cont" },
  { key: "drop", label: "Loaded drop" },
];

function fmtGcont(v: number): string {
  if (v >= PHYSICS.BIG) return "OPEN";
  if (v > 999) return (v / 1000).toFixed(1) + "kΩ";
  return String(v);
}

function fmtReading(key: keyof Fault["sig"], mean: number): string {
  if (key === "Gcont") return fmtGcont(mean);
  return mean.toFixed(1);
}

/**
 * Sparkline: a tiny bar chart of sig means [VHN, VHG, VNG] relative to 120V.
 * Gives a quick fingerprint of each fault's voltage signature at a glance.
 */
function SigSparkline({ sig }: { sig: Fault["sig"] }) {
  const slots: Array<{ key: keyof Fault["sig"]; max: number; color: string }> = [
    { key: "VHN", max: 120, color: C.amber },
    { key: "VHG", max: 120, color: C.blue },
    { key: "VNG", max: 120, color: C.warn },
  ];
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 16, flexShrink: 0 }}>
      {slots.map(({ key, max, color }) => {
        const mean = sig[key][0];
        const pct = Math.min(mean / max, 1);
        return (
          <div
            key={key}
            title={`${key}: ${mean.toFixed(0)}V`}
            style={{
              width: 5,
              height: Math.max(2, pct * 16),
              background: color,
              borderRadius: 2,
              opacity: 0.85,
              transition: "height 0.25s ease",
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Radial severity gauge in the detail panel.
 * Draws a partial arc coloured by severity (0=green, 10=red).
 */
function SeverityGauge({ sev, color }: { sev: number; color: string }) {
  const SIZE = 80;
  const CX = SIZE / 2, CY = SIZE / 2;
  const R = 30;
  const GAP = 60; // degrees gap at bottom
  const START_DEG = 90 + GAP / 2;
  const ARC_DEG = 360 - GAP;

  const toRad = (d: number) => (d * Math.PI) / 180;
  const px = (r: number, deg: number) => CX + r * Math.cos(toRad(deg));
  const py = (r: number, deg: number) => CY + r * Math.sin(toRad(deg));

  const END_DEG = START_DEG + ARC_DEG;
  const bgPath = `M ${px(R, START_DEG)} ${py(R, START_DEG)} A ${R} ${R} 0 1 1 ${px(R, END_DEG)} ${py(R, END_DEG)}`;

  const fillDeg = ARC_DEG * (sev / 10);
  const fillEnd = START_DEG + fillDeg;
  const fgPath = fillDeg > 1
    ? `M ${px(R, START_DEG)} ${py(R, START_DEG)} A ${R} ${R} 0 ${fillDeg > 180 ? 1 : 0} 1 ${px(R, fillEnd)} ${py(R, fillEnd)}`
    : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: SIZE, height: SIZE }}>
        <path d={bgPath} fill="none" stroke={C.border} strokeWidth={6} strokeLinecap="round" />
        {fgPath && (
          <path
            d={fgPath}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
            style={{ transition: "stroke 0.4s" }}
          />
        )}
        <text x={CX} y={CY + 2} textAnchor="middle" fill={color} fontSize={18} fontWeight={900} fontFamily={mono}>
          {sev}
        </text>
        <text x={CX} y={CY + 14} textAnchor="middle" fill={C.dimmer} fontSize={7} fontFamily={mono}>
          /10
        </text>
      </svg>
      <span style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, marginTop: -4 }}>SEVERITY</span>
    </div>
  );
}

/** Inline keyframes injected once. */
const ATLAS_STYLES = `
@keyframes oi-pulse {
  0%,100%{opacity:1}
  50%{opacity:0.45}
}
@keyframes oi-popin {
  0%   { opacity:0; transform:scale(0.95) translateY(6px); }
  60%  { opacity:1; transform:scale(1.01) translateY(-1px); }
  100% { opacity:1; transform:scale(1)    translateY(0); }
}
`;

const sortedFK = [...FK].sort((a, b) => FAULTS[b].sev - FAULTS[a].sev);

export function AtlasView() {
  const [selected, setSelected] = useState<string>(sortedFK[0]);
  const f = FAULTS[selected];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: 16, boxSizing: "border-box", width: "100%" }}>
      <style>{ATLAS_STYLES}</style>

      {/* ── Left: fault list ── */}
      <div style={{
        minWidth: 240,
        flex: "1 1 240px",
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: "hidden",
      }}>
        <div style={{ padding: "10px 13px 6px", color: C.dimmer, fontSize: 9, fontFamily: mono, fontWeight: 700, letterSpacing: 1, borderBottom: `1px solid ${C.border}` }}>
          FAULT LIBRARY — {sortedFK.length} hypotheses
        </div>
        <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 180px)" }}>
          {sortedFK.map((id) => {
            const fault = FAULTS[id];
            const isActive = id === selected;
            const isLethal = fault.lethal;
            return (
              <div
                key={id}
                onClick={() => setSelected(id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 13px",
                  cursor: "pointer",
                  borderBottom: `1px solid ${C.border}`,
                  background: isActive ? C.panel2 : "transparent",
                  borderLeft: isActive ? `3px solid ${C.amber}` : "3px solid transparent",
                  transition: "background 0.1s",
                  // Lethal faults pulse to draw attention
                  animation: isLethal ? "oi-pulse 2s ease-in-out infinite" : "none",
                }}
              >
                {/* Severity chip */}
                <span style={{
                  background: fault.color,
                  color: "#0A0A0C",
                  fontFamily: mono,
                  fontWeight: 800,
                  fontSize: 10,
                  borderRadius: 5,
                  padding: "2px 6px",
                  minWidth: 22,
                  textAlign: "center",
                  flexShrink: 0,
                }}>
                  {fault.sev}
                </span>
                <span style={{ color: isActive ? C.text : C.dim, fontSize: 11, fontFamily: mono, flex: 1, lineHeight: 1.4 }}>
                  {fault.name}
                </span>
                {/* Voltage signature sparkline */}
                <SigSparkline sig={fault.sig} />
                {fault.lethal && (
                  <span style={{ fontSize: 12 }} title="Lethal">☠</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: detail panel — entrance animation keyed on selected fault ── */}
      <div
        key={selected}
        style={{
          minWidth: 300,
          flex: "2 1 300px",
          animation: "oi-popin 0.22s ease-out both",
        }}
      >
        <Card title={`FAULT — ${f.id.toUpperCase()}`}>
          {/* Name + tags + severity gauge side by side */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontSize: 15, fontFamily: mono, fontWeight: 700, marginBottom: 7 }}>
                {f.name}
              </div>
              <div>
                <Tag color={f.color} text={`Severity ${f.sev}/10`} />
                {f.lethal && <Tag color={C.danger} text="LETHAL" />}
                {f.energizedGnd && <Tag color={C.danger} text="ENERGIZED GROUND" />}
                {f.defeatsTester && <Tag color={C.bad} text="DEFEATS 3-LIGHT TESTER" />}
                <Tag color={C.blue} text={`NEC ${f.nec}`} />
              </div>
            </div>
            {/* Radial severity gauge */}
            <SeverityGauge sev={f.sev} color={f.color} />
          </div>

          <SubH text="DISCRIMINATOR & REMEDY" />
          <Row label="Discriminator" val={f.discriminator} />
          <Row label="Remedy" val={f.remedy} />

          <SubH text="SIGNATURE TABLE" />
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, padding: "4px 0", borderBottom: `1px solid ${C.border}`, marginBottom: 2 }}>
            {["Reading", "Expected", "±σ"].map((h) => (
              <span key={h} style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, fontWeight: 700 }}>{h}</span>
            ))}
          </div>
          {SIG_ROWS.map(({ key, label }) => {
            const [mean, sigma] = f.sig[key];
            const expectedStr = fmtReading(key, mean);
            const sigmaStr = key === "Gcont"
              ? (mean >= PHYSICS.BIG ? "—" : sigma.toFixed(1))
              : sigma.toFixed(1);
            return (
              <div
                key={key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 4,
                  padding: "5px 0",
                  borderBottom: `1px solid ${C.border}`,
                  alignItems: "center",
                }}
              >
                <span style={{ color: C.dim, fontSize: 10, fontFamily: mono }}>{label}</span>
                <span style={{ color: C.text, fontSize: 11, fontFamily: mono }}>{expectedStr}</span>
                <span style={{ color: C.dimmer, fontSize: 10, fontFamily: mono }}>{sigmaStr}</span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
