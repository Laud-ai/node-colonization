/**
 * 0.14.0 — Map-first side windows: dock left/right, minimize to tray, close/reopen
 * from the Windows menu. Layout remembered in localStorage.
 */
import {
  bringToFront, clampAll, defaultLayout, loadLayout, resizeRect, saveLayout, clampRect,   type FloatLayout, type Viewport,
} from "./floatLayout.js";

type Side = "left" | "right";
type WinState = "open" | "min" | "closed";
interface WinLayout { side: Side; state: WinState; order: number }

const KEY = "nc.layout.v1";
const DEFAULT_STATE: Record<string, WinState> = {
  needs: "open", suppliers: "min", moves: "open", blocs: "min", independents: "min", game: "min",
  selected: "open", colonies: "open", log: "min", map: "min", legend: "min", lineage: "min", cluster: "min",
};

let layout: Record<string, WinLayout> = {};
let wins: HTMLElement[] = [];
let onChange: () => void = () => {};
/** 0.21.1 windows switched off by a rule: kept in the store, left out of the tray and the Windows menu. */
const unavailable = new Set<string>();
export function setAvailable(id: string, on: boolean): void {
  if (on === !unavailable.has(id)) return;
  if (on) unavailable.delete(id); else unavailable.add(id);
  if (wins.length) apply();
}

function save(): void {
  try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch { /* private mode */ }
}
function defaults(): Record<string, WinLayout> {
  const out: Record<string, WinLayout> = {};
  wins.forEach((w, i) => {
    const id = w.dataset.win!;
    out[id] = { side: (w.dataset.side as Side) || "left", state: DEFAULT_STATE[id] ?? "open", order: i };
  });
  return out;
}

// ---------- 0.22.0 floating windows (rule floatingWindows) ----------
let floating = false;
let fl: FloatLayout = {};
let ro: ResizeObserver | null = null;
const RS_DIRS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
function store(): Storage | null { try { return window.localStorage; } catch { return null; } }
function viewport(): Viewport {
  const bar = document.querySelector<HTMLElement>("#playScreen .topbar");
  const top = bar ? Math.ceil(bar.getBoundingClientRect().bottom) : 0;
  document.getElementById("playScreen")?.style.setProperty("--menubar-h", `${top}px`);
  return { w: window.innerWidth, h: window.innerHeight, top };
}
function floatDefaults(): FloatLayout {
  const ids = wins.map((w) => w.dataset.win!);
  const sides = Object.fromEntries(wins.map((w) => [w.dataset.win!, w.dataset.side || "left"]));
  const open = new Set(ids.filter((id) => (DEFAULT_STATE[id] ?? "open") === "open"));
  return defaultLayout(ids, sides, open, viewport());
}
export function isFloating(): boolean { return floating; }
/** Switch between the 0.14 docked layout and 0.22.0 floating windows over a full-screen map. */
export function setFloating(on: boolean): void {
  if (on === floating || !wins.length) return;
  floating = on;
  document.getElementById("playScreen")?.classList.toggle("floating", on);
  if (on) fl = loadLayout(store(), floatDefaults(), viewport());
  apply();
}
export function resetFloatLayout(): void { fl = floatDefaults(); saveLayout(store(), fl); apply(); }
function setFloat(id: string, patch: Partial<FloatLayout[string]>): void {
  if (!fl[id]) return;
  fl[id] = { ...fl[id]!, ...patch };
  if (patch.state === "open" || patch.state === "min") bringToFront(fl, id);
  saveLayout(store(), fl);
  apply();
}
function place(w: HTMLElement): void {
  const L = fl[w.dataset.win!]!;
  w.style.left = `${L.x}px`; w.style.top = `${L.y}px`; w.style.width = `${L.w}px`;
  w.style.height = L.state === "min" ? "" : `${L.h}px`; w.style.zIndex = String(10 + L.z);
}
function setupFloatHandles(w: HTMLElement): void {
  const id = w.dataset.win!;
  for (const d of RS_DIRS) {
    const h = document.createElement("div");
    h.className = `win-rs win-rs-${d}`; h.dataset.rs = d;
    w.appendChild(h);
  }
  w.addEventListener("pointerdown", (e) => {
    if (!floating || !fl[id]) return;
    if (fl[id]!.z !== Math.max(...Object.values(fl).map((x) => x.z))) { bringToFront(fl, id); for (const o of wins) if (fl[o.dataset.win!]) o.style.zIndex = String(10 + fl[o.dataset.win!]!.z); saveLayout(store(), fl); }
    const t = e.target as HTMLElement;
    const dir = t.closest<HTMLElement>("[data-rs]")?.dataset.rs;
    const onBar = !!t.closest(".win-bar") && !t.closest("button");
    if (!dir && !onBar) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY }, r0 = { ...fl[id]! };
    w.classList.add(dir ? "win-resizing" : "win-dragging");
    try { (t as Element).setPointerCapture?.(e.pointerId); } catch { /* ok */ }
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y, vp = viewport();
      const r = dir ? resizeRect(r0, dir, dx, dy, vp) : clampRect({ ...r0, x: r0.x + dx, y: r0.y + dy }, vp);
      fl[id] = { ...fl[id]!, ...r };
      place(w);
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      w.classList.remove("win-resizing", "win-dragging");
      saveLayout(store(), fl);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  });
}

