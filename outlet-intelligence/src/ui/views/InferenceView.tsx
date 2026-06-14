/* ════════════════════════════════════════════════════════════════════════════
   DIAGNOSE — the per-outlet inference workbench. Halo-menu-grade HUD layout:
   left column = evidence inputs under diamond-tick section headers; right
   column = instrument cluster with LIVE TELEMETRY strip, VerdictCluster,
   Sensor Feed, PosteriorRace, NextBestTest, CriticTribunal, AI panel.
   All existing logic, handlers and AI panel are preserved exactly.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useMemo, useState } from "react";
import { useStore } from "../../state/store";
import {
  analyzeOutlet, FAULTS,
  type Observation, type Meta, type Era, type WireMaterial, type ThermalSlot,
} from "../../core";
import { buildShareableReport, escalationEligibility, callClaude } from "../../ai/report";
import { getSetting } from "../../data/storage";
import { C, HUD, mono } from "../theme";
import {
  Card, SubH, Row, Field, NumberInput, Select, TriToggle, Pill,
} from "../components";
import { AnimatedNumber, GlowCard } from "../anim";
import { Bracket } from "../hud/Bracket";
import { METER_NAMES, METERS } from "../meters";

import { VerdictCluster }    from "../viz/inference/VerdictCluster";
import { PosteriorRace }     from "../viz/inference/PosteriorRace";
import { CriticTribunalViz } from "../viz/inference/CriticTribunalViz";
import { OutletPhysicsSVG }  from "../viz/inference/OutletPhysicsSVG";

const ERAS: Era[]             = ["Pre-1990", "1990-2000", "2000-2010", "2010+", "Unknown"];
const WIRES: WireMaterial[]   = ["Copper", "Aluminum", "Unknown"];
const THERMALS: ThermalSlot[] = ["none", "H-slot", "N-slot", "both", "terminal"];

// ─── helpers ──────────────────────────────────────────────────────────────────
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

/** Classify a voltage reading as good/warn/bad for coloring */
function vClass(v: number | null, target: number): string {
  if (v === null) return C.dimmer;
  const delta = Math.abs(v - target);
  if (delta <= 6) return C.good;
  if (delta <= 15) return C.warn;
  return C.bad;
}

