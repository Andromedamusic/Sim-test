/* ════════════════════════════════════════════════════════════════════════════
   VERDICT CLUSTER — Halo-grade hero instrument: RadialGauge at 168px with
   verdict word in holo/amber gradient, corner Brackets in verdict color, an
   animated top scan-line, pulsing red frame on hold, and telemetry chips.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import { RadialGauge, useReducedMotion } from "../../anim";
import { C, HUD, mono, holoGrad, amberGrad } from "../../theme";
import { Bracket } from "../../hud/Bracket";
import { OIcon, VERDICT_ICON } from "../../icons/OIcon";
import { FAULTS } from "../../../core";
import type { analyzeOutlet } from "../../../core";

type Result = ReturnType<typeof analyzeOutlet>;

function shortVerdict(verdictCode: string): string {
  switch (verdictCode) {
    case "SAFETY HOLD": return "HOLD";
    case "CONDEMN":      return "CONDEMN";
    case "DEFECT":       return "DEFECT";
    case "MINOR":        return "MINOR";
    case "PASS":         return "PASS";
    case "INCONCLUSIVE": return "INCON";
    default:             return verdictCode.slice(0, 6);
  }
}

/** Pick the gradient for the verdict word */
function verdictGrad(verdictCode: string, vColor: string): string {
  if (verdictCode === "PASS") return holoGrad;
  if (verdictCode === "SAFETY HOLD" || verdictCode === "CONDEMN") {
    return `linear-gradient(135deg,${C.danger} 0%,#FF8080 100%)`;
  }
  if (verdictCode === "DEFECT" || verdictCode === "MINOR") return amberGrad;
  return `linear-gradient(135deg,${vColor} 0%,${vColor}99 100%)`;
}

/** Severity label for leading fault */
function sevLabel(sev: number): string {
  if (sev >= 9) return "CRITICAL";
  if (sev >= 7) return "HIGH";
  if (sev >= 5) return "MODERATE";
  if (sev >= 3) return "LOW";
  return "TRACE";
}

