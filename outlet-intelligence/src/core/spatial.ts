/* ════════════════════════════════════════════════════════════════════════════
   SPATIAL DOMAIN MODEL — Home → Floor → Room → Outlet, with Circuit as a
   cross-cutting collection (a circuit spans rooms/floors; referenced by id,
   never nested). Framework-free; this is also the stable dashboard data contract.
   ════════════════════════════════════════════════════════════════════════════ */
import type { Observation, Meta, TribunalResult } from "./types";

export type UUID = string;
export type WallId = "N" | "S" | "E" | "W";
export type OutletType = "DUPLEX" | "GFCI" | "AFCI" | "USB" | "DRYER_240" | "RANGE_240" | "OTHER";

export interface OutletPosition {
  wallId: WallId;
  offset: number; // 0..1 along the wall from its left corner (facing in)
  height_m?: number;
}

export interface PhotoRef {
  id: UUID;
  dataUrl?: string; // compressed JPEG data URL (offline-safe)
  caption?: string;
  takenAt: string;
}

export interface OutletNode {
  id: UUID;
  roomId: UUID;
  circuitId: UUID | null;
  label: string;
  type: OutletType;
  position: OutletPosition;
  observation: Observation | null;
  metaOverride?: Partial<Meta>; // per-outlet meta (e.g. wiring) overriding home defaults
  inference: TribunalResult | null; // cached engine result
  photos: PhotoRef[];
  createdAt: string;
  updatedAt: string;
}

export interface RoomNode {
  id: UUID;
  floorId: UUID;
  name: string;
  width_m: number; // E/W wall length
  depth_m: number; // N/S wall length
  floorOffset: { x: number; y: number }; // position within floor frame (m)
  createdAt: string;
  updatedAt: string;
}

export interface FloorNode {
  id: UUID;
  homeId: UUID;
  level: number; // 0 = basement, 1 = ground, ...
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CircuitNode {
  id: UUID;
  homeId: UUID;
  breakerLabel: string;
  breakerSlot: number | null;
  ampRating: number;
  voltage: 120 | 240;
  isSharedNeutral: boolean;
  notes: string;
}

export interface HomeNode {
  id: UUID;
  name: string;
  address?: string;
  yearBuilt?: number;
  defaultMeta: Meta;
  createdAt: string;
  updatedAt: string;
}

/** Denormalised in-memory aggregate the rollup operates on. */
export interface HomeModel {
  home: HomeNode;
  floors: FloorNode[];
  rooms: RoomNode[];
  circuits: CircuitNode[];
  outlets: OutletNode[];
}

// ─── Health / rollup result types ─────────────────────────────────────────────
export type Grade = "GREEN" | "YELLOW" | "AMBER" | "RED";

export interface OutletHealth {
  outletId: UUID;
  observed: boolean;
  risk: number; // [0,1]
  grade: Grade;
  topFault: string | null;
  verdictCode: string | null;
  lethal: boolean;
  hold: boolean;
}

export interface SystemicFlag {
  type: "ELEVATED_VNG" | "MULTI_OPEN_GROUND" | "WIRING_RUN_REVERSED" | "ERA_COHORT_FAULT";
  scope: "circuit" | "room";
  scopeId: UUID;
  outletIds: UUID[];
  confidence: number;
  urgency: "IMMEDIATE" | "SOON" | "PLANNED";
  description: string;
  remedy: string;
}

export interface RoomHealth {
  roomId: UUID;
  risk: number;
  grade: Grade;
  worstVerdict: string | null;
  outletCount: number;
  unobservedCount: number;
  outlets: OutletHealth[];
}

export interface FloorHealth {
  floorId: UUID;
  risk: number;
  grade: Grade;
  rooms: RoomHealth[];
}

export interface CircuitHealth {
  circuitId: UUID;
  risk: number;
  grade: Grade;
  outletIds: UUID[];
  systemicFlags: SystemicFlag[];
}

export interface RemediationItem {
  rank: number;
  targetType: "OUTLET" | "CIRCUIT" | "ROOM";
  targetId: UUID;
  label: string;
  reason: string;
  urgency: "IMMEDIATE" | "SOON" | "PLANNED";
  score: number;
}

export interface HomeHealth {
  risk: number; // [0,1] aggregate
  grade: Grade;
  safetyHold: boolean;
  unclearedLethalOutletIds: UUID[];
  inspectionCoverage: number; // observed / placed
  floors: FloorHealth[];
  circuits: CircuitHealth[];
  systemicFlags: SystemicFlag[];
  remediation: RemediationItem[];
  computedAt: string;
}
