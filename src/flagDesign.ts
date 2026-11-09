/**
 * 0.15.0 — Vexillological flag grammar (pure; renders to an SVG string; no DOM).
 * See docs/flags.md. Principles (NAVA "Good Flag, Bad Flag"): simple, meaningful,
 * 2–3 basic tinctures, rule of tincture / contrast, no lettering or seals,
 * distinctive but related. Deterministic from the inputs (game seed + colony state).
 */
import type { NodeType } from "./types.js";

// ---------- Tinctures (standard set + two space variants) ----------
export type Tincture = "argent" | "or" | "gules" | "azure" | "celeste" | "vert" | "sable" | "purpure" | "saffron" | "lunar" | "rust";
export const TINCTURES: Record<Tincture, { hex: string; metal: boolean }> = {
  argent: { hex: "#FFFFFF", metal: true },
  or: { hex: "#FCD116", metal: true },
  lunar: { hex: "#C9CED6", metal: true }, // Moon silver (variant of argent, used sparingly)
  gules: { hex: "#C8102E", metal: false },
  rust: { hex: "#A3401C", metal: false }, // Mars rust (variant of gules, used sparingly)
  azure: { hex: "#0033A0", metal: false },
  celeste: { hex: "#4B92DB", metal: false },
  vert: { hex: "#007A3D", metal: false },
  sable: { hex: "#000000", metal: false },
  purpure: { hex: "#5B2C83", metal: false },
  saffron: { hex: "#FF9933", metal: false },
};

