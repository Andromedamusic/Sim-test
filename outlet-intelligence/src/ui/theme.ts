/* Shared design tokens — cooled toward a cinematic "command-center" palette.
   Existing keys preserved so every view re-skins cohesively without edits. */
export const C = {
  bg: "#070A10",        // deep installation black-navy
  panel: "#0D131D",     // panel slate
  panel2: "#131B28",
  border: "#202C3D",
  text: "#E6EDF6",
  dim: "#8190A6",
  dimmer: "#56627A",
  amber: "#F8B544",
  good: "#34D399",
  warn: "#FBBF24",
  bad: "#F87171",
  danger: "#EF4444",
  blue: "#39BDF8",      // holographic cyan
};

export const mono = '"SF Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

/** Halo-grade HUD design system (used by the chrome, backdrop, PiP, panels). */
export const HUD = {
  void: "#04060B",
  abyss: "#070B12",
  panel: "#0B121C",
  panelHi: "#10192696",
  glass: "rgba(13,21,34,0.62)",
  line: "#1B2636",
  lineHi: "#27374D",
  cyan: "#39BDF8",
  cyanDeep: "#0EA5E9",
  ice: "#BFE6FF",
  indigo: "#818CF8",
  amber: "#F8B544",
  text: "#E6EDF6",
  dim: "#8190A6",
  dimmer: "#56627A",
};

export const holoGrad = "linear-gradient(135deg,#39BDF8 0%,#818CF8 100%)";
export const amberGrad = "linear-gradient(135deg,#F8B544 0%,#F97316 100%)";
export const glow = (c: string, a = 0.55): string => `0 0 24px -6px ${c}, 0 0 1px ${c}`;

/** Health grade → colour, used across map + dashboard. */
export const GRADE_COLOR: Record<string, string> = {
  GREEN: "#34D399",
  YELLOW: "#FBBF24",
  AMBER: "#F97316",
  RED: "#EF4444",
};

/** Verdict code → colour. */
export const VERDICT_COLOR: Record<string, string> = {
  "SAFETY HOLD": "#EF4444",
  CONDEMN: "#EF4444",
  DEFECT: "#F8B544",
  MINOR: "#FBBF24",
  PASS: "#34D399",
  INCONCLUSIVE: "#94A3B8",
};

export const btn = (color: string, outline = false): React.CSSProperties => ({
  background: outline ? "transparent" : color,
  color: outline ? color : "#04060B",
  border: `1px solid ${color}`,
  borderRadius: 8,
  padding: "8px 13px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: mono,
  minHeight: 38,
});
