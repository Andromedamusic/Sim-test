/* ════════════════════════════════════════════════════════════════════════════
   PANEL VIEW — visual electrical breaker panel with circuit-level health,
   outlet assignment tracer, and inline circuit editing.

   HUD Upgrade:
   - MAIN PANEL enclosure with Bracket corner chrome + holo top-line
   - Beveled breaker tiles with grade-colored glowing status LEDs
   - Slot numbers, amp/voltage readouts in mono; ⚠ flags styled
   - Selected breaker highlighted with bracket overlay + glow
   - Circuit detail + tracer restyled as HUD panels
   - Two-column real panel layout with column separators
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useMemo, useRef, useState } from "react";
import { useStore } from "../../state/store";
import { rollupHome } from "../../core";
import type { CircuitNode } from "../../core";
import { C, mono, HUD, GRADE_COLOR, VERDICT_COLOR, btn } from "../theme";
import { Card, Pill } from "../components";
import { Bracket } from "../hud/Bracket";
import { useReducedMotion } from "../anim";

// ─── helpers ──────────────────────────────────────────────────────────────────

function clampAmp(v: number): number {
  const valid = [15, 20, 30, 40, 50, 60, 100, 200];
  return valid.reduce((best, n) => (Math.abs(n - v) < Math.abs(best - v) ? n : best), 15);
}

// ─── Breaker tile ─────────────────────────────────────────────────────────────

interface BreakerTileProps {
  circuit: CircuitNode;
  grade: string;
  hasSystemic: boolean;
  selected: boolean;
  tracing: boolean;
  slotNumber: number;
  reduced: boolean;
  onSelect: () => void;
  onUpdate: (c: CircuitNode) => void;
}

// Long-press threshold in ms
const LONG_PRESS_MS = 500;

function BreakerTile({ circuit, grade, hasSystemic, selected, tracing, slotNumber, reduced, onSelect, onUpdate }: BreakerTileProps) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [editingAmp, setEditingAmp] = useState(false);
  const [labelDraft, setLabelDraft] = useState(circuit.breakerLabel);
  const [ampDraft, setAmpDraft] = useState(String(circuit.ampRating));

  // Long-press timer refs
  const labelLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ampLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gradeColor = GRADE_COLOR[grade] ?? HUD.dim;

  function commitLabel() {
    const trimmed = labelDraft.trim();
    if (trimmed && trimmed !== circuit.breakerLabel) {
      onUpdate({ ...circuit, breakerLabel: trimmed });
    }
    setEditingLabel(false);
  }

  function commitAmp() {
    const n = parseInt(ampDraft, 10);
    if (!isNaN(n) && n > 0 && n !== circuit.ampRating) {
      onUpdate({ ...circuit, ampRating: clampAmp(n) });
    }
    setEditingAmp(false);
  }

  function startLabelEdit(e: React.SyntheticEvent) {
    e.stopPropagation();
    setLabelDraft(circuit.breakerLabel);
    setEditingLabel(true);
  }

  function startAmpEdit(e: React.SyntheticEvent) {
    e.stopPropagation();
    setAmpDraft(String(circuit.ampRating));
    setEditingAmp(true);
  }

  const displaySlot = circuit.breakerSlot != null ? circuit.breakerSlot : slotNumber;

  return (
    <div
      onClick={onSelect}
      className="oi-lift oi-press"
      style={{
        position: "relative",
        background: selected
          ? `linear-gradient(160deg, ${gradeColor}18 0%, ${HUD.panel}CC 100%)`
          : `linear-gradient(160deg, #111720 0%, #0B1019 100%)`,
        border: `1px solid ${selected ? gradeColor : tracing ? C.amber : HUD.line}`,
        borderRadius: 6,
        padding: "8px 9px 7px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 5,
        minWidth: 0,
        boxShadow: selected
          ? `0 0 0 1px ${gradeColor}44, 0 0 14px -4px ${gradeColor}55`
          : tracing
          ? `0 0 0 2px ${C.amber}44`
          : "inset 0 1px 0 rgba(255,255,255,0.04)",
        transition: "background 0.25s, border-color 0.2s, box-shadow 0.2s",
      }}
    >
      {/* Selected bracket overlay */}
      {selected && <Bracket color={gradeColor} size={7} weight={1.5} opacity={0.7} />}

      {/* Top row: slot number + warning + LED */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontFamily: mono, fontSize: 8, color: selected ? gradeColor : HUD.dimmer,
          fontWeight: 700, letterSpacing: 1, lineHeight: 1,
          transition: "color 0.2s",
        }}>
          #{String(displaySlot).padStart(2, "0")}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {hasSystemic && (
            <span title="Systemic flag detected" style={{
              fontSize: 9, color: C.warn,
              filter: `drop-shadow(0 0 3px ${C.warn}99)`,
            }}>⚠</span>
          )}
          {/* Grade LED */}
          <div style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: gradeColor,
            boxShadow: reduced ? undefined : `0 0 6px 1px ${gradeColor}99, 0 0 2px ${gradeColor}`,
            transition: "background 0.3s, box-shadow 0.3s",
          }} />
        </div>
      </div>

      {/* Bevel divider */}
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${HUD.line}AA, transparent)`, margin: "0 -2px" }} />

      {/* Label (inline edit on dblclick) */}
      {editingLabel ? (
        <input
          autoFocus
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => { if (e.key === "Enter") commitLabel(); if (e.key === "Escape") setEditingLabel(false); }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#080C13", border: `1px solid ${HUD.lineHi}`, borderRadius: 3,
            padding: "2px 5px", fontSize: 10, fontFamily: mono, color: HUD.text, width: "100%",
          }}
        />
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          <div
            onDoubleClick={startLabelEdit}
            onPointerDown={(e) => {
              e.stopPropagation();
              labelLongPressTimer.current = setTimeout(() => startLabelEdit(e), LONG_PRESS_MS);
            }}
            onPointerUp={() => { if (labelLongPressTimer.current) { clearTimeout(labelLongPressTimer.current); labelLongPressTimer.current = null; } }}
            onPointerLeave={() => { if (labelLongPressTimer.current) { clearTimeout(labelLongPressTimer.current); labelLongPressTimer.current = null; } }}
            title="Double-click or long-press to edit label"
            style={{
              fontFamily: mono, fontSize: 11, fontWeight: 700,
              color: selected ? HUD.text : HUD.dim,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              letterSpacing: 0.2,
              transition: "color 0.2s",
              userSelect: "none",
              flex: 1,
              minWidth: 0,
            }}
          >
            {circuit.breakerLabel}
          </div>
          {/* Pencil affordance — single tap to edit */}
          <button
            onClick={startLabelEdit}
            title="Edit label"
            style={{
              background: "none", border: "none", padding: "2px 3px", cursor: "pointer",
              color: HUD.dimmer, fontSize: 10, lineHeight: 1, flexShrink: 0,
              opacity: 0.6,
            }}
            aria-label="Edit circuit label"
          >✎</button>
        </div>
      )}

      {/* Amp + voltage row */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        {editingAmp ? (
          <input
            autoFocus
            value={ampDraft}
            onChange={(e) => setAmpDraft(e.target.value)}
            onBlur={commitAmp}
            onKeyDown={(e) => { if (e.key === "Enter") commitAmp(); if (e.key === "Escape") setEditingAmp(false); }}
            onClick={(e) => e.stopPropagation()}
            type="number"
            min={1}
            style={{
              background: "#080C13", border: `1px solid ${HUD.lineHi}`, borderRadius: 3,
              padding: "1px 4px", fontSize: 9, fontFamily: mono, color: HUD.text, width: 44,
            }}
          />
        ) : (
          <span
            onDoubleClick={startAmpEdit}
            onPointerDown={(e) => {
              e.stopPropagation();
              ampLongPressTimer.current = setTimeout(() => startAmpEdit(e), LONG_PRESS_MS);
            }}
            onPointerUp={() => { if (ampLongPressTimer.current) { clearTimeout(ampLongPressTimer.current); ampLongPressTimer.current = null; } }}
            onPointerLeave={() => { if (ampLongPressTimer.current) { clearTimeout(ampLongPressTimer.current); ampLongPressTimer.current = null; } }}
            title="Double-click or long-press to edit amperage"
            style={{ fontFamily: mono, fontSize: 10, color: selected ? gradeColor : HUD.dimmer, fontWeight: 700, letterSpacing: 0.5, userSelect: "none", cursor: "pointer" }}
          >
            {circuit.ampRating}A✎
          </span>
        )}
        <span style={{ fontFamily: mono, fontSize: 10, color: HUD.dimmer, letterSpacing: 0.5 }}>{circuit.voltage}V</span>
        {circuit.isSharedNeutral && (
          <span style={{ fontFamily: mono, fontSize: 10, color: C.warn, background: `${C.warn}1A`, padding: "1px 4px", borderRadius: 3, letterSpacing: 0.5 }}>
            MWBC
          </span>
        )}
      </div>

      {/* Tracing indicator bar */}
      {tracing && (
        <div style={{
          height: 2,
          borderRadius: 1,
          background: `linear-gradient(90deg, ${C.amber}00, ${C.amber}, ${C.amber}00)`,
          margin: "0 -2px -2px",
        }} className={reduced ? "" : "oi-shimmer"} />
      )}
    </div>
  );
}

// ─── Circuit detail / tracer panel ───────────────────────────────────────────

interface CircuitDetailProps {
  circuitId: string;
}

function CircuitDetail({ circuitId }: CircuitDetailProps) {
  const model = useStore((s) => s.model!);
  const tracerCircuitId = useStore((s) => s.tracerCircuitId);
  const startTracer = useStore((s) => s.startTracer);
  const stopTracer = useStore((s) => s.stopTracer);
  const assignOutletToTracer = useStore((s) => s.assignOutletToTracer);
  const reduced = useReducedMotion();

  const circuit = model.circuits.find((c) => c.id === circuitId);
  if (!circuit) return null;

  const isTracing = tracerCircuitId === circuitId;
  const assignedOutlets = model.outlets.filter((o) => o.circuitId === circuitId);
  const unassignedOutlets = model.outlets.filter((o) => o.circuitId !== circuitId);

  const rooms = model.rooms;
  function roomName(roomId: string): string {
    return rooms.find((r) => r.id === roomId)?.name ?? "Unknown";
  }
  function circuitLabelOf(id: string): string {
    return model.circuits.find((c) => c.id === id)?.breakerLabel ?? "another circuit";
  }

  return (
    <div className="oi-fadeup" style={{ marginTop: 14, display: "grid", gap: 10 }}>
      {/* Circuit header */}
      <div style={{
        background: HUD.panel,
        border: `1px solid ${HUD.lineHi}`,
        borderRadius: 8,
        padding: "10px 12px",
        position: "relative",
      }}>
        <Bracket color={HUD.cyan} size={7} weight={1.5} opacity={0.5} />
        <div style={{ fontFamily: mono, fontSize: 8, color: HUD.cyan, fontWeight: 700, letterSpacing: 2, marginBottom: 2 }}>
          SELECTED CIRCUIT
        </div>
        <div style={{ fontFamily: mono, fontSize: 14, color: HUD.text, fontWeight: 800, letterSpacing: 0.5 }}>
          {circuit.breakerLabel}
        </div>
        <div style={{ fontFamily: mono, fontSize: 9, color: HUD.dim, marginTop: 2 }}>
          {circuit.ampRating}A · {circuit.voltage}V
          {circuit.isSharedNeutral && <span style={{ color: C.warn, marginLeft: 6 }}>MWBC</span>}
          {circuit.notes && <span style={{ marginLeft: 8, color: HUD.dimmer }}>{circuit.notes}</span>}
        </div>
      </div>

      {/* Assigned outlets */}
      <div style={{
        background: HUD.panel,
        border: `1px solid ${HUD.line}`,
        borderRadius: 8,
        padding: "10px 12px",
        position: "relative",
      }}>
        <div style={{ fontFamily: mono, fontSize: 8, color: HUD.dimmer, letterSpacing: 2, marginBottom: 8 }}>
          OUTLETS ON THIS CIRCUIT
        </div>
        {assignedOutlets.length === 0 ? (
          <div style={{ color: HUD.dimmer, fontFamily: mono, fontSize: 10, padding: "4px 0", letterSpacing: 0.5 }}>
            No outlets assigned. Use the tracer below.
          </div>
        ) : (
          <div className="oi-stagger" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {assignedOutlets.map((o) => {
              const verdictCode = o.inference?.verdictCode;
              const verdictColor = verdictCode ? (VERDICT_COLOR[verdictCode] ?? HUD.dim) : HUD.dimmer;
              return (
                <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${HUD.line}66` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: verdictColor, boxShadow: `0 0 4px ${verdictColor}` }} />
                    <span style={{ fontFamily: mono, fontSize: 11, color: HUD.text, fontWeight: 700 }}>{o.label}</span>
                    <span style={{ fontFamily: mono, fontSize: 9, color: HUD.dim }}>{roomName(o.roomId)}</span>
                  </div>
                  {verdictCode ? (
                    <Pill color={verdictColor}>{verdictCode}</Pill>
                  ) : (
                    <span style={{ fontFamily: mono, fontSize: 9, color: HUD.dimmer, letterSpacing: 1 }}>UNMEASURED</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tracer controls */}
      <div style={{
        background: isTracing ? `${C.amber}0A` : HUD.panel,
        border: `1px solid ${isTracing ? `${C.amber}55` : HUD.line}`,
        borderRadius: 8,
        padding: "10px 12px",
        position: "relative",
        transition: "background 0.3s, border-color 0.3s",
      }}>
        {isTracing && <Bracket color={C.amber} size={8} weight={1.5} opacity={0.7} />}

        <div style={{ fontFamily: mono, fontSize: 8, color: isTracing ? C.amber : HUD.dimmer, letterSpacing: 2, marginBottom: 8, fontWeight: 700 }}>
          CIRCUIT TRACER
        </div>

        {!isTracing ? (
          <div>
            <p style={{ margin: "0 0 10px", fontFamily: mono, fontSize: 10, color: HUD.dim, lineHeight: 1.7, letterSpacing: 0.3 }}>
              Activate the tracer, then tap any unassigned outlet to assign it to this
              circuit. Useful when wiring isn't labelled or panel markings are missing.
            </p>
            <button
              onClick={() => startTracer(circuitId)}
              className="oi-press"
              style={{ ...btn(C.amber) }}
            >
              Trace This Circuit
            </button>
          </div>
        ) : (
          <div>
            <div className={reduced ? "" : "oi-pulse"} style={{ color: C.amber, fontFamily: mono, fontSize: 11, fontWeight: 800, marginBottom: 8, letterSpacing: 1 }}>
              TRACING ACTIVE — TAP AN OUTLET BELOW TO ASSIGN
            </div>
            <p style={{ margin: "0 0 10px", fontFamily: mono, fontSize: 9, color: HUD.dim, lineHeight: 1.7, letterSpacing: 0.3 }}>
              Go to each outlet, use a non-contact tester or plug a lamp, and tap it here
              when it responds to toggling this breaker. Press Done when finished.
            </p>

            {unassignedOutlets.length === 0 ? (
              <div style={{ color: HUD.dimmer, fontFamily: mono, fontSize: 10, marginBottom: 10, letterSpacing: 0.5 }}>
                All outlets are already assigned to a circuit.
              </div>
            ) : (
              <div className="oi-stagger" style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10, maxHeight: 220, overflowY: "auto" }}>
                {unassignedOutlets.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => {
                      if (o.circuitId && o.circuitId !== circuitId &&
                        !window.confirm(`Move "${o.label}" from ${circuitLabelOf(o.circuitId)} to this breaker?`)) return;
                      assignOutletToTracer(o.id);
                    }}
                    className="oi-press oi-lift"
                    style={{
                      background: `linear-gradient(90deg, ${C.amber}08, transparent)`,
                      border: `1px solid ${HUD.lineHi}`,
                      borderRadius: 6,
                      padding: "7px 10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                      <span style={{ fontFamily: mono, fontSize: 11, color: HUD.text, fontWeight: 700 }}>{o.label}</span>
                      <span style={{ fontFamily: mono, fontSize: 8, color: HUD.dim, letterSpacing: 0.5 }}>
                        {roomName(o.roomId)}
                        {o.circuitId && o.circuitId !== circuitId && <span style={{ color: C.warn }}> · on {circuitLabelOf(o.circuitId)}</span>}
                      </span>
                    </div>
                    <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: o.circuitId && o.circuitId !== circuitId ? C.warn : C.amber, letterSpacing: 1 }}>
                      {o.circuitId && o.circuitId !== circuitId ? "MOVE →" : "ASSIGN +"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={stopTracer}
              className="oi-press"
              style={{ ...btn(C.good) }}
            >
              Done — Stop Tracing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add circuit form ─────────────────────────────────────────────────────────

function AddCircuitButton() {
  const model = useStore((s) => s.model!);
  const addCircuit = useStore((s) => s.addCircuit);
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (busy) return;
    setBusy(true);
    const n = model.circuits.length + 1;
    await addCircuit({
      breakerLabel: `Ckt ${n}`,
      breakerSlot: n,
      ampRating: 15,
      voltage: 120,
      isSharedNeutral: false,
      notes: "",
    });
    setBusy(false);
  }

  return (
    <button
      onClick={handleAdd}
      disabled={busy}
      className="oi-press"
      style={{ ...btn(HUD.cyan, true), opacity: busy ? 0.5 : 1, letterSpacing: 1, fontSize: 11 }}
    >
      + ADD BREAKER
    </button>
  );
}

// ─── Main panel view ──────────────────────────────────────────────────────────

export function PanelView() {
  const model = useStore((s) => s.model);
  const updateCircuit = useStore((s) => s.updateCircuit);
  const tracerCircuitId = useStore((s) => s.tracerCircuitId);
  const [selectedCircuitId, setSelectedCircuitId] = useState<string | null>(null);
  const reduced = useReducedMotion();

  const health = useMemo(() => (model ? rollupHome(model) : null), [model]);

  if (!model || !health) return null;
  const circuitHealthById = new Map(health.circuits.map((c) => [c.circuitId, c]));

  // Sort circuits by slot number (nulls last), then by id
  const sorted = [...model.circuits].sort((a, b) => {
    if (a.breakerSlot == null && b.breakerSlot == null) return 0;
    if (a.breakerSlot == null) return 1;
    if (b.breakerSlot == null) return -1;
    return a.breakerSlot - b.breakerSlot;
  });

  // Split into two columns (left = even indices, right = odd)
  const leftCol: CircuitNode[] = [];
  const rightCol: CircuitNode[] = [];
  sorted.forEach((c, i) => {
    (i % 2 === 0 ? leftCol : rightCol).push(c);
  });

  function handleSelectCircuit(id: string) {
    setSelectedCircuitId((prev) => (prev === id ? null : id));
  }

  return (
    <div style={{ padding: "14px 12px" }}>
      {/* Header */}
      <div className="oi-fadeup" style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: mono, fontSize: 8, color: HUD.cyan, fontWeight: 700, letterSpacing: 2, marginBottom: 4, opacity: 0.85 }}>
          ELECTRICAL PANEL
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: HUD.text, lineHeight: 1.2, letterSpacing: 0.5 }}>
              Main Panel
            </h2>
            <p style={{ margin: "4px 0 0", fontFamily: mono, fontSize: 10, color: HUD.dim, letterSpacing: 0.5 }}>
              {model.circuits.length} circuit{model.circuits.length !== 1 ? "s" : ""} &middot; tap ✎ or long-press to edit label / amperage
            </p>
          </div>
          <AddCircuitButton />
        </div>
      </div>

      {/* Tracer status banner */}
      {tracerCircuitId && tracerCircuitId !== selectedCircuitId && (
        <div className={reduced ? "" : "oi-pulse"} style={{
          background: `${C.amber}12`,
          border: `1px solid ${C.amber}55`,
          borderRadius: 6,
          padding: "8px 12px",
          fontFamily: mono,
          fontSize: 10,
          color: C.amber,
          marginBottom: 12,
          letterSpacing: 1,
        }}>
          ● TRACER ACTIVE on {model.circuits.find((c) => c.id === tracerCircuitId)?.breakerLabel ?? "unknown"}
          {" "}— select that circuit below to manage it.
        </div>
      )}

      {model.circuits.length === 0 ? (
        <div style={{ color: HUD.dimmer, fontFamily: mono, fontSize: 11, padding: "24px 0", textAlign: "center", letterSpacing: 1 }}>
          NO CIRCUITS YET — ADD A BREAKER ABOVE TO BEGIN
        </div>
      ) : (
        /* Main panel enclosure */
        <div style={{
          background: `linear-gradient(180deg, #0D1520 0%, #0A1018 100%)`,
          border: `1.5px solid ${HUD.lineHi}`,
          borderRadius: 12,
          padding: "16px 14px 14px",
          position: "relative",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 32px -16px #000C",
        }}>
          {/* Panel corner brackets */}
          <Bracket color={HUD.cyan} size={14} weight={1.5} opacity={0.55} />

          {/* Holo top scan-line */}
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: 1,
            borderRadius: "12px 12px 0 0",
            background: `linear-gradient(90deg, transparent, ${HUD.cyan}66, transparent)`,
            pointerEvents: "none",
          }} />

          {/* Panel name plate */}
          <div style={{
            fontFamily: mono,
            fontSize: 8,
            fontWeight: 700,
            color: HUD.dimmer,
            letterSpacing: 3,
            textAlign: "center",
            marginBottom: 14,
            paddingBottom: 10,
            borderBottom: `1px solid ${HUD.line}`,
            position: "relative",
          }}>
            {/* Center nameplate glow line */}
            <div style={{
              position: "absolute",
              bottom: -1, left: "25%", right: "25%",
              height: 1,
              background: `linear-gradient(90deg, transparent, ${HUD.cyan}55, transparent)`,
            }} />
            200A MAIN SERVICE PANEL
          </div>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 4px 1fr", gap: "0 8px", marginBottom: 8 }}>
            <div style={{ fontFamily: mono, fontSize: 10, color: HUD.dimmer, letterSpacing: 2, textAlign: "center" }}>LINE A</div>
            <div />
            <div style={{ fontFamily: mono, fontSize: 10, color: HUD.dimmer, letterSpacing: 2, textAlign: "center" }}>LINE B</div>
          </div>

          {/* Two-column breaker grid with bus bar divider */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 4px 1fr", gap: "6px 8px" }} className="oi-stagger">
            {Array.from({ length: Math.max(leftCol.length, rightCol.length) }).map((_, rowIdx) => {
              const leftCircuit = leftCol[rowIdx];
              const rightCircuit = rightCol[rowIdx];
              const leftGlobalIdx = rowIdx * 2;
              const rightGlobalIdx = rowIdx * 2 + 1;
              return (
                <React.Fragment key={rowIdx}>
                  {/* Left breaker */}
                  {leftCircuit ? (
                    <BreakerTile
                      circuit={leftCircuit}
                      grade={circuitHealthById.get(leftCircuit.id)?.grade ?? "GREEN"}
                      hasSystemic={(circuitHealthById.get(leftCircuit.id)?.systemicFlags.length ?? 0) > 0}
                      selected={selectedCircuitId === leftCircuit.id}
                      tracing={tracerCircuitId === leftCircuit.id}
                      slotNumber={leftGlobalIdx + 1}
                      reduced={reduced}
                      onSelect={() => handleSelectCircuit(leftCircuit.id)}
                      onUpdate={updateCircuit}
                    />
                  ) : <div />}

                  {/* Bus bar center divider */}
                  <div style={{
                    display: "flex",
                    alignItems: "stretch",
                    justifyContent: "center",
                  }}>
                    <div style={{
                      width: 2,
                      background: `linear-gradient(180deg, ${HUD.line}, ${HUD.lineHi}, ${HUD.line})`,
                      borderRadius: 1,
                      opacity: 0.6,
                    }} />
                  </div>

                  {/* Right breaker */}
                  {rightCircuit ? (
                    <BreakerTile
                      circuit={rightCircuit}
                      grade={circuitHealthById.get(rightCircuit.id)?.grade ?? "GREEN"}
                      hasSystemic={(circuitHealthById.get(rightCircuit.id)?.systemicFlags.length ?? 0) > 0}
                      selected={selectedCircuitId === rightCircuit.id}
                      tracing={tracerCircuitId === rightCircuit.id}
                      slotNumber={rightGlobalIdx + 1}
                      reduced={reduced}
                      onSelect={() => handleSelectCircuit(rightCircuit.id)}
                      onUpdate={updateCircuit}
                    />
                  ) : <div />}
                </React.Fragment>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 14,
            paddingTop: 10,
            borderTop: `1px solid ${HUD.line}`,
          }}>
            {(["GREEN", "YELLOW", "AMBER", "RED"] as const).map((g) => (
              <div key={g} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: GRADE_COLOR[g],
                  boxShadow: reduced ? undefined : `0 0 5px ${GRADE_COLOR[g]}88`,
                }} />
                <span style={{ fontFamily: mono, fontSize: 8, color: HUD.dimmer, letterSpacing: 0.5 }}>{g}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 9, color: C.warn }}>⚠</span>
              <span style={{ fontFamily: mono, fontSize: 8, color: HUD.dimmer }}>Systemic flag</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontFamily: mono, fontSize: 8, color: C.warn, letterSpacing: 0.5 }}>MWBC</span>
              <span style={{ fontFamily: mono, fontSize: 8, color: HUD.dimmer }}>=shared neutral</span>
            </div>
          </div>
        </div>
      )}

      {/* Circuit detail / tracer */}
      {selectedCircuitId && <CircuitDetail key={selectedCircuitId} circuitId={selectedCircuitId} />}

      {/* Systemic flags summary */}
      {health.systemicFlags.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            background: `${C.bad}08`,
            border: `1px solid ${C.bad}44`,
            borderRadius: 8,
            padding: "12px 14px",
            position: "relative",
          }}>
            <Bracket color={C.bad} size={8} weight={1.5} opacity={0.5} />
            <div style={{ fontFamily: mono, fontSize: 8, color: C.bad, fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>
              SYSTEMIC FLAGS
            </div>
            <div className="oi-stagger" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {health.systemicFlags.map((fl, i) => {
                const urgencyColor = fl.urgency === "IMMEDIATE" ? C.bad : fl.urgency === "SOON" ? C.warn : HUD.dim;
                const scopeLabel = fl.scope === "circuit"
                  ? (model.circuits.find((c) => c.id === fl.scopeId)?.breakerLabel ?? fl.scopeId)
                  : (model.rooms.find((r) => r.id === fl.scopeId)?.name ?? fl.scopeId);
                return (
                  <div key={i} style={{ borderBottom: `1px solid ${HUD.line}44`, paddingBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Pill color={urgencyColor}>{fl.urgency}</Pill>
                      <span style={{ fontFamily: mono, fontSize: 9, color: HUD.dim, letterSpacing: 0.5 }}>
                        {fl.scope.toUpperCase()}: {scopeLabel}
                      </span>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: HUD.text, marginBottom: 3 }}>{fl.description}</div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: HUD.dim, lineHeight: 1.6 }}>{fl.remedy}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
