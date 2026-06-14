/* ════════════════════════════════════════════════════════════════════════════
   SERIAL METER ADAPTER — Web Serial API (Chrome/Edge desktop; NOT Safari/iOS).

   Opens a user-selected serial port at 9600 baud (the industry-standard
   baud rate for DMMs), pipes the byte stream through a TextDecoderStream,
   and accumulates characters into a line buffer. Each complete CR/LF-delimited
   line is forwarded to decodeAsciiLine().

   SUPPORTED METERS (ASCII-UART at 9600 baud):
   • UT61E / UT61B / UT61D (ES51922 chip) — "AC 120.3 V\r\n" format.
   • Victor VC830L, VC86E — similar ASCII frames.
   • Fluke 87V with PC serial interface — "120.3 VAC\r\n".
   • Any meter whose USB-CDC or RS-232 adapter presents ASCII readings at 9600.

   LIMITATIONS:
   • Some meters use non-standard baud rates (2400, 19200, 115200). Expose
     a constructor option or UI setting if you need to support those.
   • Binary protocols (Fluke IrDA, UT61E advanced mode) are not decoded here.
   • Web Serial requires a Chromium-based browser on desktop; isAvailable()
     returns false on Safari, Firefox, and iOS.
   • The browser requires a user gesture (button click) to call requestPort().
   • Only one port can be open per SerialMeterAdapter instance. Reconnection
     after a port error requires calling disconnect() then connect() again.
   ════════════════════════════════════════════════════════════════════════════ */

import type { MeterAdapter, MeterReading } from "./types";
import type { Observation } from "../core";
import { decodeAsciiLine, readingToField } from "./parsers";

/** Default baud rate — covers the majority of ASCII-UART DMMs. */
const DEFAULT_BAUD = 9600;

export class SerialMeterAdapter implements MeterAdapter {
  readonly id = "serial:generic";
  readonly displayName = "Serial / USB Meter (generic)";
  readonly kind = "serial" as const;

  /**
   * Which Observation field incoming readings are mapped to.
   * The UI can mutate this before or during a stream to redirect readings.
   */
  targetField: keyof Observation = "VHN";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private port: any = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private streamActive = false;
  // Reference to the pipe abort controller so we can cancel the piping.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pipeController: any = null;

  // ── isAvailable ─────────────────────────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  // ── connect ──────────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    try {
      // requestPort() shows the browser's port-picker dialog; requires a user
      // gesture.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate: DEFAULT_BAUD });
    } catch (err) {
      this.port = null;
      throw new Error(`Serial connect failed: ${String(err)}`);
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
      await this.port?.close?.();
    } catch {
      // Best-effort — port may already be closed.
    } finally {
      this.port = null;
    }
  }

  // ── startStream ──────────────────────────────────────────────────────────────

  async startStream(onReading: (r: MeterReading) => void): Promise<void> {
    if (!this.port) {
      throw new Error("SerialMeterAdapter: call connect() first");
    }
    this.streamActive = true;

    try {
      // TextDecoderStream converts the raw Uint8Array chunks from the serial
      // readable into UTF-8 strings, which we then line-buffer in readLoop.
      const textDecoder = new TextDecoderStream();

      // pipeTo is fire-and-forget — we save the writable side's abort
      // controller so we can cancel it in stopStream.
      const abortController = new AbortController();
      this.pipeController = abortController;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.port.readable as any)
        .pipeTo(textDecoder.writable, { signal: abortController.signal })
        .catch(() => {
          // Pipe errors on cancel are expected — suppress them.
        });

      this.reader = textDecoder.readable.getReader();
      // Run the read loop without awaiting — it runs until streamActive=false.
      void this.readLoop(onReading);
    } catch (err) {
      this.streamActive = false;
      this.reader = null;
      this.pipeController = null;
      throw new Error(`Serial startStream failed: ${String(err)}`);
    }
  }

  // ── stopStream ───────────────────────────────────────────────────────────────

  async stopStream(): Promise<void> {
    this.streamActive = false;
    try {
      // Cancel the reader first — this unblocks any pending read().
      await this.reader?.cancel();
    } catch {
      // Best-effort.
    }
    try {
      // Abort the pipe so the writable side closes cleanly.
      this.pipeController?.abort?.();
    } catch {
      // Best-effort.
    }
    this.reader = null;
    this.pipeController = null;
  }

  // ── Private: read loop ────────────────────────────────────────────────────────

  /**
   * Reads text chunks from the serial port's decoded stream, accumulates them
   * into a line buffer, and calls parseLine() on each complete line.
   *
   * Runs until streamActive is false, the reader is cancelled, or the port
   * closes (reader.read() returns { done: true }).
   */
  private async readLoop(
    onReading: (r: MeterReading) => void
  ): Promise<void> {
    let lineBuffer = "";

    while (this.streamActive && this.reader) {
      try {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (!value) continue;

        lineBuffer += value;

        // Split on CR, LF, or CRLF. The trailing incomplete fragment stays
        // in the buffer for the next iteration.
        const parts = lineBuffer.split(/\r\n|\r|\n/);
        lineBuffer = parts.pop() ?? "";

        for (const line of parts) {
          this.parseLine(line.trim(), onReading);
        }
      } catch {
        // Reader was cancelled (stopStream) or port was lost — exit cleanly.
        break;
      }
    }
  }

  /**
   * Decode a single trimmed line using the generic ASCII parser and emit a
   * reading for the currently configured targetField.
   */
  private parseLine(
    line: string,
    onReading: (r: MeterReading) => void
  ): void {
    if (!line) return;
    const d = decodeAsciiLine(line);
    if (d === null) return;
    onReading(readingToField(d, this.targetField));
  }
}
