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
   - useReducedMotion respected throughout
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useMemo, useRef, useState } from "react";
import { useStore } from "../../state/store";
import { tribunal, type OutletNode, type RoomNode, type WallId, type Observation, type Meta } from "../../core";
import { C, mono, VERDICT_COLOR, GRADE_COLOR } from "../theme";
import { useReducedMotion } from "../anim";
import { Card, Field, NumberInput, TextInput, Select, TriToggle, Sheet, Row, Bar } from "../components";
import { OutletMarker } from "../viz/floorplan/OutletMarker";
import { CircuitTrace } from "../viz/floorplan/CircuitTrace";
import { Minimap } from "../viz/floorplan/Minimap";
import { PhotoCaptureButton, PhotoStrip } from "../components/photo";

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
  // Use the most alarming verdict's colour
  const v = worstVerdict(outlets);
  if (v) return VERDICT_COLOR[v] ?? C.blue;
  return C.blue;
}

export function FloorplanView({ onDiagnose }: { onDiagnose: () => void }) {
  const { model, activeFloorId, selectFloor, addFloor, addRoom, activeRoomId, selectRoom } = useStore();
  const [mode, setMode] = useState<"select" | "addOutlet">("select");
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [sheetOutlet, setSheetOutlet] = useState<string | null>(null);
  const [selectedCircuitId, setSelectedCircuitId] = useState<string | "ALL">("ALL");
  const [heatmap, setHeatmap] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const reduced = useReducedMotion();

  if (!model) return null;
  const floors = model.floors;
  const floorId = activeFloorId ?? floors[0]?.id ?? null;
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
        m.set(o.id, outletXY(o, r));
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

  // content bounding box (world metres)
  const bb = useMemo(() => {
    if (!rooms.length) return { x: 0, y: 0, w: 10, h: 8 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of rooms) {
      minX = Math.min(minX, r.floorOffset.x); minY = Math.min(minY, r.floorOffset.y);
      maxX = Math.max(maxX, r.floorOffset.x + r.width_m); maxY = Math.max(maxY, r.floorOffset.y + r.depth_m);
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

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
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
    const wasDrag = drag.current?.moved;
    drag.current = null;
    if (wasDrag) return; // it was a pan, not a tap
    handleTap(toWorld(e));
  };

  const handleTap = (w: { x: number; y: number }) => {
    // hit-test outlets first
    for (const r of rooms) {
      for (const o of outletsByRoom(r.id)) {
        const p = outletXY(o, r);
        if ((p.x - w.x) ** 2 + (p.y - w.y) ** 2 < 0.18 ** 2 * (1 / view.zoom + 1)) { setSheetOutlet(o.id); return; }
      }
    }
    // room hit-test
    for (const r of rooms) {
      const inside = w.x >= r.floorOffset.x && w.x <= r.floorOffset.x + r.width_m && w.y >= r.floorOffset.y && w.y <= r.floorOffset.y + r.depth_m;
      if (inside) {
        if (mode === "addOutlet") { placeOutlet(r, w); }
        else selectRoom(r.id);
        return;
      }
    }
    selectRoom(null);
  };

  const placeOutlet = async (r: RoomNode, w: { x: number; y: number }) => {
    // nearest wall + offset
    const dN = w.y - r.floorOffset.y, dS = r.floorOffset.y + r.depth_m - w.y;
    const dW = w.x - r.floorOffset.x, dE = r.floorOffset.x + r.width_m - w.x;
    const m = Math.min(dN, dS, dW, dE);
    let wall: WallId = "N", off = 0.5;
    if (m === dN) { wall = "N"; off = (w.x - r.floorOffset.x) / r.width_m; }
    else if (m === dS) { wall = "S"; off = (w.x - r.floorOffset.x) / r.width_m; }
    else if (m === dW) { wall = "W"; off = (w.y - r.floorOffset.y) / r.depth_m; }
    else { wall = "E"; off = (w.y - r.floorOffset.y) / r.depth_m; }
    const id = await useStore.getState().addOutlet(r.id, { wallId: wall, offset: Math.max(0.04, Math.min(0.96, off)) });
    setMode("select");
    setSheetOutlet(id);
  };

  const handleZoom = (delta: number) => {
    setView((v) => ({ ...v, zoom: Math.max(0.4, Math.min(8, v.zoom * delta)) }));
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* ── floor + tools ── */}
      <Card>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
            {floors.map((f) => (
              <button key={f.id} onClick={() => selectFloor(f.id)} style={chip(floorId === f.id)}>{f.name}</button>
            ))}
            <button onClick={() => addFloor(`Floor ${floors.length + 1}`, floors.length + 1)} style={chip(false)}>+ Floor</button>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => floorId && addRoom(floorId, `Room ${rooms.length + 1}`)} style={tool(C.blue)}>+ Room</button>
            <button onClick={() => setMode(mode === "addOutlet" ? "select" : "addOutlet")} style={tool(mode === "addOutlet" ? C.amber : C.dim, mode === "addOutlet")}>
              {mode === "addOutlet" ? "● Tap a wall…" : "+ Outlet"}
            </button>
            {/* Heatmap toggle */}
            <button onClick={() => setHeatmap((h) => !h)} style={tool(heatmap ? GRADE_COLOR.AMBER : C.dim, heatmap)} title="Toggle room health heatmap">
              {heatmap ? "◼ Health" : "◻ Health"}
            </button>
            <button onClick={() => setView({ zoom: 1, panX: 0, panY: 0 })} style={tool(C.dim)}>⤢ Fit</button>
            <button onClick={() => handleZoom(1.25)} style={tool(C.dim)}>＋</button>
            <button onClick={() => handleZoom(0.8)} style={tool(C.dim)}>－</button>
          </div>
        </div>
        <div style={{ color: C.dimmer, fontSize: 10, fontFamily: mono, marginTop: 8 }}>
          {mode === "addOutlet" ? "Tap inside a room near a wall to drop an outlet." : "Tap a room to select · tap an outlet to measure it · drag to pan."}
        </div>

        {/* ── Circuit selector row ── */}
        {floorCircuits.length > 0 && (
          <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
            <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, marginBottom: 6, letterSpacing: 1 }}>CIRCUIT FILTER</div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              <button
                onClick={() => setSelectedCircuitId("ALL")}
                style={circuitChip("ALL", selectedCircuitId, C.blue)}
              >
                All
              </button>
              {floorCircuits.map((c) => {
                const cOutlets = floorOutlets.filter((o) => o.circuitId === c.id);
                const col = circuitColor(cOutlets);
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCircuitId(selectedCircuitId === c.id ? "ALL" : c.id)}
                    style={circuitChip(c.id, selectedCircuitId, col)}
                    title={`${c.ampRating}A · ${cOutlets.length} outlet${cOutlets.length !== 1 ? "s" : ""}`}
                  >
                    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: col, marginRight: 5, verticalAlign: "middle" }} />
                    {c.breakerLabel}
                    {c.isSharedNeutral && <span style={{ marginLeft: 4, fontSize: 8, opacity: 0.7 }}>MWB</span>}
                  </button>
                );
              })}
            </div>
            {selectedCircuitId !== "ALL" && (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10, fontSize: 10, fontFamily: mono, color: C.dim }}>
                <svg width={28} height={8} style={{ display: "inline-block", verticalAlign: "middle" }}>
                  <line x1={0} y1={4} x2={28} y2={4} stroke={selectedCircuitColor} strokeWidth={2} strokeDasharray="4 3" className={reduced ? "" : "oi-flow"} />
                </svg>
                <span>Animated circuit run · {selectedCircuitOutlets.length} outlet{selectedCircuitOutlets.length !== 1 ? "s" : ""} on this floor</span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── canvas ── */}
      <div style={{ position: "relative", background: "#0C0C10", border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", touchAction: "none" }}>
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
              <stop offset="60%" stopColor="#0C0C10" stopOpacity={0} />
              <stop offset="100%" stopColor="#0C0C10" stopOpacity={0.55} />
            </radialGradient>
          </defs>

          {/* ── grid ── */}
          <GridLines bb={bb} reduced={reduced} />

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

          {/* ── vignette overlay (purely decorative) ── */}
          <rect
            x={vb.x} y={vb.y} width={vb.w} height={vb.h}
            fill="url(#fp-vignette)"
            style={{ pointerEvents: "none" }}
          />

          {/* ── empty state ── */}
          {rooms.length === 0 && (
            <g className={reduced ? "" : "oi-float"} style={{ transformOrigin: `${bb.x + bb.w / 2}px ${bb.y + bb.h / 2}px` }}>
              <text
                x={bb.x + bb.w / 2}
                y={bb.y + bb.h / 2 - 0.3}
                fill={C.dim}
                fontSize={0.55}
                fontFamily={mono}
                textAnchor="middle"
              >
                Tap "+ Room" to begin
              </text>
              <text
                x={bb.x + bb.w / 2}
                y={bb.y + bb.h / 2 + 0.45}
                fill={C.dimmer}
                fontSize={0.38}
                fontFamily={mono}
                textAnchor="middle"
              >
                mapping this floor
              </text>
              {/* Pulsing dot */}
              <circle
                cx={bb.x + bb.w / 2}
                cy={bb.y + bb.h / 2 + 1.2}
                r={0.18}
                fill={C.blue}
                className={reduced ? "" : "oi-pulse"}
                opacity={0.7}
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

// ── geometry helpers ────────────────────────────────────────────────────────
function outletXY(o: OutletNode, r: RoomNode): { x: number; y: number } {
  const { x: ox, y: oy } = r.floorOffset;
  switch (o.position.wallId) {
    case "N": return { x: ox + o.position.offset * r.width_m, y: oy };
    case "S": return { x: ox + o.position.offset * r.width_m, y: oy + r.depth_m };
    case "W": return { x: ox, y: oy + o.position.offset * r.depth_m };
    case "E": return { x: ox + r.width_m, y: oy + o.position.offset * r.depth_m };
  }
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
        stroke={major ? "#1F1F26" : "#17171C"}
        strokeWidth={major ? 0.03 : 0.018}
      />
    );
  }
  for (let y = y0; y <= y1; y++) {
    const major = y % 5 === 0;
    lines.push(
      <line
        key={`h${y}`}
        x1={bb.x} y1={y} x2={bb.x + bb.w} y2={y}
        stroke={major ? "#1F1F26" : "#17171C"}
        strokeWidth={major ? 0.03 : 0.018}
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
  const { x, y } = room.floorOffset;

  return (
    <g>
      {/* Base room rect */}
      <rect
        x={x} y={y}
        width={room.width_m} height={room.depth_m}
        rx={0.08}
        fill={selected ? "#15202E" : "#121217"}
        stroke={selected ? C.blue : "#3A3A44"}
        strokeWidth={selected ? 0.06 : 0.035}
        style={{ transition: "fill 0.35s, stroke 0.25s" }}
      />

      {/* Heatmap tint overlay */}
      {heatFill && (
        <rect
          x={x} y={y}
          width={room.width_m} height={room.depth_m}
          rx={0.08}
          fill={heatFill}
          style={{ pointerEvents: "none", transition: "fill 0.45s" }}
        />
      )}

      <text x={x + 0.18} y={y + 0.55} fill={C.dim} fontSize={0.42} fontFamily={mono}>{room.name}</text>
      <text
        x={x + room.width_m - 0.18}
        y={y + room.depth_m - 0.22}
        fill="#3A3A44"
        fontSize={0.3}
        fontFamily={mono}
        textAnchor="end"
      >
        {room.width_m}×{room.depth_m}m
      </text>

      {/* Outlets — using OutletMarker */}
      {outlets.map((o) => {
        const p = outletXY(o, room);
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

// ── room inspector (rename / resize / delete) ────────────────────────────────
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
  return (
    <Card title="ROOM">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
        <Field label="Name"><TextInput value={room.name} onChange={(v) => set({ name: v })} /></Field>
        <Field label="Width (m)"><NumberInput value={room.width_m} onChange={(v) => set({ width_m: Math.max(1, parseFloat(v) || 1) })} /></Field>
        <Field label="Depth (m)"><NumberInput value={room.depth_m} onChange={(v) => set({ depth_m: Math.max(1, parseFloat(v) || 1) })} /></Field>
        <Field label="Move X (m)"><NumberInput value={room.floorOffset.x} onChange={(v) => set({ floorOffset: { ...room.floorOffset, x: parseFloat(v) || 0 } })} /></Field>
        <Field label="Move Y (m)"><NumberInput value={room.floorOffset.y} onChange={(v) => set({ floorOffset: { ...room.floorOffset, y: parseFloat(v) || 0 } })} /></Field>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={addOutletHere} className="oi-press" style={{ background: "transparent", color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 7, padding: "7px 11px", fontSize: 11, fontFamily: mono, fontWeight: 700 }}>
          + Add outlet
        </button>
        <button onClick={() => removeRoom(room.id)} style={{ background: "#3A0808", color: "#FECACA", border: "1px solid #991B1B", borderRadius: 7, padding: "7px 11px", fontSize: 11, fontFamily: mono, fontWeight: 700 }}>
          Delete room
        </button>
      </div>
    </Card>
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
          <button onClick={run} style={{ background: C.amber, color: "#0A0A0C", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 800, fontFamily: mono, fontSize: 13, flex: 1 }}>✓ Save diagnosis</button>
          <button onClick={() => { useStore.getState().setScratchObs(obs); useStore.getState().setScratchMeta(meta); onOpenDiagnose(); }} style={{ background: "transparent", color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 8, padding: "10px 12px", fontFamily: mono, fontSize: 11.5 }}>Full analysis →</button>
          <button onClick={() => { removeOutlet(outletId); onClose(); }} style={{ background: "#3A0808", color: "#FECACA", border: "1px solid #991B1B", borderRadius: 8, padding: "10px 12px", fontFamily: mono, fontSize: 11.5 }}>Delete</button>
        </div>
      </div>
    </Sheet>
  );
}

// ── small style helpers ──────────────────────────────────────────────────────
const chip = (active: boolean): React.CSSProperties => ({
  padding: "6px 11px",
  borderRadius: 7,
  whiteSpace: "nowrap",
  border: `1px solid ${active ? C.blue : C.border}`,
  background: active ? "#1E293B" : "#0E0E12",
  color: active ? C.text : C.dim,
  fontSize: 11,
  fontFamily: mono,
});

const tool = (color: string, active = false): React.CSSProperties => ({
  padding: "7px 11px",
  borderRadius: 7,
  border: `1px solid ${color}`,
  background: active ? color + "22" : "transparent",
  color,
  fontSize: 11,
  fontFamily: mono,
  fontWeight: 700,
  whiteSpace: "nowrap",
  cursor: "pointer",
});

function circuitChip(id: string, selected: string, color: string): React.CSSProperties {
  const active = id === selected;
  return {
    padding: "5px 10px",
    borderRadius: 999,
    whiteSpace: "nowrap",
    border: `1px solid ${active ? color : C.border}`,
    background: active ? color + "22" : "#0E0E12",
    color: active ? color : C.dim,
    fontSize: 10,
    fontFamily: mono,
    fontWeight: active ? 800 : 400,
    cursor: "pointer",
    transition: "background 0.2s, border-color 0.2s, color 0.2s",
  };
}
