// 0.20.0: asteroid belt view (ring of named rocks, Ceres/Vesta textured), map legend window, grouped route labels.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("0.20.0 belt view + legend + late-game routes", async ({ page, browserName }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  const dir = path.resolve(browserName === "firefox" ? "out/smoke/firefox" : "out/smoke"); fs.mkdirSync(dir, { recursive: true });
  await page.goto("/");
  await page.locator("#setupSeed").fill("5");
  await page.locator("#btnBeginSim").click();
  await expect(page.locator("#playScreen")).toBeVisible();
  // legend window (opened from the globe bar)
  await page.locator("#btnLegend").click();
  const legend = page.locator('.win[data-win="legend"]');
  await expect(legend).toBeVisible();
  await expect(legend.locator(".legend-row")).toHaveCount(18);
  await page.addStyleTag({ content: '.win[data-win="legend"] .win-body { max-height: none !important; }' });
  await page.setViewportSize({ width: 1280, height: 1500 });
  await page.waitForTimeout(200);
  await legend.screenshot({ path: path.join(dir, "legend.png") });
  await page.setViewportSize({ width: 1280, height: 720 });
  // belt view loads (12 rocks, both Dawn textures) even before anyone lives there
  await page.locator('[data-globe-mode="belt"]').click();
  await expect(page.locator("#globeBelt")).toHaveAttribute("data-rocks", "12");
  await expect(page.locator("#globeBelt")).toHaveAttribute("data-texture", "loaded");
  let belt = 0;
  for (let t = 0; t < 100 && belt === 0; t += 5) {
    await page.locator("#simN").fill("5");
    await page.locator("#btnSim").click();
    await page.waitForTimeout(120);
    belt = Number(await page.locator("#globeBelt").getAttribute("data-markers") ?? 0);
  }
  const turn = await page.locator("#turn").innerText();
  console.log(`0.20.0 belt colonies on screen: ${belt} at turn ${turn}`);
  await page.locator("#globeBelt canvas").hover({ position: { x: 4, y: 4 } });
  await page.waitForTimeout(600);
  await page.locator("#globeCard").screenshot({ path: path.join(dir, "belt-view.png") });
  // all three bodies side by side
  await page.locator('[data-globe-mode="both"]').click();
  await page.waitForTimeout(500);
  await page.locator("#globeCard").screenshot({ path: path.join(dir, "belt-three-panels.png") });
  const markers = ["#globeMoon", "#globeMars", "#globeBelt"];
  let total = 0;
  for (const g of markers) total += Number(await page.locator(g).getAttribute("data-markers") ?? 0);
  expect(total).toBe(await page.locator("#colonies .colony").count());
  // focus a belt colony from the list → belt camera orbits its rock
  if (belt > 0) {
    await page.locator('[data-globe-mode="belt"]').click();
    await page.waitForTimeout(300);
    const bm = page.locator('#colonies .colony', { hasText: /Belt/ }).first();
    if (await bm.count()) { await bm.click(); await page.waitForTimeout(700); }
    await page.locator("#globeCard").screenshot({ path: path.join(dir, "belt-closeup.png") });
    await page.locator('[data-globe-mode="both"]').click();
  }
  // late game: grouped route labels on Mars
  await page.locator("#simN").fill("30");
  await page.locator("#btnSim").click();
  await page.waitForTimeout(800);
  await page.locator('[data-globe-mode="mars"]').click();
  await page.waitForTimeout(600);
  await page.locator("#globeCard").screenshot({ path: path.join(dir, "routes-late-game-mars.png") });
  await page.locator('[data-globe-mode="moon"]').click();
  await page.waitForTimeout(600);
  await page.locator("#globeCard").screenshot({ path: path.join(dir, "routes-late-game-moon.png") });
  const ga = async (g: string, a: string) => page.locator(g).getAttribute(a);
  console.log(`0.20.0 late-game routes after grouping — Moon ${await ga("#globeMoon", "data-routes")} (${await ga("#globeMoon", "data-grouped-routes")} grouped), Mars ${await ga("#globeMars", "data-routes")} (${await ga("#globeMars", "data-grouped-routes")} grouped)`);
  for (const g of markers) expect(Number(await page.locator(g).getAttribute("data-route-flags-failed") ?? 0)).toBe(0);
  expect(pageErrors).toEqual([]);
});
