/* ════════════════════════════════════════════════════════════════════════════
   ACTIVE LEARNING — Dirichlet-multinomial prior recalibration.
   Confirmed ground-truth outcomes are multinomial counts over faults. With a
   base-rate-weighted Dirichlet prior, the posterior-mean local frequency / the
   reference base frequency gives a per-fault prior scale. Zero data → all 1
   (no change); as the local housing stock is sampled, priors shift toward what
   is actually being found here. Bounded, smooth, and self-correcting.
   ════════════════════════════════════════════════════════════════════════════ */
import { FAULTS, FK } from "./faults";
import { ERAS } from "./types";

export interface LearningConfig {
  /** Dirichlet strength as a multiple of the fault count (≈ observations to move). */
  pseudocount?: number;
  min?: number;
  max?: number;
}

/** Reference base frequency per fault: era-averaged basePrior, normalized to sum 1. */
export function referenceBaseFreq(): Record<string, number> {
  const raw: Record<string, number> = {};
  let s = 0;
  for (const k of FK) {
    const f = FAULTS[k];
    const avg = ERAS.reduce((a, e) => a + (f.basePrior[e] ?? 0), 0) / ERAS.length;
    raw[k] = avg;
    s += avg;
  }
  const out: Record<string, number> = {};
  for (const k of FK) out[k] = s > 0 ? raw[k] / s : 1 / FK.length;
  return out;
}

/**
 * Derive per-fault prior multipliers from confirmation counts.
 * `scale[k] = posteriorMeanFreq(k) / baseFreq(k)`, clamped. Only entries that
 * differ meaningfully from 1 are returned (sparse).
 */
export function priorScaleFromCounts(counts: Record<string, number>, cfg: LearningConfig = {}): Record<string, number> {
  const a = cfg.pseudocount ?? 0.5;
  const min = cfg.min ?? 0.3;
  const max = cfg.max ?? 5;
  const base = referenceBaseFreq();
  const N = FK.length;
  const pseudo = a * N; // total Dirichlet pseudo-observations, spread by base rate
  let total = 0;
  for (const k of FK) total += Math.max(0, counts[k] ?? 0);

  const scale: Record<string, number> = {};
  for (const k of FK) {
    const localFreq = ((counts[k] ?? 0) + pseudo * base[k]) / (total + pseudo);
    const s = localFreq / Math.max(base[k], 1e-6);
    if (Math.abs(s - 1) > 0.02) scale[k] = Math.max(min, Math.min(max, s));
  }
  return scale;
}
