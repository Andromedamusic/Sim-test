/* ════════════════════════════════════════════════════════════════════════════
   LEARNING VIEW — active-learning ground-truth feedback, prior calibration,
   and feedback history. Records confirmed diagnoses to locally recalibrate
   the Bayesian engine priors over time.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../../state/store";
import { FAULTS, FK, referenceBaseFreq } from "../../core";
import { listFeedback } from "../../data/storage";
import type { FeedbackRow } from "../../data/db";
import { C, mono, VERDICT_COLOR, btn, HUD, glow } from "../theme";
import { AnimatedNumber, Sparkline, useReducedMotion } from "../anim";
import { Card, Field, Bar, Pill } from "../components";
import { Bracket } from "../hud/Bracket";

// ─── helpers ──────────────────────────────────────────────────────────────────

function faultLabel(id: string): string {
  return FAULTS[id]?.name ?? id;
}

function shortDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}

// ─── HUD section label ────────────────────────────────────────────────────────

function HudLabel({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: sub ? 4 : 10 }}>
      <span style={{ color: HUD.cyan, fontSize: 8, lineHeight: 1 }}>◆</span>
      <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: 2, color: HUD.cyan, textTransform: "uppercase" as const }}>
        {label}
      </span>
      {sub && <span style={{ fontFamily: mono, fontSize: 9, color: HUD.dimmer, letterSpacing: 1 }}>— {sub}</span>}
    </div>
  );
}

// ─── HUD panel wrapper ────────────────────────────────────────────────────────

function HudPanel({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  const rm = useReducedMotion();
  return (
    <div
      className={rm ? className : `oi-fadeup${className ? " " + className : ""}`}
      style={{
        position: "relative",
        background: HUD.panel,
        border: `1px solid ${HUD.line}`,
        borderRadius: 10,
        padding: "14px 16px",
        ...style,
      }}
    >
      <Bracket color={HUD.cyan} size={9} inset={3} weight={1} opacity={0.45} />
      {children}
    </div>
  );
}

// ─── Styled select helper ─────────────────────────────────────────────────────

function HudSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        background: "#060A0F",
        border: `1px solid ${focused ? HUD.cyan : HUD.line}`,
        boxShadow: focused ? glow(HUD.cyan, 0.3) : undefined,
        borderRadius: 7,
        padding: "8px 9px",
        fontSize: 12,
        fontFamily: mono,
        color: HUD.text,
        width: "100%",
        outline: "none",
        transition: "border-color .15s, box-shadow .15s",
      }}
    >
      {children}
    </select>
  );
}

function HudInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        background: "#060A0F",
        border: `1px solid ${focused ? HUD.cyan : HUD.line}`,
        boxShadow: focused ? glow(HUD.cyan, 0.3) : undefined,
        borderRadius: 7,
        padding: "8px 9px",
        fontSize: 12,
        fontFamily: mono,
        color: HUD.text,
        width: "100%",
        boxSizing: "border-box" as const,
        outline: "none",
        transition: "border-color .15s, box-shadow .15s",
      }}
    />
  );
}

// ─── Record ground truth panel ────────────────────────────────────────────────

function RecordPanel() {
  const model = useStore((s) => s.model);
  const recordGroundTruth = useStore((s) => s.recordGroundTruth);

  // Outlets that have a completed inference are candidates
  const candidates = (model?.outlets ?? []).filter((o) => o.inference != null);

  const [outletId, setOutletId] = useState<string>("");
  const [actualFaultId, setActualFaultId] = useState<string>(FK[0] ?? "healthy");
  const [note, setNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // Pre-select the first available candidate if none chosen
  useEffect(() => {
    if (!outletId && candidates.length > 0) {
      setOutletId(candidates[0].id);
    }
  }, [candidates.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const rooms = model?.rooms ?? [];
  function outletOptionLabel(id: string): string {
    const o = candidates.find((x) => x.id === id);
    if (!o) return id;
    const room = rooms.find((r) => r.id === o.roomId);
    const predicted = o.inference?.topFault ? faultLabel(o.inference.topFault) : "—";
    return `${room?.name ?? "?"} · ${o.label}  [predicted: ${predicted}]`;
  }

  async function handleSubmit() {
    if (!outletId || !actualFaultId) return;
    setSubmitting(true);
    try {
      await recordGroundTruth(outletId, actualFaultId, note.trim() || undefined);
      setNote("");
      setFlash(`Recorded: ${faultLabel(actualFaultId)}`);
      setTimeout(() => setFlash(null), 2500);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <HudPanel style={{ marginBottom: 14 }}>
      <HudLabel label="Record Ground Truth" />
      <p style={{ color: C.dim, fontSize: 11, fontFamily: mono, margin: "0 0 12px", lineHeight: 1.6 }}>
        After physically confirming a fault (opened device, panel test, electrician report),
        record the true outcome here. Each submission recalibrates the engine's local priors
        so subsequent predictions improve over time — even fully offline.
      </p>

      {candidates.length === 0 ? (
        <div style={{ color: C.dimmer, fontSize: 11, fontFamily: mono, padding: "8px 0" }}>
          No measured outlets yet. Run a measurement in the Inference view first.
        </div>
      ) : (
        <div className="oi-stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="OUTLET (predicted fault in brackets)">
            <HudSelect value={outletId} onChange={setOutletId}>
              {candidates.map((o) => (
                <option key={o.id} value={o.id}>{outletOptionLabel(o.id)}</option>
              ))}
            </HudSelect>
          </Field>

          <Field label="ACTUAL FAULT CONFIRMED">
            <HudSelect value={actualFaultId} onChange={setActualFaultId}>
              {FK.map((k) => (
                <option key={k} value={k}>{faultLabel(k)}</option>
              ))}
            </HudSelect>
          </Field>

          <Field label="NOTE (optional)">
            <HudInput
              value={note}
              placeholder="e.g. confirmed by electrician on 2026-06-14"
              onChange={setNote}
            />
          </Field>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={handleSubmit}
              disabled={submitting || !outletId}
              className="oi-press"
              style={{ ...btn(C.amber), opacity: submitting ? 0.5 : 1 }}
            >
              {submitting ? "Saving…" : "Submit Ground Truth"}
            </button>
            {flash && (
              <span className="oi-fadeup" style={{ color: C.good, fontFamily: mono, fontSize: 11 }}>
                {flash}
              </span>
            )}
          </div>
        </div>
      )}
    </HudPanel>
  );
}

// ─── Feedback log ─────────────────────────────────────────────────────────────

function FeedbackLog({ onLoaded }: { onLoaded: (rows: FeedbackRow[]) => void }) {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const rev = useStore((s) => s.rev);

  useEffect(() => {
    listFeedback().then((r) => {
      const sorted = [...r].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      setRows(sorted);
      onLoaded(sorted);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);

  if (!rows.length) {
    return (
      <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 11, padding: "8px 0" }}>
        No feedback recorded yet.
      </div>
    );
  }

  const hits = rows.filter((r) => r.predictedFault === r.actualFault).length;
  const accuracy = rows.length > 0 ? (hits / rows.length) * 100 : 0;
  const accColor = accuracy >= 70 ? C.good : accuracy >= 40 ? C.warn : C.bad;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: C.dim, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: HUD.dimmer }}>ACCURACY</span>
          <AnimatedNumber
            value={accuracy}
            decimals={1}
            suffix="%"
            style={{ color: accColor, fontWeight: 800, fontSize: 14 }}
          />
          <span style={{ color: C.dimmer }}>({hits}/{rows.length} correct)</span>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: mono }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${HUD.lineHi}` }}>
              {["DATE", "OUTLET", "PREDICTED", "ACTUAL", ""].map((h) => (
                <th key={h} style={{ padding: "5px 8px", color: HUD.dimmer, textAlign: "left", fontWeight: 700, fontSize: 9, letterSpacing: 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="oi-stagger">
            {rows.map((row) => {
              const hit = row.predictedFault === row.actualFault;
              const predColor = FAULTS[row.predictedFault]?.color ?? C.dim;
              const actualColor = FAULTS[row.actualFault]?.color ?? C.dim;
              return (
                <tr
                  key={row.id}
                  className="oi-lift"
                  style={{ borderBottom: `1px solid ${HUD.line}`, transition: "background .15s" }}
                >
                  <td style={{ padding: "6px 8px", color: C.dimmer }}>{shortDate(row.submittedAt)}</td>
                  <td style={{ padding: "6px 8px", color: C.dim }}>{row.outletId.slice(0, 8)}&hellip;</td>
                  <td style={{ padding: "6px 8px" }}>
                    <Pill color={predColor}>{faultLabel(row.predictedFault)}</Pill>
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <Pill color={actualColor}>{faultLabel(row.actualFault)}</Pill>
                  </td>
                  <td style={{ padding: "6px 8px", color: hit ? C.good : C.bad, fontSize: 13, fontWeight: 800 }}>
                    {hit ? "✓" : "✗"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Learned priors section ───────────────────────────────────────────────────

function LearnedPriors() {
  const priorScale = useStore((s) => s.priorScale);
  const resetLearning = useStore((s) => s.resetLearning);
  const [confirming, setConfirming] = useState(false);

  const entries = Object.entries(priorScale).filter(([, v]) => v !== 1);
  // Build sparkline history per fault (sequence of scale values for visual feedback)
  // Since we only have the current multiplier, we use a synthetic 3-point series
  const sparkData = (v: number) => [1, (1 + v) / 2, v];

  async function handleReset() {
    if (!confirming) { setConfirming(true); return; }
    await resetLearning();
    setConfirming(false);
  }

  return (
    <HudPanel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <HudLabel label="Learned Priors" />
        <button
          onClick={handleReset}
          className="oi-press"
          style={{ ...btn(confirming ? C.bad : C.dimmer, true), fontSize: 10 }}
        >
          {confirming ? "Confirm reset?" : "Reset Learning"}
        </button>
      </div>

      {entries.length === 0 ? (
        <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 11, padding: "6px 0" }}>
          No priors learned yet — all multipliers at 1.0×.
        </div>
      ) : (
        <div className="oi-stagger" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {entries
            .sort((a, b) => b[1] - a[1])
            .map(([faultId, scale]) => {
              const fault = FAULTS[faultId];
              const color = fault?.color ?? C.blue;
              const pct = Math.min(100, ((scale - 0.3) / (5 - 0.3)) * 100);
              return (
                <div key={faultId} className="oi-lift" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: mono, fontSize: 11, color: C.text }}>
                      {faultLabel(faultId)}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Sparkline data={sparkData(scale)} width={60} height={20} color={color} />
                      <AnimatedNumber
                        value={scale}
                        decimals={2}
                        suffix="×"
                        style={{ fontFamily: mono, fontSize: 12, color, fontWeight: 800, minWidth: 42, textAlign: "right" }}
                      />
                    </div>
                  </div>
                  <Bar pct={pct} color={color} h={5} />
                </div>
              );
            })}
        </div>
      )}
      {confirming && (
        <div className="oi-fadeup" style={{ marginTop: 8, color: C.warn, fontFamily: mono, fontSize: 10 }}>
          Click again to confirm. All learned multipliers will be reset to 1.0×.
        </div>
      )}
    </HudPanel>
  );
}

// ─── Learned Model (Bayesian) section ────────────────────────────────────────

function LearnedModel() {
  const learnCounts = useStore((s) => s.learnCounts);
  const priorScale = useStore((s) => s.priorScale);
  // Derive base frequencies once (deterministic, cheap)
  const baseFreq = useMemo(() => referenceBaseFreq(), []);

  // Rows: any fault where there's a non-trivial signal
  const rows = useMemo(() => {
    return FK
      .filter((k) => (learnCounts[k] ?? 0) > 0 || priorScale[k] !== undefined)
      .map((k) => ({
        id: k,
        name: FAULTS[k]?.name ?? k,
        color: FAULTS[k]?.color ?? C.blue,
        count: learnCounts[k] ?? 0,
        baseFreqPct: (baseFreq[k] ?? 0) * 100,
        multiplier: priorScale[k] ?? 1,
      }))
      .sort((a, b) => Math.abs(b.multiplier - 1) - Math.abs(a.multiplier - 1));
  }, [learnCounts, priorScale, baseFreq]);

  if (rows.length === 0) {
    return (
      <HudPanel>
        <HudLabel label="Learned Model" sub="Bayesian console" />
        <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 11, padding: "6px 0" }}>
          No ground-truth confirmations yet — submit at least one ground truth to see the learned model.
        </div>
        <p style={{ color: C.dimmer, fontSize: 10, fontFamily: mono, lineHeight: 1.6, margin: "8px 0 0" }}>
          Confirmed ground truths are modeled as multinomial counts; a Dirichlet-posterior vs base-rate ratio
          gives each fault's prior multiplier. More confirmations of a fault here make the engine expect it
          more in THIS housing stock. Safety verdicts are independent of this.
        </p>
      </HudPanel>
    );
  }

  return (
    <HudPanel>
      <HudLabel label="Learned Model" sub="Bayesian console" />
      <p style={{ color: C.dim, fontSize: 11, fontFamily: mono, margin: "0 0 12px", lineHeight: 1.6 }}>
        Confirmed ground truths are modeled as multinomial counts; a Dirichlet-posterior vs base-rate ratio
        gives each fault's prior multiplier. More confirmations of a fault here make the engine expect it
        more in THIS housing stock. Safety verdicts are independent of this.
      </p>

      {/* Column header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 52px 58px 100px",
        gap: 6,
        padding: "4px 0 6px",
        borderBottom: `1px solid ${HUD.lineHi}`,
        marginBottom: 10,
      }}>
        {["FAULT", "CONF.", "BASE%", "MULTIPLIER ×1.0"].map((h) => (
          <span key={h} style={{ color: HUD.dimmer, fontSize: 9, fontFamily: mono, fontWeight: 700, letterSpacing: 1 }}>{h}</span>
        ))}
      </div>

      <div className="oi-stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(({ id, name, color, count, baseFreqPct, multiplier }) => {
          const boosted = multiplier > 1;
          // boosted → amber to the right; suppressed → cyan to the left
          const barColor = boosted ? C.amber : C.blue;
          const leftPct = 50;
          const devWidth = Math.min(48, (Math.abs(multiplier - 1) / 4) * 48);
          const barLeft = boosted ? leftPct : leftPct - devWidth;
          const barWidth = devWidth;

          return (
            <div key={id} className="oi-lift" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 52px 58px 100px",
                gap: 6,
                alignItems: "center",
              }}>
                <span style={{ fontFamily: mono, fontSize: 11, color, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {name}
                </span>
                <AnimatedNumber
                  value={count}
                  decimals={0}
                  style={{ fontFamily: mono, fontSize: 12, color: C.text, textAlign: "right", fontWeight: 700 }}
                />
                <AnimatedNumber
                  value={baseFreqPct}
                  decimals={1}
                  suffix="%"
                  style={{ fontFamily: mono, fontSize: 11, color: C.dimmer, textAlign: "right" }}
                />
                <span style={{
                  fontFamily: mono, fontSize: 11, fontWeight: 800, textAlign: "right",
                  color: multiplier > 1.05 ? C.amber : multiplier < 0.95 ? C.blue : C.dim,
                }}>
                  ×{multiplier.toFixed(2)}
                </span>
              </div>

              {/* Diverging bar — pivot at 1.0×, amber-right boosted / cyan-left suppressed */}
              <div style={{ position: "relative", height: 6, background: "#060A0F", borderRadius: 4, overflow: "hidden", border: `1px solid ${HUD.line}` }}>
                {/* Center tick */}
                <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: HUD.lineHi }} />
                {/* Deviation fill */}
                <div style={{
                  position: "absolute",
                  left: `${barLeft}%`,
                  width: `${barWidth}%`,
                  top: 0,
                  bottom: 0,
                  background: barColor,
                  borderRadius: 4,
                  boxShadow: `0 0 6px ${barColor}88`,
                  transition: "width .3s, left .3s",
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </HudPanel>
  );
}

