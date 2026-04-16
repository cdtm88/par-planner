import { test, expect } from "@playwright/test";

// SESS-07: invalid codes render the error page with a "Create a new game" CTA

test("SESS-07: opening /join/<bad> renders the error page", async ({ page }) => {
  await page.goto("/join/ZZZZZZ");
  // Either the +page.ts load throws 404 (most likely), or the modal opens and WS upgrade 404s.
  // We assert the error-page heading.
  await expect(page.getByRole("heading", { name: "Room not found" })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/That game is over|wrong|expired/)).toBeVisible();
  const cta = page.getByRole("link", { name: "Create a new game" });
  await expect(cta).toHaveAttribute("href", "/");
});

test("SESS-07: opening /room/<bad> renders the error page", async ({ page }) => {
  await page.goto("/room/ZZZZZZ");
  await expect(page.getByRole("heading", { name: "Room not found" })).toBeVisible({ timeout: 5000 });
  const cta = page.getByRole("link", { name: "Create a new game" });
  await expect(cta).toHaveAttribute("href", "/");
});
