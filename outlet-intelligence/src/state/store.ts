/* ════════════════════════════════════════════════════════════════════════════
   APP STATE — Zustand. Mirrors the persisted HomeModel in memory and writes
   every mutation through to Dexie. The rollup is derived on read (cheap), never
   cached here, so it can never go stale.
   ════════════════════════════════════════════════════════════════════════════ */
import { create } from "zustand";
import {
  tribunal, analyzeOutlet,
  type Observation, type Meta, type HomeModel, type OutletNode, type RoomNode,
  type FloorNode, type CircuitNode, type OutletPosition, type OutletType, type HomeExportDoc,
} from "../core";
import * as S from "../data/storage";
import { db, requestPersistence } from "../data/db";

const LIVE_CASE: Observation = { VHN: "116", VHG: "15", VNG: "0.5", Gcont: "0.3", frittingObs: true, thermalSlot: "none" };

interface AppState {
  ready: boolean;
  model: HomeModel | null;
  activeFloorId: string | null;
  activeRoomId: string | null;
  activeOutletId: string | null;
  scratchObs: Observation;
  scratchMeta: Meta;
  rev: number; // bump to force rollup recompute consumers

  init: () => Promise<void>;
  reloadModel: (homeId?: string) => Promise<void>;

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
}

function replaceOutlet(model: HomeModel, o: OutletNode): HomeModel {
  const exists = model.outlets.some((x) => x.id === o.id);
  return { ...model, outlets: exists ? model.outlets.map((x) => (x.id === o.id ? o : x)) : [...model.outlets, o] };
}

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  model: null,
  activeFloorId: null,
  activeRoomId: null,
  activeOutletId: null,
  scratchObs: LIVE_CASE,
  scratchMeta: { ...S.DEFAULT_META },
  rev: 0,

  init: async () => {
    requestPersistence();
    const model = await S.ensureDefaultHome();
    set({
      model, ready: true,
      activeFloorId: model.floors[0]?.id ?? null,
      scratchMeta: { ...model.home.defaultMeta },
    });
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
    const inference = tribunal(obs, meta);
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
}));

/** Convenience selector: analyse the scratch (free) observation. */
export const analyzeScratch = (obs: Observation, meta: Meta) => analyzeOutlet(obs, meta);
export { db };
