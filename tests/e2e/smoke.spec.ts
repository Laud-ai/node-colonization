import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("lobby → one turn → version snapshot iframe", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  await page.goto("/");

  // Setup lobby visible
  await expect(page.locator("#setupScreen")).toBeVisible();
  await expect(page.locator("#playScreen")).toBeHidden();

  // Four setup tabs present
  for (const [tab, label] of [
    ["fervor", "Fervor"],
    ["solar", "Solar / Blocs"],
    ["versions", "Version / Ruleset"],
    ["rules", "Rules"],
  ] as const) {
    const btn = page.locator(`[data-setup-tab="${tab}"]`);
    await expect(btn).toBeVisible();
    await expect(btn).toContainText(label);
  }

  // Seed for determinism; begin
  await page.locator("#setupSeed").fill("42");
  await page.locator("#btnBeginSim").click();
  await expect(page.locator("#playScreen")).toBeVisible();
  await expect(page.locator("#setupScreen")).toBeHidden();
  await expect(page.locator("#turn")).toHaveText("1");

  // Advance one turn
  await page.locator("#btnEnd").click();
  await expect(page.locator("#turn")).toHaveText("2");

  // Screenshot after one turn
  const smokeDir = path.resolve("out/smoke");
  fs.mkdirSync(smokeDir, { recursive: true });
  await page.screenshot({ path: path.join(smokeDir, "smoke.png"), fullPage: true });

  // Back to lobby for version picker
  await page.locator("#btnNew").click();
  await expect(page.locator("#setupScreen")).toBeVisible();

  await page.locator('[data-setup-tab="versions"]').click();
  await expect(page.locator("#setupTabVersions")).toBeVisible();

  const versionBtns = page.locator("#versionList button.variant-btn:not([disabled])");
  await expect(versionBtns.first()).toBeVisible({ timeout: 10_000 });
  const count = await versionBtns.count();
  expect(count).toBeGreaterThanOrEqual(2);

  // Prefer an older snapshot (not live 0.12.0) if present
  let older = page.locator('#versionList button.variant-btn:not([disabled])[data-ver="0.9.0"]');
  if ((await older.count()) === 0) {
    older = versionBtns.filter({ hasNotText: "live" }).first();
  }
  await older.click();

  const overlay = page.locator("#snapshotOverlay");
  await expect(overlay).toBeVisible();
  const frame = page.frameLocator("#snapshotFrame");
  // Frozen snapshot should paint its own root UI
  await expect(frame.locator("body")).toBeVisible({ timeout: 15_000 });
  await expect(frame.locator("body")).not.toBeEmpty();

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
