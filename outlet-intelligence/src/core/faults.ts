/* ════════════════════════════════════════════════════════════════════════════
   FAULT LIBRARY — 17 hypotheses, ported VERBATIM from the validated prototype.
   Each fault: forward signature predictor + era-conditioned prior + severity +
   NEC reference + behavioural flags + discriminator + remedy.
   Standards: NEC 2023, UL 498, ANSI C84.1, NFPA 70.

   DO NOT casually edit the numbers — the Dyno LIVE_CASE and fault-bench golden
   tests are calibrated against these exact values. Run `validateFaults()`.
   ════════════════════════════════════════════════════════════════════════════ */
import type { Fault } from "./types";
import { PHYSICS } from "./config";

const BIG = PHYSICS.BIG;

export const FAULTS: Record<string, Fault> = {
  healthy: {
    id: "healthy", name: "Healthy", sev: 0, lethal: false, energizedGnd: false, nFaults: 0,
    nec: "—", color: "#22C55E",
    sig: { VHN: [120, 7], VHG: [120, 8], VNG: [0.5, 1.8], Gcont: [0.5, 0.8], drop: [1, 1.5] },
    fritting: false, needsLoad: false,
    discriminator: "All readings nominal; loaded drop < 2V confirms.",
    remedy: "No action. Optionally re-test under load to confirm terminations.",
    basePrior: { "Pre-1990": 0.25, "1990-2000": 0.35, "2000-2010": 0.5, "2010+": 0.65, "Unknown": 0.4 },
  },
  open_ground_cont: {
    id: "open_ground_cont", name: "Open Ground (continuous)", sev: 7, lethal: false, energizedGnd: false, nFaults: 1,
    nec: "250.4(A)(3)", color: "#F97316",
    sig: { VHN: [120, 7], VHG: [17, 28], VNG: [0.5, 1.8], Gcont: [BIG, 1], drop: [1, 1.5] },
    fritting: false, needsLoad: false,
    discriminator: "V_HG LOW (phantom, <60V) + G-continuity OPEN + V_NG normal. Low V_HG rules OUT high-R ground.",
    remedy: "Trace ground conductor; repair pigtail/bond. Condemn receptacle. Thermal camera BLIND to this fault.",
    basePrior: { "Pre-1990": 0.3, "1990-2000": 0.18, "2000-2010": 0.1, "2010+": 0.05, "Unknown": 0.15 },
  },
  open_ground_frit: {
    id: "open_ground_frit", name: "Open Ground (intermittent / fritting)", sev: 8, lethal: false, energizedGnd: false, nFaults: 1,
    nec: "250.4(A)(3)", color: "#EA580C",
    sig: { VHN: [120, 7], VHG: [17, 30], VNG: [0.5, 1.8], Gcont: [15, 30], drop: [1, 1.5] },
    fritting: true, needsLoad: false,
    discriminator: "Continuity DECAYS over seconds (33→4→0.3Ω) = oxide a-spot breakdown. Intermittent V_HG. Worse than clean-open (state-dependent).",
    remedy: "Corroded ground termination. Replace device + clean/remake all ground connections. Wiggle test localizes.",
    basePrior: { "Pre-1990": 0.28, "1990-2000": 0.16, "2000-2010": 0.08, "2010+": 0.04, "Unknown": 0.14 },
  },
  high_r_ground: {
    id: "high_r_ground", name: "High-Resistance Ground", sev: 6, lethal: false, energizedGnd: false, nFaults: 1,
    nec: "250.122", color: "#FBBF24",
    sig: { VHN: [120, 7], VHG: [119, 3], VNG: [0.5, 1.8], Gcont: [3000, 4000], drop: [1, 1.5] },
    fritting: false, needsLoad: false,
    discriminator: "V_HG reads ~NORMAL (kΩ still passes µA test current) BUT continuity shows kΩ. Distinct from open ground (which reads LOW V_HG).",
    remedy: "Degraded but continuous ground. Locate high-R junction; remake connection. Marginal fault-clearing capacity.",
    basePrior: { "Pre-1990": 0.12, "1990-2000": 0.1, "2000-2010": 0.07, "2010+": 0.04, "Unknown": 0.08 },
  },
  backstab_hot: {
    id: "backstab_hot", name: "Backstab Failure — Hot", sev: 8, lethal: false, energizedGnd: false, nFaults: 1,
    nec: "110.14(D)", color: "#EF4444",
    sig: { VHN: [120, 7], VHG: [120, 8], VNG: [0.5, 1.8], Gcont: [0.5, 0.8], drop: [5, 4] },
    fritting: false, needsLoad: true, thermal: "H-slot",
    discriminator: "No-load NORMAL. Loaded V_HN drop > 3V. Thermal hotspot at HOT slot. Cold-R may miss it (fails only under thermal expansion).",
    remedy: "Push-in spring contact degraded. Replace with side-wire/clamp device. Pigtail feed-through. FIRE RISK.",
    basePrior: { "Pre-1990": 0.5, "1990-2000": 0.55, "2000-2010": 0.3, "2010+": 0.12, "Unknown": 0.4 },
  },
  backstab_neu: {
    id: "backstab_neu", name: "Backstab Failure — Neutral", sev: 8, lethal: false, energizedGnd: false, nFaults: 1,
    nec: "110.14(D)", color: "#EF4444",
    sig: { VHN: [120, 7], VHG: [120, 8], VNG: [0.6, 1.8], Gcont: [0.5, 0.8], drop: [3, 3] },
    fritting: false, needsLoad: true, thermal: "N-slot", ngLoad: true,
    discriminator: "No-load NORMAL incl. V_NG. Under load: V_NG RISES (I×R_neutral) + thermal at NEUTRAL slot. Invisible to V_HN test alone.",
    remedy: "Neutral spring contact degraded. Replace device, pigtail neutral. FIRE RISK.",
    basePrior: { "Pre-1990": 0.4, "1990-2000": 0.45, "2000-2010": 0.25, "2010+": 0.1, "Unknown": 0.32 },
  },
  backstab_both: {
    id: "backstab_both", name: "Backstab Failure — Both", sev: 9, lethal: false, energizedGnd: false, nFaults: 2,
    nec: "110.14(D)", color: "#DC2626",
    sig: { VHN: [120, 7], VHG: [120, 8], VNG: [0.8, 2], Gcont: [0.5, 0.8], drop: [7, 5] },
    fritting: false, needsLoad: true, thermal: "both", ngLoad: true,
    discriminator: "Both contacts degraded. Large loaded drop + V_NG rise + thermal both slots. Compound — Parsimony penalizes vs single.",
    remedy: "Whole-device contact failure. Replace immediately, pigtail both. SEVERE FIRE RISK.",
    basePrior: { "Pre-1990": 0.2, "1990-2000": 0.22, "2000-2010": 0.1, "2010+": 0.04, "Unknown": 0.15 },
  },
  reversed_pol: {
    id: "reversed_pol", name: "Reversed Polarity", sev: 7, lethal: true, energizedGnd: false, nFaults: 1,
    nec: "200.11", color: "#B91C1C",
    sig: { VHN: [120, 7], VHG: [1.5, 3], VNG: [120, 8], Gcont: [0.5, 0.8], drop: [1, 1.5] },
    fritting: false, needsLoad: false,
    discriminator: "V_HG ≈ 0V (H-slot is neutral) AND V_NG ≈ 120V (N-slot is hot). Magnitude V_HN unchanged = invisible to simple test. Energizes device neutrals/shells.",
    remedy: "Hot/neutral swapped. Correct at device AND verify source wiring. Lamp shells/switch bodies live to ground.",
    basePrior: { "Pre-1990": 0.12, "1990-2000": 0.12, "2000-2010": 0.1, "2010+": 0.08, "Unknown": 0.1 },
  },
  open_neutral: {
    id: "open_neutral", name: "Open Neutral", sev: 8, lethal: false, energizedGnd: false, nFaults: 1,
    nec: "—", color: "#EF4444",
    sig: { VHN: [119, 8], VHG: [120, 8], VNG: [1, 3], Gcont: [0.5, 0.8], drop: [110, 30] },
    fritting: false, needsLoad: true, collapses: true,
    discriminator: "No-load V_HN ~119V (PHANTOM through meter 10MΩ). Under REAL load V_HN COLLAPSES toward 0V. Mandatory loaded retest.",
    remedy: "Open neutral conductor/termination. Trace and repair. MWBC open neutral can over-volt loads — urgent.",
    basePrior: { "Pre-1990": 0.15, "1990-2000": 0.14, "2000-2010": 0.1, "2010+": 0.06, "Unknown": 0.12 },
  },
  open_hot: {
    id: "open_hot", name: "Open Hot", sev: 5, lethal: false, energizedGnd: false, nFaults: 1,
    nec: "—", color: "#FBBF24",
    sig: { VHN: [1, 3], VHG: [1, 3], VNG: [0.5, 2], Gcont: [0.5, 0.8], drop: [0, 1] },
    fritting: false, needsLoad: false, allDead: true,
    discriminator: "All voltage readings near 0V (dead outlet) with breaker ON. Distinguish from tripped breaker / switched outlet first.",
    remedy: "Open hot conductor/breaker/termination. Verify breaker not tripped; check switch leg.",
    basePrior: { "Pre-1990": 0.1, "1990-2000": 0.1, "2000-2010": 0.1, "2010+": 0.1, "Unknown": 0.1 },
  },
  bootleg_gnd: {
    id: "bootleg_gnd", name: "Bootleg Ground ⚠", sev: 9, lethal: true, energizedGnd: false, nFaults: 1,
    nec: "250.142", color: "#DC2626",
    sig: { VHN: [120, 7], VHG: [120, 8], VNG: [0.05, 0.6], Gcont: [0.5, 1.2], drop: [1, 1.5] },
    fritting: false, needsLoad: false, defeatsTester: true,
    discriminator: "Neutral jumpered to ground pin at device. 3-LIGHT TESTER READS 'CORRECT'. Tell: V_NG ≈ EXACTLY 0V + no real ground wire present + pre-grounding-era device. Energizes ground under neutral fault.",
    remedy: "Remove illegal bond. Install real equipment ground or GFCI w/ 'No Equipment Ground' label per 406.4(D).",
    basePrior: { "Pre-1990": 0.22, "1990-2000": 0.12, "2000-2010": 0.05, "2010+": 0.02, "Unknown": 0.12 },
  },
  reverse_bootleg: {
    id: "reverse_bootleg", name: "Reverse-Bootleg Ground ⚠⚠", sev: 10, lethal: true, energizedGnd: true, nFaults: 2,
    nec: "250.142 / 406.4", color: "#991B1B",
    sig: { VHN: [120, 7], VHG: [2, 4], VNG: [120, 9], Gcont: [0.5, 1.2], drop: [1, 1.5] },
    fritting: false, needsLoad: false, defeatsTester: true,
    discriminator: "Bootleg + reversed polarity → GROUND PIN ENERGIZED AT 120V. Slot readings mimic reversed polarity but the GROUND PIN is hot to true earth. Requires independent-earth reference test. LETHAL.",
    remedy: "De-energize immediately. Ground pin is live — do not touch chassis of plugged devices. Full rewire of device + source.",
    basePrior: { "Pre-1990": 0.06, "1990-2000": 0.03, "2000-2010": 0.01, "2010+": 0.005, "Unknown": 0.03 },
  },
  downstream_ng: {
    id: "downstream_ng", name: "Downstream N-G Bond", sev: 6, lethal: false, energizedGnd: false, nFaults: 1,
    nec: "250.24(A)(5)", color: "#FBBF24",
    sig: { VHN: [120, 7], VHG: [120, 8], VNG: [0.2, 1], Gcont: [0.5, 0.8], drop: [1, 1.5] },
    fritting: false, needsLoad: false, gfciTrips: true,
    discriminator: "Neutral-ground bond exists downstream of main. V_NG very low + GFCI TRIPS on this circuit. Parallel neutral path.",
    remedy: "Locate and remove improper N-G bond (often at subpanel or device). Single bond at service only.",
    basePrior: { "Pre-1990": 0.1, "1990-2000": 0.1, "2000-2010": 0.08, "2010+": 0.06, "Unknown": 0.09 },
  },
  long_run: {
    id: "long_run", name: "Marginal Long-Run Voltage Drop", sev: 3, lethal: false, energizedGnd: false, nFaults: 0,
    nec: "210.19 (FPN 3%)", color: "#FCD34D",
    sig: { VHN: [120, 7], VHG: [120, 8], VNG: [1.5, 2], Gcont: [1.2, 1], drop: [5, 3] },
    fritting: false, needsLoad: true, distributed: true,
    discriminator: "Loaded drop 3–8V but NO localized thermal hotspot (distributed I²R along wire). Long circuit / undersized conductor. Not a connection fault.",
    remedy: "Not a defect per se. Consider upsizing conductor or reducing run for sensitive loads. Flag vs 3% recommendation.",
    basePrior: { "Pre-1990": 0.12, "1990-2000": 0.12, "2000-2010": 0.12, "2010+": 0.12, "Unknown": 0.12 },
  },
  loose_arc: {
    id: "loose_arc", name: "Loose Terminal / Arc Precursor", sev: 9, lethal: false, energizedGnd: false, nFaults: 1,
    nec: "110.14(D) / 210.12", color: "#DC2626",
    sig: { VHN: [120, 9], VHG: [120, 9], VNG: [1, 3], Gcont: [0.6, 1], drop: [4, 4] },
    fritting: false, needsLoad: true, thermal: "varies", wiggle: true, afciTrips: true,
    discriminator: "Intermittent. V_HN FLICKERS, responds to WIGGLE/TAP, thermal hotspot, AFCI may trip. Series-arc precursor — thermal >> resistive prediction = arcing.",
    remedy: "Loose connection arcing. Replace device, remake all terminations to torque spec. AFCI protection recommended. FIRE RISK.",
    basePrior: { "Pre-1990": 0.2, "1990-2000": 0.2, "2000-2010": 0.12, "2010+": 0.06, "Unknown": 0.16 },
  },
  alcu_oxide: {
    id: "alcu_oxide", name: "Al-Cu Junction Oxidation", sev: 8, lethal: false, energizedGnd: false, nFaults: 1,
    nec: "110.14 / 406.3(D)", color: "#EF4444",
    sig: { VHN: [120, 8], VHG: [120, 8], VNG: [1, 3], Gcont: [0.8, 1], drop: [5, 4] },
    fritting: false, needsLoad: true, thermal: "terminal", reqAl: true,
    discriminator: "Aluminum branch wiring + Cu device terminal → oxide growth, thermal cycling. Requires ALUMINUM metadata. Thermal + loaded drop. Classic 1965–73 hazard.",
    remedy: "Use AL-CU rated device (CO/ALR) or COPALUM/AlumiConn pigtail. Never bare Al on standard device. FIRE RISK.",
    basePrior: { "Pre-1990": 0.08, "1990-2000": 0.02, "2000-2010": 0.01, "2010+": 0.005, "Unknown": 0.04 },
  },
};

