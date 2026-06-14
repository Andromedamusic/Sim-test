/* ════════════════════════════════════════════════════════════════════════════
   Minimap — tiny absolutely-positioned thumbnail of the current floor.
   Shows room rects + a blue viewport rectangle matching the SVG viewBox.
   ~120×80px, bottom-right corner, click-drag NOT implemented (display only).
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useMemo } from "react";
import type { RoomNode } from "../../../core";
import { C } from "../../theme";

const W = 120;
const H = 80;
const INSET = 4; // px padding inside minimap

export interface MinimapProps {
  rooms: RoomNode[];
  /** Current SVG viewBox: x/y offset + visible width/height in world metres. */
  viewBox: { x: number; y: number; w: number; h: number };
}

export function Minimap({ rooms, viewBox }: MinimapProps) {
  // Compute bounding box of all rooms
  const bounds = useMemo(() => {
    if (!rooms.length) return { x: 0, y: 0, w: 10, h: 8 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of rooms) {
      minX = Math.min(minX, r.floorOffset.x);
      minY = Math.min(minY, r.floorOffset.y);
      maxX = Math.max(maxX, r.floorOffset.x + r.width_m);
      maxY = Math.max(maxY, r.floorOffset.y + r.depth_m);
    }
    const pad = 1;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }, [rooms]);

  const drawW = W - INSET * 2;
  const drawH = H - INSET * 2;

  // Scale world→minimap pixels
  const scaleX = drawW / bounds.w;
  const scaleY = drawH / bounds.h;
  const scale = Math.min(scaleX, scaleY);

  const toMX = (wx: number) => INSET + (wx - bounds.x) * scale;
  const toMY = (wy: number) => INSET + (wy - bounds.y) * scale;

  // Viewport rect in minimap pixel space
  const vx = toMX(viewBox.x);
  const vy = toMY(viewBox.y);
  const vw = viewBox.w * scale;
  const vh = viewBox.h * scale;

  if (!rooms.length) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        right: 12,
        width: W,
        height: H,
        background: "#0C0C1099",
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        overflow: "hidden",
        pointerEvents: "none",
        backdropFilter: "blur(4px)",
      }}
      aria-hidden
    >
      <svg width={W} height={H} style={{ display: "block" }}>
        {/* Room rects */}
        {rooms.map((r) => (
          <rect
            key={r.id}
            x={toMX(r.floorOffset.x)}
            y={toMY(r.floorOffset.y)}
            width={r.width_m * scale}
            height={r.depth_m * scale}
            fill="#1E1E26"
            stroke="#3A3A44"
            strokeWidth={0.8}
            rx={1}
          />
        ))}

        {/* Viewport indicator */}
        <rect
          x={vx}
          y={vy}
          width={Math.max(4, vw)}
          height={Math.max(4, vh)}
          fill={C.blue + "22"}
          stroke={C.blue}
          strokeWidth={1}
          rx={1}
        />
      </svg>
    </div>
  );
}
