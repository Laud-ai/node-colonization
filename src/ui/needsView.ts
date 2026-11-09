/** 0.14.0 — Needs tree (SVG) + supplier cards. Pure HTML builders; data comes from session. */
import type { Supplier, TreeNode } from "../session.js";
import { NODE_COLORS } from "../nodes.js";
import type { NodeType } from "../types.js";
import { flagDesignToSvg } from "../flagDesign.js";
import { SPECIALTY_CODE, luminance } from "./pinIcon.js";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MISSING = "#dc2626", EXPAND = "#6b7280";

export function needsTreeHtml(tree: TreeNode[], colony: { name: string; color: string; requires: string }): string {
  const cols = new Map<number, TreeNode[]>();
  for (const t of tree) cols.set(t.depth, [...(cols.get(t.depth) || []), t]);
  const depths = [...cols.keys()].sort((a, b) => a - b);
  // Vertical tree: depth rows top (Resources) → bottom; fits a narrow side window.
  const W = 84, H = 22, GX = 6, GY = 18, PAD = 4;
  const maxCols = Math.max(...[...cols.values()].map((c) => c.length));
  const width = PAD * 2 + maxCols * W + (maxCols - 1) * GX;
  const height = PAD * 2 + depths.length * H + (depths.length - 1) * GY;
  const pos = new Map<NodeType, { x: number; y: number }>();
  depths.forEach((d, i) => {
    const list = cols.get(d)!;
    const off = ((maxCols - list.length) * (W + GX)) / 2;
    list.forEach((t, j) => pos.set(t.node, { x: PAD + off + j * (W + GX), y: PAD + i * (H + GY) }));
  });
  // Missing = dark fill + red border/text so it never blends with a red bloc color.
  const fill = (t: TreeNode) => t.state === "have" ? colony.color : t.state === "missing" ? "#2a0a0a" : t.state === "expand" ? EXPAND : "transparent";
  let edges = "", nodes = "";
  const state = new Map(tree.map((t) => [t.node, t.state]));
  for (const t of tree) {
    const b = pos.get(t.node)!;
    for (const d of t.deps) {
      const a = pos.get(d)!;
      if (a.y >= b.y) continue; // cycle edge (Stability↔Military) — skip drawing
      const hot = state.get(d) === "missing" && (t.state === "have" || t.state === "missing");
      edges += `<path d="M${a.x + W / 2},${a.y + H} C${a.x + W / 2},${a.y + H + GY} ${b.x + W / 2},${b.y - GY} ${b.x + W / 2},${b.y}" fill="none" stroke="${hot ? MISSING : "#3a4668"}" stroke-width="${hot ? 1.6 : 1}" opacity="${hot ? 0.9 : 0.55}"/>`;
    }
  }
  for (const t of tree) {
    const p = pos.get(t.node)!;
    const f = fill(t);
    const txt = t.state === "missing" ? "#fca5a5" : f === "transparent" ? "#8090b0" : luminance(f) > 0.35 ? "#0b1020" : "#fff";
    const req = t.node === colony.requires ? " ★" : "";
    const short = t.node === "Infrastructure" ? "Infrastruct." : t.node === "Terraforming" ? "Terraform" : t.node;
    const mark = t.state === "have" ? "✓" : t.state === "missing" ? "✗" : "";
    const label = `${mark}${short}${t.count > 1 ? ` ×${t.count}` : ""}${req}`;
    nodes += `<g class="nt-node" data-node="${t.node}" data-state="${t.state}"><title>${esc(`${t.node}: ${t.why || t.state}${t.source ? ` (${t.source})` : ""}`)}</title>
      <rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="5" fill="${f}" stroke="${t.state === "missing" ? MISSING : t.state === "none" ? "#3a4668" : "#e2e8f0"}" stroke-width="${t.state === "missing" ? 2 : 1}" ${t.state === "none" ? 'stroke-dasharray="3 2"' : ""}/>
      <rect x="${p.x + 3}" y="${p.y + 7}" width="8" height="8" rx="2" fill="${NODE_COLORS[t.node]}"/>
      <text x="${p.x + 15}" y="${p.y + 15}" font-size="10" font-family="system-ui,sans-serif" font-weight="${t.state === "none" ? 400 : 700}" fill="${txt}">${esc(label)}</text></g>`;
  }
  return `<div class="tags"><b>${esc(colony.name)}</b> · ★ = Requires · click a node for suppliers</div>
    <div class="nt-legend"><span><i style="background:${esc(colony.color)}"></i>✓ has</span><span><i style="background:#2a0a0a;border:2px solid ${MISSING}"></i>✗ missing</span><span><i style="background:${EXPAND}"></i>no-stress expansion</span><span><i style="border:1px dashed #3a4668"></i>other</span></div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Needs tree">${edges}${nodes}</svg>`;
}

export function resourceBadge(node: NodeType): string {
  const c = NODE_COLORS[node] || "#94a3b8";
  return `<span class="sup-res" style="background:${c};color:${luminance(c) > 0.35 ? "#0b1020" : "#fff"}" title="${node}">${esc(SPECIALTY_CODE[node])}</span>`;
}

export function suppliersHtml(
  list: Supplier[], colonyName: string, filter: NodeType | null,
  chips: { node: NodeType; state: string }[], acting: boolean, limit = 60,
): string {
  const chipHtml = chips.map((c) =>
    `<button type="button" class="${c.state}${c.node === filter ? " selected" : ""}" data-sup-node="${c.node}">${c.node}</button>`).join("");
  const head = `<div class="sup-head"><b>${filter ? `${esc(filter)} choices` : "All needs"}</b> for ${esc(colonyName)}
    ${filter ? '<button type="button" data-sup-node="">All needs</button>' : ""}
    <span class="tags">${list.length} source${list.length === 1 ? "" : "s"}${acting ? "" : " · info only (not this colony's action)"}</span></div>
    <div class="sup-filter">${chipHtml}</div>`;
  if (!list.length) return head + `<div class="tags">Nobody has ${filter ? esc(filter) : "these nodes"} available right now.</div>`;
  const cards = list.slice(0, limit).map((s) => {
    const ok = s.legal && !s.blocks.length;
    const relLabel = s.relation === "own" ? "own bloc" : s.relation;
    return `<div class="sup-card${ok ? "" : " blocked"}" data-sup-id="${esc(s.id)}" data-sup-node-card="${s.node}">
      <div class="sup-title"><span>${esc(s.name)}</span><span class="sup-loc ${s.location}">${s.location}</span></div>
      <div class="sup-flag">${flagDesignToSvg(s.flag, 48, 32, s.name)}${resourceBadge(s.node)}</div>
      <div><b>${esc(s.node)}</b> · <span class="sup-rel ${s.relation}">${relLabel}</span> · ${s.scope === "regional" ? "regional" : "outer (space)"}</div>
      <div>Line: ${esc(s.line)}</div>
      <div>Effect: ${esc(s.replaces)}</div>
      <div class="tags">${esc(s.allyHint)}</div>
      ${s.blocks.map((b) => `<div class="sup-block">⛔ ${esc(b)}</div>`).join("")}
      ${s.moveKey ? `<button type="button" class="good" data-move-key="${esc(s.moveKey)}">${esc(s.moveLabel || "Import")}</button>` : ""}
    </div>`;
  }).join("");
  const more = list.length > limit ? `<div class="tags">+${list.length - limit} more — pick a node to narrow.</div>` : "";
  return head + `<div class="sup-grid">${cards}</div>` + more;
}
