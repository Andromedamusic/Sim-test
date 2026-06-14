/* ════════════════════════════════════════════════════════════════════════════
   STORAGE FAÇADE — the only module that touches Dexie directly. Assembles the
   denormalised HomeModel, writes entities through, and round-trips the portable
   HomeExportDoc (the interchange + dashboard contract).

   RESILIENCE: if IndexedDB is unavailable (e.g. a single-file build opened from
   file:// on mobile, private-mode quirks, blocked storage), the whole layer
   transparently falls back to an in-memory store so the app still runs for the
   session (data just won't persist across reloads). isMemoryMode() reports it.
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

// ─── Resilient table primitives (IndexedDB → in-memory fallback) ──────────────
type TableName = "homes" | "floors" | "rooms" | "circuits" | "outlets" | "settings" | "feedback";
let MEMORY = false;
export const isMemoryMode = (): boolean => MEMORY;

const MEM: Record<TableName, Map<string, Record<string, unknown>>> = {
  homes: new Map(), floors: new Map(), rooms: new Map(), circuits: new Map(),
  outlets: new Map(), settings: new Map(), feedback: new Map(),
};

/** Probe IndexedDB once; flip to memory mode if it can't be opened. */
export async function initStorage(): Promise<void> {
  try {
    if (typeof indexedDB === "undefined") { MEMORY = true; return; }
    await db.open();
  } catch {
    MEMORY = true;
  }
}

interface AnyTable {
  put(o: unknown): Promise<unknown>;
  get(k: string): Promise<unknown>;
  toArray(): Promise<unknown[]>;
  delete(k: string): Promise<void>;
}
const tbl = (name: TableName): AnyTable => db[name] as unknown as AnyTable;

async function tPut(name: TableName, obj: Record<string, unknown>, keyField = "id"): Promise<void> {
  if (!MEMORY) {
    try { await tbl(name).put(obj); return; }
    catch { MEMORY = true; }
  }
  MEM[name].set(String(obj[keyField]), obj);
}
async function tGet<T>(name: TableName, key: string): Promise<T | undefined> {
  if (!MEMORY) {
    try { return (await tbl(name).get(key)) as T | undefined; }
    catch { MEMORY = true; }
  }
  return MEM[name].get(key) as T | undefined;
}
async function tAll<T>(name: TableName): Promise<T[]> {
  if (!MEMORY) {
    try { return (await tbl(name).toArray()) as T[]; }
    catch { MEMORY = true; }
  }
  return [...MEM[name].values()] as T[];
}
async function tDelete(name: TableName, key: string): Promise<void> {
  if (!MEMORY) {
    try { await tbl(name).delete(key); return; }
    catch { MEMORY = true; }
  }
  MEM[name].delete(key);
}

// ─── Home assembly ────────────────────────────────────────────────────────────
export function listHomes(): Promise<HomeNode[]> {
  return tAll<HomeNode>("homes");
}

export async function loadHomeModel(homeId: string): Promise<HomeModel | null> {
  const home = await tGet<HomeNode>("homes", homeId);
  if (!home) return null;
  const floors = (await tAll<FloorNode>("floors")).filter((f) => f.homeId === homeId);
  const circuits = (await tAll<CircuitNode>("circuits")).filter((c) => c.homeId === homeId);
  const floorIds = new Set(floors.map((f) => f.id));
  const rooms = (await tAll<RoomNode>("rooms")).filter((r) => floorIds.has(r.floorId));
  const roomIds = new Set(rooms.map((r) => r.id));
  const outlets = (await tAll<OutletNode>("outlets")).filter((o) => roomIds.has(o.roomId));
  floors.sort((a, b) => a.level - b.level);
  return { home, floors, rooms, circuits, outlets };
}

function freshHome(name = "My Home"): HomeModel {
  const ts = nowISO();
  const home: HomeNode = { id: uid(), name, defaultMeta: { ...DEFAULT_META }, createdAt: ts, updatedAt: ts };
  const floor: FloorNode = { id: uid(), homeId: home.id, level: 1, name: "Main Floor", createdAt: ts, updatedAt: ts };
  return { home, floors: [floor], rooms: [], circuits: [], outlets: [] };
}

