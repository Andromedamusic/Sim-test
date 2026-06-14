/* ════════════════════════════════════════════════════════════════════════════
   HOME — centralized intelligence model. Whole-home health, systemic patterns,
   circuit breaker bus, room heatmap, and prioritized remediation. Composes
   animated sub-views; honours prefers-reduced-motion throughout.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import { useStore } from "../../state/store";
import { type HomeHealth } from "../../core";
import { C, mono, HUD } from "../theme";
import { GlowCard, useReducedMotion } from "../anim";
import { Card, Pill, SectionHeader } from "../components";
import { Bracket } from "../hud/Bracket";
import { HealthHero } from "../viz/home/HealthHero";
import { CircuitBus } from "../viz/home/CircuitBus";
import { RoomHeatmap } from "../viz/home/RoomHeatmap";

const URGENCY_COLOR: Record<string, string> = {
  IMMEDIATE: C.danger,
  SOON: C.warn,
  PLANNED: C.dim,
};

const RANK_MEDAL: Record<number, { bg: string; color: string; label: string }> = {
  1: { bg: "#2D220099", color: "#F59E0B", label: "🥇" },
  2: { bg: "#1C1C1C99", color: "#D1D5DB", label: "🥈" },
  3: { bg: "#1C120099", color: "#D97706", label: "🥉" },
};

export function HomeDashboardView({ health, onGoMap }: { health: HomeHealth; onGoMap: () => void }) {
  const { model } = useStore();
  const reduced = useReducedMotion();
  if (!model) return null;

  const roomName = (id: string) =>
    model.rooms.find((r) => r.id === id)?.name ?? id;
  const floorName = (id: string) =>
    model.floors.find((f) => f.id === id)?.name ?? "Floor";
  const circuitName = (id: string) =>
    model.circuits.find((c) => c.id === id)?.breakerLabel ?? id;

  const placed = model.outlets.length;
  const measured = model.outlets.filter((o) => o.inference).length;

  // Partition systemic flags by urgency for ordering
  const immediateFlags = health.systemicFlags.filter((f) => f.urgency === "IMMEDIATE");
  const otherFlags = health.systemicFlags.filter((f) => f.urgency !== "IMMEDIATE");
  const orderedFlags = [...immediateFlags, ...otherFlags];

  return (
    <div
      className={reduced ? "" : "oi-stagger"}
      style={{ display: "grid", gap: 16 }}
    >
      {/* ── 1. HEALTH HERO ── */}
      <HealthHero
        health={health}
        onGoMap={onGoMap}
        placed={placed}
        measured={measured}
      />

      {/* ── 2. SYSTEMIC PATTERNS ── */}
      {orderedFlags.length > 0 && (
        <section className={reduced ? "" : "oi-fadeup"}>
          <SectionHeader
            label="SYSTEMIC PATTERNS"
            sub="wiring / circuit-scope — not device-local"
          />
          <div
            className={reduced ? "" : "oi-stagger"}
            style={{ display: "grid", gap: 9 }}
          >
            {orderedFlags.map((f, i) => {
              const uc = URGENCY_COLOR[f.urgency];
              const isImmediate = f.urgency === "IMMEDIATE";
              // Only pulse the first IMMEDIATE flag — avoid christmas-light effect
              const isFirstImmediate = isImmediate && i === 0;
              return (
                <GlowCard
                  key={i}
                  accent={uc}
                  className={isFirstImmediate && !reduced ? "oi-pulse" : undefined}
                  style={{
                    background: isImmediate
                      ? "linear-gradient(160deg,#1A0606cc,#100808cc)"
                      : "linear-gradient(160deg,#1A1200cc,#101008cc)",
                    padding: "12px 14px",
                    position: "relative",
                  }}
                >
                  {/* left status bar */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 8,
                      bottom: 8,
                      width: 3,
                      borderRadius: "0 2px 2px 0",
                      background: `linear-gradient(180deg, ${uc}dd 0%, ${uc}55 100%)`,
                      boxShadow: `0 0 8px -2px ${uc}88`,
                    }}
                  />
                  <Bracket color={uc} size={9} inset={4} weight={1.5} opacity={0.55} />

                  {/* header row */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 7,
                      flexWrap: "wrap",
                    }}
                  >
                    <Pill color={uc}>{f.urgency}</Pill>
                    <span
                      style={{
                        color: C.warn,
                        fontSize: 10.5,
                        fontFamily: mono,
                        fontWeight: 800,
                        letterSpacing: 0.8,
                      }}
                    >
                      {f.type.replace(/_/g, " ")}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        color: C.dim,
                        fontSize: 10,
                        fontFamily: mono,
                      }}
                    >
                      {f.scope === "circuit"
                        ? circuitName(f.scopeId)
                        : roomName(f.scopeId)}
                    </span>
                    <span
                      style={{
                        color: C.dim,
                        fontSize: 10,
                        fontFamily: mono,
                      }}
                    >
                      {f.outletIds.length} outlet{f.outletIds.length !== 1 ? "s" : ""}
                      {" · "}
                      {Math.round(f.confidence * 100)}% conf
                    </span>
                  </div>

                  {/* description */}
                  <div
                    style={{
                      color: C.text,
                      fontSize: 11.5,
                      lineHeight: 1.6,
                      marginBottom: 5,
                    }}
                  >
                    {f.description}
                  </div>

                  {/* remedy */}
                  <div
                    style={{
                      color: C.dim,
                      fontSize: 10.5,
                      lineHeight: 1.5,
                      borderTop: `1px solid ${C.border}`,
                      paddingTop: 7,
                      marginTop: 3,
                    }}
                  >
                    <span
                      style={{
                        color: C.dim,
                        fontFamily: mono,
                        fontSize: 10,
                        letterSpacing: 1,
                        marginRight: 6,
                        textTransform: "uppercase" as const,
                      }}
                    >
                      REMEDY
                    </span>
                    {f.remedy}
                  </div>
                </GlowCard>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 3. BREAKER PANEL (CircuitBus) ── */}
      {health.circuits.length > 0 && (
        <section className={reduced ? "" : "oi-fadeup"}>
          <SectionHeader
            label="BREAKER PANEL"
            sub={`${health.circuits.length} circuit${health.circuits.length !== 1 ? "s" : ""} · bus-bar view`}
          />
          <Card
            style={{
              background: `linear-gradient(160deg, #0D131Dee, #0A0F17ee)`,
              border: `1px solid ${HUD.line}`,
              borderTop: `2px solid ${HUD.lineHi}`,
              position: "relative",
            }}
          >
            <Bracket color={HUD.cyan} size={10} inset={5} weight={1.5} opacity={0.4} />
            <CircuitBus circuits={health.circuits} nameOf={circuitName} />
          </Card>
        </section>
      )}

      {/* ── 4. FLOORS & ROOMS (RoomHeatmap) ── */}
      {health.floors.length > 0 && (
        <section className={reduced ? "" : "oi-fadeup"}>
          <SectionHeader
            label="FLOORS & ROOMS"
            sub="grade heat by room"
          />
          <Card
            style={{
              background: `linear-gradient(160deg, #0D131Dee, #0A0F17ee)`,
              border: `1px solid ${HUD.line}`,
              borderTop: `2px solid ${HUD.lineHi}`,
              position: "relative",
            }}
          >
            <Bracket color={HUD.cyan} size={10} inset={5} weight={1.5} opacity={0.4} />
            <RoomHeatmap
              floors={health.floors}
              roomName={roomName}
              floorName={floorName}
            />
          </Card>
        </section>
      )}

      {/* ── 5. PRIORITIZED REMEDIATION ── */}
      <section className={reduced ? "" : "oi-fadeup"}>
        <SectionHeader
          label="PRIORITIZED REMEDIATION"
          sub="ordered by urgency + impact"
        />
        <Card
          style={{
            background: `linear-gradient(160deg, #0D131Dee, #0A0F17ee)`,
            border: `1px solid ${HUD.line}`,
            borderTop: `2px solid ${HUD.lineHi}`,
            position: "relative",
          }}
        >
          <Bracket color={HUD.cyan} size={10} inset={5} weight={1.5} opacity={0.4} />
          {health.remediation.length === 0 ? (
            <div
              style={{
                color: C.dim,
                fontSize: 11,
                fontFamily: mono,
                textAlign: "center",
                padding: "18px 0",
              }}
            >
              No defects found yet.{" "}
              <button
                onClick={onGoMap}
                style={{
                  background: "none",
                  border: "none",
                  color: HUD.cyan,
                  fontSize: 11,
                  fontFamily: mono,
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                Measure outlets on the Map tab
              </button>{" "}
              to populate this list.
            </div>
          ) : (
            <div
              className={reduced ? "" : "oi-stagger"}
              style={{ display: "grid", gap: 0 }}
            >
              {health.remediation.slice(0, 12).map((it) => {
                const uc = URGENCY_COLOR[it.urgency];
                const medal = RANK_MEDAL[it.rank];
                const isImmediate = it.urgency === "IMMEDIATE";
                return (
                  <div
                    key={it.rank}
                    className="oi-lift"
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "10px 8px",
                      borderBottom: `1px solid ${HUD.line}`,
                      alignItems: "flex-start",
                      background: medal ? medal.bg : "transparent",
                      borderRadius: medal ? 8 : 0,
                      marginBottom: medal ? 2 : 0,
                      position: "relative",
                    }}
                  >
                    {/* urgency accent bar — pulse only rank 1 */}
                    {isImmediate && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 6,
                          bottom: 6,
                          width: 2,
                          borderRadius: "0 1px 1px 0",
                          background: uc,
                          boxShadow: `0 0 6px ${uc}88`,
                        }}
                        className={it.rank === 1 && !reduced ? "oi-pulse" : undefined}
                      />
                    )}

                    {/* rank badge */}
                    <div
                      style={{
                        fontFamily: mono,
                        fontWeight: 800,
                        minWidth: 30,
                        textAlign: "center",
                        flexShrink: 0,
                        fontSize: medal ? 16 : 11,
                        color: medal ? medal.color : uc,
                        lineHeight: 1.4,
                        paddingTop: medal ? 0 : 1,
                      }}
                    >
                      {medal ? medal.label : (
                        <span
                          style={{
                            display: "inline-block",
                            background: `${uc}22`,
                            border: `1px solid ${uc}55`,
                            borderRadius: 5,
                            padding: "2px 5px",
                            fontSize: 10,
                            color: uc,
                          }}
                        >
                          #{it.rank}
                        </span>
                      )}
                    </div>

                    {/* content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          color: C.text,
                          fontSize: 11.5,
                          fontWeight: 700,
                          marginBottom: 3,
                          lineHeight: 1.3,
                        }}
                      >
                        {it.label}
                      </div>
                      <div
                        style={{
                          color: C.dim,
                          fontSize: 10.5,
                          lineHeight: 1.5,
                          fontFamily: mono,
                        }}
                      >
                        {it.reason}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 10,
                          color: C.dim,
                          fontFamily: mono,
                          textTransform: "uppercase" as const,
                          letterSpacing: 0.8,
                        }}
                      >
                        {it.targetType.toLowerCase()}
                      </div>
                    </div>

                    {/* urgency pill */}
                    <div style={{ flexShrink: 0, paddingTop: 1 }}>
                      <Pill color={uc}>{it.urgency}</Pill>
                    </div>
                  </div>
                );
              })}
              {health.remediation.length > 12 && (
                <div
                  style={{
                    color: C.dim,
                    fontSize: 10,
                    fontFamily: mono,
                    textAlign: "center",
                    padding: "10px 0 4px",
                    letterSpacing: 0.5,
                  }}
                >
                  +{health.remediation.length - 12} more items
                </div>
              )}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

// ─── HUD section header ──────────────────────────────────────────────────────

function HudSectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div
      style={{
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {/* diamond tick */}
      <span
        style={{
          color: HUD.cyan,
          fontSize: 8,
          lineHeight: 1,
          opacity: 0.9,
        }}
      >
        ▸
      </span>
      <span
        style={{
          color: HUD.cyan,
          fontSize: 9,
          fontFamily: mono,
          fontWeight: 700,
          letterSpacing: 2.5,
          textTransform: "uppercase" as const,
        }}
      >
        {label}
      </span>
      {sub && (
        <>
          <span style={{ color: HUD.line, fontSize: 9 }}>·</span>
          <span
            style={{
              color: HUD.dimmer,
              fontSize: 9,
              fontFamily: mono,
              opacity: 0.7,
            }}
          >
            {sub}
          </span>
        </>
      )}
      {/* rule line */}
      <div
        style={{
          flex: 1,
          height: 1,
          background: `linear-gradient(90deg, ${HUD.line}, transparent)`,
          marginLeft: 4,
        }}
      />
    </div>
  );
}
