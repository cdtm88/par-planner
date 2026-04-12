# Conventions

## JavaScript Style

**ES version:** ES2020+ (async/await, optional chaining `?.`, nullish coalescing not used but optional chaining is)

**Variable declarations:**
- `const` for all values that don't change (functions, DOM references, constants)
- `let` for mutable variables (`saveTimer`, `sharedFileHandle`, `fileIsDirty`, `dragRow`, `dragCard`, `productCounter`, `rowCounters`)
- `var` — never used

**Function declarations:**
- Named functions use `function` declarations (hoisted): `function addRow(pid, data = {}) { ... }`
- Arrow functions only used for inline callbacks: `.map(v => ...)`, `.forEach(tr => { ... })`
- Async functions use `async function` declaration: `async function generatePPTX() { ... }`

**Template literals:** Used throughout for HTML generation:
```js
return `<button class="rag-pill ${cls}${v===sel?" selected":""}"
  onclick="setRag('${rowId}','${field}','${v}',this)">${lbl}</button>`;
```

**Optional chaining:** Used for defensive DOM reads:
```js
const sel = cell?.querySelector(".rag-pill.selected");
return sel ? sel.title : "-";
```

**Short-circuit / ternary:** Preferred over if/else for inline conditional values:
```js
const bannerFill = cfg.overallRag==="GREEN" ? PC.successGreen : cfg.overallRag==="AMBER" ? PC.amber : PC.red;
```

## XSS Sanitisation

All user input that is inserted into `innerHTML` goes through `esc()`:
```js
function esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;");
}
```
Used consistently in `addRow()` and `addProduct()`. Missing `>` escaping (minor gap — see CONCERNS.md).

## Event Handling Patterns

Two patterns coexist:

**1. Inline `onclick` on dynamically generated HTML:**
Used for product cards and rows (which are created programmatically):
```js
tr.innerHTML = `...
  <button class="btn-del-row" onclick="deleteRow('${rowId}')" title="Remove">×</button>
`;
```

**2. `addEventListener` for elements that exist at page load:**
Used for drag events, global input, beforeunload:
```js
tr.addEventListener("dragstart", onRowDragStart);
document.addEventListener("input", e => { ... });
window.addEventListener("beforeunload", e => { ... });
```

**Event delegation:** Used for autosave — a single `input` listener on `document` covers all inputs via `e.target.closest(".main")`.

## Autosave Pattern

Debounced 1.5s autosave on any input within `.main`:
```js
function scheduleAutosave() {
  markDirty();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(performAutosave, 1500);
}
```
`performAutosave()` always writes to localStorage and optionally writes to the shared file handle.

## CSS Conventions

**Design tokens:** All colours and border-radius in `:root` custom properties. No magic hex values in rules (they use `var(--teal)` etc.).

**Inline compact style:** Rules often written on one line for brevity:
```css
.topbar-left { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
```

**Naming:** Kebab-case classes. BEM-influenced but not strict BEM (no `__` or `--` modifiers — instead uses separate `.selected`, `.collapsed`, `.has-notes` state classes).

**No external CSS files or preprocessors** — all CSS is embedded in the single `<style>` block.

**Section banners** in CSS to separate components:
```css
/* ── Top bar ── */
/* ── Product card ── */
/* ── Feature table ── */
```

## Section Comment Style

JavaScript sections are delimited with large banner comments:
```js
// ═══════════════════════════════════════════════════════════════════
//  STORAGE — File System Access API (B2) + JSON backup (A)
// ═══════════════════════════════════════════════════════════════════
```
Subsection comments use double-dash style:
```js
// ── Autosave scheduler ───────────────────────────────────────────
```

## DOM ID Strategy

IDs are programmatically generated using numeric `pid` (product counter):
```js
card.id = `product-${pid}`;
// card-body-${pid}, card-notes-${pid}, notes-toggle-${pid}
// row-${pid}-${rowCounters[pid]}
```
Counters are module-level: `productCounter` (integer) and `rowCounters` (object).

## Data Serialisation Conventions

- **Global date stored as ISO:** `YYYY-MM-DD` (new) with legacy `DD-Mon-YY` migration in `applyStateObject()`
- **Feature due dates:** Stored as `DD-Mon-YY` in JSON (human-readable for PPTX); converted to/from `YYYY-MM-DD` for the native date input
- **Version field:** State object carries `version: 3` for future migration support
- **Empty/blank handling:** `filter(f => f.name.trim() !== "")` at export time skips blank features

## Colour Constants

PPTX colours are stored without `#` prefix (PptxGenJS format):
```js
const PC = {
  teal:"00A9CE", darkTeal:"007A99",
  successGreen:"27AE60", ...
};
```

RAG mapping:
```js
const RAG_FILLS = { G:PC.successGreen, A:PC.amber, R:PC.red, C:PC.blue, "-":PC.noneGrey };
```
