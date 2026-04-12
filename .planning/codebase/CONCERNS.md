# Concerns

## Single-File Monolith

**Severity: Medium**

At 1,491 lines (CSS + HTML + JS all in one file), the app is at the upper limit of comfortable single-file maintainability. Specific pain points:
- No module separation — CSS, HTML, and JS are interleaved with no bundler
- Finding a specific function requires knowing line numbers or searching
- Any change touches the one file; diff reviews can be noisy
- No IDE type checking (plain JS, no JSDoc types)

## No Automated Tests

**Severity: Medium**

Zero test coverage. The PPTX generation logic (`buildCover`, `buildSummary`, `buildSlide`) is complex with many layout calculations. Any refactor risks breaking slide output with no safety net. The date arithmetic (`getFYStart`, `getWPRWeek`, `getQuarter`) is business-critical and similarly untested.

## DOM-as-Source-of-Truth Architecture

**Severity: Medium**

State lives in the DOM, not in a JS object. `readAllData()` performs DOM queries to serialise state. This means:
- No reactive updates — state is always "compiled" on save/export
- Adding a new field requires updating `addRow()` HTML, `readAllData()`, `applyStateObject()`, and PPTX builder — four separate places
- Hard to reason about what "the current state" is without running `readAllData()`
- DOM mutations from drag-and-drop can get out of sync if an event handler misses a call to `scheduleAutosave()`

## Browser Compatibility Lock-in

**Severity: Medium**

Full functionality (open/save shared file) requires the **File System Access API**, which is Chrome/Edge only. Firefox and Safari users cannot collaborate via the shared JSON file — they're limited to backup/restore. This is an inherent limitation of the approach and is documented in the UI, but restricts team adoption.

## localStorage Key Collision Risk

**Severity: Low-Medium**

The localStorage key is derived from the programme name:
```js
return prog ? `${LS_BASE}_${prog.toLowerCase().replace(/[^a-z0-9]+/g,"_")}` : LS_BASE;
```
Two programmes with similar names (e.g. "Leisure & Ops" and "Leisure + Ops") would map to the same key and overwrite each other's data. The fallback key `dnata_wpr_v3` is shared across all unnamed sessions.

## localStorage Size Limit

**Severity: Low-Medium**

localStorage is capped at ~5MB per origin. A large WPR (many products, many features, long text in status/next-steps fields) could approach this limit. There's no size check or warning before writing. Writes are silently swallowed:
```js
try { localStorage.setItem(k, JSON.stringify(state)); } catch(e) {}
```

## Incomplete XSS Sanitisation

**Severity: Low**

The `esc()` function escapes `&`, `"`, `'`, `<` but not `>`:
```js
function esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;");
  // missing: .replace(/>/g,"&gt;")
}
```
In practice, unescaped `>` is unlikely to cause XSS in attribute contexts, but is a minor gap in correctness.

## PPTX Notes Field Not Sanitised

**Severity: Low**

In `buildSlide()`, `cfg.notes.trim()` is passed directly to PptxGenJS `addText()`. PptxGenJS handles its own XML escaping internally, but this is an implicit dependency on the library's sanitisation rather than explicit handling.

## Magic Numbers in PPTX Layout

**Severity: Low**

The PPTX slide layout uses many hardcoded pixel/inch values with no named constants:
```js
const tableY = bannerH + titleH + 0.22, rowH = 0.42;
const gridTop = bannerH + titleH + 0.22;
const cardW = (TABLE_W - 0.25) / 2;
const cardH = 1.05;
const colGap = 0.25;
const rowGap = 0.18;
```
Changing the slide layout requires understanding how these values interact. The `COL_W` array `[0.32,2.1,2.85,3.05,1.15,0.72,0.86,0.52,0.52]` must sum to `TABLE_W` (12.4) but has no validation.

## Summary Slide Capped at 8 Products

**Severity: Low**

The Programme Health summary slide hard-caps at 8 product cards:
```js
const MAX_CARDS = 8;
const visibleProducts = products.slice(0, MAX_CARDS);
```
Programmes with more than 8 products get a "N more products" text note. This is a design limitation that could surprise users with larger programmes.

## Duplicate Date Utility Code

**Severity: Low**

There are two sets of date helper functions that partially overlap:
- `toIsoDate`, `fromIsoDate`, `fmtDate` (canonical, lines 429–444)
- `dueDdMmmToIso`, `isoToDdMmm` (due-date specific, lines 837–854)
- `MONTHS_SHORT` constant declared at line 834 but `M` array re-declared inside `fmtDate` (line 439)
- Alias functions `formatDate` and `formatDateDisplay` point to `fmtDate` for legacy compatibility

This creates confusion about which date utilities to use when adding new features.

## No Server-Side Backup / Audit Trail

**Severity: Low (by design)**

The app is entirely client-side — no server, no authentication, no audit log. If a user accidentally overwrites a shared JSON file and nobody has a backup, the data is lost. The app provides backup download as mitigation but relies on user discipline.

## Inline Event Handlers Mixed with addEventListener

**Severity: Low**

Two event binding patterns coexist (inline `onclick` in innerHTML strings and `addEventListener` in JS). This makes it harder to reason about which events are attached and complicates any future migration to Content Security Policy (CSP) with `unsafe-inline` disallowed.

## No TODO/FIXME Comments Found

No TODO or FIXME comments are present in the codebase. The code is production-quality in terms of cleanup.
