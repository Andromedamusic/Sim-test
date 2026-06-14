/* ════════════════════════════════════════════════════════════════════════════
   THE SIX CRITIC AGENTS — autonomous evaluation modules.
   Conservation VETOes impossible faults; Artifact DISCOUNTS deceptive readings;
   Worst-Case raises a SAFETY HOLD on un-excluded lethal faults; Parsimony
   penalises compound faults; Base-Rate anchors to era; Contrarian (deferred,
   filled by the Tribunal) challenges a premature MAP.
   ════════════════════════════════════════════════════════════════════════════ */
import { FAULTS, FK } from "./faults";
import { num, topN } from "./likelihood";
import { PHYSICS, CRITICS } from "./config";
import type { Observation, Meta, Critic } from "./types";

const VS = PHYSICS.VS;

export function runCritics(obs: Observation, meta: Meta): Critic[] {
  const meterZ = meta.meterZ;
  const critics: Critic[] = [];

  // 1. CONSERVATION — veto physically impossible hypotheses ────────────────────
  {
    const args: string[] = [];
    let veto: string[] = [];
    const vhn = num(obs.VHN), vhg = num(obs.VHG), vng = num(obs.VNG);
    if (vhn !== null && vhg !== null && vhg < vhn - CRITICS.HG_FLOAT_DELTA && vng !== null && vng < CRITICS.VNG_LOW_CEIL) {
      veto.push("healthy"); veto.push("high_r_ground");
      args.push(`V_HG (${vhg}V) ≪ V_HN (${vhn}V) with normal V_NG → ground floats. VETO healthy & high-R ground (both require V_HG≈V_HN on a ${(meterZ / 1e6).toFixed(0)}MΩ meter).`);
    }
    if (vng !== null && vng > CRITICS.ENERGIZED_NG && vhg !== null && vhg < 10) {
      args.push(`V_NG≈${vng}V + V_HG≈${vhg}V is the reversed-polarity / reverse-bootleg topology (N-slot energized). Conservation CONSISTENT.`);
    }
    if (vhn !== null && vhn < CRITICS.DEAD_CEIL && vhg !== null && vhg < CRITICS.DEAD_CEIL && vng !== null && vng < CRITICS.DEAD_CEIL) {
      veto = FK.filter((k) => k !== "open_hot");
      args.push("All three voltages ≈0V → only open-hot (or upstream loss) is physically consistent.");
    }
    if (!args.length) args.push("No conservation violations detected. All hypotheses physically admissible.");
    critics.push({ id: "conservation", name: "Conservation Critic", role: "Physics validator", power: "VETO", icon: "⚖️", color: "#60A5FA", args, veto, confidence: veto.length ? 0.95 : 0.7 });
  }

  // 2. ARTIFACT — discount deceptive readings ──────────────────────────────────
  {
    const args: string[] = [];
    const weights: Record<"VHN" | "VHG" | "VNG", number> = { VHN: 1, VHG: 1, VNG: 1 };
    const vhg = num(obs.VHG), vhn = num(obs.VHN);
    if (vhg !== null && vhg > CRITICS.PHANTOM_LO && vhg < CRITICS.PHANTOM_HI && obs.hasGroundWireLoaded !== true) {
      const Zc = (meterZ * (VS - vhg)) / Math.max(vhg, 0.1);
      const cap = (1 / (2 * Math.PI * 60 * Zc)) * 1e12;
      weights.VHG = CRITICS.PHANTOM_VHG_WEIGHT;
      args.push(`V_HG=${vhg}V on ${(meterZ / 1e6).toFixed(0)}MΩ meter ⇒ ~${(Zc / 1e6).toFixed(1)}MΩ series (≈${cap.toFixed(0)}pF coupling). PHANTOM-SUSPECT — discount V_HG weight to ${CRITICS.PHANTOM_VHG_WEIGHT} until loaded/Lo-Z confirm.`);
    }
    if (obs.frittingObs === true) {
      args.push("Continuity DECAY observed (a-spot oxide breakdown). Final low Ω is NOT a stable connection — meter wetting current frits the film. Treat continuity as UNRELIABLE; condemn connection regardless of final value.");
    }
    if (vhn !== null && vhn > CRITICS.OPEN_NEU_LO && vhn < CRITICS.OPEN_NEU_HI && num(obs.vhnLoaded) === null) {
      args.push(`V_HN=${vhn}V at no-load cannot distinguish healthy from OPEN NEUTRAL (meter ${(meterZ / 1e6).toFixed(0)}MΩ provides phantom path). LOADED retest mandatory before clearing.`);
      weights.VHN = CRITICS.PHANTOM_VHN_WEIGHT;
    }
    if (meterZ < CRITICS.LOZ_THRESHOLD) args.push(`Lo-Z/analog meter (${(meterZ / 1e3).toFixed(0)}kΩ) suppresses phantom voltages — V_HG readings here are MORE trustworthy as real connections.`);
    if (!args.length) args.push("No artifact signatures. Readings taken at face value.");
    critics.push({ id: "artifact", name: "Artifact Critic", role: "Measurement skeptic", power: "DISCOUNT", icon: "🔬", color: "#A78BFA", args, weights, confidence: 0.8 });
  }

  // 3. WORST-CASE — safety hold on un-excluded lethal faults ────────────────────
  {
    const args: string[] = [];
    let hold = false;
    const demand: string[] = [];
    const vng = num(obs.VNG);
    const groundRefTested = obs.groundRefTested === true;
    if (vng !== null && vng > CRITICS.ENERGIZED_NG && !groundRefTested) {
      hold = true;
      demand.push("Independent-earth reference test: measure ground pin → known external earth (water pipe/ground rod). If ≈120V = reverse-bootleg = LETHAL.");
      args.push(`V_NG≈${vng}V means the wide slot is energized. Until ground pin is checked against TRUE earth, reverse-bootleg (energized ground, sev 10) is NOT ruled out. SAFETY HOLD — do not clear.`);
    }
    if (vng !== null && vng < CRITICS.BOOTLEG_NG && obs.hasGroundWire === false && !obs.bootlegRuledOut) {
      hold = true;
      demand.push("Verify a real equipment-ground conductor exists (not a neutral-to-ground jumper). Inspect device rear.");
      args.push(`V_NG≈0V with NO confirmed ground wire = BOOTLEG GROUND signature. A 3-light tester would read 'correct' here. SAFETY HOLD until physical ground verified.`);
    }
    if (!hold) args.push("No un-excluded lethal hypothesis. Asymmetric-loss check passed for current evidence.");
    else args.push("Asymmetric loss: clearing a lethal outlet is catastrophic; condemning a good one is cheap. Erring toward condemnation.");
    critics.push({ id: "worstcase", name: "Worst-Case Critic", role: "Safety adversary", power: "SAFETY HOLD", icon: "☠️", color: "#F87171", args, hold, demand, confidence: 0.9 });
  }

  // 4. PARSIMONY — Occam penalty on compound faults ────────────────────────────
  {
    const penalty: Record<string, number> = {};
    for (const k of FK) {
      const n = FAULTS[k].nFaults;
      penalty[k] = n >= 2 ? Math.pow(CRITICS.PARSIMONY_BASE, n - 1) : 1;
    }
    const args = [`Applying Occam penalty ${CRITICS.PARSIMONY_BASE}^(nFaults−1) to compound hypotheses (backstab-both, reverse-bootleg, Al-Cu). Single-fault explanations preferred until evidence forces multiplicity.`];
    critics.push({ id: "parsimony", name: "Parsimony Critic", role: "Occam enforcer", power: "PENALTY", icon: "🪒", color: "#34D399", args, penalty, confidence: 0.65 });
  }

  // 5. BASE-RATE — era anchor ───────────────────────────────────────────────────
  {
    const args: string[] = [];
    const era = meta.era;
    const modal = topN(Object.fromEntries(FK.map((k) => [k, FAULTS[k].basePrior[era] ?? 0.1])), 1)[0];
    args.push(`Era "${era}": modal failure is "${FAULTS[modal[0]].name}" (base rate ${(modal[1] * 100).toFixed(0)}%). ${era === "1990-2000" || era === "Pre-1990" ? "Backstab-era construction — terminations are the prior suspect." : "Modern construction — termination failures less likely; favor wiring/installation faults."}`);
    if (meta.wireMat === "Aluminum") args.push("ALUMINUM branch wiring present → Al-Cu oxidation base rate elevated sharply.");
    critics.push({ id: "baserate", name: "Base-Rate Critic", role: "Epidemiologist", power: "ANCHOR", icon: "📊", color: "#FBBF24", args, modal: modal[0], confidence: 0.7 });
  }

  // 6. CONTRARIAN — deferred; filled by the Tribunal against the posterior ──────
  critics.push({ id: "contrarian", name: "Contrarian Critic", role: "Red team", power: "CHALLENGE", icon: "🔥", color: "#FB923C", args: [], confidence: 0.6, deferred: true });

  return critics;
}
