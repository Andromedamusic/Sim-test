/* ════════════════════════════════════════════════════════════════════════════
   DIAGNOSE — the per-outlet inference workbench. Enter measurements, read the
   adjudicated verdict + posterior + critic tribunal + next-best-test, and
   escalate to an AI second opinion (copy report, or optional live call).
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useMemo, useState } from "react";
import { useStore } from "../../state/store";
import {
  analyzeOutlet, FAULTS, topN,
  type Observation, type Meta, type Era, type WireMaterial, type ThermalSlot,
} from "../../core";
import { buildShareableReport, escalationEligibility, callClaude } from "../../ai/report";
import { getSetting } from "../../data/storage";
import { C, mono, VERDICT_COLOR } from "../theme";
import { Card, SubH, Row, Field, NumberInput, Select, TriToggle, Bar, Pill } from "../components";
import { METER_NAMES, METERS } from "../meters";

const ERAS: Era[] = ["Pre-1990", "1990-2000", "2000-2010", "2010+", "Unknown"];
const WIRES: WireMaterial[] = ["Copper", "Aluminum", "Unknown"];
const THERMALS: ThermalSlot[] = ["none", "H-slot", "N-slot", "both", "terminal"];

export function InferenceView() {
  const { scratchObs, scratchMeta, setScratchObs, setScratchMeta, loadLiveCase } = useStore();
  const obs = scratchObs, meta = scratchMeta;
  const so = (k: keyof Observation, v: unknown) => setScratchObs({ ...obs, [k]: v });

  const result = useMemo(() => analyzeOutlet(obs, meta), [obs, meta]);
  const esc = escalationEligibility(result);

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0,1fr)" }} className="diag-grid">
      <style>{`@media(min-width:900px){.diag-grid{grid-template-columns:minmax(0,1.05fr) minmax(360px,.95fr) !important;}}`}</style>

      {/* INPUT COLUMN */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card title="EVIDENCE — enter what you measured"
          right={<div style={{ display: "flex", gap: 6 }}>
            <button onClick={loadLiveCase} style={miniBtn(C.amber)}>↻ Live case</button>
            <button onClick={() => setScratchObs({ thermalSlot: "none" })} style={miniBtn(C.dim)}>Clear</button>
          </div>}>
          <SubH text="No-load voltages (VAC)" />
          <div style={grid3}>
            <Field label="V H→N"><NumberInput value={obs.VHN} onChange={(v) => so("VHN", v)} /></Field>
            <Field label="V H→G"><NumberInput value={obs.VHG} onChange={(v) => so("VHG", v)} /></Field>
            <Field label="V N→G"><NumberInput value={obs.VNG} onChange={(v) => so("VNG", v)} /></Field>
          </div>
          <SubH text="Loaded measurements" />
          <div style={grid3}>
            <Field label="Load W"><NumberInput value={obs.loadW} onChange={(v) => so("loadW", v)} /></Field>
            <Field label="V H→N loaded"><NumberInput value={obs.vhnLoaded} onChange={(v) => so("vhnLoaded", v)} /></Field>
            <Field label="V N→G loaded"><NumberInput value={obs.vngLoaded} onChange={(v) => so("vngLoaded", v)} /></Field>
            <Field label="V drop"><NumberInput value={obs.dropV} onChange={(v) => so("dropV", v)} /></Field>
          </div>
          <SubH text="Continuity (breaker OFF) & behaviour" />
          <div style={grid3}>
            <Field label="Ground cont Ω (OL=open)"><NumberInput value={obs.Gcont} onChange={(v) => so("Gcont", v)} /></Field>
            <Field label="Fritting decay?"><TriToggle value={obs.frittingObs} onChange={(v) => so("frittingObs", v)} /></Field>
            <Field label="Thermal hotspot"><Select value={obs.thermalSlot ?? "none"} options={THERMALS} onChange={(v) => so("thermalSlot", v)} /></Field>
            <Field label="Wiggle-sensitive?"><TriToggle value={obs.wiggleObs} onChange={(v) => so("wiggleObs", v)} /></Field>
            <Field label="AFCI trips?"><TriToggle value={obs.afciTrip} onChange={(v) => so("afciTrip", v)} /></Field>
            <Field label="GFCI trips?"><TriToggle value={obs.gfciTrip} onChange={(v) => so("gfciTrip", v)} /></Field>
          </div>
          <SubH text="Safety-critical checks" />
          <div style={grid3}>
            <Field label="Real ground wire?"><TriToggle value={obs.hasGroundWire} onChange={(v) => so("hasGroundWire", v)} /></Field>
            <Field label="Gnd-pin→earth tested?"><TriToggle value={obs.groundRefTested} onChange={(v) => so("groundRefTested", v)} /></Field>
          </div>
        </Card>

        <Card title="CONTEXT — sets priors & artifact interpretation">
          <div style={grid3}>
            <Field label="Build era"><Select value={meta.era} options={ERAS} onChange={(v) => setScratchMeta({ era: v })} /></Field>
            <Field label="Wire material"><Select value={meta.wireMat} options={WIRES} onChange={(v) => setScratchMeta({ wireMat: v })} /></Field>
            <Field label="Meter"><Select value={meta.meter} options={METER_NAMES} onChange={(v) => setScratchMeta({ meter: v, meterZ: METERS[v].z })} /></Field>
          </div>
          <div style={{ marginTop: 8, color: C.dimmer, fontSize: 9.5, fontFamily: mono }}>
            Meter Z = {(meta.meterZ / 1e6).toFixed(2)} MΩ · CAT {METERS[meta.meter]?.cat} · {METERS[meta.meter]?.rms ? "True-RMS" : "averaging"}
          </div>
        </Card>
      </div>

      {/* VERDICT COLUMN */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <VerdictBanner result={result} />
        <PosteriorCard result={result} />
        {result.topFault !== "healthy" && (
          <Card title={`LEADING HYPOTHESIS · ${FAULTS[result.topFault].name}`}>
            <Row label="Discriminator" val={FAULTS[result.topFault].discriminator} />
            <Row label="Remedy" val={FAULTS[result.topFault].remedy} />
            <Row label="NEC" val={FAULTS[result.topFault].nec} monoFont />
            <Row label="Severity" val={`${FAULTS[result.topFault].sev}/10`} monoFont />
          </Card>
        )}
        <NextBestTestCard result={result} />
        <CriticTribunal result={result} />
        <AIPanel obs={obs} meta={meta} result={result} esc={esc} />
      </div>
    </div>
  );
}

