/* ════════════════════════════════════════════════════════════════════════════
   REPORT VIEW — printable whole-home inspection report.
   "Print / Save as PDF" = browser window.print(). @media print rules hide the
   app chrome and make only .report visible, white-on-black, safe for paper.
   No external dependencies; works 100% offline.
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useMemo } from "react";
import { useStore } from "../../state/store";
import { rollupHome, FAULTS } from "../../core";
import type { HomeHealth, RemediationItem, SystemicFlag, OutletHealth } from "../../core";
import { C, mono, GRADE_COLOR, VERDICT_COLOR, HUD, glow } from "../theme";
import { Bracket } from "../hud/Bracket";

// ─── local style helpers ──────────────────────────────────────────────────────
const TH: React.CSSProperties = {
  fontFamily: mono,
  fontSize: 10,
  fontWeight: 700,
  color: C.dim,
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = {
  fontFamily: mono,
  fontSize: 11,
  color: C.text,
  padding: "5px 8px",
  borderBottom: `1px solid ${C.border}`,
  verticalAlign: "top",
};

const SECTION_HEAD: React.CSSProperties = {
  fontFamily: mono,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1,
  color: C.dim,
  textTransform: "uppercase" as const,
  borderBottom: `2px solid ${C.border}`,
  paddingBottom: 5,
  marginBottom: 10,
  marginTop: 24,
};

const TABLE: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 11,
};

// ─── urgency colour ───────────────────────────────────────────────────────────
function urgencyColor(u: string): string {
  if (u === "IMMEDIATE") return C.danger;
  if (u === "SOON") return C.warn;
  return C.blue;
}

// ─── grade badge ──────────────────────────────────────────────────────────────
function GradeBadge({ grade, small }: { grade: string; small?: boolean }): React.ReactElement {
  const color = GRADE_COLOR[grade] ?? C.dim;
  return (
    <span
      style={{
        display: "inline-block",
        background: color + "22",
        color,
        border: `1px solid ${color}`,
        borderRadius: 5,
        padding: small ? "1px 6px" : "3px 9px",
        fontFamily: mono,
        fontWeight: 800,
        fontSize: small ? 9 : 11,
      }}
    >
      {grade}
    </span>
  );
}

// ─── verdict badge ────────────────────────────────────────────────────────────
function VerdictBadge({ code }: { code: string | null }): React.ReactElement {
  if (!code) return <span style={{ color: C.dimmer, fontFamily: mono, fontSize: 10 }}>—</span>;
  const color = VERDICT_COLOR[code] ?? C.dimmer;
  return (
    <span
      style={{
        display: "inline-block",
        background: color + "1A",
        color,
        border: `1px solid ${color}44`,
        borderRadius: 4,
        padding: "1px 5px",
        fontFamily: mono,
        fontWeight: 700,
        fontSize: 9,
        whiteSpace: "nowrap",
      }}
    >
      {code}
    </span>
  );
}

// ─── safety hold banner ────────────────────────────────────────────────────────
function SafetyHoldBanner(): React.ReactElement {
  return (
    <div
      style={{
        background: "#3B0000",
        border: `2px solid ${C.danger}`,
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span style={{ color: C.danger, fontFamily: mono, fontWeight: 900, fontSize: 14 }}>⚠ SAFETY HOLD</span>
      <span style={{ color: "#FCA5A5", fontFamily: mono, fontSize: 11 }}>
        One or more outlets have active lethal fault conditions. Do not use until cleared by a licensed electrician.
      </span>
    </div>
  );
}

// ─── HUD section header (screen only — prints as regular SECTION_HEAD) ────────
function HudSectionHead({ label, className }: { label: string; className?: string }): React.ReactElement {
  return (
    <div className={className} style={{ ...SECTION_HEAD, display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ color: HUD.cyan, fontSize: 9, lineHeight: 1 }} aria-hidden="true">◆</span>
      <span style={{ letterSpacing: 2 }}>{label}</span>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export function ReportView(): React.ReactElement {
  const model = useStore((s) => s.model);

  const health: HomeHealth | null = useMemo(
    () => (model ? rollupHome(model) : null),
    [model]
  );

  if (!model || !health) {
    return (
      <div style={{ color: C.dim, fontFamily: mono, padding: 32, textAlign: "center" }}>
        No home loaded.
      </div>
    );
  }

  const home = model.home;
  const reportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // helper maps for name resolution
  const floorName = new Map(model.floors.map((f) => [f.id, f.name]));
  const roomName = new Map(model.rooms.map((r) => [r.id, r.name]));
  const circuitLabel = new Map(
    model.circuits.map((c) => [c.id, `${c.breakerLabel} (${c.ampRating}A)`])
  );
  const outletMap = new Map(model.outlets.map((o) => [o.id, o]));

  // per-room flat rows for the breakdown table
  interface OutletRow {
    floorName: string;
    roomName: string;
    outletLabel: string;
    outletType: string;
    verdict: string | null;
    topFaultName: string;
    topFaultNec: string;
    topFaultRemedy: string;
    health: OutletHealth;
  }

  const outletRows: OutletRow[] = [];
  for (const floorH of health.floors) {
    const fname = floorName.get(floorH.floorId) ?? floorH.floorId;
    for (const roomH of floorH.rooms) {
      const rname = roomName.get(roomH.roomId) ?? roomH.roomId;
      for (const oh of roomH.outlets) {
        const o = outletMap.get(oh.outletId);
        if (!o) continue;
        const fault = oh.topFault ? FAULTS[oh.topFault] : undefined;
        outletRows.push({
          floorName: fname,
          roomName: rname,
          outletLabel: o.label,
          outletType: o.type,
          verdict: oh.verdictCode,
          topFaultName: fault?.name ?? (oh.topFault ?? "—"),
          topFaultNec: fault?.nec ?? "—",
          topFaultRemedy: fault?.remedy ?? "—",
          health: oh,
        });
      }
    }
  }

  // counts
  const measuredCount = model.outlets.filter((o) => o.inference).length;
  const coveragePct = model.outlets.length > 0
    ? Math.round(health.inspectionCoverage * 100)
    : 0;

  function scopeLabel(flag: SystemicFlag): string {
    if (flag.scope === "circuit") {
      return circuitLabel.get(flag.scopeId) ?? flag.scopeId;
    }
    return roomName.get(flag.scopeId) ?? flag.scopeId;
  }

  function remediationTargetLabel(item: RemediationItem): string {
    if (item.targetType === "OUTLET") {
      const o = outletMap.get(item.targetId);
      if (o) {
        const rname = roomName.get(o.roomId) ?? "Room";
        return `${rname} · ${o.label}`;
      }
    }
    if (item.targetType === "CIRCUIT") {
      return circuitLabel.get(item.targetId) ?? item.targetId;
    }
    if (item.targetType === "ROOM") {
      return roomName.get(item.targetId) ?? item.targetId;
    }
    return item.label;
  }

  // fault name from remediation reason (reason = "FaultName — remedy")
  function splitReason(reason: string): { fault: string; action: string } {
    const dash = reason.indexOf(" — ");
    if (dash === -1) return { fault: "—", action: reason };
    return { fault: reason.slice(0, dash), action: reason.slice(dash + 3) };
  }

  const gradeColor = GRADE_COLOR[health.grade] ?? C.dim;

  return (
    <>
      {/* ── print / screen styles ────────────────────────────────────── */}
      <style>{`
        /* ── screen ── */
        .report-wrapper {
          background: ${C.bg};
          min-height: 100vh;
          padding: 20px;
          box-sizing: border-box;
        }
        .report-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .report {
          background: ${C.panel};
          border: 1px solid ${C.border};
          border-radius: 12px;
          padding: 28px 32px 40px;
          max-width: 900px;
          margin: 0 auto;
          font-family: ${mono};
          color: ${C.text};
          box-sizing: border-box;
        }
        .report table {
          page-break-inside: avoid;
        }
        .report tr {
          page-break-inside: avoid;
        }

        /* ── print overrides ── */
        @media print {
          /* hide everything, then reveal only .report */
          body * {
            visibility: hidden;
          }
          .report, .report * {
            visibility: visible;
          }
          .report {
            position: absolute;
            inset: 0;
            margin: 0;
            padding: 20px 24px 32px;
            border: none;
            border-radius: 0;
            max-width: 100%;
            /* force white background + black text for paper readability */
            background: #ffffff !important;
            color: #111111 !important;
          }
          /* recolour text elements for paper */
          .report * {
            color: #111111 !important;
            background: transparent !important;
            border-color: #999999 !important;
          }
          .report .print-grade-badge {
            border: 1px solid #555 !important;
            color: #000 !important;
            background: transparent !important;
            font-weight: 900 !important;
          }
          .report .print-hold-banner {
            border: 2px solid #000 !important;
            background: transparent !important;
          }
          .report .print-hold-banner * {
            color: #000 !important;
          }
          .report .print-section-head {
            border-bottom: 2px solid #555 !important;
            color: #333 !important;
          }
          /* hide HUD diamond accent from print */
          .report .hud-diamond {
            display: none !important;
          }
          .report .print-dim {
            color: #555 !important;
          }
          /* hide on-screen hero grade from print (covered by inline text) */
          .report .screen-grade-hero {
            display: none !important;
          }
          /* page breaks */
          .report .report-section {
            page-break-inside: avoid;
          }
          .report table {
            page-break-inside: auto;
          }
          .report tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="report-wrapper">
        {/* ── toolbar (hidden when printing) ──────────────────────────── */}
        <div className="report-toolbar no-print">
          {/* HUD toolbar panel */}
          <div style={{
            position: "relative",
            background: HUD.panel,
            border: `1px solid ${HUD.line}`,
            borderRadius: 10,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            width: "100%",
            maxWidth: 900,
            margin: "0 auto",
            boxSizing: "border-box",
          }}>
            <Bracket color={HUD.cyan} size={8} inset={3} weight={1} opacity={0.45} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
              <span style={{ color: HUD.cyan, fontSize: 8 }}>◆</span>
              <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: 2, color: HUD.cyan, textTransform: "uppercase" as const }}>
                Inspection Report
              </span>
              <span style={{ color: HUD.line, margin: "0 4px" }}>|</span>
              <span style={{ fontFamily: mono, fontSize: 10, color: HUD.dimmer }}>{reportDate}</span>
            </div>
            <button
              onClick={() => window.print()}
              style={{
                background: HUD.cyan,
                color: "#04060B",
                border: `1px solid ${HUD.cyan}`,
                borderRadius: 7,
                padding: "9px 16px",
                fontFamily: mono,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: glow(HUD.cyan, 0.35),
              }}
            >
              🖨 Print / Save as PDF
            </button>
            <span style={{ color: C.dimmer, fontFamily: mono, fontSize: 10 }}>
              Choose "Save as PDF" from the print destination to export offline.
            </span>
          </div>
        </div>

        {/* ── report body ──────────────────────────────────────────────── */}
        <div className="report">

          {/* ── COVER ─────────────────────────────────────────────────── */}
          <div
            className="report-section"
            style={{
              borderBottom: `2px solid ${C.border}`,
              paddingBottom: 20,
              marginBottom: 8,
            }}
          >
            {/* title */}
            <div
              style={{
                fontFamily: mono,
                fontWeight: 900,
                fontSize: 20,
                letterSpacing: 0.5,
                color: C.text,
                marginBottom: 4,
              }}
            >
              Outlet Diagnostic Report
            </div>
            <div
              style={{
                color: C.dimmer,
                fontFamily: mono,
                fontSize: 11,
                marginBottom: 16,
              }}
              className="print-dim"
            >
              Generated {reportDate} · Offline diagnostic support tool
            </div>

            {/* home info grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <InfoBlock label="Property" value={home.name} />
              {home.address && <InfoBlock label="Address" value={home.address} />}
              {home.yearBuilt && (
                <InfoBlock label="Year Built" value={String(home.yearBuilt)} />
              )}
              <InfoBlock label="Report Date" value={reportDate} />
              <InfoBlock
                label="Inspection Coverage"
                value={`${coveragePct}% (${measuredCount} / ${model.outlets.length} outlets)`}
              />
            </div>

            {/* overall grade + risk — HUD hero on screen, plain inline text for print */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 13, color: C.dim }}>
                Overall Grade:
              </span>
              <span className="print-grade-badge">
                <GradeBadge grade={health.grade} />
              </span>
              {/* Screen-only holo grade hero */}
              <span
                className="screen-grade-hero no-print"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: gradeColor + "1A",
                  border: `2px solid ${gradeColor}`,
                  boxShadow: glow(gradeColor, 0.45),
                  fontFamily: mono,
                  fontWeight: 900,
                  fontSize: 16,
                  color: gradeColor,
                  letterSpacing: 0.5,
                }}
              >
                {health.grade}
              </span>
              <span style={{ fontFamily: mono, fontSize: 11, color: C.dimmer }} className="print-dim">
                Risk Score: {(health.risk * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* ── SAFETY HOLD banner ────────────────────────────────────── */}
          {health.safetyHold && (
            <div className="print-hold-banner">
              <SafetyHoldBanner />
            </div>
          )}

          {/* ── SUMMARY ──────────────────────────────────────────────── */}
          <div className="report-section">
            <HudSectionHead label="Summary" className="print-section-head" />
            <table style={{ ...TABLE, marginBottom: 8 }}>
              <tbody>
                <SummaryRow label="Floors" value={String(model.floors.length)} />
                <SummaryRow label="Rooms" value={String(model.rooms.length)} />
                <SummaryRow label="Circuits" value={String(model.circuits.length)} />
                <SummaryRow label="Outlets (total)" value={String(model.outlets.length)} />
                <SummaryRow label="Outlets (measured)" value={`${measuredCount} (${coveragePct}%)`} />
                <SummaryRow
                  label="Lethal / Hold outlets"
                  value={String(health.unclearedLethalOutletIds.length)}
                  highlight={health.unclearedLethalOutletIds.length > 0 ? C.danger : undefined}
                />
                <SummaryRow
                  label="Systemic patterns"
                  value={String(health.systemicFlags.length)}
                  highlight={health.systemicFlags.length > 0 ? C.warn : undefined}
                />
                <SummaryRow
                  label="Remediation items"
                  value={String(health.remediation.length)}
                />
              </tbody>
            </table>
          </div>

          {/* ── PER-FLOOR GRADE SUMMARY ───────────────────────────────── */}
          {health.floors.length > 0 && (
            <div className="report-section">
              <HudSectionHead label="Floor Grades" className="print-section-head" />
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={TH}>Floor</th>
                    <th style={TH}>Grade</th>
                    <th style={TH}>Risk</th>
                    <th style={TH}>Rooms</th>
                  </tr>
                </thead>
                <tbody>
                  {health.floors.map((fh) => (
                    <tr key={fh.floorId}>
                      <td style={TD}>{floorName.get(fh.floorId) ?? fh.floorId}</td>
                      <td style={TD}>
                        <span className="print-grade-badge">
                          <GradeBadge grade={fh.grade} small />
                        </span>
                      </td>
                      <td style={{ ...TD, color: GRADE_COLOR[fh.grade] ?? C.text }}>
                        {(fh.risk * 100).toFixed(0)}%
                      </td>
                      <td style={{ ...TD, color: C.dimmer }} className="print-dim">
                        {fh.rooms.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── SYSTEMIC PATTERNS ────────────────────────────────────── */}
          {health.systemicFlags.length > 0 && (
            <div className="report-section">
              <HudSectionHead label="Systemic Patterns Detected" className="print-section-head" />
              {health.systemicFlags.map((flag, i) => (
                <div
                  key={i}
                  style={{
                    borderLeft: `3px solid ${urgencyColor(flag.urgency)}`,
                    paddingLeft: 12,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: mono,
                        fontWeight: 800,
                        fontSize: 11,
                        color: urgencyColor(flag.urgency),
                      }}
                    >
                      {flag.urgency}
                    </span>
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: 10,
                        color: C.dimmer,
                        textTransform: "uppercase" as const,
                      }}
                      className="print-dim"
                    >
                      {flag.type.replace(/_/g, " ")} · {flag.scope}: {scopeLabel(flag)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: mono,
                      fontSize: 11,
                      color: C.text,
                      marginBottom: 4,
                      lineHeight: 1.5,
                    }}
                  >
                    {flag.description}
                  </div>
                  <div
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      color: C.blue,
                      lineHeight: 1.5,
                    }}
                  >
                    Action: {flag.remedy}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── PRIORITIZED REMEDIATION ──────────────────────────────── */}
          {health.remediation.length > 0 && (
            <div className="report-section">
              <HudSectionHead label="Prioritized Remediation" className="print-section-head" />
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={{ ...TH, width: 32 }}>#</th>
                    <th style={TH}>Urgency</th>
                    <th style={TH}>Location / Label</th>
                    <th style={TH}>Fault / Issue</th>
                    <th style={TH}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {health.remediation.map((item) => {
                    const { fault, action } = splitReason(item.reason);
                    // try to enrich from FAULTS if this is an outlet-type item
                    const o = item.targetType === "OUTLET" ? outletMap.get(item.targetId) : undefined;
                    const faultId = o?.inference?.topFault;
                    const faultDef = faultId ? FAULTS[faultId] : undefined;
                    return (
                      <tr key={item.rank}>
                        <td
                          style={{
                            ...TD,
                            fontWeight: 800,
                            color: C.dim,
                          }}
                          className="print-dim"
                        >
                          {item.rank}
                        </td>
                        <td style={{ ...TD, whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              color: urgencyColor(item.urgency),
                              fontWeight: 700,
                              fontFamily: mono,
                              fontSize: 10,
                            }}
                          >
                            {item.urgency}
                          </span>
                        </td>
                        <td style={TD}>{remediationTargetLabel(item)}</td>
                        <td style={TD}>
                          <div>{faultDef ? faultDef.name : fault}</div>
                          {faultDef?.nec && faultDef.nec !== "—" && (
                            <div
                              style={{
                                color: C.dimmer,
                                fontSize: 9,
                                marginTop: 2,
                              }}
                              className="print-dim"
                            >
                              NEC {faultDef.nec}
                            </div>
                          )}
                          {(faultDef?.sev ?? 0) > 0 && (
                            <div
                              style={{
                                color: C.dimmer,
                                fontSize: 9,
                                marginTop: 1,
                              }}
                              className="print-dim"
                            >
                              Severity {faultDef?.sev}/10
                            </div>
                          )}
                        </td>
                        <td style={{ ...TD, maxWidth: 240, lineHeight: 1.5 }}>
                          {faultDef ? faultDef.remedy : action}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── PER-ROOM OUTLET BREAKDOWN ────────────────────────────── */}
          <div className="report-section">
            <HudSectionHead label="Per-Room Outlet Breakdown" className="print-section-head" />
            {outletRows.length === 0 ? (
              <div style={{ color: C.dimmer, fontFamily: mono, fontSize: 11 }}>
                No outlets recorded.
              </div>
            ) : (
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={TH}>Floor</th>
                    <th style={TH}>Room</th>
                    <th style={TH}>Outlet</th>
                    <th style={TH}>Type</th>
                    <th style={TH}>Verdict</th>
                    <th style={TH}>Top Fault</th>
                    <th style={TH}>NEC Ref</th>
                    <th style={TH}>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {outletRows.map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        background:
                          row.health.hold || row.health.lethal
                            ? C.danger + "0D"
                            : "transparent",
                      }}
                    >
                      <td style={{ ...TD, color: C.dimmer }} className="print-dim">
                        {row.floorName}
                      </td>
                      <td style={TD}>{row.roomName}</td>
                      <td style={{ ...TD, fontWeight: 700 }}>{row.outletLabel}</td>
                      <td style={{ ...TD, color: C.dimmer, fontSize: 9 }} className="print-dim">
                        {row.outletType}
                      </td>
                      <td style={TD}>
                        <VerdictBadge code={row.verdict} />
                      </td>
                      <td style={TD}>
                        {row.health.observed ? (
                          <span>{row.topFaultName}</span>
                        ) : (
                          <span
                            style={{ color: C.dimmer, fontStyle: "italic", fontSize: 10 }}
                            className="print-dim"
                          >
                            unmeasured
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          ...TD,
                          color: C.dimmer,
                          fontSize: 9,
                        }}
                        className="print-dim"
                      >
                        {row.health.observed ? row.topFaultNec : "—"}
                      </td>
                      <td
                        style={{
                          ...TD,
                          color: GRADE_COLOR[row.health.grade] ?? C.text,
                          fontWeight: 700,
                        }}
                      >
                        {row.health.observed ? `${(row.health.risk * 100).toFixed(0)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── CIRCUIT SUMMARY (if any circuits defined) ───────────── */}
          {health.circuits.length > 0 && (
            <div className="report-section">
              <HudSectionHead label="Circuit Summary" className="print-section-head" />
              <table style={TABLE}>
                <thead>
                  <tr>
                    <th style={TH}>Circuit</th>
                    <th style={TH}>Grade</th>
                    <th style={TH}>Risk</th>
                    <th style={TH}>Outlets</th>
                    <th style={TH}>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {health.circuits.map((ch) => {
                    const c = model.circuits.find((x) => x.id === ch.circuitId);
                    return (
                      <tr key={ch.circuitId}>
                        <td style={TD}>
                          {c
                            ? `${c.breakerLabel} · ${c.ampRating}A`
                            : ch.circuitId}
                        </td>
                        <td style={TD}>
                          <span className="print-grade-badge">
                            <GradeBadge grade={ch.grade} small />
                          </span>
                        </td>
                        <td
                          style={{
                            ...TD,
                            color: GRADE_COLOR[ch.grade] ?? C.text,
                          }}
                        >
                          {(ch.risk * 100).toFixed(0)}%
                        </td>
                        <td
                          style={{ ...TD, color: C.dimmer }}
                          className="print-dim"
                        >
                          {ch.outletIds.length}
                        </td>
                        <td style={{ ...TD, color: C.warn }}>
                          {ch.systemicFlags.length > 0
                            ? ch.systemicFlags
                                .map((f) => f.type.replace(/_/g, " "))
                                .join(", ")
                            : <span style={{ color: C.dimmer }} className="print-dim">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── FOOTER DISCLAIMER ────────────────────────────────────── */}
          <div
            style={{
              marginTop: 40,
              paddingTop: 16,
              borderTop: `1px solid ${C.border}`,
              fontFamily: mono,
              fontSize: 10,
              color: C.dimmer,
              lineHeight: 1.7,
            }}
            className="print-dim"
          >
            <strong style={{ color: C.dim }}>Disclaimer — Diagnostic Support Only.</strong>{" "}
            This report is generated by an offline probabilistic diagnostic tool for informational
            and triage purposes only. It is not a substitute for a professional electrical
            inspection. Results are based on user-entered meter readings and apply Bayesian
            inference; they may be incomplete or incorrect. Always consult a licensed electrician
            before performing any electrical work. For life-safety issues (SAFETY HOLD, lethal
            fault conditions) cease use of affected outlets immediately and contact a qualified
            professional. NEC references are provided for context only; compliance determinations
            require on-site evaluation by a licensed inspector.
          </div>
        </div>
        {/* end .report */}
      </div>
    </>
  );
}

// ─── local sub-components ─────────────────────────────────────────────────────
function InfoBlock({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <div
        style={{
          fontFamily: mono,
          fontSize: 9,
          fontWeight: 700,
          color: C.dimmer,
          letterSpacing: 0.5,
          textTransform: "uppercase" as const,
          marginBottom: 2,
        }}
        className="print-dim"
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: mono,
          fontSize: 13,
          fontWeight: 700,
          color: C.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}): React.ReactElement {
  return (
    <tr>
      <td
        style={{
          ...TD,
          color: C.dim,
          fontWeight: 600,
          width: "50%",
        }}
        className="print-dim"
      >
        {label}
      </td>
      <td
        style={{
          ...TD,
          color: highlight ?? C.text,
          fontWeight: highlight ? 800 : 400,
        }}
      >
        {value}
      </td>
    </tr>
  );
}
