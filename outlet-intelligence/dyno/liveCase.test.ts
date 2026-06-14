/* ════════════════════════════════════════════════════════════════════════════
   LIVE_CASE — real outlet diagnosed across a prior session.
   1995 construction, copper, Fluke 117 (10MΩ): V_HN 116, V_HG 15, V_NG 0.5,
   continuity fritting-decay 33→4→0.3Ω.
   Ground truth: intermittent OPEN GROUND (MAP); high-R ground SUPPRESSED because
   V_HG is LOW (phantom), not normal. Thermal camera blind. Do NOT clear.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from "vitest";
import { tribunal, type Observation, type Meta } from "../src/core";

const LIVE_OBS: Observation = {
  VHN: 116, VHG: 15, VNG: 0.5, Gcont: 0.3, frittingObs: true, thermalSlot: "none",
};
const LIVE_META: Meta = { era: "1990-2000", wireMat: "Copper", meter: "Fluke 117", meterZ: 10e6 };

describe("LIVE_CASE: 1995 copper outlet — open ground with fritting", () => {
  const r = tribunal(LIVE_OBS, LIVE_META);

  it("MAP fault is the intermittent open-ground (fritting) hypothesis", () => {
    expect(r.topFault).toBe("open_ground_frit");
  });

  it("high-R ground is SUPPRESSED (conservation veto: V_HG is low, not normal)", () => {
    expect(r.post["high_r_ground"] ?? 0).toBeLessThan(0.02);
  });

  it("Artifact critic flags V_HG as phantom and discounts it", () => {
    const art = r.critics.find((c) => c.id === "artifact")!;
    expect(art.weights?.VHG).toBeLessThan(1);
    expect(art.args.join(" ")).toMatch(/PHANTOM/i);
  });

  it("verdict CONDEMNs the outlet (sev-8 open ground) — never PASS", () => {
    expect(r.verdictCode).toBe("CONDEMN");
    expect(r.verdictCode).not.toBe("PASS");
  });

  it("confidence is decisive, not inconclusive", () => {
    expect(r.verdictCode).not.toBe("INCONCLUSIVE");
    expect(r.confidence).toBeGreaterThan(0.55);
  });

  it("safety posture holds even with NO continuity reading (volt-meter only)", () => {
    const partial: Observation = { VHN: 116, VHG: 15, VNG: 0.5, frittingObs: true };
    const rp = tribunal(partial, LIVE_META);
    expect(["open_ground_frit", "open_ground_cont"]).toContain(rp.topFault);
    expect(rp.verdictCode).not.toBe("PASS");
  });
});