export function relLum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}
export function contrast(a: Tincture, b: Tincture): number {
  const la = relLum(TINCTURES[a].hex), lb = relLum(TINCTURES[b].hex);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Charges must follow the rule of tincture (metal on colour / colour on metal) and contrast ≥ 3. */
export const MIN_CHARGE_CONTRAST = 3;
/** Adjacent field divisions must not be light-on-light or dark-on-dark (ratio ≥ 1.4). */
export const MIN_FIELD_CONTRAST = 1.4;
/** Pairs that vibrate / vanish even when the class rule passes (0.15.1: or-on-saffron). */
export const FORBIDDEN_PAIRS: [Tincture, Tincture][] = [["or", "saffron"]];
export function forbiddenPair(a: Tincture, b: Tincture): boolean {
  return FORBIDDEN_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}
export function chargeOk(fg: Tincture, bg: Tincture): boolean {
  return TINCTURES[fg].metal !== TINCTURES[bg].metal && contrast(fg, bg) >= MIN_CHARGE_CONTRAST && !forbiddenPair(fg, bg);
}
/** Adjacent fields: different, enough contrast, not a forbidden pair. */
export function fieldsOk(a: Tincture, b: Tincture): boolean {
  return a !== b && contrast(a, b) >= MIN_FIELD_CONTRAST && !forbiddenPair(a, b);
}
/** Layouts whose canton already carries the emblem: at most one extra charge outside it. */
export const ONE_EXTRA_LAYOUTS: Layout[] = ["starsStripes", "ensign"];

// ---------- Earth traditions (derived from the game's 14 blocs) ----------
export type Layout = "plain" | "tricolorV" | "tricolorH" | "bicolorH" | "bicolorV" | "nordic" | "ensign"
  | "starsStripes" | "hoistTriangle" | "chevron" | "disc" | "discBordure" | "corporateBars" | "bend";
export type ChargeKind = NodeType | "star" | "crescentStar" | "starRing" | "orbitRing" | "union";

export interface Tradition {
  /** Real-world tradition this bloc follows (for docs / gallery). */
  tradition: string;
  palette: Tincture[];
  base: Layout;
  baseCharge?: ChargeKind;
  /** Layout family daughters may use (colonial/derived designs). */
  daughters: Layout[];
  /** Optional second base charge in the fly (e.g. the Commonwealth star on the ensign). */
  baseFly?: ChargeKind;
  /** Justified 4th tincture on the base flag only. */
  extra?: { tincture: Tincture; why: string };
}

export const TRADITIONS: Record<string, Tradition> = {
  "United States": { tradition: "Stars and stripes (US)", palette: ["gules", "argent", "azure"], base: "starsStripes", baseCharge: "star", daughters: ["starsStripes", "ensign", "bicolorH"] },
  China: { tradition: "Communist red field with gold star (PRC)", palette: ["gules", "or"], base: "plain", baseCharge: "star", daughters: ["plain", "hoistTriangle", "bicolorV"] },
  SpaceX: { tradition: "Corporate minimal bars (US corporate)", palette: ["sable", "argent", "azure"], base: "corporateBars", daughters: ["corporateBars", "bicolorV"] },
  "Corporate China": { tradition: "Corporate minimal bars on socialist red/gold", palette: ["sable", "gules", "or"], base: "corporateBars", baseCharge: "star", daughters: ["corporateBars", "bicolorV"] },
  "European Union": { tradition: "Blue field with ring of gold stars; Nordic-cross and tricolour daughters (European)", palette: ["azure", "or", "argent"], base: "plain", baseCharge: "starRing", daughters: ["nordic", "tricolorV", "plain"] },
  "Russian Federation": { tradition: "Pan-Slavic white-blue-red tricolour", palette: ["argent", "azure", "gules"], base: "tricolorH", daughters: ["tricolorH", "tricolorV", "ensign"] },
  "Latin Federation": { tradition: "Pan-Iberian / Gran Colombia yellow-blue-red; ring of stars marks the federation (not Colombia/Ecuador)", palette: ["or", "azure", "gules"], base: "tricolorH", baseCharge: "starRing", daughters: ["tricolorH", "tricolorV", "hoistTriangle"] },
  "African Union": { tradition: "Pan-African green-gold-red; ring of black stars marks the union (not Ghana/Ethiopia)", palette: ["vert", "or", "gules"], base: "tricolorH", baseCharge: "starRing", daughters: ["tricolorH", "tricolorV", "hoistTriangle"], extra: { tincture: "sable", why: "Pan-African black stars (Ghana / Black Star tradition)" } },
  "New Caliphate": { tradition: "Islamic green with white crescent and star; Pan-Arab black-white-green", palette: ["vert", "argent", "sable"], base: "plain", baseCharge: "crescentStar", daughters: ["bicolorV", "tricolorH", "plain"] },
  "South Asian Commonwealth": { tradition: "Saffron-white-green tricolour with a ring of stars (South Asian union; not India's chakra)", palette: ["saffron", "argent", "vert"], base: "tricolorH", baseCharge: "starRing", daughters: ["tricolorH", "tricolorV", "bicolorV"] },
  "East Asian Pacific Alliance": { tradition: "East Asian sun disc inside a blue Pacific bordure (alliance mark; not Japan)", palette: ["argent", "gules", "azure"], base: "discBordure", daughters: ["disc", "bicolorH", "bend"] },
  "Dominion of Indochina": { tradition: "Red-blue-red with white disc (Indochinese)", palette: ["gules", "azure", "argent"], base: "tricolorH", baseCharge: "orbitRing", daughters: ["tricolorH", "disc", "bicolorH"] },
  "British Commonwealth": { tradition: "Ensign with union canton (Commonwealth / Blue Ensign lineage)", palette: ["azure", "argent", "gules"], base: "ensign", baseCharge: "union", baseFly: "star", daughters: ["ensign", "ensign", "nordic"] },
  "United Nations": { tradition: "UN light blue with white emblem (internationalist)", palette: ["celeste", "argent"], base: "plain", baseCharge: "orbitRing", daughters: ["plain", "bicolorH", "ensign"] },
};
const FALLBACK: Tradition = { tradition: "Generic", palette: ["sable", "argent", "or"], base: "bicolorH", daughters: ["bicolorH", "tricolorV", "bend"] };
export function traditionOf(bloc: string): Tradition { return TRADITIONS[bloc] ?? FALLBACK; }

// ---------- Ideology families (from the game's ideology list; hybrids "A-B" scanned) ----------
export type IdeologyFamily = "socialist" | "islamic" | "corporate" | "liberal" | "nationalist" | "developmental" | "technocratic" | "internationalist" | "pioneer" | "radical";
export function ideologyFamily(ideology: string): IdeologyFamily {
  const s = ideology.toLowerCase();
  if (/islam|caliph|faith/.test(s)) return "islamic";
  if (/corporate|platform/.test(s)) return "corporate";
  if (/social(ism|ist)|bolivarian|chinese socialism/.test(s)) return "socialist";
  if (/putin|conservat|sovereign/.test(s)) return "nationalist";
  if (/technocra/.test(s)) return "technocratic";
  if (/institution/.test(s)) return "internationalist";
  if (/develop|pragmatic/.test(s)) return "developmental";
  if (/situation/.test(s)) return "radical";
  if (/pioneer/.test(s)) return "pioneer";
  return "liberal"; // Democratic Free Market, Social Market, Liberal Constitutionalism, Plural Democracy, Market Realism…
}
/** Colours an ideology prefers (used for new nations and to tint daughters). */
const IDEO_TINCTURES: Record<IdeologyFamily, [Tincture, Tincture]> = {
  socialist: ["gules", "or"], islamic: ["vert", "argent"], corporate: ["sable", "argent"],
  liberal: ["azure", "argent"], nationalist: ["gules", "argent"], developmental: ["vert", "or"],
  technocratic: ["azure", "argent"], internationalist: ["celeste", "argent"], pioneer: ["purpure", "or"],
  radical: ["sable", "or"],
};

// ---------- Inputs ----------
export interface FlagInput {
  seed: number;
  id: string;
  /** Founding Earth bloc (lineage). */
  origin: string;
  /** Current patron bloc, or "Independent". */
  patron: string;
  ideology: string;
  specialty: NodeType;
  body: "Moon" | "Mars";
  /** For Independents: the nation's liege (its national flag is derived from the liege). */
  liege?: { id: string; origin: string; ideology: string } | null;
  /** True for the liege colony itself (its flag is the plain national flag + star). */
  isLiege?: boolean;
}

export interface FlagDesign {
  layout: Layout;
  palette: Tincture[];
  /** Region fills in drawing order (index into palette). */
  fields: number[];
  charges: { kind: ChargeKind; tincture: Tincture; bg: Tincture; x: number; y: number; r: number }[];
  adjacent: [Tincture, Tincture][];
  tinctures: Tincture[];
  justification?: string;
  heritage?: { kind: "color" | "layout"; value: string };
  era: "earth" | "colonial" | "independent" | "flipped";
  note: string;
}

// ---------- Hash ----------
export function fhash(...parts: (string | number)[]): number {
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return h >>> 0;
}

// ---------- Layout geometry (viewBox 300×200, 3:2) ----------
interface Geo { regions: string[]; adj: [number, number][]; slots: Record<string, { x: number; y: number; r: number; region: number }>; needs: number }
function geo(layout: Layout, small = false): Geo {
  switch (layout) {
    case "plain": return { needs: 1, regions: ["M0 0H300V200H0Z"], adj: [], slots: { canton: { x: 62, y: 52, r: 34, region: 0 }, centre: { x: 150, y: 100, r: 52, region: 0 }, fly: { x: 225, y: 100, r: 36, region: 0 } } };
    case "tricolorV": return { needs: 3, regions: ["M0 0H100V200H0Z", "M100 0H200V200H100Z", "M200 0H300V200H200Z"], adj: [[0, 1], [1, 2]], slots: { centre: { x: 150, y: 100, r: 40, region: 1 }, canton: { x: 50, y: 52, r: 30, region: 0 }, fly: { x: 250, y: 100, r: 30, region: 2 } } };
    case "tricolorH": return { needs: 3, regions: ["M0 0H300V67H0Z", "M0 67H300V133H0Z", "M0 133H300V200H0Z"], adj: [[0, 1], [1, 2]], slots: { centre: { x: 150, y: 100, r: 28, region: 1 }, canton: { x: 50, y: 33, r: 24, region: 0 }, fly: { x: 240, y: 100, r: 26, region: 1 } } };
    case "bicolorH": return { needs: 2, regions: ["M0 0H300V100H0Z", "M0 100H300V200H0Z"], adj: [[0, 1]], slots: { canton: { x: 60, y: 50, r: 34, region: 0 }, centre: { x: 150, y: 50, r: 34, region: 0 }, fly: { x: 240, y: 150, r: 32, region: 1 } } };
    case "bicolorV": return { needs: 2, regions: ["M0 0H100V200H0Z", "M100 0H300V200H100Z"], adj: [[0, 1]], slots: { canton: { x: 50, y: 100, r: 34, region: 0 }, centre: { x: 200, y: 100, r: 48, region: 1 }, fly: { x: 200, y: 100, r: 48, region: 1 } } };
    case "nordic": return { needs: 2, regions: ["M0 0H300V200H0Z", "M84 0H120V82H300V118H120V200H84V118H0V82H84Z"], adj: [[0, 1]], slots: { canton: { x: 42, y: 41, r: 26, region: 0 }, fly: { x: 215, y: 160, r: 26, region: 0 }, centre: { x: 215, y: 41, r: 26, region: 0 } } };
    case "ensign": return { needs: 2, regions: ["M0 0H300V200H0Z", "M0 0H150V100H0Z"], adj: [[0, 1]], slots: { canton: { x: 75, y: 50, r: 34, region: 1 }, fly: { x: 225, y: 120, r: 42, region: 0 }, centre: { x: 225, y: 120, r: 42, region: 0 } } };
    case "starsStripes": {
      // 13 stripes (7 coloured, starting at the top); small mode 5 (3 coloured). Canton spans 7/13 resp. 3/5.
      const n = small ? 5 : 13, sh = 200 / n;
      let stripes = "";
      for (let i = 0; i < n; i += 2) stripes += `M0 ${(i * sh).toFixed(2)}H300V${((i + 1) * sh).toFixed(2)}H0Z`;
      const ch = (small ? 3 : 7) * sh;
      const r: string[] = ["M0 0H300V200H0Z", stripes, `M0 0H130V${ch.toFixed(2)}H0Z`];
      return { needs: 3, regions: r, adj: [[0, 1], [2, 0], [2, 1]], slots: { canton: { x: 65, y: 54, r: 34, region: 2 }, fly: { x: 230, y: 150, r: 0, region: 0 }, centre: { x: 65, y: 54, r: 34, region: 2 } } };
    }
    case "hoistTriangle": return { needs: 3, regions: ["M0 0H300V100H0Z", "M0 100H300V200H0Z", "M0 0L130 100L0 200Z"], adj: [[0, 1], [0, 2], [1, 2]], slots: { canton: { x: 42, y: 100, r: 30, region: 2 }, centre: { x: 42, y: 100, r: 30, region: 2 }, fly: { x: 225, y: 50, r: 30, region: 0 } } };
    case "chevron": return { needs: 3, regions: ["M0 0H300V200H0Z", "M0 0L170 100L0 200Z", "M0 0L120 100L0 200Z"], adj: [[0, 1], [1, 2]], slots: { canton: { x: 38, y: 100, r: 28, region: 2 }, centre: { x: 38, y: 100, r: 28, region: 2 }, fly: { x: 240, y: 100, r: 34, region: 0 } } };
    case "disc": return { needs: 2, regions: ["M0 0H300V200H0Z", "M150 40A60 60 0 1 1 149.9 40Z"], adj: [[0, 1]], slots: { centre: { x: 150, y: 100, r: 40, region: 1 }, canton: { x: 150, y: 100, r: 40, region: 1 }, fly: { x: 255, y: 165, r: 22, region: 0 } } };
    case "discBordure": return { needs: 3, regions: ["M0 0H300V200H0Z", "M0 0H300V200H0ZM22 22V178H278V22Z", "M150 46A54 54 0 1 1 149.9 46Z"], adj: [[0, 1], [0, 2]], slots: { centre: { x: 150, y: 100, r: 36, region: 2 }, canton: { x: 150, y: 100, r: 36, region: 2 }, fly: { x: 248, y: 158, r: 14, region: 0 } } };
    case "corporateBars": return { needs: 3, regions: ["M0 0H300V200H0Z", "M0 150H300V164H0Z", "M0 174H300V182H0Z", "M24 24H72V72H24Z"], adj: [[0, 1], [0, 2], [0, 3]], slots: { canton: { x: 48, y: 48, r: 18, region: 3 }, centre: { x: 190, y: 80, r: 40, region: 0 }, fly: { x: 190, y: 80, r: 40, region: 0 } } };
    case "bend": return { needs: 3, regions: ["M0 0H300L0 200Z", "M300 0V200H0Z", "M0 170L255 0H300V30L45 200H0Z"], adj: [[0, 2], [1, 2]], slots: { canton: { x: 55, y: 50, r: 30, region: 0 }, centre: { x: 55, y: 50, r: 30, region: 0 }, fly: { x: 245, y: 150, r: 30, region: 1 } } };
  }
}
/** Which palette entry fills each region (by layout). */
function regionFill(layout: Layout, n: number): number[] {
  switch (layout) {
    case "plain": return [0];
    case "tricolorV": case "tricolorH": return n >= 3 ? [0, 1, 2] : [0, 1, 0];
    case "bicolorH": case "bicolorV": case "nordic": case "disc": return [0, 1];
    case "ensign": return [0, 1];
    case "starsStripes": return [1, 0, 2].map((x) => Math.min(x, n - 1)); // field argent, stripes gules, canton azure
    case "discBordure": return [0, Math.min(2, n - 1), 1]; // field, bordure, disc
    case "hoistTriangle": return [0, 1, Math.min(2, n - 1)];
    case "chevron": return [0, 1, Math.min(2, n - 1)];
    case "corporateBars": return [0, 1, Math.min(2, n - 1), Math.min(2, n - 1)];
    case "bend": return [0, Math.min(2, n - 1), 1];
  }
}

// ---------- Palette helpers ----------
function ensure(p: Tincture[], want: Tincture, keep: number): Tincture[] {
  if (p.includes(want)) return p;
  const out = p.slice(0, Math.max(keep, Math.min(p.length, 2)));
  if (out.length >= 3) out[2] = want; else out.push(want);
  return out.slice(0, 3);
}
function bodyVariant(p: Tincture[], body: "Moon" | "Mars", h: number): Tincture[] {
  if (h % 3 !== 0) return p; // sparingly: ~1 in 3 colonies
  if (body === "Mars" && p.includes("gules")) return p.map((t) => (t === "gules" ? "rust" : t));
  if (body === "Moon" && p.includes("argent")) return p.map((t) => (t === "argent" ? "lunar" : t));
  return p;
}
function hasBothClasses(p: Tincture[]): boolean {
  return p.some((t) => TINCTURES[t].metal) && p.some((t) => !TINCTURES[t].metal);
}
function fixClasses(p: Tincture[]): Tincture[] {
  if (hasBothClasses(p)) return p;
  const metalOnly = p.every((t) => TINCTURES[t].metal);
  return ensure(p, metalOnly ? "azure" : "argent", 1);
}
function nearestTincture(hex: string): Tincture {
  const n = parseInt(hex.replace("#", ""), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  let best: Tincture = "azure", bd = Infinity;
  for (const t of ["gules", "azure", "vert", "purpure", "saffron", "celeste", "sable", "or"] as Tincture[]) {
    const m = parseInt(TINCTURES[t].hex.slice(1), 16);
    const q = [(m >> 16) & 255, (m >> 8) & 255, m & 255];
    const d = (rgb[0]! - q[0]!) ** 2 + (rgb[1]! - q[1]!) ** 2 + (rgb[2]! - q[2]!) ** 2;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

/** Pick the palette tincture for a charge on `bg` (rule of tincture, best contrast). */
function chargeTincture(p: Tincture[], bg: Tincture, prefer?: Tincture): Tincture | null {
  if (prefer && chargeOk(prefer, bg) && p.includes(prefer)) return prefer;
  const ok = p.filter((t) => chargeOk(t, bg)).sort((a, b) => contrast(b, bg) - contrast(a, bg));
  return ok[0] ?? null;
}

// ---------- Assembly ----------
function assemble(layout: Layout, palette: Tincture[], order: number[], charges: { kind: ChargeKind; slot: string; prefer?: Tincture; tincture?: Tincture }[]): FlagDesign | null {
  const g = geo(layout);
  const pal = order.map((i) => palette[i % palette.length]!);
  const fills = regionFill(layout, pal.length).map((i) => pal[i]!);
  const adjacent: [Tincture, Tincture][] = g.adj.map(([a, b]) => [fills[a]!, fills[b]!]);
  if (adjacent.some(([a, b]) => !fieldsOk(a, b))) return null;
  const used = new Set<string>();
  const out: FlagDesign["charges"] = [];
  let extras = 0;
  for (const c of charges) {
    let slotName = c.slot;
    if (used.has(slotName)) slotName = ["centre", "fly", "canton"].find((s) => !used.has(s) && g.slots[s]!.r > 0) ?? slotName;
    const slot = g.slots[slotName]!;
    if (!slot || slot.r <= 0) continue;
    if (ONE_EXTRA_LAYOUTS.includes(layout) && slotName !== "canton") {
      if (extras >= 1) continue;
      extras++;
    }
    used.add(slotName);
    const bg = fills[slot.region]!;
    const t = c.tincture && chargeOk(c.tincture, bg) ? c.tincture : chargeTincture(pal, bg, c.prefer);
    if (!t) return null;
    out.push({ kind: c.kind, tincture: t, bg, x: slot.x, y: slot.y, r: slot.r });
  }
  const tinctures = [...new Set([...fills, ...out.map((c) => c.tincture)])];
  return { layout, palette: pal, fields: regionFill(layout, pal.length), charges: out, adjacent, tinctures, era: "colonial", note: "" };
}

function searchDesign(layouts: Layout[], palette: Tincture[], h: number, charges: { kind: ChargeKind; slot: string; prefer?: Tincture; tincture?: Tincture }[]): FlagDesign {
  const perms = [[0, 1, 2], [1, 0, 2], [2, 1, 0], [0, 2, 1], [1, 2, 0], [2, 0, 1]];
  for (let i = 0; i < layouts.length; i++) {
    const layout = layouts[(h + i) % layouts.length]!;
    for (let j = 0; j < perms.length; j++) {
      const perm = perms[((h >>> 4) + j) % perms.length]!.filter((x) => x < Math.max(palette.length, geo(layout).needs));
      const d = assemble(layout, palette, perm.length ? perm : [0, 1, 2], charges);
      if (d) return d;
    }
  }
  // Guaranteed fallback: plain colour field + metal charge (best-contrast pair; palette first).
  const colours = [...palette.filter((t) => !TINCTURES[t].metal), "azure", "sable"] as Tincture[];
  const metals = [...palette.filter((t) => TINCTURES[t].metal), "argent", "or"] as Tincture[];
  for (const colour of colours) for (const metal of metals) {
    if (!chargeOk(metal, colour)) continue;
    const d = assemble("plain", [colour, metal], [0, 1], charges.map((c, i) => ({ ...c, slot: i ? "fly" : "centre", tincture: metal })));
    if (d) return d;
  }
  return assemble("plain", ["azure", "argent"], [0, 1], [])!;
}

/** Earth bloc base flag (fixed per tradition). */
export function blocFlag(bloc: string): FlagDesign {
  const t = traditionOf(bloc);
  const charges: { kind: ChargeKind; slot: string; tincture?: Tincture }[] = t.baseCharge ? [{ kind: t.baseCharge, slot: t.base === "starsStripes" || t.base === "ensign" ? "canton" : t.base === "plain" && t.baseCharge === "star" ? "canton" : "centre", tincture: t.extra?.tincture }] : [];
  if (t.baseFly) charges.push({ kind: t.baseFly, slot: "fly" });
  let d = assemble(t.base, t.palette, [0, 1, 2], charges);
  if (!d) d = searchDesign([t.base], t.palette, 0, charges);
  d.era = "earth";
  d.note = t.tradition;
  if (t.extra && d.tinctures.length > 3) d.justification = t.extra.why;
  return d;
}

const CHARGE_SLOT_PREF: Record<Layout, string> = {
  plain: "centre", tricolorV: "centre", tricolorH: "centre", bicolorH: "canton", bicolorV: "canton", nordic: "canton",
  ensign: "fly", starsStripes: "canton", hoistTriangle: "canton", chevron: "canton", disc: "centre", discBordure: "centre", corporateBars: "centre", bend: "canton",
};

function ideologyCharge(f: IdeologyFamily): ChargeKind | null {
  return f === "socialist" ? "star" : f === "islamic" ? "crescentStar" : null;
}

/** Colony flag: colonial (daughter of origin), flipped (new patron, heritage layout) or independent. */
/** The bloc emblem a daughter may repeat (not the union canton or corporate marks). */
function lineageCharge(t: Tradition): ChargeKind | null {
  return t.baseCharge && t.baseCharge !== "union" && t.base !== "corporateBars" ? t.baseCharge : null;
}

export function colonyFlag(inp: FlagInput): FlagDesign {
  const fam = ideologyFamily(inp.ideology);
  const h = fhash(inp.seed, inp.id, inp.origin);
  const origin = traditionOf(inp.origin);
  const ideoCharge = ideologyCharge(fam);

  if (inp.patron === "Independent") {
    // Revolutionary national flag, derived from the liege (shared by the whole nation).
    const liege = inp.liege ?? { id: inp.id, origin: inp.origin, ideology: inp.ideology };
    const lfam = ideologyFamily(liege.ideology);
    const ltrad = traditionOf(liege.origin);
    const nh = fhash(inp.seed, "nation", liege.id);
    const heritage = ltrad.palette[0]!; // keep the founding bloc's primary colour
    let pal: Tincture[] = [heritage];
    for (const t of IDEO_TINCTURES[lfam]) if (!pal.includes(t)) pal.push(t);
    pal = fixClasses(pal.slice(0, 3));
    const layouts: Layout[] = (["hoistTriangle", "bend", "chevron", "bicolorH", "tricolorV"] as Layout[]).filter((l) => l !== ltrad.base);
    const lc = ideologyCharge(lfam) ?? "star";
    const charges: { kind: ChargeKind; slot: string }[] = inp.isLiege || inp.id === liege.id
      ? [{ kind: lc, slot: "canton" }]
      : [{ kind: lc, slot: "canton" }, { kind: inp.specialty, slot: "fly" }];
    const d = searchDesign(layouts, pal, nh, charges);
    d.era = "independent";
    d.heritage = { kind: "color", value: heritage };
    d.note = `Independent nation (liege ${liege.id}); keeps ${heritage} from ${liege.origin}`;
    return d;
  }

  if (inp.patron !== inp.origin) {
    // Bloc flip: new patron's colours, heritage = origin's layout.
    const nt = traditionOf(inp.patron);
    let pal = bodyVariant(nt.palette, inp.body, h);
    pal = fixClasses(pal);
    const lead = ideoCharge ?? lineageCharge(nt);
    const charges: { kind: ChargeKind; slot: string }[] = [{ kind: inp.specialty, slot: lead ? "fly" : CHARGE_SLOT_PREF[origin.base] }];
    if (lead) charges.unshift({ kind: lead, slot: "canton" });
    const d = searchDesign([origin.base, ...nt.daughters], pal, h, charges);
    d.era = "flipped";
    d.heritage = { kind: "layout", value: d.layout === origin.base ? origin.base : d.palette[0]! };
    if (d.layout !== origin.base) d.heritage = { kind: "color", value: d.palette.find((t) => origin.palette.includes(t)) ?? d.palette[0]! };
    d.note = `Flipped from ${inp.origin} to ${inp.patron}`;
    return d;
  }

  // Colonial daughter of the origin bloc: inherit palette + layout family, difference by hash.
  let pal: Tincture[] = origin.palette.slice();
  if (fam === "socialist") pal = ensure(pal, "gules", 2);
  if (fam === "islamic") pal = ensure(pal, "vert", 2);
  if (fam === "corporate") pal = ensure(["sable", ...pal.filter((t) => t !== "sable")], "sable", 1);
  pal = fixClasses(bodyVariant(pal, inp.body, h));
  let layouts = origin.daughters.slice();
  if (fam === "corporate") layouts = ["corporateBars", ...layouts];
  // Commonwealth lineage: most daughters fly the union in the canton (Blue Ensign tradition).
  if (origin.baseCharge === "union" && h % 3 !== 2) {
    const u = searchDesign(["ensign"], pal, h, [{ kind: "union", slot: "canton" }, { kind: inp.specialty, slot: "fly" }]);
    if (u.layout === "ensign") {
      u.era = "colonial"; u.heritage = { kind: "layout", value: "ensign" };
      u.note = `Daughter of ${inp.origin} (${origin.tradition})`;
      return u;
    }
  }
  // Lineage charge: with no ideology charge, daughters carry the bloc's emblem (e.g. the US star) so
  // colonies of different blocs with similar colours stay distinguishable.
  const lead = ideoCharge ?? lineageCharge(origin);
  const charges: { kind: ChargeKind; slot: string }[] = [];
  if (lead) charges.push({ kind: lead, slot: "canton" });
  charges.push({ kind: inp.specialty, slot: lead ? "fly" : CHARGE_SLOT_PREF[layouts[h % layouts.length]!] });
  const d = searchDesign(layouts, pal, h, charges);
  d.era = "colonial";
  d.heritage = { kind: "layout", value: d.layout };
  d.note = `Daughter of ${inp.origin} (${origin.tradition})`;
  return d;
}

// Small-mode variants (read at 24×16)
const SMALL_SHAPES: Record<string, (fill: string, bg: string) => string> = {
  union: (f, bg) => `<path d="M-2.2 -1.5L2.2 1.5M2.2 -1.5L-2.2 1.5" stroke="${f}" stroke-width="0.6"/><path d="M0 -1.5V1.5M-2.2 0H2.2" stroke="${bg === "#C8102E" ? "#0033A0" : "#C8102E"}" stroke-width="0.6"/>`,
  starRing: (f) => Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; return `<circle cx="${(Math.cos(a) * 0.72).toFixed(3)}" cy="${(Math.sin(a) * 0.72).toFixed(3)}" r="0.2" fill="${f}"/>`; }).join(""),
};

// ---------- Charges (unit shapes, centred at 0,0, radius 1) ----------
function starPath(r = 1, inner = 0.382, cx = 0, cy = 0): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    d += `${i ? "L" : "M"}${(cx + Math.cos(a) * rr).toFixed(3)} ${(cy + Math.sin(a) * rr).toFixed(3)}`;
  }
  return d + "Z";
}
const SHAPES: Record<string, (fill: string, bg: string) => string> = {
  star: (f) => `<path d="${starPath()}" fill="${f}"/>`,
  crescentStar: (f, bg) => `<circle cx="-0.15" cy="0" r="0.8" fill="${f}"/><circle cx="0.08" cy="-0.04" r="0.66" fill="${bg}"/><path d="${starPath(0.32, 0.4, 0.55, -0.05)}" fill="${f}"/>`,
  starRing: (f) => Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<path d="${starPath(0.17, 0.4, Math.cos(a) * 0.8, Math.sin(a) * 0.8)}" fill="${f}"/>`; }).join(""),
  orbitRing: (f) => `<circle r="0.78" fill="none" stroke="${f}" stroke-width="0.16"/><circle r="0.2" fill="${f}"/>`,
  union: (f, bg) => `<path d="M-2.2 -1.5L2.2 1.5M2.2 -1.5L-2.2 1.5" stroke="${f}" stroke-width="0.5"/><path d="M0 -1.5V1.5M-2.2 0H2.2" stroke="${f}" stroke-width="0.7"/><path d="M0 -1.5V1.5M-2.2 0H2.2" stroke="${bg === "#C8102E" ? "#0033A0" : "#C8102E"}" stroke-width="0.35"/>`,
  Water: (f) => `<path d="M0 -1C0.5 -0.3 0.75 0.1 0.75 0.4A0.75 0.75 0 0 1 -0.75 0.4C-0.75 0.1 -0.5 -0.3 0 -1Z" fill="${f}"/>`,
  Oxygen: (f) => `<circle cx="-0.35" cy="0.25" r="0.45" fill="none" stroke="${f}" stroke-width="0.18"/><circle cx="0.45" cy="-0.35" r="0.32" fill="none" stroke="${f}" stroke-width="0.16"/>`,
  Food: (f) => `<path d="M0 1V-0.9" stroke="${f}" stroke-width="0.14"/>${[-0.55, -0.15, 0.25].map((y) => `<ellipse cx="-0.22" cy="${y}" rx="0.2" ry="0.32" transform="rotate(-30 -0.22 ${y})" fill="${f}"/><ellipse cx="0.22" cy="${y}" rx="0.2" ry="0.32" transform="rotate(30 0.22 ${y})" fill="${f}"/>`).join("")}`,
  Energy: (f) => `<path d="M0.2 -1L-0.55 0.15H-0.05L-0.2 1L0.55 -0.15H0.05Z" fill="${f}"/>`,
  Resources: (f) => `<path d="M0 -0.95L0.85 -0.45V0.45L0 0.95L-0.85 0.45V-0.45Z" fill="${f}"/>`,
  Infrastructure: (f) => `<path d="M-0.7 0.95L-0.25 -0.95H0.25L0.7 0.95H0.35L0 -0.35L-0.35 0.95Z" fill="${f}"/><path d="M-0.5 0.2H0.5" stroke="${f}" stroke-width="0.14"/>`,
  Population: (f) => `<circle cx="0" cy="-0.45" r="0.28" fill="${f}"/><circle cx="-0.55" cy="0.2" r="0.24" fill="${f}"/><circle cx="0.55" cy="0.2" r="0.24" fill="${f}"/><path d="M-0.95 0.95A0.95 0.6 0 0 1 0.95 0.95Z" fill="${f}"/>`,
  Culture: (f) => `<path d="M-0.85 0.9V-0.1A0.85 0.85 0 0 1 0.85 -0.1V0.9H0.5V-0.05A0.5 0.5 0 0 0 -0.5 -0.05V0.9Z" fill="${f}"/>`,
  Ideology: (f) => `<path d="M0 -1C0.5 -0.4 0.55 0 0.3 0.35C0.45 0.1 0.2 -0.15 0 -0.3C-0.15 0 -0.3 0.1 -0.2 0.4C-0.55 0 -0.4 -0.5 0 -1Z" fill="${f}"/><path d="M-0.25 0.5H0.25L0.15 1H-0.15Z" fill="${f}"/>`,
  Money: (f) => `<circle r="0.85" fill="none" stroke="${f}" stroke-width="0.2"/><path d="M-0.35 0H0.35M0 -0.45V0.45" stroke="${f}" stroke-width="0.18"/>`,
  Logistics: (f) => `<ellipse rx="0.95" ry="0.4" fill="none" stroke="${f}" stroke-width="0.14" transform="rotate(-25)"/><circle r="0.32" fill="${f}"/>`,
  Science: (f) => `<path d="M-0.2 -0.95H0.2V-0.3L0.75 0.85H-0.75L-0.2 -0.3Z" fill="${f}"/>`,
  Production: (f, bg) => `<path d="${Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; const b = a + 0.25; return `${i ? "L" : "M"}${(Math.cos(a - 0.2) * 0.95).toFixed(3)} ${(Math.sin(a - 0.2) * 0.95).toFixed(3)}L${(Math.cos(b) * 0.95).toFixed(3)} ${(Math.sin(b) * 0.95).toFixed(3)}L${(Math.cos(b + 0.25) * 0.7).toFixed(3)} ${(Math.sin(b + 0.25) * 0.7).toFixed(3)}L${(Math.cos(a + 0.55) * 0.7).toFixed(3)} ${(Math.sin(a + 0.55) * 0.7).toFixed(3)}`; }).join("")}Z" fill="${f}"/><circle r="0.3" fill="${bg}"/>`,
  Military: (f) => `<path d="M0 -0.95L0.8 -0.65V0.05C0.8 0.55 0.4 0.85 0 1C-0.4 0.85 -0.8 0.55 -0.8 0.05V-0.65Z" fill="${f}"/>`,
  Stability: (f) => `<path d="M-0.7 -0.9H0.7V-0.65H0.45V0.65H0.7V0.9H-0.7V0.65H-0.45V-0.65H-0.7Z" fill="${f}"/>`,
  Subversion: (f, bg) => `<path d="M-1 0C-0.5 -0.65 0.5 -0.65 1 0C0.5 0.65 -0.5 0.65 -1 0Z" fill="${f}"/><circle r="0.3" fill="${bg}"/>`,
  Terraforming: (f, bg) => `<circle r="0.55" fill="${f}"/><ellipse rx="1" ry="0.28" fill="none" stroke="${f}" stroke-width="0.12" transform="rotate(-20)"/><path d="M-0.15 -0.1C0 -0.45 0.3 -0.35 0.25 -0.05C0.1 0.05 -0.05 0.05 -0.15 -0.1Z" fill="${bg}"/>`,
  Thrust: (f) => `<path d="M0 -1C0.35 -0.6 0.4 -0.1 0.3 0.4H-0.3C-0.4 -0.1 -0.35 -0.6 0 -1Z" fill="${f}"/><path d="M-0.3 0.15L-0.6 0.7H-0.3ZM0.3 0.15L0.6 0.7H0.3ZM-0.15 0.55H0.15L0 1Z" fill="${f}"/>`,
  Projects: (f, bg) => `<path d="M-0.85 -0.85H0.85V0.85H-0.85Z" fill="${f}"/><path d="M-0.45 -0.45H0.45V0.45H-0.45Z" fill="${bg}"/><path d="M-0.2 -0.2H0.2V0.2H-0.2Z" fill="${f}"/>`,
};