// ─── LIVE TELEMETRY strip ──────────────────────────────────────────────────────
function TelemetryStrip({ obs }: { obs: Observation }) {
  const VHN = num(obs.VHN);
  const VHG = num(obs.VHG);
  const VNG = num(obs.VNG);

  const readings: { label: string; v: number | null; target: number }[] = [
    { label: "H → N", v: VHN, target: 120 },
    { label: "H → G", v: VHG, target: 120 },
    { label: "N → G", v: VNG, target: 0 },
  ];

  return (
    <div
      className="oi-fadeup"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 0,
        background: `linear-gradient(90deg,${HUD.void}ee,${HUD.panel}ee,${HUD.void}ee)`,
        border: `1px solid ${HUD.cyan}33`,
        borderRadius: 10,
        padding: "10px 16px",
        backdropFilter: "blur(8px)",
        overflow: "hidden",
        boxShadow: `0 0 0 1px ${HUD.cyan}11`,
        marginBottom: 2,
      }}
    >
      <Bracket color={HUD.cyan} size={10} inset={3} weight={1} opacity={0.6} />

      {/* "LIVE" indicator */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        color: C.dimmer,
        fontFamily: mono,
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: 1.8,
        marginRight: 20,
        flexShrink: 0,
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: C.good,
          display: "inline-block",
          boxShadow: `0 0 6px ${C.good}`,
          animation: "oi-pulse 2s ease-in-out infinite",
        }} />
        LIVE TELEMETRY
      </div>

      {/* Voltage readouts */}
      <div style={{ display: "flex", gap: 24, flex: 1, justifyContent: "center", flexWrap: "wrap" }}>
        {readings.map(({ label, v, target }) => {
          const col = vClass(v, target);
          return (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ color: C.dimmer, fontFamily: mono, fontSize: 8, letterSpacing: 1 }}>{label}</span>
              <span style={{
                color: col,
                fontFamily: mono,
                fontSize: 22,
                fontWeight: 900,
                lineHeight: 1,
                textShadow: `0 0 12px ${col}99`,
              }}>
                {v !== null
                  ? <><AnimatedNumber value={v} decimals={1} /><span style={{ fontSize: 11, fontWeight: 400 }}>V</span></>
                  : <span style={{ fontSize: 14, color: C.dimmer }}>— V</span>
                }
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── HUD section header (diamond tick + letter-spaced label) ─────────────────
function HudSectionLabel({ text }: { text: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginTop: 14,
      marginBottom: 6,
    }}>
      <span style={{ color: HUD.cyan, fontSize: 7, lineHeight: 1 }}>◆</span>
      <span style={{
        color: HUD.cyan,
        fontFamily: mono,
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: "uppercase" as const,
      }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,${HUD.cyan}33,transparent)` }} />
    </div>
  );
}

export function InferenceView() {
  const { scratchObs, scratchMeta, setScratchObs, setScratchMeta, loadLiveCase } = useStore();
  const obs  = scratchObs;
  const meta = scratchMeta;
  const so = (k: keyof Observation, v: unknown) => setScratchObs({ ...obs, [k]: v });

  const result = useMemo(() => analyzeOutlet(obs, meta), [obs, meta]);
  const esc    = escalationEligibility(result);

  return (
    <>
      <style>{`
        .iv-grid {
          display: grid;
          gap: 14px;
          grid-template-columns: minmax(0,1fr);
          align-items: start;
        }
        @media (min-width: 900px) {
          .iv-grid {
            grid-template-columns: minmax(0, 1.1fr) minmax(360px, 0.9fr);
          }
        }
        .iv-input-col, .iv-result-col {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        /* Focus glow on all number inputs and selects inside the input column */
        .iv-input-col input:focus,
        .iv-input-col select:focus {
          outline: none;
          box-shadow: 0 0 0 2px ${HUD.cyan}55, 0 0 10px ${HUD.cyan}33;
          border-color: ${HUD.cyan}88 !important;
          transition: box-shadow 0.2s, border-color 0.2s;
        }
      `}</style>

      <div className="iv-grid">
        {/* ═══════════════════════════════════════════════════════════════════
            LEFT — EVIDENCE INPUTS + CONTEXT
            ═══════════════════════════════════════════════════════════════ */}
        <div className="iv-input-col">
          <Card
            title="EVIDENCE — enter what you measured"
            right={
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={loadLiveCase} style={miniBtn(C.amber)}>↻ Live case</button>
                <button onClick={() => setScratchObs({ thermalSlot: "none" })} style={miniBtn(C.dimmer)}>Clear</button>
              </div>
            }
          >
            <HudSectionLabel text="No-load voltages (VAC)" />
            <div style={grid3}>
              <Field label="V H→N"><NumberInput value={obs.VHN} onChange={(v) => so("VHN", v)} /></Field>
              <Field label="V H→G"><NumberInput value={obs.VHG} onChange={(v) => so("VHG", v)} /></Field>
              <Field label="V N→G"><NumberInput value={obs.VNG} onChange={(v) => so("VNG", v)} /></Field>
            </div>

            <HudSectionLabel text="Loaded measurements" />
            <div style={grid3}>
              <Field label="Load W">        <NumberInput value={obs.loadW}     onChange={(v) => so("loadW",     v)} /></Field>
              <Field label="V H→N loaded">  <NumberInput value={obs.vhnLoaded} onChange={(v) => so("vhnLoaded", v)} /></Field>
              <Field label="V N→G loaded">  <NumberInput value={obs.vngLoaded} onChange={(v) => so("vngLoaded", v)} /></Field>
              <Field label="V drop">        <NumberInput value={obs.dropV}     onChange={(v) => so("dropV",     v)} /></Field>
            </div>

            <HudSectionLabel text="Continuity (breaker OFF) & behaviour" />
            <div style={grid3}>
              <Field label="Ground cont Ω (OL=open)"><NumberInput value={obs.Gcont}      onChange={(v) => so("Gcont",       v)} /></Field>
              <Field label="Fritting decay?">         <TriToggle value={obs.frittingObs}  onChange={(v) => so("frittingObs", v)} /></Field>
              <Field label="Thermal hotspot">         <Select    value={obs.thermalSlot ?? "none"} options={THERMALS} onChange={(v) => so("thermalSlot", v)} /></Field>
              <Field label="Wiggle-sensitive?">       <TriToggle value={obs.wiggleObs}    onChange={(v) => so("wiggleObs",   v)} /></Field>
              <Field label="AFCI trips?">             <TriToggle value={obs.afciTrip}     onChange={(v) => so("afciTrip",    v)} /></Field>
              <Field label="GFCI trips?">             <TriToggle value={obs.gfciTrip}     onChange={(v) => so("gfciTrip",    v)} /></Field>
            </div>

            <HudSectionLabel text="Safety-critical checks" />
            <div style={grid3}>
              <Field label="Real ground wire?">      <TriToggle value={obs.hasGroundWire}   onChange={(v) => so("hasGroundWire",   v)} /></Field>
              <Field label="Gnd-pin→earth tested?">  <TriToggle value={obs.groundRefTested} onChange={(v) => so("groundRefTested", v)} /></Field>
            </div>
          </Card>

          <Card title="CONTEXT — sets priors & artifact interpretation">
            <div style={grid3}>
              <Field label="Build era">     <Select value={meta.era}     options={ERAS}        onChange={(v) => setScratchMeta({ era: v })} /></Field>
              <Field label="Wire material"> <Select value={meta.wireMat} options={WIRES}       onChange={(v) => setScratchMeta({ wireMat: v })} /></Field>
              <Field label="Meter">         <Select value={meta.meter}   options={METER_NAMES} onChange={(v) => setScratchMeta({ meter: v, meterZ: METERS[v].z })} /></Field>
            </div>
            <div style={{ marginTop: 8, color: C.dimmer, fontSize: 9.5, fontFamily: mono }}>
              Meter Z = {(meta.meterZ / 1e6).toFixed(2)} MΩ · CAT {METERS[meta.meter]?.cat} · {METERS[meta.meter]?.rms ? "True-RMS" : "averaging"}
            </div>
          </Card>

          {/* Leading hypothesis detail */}
          {result.topFault !== "healthy" && (
            <GlowCard accent={FAULTS[result.topFault]?.color} className="oi-fadeup">
              <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, letterSpacing: 1.5, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: FAULTS[result.topFault]?.color, fontSize: 7 }}>◆</span>
                LEADING HYPOTHESIS · {FAULTS[result.topFault].name.toUpperCase()}
              </div>
              <Row label="Discriminator" val={FAULTS[result.topFault].discriminator} />
              <Row label="Remedy"        val={FAULTS[result.topFault].remedy} />
              <Row label="NEC"           val={FAULTS[result.topFault].nec} monoFont />
              <Row label="Severity"      val={`${FAULTS[result.topFault].sev} / 10`} monoFont />
            </GlowCard>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT — INSTRUMENT CLUSTER
            ═══════════════════════════════════════════════════════════════ */}
        <div className="iv-result-col">

          {/* 0 — LIVE TELEMETRY strip */}
          <TelemetryStrip obs={obs} />

          {/* 1 — Verdict hero */}
          <VerdictCluster result={result} />

          {/* 2 — Sensor Feed (receptacle physics) */}
          <div className="oi-fadeup" style={{ display: "flex", justifyContent: "center" }}>
            <OutletPhysicsSVG obs={obs} meta={meta} result={result} />
          </div>

          {/* 3 — Posterior probability race */}
          <PosteriorRace post={result.post} topFault={result.topFault} />

          {/* 4 — Next-best test */}
          <NextBestTestPanel result={result} />

          {/* 5 — Critic tribunal */}
          <CriticTribunalViz critics={result.critics} />

          {/* 6 — AI second opinion */}
          <AIPanel obs={obs} meta={meta} result={result} esc={esc} />
        </div>
      </div>
    </>
  );
}

// ─── Next-Best-Test panel ──────────────────────────────────────────────────────
function NextBestTestPanel({ result }: { result: ReturnType<typeof analyzeOutlet> }) {
  if (result.nextBestTests.length === 0) {
    return (
      <GlowCard accent={C.amber} className="oi-fadeup">
        <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, letterSpacing: 1.5, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: C.amber, fontSize: 7 }}>◆</span>
          NEXT-BEST TEST
        </div>
        <div style={{ color: C.dim, fontSize: 11 }}>All candidate tests measured.</div>
      </GlowCard>
    );
  }

  const maxGain = Math.max(...result.nextBestTests.map((t) => t.gain), 0.001);

  return (
    <GlowCard accent={C.amber} className="oi-fadeup">
      <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, letterSpacing: 1.5, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: C.amber, fontSize: 7 }}>◆</span>
        NEXT-BEST TEST — BY INFORMATION GAIN
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {result.nextBestTests.map((t, i) => {
          const isPrimary = i === 0;
          const barPct = (t.gain / maxGain) * 100;
          return (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 10px",
                background: isPrimary ? C.amber + "12" : "transparent",
                borderRadius: 8,
                border: isPrimary ? `1px solid ${C.amber}44` : "none",
              }}
            >
              <div style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: isPrimary ? C.amber : C.panel2,
                color: isPrimary ? "#0A0A0C" : C.dimmer,
                fontFamily: mono,
                fontWeight: 800,
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                {i + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: isPrimary ? C.text : C.dim,
                  fontSize: 11.5,
                  fontWeight: isPrimary ? 700 : 400,
                  marginBottom: 4,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {t.label}
                </div>
                <div style={{ height: isPrimary ? 7 : 4, background: "#0A0A0E", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    width: `${barPct}%`,
                    height: "100%",
                    background: isPrimary ? C.amber : C.dimmer,
                    borderRadius: 4,
                    transition: "width 0.55s cubic-bezier(.2,.8,.2,1)",
                    boxShadow: isPrimary ? `0 0 6px ${C.amber}66` : undefined,
                  }} />
                </div>
              </div>

              <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 9.5, flexShrink: 0, textAlign: "right" }}>
                <AnimatedNumber value={t.gain} decimals={3} />
                <div style={{ fontSize: 8, color: C.dimmer + "88" }}>bits</div>
              </div>
            </div>
          );
        })}
      </div>
    </GlowCard>
  );
}

// ─── AI second-opinion panel (preserved exactly) ──────────────────────────────
function AIPanel({
  obs, meta, result, esc,
}: {
  obs: Observation;
  meta: Meta;
  result: ReturnType<typeof analyzeOutlet>;
  esc: ReturnType<typeof escalationEligibility>;
}) {
  const [copied,   setCopied]   = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [advisory, setAdvisory] = useState<string | null>(null);
  const [err,      setErr]      = useState<string | null>(null);
  const report = useMemo(() => buildShareableReport(obs, meta, result), [obs, meta, result]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Clipboard blocked — select & copy the text below.");
    }
  };

  const live = async () => {
    setBusy(true); setErr(null); setAdvisory(null);
    try {
      const key = await getSetting<string>("anthropicApiKey", "");
      if (!key) {
        setErr("No API key set. Add one in Settings, or use Copy report → paste into Claude.");
        return;
      }
      const a = await callClaude(key, report);
      setAdvisory(a.text);
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlowCard accent={C.blue} className="oi-fadeup" style={{ padding: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, letterSpacing: 1.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: C.blue, fontSize: 7 }}>◆</span>
          AI SECOND OPINION (advisory only)
        </div>
        {esc.eligible && <Pill color={C.amber}>escalation suggested</Pill>}
      </div>

      <div style={{ color: C.dim, fontSize: 11, lineHeight: 1.55, marginBottom: 10 }}>
        The deterministic engine above is the safety system and runs fully offline.
        This optional layer sends the evidence + critic transcript to Claude for novel/compound-fault
        reasoning.{" "}
        <b style={{ color: C.dimmer }}>It never overrides the safety verdict.</b>
        {esc.eligible && <span style={{ color: C.amber }}> · {esc.detail}</span>}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={copy} style={miniBtn(C.good)}>
          {copied ? "✓ Copied" : "⧉ Copy report → Claude"}
        </button>
        <button onClick={live} disabled={busy} style={miniBtn(C.blue)}>
          {busy ? "Calling…" : "↗ Live call (needs key)"}
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 10, color: "#FCA5A5", fontSize: 10.5, fontFamily: mono }}>
          {err}
        </div>
      )}

      {advisory && (
        <div style={{
          marginTop: 12,
          background: "#0B1220",
          border: `1px dashed ${C.blue}`,
          borderRadius: 10,
          padding: "12px 14px",
        }}>
          <div style={{ color: C.blue, fontSize: 9, fontFamily: mono, fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>
            ADVISORY — NOT A SAFETY VERDICT
          </div>
          <div style={{ color: C.text, fontSize: 11.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {advisory}
          </div>
        </div>
      )}

      <details style={{ marginTop: 10 }}>
        <summary style={{ color: C.dimmer, fontSize: 10, fontFamily: mono, cursor: "pointer" }}>
          Preview report text
        </summary>
        <textarea
          readOnly
          value={report}
          style={{ marginTop: 6, height: 160, fontFamily: mono, fontSize: 10.5, lineHeight: 1.5, width: "100%", boxSizing: "border-box" }}
        />
      </details>
    </GlowCard>
  );
}

// ─── Style helpers ─────────────────────────────────────────────────────────────
const grid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 8,
};

const miniBtn = (color: string): React.CSSProperties => ({
  background: "transparent",
  color,
  border: `1px solid ${color}`,
  borderRadius: 6,
  padding: "6px 9px",
  fontSize: 10.5,
  fontWeight: 700,
  fontFamily: mono,
  cursor: "pointer",
});
