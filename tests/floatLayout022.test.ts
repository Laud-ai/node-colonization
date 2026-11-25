// 0.22.0 floating windows: pure layout store (defaults, clamping, resize, z-order, persistence).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bringToFront, clampAll, clampRect, defaultLayout, loadLayout, resizeRect, saveLayout, topmost, FLOAT_KEY, MIN_H, MIN_W,
} from "../src/ui/floatLayout.js";

const vp = { w: 1280, h: 800, top: 90 };
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };
const ids = ["needs", "moves", "selected", "colonies", "log", "cluster"];
const sides = { needs: "left", moves: "left", selected: "right", colonies: "right", log: "right", cluster: "right" };
const open = new Set(["needs", "moves", "selected", "colonies"]);

test("0.22.0 clampRect keeps windows inside the viewport, below the menu bar, at min size", () => {
  assert.deepEqual(clampRect({ x: -50, y: 10, w: 100, h: 50 }, vp), { x: 0, y: 90, w: MIN_W, h: MIN_H });
  assert.deepEqual(clampRect({ x: 1200, y: 790, w: 400, h: 300 }, vp), { x: 880, y: 500, w: 400, h: 300 });
  const big = clampRect({ x: 0, y: 0, w: 5000, h: 5000 }, vp);
  assert.equal(big.w, 1280); assert.equal(big.h, 710); assert.equal(big.y, 90);
});

test("0.22.0 resizeRect from edges and corners honours min size and the viewport", () => {
  const r = { x: 100, y: 200, w: 300, h: 300 };
  assert.deepEqual(resizeRect(r, "se", 50, 40, vp), { x: 100, y: 200, w: 350, h: 340 });
  assert.deepEqual(resizeRect(r, "w", -40, 0, vp), { x: 60, y: 200, w: 340, h: 300 });
  assert.deepEqual(resizeRect(r, "w", 200, 0, vp), { x: 100 + 300 - MIN_W, y: 200, w: MIN_W, h: 300 }, "west edge stops at min width");
  assert.deepEqual(resizeRect(r, "n", 0, -500, vp), { x: 100, y: 90, w: 300, h: 410 }, "north edge stops at the menu bar");
  assert.deepEqual(resizeRect(r, "e", 5000, 0, vp).w, 1180, "east edge stops at the viewport");
});

test("0.22.0 default layout: two edge columns, open windows don't cover the map centre", () => {
  const L = defaultLayout(ids, sides, open, vp);
  const cx = vp.w / 2, cy = (vp.h + vp.top) / 2;
  for (const id of ids) {
    const w = L[id]!;
    assert.deepEqual({ x: w.x, y: w.y, w: w.w, h: w.h }, clampRect(w, vp), `${id} inside viewport`);
    if (w.state === "open") assert.ok(!(cx > w.x && cx < w.x + w.w && cy > w.y && cy < w.y + w.h), `${id} covers centre`);
  }
  assert.equal(L.needs!.state, "open"); assert.equal(L.log!.state, "closed");
  assert.ok(L.needs!.x < cx && L.selected!.x > cx);
  assert.ok(L.moves!.y + L.moves!.h <= L.needs!.y || L.needs!.y + L.needs!.h <= L.moves!.y, "left column stacks without overlap");
});

test("0.22.0 persistence: save → load round-trips, bad / missing values fall back, re-clamped to a smaller screen", () => {
  const s = mem();
  const L = defaultLayout(ids, sides, open, vp);
  L.cluster = { x: 900, y: 300, w: 360, h: 380, state: "open", z: 3 };
  saveLayout(s, L);
  assert.ok(s.m.has(FLOAT_KEY));
  const back = loadLayout(s, defaultLayout(ids, sides, open, vp), vp);
  assert.deepEqual(back.cluster && { ...back.cluster, z: 0 }, { x: 900, y: 300, w: 360, h: 380, state: "open", z: 0 });
  s.setItem(FLOAT_KEY, JSON.stringify({ log: { x: "bad", state: "weird", w: 300 }, ghost: { x: 1 } }));
  const fb = loadLayout(s, defaultLayout(ids, sides, open, vp), vp);
  assert.equal(fb.log!.state, "closed"); assert.equal(fb.log!.w, 300); assert.ok(!("ghost" in fb));
  s.setItem(FLOAT_KEY, "{not json");
  assert.deepEqual(Object.keys(loadLayout(s, L, vp)).sort(), [...ids].sort());
  const small = clampAll(back, { w: 800, h: 600, top: 90 });
  for (const w of Object.values(small)) assert.ok(w.x + w.w <= 800 && w.y + w.h <= 600 && w.y >= 90);
});

test("0.22.0 z-order: bring to front, normalized 1..n, topmost ignores closed", () => {
  const L = defaultLayout(ids, sides, open, vp);
  bringToFront(L, "needs");
  assert.equal(L.needs!.z, ids.length);
  assert.deepEqual(Object.values(L).map((w) => w.z).sort((a, b) => a - b), ids.map((_, i) => i + 1));
  assert.equal(topmost(L), "needs");
  L.needs!.state = "closed";
  assert.notEqual(topmost(L), "needs");
});
