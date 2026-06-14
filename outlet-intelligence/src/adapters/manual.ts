/* ════════════════════════════════════════════════════════════════════════════
   MANUAL ENTRY ADAPTER — always available, always the default.
   "Streaming" is a no-op: readings come from the user filling in the form.
   ════════════════════════════════════════════════════════════════════════════ */

import type { MeterAdapter, MeterReading } from "./types";

export class ManualEntryAdapter implements MeterAdapter {
  readonly id = "manual";
  readonly displayName = "Manual Entry";
  readonly kind = "manual" as const;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async connect(): Promise<void> {
    // No hardware connection required for manual entry.
  }

  async disconnect(): Promise<void> {
    // Nothing to disconnect.
  }

  async startStream(_onReading: (r: MeterReading) => void): Promise<void> {
    // Readings arrive via the form, not a streaming callback.
  }

  async stopStream(): Promise<void> {
    // No stream to stop.
  }
}
