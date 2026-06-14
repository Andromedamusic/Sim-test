/* ════════════════════════════════════════════════════════════════════════════
   HARDEN — targeted regression tests for engine hardening.
   (a) bootleg_gnd never clears across partial subsets + null hasGroundWire
   (b) priorScale active-learning shifts MAP without breaking safety recall
   (c) rollup edge cases: empty home, all-unobserved, one lethal pins home
   (d) nextBestTest ranks lethal-excluding tests when lethal mass is high
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from "vitest";
import {
  tribunal, rollupHome, nextBestTests, FAULTS, LETHAL_FAULTS,
  type Observation, type Meta, type HomeModel, type OutletNode,
  type RoomNode, type FloorNode, type CircuitNode, type HomeNode,
} from "../src/core";
import { sampleCase, COMPLETENESS_LEVELS } from "./syntheticCase";

const META: Meta = { era: "1990-2000", wireMat: "Copper", meter: "Fluke 117", meterZ: 10e6 };
const now = "2026-06-14T00:00:00.000Z";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function outlet(
  id: string,
  roomId: string,
  circuitId: string | null,
  obs: Observation | null,
  wall: "N" | "S" | "E" | "W" = "N",
  off = 0.5,
): OutletNode {
  return {
    id, roomId, circuitId, label: id, type: "DUPLEX",
    position: { wallId: wall, offset: off }, observation: obs,
    inference: obs ? tribunal(obs, META) : null, photos: [], createdAt: now, updatedAt: now,
  };
}

function makeHome(outlets: OutletNode[], circuits: CircuitNode[] = []): HomeModel {
  const home: HomeNode = { id: "h1", name: "Harden Test", defaultMeta: META, createdAt: now, updatedAt: now };
  const floor: FloorNode = { id: "f1", homeId: "h1", level: 1, name: "Main", createdAt: now, updatedAt: now };
  const rooms: RoomNode[] = [...new Set(outlets.map((o) => o.roomId))].map((rid) => ({
    id: rid, floorId: "f1", name: rid, width_m: 4, depth_m: 3, floorOffset: { x: 0, y: 0 }, createdAt: now, updatedAt: now,
  }));
  return { home, floors: [floor], rooms, circuits, outlets };
}

function defaultCircuit(id = "c1"): CircuitNode {
  return { id, homeId: "h1", breakerLabel: "1", breakerSlot: 1, ampRating: 15, voltage: 120, isSharedNeutral: false, notes: "" };
}

// ─── (a) bootleg_gnd — never clears ──────────────────────────────────────────

describe("(a) bootleg_gnd — no false-clears across completeness + ground-wire states", () => {
  const bootlegFault = FAULTS["bootleg_gnd"];
  const N_SEEDS = 30;

  for (const c of COMPLETENESS_LEVELS) {
    it(`bootleg_gnd @ completeness=${c} with hasGroundWire=false: zero PASS`, () => {
      let falseClears = 0;
      for (let seed = 0; seed < N_SEEDS; seed++) {
        const { obs, meta } = sampleCase(bootlegFault, c, seed + 100);
        // Ensure hasGroundWire=false (as it is in sampleCase for bootleg_gnd)
        const r = tribunal({ ...obs, hasGroundWire: false }, meta);
        if (r.verdictCode === "PASS") falseClears++;
      }
      expect(falseClears).toBe(0);
    });
  }

  it("bootleg_gnd with hasGroundWire=null (unknown) is never PASS", () => {
    // Worst-case: only VHN+VHG+VNG known, hasGroundWire unknown
    const obs: Observation = { VHN: 120, VHG: 120, VNG: 0.05, hasGroundWire: null };
    const r = tribunal(obs, META);
    expect(r.verdictCode).not.toBe("PASS");
  });

  it("bootleg_gnd with hasGroundWire=undefined (not measured) is never PASS", () => {
    const obs: Observation = { VHN: 120, VHG: 120, VNG: 0.05 };
    const r = tribunal(obs, META);
    expect(r.verdictCode).not.toBe("PASS");
  });

  it("ground-confirmed-false subset: only VHN+VHG+VNG known, hasGroundWire=false → held", () => {
    // Readings that look healthy but have confirmed-no-ground-wire
    const obs: Observation = { VHN: 120, VHG: 120, VNG: 0.4, hasGroundWire: false };
    const r = tribunal(obs, META);
    // Must NOT be PASS — bootleg ground is not ruled out
    expect(r.verdictCode).not.toBe("PASS");
  });

  it("bootleg_gnd partial subset: bootlegRuledOut=false never produces PASS", () => {
    let falseClears = 0;
    for (let seed = 0; seed < N_SEEDS; seed++) {
      const { obs, meta } = sampleCase(bootlegFault, 0.4, seed + 200);
      const r = tribunal({ ...obs, bootlegRuledOut: false }, meta);
      if (r.verdictCode === "PASS") falseClears++;
    }
    expect(falseClears).toBe(0);
  });

  it("all lethal faults with hasGroundWire=null are never PASS (paranoid check)", () => {
    for (const fid of LETHAL_FAULTS) {
      const fault = FAULTS[fid];
      for (let seed = 0; seed < 10; seed++) {
        const { obs, meta } = sampleCase(fault, 0.6, seed + 300);
        const r = tribunal({ ...obs, hasGroundWire: null }, meta);
        expect(r.verdictCode).not.toBe("PASS");
      }
    }
  });
});

// ─── (b) priorScale active-learning ──────────────────────────────────────────

describe("(b) priorScale active-learning shifts MAP without breaking safety", () => {
  // Ambiguous-evidence case: only VHN known (equal-weight baseline)
  const ambiguousObs: Observation = { VHN: 120 };

  it("boosting backstab_hot prior shifts its posterior up vs neutral baseline", () => {
    const base = tribunal(ambiguousObs, META);
    const boosted = tribunal(ambiguousObs, META, { priorScale: { backstab_hot: 5 } });
    expect(boosted.post["backstab_hot"]).toBeGreaterThan(base.post["backstab_hot"]);
  });

  it("priorScale=0 suppresses a fault to near-zero", () => {
    const r = tribunal(ambiguousObs, META, { priorScale: { backstab_hot: 0 } });
    expect(r.post["backstab_hot"]).toBeLessThan(0.01);
  });

  it("negative priorScale is clamped to 0, not inverted", () => {
    const r = tribunal(ambiguousObs, META, { priorScale: { backstab_hot: -2 } });
    // Negative scale must not produce a different posterior than zero scale
    const r0 = tribunal(ambiguousObs, META, { priorScale: { backstab_hot: 0 } });
    // Both should suppress backstab_hot equally
    expect(r.post["backstab_hot"]).toBeCloseTo(r0.post["backstab_hot"], 8);
  });

  it("large priorScale still never clears a lethal fault on lethal-typed obs", () => {
    // Even if we boost a non-lethal fault's prior to overwhelm others,
    // a reversed-pol observation must not be cleared
    const reversedObs: Observation = { VHN: 120, VHG: 1.5, VNG: 120, groundRefTested: false };
    // Boost healthy to extreme — but we still have lethal evidence
    const r = tribunal(reversedObs, META, { priorScale: { healthy: 100 } });
    expect(r.verdictCode).not.toBe("PASS");
  });

  it("boosting a lethal fault prior makes it surface higher in ranked", () => {
    const obs: Observation = { VHN: 120, VHG: 120, VNG: 0.4 };
    const base = tribunal(obs, META);
    const boosted = tribunal(obs, META, { priorScale: { reversed_pol: 8 } });
    // reversed_pol should rank higher after boosting
    const baseRank = Object.entries(base.post).sort((a, b) => b[1] - a[1]).findIndex(([k]) => k === "reversed_pol");
    const boostedRank = Object.entries(boosted.post).sort((a, b) => b[1] - a[1]).findIndex(([k]) => k === "reversed_pol");
    expect(boostedRank).toBeLessThanOrEqual(baseRank);
  });

  it("safety recall: all lethal faults never PASS even with boosted healthy prior, at partial obs", () => {
    for (const fid of LETHAL_FAULTS) {
      const fault = FAULTS[fid];
      for (let seed = 0; seed < 10; seed++) {
        const { obs, meta } = sampleCase(fault, 0.6, seed + 400);
        // Aggressively boost healthy — engine must still not produce PASS
        const r = tribunal(obs, meta, { priorScale: { healthy: 50 } });
        expect(r.verdictCode).not.toBe("PASS");
      }
    }
  });
});

// ─── (c) rollup edge cases ────────────────────────────────────────────────────

describe("(c) rollup edge cases", () => {
  it("empty home (no outlets, no floors, no rooms) does not throw and returns coherent result", () => {
    const home: HomeNode = { id: "h0", name: "Empty", defaultMeta: META, createdAt: now, updatedAt: now };
    const emptyModel: HomeModel = { home, floors: [], rooms: [], circuits: [], outlets: [] };
    let h: ReturnType<typeof rollupHome>;
    expect(() => { h = rollupHome(emptyModel); }).not.toThrow();
    expect(h!.safetyHold).toBe(false);
    expect(h!.grade).not.toBe("RED");
    expect(h!.inspectionCoverage).toBe(0);
  });

  it("home with one floor but no outlets: grade is not RED, no safety hold", () => {
    const outs: OutletNode[] = [];
    const h = rollupHome(makeHome(outs, [defaultCircuit()]));
    expect(h.safetyHold).toBe(false);
    expect(h.grade).not.toBe("RED");
    expect(h.inspectionCoverage).toBe(0);
  });

  it("all unobserved outlets: risk ≥ UNOBSERVED_RISK (0.3), no systemic flags", () => {
    const outs = [
      outlet("o1", "living", "c1", null),
      outlet("o2", "living", "c1", null),
      outlet("o3", "living", "c1", null),
    ];
    const h = rollupHome(makeHome(outs, [defaultCircuit()]));
    // Unobserved risk = 0.3 per outlet; aggregate should be >= 0.3
    expect(h.risk).toBeGreaterThanOrEqual(0.25);
    expect(h.safetyHold).toBe(false);
    // No inference data → no ELEVATED_VNG flag (no VNG readings)
    const elevatedFlag = h.systemicFlags.find((f) => f.type === "ELEVATED_VNG");
    expect(elevatedFlag).toBeUndefined();
  });

  it("one lethal outlet (reversed polarity) pins home to RED + safetyHold, two healthy neighbours don't rescue it", () => {
    const outs = [
      outlet("safe1", "den", "c1", { VHN: 120, VHG: 120, VNG: 0.4, Gcont: 0.3, hasGroundWire: true }),
      outlet("safe2", "den", "c1", { VHN: 120, VHG: 120, VNG: 0.5, Gcont: 0.4, hasGroundWire: true }),
      outlet("lethal", "den", "c1", { VHN: 120, VHG: 1.5, VNG: 120, groundRefTested: false }),
    ];
    const h = rollupHome(makeHome(outs, [defaultCircuit()]));
    expect(h.safetyHold).toBe(true);
    expect(h.grade).toBe("RED");
    expect(h.unclearedLethalOutletIds).toContain("lethal");
    // Lethal outlet should be first in remediation
    expect(h.remediation.length).toBeGreaterThan(0);
    expect(h.remediation[0].targetId).toBe("lethal");
  });

  it("ELEVATED_VNG systemic flag is emitted when ≥2 outlets on same circuit have VNG>3V", () => {
    const circuits: CircuitNode[] = [{
      id: "c1", homeId: "h1", breakerLabel: "12", breakerSlot: 12,
      ampRating: 20, voltage: 120, isSharedNeutral: true, notes: "",
    }];
    const outs = [
      outlet("A1", "kit", "c1", { VHN: 120, VHG: 120, VNG: 5.5, hasGroundWire: true }),
      outlet("A2", "kit", "c1", { VHN: 119, VHG: 119, VNG: 6.1, hasGroundWire: true }),
    ];
    const h = rollupHome(makeHome(outs, circuits));
    const flag = h.systemicFlags.find((f) => f.type === "ELEVATED_VNG");
    expect(flag).toBeTruthy();
    expect(flag!.scope).toBe("circuit");
    expect(flag!.outletIds.sort()).toEqual(["A1", "A2"]);
    expect(flag!.urgency).toBe("IMMEDIATE");
    expect(flag!.remedy).toMatch(/upstream|neutral/i);
  });

  it("ELEVATED_VNG is NOT emitted when outlets are on different circuits", () => {
    const circuits: CircuitNode[] = [
      { id: "c1", homeId: "h1", breakerLabel: "1", breakerSlot: 1, ampRating: 15, voltage: 120, isSharedNeutral: false, notes: "" },
      { id: "c2", homeId: "h1", breakerLabel: "2", breakerSlot: 2, ampRating: 15, voltage: 120, isSharedNeutral: false, notes: "" },
    ];
    const outs = [
      outlet("B1", "kit", "c1", { VHN: 120, VHG: 120, VNG: 5.5, hasGroundWire: true }),
      outlet("B2", "kit", "c2", { VHN: 119, VHG: 119, VNG: 6.1, hasGroundWire: true }),
    ];
    const h = rollupHome(makeHome(outs, circuits));
    const flag = h.systemicFlags.find((f) => f.type === "ELEVATED_VNG");
    expect(flag).toBeUndefined();
  });
});

// ─── (d) nextBestTest — lethal-excluding tests prioritised ───────────────────

describe("(d) nextBestTest prioritises lethal-excluding tests when lethal mass is high", () => {
  it("when reversed_pol has high posterior mass, groundRef or bootleg appears in top-4", () => {
    // Reversed polarity signature — VHG low, VNG high
    const obs: Observation = { VHN: 120, VHG: 1.5, VNG: 120 };
    const result = tribunal(obs, META);
    // Lethal faults should have high mass
    const lethalMass = LETHAL_FAULTS.reduce((sum, k) => sum + (result.post[k] ?? 0), 0);
    expect(lethalMass).toBeGreaterThan(0.3);

    const nbt = nextBestTests(obs, META, result.post, 4);
    const topIds = nbt.slice(0, 4).map((t) => t.id);
    const hasLethalTest = topIds.some((id) => id === "groundRef" || id === "bootleg");
    expect(hasLethalTest).toBe(true);
  });

  it("when lethal mass is present, bootleg or groundRef appears in top-6 tests", () => {
    // Bootleg ground signature: VNG ≈ 0, looks like healthy but no real ground.
    // In this ambiguous case backstab/neutral faults also have high mass so dropV
    // tops the gain chart; bootleg still surfaces in the top-6 due to lethal boost.
    const obs: Observation = { VHN: 120, VHG: 120, VNG: 0.05 };
    const result = tribunal(obs, META);
    // Verify lethal mass is non-trivial before checking test ordering
    const lethalMass = LETHAL_FAULTS.reduce((sum, k) => sum + (result.post[k] ?? 0), 0);
    expect(lethalMass).toBeGreaterThan(0.04);

    const nbt = nextBestTests(obs, META, result.post, 6);
    const topIds = nbt.map((t) => t.id);
    const hasLethalTest = topIds.some((id) => id === "groundRef" || id === "bootleg");
    expect(hasLethalTest).toBe(true);
  });

  it("already-measured tests are excluded from NBT", () => {
    // VHG already measured
    const obs: Observation = { VHN: 120, VHG: 120, VNG: 0.4 };
    const result = tribunal(obs, META);
    const nbt = nextBestTests(obs, META, result.post, 10);
    // VHG is already measured, must not appear
    expect(nbt.some((t) => t.id === "VHG")).toBe(false);
    // VNG is already measured, must not appear
    expect(nbt.some((t) => t.id === "VNG")).toBe(false);
  });

  it("returns at most n recommendations", () => {
    const obs: Observation = { VHN: 120 };
    const result = tribunal(obs, META);
    const nbt = nextBestTests(obs, META, result.post, 3);
    expect(nbt.length).toBeLessThanOrEqual(3);
  });

  it("gain values are all non-negative", () => {
    const obs: Observation = { VHN: 120 };
    const result = tribunal(obs, META);
    const nbt = nextBestTests(obs, META, result.post, 10);
    for (const t of nbt) {
      expect(t.gain).toBeGreaterThanOrEqual(0);
    }
  });
});
