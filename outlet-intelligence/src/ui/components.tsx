/* Shared presentational primitives. */
import React from "react";
import { C, mono } from "./theme";

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
            <div style={{ display: "flex", alignItems: "center", gap: 7, color: C.blue, fontSize: 9, fontFamily: mono, fontWeight: 800, letterSpacing: 1.5 }}>
              <span style={{ width: 5, height: 5, background: C.blue, boxShadow: `0 0 6px ${C.blue}`, transform: "rotate(45deg)", flexShrink: 0 }} />
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

export function SubH({ text }: { text: string }) {
  return <div style={{ color: C.blue, fontSize: 9, fontFamily: mono, fontWeight: 700, margin: "10px 0 6px", borderBottom: `1px solid ${C.border}`, paddingBottom: 3 }}>{text}</div>;
}

export function Row({ label, val, monoFont }: { label: string; val: React.ReactNode; monoFont?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.dimmer, fontSize: 10, fontFamily: mono, minWidth: 92, flexShrink: 0 }}>{label}</span>
      <span style={{ color: C.text, fontSize: 11, fontFamily: monoFont ? mono : "inherit", lineHeight: 1.5 }}>{val}</span>
    </div>
  );
}

export function Tag({ color, text }: { color: string; text: string }) {
  return <span style={{ display: "inline-block", background: color + "22", color, fontSize: 9, padding: "2px 7px", borderRadius: 4, fontFamily: mono, fontWeight: 700, marginRight: 5, marginBottom: 4 }}>{text}</span>;
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
    <label style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span style={{ color: C.dimmer, fontSize: 9, fontFamily: mono }}>{label}</span>
      {children}
    </label>
  );
}

export function NumberInput({ value, onChange, placeholder }: { value: string | number | null | undefined; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ background: "#0A0A0E", border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 9px", fontSize: 13, fontFamily: mono }}
    />
  );
}

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      style={{ background: "#0A0A0E", border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 9px", fontSize: 13, fontFamily: mono }} />
  );
}

export function Select<T extends string>({ value, options, onChange }: { value: T; options: readonly T[] | T[]; onChange: (v: T) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)}
      style={{ background: "#0A0A0E", border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 9px", fontSize: 12.5, fontFamily: mono }}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/** Yes / No / Unknown tri-state toggle. */
export function TriToggle({ value, onChange }: { value: boolean | null | undefined; onChange: (v: boolean | null) => void }) {
  const opts: Array<[string, boolean | null]> = [["Y", true], ["N", false], ["?", null]];
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {opts.map(([t, v]) => (
        <button key={t} onClick={() => onChange(v)} style={{
          padding: "7px 11px", border: `1px solid ${value === v ? C.amber : C.border}`, borderRadius: 7, fontSize: 12, fontFamily: mono,
          background: value === v ? "#2A1F00" : "#0A0A0E", color: value === v ? C.amber : C.dim,
        }}>{t}</button>
      ))}
    </div>
  );
}

/** Responsive sheet: bottom sheet on phone, side panel on desktop. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#000A", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="sheet" style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: "16px 16px 0 0",
        width: "100%", maxWidth: 560, maxHeight: "88vh", overflow: "auto", padding: 16,
        boxShadow: "0 -8px 40px #000B",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, position: "sticky", top: -16, background: C.panel, paddingTop: 4, paddingBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontFamily: mono, color: C.amber }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.dim, fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        {children}
      </div>
      <style>{`@media(min-width:760px){.sheet{align-self:stretch;border-radius:16px 0 0 16px !important;max-height:100vh !important;height:100%;}}`}</style>
    </div>
  );
}
