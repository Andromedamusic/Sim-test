/* ════════════════════════════════════════════════════════════════════════════
   METER PARSERS — generic decoders for common BLE and serial meter output.

   IMPORTANT: Exact frame formats are meter-specific. This module covers two
   widely-used interchange patterns:

     1. ASCII-UART lines — many inexpensive USB/BLE multimeters (e.g. UT61E
        via ES51922 chip, Victor series, Mastech MS8250) emit human-readable
        ASCII over their UART or BLE UART (NUS) service. Lines look like:
          "AC 120.3 V", "120.3VAC", "0.45 Ω", "RES 33.0", "OL"
        decodeAsciiLine() handles all of these plus scientific notation.

     2. Float characteristic — some proprietary BLE profiles (e.g. certain
        Fluke BLE accessories, smart-home sensing dongles) expose a single
        GATT characteristic that contains either:
          • IEEE-754 float32 little-endian (4 bytes)
          • int16 LE / 1000 fixed-point fallback (2 bytes)
        decodeFloatCharacteristic() tries float32 first, then int16/1000.

   Unknown or proprietary binary protocols (UT161E 10-byte frame, FS9721LP,
   CEM DT-912, etc.) require per-device codecs outside this module.
   ════════════════════════════════════════════════════════════════════════════ */

import type { Observation } from "../core";
import type { MeterReading } from "./types";

// ─── Nordic UART Service (NUS) well-known UUIDs ───────────────────────────────
// Used by a large portion of BLE multimeters that pipe ASCII over BLE.
/** NUS service UUID — 128-bit base. */
export const NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
/** NUS TX characteristic (meter → phone) — subscribe for notifications. */
export const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
/** NUS RX characteristic (phone → meter) — write commands to meter. */
export const NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface DecodedReading {
  /** Parsed numeric value. Infinity indicates an open-circuit / overload. */
  value: number;
  /** Raw unit token extracted from the input (e.g. "V", "VAC", "Ω", "Ohm", "Hz"). */
  unitRaw: string;
  /** Measurement mode inferred from unit tokens. UNKNOWN = no unit detected. */
  mode?: "VAC" | "VDC" | "OHM" | "HZ" | "UNKNOWN";
}

// ─── decodeAsciiLine ─────────────────────────────────────────────────────────

/**
 * Parse a single ASCII line from a meter's UART output.
 *
 * Handles formats observed in the wild:
 *   "AC 120.3 V"   →  { value: 120.3,    unitRaw: "V",   mode: "VAC" }
 *   "120.3VAC"     →  { value: 120.3,    unitRaw: "VAC", mode: "VAC" }
 *   "DC  -0.015V"  →  { value: -0.015,   unitRaw: "V",   mode: "VDC" }
 *   "OL"           →  { value: Infinity, unitRaw: "",    mode: "OHM" }
 *   "OPEN"         →  { value: Infinity, unitRaw: "",    mode: "OHM" }
 *   "0.45 Ω"       →  { value: 0.45,     unitRaw: "Ω",   mode: "OHM" }
 *   "RES 33.0"     →  { value: 33.0,     unitRaw: "",    mode: "OHM" }
 *   "50.1 Hz"      →  { value: 50.1,     unitRaw: "Hz",  mode: "HZ" }
 *   "1.23e2 V"     →  { value: 123,      unitRaw: "V",   mode: "VAC" }
 *
 * Returns null for lines that carry no parseable number.
 */
