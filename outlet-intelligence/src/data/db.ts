/* ════════════════════════════════════════════════════════════════════════════
   PERSISTENCE — IndexedDB via Dexie. Single offline source of truth.
   Version-stamped schema; the .version(N) chain is the migration path so a
   device that skipped releases upgrades sequentially without data loss.
   ════════════════════════════════════════════════════════════════════════════ */
import Dexie, { type Table } from "dexie";
import type { HomeNode, FloorNode, RoomNode, CircuitNode, OutletNode } from "../core";

export interface SettingsRow {
  key: string;
  value: unknown;
}

/** Ground-truth feedback for active learning (logged after an outlet is opened). */
export interface FeedbackRow {
  id: string;
  outletId: string;
  predictedFault: string;
  actualFault: string;
  note: string;
  submittedAt: string;
}

export class OutletDB extends Dexie {
  homes!: Table<HomeNode, string>;
  floors!: Table<FloorNode, string>;
  rooms!: Table<RoomNode, string>;
  circuits!: Table<CircuitNode, string>;
  outlets!: Table<OutletNode, string>;
  settings!: Table<SettingsRow, string>;
  feedback!: Table<FeedbackRow, string>;

  constructor() {
    super("OutletIntelligenceDB");
    this.version(1).stores({
      homes: "id, name",
      floors: "id, homeId, level",
      rooms: "id, floorId",
      circuits: "id, homeId",
      outlets: "id, roomId, circuitId",
      settings: "key",
      feedback: "id, outletId, submittedAt",
    });
    // Future schema changes:
    // this.version(2).stores({ outlets: "id, roomId, circuitId, panelSlot" })
    //   .upgrade(tx => tx.table("outlets").toCollection().modify(o => { o.panelSlot ??= null; }));
  }
}

export const db = new OutletDB();

/** Request durable storage so mobile browsers don't evict survey data. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* ignore */
  }
  return false;
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
    }
  } catch {
    /* ignore */
  }
  return null;
}
