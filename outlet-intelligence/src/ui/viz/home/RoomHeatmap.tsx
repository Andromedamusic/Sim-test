/* ════════════════════════════════════════════════════════════════════════════
   ROOM HEATMAP — per-floor grid of mission-control room health tiles.
   Grade-tinted tiles with count-up stats, worst-verdict pills, coverage bar.
   Floor headers carry grade dot + HUD risk badge. Staggered entrance.
   ════════════════════════════════════════════════════════════════════════════ */
import React from "react";
import type { FloorHealth } from "../../../core";
import { C, mono, HUD, GRADE_COLOR, VERDICT_COLOR, glow } from "../../theme";
import { AnimatedNumber, useReducedMotion } from "../../anim";
import { Pill } from "../../components";
import { Bracket } from "../../hud/Bracket";

interface Props {
  floors: FloorHealth[];
  roomName: (roomId: string) => string;
  floorName: (floorId: string) => string;
}

export function RoomHeatmap({ floors, roomName, floorName }: Props) {
  const reduced = useReducedMotion();

  if (floors.length === 0) {
    return (
      <div
        style={{
          color: C.dimmer,
          fontSize: 11,
          fontFamily: mono,
          padding: "14px 0",
          textAlign: "center",
        }}
      >
        No floors defined yet.
      </div>
    );
  }

  return (
    <div
      className={reduced ? "" : "oi-stagger"}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      {floors.map((fl) => {
        const flColor = GRADE_COLOR[fl.grade];
        return (
          <div key={fl.floorId}>
            {/* floor header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
                paddingBottom: 8,
                borderBottom: `1px solid ${HUD.line}`,
                position: "relative",
              }}
            >
              {/* grade indicator dot */}
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 3,
                  background: flColor,
                  flexShrink: 0,
                  boxShadow: !reduced ? glow(flColor, 0.5) : undefined,
                }}
              />
              {/* floor name */}
              <span
                style={{
                  color: C.text,
                  fontFamily: mono,
                  fontWeight: 700,
                  fontSize: 12.5,
                  flex: 1,
                  letterSpacing: 0.3,
                }}
              >
                {floorName(fl.floorId)}
              </span>
              {/* grade badge */}
              <span
                style={{
                  color: flColor,
                  fontFamily: mono,
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: 1.2,
                  border: `1px solid ${flColor}44`,
                  borderRadius: 4,
                  padding: "2px 7px",
                  background: `${flColor}14`,
                }}
              >
                {fl.grade}
              </span>
              {/* risk score */}
              <span
                style={{
                  color: HUD.dimmer,
                  fontFamily: mono,
                  fontSize: 9,
                  letterSpacing: 0.5,
                }}
              >
                RISK{" "}
                <span style={{ color: flColor, fontWeight: 700 }}>
                  {Math.round(fl.risk * 100)}
                </span>
              </span>
            </div>

            {fl.rooms.length === 0 ? (
              <div
                style={{
                  color: C.dim,
                  fontSize: 10.5,
                  fontFamily: mono,
                  paddingLeft: 20,
                }}
              >
                No rooms on this floor yet.
              </div>
            ) : (
              <div
                className={reduced ? "" : "oi-stagger"}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: 8,
                }}
              >
                {fl.rooms.map((r) => (
                  <RoomTile
                    key={r.roomId}
                    room={r}
                    name={roomName(r.roomId)}
                    reduced={reduced}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RoomTile({
  room,
  name,
  reduced,
}: {
  room: FloorHealth["rooms"][number];
  name: string;
  reduced: boolean;
}) {
  const color = GRADE_COLOR[room.grade];
  const verdictColor = room.worstVerdict
    ? VERDICT_COLOR[room.worstVerdict] ?? C.dim
    : C.dim;
  const unmeasuredPct =
    room.outletCount > 0
      ? Math.round((room.unobservedCount / room.outletCount) * 100)
      : 0;
  const isDanger = room.grade === "RED";

  return (
    <div
      className="oi-lift"
      style={{
        background: `linear-gradient(170deg, ${color}14 0%, #0D131D00 80%)`,
        border: `1px solid ${color}38`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
        padding: "10px 11px",
        cursor: "default",
        minHeight: 86,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        boxShadow: isDanger && !reduced ? `0 0 12px -6px ${color}55` : undefined,
      }}
      title={`${name} · ${room.outletCount} outlet${room.outletCount !== 1 ? "s" : ""} · risk ${Math.round(room.risk * 100)}/100`}
    >
      {/* subtle bracket accent — top-left only for compactness */}
      <Bracket color={color} size={7} inset={2} weight={1} opacity={0.45} />

      {/* top: room name + status dot */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <span
            style={{
              color: C.text,
              fontSize: 11,
              fontFamily: mono,
              fontWeight: 700,
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
              boxShadow: !reduced ? `0 0 6px ${color}88` : undefined,
            }}
            className={isDanger && !reduced ? "oi-pulse" : undefined}
          />
        </div>

        {/* outlet + unmeasured counts */}
        <div
          style={{
            color: C.dimmer,
            fontSize: 9.5,
            fontFamily: mono,
            lineHeight: 1.5,
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

      {/* bottom: worst-verdict pill + coverage bar */}
      <div style={{ marginTop: 7 }}>
        {room.worstVerdict && (
          <div style={{ marginBottom: 5 }}>
            <Pill color={verdictColor}>{room.worstVerdict}</Pill>
          </div>
        )}
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
                background: `linear-gradient(90deg, ${color}88, ${color})`,
                transition: "width .5s cubic-bezier(.2,.8,.2,1)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
