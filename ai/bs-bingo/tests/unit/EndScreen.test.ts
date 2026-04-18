import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, unmount } from "svelte";
import EndScreen from "../../src/lib/components/EndScreen.svelte";
import type { BoardCell, WinningLine } from "../../src/lib/protocol/messages";

let instance: ReturnType<typeof mount> | null = null;
let container: HTMLElement | null = null;

type EndScreenProps = {
  winner: { playerId: string; displayName: string };
  winningLine: WinningLine;
  winningCellIds: string[];
  board: BoardCell[] | null;
  markedCellIds: Set<string>;
  isHost: boolean;
  isWinner: boolean;
  gridSize: 3 | 4 | 5;
  onStartNewGame: () => void;
};

function makeBoard(n: number, blanksAt: number[] = []): BoardCell[] {
  return Array.from({ length: n }, (_, i) => ({
    cellId: `c${i}`,
    wordId: blanksAt.includes(i) ? null : `w${i}`,
    text: blanksAt.includes(i) ? null : `Word${i}`,
    blank: blanksAt.includes(i),
  }));
}

function baseProps(overrides: Partial<EndScreenProps> = {}): EndScreenProps {
  return {
    winner: { playerId: "p1", displayName: "Alice" },
    winningLine: { type: "row", index: 0 } as WinningLine,
    winningCellIds: ["c0", "c1", "c2"],
    board: null,
    markedCellIds: new Set<string>(["c0", "c1", "c2"]),
    isHost: false,
    isWinner: false,
    gridSize: 3,
    onStartNewGame: vi.fn(),
    ...overrides,
  };
}

