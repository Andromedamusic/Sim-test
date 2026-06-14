/* ════════════════════════════════════════════════════════════════════════════
   CALIBRATION — when the engine says it is X% confident in its MAP, it should be
   right about X% of the time. Reported as Expected Calibration Error (ECE) over
   confidence bins. This guards against over-confident verdicts.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from "vitest";
import { tribunal } from "../src/core";
import { sampleCase, ALL_FAULTS, COMPLETENESS_LEVELS } from "./syntheticCase";

const N = 20;

function computeECE(samples: Array<{ conf: number; correct: boolean }>, bins = 10): number {
  const buckets = Array.from({ length: bins }, () => ({ n: 0, conf: 0, correct: 0 }));
  for (const s of samples) {
    const idx = Math.min(bins - 1, Math.floor(s.conf * bins));
    buckets[idx].n++;
    buckets[idx].conf += s.conf;
    buckets[idx].correct += s.correct ? 1 : 0;
  }
  let ece = 0;
  const total = samples.length;
  for (const b of buckets) {
    if (b.n === 0) continue;
    const acc = b.correct / b.n;
    const conf = b.conf / b.n;
    ece += (b.n / total) * Math.abs(acc - conf);
  }
  return ece;
}

describe("CALIBRATION", () => {
  const samples: Array<{ conf: number; correct: boolean }> = [];
  for (const fault of ALL_FAULTS) {
    for (const c of COMPLETENESS_LEVELS) {
      for (let seed = 0; seed < N; seed++) {
        const { obs, meta } = sampleCase(fault, c, seed * 13 + 5);
        const r = tribunal(obs, meta);
        samples.push({ conf: r.confidence, correct: r.topFault === fault.id });
      }
    }
  }

  it("Expected Calibration Error is bounded (< 0.20)", () => {
    expect(computeECE(samples)).toBeLessThan(0.2);
  });
});
