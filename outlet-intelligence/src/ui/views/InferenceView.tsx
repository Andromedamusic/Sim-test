/* ════════════════════════════════════════════════════════════════════════════
   DIAGNOSE — the per-outlet inference workbench. Enter measurements, read the
   adjudicated verdict + posterior + critic tribunal + next-best-test, and
   escalate to an AI second opinion (copy report, or optional live call).

   Layout: two-column (input left / instrument cluster right) above 900 px,
   single column below. All existing logic and AI panel is preserved.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useMemo, useState } from "react";
import { useStore } from "../../state/store";
import {
  analyzeOutlet, FAULTS,
  type Observation, type Meta, type Era, type WireMaterial, type ThermalSlot,
} from "../../core";
import { buildShareableReport, escalationEligibility, callClaude } from "../../ai/report";
import { getSetting } from "../../data/storage";
import { C, mono } from "../theme";
import {
  Card, SubH, Row, Field, NumberInput, Select, TriToggle, Pill,
} from "../components";
import { AnimatedNumber, GlowCard } from "../anim";
import { METER_NAMES, METERS } from "../meters";

// Viz sub-components (created alongside this file)
import { VerdictCluster }    from "../viz/inference/VerdictCluster";
import { PosteriorRace }     from "../viz/inference/PosteriorRace";
import { CriticTribunalViz } from "../viz/inference/CriticTribunalViz";
import { OutletPhysicsSVG }  from "../viz/inference/OutletPhysicsSVG";

const ERAS: Era[]           = ["Pre-1990", "1990-2000", "2000-2010", "2010+", "Unknown"];
const WIRES: WireMaterial[] = ["Copper", "Aluminum", "Unknown"];
const THERMALS: ThermalSlot[] = ["none", "H-slot", "N-slot", "both", "terminal"];

export function InferenceView() {
  const { scratchObs, scratchMeta, setScratchObs, setScratchMeta, loadLiveCase } = useStore();
  const obs  = scratchObs;
  const meta = scratchMeta;
  const so = (k: keyof Observation, v: unknown) => setScratchObs({ ...obs, [k]: v });

  const result = useMemo(() => analyzeOutlet(obs, meta), [obs, meta]);
  const esc    = escalationEligibility(result);

  return (
    <>
      {/* Responsive two-column grid */}
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
                <button onClick={() => setScratchObs({ thermalSlot: "none" })} style={miniBtn(C.dim)}>Clear</button>
              </div>
            }
          >
            <SubH text="No-load voltages (VAC)" />
            <div style={grid3}>
              <Field label="V H→N"><NumberInput value={obs.VHN} onChange={(v) => so("VHN", v)} /></Field>
              <Field label="V H→G"><NumberInput value={obs.VHG} onChange={(v) => so("VHG", v)} /></Field>
              <Field label="V N→G"><NumberInput value={obs.VNG} onChange={(v) => so("VNG", v)} /></Field>
            </div>

            <SubH text="Loaded measurements" />
            <div style={grid3}>
              <Field label="Load W"><NumberInput value={obs.loadW}      onChange={(v) => so("loadW",      v)} /></Field>
              <Field label="V H→N loaded"><NumberInput value={obs.vhnLoaded}  onChange={(v) => so("vhnLoaded",  v)} /></Field>
              <Field label="V N→G loaded"><NumberInput value={obs.vngLoaded}  onChange={(v) => so("vngLoaded",  v)} /></Field>
              <Field label="V drop"><NumberInput value={obs.dropV}     onChange={(v) => so("dropV",      v)} /></Field>
            </div>

            <SubH text="Continuity (breaker OFF) & behaviour" />
            <div style={grid3}>
              <Field label="Ground cont Ω (OL=open)"><NumberInput value={obs.Gcont}      onChange={(v) => so("Gcont",      v)} /></Field>
              <Field label="Fritting decay?">        <TriToggle value={obs.frittingObs}  onChange={(v) => so("frittingObs",v)} /></Field>
              <Field label="Thermal hotspot">        <Select    value={obs.thermalSlot ?? "none"} options={THERMALS} onChange={(v) => so("thermalSlot", v)} /></Field>
              <Field label="Wiggle-sensitive?">      <TriToggle value={obs.wiggleObs}    onChange={(v) => so("wiggleObs",  v)} /></Field>
              <Field label="AFCI trips?">            <TriToggle value={obs.afciTrip}     onChange={(v) => so("afciTrip",   v)} /></Field>
              <Field label="GFCI trips?">            <TriToggle value={obs.gfciTrip}     onChange={(v) => so("gfciTrip",   v)} /></Field>
            </div>

            <SubH text="Safety-critical checks" />
            <div style={grid3}>
              <Field label="Real ground wire?">       <TriToggle value={obs.hasGroundWire}    onChange={(v) => so("hasGroundWire",    v)} /></Field>
              <Field label="Gnd-pin→earth tested?">   <TriToggle value={obs.groundRefTested}  onChange={(v) => so("groundRefTested",  v)} /></Field>
            </div>
          </Card>

          <Card title="CONTEXT — sets priors & artifact interpretation">
            <div style={grid3}>
              <Field label="Build era">     <Select value={meta.era}     options={ERAS}       onChange={(v) => setScratchMeta({ era: v })} /></Field>
              <Field label="Wire material"> <Select value={meta.wireMat} options={WIRES}      onChange={(v) => setScratchMeta({ wireMat: v })} /></Field>
              <Field label="Meter">         <Select value={meta.meter}   options={METER_NAMES} onChange={(v) => setScratchMeta({ meter: v, meterZ: METERS[v].z })} /></Field>
            </div>
            <div style={{ marginTop: 8, color: C.dimmer, fontSize: 9.5, fontFamily: mono }}>
              Meter Z = {(meta.meterZ / 1e6).toFixed(2)} MΩ · CAT {METERS[meta.meter]?.cat} · {METERS[meta.meter]?.rms ? "True-RMS" : "averaging"}
            </div>
          </Card>

          {/* Leading hypothesis detail card (left column, beneath context) */}
          {result.topFault !== "healthy" && (
            <GlowCard accent={FAULTS[result.topFault]?.color} className="oi-fadeup">
              <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, letterSpacing: 1.5, fontWeight: 700, marginBottom: 8 }}>
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

          {/* 1 — Verdict hero */}
          <VerdictCluster result={result} />

          {/* 2 — Receptacle physics diagram */}
          <GlowCard accent={result.vColor} style={{ display: "flex", justifyContent: "center", padding: "16px 12px" }} className="oi-fadeup">
            <OutletPhysicsSVG obs={obs} meta={meta} result={result} />
          </GlowCard>

          {/* 3 — Posterior probability race */}
          <PosteriorRace post={result.post} topFault={result.topFault} />

          {/* 4 — Next-best test, animated */}
          <NextBestTestPanel result={result} />

          {/* 5 — Critic tribunal */}
          <CriticTribunalViz critics={result.critics} />

          {/* 6 — AI second opinion (preserved exactly) */}
          <AIPanel obs={obs} meta={meta} result={result} esc={esc} />
        </div>
      </div>
    </>
  );
}

