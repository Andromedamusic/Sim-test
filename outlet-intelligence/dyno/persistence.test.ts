/* ════════════════════════════════════════════════════════════════════════════
   PERSISTENCE round-trip — the HomeExportDoc is the dashboard-integration
   contract and the offline backup format. Seed → export → wipe → import must
   reconstruct the home losslessly.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, beforeEach } from "vitest";
import {
  ensureDefaultHome, exportHome, importHome, loadHomeModel, putRoom, putOutlet, uid, nowISO,
} from "../src/data/storage";
import { db } from "../src/data/db";
import type { RoomNode, OutletNode } from "../src/core";

beforeEach(async () => { await db.delete(); await db.open(); });

describe("HomeExportDoc round-trip", () => {
  it("seed → export → wipe → import reconstructs rooms and outlets losslessly", async () => {
    const model = await ensureDefaultHome();
    const homeId = model.home.id;
    const floorId = model.floors[0].id;

    const room: RoomNode = { id: uid(), floorId, name: "Kitchen", width_m: 4, depth_m: 3, floorOffset: { x: 0, y: 0 }, createdAt: nowISO(), updatedAt: nowISO() };
    await putRoom(room);
    const outlet: OutletNode = { id: uid(), roomId: room.id, circuitId: null, label: "K1", type: "DUPLEX", position: { wallId: "N", offset: 0.5 }, observation: { VHN: 120, VHG: 17, VNG: 0.5 }, inference: null, photos: [], createdAt: nowISO(), updatedAt: nowISO() };
    await putOutlet(outlet);

    const doc = await exportHome(homeId);
    expect(doc).toBeTruthy();
    expect(doc!.exportVersion).toBeGreaterThan(0);
    expect(doc!.engineVersion).toMatch(/\d+\.\d+\.\d+/);

    // wipe everything, then import the doc into a fresh database
    await db.delete(); await db.open();
    expect(await loadHomeModel(homeId)).toBeNull();

    const importedId = await importHome(doc!);
    expect(importedId).toBe(homeId);

    const reloaded = await loadHomeModel(homeId);
    expect(reloaded).toBeTruthy();
    expect(reloaded!.rooms.map((r) => r.name)).toEqual(["Kitchen"]);
    expect(reloaded!.outlets).toHaveLength(1);
    expect(reloaded!.outlets[0].label).toBe("K1");
    expect(reloaded!.outlets[0].observation?.VHG).toBe(17);
  });

  it("import is idempotent (re-importing the same doc does not duplicate)", async () => {
    const model = await ensureDefaultHome();
    const doc = await exportHome(model.home.id);
    await importHome(doc!);
    await importHome(doc!);
    const reloaded = await loadHomeModel(model.home.id);
    expect(reloaded!.floors).toHaveLength(1);
  });
});
