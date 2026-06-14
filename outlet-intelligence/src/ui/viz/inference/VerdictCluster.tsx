/* ════════════════════════════════════════════════════════════════════════════
   VERDICT CLUSTER — hero instrument: RadialGauge + animated confidence +
   hold-halo + stat chips. One glance conveys the tribunal's conclusion.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import { RadialGauge, AnimatedNumber, GlowCard } from "../../anim";
import { C, mono } from "../../theme";
import { FAULTS } from "../../../core";
import type { analyzeOutlet } from "../../../core";

type Result = ReturnType<typeof analyzeOutlet>;

// Distil the verbose verdict string into a punchy display word
function shortVerdict(verdictCode: string): string {
  switch (verdictCode) {
    case "SAFETY HOLD": return "HOLD";
    case "CONDEMN":     return "CONDEMN";
    case "DEFECT":      return "DEFECT";
    case "MINOR":       return "MINOR";
    case "PASS":        return "PASS";
    case "INCONCLUSIVE":return "INCON";
    default:            return verdictCode.slice(0, 6);
  }
}

export function VerdictCluster({ result }: { result: Result }) {
  const vWord = shortVerdict(result.verdictCode);
  const confidencePct = result.confidence * 100;
  const topFaultLabel = result.topFault !== "healthy" ? (FAULTS[result.topFault]?.name ?? result.topFault) : "Healthy";

  return (
    <GlowCard accent={result.vColor} className="oi-popin" style={{ padding: "18px 16px" }}>
      {/* Section label */}
      <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, letterSpacing: 1.5, fontWeight: 700, marginBottom: 12 }}>
        ADJUDICATED VERDICT
      </div>

      {/* Gauge + hold halo row */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        {/* Hold halo wrapper */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          {result.hold && (
            <div
              className="oi-pulse"
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
            size={148}
            thickness={12}
            color={result.vColor}
            label={vWord}
            sublabel="CONFIDENCE"
            glow
          />
        </div>

        {/* Right-side info stack */}
        <div style={{ flex: 1, minWidth: 120, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Animated confidence % */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ color: C.dimmer, fontFamily: mono, fontSize: 9, letterSpacing: 1 }}>CONFIDENCE</span>
            <span style={{ color: result.vColor, fontFamily: mono, fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
              <AnimatedNumber value={confidencePct} decimals={1} suffix="%" />
            </span>
          </div>

          {/* Stat chips row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatChip label="H" value={result.H.toFixed(2)} unit="bits" color={C.blue} />
            <StatChip label="margin" value={result.margin.toFixed(1)} unit="×" color={C.amber} />
          </div>

          {/* Leading fault */}
          <div style={{ background: C.panel2, borderRadius: 8, padding: "6px 10px", borderLeft: `3px solid ${FAULTS[result.topFault]?.color ?? C.dim}` }}>
            <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 8, letterSpacing: 1, marginBottom: 2 }}>LEADING HYPOTHESIS</div>
            <div style={{ color: FAULTS[result.topFault]?.color ?? C.text, fontFamily: mono, fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>
              {topFaultLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Safety hold alert */}
      {result.hold && result.demand.length > 0 && (
        <div
          className="oi-pulse"
          style={{
            marginTop: 14,
            background: "#1A0404",
            border: `1px solid ${C.danger}`,
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <div style={{ color: "#FCA5A5", fontFamily: mono, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, marginBottom: 6 }}>
            ☠ SAFETY HOLD — RESOLVE BEFORE PROCEEDING
          </div>
          {result.demand.map((d, i) => (
            <div key={i} style={{ color: "#FECACA", fontFamily: mono, fontSize: 10.5, lineHeight: 1.6, marginBottom: 2 }}>
              ▸ {d}
            </div>
          ))}
        </div>
      )}
    </GlowCard>
  );
}

function StatChip({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{
      background: color + "18",
      border: `1px solid ${color}44`,
      borderRadius: 6,
      padding: "4px 8px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      minWidth: 48,
    }}>
      <span style={{ color, fontFamily: mono, fontWeight: 800, fontSize: 13, lineHeight: 1 }}>{value}<span style={{ fontSize: 9 }}>{unit}</span></span>
      <span style={{ color: C.dimmer, fontFamily: mono, fontSize: 8, letterSpacing: 0.5, marginTop: 2 }}>{label.toUpperCase()}</span>
    </div>
  );
}
