# Structure

## File Overview

Single monolithic HTML file: `/Users/christianmoore/Downloads/WPR-Generator.html`
**1,491 lines** — HTML, embedded CSS, embedded JavaScript.

## Section Layout (by line range)

| Lines | Section | Contents |
|-------|---------|----------|
| 1–6 | Document head | DOCTYPE, lang, charset, viewport, title, CDN script tag |
| 7–320 | `<style>` | All CSS: design tokens, component styles |
| 322–403 | `<body>` HTML | Topbar, main content wrapper, settings panel, product container, status bar |
| 405–468 | JS: Date utilities | `getFYStart`, `getWPRWeek`, `getQuarter`, `toIsoDate`, `fromIsoDate`, `fmtDate`, `initDateFields`, `recalcFromDate` |
| 470–728 | JS: Storage layer | Constants, `buildStateObject`, `applyStateObject`, `markDirty`, `markSaved`, `scheduleAutosave`, `performAutosave`, `writeToFileHandle`, `openSharedFile`, `saveToFile`, `exportBackup`, `importBackup`, `loadFromLocalStorage`, global event listeners |
| 730–763 | JS: RAG helpers | `ragPills`, `setRag`, `getRag`, `setOverallRag`, `getOverallRag` |
| 765–797 | JS: Row drag-and-drop | `onRowDragStart/Over/Leave/Drop/End`, `dragRow` variable |
| 799–828 | JS: Card drag-and-drop | `onCardDragStart/Over/Leave/Drop/End`, `dragCard` variable |
| 830–854 | JS: Due-date utilities | `MONTHS_SHORT`, `dueDdMmmToIso`, `isoToDdMmm` |
| 856–916 | JS: Row management | `productCounter`, `rowCounters`, `esc()`, `addRow`, `deleteRow`, `renumberRows` |
| 918–1025 | JS: Product management | `addProduct`, `removeProduct`, `toggleCollapse`, `toggleNotes` |
| 1027–1069 | JS: Roll Week | `rollWeek` |
| 1071–1088 | JS: Notes | `toggleNotes`, `onNotesInput` |
| 1090–1127 | JS: Data read | `readAllData` |
| 1129–1430 | JS: PPTX | `PC` constants, `RAG_FILLS`, layout constants, `pRag`, `pH`, `pB`, `addSlideFooter`, `buildCover`, `buildSummary`, `buildSlide`, `generatePPTX` |
| 1432–1473 | JS: UI utilities | `showConfirm`, `showStatus` |
| 1475–1489 | JS: Init | `DOMContentLoaded` bootstrap |

## Key HTML Elements

| Element / ID | Purpose |
|---|---|
| `.topbar` | Sticky header with brand, file ops, PPTX button |
| `#save-indicator` | Text showing file status (unsaved, saved, file open) |
| `.btn-save` | "Save File" button |
| `.btn-generate` | "Generate PPTX" button |
| `#file-status-bar` | Panel shown when a shared JSON file is open |
| `#browser-warning` | Warning banner for non-Chrome/Edge browsers |
| `.settings-panel` | Global programme/week/date/quarter inputs |
| `#global-programme` | Programme name input |
| `#global-week` | Week label input (e.g. "WK 12") |
| `#global-date` | Date picker (`type="date"`) |
| `#global-quarter` | Auto-calculated quarter (readonly) |
| `#products-container` | Dynamic container for `.product-card` divs |
| `.btn-add-product` | "Add Product Area" button |
| `#status-bar` | Fixed toast notification at bottom of screen |

## Dynamically Generated HTML Structure

Each product card (`addProduct()`) generates:
```
div.product-card#product-{pid}
  div.card-header
    span.card-drag-handle
    input.input-product-name
    input.input-short-desc
    input.input-owner
    div.rag-selector
      button.rag-btn.g / .a / .r
    button.btn-collapse
    button.btn-del-row
  div.card-body#card-body-{pid}
    div.feature-table-wrap
      table.features
        thead > tr > th × 11
        tbody.feature-tbody
          tr#row-{pid}-{n} × N   (each row from addRow())
    div.card-footer
      button.btn-add-row
      button.btn-notes-toggle#notes-toggle-{pid}
    div.card-notes-wrap#card-notes-{pid}
      div.card-notes-inner
        span.card-notes-label
        textarea.card-notes-textarea
```

## Naming Conventions

**IDs — kebab-case with semantic prefixes:**
- `product-{pid}` — product card container
- `card-body-{pid}` — collapsible card body
- `card-notes-{pid}` — notes section
- `notes-toggle-{pid}` — notes toggle button
- `row-{pid}-{rowNum}` — feature row
- `global-*` — settings panel inputs
- `file-status-*` — file status panel elements

**CSS classes — BEM-influenced, kebab-case:**
- Block: `.product-card`, `.card-header`, `.card-body`, `.card-footer`
- Component: `.feature-tbody`, `.rag-cell`, `.rag-pill`, `.rag-btn`
- State modifiers: `.selected`, `.collapsed`, `.has-notes`, `.unsaved`, `.visible`
- Utility: `.btn-del-row`, `.btn-add-row`, `.btn-collapse`, `.btn-topbar`

**JavaScript functions — camelCase:**
- `addProduct`, `removeProduct`, `addRow`, `deleteRow`, `renumberRows`
- `buildStateObject`, `applyStateObject`, `readAllData`
- `buildCover`, `buildSummary`, `buildSlide`, `generatePPTX`
- `onRowDragStart/Over/Leave/Drop/End`, `onCardDragStart/Over/Leave/Drop/End`

**JavaScript variables:**
- `productCounter` — integer ID counter for products
- `rowCounters` — object keyed by `pid` for row ID counters
- `sharedFileHandle` — `FileSystemFileHandle` or `null`
- `saveTimer` — debounce timer reference
- `PC` — PPTX colour constants object

## CSS Design Token System

All colours defined as CSS custom properties on `:root` (lines 8–24):
```
--teal, --dark-teal, --teal-tint, --green, --success
--charcoal, --mid-grey, --light-grey, --border-grey, --white
--amber, --red, --blue, --none-grey, --radius
```
Mirrored as JS constants in `PC` object (line 1132–1138) for PPTX use.
