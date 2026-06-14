import React, { useState } from "react";
import { FAULTS, FK, PHYSICS } from "../../core";
import type { Fault } from "../../core";
import { C, HUD, mono, sans, glow } from "../theme";
import { Card, SectionHeader, SubH, Row, Tag } from "../components";
import { RadialGauge, Sparkline, useReducedMotion } from "../anim";
import { Bracket } from "../hud/Bracket";

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

/** Sig sparkline redrawn from the three voltage keys. */
function SigSparkline({ sig }: { sig: Fault["sig"] }) {
  const vals = [sig.VHN[0], sig.VHG[0], sig.VNG[0]];
  return (
    <Sparkline
      data={vals}
      width={36}
      height={16}
      color={HUD.cyan}
      fill
    />
  );
}

const sortedFK = [...FK].sort((a, b) => FAULTS[b].sev - FAULTS[a].sev);

export function AtlasView() {
  const [selected, setSelected] = useState<string>(sortedFK[0]);
  const reduced = useReducedMotion();
  const f = FAULTS[selected];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: 16, boxSizing: "border-box", width: "100%" }}>

      {/* ── Left: fault roster ── */}
      <div style={{
        minWidth: "min(240px,100%)",
        flex: "1 1 240px",
        background: HUD.panel,
        border: `1px solid ${HUD.line}`,
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
      }}>
        <Bracket color={HUD.cyan} size={10} inset={4} weight={1.5} opacity={0.5} />

        {/* Roster header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "10px 13px 8px",
          borderBottom: `1px solid ${HUD.line}`,
        }}>
          <span style={{
            width: 5,
            height: 5,
            background: HUD.cyan,
            boxShadow: glow(HUD.cyan, 0.7),
            transform: "rotate(45deg)",
            flexShrink: 0,
          }} />
          <span style={{ color: HUD.cyan, fontSize: 10, fontFamily: mono, fontWeight: 800, letterSpacing: 1.5, flex: 1 }}>
            FAULT LIBRARY
          </span>
          <span style={{
            color: HUD.dim,
            fontSize: 10,
            fontFamily: mono,
            background: HUD.glass,
            border: `1px solid ${HUD.lineHi}`,
            borderRadius: 4,
            padding: "1px 6px",
          }}>
            {sortedFK.length}
          </span>
        </div>

        {/* Roster list */}
        <div
          className={reduced ? "" : "oi-stagger"}
          style={{ overflowY: "auto", maxHeight: "calc(100vh - 180px)" }}
        >
          {sortedFK.map((id) => {
            const fault = FAULTS[id];
            const isActive = id === selected;
            const isLethal = fault.lethal;
            return (
              <div
                key={id}
                className="oi-lift"
                onClick={() => setSelected(id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 13px",
                  cursor: "pointer",
                  borderBottom: `1px solid ${HUD.line}`,
                  background: isActive
                    ? `linear-gradient(90deg,${HUD.cyan}12,transparent)`
                    : "transparent",
                  borderLeft: isActive
                    ? `2px solid ${HUD.cyan}`
                    : "2px solid transparent",
                  transition: "background 0.15s, border-color 0.15s",
                  boxShadow: isActive ? `inset 0 0 0 1px ${HUD.cyan}18` : "none",
                }}
              >
                {/* Severity chip */}
                <span style={{
                  background: fault.color + "22",
                  color: fault.color,
                  border: `1px solid ${fault.color}66`,
                  fontFamily: mono,
                  fontWeight: 800,
                  fontSize: 10,
                  borderRadius: 4,
                  padding: "2px 6px",
                  minWidth: 22,
                  textAlign: "center",
                  flexShrink: 0,
                  boxShadow: isActive ? glow(fault.color, 0.35) : "none",
                }}>
                  {fault.sev}
                </span>

                <span style={{
                  color: isActive ? HUD.text : HUD.dim,
                  fontSize: 11,
                  fontFamily: mono,
                  flex: 1,
                  lineHeight: 1.4,
                  letterSpacing: 0.2,
                }}>
                  {fault.name}
                </span>

                <SigSparkline sig={fault.sig} />

                {isLethal && (
                  <span
                    className={reduced ? "" : "oi-pulse"}
                    title="Lethal"
                    style={{ fontSize: 11, color: C.danger }}
                  >
                    ☠
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: fault dossier ── */}
      <div
        key={selected}
        className={reduced ? "" : "oi-popin"}
        style={{ minWidth: "min(300px,100%)", flex: "2 1 300px" }}
      >
        <Card title={`FAULT DOSSIER — ${f.id.toUpperCase()}`}>
          {/* Hero: name + severity gauge, bracketed */}
          <div style={{ position: "relative", padding: "12px 0 10px" }}>
            <Bracket color={HUD.cyan} size={8} inset={-2} weight={1} opacity={0.4} />
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  color: HUD.text,
                  fontSize: 15,
                  fontFamily: mono,
                  fontWeight: 700,
                  marginBottom: 8,
                  letterSpacing: 0.3,
                }}>
                  {f.name}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  <Tag color={f.color} text={`SEV ${f.sev}/10`} />
                  {f.lethal && <Tag color={C.danger} text="LETHAL" />}
                  {f.energizedGnd && <Tag color={C.danger} text="ENERGIZED GND" />}
                  {f.defeatsTester && <Tag color={C.bad} text="DEFEATS 3-LIGHT" />}
                  <Tag color={HUD.cyan} text={`NEC ${f.nec}`} />
                </div>
              </div>

              {/* Shared RadialGauge from anim */}
              <div style={{ flexShrink: 0 }}>
                <RadialGauge
                  value={f.sev}
                  max={10}
                  size={88}
                  thickness={8}
                  color={f.color}
                  track={HUD.line}
                  label={String(f.sev)}
                  sublabel="SEVERITY"
                  glow
                />
              </div>
            </div>
          </div>

          {/* Voltage-signature sparkline across the full width */}
          <SectionHeader label="VOLTAGE FINGERPRINT" style={{ margin: "12px 0 6px" }} />
          <div style={{
            padding: "8px 0 4px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}>
            <Sparkline
              data={[f.sig.VHN[0], f.sig.VHG[0], f.sig.VNG[0], f.sig.VNG[0] * 0.5, f.sig.drop[0]]}
              width={160}
              height={32}
              color={HUD.cyan}
              fill
            />
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { label: "VHN", val: f.sig.VHN[0], color: C.amber },
                { label: "VHG", val: f.sig.VHG[0], color: HUD.cyan },
                { label: "VNG", val: f.sig.VNG[0], color: C.warn },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span style={{ color, fontSize: 12, fontFamily: mono, fontWeight: 700 }}>
                    {val.toFixed(0)}
                  </span>
                  <span style={{ color: HUD.dim, fontSize: 10, fontFamily: mono }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Discriminator + Remedy */}
          <SectionHeader label="DISCRIMINATOR & REMEDY" style={{ margin: "12px 0 6px" }} />
          <Row label="Discriminator" val={f.discriminator} />
          <Row label="Remedy" val={f.remedy} />

          {/* Signature table */}
          <SectionHeader label="SIGNATURE TABLE" style={{ margin: "12px 0 6px" }} />
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 4,
            padding: "4px 0 6px",
            borderBottom: `1px solid ${HUD.line}`,
          }}>
            {["Reading", "Expected", "±σ"].map((h) => (
              <span key={h} style={{ color: HUD.dim, fontSize: 10, fontFamily: mono, fontWeight: 700, letterSpacing: 1 }}>
                {h}
              </span>
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
                  borderBottom: `1px solid ${HUD.line}`,
                  alignItems: "center",
                }}
              >
                <span style={{ color: HUD.dim, fontSize: 10, fontFamily: mono }}>{label}</span>
                <span style={{ color: HUD.text, fontSize: 11, fontFamily: mono, fontWeight: 600 }}>{expectedStr}</span>
                <span style={{ color: HUD.dim, fontSize: 10, fontFamily: mono }}>{sigmaStr}</span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
