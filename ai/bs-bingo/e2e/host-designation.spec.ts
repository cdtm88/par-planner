import { test, expect } from "@playwright/test";

// SESS-06: first player to join is designated host, visibly marked on all clients

test("SESS-06: first player is host, visibly marked on all clients", async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const a = await hostCtx.newPage();
  await a.goto("/");
  await a.getByRole("button", { name: "Create a game" }).click();
  await a.getByLabel("Your name").fill("Alice");
  await a.getByRole("button", { name: /Create game/ }).click();
  await a.waitForURL(/\/room\/[A-Z2-9]{6}$/);
  const code = a.url().split("/").pop()!;

  // Host sees "Start Game" (disabled) + her own Host badge
  await expect(a.getByRole("button", { name: "Start Game" })).toBeDisabled();
  const aliceRow = a.locator("li", { hasText: "Alice" });
  await expect(aliceRow.getByText("Host")).toBeVisible();

  const joinerCtx = await browser.newContext();
  const b = await joinerCtx.newPage();
  await b.goto(`/join/${code}`);
  await b.getByLabel("Your name").fill("Bob");
  await b.getByRole("button", { name: /Join game/ }).click();
  await b.waitForURL(`**/room/${code}`);

  // Bob (non-host) sees "Waiting for the host to start." and Alice has Host badge on his view.
  await expect(b.getByText("Waiting for the host to start.")).toBeVisible();
  await expect(b.getByRole("button", { name: "Start Game" })).toHaveCount(0);
  const bobAliceRow = b.locator("li", { hasText: "Alice" });
  await expect(bobAliceRow.getByText("Host")).toBeVisible();
  const bobBobRow = b.locator("li", { hasText: "Bob" });
  await expect(bobBobRow.getByText("Host")).toHaveCount(0);

  await hostCtx.close();
  await joinerCtx.close();
});
