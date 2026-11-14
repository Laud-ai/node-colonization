/**
 * 0.21.1 Lineage window (ideology / culture trees) and Cluster graph window (force layout + turn replay).
 * Both read the UI snapshot's event log + relation timeline only (never sim state).
 */
import { buildLineage, type Lineage, type LineageKind, type LineageSite } from "../lineage.js";
import { ClusterReplay, type ClusterFrame } from "../cluster.js";
import { flagDesignToSvg, type FlagDesign } from "../flagDesign.js";
import { svgDataUrl } from "./svgUrl.js";
import type { UiSnapshot } from "../session.js";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// ---------- Lineage ----------
export interface LineageUi { kind: LineageKind; scope: "all" | "colony"; pop: string | null }
export const lineageUi: LineageUi = { kind: "ideology", scope: "all", pop: null };
const COL_W = 176, ROW_H = 74, NODE_W = 158, PAD_X = 46, PAD_Y = 14, SHOW = 3;

const siteHtml = (s: LineageSite, live: Set<string>, own = false) => {
  if (own) return `<span class="lin-own">T${s.turn} ${esc(s.how)}</span>`;
  const label = `${esc(s.name)} <span class="tags">T${s.turn}</span>`;
  return live.has(s.colonyId)
    ? `<button type="button" class="lin-col" data-select-colony="${esc(s.colonyId)}" title="${esc(s.how)} · select ${esc(s.name)}">${label}</button>`
    : `<span class="lin-col gone" title="${esc(s.how)} · no longer on the map">${label}</span>`;
};

export function lineageHtml(snap: UiSnapshot): string {
  if (!snap.eventLog) return `<div class="tags" data-lineage-empty>Lineage needs the event log (Rules → History → Event log).</div>`;
  const sel = snap.selected;
  const colonyId = lineageUi.scope === "colony" && sel ? sel.id : null;
  const L = buildLineage({ events: snap.events, timeline: snap.timeline }, lineageUi.kind, colonyId);
  const live = new Set(snap.colonies.map((c) => c.id));
  const tabs = `<div class="detail-tabs lin-tabs" role="tablist">
    ${(["ideology", "culture"] as const).map((k) => `<button type="button" role="tab" data-lineage-kind="${k}" class="${lineageUi.kind === k ? "on" : ""}" aria-selected="${lineageUi.kind === k}">${k === "ideology" ? "Ideology" : "Culture"}</button>`).join("")}
  </div>
  <div class="lin-scope tags">Show:
    <button type="button" data-lineage-scope="all" class="${colonyId ? "" : "on"}">All colonies</button>
    <button type="button" data-lineage-scope="colony" class="${colonyId ? "on" : ""}"${sel ? "" : " disabled"}>${sel ? esc(sel.name) : "selected colony"}</button>
  </div>`;
  if (!L.nodes.length) return `${tabs}<div class="tags" data-lineage-empty>No ${lineageUi.kind} history yet — end a turn.</div>`;
  let pop = "";
  const popNode = lineageUi.pop ? L.nodes.find((n) => n.tag === lineageUi.pop) : null;
  if (popNode) pop = `<div class="lin-pop" data-lineage-pop><div class="summary-title">${esc(popNode.tag)} — ${popNode.sites.length} colon${popNode.sites.length === 1 ? "y" : "ies"} <button type="button" data-lineage-pop-close title="Close">×</button></div>
    <div class="lin-pop-list">${popNode.sites.map((s) => `<div>${siteHtml(s, live)} <span class="tags">${esc(s.how)}</span></div>`).join("")}</div></div>`;
  return `${tabs}${colonyId ? `<div class="tags lin-path">Path of ${esc(sel!.name)}: founding ${lineageUi.kind} → shifts and blends, with turns.</div>` : ""}${pop}${treeHtml(L, live, !!colonyId)}`;
}

