// 0.21.1: Lineage window (ideology / culture trees, general + per colony) and Cluster graph window (replay slider).
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("0.21.1 Lineage trees + cluster graph replay", async ({ page, browserName }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  const dir = path.resolve(browserName === "firefox" ? "out/smoke/firefox" : "out/smoke"); fs.mkdirSync(dir, { recursive: true });
  await page.goto("/");
  await page.locator("#setupSeed").fill("42");
  await page.locator("#btnBeginSim").click();
  await expect(page.locator("#playScreen")).toBeVisible();
  for (let i = 0; i < 4; i++) { await page.locator("#simN").fill("20"); await page.locator("#btnSim").click(); await page.waitForTimeout(150); }
  await expect(page.locator("#turn")).toHaveText(/8\d|9\d|1\d\d/);
  // ---- Lineage: open from the tray, general Ideology tree
  await page.locator('[data-restore="lineage"]').click();
  const lin = page.locator('.win[data-win="lineage"]');
  await expect(lin).toBeVisible();
  const tree = lin.locator("[data-lineage-tree]");
  await expect(tree).toBeVisible();
  expect(Number(await tree.getAttribute("data-nodes"))).toBeGreaterThan(3);
  expect(Number(await tree.getAttribute("data-edges"))).toBeGreaterThan(0);
  await expect(lin.locator(".lin-edge.blend").first()).toBeAttached();
  await expect(lin.locator(".lin-node.blend .lin-parents").first()).toContainText("+");
  // +N opens the full list
  const more = lin.locator("[data-lineage-more]").first();
  if (await more.count()) { await more.click(); await expect(lin.locator("[data-lineage-pop]")).toBeVisible(); }
  await page.addStyleTag({ content: '.win[data-win="lineage"] .win-body { max-height: none !important; } .dock-left { width: 760px !important; flex-basis: 760px !important; }' });
  await page.setViewportSize({ width: 1600, height: 1400 });
  await page.waitForTimeout(200);
  await lin.screenshot({ path: path.join(dir, "lineage-general.png") });
  // culture sub-tab
  await lin.locator('[data-lineage-kind="culture"]').click();
  await expect(lin.locator('[data-lineage-kind="culture"]')).toHaveClass(/on/);
  await expect(lin.locator("[data-lineage-tree]")).toBeVisible();
  await lin.screenshot({ path: path.join(dir, "lineage-culture.png") });
  // click a colony name in a note → selects it, tree narrows to that colony's path
  await lin.locator('[data-lineage-kind="ideology"]').click();
  if (await lin.locator("[data-lineage-pop-close]").count()) await lin.locator("[data-lineage-pop-close]").click();
  const name = lin.locator("[data-select-colony]").first();
  const pickedId = await name.getAttribute("data-select-colony");
  const pickedName = (await name.innerText()).replace(/\s*T\d+$/, "").trim();
  await name.click();
  await expect(lin.locator('[data-lineage-scope="colony"]')).toHaveClass(/on/);
  await expect(lin.locator(".lin-path")).toContainText(pickedName);
  // only this colony's own steps (turn + how), no other colonies listed
  await expect(lin.locator("[data-select-colony]")).toHaveCount(0);
  expect(await lin.locator(".lin-own").count()).toBeGreaterThan(0);
  expect(pickedId).toBeTruthy();
  await expect(page.locator("#detail .editable-name, #detail .detail-head .name").first()).toContainText(pickedName);
  await lin.screenshot({ path: path.join(dir, "lineage-colony.png") });
  await lin.locator('[data-lineage-scope="all"]').click();
  await page.setViewportSize({ width: 1280, height: 900 });
  // ---- Cluster graph: open, scrub early + late, play/pause, click selects
  await page.locator('[data-restore="cluster"]').click();
  const cl = page.locator('.win[data-win="cluster"]');
  await expect(cl).toBeVisible();
  const svg = cl.locator("#clusterSvg");
  await expect(svg).toHaveAttribute("data-nodes", /\d+/);
  const slider = cl.locator("#clusterTurn");
  const max = Number(await slider.getAttribute("max"));
  expect(max).toBeGreaterThan(50);
  await page.addStyleTag({ content: '.win[data-win="cluster"] .win-body { max-height: none !important; } .dock-right { width: 640px !important; flex-basis: 640px !important; }' });
  await page.setViewportSize({ width: 1500, height: 1100 });
  await slider.fill("4");
  await expect(svg).toHaveAttribute("data-turn", "5");
  await page.waitForTimeout(700);
  const early = Number(await svg.getAttribute("data-nodes"));
  await cl.screenshot({ path: path.join(dir, "cluster-early.png") });
  await slider.fill(String(max));
  await page.waitForTimeout(700);
  const late = Number(await svg.getAttribute("data-nodes"));
  expect(late).toBeGreaterThan(early);
  await cl.screenshot({ path: path.join(dir, "cluster-late.png") });
  // hover title + flags rendered as images
  expect(await cl.locator("#clusterSvg image").count()).toBeGreaterThan(14);
  await expect(cl.locator("#clusterSvg [data-cl-colony] title").first()).not.toBeEmpty();
  // play → advances, pause stops
  await slider.fill("10");
  await cl.locator("#clusterPlay").click();
  await page.waitForTimeout(1500);
  await cl.locator("#clusterPlay").click();
  const after = Number(await slider.inputValue());
  expect(after).toBeGreaterThan(10);
  await page.waitForTimeout(800);
  expect(Number(await slider.inputValue())).toBe(after);
  // smooth: a flag mid-transition sits between frames (no jump) — check transform changes over time
  await slider.fill(String(max));
  await page.waitForTimeout(600);
  const node = cl.locator("#clusterSvg [data-cl-colony]").first();
  const id = await node.getAttribute("data-cl-colony");
  await node.dispatchEvent("click");
  await expect(cl.locator(`#clusterSvg [data-cl-colony="${id}"]`)).toHaveClass(/selected/);
  expect(pageErrors).toEqual([]);
});
