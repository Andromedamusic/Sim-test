/* ════════════════════════════════════════════════════════════════════════════
   CORE CONFIG — named constants that were magic numbers in the prototype.
   Centralised so the Dyno harness can sweep them and so every threshold is
   auditable. Defaults reproduce the validated prototype behaviour exactly.
   ════════════════════════════════════════════════════════════════════════════ */

export const PHYSICS = {
  /** nominal source V_RMS */
  VS: 120,
  /** default meter input impedance (Fluke 117 / 87V) */
  Z_DEFAULT: 10e6,
  /** °C/W terminal → nylon faceplate */
  RTH_FACE: 5,
  /** °C/W terminal → enclosed box air */
  RTH_TERM: 12,
  /** sentinel "very large" used for open circuits in signatures */
  BIG: 1e9,
} as const;

export const INFERENCE = {
  /** likelihood floor added to gaussian so a single miss never hard-zeros a hypothesis */
  GAUSS_FLOOR: 0.02,
  /** continuity (log-domain) likelihood floor */
  GCONT_FLOOR: 0.05,
  /** σ used when comparing log10(ohms) for continuity */
  GCONT_LOG_SIGMA: 1.4,
  /** floor applied to σ to avoid divide-by-zero */
  SIGMA_FLOOR: 0.01,
  /** default era prior when a fault has no row for the era */
  DEFAULT_ERA_PRIOR: 0.1,
} as const;

/** Behavioural-evidence likelihood multipliers (ported verbatim from prototype). */
export const BEHAVIOR = {
  FRITTING_MATCH: 1.6,
  FRITTING_MISS: 0.5,
  FRITTING_FALSE_MATCH: 0.6, // observed false, fault expects fritting
  THERMAL_NONE: 0.55, // hotspot observed but fault predicts none
  THERMAL_GENERIC: 1.3, // fault thermal is both/varies/terminal
  THERMAL_EXACT: 1.7, // exact slot match
  THERMAL_WRONG: 0.6,
  WIGGLE_MATCH: 1.8,
  WIGGLE_MISS: 0.7,
  AFCI_MATCH: 1.8,
  AFCI_MISS: 0.75,
  GFCI_MATCH: 1.9,
  GFCI_MISS: 0.8,
  COLLAPSE_MATCH: 2.2, // V_HN collapsed under load & fault collapses
  COLLAPSE_MISS: 0.4,
  NG_RISE_MATCH: 1.9, // V_NG rose under load & fault.ngLoad
  NG_RISE_MISS: 0.6,
  /** hard metadata gate: fault requires Al but wire isn't Al */
  AL_GATE: 0.04,
} as const;

export const CRITICS = {
  /** Conservation: V_HG this far below V_HN (with low V_NG) ⇒ ground floats */
  HG_FLOAT_DELTA: 25,
  /** Conservation: "low" V_NG ceiling for the float test */
  VNG_LOW_CEIL: 5,
  /** Conservation: "all dead" voltage ceiling */
  DEAD_CEIL: 10,
  /** Artifact: phantom-voltage band on V_HG */
  PHANTOM_LO: 3,
  PHANTOM_HI: 70,
  /** Artifact: discounted weight applied to a phantom V_HG reading */
  PHANTOM_VHG_WEIGHT: 0.55,
  /** Artifact: open-neutral meter-loading band on V_HN */
  OPEN_NEU_LO: 110,
  OPEN_NEU_HI: 122,
  PHANTOM_VHN_WEIGHT: 0.8,
  /** Artifact: Lo-Z meter advisory threshold (Ω) */
  LOZ_THRESHOLD: 1e5,
  /** Worst-Case: V_NG above this ⇒ energised neutral slot, demand earth-ref test */
  ENERGIZED_NG: 100,
  /** Worst-Case: V_NG below this with no confirmed ground ⇒ bootleg signature */
  BOOTLEG_NG: 0.6,
  /** Parsimony: penalty base, applied as BASE^(nFaults-1) */
  PARSIMONY_BASE: 0.45,
  /** Conservation veto multiplier */
  VETO_FACTOR: 1e-3,
  /** Contrarian: challenge MAP if margin below this AND 2nd above CONTRARIAN_2ND */
  CONTRARIAN_MARGIN: 3,
  CONTRARIAN_2ND: 0.08,
  CONTRARIAN_BOOST: 1.15,
} as const;

export const CONFIDENCE = {
  W_ENTROPY: 0.6,
  W_MARGIN: 0.25,
  W_AGREEMENT: 0.15,
  MARGIN_CAP: 6,
  AGREEMENT_CHALLENGED: 0.55,
  AGREEMENT_HOLD: 0.5,
  AGREEMENT_CLEAR: 0.85,
  MIN: 0.05,
  MAX: 0.98,
  /** verdict: PASS requires healthy MAP above this confidence */
  PASS_CONF: 0.6,
} as const;

export const SAFETY = {
  /**
   * Asymmetric-safety hardening: the engine may only AFFIRMATIVELY CLEAR (PASS)
   * an outlet when a real equipment ground is confirmed (hasGroundWire===true),
   * bootleg is explicitly ruled out, or a ground→earth reference test passed.
   * Bootleg ground is indistinguishable from healthy on voltage alone, so a
   * "healthy" reading with an unconfirmed ground is downgraded to SAFETY HOLD
   * ("verify ground") rather than cleared. Never produces a lethal false-clear.
   */
  REQUIRE_GROUND_CONFIRM_TO_PASS: true,
} as const;

export const PROGNOSIS = {
  /** activation energy for Cu-oxide growth (eV) */
  EA_EV: 0.7,
  /** Boltzmann constant (eV/K) */
  K_EV: 8.617e-5,
  /** insulation/plastic runaway threshold (°C) */
  RUNAWAY_C: 150,
} as const;

export const NBT = {
  /** hypotheses below this posterior mass are dropped from info-gain estimate */
  SURVIVING_MASS: 0.03,
  /** additive safety boost weight for tests that exclude lethal faults */
  LETHAL_BOOST: 0.8,
} as const;
