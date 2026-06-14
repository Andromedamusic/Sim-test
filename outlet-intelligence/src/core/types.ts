/* ════════════════════════════════════════════════════════════════════════════
   CORE TYPES — framework-free. No React, no DOM. Shared by the engine, the
   Dyno harness, the persistence layer, and (later) the dashboard.
   ════════════════════════════════════════════════════════════════════════════ */

// ─── Construction era (keys MUST match FAULTS basePrior rows) ──────────────────
export type Era = "Pre-1990" | "1990-2000" | "2000-2010" | "2010+" | "Unknown";
export const ERAS: Era[] = ["Pre-1990", "1990-2000", "2000-2010", "2010+", "Unknown"];

export type WireMaterial = "Copper" | "Aluminum" | "Unknown";
export type ThermalSlot = "none" | "H-slot" | "N-slot" | "both" | "terminal" | "varies";

// ─── Observation set (what the technician measured) ───────────────────────────
// Field names mirror the validated engine prototype exactly. Values may be a raw
// form string, a number, or null/"". "" / null / NaN are treated as NO EVIDENCE,
// never as zero — a missing reading must not look like a measured 0 V.
export type Reading = string | number | null | undefined;
export interface Observation {
  VHN?: Reading; // no-load hot→neutral V
  VHG?: Reading; // no-load hot→ground V
  VNG?: Reading; // no-load neutral→ground V
  VHG_loz?: Reading; // Lo-Z hot→ground V
  VNG_loz?: Reading; // Lo-Z neutral→ground V
  vhnLoaded?: Reading; // loaded hot→neutral (collapse test)
  vngLoaded?: Reading; // loaded neutral→ground (rise test)
  dropV?: Reading; // loaded voltage drop V
  loadW?: Reading; // applied load watts
  Gcont?: Reading; // ground continuity Ω ("OL"/Infinity = open)
  // behavioural / boolean evidence (null = unknown)
  frittingObs?: boolean | null;
  thermalSlot?: ThermalSlot;
  wiggleObs?: boolean | null;
  afciTrip?: boolean | null;
  gfciTrip?: boolean | null;
  hasGroundWire?: boolean | null;
  groundRefTested?: boolean | null;
  bootlegRuledOut?: boolean;
  hasGroundWireLoaded?: boolean;
  reversePolarity?: boolean | null;
}

/** Internal normalised view used by the likelihood functions (the FAULTS sig keys). */
export interface NormObs {
  VHN: number | null;
  VHG: number | null;
  VNG: number | null;
  Gcont: number | null;
  drop: number | null;
}

// ─── Site / device metadata (sets priors & artifact interpretation) ───────────
export interface Meta {
  era: Era;
  wireMat: WireMaterial;
  meter: string;
  meterZ: number; // meter input impedance Ω
  gauge?: string;
  topology?: string;
  boxType?: string;
}

// ─── Fault library entry ──────────────────────────────────────────────────────
export type SigPair = [mean: number, sigma: number];
export interface FaultSig {
  VHN: SigPair;
  VHG: SigPair;
  VNG: SigPair;
  Gcont: SigPair;
  drop: SigPair;
}

export interface Fault {
  id: string;
  name: string;
  sev: number; // 0–10
  lethal: boolean;
  energizedGnd: boolean;
  nFaults: number; // compound count → parsimony penalty
  nec: string;
  color: string;
  sig: FaultSig;
  // behavioural flags
  fritting?: boolean;
  needsLoad?: boolean;
  collapses?: boolean;
  thermal?: ThermalSlot | "varies" | "terminal";
  ngLoad?: boolean;
  wiggle?: boolean;
  afciTrips?: boolean;
  gfciTrips?: boolean;
  defeatsTester?: boolean;
  reqAl?: boolean;
  allDead?: boolean;
  distributed?: boolean;
  discriminator: string;
  remedy: string;
  basePrior: Record<Era, number>;
}

// ─── Inference products ───────────────────────────────────────────────────────
export type Posterior = Record<string, number>; // faultId → probability [0,1]
export type ArtifactWeights = Partial<Record<"VHN" | "VHG" | "VNG", number>>;

export type VerdictCode =
  | "SAFETY HOLD"
  | "PASS"
  | "CONDEMN"
  | "DEFECT"
  | "MINOR"
  | "INCONCLUSIVE";

export interface Critic {
  id: string;
  name: string;
  role: string;
  power: string;
  icon: string;
  color: string;
  args: string[];
  confidence: number;
  veto?: string[];
  weights?: ArtifactWeights;
  penalty?: Record<string, number>;
  hold?: boolean;
  demand?: string[];
  modal?: string;
  deferred?: boolean;
}

export interface TribunalResult {
  post: Posterior;
  critics: Critic[];
  ranked: Array<[string, number]>;
  confidence: number;
  verdict: string; // full verdict label
  verdictCode: VerdictCode;
  vColor: string;
  topFault: string;
  hold: boolean;
  demand: string[];
  H: number; // entropy (bits)
  margin: number;
}

export interface TestRecommendation {
  id: string;
  label: string;
  field: string;
  gain: number;
}

export interface PrognoseResult {
  P: number; // dissipated power W
  Tterm: number; // steady terminal temp °C
  months: number; // est. time to runaway
  status: string;
  sColor: string;
  runaway: boolean;
}
