/* ════════════════════════════════════════════════════════════════════════════
   ADAPTER PANEL — experimental hardware connectivity UI.

   Shows which meter adapters are available on this platform, lets the user
   connect/disconnect non-manual adapters, choose a target reading field, and
   live-stream readings from the connected device.

   ⚠  EXPERIMENTAL — Requires Chrome on Android or desktop for BLE/Serial.
      Manual entry is always the recommended primary workflow.
      Live meter readings are meter-dependent; results may vary by device.
   ════════════════════════════════════════════════════════════════════════════ */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { C, mono, btn } from "../theme";
import { Card } from "../components";
import {
  availableAdapters,
  platformCapabilities,
  type PlatformCapabilities,
} from "../../adapters/registry";
import type { MeterAdapter, MeterReading } from "../../adapters/types";
import type { Observation } from "../../core";
import { BLEMeterAdapter } from "../../adapters/ble";
import { SerialMeterAdapter } from "../../adapters/serial";

// ─── Target field options exposed to the user ─────────────────────────────────

const TARGET_FIELDS: Array<keyof Observation> = [
  "VHN",
  "VHG",
  "VNG",
  "dropV",
  "Gcont",
];

const FIELD_LABELS: Record<string, string> = {
  VHN: "VHN — Hot→Neutral",
  VHG: "VHG — Hot→Ground",
  VNG: "VNG — Neutral→Ground",
  dropV: "dropV — Loaded Drop",
  Gcont: "Gcont — Ground Continuity",
};

// ─── Per-adapter state ────────────────────────────────────────────────────────

