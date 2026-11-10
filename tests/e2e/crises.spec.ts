// 0.19.0: screenshot a nomad camp and an oxygen war if they occur (seed 42, up to T120). Never fails on absence.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("0.19.0 crises: nomad camp + oxygen war screenshots", async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  const dir = path.resolve("out/smoke"); fs.mkdirSync(dir, { recursive: true });
  await page.goto("/");
  await page.locator("#setupSeed").fill("42");
  await page.locator("#btnBeginSim").click();
  await expect(page.locator("#playScreen")).toBeVisible();
  const found = { camp: false, war: false };
  const scan = async () => {
    const cs = page.locator("#colonies .colony");
    for (let i = 0; i < await cs.count() && !(found.camp && found.war); i++) {
      await cs.nth(i).click();
      const crises = page.locator("#detail [data-crises]"), o2 = page.locator("#detail [data-o2-crisis]");
      const txt = ((await crises.count()) ? await crises.innerText() : "") + ((await o2.count()) ? await o2.innerText() : "");
      if (!found.camp && /Nomad camp since/.test(txt)) {
        found.camp = true;
        await page.locator("#detail").screenshot({ path: path.join(dir, "nomad-camp-detail.png") });
        await page.screenshot({ path: path.join(dir, "nomad-camp.png") });
      }
      if (!found.war && /Casus belli|Crisis actions|hoarder/i.test(txt)) {
        found.war = true;
        await page.locator("#detail").screenshot({ path: path.join(dir, "oxygen-war-detail.png") });
        await page.screenshot({ path: path.join(dir, "oxygen-war.png") });
      }
    }
  };
  for (let turn = 1; turn < 120 && !(found.camp && found.war); turn += 3) {
    await page.locator("#simN").fill("3");
    await page.locator("#btnSim").click();
    await page.waitForTimeout(150);
    const log = await page.locator("#log").innerText();
    if ((!found.camp && /NOMAD CAMP|RAID/.test(log)) || (!found.war && /PLEA REFUSED|SEIZ|HOARDER|Justified war/.test(log))) await scan();
  }
  console.log(`0.19.0 screenshots: camp ${found.camp} · oxygen war ${found.war} · at turn ${await page.locator("#turn").innerText()}`);
  expect(pageErrors).toEqual([]);
});
