/* Shared design tokens (single source of truth — no Tailwind compile step). */
export const C = {
  bg: "#0A0A0C",
  panel: "#16161A",
  panel2: "#1E1E24",
  border: "#2E2E36",
  text: "#E4E4E7",
  dim: "#71717A",
  dimmer: "#52525B",
  amber: "#F59E0B",
  good: "#22C55E",
  warn: "#FBBF24",
  bad: "#EF4444",
  danger: "#DC2626",
  blue: "#60A5FA",
};

export const mono = '"SF Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

/** Health grade → colour, used across map + dashboard. */
export const GRADE_COLOR: Record<string, string> = {
  GREEN: "#22C55E",
  YELLOW: "#FBBF24",
  AMBER: "#F97316",
  RED: "#DC2626",
};

/** Verdict code → colour. */
export const VERDICT_COLOR: Record<string, string> = {
  "SAFETY HOLD": "#DC2626",
  CONDEMN: "#DC2626",
  DEFECT: "#F59E0B",
  MINOR: "#FBBF24",
  PASS: "#22C55E",
  INCONCLUSIVE: "#9CA3AF",
};

export const btn = (color: string, outline = false): React.CSSProperties => ({
  background: outline ? "transparent" : color,
  color: outline ? color : "#0A0A0C",
  border: `1px solid ${color}`,
  borderRadius: 7,
  padding: "8px 13px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: mono,
  minHeight: 38,
});
