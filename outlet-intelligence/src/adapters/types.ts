/* ════════════════════════════════════════════════════════════════════════════
   ADAPTER TYPES — hardware-adapter abstraction for outlet diagnostics.
   Adapters normalize meter hardware into Partial<Observation> so the engine
   remains decoupled from physical connectivity.
   ════════════════════════════════════════════════════════════════════════════ */

import type { Observation } from "../core";

/** A single reading from a meter, referencing a field in the Observation schema. */
export interface MeterReading {
  field: keyof Observation;
  value: number | string;
  at: string; // ISO-8601 timestamp
}

/** Common contract every hardware adapter must satisfy. */
export interface MeterAdapter {
  /** Stable identifier for this adapter instance (e.g. "ble:generic", "serial:generic"). */
  id: string;
  /** Human-readable label shown in the UI. */
  displayName: string;
  /** Adapter transport category. */
  kind: "manual" | "ble" | "serial" | "thermal";

  /** Returns true if this adapter can operate on the current platform/browser. */
  isAvailable(): Promise<boolean>;

  /** Open the connection to the hardware device. */
  connect(): Promise<void>;

  /** Close the connection to the hardware device. */
  disconnect(): Promise<void>;

  /**
   * Begin streaming readings from the device.
   * @param onReading Callback invoked for every parsed reading.
   */
  startStream(onReading: (r: MeterReading) => void): Promise<void>;

  /** Stop the active stream. */
  stopStream(): Promise<void>;

  /**
   * Optional: capture a one-shot snapshot (e.g. a thermal image).
   * Returns a partial Observation that can be merged into the active session.
   */
  captureSnapshot?(): Promise<Partial<Observation>>;
}
