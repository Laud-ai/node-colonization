/**
 * 0.14.0 — Map-first side windows: dock left/right, minimize to tray, close/reopen
 * from the Windows menu. Layout remembered in localStorage.
 */
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

export function initWindows(changed: () => void): void {
  onChange = changed;
  wins = [...document.querySelectorAll<HTMLElement>("#winStore .win, .dock .win")];
  const def = defaults();
  let stored: Record<string, WinLayout> = {};
  try { stored = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { stored = {}; }
  layout = {};
  for (const id of Object.keys(def)) layout[id] = { ...def[id]!, ...(stored[id] || {}) };
  for (const w of wins) {
    w.querySelector(".win-bar")?.addEventListener("click", (e) => {
      const act = (e.target as HTMLElement).closest("[data-win-act]")?.getAttribute("data-win-act");
      const id = w.dataset.win!;
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
  if (!layout[id]) return;
  layout[id] = { ...layout[id]!, ...patch };
  save();
  apply();
}

/** Open (restore) a window, e.g. from a pin click. */
export function openWindow(id: string): void {
  if (layout[id]?.state !== "open") setWin(id, { state: "open" });
  document.querySelector(`.win[data-win="${id}"]`)?.scrollIntoView({ block: "nearest" });
}

export function isOpen(id: string): boolean { return layout[id]?.state === "open" && !unavailable.has(id); }

function apply(): void {
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