// ─── Confusion summary (compact) ─────────────────────────────────────────────

function ConfusionSummary({ rows }: { rows: FeedbackRow[] }) {
  const stats = useMemo(() => {
    const total = rows.length;
    if (total === 0) return null;
    const hits = rows.filter((r) => r.predictedFault === r.actualFault).length;
    const corrections = total - hits;
    const accuracy = (hits / total) * 100;

    // Find most common mis-prediction pair (predicted → actual)
    const pairCounts: Record<string, number> = {};
    for (const r of rows) {
      if (r.predictedFault !== r.actualFault) {
        const key = `${r.predictedFault}→${r.actualFault}`;
        pairCounts[key] = (pairCounts[key] ?? 0) + 1;
      }
    }
    const topPairEntry = Object.entries(pairCounts).sort((a, b) => b[1] - a[1])[0];
    const topPair = topPairEntry
      ? { from: topPairEntry[0].split("→")[0], to: topPairEntry[0].split("→")[1], n: topPairEntry[1] }
      : null;

    return { total, hits, corrections, accuracy, topPair };
  }, [rows]);

  if (!stats) return null;

  const accColor = stats.accuracy >= 70 ? C.good : stats.accuracy >= 40 ? C.warn : C.bad;

  return (
    <HudPanel className="oi-stagger" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <HudLabel label="Feedback Summary" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <StatReadout label="TOTAL" value={stats.total} color={C.text} />
        <StatReadout label="HITS" value={stats.hits} color={C.good} />
        <StatReadout label="CORRECTIONS" value={stats.corrections} color={C.bad} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: mono, fontSize: 9, color: HUD.dimmer, letterSpacing: 1 }}>ACCURACY</span>
          <AnimatedNumber
            value={stats.accuracy}
            decimals={1}
            suffix="%"
            style={{ color: accColor, fontWeight: 800, fontSize: 14, fontFamily: mono }}
          />
        </div>
        {stats.topPair && (
          <span style={{ fontFamily: mono, fontSize: 10, color: C.dimmer, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <span style={{ color: HUD.dimmer, letterSpacing: 1, fontSize: 9 }}>TOP MIS-PRED</span>
            <Pill color={FAULTS[stats.topPair.from]?.color ?? C.dim}>{faultLabel(stats.topPair.from)}</Pill>
            <span style={{ color: C.dimmer }}>→</span>
            <Pill color={FAULTS[stats.topPair.to]?.color ?? C.dim}>{faultLabel(stats.topPair.to)}</Pill>
            <span style={{ color: C.dimmer }}>({stats.topPair.n}×)</span>
          </span>
        )}
      </div>
    </HudPanel>
  );
}

