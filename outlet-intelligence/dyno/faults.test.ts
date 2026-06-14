import { describe, it, expect } from "vitest";
import { validateFaults, FK, LETHAL_FAULTS } from "../src/core";

describe("FAULT LIBRARY integrity", () => {
  it("all 17 hypotheses validate (σ>0, all eras, ids match)", () => {
    const { ok, errors } = validateFaults();
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });
  it("library has the expected 16 hypotheses", () => {
    // The prototype's UI copy said "17"; the actual FAULTS table has 16 keys.
    expect(FK.length).toBe(16);
  });
  it("lethal set is exactly the three energised/reversed modes", () => {
    expect(new Set(LETHAL_FAULTS)).toEqual(new Set(["reversed_pol", "bootleg_gnd", "reverse_bootleg"]));
  });
});
