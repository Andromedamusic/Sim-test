/* ════════════════════════════════════════════════════════════════════════════
   BLE METER ADAPTER — Web Bluetooth API (Chrome/Android; NOT iOS Safari).

   Connects to any BLE meter via a two-tier discovery strategy:

     Tier 1 — Nordic UART Service (NUS, UUID 6e400001-…).
       The de-facto standard for BLE multimeters that stream ASCII readings
       (Victor VC921, Zotek ZT-M1, Owon B35T+, some Uni-T variants).
       On the NUS TX characteristic we receive UTF-8 chunks, accumulate them
       in a carry buffer, split on CR/LF, and decode each line with
       decodeAsciiLine(). This handles the widest range of affordable meters.

     Tier 2 — Fallback notifiable characteristic.
       If NUS is absent, we walk all services listed in optionalServices and
       take the first characteristic with the NOTIFY property. We then decode
       its value with decodeFloatCharacteristic() (float32 LE → int16/1000
       fallback). This covers some Fluke BLE accessories and DIY dongles that
       publish a raw float rather than an ASCII stream.

   LIMITATIONS:
   • Proprietary binary protocols (UT161E 10-byte frame, FS9721LP 14-byte
     frame, CEM DT-912, etc.) are NOT decoded here. They require per-device
     codecs.
   • iOS Safari has no Web Bluetooth at all — isAvailable() returns false.
   • The browser requires a user gesture (button click) to call requestDevice;
     calling connect() from a timer or useEffect will throw.
   • Only one BLEMeterAdapter instance should be connected at a time per tab
     because navigator.bluetooth.requestDevice() is modal.
   ════════════════════════════════════════════════════════════════════════════ */

import type { MeterAdapter, MeterReading } from "./types";
import type { Observation } from "../core";
import {
  NUS_SERVICE,
  NUS_TX,
  decodeNordicUartChunk,
  decodeFloatCharacteristic,
  readingToField,
} from "./parsers";

// Standard GATT service UUIDs included in optionalServices so Chrome permits
// discovery even when the user picks a device that only exposes one of them.
const GATT_HEALTH_THERM = 0x1809; // standard temperature
const GATT_VENDOR_METER = 0xfff0; // common budget-meter vendor service
const GATT_BATTERY = 0x180f;

export class BLEMeterAdapter implements MeterAdapter {
  readonly id = "ble:generic";
  readonly displayName = "BLE Meter (generic)";
  readonly kind = "ble" as const;

  /**
   * Which Observation field incoming readings are mapped to.
   * The UI can mutate this before or during a stream to redirect readings.
   */
  targetField: keyof Observation = "VHN";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private device: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private server: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private characteristic: any = null;
  private onReading: ((r: MeterReading) => void) | null = null;

  // Carry buffer for NUS ASCII accumulation across BLE packets.
  private nusBuf: { buf: string } = { buf: "" };

  // ── isAvailable ─────────────────────────────────────────────────────────────

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

