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

const sortedFK = [...FK].sort((a, b) => FAULTS[b].sev - FAULTS[a].sev);

export function AtlasView() {
  const [selected, setSelected] = useState<string>(sortedFK[0]);
  const f = FAULTS[selected];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: 16, boxSizing: "border-box", width: "100%" }}>
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
                {fault.lethal && (
                  <span style={{ fontSize: 12 }} title="Lethal">☠</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: detail panel ── */}
      <div style={{ minWidth: 300, flex: "2 1 300px" }}>
        <Card title={`FAULT — ${f.id.toUpperCase()}`}>
          {/* Name + tags */}
          <div style={{ marginBottom: 10 }}>
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
