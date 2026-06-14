/* ════════════════════════════════════════════════════════════════════════════
   ROLLUP — the home-level intelligence model. Verifies systemic-fault detection
   (shared circuit) and the safety-asymmetric guarantee (one lethal outlet pins
   the whole home to RED).
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from "vitest";
import {
  tribunal, rollupHome, type Observation, type Meta,
  type HomeModel, type OutletNode, type RoomNode, type FloorNode, type CircuitNode, type HomeNode,
} from "../src/core";

const META: Meta = { era: "1990-2000", wireMat: "Copper", meter: "Fluke 117", meterZ: 10e6 };
const now = "2026-01-01T00:00:00.000Z";

function outlet(id: string, roomId: string, circuitId: string | null, obs: Observation | null, wall: "N" | "S" | "E" | "W" = "N", off = 0.5): OutletNode {
  return {
    id, roomId, circuitId, label: id, type: "DUPLEX",
    position: { wallId: wall, offset: off }, observation: obs,
    inference: obs ? tribunal(obs, META) : null, photos: [], createdAt: now, updatedAt: now,
  };
}

function makeHome(outlets: OutletNode[], circuits: CircuitNode[]): HomeModel {
  const home: HomeNode = { id: "h1", name: "Test", defaultMeta: META, createdAt: now, updatedAt: now };
  const floor: FloorNode = { id: "f1", homeId: "h1", level: 1, name: "Main", createdAt: now, updatedAt: now };
  const rooms: RoomNode[] = [...new Set(outlets.map((o) => o.roomId))].map((rid) => ({
    id: rid, floorId: "f1", name: rid, width_m: 4, depth_m: 3, floorOffset: { x: 0, y: 0 }, createdAt: now, updatedAt: now,
  }));
  return { home, floors: [floor], rooms, circuits, outlets };
}

describe("ROLLUP — systemic detection", () => {
  it("flags ELEVATED_VNG as an upstream/shared-neutral fault across a circuit", () => {
    const circuits: CircuitNode[] = [{ id: "c1", homeId: "h1", breakerLabel: "12", breakerSlot: 12, ampRating: 20, voltage: 120, isSharedNeutral: true, notes: "" }];
    const outs = [
      outlet("K1", "kitchen", "c1", { VHN: 120, VHG: 120, VNG: 6.5, hasGroundWire: true }),
      outlet("K2", "kitchen", "c1", { VHN: 119, VHG: 119, VNG: 7.2, hasGroundWire: true }),
    ];
    const h = rollupHome(makeHome(outs, circuits));
    const flag = h.systemicFlags.find((f) => f.type === "ELEVATED_VNG");
    expect(flag).toBeTruthy();
    expect(flag!.outletIds.sort()).toEqual(["K1", "K2"]);
    expect(flag!.remedy).toMatch(/upstream|neutral/i);
    // a systemic circuit flag should surface at the top of remediation
    expect(h.remediation[0].reason).toMatch(/neutral|upstream/i);
  });
});

describe("ROLLUP — safety asymmetry", () => {
  it("one lethal outlet pins the whole home to RED + safetyHold, regardless of healthy neighbours", () => {
    const circuits: CircuitNode[] = [{ id: "c1", homeId: "h1", breakerLabel: "1", breakerSlot: 1, ampRating: 15, voltage: 120, isSharedNeutral: false, notes: "" }];
    const outs = [
      outlet("good1", "bed", "c1", { VHN: 120, VHG: 120, VNG: 0.4, Gcont: 0.3, hasGroundWire: true }),
      outlet("good2", "bed", "c1", { VHN: 120, VHG: 120, VNG: 0.5, Gcont: 0.4, hasGroundWire: true }),
      // reversed polarity — lethal
      outlet("danger", "bed", "c1", { VHN: 120, VHG: 1.5, VNG: 120, groundRefTested: false }),
    ];
    const h = rollupHome(makeHome(outs, circuits));
    expect(h.safetyHold).toBe(true);
    expect(h.grade).toBe("RED");
    expect(h.unclearedLethalOutletIds).toContain("danger");
    expect(h.remediation[0].targetId).toBe("danger");
  });

  it("an all-healthy, ground-confirmed home reads GREEN/▾ low risk", () => {
    const circuits: CircuitNode[] = [{ id: "c1", homeId: "h1", breakerLabel: "1", breakerSlot: 1, ampRating: 15, voltage: 120, isSharedNeutral: false, notes: "" }];
    const outs = [
      outlet("a", "den", "c1", { VHN: 120, VHG: 120, VNG: 0.4, Gcont: 0.3, hasGroundWire: true }),
      outlet("b", "den", "c1", { VHN: 121, VHG: 120, VNG: 0.5, Gcont: 0.4, hasGroundWire: true }),
    ];
    const h = rollupHome(makeHome(outs, circuits));
    expect(h.safetyHold).toBe(false);
    expect(["GREEN", "YELLOW"]).toContain(h.grade);
    expect(h.inspectionCoverage).toBe(1);
  });
});