export function initWindows(changed: () => void): void {
  onChange = changed;
  wins = [...document.querySelectorAll<HTMLElement>("#winStore .win, .dock .win")];
  for (const w of wins) setupFloatHandles(w);
  // contents reflow to the window size: width classes + a custom event for views that redraw
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver((entries) => {
      for (const en of entries) {
        const w = en.target as HTMLElement, cw = Math.round(en.contentRect.width);
        w.classList.toggle("w-narrow", cw < 300); w.classList.toggle("w-wide", cw >= 560);
        w.style.setProperty("--win-w", `${cw}px`);
        w.dispatchEvent(new CustomEvent("win-resize", { bubbles: true, detail: { id: w.dataset.win, width: cw, height: Math.round(en.contentRect.height) } }));
      }
    });
    for (const w of wins) ro.observe(w);
  }
  window.addEventListener("resize", () => { if (!floating) return; fl = clampAll(fl, viewport()); saveLayout(store(), fl); for (const w of wins) if (w.parentElement?.id === "floatLayer") place(w); });
  document.getElementById("winMenuBar")?.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const id = t.closest("[data-menu-win]")?.getAttribute("data-menu-win");
    if (id && fl[id]) setFloat(id, { state: fl[id]!.state === "open" || fl[id]!.state === "min" ? "closed" : "open" });
    else if (t.closest("[data-menu-reset]")) resetFloatLayout();
  });
  const def = defaults();
  let stored: Record<string, WinLayout> = {};
  try { stored = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { stored = {}; }
  layout = {};
  for (const id of Object.keys(def)) layout[id] = { ...def[id]!, ...(stored[id] || {}) };
  for (const w of wins) {
    w.querySelector(".win-bar")?.addEventListener("click", (e) => {
      const act = (e.target as HTMLElement).closest("[data-win-act]")?.getAttribute("data-win-act");
      const id = w.dataset.win!;
      if (floating) {
        if (act === "min") setFloat(id, { state: fl[id]!.state === "min" ? "open" : "min" });
        else if (act === "close") setFloat(id, { state: "closed" });
        return;
      }
      if (act === "side") setWin(id, { side: layout[id]!.side === "left" ? "right" : "left", order: Date.now() });
      else if (act === "min") setWin(id, { state: "min" });
      else if (act === "close") setWin(id, { state: "closed" });
    });
  }
  const btn = document.getElementById("btnWindows");
  const menu = document.getElementById("windowMenu")!;
  btn?.addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; renderMenu(); });
  document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target as Node) && e.target !== btn) menu.hidden = true; });
  menu.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.winToggle) setWin(t.dataset.winToggle, { state: t.checked ? "open" : "closed" });
  });
  document.getElementById("tray")?.addEventListener("click", (e) => {
    const id = (e.target as HTMLElement).closest("[data-restore]")?.getAttribute("data-restore");
    if (id) setWin(id, { state: "open" });
  });
  document.getElementById("layoutReset")?.addEventListener("click", () => { layout = defaults(); save(); apply(); });
  apply();
}

export function setWin(id: string, patch: Partial<WinLayout>): void {
  if (floating && patch.state) { setFloat(id, { state: patch.state }); return; }
  if (!layout[id]) return;
  layout[id] = { ...layout[id]!, ...patch };
  save();
  apply();
}

