/* ════════════════════════════════════════════════════════════════════════════
   BLE METER ADAPTER — Web Bluetooth API (Chrome/Android; NOT iOS Safari).
   Connects to a generic Bluetooth Low Energy meter and streams voltage
   readings. Frame parsing is meter-specific and must be customised per
   device — the placeholder below emits a single float as "VHN".
   ════════════════════════════════════════════════════════════════════════════ */

import type { MeterAdapter, MeterReading } from "./types";
import type { Observation } from "../core";

// Standard GATT service UUIDs used by some multimeters.
const GATT_HEALTH_THERM = 0x1809;
// 0xFFF0 is a common vendor-defined service on budget BLE meters.
const GATT_VENDOR_METER = 0xfff0;

export class BLEMeterAdapter implements MeterAdapter {
  readonly id = "ble:generic";
  readonly displayName = "BLE Meter (generic)";
  readonly kind = "ble" as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private device: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private characteristic: any = null;
  private onReading: ((r: MeterReading) => void) | null = null;

  async isAvailable(): Promise<boolean> {
    try {
      if (typeof navigator === "undefined") return false;
      if (!("bluetooth" in navigator)) return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const avail = await (navigator as any).bluetooth?.getAvailability?.();
      return !!avail;
    } catch {
      return false;
    }
  }

  async connect(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [GATT_HEALTH_THERM, GATT_VENDOR_METER],
      });
    } catch (err) {
      // User cancelled or platform unsupported — surface as a non-fatal error.
      throw new Error(`BLE connect failed: ${String(err)}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.stopStream();
      this.device?.gatt?.disconnect();
    } catch {
      // Best-effort disconnect; ignore errors.
    } finally {
      this.device = null;
      this.characteristic = null;
    }
  }

  async startStream(onReading: (r: MeterReading) => void): Promise<void> {
    if (!this.device) throw new Error("BLEMeterAdapter: call connect() first");
    this.onReading = onReading;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const server = await this.device.gatt.connect();
      // Try the vendor service first, fall back to health thermometer.
      let service;
      try {
        service = await server.getPrimaryService(GATT_VENDOR_METER);
      } catch {
        service = await server.getPrimaryService(GATT_HEALTH_THERM);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chars: any[] = await service.getCharacteristics();
      this.characteristic = chars[0];

      // TODO: Real meter frame parsing is meter-specific. The proprietary
      // binary frames used by most BLE multimeters (UT161E, FS9721, etc.)
      // require a dedicated codec. This placeholder parses a raw float from
      // the first 4 bytes and reports it as VHN — replace with a proper
      // per-device frame decoder before production use.
      // Real meter frame parsing is meter-specific — see device datasheet.
      this.characteristic.addEventListener(
        "characteristicvaluechanged",
        this.handleValueChanged
      );
      await this.characteristic.startNotifications();
    } catch (err) {
      throw new Error(`BLE startStream failed: ${String(err)}`);
    }
  }

  async stopStream(): Promise<void> {
    try {
      if (this.characteristic) {
        this.characteristic.removeEventListener(
          "characteristicvaluechanged",
          this.handleValueChanged
        );
        await this.characteristic.stopNotifications?.();
      }
    } catch {
      // Best-effort.
    } finally {
      this.characteristic = null;
      this.onReading = null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleValueChanged = (event: any): void => {
    if (!this.onReading) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const view: DataView = event.target.value as any;
      // TODO: Replace with per-meter frame decoder. Most BLE meters use a
      // proprietary 9–14 byte frame — this placeholder just reads a float32.
      if (view.byteLength < 4) return;
      const raw = view.getFloat32(0, true);
      if (!isFinite(raw)) return;
      const field: keyof Observation = "VHN";
      this.onReading({ field, value: raw, at: new Date().toISOString() });
    } catch {
      // Silently ignore parse errors; never throw inside an event handler.
    }
  };
}