function VerdictBanner({ result }: { result: ReturnType<typeof analyzeOutlet> }) {
  return (
    <div style={{ background: result.hold ? "#1A0606" : C.panel, border: `2px solid ${result.vColor}`, borderRadius: 12, padding: 14, boxShadow: `0 0 24px ${result.vColor}22` }}>
      <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, letterSpacing: 1, marginBottom: 4 }}>ADJUDICATED VERDICT</div>
      <div style={{ color: result.vColor, fontSize: 21, fontWeight: 800, fontFamily: mono, lineHeight: 1.1 }}>{result.verdict}</div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: C.dim, fontSize: 10, fontFamily: mono }}>CONFIDENCE</span>
        <div style={{ flex: 1 }}><Bar pct={result.confidence * 100} color={result.confidence > 0.7 ? C.good : result.confidence > 0.4 ? C.warn : C.bad} h={8} /></div>
        <span style={{ color: C.text, fontSize: 12, fontFamily: mono, fontWeight: 700 }}>{(result.confidence * 100).toFixed(0)}%</span>
      </div>
      {result.hold && result.demand.length > 0 && (
        <div style={{ marginTop: 10, background: "#260808", border: "1px solid #7F1D1D", borderRadius: 8, padding: 10 }}>
          <div style={{ color: "#FCA5A5", fontSize: 9.5, fontFamily: mono, fontWeight: 700, marginBottom: 5 }}>☠️ SAFETY HOLD — RESOLVE BEFORE PROCEEDING:</div>
          {result.demand.map((d, i) => <div key={i} style={{ color: "#FECACA", fontSize: 10.5, fontFamily: mono, lineHeight: 1.5, marginBottom: 4 }}>▸ {d}</div>)}
        </div>
      )}
    </div>
  );
}

function PosteriorCard({ result }: { result: ReturnType<typeof analyzeOutlet> }) {
  return (
    <Card title="POSTERIOR — FAULT PROBABILITY">
      {topN(result.post, 7).filter(([, p]) => p > 0.005).map(([k, p]) => {
        const f = FAULTS[k];
        return (
          <div key={k} style={{ marginBottom: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ color: f.color, fontSize: 11, fontFamily: mono, fontWeight: 600 }}>{f.name}{f.lethal ? " ☠" : ""}</span>
              <span style={{ color: C.text, fontSize: 11, fontFamily: mono, fontWeight: 700 }}>{(p * 100).toFixed(1)}%</span>
            </div>
            <Bar pct={p * 100} color={f.color} />
          </div>
        );
      })}
      <div style={{ marginTop: 8, color: C.dimmer, fontSize: 9, fontFamily: mono, borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
        Entropy H = {result.H.toFixed(2)} bits · margin {result.margin.toFixed(1)}×
      </div>
    </Card>
  );
}

function NextBestTestCard({ result }: { result: ReturnType<typeof analyzeOutlet> }) {
  return (
    <Card title="🎯 RECOMMENDED NEXT TEST (by information gain)">
      {result.nextBestTests.length === 0 ? <div style={{ color: C.dim, fontSize: 11 }}>All candidate tests measured.</div> :
        result.nextBestTests.map((t, i) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < result.nextBestTests.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <span style={{ color: i === 0 ? C.amber : C.dimmer, fontFamily: mono, fontWeight: 700, fontSize: 13, minWidth: 16 }}>{i + 1}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: i === 0 ? C.text : C.dim, fontSize: 11.5, fontWeight: i === 0 ? 700 : 400 }}>{t.label}</div>
              <div style={{ marginTop: 3 }}><Bar pct={Math.min(t.gain * 100, 100)} color={i === 0 ? C.amber : C.dimmer} h={4} /></div>
            </div>
            <span style={{ color: C.dimmer, fontSize: 9.5, fontFamily: mono }}>{t.gain.toFixed(2)}</span>
          </div>
        ))}
    </Card>
  );
}

