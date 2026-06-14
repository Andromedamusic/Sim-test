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
import { C, mono, VERDICT_COLOR, btn } from "../theme";
import { AnimatedNumber, Sparkline } from "../anim";
import { Card, Field, Bar, Pill } from "../components";

// ─── helpers ──────────────────────────────────────────────────────────────────

function faultLabel(id: string): string {
  return FAULTS[id]?.name ?? id;
}

function shortDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
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
    <Card title="RECORD GROUND TRUTH" style={{ marginBottom: 14 }}>
      <p style={{ color: C.dim, fontSize: 11, fontFamily: mono, margin: "0 0 10px", lineHeight: 1.6 }}>
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
            <select
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
              style={{
                background: "#0A0A0E", border: `1px solid ${C.border}`,
                borderRadius: 7, padding: "8px 9px", fontSize: 12, fontFamily: mono, color: C.text,
              }}
            >
              {candidates.map((o) => (
                <option key={o.id} value={o.id}>{outletOptionLabel(o.id)}</option>
              ))}
            </select>
          </Field>

          <Field label="ACTUAL FAULT CONFIRMED">
            <select
              value={actualFaultId}
              onChange={(e) => setActualFaultId(e.target.value)}
              style={{
                background: "#0A0A0E", border: `1px solid ${C.border}`,
                borderRadius: 7, padding: "8px 9px", fontSize: 12, fontFamily: mono, color: C.text,
              }}
            >
              {FK.map((k) => (
                <option key={k} value={k}>{faultLabel(k)}</option>
              ))}
            </select>
          </Field>

          <Field label="NOTE (optional)">
            <input
              value={note}
              placeholder="e.g. confirmed by electrician on 2026-06-14"
              onChange={(e) => setNote(e.target.value)}
              style={{
                background: "#0A0A0E", border: `1px solid ${C.border}`,
                borderRadius: 7, padding: "8px 9px", fontSize: 12, fontFamily: mono, color: C.text,
              }}
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
    </Card>
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

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: C.dim }}>
          Accuracy:&nbsp;
          <AnimatedNumber
            value={accuracy}
            decimals={1}
            suffix="%"
            style={{ color: accuracy >= 70 ? C.good : accuracy >= 40 ? C.warn : C.bad, fontWeight: 800 }}
          />
          &nbsp;<span style={{ color: C.dimmer }}>({hits}/{rows.length} correct)</span>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: mono }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["DATE", "OUTLET", "PREDICTED", "ACTUAL", ""].map((h) => (
                <th key={h} style={{ padding: "5px 8px", color: C.dimmer, textAlign: "left", fontWeight: 700, fontSize: 9 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="oi-stagger">
            {rows.map((row) => {
              const hit = row.predictedFault === row.actualFault;
              const predColor = FAULTS[row.predictedFault]?.color ?? C.dim;
              const actualColor = FAULTS[row.actualFault]?.color ?? C.dim;
              return (
                <tr key={row.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
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
    <Card title="LEARNED PRIORS" right={
      <button
        onClick={handleReset}
        className="oi-press"
        style={{ ...btn(confirming ? C.bad : C.dimmer, true), fontSize: 10 }}
      >
        {confirming ? "Confirm reset?" : "Reset Learning"}
      </button>
    }>
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
                <div key={faultId} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
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
    </Card>
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
      <Card title="LEARNED MODEL">
        <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 11, padding: "6px 0" }}>
          No ground-truth confirmations yet — submit at least one ground truth to see the learned model.
        </div>
        <p style={{ color: C.dimmer, fontSize: 10, fontFamily: mono, lineHeight: 1.6, margin: "8px 0 0" }}>
          Confirmed ground truths are modeled as multinomial counts; a Dirichlet-posterior vs base-rate ratio
          gives each fault's prior multiplier. More confirmations of a fault here make the engine expect it
          more in THIS housing stock. Safety verdicts are independent of this.
        </p>
      </Card>
    );
  }

  return (
    <Card title="LEARNED MODEL">
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
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 8,
      }}>
        {["FAULT", "CONF.", "BASE%", "MULTIPLIER ×1.0"].map((h) => (
          <span key={h} style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, fontWeight: 700 }}>{h}</span>
        ))}
      </div>

      <div className="oi-stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(({ id, name, color, count, baseFreqPct, multiplier }) => {
          const boosted = multiplier > 1;
          const barColor = boosted ? C.amber : C.blue;
          // Map multiplier to [0,100] around center=50 → center means 1.0×
          // Range: 0.3 → 0%, 1.0 → 50%, 5.0 → ~100%
          const leftPct = 50; // pivot position
          // deviation bar width proportional to |mult-1|, max deviation shown at ±4 units
          const devWidth = Math.min(48, (Math.abs(multiplier - 1) / 4) * 48);
          const barLeft = boosted ? leftPct : leftPct - devWidth;
          const barWidth = devWidth;

          return (
            <div key={id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 52px 58px 100px",
                gap: 6,
                alignItems: "center",
              }}>
                {/* Fault name */}
                <span style={{ fontFamily: mono, fontSize: 11, color, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {name}
                </span>
                {/* Confirmed count */}
                <AnimatedNumber
                  value={count}
                  decimals={0}
                  style={{ fontFamily: mono, fontSize: 12, color: C.text, textAlign: "right", fontWeight: 700 }}
                />
                {/* Base frequency */}
                <AnimatedNumber
                  value={baseFreqPct}
                  decimals={1}
                  suffix="%"
                  style={{ fontFamily: mono, fontSize: 11, color: C.dimmer, textAlign: "right" }}
                />
                {/* Multiplier badge */}
                <span style={{
                  fontFamily: mono, fontSize: 11, fontWeight: 800, textAlign: "right",
                  color: multiplier > 1.05 ? C.amber : multiplier < 0.95 ? C.blue : C.dim,
                }}>
                  ×{multiplier.toFixed(2)}
                </span>
              </div>

              {/* Diverging bar (pivot at 1.0, right=boosted amber, left=suppressed blue) */}
              <div style={{ position: "relative", height: 6, background: "#0A0A0E", borderRadius: 4, overflow: "hidden" }}>
                {/* Center tick */}
                <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: C.border }} />
                {/* Deviation fill */}
                <div style={{
                  position: "absolute",
                  left: `${barLeft}%`,
                  width: `${barWidth}%`,
                  top: 0,
                  bottom: 0,
                  background: barColor,
                  borderRadius: 4,
                  transition: "width .3s, left .3s",
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
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
    <div className="oi-stagger" style={{
      background: C.panel,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: "10px 12px",
      display: "flex",
      flexWrap: "wrap",
      gap: 16,
      alignItems: "center",
    }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: C.dimmer }}>
        FEEDBACK SUMMARY
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
        <span style={{ fontFamily: mono, fontSize: 11, color: C.dim }}>
          Total: <span style={{ color: C.text, fontWeight: 700 }}>{stats.total}</span>
        </span>
        <span style={{ fontFamily: mono, fontSize: 11, color: C.dim }}>
          Hits: <span style={{ color: C.good, fontWeight: 700 }}>{stats.hits}</span>
        </span>
        <span style={{ fontFamily: mono, fontSize: 11, color: C.dim }}>
          Corrections: <span style={{ color: C.bad, fontWeight: 700 }}>{stats.corrections}</span>
        </span>
        <span style={{ fontFamily: mono, fontSize: 11, color: C.dim, display: "flex", alignItems: "center", gap: 4 }}>
          Accuracy:&nbsp;
          <AnimatedNumber value={stats.accuracy} decimals={1} suffix="%" style={{ color: accColor, fontWeight: 800, fontSize: 12, fontFamily: mono }} />
        </span>
        {stats.topPair && (
          <span style={{ fontFamily: mono, fontSize: 10, color: C.dimmer }}>
            Top mis-prediction:&nbsp;
            <Pill color={FAULTS[stats.topPair.from]?.color ?? C.dim}>{faultLabel(stats.topPair.from)}</Pill>
            <span style={{ margin: "0 4px", color: C.dimmer }}>→</span>
            <Pill color={FAULTS[stats.topPair.to]?.color ?? C.dim}>{faultLabel(stats.topPair.to)}</Pill>
            <span style={{ color: C.dimmer }}>&nbsp;({stats.topPair.n}×)</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function LearningView() {
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRow[]>([]);

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
      {/* Header */}
      <div className="oi-fadeup">
        <div style={{ fontFamily: mono, fontSize: 9, color: C.blue, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
          ACTIVE LEARNING
        </div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
          Ground-Truth Calibration
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: C.dim, fontFamily: mono, lineHeight: 1.6 }}>
          Each confirmed diagnosis nudges the Bayesian engine's per-fault priors
          (multipliers clamped 0.3–5×) so it learns the fault mix of this specific
          home's era, wiring, and environment — entirely offline.
        </p>
        {accuracyHistory.length >= 2 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <span style={{ fontFamily: mono, fontSize: 10, color: C.dimmer }}>Accuracy over time:</span>
            <Sparkline data={accuracyHistory} width={120} height={28} color={C.blue} />
          </div>
        )}
      </div>

      {/* Record panel */}
      <RecordPanel />

      {/* NEW: Bayesian learned model (diverging bar, per-fault multipliers) */}
      <LearnedModel />

      {/* Learned priors (existing — multiplier bars + sparklines + reset) */}
      <LearnedPriors />

      {/* Confusion summary (compact stats row derived from feedback) */}
      {feedbackRows.length > 0 && <ConfusionSummary rows={feedbackRows} />}

      {/* Feedback log */}
      <Card title="FEEDBACK LOG">
        <FeedbackLog onLoaded={setFeedbackRows} />
      </Card>
    </div>
  );
}
