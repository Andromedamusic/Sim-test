/* ════════════════════════════════════════════════════════════════════════════
   CIRCUIT BUS — mission-control breaker-panel visual.
   A glowing bus-bar rail with breaker nodes coloured by health grade.
   Health status dots, flag-badge overlays, staggered entrance, hover lift.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import type { CircuitHealth } from "../../../core";
import { C, mono, HUD, GRADE_COLOR, glow } from "../../theme";
import { AnimatedNumber, useReducedMotion } from "../../anim";
import { Bracket } from "../../hud/Bracket";
import { OIcon } from "../../icons/OIcon";

interface Props {
  circuits: CircuitHealth[];
  nameOf: (circuitId: string) => string;
}

export function CircuitBus({ circuits, nameOf }: Props) {
  const reduced = useReducedMotion();

  if (circuits.length === 0) {
    return (
      <div
        style={{
          color: C.dim,
          fontSize: 11,
          fontFamily: mono,
          padding: "14px 0",
          textAlign: "center",
        }}
      >
        No circuits defined yet.
      </div>
    );
  }

  // Sort: worst grade first (RED → AMBER → YELLOW → GREEN)
  const gradeRank: Record<string, number> = { RED: 0, AMBER: 1, YELLOW: 2, GREEN: 3 };
  const sorted = [...circuits].sort(
    (a, b) => (gradeRank[a.grade] ?? 9) - (gradeRank[b.grade] ?? 9)
  );

  // Identify the single worst RED circuit (highest risk) for targeted pulsing
  const redCircuits = sorted.filter((c) => c.grade === "RED");
  const worstRedId = redCircuits.length > 0
    ? redCircuits.reduce((worst, c) => c.risk > worst.risk ? c : worst, redCircuits[0]).circuitId
    : null;

  return (
    <div>
      {/* bus-bar rail */}
      <div
        style={{
          position: "relative",
          marginBottom: 12,
        }}
      >
        {/* main bus line */}
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            top: 14,
            height: 4,
            background: `linear-gradient(90deg, ${HUD.line}, ${HUD.lineHi} 30%, ${HUD.cyan}55 50%, ${HUD.lineHi} 70%, ${HUD.line})`,
            borderRadius: 2,
            boxShadow: `0 0 8px -2px ${HUD.cyan}44`,
            zIndex: 0,
          }}
        />
        {/* breaker nodes — staggered entrance */}
        <div
          className={reduced ? "" : "oi-stagger"}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(138px, 1fr))",
            gap: 9,
            position: "relative",
            zIndex: 1,
          }}
        >
          {sorted.map((c) => (
            <BreakerNode
              key={c.circuitId}
              circuit={c}
              name={nameOf(c.circuitId)}
              reduced={reduced}
              isWorst={c.circuitId === worstRedId}
            />
          ))}
        </div>
      </div>

      {/* legend */}
      <div
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          marginTop: 6,
          paddingTop: 10,
          borderTop: `1px solid ${HUD.line}`,
          alignItems: "center",
        }}
      >
        {(["GREEN", "YELLOW", "AMBER", "RED"] as const).map((g) => (
          <div
            key={g}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: C.dim,
              fontSize: 10,
              fontFamily: mono,
              letterSpacing: 0.8,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: GRADE_COLOR[g],
                display: "inline-block",
                flexShrink: 0,
                boxShadow: `0 0 5px ${GRADE_COLOR[g]}66`,
              }}
            />
            {g}
          </div>
        ))}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            color: C.dim,
            fontSize: 10,
            fontFamily: mono,
            marginLeft: "auto",
          }}
        >
          <OIcon name="shield" size={12} color={C.warn} accent={C.warn} />
          systemic flag
        </div>
      </div>
    </div>
  );
}

function BreakerNode({
  circuit,
  name,
  reduced,
  isWorst,
}: {
  circuit: CircuitHealth;
  name: string;
  reduced: boolean;
  isWorst: boolean;
}) {
  const color = GRADE_COLOR[circuit.grade];
  const hasFlags = circuit.systemicFlags.length > 0;
  const riskPct = Math.round(circuit.risk * 100);
  const isDanger = circuit.grade === "RED";
  const isAmber = circuit.grade === "AMBER";

  return (
    <div
      className="oi-lift"
      style={{
        background: `linear-gradient(170deg, ${color}16 0%, ${color}06 60%, #0A0E1400 100%)`,
        border: `1px solid ${color}40`,
        borderTop: `3px solid ${color}`,
        borderRadius: 10,
        padding: "11px 11px 9px",
        position: "relative",
        cursor: "default",
        boxShadow: (isDanger || isAmber)
          ? `0 0 14px -6px ${color}55, inset 0 1px 0 ${color}22`
          : `inset 0 1px 0 ${color}18`,
      }}
      title={`${name} · risk ${riskPct}/100 · ${circuit.outletIds.length} outlet${circuit.outletIds.length !== 1 ? "s" : ""}`}
    >
      {/* connector stub — links visually to bus rail */}
      <div
        style={{
          position: "absolute",
          top: -12,
          left: "50%",
          transform: "translateX(-50%)",
          width: 2,
          height: 12,
          background: `linear-gradient(180deg, ${color}88 0%, ${color}22 100%)`,
          borderRadius: 1,
          zIndex: 0,
        }}
      />

      {/* flag badge */}
      {hasFlags && (
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 7,
            lineHeight: 1,
            filter: !reduced ? `drop-shadow(0 0 4px ${C.warn}88)` : undefined,
            display: "flex",
            alignItems: "center",
          }}
          className={isWorst && !reduced ? "oi-pulse" : undefined}
          title={`${circuit.systemicFlags.length} systemic flag${circuit.systemicFlags.length !== 1 ? "s" : ""}`}
        >
          <OIcon name="shield" size={13} color={C.warn} accent={C.warn} />
        </span>
      )}

      {/* status dot + grade label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 7,
          marginRight: hasFlags ? 16 : 0,
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: color,
            flexShrink: 0,
            boxShadow: !reduced ? glow(color, 0.5) : undefined,
          }}
          className={isWorst && !reduced ? "oi-pulse" : undefined}
        />
        <span
          style={{
            color,
            fontFamily: mono,
            fontWeight: 800,
            fontSize: 10,
            letterSpacing: 1.2,
          }}
        >
          {circuit.grade}
        </span>
      </div>

      {/* circuit name */}
      <div
        style={{
          color: C.text,
          fontFamily: mono,
          fontSize: 11.5,
          fontWeight: 700,
          lineHeight: 1.2,
          marginBottom: 5,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
        }}
        title={name}
      >
        {name}
      </div>

      {/* outlet count + risk pct */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 5,
        }}
      >
        <span
          style={{
            color: C.dim,
            fontSize: 10,
            fontFamily: mono,
          }}
        >
          <AnimatedNumber value={circuit.outletIds.length} />{" "}
          {circuit.outletIds.length === 1 ? "outlet" : "outlets"}
        </span>
        <span
          style={{
            color,
            fontSize: 10,
            fontFamily: mono,
            fontWeight: 800,
          }}
        >
          <AnimatedNumber value={riskPct} suffix="%" />
        </span>
      </div>

      {/* risk bar */}
      <div
        style={{
          height: 3,
          background: "#0A0A0E",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${riskPct}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 5px ${color}88`,
            transition: "width .5s cubic-bezier(.2,.8,.2,1)",
          }}
        />
      </div>
    </div>
  );
}
