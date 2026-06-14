/* ════════════════════════════════════════════════════════════════════════════
   MEASUREMENT COVERAGE — the "diagnostic progress" instrument. An evidence ring
   that fills as the inspector captures readings, a live certainty trend, and a
   grid of per-measurement nodes that light up when taken. Engagement through
   closure + meaning + gentle guidance — never points, badges or streaks.
   Each node carries its own bespoke OIcon so the measurements feel instrumented.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import { RadialGauge, useReducedMotion } from "../../anim";
import { C, HUD, mono } from "../../theme";
import { OIcon, type OIconName } from "../../icons/OIcon";
import type { Observation } from "../../../core";
import type { analyzeOutlet } from "../../../core";

type Result = ReturnType<typeof analyzeOutlet>;

type Kind = "num" | "bool" | "thermal";
interface Ev { key: keyof Observation; label: string; icon: OIconName; kind: Kind; group: string; lethal?: boolean; }

/** The evidence catalogue — what a full survey captures, grouped by station. */
const CATALOG: Ev[] = [
  { key: "VHN",            label: "H→N",     icon: "hot",        kind: "num",  group: "Voltage" },
  { key: "VHG",            label: "H→G",     icon: "ground",     kind: "num",  group: "Voltage" },
  { key: "VNG",            label: "N→G",     icon: "neutral",    kind: "num",  group: "Voltage" },
  { key: "loadW",          label: "Load",    icon: "load",       kind: "num",  group: "Loaded" },
  { key: "vhnLoaded",      label: "H→N·ld",  icon: "hot",        kind: "num",  group: "Loaded" },
  { key: "vngLoaded",      label: "N→G·ld",  icon: "neutral",    kind: "num",  group: "Loaded" },
  { key: "dropV",          label: "Drop",    icon: "voltage",    kind: "num",  group: "Loaded" },
  { key: "Gcont",          label: "Gnd Ω",   icon: "continuity", kind: "num",  group: "Continuity" },
  { key: "frittingObs",    label: "Fritting",icon: "arc",        kind: "bool", group: "Behaviour" },
  { key: "thermalSlot",    label: "Thermal", icon: "thermal",    kind: "thermal", group: "Behaviour" },
  { key: "wiggleObs",      label: "Wiggle",  icon: "wiggle",     kind: "bool", group: "Behaviour" },
  { key: "afciTrip",       label: "AFCI",    icon: "afci",       kind: "bool", group: "Behaviour" },
  { key: "gfciTrip",       label: "GFCI",    icon: "gfci",       kind: "bool", group: "Behaviour" },
  { key: "hasGroundWire",  label: "Gnd wire",icon: "ground",     kind: "bool", group: "Safety", lethal: true },
  { key: "groundRefTested",label: "Gnd ref", icon: "shield",     kind: "bool", group: "Safety", lethal: true },
];
const GROUPS = ["Voltage", "Loaded", "Continuity", "Behaviour", "Safety"] as const;

function captured(obs: Observation, ev: Ev): boolean {
  const v = obs[ev.key];
  if (ev.kind === "bool") return v === true || v === false;
  if (ev.kind === "thermal") return v != null && v !== "none"; // "none" = default, not a finding
  // numeric reading — any non-empty string/number counts ("OL" is a valid answer)
  return v !== null && v !== undefined && String(v).trim() !== "";
}

