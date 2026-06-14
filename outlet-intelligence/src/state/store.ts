/* ════════════════════════════════════════════════════════════════════════════
   APP STATE — Zustand. Mirrors the persisted HomeModel in memory and writes
   every mutation through to Dexie. The rollup is derived on read (cheap), never
   cached here, so it can never go stale.
   ════════════════════════════════════════════════════════════════════════════ */
import { create } from "zustand";
import {
  tribunal, analyzeOutlet, priorScaleFromCounts,
  type Observation, type Meta, type HomeModel, type HomeNode, type OutletNode, type RoomNode,
  type FloorNode, type CircuitNode, type OutletPosition, type OutletType, type HomeExportDoc,
  type PhotoRef,
} from "../core";
import * as S from "../data/storage";
import { db, requestPersistence } from "../data/db";
import { type SyncConfig, pushHome, pullHome, syncConfigured, newerDoc } from "../sync/remote";

export interface SyncStatus { state: "idle" | "syncing" | "ok" | "error"; message?: string; at?: string }

const LIVE_CASE: Observation = { VHN: "116", VHG: "15", VNG: "0.5", Gcont: "0.3", frittingObs: true, thermalSlot: "none" };

function clampScale(v: number): number {
  return Math.max(0.3, Math.min(5, v));
}

interface AppState {
  ready: boolean;
  memoryMode: boolean;
  model: HomeModel | null;
  activeFloorId: string | null;
  activeRoomId: string | null;
  activeOutletId: string | null;
  scratchObs: Observation;
  scratchMeta: Meta;
  rev: number; // bump to force rollup recompute consumers

  /** Active-learning: per-fault prior multipliers derived from learnCounts. */
  priorScale: Record<string, number>;
  /** Active-learning: confirmed ground-truth counts per fault. */
  learnCounts: Record<string, number>;

  /** Circuit tracer: which circuit is being traced right now (null = idle). */
  tracerCircuitId: string | null;

  /** Multi-home. */
  homes: HomeNode[];
  /** Cloud sync. */
  syncConfig: SyncConfig | null;
  syncStatus: SyncStatus;

  init: () => Promise<void>;
  reloadModel: (homeId?: string) => Promise<void>;

  // ── Multi-home ─────────────────────────────────────────────────────────────
  refreshHomes: () => Promise<void>;
  createHomeAndSwitch: (name: string) => Promise<void>;
  switchHome: (homeId: string) => Promise<void>;
  renameCurrentHome: (name: string) => Promise<void>;
  deleteHomeAndSwitch: (homeId: string) => Promise<void>;

  // ── Cloud sync ─────────────────────────────────────────────────────────────
  setSyncConfig: (config: SyncConfig | null) => Promise<void>;
  syncNow: () => Promise<void>;

  selectFloor: (id: string | null) => void;
  selectRoom: (id: string | null) => void;
  selectOutlet: (id: string | null) => void;

  addFloor: (name: string, level: number) => Promise<string>;
  addRoom: (floorId: string, name: string, width_m?: number, depth_m?: number) => Promise<string>;
  updateRoom: (room: RoomNode) => Promise<void>;
  removeRoom: (id: string) => Promise<void>;
  addCircuit: (c: Omit<CircuitNode, "id" | "homeId">) => Promise<string>;
  updateCircuit: (c: CircuitNode) => Promise<void>;
  addOutlet: (roomId: string, position: OutletPosition, label?: string, type?: OutletType) => Promise<string>;
  updateOutlet: (o: OutletNode) => Promise<void>;
  removeOutlet: (id: string) => Promise<void>;
  /** set observation, run the engine, cache inference, persist. */
  measureOutlet: (id: string, obs: Observation, metaOverride?: Partial<Meta>) => Promise<void>;

  setScratchObs: (obs: Observation) => void;
  setScratchMeta: (meta: Partial<Meta>) => void;
  loadLiveCase: () => void;

  importDoc: (doc: HomeExportDoc) => Promise<void>;

