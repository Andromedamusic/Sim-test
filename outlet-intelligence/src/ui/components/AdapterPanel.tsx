/* ════════════════════════════════════════════════════════════════════════════
   ADAPTER PANEL — experimental hardware connectivity UI.
   Shows which meter adapters are available on this platform and lets the
   user connect/disconnect non-manual adapters. Manual entry is always the
   primary, production-ready path; BLE/Serial/Thermal are experimental.
   ════════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useState } from "react";
import { C, mono, btn } from "../theme";
import { Card } from "../components";
import {
  availableAdapters,
  platformCapabilities,
  type PlatformCapabilities,
} from "../../adapters/registry";
import type { MeterAdapter } from "../../adapters/types";

interface AdapterState {
  adapter: MeterAdapter;
  connected: boolean;
  status: string;
}

export function AdapterPanel() {
  const [adapterStates, setAdapterStates] = useState<AdapterState[]>([]);
  const [capabilities, setCapabilities] = useState<PlatformCapabilities | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const [adapters, caps] = await Promise.all([
        availableAdapters(),
        platformCapabilities(),
      ]);
      if (cancelled) return;
      setAdapterStates(
        adapters.map((a) => ({ adapter: a, connected: false, status: "" }))
      );
      setCapabilities(caps);
      setLoading(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConnect(id: string) {
    setAdapterStates((prev) =>
      prev.map((s) =>
        s.adapter.id === id ? { ...s, status: "Connecting…" } : s
      )
    );
    const target = adapterStates.find((s) => s.adapter.id === id);
    if (!target) return;
    try {
      await target.adapter.connect();
      setAdapterStates((prev) =>
        prev.map((s) =>
          s.adapter.id === id
            ? { ...s, connected: true, status: "Connected" }
            : s
        )
      );
    } catch (err) {
      setAdapterStates((prev) =>
        prev.map((s) =>
          s.adapter.id === id
            ? { ...s, connected: false, status: `Error: ${String(err)}` }
            : s
        )
      );
    }
  }

  async function handleDisconnect(id: string) {
    setAdapterStates((prev) =>
      prev.map((s) =>
        s.adapter.id === id ? { ...s, status: "Disconnecting…" } : s
      )
    );
    const target = adapterStates.find((s) => s.adapter.id === id);
    if (!target) return;
    try {
      await target.adapter.disconnect();
      setAdapterStates((prev) =>
        prev.map((s) =>
          s.adapter.id === id
            ? { ...s, connected: false, status: "Disconnected" }
            : s
        )
      );
    } catch (err) {
      setAdapterStates((prev) =>
        prev.map((s) =>
          s.adapter.id === id
            ? { ...s, status: `Error: ${String(err)}` }
            : s
        )
      );
    }
  }

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
        — Hardware adapters are an optional enhancement. Manual entry is always
        available and is the recommended primary workflow. Live meter streaming
        requires Chrome on Android or desktop.
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
          style={{ fontFamily: mono, fontSize: 10, color: C.dimmer, padding: 8 }}
        >
          Probing platform capabilities…
        </div>
      )}

      {!loading && adapterStates.length === 0 && (
        <div
          style={{ fontFamily: mono, fontSize: 10, color: C.dimmer, padding: 8 }}
        >
          No adapters available on this platform.
        </div>
      )}

      {/* Adapter rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {adapterStates.map(({ adapter, connected, status }) => {
          const isManual = adapter.kind === "manual";
          const dot = isManual ? C.good : connected ? C.good : C.dimmer;

          return (
            <div
              key={adapter.id}
              style={{
                background: C.panel2,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "9px 11px",
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
                  background: dot,
                  flexShrink: 0,
                  display: "inline-block",
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {status && (
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: 9,
                        color: status.startsWith("Error") ? C.bad : C.dim,
                        maxWidth: 180,
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
                      style={{ ...btn(C.blue, true), padding: "5px 11px", fontSize: 10, minHeight: 28 }}
                      onClick={() => void handleConnect(adapter.id)}
                    >
                      Connect
                    </button>
                  ) : (
                    <button
                      style={{ ...btn(C.dim, true), padding: "5px 11px", fontSize: 10, minHeight: 28 }}
                      onClick={() => void handleDisconnect(adapter.id)}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