/** Stable ordering of fault keys. */
export const FK: string[] = Object.keys(FAULTS);

/** The only faults that can kill. Safety-recall gate is defined over this set. */
export const LETHAL_FAULTS: string[] = FK.filter((k) => FAULTS[k].lethal);

/**
 * Integrity check run by tests at module load: every signature σ must be > 0 and
 * every fault must carry all five signature keys + an entry for every era.
 */
export function validateFaults(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const eras = ["Pre-1990", "1990-2000", "2000-2010", "2010+", "Unknown"] as const;
  for (const k of FK) {
    const f = FAULTS[k];
    if (f.id !== k) errors.push(`${k}: id mismatch (${f.id})`);
    for (const sk of ["VHN", "VHG", "VNG", "Gcont", "drop"] as const) {
      const pair = f.sig[sk];
      if (!pair || pair.length !== 2) errors.push(`${k}.${sk}: missing sig pair`);
      else if (!(pair[1] > 0)) errors.push(`${k}.${sk}: sigma must be > 0 (got ${pair[1]})`);
    }
    for (const e of eras) {
      if (typeof f.basePrior[e] !== "number") errors.push(`${k}.basePrior[${e}]: missing`);
    }
    if (f.sev < 0 || f.sev > 10) errors.push(`${k}: severity out of range (${f.sev})`);
  }
  return { ok: errors.length === 0, errors };
}