  // ── Active-learning ────────────────────────────────────────────────────────
  /** Record a ground-truth correction, update learned priors, re-run engine. */
  recordGroundTruth: (outletId: string, actualFaultId: string, note?: string) => Promise<void>;
  /** Wipe all learned priors back to factory defaults. */
  resetLearning: () => Promise<void>;

  // ── Photo management ───────────────────────────────────────────────────────
  addOutletPhoto: (outletId: string, dataUrl: string, caption?: string) => Promise<void>;
  removeOutletPhoto: (outletId: string, photoId: string) => Promise<void>;

  // ── Circuit tracer ─────────────────────────────────────────────────────────
  startTracer: (circuitId: string) => void;
  stopTracer: () => void;
  /** Assign the outlet to the currently-active tracer circuit (no-op if none). */
  assignOutletToTracer: (outletId: string) => Promise<void>;
}

function replaceOutlet(model: HomeModel, o: OutletNode): HomeModel {
  const exists = model.outlets.some((x) => x.id === o.id);
  return { ...model, outlets: exists ? model.outlets.map((x) => (x.id === o.id ? o : x)) : [...model.outlets, o] };
}

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  memoryMode: false,
  model: null,
  activeFloorId: null,
  activeRoomId: null,
  activeOutletId: null,
  scratchObs: LIVE_CASE,
  scratchMeta: { ...S.DEFAULT_META },
  rev: 0,
  priorScale: {},
  learnCounts: {},
  tracerCircuitId: null,
  homes: [],
  syncConfig: null,
  syncStatus: { state: "idle" },

  init: async () => {
    requestPersistence();
    await S.initStorage(); // probe IndexedDB; falls back to in-memory if blocked
    const [model, learnCounts, syncConfig, homes] = await Promise.all([
      S.ensureDefaultHome(),
      S.getSetting<Record<string, number>>("learnCounts", {}),
      S.getSetting<SyncConfig | null>("syncConfig", null),
      S.listHomes(),
    ]);
    set({
      model, ready: true, memoryMode: S.isMemoryMode(), learnCounts, syncConfig, homes,
      priorScale: priorScaleFromCounts(learnCounts),
      activeFloorId: model.floors[0]?.id ?? null,
      scratchMeta: { ...model.home.defaultMeta },
    });
  },

  refreshHomes: async () => set({ homes: await S.listHomes() }),

  createHomeAndSwitch: async (name) => {
    const model = await S.createHome(name);
    set({ model, homes: await S.listHomes(), activeFloorId: model.floors[0]?.id ?? null, activeRoomId: null, activeOutletId: null, rev: get().rev + 1, scratchMeta: { ...model.home.defaultMeta } });
  },

  switchHome: async (homeId) => {
    const model = await S.loadHomeModel(homeId);
    if (!model) return;
    set({ model, activeFloorId: model.floors[0]?.id ?? null, activeRoomId: null, activeOutletId: null, rev: get().rev + 1, scratchMeta: { ...model.home.defaultMeta } });
  },

  renameCurrentHome: async (name) => {
    const home = get().model?.home;
    if (!home) return;
    await S.renameHome(home.id, name);
    await get().reloadModel(home.id);
    set({ homes: await S.listHomes() });
  },

  deleteHomeAndSwitch: async (homeId) => {
    await S.deleteHome(homeId);
    const next = await S.ensureDefaultHome();
    set({ model: next, homes: await S.listHomes(), activeFloorId: next.floors[0]?.id ?? null, activeRoomId: null, activeOutletId: null, rev: get().rev + 1 });
  },

  setSyncConfig: async (config) => {
    await S.setSetting("syncConfig", config);
    set({ syncConfig: config });
  },

  syncNow: async () => {
    const { syncConfig, model } = get();
    if (!syncConfigured(syncConfig) || !model) { set({ syncStatus: { state: "error", message: "No sync endpoint configured." } }); return; }
    set({ syncStatus: { state: "syncing" } });
    try {
      const local = await S.exportHome(model.home.id);
      if (!local) throw new Error("Nothing to sync.");
      const remote = await pullHome(syncConfig, model.home.id);
      if (newerDoc(local, remote) === "remote" && remote) {
        await S.importHome(remote);
        await get().reloadModel(model.home.id);
        set({ syncStatus: { state: "ok", message: "Pulled newer remote copy.", at: new Date().toISOString() }, homes: await S.listHomes() });
      } else {
        await pushHome(syncConfig, local);
        set({ syncStatus: { state: "ok", message: "Pushed local copy.", at: new Date().toISOString() } });
      }
    } catch (e) {
      set({ syncStatus: { state: "error", message: (e as Error).message } });
    }
  },

  reloadModel: async (homeId) => {
    const id = homeId ?? get().model?.home.id;
    if (!id) return;
    const model = await S.loadHomeModel(id);
    if (model) set((st) => ({ model, rev: st.rev + 1 }));
  },

  selectFloor: (id) => set({ activeFloorId: id, activeRoomId: null }),
  selectRoom: (id) => set({ activeRoomId: id }),
  selectOutlet: (id) => set({ activeOutletId: id }),

  addFloor: async (name, level) => {
    const model = get().model!;
    const f: FloorNode = { id: S.uid(), homeId: model.home.id, level, name, createdAt: S.nowISO(), updatedAt: S.nowISO() };
    await S.putFloor(f);
    set((st) => ({ model: { ...st.model!, floors: [...st.model!.floors, f].sort((a, b) => a.level - b.level) }, activeFloorId: f.id, rev: st.rev + 1 }));
    return f.id;
  },

  addRoom: async (floorId, name, width_m = 4, depth_m = 3) => {
    const model = get().model!;
    const onFloor = model.rooms.filter((r) => r.floorId === floorId);
    const r: RoomNode = {
      id: S.uid(), floorId, name, width_m, depth_m,
      floorOffset: { x: (onFloor.length % 3) * (width_m + 1), y: Math.floor(onFloor.length / 3) * (depth_m + 1) },
      createdAt: S.nowISO(), updatedAt: S.nowISO(),
    };
    await S.putRoom(r);
    set((st) => ({ model: { ...st.model!, rooms: [...st.model!.rooms, r] }, activeRoomId: r.id, rev: st.rev + 1 }));
    return r.id;
  },

  updateRoom: async (room) => {
    await S.putRoom(room);
    set((st) => ({ model: { ...st.model!, rooms: st.model!.rooms.map((r) => (r.id === room.id ? room : r)) }, rev: st.rev + 1 }));
  },

  removeRoom: async (id) => {
    await S.deleteRoom(id);
    set((st) => ({
      model: { ...st.model!, rooms: st.model!.rooms.filter((r) => r.id !== id), outlets: st.model!.outlets.filter((o) => o.roomId !== id) },
      activeRoomId: st.activeRoomId === id ? null : st.activeRoomId, rev: st.rev + 1,
    }));
  },

  addCircuit: async (c) => {
    const model = get().model!;
    const circuit: CircuitNode = { ...c, id: S.uid(), homeId: model.home.id };
    await S.putCircuit(circuit);
    set((st) => ({ model: { ...st.model!, circuits: [...st.model!.circuits, circuit] }, rev: st.rev + 1 }));
    return circuit.id;
  },

  updateCircuit: async (c) => {
    await S.putCircuit(c);
    set((st) => ({ model: { ...st.model!, circuits: st.model!.circuits.map((x) => (x.id === c.id ? c : x)) }, rev: st.rev + 1 }));
  },

  addOutlet: async (roomId, position, label, type = "DUPLEX") => {
    const model = get().model!;
    const n = model.outlets.filter((o) => o.roomId === roomId).length + 1;
    const o: OutletNode = {
      id: S.uid(), roomId, circuitId: null, label: label ?? `Outlet ${n}`, type, position,
      observation: null, inference: null, photos: [], createdAt: S.nowISO(), updatedAt: S.nowISO(),
    };
    await S.putOutlet(o);
    set((st) => ({ model: replaceOutlet(st.model!, o), activeOutletId: o.id, rev: st.rev + 1 }));
    return o.id;
  },

  updateOutlet: async (o) => {
    await S.putOutlet(o);
    set((st) => ({ model: replaceOutlet(st.model!, o), rev: st.rev + 1 }));
  },

  removeOutlet: async (id) => {
    await S.deleteOutlet(id);
    set((st) => ({ model: { ...st.model!, outlets: st.model!.outlets.filter((o) => o.id !== id) }, activeOutletId: st.activeOutletId === id ? null : st.activeOutletId, rev: st.rev + 1 }));
  },

  measureOutlet: async (id, obs, metaOverride) => {
    const st = get();
    const model = st.model!;
    const outlet = model.outlets.find((o) => o.id === id);
    if (!outlet) return;
    const meta: Meta = { ...model.home.defaultMeta, ...outlet.metaOverride, ...metaOverride };
    const inference = tribunal(obs, meta, { priorScale: get().priorScale });
    const updated: OutletNode = { ...outlet, observation: obs, inference, metaOverride: { ...outlet.metaOverride, ...metaOverride }, updatedAt: S.nowISO() };
    await S.putOutlet(updated);
    set((s) => ({ model: replaceOutlet(s.model!, updated), rev: s.rev + 1 }));
  },

  setScratchObs: (obs) => set({ scratchObs: obs }),
  setScratchMeta: (meta) => set((st) => ({ scratchMeta: { ...st.scratchMeta, ...meta } })),
  loadLiveCase: () => set({ scratchObs: { ...LIVE_CASE } }),

  importDoc: async (doc) => {
    const homeId = await S.importHome(doc);
    await get().reloadModel(homeId);
    set({ activeFloorId: get().model?.floors[0]?.id ?? null });
  },

  // ── Active-learning ──────────────────────────────────────────────────────
  recordGroundTruth: async (outletId, actualFaultId, note) => {
    const st = get();
    const model = st.model!;
    const outlet = model.outlets.find((o) => o.id === outletId);
    if (!outlet) return;
    const predicted = outlet.inference?.topFault ?? "";
    await S.addFeedback({ outletId, predictedFault: predicted, actualFault: actualFaultId, note: note ?? "" });
    // Count-based Dirichlet update: increment the confirmed fault's count and
    // re-derive the per-fault prior scale from the full count vector.
    const learnCounts = { ...st.learnCounts, [actualFaultId]: (st.learnCounts[actualFaultId] ?? 0) + 1 };
    const priorScale = priorScaleFromCounts(learnCounts);
    await S.setSetting("learnCounts", learnCounts);
    set({ learnCounts, priorScale });
    // Re-run engine so the outlet's cached inference reflects new priors immediately
    if (outlet.observation) await get().measureOutlet(outletId, outlet.observation);
  },

  resetLearning: async () => {
    await S.setSetting("learnCounts", {});
    set({ learnCounts: {}, priorScale: {} });
  },

  // ── Photo management ─────────────────────────────────────────────────────
  addOutletPhoto: async (outletId, dataUrl, caption) => {
    const model = get().model!;
    const outlet = model.outlets.find((o) => o.id === outletId);
    if (!outlet) return;
    const photo: PhotoRef = { id: S.uid(), dataUrl, caption, takenAt: S.nowISO() };
    await get().updateOutlet({ ...outlet, photos: [...outlet.photos, photo] });
  },

  removeOutletPhoto: async (outletId, photoId) => {
    const model = get().model!;
    const outlet = model.outlets.find((o) => o.id === outletId);
    if (!outlet) return;
    await get().updateOutlet({ ...outlet, photos: outlet.photos.filter((p) => p.id !== photoId) });
  },

  // ── Circuit tracer ───────────────────────────────────────────────────────
  startTracer: (circuitId) => set({ tracerCircuitId: circuitId }),
  stopTracer: () => set({ tracerCircuitId: null }),
  assignOutletToTracer: async (outletId) => {
    const st = get();
    if (!st.tracerCircuitId) return;
    const model = st.model!;
    const outlet = model.outlets.find((o) => o.id === outletId);
    if (!outlet) return;
    await get().updateOutlet({ ...outlet, circuitId: st.tracerCircuitId });
  },
}));

/** Convenience selector: analyse the scratch (free) observation. */
export const analyzeScratch = (obs: Observation, meta: Meta) => analyzeOutlet(obs, meta);
export { db };
