/* ════════════════════════════════════════════════════════════════════════════
   PUBLIC API — the dependency-free diagnostic engine.
   Import this from the UI, the Dyno harness, a CLI, or a future dashboard.
   No React, no DOM, no I/O.
   ════════════════════════════════════════════════════════════════════════════ */
export * from "./types";
export * from "./spatial";
export { EXPORT_VERSION } from "./spatial";
export { FAULTS, FK, LETHAL_FAULTS, validateFaults } from "./faults";
export { PHYSICS, INFERENCE, BEHAVIOR, CRITICS, CONFIDENCE, PROGNOSIS, NBT } from "./config";
export { gaussLik, gcontLik, num, hasValue, normalize, entropy, topN } from "./likelihood";
export { rawPosterior } from "./inference";
export { runCritics } from "./critics";
export { tribunal, type TribunalOpts } from "./tribunal";
export { nextBestTests, CANDIDATE_TESTS } from "./nextBestTest";
export { prognose } from "./prognose";
export { rollupHome, outletRisk } from "./rollup";

import { tribunal, type TribunalOpts } from "./tribunal";
import { nextBestTests } from "./nextBestTest";
import type { Observation, Meta } from "./types";

/** Engine semantic version — stamped onto persisted results & exports. */
export const ENGINE_VERSION = "1.1.0";

/** Convenience: full per-outlet analysis (verdict + ranked next tests). */
export function analyzeOutlet(obs: Observation, meta: Meta, opts?: TribunalOpts) {
  const result = tribunal(obs, meta, opts);
  const nbt = nextBestTests(obs, meta, result.post);
  return { ...result, nextBestTests: nbt, engineVersion: ENGINE_VERSION };
}
