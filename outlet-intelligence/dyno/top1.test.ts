/* ════════════════════════════════════════════════════════════════════════════
   TOP-1 / TOP-3 ACCURACY.
   Electrically-distinct faults must be recovered with high top-1 accuracy.
   Several faults are DELIBERATELY degenerate (bootleg ground mimics healthy;
   reverse-bootleg is identical to reversed-polarity without an earth-ref test;
   high-R ground / Al-Cu / long-run overlap their families). Those are handled by
   the safety layer + top-3 containment, not by a confident MAP — asserting a
   high top-1 on them would be dishonest. Keyed on the posterior, reseeded noise.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from "vitest";
import { tribunal, type Posterior } from "../src/core";
import { sampleCase, ALL_FAULTS, type Completeness } from "./syntheticCase";

const N = 50;
const topK = (post: Posterior, k: number) =>
  Object.entries(post).sort((a, b) => b[1] - a[1]).slice(0, k).map(([id]) => id);

// Faults whose signatures are electrically distinct enough to pin down a MAP.
const DISTINCT = [
  "reversed_pol", "open_neutral", "open_hot", "loose_arc",
  "backstab_hot", "backstab_neu", "open_ground_cont", "open_ground_frit",
];

function fleet(completeness: Completeness) {
  let c1 = 0, c3 = 0, tot = 0;
  const per: Record<string, number> = {};
  for (const fault of ALL_FAULTS) {
    let f1 = 0;
    for (let seed = 0; seed < N; seed++) {
      const { obs, meta } = sampleCase(fault, completeness, seed * 7 + 1);
      const r = tribunal(obs, meta);
      if (r.topFault === fault.id) { c1++; f1++; }
      if (topK(r.post, 3).includes(fault.id)) c3++;
      tot++;
    }
    per[fault.id] = f1 / N;
  }
  return { top1: c1 / tot, top3: c3 / tot, per };
}

describe("TOP-1 / TOP-3 ACCURACY", () => {
  const full = fleet(1.0);

  it("each electrically-distinct fault recovers with top-1 ≥ 0.78", () => {
    for (const id of DISTINCT) expect(full.per[id]).toBeGreaterThanOrEqual(0.78);
  });

  it("fleet top-1 ≫ chance (≥ 0.5 vs 1/16 = 0.06)", () => {
    expect(full.top1).toBeGreaterThanOrEqual(0.5);
  });

  it("fleet top-3 containment ≥ 0.70 (degenerate faults still surface)", () => {
    expect(full.top3).toBeGreaterThanOrEqual(0.7);
  });

  it("accuracy degrades gracefully: full ≥ 40%-completeness", () => {
    expect(full.top1).toBeGreaterThanOrEqual(fleet(0.4).top1 - 1e-9);
  });
});
