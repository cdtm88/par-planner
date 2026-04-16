import { test, expect, type Page } from "@playwright/test";

// SESS-02: join an existing room by entering the 6-character code on the home page

async function createRoomInTab(page: Page, name: string): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a game" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /Create game/ }).click();
  await page.waitForURL(/\/room\/[A-Z2-9]{6}$/);
  const url = new URL(page.url());
  return url.pathname.split("/").pop()!;
}

test("SESS-02: join an existing room by entering the code", async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const hostPage = await hostCtx.newPage();
  const code = await createRoomInTab(hostPage, "Alice");
  expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);

  const joinerCtx = await browser.newContext();
  const joinerPage = await joinerCtx.newPage();
  await joinerPage.goto("/");
  const codeInput = joinerPage.getByLabel("Join with code");
  await codeInput.fill(code);
  await joinerPage.getByRole("button", { name: /^Join$/ }).click();
  await joinerPage.getByLabel("Your name").fill("Bob");
  await joinerPage.getByRole("button", { name: /Join game/ }).click();
  await joinerPage.waitForURL(`**/room/${code}`);
  await expect(joinerPage.getByText("Bob")).toBeVisible({ timeout: 2000 });

  await hostCtx.close();
  await joinerCtx.close();
});
