/* ═══════════════════════════════════════════════════════════════════════════
   DiagnosticWidget — embeddable outlet-diagnostic card.
   Drop into any React dashboard to show a live verdict for one outlet.
   Dependency-free beyond React itself and the core engine.
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useMemo } from "react";
import { analyzeOutlet, type Observation, type Meta, type TribunalResult } from "../core";
import { C, mono, VERDICT_COLOR } from "./theme";

// ─── Public contract ──────────────────────────────────────────────────────────

export interface DiagnosticWidgetProps {
  /** Partial observation — merged with empty defaults; missing fields = no evidence. */
  initialObservations?: Partial<Observation>;
  /** Partial meta — merged with DEFAULT_META below. */
  meta?: Partial<Meta>;
  /** Called once after the engine computes a result. */
  onResult?: (r: TribunalResult) => void;
  /** When true the card is display-only (no interactive controls rendered). */
  readOnly?: boolean;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_META: Meta = {
  era: "1990-2000",
  wireMat: "Copper",
  meter: "Fluke 117",
  meterZ: 10e6,
};

const EMPTY_OBS: Observation = {};

// ─── Component ────────────────────────────────────────────────────────────────

export function DiagnosticWidget(props: DiagnosticWidgetProps): React.ReactElement {
  const { initialObservations, meta: metaOverride, onResult, readOnly = false } = props;

  const obs: Observation = useMemo(
    () => ({ ...EMPTY_OBS, ...initialObservations }),
    [initialObservations]
  );

  const meta: Meta = useMemo(
    () => ({ ...DEFAULT_META, ...metaOverride }),
    [metaOverride]
  );

  const result = useMemo(() => analyzeOutlet(obs, meta), [obs, meta]);

  // Notify parent after each compute
  useEffect(() => {
    if (onResult) onResult(result);
  }, [result, onResult]);

  const verdictColor = VERDICT_COLOR[result.verdictCode] ?? C.dim;
  const pct = Math.round(result.confidence * 100);
  const top3 = result.ranked.slice(0, 3);
  const topProb = top3[0]?.[1] ?? 1;

  // ─── Styles (inline; no Tailwind dependency) ─────────────────────────────
  const card: React.CSSProperties = {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: "18px 20px",
    fontFamily: mono,
    color: C.text,
    minWidth: 260,
    maxWidth: 420,
    boxSizing: "border-box",
  };

  const headerRow: React.CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 14,
  };

  const verdictLabel: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.07em",
    color: verdictColor,
    textTransform: "uppercase" as const,
  };

  const confidenceLabel: React.CSSProperties = {
    fontSize: 11,
    color: C.dim,
  };

  const barSection: React.CSSProperties = {
    display: "flex",
    flexDirection: "column" as const,
    gap: 7,
  };

  const barRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  const barLabel: React.CSSProperties = {
    fontSize: 10,
    color: C.dim,
    width: 110,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  };

  const barTrack: React.CSSProperties = {
    flex: 1,
    height: 8,
    background: C.panel2,
    borderRadius: 4,
    overflow: "hidden",
  };

  const barPct: React.CSSProperties = {
    fontSize: 10,
    color: C.dimmer,
    width: 34,
    textAlign: "right" as const,
    flexShrink: 0,
  };

  const topFaultRow: React.CSSProperties = {
    marginTop: 14,
    fontSize: 10,
    color: C.dim,
    borderTop: `1px solid ${C.border}`,
    paddingTop: 10,
  };

  return (
    <div style={card} role="region" aria-label="Outlet diagnostic result">
      <div style={headerRow}>
        <span style={verdictLabel}>{result.verdict}</span>
        <span style={confidenceLabel}>{pct}% confidence</span>
      </div>

      <div style={barSection} aria-label="Top posterior hypotheses">
        {top3.map(([faultId, prob]) => {
          const fillPct = topProb > 0 ? (prob / topProb) * 100 : 0;
          const fillColor = prob > 0.5 ? verdictColor : C.amber;
          return (
            <div key={faultId} style={barRow}>
              <span style={barLabel} title={faultId}>{faultId}</span>
              <div style={barTrack} role="progressbar" aria-valuenow={Math.round(prob * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div
                  style={{
                    width: `${fillPct}%`,
                    height: "100%",
                    background: fillColor,
                    borderRadius: 4,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <span style={barPct}>{Math.round(prob * 100)}%</span>
            </div>
          );
        })}
      </div>

      {result.topFault && (
        <div style={topFaultRow}>
          {readOnly ? null : null}
          <span style={{ color: C.dimmer }}>Top hypothesis: </span>
          <span style={{ color: C.text }}>{result.topFault}</span>
          {result.hold && (
            <span
              style={{
                marginLeft: 10,
                color: VERDICT_COLOR["SAFETY HOLD"],
                fontWeight: 700,
                fontSize: 10,
              }}
            >
              HOLD
            </span>
          )}
        </div>
      )}
    </div>
  );
}
