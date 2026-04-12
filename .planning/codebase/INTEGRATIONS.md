# External Integrations

**Analysis Date:** 2026-04-10

## APIs & External Services

**CDN — jsDelivr:**
- Delivers the pptxgenjs bundle at load time
- URL: `https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js`
- Loaded as a synchronous `<script>` tag in `<head>`; exposes global `PptxGenJS`
- If jsDelivr is unreachable the app fails silently on "Generate PPTX" — no fallback bundle

No other external API calls exist. The app is fully client-side and makes no XHR or `fetch` requests.

## Third-Party Libraries

**PptxGenJS v3.12.0:**
- Purpose: Generates `.pptx` files entirely in the browser
- Source: `https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js`
- Usage pattern:
  ```js
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";   // 13.3 × 7.5 inch widescreen
  pres.title  = `${programme} — WPR`;
  const slide = pres.addSlide();
  slide.addShape(pres.ShapeType.rect, { ... });
  slide.addText("...", { ... });
  slide.addTable([headerRow, ...dataRows], { ... });
  await pres.writeFile({ fileName: "WPR_WK-N_DD-Mon-YY.pptx" });
  ```
- Used in `generatePPTX()`, `buildCover()`, `buildSummary()`, `buildSlide()`, `addSlideFooter()`
- No other third-party libraries are used anywhere in the file

## File System Integrations

**File System Access API — shared file workflow (Chrome/Edge only):**
- Open: `window.showOpenFilePicker({ id:"wpr-shared-file", accept:{"application/json":[".json"]} })`
  - Returns a `FileSystemFileHandle`; stored in module-level `sharedFileHandle`
  - File contents read with `handle.getFile()` then `file.text()`, parsed as JSON
- Save: `window.showSaveFilePicker({ id:"wpr-shared-file", suggestedName:"wpr-data.json" })`
  - Returns a writable handle; written via `handle.createWritable()` → `writable.write(json)` → `writable.close()`
- Autosave: triggered 1.5 s after last user input via `scheduleAutosave()` → `performAutosave()`; writes to open `sharedFileHandle` if present, always also writes to localStorage
- Intended workflow: one user saves `wpr-data.json` to a network drive; others open the same file to collaborate

**Backup JSON download (all browsers):**
- `exportBackup()` creates a `Blob` of serialised state JSON and triggers a download via a synthetic `<a>` click
- Filename pattern: `WPR-Backup_{Programme}_{YYYY-MM-DD}.json`
- No server involved; uses `URL.createObjectURL` / `URL.revokeObjectURL`

**Backup JSON import/restore (all browsers):**
- `importBackup()` creates a hidden `<input type="file" accept=".json">` and reads the selected file with `file.text()`
- Validates presence of `state.products` before applying
- Writes restored state to localStorage after apply

## Data Storage

**LocalStorage:**
- Always written on every autosave cycle as a fallback
- Key pattern: `dnata_wpr_v3_{programme_name_slug}` (e.g. `dnata_wpr_v3_leisure_ops`)
- Pointer key `dnata_wpr_last_key` stores the most recently used programme key
- On `DOMContentLoaded`, `loadFromLocalStorage()` restores the last session if no shared file is opened
- Namespace constant: `LS_BASE = "dnata_wpr_v3"`

**SessionStorage / IndexedDB:**
- Not used

**File system (via File System Access API):**
- Primary persistence when a shared file is open; see above

## Authentication & Identity

- None — no login, no auth provider, no user accounts
- The app is entirely unauthenticated; access control relies on filesystem/network share permissions

## Monitoring & Observability

**Error Tracking:**
- None — errors surface only via `console.error(e)` and the in-page `showStatus()` toast
- PPTX generation errors are caught in a `try/catch` and displayed in the status bar

**Logs:**
- `console.warn("File autosave failed:", e)` on file-write failures
- No structured logging, no remote logging

## CI/CD & Deployment

**Hosting:**
- Not applicable — single `.html` file, distributed directly (file share, email, static host)

**CI Pipeline:**
- None detected

## Export Targets

**PPTX (Microsoft PowerPoint):**
- Generated client-side via pptxgenjs; downloaded as `WPR_{week}_{date}.pptx`
- Slide layout: `LAYOUT_WIDE` (13.3 × 7.5 inches, 16:9)
- Slide types produced: Cover slide, Programme Health summary slide, one product detail slide per product
- Font used throughout: Arial

**JSON Backup:**
- Downloaded as `WPR-Backup_{programme}_{date}.json`
- Schema: `{ version:3, programme, week, date, quarter, products:[...], savedAt }`

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:** None

---

*Integration audit: 2026-04-10*
