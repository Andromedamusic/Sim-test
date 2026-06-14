/* ════════════════════════════════════════════════════════════════════════════
   POSTERIOR RACE — sleek HUD probability bar stack. MAP row has a bracket
   glow and larger height; lethal rows pulse red; all % values are animated
   AnimatedNumbers in monospace. Header wears a diamond-tick section label.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import { AnimatedNumber, GlowCard, useReducedMotion } from "../../anim";
import { C, HUD, mono } from "../../theme";
import { Bracket } from "../../hud/Bracket";
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
    <GlowCard accent={FAULTS[topFault]?.color} style={{ padding: "14px 14px" }}>
      <Header />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(([id, p], i) => {
          const f = FAULTS[id];
          if (!f) return null;
          const isMap = id === topFault;
          const isLethal = !!f.lethal;
          const pct = (p / (maxP || 1)) * 100;
          const absPct = p * 100;

          return (
            <div
              key={id}
              className={isLethal && !reduced ? "oi-pulse" : undefined}
              style={{ position: "relative" }}
            >
              {/* Label + percent row */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 5,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {/* MAP bracket marker */}
                  {isMap ? (
                    <span style={{
                      color: f.color,
                      fontFamily: mono,
                      fontSize: 9,
                      fontWeight: 900,
                      letterSpacing: 0.5,
                      background: f.color + "18",
                      border: `1px solid ${f.color}55`,
                      borderRadius: 4,
                      padding: "1px 5px",
                    }}>MAP</span>
                  ) : (
                    <span style={{
                      color: C.dimmer,
                      fontFamily: mono,
                      fontSize: 9,
                      fontWeight: 700,
                      minWidth: 22,
                      opacity: 0.7,
                    }}>#{i + 1}</span>
                  )}
                  <span style={{
                    color: isMap ? f.color : C.dim,
                    fontFamily: mono,
                    fontSize: isMap ? 12 : 11,
                    fontWeight: isMap ? 800 : 500,
                    letterSpacing: isMap ? 0.4 : 0,
                  }}>
                    {f.name}
                    {isLethal && <span style={{ marginLeft: 6, fontSize: 10, color: C.danger }}>☠</span>}
                  </span>
                </div>

                {/* Animated % */}
                <span style={{
                  color: isMap ? f.color : C.dimmer,
                  fontFamily: mono,
                  fontSize: isMap ? 14 : 11,
                  fontWeight: isMap ? 900 : 600,
                  minWidth: 52,
                  textAlign: "right",
                }}>
                  <AnimatedNumber value={absPct} decimals={1} suffix="%" />
                </span>
              </div>

              {/* Bar track */}
              <div style={{
                position: "relative",
                height: isMap ? 10 : 5,
                background: HUD.void,
                borderRadius: 6,
                overflow: "hidden",
                boxShadow: isMap ? `0 0 0 1px ${f.color}44` : undefined,
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: isMap
                    ? `linear-gradient(90deg,${f.color}99 0%,${f.color} 100%)`
                    : f.color + (isLethal ? "cc" : "77"),
                  borderRadius: 6,
                  transition: reduced ? "none" : "width 0.55s cubic-bezier(.2,.8,.2,1)",
                  boxShadow: isMap ? `0 0 10px ${f.color}88` : undefined,
                }} />
              </div>

              {/* MAP gets Bracket overlay */}
              {isMap && (
                <div style={{ position: "relative", marginTop: 2 }}>
                  <Bracket color={f.color} size={8} inset={0} weight={1} opacity={0.65} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 12,
        paddingTop: 8,
        borderTop: `1px solid ${C.border}`,
        color: C.dimmer,
        fontFamily: mono,
        fontSize: 8.5,
        display: "flex",
        gap: 14,
        letterSpacing: 0.3,
      }}>
        <span>bars scaled to MAP</span>
        <span style={{ marginLeft: "auto" }}>
          {rows.length} / {Object.keys(post).length} hypotheses shown
        </span>
      </div>
    </GlowCard>
  );
}

function Header() {
  return (
    <div style={{
      color: C.dimmer,
      fontSize: 9,
      fontFamily: mono,
      letterSpacing: 2,
      fontWeight: 700,
      marginBottom: 12,
      display: "flex",
      alignItems: "center",
      gap: 6,
    }}>
      <span style={{ color: HUD.cyan, fontSize: 7 }}>◆</span>
      POSTERIOR — FAULT PROBABILITY
    </div>
  );
}
