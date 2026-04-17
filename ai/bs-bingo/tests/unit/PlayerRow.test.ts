import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { mount, unmount } from "svelte";
import PlayerRow from "../../src/lib/components/PlayerRow.svelte";

// jsdom doesn't implement element.animate — stub it so Svelte transitions don't throw
beforeAll(() => {
  if (!HTMLElement.prototype.animate) {
    HTMLElement.prototype.animate = () => ({
      cancel: () => {},
      finish: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as Animation);
  }
});

type Player = { playerId: string; displayName: string; isHost: boolean };

let instance: ReturnType<typeof mount> | null = null;
let container: HTMLElement | null = null;

function renderRow(props: { player: Player; markCount?: number }) {
  container = document.createElement("div");
  document.body.appendChild(container);
  instance = mount(PlayerRow, { target: container, props });
  return container;
}

afterEach(() => {
  if (instance) { unmount(instance); instance = null; }
  if (container) { container.remove(); container = null; }
});

describe("PlayerRow — backwards compatibility (Phase 2 lobby path)", () => {
  const player: Player = { playerId: "p1", displayName: "Alice", isHost: false };

  it("renders display name", () => {
    const el = renderRow({ player });
    expect(el.textContent).toContain("Alice");
  });

  it("no mark badge when markCount is undefined", () => {
    const el = renderRow({ player });
    const spans = Array.from(el.querySelectorAll("span"));
    const pill = spans.find((s) =>
      s.className.includes("bg-[var(--color-accent)]") &&
      s.className.includes("rounded-full")
    );
    expect(pill).toBeUndefined();
  });

  it("no mark badge when markCount is 0", () => {
    const el = renderRow({ player, markCount: 0 });
    const spans = Array.from(el.querySelectorAll("span"));
    const pill = spans.find((s) =>
      s.className.includes("bg-[var(--color-accent)]") &&
      s.className.includes("rounded-full")
    );
    expect(pill).toBeUndefined();
  });
});

describe("PlayerRow — mark-count badge (Phase 3)", () => {
  const player: Player = { playerId: "p1", displayName: "Alice", isHost: false };

  it("renders accent pill when markCount is 1", () => {
    const el = renderRow({ player, markCount: 1 });
    const spans = Array.from(el.querySelectorAll("span"));
    const pill = spans.find((s) =>
      s.className.includes("bg-[var(--color-accent)]") &&
      s.className.includes("rounded-full")
    );
    expect(pill).toBeDefined();
    expect(pill!.textContent?.trim()).toBe("1");
  });

  it("renders the count '12' when markCount is 12", () => {
    const el = renderRow({ player, markCount: 12 });
    const spans = Array.from(el.querySelectorAll("span"));
    const pill = spans.find((s) =>
      s.className.includes("bg-[var(--color-accent)]") &&
      s.className.includes("rounded-full")
    );
    expect(pill).toBeDefined();
    expect(pill!.textContent?.trim()).toBe("12");
  });

  it("accent pill has ink-inverse text color class", () => {
    const el = renderRow({ player, markCount: 3 });
    const spans = Array.from(el.querySelectorAll("span"));
    const pill = spans.find((s) =>
      s.className.includes("bg-[var(--color-accent)]")
    )!;
    expect(pill.className).toContain("text-[var(--color-ink-inverse)]");
  });

  it("accent pill has screen-reader aria-label (singular for 1, plural otherwise)", () => {
    const el1 = renderRow({ player, markCount: 1 });
    const pill1 = Array.from(el1.querySelectorAll("span"))
      .find((s) => s.className.includes("bg-[var(--color-accent)]"))!;
    expect(pill1.getAttribute("aria-label")).toMatch(/1 mark$/);

    unmount(instance!); instance = null;
    container!.remove(); container = null;

    const el5 = renderRow({ player, markCount: 5 });
    const pill5 = Array.from(el5.querySelectorAll("span"))
      .find((s) => s.className.includes("bg-[var(--color-accent)]"))!;
    expect(pill5.getAttribute("aria-label")).toMatch(/5 marks$/);
  });

  it("host with markCount shows BOTH host badge and accent pill", () => {
    const hostPlayer: Player = { playerId: "p1", displayName: "Alice", isHost: true };
    const el = renderRow({ player: hostPlayer, markCount: 2 });

    expect(el.textContent).toContain("Host"); // Host badge still renders
    const spans = Array.from(el.querySelectorAll("span"));
    const pill = spans.find((s) =>
      s.className.includes("bg-[var(--color-accent)]") &&
      s.className.includes("rounded-full")
    );
    expect(pill).toBeDefined();
    expect(pill!.textContent?.trim()).toBe("2");
  });
});
