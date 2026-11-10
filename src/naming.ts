/**
 * Evocative modular colony naming (0.7.3).
 * Culture-rooted proper nouns / myths / heroes + specialty flavor + light ideology,
 * assembled via weighted templates — Solar Realist hand-sim vibe, fully seeded/random.
 */

import { chance, pick, type Rng } from "./rng.js";
import type { Body, GameState, NodeType } from "./types.js";

/** Culture family keys for name banks. */
export type CultureFamily =
  | "American"
  | "Corporate American"
  | "Chinese"
  | "Corporate Chinese"
  | "Russian"
  | "European"
  | "African"
  | "Latin"
  | "Caliphate"
  | "South Asian"
  | "East Asian"
  | "Indochinese"
  | "British"
  | "UN"
  | "Independent"
  | "Mixed";

export interface CultureBank {
  roots: readonly string[];
  /** Culture-appropriate prefixes (Fort, Baza, Omni-, …). Empty = none. */
  prefixes: readonly string[];
  /** Corporate-style prefixes (Omni-, Helix-). Used by corporate templates. */
  corpPrefixes?: readonly string[];
}

/** Specialty → mid-name flavor terms (can sit like “Lunar Research Station”). */
export const SPECIALTY_TERMS: Record<NodeType, readonly string[]> = {
  Resources: ["Extraction", "Mining", "Ore"],
  Infrastructure: ["Works", "Civic", "Foundry"],
  Water: ["Hydro", "Aquifer", "Ice"],
  Oxygen: ["Atmo", "Breath", "Air"],
  Food: ["Agro", "Harvest", "Grain"],
  Energy: ["Power", "Reactor", "Grid"],
  Population: ["Hab", "Settlement", "Cradle"],
  Culture: ["Heritage", "Arts", "Memory"],
  Ideology: ["Doctrine", "Mandate", "Creed"],
  Money: ["Credit", "Exchange", "Market"],
  Logistics: ["Haul", "Transit", "Depot"],
  Science: ["Research", "Lab", "Observatory"],
  Production: ["Foundry", "Forge", "Fabrication"],
  Military: ["Garrison", "Defense", "Watch"],
  Stability: ["Order", "Harmony", "Keep"],
  Subversion: ["Influence", "Shadow", "Network"],
  Terraforming: ["Terraforming", "Bloom", "Garden"],
  Thrust: ["Transit", "Launch", "Orbital"],
  Projects: ["Works", "Venture", "Initiative"],
};

/** Backward-compat primary flavor token (first specialty term). */
export const SPECIALTY_FLAVOR: Record<NodeType, string> = Object.fromEntries(
  (Object.keys(SPECIALTY_TERMS) as NodeType[]).map((k) => [k, SPECIALTY_TERMS[k]![0]!])
) as Record<NodeType, string>;

/** Short ideology hints used sparsely (~25%). */
export const IDEOLOGY_HINTS: Record<string, string> = {
  "Democratic Free Market": "Market",
  "Chinese Socialism": "Socialist",
  "Corporate Pioneerism": "Pioneer",
  "Platform Socialism": "Platform",
  "Technocratic Pioneerism": "Technocrat",
  "Corporate Socialism": "Corp",
  "Social Market": "Social",
  Putinism: "Sovereign",
  "Bolivarian Mix": "Bolivarian",
  Developmentalism: "Developmental",
  "Political Islam": "Faith",
  "Plural Democracy": "Plural",
  "Developmental Conservatism": "Conserv",
  "Pragmatic Developmentalism": "Pragmatic",
  "Liberal Constitutionalism": "Liberal",
  "Global Institutionalism": "Institutional",
  Situationism: "Situationist",
  "Market Realism": "Market",
  Technocracy: "Technate",
  Pioneerism: "Pioneer",
  Socialism: "Socialist",
};

/** @deprecated alias — same map as IDEOLOGY_HINTS */
export const IDEOLOGY_NAME_HINT = IDEOLOGY_HINTS;

