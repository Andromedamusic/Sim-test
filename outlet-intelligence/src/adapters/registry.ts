/* ════════════════════════════════════════════════════════════════════════════
   ADAPTER REGISTRY — central factory and availability queries.
   Import from here rather than constructing adapters directly.
   ════════════════════════════════════════════════════════════════════════════ */

import type { MeterAdapter } from "./types";
import { ManualEntryAdapter } from "./manual";
import { BLEMeterAdapter } from "./ble";
import { SerialMeterAdapter } from "./serial";
import { ThermalImageAdapter } from "./thermal";

/** Returns one instance of every registered adapter (regardless of availability). */
export function allAdapters(): MeterAdapter[] {
  return [
    new ManualEntryAdapter(),
    new BLEMeterAdapter(),
    new SerialMeterAdapter(),
    new ThermalImageAdapter(),
  ];
}

/** Returns only the adapters that report themselves as available on this platform. */
export async function availableAdapters(): Promise<MeterAdapter[]> {
  const adapters = allAdapters();
  const results = await Promise.all(
    adapters.map(async (a) => ({ adapter: a, ok: await a.isAvailable() }))
  );
  return results.filter((r) => r.ok).map((r) => r.adapter);
}

/** Always returns a ManualEntryAdapter — the universal fallback. */
export const defaultAdapter = (): MeterAdapter => new ManualEntryAdapter();

export interface PlatformCapabilities {
  ble: boolean;
  serial: boolean;
  /** Human-readable explanation of what is and isn't available and why. */
  note: string;
}

/**
 * Probes platform capabilities and returns a human-readable note for the UI.
 *
 * Web Bluetooth and Web Serial are only available in Chromium-based browsers
 * on Android and desktop. iOS Safari does not support either API. Manual entry
 * always works on every platform and browser.
 */
export async function platformCapabilities(): Promise<PlatformCapabilities> {
  const bleAdapter = new BLEMeterAdapter();
  const serialAdapter = new SerialMeterAdapter();

  const [ble, serial] = await Promise.all([
    bleAdapter.isAvailable(),
    serialAdapter.isAvailable(),
  ]);

  let note: string;
  if (ble && serial) {
    note =
      "BLE and Serial are both available. Connect a compatible meter to stream live readings.";
  } else if (ble && !serial) {
    note =
      "Bluetooth (BLE) is available but Web Serial is not supported on this browser/platform. " +
      "For Serial support use Chrome or Edge on desktop.";
  } else if (!ble && serial) {
    note =
      "Web Serial is available but Web Bluetooth is not supported on this browser/platform. " +
      "For BLE support use Chrome on Android or desktop.";
  } else {
    // Neither available — likely iOS Safari or Firefox.
    note =
      "BLE and Serial are not available on this browser/platform. " +
      "iOS Safari does not support Web Bluetooth or Web Serial. " +
      "For wireless meter support use Chrome on Android or a Chromium-based browser on desktop. " +
      "Manual entry always works on every platform.";
  }

  return { ble, serial, note };
}
