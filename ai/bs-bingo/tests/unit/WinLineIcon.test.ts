import { describe, it, expect, afterEach } from "vitest";
import { mount, unmount } from "svelte";
import WinLineIcon from "../../src/lib/components/WinLineIcon.svelte";
import type { WinningLine } from "../../src/lib/protocol/messages";

let instance: ReturnType<typeof mount> | null = null;
let container: HTMLElement | null = null;

function renderIcon(props: { gridSize: 3 | 4 | 5; winningLine: WinningLine }) {
  container = document.createElement("div");
  document.body.appendChild(container);
  instance = mount(WinLineIcon, { target: container, props });
  return container;
}

afterEach(() => {
  if (instance) {
    unmount(instance);
    instance = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

function getCells(el: HTMLElement): HTMLElement[] {
  // The root is a <div class="grid...">, cells are its direct <div> children.
  const root = el.firstElementChild as HTMLElement;
  return Array.from(root.children) as HTMLElement[];
}

function expectHighlighted(cells: HTMLElement[], indices: number[]) {
  const highlightClass = "bg-[var(--color-ink-primary)]";
  const dimClass = "bg-[var(--color-divider)]";
  const highlightedSet = new Set(indices);
  cells.forEach((cell, i) => {
    if (highlightedSet.has(i)) {
      expect(cell.className, `cell ${i} should be highlighted`).toContain(highlightClass);
      expect(cell.className, `cell ${i} should not be dim`).not.toContain(dimClass);
    } else {
      expect(cell.className, `cell ${i} should be dim`).toContain(dimClass);
      expect(cell.className, `cell ${i} should not be highlighted`).not.toContain(highlightClass);
    }
  });
}

describe("WinLineIcon", () => {
  it("I1: gridSize 3, row 0 — root has grid-cols-3 and 9 cells", () => {
    const el = renderIcon({ gridSize: 3, winningLine: { type: "row", index: 0 } });
    const root = el.firstElementChild as HTMLElement;
    expect(root.className).toContain("grid-cols-3");
    const cells = getCells(el);
    expect(cells.length).toBe(9);
  });

  it("I2: gridSize 3, row 0 — indices 0,1,2 highlighted; 3-8 dim", () => {
    const el = renderIcon({ gridSize: 3, winningLine: { type: "row", index: 0 } });
    const cells = getCells(el);
    expectHighlighted(cells, [0, 1, 2]);
  });

  it("I3: gridSize 4, col 1 — indices 1,5,9,13 highlighted", () => {
    const el = renderIcon({ gridSize: 4, winningLine: { type: "col", index: 1 } });
    const root = el.firstElementChild as HTMLElement;
    expect(root.className).toContain("grid-cols-4");
    const cells = getCells(el);
    expect(cells.length).toBe(16);
    expectHighlighted(cells, [1, 5, 9, 13]);
  });

  it("I4: gridSize 5, diagonal 0 (main) — indices 0,6,12,18,24 highlighted", () => {
    const el = renderIcon({ gridSize: 5, winningLine: { type: "diagonal", index: 0 } });
    const root = el.firstElementChild as HTMLElement;
    expect(root.className).toContain("grid-cols-5");
    const cells = getCells(el);
    expect(cells.length).toBe(25);
    expectHighlighted(cells, [0, 6, 12, 18, 24]);
  });

  it("I5: gridSize 5, diagonal 1 (anti) — indices 4,8,12,16,20 highlighted", () => {
    const el = renderIcon({ gridSize: 5, winningLine: { type: "diagonal", index: 1 } });
    const cells = getCells(el);
    expect(cells.length).toBe(25);
    expectHighlighted(cells, [4, 8, 12, 16, 20]);
  });

  it("I6: root has role='img' and aria-label='Winning line indicator'", () => {
    const el = renderIcon({ gridSize: 3, winningLine: { type: "row", index: 0 } });
    const root = el.firstElementChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("img");
    expect(root.getAttribute("aria-label")).toBe("Winning line indicator");
  });

  it("I7: root has w-16 h-16 fixed 64×64 dimensions", () => {
    const el = renderIcon({ gridSize: 3, winningLine: { type: "row", index: 0 } });
    const root = el.firstElementChild as HTMLElement;
    expect(root.className).toContain("w-16");
    expect(root.className).toContain("h-16");
  });

  it("I8: gridSize 3, row 2 — indices 6,7,8 highlighted", () => {
    const el = renderIcon({ gridSize: 3, winningLine: { type: "row", index: 2 } });
    const cells = getCells(el);
    expectHighlighted(cells, [6, 7, 8]);
  });
});
