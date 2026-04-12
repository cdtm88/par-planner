# Technology Stack

**Analysis Date:** 2026-04-10

## Languages

**Primary:**
- HTML5 — Structure and markup, single-file app at `/Users/christianmoore/Downloads/WPR-Generator.html`
- CSS3 — Styling via `<style>` block in same file; uses CSS custom properties (`:root` variables), flexbox layout, CSS transitions
- JavaScript (ES2020+) — All application logic in a `<script>` block in the same file; uses `async/await`, optional chaining (`?.`), nullish coalescing, template literals, arrow functions, `Array.from`, destructuring, `Promise`, `Blob`, `URL.createObjectURL`

**Secondary:**
- None — no TypeScript, no compiled languages

## Runtime

**Environment:**
- Browser-only (no Node.js, no server-side component)
- Targets Chromium browsers (Chrome, Edge) for full functionality; Firefox/Safari supported in degraded mode (no File System Access API)

**Package Manager:**
- None — single-file, no build step, no lockfile
- Distributed as a standalone `.html` file

## Frameworks

**Core:**
- None — vanilla HTML/CSS/JS, no UI framework (no React, Vue, Svelte, etc.)

**Testing:**
- None detected

**Build/Dev:**
- None — no bundler, no transpiler, no build pipeline; the file runs directly in-browser

## Key Dependencies

**Critical:**
- `pptxgenjs` v3.12.0 — PPTX generation; loaded from CDN
  - CDN URL: `https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js`
  - Used via global `PptxGenJS` constructor
  - Called in `generatePPTX()` to create slides, tables, shapes, and trigger `.writeFile()`

## Configuration

**CSS Custom Properties (design tokens — defined at `:root` in `<style>` block):**
```css
--teal:        #00A9CE   /* primary brand colour */
--dark-teal:   #007A99
--teal-tint:   #E6F6FA
--green:       #5BB85D
--success:     #27AE60
--charcoal:    #1A1A1A
--mid-grey:    #6B6B6B
--light-grey:  #F4F4F4
--border-grey: #DCDCDC
--white:       #FFFFFF
--amber:       #F5A623
--red:         #D0021B
--blue:        #4A86C8
--none-grey:   #AAAAAA
--radius:      6px
```

**JavaScript Constants:**
```js
const LS_BASE = "dnata_wpr_v3";          // localStorage namespace key prefix
const PC = { teal:"00A9CE", ... };       // PPTX colour palette (hex without #)
const RAG_FILLS = { G, A, R, C, "-" };  // RAG status → PPTX fill colour map
const PW=13.3, PH=7.5, MARGIN=0.45;     // Slide dimensions in inches (widescreen 16:9)
const COL_W=[0.32,2.1,2.85,3.05,1.15,0.72,0.86,0.52,0.52]; // PPTX table column widths
```

**Data Schema Version:**
- State objects carry `version: 3` — used for migration detection on load

## Browser API Requirements

**File System Access API** (`window.showOpenFilePicker`, `window.showSaveFilePicker`, `FileSystemFileHandle.createWritable`):
- Required for "Open File" and "Save File" shared-file workflow
- Chrome and Edge only; gracefully degraded with warning banner for other browsers
- Presence checked via `typeof window.showOpenFilePicker === "function"`

**LocalStorage:**
- Used as session fallback and autosave target (always written)
- Key pattern: `dnata_wpr_v3_{programme_name}` and `dnata_wpr_last_key`

**Blob / URL API** (`new Blob`, `URL.createObjectURL`, `URL.revokeObjectURL`):
- Used in `exportBackup()` to trigger a JSON download without a server

**HTML5 Drag and Drop API** (`draggable`, `dragstart`, `dragover`, `dragleave`, `drop`, `dragend`):
- Used for reordering feature rows within a product table
- Used for reordering product cards within the container

**`<input type="date">`:**
- Native browser date picker; value stored as `YYYY-MM-DD`; displayed as `DD-Mon-YY`

**`DOMContentLoaded` / `beforeunload` events:**
- `DOMContentLoaded` — triggers init, localStorage restore
- `beforeunload` — warns user of unsaved shared-file changes

## Platform Requirements

**Development:**
- No build tools required; open the `.html` file directly in a browser
- Chrome or Edge required for full File System Access API support

**Production:**
- Delivered as a single static `.html` file — no hosting infrastructure required
- Can be served from a file share, email attachment, or any static host
- Internet required at load time to fetch pptxgenjs from jsDelivr CDN

---

*Stack analysis: 2026-04-10*
