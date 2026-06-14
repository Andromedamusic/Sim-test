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
  offset: number; // 0..1 along the wall/edge from its start
  height_m?: number;
  edge?: number; // index into roomEdges() for polygon rooms (overrides wallId)
}

export type Vec2 = { x: number; y: number };

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
  width_m: number; // E/W bounding-box length
  depth_m: number; // N/S bounding-box length
  floorOffset: { x: number; y: number }; // position within floor frame (m)
  /** Optional polygon (local coords, origin = floorOffset) for L-shaped / non-rect rooms. */
  polygon?: Vec2[];
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

/** Portable, version-stamped interchange unit (export/import + dashboard seam). */
export const EXPORT_VERSION = 2;
export interface HomeExportDoc {
  exportVersion: number;
  exportedAt: string;
  engineVersion: string;
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

// ─── Room geometry helpers (rectangle + polygon, shared by editor & viz) ──────
export function rectCorners(r: RoomNode): Vec2[] {
  const { x, y } = r.floorOffset;
  return [{ x, y }, { x: x + r.width_m, y }, { x: x + r.width_m, y: y + r.depth_m }, { x, y: y + r.depth_m }];
}

/** Room outline in WORLD coordinates (polygon if present, else rectangle). */
export function roomPolygonWorld(r: RoomNode): Vec2[] {
  if (r.polygon && r.polygon.length >= 3) return r.polygon.map((p) => ({ x: p.x + r.floorOffset.x, y: p.y + r.floorOffset.y }));
  return rectCorners(r);
}

export function roomEdges(r: RoomNode): Array<{ a: Vec2; b: Vec2 }> {
  const pts = roomPolygonWorld(r);
  return pts.map((p, i) => ({ a: p, b: pts[(i + 1) % pts.length] }));
}

/** World position of an outlet on its room's wall/edge. */
export function outletWorldPos(r: RoomNode, pos: OutletPosition): Vec2 {
  if (r.polygon && r.polygon.length >= 3 && pos.edge != null) {
    const edges = roomEdges(r);
    const e = edges[Math.min(pos.edge, edges.length - 1)];
    return { x: e.a.x + (e.b.x - e.a.x) * pos.offset, y: e.a.y + (e.b.y - e.a.y) * pos.offset };
  }
  const { x: ox, y: oy } = r.floorOffset;
  switch (pos.wallId) {
    case "N": return { x: ox + pos.offset * r.width_m, y: oy };
    case "S": return { x: ox + pos.offset * r.width_m, y: oy + r.depth_m };
    case "W": return { x: ox, y: oy + pos.offset * r.depth_m };
    case "E": return { x: ox + r.width_m, y: oy + pos.offset * r.depth_m };
  }
}

/** Nearest wall/edge to a world point — used when placing an outlet by tap. */
export function nearestEdge(r: RoomNode, w: Vec2): { edge: number; offset: number; wallId: WallId } {
  const edges = roomEdges(r);
  let best = 0, bestD = Infinity, bestOff = 0.5;
  edges.forEach((e, i) => {
    const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((w.x - e.a.x) * dx + (w.y - e.a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = e.a.x + dx * t, py = e.a.y + dy * t;
    const d = (px - w.x) ** 2 + (py - w.y) ** 2;
    if (d < bestD) { bestD = d; best = i; bestOff = t; }
  });
  const wallId: WallId = (["N", "E", "S", "W"] as WallId[])[best % 4] ?? "N";
  return { edge: best, offset: Math.max(0.04, Math.min(0.96, bestOff)), wallId };
}

/** Axis-aligned bounding box of a polygon (local coords) → width/depth. */
export function polygonBBox(poly: Vec2[]): { width_m: number; depth_m: number } {
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
  return { width_m: Math.max(...xs) - Math.min(...xs), depth_m: Math.max(...ys) - Math.min(...ys) };
}