// ─── Next-Best-Test panel with animated gain bars ─────────────────────────────
function NextBestTestPanel({ result }: { result: ReturnType<typeof analyzeOutlet> }) {
  if (result.nextBestTests.length === 0) {
    return (
      <GlowCard accent={C.amber} className="oi-fadeup">
        <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, letterSpacing: 1.5, fontWeight: 700, marginBottom: 8 }}>
          NEXT-BEST TEST
        </div>
        <div style={{ color: C.dim, fontSize: 11 }}>All candidate tests measured.</div>
      </GlowCard>
    );
  }

  const maxGain = Math.max(...result.nextBestTests.map((t) => t.gain), 0.001);

  return (
    <GlowCard accent={C.amber} className="oi-fadeup">
      <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, letterSpacing: 1.5, fontWeight: 700, marginBottom: 10 }}>
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
              {/* Rank badge */}
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
                {/* Animated gain bar */}
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

              {/* Gain number */}
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

// ─── AI second-opinion panel (preserved verbatim, rewrapped in GlowCard) ──────
function AIPanel({
  obs, meta, result, esc,
}: {
  obs: Observation;
  meta: Meta;
  result: ReturnType<typeof analyzeOutlet>;
  esc: ReturnType<typeof escalationEligibility>;
}) {
  const [copied,  setCopied]  = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [advisory,setAdvisory] = useState<string | null>(null);
  const [err,     setErr]     = useState<string | null>(null);
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
    <GlowCard
      accent={C.blue}
      className="oi-fadeup"
      style={{ padding: "14px" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, letterSpacing: 1.5, fontWeight: 700 }}>
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