export const BODY_TERMS: Record<Body, readonly string[]> = {
  Moon: ["Lunar", "Moon", "of the Moon", "Selene"],
  Mars: ["Martian", "Mars", "of Mars", "Ares"],
  Belt: ["Belter", "Belt", "of the Belt", "Ceres"],
};

export const SUFFIXES = [
  "Colony",
  "Outpost",
  "Settlement",
  "Station",
  "Base",
  "Hab",
  "Works",
] as const;

/** Collision markers (used sparingly after serial > 1). */
const COLLISION_MARKERS = ["II", "2", "Beta", "3"] as const;

// ─── Culture banks ───────────────────────────────────────────────────────────

export const CULTURE_BANKS: Record<CultureFamily, CultureBank> = {
  American: {
    roots: [
      "Armstrong", "Pioneer", "Liberty", "Columbia", "Jefferson", "Franklin",
      "Lincoln", "Apollo", "Freedom", "Horizon", "Frontier", "Eagle",
      "Independence", "York", "Adams", "Kennedy", "Trailblazer", "Summit",
    ],
    prefixes: ["Fort", "Port", "New", "Camp"],
  },
  "Corporate American": {
    roots: [
      "Helix", "Apex", "Nova", "Orbit", "Vector", "Summit", "Pioneer",
      "Horizon", "Pulse", "Atlas", "Vertex", "Stride", "Nexus", "Prism",
    ],
    prefixes: ["New", "Port"],
    corpPrefixes: ["Omni-", "Helix-", "Apex-", "Nova-", "Orbit-", "Vector-", "Nexus-"],
  },
  Chinese: {
    roots: [
      "Guanghan", "Nüwa", "Huaxia", "Chang'e", "Tiangong", "Jade",
      "Heavenly", "Silk", "Dragon", "Phoenix", "Harmony", "Zhonghua",
      "Yutu", "Kunlun", "Fuxi", "Xuannu", "Shenzhou", "Celestial",
    ],
    prefixes: [], // classical Chinese roots often stand alone
  },
  "Corporate Chinese": {
    roots: [
      "Helix", "Dragon", "Jade", "Platform", "Lattice", "Horizon",
      "Phoenix", "Nexus", "Pulse", "Apex", "Silk", "Vertex", "Prism",
    ],
    prefixes: [],
    corpPrefixes: ["Omni-", "Helix-", "Apex-", "Platform-", "Lattice-", "Nexus-", "Jade-"],
  },
  Russian: {
    roots: [
      "Korolyova", "Gagarin", "Tsiolkovsky", "Mir", "Zarya", "Siberia",
      "Volga", "Baikal", "Soyuz", "Rodina", "Cosmos", "Kaluga",
      "Novaya", "Sputnik", "Vostok", "Laika",
    ],
    prefixes: ["Baza", "Port", "Novaya", "Stanitsa"],
  },
  European: {
    roots: [
      "Ariane", "Horizon", "Athena", "Prometheus", "Europa", "Da Vinci",
      "Kepler", "Copernicus", "Olympia", "Lumen", "Sol", "Aurora",
      "Charlemagne", "Rhine", "Athenaeum",
    ],
    prefixes: ["Fort", "Port", "New", "Station"],
  },
  African: {
    roots: [
      "Ubuntu", "Nkrumah", "Sahara", "Kilimanjaro", "Axum", "Mansa",
      "Sankofa", "Nile", "Zulu", "Harlem", "Baobab", "Imhotep",
      "Mandela", "Asmara", "Timbuktu",
    ],
    prefixes: ["Port", "New", "Camp", "Fort"],
  },
  Latin: {
    roots: [
      "Bolívar", "Andes", "Quetzal", "Inca", "Patagonia", "Libre",
      "Sol", "Cordillera", "Maya", "Amazon", "Gaucho", "Aztec",
      "Pachamama", "Condor", "Tenochtitlan",
    ],
    prefixes: ["Puerto", "Nueva", "Fort", "Camp"],
  },
  Caliphate: {
    roots: [
      "Andalus", "Nur", "Qibla", "Hijra", "Rashidun", "Zahra",
      "Falak", "Ibn Sina", "Miraj", "Safa", "Ummah", "Qamar",
      "Al-Biruni", "Fajr", "Masarra",
    ],
    prefixes: ["Port", "New", "Bayt"],
  },
  "South Asian": {
    roots: [
      "Aryabhata", "Ashoka", "Indus", "Ganga", "Vikram", "Chandra",
      "Surya", "Agni", "Bodhi", "Nalanda", "Kalpana", "Bhaskara",
      "Tagore", "Himalaya", "Saraswati",
    ],
    prefixes: ["Port", "New", "Fort", "Sri"],
  },
  "East Asian": {
    roots: [
      "Horizon", "Sakura", "Hikari", "Pacific", "Han", "Joseon",
      "Fuji", "Sejong", "Meiji", "Yamato", "Busan", "Taipei",
      "Pacific Rim", "Sunrise", "Kibo",
    ],
    prefixes: ["Port", "New", "Fort"],
  },
  Indochinese: {
    roots: [
      "Mekong", "Angkor", "Lotus", "Saigon", "Champa", "Irrawaddy",
      "Halong", "Lan Xang", "Borobudur", "Srivijaya", "Pagan", "Tonle",
    ],
    prefixes: ["Port", "New", "Fort"],
  },
  British: {
    roots: [
      "Churchill", "Victoria", "Endeavour", "Albion", "Britannia",
      "Drake", "Scott", "Nelson", "Commonwealth", "Crown", "Thames",
      "Wellington", "Cook", "Faraday",
    ],
    prefixes: ["Fort", "Port", "New", "HM"],
  },
  UN: {
    roots: [
      "Concord", "Unity", "Horizon", "Peace", "Charter", "Geneva",
      "Athena", "Sol", "Commons", "Mandate", "Assembly", "Beacon",
    ],
    prefixes: ["Station", "Port", "New", "Camp"],
  },
  Independent: {
    roots: [
      "Horizon", "Freehold", "Outland", "Commons", "Exile", "Frontier",
      "Drift", "Refuge", "Autonomy", "Wander", "Solace", "Breakaway",
    ],
    prefixes: ["Port", "New", "Camp", "Free"],
  },
  Mixed: {
    roots: [
      "Horizon", "Concord", "Frontier", "Aurora", "Sol", "Nexus",
      "Summit", "Beacon", "Cradle", "Drift",
    ],
    prefixes: ["Port", "New", "Camp"],
  },
};

