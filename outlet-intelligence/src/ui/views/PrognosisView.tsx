import React, { useState, useRef, useEffect } from "react";
import { prognose } from "../../core";
import { C, HUD, mono, glow } from "../theme";
import { Card } from "../components";
import { RadialGauge, AnimatedNumber, useReducedMotion } from "../anim";
import { Bracket } from "../hud/Bracket";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}

/** HUD instrument control: label + amber readout + styled range slider. */
function Slider({ label, value, min, max, step, unit, onChange }: SliderProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 5,
      flex: "1 1 180px",
      minWidth: 160,
      background: HUD.glass,
      border: `1px solid ${HUD.lineHi}`,
      borderRadius: 8,
      padding: "10px 12px",
      position: "relative",
    }}>
      <Bracket color={HUD.cyan} size={6} inset={3} weight={1} opacity={0.35} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ color: HUD.dim, fontSize: 9, fontFamily: mono, letterSpacing: 1, fontWeight: 600 }}>
          {label.toUpperCase()}
        </span>
        <span style={{
          color: C.amber,
          fontFamily: mono,
          fontWeight: 800,
          fontSize: 16,
          lineHeight: 1,
          textShadow: glow(C.amber, 0.4),
        }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ accentColor: C.amber, width: "100%", cursor: "pointer", margin: "2px 0" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: HUD.dimmer, fontSize: 8, fontFamily: mono }}>{min}{unit}</span>
        <span style={{ color: HUD.dimmer, fontSize: 8, fontFamily: mono }}>{max}{unit}</span>
      </div>
    </div>
  );
}

/** Compact HUD section header. */
function HudLabel({ text }: { text: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 7,
      margin: "12px 0 7px",
      color: HUD.cyan,
      fontSize: 9,
      fontFamily: mono,
      fontWeight: 800,
      letterSpacing: 2,
    }}>
      <span style={{
        width: 5,
        height: 5,
        background: HUD.cyan,
        boxShadow: glow(HUD.cyan, 0.7),
        transform: "rotate(45deg)",
        flexShrink: 0,
        display: "inline-block",
      }} />
      {text}
    </div>
  );
}

/** HUD readout tile — animated numeric display. */
interface StatCardProps {
  label: string;
  value: string;
  color?: string;
  animate?: boolean;
  numericValue?: number;
  numericDecimals?: number;
  numericUnit?: string;
}

function StatCard({ label, value, color, animate, numericValue, numericDecimals, numericUnit }: StatCardProps) {
  return (
    <div style={{
      background: HUD.glass,
      border: `1px solid ${HUD.lineHi}`,
      borderRadius: 8,
      padding: "10px 14px",
      flex: "1 1 130px",
      minWidth: 130,
      position: "relative",
    }}>
      <Bracket color={color ?? HUD.cyan} size={6} inset={3} weight={1} opacity={0.3} />
      <div style={{
        color: HUD.dimmer,
        fontSize: 8,
        fontFamily: mono,
        fontWeight: 700,
        letterSpacing: 1.5,
        marginBottom: 5,
        textTransform: "uppercase",
      }}>
        {label}
      </div>
      <div style={{
        color: color ?? HUD.text,
        fontSize: 20,
        fontFamily: mono,
        fontWeight: 800,
        textShadow: color ? glow(color, 0.4) : "none",
        lineHeight: 1,
      }}>
        {animate && numericValue !== undefined
          ? <AnimatedNumber value={numericValue} decimals={numericDecimals ?? 0} suffix={numericUnit ?? ""} />
          : value}
      </div>
    </div>
  );
}

/** Build SVG path for temp vs load current 0..20A */
function buildCurve(R: number, amb: number): string {
  const RTH = 12;
  const W = 320, H = 220, padL = 36, padR = 12, padT = 14, padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxT = 200, maxA = 20;
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * maxA;
    const t = Math.min(amb + a * a * R * RTH, maxT);
    const x = padL + (a / maxA) * plotW;
    const y = padT + plotH - (t / maxT) * plotH;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return "M " + pts.join(" L ");
}

function tempToY(t: number, padT: number, plotH: number, maxT: number): number {
  return padT + plotH - (Math.min(t, maxT) / maxT) * plotH;
}

