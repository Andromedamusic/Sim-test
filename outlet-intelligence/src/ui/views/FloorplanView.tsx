/* ════════════════════════════════════════════════════════════════════════════
   MAP — recursive spatial editor. Draw rectangular rooms on a floor, place
   outlets on walls, tap one to measure it. Outlet rings are colour-coded by the
   engine verdict. Floors compose the home; the home rolls up on the Home tab.
   Touch + mouse via Pointer Events; pan by drag, zoom by wheel / ± controls.

   Enhanced:
   - Circuit Selector (chip row) with animated CircuitTrace current-flow lines
   - Heatmap toggle (room fill tinted by worst verdict across outlets)
   - OutletMarker (highlighted / dimmed by circuit selection)
   - Minimap thumbnail (bottom-right)
   - Animated grid lines + SVG vignette
   - Improved empty state with oi-float / oi-pulse
   - Polygon / L-shaped room support:
       • Rooms render as <polygon> using roomPolygonWorld()
       • Outlet placement uses nearestEdge() + outletWorldPos()
       • RoomInspector: "Make L-shaped", vertex handles, "+ vertex", delete vertex, "Reset to rectangle"

   HUD Upgrade:
   - TACTICAL MAP framing with Brackets + holo scan-line
   - Coordinate/scale HUD overlay on canvas
   - Toolbar restyled as crisp HUD controls (mono, letter-spacing, cyan active states)
   - Brighter holo grid major lines; faint vignette; room labels in mono
   - Cinematic empty state
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useMemo, useRef, useState, useCallback } from "react";
import { useStore } from "../../state/store";
import { tribunal, type OutletNode, type RoomNode, type WallId, type Observation, type Meta,
         outletWorldPos, nearestEdge, roomPolygonWorld, polygonBBox, type Vec2 } from "../../core";
import { C, mono, HUD, VERDICT_COLOR, GRADE_COLOR } from "../theme";
import { useReducedMotion } from "../anim";
import { Card, Field, NumberInput, TextInput, Select, TriToggle, Sheet, Row, Bar } from "../components";
import { OutletMarker } from "../viz/floorplan/OutletMarker";
import { CircuitTrace } from "../viz/floorplan/CircuitTrace";
import { Minimap } from "../viz/floorplan/Minimap";
import { PhotoCaptureButton, PhotoStrip } from "../components/photo";
import { Bracket } from "../hud/Bracket";

const PAD = 1.2; // metres of padding around content

// ── grade helpers ────────────────────────────────────────────────────────────
const VERDICT_RANK: Record<string, number> = {
  "SAFETY HOLD": 5,
  CONDEMN: 4,
  DEFECT: 3,
  MINOR: 2,
  INCONCLUSIVE: 1,
  PASS: 0,
};

function worstVerdict(outlets: OutletNode[]): string | null {
  let best: string | null = null;
  let rank = -1;
  for (const o of outlets) {
    if (!o.inference) continue;
    const v = o.inference.verdictCode;
    const r = VERDICT_RANK[v] ?? 0;
    if (r > rank) { rank = r; best = v; }
  }
  return best;
}

function roomGradeColor(outlets: OutletNode[]): string {
  const v = worstVerdict(outlets);
  if (!v) return "#17171C"; // no data — neutral dark tint
  if (v === "SAFETY HOLD" || v === "CONDEMN") return GRADE_COLOR.RED + "28";
  if (v === "DEFECT") return GRADE_COLOR.AMBER + "22";
  if (v === "MINOR") return GRADE_COLOR.YELLOW + "1A";
  if (v === "PASS") return GRADE_COLOR.GREEN + "14";
  return "#17171C";
}

// ── circuit colour helper ────────────────────────────────────────────────────
function circuitColor(outlets: OutletNode[]): string {
  const v = worstVerdict(outlets);
  if (v) return VERDICT_COLOR[v] ?? C.blue;
  return C.blue;
}

// ── point-in-polygon (ray-casting) ───────────────────────────────────────────
function pointInPolygon(pt: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ── vertex drag state ────────────────────────────────────────────────────────
interface VertexDrag {
  vertexIdx: number;
  roomId: string;
}

export function FloorplanView({ onDiagnose }: { onDiagnose: () => void }) {
  const { model, activeFloorId, selectFloor, addFloor, addRoom, activeRoomId, selectRoom } = useStore();
  const [mode, setMode] = useState<"select" | "addOutlet">("select");
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [sheetOutlet, setSheetOutlet] = useState<string | null>(null);
  const [selectedCircuitId, setSelectedCircuitId] = useState<string | "ALL">("ALL");
  const [heatmap, setHeatmap] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Canvas pan drag — null when idle
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // Vertex drag — null when idle; set on pointerdown on a vertex handle
  const vertexDrag = useRef<VertexDrag | null>(null);
  const reduced = useReducedMotion();

  if (!model) return null;
  const floors = model.floors;
  const floorId = activeFloorId ?? floors[0]?.id ?? null;
  const activeFloor = floors.find((f) => f.id === floorId);
  const rooms = model.rooms.filter((r) => r.floorId === floorId);
  const allOutlets = model.outlets;
  const outletsByRoom = (rid: string) => allOutlets.filter((o) => o.roomId === rid);

  // Outlets on this floor
  const floorRoomIds = new Set(rooms.map((r) => r.id));
  const floorOutlets = allOutlets.filter((o) => floorRoomIds.has(o.roomId));

  // Circuits that appear on this floor
  const floorCircuitIds = new Set(floorOutlets.map((o) => o.circuitId).filter((id): id is string => !!id));
  const floorCircuits = model.circuits.filter((c) => floorCircuitIds.has(c.id));

  // ── world coordinate of each outlet (flat map for CircuitTrace) ──────────
  const outletPositionMap = useMemo<Map<string, { x: number; y: number }>>(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const r of rooms) {
      for (const o of outletsByRoom(r.id)) {
        m.set(o.id, outletWorldPos(r, o.position));
      }
    }
    return m;
  }, [rooms, allOutlets]);

  // Outlets belonging to the selected circuit (for trace + highlighting)
  const selectedCircuitOutlets = useMemo<OutletNode[]>(() => {
    if (selectedCircuitId === "ALL") return [];
    return floorOutlets.filter((o) => o.circuitId === selectedCircuitId);
  }, [floorOutlets, selectedCircuitId]);

  const selectedCircuitColor = useMemo(() => {
    if (selectedCircuitId === "ALL") return C.blue;
    return circuitColor(selectedCircuitOutlets);
  }, [selectedCircuitId, selectedCircuitOutlets]);

  // content bounding box (world metres) — respects polygon extents
  const bb = useMemo(() => {
    if (!rooms.length) return { x: 0, y: 0, w: 10, h: 8 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of rooms) {
      const pts = roomPolygonWorld(r);
      for (const p of pts) {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }
    }
    return { x: minX - PAD, y: minY - PAD, w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2 };
  }, [rooms]);

  const vb = { x: bb.x - view.panX, y: bb.y - view.panY, w: bb.w / view.zoom, h: bb.h / view.zoom };

  const toWorld = (e: React.PointerEvent): { x: number; y: number } => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  };

  // ── vertex handle pointer events ─────────────────────────────────────────
  const onVertexPointerDown = useCallback((e: React.PointerEvent, roomId: string, vertexIdx: number) => {
    e.stopPropagation(); // prevent canvas pan
    (e.target as Element).setPointerCapture?.(e.pointerId);
    vertexDrag.current = { vertexIdx, roomId };
  }, []);

  // ── canvas pointer events ─────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    // If a vertex drag was just started via onVertexPointerDown, don't pan
    if (vertexDrag.current) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    // Vertex drag takes priority
    if (vertexDrag.current) {
      const { roomId, vertexIdx } = vertexDrag.current;
      const room = model.rooms.find((r) => r.id === roomId);
      if (!room || !room.polygon) return;
      const w = toWorld(e);
      const localX = w.x - room.floorOffset.x;
      const localY = w.y - room.floorOffset.y;
      const newPoly = room.polygon.map((v, i) => (i === vertexIdx ? { x: localX, y: localY } : v));
      const bbox = polygonBBox(newPoly);
      useStore.getState().updateRoom({
        ...room,
        polygon: newPoly,
        width_m: Math.max(0.5, bbox.width_m),
        depth_m: Math.max(0.5, bbox.depth_m),
      });
      return;
    }

    if (!drag.current) return;
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.current.moved = true;
    if (drag.current.moved) {
      const scale = vb.w / (svgRef.current!.clientWidth || 1);
      setView((v) => ({ ...v, panX: v.panX + dx * scale, panY: v.panY + dy * scale }));
      drag.current.x = e.clientX; drag.current.y = e.clientY;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (vertexDrag.current) {
      vertexDrag.current = null;
      return;
    }
    const wasDrag = drag.current?.moved;
    drag.current = null;
    if (wasDrag) return; // it was a pan, not a tap
    handleTap(toWorld(e));
  };

  const handleTap = (w: { x: number; y: number }) => {
    // hit-test outlets first
    for (const r of rooms) {
      for (const o of outletsByRoom(r.id)) {
        const p = outletWorldPos(r, o.position);
        if ((p.x - w.x) ** 2 + (p.y - w.y) ** 2 < 0.18 ** 2 * (1 / view.zoom + 1)) { setSheetOutlet(o.id); return; }
      }
    }
    // room hit-test — use polygon point-in-polygon for L-shapes
    for (const r of rooms) {
      const poly = roomPolygonWorld(r);
      const inside = pointInPolygon(w, poly);
      if (inside) {
        if (mode === "addOutlet") { placeOutlet(r, w); }
        else selectRoom(r.id);
        return;
      }
    }
    selectRoom(null);
  };

  const placeOutlet = async (r: RoomNode, w: { x: number; y: number }) => {
    const { edge, offset, wallId } = nearestEdge(r, w);
    const id = await useStore.getState().addOutlet(r.id, { wallId, offset, edge });
    setMode("select");
    setSheetOutlet(id);
  };

  const handleZoom = (delta: number) => {
    setView((v) => ({ ...v, zoom: Math.max(0.4, Math.min(8, v.zoom * delta)) }));
  };

  // ── active room (for vertex handles) ─────────────────────────────────────
  const activeRoom = activeRoomId ? model.rooms.find((r) => r.id === activeRoomId) ?? null : null;

  // ── HUD overlay info ──────────────────────────────────────────────────────
  const floorLabel = activeFloor?.name ?? (floorId ? `Floor ${floors.findIndex((f) => f.id === floorId) + 1}` : "FLOOR 1");

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* ── HUD toolbar card ── */}
      <div style={{
        background: HUD.panel,
        border: `1px solid ${HUD.line}`,
        borderRadius: 10,
        padding: "10px 12px",
        position: "relative",
      }}>
        <Bracket color={HUD.cyan} size={10} weight={1.5} opacity={0.6} />

        {/* section label */}
        <div style={{ fontFamily: mono, fontSize: 8, color: HUD.cyan, letterSpacing: 2, fontWeight: 700, marginBottom: 8, opacity: 0.75 }}>
          TACTICAL MAP — CONTROLS
        </div>

        {/* floor chips + main tools */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
            {floors.map((f) => (
              <button key={f.id} onClick={() => selectFloor(f.id)}
                className="oi-press"
                style={hudChip(floorId === f.id)}>
                {f.name}
              </button>
            ))}
            <button onClick={() => addFloor(`Floor ${floors.length + 1}`, floors.length + 1)}
              className="oi-press"
              style={hudChip(false)}>
              + FLOOR
            </button>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => floorId && addRoom(floorId, `Room ${rooms.length + 1}`)}
              className="oi-press"
              style={hudTool(HUD.cyan)}>
              + ROOM
            </button>
            <button
              onClick={() => setMode(mode === "addOutlet" ? "select" : "addOutlet")}
              className="oi-press"
              style={hudTool(mode === "addOutlet" ? C.amber : HUD.dim, mode === "addOutlet")}>
              {mode === "addOutlet" ? "● TAP WALL…" : "+ OUTLET"}
            </button>
            <button
              onClick={() => setHeatmap((h) => !h)}
              className="oi-press"
              style={hudTool(heatmap ? GRADE_COLOR.AMBER : HUD.dim, heatmap)}
              title="Toggle room health heatmap">
              {heatmap ? "◼ HEALTH" : "◻ HEALTH"}
            </button>
            <button onClick={() => setView({ zoom: 1, panX: 0, panY: 0 })} className="oi-press" style={hudTool(HUD.dim)}>⤢ FIT</button>
            <button onClick={() => handleZoom(1.25)} className="oi-press" style={hudTool(HUD.dim)}>＋</button>
            <button onClick={() => handleZoom(0.8)} className="oi-press" style={hudTool(HUD.dim)}>－</button>
          </div>
        </div>

        {/* status hint */}
        <div style={{ color: HUD.dimmer, fontSize: 9, fontFamily: mono, marginTop: 8, letterSpacing: 0.5 }}>
          {mode === "addOutlet"
            ? "▸ TAP INSIDE A ROOM NEAR A WALL TO DROP AN OUTLET"
            : "▸ TAP ROOM TO SELECT · TAP OUTLET TO MEASURE · DRAG TO PAN"}
        </div>

        {/* ── Circuit selector row ── */}
        {floorCircuits.length > 0 && (
          <div style={{ marginTop: 10, borderTop: `1px solid ${HUD.line}`, paddingTop: 10 }}>
            <div style={{ color: HUD.dimmer, fontSize: 8, fontFamily: mono, marginBottom: 6, letterSpacing: 2 }}>CIRCUIT FILTER</div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              <button
                onClick={() => setSelectedCircuitId("ALL")}
                className="oi-press"
                style={circuitChip("ALL", selectedCircuitId, HUD.cyan)}
              >
                ALL
              </button>
              {floorCircuits.map((c) => {
                const cOutlets = floorOutlets.filter((o) => o.circuitId === c.id);
                const col = circuitColor(cOutlets);
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCircuitId(selectedCircuitId === c.id ? "ALL" : c.id)}
                    className="oi-press"
                    style={circuitChip(c.id, selectedCircuitId, col)}
                    title={`${c.ampRating}A · ${cOutlets.length} outlet${cOutlets.length !== 1 ? "s" : ""}`}
                  >
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: col, marginRight: 5, verticalAlign: "middle", boxShadow: `0 0 5px ${col}` }} />
                    {c.breakerLabel}
                    {c.isSharedNeutral && <span style={{ marginLeft: 4, fontSize: 8, opacity: 0.7 }}>MWB</span>}
                  </button>
                );
              })}
            </div>
            {selectedCircuitId !== "ALL" && (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10, fontSize: 9, fontFamily: mono, color: HUD.dim }}>
                <svg width={28} height={8} style={{ display: "inline-block", verticalAlign: "middle" }}>
                  <line x1={0} y1={4} x2={28} y2={4} stroke={selectedCircuitColor} strokeWidth={2} strokeDasharray="4 3" className={reduced ? "" : "oi-flow"} />
                </svg>
                <span>CIRCUIT RUN · {selectedCircuitOutlets.length} OUTLET{selectedCircuitOutlets.length !== 1 ? "S" : ""} ON FLOOR</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── TACTICAL MAP canvas ── */}
      <div style={{
        position: "relative",
        background: "#07090E",
        border: `1px solid ${HUD.lineHi}`,
        borderRadius: 12,
        overflow: "hidden",
        touchAction: "none",
      }}>
        {/* Corner brackets on the canvas frame */}
        <Bracket color={HUD.cyan} size={16} weight={1.5} opacity={0.7} />

        {/* Holo top scan-line */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${HUD.cyan}88, transparent)`,
          zIndex: 4,
          pointerEvents: "none",
        }} />

        {/* Canvas HUD overlay — coordinate / scale readout */}
        <div style={{
          position: "absolute",
          top: 10, left: 14,
          zIndex: 5,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <span style={{ fontFamily: mono, fontSize: 8, color: HUD.cyan, letterSpacing: 2, fontWeight: 700, opacity: 0.85 }}>
            {floorLabel.toUpperCase()}
          </span>
          <span style={{ fontFamily: mono, fontSize: 8, color: HUD.dimmer, letterSpacing: 1 }}>·</span>
          <span style={{ fontFamily: mono, fontSize: 8, color: HUD.dim, letterSpacing: 1 }}>
            {floorOutlets.length} OUTLET{floorOutlets.length !== 1 ? "S" : ""}
          </span>
          <span style={{ fontFamily: mono, fontSize: 8, color: HUD.dimmer, letterSpacing: 1 }}>·</span>
          <span style={{ fontFamily: mono, fontSize: 8, color: HUD.dim, letterSpacing: 1 }}>
            {view.zoom.toFixed(2)}×
          </span>
        </div>

        {/* Mode badge top-right */}
        {mode === "addOutlet" && (
          <div style={{
            position: "absolute",
            top: 10, right: 14,
            zIndex: 5,
            pointerEvents: "none",
            fontFamily: mono,
            fontSize: 8,
            color: C.amber,
            letterSpacing: 2,
            fontWeight: 700,
          }} className={reduced ? "" : "oi-pulse"}>
            ● OUTLET PLACEMENT
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          style={{ width: "100%", height: "min(64vh, 640px)", display: "block", cursor: mode === "addOutlet" ? "crosshair" : "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={(e) => {
            e.preventDefault();
            setView((v) => ({ ...v, zoom: Math.max(0.4, Math.min(8, v.zoom * (e.deltaY < 0 ? 1.1 : 0.9))) }));
          }}
        >
          <defs>
            {/* Radial vignette */}
            <radialGradient id="fp-vignette" cx="50%" cy="50%" r="70%">
              <stop offset="55%" stopColor="#07090E" stopOpacity={0} />
              <stop offset="100%" stopColor="#07090E" stopOpacity={0.68} />
            </radialGradient>
            {/* Holo scan sweep */}
            <linearGradient id="fp-scan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={HUD.cyan} stopOpacity={0.06} />
              <stop offset="100%" stopColor={HUD.cyan} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* ── grid ── */}
          <GridLines bb={bb} reduced={reduced} />

          {/* Faint holo tint on the whole canvas */}
          <rect
            x={vb.x} y={vb.y} width={vb.w} height={vb.h}
            fill="url(#fp-scan)"
            style={{ pointerEvents: "none" }}
          />

          {/* ── circuit trace (behind rooms) ── */}
          {selectedCircuitId !== "ALL" && (
            <CircuitTrace
              outlets={selectedCircuitOutlets}
              positions={outletPositionMap}
              color={selectedCircuitColor}
            />
          )}

          {/* ── rooms ── */}
          {rooms.map((r) => {
            const outs = outletsByRoom(r.id);
            const heatFill = heatmap ? roomGradeColor(outs) : null;
            return (
              <RoomShape
                key={r.id}
                room={r}
                outlets={outs}
                selected={activeRoomId === r.id}
                heatFill={heatFill}
                selectedCircuitId={selectedCircuitId}
                onTapOutlet={setSheetOutlet}
              />
            );
          })}

          {/* ── vertex handles for the selected polygon room ── */}
          {activeRoom && activeRoom.polygon && activeRoom.polygon.length >= 3 && (
            <VertexHandles
              room={activeRoom}
              onVertexPointerDown={onVertexPointerDown}
            />
          )}

          {/* ── vignette overlay (purely decorative) ── */}
          <rect
            x={vb.x} y={vb.y} width={vb.w} height={vb.h}
            fill="url(#fp-vignette)"
            style={{ pointerEvents: "none" }}
          />

          {/* ── empty state ── */}
          {rooms.length === 0 && (
            <g className={reduced ? "" : "oi-float"} style={{ transformOrigin: `${bb.x + bb.w / 2}px ${bb.y + bb.h / 2}px` }}>
              {/* Crosshair reticle */}
              <line x1={bb.x + bb.w / 2 - 0.6} y1={bb.y + bb.h / 2} x2={bb.x + bb.w / 2 + 0.6} y2={bb.y + bb.h / 2} stroke={HUD.cyan} strokeWidth={0.025} opacity={0.25} />
              <line x1={bb.x + bb.w / 2} y1={bb.y + bb.h / 2 - 0.6} x2={bb.x + bb.w / 2} y2={bb.y + bb.h / 2 + 0.6} stroke={HUD.cyan} strokeWidth={0.025} opacity={0.25} />
              <rect
                x={bb.x + bb.w / 2 - 0.5} y={bb.y + bb.h / 2 - 0.5}
                width={1} height={1}
                fill="none"
                stroke={HUD.cyan}
                strokeWidth={0.03}
                opacity={0.15}
              />
              <text
                x={bb.x + bb.w / 2}
                y={bb.y + bb.h / 2 - 0.22}
                fill={HUD.cyan}
                fontSize={0.5}
                fontFamily={mono}
                textAnchor="middle"
                letterSpacing={0.04}
                opacity={0.7}
              >
                NO FLOOR DATA
              </text>
              <text
                x={bb.x + bb.w / 2}
                y={bb.y + bb.h / 2 + 0.38}
                fill={HUD.dim}
                fontSize={0.32}
                fontFamily={mono}
                textAnchor="middle"
                letterSpacing={0.02}
              >
                tap + ROOM to begin mapping this floor
              </text>
              {/* Pulsing dot */}
              <circle
                cx={bb.x + bb.w / 2}
                cy={bb.y + bb.h / 2 + 1.1}
                r={0.15}
                fill={HUD.cyan}
                className={reduced ? "" : "oi-pulse"}
                opacity={0.6}
              />
            </g>
          )}
        </svg>

        {/* ── minimap ── */}
        <Minimap rooms={rooms} viewBox={vb} />
      </div>

      {activeRoomId && <RoomInspector roomId={activeRoomId} />}

      {sheetOutlet && (
        <MeasurementPanel
          outletId={sheetOutlet}
          onClose={() => setSheetOutlet(null)}
          onOpenDiagnose={onDiagnose}
        />
      )}
    </div>
  );
}

// ── vertex handles overlay ────────────────────────────────────────────────────
interface VertexHandlesProps {
  room: RoomNode;
  onVertexPointerDown: (e: React.PointerEvent, roomId: string, idx: number) => void;
}

function VertexHandles({ room, onVertexPointerDown }: VertexHandlesProps) {
  if (!room.polygon || room.polygon.length < 3) return null;
  const worldPts = roomPolygonWorld(room);
  const handleR = 0.14; // radius in world metres

  return (
    <g style={{ pointerEvents: "all" }}>
      {worldPts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={handleR}
          fill={HUD.cyan}
          stroke="#07090E"
          strokeWidth={0.04}
          style={{ cursor: "move", filter: `drop-shadow(0 0 3px ${HUD.cyan}99)` }}
          onPointerDown={(e) => onVertexPointerDown(e, room.id, i)}
        />
      ))}
    </g>
  );
}

// ── grid lines ──────────────────────────────────────────────────────────────
function GridLines({ bb, reduced }: { bb: { x: number; y: number; w: number; h: number }; reduced: boolean }) {
  const lines: React.ReactNode[] = [];
  const x0 = Math.floor(bb.x), x1 = Math.ceil(bb.x + bb.w);
  const y0 = Math.floor(bb.y), y1 = Math.ceil(bb.y + bb.h);
  for (let x = x0; x <= x1; x++) {
    const major = x % 5 === 0;
    lines.push(
      <line
        key={`v${x}`}
        x1={x} y1={bb.y} x2={x} y2={bb.y + bb.h}
        stroke={major ? `${HUD.cyan}28` : "#15181F"}
        strokeWidth={major ? 0.035 : 0.018}
      />
    );
  }
  for (let y = y0; y <= y1; y++) {
    const major = y % 5 === 0;
    lines.push(
      <line
        key={`h${y}`}
        x1={bb.x} y1={y} x2={bb.x + bb.w} y2={y}
        stroke={major ? `${HUD.cyan}28` : "#15181F"}
        strokeWidth={major ? 0.035 : 0.018}
      />
    );
  }
  return <g aria-hidden>{lines}</g>;
}

// ── room shape ──────────────────────────────────────────────────────────────
interface RoomShapeProps {
  room: RoomNode;
  outlets: OutletNode[];
  selected: boolean;
  heatFill: string | null;
  selectedCircuitId: string | "ALL";
  onTapOutlet: (id: string) => void;
}

function RoomShape({ room, outlets, selected, heatFill, selectedCircuitId, onTapOutlet }: RoomShapeProps) {
  const worldPts = roomPolygonWorld(room);
  const pointsAttr = worldPts.map((p) => `${p.x},${p.y}`).join(" ");

  // Label anchor: bounding-box top-left for consistent placement
  const xs = worldPts.map((p) => p.x);
  const ys = worldPts.map((p) => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const maxX = Math.max(...xs), maxY = Math.max(...ys);

  return (
    <g>
      {/* Base room polygon */}
      <polygon
        points={pointsAttr}
        fill={selected ? "#0D1A2A" : "#0C0F16"}
        stroke={selected ? HUD.cyan : HUD.line}
        strokeWidth={selected ? 0.06 : 0.03}
        strokeLinejoin="round"
        style={{ transition: "fill 0.35s, stroke 0.25s", filter: selected ? `drop-shadow(0 0 4px ${HUD.cyan}55)` : undefined }}
      />

      {/* Selection inner highlight */}
      {selected && (
        <polygon
          points={pointsAttr}
          fill="none"
          stroke={HUD.cyan}
          strokeWidth={0.025}
          strokeLinejoin="round"
          opacity={0.25}
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Heatmap tint overlay */}
      {heatFill && (
        <polygon
          points={pointsAttr}
          fill={heatFill}
          style={{ pointerEvents: "none", transition: "fill 0.45s" }}
        />
      )}

      {/* Room label in mono */}
      <text x={minX + 0.18} y={minY + 0.52} fill={selected ? HUD.cyan : HUD.dim} fontSize={0.38} fontFamily={mono} letterSpacing={0.02} style={{ transition: "fill 0.25s" }}>{room.name.toUpperCase()}</text>
      <text
        x={maxX - 0.18}
        y={maxY - 0.2}
        fill={HUD.dimmer}
        fontSize={0.27}
        fontFamily={mono}
        textAnchor="end"
        letterSpacing={0.01}
      >
        {room.width_m.toFixed(1)}×{room.depth_m.toFixed(1)}m
      </text>

      {/* Outlets — using OutletMarker */}
      {outlets.map((o) => {
        const p = outletWorldPos(room, o.position);
        const highlighted = selectedCircuitId !== "ALL" && o.circuitId === selectedCircuitId;
        const dimmed = selectedCircuitId !== "ALL" && o.circuitId !== selectedCircuitId;
        return (
          <OutletMarker
            key={o.id}
            outlet={o}
            x={p.x}
            y={p.y}
            highlighted={highlighted}
            dimmed={dimmed}
            onTap={() => onTapOutlet(o.id)}
          />
        );
      })}
    </g>
  );
}

// ── room inspector (rename / resize / delete / polygon) ──────────────────────
function RoomInspector({ roomId }: { roomId: string }) {
  const { model, updateRoom, removeRoom } = useStore();
  const room = model!.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const set = (patch: Partial<RoomNode>) => updateRoom({ ...room, ...patch });

  // Keyboard/screen-reader path for adding an outlet without the SVG canvas:
  // distribute new outlets around the four walls.
  const addOutletHere = () => {
    const here = model!.outlets.filter((o) => o.roomId === room.id);
    const walls: WallId[] = ["N", "E", "S", "W"];
    const wall = walls[here.length % 4];
    const onWall = here.filter((o) => o.position.wallId === wall).length;
    void useStore.getState().addOutlet(room.id, { wallId: wall, offset: Math.min(0.9, 0.2 + onWall * 0.2) });
  };

  // ── polygon actions ─────────────────────────────────────────────────────
  const makeLShaped = () => {
    const w = room.width_m, d = room.depth_m;
    const poly: Vec2[] = [
      { x: 0,       y: 0 },
      { x: w * 0.5, y: 0 },
      { x: w * 0.5, y: d * 0.5 },
      { x: w,       y: d * 0.5 },
      { x: w,       y: d },
      { x: 0,       y: d },
    ];
    const bbox = polygonBBox(poly);
    updateRoom({ ...room, polygon: poly, width_m: Math.max(0.5, bbox.width_m), depth_m: Math.max(0.5, bbox.depth_m) });
  };

  const resetToRect = () => {
    updateRoom({ ...room, polygon: undefined });
  };

  const addVertex = () => {
    if (!room.polygon || room.polygon.length < 3) return;
    const poly = room.polygon;
    let bestLen = -1, bestIdx = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const len = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      if (len > bestLen) { bestLen = len; bestIdx = i; }
    }
    const a = poly[bestIdx], b = poly[(bestIdx + 1) % poly.length];
    const mid: Vec2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const newPoly = [...poly.slice(0, bestIdx + 1), mid, ...poly.slice(bestIdx + 1)];
    const bbox = polygonBBox(newPoly);
    updateRoom({ ...room, polygon: newPoly, width_m: Math.max(0.5, bbox.width_m), depth_m: Math.max(0.5, bbox.depth_m) });
  };

  const deleteVertex = (idx: number) => {
    if (!room.polygon || room.polygon.length <= 3) return;
    const newPoly = room.polygon.filter((_, i) => i !== idx);
    const bbox = polygonBBox(newPoly);
    updateRoom({ ...room, polygon: newPoly, width_m: Math.max(0.5, bbox.width_m), depth_m: Math.max(0.5, bbox.depth_m) });
  };

  const isPolygon = !!(room.polygon && room.polygon.length >= 3);

  return (
    <div style={{
      background: HUD.panel,
      border: `1px solid ${HUD.lineHi}`,
      borderRadius: 10,
      padding: "12px 14px",
      position: "relative",
    }} className="oi-fadeup">
      <Bracket color={HUD.cyan} size={8} weight={1.5} opacity={0.5} />

      <div style={{ fontFamily: mono, fontSize: 8, color: HUD.cyan, letterSpacing: 2, fontWeight: 700, marginBottom: 10, opacity: 0.8 }}>
        ROOM — {room.name.toUpperCase()}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
        <Field label="Name"><TextInput value={room.name} onChange={(v) => set({ name: v })} /></Field>
        <Field label="Width (m)"><NumberInput value={room.width_m} onChange={(v) => set({ width_m: Math.max(1, parseFloat(v) || 1) })} /></Field>
        <Field label="Depth (m)"><NumberInput value={room.depth_m} onChange={(v) => set({ depth_m: Math.max(1, parseFloat(v) || 1) })} /></Field>
        <Field label="Move X (m)"><NumberInput value={room.floorOffset.x} onChange={(v) => set({ floorOffset: { ...room.floorOffset, x: parseFloat(v) || 0 } })} /></Field>
        <Field label="Move Y (m)"><NumberInput value={room.floorOffset.y} onChange={(v) => set({ floorOffset: { ...room.floorOffset, y: parseFloat(v) || 0 } })} /></Field>
      </div>

      {/* ── polygon shape controls ── */}
      <div style={{ marginTop: 10, borderTop: `1px solid ${HUD.line}`, paddingTop: 10 }}>
        <div style={{ color: HUD.dimmer, fontSize: 8, fontFamily: mono, marginBottom: 8, letterSpacing: 2 }}>SHAPE</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!isPolygon ? (
            <button onClick={makeLShaped} className="oi-press" style={shapeBtn(HUD.cyan)} title="Convert to L-shaped room (cut NE quadrant)">
              MAKE L-SHAPED
            </button>
          ) : (
            <>
              <button onClick={resetToRect} className="oi-press" style={shapeBtn(HUD.dim)} title="Reset to bounding-box rectangle">
                RESET TO RECT
              </button>
              <button onClick={addVertex} className="oi-press" style={shapeBtn(HUD.cyan)} title="Insert a vertex at the midpoint of the longest edge">
                + VERTEX
              </button>
            </>
          )}
        </div>

        {/* Vertex list with delete buttons */}
        {isPolygon && room.polygon && (
          <div style={{ marginTop: 8 }}>
            <div style={{ color: HUD.dimmer, fontSize: 8, fontFamily: mono, marginBottom: 4, letterSpacing: 1 }}>
              VERTICES ({room.polygon.length}) — drag handles on canvas to reposition
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
              {room.polygon.map((v, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: mono, color: HUD.dim }}>
                  <span style={{ minWidth: 20, color: HUD.dimmer, fontSize: 9 }}>{i}</span>
                  <span>{v.x.toFixed(2)}, {v.y.toFixed(2)} m</span>
                  {room.polygon!.length > 3 && (
                    <button
                      onClick={() => deleteVertex(i)}
                      className="oi-press"
                      style={{ marginLeft: "auto", background: "#3A0808", color: "#FECACA", border: "1px solid #991B1B", borderRadius: 5, padding: "2px 7px", fontSize: 10, fontFamily: mono, cursor: "pointer" }}
                      title="Delete this vertex"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={addOutletHere} className="oi-press" style={{ background: "transparent", color: HUD.cyan, border: `1px solid ${HUD.cyan}`, borderRadius: 7, padding: "7px 11px", fontSize: 11, fontFamily: mono, fontWeight: 700, letterSpacing: 1 }}>
          + OUTLET
        </button>
        <button onClick={() => removeRoom(room.id)} className="oi-press" style={{ background: "#3A0808", color: "#FECACA", border: "1px solid #991B1B", borderRadius: 7, padding: "7px 11px", fontSize: 11, fontFamily: mono, fontWeight: 700 }}>
          DELETE ROOM
        </button>
      </div>
    </div>
  );
}

// ── per-outlet measurement panel ─────────────────────────────────────────────
const THERMALS = ["none", "H-slot", "N-slot", "both", "terminal"] as const;

function MeasurementPanel({ outletId, onClose, onOpenDiagnose }: { outletId: string; onClose: () => void; onOpenDiagnose: () => void }) {
  const { model, measureOutlet, updateOutlet, removeOutlet, addCircuit, updateCircuit } = useStore();
  const outlet = model!.outlets.find((o) => o.id === outletId)!;
  const home = model!.home;
  const [obs, setObs] = useState<Observation>(outlet.observation ?? { thermalSlot: "none" });
  const [label, setLabel] = useState(outlet.label);
  const so = (k: keyof Observation, v: unknown) => setObs((p) => ({ ...p, [k]: v }));

  const meta: Meta = { ...home.defaultMeta, ...outlet.metaOverride };
  const preview = useMemo(() => tribunal(obs, meta), [obs, meta]);
  const circuits = model!.circuits;

  const run = async () => {
    await measureOutlet(outletId, obs);
    if (label !== outlet.label) await updateOutlet({ ...outlet, label, observation: obs });
  };

  return (
    <Sheet open onClose={onClose} title={`📍 ${outlet.label}`}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Field label="Label"><TextInput value={label} onChange={setLabel} /></Field>
          <Field label="Circuit / breaker">
            <Select
              value={outlet.circuitId ?? "—"}
              options={["—", ...circuits.map((c) => c.breakerLabel), "+ new circuit"]}
              onChange={async (v) => {
                if (v === "—") return updateOutlet({ ...outlet, circuitId: null });
                if (v === "+ new circuit") {
                  const id = await addCircuit({ breakerLabel: `Ckt ${circuits.length + 1}`, breakerSlot: null, ampRating: 15, voltage: 120, isSharedNeutral: false, notes: "" });
                  return updateOutlet({ ...outlet, circuitId: id });
                }
                const c = circuits.find((x) => x.breakerLabel === v);
                if (c) updateOutlet({ ...outlet, circuitId: c.id });
              }}
            />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          <Field label="V H→N"><NumberInput value={obs.VHN} onChange={(v) => so("VHN", v)} /></Field>
          <Field label="V H→G"><NumberInput value={obs.VHG} onChange={(v) => so("VHG", v)} /></Field>
          <Field label="V N→G"><NumberInput value={obs.VNG} onChange={(v) => so("VNG", v)} /></Field>
          <Field label="Ground Ω (OL=open)"><NumberInput value={obs.Gcont} onChange={(v) => so("Gcont", v)} /></Field>
          <Field label="Load W"><NumberInput value={obs.loadW} onChange={(v) => so("loadW", v)} /></Field>
          <Field label="V H→N loaded"><NumberInput value={obs.vhnLoaded} onChange={(v) => so("vhnLoaded", v)} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
          <Field label="Fritting?"><TriToggle value={obs.frittingObs} onChange={(v) => so("frittingObs", v)} /></Field>
          <Field label="Thermal"><Select value={(obs.thermalSlot ?? "none") as string} options={THERMALS as unknown as string[]} onChange={(v) => so("thermalSlot", v)} /></Field>
          <Field label="Real ground?"><TriToggle value={obs.hasGroundWire} onChange={(v) => so("hasGroundWire", v)} /></Field>
          <Field label="GFCI trips?"><TriToggle value={obs.gfciTrip} onChange={(v) => so("gfciTrip", v)} /></Field>
        </div>

        {/* photos */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <PhotoCaptureButton outletId={outletId} />
          <span style={{ color: C.dimmer, fontSize: 9.5, fontFamily: mono }}>thermal / faceplate / wiring evidence</span>
        </div>
        <PhotoStrip outletId={outletId} />

        {/* live preview */}
        <div style={{ border: `2px solid ${preview.vColor}`, borderRadius: 10, padding: 10, background: preview.hold ? "#1A0606" : "#0E0E12" }}>
          <div style={{ color: preview.vColor, fontWeight: 800, fontFamily: mono, fontSize: 14 }}>{preview.verdict}</div>
          <div style={{ marginTop: 6 }}><Bar pct={preview.confidence * 100} color={preview.vColor} h={6} /></div>
          <Row label="Leading" val={`${preview.ranked[0] ? (preview.post[preview.topFault] * 100).toFixed(0) : 0}% ${outlet.inference ? "" : "(preview)"} ${preview.topFault}`} monoFont />
          {preview.hold && preview.demand[0] && <div style={{ color: "#FECACA", fontSize: 10, fontFamily: mono, marginTop: 4 }}>▸ {preview.demand[0]}</div>}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={run} className="oi-press" style={{ background: C.amber, color: "#0A0A0C", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 800, fontFamily: mono, fontSize: 13, flex: 1 }}>✓ Save diagnosis</button>
          <button onClick={() => { useStore.getState().setScratchObs(obs); useStore.getState().setScratchMeta(meta); onOpenDiagnose(); }} className="oi-press" style={{ background: "transparent", color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 8, padding: "10px 12px", fontFamily: mono, fontSize: 11.5 }}>Full analysis →</button>
          <button onClick={() => { removeOutlet(outletId); onClose(); }} className="oi-press" style={{ background: "#3A0808", color: "#FECACA", border: "1px solid #991B1B", borderRadius: 8, padding: "10px 12px", fontFamily: mono, fontSize: 11.5 }}>Delete</button>
        </div>
      </div>
    </Sheet>
  );
}

// ── small style helpers ──────────────────────────────────────────────────────
const hudChip = (active: boolean): React.CSSProperties => ({
  padding: "5px 10px",
  borderRadius: 5,
  whiteSpace: "nowrap",
  border: `1px solid ${active ? HUD.cyan : HUD.line}`,
  background: active ? `${HUD.cyan}18` : "transparent",
  color: active ? HUD.cyan : HUD.dim,
  fontSize: 9,
  fontFamily: mono,
  fontWeight: 700,
  letterSpacing: 1,
  cursor: "pointer",
  transition: "background 0.2s, border-color 0.2s, color 0.2s",
  boxShadow: active ? `0 0 8px ${HUD.cyan}33` : undefined,
});

const hudTool = (color: string, active = false): React.CSSProperties => ({
  padding: "5px 10px",
  borderRadius: 5,
  border: `1px solid ${active ? color : `${color}66`}`,
  background: active ? `${color}18` : "transparent",
  color: active ? color : `${color}CC`,
  fontSize: 9,
  fontFamily: mono,
  fontWeight: 700,
  letterSpacing: 1,
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: "background 0.15s, border-color 0.15s, color 0.15s",
  boxShadow: active ? `0 0 8px ${color}33` : undefined,
});

function circuitChip(id: string, selected: string, color: string): React.CSSProperties {
  const active = id === selected;
  return {
    padding: "4px 10px",
    borderRadius: 4,
    whiteSpace: "nowrap",
    border: `1px solid ${active ? color : HUD.line}`,
    background: active ? `${color}20` : "transparent",
    color: active ? color : HUD.dim,
    fontSize: 9,
    fontFamily: mono,
    fontWeight: active ? 800 : 400,
    letterSpacing: active ? 1 : 0.5,
    cursor: "pointer",
    transition: "background 0.2s, border-color 0.2s, color 0.2s",
    boxShadow: active ? `0 0 8px ${color}44` : undefined,
  };
}

const shapeBtn = (color: string): React.CSSProperties => ({
  background: "transparent",
  color,
  border: `1px solid ${color}88`,
  borderRadius: 5,
  padding: "5px 10px",
  fontSize: 9,
  fontFamily: mono,
  fontWeight: 700,
  letterSpacing: 1,
  cursor: "pointer",
  transition: "border-color 0.15s, color 0.15s",
});
