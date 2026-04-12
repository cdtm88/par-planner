# Architecture

## Pattern

**Event-Driven Single-Page Application (DOM-as-source-of-truth)**

The app has no separate model layer — the DOM is the canonical data store. State is read from the DOM at save/export time via `readAllData()`, which walks all `.product-card` and `.feature-tbody tr` elements to extract values. This "DOM as model" pattern is intentional: it avoids maintaining parallel JS and DOM state at the cost of making data access coupled to DOM queries.

## Major Logical Sections

| Section | Lines | Responsibility |
|---------|-------|----------------|
| Date/week/quarter utilities | 409–468 | FY-aware week numbering, date parsing/formatting |
| Storage layer | 470–728 | File System Access API, localStorage, backup JSON |
| RAG helpers | 730–763 | RAG pill rendering and read/write |
| Row drag-and-drop | 765–797 | Row reordering within a feature table |
| Card drag-and-drop | 799–828 | Product card reordering within the container |
| Additional date utilities | 830–854 | Due-date format conversion (DD-MMM ↔ YYYY-MM-DD) |
| Row management | 856–916 | `addRow()`, `deleteRow()`, `renumberRows()` |
| Product card management | 918–1025 | `addProduct()`, `removeProduct()`, `toggleCollapse()` |
| Roll Week | 1027–1069 | Weekly roll: copies currentRag → lastRag, advances date +7 days |
| Notes | 1071–1088 | Per-card notes toggle and dirty indicator |
| Data read | 1090–1127 | `readAllData()` — walks DOM to serialise state |
| PPTX generation | 1129–1430 | Cover + Summary + per-product slide builders |
| Modal confirmation | 1432–1466 | Custom modal replacing `window.confirm()` |
| Status toast | 1469–1473 | `showStatus()` — fixed toast notification |
| Initialisation | 1475–1488 | `DOMContentLoaded` bootstrap |

## Data Flow

```
User input
    │
    ▼
DOM element (input, button, textarea)
    │
    ├── onclick / oninput handler
    │       │
    │       ├── scheduleAutosave() — 1.5s debounce
    │       │       │
    │       │       └── performAutosave()
    │       │               ├── buildStateObject()
    │       │               │       └── readAllData() → DOM walk
    │       │               ├── localStorage.setItem()
    │       │               └── writeToFileHandle() [if file open]
    │       │
    │       └── [for RAG buttons] update .selected CSS class only
    │
    └── generatePPTX()
            └── readAllData() → build PptxGenJS object → write .pptx file
```

## State Management

State lives entirely in the DOM. The serialised representation is a versioned JSON schema:

```js
{
  version: 3,
  programme: "string",
  week: "WK 12",
  date: "YYYY-MM-DD",
  quarter: "FY24-25 Q4",
  products: [
    {
      productName: "string",
      shortDesc: "string",
      owner: "string",
      overallRag: "GREEN" | "AMBER" | "RED",
      notes: "string",
      features: [
        {
          num: 1,
          name: "string",
          status: "string",
          nextSteps: "string",
          owner: "string",
          estimate: "string",
          due: "DD-Mon-YY",
          currentRag: "G" | "A" | "R" | "C" | "-",
          lastRag: "G" | "A" | "R" | "C" | "-"
        }
      ]
    }
  ],
  savedAt: "ISO-8601 timestamp"
}
```

**Persistence priority:**
1. File System Access API shared file (primary — multi-user)
2. `localStorage` key `dnata_wpr_v3_{programme}` (fallback — session)
3. JSON export/import (backup and restore)

## Key Abstractions

**`buildStateObject()`** — Serialises current DOM state to the v3 JSON schema.

**`applyStateObject(s)`** — Deserialises saved state back into the DOM; handles legacy `DD-Mon-YY` date format migration.

**`addProduct(data)`** — Renders a complete product card div with header inputs, feature table, footer, notes area; wires all drag and input events.

**`addRow(pid, data)`** — Appends a feature row to a product's `<tbody>` using innerHTML with `esc()` sanitisation.

**`readAllData()`** — Reads all product cards and their rows from the DOM; converts native date input values (YYYY-MM-DD) to DD-Mon-YY for PPTX.

**`generatePPTX()`** — Orchestrates PPTX build: calls `readAllData()`, filters unnamed items, then calls `buildCover()`, `buildSummary()`, `buildSlide()` per product.

## Entry Points

- `window.addEventListener("DOMContentLoaded", ...)` (line 1478) — bootstraps the app: browser check, date init, localStorage restore or empty product
- `document.addEventListener("input", ...)` (line 717) — global input handler triggering autosave and date recalc
- `window.addEventListener("beforeunload", ...)` (line 723) — dirty-state guard when shared file is open

## PPTX Generation Pipeline

```
generatePPTX()
  └── readAllData()           filter unnamed products/features
  └── new PptxGenJS()         LAYOUT_WIDE (13.3" × 7.5")
  └── buildCover()            Slide 1: minimalist cover
  └── buildSummary()          Slide 2: product health grid (max 8 cards)
  └── buildSlide() × N        Slides 3+: one per product with feature table
        ├── RAG colour banner
        ├── addTable() with header + data rows
        └── Notes callout (if notes present)
        └── addSlideFooter()
  └── pres.writeFile()        Triggers browser download
```

Constants: `PW=13.3`, `PH=7.5`, `MARGIN=0.45`, `COL_W=[0.32,2.1,2.85,3.05,1.15,0.72,0.86,0.52,0.52]`
