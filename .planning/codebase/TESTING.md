# Testing

## Automated Testing

**None.** There are no unit tests, integration tests, or test files. No test framework, no test runner, no CI pipeline configuration.

## Manual Testing Approach

The application relies entirely on manual browser testing. Evidence from the code suggests the following informal manual test scenarios:

- Open the file in Chrome/Edge → verify the browser-warning is hidden
- Open the file in Firefox/Safari → verify the browser-warning appears
- Add a product and feature → verify autosave triggers after 1.5s
- Generate PPTX → verify download starts, slides render correctly
- Open a JSON file → verify state loads and file status bar appears
- Roll Week → verify RAGs copy and date advances by 7 days
- Restore from backup → verify confirm modal appears before overwriting

## Validation Patterns

**Browser capability detection:**
```js
const supportsFileAPI = typeof window.showOpenFilePicker === "function";
function checkBrowserSupport() {
  if (!supportsFileAPI) {
    document.getElementById("browser-warning").style.display = "block";
    document.getElementById("btn-save-file").title = "Requires Chrome or Edge";
  }
}
```

**JSON backup import validation:**
```js
if (!state.products) throw new Error("Not a valid WPR backup file");
```
Minimal — only checks for `products` key existence.

**Date parsing validation:**
```js
function fromIsoDate(str) {
  if (!str) return null;
  const [y,m,d] = str.split("-").map(Number);
  if (!y||!m||!d) return null;
  return new Date(y, m-1, d);
}
```

**Legacy date format migration** in `applyStateObject()` — handles both `YYYY-MM-DD` (new) and `DD-Mon-YY` (legacy) gracefully.

## Error States and Display

All errors surface through `showStatus()` — a fixed toast that auto-hides after 3.5s:
```js
function showStatus(msg) {
  const bar = document.getElementById("status-bar");
  bar.textContent = msg; bar.classList.add("show");
  setTimeout(() => bar.classList.remove("show"), 3500);
}
```

**AbortError suppression** — File picker cancellation is silently ignored (correct UX):
```js
} catch(e) {
  if (e.name !== "AbortError") showStatus("Could not open file: " + e.message);
}
```

**File autosave failure** falls back gracefully:
```js
} catch(e) {
  console.warn("File autosave failed:", e);
  markSaved("● Saved (localStorage)");
}
```

**PPTX generation errors** are caught and displayed:
```js
} catch(e) {
  console.error(e);
  showStatus("Error: " + e.message);
}
```

**localStorage write** is wrapped in try/catch everywhere (silent fail — storage quota or private browsing):
```js
try { localStorage.setItem(k, JSON.stringify(state)); } catch(e) {}
```

## Debug Helpers

**None.** No `debugger` statements, no `console.log` in the production code. Only `console.warn` and `console.error` for operational errors (file autosave failure, PPTX generation).

## Browser Compatibility

The app explicitly targets **Chrome and Edge only** for full functionality:

| Feature | Chrome/Edge | Firefox/Safari |
|---|---|---|
| File System Access API | ✓ Full support | ✗ Not supported |
| `showOpenFilePicker()` | ✓ | ✗ |
| `showSaveFilePicker()` | ✓ | ✗ |
| localStorage fallback | ✓ | ✓ |
| JSON backup/restore | ✓ | ✓ |
| PPTX generation | ✓ | ✓ (no file open/save) |

The `supportsFileAPI` flag controls feature availability. Non-Chrome users see a warning banner and the Save File button is disabled, but the app remains functional for backup/restore and PPTX generation.

## Destructive Action Guards

All destructive operations require explicit confirmation via `showConfirm()` (custom modal):
- `importBackup()` — "Restoring a backup will replace all current data"
- `removeProduct()` — "Remove 'X'? This cannot be undone."
- `rollWeek()` — shows what will change, "This cannot be undone"

Additionally, `beforeunload` fires if `fileIsDirty && sharedFileHandle` to warn of unsaved changes.
