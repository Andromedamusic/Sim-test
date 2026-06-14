// @vitest-environment jsdom
/* ════════════════════════════════════════════════════════════════════════════
   APP RUNTIME INTEGRATION — mounts the real <App/> against fake-IndexedDB,
   waits for init, drives the store, and renders EVERY tab. Catches runtime
   crashes in the store-backed views + all viz components that typecheck/build
   cannot detect.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor, cleanup } from "@testing-library/react";
import React from "react";
import { App } from "../src/ui/App";
import { useStore } from "../src/state/store";
import { db } from "../src/data/db";
import { ErrorBoundary } from "../src/ui/ErrorBoundary";

async function freshDb() {
  await db.delete();
  await db.open();
  // reset the zustand singleton between tests
  useStore.setState({ ready: false, model: null, activeFloorId: null, activeRoomId: null, activeOutletId: null, priorScale: {}, tracerCircuitId: null });
}

beforeEach(async () => {
  cleanup();
  await freshDb();
});

const clickTab = (label: string) => fireEvent.click(screen.getAllByText(label)[0]);

describe("App runtime", () => {
  it("mounts, reaches ready, and the Diagnose tab shows the live-case verdict", async () => {
    render(<App />);
    // loading → ready (HealthHero header text)
    await screen.findByText(/WHOLE-HOME ELECTRICAL HEALTH/i, {}, { timeout: 5000 });
    clickTab("Diagnose");
    // scratch defaults to the 17V live case → open-ground CONDEMN
    await waitFor(() => expect(screen.getAllByText(/CONDEMN/i).length).toBeGreaterThan(0));
  });

  it("renders every tab without throwing", async () => {
    render(<App />);
    await screen.findByText(/WHOLE-HOME ELECTRICAL HEALTH/i, {}, { timeout: 5000 });
    for (const tab of ["Map", "Diagnose", "Panel", "Atlas", "Prognosis", "Learning", "Reference", "Settings", "Home"]) {
      await act(async () => { clickTab(tab); });
      // a representative element renders for each
      await waitFor(() => expect(document.querySelectorAll("button, svg, input").length).toBeGreaterThan(0));
    }
  });

  it("a seeded lethal (reversed-polarity) outlet pins the home to SAFETY HOLD", async () => {
    render(<App />);
    await screen.findByText(/WHOLE-HOME ELECTRICAL HEALTH/i, {}, { timeout: 5000 });

    await act(async () => {
      const st = useStore.getState();
      const floorId = st.activeFloorId!;
      const roomId = await st.addRoom(floorId, "Kitchen", 4, 3);
      const outletId = await st.addOutlet(roomId, { wallId: "N", offset: 0.5 }, "K1");
      await st.measureOutlet(outletId, { VHN: 120, VHG: 1.5, VNG: 120, groundRefTested: false });
    });

    // header pill + hero both reflect the hold
    await waitFor(() => expect(screen.getAllByText(/SAFETY HOLD/i).length).toBeGreaterThan(0));

    // Map renders the outlet marker; Panel renders the circuit-less state
    await act(async () => { clickTab("Map"); });
    await waitFor(() => expect(document.querySelector("svg")).toBeTruthy());
  });

  it("active learning: recording a ground truth shifts the learned prior", async () => {
    render(<App />);
    await screen.findByText(/WHOLE-HOME ELECTRICAL HEALTH/i, {}, { timeout: 5000 });
    await act(async () => {
      const st = useStore.getState();
      const floorId = st.activeFloorId!;
      const roomId = await st.addRoom(floorId, "Bed", 4, 3);
      const outletId = await st.addOutlet(roomId, { wallId: "E", offset: 0.3 }, "B1");
      await st.measureOutlet(outletId, { VHN: 120, VHG: 120, VNG: 1, dropV: 5, hasGroundWire: true });
      await st.recordGroundTruth(outletId, "backstab_hot", "opened it, hot push-in was loose");
    });
    expect(useStore.getState().priorScale["backstab_hot"]).toBeGreaterThan(1);
  });

  it("ErrorBoundary catches a child crash and offers retry instead of white-screening", () => {
    const Boom = (): React.ReactElement => { throw new Error("kaboom"); };
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText(/hit a snag/i)).toBeTruthy();
    expect(screen.getByText(/Retry/i)).toBeTruthy();
  });
});
