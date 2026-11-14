// 0.21.0: colony History tab — template chronicle grouped into eras (from the deterministic event log).
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("0.21.0 History tab: eras + chronicle for a colony", async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  const dir = path.resolve("out/smoke"); fs.mkdirSync(dir, { recursive: true });
  await page.goto("/");
  await page.locator("#setupSeed").fill("42");
  await page.locator("#btnBeginSim").click();
  await expect(page.locator("#playScreen")).toBeVisible();
  const detail = page.locator("#detail");
  // turn 0: tab exists, history empty until a turn ends
  await detail.locator('[data-detail-tab="history"]').click();
  await expect(detail.locator('[data-detail-tab="history"]')).toHaveClass(/on/);
  for (let i = 0; i < 3; i++) {
    await page.locator("#simN").fill("20");
    await page.locator("#btnSim").click();
    await page.waitForTimeout(150);
  }
  // the History tab sticks across selection changes; pick the colony with the most eras
  const rows = page.locator("#colonies .colony");
  const n = Math.min(await rows.count(), 12);
  let best = -1, bestEras = 0;
  for (let i = 0; i < n; i++) {
    await rows.nth(i).click();
    await page.waitForTimeout(60);
    const eras = await detail.locator("[data-era]").count();
    if (eras > bestEras) { bestEras = eras; best = i; }
  }
  expect(bestEras).toBeGreaterThan(0);
  await rows.nth(best).click();
  await expect(detail.locator("[data-history]")).toBeVisible();
  const entries = await detail.locator("[data-history] li").count();
  expect(entries).toBeGreaterThan(2);
  const first = await detail.locator("[data-history] li").first().innerText();
  expect(first).toMatch(/^T\d+/);
  console.log(`0.21.0 history: ${bestEras} eras, ${entries} entries; first "${first}"`);
  await page.addStyleTag({ content: '.win[data-win="selected"] .win-body { max-height: none !important; overflow: visible !important; }' });
  await page.setViewportSize({ width: 1280, height: 1600 });
  await page.waitForTimeout(250);
  await page.locator('.win[data-win="selected"]').screenshot({ path: path.join(dir, "history-tab.png") });
  await detail.locator("[data-era]").first().screenshot({ path: path.join(dir, "history-eras.png") });
  await page.setViewportSize({ width: 1280, height: 720 });
  // back to Details keeps the old panel
  await detail.locator('[data-detail-tab="details"]').click();
  await expect(detail.locator("[data-open-needs]")).toBeVisible();
  expect(pageErrors).toEqual([]);
});
