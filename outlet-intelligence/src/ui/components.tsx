/* Shared presentational primitives (canonical — used across every menu). */
import React from "react";
import { C, mono } from "./theme";
import { Bracket } from "./hud/Bracket";

export function Card({ title, right, children, style }: { title?: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      position: "relative",
      background: "linear-gradient(165deg, rgba(17,26,40,0.66), rgba(8,13,21,0.72))",
      backdropFilter: "blur(7px)",
      border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, minWidth: 0,
      boxShadow: "0 12px 34px -22px #000, inset 0 1px 0 rgba(255,255,255,0.03)",
      ...style,
    }}>
      <span style={{ position: "absolute", left: 14, right: 14, top: 0, height: 1, background: `linear-gradient(90deg,transparent,${C.blue}55,transparent)` }} />
      {(title || right) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11, gap: 8 }}>
          {title && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, color: C.blue, fontSize: 11, fontFamily: mono, fontWeight: 800, letterSpacing: 1.2 }}>
              <span style={{ width: 6, height: 6, background: C.blue, boxShadow: `0 0 6px ${C.blue}`, transform: "rotate(45deg)", flexShrink: 0 }} />
              {title}
            </div>
          )}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

/** Canonical HUD section header (replaces the per-view HudLabel variants). */
export function SectionHeader({ label, sub, style }: { label: string; sub?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0 10px", ...style }}>
      <span style={{ width: 6, height: 6, background: C.blue, transform: "rotate(45deg)", boxShadow: `0 0 6px ${C.blue}`, flexShrink: 0 }} />
      <span style={{ color: C.blue, fontSize: 10, fontFamily: mono, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</span>
      {sub && <span style={{ color: C.dim, fontSize: 9.5, fontFamily: mono }}>{sub}</span>}
      <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg,${C.border},transparent)` }} />
    </div>
  );
}

/** Canonical glass HUD panel with corner brackets (replaces per-view HudPanel copies). */
export function HudPanel({ children, accent = C.blue, style, className }: { children: React.ReactNode; accent?: string; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={className} style={{
      position: "relative",
      background: "linear-gradient(165deg, rgba(17,26,40,0.6), rgba(8,13,21,0.7))",
      border: `1px solid ${C.border}`, borderRadius: 11, padding: 14, minWidth: 0, ...style,
    }}>
      <Bracket color={accent} size={10} inset={3} weight={1.5} opacity={0.45} />
      {children}
    </div>
  );
}

export function SubH({ text }: { text: string }) {
  return <div style={{ color: C.blue, fontSize: 10, fontFamily: mono, fontWeight: 700, letterSpacing: 1, margin: "10px 0 6px", borderBottom: `1px solid ${C.border}`, paddingBottom: 3 }}>{text}</div>;
}

export function Row({ label, val, monoFont }: { label: string; val: React.ReactNode; monoFont?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.dim, fontSize: 10.5, fontFamily: mono, minWidth: 92, flexShrink: 0 }}>{label}</span>
      <span style={{ color: C.text, fontSize: 11.5, fontFamily: monoFont ? mono : "inherit", lineHeight: 1.5 }}>{val}</span>
    </div>
  );
}

export function Tag({ color, text }: { color: string; text: string }) {
  return <span style={{ display: "inline-block", background: color + "22", color, fontSize: 10, padding: "2px 7px", borderRadius: 4, fontFamily: mono, fontWeight: 700, marginRight: 5, marginBottom: 4 }}>{text}</span>;
}

export function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, border: `1px solid ${color}`, color, background: color + "18", borderRadius: 999, padding: "3px 9px", fontFamily: mono, fontWeight: 800, fontSize: 10 }}>{children}</span>;
}

export function Bar({ pct, color, h = 7 }: { pct: number; color: string; h?: number }) {
  return (
    <div style={{ height: h, background: "#0A0A0E", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color, transition: "width .2s" }} />
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={{ color: C.dim, fontSize: 10, fontFamily: mono }}>{label}</span>
      {children}
    </label>
  );
}

// inputs use 16px font to prevent iOS focus-zoom; full-width + border-box so they never overflow grids
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "#0A0A0E", border: `1px solid ${C.border}`, borderRadius: 8,
  padding: "9px 10px", fontSize: 16, fontFamily: mono, color: C.text, minHeight: 42,
};

export function NumberInput({ value, onChange, placeholder }: { value: string | number | null | undefined; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input type="number" inputMode="decimal" value={value ?? ""} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)} style={inputStyle} />
  );
}

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={inputStyle} />;
}

export function Select<T extends string>({ value, options, onChange }: { value: T; options: readonly T[] | T[]; onChange: (v: T) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} style={{ ...inputStyle, fontSize: 15 }}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/** Yes / No / Unknown tri-state toggle — 44px touch targets, outline on active. */
export function TriToggle({ value, onChange }: { value: boolean | null | undefined; onChange: (v: boolean | null) => void }) {
  const opts: Array<[string, boolean | null]> = [["Y", true], ["N", false], ["?", null]];
  return (
    <div style={{ display: "flex", gap: 7 }}>
      {opts.map(([t, v]) => {
        const on = value === v;
        return (
          <button key={t} onClick={() => onChange(v)} className="oi-press" style={{
            flex: 1, minHeight: 44, padding: "10px 0", borderRadius: 8, fontSize: 14, fontFamily: mono, fontWeight: on ? 800 : 600,
            border: `1px solid ${on ? C.amber : C.border}`,
            background: on ? "#2A1F00" : "#0A0A0E", color: on ? C.amber : C.dim,
            boxShadow: on ? `0 0 0 1px ${C.amber}, 0 0 10px -4px ${C.amber}` : "none",
          }}>{t}</button>
        );
      })}
    </div>
  );
}

/** Responsive sheet: bottom sheet on phone, side panel on desktop. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000C", backdropFilter: "blur(2px)", zIndex: 90, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="sheet" style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: "16px 16px 0 0",
        width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto",
        padding: "0 16px calc(16px + env(safe-area-inset-bottom,0px))",
        boxShadow: "0 -8px 40px #000B",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, position: "sticky", top: 0, background: C.panel, paddingTop: 12, paddingBottom: 8, zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontFamily: mono, color: C.amber, letterSpacing: 0.5 }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" className="oi-press" style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.dim, fontSize: 18, lineHeight: 1, width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
        </div>
        {children}
      </div>
      <style>{`@media(min-width:760px){.sheet{align-self:stretch;border-radius:16px 0 0 16px !important;max-height:100vh !important;height:100%;}}`}</style>
    </div>
  );
}
