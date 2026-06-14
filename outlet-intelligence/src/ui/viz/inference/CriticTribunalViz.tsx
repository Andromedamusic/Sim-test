/* ════════════════════════════════════════════════════════════════════════════
   CRITIC TRIBUNAL VIZ — six HUD "agent" tiles in a row, each with bracketed
   active states, color-coded power badges, and an expandable transcript. The
   worst-case tile pulses red on hold; veto entries are struck through.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useState } from "react";
import { GlowCard, useReducedMotion } from "../../anim";
import { C, HUD, mono } from "../../theme";
import { Bracket } from "../../hud/Bracket";
import { FAULTS } from "../../../core";
import type { Critic } from "../../../core";

interface Props {
  critics: Critic[];
}

export function CriticTribunalViz({ critics }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const reduced = useReducedMotion();

  const toggle = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  return (
    <GlowCard style={{ padding: "14px 14px" }}>
      {/* Section header */}
      <div style={{
        color: C.dimmer,
        fontSize: 9,
        fontFamily: mono,
        letterSpacing: 2,
        fontWeight: 700,
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        <span style={{ color: HUD.cyan, fontSize: 7 }}>◆</span>
        CRITIC TRIBUNAL — 6 AGENTS ADJUDICATE
      </div>

      {/* Tile row with stagger animation */}
      <div
        className="oi-stagger"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 8,
        }}
      >
        {critics.map((c) => {
          const isOpen = expanded === c.id;
          const isHold = c.id === "worstcase" && c.hold;
          const hasVeto = c.veto && c.veto.length > 0;
          const hasArgs = c.args && c.args.length > 0;

          return (
            <div
              key={c.id}
              className={`oi-lift oi-press${isHold && !reduced ? " oi-pulse" : ""}`}
              onClick={() => toggle(c.id)}
              style={{
                position: "relative",
                background: isOpen ? c.color + "16" : C.panel2,
                border: `1.5px solid ${isOpen ? c.color : c.color + "44"}`,
                borderRadius: 11,
                padding: "10px 10px 8px",
                cursor: "pointer",
                transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
                boxShadow: isOpen
                  ? `0 0 18px ${c.color}44, 0 0 0 1px ${c.color}22`
                  : isHold
                  ? `0 0 14px ${C.danger}44`
                  : undefined,
                overflow: "hidden",
              }}
            >
              {/* Bracket overlays when open */}
              {isOpen && (
                <Bracket color={c.color} size={10} inset={3} weight={1.5} opacity={0.8} />
              )}

              {/* Confidence micro-bar at top */}
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: HUD.line,
                borderRadius: "11px 11px 0 0",
                overflow: "hidden",
              }}>
                <div style={{
                  width: `${(c.confidence ?? 0.5) * 100}%`,
                  height: "100%",
                  background: c.color,
                  transition: "width 0.5s cubic-bezier(.2,.8,.2,1)",
                  boxShadow: `0 0 6px ${c.color}aa`,
                }} />
              </div>

              {/* Icon + name row */}
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{c.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: c.color,
                    fontFamily: mono,
                    fontSize: 10,
                    fontWeight: 800,
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {c.name}
                  </div>
                  <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 7.5, lineHeight: 1.3, marginTop: 1 }}>
                    {c.role}
                  </div>
                </div>
              </div>

              {/* Power badge */}
              <div style={{ marginBottom: hasVeto ? 7 : 0 }}>
                <span style={{
                  display: "inline-block",
                  background: c.color + "22",
                  color: c.color,
                  fontFamily: mono,
                  fontSize: 7.5,
                  fontWeight: 900,
                  padding: "2px 7px",
                  borderRadius: 5,
                  letterSpacing: 0.5,
                  border: `1px solid ${c.color}44`,
                }}>
                  {c.power}
                </span>
              </div>

              {/* Veto list */}
              {hasVeto && (
                <div style={{ marginTop: 5 }}>
                  <div style={{ color: C.bad, fontFamily: mono, fontSize: 7.5, fontWeight: 700, marginBottom: 3, letterSpacing: 0.5 }}>
                    VETOED:
                  </div>
                  {c.veto!.map((v) => (
                    <div key={v} style={{
                      color: C.dim,
                      fontFamily: mono,
                      fontSize: 8.5,
                      textDecoration: "line-through",
                      textDecorationColor: C.bad + "aa",
                      lineHeight: 1.55,
                    }}>
                      {FAULTS[v]?.name ?? v}
                    </div>
                  ))}
                </div>
              )}

              {/* Hold indicator */}
              {isHold && (
                <div style={{
                  marginTop: 7,
                  color: C.danger,
                  fontFamily: mono,
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                }}>
                  ☠ HOLD DEMANDED
                </div>
              )}

              {/* Arg count hint */}
              {hasArgs && (
                <div style={{
                  marginTop: 6,
                  color: c.color + "99",
                  fontFamily: mono,
                  fontSize: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <span>{c.args.length} finding{c.args.length !== 1 ? "s" : ""}</span>
                  <span>{isOpen ? "▲" : "▼"}</span>
                </div>
              )}
              {!hasArgs && (
                <div style={{
                  marginTop: 6,
                  textAlign: "right",
                  color: c.color + "77",
                  fontFamily: mono,
                  fontSize: 9,
                }}>
                  {isOpen ? "▲" : "▼"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded transcript panel */}
      {expanded && (() => {
        const c = critics.find((x) => x.id === expanded);
        if (!c) return null;
        return (
          <div
            className="oi-fadeup"
            style={{
              marginTop: 14,
              position: "relative",
              background: `linear-gradient(160deg,${C.bg}ee,#0A0F1Aee)`,
              border: `1px solid ${c.color}55`,
              borderLeft: `3px solid ${c.color}`,
              borderRadius: 12,
              padding: "14px 16px",
              backdropFilter: "blur(6px)",
            }}
          >
            <Bracket color={c.color} size={10} inset={4} weight={1} opacity={0.6} />

            {/* Transcript header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{c.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: c.color, fontFamily: mono, fontWeight: 800, fontSize: 13, lineHeight: 1.2 }}>{c.name}</div>
                <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 9, marginTop: 2 }}>{c.role}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span style={{
                  background: c.color + "22",
                  color: c.color,
                  fontFamily: mono,
                  fontSize: 8.5,
                  fontWeight: 900,
                  padding: "2px 8px",
                  borderRadius: 5,
                  border: `1px solid ${c.color}44`,
                }}>
                  {c.power}
                </span>
                <span style={{ color: C.dimmer, fontFamily: mono, fontSize: 8.5 }}>
                  conf {((c.confidence ?? 0.5) * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Confidence bar in transcript */}
            <div style={{
              height: 3,
              background: HUD.line,
              borderRadius: 4,
              overflow: "hidden",
              marginBottom: 14,
            }}>
              <div style={{
                width: `${(c.confidence ?? 0.5) * 100}%`,
                height: "100%",
                background: `linear-gradient(90deg,${c.color}88,${c.color})`,
                borderRadius: 4,
                boxShadow: `0 0 8px ${c.color}77`,
              }} />
            </div>

            {/* Arguments */}
            {c.args.length === 0 ? (
              <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 10, fontStyle: "italic" }}>
                No findings this run.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {c.args.map((arg, i) => (
                  <div key={i} style={{
                    color: C.text,
                    fontFamily: mono,
                    fontSize: 10.5,
                    lineHeight: 1.65,
                    paddingLeft: 14,
                    borderLeft: `2px solid ${c.color}55`,
                  }}>
                    <span style={{ color: c.color + "99", marginRight: 6 }}>▸</span>
                    {arg}
                  </div>
                ))}
              </div>
            )}

            {/* Modal / deferred notices */}
            {c.modal && (
              <div style={{ marginTop: 10, color: C.amber, fontFamily: mono, fontSize: 9.5 }}>
                Modal: {c.modal}
              </div>
            )}
            {c.deferred && (
              <div style={{ marginTop: 5, color: C.dimmer, fontFamily: mono, fontSize: 9, fontStyle: "italic" }}>
                (deferred — awaiting more evidence)
              </div>
            )}
          </div>
        );
      })()}
    </GlowCard>
  );
}
