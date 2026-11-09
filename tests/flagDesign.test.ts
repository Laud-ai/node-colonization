import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TRADITIONS, TINCTURES, blocFlag, colonyFlag, flagDesignToSvg, chargeOk, contrast, MIN_FIELD_CONTRAST,
  ideologyFamily, type FlagInput,
} from "../src/flagDesign.js";
import { NODES } from "../src/nodes.js";
import { IDEOLOGIES } from "../src/engine.js";

const BLOCS = Object.keys(TRADITIONS);
const IDEOS = [...Object.values(IDEOLOGIES), "Situationism", "Market Realism", "Technocracy", "Pioneerism", "Socialism",
  "Technocratic Pioneerism", "Corporate Socialism", "Global Institutionalism-Socialism-Pioneerism"];

function sample(n: number): FlagInput[] {
  const out: FlagInput[] = [];
  for (let i = 0; i < n; i++) {
    const origin = BLOCS[i % BLOCS.length]!;
    const kind = i % 5;
    const patron = kind === 3 ? "Independent" : kind === 4 ? BLOCS[(i * 7 + 3) % BLOCS.length]! : origin;
    out.push({
      seed: 1000 + (i % 13), id: `c${i}`, origin, patron, ideology: IDEOS[i % IDEOS.length]!,
      specialty: NODES[i % NODES.length]!, body: i % 2 ? "Moon" : "Mars",
      liege: patron === "Independent" ? { id: `c${i % 9}`, origin: BLOCS[(i * 3) % BLOCS.length]!, ideology: IDEOS[(i * 5) % IDEOS.length]! } : null,
    });
  }
  return out;
}

const all = () => [...BLOCS.map((b) => ({ d: blocFlag(b), label: b })), ...sample(600).map((s) => ({ d: colonyFlag(s), label: `${s.id}/${s.origin}/${s.patron}` }))];

test("0.15.0 flags are deterministic (same input → same SVG)", () => {
  for (const s of sample(120)) assert.equal(flagDesignToSvg(colonyFlag(s)), flagDesignToSvg(colonyFlag({ ...s })));
  for (const b of BLOCS) assert.equal(flagDesignToSvg(blocFlag(b)), flagDesignToSvg(blocFlag(b)));
});

test("0.15.0 rule of tincture + contrast: every charge and adjacent field passes", () => {
  for (const { d, label } of all()) {
    for (const c of d.charges) assert.ok(chargeOk(c.tincture, c.bg), `${label}: ${c.kind} ${c.tincture} on ${c.bg}`);
    for (const [a, b] of d.adjacent) assert.ok(a !== b && contrast(a, b) >= MIN_FIELD_CONTRAST, `${label}: ${a}|${b}`);
  }
});

test("0.15.0 max 3 tinctures (4 only with a justified tradition)", () => {
  for (const { d, label } of all()) {
    assert.ok(d.tinctures.every((t) => t in TINCTURES));
    if (d.tinctures.length === 4) assert.ok(d.justification, `${label}: 4 tinctures without justification`);
    assert.ok(d.tinctures.length <= 4, `${label}: ${d.tinctures.join(",")}`);
  }
  assert.ok(blocFlag("African Union").justification?.includes("Pan-African"));
});

test("0.15.0 lineage, function, ideology and independence semantics", () => {
  const base: FlagInput = { seed: 5, id: "c7", origin: "Russian Federation", patron: "Russian Federation", ideology: "Putinism", specialty: "Water", body: "Moon" };
  const d = colonyFlag(base);
  assert.equal(d.era, "colonial");
  assert.ok(d.charges.some((c) => c.kind === "Water"), "specialty charge");
  assert.ok(d.palette.every((t) => ["argent", "azure", "gules", "lunar"].includes(t)), "inherits Pan-Slavic palette");
  assert.ok(colonyFlag({ ...base, ideology: "Chinese Socialism" }).charges.some((c) => c.kind === "star"), "socialist star");
  assert.ok(colonyFlag({ ...base, origin: "New Caliphate", patron: "New Caliphate", ideology: "Political Islam" }).charges.some((c) => c.kind === "crescentStar"));
  // Siblings (same origin, different ids) are mostly distinct
  const sibs = new Set(Array.from({ length: 12 }, (_, i) => flagDesignToSvg(colonyFlag({ ...base, id: `c${i}`, specialty: NODES[i % 4]! }))));
  assert.ok(sibs.size >= 10);
  // Independence: revolutionary redesign that keeps a heritage colour from the founding bloc
  const ind = colonyFlag({ ...base, patron: "Independent", liege: { id: "c7", origin: "Russian Federation", ideology: "Putinism" }, isLiege: true });
  assert.equal(ind.era, "independent");
  assert.notEqual(flagDesignToSvg(ind), flagDesignToSvg(d));
  assert.equal(ind.heritage?.kind, "color");
  assert.ok(ind.palette.includes(ind.heritage!.value as never));
  assert.ok(TRADITIONS["Russian Federation"]!.palette.includes(ind.heritage!.value as never));
  // Members of the same independent nation share the national layout + palette
  const m1 = colonyFlag({ ...base, id: "c9", patron: "Independent", liege: { id: "c7", origin: "Russian Federation", ideology: "Putinism" } });
  assert.equal(m1.layout, ind.layout);
  assert.deepEqual(m1.palette, ind.palette);
  // Bloc flip keeps a heritage element
  const flip = colonyFlag({ ...base, patron: "China" });
  assert.equal(flip.era, "flipped");
  assert.ok(flip.heritage);
  assert.equal(ideologyFamily("Platform Socialism"), "corporate");
  assert.equal(ideologyFamily("Political Islam"), "islamic");
});

test("0.15.0 distinctive: daughters of different blocs don't collide", () => {
  for (const sp of NODES.slice(0, 6)) for (const body of ["Moon", "Mars"] as const) {
    const svgs = BLOCS.map((b) => flagDesignToSvg(colonyFlag({ seed: 9, id: "c3", origin: b, patron: b, ideology: IDEOLOGIES[b] ?? "", specialty: sp, body })));
    assert.equal(new Set(svgs).size, BLOCS.length, `${sp}/${body}`);
  }
});