/** Flag keyline (0.15.1: lighter so dark flags separate from the #0B0F14 UI). */
export const FLAG_KEYLINE = "#5A6B7D";
/** Widths at or below this render in small mode. */
export const SMALL_FLAG_MAX_W = 30;
const isSpecialty = (k: ChargeKind) => !["star", "crescentStar", "starRing", "orbitRing", "union"].includes(k);

/**
 * Render a design. Small mode (auto when w ≤ 30, e.g. route labels, map strip, card icons):
 * 5 stripes instead of 13, union without fimbriation, star ring → 6 dots, no specialty charge
 * (layout + ideology/lineage emblem stay).
 */
export function flagDesignToSvg(d: FlagDesign, w = 30, h = 20, title?: string, opts?: { small?: boolean }): string {
  const small = opts?.small ?? w <= SMALL_FLAG_MAX_W;
  const g = geo(d.layout, small);
  const fills = d.fields.map((i) => TINCTURES[d.palette[i]!].hex);
  let body = g.regions.map((p, i) => `<path d="${p}" fill="${fills[i]}"/>`).join("");
  for (const c of d.charges) {
    if (small && isSpecialty(c.kind)) continue;
    const fn = (small && SMALL_SHAPES[c.kind]) || (SHAPES[c.kind] ?? SHAPES.star!);
    // union canton fills its slot box instead of a round charge
    const scale = c.r;
    body += `<g transform="translate(${c.x} ${c.y}) scale(${scale.toFixed(2)})">${fn(TINCTURES[c.tincture].hex, TINCTURES[c.bg].hex)}</g>`;
  }
  const t = title ? `<title>${title.replace(/</g, "&lt;")}</title>` : "";
  return `<svg class="flag" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 300 200" aria-hidden="true">${t}${body}<rect width="300" height="200" fill="none" stroke="${FLAG_KEYLINE}" stroke-width="${(300 / w).toFixed(1)}"/></svg>`;
}
