/* ════════════════════════════════════════════════════════════════════════════
   THERMAL IMAGE ADAPTER — file-picker based; works on any platform.
   The user selects a thermal image; a vision model / hotspot ROI extractor
   would analyse it. The placeholder returns { thermalSlot: "both" } and
   stores the data URL for future processing.
   ════════════════════════════════════════════════════════════════════════════ */

import type { MeterAdapter, MeterReading } from "./types";
import type { Observation } from "../core";

export class ThermalImageAdapter implements MeterAdapter {
  readonly id = "thermal:image";
  readonly displayName = "Thermal Image (file picker)";
  readonly kind = "thermal" as const;

  async isAvailable(): Promise<boolean> {
    // The file-picker approach works everywhere; always report available.
    return true;
  }

  async connect(): Promise<void> {
    // No persistent connection — each captureSnapshot() opens its own picker.
  }

  async disconnect(): Promise<void> {
    // Nothing to disconnect.
  }

  async startStream(_onReading: (r: MeterReading) => void): Promise<void> {
    // Thermal images are one-shot snapshots, not a continuous stream.
  }

  async stopStream(): Promise<void> {
    // No stream to stop.
  }

  async captureSnapshot(): Promise<Partial<Observation>> {
    const dataUrl = await this.openFilePicker();
    if (!dataUrl) return {};

    // TODO: Pass `dataUrl` to a vision model or local hotspot ROI extractor.
    // Candidate approaches:
    //   • WebGL-based threshold analysis for hot/neutral/ground terminal regions
    //   • Off-device vision API call (requires connectivity — breaks offline-first)
    //   • ONNX Runtime Web for an on-device thermal segmentation model
    // Until then, return a conservative placeholder that flags both slots
    // so the engine knows thermal evidence exists but avoids false negatives.
    void dataUrl; // consumed by future vision pipeline
    return { thermalSlot: "both" };
  }

  /** Opens a native file picker and resolves with the image's data URL, or null on cancel. */
  private openFilePicker(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };

      // Handle the case where the user closes the picker without selecting.
      input.oncancel = () => resolve(null);

      document.body.appendChild(input);
      input.click();
      // Clean up after the dialog interaction is complete.
      setTimeout(() => document.body.removeChild(input), 30_000);
    });
  }
}