function StatReadout({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
      <span style={{ fontFamily: mono, fontSize: 9, color: HUD.dimmer, letterSpacing: 1 }}>{label}</span>
      <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function LearningView() {
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRow[]>([]);
  const rm = useReducedMotion();

  // Collect accuracy sparkline data from feedback history (group by date)
  const accuracyHistory: number[] = useMemo(() => {
    if (feedbackRows.length < 2) return [];
    // Use rolling accuracy up to each entry (chronological order)
    const sorted = [...feedbackRows].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    return sorted.map((_, i) => {
      const slice = sorted.slice(0, i + 1);
      const hits = slice.filter((r) => r.predictedFault === r.actualFault).length;
      return (hits / slice.length) * 100;
    });
  }, [feedbackRows]);

  return (
    <div style={{ padding: "14px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={rm ? undefined : "oi-fadeup"}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ color: HUD.cyan, fontSize: 8 }}>◆</span>
          <span style={{ fontFamily: mono, fontSize: 9, color: HUD.cyan, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const }}>
            Active Learning
          </span>
        </div>
        <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
          Ground-Truth Calibration
        </h2>
        <p style={{ margin: "0", fontSize: 11, color: C.dim, fontFamily: mono, lineHeight: 1.6 }}>
          Each confirmed diagnosis nudges the Bayesian engine's per-fault priors
          (multipliers clamped 0.3–5×) so it learns the fault mix of this specific
          home's era, wiring, and environment — entirely offline.
        </p>
        {accuracyHistory.length >= 2 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <span style={{ fontFamily: mono, fontSize: 10, color: C.dimmer, letterSpacing: 1 }}>ACCURACY TREND</span>
            <Sparkline data={accuracyHistory} width={120} height={28} color={HUD.cyan} />
          </div>
        )}
      </div>

      {/* ── Record panel ────────────────────────────────────────────────── */}
      <RecordPanel />

      {/* ── Bayesian learned model (diverging bar, per-fault multipliers) ─ */}
      <LearnedModel />

      {/* ── Learned priors (multiplier bars + sparklines + reset) ────────── */}
      <LearnedPriors />

      {/* ── Confusion summary (compact stats row derived from feedback) ─── */}
      {feedbackRows.length > 0 && <ConfusionSummary rows={feedbackRows} />}

      {/* ── Feedback log ────────────────────────────────────────────────── */}
      <HudPanel>
        <HudLabel label="Feedback Log" />
        <FeedbackLog onLoaded={setFeedbackRows} />
      </HudPanel>
    </div>
  );
}
