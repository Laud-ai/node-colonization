/**
 * 0.13.0 — deterministic colony sites on the Moon / Mars globes.
 * Pure (no DOM / three.js): reads ids + seed only, never touches sim state.
 * Sites are hash(seed, body, colony id, attempt) → lat/lon with a minimum
 * angular spacing against already-placed sites, so they are stable across turns.
 */
import { BELT_ROCKS } from "./beltRocks.js";
export type SiteBody = "Moon" | "Mars" | "Belt";
/** 0.20.0: `rock` = which named asteroid (belt only). */
export interface Site { lat: number; lon: number; rock?: string }

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
function unit(seed: number, body: string, id: string, k: number, salt: string): number {
  return hash32(`${seed}|${body}|${id}|${k}|${salt}`) / 4294967296;
}
const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

/** Area-uniform latitude within [lo, hi] degrees. */
function bandLat(u: number, lo: number, hi: number): number {
  const a = Math.sin(rad(lo)), b = Math.sin(rad(hi));
  return deg(Math.asin(a + (b - a) * u));
}

/** Candidate site with plausible siting bias (bonus, purely cosmetic). */
export function candidateSite(seed: number, body: SiteBody, id: string, k: number): Site {
  const pick = unit(seed, body, id, k, "band");
  const u = unit(seed, body, id, k, "lat");
  const lon = unit(seed, body, id, k, "lon") * 360 - 180;
  let lat: number;
  if (body === "Moon") {
    // Lunar south-polar region (ice) favoured, then anywhere.
    lat = pick < 0.5 ? bandLat(u, -88, -50) : pick < 0.62 ? bandLat(u, 50, 88) : bandLat(u, -50, 50);
  } else if (body === "Belt") {
    // 0.20.0: pick a named asteroid (weighted: Ceres / Vesta / Psyche favoured), then any latitude band
    const total = BELT_ROCKS.reduce((s, r) => s + r.weight, 0);
    let w = unit(seed, body, id, 0, "rock") * total; // rock fixed per colony (attempt 0), site varies with k
    let rock = BELT_ROCKS[0]!.name;
    for (const r of BELT_ROCKS) { if ((w -= r.weight) < 0) { rock = r.name; break; } }
    return { lat: bandLat(u, -60, 60), lon, rock };
  } else {
    // Mars: low–mid latitudes (warmth, landing), occasional mid-high (ice).
    lat = pick < 0.8 ? bandLat(u, -40, 45) : bandLat(u, -65, 65);
  }
  return { lat, lon };
}

/** Great-circle angle in degrees. */
export function angularDistance(a: Site, b: Site): number {
  const p1 = rad(a.lat), p2 = rad(b.lat), dl = rad(b.lon - a.lon);
  const c = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
  return deg(Math.acos(Math.max(-1, Math.min(1, c))));
}

export const MIN_SPACING_DEG = 10;

/**
 * Remembers sites per game. Call place() each render with the current colonies;
 * existing ids keep their site forever (also after destruction), new ids are
 * placed in id order away from every reserved site.
 */
export class SiteBook {
  private sites = new Map<string, Site & { body: SiteBody }>();
  constructor(readonly seed: number) {}

  get(id: string): Site | undefined { return this.sites.get(id); }

  place(cols: { id: string; body: SiteBody }[]): Map<string, Site> {
    const fresh = cols.filter((c) => !this.sites.has(c.id))
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    for (const c of fresh) this.sites.set(c.id, { ...this.pick(c.id, c.body), body: c.body });
    const out = new Map<string, Site>();
    for (const c of cols) out.set(c.id, this.sites.get(c.id)!);
    return out;
  }

  private pick(id: string, body: SiteBody): Site {
    const taken = [...this.sites.values()].filter((s) => s.body === body
      && (body !== "Belt" || s.rock === candidateSite(this.seed, body, id, 0).rock));
    let best: Site | null = null, bestD = -1;
    for (let k = 0; k < 64; k++) {
      const s = candidateSite(this.seed, body, id, k);
      const d = taken.length ? Math.min(...taken.map((t) => angularDistance(s, t))) : 180;
      if (d >= (body === "Belt" ? 28 : MIN_SPACING_DEG)) return s;
      if (d > bestD) { bestD = d; best = s; }
    }
    return best!;
  }
}
