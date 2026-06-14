import { describe, it, expect } from "vitest";
import { outletWorldPos, nearestEdge, roomEdges, polygonBBox, type RoomNode } from "../src/core";

const rect: RoomNode = { id: "r", floorId: "f", name: "R", width_m: 4, depth_m: 3, floorOffset: { x: 1, y: 1 }, createdAt: "", updatedAt: "" };

describe("room geometry (rectangle + polygon)", () => {
  it("rectangle N-wall midpoint", () => {
    expect(outletWorldPos(rect, { wallId: "N", offset: 0.5 })).toEqual({ x: 3, y: 1 });
  });
  it("rectangle E-wall midpoint", () => {
    expect(outletWorldPos(rect, { wallId: "E", offset: 0.5 })).toEqual({ x: 5, y: 2.5 });
  });
  it("polygon (L-room) exposes one edge per side", () => {
    const poly: RoomNode = { ...rect, polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 0, y: 3 }] };
    expect(roomEdges(poly).length).toBe(6);
    // edge 0 = (1,1)->(5,1) in world; mid → (3,1)
    expect(outletWorldPos(poly, { wallId: "N", offset: 0.5, edge: 0 })).toEqual({ x: 3, y: 1 });
  });
  it("nearestEdge snaps a point to a valid edge + offset", () => {
    const ne = nearestEdge(rect, { x: 3, y: 0.9 });
    expect(ne.edge).toBe(0);
    expect(ne.offset).toBeGreaterThanOrEqual(0);
    expect(ne.offset).toBeLessThanOrEqual(1);
  });
  it("polygonBBox returns width/depth", () => {
    expect(polygonBBox([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }])).toEqual({ width_m: 4, depth_m: 3 });
  });
});