export function VerdictCluster({ result }: { result: Result }) {
  const reduced = useReducedMotion();
  const vWord = shortVerdict(result.verdictCode);
  const confidencePct = result.confidence * 100;
  const topFaultLabel = result.topFault !== "healthy"
    ? (FAULTS[result.topFault]?.name ?? result.topFault)
    : "Healthy";
  const topFaultColor = FAULTS[result.topFault]?.color ?? C.good;
  const topFaultSev   = FAULTS[result.topFault]?.sev ?? 0;
  const grad = verdictGrad(result.verdictCode, result.vColor);

  return (
    <div
      className={`oi-popin${result.hold && !reduced ? " oi-pulse" : ""}`}
      style={{
        position: "relative",
        borderRadius: 16,
        padding: "18px 16px 16px",
        background: result.hold
          ? `linear-gradient(160deg,#1A0404dd,#0D060Add)`
          : `linear-gradient(160deg,#0D131Ddd,#0A0F17dd)`,
        border: result.hold
          ? `1.5px solid ${C.danger}`
          : `1.5px solid ${result.vColor}55`,
        boxShadow: result.hold
          ? `0 0 0 1px ${C.danger}44, 0 8px 40px -12px ${C.danger}88`
          : `0 0 0 1px ${result.vColor}22, 0 8px 40px -14px ${result.vColor}88`,
        backdropFilter: "blur(10px)",
        overflow: "hidden",
      }}
    >
      {/* Corner brackets */}
      <Bracket color={result.vColor} size={14} inset={4} weight={2} opacity={0.9} />

      {/* Top accent line — animated scan only on real severity verdicts, static otherwise */}
      {(result.hold || result.verdictCode === "CONDEMN" || result.verdictCode === "DEFECT") ? (
        !reduced ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              background: `linear-gradient(90deg,transparent 0%,${result.vColor}cc 40%,${result.vColor} 50%,${result.vColor}cc 60%,transparent 100%)`,
              animation: "oi-scan 3.2s linear infinite",
              opacity: 0.7,
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        ) : (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: result.vColor, opacity: 0.7, pointerEvents: "none", zIndex: 2 }} />
        )
      ) : (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `${result.vColor}55`, pointerEvents: "none", zIndex: 2 }} />
      )}

      {/* Section label */}
      <div style={{
        color: C.dim,
        fontSize: 10,
        fontFamily: mono,
        letterSpacing: 1.5,
        fontWeight: 700,
        marginBottom: 14,
        textTransform: "uppercase",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        <span style={{ width: 3, height: 9, borderRadius: 2, background: result.vColor, display: "inline-block", flexShrink: 0 }} />
        ADJUDICATED VERDICT
      </div>

      {/* Gauge + right info stack */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        {/* Hold halo wrapper + gauge */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          {result.hold && (
            <div
              className={reduced ? undefined : "oi-pulse"}
              style={{
                position: "absolute",
                inset: -10,
                borderRadius: "50%",
                border: `3px solid ${C.danger}`,
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          )}
          <RadialGauge
            value={result.confidence}
            max={1}
            size={168}
            thickness={13}
            color={result.vColor}
            label={`${Math.round(confidencePct)}%`}
            sublabel="CONFIDENCE"
            glow
          />
        </div>

        {/* Right info stack */}
        <div style={{ flex: 1, minWidth: 120, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Big verdict word in gradient, led by its hex-frame glyph */}
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <OIcon
              name={VERDICT_ICON[result.verdictCode] ?? "verdictInconclusive"}
              size={34}
              color={result.vColor}
              accent={result.vColor}
              style={{ filter: `drop-shadow(0 0 7px ${result.vColor}66)`, flexShrink: 0 }}
            />
            <div style={{
              fontFamily: mono,
              fontWeight: 900,
              fontSize: 28,
              lineHeight: 1,
              background: grad,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: 1,
            }}>
              {vWord}
            </div>
          </div>

          {/* Telemetry chips row */}
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <TelChip label="ENTROPY H" value={result.H.toFixed(2)} unit="bits" color={HUD.cyan} />
            <TelChip label="MARGIN" value={result.margin.toFixed(1)} unit="×" color={C.amber} />
            <TelChip label="SEV" value={sevLabel(topFaultSev)} unit="" color={topFaultColor} />
          </div>
        </div>
      </div>

      {/* Leading hypothesis bar */}
      <div style={{
        marginTop: 14,
        background: topFaultColor + "12",
        borderRadius: 10,
        padding: "8px 12px",
        borderLeft: `3px solid ${topFaultColor}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 8, letterSpacing: 1.2, marginBottom: 3 }}>LEADING HYPOTHESIS</div>
          <div style={{
            color: topFaultColor,
            fontFamily: mono,
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {topFaultLabel}
          </div>
        </div>
        {topFaultSev > 0 && (
          <div style={{
            color: topFaultColor,
            fontFamily: mono,
            fontSize: 18,
            fontWeight: 900,
            lineHeight: 1,
            textAlign: "center",
            flexShrink: 0,
          }}>
            {topFaultSev}
            <div style={{ fontSize: 10, color: C.dim, fontWeight: 400, letterSpacing: 0.5, marginTop: 1 }}>/ 10</div>
          </div>
        )}
      </div>

      {/* Safety hold alert */}
      {result.hold && result.demand.length > 0 && (
        <div
          style={{
            marginTop: 12,
            background: "#1A0404",
            border: `1px solid ${C.danger}`,
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <div style={{ color: "#FCA5A5", fontFamily: mono, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.8, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <OIcon name="shield" size={13} color="#FCA5A5" accent={C.danger} />SAFETY HOLD — RESOLVE BEFORE PROCEEDING
          </div>
          {result.demand.map((d, i) => (
            <div key={i} style={{ color: "#FECACA", fontFamily: mono, fontSize: 10.5, lineHeight: 1.7, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ display: "inline-block", width: 7, height: 1.5, background: "#FCA5A5", borderRadius: 1, marginTop: 7, flexShrink: 0 }} />
              <span>{d}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TelChip({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{
      background: color + "14",
      border: `1px solid ${color}44`,
      borderRadius: 7,
      padding: "5px 9px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      minWidth: 52,
    }}>
      <span style={{
        color,
        fontFamily: mono,
        fontWeight: 800,
        fontSize: unit ? 13 : 10,
        lineHeight: 1,
      }}>
        {value}
        {unit && <span style={{ fontSize: 8.5, marginLeft: 1 }}>{unit}</span>}
      </span>
      <span style={{ color: C.dim, fontFamily: mono, fontSize: 10, letterSpacing: 1, marginTop: 3 }}>{label}</span>
    </div>
  );
}