function treeHtml(L: Lineage, live: Set<string>, own: boolean): string {
  const lanes = Math.max(1, ...L.nodes.map((n) => n.lane + 1));
  const W = PAD_X + lanes * COL_W, H = PAD_Y * 2 + L.turns.length * ROW_H;
  const pos = new Map(L.nodes.map((n) => [n.tag, { x: PAD_X + n.lane * COL_W, y: PAD_Y + n.y * ROW_H }]));
  const paths = L.edges.map((e) => {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (!a || !b) return "";
    const x1 = a.x + NODE_W / 2, y1 = a.y + 50, x2 = b.x + NODE_W / 2, y2 = b.y;
    const my = (y1 + y2) / 2;
    const who = e.sites.map((s) => `${s.name} T${s.turn}`).join(", ");
    return `<path class="lin-edge ${e.kind}" d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}" data-edge="${esc(e.from)}→${esc(e.to)}"><title>${esc(e.from)} → ${esc(e.to)} (${e.kind}): ${esc(who)}</title></path>`;
  }).join("");
  const axis = L.turns.map((t, i) => Number.isInteger(t) ? `<div class="lin-turn" style="top:${PAD_Y + i * ROW_H + 4}px">T${t}</div>` : "").join("");
  const nodes = L.nodes.map((n) => {
    const p = pos.get(n.tag)!;
    const parents = L.edges.filter((e) => e.to === n.tag && e.kind === "blend").map((e) => e.from);
    const shown = own ? n.sites.map((s) => siteHtml(s, live, true)).join(" · ") : n.sites.slice(0, SHOW).map((s) => siteHtml(s, live)).join(" ");
    const more = !own && n.sites.length > SHOW
      ? `<button type="button" class="lin-more" data-lineage-more="${esc(n.tag)}" title="${esc(n.sites.map((s) => `${s.name} T${s.turn}`).join(", "))}">+${n.sites.length - SHOW}</button>` : "";
    return `<div class="lin-node${parents.length ? " blend" : ""}" data-lineage-node="${esc(n.tag)}" style="left:${p.x}px;top:${p.y}px;width:${NODE_W}px"
      title="${esc(n.tag)}${parents.length ? ` = ${esc(parents.join(" + "))}` : ""}">
      <div class="lin-tag">${more}${esc(n.tag)}</div>
      ${parents.length ? `<div class="lin-parents tags">${parents.map(esc).join(" + ")}</div>` : ""}
      <div class="lin-sites">${shown}</div></div>`;
  }).join("");
  return `<div class="lin-canvas" data-lineage-tree data-nodes="${L.nodes.length}" data-edges="${L.edges.length}" style="width:${W}px;height:${H}px">
    <svg class="lin-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><marker id="linArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#64748b"/></marker></defs>${paths}</svg>
    ${axis}${nodes}</div>`;
}