interface AdapterState {
  adapter: MeterAdapter;
  connected: boolean;
  streaming: boolean;
  status: string;
  /** Last live reading received from this adapter during a stream. */
  lastReading: MeterReading | null;
  /** Currently selected target field for this adapter. */
  targetField: keyof Observation;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if this adapter class supports a settable targetField. */
function hasTargetField(
  a: MeterAdapter
): a is (BLEMeterAdapter | SerialMeterAdapter) & { targetField: keyof Observation } {
  return (
    a instanceof BLEMeterAdapter || a instanceof SerialMeterAdapter
  );
}

/** Format a reading value for display: Infinity → "OL", number → fixed-3. */
function formatValue(v: number | string): string {
  if (v === "OL" || v === Infinity) return "OL";
  if (typeof v === "number") {
    if (!isFinite(v)) return "OL";
    // Choose decimal places based on magnitude.
    if (Math.abs(v) >= 100) return v.toFixed(1);
    if (Math.abs(v) >= 10) return v.toFixed(2);
    return v.toFixed(3);
  }
  return String(v);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AdapterPanel() {
  const [adapterStates, setAdapterStates] = useState<AdapterState[]>([]);
  const [capabilities, setCapabilities] = useState<PlatformCapabilities | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  // Stable ref to adapterStates so callbacks can read current state without
  // closing over stale values.
  const stateRef = useRef<AdapterState[]>([]);
  stateRef.current = adapterStates;

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const [adapters, caps] = await Promise.all([
        availableAdapters(),
        platformCapabilities(),
      ]);
      if (cancelled) return;
      setAdapterStates(
        adapters.map((a) => ({
          adapter: a,
          connected: false,
          streaming: false,
          status: "",
          lastReading: null,
          targetField: "VHN",
        }))
      );
      setCapabilities(caps);
      setLoading(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Mutate helpers ─────────────────────────────────────────────────────────

  const patchState = useCallback(
    (id: string, patch: Partial<AdapterState>) => {
      setAdapterStates((prev) =>
        prev.map((s) => (s.adapter.id === id ? { ...s, ...patch } : s))
      );
    },
    []
  );

  // ── Connect ────────────────────────────────────────────────────────────────

  const handleConnect = useCallback(
    async (id: string) => {
      patchState(id, { status: "Connecting…" });
      const target = stateRef.current.find((s) => s.adapter.id === id);
      if (!target) return;
      try {
        await target.adapter.connect();
        patchState(id, { connected: true, status: "Connected" });
      } catch (err) {
        patchState(id, {
          connected: false,
          status: `Error: ${String(err)}`,
        });
      }
    },
    [patchState]
  );

  // ── Disconnect ─────────────────────────────────────────────────────────────

  const handleDisconnect = useCallback(
    async (id: string) => {
      patchState(id, { status: "Disconnecting…" });
      const target = stateRef.current.find((s) => s.adapter.id === id);
      if (!target) return;
      try {
        await target.adapter.disconnect();
        patchState(id, {
          connected: false,
          streaming: false,
          status: "Disconnected",
          lastReading: null,
        });
      } catch (err) {
        patchState(id, { status: `Error: ${String(err)}` });
      }
    },
    [patchState]
  );

  // ── Start stream ───────────────────────────────────────────────────────────

  const handleStartStream = useCallback(
    async (id: string) => {
      const target = stateRef.current.find((s) => s.adapter.id === id);
      if (!target) return;

      // Push the selected targetField into the adapter before starting.
      if (hasTargetField(target.adapter)) {
        target.adapter.targetField = target.targetField;
      }

      patchState(id, { status: "Streaming…", streaming: true, lastReading: null });

      try {
        await target.adapter.startStream((reading: MeterReading) => {
          // This callback fires from event handlers — update state via setter.
          setAdapterStates((prev) =>
            prev.map((s) =>
              s.adapter.id === id ? { ...s, lastReading: reading } : s
            )
          );
        });
      } catch (err) {
        patchState(id, {
          streaming: false,
          status: `Stream error: ${String(err)}`,
        });
      }
    },
    [patchState]
  );

  // ── Stop stream ────────────────────────────────────────────────────────────

  const handleStopStream = useCallback(
    async (id: string) => {
      const target = stateRef.current.find((s) => s.adapter.id === id);
      if (!target) return;
      patchState(id, { status: "Stopping…" });
      try {
        await target.adapter.stopStream();
        patchState(id, { streaming: false, status: "Stopped" });
      } catch (err) {
        patchState(id, {
          streaming: false,
          status: `Stop error: ${String(err)}`,
        });
      }
    },
    [patchState]
  );

  // ── Target field change ────────────────────────────────────────────────────

  const handleTargetChange = useCallback(
    (id: string, field: keyof Observation) => {
      patchState(id, { targetField: field });
      // If already streaming, push the new field into the adapter immediately.
      const target = stateRef.current.find((s) => s.adapter.id === id);
      if (target && hasTargetField(target.adapter)) {
        target.adapter.targetField = field;
      }
    },
    [patchState]
  );

  // ── Layout ─────────────────────────────────────────────────────────────────

  const showBanner =
    capabilities && (!capabilities.ble || !capabilities.serial);

  return (
    <Card title="HARDWARE ADAPTERS">
      {/* Experimental notice */}
      <div
        style={{
          background: C.panel2,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: "8px 10px",
          marginBottom: 12,
          fontFamily: mono,
          fontSize: 10,
          color: C.dim,
          lineHeight: 1.6,
        }}
      >
        <span style={{ color: C.amber, fontWeight: 700 }}>EXPERIMENTAL</span>{" "}
        — Hardware adapters are an optional enhancement. Live streaming depends
        on your meter's protocol; results are meter-dependent. Manual entry is
        always the recommended primary workflow. Requires Chrome on Android or
        desktop.
      </div>

      {/* Platform capabilities banner */}
      {showBanner && capabilities && (
        <div
          style={{
            background: C.amber + "18",
            border: `1px solid ${C.amber}44`,
            borderRadius: 8,
            padding: "8px 10px",
            marginBottom: 12,
            fontFamily: mono,
            fontSize: 10,
            color: C.amber,
            lineHeight: 1.6,
          }}
        >
          {capabilities.note}
        </div>
      )}

      {loading && (
        <div
          style={{
            fontFamily: mono,
            fontSize: 10,
            color: C.dimmer,
            padding: 8,
          }}
        >
          Probing platform capabilities…
        </div>
      )}

      {!loading && adapterStates.length === 0 && (
        <div
          style={{
            fontFamily: mono,
            fontSize: 10,
            color: C.dimmer,
            padding: 8,
          }}
        >
          No adapters available on this platform.
        </div>
      )}

      {/* Adapter rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {adapterStates.map(
          ({ adapter, connected, streaming, status, lastReading, targetField }) => {
            const isManual = adapter.kind === "manual";
            const dot = isManual ? C.good : connected ? C.good : C.dimmer;
            const supportsStream =
              adapter.kind === "ble" || adapter.kind === "serial";

            return (
              <div
                key={adapter.id}
                style={{
                  background: C.panel2,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {/* ── Header row: dot / name / kind badge ── */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {/* Availability dot */}
                  <span
                    title={
                      isManual
                        ? "Always available"
                        : connected
                        ? "Connected"
                        : "Available — not connected"
                    }
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: streaming ? C.good : dot,
                      flexShrink: 0,
                      display: "inline-block",
                      boxShadow: streaming
                        ? `0 0 6px ${C.good}`
                        : undefined,
                      transition: "box-shadow 0.3s",
                    }}
                  />

                  {/* Name + kind badge */}
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 11,
                      color: C.text,
                      fontWeight: 600,
                      flex: 1,
                      minWidth: 120,
                    }}
                  >
                    {adapter.displayName}
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 9,
                        color: C.dimmer,
                        fontWeight: 400,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {adapter.kind}
                    </span>
                  </span>

                  {/* Manual entry label */}
                  {isManual && (
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: 9,
                        color: C.good,
                        fontWeight: 700,
                      }}
                    >
                      Always available — default
                    </span>
                  )}

                  {/* Connect / Disconnect for non-manual adapters */}
                  {!isManual && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {status && (
                        <span
                          style={{
                            fontFamily: mono,
                            fontSize: 9,
                            color: status.startsWith("Error")
                              ? C.bad
                              : status.startsWith("Stream")
                              ? C.good
                              : C.dim,
                            maxWidth: 220,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {status}
                        </span>
                      )}

                      {!connected ? (
                        <button
                          style={{
                            ...btn(C.blue, true),
                            padding: "5px 11px",
                            fontSize: 10,
                            minHeight: 28,
                          }}
                          onClick={() => void handleConnect(adapter.id)}
                        >
                          Connect
                        </button>
                      ) : (
                        <button
                          style={{
                            ...btn(C.dim, true),
                            padding: "5px 11px",
                            fontSize: 10,
                            minHeight: 28,
                          }}
                          onClick={() => void handleDisconnect(adapter.id)}
                        >
                          Disconnect
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Live stream panel (BLE / Serial only, when connected) ── */}
                {supportsStream && connected && (
                  <div
                    style={{
                      borderTop: `1px solid ${C.border}`,
                      paddingTop: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {/* Target field selector */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <label
                        style={{
                          fontFamily: mono,
                          fontSize: 9,
                          color: C.dimmer,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Target reading
                      </label>
                      <select
                        value={targetField}
                        onChange={(e) =>
                          handleTargetChange(
                            adapter.id,
                            e.target.value as keyof Observation
                          )
                        }
                        style={{
                          background: "#0A0A0E",
                          border: `1px solid ${C.border}`,
                          borderRadius: 6,
                          padding: "4px 7px",
                          fontSize: 10,
                          fontFamily: mono,
                          color: C.text,
                        }}
                      >
                        {TARGET_FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {FIELD_LABELS[f] ?? f}
                          </option>
                        ))}
                      </select>

                      {/* Stream start / stop */}
                      {!streaming ? (
                        <button
                          style={{
                            ...btn(C.good, true),
                            padding: "4px 10px",
                            fontSize: 10,
                            minHeight: 26,
                          }}
                          onClick={() => void handleStartStream(adapter.id)}
                        >
                          Start Stream
                        </button>
                      ) : (
                        <button
                          style={{
                            ...btn(C.bad, true),
                            padding: "4px 10px",
                            fontSize: 10,
                            minHeight: 26,
                          }}
                          onClick={() => void handleStopStream(adapter.id)}
                        >
                          Stop
                        </button>
                      )}
                    </div>

                    {/* Live reading display */}
                    {streaming && (
                      <div
                        style={{
                          background: "#0A0A0E",
                          border: `1px solid ${
                            lastReading ? C.good + "66" : C.border
                          }`,
                          borderRadius: 6,
                          padding: "10px 12px",
                          minHeight: 56,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          transition: "border-color 0.3s",
                        }}
                      >
                        {lastReading ? (
                          <>
                            {/* Large live value */}
                            <div
                              style={{
                                fontFamily: mono,
                                fontSize: 28,
                                fontWeight: 700,
                                color: C.good,
                                letterSpacing: -0.5,
                                lineHeight: 1.1,
                              }}
                            >
                              {formatValue(lastReading.value)}
                            </div>
                            {/* Field + timestamp meta */}
                            <div
                              style={{
                                display: "flex",
                                gap: 10,
                                alignItems: "baseline",
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: mono,
                                  fontSize: 9,
                                  color: C.blue,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                }}
                              >
                                {lastReading.field}
                              </span>
                              <span
                                style={{
                                  fontFamily: mono,
                                  fontSize: 9,
                                  color: C.dimmer,
                                }}
                              >
                                {new Date(lastReading.at).toLocaleTimeString()}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div
                            style={{
                              fontFamily: mono,
                              fontSize: 11,
                              color: C.dimmer,
                              alignSelf: "center",
                              marginTop: 8,
                            }}
                          >
                            Waiting for data from meter…
                          </div>
                        )}
                      </div>
                    )}

                    {/* Meter-dependence disclaimer */}
                    <div
                      style={{
                        fontFamily: mono,
                        fontSize: 9,
                        color: C.dimmer,
                        lineHeight: 1.5,
                      }}
                    >
                      Readings use ASCII-UART or float-characteristic decoding.
                      Proprietary binary protocols (UT161E, FS9721, etc.) require
                      a per-device codec and may show no data.{" "}
                      <span style={{ color: C.amber }}>
                        Manual entry remains the reliable default.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>
    </Card>
  );
}
