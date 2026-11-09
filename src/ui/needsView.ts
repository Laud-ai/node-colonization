/** 0.14.0 — Needs tree (SVG) + supplier cards. Pure HTML builders; data comes from session. */
import type { Supplier, TreeNode } from "../session.js";
import type { NeedState } from "../needs.js";
import { NODE_COLORS } from "../nodes.js";
import type { NodeType } from "../types.js";
import { flagDesignToSvg } from "../flagDesign.js";
import { SPECIALTY_CODE, luminance } from "./pinIcon.js";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/**
 * 0.15.3 state styles (Tiago's colours, readable on #0B0F14) + a non-colour cue per state
 * (icon prefix and border style) for colourblind safety.
 */
export const NEED_STYLE: Record<NeedState, { label: string; fill: string; stroke: string; text: string; icon: string; dash: string; width: number }> = {
  specialty: { label: "specialty", fill: "#4C9BE8", stroke: "#DCEBFA", text: "#0B0F14", icon: "◆", dash: "", width: 2.5 },
  developed: { label: "developed", fill: "#3FB68B", stroke: "#D5F2E6", text: "#0B0F14", icon: "✓", dash: "", width: 1.2 },
  imported: { label: "imported", fill: "#E8C547", stroke: "#FFF3C4", text: "#0B0F14", icon: "⇩", dash: "6 2", width: 1.4 },
  missing: { label: "missing", fill: "#2A0A0C", stroke: "#E5484D", text: "#FF9A9D", icon: "✗", dash: "", width: 2 },
  expand: { label: "no-stress expansion", fill: "#4A5462", stroke: "#AEB8C4", text: "#F1F4F7", icon: "+", dash: "1.5 2", width: 1.4 },
  locked: { label: "other (locked)", fill: "transparent", stroke: "#2A3A4D", text: "#7D8B99", icon: "", dash: "3 2", width: 1 },
};
const MISSING = NEED_STYLE.missing.stroke;
const OWNED = new Set<NeedState>(["specialty", "developed", "imported"]);

export function needsTreeHtml(tree: TreeNode[], colony: { name: string; color: string; requires: string }): string {
  const cols = new Map<number, TreeNode[]>();
  for (const t of tree) cols.set(t.depth, [...(cols.get(t.depth) || []), t]);
  const depths = [...cols.keys()].sort((a, b) => a - b);
  // 0.15.3: inverted — basics (Resources) at the bottom, the tree builds upward; fits a narrow side window.
  const W = 84, H = 22, GX = 6, GY = 18, PAD = 4;
  const maxCols = Math.max(...[...cols.values()].map((c) => c.length));
  const width = PAD * 2 + maxCols * W + (maxCols - 1) * GX;
  const height = PAD * 2 + depths.length * H + (depths.length - 1) * GY;
  const pos = new Map<NodeType, { x: number; y: number }>();
  depths.forEach((d, i) => {
    const list = cols.get(d)!;
    const off = ((maxCols - list.length) * (W + GX)) / 2;
    const row = depths.length - 1 - i;
    list.forEach((t, j) => pos.set(t.node, { x: PAD + off + j * (W + GX), y: PAD + row * (H + GY) }));
  });
  let edges = "", nodes = "";
  const state = new Map(tree.map((t) => [t.node, t.state]));
  for (const t of tree) {
    const b = pos.get(t.node)!;
    for (const d of t.deps) {
      const a = pos.get(d)!;
      if (a.y <= b.y) continue; // cycle edge (Stability↔Military) — skip drawing
      const hot = state.get(d) === "missing" && (OWNED.has(t.state) || t.state === "missing");
      edges += `<path d="M${a.x + W / 2},${a.y} C${a.x + W / 2},${a.y - GY} ${b.x + W / 2},${b.y + H + GY} ${b.x + W / 2},${b.y + H}" fill="none" stroke="${hot ? MISSING : "#3a4668"}" stroke-width="${hot ? 1.6 : 1}" opacity="${hot ? 0.9 : 0.55}"/>`;
    }
  }
  for (const t of tree) {
    const p = pos.get(t.node)!;
    const st = NEED_STYLE[t.state];
    const req = t.node === colony.requires ? " ★" : "";
    const short = t.node === "Infrastructure" ? "Infrastruct." : t.node === "Terraforming" ? "Terraform" : t.node;
    const imp = t.imported > 0 && t.state !== "imported" ? "⇩" : "";
    const label = `${st.icon}${short}${t.count > 1 ? ` ×${t.count}` : ""}${imp}${req}`;
    const warn = t.short ? `<circle cx="${p.x + W - 4}" cy="${p.y + 4}" r="4.5" fill="#2A0A0C" stroke="${MISSING}" stroke-width="1.2"/><text x="${p.x + W - 4}" y="${p.y + 7}" font-size="7" font-weight="700" text-anchor="middle" fill="#FF9A9D">!</text>` : "";
    nodes += `<g class="nt-node" data-node="${t.node}" data-state="${t.state}"><title>${esc(`${t.node} — ${st.label}${t.why ? `: ${t.why}` : ""}${t.source ? ` (${t.source})` : ""}${t.short ? " · under-covered (strain)" : ""}`)}</title>
      <rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="5" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${st.width}" ${st.dash ? `stroke-dasharray="${st.dash}"` : ""}/>
      <rect x="${p.x + 3}" y="${p.y + 7}" width="8" height="8" rx="2" fill="${NODE_COLORS[t.node]}" stroke="#0B0F14" stroke-width="0.8"/>
      <text x="${p.x + 15}" y="${p.y + 15}" font-size="10" font-family="system-ui,sans-serif" font-weight="${t.state === "locked" ? 400 : 700}" fill="${st.text}">${esc(label)}</text>${warn}</g>`;
  }
  const order: NeedState[] = ["specialty", "developed", "imported", "missing", "expand", "locked"];
  const legend = order.map((k) => {
    const st = NEED_STYLE[k];
    return `<span data-legend="${k}"><i style="background:${st.fill};border:${Math.min(2, st.width)}px ${st.dash ? (k === "expand" ? "dotted" : "dashed") : "solid"} ${st.stroke}"></i>${st.icon ? st.icon + " " : ""}${esc(st.label)}</span>`;
  }).join("");
  return `<div class="tags"><b>${esc(colony.name)}</b> · ★ = Requires · ! = under-covered · ⇩ = imported · basics at the bottom · click a node for suppliers</div>
    <div class="nt-legend">${legend}</div>
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
