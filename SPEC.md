### **\u2611 Scope v 3.0 — *“Residential Electrical-Panel Estimator & Cost Optimizer”***

*(Fully integrates O-series refinements, P-series personalized features, and N-series enhancements.  This is the **single, comprehensive prompt** to hand to the development team / next-stage LLM for actual code generation.)*

---

## 1 Mission & Success Criteria

| ID  | Goal                                                                                                                                                                                  | Quantifiable Success Test                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| G-1 | Accept Zillow-style inputs + optional custom circuits and instantly output a **legacy vs 2025-ready panel** with NEC-compliant load calc.                                             | < 1 s recompute latency, ≤ ±10 % of NEC Std. Method benchmark.                             |
| G-2 | **Dual SVG canvases** show the inferred historic panel (left) and a balanced modern panel with ≥ 25 % spare capacity plus “Good / Better / Best” upgrade tiers (200 A, 225 A, 320 A). | Visual accuracy ±1 pole; leg imbalance ≤ 10 %.                                             |
| G-3 | Display **ZIP-specific monthly cost & CO₂** for legacy and modern scenarios under the cheapest available tariff.                                                                      | Cost error ≤ 2 % vs utility simulator; CO₂ calc uses eGRID/WattTime intensity within ±5 %. |
| G-4 | Generate a downloadable **PDF report** (panel diagrams, load tables, tariff analysis, carbon delta).                                                                                  | PDF < 2 MB, renders identically in Chrome & Acrobat.                                       |
| G-5 | Mobile UX remains fully functional (swipe-toggle panels, collapsible inputs).                                                                                                         | Lighthouse mobile score ≥ 90.                                                              |

---

## 2 Core Inputs

```json
{
  "sqft": 0,
  "beds": 0,
  "baths": 0,
  "yearBuilt": 0,
  "zip": "#####",
  "buildingType": "SF|DUP|QPLX|MF",
  "amenities": {
    "pool": false,
    "hotTub": false,
    "well": false,
    "workshop": false,
    "evReady": false
  },
  "der": {              // distributed-energy resources
    "hasPV": false,
    "hasESS": false
  },
  "extras": {
    "maker": false,     // Bambu printers, soldering, etc.
    "smoker": false     // 1 kW Pit Boss electric smoker
  },
  "codeRegion": "AUTO", // AUTO = Michigan Part 8 if ZIP 48-49
  "customCircuits": [
    { "label": "", "amps": 0, "poles": 1, "duty": 0.5 }
  ],
  "evConfig": {         // modal-supplied
    "count": 1,
    "amps": 40,
    "managedCharging": false
  }
}
```

---

## 3 User-Interface Layout (desktop ≥ 900 px)

```
┌─────────────── 66 % ────────────────┐
| LEGACY PANEL  | MODERN PANEL        |
| SVG canvas w/ hover kW,$,CO₂        |
└─────────────────────────────────────┘
┌───── 33 % INPUT / OPTIONS ──────────┐
| Sq ft  Beds  Baths  Year  ZIP       |
| Building-type ▼                     |
| Checkboxes: Pool Hot-tub Well EV…   |
| Maker-Space | Smoker | Solar | ESS  |
| Buttons:  [EV details] [Recalc]     |
| Tariff badge + plan selector ▼      |
└─────────────────────────────────────┘
┌───────────── ANALYTICS STRIP ───────┐
| • Stacked kW bars (legacy vs modern)|
| • $/mo + kg CO₂ delta               |
| • Good / Better / Best upgrade grid |
| • Warning chips (overload, 705.12…) |
└─────────────────────────────────────┘
```

*Mobile (≤ 600 px):* swipe-left/right shows one panel at a time; inputs collapse to accordion.

---

## 4 Calculation Pipeline

1. **Validate inputs** → error toast if out of range.
2. **Historic-panel lookup** (utility ID + decade) → main A, pole-count, breaker model, hazard flag.
3. **Load model**

   * 3 VA/ft² lighting + SA + laundry + NEC demand factors
   * Amenity templates (pool 1.5 kW cont., smoker 1 kW cont., maker space plug 2 kW duty 0.4 + 4 kW reserve)
   * Building-type diversity (duplex, quadplex) per NEC 220.84
   * Custom circuits & EV modal values
