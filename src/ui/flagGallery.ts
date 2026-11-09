/** 0.15.0 — Dev flag gallery (?flags or Rules tab → Flag gallery). Synthetic samples only. */
import { TRADITIONS, blocFlag, colonyFlag, flagDesignToSvg, type FlagDesign, type FlagInput } from "../flagDesign.js";
import type { NodeType } from "../types.js";
import { IDEOLOGIES } from "../engine.js";

const SPECS: NodeType[] = ["Water", "Production", "Food", "Logistics", "Military", "Terraforming", "Energy", "Science", "Oxygen", "Thrust", "Resources", "Culture", "Money", "Projects"];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

let smalls: { d: FlagDesign; label: string }[] = [];
function tile(d: FlagDesign, label: string, sub = ""): string {
  smalls.push({ d, label });
  return `<figure class="fg-tile"><div class="fg-flag">${flagDesignToSvg(d, 120, 80)}</div><div class="fg-small">${flagDesignToSvg(d, 24, 16)}</div>
    <figcaption><b>${esc(label)}</b><span>${esc(sub || `${d.layout} · ${d.tinctures.join("/")}${d.justification ? " (4th: " + d.justification + ")" : ""}`)}</span></figcaption></figure>`;
}

export function flagGalleryHtml(seed = 2026): string {
  smalls = [];
  const blocs = Object.keys(TRADITIONS);
  const earth = blocs.map((b) => tile(blocFlag(b), b, TRADITIONS[b]!.tradition)).join("");
  let n = 0;
  const daughters = blocs.flatMap((b, i) => [0, 1].map((k) => {
    const sp = SPECS[(i * 2 + k) % SPECS.length]!;
    const body = k ? "Mars" : "Moon";
    const inp: FlagInput = { seed, id: `c${++n}`, origin: b, patron: b, ideology: defaultIdeology(b), specialty: sp, body };
    return tile(colonyFlag(inp), `${b} daughter`, `${sp} · ${body}`);
  })).join("");
  const ideos = ["Putinism", "Socialism", "Political Islam", "Corporate Pioneerism", "Democratic Free Market", "Technocracy"].map((ideo, i) =>
    tile(colonyFlag({ seed, id: `c${100 + i}`, origin: "Russian Federation", patron: "Russian Federation", ideology: ideo, specialty: "Production", body: "Moon" }), "Pan-Slavic daughter", `${ideo} · Production`)).join("");
  const pairs = [
    { origin: "British Commonwealth", ideo: "Liberal Constitutionalism", newIdeo: "Socialism", sp: "Food" as NodeType },
    { origin: "United States", ideo: "Democratic Free Market", newIdeo: "Pioneerism", sp: "Thrust" as NodeType },
    { origin: "China", ideo: "Chinese Socialism", newIdeo: "Technocracy", sp: "Water" as NodeType },
    { origin: "New Caliphate", ideo: "Political Islam", newIdeo: "Political Islam", sp: "Military" as NodeType },
  ].map((p, i) => {
    const id = `c${200 + i}`;
    const before: FlagInput = { seed, id, origin: p.origin, patron: p.origin, ideology: p.ideo, specialty: p.sp, body: "Moon" };
    const after: FlagInput = { ...before, patron: "Independent", ideology: p.newIdeo, liege: { id, origin: p.origin, ideology: p.newIdeo }, isLiege: true };
    const member: FlagInput = { ...after, id: `c${300 + i}`, specialty: "Energy", isLiege: false };
    const a = colonyFlag(after);
    return `<div class="fg-pair">${tile(colonyFlag(before), `${p.origin} colony (before)`, `${p.ideo} · ${p.sp}`)}<span class="fg-arrow">→</span>${tile(a, "Independent (after)", `keeps ${a.heritage?.value} · ${p.newIdeo}`)}${tile(colonyFlag(member), "Same nation, member", "Energy colony")}</div>`;
  }).join("");
  const flip = [["Russian Federation", "China"], ["United States", "European Union"]].map(([o, np], i) => {
    const b: FlagInput = { seed, id: `c${400 + i}`, origin: o!, patron: o!, ideology: defaultIdeology(o!), specialty: "Science", body: "Mars" };
    const f = colonyFlag({ ...b, patron: np!, ideology: defaultIdeology(np!) });
    return `<div class="fg-pair">${tile(colonyFlag(b), `${o} colony`, "Science · Mars")}<span class="fg-arrow">→</span>${tile(f, `flipped to ${np}`, `heritage ${f.heritage?.kind}: ${f.heritage?.value}`)}</div>`;
  }).join("");
  return `<div class="fg"><h2>Flag gallery (0.15.1 grammar)</h2>
    <p class="tags">Synthetic samples, seed ${seed}. Large = 120×80, small = 24×16 (recognizable when small). Rules: ≤3 tinctures (4th only with a named tradition), metal-on-colour charges, contrast checked. See docs/flags.md.</p>
    <h3>Earth blocs (tradition base flags)</h3><div class="fg-grid">${earth}</div>
    <h3>Colonial daughters (inherit palette + layout family; specialty charge; differenced per colony)</h3><div class="fg-grid">${daughters}</div>
    <h3>Ideology on the same lineage</h3><div class="fg-grid">${ideos}</div>
    <h3>Independence: before → after (keeps one heritage colour) → a member of the same nation</h3>${pairs}
    <h3>Bloc flip (keeps heritage layout or colour)</h3>${flip}
    <h3>Small mode at real size 24×16 (route labels, map strip, card icons): 5 stripes, plain union, 6-dot ring, no specialty charge</h3>
    <div id="fgSmall" class="fg-smallgrid">${smalls.map((x) => `<div title="${esc(x.label)}">${flagDesignToSvg(x.d, 24, 16)}</div>`).join("")}</div></div>`;
}

function defaultIdeology(b: string): string { return IDEOLOGIES[b] ?? "Market Realism"; }
