/* ════════════════════════════════════════════════════════════════════════════
   FAILURE PROGNOSIS — Arrhenius thermal-cycling model.
   P = I²R heats the terminal; oxide growth (Ea≈0.7eV) accelerates with temp,
   raising R further — positive feedback toward runaway above ~150°C.
   ════════════════════════════════════════════════════════════════════════════ */
import { PHYSICS, PROGNOSIS } from "./config";
import type { PrognoseResult } from "./types";

export function prognose(R_term: number, loadA: number, ambientC: number): PrognoseResult {
  // Guard: negative or NaN R_term (invalid sensor data) must never produce
  // negative P or a misleadingly-cool Tterm that masks a real hazard.
  const R = Math.max(0, Number.isFinite(R_term) ? R_term : 0);
  const P = loadA * loadA * R;
  const Tterm = ambientC + P * PHYSICS.RTH_TERM;

  const Tk = Tterm + 273.15;
  const rate = Math.exp(-PROGNOSIS.EA_EV / (PROGNOSIS.K_EV * Tk)) * 1e9; // relative hazard
  const margin = PROGNOSIS.RUNAWAY_C - Tterm;
  let months = margin <= 0 ? 0 : (margin / Math.max(rate, 0.01)) * 0.4;
  months = Math.max(0, Math.min(months, 240));

  const status = Tterm > 120 ? "RUNAWAY IMMINENT" : Tterm > 90 ? "ACCELERATED DEGRADATION" : Tterm > 60 ? "ELEVATED — MONITOR" : "STABLE";
  const sColor = Tterm > 120 ? "#DC2626" : Tterm > 90 ? "#F97316" : Tterm > 60 ? "#FBBF24" : "#22C55E";

  return {
    P: +P.toFixed(1),
    Tterm: +Tterm.toFixed(0),
    months: +months.toFixed(0),
    status,
    sColor,
    runaway: Tterm > 120,
  };
}
