/* ════════════════════════════════════════════════════════════════════════════
   ROOM HEATMAP — per-floor grid of room health tiles.
   Each tile is tinted by grade color, showing room name, outlet count,
   unmeasured count, and worst verdict. Staggered entrance; hover lifts.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import type { FloorHealth } from "../../../core";
import { C, mono, GRADE_COLOR, VERDICT_COLOR } from "../../theme";
import { AnimatedNumber } from "../../anim";
import { Pill } from "../../components";

interface Props {
  floors: FloorHealth[];
  roomName: (roomId: string) => string;
  floorName: (floorId: string) => string;
}

export function RoomHeatmap({ floors, roomName, floorName }: Props) {
  if (floors.length === 0) {
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
        No floors defined yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {floors.map((fl) => (
        <div key={fl.floorId}>
          {/* floor header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: GRADE_COLOR[fl.grade],
                flexShrink: 0,
                boxShadow: `0 0 8px ${GRADE_COLOR[fl.grade]}88`,
              }}
            />
            <span
              style={{
                color: C.text,
                fontFamily: mono,
                fontWeight: 700,
                fontSize: 12,
                flex: 1,
              }}
            >
              {floorName(fl.floorId)}
            </span>
            <span
              style={{
                color: GRADE_COLOR[fl.grade],
                fontFamily: mono,
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              {fl.grade}
            </span>
            <span
              style={{
                color: C.dimmer,
                fontFamily: mono,
                fontSize: 9.5,
              }}
            >
              risk {Math.round(fl.risk * 100)}
            </span>
          </div>

          {fl.rooms.length === 0 ? (
            <div
              style={{ color: C.dim, fontSize: 10.5, fontFamily: mono, paddingLeft: 20 }}
            >
              No rooms on this floor yet.
            </div>
          ) : (
            <div
              className="oi-stagger"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
                gap: 7,
              }}
            >
              {fl.rooms.map((r) => (
                <RoomTile
                  key={r.roomId}
                  room={r}
                  name={roomName(r.roomId)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RoomTile({
  room,
  name,
}: {
  room: FloorHealth["rooms"][number];
  name: string;
}) {
  const color = GRADE_COLOR[room.grade];
  const verdictColor = room.worstVerdict
    ? VERDICT_COLOR[room.worstVerdict] ?? C.dim
    : C.dim;
  const unmeasuredPct =
    room.outletCount > 0
      ? Math.round((room.unobservedCount / room.outletCount) * 100)
      : 0;

  return (
    <div
      className="oi-lift"
      style={{
        background: `linear-gradient(170deg, ${color}12 0%, #0E0E1200 80%)`,
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        padding: "8px 10px",
        cursor: "default",
        minHeight: 78,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
      title={`${name} · ${room.outletCount} outlets · risk ${Math.round(room.risk * 100)}/100`}
    >
      {/* room name + grade dot */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 3,
          }}
        >
          <span
            style={{
              color: C.text,
              fontSize: 11,
              fontFamily: mono,
              fontWeight: 600,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "80%",
            }}
            title={name}
          >
            {name}
          </span>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: color,
              flexShrink: 0,
              boxShadow: `0 0 5px ${color}88`,
            }}
          />
        </div>

        {/* outlet / unmeasured counts */}
        <div
          style={{
            color: C.dimmer,
            fontSize: 9.5,
            fontFamily: mono,
            lineHeight: 1.4,
          }}
        >
          <AnimatedNumber value={room.outletCount} />{" "}
          {room.outletCount === 1 ? "outlet" : "outlets"}
          {room.unobservedCount > 0 && (
            <span style={{ color: C.warn }}>
              {" · "}
              <AnimatedNumber value={room.unobservedCount} /> unmeasured
            </span>
          )}
        </div>
      </div>

      {/* bottom: worst verdict pill + risk bar */}
      <div style={{ marginTop: 6 }}>
        {room.worstVerdict && (
          <div style={{ marginBottom: 4 }}>
            <Pill color={verdictColor}>
              {room.worstVerdict}
            </Pill>
          </div>
        )}
        {/* coverage bar: measured / total */}
        {room.outletCount > 0 && (
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
                width: `${100 - unmeasuredPct}%`,
                height: "100%",
                background: color,
                transition: "width .4s cubic-bezier(.2,.8,.2,1)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
