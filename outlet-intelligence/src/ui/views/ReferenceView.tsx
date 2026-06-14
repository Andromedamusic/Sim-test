import React from "react";
import { C, HUD, mono, sans, glow } from "../theme";
import { Card, SectionHeader } from "../components";
import { useReducedMotion } from "../anim";
import { Bracket } from "../hud/Bracket";

// ─── 1. Artifact Physics ──────────────────────────────────────────────────────

interface ArtifactEntry {
  name: string;
  formula: string;
  description: string;
}

const ARTIFACTS: ArtifactEntry[] = [
  {
    name: "Phantom voltage",
    formula: "V ≈ V_src·Z_m/(Z_m+Z_c)",
    description:
      "Floating conductor capacitively couples line V; high-Z meter reads 15–80V; Lo-Z suppresses.",
  },
  {
    name: "Fritting",
    formula: "oxide a-spot breakdown",
    description:
      "Corroded junction reads high→low Ω as meter current punches bridges; final low value not a real connection.",
  },
  {
    name: "Meter loading",
    formula: "I_test = V/Z_m ≈ 11.6µA",
    description:
      "Open neutral reads ~119V no-load through meter 10MΩ, collapses under load.",
  },
  {
    name: "Thermal blindness",
    formula: "P=I²R, I_gnd=0",
    description:
      "Ground faults carry no current → zero IR signature; thermal camera cannot see open/high-R ground.",
  },
  {
    name: "Utility drift",
    formula: "ANSI C84.1 Range A",
    description:
      "Cross-session 120→116V is grid drift not a fault.",
  },
];

// ─── 2. Acceptance Thresholds ─────────────────────────────────────────────────

interface ThresholdRow {
  param: string;
  pass: string;
  fail: string;
  std: string;
}

const THRESHOLDS: ThresholdRow[] = [
  { param: "V H→N nl",   pass: "114–126",  fail: "<110 or >132", std: "C84.1"  },
  { param: "V N→G nl",   pass: "0–2",      fail: ">5",           std: "250"    },
  { param: "V N→G load", pass: "<5",       fail: ">10",          std: "Eng"    },
  { param: "V H→G",      pass: "≈V_HN",   fail: "<60",          std: "UL498"  },
  { param: "Gnd cont",   pass: "<1Ω",     fail: "OL",           std: "250.122"},
  { param: "Term R",     pass: "<0.1Ω",   fail: ">0.5Ω",        std: "UL498"  },
  { param: "Drop@load",  pass: "<2V",     fail: ">5V",          std: "210.19" },
  { param: "ΔT face",    pass: "<5°C",    fail: ">15°C",        std: "UL498"  },
];

// ─── 3. Bayesian Loop ─────────────────────────────────────────────────────────

interface BayesStage {
  stage: string;
  desc: string;
}

const BAYES_LOOP: BayesStage[] = [
  { stage: "Forward model",  desc: "Predict reading vector per fault." },
  { stage: "Likelihood",     desc: "P(obs|fault) artifact-weighted." },
  { stage: "Prior",          desc: "P(fault|era,wire,device)." },
  { stage: "Posterior",      desc: "∝ Likelihood×Prior, vetoed & penalized." },
  { stage: "Critics",        desc: "6 agents confirm-break → adjudicate." },
  { stage: "Confidence",     desc: "f(margin, entropy, critic agreement)." },
  { stage: "Next-best-test", desc: "argmax expected info gain." },
];

