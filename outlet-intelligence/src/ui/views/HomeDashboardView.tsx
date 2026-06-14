/* ════════════════════════════════════════════════════════════════════════════
   HOME — centralized intelligence model. Whole-home health, systemic patterns,
   circuit breaker bus, room heatmap, and prioritized remediation. Composes
   animated sub-views; honours prefers-reduced-motion throughout.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import { useStore } from "../../state/store";
import { type HomeHealth } from "../../core";
import { C, mono } from "../theme";
import { GlowCard, useReducedMotion } from "../anim";
import { Card, Pill } from "../components";
import { HealthHero } from "../viz/home/HealthHero";
import { CircuitBus } from "../viz/home/CircuitBus";
import { RoomHeatmap } from "../viz/home/RoomHeatmap";

const URGENCY_COLOR: Record<string, string> = {
  IMMEDIATE: C.danger,
  SOON: C.warn,
  PLANNED: C.dim,
};

const RANK_MEDAL: Record<number, { bg: string; color: string; label: string }> = {
  1: { bg: "#2D2200", color: "#F59E0B", label: "🥇" },
  2: { bg: "#1C1C1C", color: "#D1D5DB", label: "🥈" },
  3: { bg: "#1C1200", color: "#D97706", label: "🥉" },
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
      style={{ display: "grid", gap: 14 }}
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
          <SectionHeader label="SYSTEMIC PATTERNS" sub="not device-local — wiring / circuit scope" />
          <div
            className={reduced ? "" : "oi-stagger"}
            style={{ display: "grid", gap: 8 }}
          >
            {orderedFlags.map((f, i) => {
              const uc = URGENCY_COLOR[f.urgency];
              const isImmediate = f.urgency === "IMMEDIATE";
              return (
                <GlowCard
                  key={i}
                  accent={uc}
                  className={isImmediate && !reduced ? "oi-pulse" : undefined}
                  style={{
                    background:
                      isImmediate
                        ? "linear-gradient(160deg,#1A0606cc,#100808cc)"
                        : "linear-gradient(160deg,#1A1200cc,#101008cc)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <Pill color={uc}>{f.urgency}</Pill>
                    <span
                      style={{
                        color: C.warn,
                        fontSize: 11,
                        fontFamily: mono,
                        fontWeight: 800,
                        letterSpacing: 0.5,
                      }}
                    >
                      {f.type.replace(/_/g, " ")}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        color: C.dimmer,
                        fontSize: 9.5,
                        fontFamily: mono,
                      }}
                    >
                      {f.scope === "circuit"
                        ? circuitName(f.scopeId)
                        : roomName(f.scopeId)}
                    </span>
                    <span
                      style={{
                        color: C.dimmer,
                        fontSize: 9,
                        fontFamily: mono,
                      }}
                    >
                      {f.outletIds.length} outlet{f.outletIds.length !== 1 ? "s" : ""}
                      {" · "}
                      {Math.round(f.confidence * 100)}% conf
                    </span>
                  </div>
                  <div
                    style={{
                      color: "#FDE68A",
                      fontSize: 11.5,
                      lineHeight: 1.55,
                      marginBottom: 4,
                    }}
                  >
                    {f.description}
                  </div>
                  <div
                    style={{
                      color: C.dim,
                      fontSize: 10.5,
                      lineHeight: 1.5,
                      borderTop: `1px solid ${C.border}`,
                      paddingTop: 6,
                      marginTop: 2,
                    }}
                  >
                    <span style={{ color: C.dimmer, fontFamily: mono, fontSize: 9.5, letterSpacing: 1 }}>
                      REMEDY{" "}
                    </span>
                    {f.remedy}
                  </div>
                </GlowCard>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 3. CIRCUIT BUS ── */}
      {health.circuits.length > 0 && (
        <section className={reduced ? "" : "oi-fadeup"}>
          <SectionHeader
            label="BREAKER PANEL"
            sub={`${health.circuits.length} circuit${health.circuits.length !== 1 ? "s" : ""}`}
          />
          <Card style={{ background: C.panel }}>
            <CircuitBus circuits={health.circuits} nameOf={circuitName} />
          </Card>
        </section>
      )}

      {/* ── 4. ROOM HEATMAP ── */}
      {health.floors.length > 0 && (
        <section className={reduced ? "" : "oi-fadeup"}>
          <SectionHeader
            label="FLOORS & ROOMS"
            sub="grade heat by room"
          />
          <Card style={{ background: C.panel }}>
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
        <SectionHeader label="PRIORITIZED REMEDIATION" sub="ordered by urgency + impact" />
        <Card style={{ background: C.panel }}>
          {health.remediation.length === 0 ? (
            <div style={{ color: C.dim, fontSize: 11, fontFamily: mono, textAlign: "center", padding: "16px 0" }}>
              No defects found yet.{" "}
              <button
                onClick={onGoMap}
                style={{
                  background: "none",
                  border: "none",
                  color: C.blue,
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
                return (
                  <div
                    key={it.rank}
                    className="oi-lift"
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "9px 6px",
                      borderBottom: `1px solid ${C.border}`,
                      alignItems: "flex-start",
                      background: medal
                        ? medal.bg
                        : "transparent",
                      borderRadius: medal ? 8 : 0,
                      marginBottom: medal ? 2 : 0,
                    }}
                  >
                    {/* rank badge */}
                    <div
                      style={{
                        fontFamily: mono,
                        fontWeight: 800,
                        minWidth: 26,
                        textAlign: "center",
                        flexShrink: 0,
                        fontSize: medal ? 15 : 12,
                        color: medal ? medal.color : uc,
                        lineHeight: 1.4,
                      }}
                    >
                      {medal ? medal.label : `#${it.rank}`}
                    </div>

                    {/* content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          color: C.text,
                          fontSize: 11.5,
                          fontWeight: 700,
                          marginBottom: 2,
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
                      <div style={{ marginTop: 4, fontSize: 9.5, color: C.dimmer, fontFamily: mono, textTransform: "capitalize" as const }}>
                        {it.targetType.toLowerCase()}
                      </div>
                    </div>

                    {/* urgency pill */}
                    <div style={{ flexShrink: 0 }}>
                      <Pill color={uc}>{it.urgency}</Pill>
                    </div>
                  </div>
                );
              })}
              {health.remediation.length > 12 && (
                <div
                  style={{
                    color: C.dimmer,
                    fontSize: 10,
                    fontFamily: mono,
                    textAlign: "center",
                    padding: "8px 0 4px",
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

// ─── local helpers ──────────────────────────────────────────────────────────

function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 8, display: "flex", alignItems: "baseline", gap: 8 }}>
      <span
        style={{
          color: C.dimmer,
          fontSize: 9,
          fontFamily: mono,
          fontWeight: 700,
          letterSpacing: 2,
        }}
      >
        {label}
      </span>
      {sub && (
        <span
          style={{
            color: C.dimmer,
            fontSize: 9,
            fontFamily: mono,
            opacity: 0.6,
          }}
        >
          · {sub}
        </span>
      )}
    </div>
  );
}