function CriticTribunal({ result }: { result: ReturnType<typeof analyzeOutlet> }) {
  const [open, setOpen] = useState(false);
  return (
    <Card title="⚖️ CRITIC TRIBUNAL" right={<button onClick={() => setOpen(!open)} style={miniBtn(C.blue)}>{open ? "Hide" : "Show"} transcript</button>}>
      {!open ? <div style={{ color: C.dim, fontSize: 11 }}>Six critics adjudicate the evidence. Open to read the full debate transcript.</div> :
        <div style={{ display: "grid", gap: 8 }}>
          {result.critics.map((c) => (
            <div key={c.id} style={{ background: "#0E0E12", border: `1px solid ${C.border}`, borderLeft: `3px solid ${c.color}`, borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span>{c.icon}</span>
                <span style={{ color: c.color, fontWeight: 700, fontSize: 12, fontFamily: mono }}>{c.name}</span>
                <span style={{ marginLeft: "auto", background: c.color + "22", color: c.color, fontSize: 8.5, padding: "2px 6px", borderRadius: 3, fontFamily: mono, fontWeight: 700 }}>{c.power}</span>
              </div>
              {(c.veto && c.veto.length > 0) && <div style={{ color: C.bad, fontSize: 9.5, fontFamily: mono, marginBottom: 4 }}>VETOED: {c.veto.map((v) => FAULTS[v]?.name).join(", ")}</div>}
              {c.args.length === 0 ? <div style={{ color: C.dimmer, fontSize: 10, fontStyle: "italic" }}>No findings.</div> :
                c.args.map((a, i) => <div key={i} style={{ color: C.text, fontSize: 10.5, fontFamily: mono, lineHeight: 1.5, marginBottom: 4 }}>▸ {a}</div>)}
            </div>
          ))}
        </div>}
    </Card>
  );
}

function AIPanel({ obs, meta, result, esc }: { obs: Observation; meta: Meta; result: ReturnType<typeof analyzeOutlet>; esc: ReturnType<typeof escalationEligibility> }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [advisory, setAdvisory] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const report = useMemo(() => buildShareableReport(obs, meta, result), [obs, meta, result]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setErr("Clipboard blocked — select & copy the text below."); }
  };
  const live = async () => {
    setBusy(true); setErr(null); setAdvisory(null);
    try {
      const key = await getSetting<string>("anthropicApiKey", "");
      if (!key) { setErr("No API key set. Add one in Settings, or use Copy report → paste into Claude."); return; }
      const a = await callClaude(key, report);
      setAdvisory(a.text);
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  };

  return (
    <Card title="🤖 AI SECOND OPINION (advisory only)"
      right={esc.eligible ? <Pill color={C.amber}>escalation suggested</Pill> : undefined}>
      <div style={{ color: C.dim, fontSize: 11, lineHeight: 1.5, marginBottom: 8 }}>
        The deterministic engine above is the safety system and runs fully offline. This optional layer sends the evidence + critic transcript to Claude for novel/compound-fault reasoning. <b style={{ color: C.dimmer }}>It never overrides the safety verdict.</b>
        {esc.eligible && <span style={{ color: C.amber }}> · {esc.detail}</span>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={copy} style={miniBtn(C.good)}>{copied ? "✓ Copied" : "⧉ Copy report → Claude"}</button>
        <button onClick={live} disabled={busy} style={miniBtn(C.blue)}>{busy ? "Calling…" : "↗ Live call (needs key)"}</button>
      </div>
      {err && <div style={{ marginTop: 8, color: "#FCA5A5", fontSize: 10.5, fontFamily: mono }}>{err}</div>}
      {advisory && (
        <div style={{ marginTop: 10, background: "#0B1220", border: `1px dashed ${C.blue}`, borderRadius: 8, padding: 10 }}>
          <div style={{ color: C.blue, fontSize: 9, fontFamily: mono, fontWeight: 700, marginBottom: 6 }}>ADVISORY — NOT A SAFETY VERDICT</div>
          <div style={{ color: C.text, fontSize: 11.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{advisory}</div>
        </div>
      )}
      <details style={{ marginTop: 8 }}>
        <summary style={{ color: C.dimmer, fontSize: 10, fontFamily: mono, cursor: "pointer" }}>Preview report text</summary>
        <textarea readOnly value={report} style={{ marginTop: 6, height: 160, fontFamily: mono, fontSize: 10.5, lineHeight: 1.5 }} />
      </details>
    </Card>
  );
}

const grid3: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 };
const miniBtn = (color: string): React.CSSProperties => ({ background: "transparent", color, border: `1px solid ${color}`, borderRadius: 6, padding: "6px 9px", fontSize: 10.5, fontWeight: 700, fontFamily: mono, cursor: "pointer" });
