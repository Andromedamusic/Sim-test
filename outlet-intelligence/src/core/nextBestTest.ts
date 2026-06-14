/* ════════════════════════════════════════════════════════════════════════════
   NEXT-BEST-TEST — expected information gain over surviving hypotheses, with a
   safety boost for tests that exclude lethal faults. Ported from the prototype.
   ════════════════════════════════════════════════════════════════════════════ */
import { FAULTS } from "./faults";
import { topN } from "./likelihood";
import { NBT } from "./config";
import type { Observation, Meta, Posterior, TestRecommendation } from "./types";

export const CANDIDATE_TESTS = [
  { id: "VHG", label: "Measure V Hot→Ground", field: "VHG" },
  { id: "VNG", label: "Measure V Neutral→Ground", field: "VNG" },
  { id: "dropV", label: "Loaded voltage-drop test", field: "dropV" },
  { id: "vhnLoaded", label: "V_HN under load (collapse?)", field: "vhnLoaded" },
  { id: "vngLoaded", label: "V_NG under load (rise?)", field: "vngLoaded" },
  { id: "Gcont", label: "Ground continuity (breaker off)", field: "Gcont" },
  { id: "thermal", label: "Thermal scan at 80% load", field: "thermalSlot" },
  { id: "groundRef", label: "Ground pin → true earth ref", field: "groundRefTested" },
  { id: "bootleg", label: "Verify real ground wire exists", field: "hasGroundWire" },
  { id: "wiggle", label: "Wiggle/tap intermittent test", field: "wiggleObs" },
] as const;

const SCALE: Record<string, number> = {
  VHG: 120, VNG: 120, dropV: 8, vhnLoaded: 120, vngLoaded: 30,
  Gcont: 200, thermalSlot: 100, groundRefTested: 120, hasGroundWire: 100, wiggleObs: 100,
};

export function nextBestTests(obs: Observation, _meta: Meta, post: Posterior, n = 4): TestRecommendation[] {
  const surviving = topN(post, 6).filter(([, p]) => p > NBT.SURVIVING_MASS);
  const scored: TestRecommendation[] = [];

  for (const t of CANDIDATE_TESTS) {
    const cur = (obs as Record<string, unknown>)[t.field];
    if (cur !== null && cur !== undefined && cur !== "") continue; // already measured

    const vals: Array<{ v: number; p: number }> = [];
    for (const [k, p] of surviving) {
      const f = FAULTS[k];
      let v = 0;
      if (t.field === "VHG") v = f.sig.VHG[0];
      else if (t.field === "VNG") v = f.sig.VNG[0];
      else if (t.field === "dropV") v = f.sig.drop[0];
      else if (t.field === "vhnLoaded") v = f.collapses ? 0 : 120;
      else if (t.field === "vngLoaded") v = f.ngLoad ? 30 : f.sig.VNG[0];
      else if (t.field === "Gcont") v = Math.log10(Math.max(f.sig.Gcont[0], 0.01)) * 20;
      else if (t.field === "thermalSlot") v = f.thermal ? (f.thermal === "H-slot" ? 100 : f.thermal === "N-slot" ? 50 : 75) : 0;
      else if (t.field === "groundRefTested") v = f.energizedGnd ? 120 : 0;
      else if (t.field === "hasGroundWire") v = f.defeatsTester ? 0 : 100;
      else if (t.field === "wiggleObs") v = f.wiggle ? 100 : 0;
      vals.push({ v, p });
    }

    const pSum = vals.reduce((a, x) => a + x.p, 0) || 1e-6;
    const mean = vals.reduce((a, x) => a + x.v * x.p, 0) / pSum;
    const varr = vals.reduce((a, x) => a + x.p * (x.v - mean) ** 2, 0);
    const spread = Math.sqrt(varr);
    const scale = SCALE[t.field] || 100;
    let gain = spread / scale;

    if (t.id === "groundRef" || t.id === "bootleg") {
      const lethalMass = surviving.filter(([k]) => FAULTS[k].lethal).reduce((a, [, p]) => a + p, 0);
      gain += lethalMass * NBT.LETHAL_BOOST;
    }
    scored.push({ ...t, gain });
  }

  return scored.sort((a, b) => b.gain - a.gain).slice(0, n);
}
