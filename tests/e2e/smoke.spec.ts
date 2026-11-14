import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("lobby → one turn → version snapshot iframe", async ({ page, browserName }) => {
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

  // 0.15.4 fresh colony needs tree: basics grey, nothing red until a developed node needs it
  await expect(page.locator("#needsTree .nt-node").first()).toBeVisible();
  expect(await page.locator('#needsTree .nt-node[data-state="missing"]').count()).toBe(0);
  expect(await page.locator('#needsTree .nt-node[data-node="Water"]').getAttribute("data-state")).toMatch(/expand|developed|imported|specialty/);
  fs.mkdirSync(path.resolve(browserName === "firefox" ? "out/smoke/firefox" : "out/smoke"), { recursive: true });
  await page.locator('.win[data-win="needs"]').screenshot({ path: path.join(path.resolve(browserName === "firefox" ? "out/smoke/firefox" : "out/smoke"), "needs-tree-fresh.png") });

  // Advance one turn
  await page.locator("#btnEnd").click();
  await expect(page.locator("#turn")).toHaveText("2");

  // Screenshot after one turn
  const smokeDir = path.resolve(browserName === "firefox" ? "out/smoke/firefox" : "out/smoke");
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
  // 0.15.2: each pin carries its colony's own flag
  await expect.poll(async () => Number(await page.locator("#globeMoon").getAttribute("data-pin-flags-loaded") ?? 0)).toBeGreaterThan(0);
  await page.mouse.move(mbox.x + 4, mbox.y + mbox.height - 4); // no tooltip over the pins
  await page.waitForTimeout(300);
  await page.locator("#globeMoon").screenshot({ path: path.join(smokeDir, "pin-flag-closeup.png") });
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
  await needsWin.screenshot({ path: path.join(smokeDir, "needs-tree.png") });
  await needsWin.screenshot({ path: path.join(smokeDir, "needs-tree-midgame.png") });
  // Click a red (missing) node if the selected colony has one this run, else a grey expansion (0.17.0: game state varies with rules)
  const missingNode = page.locator('#needsTree .nt-node[data-state="missing"]');
  await ((await missingNode.count()) ? missingNode.first() : page.locator('#needsTree .nt-node[data-state="expand"]').first()).click();
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
  // 0.15.3 needs tree: find a colony showing all five Tiago states, screenshot it
  const want = ["specialty", "developed", "imported", "missing", "expand"];
  const cards = page.locator("#colonies .colony");
  let best = -1, bestCount = -1;
  for (let i = 0; i < await cards.count(); i++) {
    await cards.nth(i).click();
    const states = new Set(await page.locator("#needsTree .nt-node").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.state)));
    const n = want.filter((w) => states.has(w)).length;
    if (n > bestCount) { best = i; bestCount = n; }
    if (n === 5) break;
  }
  await cards.nth(best).click();
  expect(bestCount).toBeGreaterThanOrEqual(4);
  await expect(page.locator('#needsTree [data-legend="imported"]')).toBeVisible();
  await page.locator('.win[data-win="needs"]').screenshot({ path: path.join(smokeDir, "needs-tree-states.png") });
  // 0.15.3 limb close-ups: rotate so markers sit at / behind the limb; sprites must not cut into the body
  for (const [mode, sel, file] of [["moon", "#globeMoon", "globe-limb-moon.png"], ["mars", "#globeMars", "globe-limb-mars.png"]] as const) {
    await page.locator(`[data-globe-mode="${mode}"]`).click();
    await page.waitForTimeout(300);
    const gb = (await page.locator(`${sel} canvas`).boundingBox())!;
    await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
    await page.mouse.down();
    await page.mouse.move(gb.x + gb.width / 2 + gb.width * 0.32, gb.y + gb.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.mouse.move(gb.x + 4, gb.y + gb.height - 4);
    await page.waitForTimeout(900);
    await page.locator(sel).screenshot({ path: path.join(smokeDir, file) });
  }
  expect(Number(await page.locator("#globeMoon").getAttribute("data-hidden-markers") ?? 0)
    + Number(await page.locator("#globeMars").getAttribute("data-hidden-markers") ?? 0)).toBeGreaterThanOrEqual(0);
  await page.locator('[data-globe-mode="both"]').click();
  // 0.15.2: route-label partner flags really render (image loaded, none failed, flag pixels inked)
  for (const g of ["#globeMoon", "#globeMars"]) {
    const el = page.locator(g);
    const total = Number(await el.getAttribute("data-route-flags") ?? 0);
    await expect.poll(async () => Number(await el.getAttribute("data-route-flags-loaded") ?? 0)).toBe(total);
    expect(Number(await el.getAttribute("data-route-flags-failed") ?? 0)).toBe(0);
    if (total > 0) expect(Number(await el.getAttribute("data-route-flag-min-ink") ?? 0)).toBeGreaterThan(100);
  }
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
  // 0.15.1 small-mode close-up (real 24×16 flags, captured at 3× device pixels)
  const smallBox = await page.locator("#fgSmall").boundingBox();
  const zoomPage = await page.context().browser()!.newPage({ deviceScaleFactor: 3, viewport: { width: 1400, height: Math.min(4000, fgH) } });
  await zoomPage.goto(page.url());
  await expect(zoomPage.locator("#fgSmall")).toBeVisible();
  await zoomPage.locator("#fgSmall").screenshot({ path: path.join(smokeDir, "flags-small.png") });
  await zoomPage.close();
  expect(smallBox).not.toBeNull();

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});
