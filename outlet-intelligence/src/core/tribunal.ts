/* ════════════════════════════════════════════════════════════════════════════
   TRIBUNAL — adjudicates the critic ensemble into a single posterior + verdict.
   Order: artifact-discounted posterior → conservation vetoes → parsimony →
   contrarian boost → confidence(entropy, margin, agreement) → verdict overlay.
   Ported verbatim from the prototype.
   ════════════════════════════════════════════════════════════════════════════ */
import { FAULTS, FK } from "./faults";
import { rawPosterior } from "./inference";
import { runCritics } from "./critics";
import { normalize, entropy, topN, num } from "./likelihood";
import { CRITICS, CONFIDENCE, SAFETY } from "./config";
import type { Observation, Meta, TribunalResult, Posterior, VerdictCode } from "./types";

export interface TribunalOpts {
  /** per-fault prior multipliers from locally-learned ground truth (active learning). */
  priorScale?: Record<string, number>;
}

export function tribunal(obs: Observation, meta: Meta, opts?: TribunalOpts): TribunalResult {
  const critics = runCritics(obs, meta);
  const artifact = critics.find((c) => c.id === "artifact")!;
  const conservation = critics.find((c) => c.id === "conservation")!;
  const worstcase = critics.find((c) => c.id === "worstcase")!;
  const parsimony = critics.find((c) => c.id === "parsimony")!;

  // 1. base posterior with artifact-discounted weights (+ optional learned prior scale)
  let post: Posterior = rawPosterior(obs, meta, artifact.weights, opts?.priorScale);
  // 2. conservation vetoes
  for (const v of conservation.veto || []) post[v] = (post[v] || 0) * CRITICS.VETO_FACTOR;
  // 3. parsimony penalty
  for (const k of FK) post[k] = (post[k] || 0) * (parsimony.penalty?.[k] ?? 1);
  post = normalize(post);

  // 4. CONTRARIAN — attack the current MAP
  const ranked0 = topN(post, FK.length);
  const map = ranked0[0], second = ranked0[1];
  const contrarian = critics.find((c) => c.id === "contrarian")!;
  const cargs: string[] = [];
  let challengeBoosted = false;
  if (map && second) {
    const margin = map[1] / Math.max(second[1], 1e-6);
    if (margin < CRITICS.CONTRARIAN_MARGIN && second[1] > CRITICS.CONTRARIAN_2ND) {
      cargs.push(`Leading "${FAULTS[map[0]].name}" (${(map[1] * 100).toFixed(0)}%) is NOT decisively ahead of "${FAULTS[second[0]].name}" (${(second[1] * 100).toFixed(0)}%). Margin ${margin.toFixed(1)}× < ${CRITICS.CONTRARIAN_MARGIN}×. Premature to converge.`);
      cargs.push("Discriminating test required to separate them — see next-best-test. Boosting challenger weight for visibility.");
      post[second[0]] *= CRITICS.CONTRARIAN_BOOST;
      challengeBoosted = true;
    } else {
      cargs.push(`Leading "${FAULTS[map[0]].name}" survives challenge — ${margin.toFixed(1)}× ahead of nearest alternative "${FAULTS[second[0]].name}". Convergence justified.`);
    }
  }
  contrarian.args = cargs;
  if (challengeBoosted) post = normalize(post);

  // 5. confidence from margin × critic agreement
  const r2 = topN(post, 3);
  const margin = r2[0] ? r2[0][1] / Math.max((r2[1] && r2[1][1]) || 0.001, 0.001) : 1;
  const H = entropy(post);
  const Hmax = Math.log2(FK.length);
  const agreement = challengeBoosted ? CONFIDENCE.AGREEMENT_CHALLENGED : worstcase.hold ? CONFIDENCE.AGREEMENT_HOLD : CONFIDENCE.AGREEMENT_CLEAR;
  const confRaw = (1 - H / Hmax) * CONFIDENCE.W_ENTROPY + Math.min(margin / CONFIDENCE.MARGIN_CAP, 1) * CONFIDENCE.W_MARGIN + agreement * CONFIDENCE.W_AGREEMENT;
  const confidence = Math.max(CONFIDENCE.MIN, Math.min(CONFIDENCE.MAX, confRaw));

  // 6. verdict + safety overlay
  const topFault = r2[0] ? r2[0][0] : "healthy";
  const f = FAULTS[topFault];

  // Asymmetric-safety: a "healthy" reading cannot be CLEARED while ANY lethal
  // mode is un-excluded by evidence. The two lethal modes that can hide behind
  // healthy-looking readings are bootleg ground (mimics healthy on a meter) and
  // reversed polarity (invisible unless V_HG/V_NG or polarity is checked). A
  // would-be PASS lacking those exclusions is downgraded to SAFETY HOLD.
  const wouldPass = topFault === "healthy" && confidence > CONFIDENCE.PASS_CONF;
  const vngE = num(obs.VNG), vhgE = num(obs.VHG);
  const bootlegExcluded = obs.hasGroundWire === true || obs.bootlegRuledOut === true || obs.groundRefTested === true;
  const polarityExcluded =
    obs.reversePolarity === false ||
    obs.groundRefTested === true ||
    (vngE !== null && vngE < 90) || // reversed/​reverse-bootleg drive V_NG ≈ 120
    (vhgE !== null && vhgE > 30); //   reversed drives V_HG ≈ 0
  const lethalExcluded = bootlegExcluded && polarityExcluded;
  const passBlocked = SAFETY.REQUIRE_GROUND_CONFIRM_TO_PASS && wouldPass && !lethalExcluded;
  if (passBlocked) {
    worstcase.hold = true;
    const demands = worstcase.demand ? [...worstcase.demand] : [];
    if (!bootlegExcluded) demands.push("Confirm a REAL equipment-ground conductor (rule out bootleg ground). Bootleg ground reads identical to a healthy outlet on a meter and defeats a 3-light tester.");
    if (!polarityExcluded) demands.push("Confirm polarity: measure V_HG (≈120V normal) and V_NG (≈0V normal), or a polarity tester. Reversed polarity is invisible to a V_HN-only check.");
    worstcase.demand = demands;
    worstcase.args.push("Voltages look healthy, but a lethal mode (bootleg ground and/or reversed polarity) cannot be excluded from the evidence taken. Refusing to CLEAR until it is ruled out.");
  }
  const hold = worstcase.hold === true;

  let verdict: string, vColor: string, verdictCode: VerdictCode;
  if (hold) { verdict = "SAFETY HOLD — do not clear"; vColor = "#DC2626"; verdictCode = "SAFETY HOLD"; }
  else if (topFault === "healthy" && confidence > CONFIDENCE.PASS_CONF) { verdict = "PASS — outlet healthy"; vColor = "#22C55E"; verdictCode = "PASS"; }
  else if (f.sev >= 8) { verdict = "CONDEMN — replace immediately"; vColor = "#DC2626"; verdictCode = "CONDEMN"; }
  else if (f.sev >= 5) { verdict = "DEFECT — remediate"; vColor = "#F59E0B"; verdictCode = "DEFECT"; }
  else if (f.sev >= 1) { verdict = "MINOR — monitor / advise"; vColor = "#FBBF24"; verdictCode = "MINOR"; }
  else { verdict = "INCONCLUSIVE — gather data"; vColor = "#9CA3AF"; verdictCode = "INCONCLUSIVE"; }

  return { post, critics, ranked: r2, confidence, verdict, verdictCode, vColor, topFault, hold, demand: worstcase.demand || [], H, margin };
}
