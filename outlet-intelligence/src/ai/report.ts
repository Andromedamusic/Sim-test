/* ════════════════════════════════════════════════════════════════════════════
   AI SECOND-OPINION — ADVISORY ONLY. The deterministic engine is load-bearing
   and never depends on this. We package the evidence + full critic transcript
   into a portable report the user can paste into Claude (works offline, no key),
   and offer an optional live API call when a key is configured + online.
   ════════════════════════════════════════════════════════════════════════════ */
import { FAULTS, type Observation, type Meta, type TribunalResult } from "../core";

export interface Escalation {
  eligible: boolean;
  reason: "critic_deadlock" | "no_strong_fit" | "safety_hold" | "confident" ;
  detail: string;
}

/** Decide whether to OFFER an escalation (never auto-fires). */
export function escalationEligibility(r: TribunalResult): Escalation {
  const top = r.ranked[0]?.[1] ?? 0;
  if (r.margin < 3 && (r.ranked[1]?.[1] ?? 0) > 0.08)
    return { eligible: true, reason: "critic_deadlock", detail: `Top two hypotheses are close (margin ${r.margin.toFixed(1)}×).` };
  if (top < 0.35)
    return { eligible: true, reason: "no_strong_fit", detail: `No hypothesis fits well (leading ${(top * 100).toFixed(0)}%).` };
  if (r.hold)
    return { eligible: true, reason: "safety_hold", detail: "A safety hold is active; a second opinion may help plan the next test." };
  return { eligible: false, reason: "confident", detail: "Engine is confident; second opinion optional." };
}

function fmtObs(obs: Observation): string {
  const rows: Array<[string, unknown]> = [
    ["V Hot→Neutral", obs.VHN], ["V Hot→Ground", obs.VHG], ["V Neutral→Ground", obs.VNG],
    ["V H→G (Lo-Z)", obs.VHG_loz], ["Ground continuity Ω", obs.Gcont], ["Loaded V drop", obs.dropV],
    ["Loaded V_HN", obs.vhnLoaded], ["Loaded V_NG", obs.vngLoaded], ["Load W", obs.loadW],
    ["Fritting decay?", obs.frittingObs], ["Thermal hotspot", obs.thermalSlot], ["Wiggle-sensitive?", obs.wiggleObs],
    ["AFCI trips?", obs.afciTrip], ["GFCI trips?", obs.gfciTrip], ["Real ground wire?", obs.hasGroundWire],
    ["Gnd-pin→earth tested?", obs.groundRefTested],
  ];
  return rows.filter(([, v]) => v !== "" && v !== null && v !== undefined).map(([k, v]) => `- ${k}: ${v}`).join("\n");
}

/** Portable markdown report — paste into Claude.ai; works with zero API key. */
export function buildShareableReport(obs: Observation, meta: Meta, r: TribunalResult, location?: string): string {
  const ranked = r.ranked.slice(0, 5).map(([k, p]) => `- ${FAULTS[k]?.name ?? k}: ${(p * 100).toFixed(1)}%${FAULTS[k]?.lethal ? " ⚠ LETHAL" : ""}`).join("\n");
  const critics = r.critics.filter((c) => c.args.length).map((c) =>
    `### ${c.name} — ${c.power}\n${c.args.map((a) => `- ${a}`).join("\n")}`).join("\n\n");
  const esc = escalationEligibility(r);
  return [
    `# Outlet Diagnostic — Second-Opinion Request`,
    location ? `**Location:** ${location}` : "",
    `**Context:** ${meta.era} construction · ${meta.wireMat} wiring · meter ${meta.meter} (${(meta.meterZ / 1e6).toFixed(0)}MΩ)`,
    ``,
    `## Deterministic verdict`,
    `**${r.verdict}** · confidence ${(r.confidence * 100).toFixed(0)}% · entropy ${r.H.toFixed(2)} bits · margin ${r.margin.toFixed(1)}×`,
    r.hold ? `\n> SAFETY HOLD demands:\n${r.demand.map((d) => `> - ${d}`).join("\n")}` : "",
    ``,
    `## Measurements`,
    fmtObs(obs) || "_none entered_",
    ``,
    `## Posterior (top 5)`,
    ranked,
    ``,
    `## Critic transcript`,
    critics,
    ``,
    `## Why escalate`,
    `${esc.reason} — ${esc.detail}`,
    ``,
    `---`,
    `Please suggest any NOVEL or COMPOUND fault hypotheses not in the list above, reason from the evidence, and flag any safety concern. This is advisory — it does not override the deterministic safety verdict.`,
  ].filter((l) => l !== "").join("\n");
}

// ─── Optional live API call (only when a key is configured + online) ──────────
export interface LLMAdvisory {
  text: string;
  modelId: string;
  generatedAt: string;
}

export async function callClaude(apiKey: string, report: string, model = "claude-opus-4-8"): Promise<LLMAdvisory> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: "You are an expert electrical diagnostician reviewing structured field evidence. The deterministic engine has low confidence or a critic deadlock. Your role is ADVISORY ONLY — do not override the safety verdict. Suggest novel/compound fault hypotheses, reason from the evidence, and flag safety concerns.",
      messages: [{ role: "user", content: report }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.content ?? []).map((b: { text?: string }) => b.text ?? "").join("\n");
  return { text, modelId: data.model ?? model, generatedAt: new Date().toISOString() };
}

export async function isOnline(): Promise<boolean> {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