  // ── connect ──────────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    try {
      // requestDevice() shows the browser's device-picker dialog.
      // We advertise all optional services so Chrome grants access to them
      // regardless of which device the user selects.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          NUS_SERVICE,
          GATT_HEALTH_THERM,
          GATT_VENDOR_METER,
          GATT_BATTERY,
        ],
      });

      // Connect to the GATT server immediately so the UI can show "Connected"
      // before startStream() is called.
      this.server = await this.device.gatt.connect();
    } catch (err) {
      // User cancelled the picker or the platform threw — surface as Error.
      this.device = null;
      this.server = null;
      throw new Error(`BLE connect failed: ${String(err)}`);
    }
  }

  // ── disconnect ───────────────────────────────────────────────────────────────

  async disconnect(): Promise<void> {
    try {
      await this.stopStream();
    } catch {
      // Ignore stopStream errors during disconnect.
    }
    try {
      // gatt.disconnect() is synchronous in the Web BT spec but we wrap
      // defensively in case some UA makes it async.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.device?.gatt as any)?.disconnect?.();
    } catch {
      // Best-effort; device may already be gone.
    } finally {
      this.device = null;
      this.server = null;
      this.characteristic = null;
    }
  }

  // ── startStream ──────────────────────────────────────────────────────────────

  async startStream(onReading: (r: MeterReading) => void): Promise<void> {
    if (!this.device || !this.server) {
      throw new Error("BLEMeterAdapter: call connect() first");
    }
    this.onReading = onReading;
    this.nusBuf = { buf: "" }; // reset carry buffer on each new stream

    try {
      // ── Tier 1: Try Nordic UART Service (NUS) ─────────────────────────────
      let usedNus = false;
      try {
        const nusService = await this.server.getPrimaryService(NUS_SERVICE);
        // NUS TX is the characteristic the meter notifies (meter → phone).
        const nusTx = await nusService.getCharacteristic(NUS_TX);
        this.characteristic = nusTx;

        this.characteristic.addEventListener(
          "characteristicvaluechanged",
          this.handleNusValueChanged
        );
        await this.characteristic.startNotifications();
        usedNus = true;
      } catch {
        // NUS not available on this device — fall through to tier 2.
      }

      // ── Tier 2: Walk optionalServices for any notifiable characteristic ───
      if (!usedNus) {
        const serviceUuids = [
          GATT_HEALTH_THERM,
          GATT_VENDOR_METER,
          GATT_BATTERY,
        ];

        let found = false;
        for (const uuid of serviceUuids) {
          if (found) break;
          try {
            const svc = await this.server.getPrimaryService(uuid);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const chars: any[] = await svc.getCharacteristics();
            for (const ch of chars) {
              // Check for NOTIFY property (0x10 bit in properties bitmask).
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const props = ch.properties as any;
              if (props?.notify === true) {
                this.characteristic = ch;
                this.characteristic.addEventListener(
                  "characteristicvaluechanged",
                  this.handleFloatValueChanged
                );
                await this.characteristic.startNotifications();
                found = true;
                break;
              }
            }
          } catch {
            // Service not present — try next.
          }
        }

        if (!found) {
          throw new Error(
            "BLE startStream: no notifiable characteristic found. " +
              "Connect a meter that uses Nordic UART Service or exposes a " +
              "standard GATT health/vendor service with NOTIFY."
          );
        }
      }
    } catch (err) {
      this.characteristic = null;
      this.onReading = null;
      throw new Error(`BLE startStream failed: ${String(err)}`);
    }
  }

  // ── stopStream ───────────────────────────────────────────────────────────────

  async stopStream(): Promise<void> {
    try {
      if (this.characteristic) {
        // Remove both possible listeners — only one will have been attached.
        this.characteristic.removeEventListener(
          "characteristicvaluechanged",
          this.handleNusValueChanged
        );
        this.characteristic.removeEventListener(
          "characteristicvaluechanged",
          this.handleFloatValueChanged
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

  // ── Private event handlers ────────────────────────────────────────────────────

  /**
   * Handler for NUS TX notifications. Accumulates UTF-8 bytes, splits on
   * CR/LF, and calls decodeAsciiLine on each complete line.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleNusValueChanged = (event: any): void => {
    if (!this.onReading) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dv: DataView = event.target.value as any;
      const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      const readings = decodeNordicUartChunk(bytes, this.nusBuf);
      for (const d of readings) {
        this.onReading(readingToField(d, this.targetField));
      }
    } catch {
      // Silently ignore parse errors — never throw inside an event handler.
    }
  };

  /**
   * Handler for fallback float characteristics. Tries float32 LE then
   * int16/1000 fixed-point.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleFloatValueChanged = (event: any): void => {
    if (!this.onReading) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dv: DataView = event.target.value as any;
      const d = decodeFloatCharacteristic(dv);
      if (d !== null) {
        this.onReading(readingToField(d, this.targetField));
      }
    } catch {
      // Silently ignore parse errors.
    }
  };
}
