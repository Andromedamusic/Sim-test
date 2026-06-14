/* ════════════════════════════════════════════════════════════════════════════
   SAFETY RECALL — the non-negotiable regression gate.
   A lethal fault must NEVER be affirmatively CLEARED (PASS), at ANY measurement
   completeness, across many reseeded partial-measurement subsets. Type-II error
   (clearing a lethal outlet) is catastrophic; this asserts it cannot happen.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from "vitest";
import { FAULTS, LETHAL_FAULTS, tribunal } from "../src/core";
import { sampleCase, COMPLETENESS_LEVELS } from "./syntheticCase";

const N_SEEDS = 40;

describe("SAFETY RECALL — lethal faults are never cleared", () => {
  for (const fid of LETHAL_FAULTS) {
    const fault = FAULTS[fid];
    for (const c of COMPLETENESS_LEVELS) {
      it(`${fid} @ completeness=${c}: zero false-clears over ${N_SEEDS} seeds`, () => {
        let falseClears = 0;
        for (let seed = 0; seed < N_SEEDS; seed++) {
          const { obs, meta } = sampleCase(fault, c, seed);
          const r = tribunal(obs, meta);
          // A lethal-planted case must never come back PASS.
          if (r.verdictCode === "PASS") falseClears++;
        }
        expect(falseClears).toBe(0);
      });
    }
  }

  it("a genuinely healthy outlet with a CONFIRMED ground CAN pass (no over-blocking)", () => {
    const r = tribunal(
      { VHN: 120, VHG: 120, VNG: 0.4, Gcont: 0.4, hasGroundWire: true },
      { era: "2010+", wireMat: "Copper", meter: "Fluke 117", meterZ: 10e6 },
    );
    expect(r.verdictCode).toBe("PASS");
  });

  it("the same healthy readings WITHOUT ground confirmation are held, not cleared", () => {
    const r = tribunal(
      { VHN: 120, VHG: 120, VNG: 0.4 },
      { era: "2010+", wireMat: "Copper", meter: "Fluke 117", meterZ: 10e6 },
    );
    expect(r.verdictCode).not.toBe("PASS");
  });
});
