import { describe, it, expect } from "vitest";
import { priorScaleFromCounts, referenceBaseFreq, FK, tribunal, type Meta } from "../src/core";

const META: Meta = { era: "1990-2000", wireMat: "Copper", meter: "Fluke 117", meterZ: 10e6 };

describe("active learning — Dirichlet prior recalibration", () => {
  it("zero counts → no adjustment (sparse empty map)", () => {
    expect(Object.keys(priorScaleFromCounts({})).length).toBe(0);
  });
  it("repeated confirmations raise that fault's prior scale above 1", () => {
    expect(priorScaleFromCounts({ backstab_hot: 10 })["backstab_hot"]).toBeGreaterThan(1);
  });
  it("scales stay bounded [0.3, 5] under extreme counts", () => {
    const s = priorScaleFromCounts({ alcu_oxide: 5000 });
    for (const k of FK) if (s[k] !== undefined) {
      expect(s[k]).toBeGreaterThanOrEqual(0.3);
      expect(s[k]).toBeLessThanOrEqual(5);
    }
  });
  it("reference base frequencies sum to 1", () => {
    const sum = Object.values(referenceBaseFreq()).reduce((a, x) => a + x, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
  it("learned priors NEVER produce a lethal false-clear", () => {
    // Even with a wildly mis-learned prior favouring 'healthy', an un-confirmed
    // ground must not PASS (asymmetric safety is independent of priors).
    const obs = { VHN: 120, VHG: 120, VNG: 0.4 };
    const learned = tribunal(obs, META, { priorScale: { healthy: 5 } });
    expect(learned.verdictCode).not.toBe("PASS");
  });
});
