/* ════════════════════════════════════════════════════════════════════════════
   STORAGE FAÇADE — the only module that touches Dexie directly. Assembles the
   denormalised HomeModel, writes entities through, and round-trips the portable
   HomeExportDoc (the interchange + dashboard contract).
   ════════════════════════════════════════════════════════════════════════════ */
import { db, type FeedbackRow } from "./db";
import {
  ENGINE_VERSION, EXPORT_VERSION,
  type Meta, type HomeModel, type HomeNode, type FloorNode, type RoomNode,
  type CircuitNode, type OutletNode, type HomeExportDoc,
} from "../core";

export const uid = (): string =>
  (crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

export const nowISO = (): string => new Date().toISOString();

export const DEFAULT_META: Meta = {
  era: "1990-2000", wireMat: "Copper", meter: "Fluke 117", meterZ: 10e6,
  gauge: "14 AWG", topology: "Terminal", boxType: "Metal",
};

// ─── Home assembly ────────────────────────────────────────────────────────────
export async function listHomes(): Promise<HomeNode[]> {
  return db.homes.toArray();
}

export async function loadHomeModel(homeId: string): Promise<HomeModel | null> {
  const home = await db.homes.get(homeId);
  if (!home) return null;
  const [floors, circuits] = await Promise.all([
    db.floors.where("homeId").equals(homeId).toArray(),
    db.circuits.where("homeId").equals(homeId).toArray(),
  ]);
  const floorIds = floors.map((f) => f.id);
  const rooms = (await db.rooms.toArray()).filter((r) => floorIds.includes(r.floorId));
  const roomIds = new Set(rooms.map((r) => r.id));
  const outlets = (await db.outlets.toArray()).filter((o) => roomIds.has(o.roomId));
  floors.sort((a, b) => a.level - b.level);
  return { home, floors, rooms, circuits, outlets };
}

/** Create (or return) a starter home so the app always has something to open. */
export async function ensureDefaultHome(): Promise<HomeModel> {
  const homes = await db.homes.toArray();
  if (homes.length) {
    const m = await loadHomeModel(homes[0].id);
    if (m) return m;
  }
  const ts = nowISO();
  const home: HomeNode = { id: uid(), name: "My Home", defaultMeta: { ...DEFAULT_META }, createdAt: ts, updatedAt: ts };
  const floor: FloorNode = { id: uid(), homeId: home.id, level: 1, name: "Main Floor", createdAt: ts, updatedAt: ts };
  await db.homes.put(home);
  await db.floors.put(floor);
  return { home, floors: [floor], rooms: [], circuits: [], outlets: [] };
}

// ─── Multi-home management ────────────────────────────────────────────────────
export async function createHome(name: string): Promise<HomeModel> {
  const ts = nowISO();
  const home: HomeNode = { id: uid(), name: name?.trim() || "New Home", defaultMeta: { ...DEFAULT_META }, createdAt: ts, updatedAt: ts };
  const floor: FloorNode = { id: uid(), homeId: home.id, level: 1, name: "Main Floor", createdAt: ts, updatedAt: ts };
  await db.homes.put(home);
  await db.floors.put(floor);
  return { home, floors: [floor], rooms: [], circuits: [], outlets: [] };
}

export async function renameHome(id: string, name: string): Promise<void> {
  const h = await db.homes.get(id);
  if (h) await db.homes.put({ ...h, name: name.trim() || h.name, updatedAt: nowISO() });
}

export async function deleteHome(id: string): Promise<void> {
  const floors = await db.floors.where("homeId").equals(id).toArray();
  for (const f of floors) await deleteFloor(f.id);
  await db.circuits.where("homeId").equals(id).delete();
  await db.homes.delete(id);
}

// ─── Write-through (entity puts/deletes) ──────────────────────────────────────
export const putHome = (h: HomeNode) => db.homes.put({ ...h, updatedAt: nowISO() });
export const putFloor = (f: FloorNode) => db.floors.put({ ...f, updatedAt: nowISO() });
export const putRoom = (r: RoomNode) => db.rooms.put({ ...r, updatedAt: nowISO() });
export const putCircuit = (c: CircuitNode) => db.circuits.put(c);
export const putOutlet = (o: OutletNode) => db.outlets.put({ ...o, updatedAt: nowISO() });

export async function deleteRoom(roomId: string) {
  await db.outlets.where("roomId").equals(roomId).delete();
  await db.rooms.delete(roomId);
}
export async function deleteFloor(floorId: string) {
  const rooms = await db.rooms.where("floorId").equals(floorId).toArray();
  for (const r of rooms) await deleteRoom(r.id);
  await db.floors.delete(floorId);
}
export const deleteOutlet = (id: string) => db.outlets.delete(id);
export const deleteCircuit = (id: string) => db.circuits.delete(id);

// ─── Settings (API key, prefs) ────────────────────────────────────────────────
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}
export const setSetting = (key: string, value: unknown) => db.settings.put({ key, value });

// ─── Ground-truth feedback (active learning) ──────────────────────────────────
export const addFeedback = (f: Omit<FeedbackRow, "id" | "submittedAt">) =>
  db.feedback.put({ ...f, id: uid(), submittedAt: nowISO() });
export const listFeedback = () => db.feedback.toArray();

// ─── Portable export / import ─────────────────────────────────────────────────
export async function exportHome(homeId: string): Promise<HomeExportDoc | null> {
  const m = await loadHomeModel(homeId);
  if (!m) return null;
  return {
    exportVersion: EXPORT_VERSION,
    exportedAt: nowISO(),
    engineVersion: ENGINE_VERSION,
    home: m.home, floors: m.floors, rooms: m.rooms, circuits: m.circuits, outlets: m.outlets,
  };
}

export async function importHome(doc: HomeExportDoc): Promise<string> {
  // idempotent upsert keyed on existing ids
  await db.transaction("rw", [db.homes, db.floors, db.rooms, db.circuits, db.outlets], async () => {
    await db.homes.put(doc.home);
    await db.floors.bulkPut(doc.floors);
    await db.rooms.bulkPut(doc.rooms);
    await db.circuits.bulkPut(doc.circuits);
    await db.outlets.bulkPut(doc.outlets);
  });
  return doc.home.id;
}

export function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
