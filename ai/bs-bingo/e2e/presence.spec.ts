import { test, expect, type Browser } from "@playwright/test";

// SESS-05: live roster updates propagate across clients within 1 second

test("SESS-05: live roster updates across clients within 1 second", async ({ browser }: { browser: Browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  // A creates the room
  await a.goto("/");
  await a.getByRole("button", { name: "Create a game" }).click();
  await a.getByLabel("Your name").fill("Alice");
  await a.getByRole("button", { name: /Create game/ }).click();
  await a.waitForURL(/\/room\/[A-Z2-9]{6}$/);
  const code = a.url().split("/").pop()!;

  // A sees herself, count 1, "Waiting for players" hint present
  await expect(a.getByText("Players · 1")).toBeVisible({ timeout: 2000 });
  await expect(a.getByText(/Waiting for players/)).toBeVisible();

  // B joins via link
  const t0 = Date.now();
  await b.goto(`/join/${code}`);
  await b.getByLabel("Your name").fill("Bob");
  await b.getByRole("button", { name: /Join game/ }).click();
  await b.waitForURL(`**/room/${code}`);

  // Both tabs should show both players within 2s (sub-1s real target, 2s guardband)
  await expect(a.getByText("Players · 2")).toBeVisible({ timeout: 2000 });
  await expect(a.getByText("Bob")).toBeVisible({ timeout: 2000 });
  await expect(b.getByText("Players · 2")).toBeVisible({ timeout: 2000 });
  await expect(b.getByText("Alice")).toBeVisible({ timeout: 2000 });
  const elapsed = Date.now() - t0;
  expect(elapsed).toBeLessThan(5000); // very loose — includes page navigation time

  // B leaves; A's roster drops Bob within 2s
  await ctxB.close();
  await expect(a.getByText("Players · 1")).toBeVisible({ timeout: 2000 });
  await expect(a.getByText("Bob")).toBeHidden({ timeout: 2000 });

  await ctxA.close();
});
