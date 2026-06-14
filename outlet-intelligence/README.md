# Outlet Intelligence

Recursive home electrical outlet diagnostic intelligence — measure outlets with a multimeter, place them on a room map, and roll up to a whole-home electrical health model. Works fully offline as a PWA on phone or desktop. The diagnostic engine is deterministic, dependency-free Bayesian inference: no cloud, no ML model, no API key.

---

## Overview

- **Per-outlet diagnosis** — enter voltage readings (VHN, VHG, VNG), continuity, behavioral flags. The engine produces a ranked posterior across 16 fault hypotheses, a safety verdict, and the next best measurement to take.
- **Room & floor atlas** — place outlets on a 2-D floor plan; the home rolls up to a RAG health grade.
- **Whole-home rollup** — aggregate severity scores surface the riskiest circuits and rooms at a glance.
- **Offline-first PWA** — service worker precaches the shell; all diagnostics run client-side. No data leaves the device.
- **Phone + desktop** — responsive React UI; works with a capacitive-touch multimeter workflow.
- **Deterministic Bayesian engine** — 16 fault hypotheses with per-era base priors, Gaussian/special likelihoods, 6 critic agents, safety-asymmetric tribunal verdicts, and AI second-opinion (optional, requires network).

---

## Quick Start

```bash
npm install
npm run dev          # Vite dev server — http://localhost:5173
npm run build        # Production build → dist/
npm run build:single # Single-file bundle (vite.single.config.ts) → dist-single/
npm test             # Dyno safety harness (Vitest)
```

---

## Architecture

```
src/
  core/        Dependency-free diagnostic engine (types, faults, likelihoods,
               inference, critics, tribunal, rollup, nextBestTest, prognose).
               Import @core from any environment — Node, Deno, browser, worker.
  data/        Dexie (IndexedDB) persistence — homes, floors, rooms, circuits,
               outlets, cached AI reports.
  state/       Zustand stores — selected home/floor/room/outlet, UI mode.
  ui/          React components — App, AtlasView, DiagnosticWidget, theme tokens.
  ai/          Optional AI second-opinion (network-gated, gracefully degrades).
  adapters/    Bridge types for export/import and external integrations.

dyno/          Vitest safety harness — deterministic golden-value tests for all
               16 fault signatures, tribunal verdicts, and safety-gate logic.

schema/        home-export.schema.json — JSON Schema (draft 2020-12) for the
               HomeExportDoc wire format.

public/
  sw.js                   Offline-first service worker (cache-first, nav fallback).
  manifest.webmanifest    PWA manifest.
  icon.svg / icon-*.png   App icons.
```

---

## Safety Model

The engine is deliberately **safety-asymmetric**:

- **SAFETY HOLD** — any lethal fault hypothesis (`lethal: true`, e.g. energized ground, open neutral under load) with posterior above the hold threshold causes an unconditional hold regardless of other critics. The hold is never cleared by confidence alone.
- **LIVE_CASE** — a special critic veto gate prevents reclassifying an energized-ground outlet as anything safer than CONDEMN once evidence supports it.
- **Safety-recall gate** — `SAFETY HOLD` and `CONDEMN` verdicts require explicit technician acknowledgement before the outlet can be marked resolved.
- The engine **never outputs PASS** when any lethal fault has a non-negligible posterior.

Verdict hierarchy (descending severity): `SAFETY HOLD` > `CONDEMN` > `DEFECT` > `MINOR` > `PASS` > `INCONCLUSIVE`.

---

## Diagnostic Engine Detail

| Aspect | Detail |
|---|---|
| Fault hypotheses | 16 (open ground, open neutral, bootleg ground, reversed polarity, energized ground, high resistance, shared neutral, aluminum wiring degradation, GFCI fault, AFCI fault, loose connection, floating neutral, partial open, voltage collapse, normal, and more) |
| Critics | 6 — Conservation (voltage-law consistency), Artifact (meter-loading artifact detection), Worst-Case (safety-bias), Parsimony (Occam penalty for compound faults), Base-Rate (era/material priors), Contrarian (anti-anchoring) |
| Verdicts | SAFETY HOLD / PASS / CONDEMN / DEFECT / MINOR / INCONCLUSIVE |
| Prognosis | Thermal runaway estimate: dissipated power → terminal temp → months-to-failure |
| Next-best test | Information-gain ranked list of remaining measurements |

---

## Dashboard Integration

### Engine (headless)

```ts
import { analyzeOutlet, type Observation, type Meta } from "./src/core";

const obs: Observation = { VHN: 121.4, VHG: 0.3, VNG: 0.2, Gcont: 0.8 };
const meta: Meta = { era: "1990-2000", wireMat: "Copper", meter: "Fluke 117", meterZ: 10e6 };
const result = analyzeOutlet(obs, meta);
console.log(result.verdict, result.confidence);
```

### Widget (React)

```tsx
import { DiagnosticWidget } from "./src/ui/DiagnosticWidget";

<DiagnosticWidget
  initialObservations={{ VHN: 121.4, VHG: 0.3 }}
  meta={{ era: "2010+", wireMat: "Copper", meter: "Fluke 117", meterZ: 10e6 }}
  onResult={(r) => console.log(r.verdictCode)}
/>
```

### Export Schema

The `schema/home-export.schema.json` (JSON Schema draft 2020-12) describes the `HomeExportDoc` wire format used by the export/import feature. Validate with any draft-2020-12-compatible validator (e.g. `ajv`, `@cfworker/json-schema`).

---

## Offline / PWA

The service worker (`public/sw.js`) uses a **cache-first** strategy for all same-origin GET requests with runtime caching of newly fetched assets. Navigation requests fall back to the cached `index.html` shell, so the app loads fully offline after first visit. To update the cache, bump `CACHE_NAME` in `sw.js`.

To install the app on iOS: Safari → Share → Add to Home Screen. On Android/Chrome: the browser will prompt automatically.

---

## Disclaimer

**Outlet Intelligence is a diagnostic support tool — not a substitute for a licensed electrician.**

- Voltage and continuity readings presented by this app are only as reliable as the meter, technique, and evidence entered by the user.
- **Always de-energize the circuit at the breaker panel and verify with a non-contact voltage tester before performing any continuity or resistance measurements.**
- A `PASS` verdict means the evidence entered does not support a fault, not that the outlet is certified safe.
- `SAFETY HOLD` and `CONDEMN` verdicts should be acted upon by a licensed electrician (or qualified homeowner where permitted by local code).
- The authors accept no liability for electrical hazards, property damage, or personal injury arising from use of this application.