function render(props: EndScreenProps) {
  container = document.createElement("div");
  document.body.appendChild(container);
  instance = mount(EndScreen, { target: container, props });
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

describe("EndScreen — winner view", () => {
  it("E1: renders 'BINGO!' inside an element with font-display and text-accent classes", () => {
    const el = render(baseProps({ isWinner: true, board: makeBoard(9) }));
    const match = Array.from(el.querySelectorAll("h1,p,div,span")).find((n) =>
      (n.textContent ?? "").trim() === "BINGO!"
    );
    expect(match).toBeTruthy();
    expect(match!.className).toContain("font-display");
    expect(match!.className).toContain("text-[var(--color-accent)]");
  });

  it("E2: renders the winner's displayName below the wordmark", () => {
    const el = render(
      baseProps({
        isWinner: true,
        board: makeBoard(9),
        winner: { playerId: "p1", displayName: "Alice" },
      })
    );
    expect(el.textContent).toContain("Alice");
  });

  it("E3: renders 'You called it.' subline containing formatWinLine label (Row 1)", () => {
    const el = render(
      baseProps({
        isWinner: true,
        board: makeBoard(9),
        winningLine: { type: "row", index: 0 },
      })
    );
    expect(el.textContent).toMatch(/You called it\./);
    expect(el.textContent).toMatch(/Row 1/);
  });

  it("E4: winner view shows WinLineIcon (no frozen board — board removed to avoid jarring resize)", () => {
    const el = render(
      baseProps({
        isWinner: true,
        board: makeBoard(9),
        winningCellIds: ["c0", "c1", "c2"],
      })
    );
    // No full frozen board — WinLineIcon SVG replaces it
    expect(el.querySelector(".pointer-events-none")).toBeNull();
    // WinLineIcon renders an svg or role=img element
    const icon = el.querySelector("svg, [role='img']");
    expect(icon).not.toBeNull();
  });

  it("E5: winner view does not render individual board cells", () => {
    const el = render(
      baseProps({
        isWinner: true,
        board: makeBoard(9),
        winningCellIds: ["c0", "c1", "c2"],
      })
    );
    // No data-win-line attributes — board cells are not rendered
    const winLineCells = el.querySelectorAll("[data-win-line='true']");
    expect(winLineCells.length).toBe(0);
  });

  it("E6: winner view Start new game button is clickable (no frozen board buttons to conflict)", () => {
    const onStartNewGame = vi.fn();
    const el = render(
      baseProps({
        isWinner: true,
        isHost: true,
        board: makeBoard(9),
        winningCellIds: ["c0", "c1", "c2"],
        onStartNewGame,
      })
    );
    const btn = el.querySelector("button") as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(() => btn!.click()).not.toThrow();
  });

  it("E7: aria-live=polite region contains 'BINGO!' and a win-line reference in the section text", () => {
    const el = render(
      baseProps({
        isWinner: true,
        board: makeBoard(9),
        winningLine: { type: "diagonal", index: 0 },
      })
    );
    const live = el.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    // The H1 is the aria-live region — contains "BINGO!"
    expect((live!.textContent ?? "").trim()).toMatch(/BINGO!/);
    // Section text contains the line label somewhere (subline under the wordmark)
    expect(el.textContent).toMatch(/Top-left diagonal/);
  });
});

describe("EndScreen — non-winner view", () => {
  it("E8: renders heading containing '{winner.displayName} got Bingo!'", () => {
    const el = render(
      baseProps({
        isWinner: false,
        winner: { playerId: "p-other", displayName: "Alice" },
      })
    );
    expect(el.textContent).toMatch(/Alice got Bingo!/);
  });

  it("E9: renders a WinLineIcon child (role=img + aria-label)", () => {
    const el = render(
      baseProps({
        isWinner: false,
        gridSize: 4,
        winningLine: { type: "col", index: 1 },
      })
    );
    const icon = el.querySelector('[role="img"][aria-label="Winning line indicator"]');
    expect(icon).not.toBeNull();
    // WinLineIcon uses grid-cols-N; for gridSize=4, should be grid-cols-4
    expect(icon!.className).toContain("grid-cols-4");
  });

  it("E10: does NOT render a frozen board (no pointer-events-none grid, no BoardCell buttons)", () => {
    const el = render(baseProps({ isWinner: false, board: null }));
    expect(el.querySelector(".pointer-events-none")).toBeNull();
    // The non-winner branch only renders WinLineIcon cells (divs), no BoardCell buttons.
    // Buttons may exist from the (non-host) branch but that won't include BoardCell buttons.
    const buttons = Array.from(el.querySelectorAll("button"));
    // Non-winner, non-host → no buttons at all.
    expect(buttons.length).toBe(0);
  });

  it("E11: subline contains formatWinLine label and 'completed'", () => {
    const el = render(
      baseProps({
        isWinner: false,
        winningLine: { type: "row", index: 2 },
      })
    );
    expect(el.textContent).toMatch(/Row 3 completed\./);
  });

  it("E12: closing line contains 'Nice try'", () => {
    const el = render(baseProps({ isWinner: false }));
    expect(el.textContent).toMatch(/Nice try/);
  });
});

describe("EndScreen — host vs non-host", () => {
  it("E13: isHost=true renders 'Start new game' button and clicking invokes onStartNewGame", () => {
    const onStartNewGame = vi.fn();
    const el = render(
      baseProps({
        isWinner: false,
        isHost: true,
        onStartNewGame,
      })
    );
    const btn = el.querySelector("button")!;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toMatch(/Start new game/);
    btn.click();
    expect(onStartNewGame).toHaveBeenCalledTimes(1);
  });

  it("E14: isHost=false renders NO button and helper text 'Waiting for the host'", () => {
    const el = render(baseProps({ isWinner: false, isHost: false }));
    expect(el.querySelector("button")).toBeNull();
    expect(el.textContent).toMatch(/Waiting for the host/);
  });

  it("E15: isHost=true helper text contains 'Word pool and players are kept'", () => {
    const el = render(baseProps({ isWinner: false, isHost: true }));
    expect(el.textContent).toMatch(/Word pool and players are kept/);
  });
});