export function MeasurementCoverage({ obs, result }: { obs: Observation; result: Result }) {
  const reduced = useReducedMotion();
  const flags = CATALOG.map((ev) => ({ ev, on: captured(obs, ev) }));
  const done = flags.filter((f) => f.on).length;
  const total = CATALOG.length;
  const frac = done / total;
  const confPct = Math.round(result.confidence * 100);

  // lethal-relevant safety checks still missing — the only "nudge" we surface
  const missingLethal = flags.filter((f) => f.ev.lethal && !f.on).map((f) => f.ev);

  // a single, honest line of guidance (not a reward)
  const guidance =
    missingLethal.length > 0
      ? { text: `${missingLethal.map((e) => e.label).join(" + ")} untested — lethal faults can't be excluded`, color: C.danger }
      : done === 0
      ? { text: "Enter what you measured — the diagnosis sharpens with each reading", color: C.dim }
      : frac < 0.5
      ? { text: "Evidence building — add loaded and continuity tests to narrow it down", color: C.amber }
      : result.confidence >= 0.8
      ? { text: "Strong evidence base — high-confidence adjudication", color: C.good }
      : { text: "Good coverage — a couple more tests would lift confidence", color: HUD.cyan };

  const ringColor = missingLethal.length > 0 ? C.danger : frac >= 0.7 ? C.good : frac >= 0.4 ? C.amber : HUD.cyan;

  return (
    <div style={{
      position: "relative",
      borderRadius: 16,
      padding: "16px 16px 14px",
      background: "linear-gradient(160deg,#0D131Ddd,#0A0F17dd)",
      border: `1.5px solid ${ringColor}33`,
      boxShadow: `0 0 0 1px ${ringColor}18, 0 8px 38px -16px ${ringColor}66`,
      backdropFilter: "blur(10px)",
      overflow: "hidden",
    }}>
      {/* Section label */}
      <div style={{ color: C.dim, fontSize: 10, fontFamily: mono, letterSpacing: 1.5, fontWeight: 700, marginBottom: 14, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 3, height: 9, borderRadius: 2, background: ringColor, display: "inline-block", flexShrink: 0 }} />
        DIAGNOSTIC PROGRESS
      </div>

      {/* Ring + certainty stack */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div style={{ flexShrink: 0 }}>
          <RadialGauge value={frac} max={1} size={116} thickness={10} color={ringColor} label={`${done}/${total}`} sublabel="EVIDENCE" glow />
        </div>
        <div style={{ flex: 1, minWidth: 130, display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <Metric label="CERTAINTY" value={`${confPct}%`} color={result.vColor} />
            <Metric label="ENTROPY" value={result.H.toFixed(2)} unit="bits" color={HUD.cyan} />
          </div>
          {/* certainty bar — the "trend" cue without faking history */}
          <div style={{ height: 4, background: HUD.line, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${confPct}%`, height: "100%", background: `linear-gradient(90deg,${result.vColor}77,${result.vColor})`, borderRadius: 4, boxShadow: `0 0 8px ${result.vColor}77`, transition: "width .5s cubic-bezier(.2,.8,.2,1)" }} />
          </div>
          <div style={{ color: guidance.color, fontFamily: mono, fontSize: 9.5, lineHeight: 1.5 }}>
            {guidance.text}
          </div>
        </div>
      </div>

      {/* Node grid — grouped stations, each measurement a lit/unlit chip */}
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
        {GROUPS.map((g) => {
          const items = flags.filter((f) => f.ev.group === g);
          return (
            <div key={g} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: C.dimmer, fontFamily: mono, fontSize: 8, letterSpacing: 1, width: 56, flexShrink: 0, textAlign: "right", textTransform: "uppercase" }}>{g}</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
                {items.map(({ ev, on }) => {
                  const nudge = ev.lethal && !on;
                  const col = on ? ev_color(ev) : nudge ? C.danger : C.dimmer;
                  return (
                    <div key={String(ev.key)} title={`${ev.label}${on ? " — captured" : nudge ? " — required, not yet tested" : " — not captured"}`}
                      className={nudge && !reduced ? "oi-pulse" : undefined}
                      style={{
                        display: "flex", alignItems: "center", gap: 4, padding: "3px 7px 3px 5px", borderRadius: 7,
                        background: on ? col + "16" : nudge ? C.danger + "12" : "transparent",
                        border: `1px solid ${on ? col + "55" : nudge ? C.danger + "55" : HUD.line}`,
                        opacity: on || nudge ? 1 : 0.5,
                      }}>
                      <OIcon name={ev.icon} size={13} color={col} accent={on ? col : "#F8B54466"} />
                      <span style={{ color: on ? C.text : col, fontFamily: mono, fontSize: 9, fontWeight: on ? 700 : 500 }}>{ev.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** captured node color by station (keeps the palette coherent) */
function ev_color(ev: Ev): string {
  switch (ev.group) {
    case "Voltage": return HUD.cyan;
    case "Loaded": return C.amber;
    case "Continuity": return C.good;
    case "Behaviour": return "#A78BFA";
    case "Safety": return C.good;
    default: return HUD.cyan;
  }
}

function Metric({ label, value, unit, color }: { label: string; value: string; unit?: string; color: string }) {
  return (
    <div style={{ background: color + "12", border: `1px solid ${color}33`, borderRadius: 7, padding: "5px 10px", minWidth: 58 }}>
      <div style={{ color, fontFamily: mono, fontWeight: 800, fontSize: 15, lineHeight: 1 }}>
        {value}{unit && <span style={{ fontSize: 8.5, marginLeft: 2, fontWeight: 400 }}>{unit}</span>}
      </div>
      <div style={{ color: C.dim, fontFamily: mono, fontSize: 8, letterSpacing: 1, marginTop: 3 }}>{label}</div>
    </div>
  );
}