/** Map culture tag (and optional patron) → culture family bank key. */
export function resolveCultureFamily(culture: string, patron?: string | null): CultureFamily {
  const c = (culture || "").trim();
  if (c === "Corporate American" || c.startsWith("Corporate American")) return "Corporate American";
  if (c === "Corporate Chinese" || c.startsWith("Corporate Chinese")) return "Corporate Chinese";
  if (c === "American" || c === "Neo-American") return "American";
  if (c === "Chinese") return "Chinese";
  if (c === "Russian") return "Russian";
  if (c === "European") return "European";
  if (c === "African") return "African";
  if (c === "Latin") return "Latin";
  if (c === "Caliphate") return "Caliphate";
  if (c === "South Asian") return "South Asian";
  if (c === "East Asian") return "East Asian";
  if (c === "Indochinese") return "Indochinese";
  if (c === "British" || c === "Commonwealth") return "British";
  if (c === "UN" || c === "International") return "UN";
  if (c === "Independent") return "Independent";
  // "Mixed" / empty → fall through to patron (Independent founding may carry founder culture)

  // Patron fallback
  if (patron === "SpaceX") return "Corporate American";
  if (patron === "Corporate China") return "Corporate Chinese";
  if (patron === "United States") return "American";
  if (patron === "China") return "Chinese";
  if (patron === "Russian Federation") return "Russian";
  if (patron === "European Union") return "European";
  if (patron === "African Union") return "African";
  if (patron === "Latin Federation") return "Latin";
  if (patron === "New Caliphate") return "Caliphate";
  if (patron === "South Asian Commonwealth") return "South Asian";
  if (patron === "East Asian Pacific Alliance") return "East Asian";
  if (patron === "Dominion of Indochina") return "Indochinese";
  if (patron === "British Commonwealth") return "British";
  if (patron === "United Nations") return "UN";
  if (patron === "Independent") return "Independent";

  // Fuzzy: contains
  const lower = c.toLowerCase();
  if (lower.includes("corporate") && lower.includes("american")) return "Corporate American";
  if (lower.includes("corporate") && lower.includes("chinese")) return "Corporate Chinese";
  if (lower.includes("american")) return "American";
  if (lower.includes("chinese")) return "Chinese";
  if (lower.includes("russian")) return "Russian";
  if (lower.includes("european")) return "European";
  if (lower.includes("african")) return "African";
  if (lower.includes("latin") || lower.includes("bolivar")) return "Latin";
  if (lower.includes("caliph") || lower.includes("arab") || lower.includes("islam")) return "Caliphate";
  if (lower.includes("south asian") || lower.includes("indian")) return "South Asian";
  if (lower.includes("east asian") || lower.includes("pacific") || lower.includes("korean") || lower.includes("japan")) return "East Asian";
  if (lower.includes("indochin") || lower.includes("vietnam") || lower.includes("mekong")) return "Indochinese";
  if (lower.includes("british") || lower.includes("commonwealth")) return "British";
  if (lower.includes("un ") || lower === "un" || lower.includes("international")) return "UN";

  return "Mixed";
}

