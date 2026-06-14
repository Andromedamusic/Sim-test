/* Corner brackets — the signature HUD frame. Overlay on any position:relative box. */
import React from "react";
import { HUD } from "../theme";

export function Bracket({ color = HUD.cyan, size = 12, inset = 0, weight = 2, opacity = 0.85 }:
  { color?: string; size?: number; inset?: number; weight?: number; opacity?: number }) {
  const base: React.CSSProperties = { position: "absolute", width: size, height: size, pointerEvents: "none", opacity };
  return (
    <>
      <span style={{ ...base, top: inset, left: inset, borderTop: `${weight}px solid ${color}`, borderLeft: `${weight}px solid ${color}` }} />
      <span style={{ ...base, top: inset, right: inset, borderTop: `${weight}px solid ${color}`, borderRight: `${weight}px solid ${color}` }} />
      <span style={{ ...base, bottom: inset, left: inset, borderBottom: `${weight}px solid ${color}`, borderLeft: `${weight}px solid ${color}` }} />
      <span style={{ ...base, bottom: inset, right: inset, borderBottom: `${weight}px solid ${color}`, borderRight: `${weight}px solid ${color}` }} />
    </>
  );
}