/** Open (restore) a window, e.g. from a pin click. */
export function openWindow(id: string): void {
  if (floating) { if (fl[id]?.state !== "open") setFloat(id, { state: "open" }); else { bringToFront(fl, id); apply(); } return; }
  if (layout[id]?.state !== "open") setWin(id, { state: "open" });
  document.querySelector(`.win[data-win="${id}"]`)?.scrollIntoView({ block: "nearest" });
}

export function isOpen(id: string): boolean {
  if (unavailable.has(id)) return false;
  return floating ? fl[id]?.state === "open" : layout[id]?.state === "open";
}

function applyFloating(): void {
  renderMenuBar();
  fl = clampAll(fl, viewport());
  const layer = document.getElementById("floatLayer")!, storeEl = document.getElementById("winStore")!;
  for (const w of wins) {
    const id = w.dataset.win!, L = fl[id];
    const shown = !!L && L.state !== "closed" && !unavailable.has(id);
    if (shown) { layer.appendChild(w); place(w); } else storeEl.appendChild(w);
    w.classList.toggle("win-open", shown && L!.state === "open");
    w.classList.toggle("win-min", shown && L!.state === "min");
  }
  for (const d of ["dockLeft", "dockRight"]) document.getElementById(d)?.classList.add("empty");
  const tray = document.getElementById("tray")!; tray.innerHTML = ""; tray.hidden = true;
  renderMenuBar();
  onChange();
}
function renderMenuBar(): void {
  const bar = document.getElementById("winMenuBar");
  if (!bar) return;
  bar.innerHTML = wins.filter((w) => !unavailable.has(w.dataset.win!)).map((w) => {
    const id = w.dataset.win!, st = fl[id]?.state ?? "closed";
    return `<button type="button" class="menu-win${st === "open" ? " on" : st === "min" ? " min" : ""}" data-menu-win="${id}" aria-pressed="${st !== "closed"}" title="${st === "closed" ? "Open" : "Close"} ${w.dataset.title}">${w.dataset.title}</button>`;
  }).join("") + `<button type="button" class="menu-reset" data-menu-reset title="Put every window back to the default layout">Reset layout</button>`;
}
function clearFloatStyles(): void {
  for (const w of wins) { w.style.left = w.style.top = w.style.width = w.style.height = w.style.zIndex = ""; w.classList.remove("win-min"); }
}

function apply(): void {
  if (floating) { applyFloating(); return; }
  clearFloatStyles();
  const left = document.getElementById("dockLeft")!, right = document.getElementById("dockRight")!;
  const store = document.getElementById("winStore")!;
  const sorted = [...wins].sort((a, b) => layout[a.dataset.win!]!.order - layout[b.dataset.win!]!.order);
  for (const w of sorted) {
    const L = layout[w.dataset.win!]!;
    if (L.state === "open" && !unavailable.has(w.dataset.win!)) (L.side === "left" ? left : right).appendChild(w);
    else store.appendChild(w);
    w.classList.toggle("win-open", L.state === "open" && !unavailable.has(w.dataset.win!));
  }
  left.classList.toggle("empty", !left.children.length);
  right.classList.toggle("empty", !right.children.length);
  const tray = document.getElementById("tray")!;
  tray.innerHTML = wins.filter((w) => layout[w.dataset.win!]!.state === "min" && !unavailable.has(w.dataset.win!))
    .map((w) => `<button type="button" class="tray-chip" data-restore="${w.dataset.win}" title="Restore">▢ ${w.dataset.title}</button>`).join("");
  tray.hidden = !tray.children.length;
  renderMenu();
  onChange();
}

function renderMenu(): void {
  const menu = document.getElementById("windowMenu");
  if (!menu) return;
  menu.innerHTML = wins.filter((w) => !unavailable.has(w.dataset.win!)).map((w) => {
    const id = w.dataset.win!, L = layout[id]!;
    return `<label class="win-menu-row"><input type="checkbox" data-win-toggle="${id}"${L.state === "open" ? " checked" : ""}/> ${w.dataset.title} <span class="tags">${L.state === "min" ? "minimized" : L.state === "closed" ? "closed" : L.side}</span></label>`;
  }).join("");
}