4. **DER impact** – 705.12 back-feed, 120 % bus rule, ESS peak-shave.
5. **Panel allocator & balancer**

   * Legacy: inferred layout
   * Modern: design three tiers (Good = 200 A, Better = 225 A, Best = 320 A) - choose cheapest that keeps spare ≥ 25 %.
6. **Code overlay** – Michigan Part 8 (outside disconnect, SPD, AFCI/GFCI).
7. **Tariff engine**

   * Fetch all plans (UtilityAPI → Genability → EIA fallback)
   * Simulate hourly load; compute fixed, energy, demand pieces
   * Pick cheapest; show savings vs next-best.
8. **CO₂ engine** – fetch hourly or average grid intensity via WattTime/eGRID; convert kWh to kg CO₂.
9. **Warnings** – overload > 80 %, unbalanced legs > 10 %, obsolete Stab-Lok, 705.12 violation, missing SPD.

---

## 5 Output Artifacts

* Dual SVG panels with hover tooltips.
* “Good / Better / Best” card set (ampacity, cost, headroom).
* Interactive cost & carbon bar chart.
* **One-click PDF export** (puppeteer-serverless) bundling:

  * Cover page summary
  * Panel diagrams (vector)
  * Detailed load-calc tables
  * Tariff comparison
  * CO₂ analysis
  * Warning checklist & inspector notes.

---

## 6 Technology Stack

| Layer      | Choice                                              | Reason                                    |
| ---------- | --------------------------------------------------- | ----------------------------------------- |
| Front-end  | **React 18 + TypeScript + Vite + Tailwind**         | Static-site deploy, component reuse.      |
| SVG/Charts | **D3 v8**                                           | Fine-grained panel drawing, stacked bars. |
| State      | **Zustand**                                         | Lightweight, URL serialization.           |
| Heavy calc | **Web Worker + Pyodide** (shared Python NEC module) | Keep UI 60 fps, reuse calc lib in tests.  |
| Back-end   | **FastAPI** on serverless (optional)                | Tariff & PDF functions behind CORS proxy. |
| Data       | IndexedDB cache for LUT & tariffs.                  |                                           |
| Tests      | Jest + RTL (UI), PyTest (calc), Playwright (E2E).   |                                           |

---

## 7 Acceptance Tests (excerpt)

| ID   | Scenario                               | Expected                                                                                       |
| ---- | -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| AT-1 | 1 200 ft², 1959, ZIP 48009, SF w/ pool | Legacy 60 A split-bus shown; modern “Good” rejects (headroom < 25 %), “Better” 225 A accepted. |
| AT-2 | Duplex 2×1 000 ft², 2024               | Diversity factor reduces service to 150 A; legs balanced ±6 %.                                 |
| AT-3 | Enable PV 8 kW + 200 A bus             | 120 % rule warning if back-feed > 40 A; suggestion: 225 A or end-fed breaker.                  |
| AT-4 | Maker+Smoker+EV 48 A managed           | No breaker > 80 % duty; GFCI outdoor count ≥ 2.                                                |
| AT-5 | PDF export click                       | Generates file < 2 MB; opens with cover, diagrams, tables.                                     |

---

## 8 Timeline (6-sprint MVP)

| Sprint | Deliverable                                |
| ------ | ------------------------------------------ |
| 0      | Repo init, JSON schemas, utility LUT CSV.  |
| 1      | Responsive input panel, mobile swipe.      |
| 2      | Historic & modern calc engine, WebWorker.  |
| 3      | Dual SVG renderer, balancer, O/P features. |
| 4      | Tariff optimiser, CO₂ engine, P-wizard.    |
| 5      | PDF export, a11y, calibration, full tests. |

---

## 9 Open Items (to monitor)

1. API-key cost limits for WattTime / UtilityAPI.
2. Split-bus validation outside Pacific NW datasets.
3. Localisation for non-US code cycles (future).

---

> **Deliver this document verbatim to the development LLM or engineering team.**
> It is the authoritative, self-contained specification for building the “Residential Electrical-Panel Estimator & Cost Optimizer” web application.
