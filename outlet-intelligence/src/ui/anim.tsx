/* ════════════════════════════════════════════════════════════════════════════
   MOTION & VIZ FOUNDATION — dependency-free animation system shared by every
   view. Keyframes are injected once via <MotionStyles/>; hooks drive rAF
   count-ups and springs; primitives (RadialGauge, AnimatedNumber, Sparkline,
   ConfidenceRing) give a consistent instrument aesthetic. Honours
   prefers-reduced-motion throughout.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useEffect, useRef, useState } from "react";
import { C, mono } from "./theme";

// ─── global keyframes + utility classes (mount once) ──────────────────────────
export function MotionStyles() {
  return (
    <style>{`
      @keyframes oi-pulse { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:1;transform:scale(1.12)} }
      @keyframes oi-glow { 0%,100%{filter:drop-shadow(0 0 2px currentColor)} 50%{filter:drop-shadow(0 0 9px currentColor)} }
      @keyframes oi-ringpulse { 0%{transform:scale(.7);opacity:.7} 100%{transform:scale(1.7);opacity:0} }
      @keyframes oi-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      @keyframes oi-dash { to { stroke-dashoffset: -1000; } }
      @keyframes oi-fadeup { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
      @keyframes oi-popin { from{opacity:0;transform:scale(.92)} to{opacity:1;transform:scale(1)} }
      @keyframes oi-spin { to { transform: rotate(360deg); } }
      @keyframes oi-scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(420%)} }
      @keyframes oi-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
      @keyframes oi-sweep { from{opacity:.0} to{opacity:1} }
      .oi-fadeup{animation:oi-fadeup .5s cubic-bezier(.2,.7,.2,1) both}
      .oi-popin{animation:oi-popin .35s cubic-bezier(.2,.8,.2,1) both}
      .oi-pulse{animation:oi-pulse 1.6s ease-in-out infinite}
      .oi-glow{animation:oi-glow 2.2s ease-in-out infinite}
      .oi-float{animation:oi-float 3s ease-in-out infinite}
      .oi-stagger>*{animation:oi-fadeup .45s cubic-bezier(.2,.7,.2,1) both}
      .oi-stagger>*:nth-child(1){animation-delay:.03s}
      .oi-stagger>*:nth-child(2){animation-delay:.07s}
      .oi-stagger>*:nth-child(3){animation-delay:.11s}
      .oi-stagger>*:nth-child(4){animation-delay:.15s}
      .oi-stagger>*:nth-child(5){animation-delay:.19s}
      .oi-stagger>*:nth-child(6){animation-delay:.23s}
      .oi-stagger>*:nth-child(7){animation-delay:.27s}
      .oi-stagger>*:nth-child(n+8){animation-delay:.31s}
      .oi-shimmer{background:linear-gradient(100deg,#ffffff00 30%,#ffffff22 50%,#ffffff00 70%);background-size:200% 100%;animation:oi-shimmer 2.4s linear infinite}
      .oi-flow{stroke-dasharray:6 7;animation:oi-dash 14s linear infinite}
      .oi-press{transition:transform .08s ease}.oi-press:active{transform:scale(.95)}
      .oi-lift{transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s,border-color .18s}
      .oi-lift:hover{transform:translateY(-2px)}
      @media (prefers-reduced-motion: reduce){
        .oi-fadeup,.oi-popin,.oi-pulse,.oi-glow,.oi-float,.oi-stagger>*,.oi-shimmer,.oi-flow{animation:none !important}
      }
    `}</style>
  );
}

export function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const f = () => setR(mq.matches);
    f(); mq.addEventListener?.("change", f);
    return () => mq.removeEventListener?.("change", f);
  }, []);
  return r;
}

// ─── rAF count-up ─────────────────────────────────────────────────────────────
export function useCountUp(target: number, duration = 650): number {
  const reduced = useReducedMotion();
  const [v, setV] = useState(target);
  const from = useRef(target);
  const raf = useRef(0);
  useEffect(() => {
    if (reduced || duration <= 0) { setV(target); return; }
    const start = performance.now();
    const a = from.current;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
      setV(a + (target - a) * e);
      if (k < 1) raf.current = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, reduced]);
  return v;
}

export function AnimatedNumber({ value, decimals = 0, suffix = "", prefix = "", style }: { value: number; decimals?: number; suffix?: string; prefix?: string; style?: React.CSSProperties }) {
  const v = useCountUp(value);
  return <span style={style}>{prefix}{v.toFixed(decimals)}{suffix}</span>;
}

// ─── radial gauge (270° arc) ──────────────────────────────────────────────────
export function RadialGauge({ value, max = 1, size = 132, thickness = 11, color, track = "#1b1b22", label, sublabel, glow = true }:
  { value: number; max?: number; size?: number; thickness?: number; color: string; track?: string; label?: React.ReactNode; sublabel?: string; glow?: boolean }) {
  const reduced = useReducedMotion();
  const f = Math.max(0, Math.min(1, value / max));
  const sprung = useSpringValue(f); // always call the hook (Rules of Hooks)
  const af = reduced ? f : sprung;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const C2 = 2 * Math.PI * r;
  const arc = 0.75; // 270°
  const dash = C2 * arc;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(135deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={thickness} strokeDasharray={`${dash} ${C2}`} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={thickness}
          strokeDasharray={`${dash * af} ${C2}`} strokeLinecap="round"
          style={{ transition: reduced ? "none" : "stroke-dasharray .2s linear", filter: glow ? `drop-shadow(0 0 6px ${color}aa)` : undefined }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        {label && <div style={{ color, fontFamily: mono, fontWeight: 800, fontSize: size * 0.21, lineHeight: 1 }}>{label}</div>}
        {sublabel && <div style={{ color: C.dimmer, fontFamily: mono, fontSize: size * 0.082, marginTop: 3, letterSpacing: 1 }}>{sublabel}</div>}
      </div>
    </div>
  );
}

// spring value driven by rAF (critically-ish damped)
export function useSpringValue(target: number, stiffness = 0.12, damp = 0.72): number {
  const [v, setV] = useState(target);
  const state = useRef({ v: target, vel: 0 });
  const raf = useRef(0);
  useEffect(() => {
    const tick = () => {
      const s = state.current;
      const force = (target - s.v) * stiffness;
      s.vel = (s.vel + force) * damp;
      s.v += s.vel;
      if (Math.abs(target - s.v) < 0.0008 && Math.abs(s.vel) < 0.0008) { s.v = target; setV(target); return; }
      setV(s.v);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, stiffness, damp]);
  return v;
}

// ─── sparkline ────────────────────────────────────────────────────────────────
export function Sparkline({ data, width = 90, height = 26, color = C.blue, fill = true }: { data: number[]; width?: number; height?: number; color?: string; fill?: boolean }) {
  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((d, i) => [(i / (data.length - 1 || 1)) * width, height - ((d - min) / span) * (height - 4) - 2]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {fill && <path d={`${line} L${width} ${height} L0 ${height} Z`} fill={color} opacity={0.12} />}
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.2} fill={color} />
    </svg>
  );
}

// ─── reusable gradient defs (for grade fills) ─────────────────────────────────
export function GradeDefs() {
  return (
    <defs>
      <linearGradient id="grad-green" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34D399" /><stop offset="1" stopColor="#059669" /></linearGradient>
      <linearGradient id="grad-amber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FBBF24" /><stop offset="1" stopColor="#D97706" /></linearGradient>
      <linearGradient id="grad-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F87171" /><stop offset="1" stopColor="#B91C1C" /></linearGradient>
      <radialGradient id="grad-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ffffff" stopOpacity="0.25" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></radialGradient>
    </defs>
  );
}

/** Glassmorphic card with optional glow accent. */
export function GlowCard({ accent, children, style, className }: { accent?: string; children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={`oi-lift ${className ?? ""}`} style={{
      background: "linear-gradient(160deg,#16161Acc,#101014cc)", backdropFilter: "blur(8px)",
      border: `1px solid ${accent ? accent + "55" : C.border}`, borderRadius: 14, padding: 14,
      boxShadow: accent ? `0 0 0 1px ${accent}22, 0 8px 30px -12px ${accent}66` : "0 8px 24px -16px #000",
      ...style,
    }}>{children}</div>
  );
}