/** Inline CSS keyframes injected once. */
const STYLES = `
@keyframes oi-pulse {
  0%,100%{opacity:1}
  50%{opacity:0.45}
}
@keyframes oi-draw {
  from { stroke-dashoffset: var(--path-len, 9999); }
  to   { stroke-dashoffset: 0; }
}
@keyframes oi-glow {
  0%,100%{opacity:0.18}
  50%{opacity:0.38}
}
`;

export function PrognosisView() {
  const [R, setR] = useState(0.5);
  const [A, setA] = useState(12);
  const [amb, setAmb] = useState(25);
  const reduced = useReducedMotion();

  const p = prognose(R, A, amb);
  const runawaySuffix = p.runaway ? "IMMINENT" : `~${p.months} months`;

  // SVG geometry
  const W = 320, H = 220;
  const padL = 36, padR = 12, padT = 14, padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxT = 200, maxA = 20;
  const RTH = 12;

  const curvePath = buildCurve(R, amb);

  const markerT = Math.min(amb + A * A * R * RTH, maxT);
  const markerX = padL + (A / maxA) * plotW;
  const markerY = tempToY(markerT, padT, plotH, maxT);

  const y60  = tempToY(60,  padT, plotH, maxT);
  const y90  = tempToY(90,  padT, plotH, maxT);
  const y120 = tempToY(120, padT, plotH, maxT);
  const y150 = tempToY(150, padT, plotH, maxT);
  const yBottom = padT + plotH;
  const xTicks = [0, 5, 10, 15, 20];

  // Stroke-dashoffset draw-on animation
  const pathRef = useRef<SVGPathElement | null>(null);
  const [pathLen, setPathLen] = useState<number>(9999);
  const prevCurveRef = useRef<string>("");

  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const len = typeof el.getTotalLength === "function" ? el.getTotalLength() : 0;
    if (curvePath !== prevCurveRef.current) {
      prevCurveRef.current = curvePath;
      if (len > 0) setPathLen(len);
    }
  }, [curvePath]);

  const isPulsing = p.Tterm > 90;
  const statusKey = p.status;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: 16, boxSizing: "border-box", width: "100%" }}>
      <style>{STYLES}</style>

      {/* ── Left: instrument controls + readouts ── */}
      <div style={{ flex: "1 1 300px", minWidth: 300, display: "flex", flexDirection: "column", gap: 14 }}>

        <Card title="ARRHENIUS THERMAL-RUNAWAY EXPLORER">
          <HudLabel text="INSTRUMENT CONTROLS" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 2 }}>
            <Slider label="Terminal resistance R" value={R} min={0.05} max={8} step={0.05} unit=" Ω" onChange={setR} />
            <Slider label="Load current" value={A} min={1} max={20} step={1} unit=" A" onChange={setA} />
            <Slider label="Ambient temperature" value={amb} min={10} max={50} step={1} unit=" °C" onChange={setAmb} />
          </div>
        </Card>

        {/* Readout tiles */}
        <HudLabel text="LIVE READOUTS" />
        <div className={reduced ? "" : "oi-stagger"} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <StatCard
            label="Power Dissipated"
            value={`${p.P} W`}
            color={C.amber}
            animate
            numericValue={p.P}
            numericDecimals={1}
            numericUnit=" W"
          />
          <StatCard
            label="Terminal Temp"
            value={`${p.Tterm} °C`}
            color={p.sColor}
            animate
            numericValue={p.Tterm}
            numericDecimals={0}
            numericUnit=" °C"
          />
          <StatCard
            label="Est. Time to Runaway"
            value={runawaySuffix}
            color={p.runaway ? C.danger : HUD.text}
            animate={!p.runaway}
            numericValue={p.months}
            numericDecimals={0}
            numericUnit=" mo"
          />
        </div>

        {/* Bracketed RadialGauge panel */}
        <div style={{ position: "relative" }}>
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
            padding: "14px 10px",
            background: HUD.glass,
            border: `1px solid ${HUD.lineHi}`,
            borderRadius: 10,
            position: "relative",
          }}>
            <Bracket color={p.Tterm >= 120 ? C.danger : HUD.cyan} size={9} inset={4} weight={1.5} opacity={0.6} />
            <RadialGauge
              value={p.Tterm}
              max={150}
              size={110}
              thickness={10}
              label={<AnimatedNumber value={p.Tterm} decimals={0} />}
              sublabel="°C / RUNAWAY"
              color={p.Tterm >= 120 ? C.danger : p.Tterm >= 90 ? C.bad : C.amber}
              track={HUD.line}
              glow
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { t: 60,  label: "Elevated",    color: C.warn },
                { t: 90,  label: "Accelerated", color: C.bad },
                { t: 120, label: "Danger",       color: C.danger },
                { t: 150, label: "Runaway",      color: C.danger },
              ].map(({ t, label, color }) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    width: 22,
                    height: 2,
                    background: color,
                    borderRadius: 1,
                    opacity: p.Tterm >= t ? 1 : 0.3,
                    boxShadow: p.Tterm >= t ? glow(color, 0.5) : "none",
                  }} />
                  <span style={{ color: p.Tterm >= t ? color : HUD.dimmer, fontSize: 9, fontFamily: mono }}>
                    {t}°C {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status banner — pulses on RUNAWAY or ACCELERATED */}
        <div
          key={statusKey}
          style={{
            background: p.sColor + "14",
            border: `1px solid ${p.sColor}`,
            borderRadius: 10,
            padding: "10px 14px",
            position: "relative",
            animation: (isPulsing && !reduced) ? "oi-pulse 1.4s ease-in-out infinite" : "none",
          }}
        >
          <Bracket color={p.sColor} size={8} inset={4} weight={1.5} opacity={0.6} />
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}>
            <span style={{
              width: 6,
              height: 6,
              background: p.sColor,
              borderRadius: "50%",
              boxShadow: glow(p.sColor, 0.8),
              flexShrink: 0,
              display: "inline-block",
              ...(isPulsing && !reduced ? { animation: "oi-pulse 1s ease-in-out infinite" } : {}),
            }} />
            <span style={{ color: p.sColor, fontFamily: mono, fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>
              {p.status}
            </span>
          </div>
          <div style={{ color: HUD.dim, fontSize: 10, fontFamily: mono, lineHeight: 1.6 }}>
            I²R heating (P = {p.P} W) raises terminal temp via thermal resistance. Copper-oxide
            growth rate follows Arrhenius kinetics (Ea ≈ 0.7 eV) — resistance increases
            with temperature in positive feedback. Above ~120–150 °C, oxide bridges fail
            and runaway ignition becomes imminent.
          </div>
        </div>
      </div>

      {/* ── Right: SVG chart ── */}
      <div style={{ flex: "1 1 320px", minWidth: 280 }}>
        <Card title="TERMINAL TEMP vs LOAD CURRENT">
          {/* Bracketed chart panel */}
          <div style={{ position: "relative", padding: "4px 0" }}>
            <Bracket color={HUD.cyan} size={8} inset={0} weight={1} opacity={0.4} />
            <div style={{ overflowX: "auto" }}>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, display: "block", fontFamily: mono }}>
                {/* Danger band 60–90°C */}
                <rect x={padL} y={y90} width={plotW} height={y60 - y90}
                  fill={C.warn + "20"}
                  style={(p.Tterm >= 60 && p.Tterm < 90 && !reduced) ? { animation: "oi-glow 2s ease-in-out infinite" } : {}}
                />
                {/* Band 90–120°C */}
                <rect x={padL} y={y120} width={plotW} height={y90 - y120}
                  fill={C.bad + "20"}
                  style={(p.Tterm >= 90 && p.Tterm < 120 && !reduced) ? { animation: "oi-glow 1.5s ease-in-out infinite" } : {}}
                />
                {/* Band 120+°C */}
                <rect x={padL} y={padT} width={plotW} height={y120 - padT}
                  fill={C.danger + "22"}
                  style={(p.Tterm >= 120 && !reduced) ? { animation: "oi-glow 0.9s ease-in-out infinite" } : {}}
                />

                {/* 60°C line */}
                <line x1={padL} y1={y60} x2={padL + plotW} y2={y60}
                  stroke={C.warn} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
                <text x={padL + 2} y={y60 - 3} fill={C.warn} fontSize={8}>60°C</text>

                {/* 90°C line */}
                <line x1={padL} y1={y90} x2={padL + plotW} y2={y90}
                  stroke={C.bad} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
                <text x={padL + 2} y={y90 - 3} fill={C.bad} fontSize={8}>90°C</text>

                {/* 120°C line */}
                <line x1={padL} y1={y120} x2={padL + plotW} y2={y120}
                  stroke={C.danger} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
                <text x={padL + 2} y={y120 - 3} fill={C.danger} fontSize={8}>120°C</text>

                {/* 150°C runaway line */}
                <line x1={padL} y1={y150} x2={padL + plotW} y2={y150}
                  stroke={C.danger} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.9} />
                <text x={padL + 2} y={y150 - 3} fill={C.danger} fontSize={8} fontWeight="bold">150°C RUNAWAY</text>

                {/* Axes */}
                <line x1={padL} y1={yBottom} x2={padL + plotW} y2={yBottom} stroke={HUD.line} strokeWidth={1} />
                <line x1={padL} y1={padT} x2={padL} y2={yBottom} stroke={HUD.line} strokeWidth={1} />

                {/* X-axis ticks */}
                {xTicks.map((a) => {
                  const x = padL + (a / maxA) * plotW;
                  return (
                    <g key={a}>
                      <line x1={x} y1={yBottom} x2={x} y2={yBottom + 4} stroke={HUD.dimmer} strokeWidth={1} />
                      <text x={x} y={yBottom + 12} fill={HUD.dimmer} fontSize={8} textAnchor="middle">{a}A</text>
                    </g>
                  );
                })}

                {/* Y-axis ticks */}
                {[0, 50, 100, 150, 200].map((t) => {
                  const y = tempToY(t, padT, plotH, maxT);
                  return (
                    <g key={t}>
                      <line x1={padL - 3} y1={y} x2={padL} y2={y} stroke={HUD.dimmer} strokeWidth={1} />
                      <text x={padL - 5} y={y + 3} fill={HUD.dimmer} fontSize={7} textAnchor="end">{t}</text>
                    </g>
                  );
                })}

                {/* The curve — draw-on animation via stroke-dashoffset */}
                <path
                  ref={pathRef}
                  d={curvePath}
                  fill="none"
                  stroke={C.amber}
                  strokeWidth={2}
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: pathLen,
                    strokeDashoffset: 0,
                    transition: "stroke-dashoffset 0.5s ease-out, d 0.2s ease",
                    filter: `drop-shadow(0 0 4px ${C.amber}88)`,
                  }}
                />

                {/* Marker dot at current A */}
                <circle
                  cx={markerX}
                  cy={markerY}
                  r={5}
                  fill={p.sColor}
                  stroke={HUD.void}
                  strokeWidth={2}
                  style={{
                    transition: "cx 0.2s ease, cy 0.2s ease, fill 0.3s",
                    filter: `drop-shadow(0 0 6px ${p.sColor})`,
                  }}
                />
                <line x1={markerX} y1={markerY} x2={markerX} y2={yBottom}
                  stroke={p.sColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.5}
                  style={{ transition: "stroke 0.3s" }}
                />
              </svg>
            </div>
          </div>

          {/* Legend */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            margin: "10px 0 5px",
            color: HUD.cyan,
            fontSize: 9,
            fontFamily: mono,
            fontWeight: 800,
            letterSpacing: 2,
          }}>
            <span style={{
              width: 5, height: 5, background: HUD.cyan,
              transform: "rotate(45deg)", flexShrink: 0, display: "inline-block",
            }} />
            LEGEND
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {[
              { color: C.amber,  label: "Tterm curve" },
              { color: C.warn,   label: "60–90°C elevated" },
              { color: C.bad,    label: "90–120°C accelerated" },
              { color: C.danger, label: ">120°C / runaway" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{
                  width: 14,
                  height: 2,
                  background: color,
                  borderRadius: 1,
                  boxShadow: glow(color, 0.5),
                }} />
                <span style={{ color: HUD.dimmer, fontSize: 9, fontFamily: mono }}>{label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
