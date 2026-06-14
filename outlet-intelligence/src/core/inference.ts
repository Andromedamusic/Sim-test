/* ════════════════════════════════════════════════════════════════════════════
   rawPosterior — forward signature × era prior, artifact-weighted.
   Ported verbatim from the prototype; behaviour preserved so the LIVE_CASE and
   fault-bench golden tests reproduce the validated engine.
   ════════════════════════════════════════════════════════════════════════════ */
import { FAULTS, FK } from "./faults";
import { gaussLik, gcontLik, num, normalize } from "./likelihood";
import { BEHAVIOR, INFERENCE } from "./config";
import type { Observation, Meta, ArtifactWeights, Posterior } from "./types";

export function rawPosterior(
  obs: Observation,
  meta: Meta,
  artifactWeights?: ArtifactWeights,
  priorScale?: Record<string, number>,
): Posterior {
  const aw = artifactWeights || {};
  const w: Record<string, number> = {};

  for (const k of FK) {
    const f = FAULTS[k];
    const s = f.sig;
    let L = 1;

    // Voltage likelihoods — exponentiated by per-reading artifact reliability
    L *= Math.pow(gaussLik(obs.VHN, s.VHN[0], s.VHN[1]), aw.VHN ?? 1);
    L *= Math.pow(gaussLik(obs.VHG, s.VHG[0], s.VHG[1]), aw.VHG ?? 1);
    L *= Math.pow(gaussLik(obs.VNG, s.VNG[0], s.VNG[1]), aw.VNG ?? 1);

    // Continuity (log-domain)
    if (num(obs.Gcont) !== null) L *= gcontLik(obs.Gcont, s.Gcont[0]);

    // Loaded drop
    if (num(obs.dropV) !== null) L *= gaussLik(obs.dropV, s.drop[0], s.drop[1]);

    // Fritting match
    if (obs.frittingObs === true) L *= f.fritting ? BEHAVIOR.FRITTING_MATCH : BEHAVIOR.FRITTING_MISS;
    if (obs.frittingObs === false) L *= f.fritting ? BEHAVIOR.FRITTING_FALSE_MATCH : 1.0;

    // Thermal slot match
    if (obs.thermalSlot && obs.thermalSlot !== "none") {
      const want = f.thermal;
      if (!want) L *= BEHAVIOR.THERMAL_NONE;
      else if (want === "both" || want === "varies" || want === "terminal") L *= BEHAVIOR.THERMAL_GENERIC;
      else if (want === obs.thermalSlot) L *= BEHAVIOR.THERMAL_EXACT;
      else L *= BEHAVIOR.THERMAL_WRONG;
    }

    // Wiggle / AFCI / GFCI behavioural evidence
    if (obs.wiggleObs === true) L *= f.wiggle ? BEHAVIOR.WIGGLE_MATCH : BEHAVIOR.WIGGLE_MISS;
    if (obs.afciTrip === true) L *= f.afciTrips ? BEHAVIOR.AFCI_MATCH : BEHAVIOR.AFCI_MISS;
    if (obs.gfciTrip === true) L *= f.gfciTrips ? BEHAVIOR.GFCI_MATCH : BEHAVIOR.GFCI_MISS;

    // Loaded V_HN collapse (open-neutral signature)
    const vhnL = num(obs.vhnLoaded);
    if (vhnL !== null) {
      const collapsed = vhnL < 60;
      if (collapsed) L *= f.collapses ? BEHAVIOR.COLLAPSE_MATCH : BEHAVIOR.COLLAPSE_MISS;
      else L *= f.collapses ? BEHAVIOR.COLLAPSE_MISS : 1.0;
    }

    // Loaded V_NG rise (neutral-backstab signature)
    const vngL = num(obs.vngLoaded);
    if (vngL !== null) {
      const rise = vngL > 5;
      if (rise) L *= f.ngLoad ? BEHAVIOR.NG_RISE_MATCH : BEHAVIOR.NG_RISE_MISS;
    }

    // Hard metadata gates
    if (f.reqAl && meta.wireMat !== "Aluminum") L *= BEHAVIOR.AL_GATE;
    if (obs.hasGroundWire === false && k === "healthy") L *= 0.5;

    // Prior from era, optionally scaled by locally-learned ground-truth (active learning)
    const prior = (f.basePrior[meta.era] ?? INFERENCE.DEFAULT_ERA_PRIOR) * (priorScale?.[k] ?? 1);
    w[k] = L * prior;
  }

  return normalize(w);
}
