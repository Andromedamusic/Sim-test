/* ════════════════════════════════════════════════════════════════════════════
   PANEL VIEW — visual electrical breaker panel with circuit-level health,
   outlet assignment tracer, and inline circuit editing.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useState } from "react";
import { useStore } from "../../state/store";
import { rollupHome } from "../../core";
import type { CircuitNode } from "../../core";
import { C, mono, GRADE_COLOR, VERDICT_COLOR, btn } from "../theme";
import { Card, Pill } from "../components";

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
  onSelect: () => void;
  onUpdate: (c: CircuitNode) => void;
}

function BreakerTile({ circuit, grade, hasSystemic, selected, tracing, onSelect, onUpdate }: BreakerTileProps) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [editingAmp, setEditingAmp] = useState(false);
  const [labelDraft, setLabelDraft] = useState(circuit.breakerLabel);
  const [ampDraft, setAmpDraft] = useState(String(circuit.ampRating));

  const gradeColor = GRADE_COLOR[grade] ?? C.dim;
  const isSelected = selected;

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

  return (
    <div
      onClick={onSelect}
      className="oi-lift oi-press"
      style={{
        background: isSelected ? gradeColor + "22" : C.panel2,
        border: `1.5px solid ${isSelected ? gradeColor : tracing ? C.amber : C.border}`,
        borderRadius: 8,
        padding: "8px 10px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 0,
        boxShadow: tracing ? `0 0 0 2px ${C.amber}55` : undefined,
      }}
    >
      {/* Slot number + health dot */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: mono, fontSize: 9, color: C.dimmer, fontWeight: 700 }}>
          {circuit.breakerSlot != null ? `#${circuit.breakerSlot}` : "—"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {hasSystemic && (
            <span title="Systemic flag detected" style={{ fontSize: 11 }}>⚠</span>
          )}
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: gradeColor,
              boxShadow: `0 0 5px ${gradeColor}99`,
            }}
          />
        </div>
      </div>

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
            background: "#0A0A0E", border: `1px solid ${C.border}`, borderRadius: 4,
            padding: "2px 5px", fontSize: 11, fontFamily: mono, color: C.text, width: "100%",
          }}
        />
      ) : (
        <div
          onDoubleClick={(e) => { e.stopPropagation(); setLabelDraft(circuit.breakerLabel); setEditingLabel(true); }}
          title="Double-click to edit label"
          style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {circuit.breakerLabel}
        </div>
      )}

      {/* Amp + voltage */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
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
              background: "#0A0A0E", border: `1px solid ${C.border}`, borderRadius: 4,
              padding: "1px 4px", fontSize: 10, fontFamily: mono, color: C.text, width: 48,
            }}
          />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); setAmpDraft(String(circuit.ampRating)); setEditingAmp(true); }}
            title="Double-click to edit amperage"
            style={{ fontFamily: mono, fontSize: 10, color: C.dim }}
          >
            {circuit.ampRating}A
          </span>
        )}
        <span style={{ fontFamily: mono, fontSize: 9, color: C.dimmer }}>{circuit.voltage}V</span>
        {circuit.isSharedNeutral && (
          <span style={{ fontFamily: mono, fontSize: 8, color: C.warn, background: C.warn + "22", padding: "1px 4px", borderRadius: 3 }}>
            MWBC
          </span>
        )}
      </div>
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

  const circuit = model.circuits.find((c) => c.id === circuitId);
  if (!circuit) return null;

  const isTracing = tracerCircuitId === circuitId;
  const assignedOutlets = model.outlets.filter((o) => o.circuitId === circuitId);
  // Outlets not yet assigned to this circuit (candidates while tracing)
  const unassignedOutlets = model.outlets.filter((o) => o.circuitId !== circuitId);

  const rooms = model.rooms;
  function roomName(roomId: string): string {
    return rooms.find((r) => r.id === roomId)?.name ?? "Unknown";
  }

  return (
    <div className="oi-fadeup" style={{ marginTop: 14 }}>
      {/* Circuit title */}
      <div style={{ fontFamily: mono, fontSize: 9, color: C.blue, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
        CIRCUIT — {circuit.breakerLabel}
      </div>

      {/* Assigned outlets */}
      <Card title="OUTLETS ON THIS CIRCUIT" style={{ marginBottom: 10 }}>
        {assignedOutlets.length === 0 ? (
          <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 11, padding: "4px 0" }}>
            No outlets assigned. Use the tracer below.
          </div>
        ) : (
          <div className="oi-stagger" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {assignedOutlets.map((o) => {
              const verdictCode = o.inference?.verdictCode;
              const verdictColor = verdictCode ? (VERDICT_COLOR[verdictCode] ?? C.dim) : C.dimmer;
              return (
                <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.border}22` }}>
                  <div>
                    <span style={{ fontFamily: mono, fontSize: 12, color: C.text, fontWeight: 700 }}>{o.label}</span>
                    <span style={{ fontFamily: mono, fontSize: 10, color: C.dim, marginLeft: 7 }}>{roomName(o.roomId)}</span>
                  </div>
                  {verdictCode ? (
                    <Pill color={verdictColor}>{verdictCode}</Pill>
                  ) : (
                    <span style={{ fontFamily: mono, fontSize: 10, color: C.dimmer }}>unmeasured</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Tracer controls */}
      <Card title="CIRCUIT TRACER">
        {!isTracing ? (
          <div>
            <p style={{ margin: "0 0 10px", fontFamily: mono, fontSize: 11, color: C.dim, lineHeight: 1.6 }}>
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
            <div className="oi-pulse" style={{ color: C.amber, fontFamily: mono, fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
              TRACING ACTIVE — tap an outlet below to assign it
            </div>
            <p style={{ margin: "0 0 10px", fontFamily: mono, fontSize: 10, color: C.dim, lineHeight: 1.5 }}>
              Go to each outlet, use a non-contact tester or plug a lamp, and tap it here
              when it responds to toggling this breaker. Press Done when finished.
            </p>

            {unassignedOutlets.length === 0 ? (
              <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 11, marginBottom: 10 }}>
                All outlets are already assigned to a circuit.
              </div>
            ) : (
              <div className="oi-stagger" style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10, maxHeight: 220, overflowY: "auto" }}>
                {unassignedOutlets.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => assignOutletToTracer(o.id)}
                    className="oi-press oi-lift"
                    style={{
                      background: C.panel2,
                      border: `1px solid ${C.border}`,
                      borderRadius: 7,
                      padding: "7px 10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                      <span style={{ fontFamily: mono, fontSize: 12, color: C.text, fontWeight: 700 }}>{o.label}</span>
                      <span style={{ fontFamily: mono, fontSize: 9, color: C.dim }}>{roomName(o.roomId)}</span>
                    </div>
                    <span style={{ fontFamily: mono, fontSize: 10, color: C.amber }}>Assign +</span>
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
      </Card>
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
      style={{ ...btn(C.blue, true), opacity: busy ? 0.5 : 1 }}
    >
      + Add Breaker
    </button>
  );
}

// ─── Main panel view ──────────────────────────────────────────────────────────

export function PanelView() {
  const model = useStore((s) => s.model);
  const updateCircuit = useStore((s) => s.updateCircuit);
  const tracerCircuitId = useStore((s) => s.tracerCircuitId);
  const [selectedCircuitId, setSelectedCircuitId] = useState<string | null>(null);

  if (!model) return null;

  const health = rollupHome(model);
  const circuitHealthById = new Map(health.circuits.map((c) => [c.circuitId, c]));

  // Sort circuits by slot number (nulls last), then by id
  const sorted = [...model.circuits].sort((a, b) => {
    if (a.breakerSlot == null && b.breakerSlot == null) return 0;
    if (a.breakerSlot == null) return 1;
    if (b.breakerSlot == null) return -1;
    return a.breakerSlot - b.breakerSlot;
  });

  // Split into two columns (left = odd slots, right = even, or just half-half)
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
        <div style={{ fontFamily: mono, fontSize: 9, color: C.blue, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
          ELECTRICAL PANEL
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
              Main Panel
            </h2>
            <p style={{ margin: "4px 0 0", fontFamily: mono, fontSize: 10, color: C.dim }}>
              {model.circuits.length} circuit{model.circuits.length !== 1 ? "s" : ""} &middot; double-click a breaker to edit label or amperage
            </p>
          </div>
          <AddCircuitButton />
        </div>
      </div>

      {/* Tracer status banner */}
      {tracerCircuitId && tracerCircuitId !== selectedCircuitId && (
        <div className="oi-pulse" style={{
          background: C.amber + "18",
          border: `1px solid ${C.amber}55`,
          borderRadius: 8,
          padding: "8px 12px",
          fontFamily: mono,
          fontSize: 11,
          color: C.amber,
          marginBottom: 12,
        }}>
          TRACER ACTIVE on {model.circuits.find((c) => c.id === tracerCircuitId)?.breakerLabel ?? "unknown"}
          {" "}— select that circuit below to manage it.
        </div>
      )}

      {model.circuits.length === 0 ? (
        <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 12, padding: "24px 0", textAlign: "center" }}>
          No circuits yet. Add a breaker above to begin.
        </div>
      ) : (
        /* Panel frame */
        <div style={{
          background: C.panel2,
          border: `2px solid ${C.border}`,
          borderRadius: 14,
          padding: "14px 12px",
          position: "relative",
        }}>
          {/* Panel label */}
          <div style={{
            fontFamily: mono,
            fontSize: 9,
            fontWeight: 700,
            color: C.dimmer,
            letterSpacing: 2,
            textAlign: "center",
            marginBottom: 12,
            borderBottom: `1px solid ${C.border}`,
            paddingBottom: 8,
          }}>
            200A MAIN SERVICE PANEL
          </div>

          {/* Two-column breaker grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }} className="oi-stagger">
            {sorted.map((circuit) => {
              const ch = circuitHealthById.get(circuit.id);
              const grade = ch?.grade ?? "GREEN";
              const hasSystemic = (ch?.systemicFlags.length ?? 0) > 0;
              return (
                <BreakerTile
                  key={circuit.id}
                  circuit={circuit}
                  grade={grade}
                  hasSystemic={hasSystemic}
                  selected={selectedCircuitId === circuit.id}
                  tracing={tracerCircuitId === circuit.id}
                  onSelect={() => handleSelectCircuit(circuit.id)}
                  onUpdate={updateCircuit}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
            {(["GREEN", "YELLOW", "AMBER", "RED"] as const).map((g) => (
              <div key={g} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: GRADE_COLOR[g] }} />
                <span style={{ fontFamily: mono, fontSize: 9, color: C.dimmer }}>{g}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10 }}>⚠</span>
              <span style={{ fontFamily: mono, fontSize: 9, color: C.dimmer }}>Systemic flag</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontFamily: mono, fontSize: 9, color: C.warn }}>MWBC</span>
              <span style={{ fontFamily: mono, fontSize: 9, color: C.dimmer }}>= shared neutral</span>
            </div>
          </div>
        </div>
      )}

      {/* Circuit detail / tracer */}
      {selectedCircuitId && <CircuitDetail key={selectedCircuitId} circuitId={selectedCircuitId} />}

      {/* Systemic flags summary */}
      {health.systemicFlags.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Card title="SYSTEMIC FLAGS">
            <div className="oi-stagger" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {health.systemicFlags.map((fl, i) => {
                const urgencyColor = fl.urgency === "IMMEDIATE" ? C.bad : fl.urgency === "SOON" ? C.warn : C.dim;
                const scopeLabel = fl.scope === "circuit"
                  ? (model.circuits.find((c) => c.id === fl.scopeId)?.breakerLabel ?? fl.scopeId)
                  : (model.rooms.find((r) => r.id === fl.scopeId)?.name ?? fl.scopeId);
                return (
                  <div key={i} style={{ borderBottom: `1px solid ${C.border}22`, paddingBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <Pill color={urgencyColor}>{fl.urgency}</Pill>
                      <span style={{ fontFamily: mono, fontSize: 10, color: C.dim }}>
                        {fl.scope.toUpperCase()}: {scopeLabel}
                      </span>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: C.text, marginBottom: 3 }}>{fl.description}</div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: C.dim, lineHeight: 1.5 }}>{fl.remedy}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
