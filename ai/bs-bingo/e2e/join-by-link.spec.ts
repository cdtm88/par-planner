import { test, expect } from "@playwright/test";

// SESS-03: join an existing room by opening the share link (/join/{code})

test("SESS-03: join an existing room by opening the share link", async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  await host.goto("/");
  await host.getByRole("button", { name: "Create a game" }).click();
  await host.getByLabel("Your name").fill("Alice");
  await host.getByRole("button", { name: /Create game/ }).click();
  await host.waitForURL(/\/room\/[A-Z2-9]{6}$/);
  const code = host.url().split("/").pop()!;

  const joinerCtx = await browser.newContext();
  const joiner = await joinerCtx.newPage();
  await joiner.goto(`/join/${code}`);
  await expect(joiner.getByText(/Joining room/)).toBeVisible();
  await joiner.getByLabel("Your name").fill("Bob");
  await joiner.getByRole("button", { name: /Join game/ }).click();
  await joiner.waitForURL(`**/room/${code}`);
  await expect(joiner.getByText("Bob")).toBeVisible();

  await hostCtx.close();
  await joinerCtx.close();
});