// ---------- Cluster graph ----------
interface Shown { x: number; y: number }
export class ClusterView {
  private replay: ClusterReplay | null = null;
  private idx = -1;
  private follow = true;
  private timer: number | null = null;
  private shown = new Map<string, Shown>();
  private view = { x: -300, y: -300, w: 600, h: 600 };
  private anim: number | null = null;
  private flagUrl = new Map<string, string>();
  private snap: UiSnapshot | null = null;
  edges = true;
  constructor(private root: HTMLElement, private onSelect: (id: string) => void) {
    root.innerHTML = `<div class="cl-controls">
        <button type="button" id="clusterPlay" title="Play / pause the replay">▶</button>
        <input type="range" id="clusterTurn" min="0" max="0" value="0" step="1" aria-label="Replay turn"/>
        <span id="clusterTurnLabel" class="tags">—</span>
        <label class="tags"><input type="checkbox" id="clusterEdges" checked/> edges</label>
      </div>
      <svg id="clusterSvg" class="cl-svg" viewBox="-300 -300 600 600" preserveAspectRatio="xMidYMid meet"><g class="cl-edges"></g><g class="cl-nodes"></g></svg>
      <div class="tags cl-legend">Pulled together by patron, bloc, alliance, trade, shared ideology · pushed apart by war, seizure, rival alliances, hoarding · colonies drift from their nation as fervor rises.</div>
      <div id="clusterEmpty" class="tags" hidden>End a turn to start the replay.</div>`;
    const slider = this.slider();
    slider.addEventListener("input", () => { this.stop(); this.go(Number(slider.value)); });
    root.querySelector("#clusterPlay")!.addEventListener("click", () => (this.timer ? this.stop() : this.play()));
    root.querySelector("#clusterEdges")!.addEventListener("change", (e) => { this.edges = (e.target as HTMLInputElement).checked; this.draw(false); });
    root.querySelector("#clusterSvg")!.addEventListener("click", (e) => {
      const id = (e.target as Element).closest("[data-cl-colony]")?.getAttribute("data-cl-colony");
      if (id) this.onSelect(id);
    });
  }
  private slider(): HTMLInputElement { return this.root.querySelector("#clusterTurn") as HTMLInputElement; }
  get index(): number { return this.idx; }
  frame(): ClusterFrame | null { return this.replay?.frame(this.idx) ?? null; }
  update(snap: UiSnapshot): void {
    this.snap = snap;
    const n = snap.timeline.length;
    if (!this.replay) this.replay = new ClusterReplay(snap.timeline, snap.events);
    else this.replay.update(snap.timeline, snap.events);
    const s = this.slider();
    s.max = String(Math.max(0, n - 1));
    (this.root.querySelector("#clusterEmpty") as HTMLElement).hidden = n > 0;
    if (!n) { this.idx = -1; return; }
    const target = this.follow || this.idx < 0 || this.idx >= n ? n - 1 : this.idx;
    if (target !== this.idx) this.go(target, false); else this.draw(false);
  }
  go(i: number, animate = true): void {
    if (!this.replay || !this.snap) return;
    const n = this.snap.timeline.length;
    this.idx = Math.max(0, Math.min(n - 1, i));
    this.follow = this.idx === n - 1 && !this.timer;
    this.slider().value = String(this.idx);
    this.draw(animate);
  }
  play(): void {
    if (!this.snap?.timeline.length) return;
    if (this.idx >= this.snap.timeline.length - 1) this.go(0, false);
    (this.root.querySelector("#clusterPlay") as HTMLElement).textContent = "⏸";
    this.timer = window.setInterval(() => {
      if (!this.snap || this.idx >= this.snap.timeline.length - 1) { this.stop(); return; }
      this.go(this.idx + 1);
    }, 550);
  }
  stop(): void {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    (this.root.querySelector("#clusterPlay") as HTMLElement).textContent = "▶";
    if (this.snap) this.follow = this.idx === this.snap.timeline.length - 1;
  }
  private flag(id: string, design: FlagDesign | undefined, w: number, h: number): string | null {
    if (!design) return null;
    const k = `${id}|${w}`;
    let u = this.flagUrl.get(k);
    if (!u) { u = svgDataUrl(flagDesignToSvg(design, w, h)); this.flagUrl.set(k, u); }
    return u;
  }
  private draw(animate: boolean): void {
    const f = this.frame(), snap = this.snap;
    if (!f || !snap) return;
    const label = this.root.querySelector("#clusterTurnLabel")!;
    label.textContent = `T${f.turn} (${this.idx + 1}/${snap.timeline.length})`;
    const svg = this.root.querySelector("#clusterSvg") as SVGSVGElement;
    svg.setAttribute("data-turn", String(f.turn));
    svg.setAttribute("data-nodes", String(f.nodes.length));
    const gN = svg.querySelector(".cl-nodes")!, gE = svg.querySelector(".cl-edges")!;
    const NS = "http://www.w3.org/2000/svg";
    const colFlags = new Map(snap.colonies.map((c) => [c.id, c.flag]));
    const color = new Map(snap.blocs.map((b) => [b.name, b.nationColor]));
    const keep = new Set<string>();
    for (const nd of f.nodes) {
      keep.add(nd.id);
      let g = gN.querySelector(`[data-node="${CSS.escape(nd.id)}"]`) as SVGGElement | null;
      if (!g) {
        g = document.createElementNS(NS, "g") as SVGGElement;
        g.setAttribute("data-node", nd.id);
        const bloc = nd.kind === "bloc";
        const w = bloc ? 36 : 24, h = bloc ? 24 : 16;
        const url = bloc ? this.flag(nd.id, snap.blocFlags[nd.name], 36, 24) : this.flag(nd.id, colFlags.get(nd.id), 30, 20);
        const fr = document.createElementNS(NS, "rect");
        fr.setAttribute("x", String(-w / 2 - 2)); fr.setAttribute("y", String(-h / 2 - 2)); fr.setAttribute("width", String(w + 4)); fr.setAttribute("height", String(h + 4));
        fr.setAttribute("class", bloc ? "cl-frame bloc" : "cl-frame");
        fr.setAttribute("fill", color.get(nd.bloc) ?? "#64748b");
        g.appendChild(fr);
        if (url) {
          const im = document.createElementNS(NS, "image");
          im.setAttribute("href", url); im.setAttribute("x", String(-w / 2)); im.setAttribute("y", String(-h / 2));
          im.setAttribute("width", String(w)); im.setAttribute("height", String(h)); im.setAttribute("preserveAspectRatio", "none");
          g.appendChild(im);
        }
        const t = document.createElementNS(NS, "title"); g.appendChild(t);
        if (bloc) {
          const tx = document.createElementNS(NS, "text"); tx.setAttribute("y", String(h / 2 + 11)); tx.setAttribute("class", "cl-bloc-label");
          tx.textContent = nd.name.replace(/^(The )?/, "").split(" ").map((w2) => w2[0]).join("").slice(0, 4);
          g.appendChild(tx);
        } else { g.setAttribute("data-cl-colony", nd.id); g.setAttribute("class", "cl-colony"); }
        gN.appendChild(g);
        if (!this.shown.has(nd.id)) this.shown.set(nd.id, { x: nd.x, y: nd.y });
      }
      g.querySelector("title")!.textContent = nd.kind === "bloc" ? `${nd.name} (Earth)` : `${nd.name} · ${nd.independent ? `Independent (from ${nd.bloc})` : nd.bloc}${nd.fervor ? ` · fervor ${nd.fervor}` : ""}`;
      g.classList.toggle("independent", nd.independent);
      g.classList.toggle("selected", nd.id === snap.selected?.id);
    }
    for (const g of [...gN.querySelectorAll("[data-node]")]) {
      const id = g.getAttribute("data-node")!;
      if (!keep.has(id)) { g.remove(); this.shown.delete(id); }
    }
    // edges (faint): alliances between blocs + wars; patron links only for the selected colony
    const sel = snap.selected?.id;
    const edges = this.edges ? f.edges.filter((e) => e.kind !== "patron" || e.a === sel) : [];
    gE.innerHTML = edges.map((e) => `<line class="cl-edge ${e.kind}" data-a="${esc(e.a)}" data-b="${esc(e.b)}"/>`).join("");
    svg.setAttribute("data-edges", String(edges.length));
    // fit view
    const xs = f.nodes.map((n) => n.x), ys = f.nodes.map((n) => n.y);
    const pad = 40, minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
    const side = Math.max(maxX - minX, maxY - minY, 200);
    const target = { x: (minX + maxX) / 2 - side / 2, y: (minY + maxY) / 2 - side / 2, w: side, h: side };
    const to = new Map(f.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
    const from = new Map([...this.shown].map(([k, v]) => [k, { ...v }]));
    const v0 = { ...this.view };
    if (this.anim) cancelAnimationFrame(this.anim);
    const t0 = performance.now(), dur = animate ? 420 : 0;
    const step = (now: number) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      for (const [id, p] of to) {
        const a = from.get(id) ?? p;
        const cur = { x: a.x + (p.x - a.x) * e, y: a.y + (p.y - a.y) * e };
        this.shown.set(id, cur);
        gN.querySelector(`[data-node="${CSS.escape(id)}"]`)?.setAttribute("transform", `translate(${cur.x.toFixed(1)},${cur.y.toFixed(1)})`);
      }
      for (const l of gE.querySelectorAll("line")) {
        const a = this.shown.get(l.getAttribute("data-a")!), b = this.shown.get(l.getAttribute("data-b")!);
        if (!a || !b) continue;
        l.setAttribute("x1", a.x.toFixed(1)); l.setAttribute("y1", a.y.toFixed(1)); l.setAttribute("x2", b.x.toFixed(1)); l.setAttribute("y2", b.y.toFixed(1));
      }
      this.view = { x: v0.x + (target.x - v0.x) * e, y: v0.y + (target.y - v0.y) * e, w: v0.w + (target.w - v0.w) * e, h: v0.h + (target.h - v0.h) * e };
      svg.setAttribute("viewBox", `${this.view.x.toFixed(1)} ${this.view.y.toFixed(1)} ${this.view.w.toFixed(1)} ${this.view.h.toFixed(1)}`);
      this.anim = k < 1 ? requestAnimationFrame(step) : null;
    };
    if (dur) this.anim = requestAnimationFrame(step); else step(t0);
  }
}
