/* ════════════════════════════════════════════════════════════════════════════
   OIcon — the app's single, bespoke icon system. One 24×24 grid, 1.75px round
   strokes, exactly one amber accent per glyph (var --oi-accent). Constructed as
   a SET (same canvas/stroke/join/accent) so it reads as designed, never clip-art
   or emoji. The receptacle DNA (two slots + round ground) recurs throughout.
   Replaces every emoji / unicode-diamond tell in the UI.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";

export type OIconName =
  | "logo" | "hot" | "neutral" | "ground" | "voltage" | "resistance" | "continuity"
  | "load" | "thermal" | "arc" | "wiggle" | "afci" | "gfci" | "polarity"
  | "receptacle" | "breaker" | "circuit" | "room" | "floor" | "home"
  | "diagnose" | "report" | "atlas" | "learning" | "settings" | "prognosis" | "more"
  | "command" | "reference"
  | "criticConservation" | "criticArtifact" | "criticWorstCase"
  | "criticParsimony" | "criticBaseRate" | "criticContrarian"
  | "verdictPass" | "verdictDefect" | "verdictCondemn" | "verdictHold"
  | "verdictMinor" | "verdictInconclusive"
  | "export" | "import" | "sync" | "camera" | "bolt" | "shield" | "check" | "cross";

const S = 1.75; // regular stroke
const SH = 2.25; // heavy (logo + verdict frames)
const cc = "currentColor";
const ac = "var(--oi-accent)";

/** Per-glyph body. Body strokes = currentColor; the single accent = var(--oi-accent). */
const PATHS: Record<OIconName, React.ReactNode> = {
  logo: (<>
    <rect x="4" y="3" width="16" height="18" rx="5" stroke={cc} strokeWidth={SH} />
    <line x1="9.5" y1="8" x2="9.5" y2="12.5" stroke={cc} strokeWidth={SH} />
    <line x1="14.5" y1="8.5" x2="14.5" y2="12" stroke={ac} strokeWidth={SH} />
    <circle cx="12" cy="16" r="1.6" stroke={cc} strokeWidth={SH} />
    <line x1="2.5" y1="13.4" x2="21.5" y2="11.2" stroke={ac} strokeWidth="1.5" opacity="0.5" />
  </>),
  hot: (<>
    <line x1="12" y1="4" x2="12" y2="20" stroke={cc} strokeWidth={S} />
    <path d="M12 10 l-3 2 h3 l-3 2" stroke={cc} strokeWidth={S} />
    <circle cx="12" cy="4" r="1.1" fill={ac} />
  </>),
  neutral: (<>
    <line x1="12" y1="3.5" x2="12" y2="20.5" stroke={cc} strokeWidth={S} />
    <line x1="9" y1="20.5" x2="15" y2="20.5" stroke={ac} strokeWidth={S} />
  </>),
  ground: (<>
    <line x1="12" y1="3.5" x2="12" y2="12" stroke={ac} strokeWidth={S} />
    <line x1="6" y1="12" x2="18" y2="12" stroke={cc} strokeWidth={S} />
    <line x1="8" y1="15.5" x2="16" y2="15.5" stroke={cc} strokeWidth={S} />
    <line x1="10" y1="19" x2="14" y2="19" stroke={cc} strokeWidth={S} />
  </>),
  voltage: (<>
    <circle cx="5" cy="18" r="1.4" stroke={cc} strokeWidth={S} />
    <circle cx="19" cy="6" r="1.4" stroke={ac} strokeWidth={S} />
    <path d="M5 16 v-4 h7 v-4 h5" stroke={cc} strokeWidth={S} />
  </>),
  resistance: (<>
    <path d="M6 19 h3.5 a8 8 0 1 1 5 0 H18" stroke={cc} strokeWidth={S} />
    <circle cx="9.5" cy="19" r="0.9" fill={ac} />
  </>),
  continuity: (<>
    <path d="M6 19 h3.5 a8 8 0 1 1 5 0 H18" stroke={cc} strokeWidth={S} />
    <line x1="6.5" y1="19" x2="17.5" y2="19" stroke={ac} strokeWidth={S} strokeDasharray="0.1 3.4" />
  </>),
  load: (<>
    <rect x="7" y="3.5" width="10" height="7" rx="2" stroke={cc} strokeWidth={S} />
    <line x1="10" y1="10.5" x2="10" y2="14" stroke={cc} strokeWidth={S} />
    <line x1="14" y1="10.5" x2="14" y2="14" stroke={cc} strokeWidth={S} />
    <line x1="4" y1="14" x2="20" y2="14" stroke={cc} strokeWidth={S} />
    <path d="M12 16 l-2 2.5 h2.4 l-2 2.5" stroke={ac} strokeWidth={S} />
  </>),
  thermal: (<>
    <circle cx="8" cy="17" r="2.2" stroke={cc} strokeWidth={S} />
    <circle cx="8" cy="17" r="0.6" fill={ac} />
    <path d="M13 18 q2 -2 0 -4 q-2 -2 0 -4" stroke={ac} strokeWidth={S} />
    <path d="M17 18 q2 -2 0 -4 q-2 -2 0 -4" stroke={cc} strokeWidth={S} opacity="0.7" />
  </>),
  arc: (<>
    <line x1="3" y1="12" x2="9.5" y2="12" stroke={cc} strokeWidth={S} />
    <line x1="14.5" y1="12" x2="21" y2="12" stroke={cc} strokeWidth={S} />
    <path d="M9.5 12 l2 -3 l-1 3 l3 -1 l-2 3" stroke={ac} strokeWidth={S} />
    <circle cx="12" cy="6.5" r="1" fill={ac} />
  </>),
  wiggle: (<>
    <line x1="9" y1="5" x2="9" y2="19" stroke={cc} strokeWidth={S} opacity="0.4" />
    <line x1="15" y1="5" x2="15" y2="19" stroke={cc} strokeWidth={S} opacity="0.4" />
    <line x1="12" y1="4" x2="12" y2="20" stroke={cc} strokeWidth={S} />
    <path d="M5 12 q2 -2.5 4 0" stroke={ac} strokeWidth={S} />
    <path d="M15 12 q2 2.5 4 0" stroke={ac} strokeWidth={S} />
  </>),
  afci: (<>
    <rect x="5" y="4" width="14" height="16" rx="3" stroke={cc} strokeWidth={S} />
    <path d="M11 8 l-2 4 h3 l-2 4" stroke={ac} strokeWidth={S} />
  </>),
  gfci: (<>
    <rect x="5" y="4" width="14" height="16" rx="3" stroke={cc} strokeWidth={S} />
    <circle cx="12" cy="12" r="4" stroke={cc} strokeWidth={S} />
    <circle cx="12" cy="12" r="0.8" fill={ac} />
  </>),
  polarity: (<>
    <line x1="8" y1="5" x2="8" y2="14" stroke={cc} strokeWidth={S} />
    <line x1="16" y1="5" x2="16" y2="14" stroke={cc} strokeWidth={S} />
    <path d="M7 18 q5 3 10 0" stroke={ac} strokeWidth={S} />
    <path d="M7 18 l1.5 -1.5 M7 18 l1.5 1.5" stroke={ac} strokeWidth={S} />
    <path d="M17 18 l-1.5 -1.5 M17 18 l-1.5 1.5" stroke={ac} strokeWidth={S} />
  </>),
  receptacle: (<>
    <rect x="3.5" y="4" width="17" height="16" rx="5" stroke={cc} strokeWidth={S} />
    <line x1="9" y1="8.5" x2="9" y2="12" stroke={cc} strokeWidth={S} />
    <line x1="15" y1="8.5" x2="15" y2="12" stroke={ac} strokeWidth={S} />
    <circle cx="12" cy="15.5" r="1.3" stroke={cc} strokeWidth={S} />
  </>),
  breaker: (<>
    <rect x="6" y="3.5" width="12" height="17" rx="2.5" stroke={cc} strokeWidth={S} />
    <line x1="12" y1="7" x2="12" y2="11" stroke={cc} strokeWidth={S} />
    <path d="M9.5 13 h5 v3 h-5 z" stroke={ac} strokeWidth={S} />
  </>),
  circuit: (<>
    <line x1="4" y1="7" x2="20" y2="7" stroke={ac} strokeWidth={S} />
    <line x1="8" y1="7" x2="8" y2="18" stroke={cc} strokeWidth={S} />
    <line x1="12" y1="7" x2="12" y2="18" stroke={cc} strokeWidth={S} />
    <line x1="16" y1="7" x2="16" y2="18" stroke={cc} strokeWidth={S} />
    <circle cx="8" cy="18.5" r="1.1" stroke={cc} strokeWidth={S} />
    <circle cx="12" cy="18.5" r="1.1" stroke={cc} strokeWidth={S} />
    <circle cx="16" cy="18.5" r="1.1" stroke={cc} strokeWidth={S} />
  </>),
  room: (<>
    <rect x="4" y="6" width="16" height="13" rx="2" stroke={cc} strokeWidth={S} />
    <line x1="14" y1="6" x2="16" y2="6" stroke={ac} strokeWidth={S + 0.5} />
  </>),
  floor: (<>
    <rect x="5" y="4" width="14" height="7" rx="1.5" stroke={cc} strokeWidth={S} />
    <rect x="5" y="13" width="14" height="7" rx="1.5" stroke={ac} strokeWidth={S} />
  </>),
  home: (<>
    <path d="M4 11 L12 4 L20 11" stroke={cc} strokeWidth={S} />
    <path d="M6 10 V20 H18 V10" stroke={cc} strokeWidth={S} />
    <rect x="10.5" y="13" width="3" height="4" stroke={ac} strokeWidth={S} />
  </>),
  // nav aliases
  diagnose: (<>
    <circle cx="12" cy="12" r="8" stroke={cc} strokeWidth={S} />
    <path d="M4 12 h3 l2 -5 l3 10 l2 -5 h6" stroke={ac} strokeWidth={S} />
  </>),
  report: (<>
    <rect x="5" y="3" width="14" height="18" rx="2.5" stroke={cc} strokeWidth={S} />
    <line x1="8.5" y1="8" x2="15.5" y2="8" stroke={cc} strokeWidth={S} />
    <line x1="8.5" y1="12" x2="15.5" y2="12" stroke={cc} strokeWidth={S} />
    <line x1="8.5" y1="16" x2="12.5" y2="16" stroke={ac} strokeWidth={S} />
  </>),
  atlas: (<>
    <path d="M5 5 l7 -1.5 l7 1.5 v14 l-7 -1.5 l-7 1.5 z" stroke={cc} strokeWidth={S} />
    <line x1="12" y1="3.5" x2="12" y2="20.5" stroke={ac} strokeWidth={S} />
  </>),
  learning: (<>
    <path d="M12 4 L21 8.5 L12 13 L3 8.5 Z" stroke={cc} strokeWidth={S} />
    <path d="M7 10.5 V15 q5 3.5 10 0 V10.5" stroke={ac} strokeWidth={S} />
  </>),
  settings: (<>
    <circle cx="12" cy="12" r="3.2" stroke={cc} strokeWidth={S} />
    <path d="M12 3.5 v3 M12 17.5 v3 M3.5 12 h3 M17.5 12 h3 M6 6 l2 2 M16 16 l2 2 M18 6 l-2 2 M8 16 l-2 2" stroke={cc} strokeWidth={S} />
    <circle cx="12" cy="12" r="0.7" fill={ac} />
  </>),
  prognosis: (<>
    <path d="M4 19 h16" stroke={cc} strokeWidth={S} opacity="0.5" />
    <path d="M4 18 q5 0 8 -6 t8 -6" stroke={ac} strokeWidth={S} />
    <circle cx="20" cy="6" r="1.1" fill={ac} />
  </>),
  more: (<>
    <circle cx="6" cy="12" r="1.4" fill={cc} />
    <circle cx="12" cy="12" r="1.4" fill={cc} />
    <circle cx="18" cy="12" r="1.4" fill={ac} />
  </>),
  command: (<>
    <circle cx="12" cy="12" r="8" stroke={cc} strokeWidth={S} />
    <circle cx="12" cy="12" r="3.2" stroke={cc} strokeWidth={S} />
    <line x1="12" y1="4" x2="12" y2="6.5" stroke={cc} strokeWidth={S} />
    <line x1="12" y1="17.5" x2="12" y2="20" stroke={cc} strokeWidth={S} />
    <line x1="4" y1="12" x2="6.5" y2="12" stroke={cc} strokeWidth={S} />
    <line x1="17.5" y1="12" x2="20" y2="12" stroke={cc} strokeWidth={S} />
    <circle cx="12" cy="12" r="0.9" fill={ac} />
  </>),
  reference: (<>
    <path d="M12 6 C10 4.6 7.2 4.6 4.8 5.2 V17.6 C7.2 17 10 17 12 18.4" stroke={cc} strokeWidth={S} />
    <path d="M12 6 C14 4.6 16.8 4.6 19.2 5.2 V17.6 C16.8 17 14 17 12 18.4" stroke={cc} strokeWidth={S} />
    <line x1="12" y1="6" x2="12" y2="18.4" stroke={ac} strokeWidth={S} />
  </>),
  // critics — shared agent-token ring, distinct interior
  criticConservation: (<>
    <circle cx="12" cy="12" r="8" stroke={cc} strokeWidth={S} />
    <line x1="8" y1="13" x2="16" y2="13" stroke={cc} strokeWidth={S} />
    <path d="M10 13 l-2 -4 M14 13 l2 -4" stroke={cc} strokeWidth={S} />
    <circle cx="12" cy="9" r="1" fill={ac} />
  </>),
  criticArtifact: (<>
    <circle cx="12" cy="12" r="8" stroke={cc} strokeWidth={S} />
    <circle cx="11" cy="11" r="2.6" stroke={cc} strokeWidth={S} />
    <line x1="13" y1="13" x2="15.5" y2="15.5" stroke={cc} strokeWidth={S} />
    <path d="M9.5 11 q0.7 -1.2 1.5 0 t1.5 0" stroke={ac} strokeWidth="1.2" />
  </>),
  criticWorstCase: (<>
    <circle cx="12" cy="12" r="8" stroke={cc} strokeWidth={S} />
    <path d="M12 8 v4" stroke={cc} strokeWidth={S} />
    <circle cx="12" cy="15" r="0.9" fill={ac} />
  </>),
  criticParsimony: (<>
    <circle cx="12" cy="12" r="8" stroke={cc} strokeWidth={S} />
    <line x1="7" y1="15" x2="17" y2="9" stroke={ac} strokeWidth={S} />
  </>),
  criticBaseRate: (<>
    <circle cx="12" cy="12" r="8" stroke={cc} strokeWidth={S} />
    <line x1="9" y1="15" x2="9" y2="12.5" stroke={cc} strokeWidth={S} />
    <line x1="12" y1="15" x2="12" y2="10.5" stroke={cc} strokeWidth={S} />
    <line x1="15" y1="15" x2="15" y2="8.5" stroke={ac} strokeWidth={S} />
  </>),
  criticContrarian: (<>
    <circle cx="12" cy="12" r="8" stroke={cc} strokeWidth={S} />
    <path d="M14 8 l-4 4 l4 4" stroke={ac} strokeWidth={S} />
  </>),
  // verdicts — shared hex frame, accent overridden per state at call-site
  verdictPass: (<>
    <path d="M12 2.5 L20 7 V17 L12 21.5 L4 17 V7 Z" stroke={cc} strokeWidth={SH} />
    <path d="M8.5 12 l2.5 2.5 l4.5 -5" stroke={ac} strokeWidth={SH} />
  </>),
  verdictDefect: (<>
    <path d="M12 2.5 L20 7 V17 L12 21.5 L4 17 V7 Z" stroke={cc} strokeWidth={SH} />
    <line x1="12" y1="7.5" x2="12" y2="13.5" stroke={ac} strokeWidth={SH} />
    <circle cx="12" cy="16.5" r="0.9" fill={ac} />
  </>),
  verdictCondemn: (<>
    <path d="M12 2.5 L20 7 V17 L12 21.5 L4 17 V7 Z" stroke={cc} strokeWidth={SH} />
    <path d="M9 9 l6 6 M15 9 l-6 6" stroke={ac} strokeWidth={SH} />
  </>),
  verdictHold: (<>
    <path d="M12 2.5 L20 7 V17 L12 21.5 L4 17 V7 Z" stroke={cc} strokeWidth={SH} />
    <line x1="8" y1="12" x2="16" y2="12" stroke={ac} strokeWidth={SH} />
  </>),
  verdictMinor: (<>
    <path d="M12 2.5 L20 7 V17 L12 21.5 L4 17 V7 Z" stroke={cc} strokeWidth={SH} />
    <path d="M8.5 13 q1.75 -2.5 3.5 0 t3.5 0" stroke={ac} strokeWidth={S} />
  </>),
  verdictInconclusive: (<>
    <path d="M12 2.5 L20 7 V17 L12 21.5 L4 17 V7 Z" stroke={cc} strokeWidth={SH} />
    <circle cx="8.5" cy="12.5" r="0.9" fill={ac} />
    <circle cx="12" cy="12.5" r="0.9" fill={cc} />
    <circle cx="15.5" cy="12.5" r="0.9" fill={cc} />
  </>),
  // utility
  export: (<><path d="M12 3.5 v11 M8 11 l4 4 l4 -4" stroke={cc} strokeWidth={S} /><path d="M5 16 v3 h14 v-3" stroke={ac} strokeWidth={S} /></>),
  import: (<><path d="M12 14.5 v-11 M8 7 l4 -4 l4 4" stroke={cc} strokeWidth={S} /><path d="M5 16 v3 h14 v-3" stroke={ac} strokeWidth={S} /></>),
  sync: (<><path d="M5 12 a7 7 0 0 1 12 -4.5 M19 12 a7 7 0 0 1 -12 4.5" stroke={cc} strokeWidth={S} /><path d="M17 4 v3.5 h-3.5 M7 20 v-3.5 h3.5" stroke={ac} strokeWidth={S} /></>),
  camera: (<><rect x="3.5" y="7" width="17" height="12" rx="2.5" stroke={cc} strokeWidth={S} /><path d="M9 7 l1.5 -2.5 h3 L15 7" stroke={cc} strokeWidth={S} /><circle cx="12" cy="13" r="3" stroke={ac} strokeWidth={S} /></>),
  bolt: (<><path d="M13 3 L6 13 h5 l-1 8 l8 -11 h-5 z" stroke={cc} strokeWidth={S} /><circle cx="13" cy="3" r="0.9" fill={ac} /></>),
  shield: (<><path d="M12 3.5 l7 2.5 v5 q0 6 -7 9.5 q-7 -3.5 -7 -9.5 V6 z" stroke={cc} strokeWidth={S} /><path d="M9 12 l2 2 l4 -4.5" stroke={ac} strokeWidth={S} /></>),
  check: (<><path d="M5 12.5 l4 4 l10 -10" stroke={ac} strokeWidth={SH} /></>),
  cross: (<><path d="M6 6 l12 12 M18 6 l-12 12" stroke={ac} strokeWidth={SH} /></>),
};

