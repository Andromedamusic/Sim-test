/* ════════════════════════════════════════════════════════════════════════════
   HOME — the centralized intelligence model. Whole-home health grade, systemic
   patterns, prioritized remediation, and a floor/room/circuit breakdown rolled
   up from every measured outlet (safety-asymmetric: one lethal outlet → RED).
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import { useStore } from "../../state/store";
import { FAULTS, type HomeHealth, type Grade } from "../../core";
import { C, mono, GRADE_COLOR } from "../theme";
import { Card, Bar, Pill } from "../components";

const URGENCY_COLOR: Record<string, string> = { IMMEDIATE: C.danger, SOON: C.warn, PLANNED: C.dim };

export function HomeDashboardView({ health, onGoMap }: { health: HomeHealth; onGoMap: () => void }) {
  const { model } = useStore();
  if (!model) return null;
  const roomName = (id: string) => model.rooms.find((r) => r.id === id)?.name ?? id;
  const circuitName = (id: string) => model.circuits.find((c) => c.id === id)?.breakerLabel ?? id;
  const placed = model.outlets.length;
  const measured = model.outlets.filter((o) => o.inference).length;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* hero */}
      <div style={{ background: health.safetyHold ? "#1A0606" : C.panel, border: `2px solid ${GRADE_COLOR[health.grade]}`, borderRadius: 14, padding: 16, boxShadow: `0 0 28px ${GRADE_COLOR[health.grade]}22` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: C.dimmer, fontSize: 9, fontFamily: mono, letterSpacing: 1 }}>WHOLE-HOME ELECTRICAL HEALTH</div>
            <div style={{ color: GRADE_COLOR[health.grade], fontSize: 30, fontWeight: 800, fontFamily: mono, lineHeight: 1.1 }}>
              {health.safetyHold ? "⚠ SAFETY HOLD" : health.grade}
            </div>
            <div style={{ color: C.dim, fontSize: 11, fontFamily: mono, marginTop: 2 }}>risk index {(health.risk * 100).toFixed(0)} / 100</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: C.dim, fontSize: 10, fontFamily: mono }}>inspection coverage</div>
            <div style={{ color: C.text, fontSize: 20, fontFamily: mono, fontWeight: 700 }}>{measured}/{placed}</div>
            <div style={{ width: 120, marginTop: 4 }}><Bar pct={health.inspectionCoverage * 100} color={C.blue} h={6} /></div>
          </div>
        </div>
        {health.safetyHold && (
          <div style={{ marginTop: 12, background: "#260808", border: "1px solid #7F1D1D", borderRadius: 8, padding: 10, color: "#FECACA", fontSize: 11, fontFamily: mono }}>
            {health.unclearedLethalOutletIds.length} outlet(s) cannot be cleared — a lethal mode is un-excluded. Resolve before energising high loads.
          </div>
        )}
        {placed === 0 && (
          <button onClick={onGoMap} style={{ marginTop: 12, background: C.amber, color: "#0A0A0C", border: "none", borderRadius: 8, padding: "9px 13px", fontFamily: mono, fontWeight: 800 }}>Start mapping outlets →</button>
        )}
      </div>

      {/* systemic flags */}
      {health.systemicFlags.length > 0 && (
        <Card title="🔗 SYSTEMIC PATTERNS (not device-local)">
          <div style={{ display: "grid", gap: 8 }}>
            {health.systemicFlags.map((f, i) => (
              <div key={i} style={{ background: "#1A1200", border: `1px solid #854D0E`, borderRadius: 8, padding: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <Pill color={URGENCY_COLOR[f.urgency]}>{f.urgency}</Pill>
                  <span style={{ color: C.warn, fontSize: 11, fontFamily: mono, fontWeight: 700 }}>{f.type.replace(/_/g, " ")}</span>
                  <span style={{ marginLeft: "auto", color: C.dimmer, fontSize: 9.5, fontFamily: mono }}>{f.scope === "circuit" ? circuitName(f.scopeId) : roomName(f.scopeId)}</span>
                </div>
                <div style={{ color: "#FDE68A", fontSize: 11, lineHeight: 1.5 }}>{f.description}</div>
                <div style={{ color: C.dim, fontSize: 10.5, lineHeight: 1.5, marginTop: 3 }}>{f.remedy}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* remediation */}
      <Card title="🛠 PRIORITIZED REMEDIATION">
        {health.remediation.length === 0 ? <div style={{ color: C.dim, fontSize: 11 }}>No defects found yet. Measure outlets on the Map tab to populate this list.</div> :
          health.remediation.slice(0, 12).map((it) => (
            <div key={it.rank} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: URGENCY_COLOR[it.urgency], fontFamily: mono, fontWeight: 800, minWidth: 18 }}>{it.rank}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontSize: 11.5, fontWeight: 600 }}>{it.label}</div>
                <div style={{ color: C.dim, fontSize: 10.5, lineHeight: 1.45 }}>{it.reason}</div>
              </div>
              <Pill color={URGENCY_COLOR[it.urgency]}>{it.urgency}</Pill>
            </div>
          ))}
      </Card>

      {/* floor / room breakdown */}
      <Card title="🏚 FLOORS & ROOMS">
        {health.floors.map((fl) => {
          const floor = model.floors.find((f) => f.id === fl.floorId);
          return (
            <div key={fl.floorId} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <GradeDot grade={fl.grade} />
                <span style={{ color: C.text, fontFamily: mono, fontWeight: 700, fontSize: 12 }}>{floor?.name ?? "Floor"}</span>
                <span style={{ marginLeft: "auto", color: C.dimmer, fontFamily: mono, fontSize: 10 }}>{(fl.risk * 100).toFixed(0)}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 6 }}>
                {fl.rooms.map((r) => (
                  <div key={r.roomId} style={{ background: "#0E0E12", border: `1px solid ${C.border}`, borderLeft: `3px solid ${GRADE_COLOR[r.grade]}`, borderRadius: 8, padding: "7px 9px" }}>
                    <div style={{ color: C.text, fontSize: 11, fontFamily: mono }}>{roomName(r.roomId)}</div>
                    <div style={{ color: C.dimmer, fontSize: 9.5, fontFamily: mono, marginTop: 2 }}>
                      {r.outletCount} outlet{r.outletCount !== 1 ? "s" : ""}{r.unobservedCount ? ` · ${r.unobservedCount} unmeasured` : ""}
                    </div>
                  </div>
                ))}
                {fl.rooms.length === 0 && <div style={{ color: C.dim, fontSize: 10.5 }}>No rooms on this floor yet.</div>}
              </div>
            </div>
          );
        })}
      </Card>

      {/* circuits */}
      {health.circuits.length > 0 && (
        <Card title="⚡ CIRCUITS">
          {health.circuits.map((c) => (
            <div key={c.circuitId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
              <GradeDot grade={c.grade} />
              <span style={{ color: C.text, fontSize: 11, fontFamily: mono }}>{circuitName(c.circuitId)}</span>
              <span style={{ color: C.dimmer, fontSize: 10, fontFamily: mono }}>· {c.outletIds.length} outlets</span>
              {c.systemicFlags.length > 0 && <span style={{ color: C.warn, fontSize: 10, fontFamily: mono }}>⚠ {c.systemicFlags.length} flag</span>}
              <span style={{ marginLeft: "auto", color: C.dimmer, fontSize: 10, fontFamily: mono }}>{(c.risk * 100).toFixed(0)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function GradeDot({ grade }: { grade: Grade }) {
  return <span style={{ width: 10, height: 10, borderRadius: 999, background: GRADE_COLOR[grade], flexShrink: 0, boxShadow: `0 0 8px ${GRADE_COLOR[grade]}88` }} />;
}
