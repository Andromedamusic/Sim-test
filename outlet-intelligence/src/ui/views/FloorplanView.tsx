/* ════════════════════════════════════════════════════════════════════════════
   MAP — recursive spatial editor. Draw rectangular rooms on a floor, place
   outlets on walls, tap one to measure it. Outlet rings are colour-coded by the
   engine verdict. Floors compose the home; the home rolls up on the Home tab.
   Touch + mouse via Pointer Events; pan by drag, zoom by wheel / ± controls.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useMemo, useRef, useState } from "react";
import { useStore } from "../../state/store";
import { tribunal, type OutletNode, type RoomNode, type WallId, type Observation, type Meta } from "../../core";
import { C, mono, VERDICT_COLOR } from "../theme";
import { Card, Field, NumberInput, TextInput, Select, TriToggle, Sheet, Row, Bar } from "../components";

const PAD = 1.2; // metres of padding around content

export function FloorplanView({ onDiagnose }: { onDiagnose: () => void }) {
  const { model, activeFloorId, selectFloor, addFloor, addRoom, activeRoomId, selectRoom } = useStore();
  const [mode, setMode] = useState<"select" | "addOutlet">("select");
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [sheetOutlet, setSheetOutlet] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  if (!model) return null;
  const floors = model.floors;
  const floorId = activeFloorId ?? floors[0]?.id ?? null;
  const rooms = model.rooms.filter((r) => r.floorId === floorId);
  const outletsByRoom = (rid: string) => model.outlets.filter((o) => o.roomId === rid);

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

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* floor + tools */}
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
            <button onClick={() => setView({ zoom: 1, panX: 0, panY: 0 })} style={tool(C.dim)}>⤢ Fit</button>
            <button onClick={() => setView((v) => ({ ...v, zoom: Math.min(v.zoom * 1.25, 8) }))} style={tool(C.dim)}>＋</button>
            <button onClick={() => setView((v) => ({ ...v, zoom: Math.max(v.zoom / 1.25, 0.4) }))} style={tool(C.dim)}>－</button>
          </div>
        </div>
        <div style={{ color: C.dimmer, fontSize: 10, fontFamily: mono, marginTop: 8 }}>
          {mode === "addOutlet" ? "Tap inside a room near a wall to drop an outlet." : "Tap a room to select · tap an outlet to measure it · drag to pan."}
        </div>
      </Card>

      {/* canvas */}
      <div style={{ background: "#0C0C10", border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", touchAction: "none" }}>
        <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} style={{ width: "100%", height: "min(64vh, 640px)", display: "block", cursor: mode === "addOutlet" ? "crosshair" : "grab" }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onWheel={(e) => setView((v) => ({ ...v, zoom: Math.max(0.4, Math.min(8, v.zoom * (e.deltaY < 0 ? 1.1 : 0.9))) }))}>
          {/* grid */}
          <GridLines bb={bb} />
          {rooms.map((r) => (
            <RoomShape key={r.id} room={r} outlets={outletsByRoom(r.id)} selected={activeRoomId === r.id} />
          ))}
          {rooms.length === 0 && (
            <text x={bb.x + bb.w / 2} y={bb.y + bb.h / 2} fill={C.dim} fontSize={0.5} fontFamily={mono} textAnchor="middle">Tap “+ Room” to begin mapping this floor</text>
          )}
        </svg>
      </div>

      {activeRoomId && <RoomInspector roomId={activeRoomId} />}

      {sheetOutlet && <MeasurementPanel outletId={sheetOutlet} onClose={() => setSheetOutlet(null)} onOpenDiagnose={onDiagnose} />}
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

function GridLines({ bb }: { bb: { x: number; y: number; w: number; h: number } }) {
  const lines: React.ReactNode[] = [];
  const x0 = Math.floor(bb.x), x1 = Math.ceil(bb.x + bb.w), y0 = Math.floor(bb.y), y1 = Math.ceil(bb.y + bb.h);
  for (let x = x0; x <= x1; x++) lines.push(<line key={`v${x}`} x1={x} y1={bb.y} x2={x} y2={bb.y + bb.h} stroke="#17171C" strokeWidth={0.02} />);
  for (let y = y0; y <= y1; y++) lines.push(<line key={`h${y}`} x1={bb.x} y1={y} x2={bb.x + bb.w} y2={y} stroke="#17171C" strokeWidth={0.02} />);
  return <g>{lines}</g>;
}

function RoomShape({ room, outlets, selected }: { room: RoomNode; outlets: OutletNode[]; selected: boolean }) {
  const { x, y } = room.floorOffset;
  return (
    <g>
      <rect x={x} y={y} width={room.width_m} height={room.depth_m} rx={0.08}
        fill={selected ? "#15202E" : "#121217"} stroke={selected ? C.blue : "#3A3A44"} strokeWidth={selected ? 0.06 : 0.035} />
      <text x={x + 0.18} y={y + 0.55} fill={C.dim} fontSize={0.42} fontFamily={mono}>{room.name}</text>
      <text x={x + room.width_m - 0.18} y={y + room.depth_m - 0.22} fill="#3A3A44" fontSize={0.3} fontFamily={mono} textAnchor="end">{room.width_m}×{room.depth_m}m</text>
      {outlets.map((o) => {
        const p = outletXY(o, room);
        const v = o.inference?.verdictCode;
        const color = v ? (VERDICT_COLOR[v] ?? C.dim) : "#52525B";
        const lethal = o.inference?.hold || (o.inference && o.inference.topFault !== "healthy" && (o.inference.ranked[0]?.[1] ?? 0) > 0.4 && ["reversed_pol", "bootleg_gnd", "reverse_bootleg"].includes(o.inference.topFault));
        return (
          <g key={o.id}>
            {lethal && <circle cx={p.x} cy={p.y} r={0.32} fill="none" stroke={C.danger} strokeWidth={0.05} opacity={0.6}><animate attributeName="r" values="0.26;0.4;0.26" dur="1.4s" repeatCount="indefinite" /></circle>}
            <circle cx={p.x} cy={p.y} r={0.2} fill={color} stroke="#0A0A0C" strokeWidth={0.04} />
            <circle cx={p.x} cy={p.y} r={0.085} fill="#0A0A0C" />
          </g>
        );
      })}
    </g>
  );
}

// ── room inspector (rename / resize / delete) ───────────────────────────────
function RoomInspector({ roomId }: { roomId: string }) {
  const { model, updateRoom, removeRoom } = useStore();
  const room = model!.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const set = (patch: Partial<RoomNode>) => updateRoom({ ...room, ...patch });
  return (
    <Card title="ROOM">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
        <Field label="Name"><TextInput value={room.name} onChange={(v) => set({ name: v })} /></Field>
        <Field label="Width (m)"><NumberInput value={room.width_m} onChange={(v) => set({ width_m: Math.max(1, parseFloat(v) || 1) })} /></Field>
        <Field label="Depth (m)"><NumberInput value={room.depth_m} onChange={(v) => set({ depth_m: Math.max(1, parseFloat(v) || 1) })} /></Field>
        <Field label="Move X (m)"><NumberInput value={room.floorOffset.x} onChange={(v) => set({ floorOffset: { ...room.floorOffset, x: parseFloat(v) || 0 } })} /></Field>
        <Field label="Move Y (m)"><NumberInput value={room.floorOffset.y} onChange={(v) => set({ floorOffset: { ...room.floorOffset, y: parseFloat(v) || 0 } })} /></Field>
      </div>
      <button onClick={() => removeRoom(room.id)} style={{ marginTop: 10, background: "#3A0808", color: "#FECACA", border: "1px solid #991B1B", borderRadius: 7, padding: "7px 11px", fontSize: 11, fontFamily: mono, fontWeight: 700 }}>Delete room</button>
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
            <Select value={outlet.circuitId ?? "—"} options={["—", ...circuits.map((c) => c.breakerLabel), "+ new circuit"]}
              onChange={async (v) => {
                if (v === "—") return updateOutlet({ ...outlet, circuitId: null });
                if (v === "+ new circuit") {
                  const id = await addCircuit({ breakerLabel: `Ckt ${circuits.length + 1}`, breakerSlot: null, ampRating: 15, voltage: 120, isSharedNeutral: false, notes: "" });
                  return updateOutlet({ ...outlet, circuitId: id });
                }
                const c = circuits.find((x) => x.breakerLabel === v);
                if (c) updateOutlet({ ...outlet, circuitId: c.id });
              }} />
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
const chip = (active: boolean): React.CSSProperties => ({ padding: "6px 11px", borderRadius: 7, whiteSpace: "nowrap", border: `1px solid ${active ? C.blue : C.border}`, background: active ? "#1E293B" : "#0E0E12", color: active ? C.text : C.dim, fontSize: 11, fontFamily: mono });
const tool = (color: string, active = false): React.CSSProperties => ({ padding: "7px 11px", borderRadius: 7, border: `1px solid ${color}`, background: active ? color + "22" : "transparent", color, fontSize: 11, fontFamily: mono, fontWeight: 700, whiteSpace: "nowrap" });
