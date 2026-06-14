/* ════════════════════════════════════════════════════════════════════════════
   SYNTHETIC CASE GENERATOR — for each fault, sample its signature with noise,
   set behavioural ground-truth, then optionally DROP fields to simulate a
   partial measurement. The engine must recover the planted fault.
   ════════════════════════════════════════════════════════════════════════════ */
import { FAULTS, PHYSICS } from "../src/core";
import type { Observation, Meta, Fault, Era } from "../src/core";
import { mulberry32, gauss } from "./rng";

export type Completeness = 0.2 | 0.4 | 0.6 | 0.8 | 1.0;

export interface SyntheticCase {
  faultId: string;
  obs: Observation;
  meta: Meta;
  completeness: Completeness;
  seed: number;
  keptFields: string[];
}

// fields that can be present/dropped, in rough order of how commonly a tech takes them
const OPTIONAL_FIELDS = [
  "VHG", "VNG", "Gcont", "dropV", "vhnLoaded", "vngLoaded",
  "thermalSlot", "frittingObs", "hasGroundWire", "wiggleObs", "afciTrip", "gfciTrip", "groundRefTested",
] as const;

/** Does a real equipment ground exist? (bootleg & open-ground variants: no) */
function groundWireTruth(f: Fault): boolean {
  return !(f.id === "bootleg_gnd" || f.id === "reverse_bootleg" || f.id === "open_ground_cont" || f.id === "open_ground_frit");
}

function sampleVolt(rand: () => number, pair: [number, number]): number {
  return Math.max(0, +gauss(rand, pair[0], pair[1]).toFixed(1));
}

export function sampleCase(
  fault: Fault,
  completeness: Completeness,
  seed: number,
  metaOverride: Partial<Meta> = {},
): SyntheticCase {
  const rand = mulberry32(seed + hashId(fault.id));
  const s = fault.sig;

  // ── full ground-truth observation ──────────────────────────────────────────
  const full: Observation = {
    VHN: sampleVolt(rand, s.VHN),
    VHG: sampleVolt(rand, s.VHG),
    VNG: sampleVolt(rand, s.VNG),
    Gcont: s.Gcont[0] >= PHYSICS.BIG ? "OL" : Math.max(0.01, +gauss(rand, s.Gcont[0], s.Gcont[1]).toFixed(2)),
    dropV: sampleVolt(rand, s.drop),
    thermalSlot: fault.thermal ? (fault.thermal === "varies" ? "both" : (fault.thermal as Observation["thermalSlot"])) : "none",
    frittingObs: bernoulli(rand, fault.fritting ? 0.9 : 0.05),
    wiggleObs: bernoulli(rand, fault.wiggle ? 0.9 : 0.05),
    afciTrip: bernoulli(rand, fault.afciTrips ? 0.9 : 0.05),
    gfciTrip: bernoulli(rand, fault.gfciTrips ? 0.9 : 0.05),
    hasGroundWire: groundWireTruth(fault),
    // loaded behaviour
    vhnLoaded: fault.collapses ? sampleVolt(rand, [8, 6]) : sampleVolt(rand, [s.VHN[0] - (fault.needsLoad ? +s.drop[0] : 0), 3]),
    vngLoaded: fault.ngLoad ? sampleVolt(rand, [28, 6]) : sampleVolt(rand, s.VNG),
    groundRefTested: fault.energizedGnd ? false : false, // earth-ref not done by default
    reversePolarity: fault.id === "reversed_pol",
  };

  // ── decide which optional fields survive (VHN always kept) ──────────────────
  const nKeep = Math.max(1, Math.round(completeness * OPTIONAL_FIELDS.length));
  const shuffled = seededShuffle([...OPTIONAL_FIELDS], rand);
  const kept = new Set<string>(["VHN", ...shuffled.slice(0, nKeep)]);

  const obs: Observation = { VHN: full.VHN };
  for (const k of OPTIONAL_FIELDS) {
    if (kept.has(k)) (obs as Record<string, unknown>)[k] = (full as Record<string, unknown>)[k];
  }
  if (!kept.has("thermalSlot")) obs.thermalSlot = "none";

  const meta: Meta = {
    era: pickEra(fault, rand),
    wireMat: fault.reqAl ? "Aluminum" : "Copper",
    meter: "Fluke 117",
    meterZ: PHYSICS.Z_DEFAULT,
    ...metaOverride,
  };

  return { faultId: fault.id, obs, meta, completeness, seed, keptFields: [...kept] };
}

// ── helpers ───────────────────────────────────────────────────────────────────
function bernoulli(rand: () => number, p: number): boolean {
  return rand() < p;
}
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function seededShuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function pickEra(fault: Fault, rand: () => number): Era {
  const eras = Object.entries(fault.basePrior) as [Era, number][];
  const total = eras.reduce((a, [, p]) => a + p, 0);
  let r = rand() * total;
  for (const [era, p] of eras) {
    r -= p;
    if (r <= 0) return era;
  }
  return "Unknown";
}

export const COMPLETENESS_LEVELS: Completeness[] = [0.2, 0.4, 0.6, 0.8, 1.0];
export const ALL_FAULTS: Fault[] = Object.values(FAULTS);
