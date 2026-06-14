/* ════════════════════════════════════════════════════════════════════════════
   CIRCUIT BUS — breaker-panel summary visualization.
   Each circuit is a breaker "node" colored by its health grade. Systemic
   flags show a warning badge. Hover lifts. Staggered entrance.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import type { CircuitHealth } from "../../../core";
import { C, mono, GRADE_COLOR } from "../../theme";
import { AnimatedNumber } from "../../anim";

interface Props {
  circuits: CircuitHealth[];
  nameOf: (circuitId: string) => string;
}

export function CircuitBus({ circuits, nameOf }: Props) {
  if (circuits.length === 0) {
    return (
      <div
        style={{
          color: C.dimmer,
          fontSize: 11,
          fontFamily: mono,
          padding: "10px 0",
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

  return (
    <div>
      {/* bus rail */}
      <div
        style={{
          position: "relative",
          marginBottom: 10,
        }}
      >
        {/* horizontal bus bar line */}
        <div
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            top: 12,
            height: 3,
            background: `linear-gradient(90deg, ${C.border}, #3A3A46, ${C.border})`,
            borderRadius: 2,
          }}
        />

        {/* breaker nodes */}
        <div
          className="oi-stagger"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 8,
            position: "relative",
          }}
        >
          {sorted.map((c) => (
            <BreakerNode
              key={c.circuitId}
              circuit={c}
              name={nameOf(c.circuitId)}
            />
          ))}
        </div>
      </div>

      {/* legend */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 4,
          paddingTop: 8,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        {(["GREEN", "YELLOW", "AMBER", "RED"] as const).map((g) => (
          <div
            key={g}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              color: C.dimmer,
              fontSize: 9,
              fontFamily: mono,
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
            color: C.dimmer,
            fontSize: 9,
            fontFamily: mono,
            marginLeft: "auto",
          }}
        >
          <span style={{ color: C.warn }}>⚠</span> systemic flag
        </div>
      </div>
    </div>
  );
}

function BreakerNode({
  circuit,
  name,
}: {
  circuit: CircuitHealth;
  name: string;
}) {
  const color = GRADE_COLOR[circuit.grade];
  const hasFlags = circuit.systemicFlags.length > 0;
  const riskPct = Math.round(circuit.risk * 100);

  return (
    <div
      className="oi-lift"
      style={{
        background: `linear-gradient(170deg, ${color}14, ${color}06)`,
        border: `1px solid ${color}44`,
        borderTop: `3px solid ${color}`,
        borderRadius: 8,
        padding: "10px 10px 8px",
        position: "relative",
        cursor: "default",
        transition: "border-color .18s, box-shadow .18s",
      }}
      title={`${name} · risk ${riskPct}/100 · ${circuit.outletIds.length} outlets`}
    >
      {/* flag badge */}
      {hasFlags && (
        <span
          style={{
            position: "absolute",
            top: 5,
            right: 6,
            fontSize: 10,
            color: C.warn,
          }}
          title={`${circuit.systemicFlags.length} systemic flag${circuit.systemicFlags.length !== 1 ? "s" : ""}`}
        >
          ⚠
        </span>
      )}

      {/* health dot + grade */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: color,
            flexShrink: 0,
            boxShadow: `0 0 6px ${color}88`,
          }}
        />
        <span
          style={{
            color,
            fontFamily: mono,
            fontWeight: 800,
            fontSize: 9.5,
            letterSpacing: 1,
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
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.2,
          marginBottom: 4,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
        }}
        title={name}
      >
        {name}
      </div>

      {/* footer stats */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            color: C.dimmer,
            fontSize: 9.5,
            fontFamily: mono,
          }}
        >
          <AnimatedNumber value={circuit.outletIds.length} />{" "}
          {circuit.outletIds.length === 1 ? "outlet" : "outlets"}
        </span>
        <span
          style={{
            color: color,
            fontSize: 9.5,
            fontFamily: mono,
            fontWeight: 700,
          }}
        >
          <AnimatedNumber value={riskPct} suffix="%" />
        </span>
      </div>

      {/* risk bar */}
      <div
        style={{
          marginTop: 5,
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
            background: color,
            boxShadow: `0 0 4px ${color}`,
            transition: "width .4s cubic-bezier(.2,.8,.2,1)",
          }}
        />
      </div>
    </div>
  );
}