export interface OIconProps {
  name: OIconName;
  size?: number;
  color?: string; // body color (currentColor source)
  accent?: string; // the single accent
  title?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function OIcon({ name, size = 22, color, accent, title, style, className }: OIconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      className={className}
      role={title ? "img" : undefined} aria-hidden={title ? undefined : true}
      style={{ color: color ?? "currentColor", strokeLinecap: "round", strokeLinejoin: "round", flexShrink: 0, ["--oi-accent" as string]: accent ?? "#F8B544", ...style } as React.CSSProperties}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}

/** Map a critic id → its OIcon name (replaces the emoji in critics.ts). */
export const CRITIC_ICON: Record<string, OIconName> = {
  conservation: "criticConservation",
  artifact: "criticArtifact",
  worstcase: "criticWorstCase",
  parsimony: "criticParsimony",
  baserate: "criticBaseRate",
  contrarian: "criticContrarian",
};

/** Map a verdict code → its OIcon name + the accent color it overrides to. */
export const VERDICT_ICON: Record<string, OIconName> = {
  PASS: "verdictPass",
  DEFECT: "verdictDefect",
  CONDEMN: "verdictCondemn",
  "SAFETY HOLD": "verdictHold",
  MINOR: "verdictMinor",
  INCONCLUSIVE: "verdictInconclusive",
};
