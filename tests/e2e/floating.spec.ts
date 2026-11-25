// 0.22.0 Floating windows: full-screen map, menu bar, drag / resize / z-order / persistence, rule off = docked.
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const begin = async (page: Page, seed = "42") => {
  await page.locator("#setupSeed").fill(seed);
  await page.locator("#btnBeginSim").click();
  await expect(page.locator("#playScreen")).toBeVisible();
};
const box = async (page: Page, id: string) => (await page.locator(`.win[data-win="${id}"]`).boundingBox())!;

test("0.22.0 floating windows over a full-screen map", async ({ page, browserName }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  const dir = path.resolve(browserName === "firefox" ? "out/smoke/firefox" : "out/smoke"); fs.mkdirSync(dir, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("nc.float.v1"));
  await begin(page);
  await expect(page.locator("#playScreen")).toHaveClass(/floating/);
  for (let i = 0; i < 2; i++) { await page.locator("#simN").fill("15"); await page.locator("#btnSim").click(); await page.waitForTimeout(150); }
  // map covers the whole viewport behind everything; docks + tray gone
  const map = (await page.locator("#globeCard").boundingBox())!;
  expect(map.width).toBeGreaterThanOrEqual(1430); expect(map.height).toBeGreaterThanOrEqual(890);
  await expect(page.locator("#dockLeft")).toBeHidden();
  await expect(page.locator("#tray")).toBeHidden();
  // menu bar lists every window; open ones highlighted; turn + End turn still in the bar
  const bar = page.locator("#winMenuBar");
  const items = bar.locator("[data-menu-win]");
  expect(await items.count()).toBeGreaterThanOrEqual(13);
  for (const id of ["selected", "needs", "suppliers", "log", "lineage", "cluster", "independents", "legend", "blocs", "moves", "colonies", "game", "map"])
    await expect(bar.locator(`[data-menu-win="${id}"]`)).toHaveCount(1);
  await expect(bar.locator('[data-menu-win="selected"]')).toHaveClass(/on/);
  await expect(bar.locator('[data-menu-win="log"]')).not.toHaveClass(/on/);
  await expect(page.locator("#btnEnd")).toBeVisible();
  await expect(page.locator("#turn")).toBeVisible();
  // default layout leaves the map centre free → a click there reaches the globe, not a window
  const hit = await page.evaluate(() => { const el = document.elementFromPoint(innerWidth / 2, innerHeight * 0.6); return el?.closest(".win") ? "win" : el?.closest("#globeWrap") ? "globe" : el?.tagName; });
  expect(hit).toBe("globe");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, "floating-default.png") });
  // open / close from the menu
  await bar.locator('[data-menu-win="cluster"]').click();
  const cl = page.locator('.win[data-win="cluster"]');
  await expect(cl).toBeVisible();
  await expect(bar.locator('[data-menu-win="cluster"]')).toHaveClass(/on/);
  await bar.locator('[data-menu-win="log"]').click();
  await expect(page.locator('.win[data-win="log"]')).toBeVisible();
  await bar.locator('[data-menu-win="log"]').click();
  await expect(page.locator('.win[data-win="log"]')).toBeHidden();
  // close (×) and minimize from the title bar
  await bar.locator('[data-menu-win="legend"]').click();
  await page.locator('.win[data-win="legend"] [data-win-act="close"]').click();
  await expect(page.locator('.win[data-win="legend"]')).toBeHidden();
  await expect(bar.locator('[data-menu-win="legend"]')).not.toHaveClass(/on/);
  // drag the cluster window by its title bar to the map centre
  const b0 = await box(page, "cluster");
  const title = cl.locator(".win-bar .win-title");
  const t = (await title.boundingBox())!;
  await page.mouse.move(t.x + 20, t.y + t.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + 20 - 300, t.y + t.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  const b1 = await box(page, "cluster");
  expect(Math.round(b1.x - b0.x)).toBeLessThan(-250);
  expect(Math.round(b1.y - b0.y)).toBeGreaterThan(40);
  // bring to front: the dragged window sits on top; clicking another raises it
  const z = async (id: string) => Number(await page.locator(`.win[data-win="${id}"]`).evaluate((e) => getComputedStyle(e).zIndex));
  await page.locator('.win[data-win="selected"] .win-bar .win-title').click();
  expect(await z("selected")).toBeGreaterThan(await z("cluster"));
  await cl.locator(".win-bar .win-title").click();
  expect(await z("cluster")).toBeGreaterThan(await z("selected"));
  // resize from the south-east corner → the inner width follows, and the graph redraws to fit
  const inner0 = await cl.locator(".win-body").evaluate((e) => e.clientWidth);
  const svg0 = (await cl.locator("#clusterSvg").boundingBox())!;
  const se = (await cl.locator(".win-rs-se").boundingBox())!;
  await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
  await page.mouse.down();
  await page.mouse.move(se.x + 220, se.y + 140, { steps: 8 });
  await page.mouse.up();
  const b2 = await box(page, "cluster");
  expect(b2.width - b1.width).toBeGreaterThan(180);
  const inner1 = await cl.locator(".win-body").evaluate((e) => e.clientWidth);
  expect(inner1 - inner0).toBeGreaterThan(180);
  const svg1 = (await cl.locator("#clusterSvg").boundingBox())!;
  expect(svg1.width).toBeGreaterThan(svg0.width + 150);
  await expect(cl).toHaveClass(/w-wide/);
  // resize below the minimum stops at the minimum
  const w2 = (await cl.locator(".win-rs-e").boundingBox())!;
  await page.mouse.move(w2.x + 2, w2.y + 30); await page.mouse.down(); await page.mouse.move(w2.x - 2000, w2.y + 30, { steps: 4 }); await page.mouse.up();
  expect((await box(page, "cluster")).width).toBeGreaterThanOrEqual(219);
  const e3 = (await cl.locator(".win-rs-e").boundingBox())!;
  await page.mouse.move(e3.x + 2, e3.y + 30); await page.mouse.down(); await page.mouse.move(e3.x + 380, e3.y + 30, { steps: 6 }); await page.mouse.up();
  // lineage opens too and scrolls inside its window
  await bar.locator('[data-menu-win="lineage"]').click();
  await expect(page.locator('.win[data-win="lineage"] [data-lineage-tree]')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, "floating-resized.png") });
  // window can't leave the viewport (drag far off-screen)
  const t2 = (await cl.locator(".win-bar .win-title").boundingBox())!;
  await page.mouse.move(t2.x + 10, t2.y + 5); await page.mouse.down(); await page.mouse.move(t2.x + 4000, t2.y + 4000, { steps: 5 }); await page.mouse.up();
  const b4 = await box(page, "cluster");
  expect(b4.x + b4.width).toBeLessThanOrEqual(1441); expect(b4.y + b4.height).toBeLessThanOrEqual(901);
  // browser resize re-clamps
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.waitForTimeout(300);
  const b5 = await box(page, "cluster");
  expect(b5.x + b5.width).toBeLessThanOrEqual(1101); expect(b5.y + b5.height).toBeLessThanOrEqual(761);
  // persistence across reload (layout is per browser, game restarts)
  const saved = await box(page, "cluster");
  await page.reload();
  await begin(page);
  await expect(page.locator('.win[data-win="cluster"]')).toBeVisible();
  await expect(page.locator('.win[data-win="lineage"]')).toBeVisible();
  await expect(page.locator('.win[data-win="legend"]')).toBeHidden();
  const back = await box(page, "cluster");
  expect(Math.abs(back.x - saved.x)).toBeLessThan(2); expect(Math.abs(back.width - saved.width)).toBeLessThan(2);
  expect(await z("cluster")).toBeGreaterThan(await z("selected"));
  // Reset layout → defaults (cluster closed again)
  await page.locator("[data-menu-reset]").click();
  await expect(page.locator('.win[data-win="cluster"]')).toBeHidden();
  await expect(page.locator('.win[data-win="selected"]')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  // rule off → exact docked layout
  await page.locator("#btnNew").click();
  await expect(page.locator("#setupScreen")).toBeVisible();
  await page.locator('[data-setup-tab="rules"]').click();
  await page.locator('[data-rule="floatingWindows"]').uncheck();
  await page.locator('[data-setup-tab="fervor"]').click();
  await begin(page, "7");
  await expect(page.locator("#playScreen")).not.toHaveClass(/floating/);
  await expect(page.locator("#winMenuBar")).toBeHidden();
  await expect(page.locator("#dockRight .win[data-win='selected']")).toBeVisible();
  await expect(page.locator("#tray")).toBeVisible();
  expect(await page.locator('.win[data-win="selected"]').evaluate((e) => (e as HTMLElement).style.left + (e as HTMLElement).style.width)).toBe("");
  await page.screenshot({ path: path.join(dir, "floating-off-docked.png") });
  expect(pageErrors).toEqual([]);
});
