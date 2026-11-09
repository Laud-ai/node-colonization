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
