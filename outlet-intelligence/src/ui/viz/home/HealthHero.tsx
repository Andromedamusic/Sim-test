/* ════════════════════════════════════════════════════════════════════════════
   HEALTH HERO — whole-home health command panel.
   A large RadialGauge shows overall health (1-risk so full = good), flanked
   by a coverage ring and key count-up stats. Safety-hold state pulsing ring.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import type { HomeHealth } from "../../../core";
import { C, mono, GRADE_COLOR } from "../../theme";
import { RadialGauge, AnimatedNumber, GlowCard, useReducedMotion } from "../../anim";
import { Bar } from "../../components";

interface Props {
  health: HomeHealth;
  onGoMap: () => void;
  placed: number;
  measured: number;
}

export function HealthHero({ health, onGoMap, placed, measured }: Props) {
  const reduced = useReducedMotion();
  const gradeColor = GRADE_COLOR[health.grade];
  // gauge shows health (1-risk = good), colored by grade
  const healthValue = 1 - health.risk;
  const coverageColor =
    health.inspectionCoverage >= 0.8
      ? GRADE_COLOR.GREEN
      : health.inspectionCoverage >= 0.5
      ? GRADE_COLOR.YELLOW
      : GRADE_COLOR.AMBER;

  const holdCount = health.unclearedLethalOutletIds.length;

  return (
    <div style={{ position: "relative" }} className="oi-fadeup">
      {/* safety hold pulsing ring — sits outside GlowCard so it overlays the border */}
      {health.safetyHold && !reduced && (
        <div
          style={{
            position: "absolute",
            inset: -1,
            borderRadius: 15,
            border: `2px solid ${C.danger}`,
            pointerEvents: "none",
            zIndex: 1,
          }}
          className="oi-pulse"
        />
      )}
      <GlowCard
        accent={gradeColor}
        style={{
          background: health.safetyHold
            ? "linear-gradient(160deg,#1A0606cc,#100808cc)"
            : undefined,
          padding: 20,
        }}
      >
      <div>
        {/* top label */}
        <div
          style={{
            color: C.dimmer,
            fontSize: 9,
            fontFamily: mono,
            letterSpacing: 2,
            marginBottom: 16,
          }}
        >
          WHOLE-HOME ELECTRICAL HEALTH
        </div>

        {/* main layout */}
        <div
          style={{
            display: "flex",
            gap: 24,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* ── big health gauge ── */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <RadialGauge
              value={healthValue}
              max={1}
              size={160}
              thickness={14}
              color={gradeColor}
              glow
              label={health.safetyHold ? "HOLD" : health.grade}
              sublabel="HOME HEALTH"
            />
            {/* risk index below gauge */}
            <div
              style={{
                textAlign: "center",
                marginTop: 6,
                color: C.dim,
                fontSize: 9.5,
                fontFamily: mono,
                letterSpacing: 1,
              }}
            >
              RISK INDEX{" "}
              <span style={{ color: gradeColor, fontWeight: 800 }}>
                <AnimatedNumber value={Math.round(health.risk * 100)} suffix=" / 100" />
              </span>
            </div>
          </div>

          {/* ── right column: coverage + stats ── */}
          <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* coverage gauge row */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <RadialGauge
                value={health.inspectionCoverage}
                max={1}
                size={80}
                thickness={9}
                color={coverageColor}
                glow
                label={`${Math.round(health.inspectionCoverage * 100)}%`}
                sublabel="COVERAGE"
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: C.dimmer,
                    fontSize: 9,
                    fontFamily: mono,
                    letterSpacing: 1,
                    marginBottom: 4,
                  }}
                >
                  OUTLETS MEASURED
                </div>
                <div
                  style={{
                    color: C.text,
                    fontSize: 22,
                    fontFamily: mono,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  <AnimatedNumber value={measured} />
                  <span style={{ color: C.dimmer, fontSize: 14, fontWeight: 400 }}>
                    {" "}
                    / <AnimatedNumber value={placed} />
                  </span>
                </div>
                <div style={{ marginTop: 6, maxWidth: 140 }}>
                  <Bar pct={health.inspectionCoverage * 100} color={coverageColor} h={5} />
                </div>
              </div>
            </div>

            {/* stat chips */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <StatChip
                label="FLOORS"
                value={health.floors.length}
                color={C.blue}
              />
              <StatChip
                label="CIRCUITS"
                value={health.circuits.length}
                color={C.blue}
              />
              <StatChip
                label="SYSTEMIC FLAGS"
                value={health.systemicFlags.length}
                color={
                  health.systemicFlags.length > 0 ? C.warn : C.dim
                }
              />
              <StatChip
                label="REMEDIATION ITEMS"
                value={health.remediation.length}
                color={
                  health.remediation.length > 0 ? C.amber : C.dim
                }
              />
            </div>
          </div>
        </div>

        {/* safety hold alert */}
        {health.safetyHold && (
          <div
            className={reduced ? "" : "oi-fadeup"}
            style={{
              marginTop: 16,
              background: "#260808",
              border: "1px solid #7F1D1D",
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <span
              style={{ color: C.danger, fontSize: 16, flexShrink: 0 }}
              className={reduced ? "" : "oi-pulse"}
            >
              ⚠
            </span>
            <div>
              <div
                style={{
                  color: "#FECACA",
                  fontSize: 12,
                  fontFamily: mono,
                  fontWeight: 800,
                  marginBottom: 3,
                }}
              >
                SAFETY HOLD — DO NOT ENERGISE HIGH LOADS
              </div>
              <div
                style={{
                  color: "#FCA5A5",
                  fontSize: 11,
                  fontFamily: mono,
                  lineHeight: 1.55,
                }}
              >
                {holdCount} outlet{holdCount !== 1 ? "s" : ""} cannot be
                cleared — lethal mode un-excluded. Resolve before energising
                high loads.
              </div>
            </div>
          </div>
        )}

        {/* empty-state CTA */}
        {placed === 0 && (
          <button
            onClick={onGoMap}
            className="oi-lift oi-press"
            style={{
              marginTop: 16,
              background: C.amber,
              color: "#0A0A0C",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              fontFamily: mono,
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
              letterSpacing: 0.5,
            }}
          >
            Start mapping outlets →
          </button>
        )}
      </div>
      </GlowCard>
    </div>
  );
}

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#0A0A0E",
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "7px 10px",
      }}
    >
      <div
        style={{
          color: C.dimmer,
          fontSize: 8.5,
          fontFamily: mono,
          letterSpacing: 1,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color,
          fontFamily: mono,
          fontWeight: 800,
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        <AnimatedNumber value={value} />
      </div>
    </div>
  );
}
