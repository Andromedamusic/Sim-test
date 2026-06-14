/* ════════════════════════════════════════════════════════════════════════════
   POSTERIOR RACE — animated horizontal probability bars, sorted descending.
   MAP bar glows; lethal faults pulse + display skull. CSS width transitions
   drive the smooth update animation; no rAF overhead per bar.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import { AnimatedNumber, GlowCard, useReducedMotion } from "../../anim";
import { C, mono } from "../../theme";
import { FAULTS, topN } from "../../../core";
import type { analyzeOutlet } from "../../../core";

type Result = ReturnType<typeof analyzeOutlet>;

export function PosteriorRace({ post, topFault }: { post: Result["post"]; topFault: string }) {
  const reduced = useReducedMotion();
  const rows = topN(post, 7).filter(([, p]) => p > 0.005);

  if (rows.length === 0) {
    return (
      <GlowCard style={{ padding: "12px 14px" }}>
        <Header />
        <div style={{ color: C.dimmer, fontSize: 11, fontStyle: "italic" }}>No posterior data yet.</div>
      </GlowCard>
    );
  }

  const maxP = rows[0][1];

  return (
    <GlowCard accent={FAULTS[topFault]?.color} style={{ padding: "12px 14px" }}>
      <Header />
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {rows.map(([id, p], i) => {
          const f = FAULTS[id];
          if (!f) return null;
          const isMap = id === topFault;
          const pct = (p / (maxP || 1)) * 100;
          const absPct = p * 100;

          return (
            <div key={id} className={f.lethal && !reduced ? "oi-pulse" : undefined} style={{ position: "relative" }}>
              {/* Label row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {/* Rank badge */}
                  <span style={{
                    color: i === 0 ? f.color : C.dimmer,
                    fontFamily: mono,
                    fontSize: 9,
                    fontWeight: 700,
                    minWidth: 14,
                    opacity: 0.8,
                  }}>#{i + 1}</span>
                  <span style={{
                    color: f.color,
                    fontFamily: mono,
                    fontSize: 11,
                    fontWeight: isMap ? 800 : 600,
                    letterSpacing: isMap ? 0.3 : 0,
                  }}>
                    {f.name}
                    {f.lethal && (
                      <span style={{ marginLeft: 5, fontSize: 10 }}>☠</span>
                    )}
                  </span>
                </div>
                <span style={{
                  color: isMap ? f.color : C.dim,
                  fontFamily: mono,
                  fontSize: 11,
                  fontWeight: isMap ? 800 : 600,
                }}>
                  <AnimatedNumber value={absPct} decimals={1} suffix="%" />
                </span>
              </div>

              {/* Bar track */}
              <div style={{
                height: isMap ? 9 : 6,
                background: "#0A0A0E",
                borderRadius: 6,
                overflow: "hidden",
                boxShadow: isMap ? `0 0 0 1px ${f.color}33` : undefined,
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: isMap
                    ? `linear-gradient(90deg, ${f.color}cc, ${f.color})`
                    : f.color + "99",
                  borderRadius: 6,
                  transition: reduced ? "none" : "width 0.55s cubic-bezier(.2,.8,.2,1)",
                  boxShadow: isMap ? `0 0 8px ${f.color}88` : undefined,
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div style={{
        marginTop: 10,
        paddingTop: 7,
        borderTop: `1px solid ${C.border}`,
        color: C.dimmer,
        fontFamily: mono,
        fontSize: 9,
        display: "flex",
        gap: 14,
      }}>
        <span>Bars scaled to MAP</span>
        <span style={{ marginLeft: "auto" }}>
          Showing {rows.length} / {Object.keys(post).length} hypotheses
        </span>
      </div>
    </GlowCard>
  );
}

function Header() {
  return (
    <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, letterSpacing: 1.5, fontWeight: 700, marginBottom: 10 }}>
      POSTERIOR — FAULT PROBABILITY
    </div>
  );
}
