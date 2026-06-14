/* ════════════════════════════════════════════════════════════════════════════
   LEARNING VIEW — active-learning ground-truth feedback, prior calibration,
   and feedback history. Records confirmed diagnoses to locally recalibrate
   the Bayesian engine priors over time.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../../state/store";
import { FAULTS, FK } from "../../core";
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

      {/* Learned priors */}
      <LearnedPriors />

      {/* Feedback log */}
      <Card title="FEEDBACK LOG">
        <FeedbackLog onLoaded={setFeedbackRows} />
      </Card>
    </div>
  );
}
