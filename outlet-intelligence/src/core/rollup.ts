/* ════════════════════════════════════════════════════════════════════════════
   HOME-LEVEL ROLLUP — the "centralized intelligence model".
   Aggregates per-outlet posteriors into room / floor / home / circuit health,
   detects SYSTEMIC patterns (upstream / shared-neutral / mis-wired run / era
   cohort), and emits a prioritised remediation list.

   SAFETY-ASYMMETRIC by construction: any un-excluded lethal or SAFETY-HOLD
   outlet hard-pins its room, floor, circuit, and the whole home to RED — it can
   never be averaged away.
   ════════════════════════════════════════════════════════════════════════════ */
import { FAULTS } from "./faults";
import { num } from "./likelihood";
import type {
  HomeModel, OutletNode, OutletHealth, RoomHealth, FloorHealth, CircuitHealth,
  SystemicFlag, RemediationItem, HomeHealth, Grade,
} from "./spatial";

/** Worst-case emphasis: 70% weight on the worst outlet, 30% on the mean. */
const ALPHA = 0.7;
const ALPHA_SHARED_NEUTRAL = 0.85;
const UNOBSERVED_RISK = 0.3; // unknown = moderate, never optimistic
const COVERAGE_PENALTY = 0.2;

function gradeOf(risk: number, forceRed = false): Grade {
  if (forceRed) return "RED";
  if (risk >= 0.7) return "RED";
  if (risk >= 0.4) return "AMBER";
  if (risk >= 0.2) return "YELLOW";
  return "GREEN";
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Per-outlet risk scalar from its cached Tribunal result. */
export function outletRisk(o: OutletNode): OutletHealth {
  const inf = o.inference;
  if (!o.observation || !inf || !inf.ranked.length) {
    return { outletId: o.id, observed: false, risk: UNOBSERVED_RISK, grade: gradeOf(UNOBSERVED_RISK), topFault: null, verdictCode: null, lethal: false, hold: false };
  }
  const top = inf.topFault;
  const f = FAULTS[top];
  const mapProb = inf.ranked[0][1];
  const lethal = !!(f && f.lethal);
  const hold = inf.hold;
  let risk = mapProb * ((f?.sev ?? 0) / 10) * (lethal ? 2 : 1) * (hold ? 1.5 : 1);
  risk = clamp01(risk);
  // safety-asymmetric hard floors
  if (hold) risk = Math.max(risk, 0.85);
  if (lethal && mapProb > 0.05) risk = Math.max(risk, 0.9);
  return {
    outletId: o.id, observed: true, risk,
    grade: gradeOf(risk, hold || (lethal && mapProb > 0.05)),
    topFault: top, verdictCode: inf.verdictCode, lethal, hold,
  };
}

/** α-weighted worst-case aggregate of child risks, with coverage penalty. */
function aggregate(risks: number[], unobserved: number, total: number, alpha = ALPHA): number {
  if (!risks.length) return UNOBSERVED_RISK * (total > 0 ? 1 : 0);
  const worst = Math.max(...risks);
  const mean = risks.reduce((a, b) => a + b, 0) / risks.length;
  const base = alpha * worst + (1 - alpha) * mean;
  const coverage = total > 0 ? COVERAGE_PENALTY * (unobserved / total) : 0;
  return clamp01(base + coverage);
}

// ─── Systemic pattern detectors ───────────────────────────────────────────────
function detectSystemic(model: HomeModel): SystemicFlag[] {
  const flags: SystemicFlag[] = [];
  const byCircuit = new Map<string, OutletNode[]>();
  const byRoom = new Map<string, OutletNode[]>();
  for (const o of model.outlets) {
    if (o.circuitId) (byCircuit.get(o.circuitId) ?? byCircuit.set(o.circuitId, []).get(o.circuitId)!).push(o);
    (byRoom.get(o.roomId) ?? byRoom.set(o.roomId, []).get(o.roomId)!).push(o);
  }

  // P1 — Elevated V_NG across a circuit → upstream / shared-neutral (not device-local)
  for (const [cid, outs] of byCircuit) {
    const elevated = outs.filter((o) => (num(o.observation?.VNG) ?? 0) > 3);
    if (elevated.length >= 2) {
      flags.push({
        type: "ELEVATED_VNG", scope: "circuit", scopeId: cid,
        outletIds: elevated.map((o) => o.id), confidence: 0.8, urgency: "IMMEDIATE",
        description: `${elevated.length} outlets on this circuit show elevated neutral-to-ground voltage (>3V).`,
        remedy: "Fault is likely UPSTREAM (shared-neutral overload or a loose/corroded neutral at the panel), not device-local. Inspect the home-run neutral and panel termination first.",
      });
    }
  }

  // P2 — ≥3 outlets on a circuit share an open-ground MAP → missing EGC upstream
  for (const [cid, outs] of byCircuit) {
    const og = outs.filter((o) => o.inference && (o.inference.topFault === "open_ground_cont" || o.inference.topFault === "open_ground_frit"));
    if (og.length >= 3) {
      flags.push({
        type: "MULTI_OPEN_GROUND", scope: "circuit", scopeId: cid,
        outletIds: og.map((o) => o.id), confidence: 0.75, urgency: "SOON",
        description: `${og.length} outlets on this circuit diagnose as open ground.`,
        remedy: "Equipment grounding conductor likely severed/absent upstream. Check the panel bond and the first junction box on the run before condemning each device.",
      });
    }
  }

  // P3 — ≥2 same-wall outlets both reversed-polarity → mis-wired feed, not devices
  for (const [rid, outs] of byRoom) {
    const byWall = new Map<string, OutletNode[]>();
    for (const o of outs) {
      const rev = o.observation?.reversePolarity === true || o.inference?.topFault === "reversed_pol";
      if (rev) (byWall.get(o.position.wallId) ?? byWall.set(o.position.wallId, []).get(o.position.wallId)!).push(o);
    }
    for (const [, wallOuts] of byWall) {
      if (wallOuts.length >= 2) {
        flags.push({
          type: "WIRING_RUN_REVERSED", scope: "room", scopeId: rid,
          outletIds: wallOuts.map((o) => o.id), confidence: 0.7, urgency: "IMMEDIATE",
          description: `${wallOuts.length} adjacent outlets on the same wall read reversed polarity.`,
          remedy: "The feed to this wall section is likely reversed at a junction, not at each device. Trace the upstream splice.",
        });
      }
    }
  }

  // P4 — Whole room shares one dominant fault → era/cohort artifact
  for (const [rid, outs] of byRoom) {
    const observed = outs.filter((o) => o.inference);
    if (observed.length >= 3) {
      const f0 = observed[0].inference!.topFault;
      if (f0 !== "healthy" && observed.every((o) => o.inference!.topFault === f0)) {
        flags.push({
          type: "ERA_COHORT_FAULT", scope: "room", scopeId: rid,
          outletIds: observed.map((o) => o.id), confidence: 0.6, urgency: "SOON",
          description: `All ${observed.length} measured outlets in this room share the same fault mode (${FAULTS[f0]?.name ?? f0}).`,
          remedy: "Treat as a wiring-era / installation cohort issue rather than coincidental device failures.",
        });
      }
    }
  }

  return flags;
}

// ─── Main entry ───────────────────────────────────────────────────────────────
export function rollupHome(model: HomeModel): HomeHealth {
  const outletHealth = new Map<string, OutletHealth>();
  for (const o of model.outlets) outletHealth.set(o.id, outletRisk(o));

  const systemicFlags = detectSystemic(model);
  const flagByCircuit = new Map<string, SystemicFlag[]>();
  for (const fl of systemicFlags.filter((f) => f.scope === "circuit")) {
    (flagByCircuit.get(fl.scopeId) ?? flagByCircuit.set(fl.scopeId, []).get(fl.scopeId)!).push(fl);
  }

  // Rooms
  const roomHealths: RoomHealth[] = model.rooms.map((r) => {
    const outs = model.outlets.filter((o) => o.roomId === r.id);
    const hs = outs.map((o) => outletHealth.get(o.id)!);
    const unobserved = hs.filter((h) => !h.observed).length;
    const risk = aggregate(hs.map((h) => h.risk), unobserved, outs.length);
    const anyHold = hs.some((h) => h.hold || (h.lethal && h.grade === "RED"));
    const worst = hs.reduce<OutletHealth | null>((a, b) => (!a || b.risk > a.risk ? b : a), null);
    return {
      roomId: r.id, risk, grade: gradeOf(risk, anyHold), worstVerdict: worst?.verdictCode ?? null,
      outletCount: outs.length, unobservedCount: unobserved, outlets: hs,
    };
  });
  const roomById = new Map(roomHealths.map((r) => [r.roomId, r]));

  // Floors
  const floorHealths: FloorHealth[] = model.floors.map((fl) => {
    const rms = model.rooms.filter((r) => r.floorId === fl.id).map((r) => roomById.get(r.id)!).filter(Boolean);
    const anyHold = rms.some((r) => r.grade === "RED" && (r.worstVerdict === "SAFETY HOLD" || r.outlets.some((o) => o.lethal)));
    const risk = aggregate(rms.map((r) => r.risk), 0, rms.length);
    return { floorId: fl.id, risk, grade: gradeOf(risk, anyHold), rooms: rms };
  });

  // Circuits
  const circuitHealths: CircuitHealth[] = model.circuits.map((c) => {
    const outs = model.outlets.filter((o) => o.circuitId === c.id);
    const hs = outs.map((o) => outletHealth.get(o.id)!);
    const flags = flagByCircuit.get(c.id) ?? [];
    const anyHold = hs.some((h) => h.hold || h.lethal) || flags.length > 0;
    const risk = aggregate(hs.map((h) => h.risk), hs.filter((h) => !h.observed).length, outs.length, c.isSharedNeutral ? ALPHA_SHARED_NEUTRAL : ALPHA);
    return { circuitId: c.id, risk, grade: gradeOf(risk, anyHold), outletIds: outs.map((o) => o.id), systemicFlags: flags };
  });

  // Home aggregate
  const allObserved = model.outlets.filter((o) => o.inference).length;
  const placed = model.outlets.length;
  const unclearedLethal = [...outletHealth.values()].filter((h) => h.hold || (h.lethal && h.grade === "RED")).map((h) => h.outletId);
  const safetyHold = unclearedLethal.length > 0;
  const homeRisk = aggregate(floorHealths.map((f) => f.risk), 0, floorHealths.length);

  // Remediation list
  const remediation = buildRemediation(model, outletHealth, systemicFlags);

  return {
    risk: homeRisk,
    grade: gradeOf(homeRisk, safetyHold),
    safetyHold,
    unclearedLethalOutletIds: unclearedLethal,
    inspectionCoverage: placed > 0 ? allObserved / placed : 0,
    floors: floorHealths,
    circuits: circuitHealths,
    systemicFlags,
    remediation,
    computedAt: new Date().toISOString(),
  };
}

function buildRemediation(
  model: HomeModel,
  health: Map<string, OutletHealth>,
  systemic: SystemicFlag[],
): RemediationItem[] {
  const items: Array<Omit<RemediationItem, "rank">> = [];
  const labelFor = (o: OutletNode) => {
    const room = model.rooms.find((r) => r.id === o.roomId);
    return `${room?.name ?? "Room"} · ${o.label}`;
  };

  for (const o of model.outlets) {
    const h = health.get(o.id)!;
    if (!h.observed || !o.inference) continue;
    const f = FAULTS[o.inference.topFault];
    if (!f || f.sev < 1) continue;
    const urgency = h.hold || h.lethal || f.sev >= 8 ? "IMMEDIATE" : f.sev >= 5 ? "SOON" : "PLANNED";
    const score =
      (h.lethal ? 1000 : 0) +
      (o.inference.verdictCode === "SAFETY HOLD" ? 800 : o.inference.verdictCode === "CONDEMN" ? 500 : 0) +
      f.sev * 20 +
      (h.hold ? 200 : 0);
    items.push({ targetType: "OUTLET", targetId: o.id, label: labelFor(o), reason: `${f.name} — ${f.remedy}`, urgency, score });
  }

  for (const fl of systemic) {
    const score = (fl.urgency === "IMMEDIATE" ? 700 : fl.urgency === "SOON" ? 400 : 150) + 300;
    items.push({ targetType: fl.scope === "circuit" ? "CIRCUIT" : "ROOM", targetId: fl.scopeId, label: fl.description, reason: fl.remedy, urgency: fl.urgency, score });
  }

  return items
    .sort((a, b) => b.score - a.score)
    .map((it, i) => ({ ...it, rank: i + 1 }));
}
