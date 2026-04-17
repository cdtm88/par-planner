import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, unmount } from "svelte";
import BoardCell from "../../src/lib/components/BoardCell.svelte";

type Cell = { cellId: string; wordId: string | null; text: string | null; blank: boolean };

let instance: ReturnType<typeof mount> | null = null;
let container: HTMLElement | null = null;

function renderCell(props: { cell: Cell; marked: boolean; onToggle?: () => void }) {
  container = document.createElement("div");
  document.body.appendChild(container);
  instance = mount(BoardCell, { target: container, props });
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

describe("BoardCell — non-blank (word) cell", () => {
  const wordCell: Cell = { cellId: "c1", wordId: "w1", text: "Synergy", blank: false };

  it("renders a button element", () => {
    const el = renderCell({ cell: wordCell, marked: false });
    expect(el.querySelector("button")).not.toBeNull();
  });

  it("displays the word text", () => {
    const el = renderCell({ cell: wordCell, marked: false });
    expect(el.textContent).toContain("Synergy");
  });

  it("unmarked cell has surface background and primary text classes (D-12)", () => {
    const el = renderCell({ cell: wordCell, marked: false });
    const btn = el.querySelector("button")!;
    const cls = btn.className;
    expect(cls).toContain("bg-[var(--color-surface)]");
    expect(cls).toContain("text-[var(--color-ink-primary)]");
  });

  it("marked cell has accent background and inverse text classes (D-13)", () => {
    const el = renderCell({ cell: wordCell, marked: true });
    const btn = el.querySelector("button")!;
    const cls = btn.className;
    expect(cls).toContain("bg-[var(--color-accent)]");
    expect(cls).toContain("text-[var(--color-ink-inverse)]");
  });

  it("has min-h-11 min-w-11 aspect-square (BOAR-07 / D-15)", () => {
    const el = renderCell({ cell: wordCell, marked: false });
    const btn = el.querySelector("button")!;
    const cls = btn.className;
    expect(cls).toContain("min-h-11");
    expect(cls).toContain("min-w-11");
    expect(cls).toContain("aspect-square");
  });

  it("unmarked aria-label includes 'Tap to mark'", () => {
    const el = renderCell({ cell: wordCell, marked: false });
    const btn = el.querySelector("button")!;
    expect(btn.getAttribute("aria-label")).toMatch(/Tap to mark/);
  });

  it("marked aria-label includes 'Marked. Tap to unmark'", () => {
    const el = renderCell({ cell: wordCell, marked: true });
    const btn = el.querySelector("button")!;
    expect(btn.getAttribute("aria-label")).toMatch(/Marked\. Tap to unmark/);
  });

  it("marked cell has aria-pressed='true'", () => {
    const el = renderCell({ cell: wordCell, marked: true });
    const btn = el.querySelector("button")!;
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("unmarked cell has aria-pressed='false'", () => {
    const el = renderCell({ cell: wordCell, marked: false });
    const btn = el.querySelector("button")!;
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking the button invokes onToggle", () => {
    const onToggle = vi.fn();
    const el = renderCell({ cell: wordCell, marked: false, onToggle });
    const btn = el.querySelector("button")!;
    btn.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe("BoardCell — blank (inert) cell", () => {
  const blankCell: Cell = { cellId: "c2", wordId: null, text: null, blank: true };

  it("does NOT render a button (Pitfall 6)", () => {
    const el = renderCell({ cell: blankCell, marked: false });
    expect(el.querySelector("button")).toBeNull();
  });

  it("renders a div with aria-hidden='true' and tabindex='-1'", () => {
    const el = renderCell({ cell: blankCell, marked: false });
    const blank = el.querySelector('[aria-hidden="true"]');
    expect(blank).not.toBeNull();
    expect(blank!.getAttribute("tabindex")).toBe("-1");
  });

  it("has no text content", () => {
    const el = renderCell({ cell: blankCell, marked: false });
    expect((el.textContent ?? "").trim()).toBe("");
  });

  it("has min-h-11 min-w-11 aspect-square (still a 44px slot)", () => {
    const el = renderCell({ cell: blankCell, marked: false });
    const blank = el.querySelector('[aria-hidden="true"]')!;
    const cls = blank.className;
    expect(cls).toContain("min-h-11");
    expect(cls).toContain("min-w-11");
    expect(cls).toContain("aspect-square");
  });

  it("has a dashed border class (D-14)", () => {
    const el = renderCell({ cell: blankCell, marked: false });
    const blank = el.querySelector('[aria-hidden="true"]')!;
    expect(blank.className).toContain("border-dashed");
  });

  it("clicking the blank element does NOT invoke onToggle", () => {
    const onToggle = vi.fn();
    const el = renderCell({ cell: blankCell, marked: false, onToggle });
    const blank = el.querySelector('[aria-hidden="true"]')! as HTMLElement;
    blank.click();
    expect(onToggle).not.toHaveBeenCalled();
  });
});
