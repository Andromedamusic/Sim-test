/* ════════════════════════════════════════════════════════════════════════════
   CRITIC TRIBUNAL VIZ — six agent tiles that convey their adjudication
   visually. Tiles are color-lit, expandable (click to read debate transcript),
   VETO tiles show struck-through fault names, worst-case pulses red on hold.
   oi-stagger staggers the tile entrance animation.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useState } from "react";
import { GlowCard, useReducedMotion } from "../../anim";
import { C, mono } from "../../theme";
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
      <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, letterSpacing: 1.5, fontWeight: 700, marginBottom: 12 }}>
        CRITIC TRIBUNAL — 6 AGENTS ADJUDICATE
      </div>

      {/* Tile grid with stagger animation */}
      <div
        className="oi-stagger"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 8,
        }}
      >
        {critics.map((c) => {
          const isOpen = expanded === c.id;
          const isHold = c.id === "worstcase" && c.hold;
          const hasVeto = c.veto && c.veto.length > 0;

          return (
            <div
              key={c.id}
              className={`oi-lift oi-press${isHold && !reduced ? " oi-pulse" : ""}`}
              onClick={() => toggle(c.id)}
              style={{
                background: isOpen ? c.color + "18" : C.panel2,
                border: `1.5px solid ${isOpen ? c.color : c.color + "55"}`,
                borderRadius: 10,
                padding: "10px 10px 8px",
                cursor: "pointer",
                transition: "background 0.2s, border-color 0.2s",
                boxShadow: isOpen ? `0 0 14px ${c.color}44` : undefined,
              }}
            >
              {/* Icon + name row */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{c.icon}</span>
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
                  <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 8, lineHeight: 1.2 }}>
                    {c.role}
                  </div>
                </div>
              </div>

              {/* Power badge */}
              <div style={{ marginBottom: hasVeto ? 6 : 0 }}>
                <span style={{
                  background: c.color + "22",
                  color: c.color,
                  fontFamily: mono,
                  fontSize: 8,
                  fontWeight: 800,
                  padding: "2px 6px",
                  borderRadius: 4,
                  letterSpacing: 0.3,
                }}>
                  {c.power}
                </span>
              </div>

              {/* Veto list — struck-through fault names */}
              {hasVeto && (
                <div style={{ marginTop: 5 }}>
                  <div style={{ color: C.bad, fontFamily: mono, fontSize: 8, fontWeight: 700, marginBottom: 3, letterSpacing: 0.5 }}>
                    VETOED:
                  </div>
                  {c.veto!.map((v) => (
                    <div key={v} style={{
                      color: C.dim,
                      fontFamily: mono,
                      fontSize: 8.5,
                      textDecoration: "line-through",
                      textDecorationColor: C.bad + "aa",
                      lineHeight: 1.5,
                    }}>
                      {FAULTS[v]?.name ?? v}
                    </div>
                  ))}
                </div>
              )}

              {/* Hold indicator */}
              {isHold && (
                <div style={{ marginTop: 6, color: C.danger, fontFamily: mono, fontSize: 9, fontWeight: 800 }}>
                  ☠ HOLD DEMANDED
                </div>
              )}

              {/* Expand caret */}
              <div style={{
                textAlign: "right",
                color: c.color + "88",
                fontFamily: mono,
                fontSize: 10,
                marginTop: 6,
                lineHeight: 1,
              }}>
                {isOpen ? "▲ hide" : "▼ read"}
              </div>
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
              marginTop: 12,
              background: C.bg,
              border: `1px solid ${c.color}55`,
              borderLeft: `3px solid ${c.color}`,
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{c.icon}</span>
              <div>
                <div style={{ color: c.color, fontFamily: mono, fontWeight: 800, fontSize: 12 }}>{c.name}</div>
                <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 9 }}>{c.role}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                <span style={{
                  background: c.color + "22",
                  color: c.color,
                  fontFamily: mono,
                  fontSize: 8.5,
                  fontWeight: 800,
                  padding: "2px 7px",
                  borderRadius: 4,
                }}>
                  {c.power}
                </span>
                <span style={{ color: C.dimmer, fontFamily: mono, fontSize: 8 }}>
                  conf {(c.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Arguments */}
            {c.args.length === 0 ? (
              <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 10, fontStyle: "italic" }}>No findings this run.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {c.args.map((arg, i) => (
                  <div key={i} style={{
                    color: C.text,
                    fontFamily: mono,
                    fontSize: 10.5,
                    lineHeight: 1.6,
                    paddingLeft: 12,
                    borderLeft: `2px solid ${c.color}44`,
                  }}>
                    ▸ {arg}
                  </div>
                ))}
              </div>
            )}

            {/* Modal / deferred notice */}
            {c.modal && (
              <div style={{ marginTop: 8, color: C.amber, fontFamily: mono, fontSize: 9.5 }}>
                Modal: {c.modal}
              </div>
            )}
            {c.deferred && (
              <div style={{ marginTop: 4, color: C.dimmer, fontFamily: mono, fontSize: 9, fontStyle: "italic" }}>
                (deferred — awaiting more evidence)
              </div>
            )}
          </div>
        );
      })()}
    </GlowCard>
  );
}
