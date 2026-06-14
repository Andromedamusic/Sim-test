/* ════════════════════════════════════════════════════════════════════════════
   HEALTH HERO — cinematic whole-home command panel.
   Large RadialGauge (grade-coloured, 180px) + coverage ring + animated
   telemetry chips. Safety-hold triggers pulsing red frame + alert banner.
   Animated scan-line sweeps the panel. Bracket corner accents.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import type { HomeHealth } from "../../../core";
import { C, mono, HUD, GRADE_COLOR, glow } from "../../theme";
import { RadialGauge, AnimatedNumber, GlowCard, useReducedMotion } from "../../anim";
import { Bar } from "../../components";
import { Bracket } from "../../hud/Bracket";

interface Props {
  health: HomeHealth;
  onGoMap: () => void;
  placed: number;
  measured: number;
}

export function HealthHero({ health, onGoMap, placed, measured }: Props) {
  const reduced = useReducedMotion();
  const gradeColor = GRADE_COLOR[health.grade];
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
      {/* pulsing danger ring — safety hold */}
      {health.safetyHold && !reduced && (
        <div
          style={{
            position: "absolute",
            inset: -2,
            borderRadius: 17,
            border: `2px solid ${C.danger}`,
            pointerEvents: "none",
            zIndex: 2,
            boxShadow: `0 0 18px -2px ${C.danger}88, inset 0 0 12px -4px ${C.danger}44`,
          }}
          className="oi-pulse"
        />
      )}

      <GlowCard
        accent={gradeColor}
        style={{
          background: health.safetyHold
            ? "linear-gradient(160deg,#1A060888,#0E060688)"
            : "linear-gradient(160deg,#0D131D99,#0B0F1799)",
          padding: 22,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* corner brackets */}
        <Bracket color={gradeColor} size={16} inset={4} weight={2} opacity={0.7} />

        {/* animated scan-line */}
        {!reduced && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 2,
              background: `linear-gradient(90deg, transparent 0%, ${gradeColor}33 30%, ${gradeColor}88 50%, ${gradeColor}33 70%, transparent 100%)`,
              pointerEvents: "none",
              zIndex: 0,
              animation: "oi-scan 4s cubic-bezier(.4,0,.6,1) infinite",
            }}
          />
        )}

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* section header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 18,
            }}
          >
            <span style={{ color: HUD.cyan, fontSize: 10, lineHeight: 1 }}>◈</span>
            <span
              style={{
                color: HUD.dimmer,
                fontSize: 9,
                fontFamily: mono,
                fontWeight: 700,
                letterSpacing: 2.5,
                textTransform: "uppercase" as const,
              }}
            >
              WHOLE-HOME ELECTRICAL HEALTH
            </span>
            {health.safetyHold && (
              <span
                style={{
                  marginLeft: "auto",
                  color: C.danger,
                  fontSize: 9,
                  fontFamily: mono,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  border: `1px solid ${C.danger}66`,
                  borderRadius: 4,
                  padding: "2px 6px",
                  background: `${C.danger}18`,
                }}
                className={reduced ? "" : "oi-pulse"}
              >
                ⚠ SAFETY HOLD
              </span>
            )}
          </div>

          {/* main layout */}
          <div
            style={{
              display: "flex",
              gap: 28,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {/* ── primary health gauge ── */}
            <div
              style={{
                position: "relative",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0,
              }}
            >
              <div
                style={{
                  position: "relative",
                  borderRadius: 999,
                  boxShadow: !reduced ? glow(gradeColor, 0.45) : undefined,
                }}
              >
                <RadialGauge
                  value={healthValue}
                  max={1}
                  size={180}
                  thickness={16}
                  color={gradeColor}
                  glow
                  label={health.safetyHold ? "HOLD" : health.grade}
                  sublabel="HOME HEALTH"
                />
              </div>
              {/* risk index badge */}
              <div
                style={{
                  marginTop: 8,
                  background: `${gradeColor}18`,
                  border: `1px solid ${gradeColor}44`,
                  borderRadius: 6,
                  padding: "4px 10px",
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    color: HUD.dimmer,
                    fontSize: 8.5,
                    fontFamily: mono,
                    letterSpacing: 1.5,
                  }}
                >
                  RISK INDEX{" "}
                </span>
                <span
                  style={{
                    color: gradeColor,
                    fontFamily: mono,
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  <AnimatedNumber value={Math.round(health.risk * 100)} suffix=" / 100" />
                </span>
              </div>
            </div>

            {/* ── right column ── */}
            <div
              style={{
                flex: 1,
                minWidth: 160,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* coverage gauge + bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  background: "#0A0E1A88",
                  border: `1px solid ${HUD.line}`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  position: "relative",
                }}
              >
                <div style={{ borderRadius: 999, boxShadow: !reduced ? glow(coverageColor, 0.3) : undefined }}>
                  <RadialGauge
                    value={health.inspectionCoverage}
                    max={1}
                    size={76}
                    thickness={9}
                    color={coverageColor}
                    glow
                    label={`${Math.round(health.inspectionCoverage * 100)}%`}
                    sublabel="COVERAGE"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      color: HUD.dimmer,
                      fontSize: 8.5,
                      fontFamily: mono,
                      letterSpacing: 1.5,
                      marginBottom: 5,
                    }}
                  >
                    OUTLETS MEASURED
                  </div>
                  <div
                    style={{
                      color: C.text,
                      fontSize: 24,
                      fontFamily: mono,
                      fontWeight: 800,
                      lineHeight: 1,
                      letterSpacing: -0.5,
                    }}
                  >
                    <AnimatedNumber value={measured} />
                    <span
                      style={{
                        color: C.dimmer,
                        fontSize: 15,
                        fontWeight: 400,
                      }}
                    >
                      {" "}
                      /{" "}
                      <AnimatedNumber value={placed} />
                    </span>
                  </div>
                  <div style={{ marginTop: 7, maxWidth: 150 }}>
                    <Bar pct={health.inspectionCoverage * 100} color={coverageColor} h={5} />
                  </div>
                </div>
              </div>

              {/* telemetry chips — 2×3 grid */}
              <div
                className={reduced ? "" : "oi-stagger"}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 7,
                }}
              >
                <TelemetryChip
                  label="FLOORS"
                  value={health.floors.length}
                  color={HUD.cyan}
                />
                <TelemetryChip
                  label="CIRCUITS"
                  value={health.circuits.length}
                  color={HUD.cyan}
                />
                <TelemetryChip
                  label="OUTLETS"
                  value={placed}
                  color={HUD.cyan}
                />
                <TelemetryChip
                  label="MEASURED"
                  value={measured}
                  color={coverageColor}
                />
                <TelemetryChip
                  label="SYS FLAGS"
                  value={health.systemicFlags.length}
                  color={
                    health.systemicFlags.length > 0 ? C.warn : C.dim
                  }
                  alert={health.systemicFlags.length > 0}
                  reduced={reduced}
                />
                <TelemetryChip
                  label="REMEDIATION"
                  value={health.remediation.length}
                  color={
                    health.remediation.length > 0 ? C.amber : C.dim
                  }
                />
              </div>
            </div>
          </div>

          {/* safety hold alert banner */}
          {health.safetyHold && (
            <div
              className={reduced ? "" : "oi-fadeup"}
              style={{
                marginTop: 18,
                background: "linear-gradient(160deg,#260808ee,#1A0404ee)",
                border: `1px solid ${C.danger}88`,
                borderLeft: `3px solid ${C.danger}`,
                borderRadius: 10,
                padding: "12px 16px",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                position: "relative",
              }}
            >
              <Bracket color={C.danger} size={10} inset={2} weight={1.5} opacity={0.7} />
              <span
                style={{ color: C.danger, fontSize: 18, flexShrink: 0, lineHeight: 1 }}
                className={reduced ? "" : "oi-pulse"}
              >
                ⚠
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: "#FECACA",
                    fontSize: 12,
                    fontFamily: mono,
                    fontWeight: 800,
                    marginBottom: 4,
                    letterSpacing: 0.5,
                  }}
                >
                  SAFETY HOLD — DO NOT ENERGISE HIGH LOADS
                </div>
                <div
                  style={{
                    color: "#FCA5A5",
                    fontSize: 11,
                    fontFamily: mono,
                    lineHeight: 1.6,
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
                marginTop: 18,
                background: `linear-gradient(135deg, ${C.amber}, #F97316)`,
                color: "#0A0A0C",
                border: "none",
                borderRadius: 8,
                padding: "11px 20px",
                fontFamily: mono,
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
                letterSpacing: 0.8,
                boxShadow: `0 0 18px -4px #F8B54488`,
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

function TelemetryChip({
  label,
  value,
  color,
  alert = false,
  reduced = false,
}: {
  label: string;
  value: number;
  color: string;
  alert?: boolean;
  reduced?: boolean;
}) {
  return (
    <div
      style={{
        background: `linear-gradient(170deg, ${color}10 0%, #0A0A0E00 100%)`,
        border: `1px solid ${color}30`,
        borderTop: `2px solid ${color}88`,
        borderRadius: 8,
        padding: "8px 10px",
        position: "relative",
      }}
    >
      <div
        style={{
          color: HUD.dimmer,
          fontSize: 7.5,
          fontFamily: mono,
          letterSpacing: 1.5,
          marginBottom: 3,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color,
          fontFamily: mono,
          fontWeight: 800,
          fontSize: 20,
          lineHeight: 1,
        }}
        className={alert && !reduced ? "oi-pulse" : undefined}
      >
        <AnimatedNumber value={value} />
      </div>
    </div>
  );
}
