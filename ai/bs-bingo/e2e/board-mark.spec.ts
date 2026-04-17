import { test, expect } from "@playwright/test";

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

test("Phase 3: both players see a board after host starts the game", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  const code = await createRoom(a, "Host");
  await joinRoom(b, code, "Player2");
  await expect(a.getByText("Players · 2")).toBeVisible({ timeout: 5000 });

  await seedWords(a, ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]);
  await a.getByRole("button", { name: /Start Game/i }).click();

  // Both see the board (a <button> cell appears inside board-grid)
  await expect(a.locator('[data-testid="board-grid"] button').first()).toBeVisible({ timeout: 3000 });
  await expect(b.locator('[data-testid="board-grid"] button').first()).toBeVisible({ timeout: 3000 });

  await ctxA.close();
  await ctxB.close();
});

test("Phase 3: marking a cell updates the acting player's own badge within 1s", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  const code = await createRoom(a, "Host");
  await joinRoom(b, code, "Player2");
  await expect(a.getByText("Players · 2")).toBeVisible({ timeout: 5000 });

  await seedWords(a, ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]);
  await a.getByRole("button", { name: /Start Game/i }).click();

  await expect(a.locator('[data-testid="board-grid"] button').first()).toBeVisible({ timeout: 3000 });

  // Host clicks first cell
  await a.locator('[data-testid="board-grid"] button').first().click();

  // Host sees their own badge count = 1 within 1s
  await expect(
    a.locator('li').filter({ hasText: "Host" }).locator('[data-testid="mark-badge"]')
  ).toHaveText("1", { timeout: 1500 });

  await ctxA.close();
  await ctxB.close();
});

test("Phase 3: peer's badge updates within 1s after a player marks a cell (BOAR-06)", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  const code = await createRoom(a, "Host");
  await joinRoom(b, code, "Player2");
  await expect(a.getByText("Players · 2")).toBeVisible({ timeout: 5000 });

  await seedWords(a, ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]);
  await a.getByRole("button", { name: /Start Game/i }).click();

  await expect(a.locator('[data-testid="board-grid"] button').first()).toBeVisible({ timeout: 3000 });
  await expect(b.locator('[data-testid="board-grid"] button').first()).toBeVisible({ timeout: 3000 });

  // Host marks first cell
  await a.locator('[data-testid="board-grid"] button').first().click();

  // Guest sees Host's badge = 1 within 1s
  await expect(
    b.locator('li').filter({ hasText: "Host" }).locator('[data-testid="mark-badge"]')
  ).toHaveText("1", { timeout: 1500 });

  await ctxA.close();
  await ctxB.close();
});

test("Phase 3: mark toggle — clicking a marked cell removes the mark", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();

  await createRoom(a, "Host");
  // Solo game — host only needs 5 words to start (canStart gate is wordCount >= 5, not player count)
  await seedWords(a, ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]);
  await a.getByRole("button", { name: /Start Game/i }).click();

  await expect(a.locator('[data-testid="board-grid"] button').first()).toBeVisible({ timeout: 3000 });

  const firstCell = a.locator('[data-testid="board-grid"] button').first();
  await firstCell.click();
  await expect(
    a.locator('li').filter({ hasText: "Host" }).locator('[data-testid="mark-badge"]')
  ).toHaveText("1", { timeout: 1500 });

  // Toggle off
  await firstCell.click();
  // Badge disappears (markCount === 0 → no badge rendered)
  await expect(
    a.locator('li').filter({ hasText: "Host" }).locator('[data-testid="mark-badge"]')
  ).toHaveCount(0, { timeout: 1500 });

  await ctxA.close();
});