export function decodeAsciiLine(line: string): DecodedReading | null {
  // Normalise: collapse runs of whitespace, trim.
  const s = line.replace(/\s+/g, " ").trim();
  if (!s) return null;

  // ── Overload / open-circuit shortcuts ──────────────────────────────────────
  if (/^(OL|O\.L\.?|OPEN|OVERLOAD)$/i.test(s)) {
    return { value: Infinity, unitRaw: "", mode: "OHM" };
  }

  // ── Strip well-known leading mode keywords to simplify number extraction ───
  // "AC", "DC", "RES", "OHM", "HZ", "FREQ" as standalone prefix words.
  const prefixMatch = s.match(
    /^(AC|DC|RES|OHM|OHMS|HZ|FREQ)\s+(.*)/i
  );
  const prefixKeyword: string | null = prefixMatch
    ? prefixMatch[1].toUpperCase()
    : null;
  const remainder = prefixMatch ? prefixMatch[2] : s;

  // ── Extract the numeric part (supports scientific notation, sign, decimal) ─
  // Pattern: optional sign, digits, optional decimal + digits, optional exponent.
  const numMatch = remainder.match(
    /([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/
  );
  if (!numMatch) return null;

  const value = parseFloat(numMatch[1]);
  if (!isFinite(value) && !isNaN(value)) return null; // ±Infinity from parseFloat is not useful here
  if (isNaN(value)) return null;

  // ── Extract unit token after (or embedded in) the number ──────────────────
  // Look at everything that follows the numeric match in the full string.
  const afterNum = remainder.slice(
    remainder.indexOf(numMatch[1]) + numMatch[1].length
  ).trim();

  // Unit candidates: "VAC", "VDC", "V", "mV", "kΩ", "MΩ", "Ω", "Ohm", "Ohms",
  //                  "kOhm", "Hz", "kHz", "MHz" — case-insensitive.
  const unitMatch = afterNum.match(
    /^(m?VAC|m?VDC|m?V|[kKmMgG]?[ΩΩ]|[kKmM]?ohms?|[kKmMgG]?[Hh][Zz])/i
  );
  const unitRaw: string = unitMatch ? unitMatch[1] : "";

  // ── Infer mode ─────────────────────────────────────────────────────────────
  const u = unitRaw.toUpperCase();
  const kwUpper = prefixKeyword ?? "";

  let mode: DecodedReading["mode"] = "UNKNOWN";

  if (
    u.includes("VAC") ||
    kwUpper === "AC" ||
    (u.endsWith("V") && kwUpper === "AC")
  ) {
    mode = "VAC";
  } else if (
    u.includes("VDC") ||
    kwUpper === "DC" ||
    (u.endsWith("V") && kwUpper === "DC")
  ) {
    mode = "VDC";
  } else if (u.endsWith("V") && kwUpper === "") {
    // Bare "V" with no prefix — could be AC or DC; default to VAC (most common
    // for outlet diagnostics). Caller may override based on meter context.
    mode = "VAC";
  } else if (
    u.includes("Ω") ||
    u.includes("OHM") ||
    kwUpper === "RES" ||
    kwUpper === "OHM" ||
    kwUpper === "OHMS"
  ) {
    mode = "OHM";
  } else if (u.includes("HZ") || kwUpper === "HZ" || kwUpper === "FREQ") {
    mode = "HZ";
  }

  return { value, unitRaw, mode };
}

// ─── decodeNordicUartChunk ───────────────────────────────────────────────────

/**
 * Accumulate raw BLE notification bytes (UTF-8) into a carry buffer, then
 * split on CR/LF and decode each complete line.
 *
 * Usage pattern (BLE characteristicvaluechanged handler):
 *   const carry = { buf: "" };
 *   ...onchange = (e) => {
 *     const readings = decodeNordicUartChunk(e.target.value, carry);
 *     readings.forEach(r => onReading(readingToField(r, targetField)));
 *   };
 *
 * @param bytes  Raw bytes from the BLE characteristic notification.
 * @param carry  Mutable object persisting partial-line state across calls.
 */
export function decodeNordicUartChunk(
  bytes: Uint8Array,
  carry: { buf: string }
): DecodedReading[] {
  // Decode the UTF-8 bytes (NUS packets are almost always plain ASCII, but
  // UTF-8 is correct for the Ω symbol and similar glyphs some meters emit).
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  carry.buf += text;

  // Split on CR, LF, or CRLF. Keep the trailing incomplete fragment in buf.
  const parts = carry.buf.split(/\r\n|\r|\n/);
  carry.buf = parts.pop() ?? "";

  const results: DecodedReading[] = [];
  for (const line of parts) {
    const d = decodeAsciiLine(line);
    if (d !== null) results.push(d);
  }
  return results;
}

// ─── decodeFloatCharacteristic ───────────────────────────────────────────────

/**
 * Decode a short GATT characteristic value that contains a raw numeric
 * reading (no ASCII formatting). Two sub-formats are tried in order:
 *
 *   1. IEEE-754 float32 little-endian (4+ bytes) — used by some Fluke BLE
 *      accessories and DIY smart-meter dongles.
 *   2. int16 LE / 1000 fixed-point (2+ bytes) — a common compact encoding
 *      where 12034 represents 12.034 V.
 *
 * Mode is always UNKNOWN because there is no unit information in the raw value.
 * Callers should set the target field explicitly.
 *
 * Returns null if the DataView is too short or the decoded value is not finite.
 */
export function decodeFloatCharacteristic(
  dv: DataView
): DecodedReading | null {
  // Attempt 1: float32 LE (requires ≥ 4 bytes).
  if (dv.byteLength >= 4) {
    const f = dv.getFloat32(0, /* littleEndian= */ true);
    if (isFinite(f) && !isNaN(f)) {
      return { value: f, unitRaw: "", mode: "UNKNOWN" };
    }
  }

  // Attempt 2: int16 LE / 1000 fixed-point (requires ≥ 2 bytes).
  if (dv.byteLength >= 2) {
    const raw = dv.getInt16(0, /* littleEndian= */ true);
    const f = raw / 1000;
    if (isFinite(f)) {
      return { value: f, unitRaw: "", mode: "UNKNOWN" };
    }
  }

  return null;
}

// ─── readingToField ───────────────────────────────────────────────────────────

/**
 * Map a DecodedReading to a MeterReading targeting a specific Observation field.
 *
 * Special case: OHM mode + Infinity value → string "OL" (open-loop), which is
 * the conventional representation for ground-continuity overload in the
 * Observation schema (Gcont accepts string | number | null).
 */
export function readingToField(
  d: DecodedReading,
  target: keyof Observation
): MeterReading {
  let value: number | string;

  if (d.mode === "OHM" && d.value === Infinity) {
    value = "OL";
  } else {
    value = d.value;
  }

  return {
    field: target,
    value,
    at: new Date().toISOString(),
  };
}
