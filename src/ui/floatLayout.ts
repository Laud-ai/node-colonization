/**
 * 0.22.0 Floating windows — pure layout store (no DOM): defaults, clamping, z-order, persistence.
 * Used by windows.ts when the `floatingWindows` rule is on.
 */
export type FloatState = "open" | "min" | "closed";
export interface FloatRect { x: number; y: number; w: number; h: number }
export interface FloatWin extends FloatRect { state: FloatState; z: number }
export type FloatLayout = Record<string, FloatWin>;
export interface Viewport { w: number; h: number; top: number }
export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }

export const FLOAT_KEY = "nc.float.v1";
export const MIN_W = 220, MIN_H = 120, BAR_H = 30;

/** Keep a window inside the viewport (below the menu bar), at least MIN size, never larger than the viewport. */
export function clampRect(r: FloatRect, vp: Viewport, minW = MIN_W, minH = MIN_H): FloatRect {
  const availH = Math.max(minH, vp.h - vp.top);
  const w = Math.round(Math.min(Math.max(r.w, minW), Math.max(minW, vp.w)));
  const h = Math.round(Math.min(Math.max(r.h, minH), availH));
  const x = Math.round(Math.min(Math.max(r.x, 0), Math.max(0, vp.w - w)));
  const y = Math.round(Math.min(Math.max(r.y, vp.top), Math.max(vp.top, vp.h - h)));
  return { x, y, w, h };
}

/** Resize from an edge / corner ("n","s","e","w","ne","nw","se","sw") by (dx, dy), honouring min size + viewport. */
export function resizeRect(r: FloatRect, dir: string, dx: number, dy: number, vp: Viewport, minW = MIN_W, minH = MIN_H): FloatRect {
  let { x, y, w, h } = r;
  if (dir.includes("e")) w = Math.min(Math.max(minW, w + dx), vp.w - x);
  if (dir.includes("s")) h = Math.min(Math.max(minH, h + dy), vp.h - y);
  if (dir.includes("w")) { const nx = Math.min(Math.max(0, x + dx), x + w - minW); w += x - nx; x = nx; }
  if (dir.includes("n")) { const ny = Math.min(Math.max(vp.top, y + dy), y + h - minH); h += y - ny; y = ny; }
  return clampRect({ x, y, w, h }, vp, minW, minH);
}

/**
 * First-load layout: two columns hugging the left and right edges, the map centre free.
 * `sides[id]` = "left" | "right" (the 0.14 dock side); `open` = windows open at start.
 */
export function defaultLayout(ids: string[], sides: Record<string, string>, open: Set<string>, vp: Viewport): FloatLayout {
  const out: FloatLayout = {};
  const colW = Math.max(MIN_W, Math.min(360, Math.floor(vp.w * 0.26)));
  const avail = Math.max(MIN_H * 2, vp.h - vp.top - 16);
  for (const side of ["left", "right"]) {
    const col = ids.filter((id) => (sides[id] || "left") === side);
    const shown = col.filter((id) => open.has(id));
    const each = Math.max(MIN_H, Math.floor(avail / Math.max(1, shown.length)) - 8);
    let y = vp.top + 8, k = 0;
    for (const id of col) {
      const x = side === "left" ? 8 : vp.w - colW - 8;
      if (open.has(id)) { out[id] = { x, y, w: colW, h: each, state: "open", z: 0 }; y += each + 8; }
      else { const off = 24 * (k++ % 6); out[id] = { x: side === "left" ? x + off : x - off, y: vp.top + 40 + off, w: colW, h: Math.min(420, avail), state: "closed", z: 0 }; }
      out[id] = { ...out[id]!, ...clampRect(out[id]!, vp) };
    }
  }
  ids.forEach((id, i) => { out[id]!.z = i + 1; });
  return out;
}

/** Stored layout merged over defaults (unknown ids dropped, missing ids from defaults), then clamped. */
export function loadLayout(storage: StorageLike | null, defaults: FloatLayout, vp: Viewport): FloatLayout {
  let stored: Record<string, Partial<FloatWin>> = {};
  try { stored = JSON.parse(storage?.getItem(FLOAT_KEY) || "{}") ?? {}; } catch { stored = {}; }
  const out: FloatLayout = {};
  for (const [id, d] of Object.entries(defaults)) {
    const s = stored[id] || {};
    const num = (v: unknown, f: number) => (typeof v === "number" && Number.isFinite(v) ? v : f);
    const state: FloatState = s.state === "open" || s.state === "min" || s.state === "closed" ? s.state : d.state;
    const r = clampRect({ x: num(s.x, d.x), y: num(s.y, d.y), w: num(s.w, d.w), h: num(s.h, d.h) }, vp);
    out[id] = { ...r, state, z: num(s.z, d.z) };
  }
  return normalizeZ(out);
}
export function saveLayout(storage: StorageLike | null, L: FloatLayout): void {
  try { storage?.setItem(FLOAT_KEY, JSON.stringify(L)); } catch { /* private mode */ }
}
export function clampAll(L: FloatLayout, vp: Viewport): FloatLayout {
  const out: FloatLayout = {};
  for (const [id, w] of Object.entries(L)) out[id] = { ...w, ...clampRect(w, vp) };
  return out;
}
/** z = 1..n in current order (stable). */
export function normalizeZ(L: FloatLayout): FloatLayout {
  const ids = Object.keys(L).sort((a, b) => L[a]!.z - L[b]!.z || a.localeCompare(b));
  ids.forEach((id, i) => { L[id]!.z = i + 1; });
  return L;
}
export function bringToFront(L: FloatLayout, id: string): FloatLayout {
  if (!L[id]) return L;
  L[id]!.z = Math.max(0, ...Object.values(L).map((w) => w.z)) + 1;
  return normalizeZ(L);
}
export function topmost(L: FloatLayout): string | null {
  let best: string | null = null;
  for (const [id, w] of Object.entries(L)) if (w.state !== "closed" && (!best || w.z > L[best]!.z)) best = id;
  return best;
}
