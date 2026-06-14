/* Render smoke test — executes the UI→core render path (no DOM/IndexedDB needed)
   via react-dom/server, catching component crashes the typechecker can't. */
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { DiagnosticWidget } from "../src/ui/DiagnosticWidget";

describe("UI render smoke", () => {
  it("DiagnosticWidget renders a verdict for the live case without throwing", () => {
    const html = renderToString(
      <DiagnosticWidget initialObservations={{ VHN: 116, VHG: 15, VNG: 0.5, frittingObs: true }} meta={{ era: "1990-2000" }} />,
    );
    expect(html).toMatch(/CONDEMN|SAFETY HOLD|DEFECT/);
    expect(html.length).toBeGreaterThan(50);
  });

  it("DiagnosticWidget renders a PASS for a confirmed-healthy outlet", () => {
    const html = renderToString(
      <DiagnosticWidget initialObservations={{ VHN: 120, VHG: 120, VNG: 0.4, Gcont: 0.3, hasGroundWire: true }} />,
    );
    expect(html).toMatch(/PASS|healthy/i);
  });
});
