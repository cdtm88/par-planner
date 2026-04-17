import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, unmount } from "svelte";
import Board from "../../src/lib/components/Board.svelte";

type Cell = { cellId: string; wordId: string | null; text: string | null; blank: boolean };

let instance: ReturnType<typeof mount> | null = null;
let container: HTMLElement | null = null;

function renderBoard(props: {
  cells: Cell[] | null;
  markedCellIds: Set<string>;
  onToggle: (cellId: string) => void;
}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  instance = mount(Board, { target: container, props });
  return container;
}

afterEach(() => {
  if (instance) { unmount(instance); instance = null; }
  if (container) { container.remove(); container = null; }
});

function makeCells(n: number, blanksAt: number[] = []): Cell[] {
  return Array.from({ length: n }, (_, i) => ({
    cellId: `c${i}`,
    wordId: blanksAt.includes(i) ? null : `w${i}`,
    text: blanksAt.includes(i) ? null : `Word${i}`,
    blank: blanksAt.includes(i),
  }));
}

describe("Board — empty state", () => {
  it("renders 'Dealing your board…' when cells is null", () => {
    const el = renderBoard({ cells: null, markedCellIds: new Set(), onToggle: vi.fn() });
    expect(el.textContent).toMatch(/Dealing your board/i);
    expect(el.querySelector("button")).toBeNull(); // no grid cells
  });
});

describe("Board — grid structure", () => {
  it("uses 3 columns for a 9-cell board (3x3)", () => {
    const el = renderBoard({ cells: makeCells(9), markedCellIds: new Set(), onToggle: vi.fn() });
    const grid = el.querySelector('[data-testid="board-grid"]') ?? el.firstElementChild!;
    const cls = grid.className;
    expect(cls).toContain("grid-cols-3");
  });

  it("uses 4 columns for a 16-cell board (4x4)", () => {
    const el = renderBoard({ cells: makeCells(16), markedCellIds: new Set(), onToggle: vi.fn() });
    const grid = el.querySelector('[data-testid="board-grid"]') ?? el.firstElementChild!;
    expect(grid.className).toContain("grid-cols-4");
  });

  it("uses 5 columns for a 25-cell board (5x5)", () => {
    const el = renderBoard({ cells: makeCells(25), markedCellIds: new Set(), onToggle: vi.fn() });
    const grid = el.querySelector('[data-testid="board-grid"]') ?? el.firstElementChild!;
    expect(grid.className).toContain("grid-cols-5");
  });

  it("has 8px gap between cells (gap-2)", () => {
    const el = renderBoard({ cells: makeCells(9), markedCellIds: new Set(), onToggle: vi.fn() });
    const grid = el.querySelector('[data-testid="board-grid"]') ?? el.firstElementChild!;
    expect(grid.className).toContain("gap-2");
  });

  it("has w-full for portrait mobile layout (BOAR-07)", () => {
    const el = renderBoard({ cells: makeCells(9), markedCellIds: new Set(), onToggle: vi.fn() });
    const grid = el.querySelector('[data-testid="board-grid"]') ?? el.firstElementChild!;
    expect(grid.className).toContain("w-full");
  });
});

describe("Board — cell rendering", () => {
  it("renders 9 cells for a 9-cell board (buttons + aria-hidden divs total 9)", () => {
    const el = renderBoard({
      cells: makeCells(9, [4]), // one blank at center
      markedCellIds: new Set(),
      onToggle: vi.fn(),
    });
    const cellCount =
      el.querySelectorAll("button").length +
      el.querySelectorAll('[aria-hidden="true"]').length;
    expect(cellCount).toBe(9);
  });

  it("renders blank cells as aria-hidden divs (no button)", () => {
    const el = renderBoard({
      cells: makeCells(9, [0, 4, 8]),
      markedCellIds: new Set(),
      onToggle: vi.fn(),
    });
    // 6 word cells (buttons), 3 blanks (aria-hidden divs)
    expect(el.querySelectorAll("button").length).toBe(6);
    expect(el.querySelectorAll('[aria-hidden="true"]').length).toBe(3);
  });

  it("applies marked styling to cells in markedCellIds", () => {
    const cells = makeCells(9);
    const el = renderBoard({
      cells,
      markedCellIds: new Set(["c0"]),
      onToggle: vi.fn(),
    });
    const buttons = Array.from(el.querySelectorAll("button"));
    const accented = buttons.filter((b) =>
      b.className.includes("bg-[var(--color-accent)]")
    );
    expect(accented.length).toBe(1);
  });

  it("clicking a non-blank cell invokes onToggle with the cellId", () => {
    const cells = makeCells(9);
    const onToggle = vi.fn();
    const el = renderBoard({ cells, markedCellIds: new Set(), onToggle });
    const firstBtn = el.querySelector("button")!;
    firstBtn.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("c0");
  });

  it("clicking a blank cell does NOT invoke onToggle", () => {
    const cells = makeCells(9, [0]); // first cell blank
    const onToggle = vi.fn();
    const el = renderBoard({ cells, markedCellIds: new Set(), onToggle });
    const blank = el.querySelector('[aria-hidden="true"]') as HTMLElement;
    blank.click();
    expect(onToggle).not.toHaveBeenCalled();
  });
});
