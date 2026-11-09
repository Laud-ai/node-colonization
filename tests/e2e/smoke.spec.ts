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

  // 0.13.0 globes: canvases render, textures load, markers appear after a few turns
  await expect(page.locator("#globeMoon canvas.globe-canvas")).toBeVisible();
  await expect(page.locator("#globeMars canvas.globe-canvas")).toBeVisible();
  await expect(page.locator("#globeMoon")).toHaveAttribute("data-texture", "loaded", { timeout: 20_000 });
  await expect(page.locator("#globeMars")).toHaveAttribute("data-texture", "loaded", { timeout: 20_000 });
  await page.locator("#simN").fill("18");
  await page.locator("#btnSim").click();
  await expect(page.locator("#turn")).toHaveText("20");
  await expect.poll(async () => {
    const m = Number(await page.locator("#globeMoon").getAttribute("data-markers"));
    const r = Number(await page.locator("#globeMars").getAttribute("data-markers"));
    return m + r;
  }).toBeGreaterThan(0);
  const coloniesShown = await page.locator("#colonies .colony").count();
  const markers = Number(await page.locator("#globeMoon").getAttribute("data-markers"))
    + Number(await page.locator("#globeMars").getAttribute("data-markers"));
  expect(markers).toBe(coloniesShown);
  await page.addStyleTag({ content: "header { position: static !important; }" });
  await page.waitForTimeout(500);
  await page.locator("#globeCard").screenshot({ path: path.join(smokeDir, "globes.png") });
  await page.locator('[data-globe-mode="moon"]').click();
  await page.waitForTimeout(400);
  await page.locator("#globeCard").screenshot({ path: path.join(smokeDir, "globe-moon.png") });
  await page.locator('[data-globe-mode="mars"]').click();
  await page.waitForTimeout(400);
  await page.locator("#globeCard").screenshot({ path: path.join(smokeDir, "globe-mars.png") });
  await page.locator('[data-globe-mode="both"]').click();

  // 0.13.1 pins are the default marker style; glyphs stay selectable
  await expect(page.locator('[data-marker-style="pin"]')).toHaveClass(/selected/);
  await page.locator('[data-globe-mode="moon"]').click();
  const mbox = (await page.locator("#globeMoon canvas").boundingBox())!;
  await page.mouse.move(mbox.x + mbox.width / 2, mbox.y + mbox.height / 2);
  for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(80); }
  await page.waitForTimeout(500);
  await page.locator("#globeMoon").screenshot({ path: path.join(smokeDir, "pins-closeup.png") });
  await page.locator('[data-marker-style="glyph"]').click();
  await expect(page.locator('[data-marker-style="glyph"]')).toHaveClass(/selected/);
  await page.waitForTimeout(300);
  await page.locator("#globeMoon").screenshot({ path: path.join(smokeDir, "glyphs-closeup.png") });
  expect(Number(await page.locator("#globeMoon").getAttribute("data-markers"))).toBeGreaterThanOrEqual(0);
  await page.locator('[data-marker-style="pin"]').click();
  await page.locator('[data-globe-mode="both"]').click();

  // 0.14.0 map-first: needs tree → supplier menu, minimize/restore a window
  const needsWin = page.locator('.win[data-win="needs"]');
  await expect(needsWin).toBeVisible();
  await expect(page.locator("#needsTree svg .nt-node").first()).toBeVisible();
  expect(await page.locator("#needsTree .nt-node").count()).toBe(19);
  await expect(page.locator('#needsTree .nt-node[data-state="missing"]').first()).toBeVisible();
  await needsWin.screenshot({ path: path.join(smokeDir, "needs-tree.png") });
  await page.locator('#needsTree .nt-node[data-state="missing"]').first().click();
  const supWin = page.locator('.win[data-win="suppliers"]');
  await expect(supWin).toBeVisible();
  await expect(page.locator("#suppliers .sup-head")).toContainText("choices");
  await page.locator('#suppliers button[data-sup-node=""]').click();
  await expect(page.locator("#suppliers .sup-head")).toContainText("All needs");
  await supWin.screenshot({ path: path.join(smokeDir, "suppliers.png") });
  await needsWin.locator('[data-win-act="min"]').click();
  await expect(needsWin).toBeHidden();
  await page.locator('#tray [data-restore="needs"]').click();
  await expect(needsWin).toBeVisible();
  await page.screenshot({ path: path.join(smokeDir, "map-first.png") });

  // 0.14.1 trade routes layer renders and toggles
  await expect(page.locator("#globeMoon")).toHaveAttribute("data-routes", /\d+/);
  const routeCount = Number(await page.locator("#globeMoon").getAttribute("data-routes"))
    + Number(await page.locator("#globeMars").getAttribute("data-routes"));
  expect(routeCount).toBeGreaterThanOrEqual(0);
  await expect(page.locator("#btnRoutes")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#btnRoutes").click();
  await expect(page.locator("#btnRoutes")).toHaveAttribute("aria-pressed", "false");
  await page.locator("#btnRoutes").click();
  await expect(page.locator("#btnRoutes")).toHaveAttribute("aria-pressed", "true");
  // Late game (more colonies + routes) with the map-first layout
  await page.locator("#simN").fill("60");
  await page.locator("#btnSim").click();
  await expect(page.locator("#turn")).toHaveText("80");
  await expect.poll(async () => Number(await page.locator("#globeMoon").getAttribute("data-routes"))
    + Number(await page.locator("#globeMars").getAttribute("data-routes"))).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(smokeDir, "routes-late-game.png") });
  // 0.15.0: vexillological flags on colony cards and the map strip
  expect(await page.locator("#colonies svg.flag").count()).toBeGreaterThan(0);
  if (await page.locator("#solarMapCard").isVisible()) expect(await page.locator("#solarMap svg.flag").count()).toBeGreaterThan(0);

  // Back to lobby for version picker
  await page.locator("#btnNew").click();
  await expect(page.locator("#setupScreen")).toBeVisible();

  await page.locator('[data-setup-tab="versions"]').click();
  await expect(page.locator("#setupTabVersions")).toBeVisible();

  const versionBtns = page.locator("#versionList button.variant-btn:not([disabled])");
  await expect(versionBtns.first()).toBeVisible({ timeout: 10_000 });
  const count = await versionBtns.count();
  expect(count).toBeGreaterThanOrEqual(2);

  // Prefer an older snapshot (not the live build) if present
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

  // Previous release (0.12.0) still loads as a frozen snapshot
  await page.locator("#snapshotBack").click();
  await expect(overlay).toBeHidden();
  const prev = page.locator('#versionList button.variant-btn:not([disabled])[data-ver="0.12.0"]');
  await expect(prev).toBeVisible();
  await prev.click();
  await expect(overlay).toBeVisible();
  await expect(frame.locator("#setupScreen")).toBeVisible({ timeout: 15_000 });

  // 0.15.0 dev flag gallery (?flags) — ~50 samples + independence before/after
  await page.goto("?flags");
  await expect(page.locator("#flagGallery")).toBeVisible();
  expect(await page.locator("#flagGallery .fg-tile").count()).toBeGreaterThanOrEqual(40);
  const fgH = await page.locator("#flagGallery").evaluate((el) => el.scrollHeight);
  await page.setViewportSize({ width: 1400, height: Math.min(4000, fgH) });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(smokeDir, "flags-gallery.png") });

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
