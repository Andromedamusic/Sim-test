/* ════════════════════════════════════════════════════════════════════════════
   SERIAL METER ADAPTER — Web Serial API (Chrome/Edge desktop; NOT Safari/iOS).
   Connects to a USB/serial multimeter at 9600 baud and streams voltage
   readings. Line parsing is meter-specific and must be customised per
   device — the placeholder below parses a leading float as "VHN".
   ════════════════════════════════════════════════════════════════════════════ */

import type { MeterAdapter, MeterReading } from "./types";
import type { Observation } from "../core";

export class SerialMeterAdapter implements MeterAdapter {
  readonly id = "serial:generic";
  readonly displayName = "Serial / USB Meter (generic)";
  readonly kind = "serial" as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private port: any = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private streamActive = false;

  async isAvailable(): Promise<boolean> {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  async connect(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate: 9600 });
    } catch (err) {
      throw new Error(`Serial connect failed: ${String(err)}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.stopStream();
      await this.port?.close?.();
    } catch {
      // Best-effort disconnect.
    } finally {
      this.port = null;
    }
  }

  async startStream(onReading: (r: MeterReading) => void): Promise<void> {
    if (!this.port) throw new Error("SerialMeterAdapter: call connect() first");
    this.streamActive = true;
    try {
      const textDecoder = new TextDecoderStream();
      this.port.readable.pipeTo(textDecoder.writable);
      this.reader = textDecoder.readable.getReader();
      this.readLoop(onReading);
    } catch (err) {
      throw new Error(`Serial startStream failed: ${String(err)}`);
    }
  }

  async stopStream(): Promise<void> {
    this.streamActive = false;
    try {
      await this.reader?.cancel();
    } catch {
      // Best-effort.
    } finally {
      this.reader = null;
    }
  }

  private async readLoop(onReading: (r: MeterReading) => void): Promise<void> {
    let lineBuffer = "";
    while (this.streamActive && this.reader) {
      try {
        const { value, done } = await this.reader.read();
        if (done) break;
        lineBuffer += value;
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          this.parseLine(line.trim(), onReading);
        }
      } catch {
        // Stream ended or was cancelled — exit gracefully.
        break;
      }
    }
  }

  private parseLine(
    line: string,
    onReading: (r: MeterReading) => void
  ): void {
    if (!line) return;
    // TODO: Replace with per-meter line parser. Serial multimeters (e.g.
    // Fluke 87V, UT61E) use varying ASCII/binary protocols. This placeholder
    // extracts a leading float from a space- or comma-separated line and
    // reports it as VHN — replace with a proper protocol decoder.
    // Real meter serial protocols are meter-specific — see device datasheet.
    const match = line.match(/^[-+]?[0-9]*\.?[0-9]+/);
    if (!match) return;
    const raw = parseFloat(match[0]);
    if (!isFinite(raw)) return;
    const field: keyof Observation = "VHN";
    onReading({ field, value: raw, at: new Date().toISOString() });
  }
}
