/* ════════════════════════════════════════════════════════════════════════════
   LIKELIHOOD primitives + small numeric helpers.
   A missing reading ("" / null / undefined / NaN) returns likelihood 1 — i.e.
   NO EVIDENCE, never evidence of zero. This is the load-bearing safety property
   that keeps partial measurements from accidentally "clearing" a hypothesis.
   ════════════════════════════════════════════════════════════════════════════ */
import { INFERENCE } from "./config";
import type { Reading, Posterior } from "./types";

/** True iff a reading carries usable numeric information. */
export function hasValue(v: Reading): boolean {
  if (v === null || v === undefined || v === "") return false;
  const x = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(x) || /^ol$|^open$|^inf/i.test(String(v).trim());
}

/** Parse a reading to a number; "OL"/"open"/"inf" → Infinity; junk → null. */
export function num(v: Reading): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (/^ol$|^open$|^inf(inity)?$/i.test(s)) return Infinity;
  const x = typeof v === "number" ? v : parseFloat(s);
  return Number.isFinite(x) ? x : null;
}

/** Gaussian likelihood with a small floor so one outlier never hard-zeros a fault. */
export function gaussLik(obs: Reading, mean: number, sigma: number): number {
  if (obs === null || obs === undefined || obs === "") return 1; // no info
  const o = typeof obs === "number" ? obs : parseFloat(String(obs));
  if (!Number.isFinite(o)) return 1; // no info (incl. "OL" for voltage fields)
  const z = (o - mean) / Math.max(sigma, INFERENCE.SIGMA_FLOOR);
  return Math.exp(-0.5 * z * z) + INFERENCE.GAUSS_FLOOR;
}

/** Log-domain continuity likelihood (resistances span many decades). */
export function gcontLik(obs: Reading, mean: number): number {
  const o = num(obs);
  if (o === null) return 1; // no info
  const og = Math.log10(Math.max(o, 0.01));
  const eg = Math.log10(Math.max(mean, 0.01));
  const zz = (og - eg) / INFERENCE.GCONT_LOG_SIGMA;
  return Math.exp(-0.5 * zz * zz) + INFERENCE.GCONT_FLOOR;
}

// ─── distribution helpers ─────────────────────────────────────────────────────
export function normalize(w: Record<string, number>): Posterior {
  let s = 0;
  for (const k in w) s += w[k];
  const out: Posterior = {};
  const n = Object.keys(w).length || 1;
  for (const k in w) out[k] = s > 0 && Number.isFinite(s) ? w[k] / s : 1 / n;
  return out;
}

export function entropy(w: Posterior): number {
  let h = 0;
  for (const k in w) {
    const p = w[k];
    if (p > 1e-9) h -= p * Math.log2(p);
  }
  return h;
}

export function topN(w: Posterior, n: number): Array<[string, number]> {
  return Object.entries(w)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}
