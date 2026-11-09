import { test } from "node:test";
import assert from "node:assert/strict";
import { SiteBook, angularDistance, MIN_SPACING_DEG } from "../src/ui/colonySites.js";
import { drawHudIcon, clampLevel, ringFills } from "../src/ui/hudIcon.js";

test("0.13.0 globe sites are deterministic, stable and spaced", () => {
  const cols = Array.from({ length: 12 }, (_, i) => ({ id: `c${i + 1}`, body: (i % 3 ? "Moon" : "Mars") as "Moon" | "Mars" }));
  const a = new SiteBook(42), b = new SiteBook(42);
  const early = a.place(cols.slice(0, 5));
  const all = a.place(cols);
  const once = b.place(cols);
  for (const c of cols.slice(0, 5)) assert.deepEqual(all.get(c.id), early.get(c.id));
  for (const c of cols) assert.deepEqual(all.get(c.id), once.get(c.id));
  const moon = cols.filter((c) => c.body === "Moon").map((c) => all.get(c.id)!);
  for (let i = 0; i < moon.length; i++) for (let j = i + 1; j < moon.length; j++)
    assert.ok(angularDistance(moon[i]!, moon[j]!) >= MIN_SPACING_DEG);
  assert.notDeepEqual(new SiteBook(7).place(cols).get("c2"), all.get("c2"));
});

test("0.13.0 HUD glyph scheme (Sep 1 globe) is reused", () => {
  assert.equal(clampLevel(0), 1);
  assert.deepEqual(ringFills(9), []);
  assert.deepEqual(ringFills(10), [false]);
  assert.deepEqual(ringFills(11), [true]);
  assert.deepEqual(ringFills(12), [true, false]);
  assert.equal(typeof drawHudIcon, "function");
});

test("0.13.1 pin helpers: tiers, fervor colors, halo for dark colors", async () => {
  const { stemHeight, fervorColor, haloFor, SPECIALTY_CODE } = await import("../src/ui/pinIcon.js");
  assert.ok(stemHeight(1) < stemHeight(5) && stemHeight(5) < stemHeight(10));
  assert.equal(stemHeight(4), stemHeight(1));
  assert.equal(stemHeight(9), stemHeight(5));
  assert.equal(fervorColor(0.1), "#22c55e");
  assert.equal(fervorColor(0.6), "#f59e0b");
  assert.equal(fervorColor(0.9), "#ef4444");
  assert.equal(haloFor("#1d2a33"), "#f1f5f9");
  assert.equal(haloFor("#e8e4d8"), "#0b1020");
  assert.equal(SPECIALTY_CODE.Water, "H₂O");
});

test("0.15.1 fervor non-colour cue: 1/2/3 lit segments + dashed ring when critical", async () => {
  const { fervorCue } = await import("../src/ui/pinIcon.js");
  assert.deepEqual(fervorCue(0), { segments: 0, critical: false });
  assert.deepEqual(fervorCue(0.2), { segments: 1, critical: false });
  assert.deepEqual(fervorCue(0.6), { segments: 2, critical: false });
  assert.deepEqual(fervorCue(0.85), { segments: 3, critical: false });
  assert.deepEqual(fervorCue(0.95), { segments: 3, critical: true });
  assert.deepEqual(fervorCue(2), { segments: 3, critical: true });
});