/** Create (or return) a starter home so the app always has something to open. */
export async function ensureDefaultHome(): Promise<HomeModel> {
  const homes = await tAll<HomeNode>("homes");
  if (homes.length) {
    const m = await loadHomeModel(homes[0].id);
    if (m) return m;
  }
  const model = freshHome();
  await tPut("homes", model.home as unknown as Record<string, unknown>);
  await tPut("floors", model.floors[0] as unknown as Record<string, unknown>);
  return model;
}

// ─── Multi-home management ────────────────────────────────────────────────────
export async function createHome(name: string): Promise<HomeModel> {
  const model = freshHome(name?.trim() || "New Home");
  await tPut("homes", model.home as unknown as Record<string, unknown>);
  await tPut("floors", model.floors[0] as unknown as Record<string, unknown>);
  return model;
}

export async function renameHome(id: string, name: string): Promise<void> {
  const h = await tGet<HomeNode>("homes", id);
  if (h) await tPut("homes", { ...h, name: name.trim() || h.name, updatedAt: nowISO() });
}

export async function deleteHome(id: string): Promise<void> {
  const floors = (await tAll<FloorNode>("floors")).filter((f) => f.homeId === id);
  for (const f of floors) await deleteFloor(f.id);
  const circuits = (await tAll<CircuitNode>("circuits")).filter((c) => c.homeId === id);
  for (const c of circuits) await tDelete("circuits", c.id);
  await tDelete("homes", id);
}

// ─── Write-through (entity puts/deletes) ──────────────────────────────────────
export const putHome = (h: HomeNode) => tPut("homes", { ...h, updatedAt: nowISO() });
export const putFloor = (f: FloorNode) => tPut("floors", { ...f, updatedAt: nowISO() });
export const putRoom = (r: RoomNode) => tPut("rooms", { ...r, updatedAt: nowISO() });
export const putCircuit = (c: CircuitNode) => tPut("circuits", { ...c });
export const putOutlet = (o: OutletNode) => tPut("outlets", { ...o, updatedAt: nowISO() });

export async function deleteRoom(roomId: string) {
  const outlets = (await tAll<OutletNode>("outlets")).filter((o) => o.roomId === roomId);
  for (const o of outlets) await tDelete("outlets", o.id);
  await tDelete("rooms", roomId);
}
export async function deleteFloor(floorId: string) {
  const rooms = (await tAll<RoomNode>("rooms")).filter((r) => r.floorId === floorId);
  for (const r of rooms) await deleteRoom(r.id);
  await tDelete("floors", floorId);
}
export const deleteOutlet = (id: string) => tDelete("outlets", id);
export const deleteCircuit = (id: string) => tDelete("circuits", id);

// ─── Settings (API key, prefs) ────────────────────────────────────────────────
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await tGet<{ key: string; value: T }>("settings", key);
  return row ? row.value : fallback;
}
export const setSetting = (key: string, value: unknown) => tPut("settings", { key, value }, "key");

// ─── Ground-truth feedback (active learning) ──────────────────────────────────
export const addFeedback = (f: Omit<FeedbackRow, "id" | "submittedAt">) =>
  tPut("feedback", { ...f, id: uid(), submittedAt: nowISO() });
export const listFeedback = () => tAll<FeedbackRow>("feedback");

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
  await tPut("homes", doc.home as unknown as Record<string, unknown>);
  for (const f of doc.floors) await tPut("floors", f as unknown as Record<string, unknown>);
  for (const r of doc.rooms) await tPut("rooms", r as unknown as Record<string, unknown>);
  for (const c of doc.circuits) await tPut("circuits", c as unknown as Record<string, unknown>);
  for (const o of doc.outlets) await tPut("outlets", o as unknown as Record<string, unknown>);
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
