/** L6 (0.11.0) — procedural flags + solar map, Solar Realist aesthetic (muted, utilitarian). */
const PALETTE = ["#d6c7a1", "#2f3b45", "#b5523b", "#e8e4d8", "#5f7a61", "#c9a227", "#1d2a33", "#7d8b99"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Deterministic flag from identity (culture/ideology/name) + nation color. */
export function flagSvg(key: string, nationColor: string, w = 30, h = 20): string {
  const x = hash(key);
  const a = nationColor || PALETTE[x % 8]!;
  const b = PALETTE[(x >>> 3) % 8]!;
  const c = PALETTE[(x >>> 6) % 8]!;
  const layout = (x >>> 9) % 5;
  let body = "";
  if (layout === 0) body = `<rect width="${w}" height="${h / 3}" fill="${a}"/><rect y="${h / 3}" width="${w}" height="${h / 3}" fill="${b}"/><rect y="${(2 * h) / 3}" width="${w}" height="${h / 3}" fill="${c}"/>`;
  else if (layout === 1) body = `<rect width="${w / 3}" height="${h}" fill="${a}"/><rect x="${w / 3}" width="${w / 3}" height="${h}" fill="${b}"/><rect x="${(2 * w) / 3}" width="${w / 3}" height="${h}" fill="${c}"/>`;
  else if (layout === 2) body = `<rect width="${w}" height="${h}" fill="${b}"/><rect width="${w / 2}" height="${h / 2}" fill="${a}"/><circle cx="${w / 4}" cy="${h / 4}" r="${h / 8}" fill="${c}"/>`;
  else if (layout === 3) body = `<rect width="${w}" height="${h}" fill="${a}"/><polygon points="0,${h} ${w},0 ${w},${h}" fill="${b}"/>`;
  else body = `<rect width="${w}" height="${h}" fill="${b}"/><circle cx="${w / 2}" cy="${h / 2}" r="${h / 3}" fill="none" stroke="${a}" stroke-width="2"/><circle cx="${w / 2}" cy="${h / 2}" r="${h / 9}" fill="${c}"/>`;
  return `<svg class="flag" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${body}<rect width="${w}" height="${h}" fill="none" stroke="#0008"/></svg>`;
}

export interface MapColony { id: string; name: string; body: string; nationColor: string; independent: boolean; projects: string[] }

/** Simple Earth–Moon–Mars strip with colony markers and TF bars. */
export function solarMapSvg(cols: MapColony[], tf: Record<string, number>, selectedId: string | null): string {
  const W = 520, H = 150;
  const bodies = [
    { id: "Earth", x: 60, r: 26, fill: "#3d5a73" },
    { id: "Moon", x: 200, r: 14, fill: "#9a968c" },
    { id: "Mars", x: 400, r: 20, fill: "#a4553a" },
  ];
  let s = `<svg class="solar-map" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Solar map">`;
  s += `<rect width="${W}" height="${H}" fill="#14191e"/>`;
  s += `<line x1="60" y1="60" x2="400" y2="60" stroke="#3a444d" stroke-dasharray="4 4"/>`;
  for (const b of bodies) {
    s += `<circle cx="${b.x}" cy="60" r="${b.r}" fill="${b.fill}"/><text x="${b.x}" y="${60 + b.r + 14}" fill="#d6c7a1" font-size="11" text-anchor="middle" font-family="monospace">${b.id.toUpperCase()}</text>`;
    if (b.id !== "Earth") {
      const t = Math.min(10, tf[b.id] || 0);
      s += `<rect x="${b.x - 25}" y="${60 + b.r + 20}" width="50" height="5" fill="#2f3b45"/><rect x="${b.x - 25}" y="${60 + b.r + 20}" width="${t * 5}" height="5" fill="#5f7a61"/>`;
      const here = cols.filter((c) => c.body === b.id);
      here.forEach((c, i) => {
        const ang = (i / Math.max(1, here.length)) * Math.PI * 2;
        const rr = b.r + 9 + (i % 2) * 6;
        const cx = b.x + Math.cos(ang) * rr, cy = 60 + Math.sin(ang) * rr;
        const stroke = c.id === selectedId ? "#fff" : c.independent ? "#c9a227" : "#000";
        s += `<circle data-id="${c.id}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${c.projects.length ? 5 : 4}" fill="${c.nationColor}" stroke="${stroke}" stroke-width="1.5"><title>${c.name}${c.independent ? " (Independent)" : ""}${c.projects.length ? " · " + c.projects.join(", ") : ""}</title></circle>`;
      });
    }
  }
  s += `<text x="8" y="${H - 6}" fill="#7d8b99" font-size="9" font-family="monospace">TF bar → livable at 10 · gold ring = Independent · large dot = has Project</text></svg>`;
  return s;
}
