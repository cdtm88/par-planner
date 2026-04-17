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

test("Phase 2: word input and pool visible for all players", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  const code = await createRoom(a, "Host");
  await joinRoom(b, code, "Player2");

  await expect(a.getByText("Players · 2")).toBeVisible({ timeout: 5000 });
  await expect(b.getByText("Players · 2")).toBeVisible({ timeout: 5000 });

  // Both see word input
  await expect(a.getByPlaceholder("Add a buzzword…")).toBeVisible();
  await expect(b.getByPlaceholder("Add a buzzword…")).toBeVisible();

  // Both see empty state
  await expect(a.getByText("No words yet")).toBeVisible();
  await expect(b.getByText("No words yet")).toBeVisible();

  // Host sees packs, non-host does not
  await expect(a.getByText("Seed from a starter pack:")).toBeVisible();
  await expect(b.getByText("Seed from a starter pack:")).not.toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test("Phase 2: word submission appears in both browsers", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  const code = await createRoom(a, "Host");
  await joinRoom(b, code, "Player2");
  await expect(a.getByText("Players · 2")).toBeVisible({ timeout: 5000 });

  await a.getByPlaceholder("Add a buzzword…").fill("Synergy");
  await a.getByPlaceholder("Add a buzzword…").press("Enter");

  await expect(a.getByText("Synergy")).toBeVisible({ timeout: 3000 });
  await expect(b.getByText("Synergy")).toBeVisible({ timeout: 3000 });

  // A's chip has delete, B's does not
  await expect(a.getByRole("button", { name: /Remove "Synergy"/i })).toBeVisible();
  await expect(b.getByRole("button", { name: /Remove "Synergy"/i })).not.toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test("Phase 2: duplicate word shows error", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();

  await createRoom(a, "Host");
  await a.getByPlaceholder("Add a buzzword…").fill("Synergy");
  await a.getByPlaceholder("Add a buzzword…").press("Enter");
  await expect(a.getByText("Synergy")).toBeVisible({ timeout: 3000 });

  await a.getByPlaceholder("Add a buzzword…").fill("synergy");
  await a.getByPlaceholder("Add a buzzword…").press("Enter");

  await expect(a.getByText(/already in the pool/i)).toBeVisible({ timeout: 3000 });

  await ctxA.close();
});

test("Phase 2: grid progress visible, start game disabled < 5 words", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();

  await createRoom(a, "Host");

  await expect(a.getByText(/need 5 more/i)).toBeVisible({ timeout: 3000 });
  await expect(a.getByRole("button", { name: /Start Game/i })).toBeDisabled();

  await ctxA.close();
});

test("Phase 2: start game enabled after 5 words", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();

  await createRoom(a, "Host");

  for (const word of ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]) {
    await a.getByPlaceholder("Add a buzzword…").fill(word);
    await a.getByPlaceholder("Add a buzzword…").press("Enter");
    await expect(a.getByText(word)).toBeVisible({ timeout: 2000 });
  }

  await expect(a.getByRole("button", { name: /Start Game/i })).toBeEnabled({ timeout: 3000 });

  await ctxA.close();
});

test("Phase 2: non-host sees waiting message not start game button", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  const code = await createRoom(a, "Alice");
  await joinRoom(b, code, "Bob");
  await expect(a.getByText("Players · 2")).toBeVisible({ timeout: 5000 });

  await expect(b.getByText(/Waiting for .* to start the game/i)).toBeVisible({ timeout: 3000 });
  await expect(b.getByRole("button", { name: /Start Game/i })).not.toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test("Phase 2: delete chip removes word from both browsers", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  const code = await createRoom(a, "Host");
  await joinRoom(b, code, "Player2");
  await expect(a.getByText("Players · 2")).toBeVisible({ timeout: 5000 });

  await a.getByPlaceholder("Add a buzzword…").fill("Synergy");
  await a.getByPlaceholder("Add a buzzword…").press("Enter");
  await expect(b.getByText("Synergy")).toBeVisible({ timeout: 3000 });

  await a.getByRole("button", { name: /Remove "Synergy"/i }).click();

  await expect(a.getByText("Synergy")).not.toBeVisible({ timeout: 3000 });
  await expect(b.getByText("Synergy")).not.toBeVisible({ timeout: 3000 });

  await ctxA.close();
  await ctxB.close();
});
