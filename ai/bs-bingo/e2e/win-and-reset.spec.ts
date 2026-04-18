import { test, expect } from "@playwright/test";

// Reuse helpers from board-mark.spec.ts — copied verbatim so this file stands alone.
async function createRoom(page: import("@playwright/test").Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a game" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /Create game/ }).click();
  await page.waitForURL(/\/room\/[A-Z2-9]{6}$/);
  return page.url().split("/").pop()!;
}

async function joinRoom(page: import("@playwright/test").Page, code: string, name: string) {
  await page.goto(`/join/${code}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /Join game/ }).click();
  await page.waitForURL(`**/room/${code}`);
}

async function seedWords(page: import("@playwright/test").Page, words: string[]) {
  for (const w of words) {
    await page.getByPlaceholder("Add a buzzword…").fill(w);
    await page.getByPlaceholder("Add a buzzword…").press("Enter");
    await expect(page.getByText(w)).toBeVisible({ timeout: 2000 });
  }
}

test.describe("Phase 4: Win & Play-Again e2e", () => {
  test("both players see EndScreen within 1.5s of win", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    try {
      const code = await createRoom(a, "HostAlice");
      await joinRoom(b, code, "PeerBob");
      await expect(a.getByText("Players · 2")).toBeVisible({ timeout: 5000 });

      // 5 words → 3x3 grid (5 non-blank + 4 blanks per BoardCell layout).
      // Blank cells render as <div>, not <button>, so `button` selectors
      // naturally exclude them. Marking every button guarantees a complete line.
      await seedWords(a, ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]);
      await a.getByRole("button", { name: /Start Game/i }).click();

      // Wait for board to deal
      await expect(a.locator('[data-testid="board-grid"] button').first()).toBeVisible({
        timeout: 3000,
      });

      // Click non-blank cells on host's board until a line completes.
      // The Board unmounts the moment the server broadcasts winDeclared, so
      // later clicks race against detachment — use a short per-click timeout
      // and break once BINGO! appears.
      const cells = await a.locator('[data-testid="board-grid"] button').all();
      for (const cell of cells) {
        try {
          await cell.click({ timeout: 1000 });
        } catch {
          // Board likely unmounted after a winning click — stop iterating.
          break;
        }
        if (await a.getByText(/^BINGO!$/).isVisible().catch(() => false)) break;
      }

      // Winner sees BINGO! wordmark
      await expect(a.getByText(/^BINGO!$/)).toBeVisible({ timeout: 1500 });

      // Non-winner sees "{Host's name} got Bingo!"
      await expect(b.getByText(/HostAlice got Bingo!/)).toBeVisible({ timeout: 1500 });

      // Non-winner does NOT see BINGO! wordmark
      await expect(b.getByText(/^BINGO!$/)).toHaveCount(0);

      // Winner does NOT see the "got Bingo!" heading variant (only the Display wordmark)
      await expect(a.getByText(/got Bingo!/)).toHaveCount(0);

      // Host-only CTA visible on host
      await expect(a.getByRole("button", { name: /Start new game/i })).toBeVisible();

      // Non-host sees the waiting message, no CTA
      await expect(b.getByText(/Waiting for the host/i)).toBeVisible();
      await expect(b.getByRole("button", { name: /Start new game/i })).toHaveCount(0);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("host starts new game, both players return to lobby with words retained", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    try {
      const code = await createRoom(a, "HostAlice");
      await joinRoom(b, code, "PeerBob");
      await expect(a.getByText("Players · 2")).toBeVisible({ timeout: 5000 });

      const seedWordsList = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
      await seedWords(a, seedWordsList);
      await a.getByRole("button", { name: /Start Game/i }).click();
      await expect(a.locator('[data-testid="board-grid"] button').first()).toBeVisible({
        timeout: 3000,
      });

      // Trigger win using the same strategy as test 1 — short per-click
      // timeout + break on BINGO! to avoid racing with Board unmount.
      const cells = await a.locator('[data-testid="board-grid"] button').all();
      for (const cell of cells) {
        try {
          await cell.click({ timeout: 1000 });
        } catch {
          break;
        }
        if (await a.getByText(/^BINGO!$/).isVisible().catch(() => false)) break;
      }

      await expect(a.getByText(/^BINGO!$/)).toBeVisible({ timeout: 1500 });

      // Host clicks "Start new game"
      await a.getByRole("button", { name: /Start new game/i }).click();

      // Both browsers return to the lobby within 1.5s.
      // Host sees the "Start Game" button; non-host sees the "Waiting for {host}
      // to start the game…" helper (non-host lobby never renders Start Game).
      await expect(a.getByRole("button", { name: /Start Game/i })).toBeVisible({ timeout: 1500 });
      await expect(b.getByText(/Waiting for .* to start the game/i)).toBeVisible({ timeout: 1500 });

      // Word pool retained — each seeded word still present on both
      for (const word of seedWordsList) {
        await expect(a.getByText(word)).toBeVisible();
        await expect(b.getByText(word)).toBeVisible();
      }

      // EndScreen UI gone — BINGO! wordmark and "got Bingo!" heading no longer visible
      await expect(a.getByText(/^BINGO!$/)).toHaveCount(0);
      await expect(b.getByText(/got Bingo!/)).toHaveCount(0);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