function isCorporateFamily(fam: CultureFamily): boolean {
  return fam === "Corporate American" || fam === "Corporate Chinese";
}

function joinParts(parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => !!p && p.trim().length > 0)
    .map((p) => p.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Avoid ugly doubles like "Transit Transit" or "Colony Colony". */
function avoidDoubles(parts: string[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    const prev = out[out.length - 1];
    if (prev && prev.toLowerCase() === p.toLowerCase()) continue;
    // Also skip if previous already ends with this word (e.g. Omni-Helix + Helix)
    if (prev && prev.replace(/-$/, "").toLowerCase() === p.toLowerCase()) continue;
    out.push(p);
  }
  return out;
}

function pickIdeologyHint(ideology: string | null | undefined, rng: Rng): string | null {
  if (!ideology) return null;
  if (!chance(rng, 0.25)) return null;
  return (
    IDEOLOGY_HINTS[ideology]
    || ideology.split(/\s+/).find((w) => w.length > 3)
    || null
  );
}

function pickSpecialty(specialty: NodeType, rng: Rng): string {
  const pool = SPECIALTY_TERMS[specialty] || [specialty];
  return pick(rng, pool);
}

function pickBody(body: Body, rng: Rng): string {
  return pick(rng, BODY_TERMS[body]);
}

function pickSuffix(rng: Rng): string {
  return pick(rng, SUFFIXES);
}

/**
 * Assemble a modular evocative name.
 * Weights (approximate): root always; specialty ~70%; body ~40%; ideology ~25%; suffix ~50%.
 */
export function assembleColonyName(
  rng: Rng,
  opts: {
    family: CultureFamily;
    specialty: NodeType;
    body: Body;
    ideology?: string | null;
  }
): string {
  const bank = CULTURE_BANKS[opts.family] || CULTURE_BANKS.Mixed;
  const root = pick(rng, bank.roots);
  const useSpecialty = chance(rng, 0.70);
  const useBody = chance(rng, 0.40);
  const useSuffix = chance(rng, 0.50);
  const ideologyHint = pickIdeologyHint(opts.ideology, rng);
  const specialty = useSpecialty ? pickSpecialty(opts.specialty, rng) : null;
  const bodyTerm = useBody ? pickBody(opts.body, rng) : null;
  const suffix = useSuffix ? pickSuffix(rng) : null;

  const corporate = isCorporateFamily(opts.family);
  const hasCorpPrefix = corporate && bank.corpPrefixes && bank.corpPrefixes.length > 0;

  // Template selection
  type TemplateId = 1 | 2 | 3 | 4 | 5;
  const weights: { id: TemplateId; w: number }[] = corporate && hasCorpPrefix
    ? [
        { id: 5, w: 40 }, // Corporate: CorpPrefix Root Specialty? Suffix?
        { id: 2, w: 20 },
        { id: 3, w: 20 },
        { id: 1, w: 10 },
        { id: 4, w: 10 },
      ]
    : [
        { id: 1, w: 25 }, // Prefix? Root Suffix
        { id: 2, w: 30 }, // Root Body? Specialty Suffix
        { id: 3, w: 25 }, // Root Specialty Suffix
        { id: 4, w: 20 }, // Root Ideology? Suffix
      ];

  const total = weights.reduce((s, x) => s + x.w, 0);
  let roll = rng() * total;
  let template: TemplateId = weights[0]!.id;
  for (const { id, w } of weights) {
    roll -= w;
    if (roll < 0) {
      template = id;
      break;
    }
  }

  let parts: string[] = [];

  switch (template) {
    case 1: {
      // {Prefix?} {Root} {Suffix?} — Fort Armstrong / Pioneer Outpost / Baza Korolyova
      const usePrefix = bank.prefixes.length > 0 && chance(rng, 0.55);
      const prefix = usePrefix ? pick(rng, bank.prefixes) : null;
      // Prefer a suffix on this template (~70% if not already forced)
      const suf = suffix || (chance(rng, 0.55) ? pickSuffix(rng) : null);
      parts = [prefix, root, suf].filter(Boolean) as string[];
      // If we got only a bare root, add specialty or suffix
      if (parts.length === 1) {
        if (specialty) parts.push(specialty);
        parts.push(suf || pickSuffix(rng));
      }
      break;
    }
    case 2: {
      // {Root} {Body?} {Specialty} {Suffix} — Guanghan Lunar Research Station
      const spec = specialty || pickSpecialty(opts.specialty, rng);
      const suf = suffix || pickSuffix(rng);
      parts = [root, bodyTerm, spec, suf].filter(Boolean) as string[];
      break;
    }
    case 3: {
      // {Root} {Specialty} {Suffix} — Huaxia Heritage Colony
      const spec = specialty || pickSpecialty(opts.specialty, rng);
      const suf = suffix || (chance(rng, 0.65) ? pickSuffix(rng) : null);
      parts = [root, spec, suf].filter(Boolean) as string[];
      break;
    }
    case 4: {
      // {Root} {IdeologyHint?} {Suffix} — lighter ideology
      const hint = ideologyHint || (chance(rng, 0.4) ? pickIdeologyHint(opts.ideology, rng) : null);
      const suf = suffix || (chance(rng, 0.6) ? pickSuffix(rng) : null);
      parts = [root, hint, suf].filter(Boolean) as string[];
      if (parts.length === 1) {
        parts.push(specialty || pickSpecialty(opts.specialty, rng));
        parts.push(suf || pickSuffix(rng));
      }
      break;
    }
    case 5: {
      // Corporate: {CorpPrefix} {Root} {Specialty?} {Suffix?}
      const corp = pick(rng, bank.corpPrefixes!);
      const corpStem = corp.replace(/-$/, "").toLowerCase();
      // Avoid Apex-Apex / Helix-Helix when prefix stem matches root
      let rootUse = root;
      if (root.toLowerCase() === corpStem) {
        const alt = bank.roots.filter((r) => r.toLowerCase() !== corpStem);
        if (alt.length) rootUse = pick(rng, alt);
      }
      const branded = corp.endsWith("-") ? `${corp}${rootUse}` : joinParts([corp, rootUse]);
      const spec = specialty;
      const suf = suffix || (chance(rng, 0.45) ? pickSuffix(rng) : null);
      parts = [branded, spec, suf].filter(Boolean) as string[];
      break;
    }
  }

  // Sparse ideology injection if not already used (templates 1–3, 5)
  if (ideologyHint && template !== 4 && chance(rng, 0.15)) {
    // Insert before suffix if present
    const last = parts[parts.length - 1];
    if (last && (SUFFIXES as readonly string[]).includes(last)) {
      parts = [...parts.slice(0, -1), ideologyHint, last];
    } else {
      parts.push(ideologyHint);
    }
  }

  parts = avoidDoubles(parts);
  let name = joinParts(parts);

  // Ensure we never return empty / single-token too bare without context
  if (!name || name.split(/\s+/).length < 1) {
    name = joinParts([root, pickSpecialty(opts.specialty, rng), pickSuffix(rng)]);
  }

  return name;
}

/**
 * Deterministic fallback when no RNG is provided (collision tests / forced makeColony).
 * Uses a simple mix of culture + specialty + body — still evocative, not the old dry pattern.
 */
function assembleDeterministic(opts: {
  family: CultureFamily;
  specialty: NodeType;
  body: Body;
  ideology?: string | null;
}): string {
  const bank = CULTURE_BANKS[opts.family] || CULTURE_BANKS.Mixed;
  const root = bank.roots[0]!;
  const spec = SPECIALTY_TERMS[opts.specialty]?.[0] || opts.specialty;
  const body = BODY_TERMS[opts.body][0]!;
  const suf = "Colony";
  if (isCorporateFamily(opts.family) && bank.corpPrefixes?.length) {
    const corp = bank.corpPrefixes[0]!;
    const branded = corp.endsWith("-") ? `${corp}${root}` : `${corp} ${root}`;
    return joinParts([branded, spec, suf]);
  }
  if (bank.prefixes.length > 0) {
    return joinParts([bank.prefixes[0], root, suf]);
  }
  return joinParts([root, body, spec, suf]);
}

function collisionTag(n: number, rng?: Rng): string {
  if (n <= 1) return "";
  if (rng) {
    const marker = pick(rng, COLLISION_MARKERS);
    // Prefer roman / word for 2nd collision, numeric after
    if (n === 2) return marker === "2" ? "2" : marker;
    if (n === 3) return marker === "3" || marker === "Beta" ? marker : String(n);
    return String(n);
  }
  return String(n);
}

/**
 * Generate a unique evocative colony name and register it in G.nameSerial.
 */
export function nextColonyName(
  G: GameState,
  opts: {
    culture: string;
    specialty: NodeType;
    body: Body;
    ideology?: string | null;
    patron?: string | null;
    rng?: Rng;
  }
): string {
  const family = resolveCultureFamily(opts.culture || "Mixed", opts.patron);
  const base = opts.rng
    ? assembleColonyName(opts.rng, {
        family,
        specialty: opts.specialty,
        body: opts.body,
        ideology: opts.ideology,
      })
    : assembleDeterministic({
        family,
        specialty: opts.specialty,
        body: opts.body,
        ideology: opts.ideology,
      });

  const n = (G.nameSerial[base] || 0) + 1;
  G.nameSerial[base] = n;
  if (n === 1) return base;
  const tag = collisionTag(n, opts.rng);
  return `${base} ${tag}`;
}

/** Exported template ids for docs/tests. */
export const NAME_TEMPLATES = [
  "{Prefix?} {Root} {Suffix?}",
  "{Root} {Body?} {Specialty} {Suffix}",
  "{Root} {Specialty} {Suffix?}",
  "{Root} {IdeologyHint?} {Suffix?}",
  "{CorpPrefix} {Root} {Specialty?} {Suffix?}",
] as const;