export function ReferenceView() {
  const reduced = useReducedMotion();

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: 16, boxSizing: "border-box", width: "100%" }}>

      {/* ── Card 1: Artifact Physics ── */}
      <Card
        title="ARTIFACT PHYSICS — WHAT FOOLS A MULTIMETER"
        style={{ flex: "1 1 280px", minWidth: "min(280px,100%)" }}
      >
        <SectionHeader label="MEASUREMENT ARTIFACTS" style={{ margin: "6px 0 10px" }} />
        <div
          className={reduced ? "" : "oi-stagger"}
          style={{ display: "flex", flexDirection: "column", gap: 0 }}
        >
          {ARTIFACTS.map((a, i) => (
            <div
              key={i}
              className="oi-lift"
              style={{
                padding: "9px 0",
                borderBottom: i < ARTIFACTS.length - 1 ? `1px solid ${HUD.line}` : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                {/* section tick accent */}
                <span style={{ width: 3, height: 9, borderRadius: 2, background: HUD.cyan, display: "inline-block", flexShrink: 0 }} />
                <span style={{
                  color: C.amber,
                  fontFamily: mono,
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: 0.3,
                  textShadow: glow(C.amber, 0.25),
                }}>
                  {a.name}
                </span>
                <code style={{
                  color: HUD.cyan,
                  fontFamily: mono,
                  fontSize: 10,
                  background: HUD.glass,
                  border: `1px solid ${HUD.lineHi}`,
                  borderRadius: 4,
                  padding: "1px 6px",
                }}>
                  {a.formula}
                </code>
              </div>
              <div style={{
                color: HUD.dim,
                fontSize: 11,
                fontFamily: sans,
                lineHeight: 1.65,
                paddingLeft: 16,
              }}>
                {a.description}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Card 2: Acceptance Thresholds ── */}
      <Card
        title="ACCEPTANCE THRESHOLDS"
        style={{ flex: "1 1 280px", minWidth: "min(280px,100%)" }}
      >
        <SectionHeader label="PASS / FAIL MATRIX" style={{ margin: "6px 0 10px" }} />

        {/* Scrollable wrapper prevents horizontal overflow on narrow screens */}
        <div style={{ overflowX: "auto" }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 0.8fr",
            gap: 4,
            padding: "4px 6px 6px",
            borderBottom: `1px solid ${HUD.lineHi}`,
            background: HUD.glass,
            borderRadius: "4px 4px 0 0",
            marginBottom: 1,
            minWidth: 280,
          }}>
            {["Param", "PASS", "FAIL", "Std"].map((h, idx) => (
              <span key={h} style={{
                color: idx === 1 ? C.good
                     : idx === 2 ? C.bad
                     : HUD.dim,
                fontSize: 10,
                fontFamily: mono,
                fontWeight: 800,
                letterSpacing: 1,
              }}>
                {h}
              </span>
            ))}
          </div>

          {/* Table rows */}
          <div
            className={reduced ? "" : "oi-stagger"}
            style={{ display: "flex", flexDirection: "column", minWidth: 280 }}
          >
            {THRESHOLDS.map((row, i) => (
              <div
                key={i}
                className="oi-lift"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 1fr 0.8fr",
                  gap: 4,
                  padding: "5px 4px",
                  borderBottom: i < THRESHOLDS.length - 1 ? `1px solid ${HUD.line}` : "none",
                  alignItems: "center",
                }}
              >
                <span style={{ color: HUD.text, fontSize: 10, fontFamily: mono }}>{row.param}</span>
                <span style={{
                  color: C.good,
                  fontSize: 10,
                  fontFamily: mono,
                  fontWeight: 700,
                  textShadow: glow(C.good, 0.25),
                }}>
                  {row.pass}
                </span>
                <span style={{
                  color: C.bad,
                  fontSize: 10,
                  fontFamily: mono,
                  fontWeight: 700,
                  textShadow: glow(C.bad, 0.2),
                }}>
                  {row.fail}
                </span>
                <span style={{
                  color: HUD.dim,
                  fontSize: 10,
                  fontFamily: mono,
                  background: HUD.glass,
                  border: `1px solid ${HUD.line}`,
                  borderRadius: 3,
                  padding: "1px 5px",
                  display: "inline-block",
                }}>
                  {row.std}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Card 3: Bayesian Loop ── */}
      <Card
        title="THE BAYESIAN LOOP"
        style={{ flex: "1 1 260px", minWidth: "min(260px,100%)" }}
      >
        <SectionHeader label="INFERENCE PIPELINE" style={{ margin: "6px 0 10px" }} />

        {/* Bracketed pipeline panel */}
        <div style={{ position: "relative", paddingTop: 4 }}>
          <Bracket color={HUD.cyan} size={8} inset={0} weight={1} opacity={0.35} />
          <div
            className={reduced ? "" : "oi-stagger"}
            style={{ display: "flex", flexDirection: "column", gap: 0 }}
          >
            {BAYES_LOOP.map((entry, i) => (
              <div
                key={i}
                className="oi-lift"
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "8px 4px",
                  borderBottom: i < BAYES_LOOP.length - 1 ? `1px solid ${HUD.line}` : "none",
                  alignItems: "flex-start",
                }}
              >
                {/* Step index bubble */}
                <div style={{
                  background: HUD.glass,
                  border: `1px solid ${HUD.lineHi}`,
                  borderRadius: 5,
                  width: 20,
                  height: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: HUD.cyan,
                  fontFamily: mono,
                  fontWeight: 800,
                  fontSize: 10,
                  boxShadow: `0 0 0 1px ${HUD.cyan}20`,
                }}>
                  {i + 1}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    marginBottom: 2,
                  }}>
                    <span style={{ width: 3, height: 9, borderRadius: 2, background: HUD.cyan, display: "inline-block", flexShrink: 0 }} />
                    <span style={{
                      color: C.amber,
                      fontFamily: mono,
                      fontWeight: 700,
                      fontSize: 11,
                      letterSpacing: 0.2,
                    }}>
                      {entry.stage}
                    </span>
                  </div>
                  <div style={{ color: HUD.dim, fontFamily: sans, fontSize: 11, lineHeight: 1.55, paddingLeft: 14 }}>
                    {entry.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer accent line */}
        <div style={{
          marginTop: 12,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${HUD.cyan}44, transparent)`,
          borderRadius: 1,
        }} />
      </Card>
    </div>
  );
}
