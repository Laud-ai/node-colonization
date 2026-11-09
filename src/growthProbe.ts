// Headless growth/refugee probe: npm run sim:growth -- [turns] [seeds] [fervorVariant]
import { mulberry32 } from "./rng.js";
import { applyRules } from "./rules.js";
import { createGame, runTurn, isIndependent, applyFervorParams } from "./engine.js";
import { variantById } from "./fervorVariants.js";
const turns = Number(process.argv[2] || 120);
const seeds = (process.argv[3] || "42,7,99").split(",").map(Number);
const fv = process.argv[4];
for (const seed of seeds) {
  const rng = mulberry32(seed);
  const G = createGame(seed, rng);
  if (process.env.LEGACY !== "1") applyRules(G, process.env.CLOCKS_OLD === "1" ? { survivalNeedsPopulation: false } : {});
  if (fv) applyFervorParams(G, variantById(fv)!.params);
  const at: Record<number, number> = {};
  for (let t = 1; t <= turns; t++) { runTurn(G, rng); if ([10, 40, 80, 120, 150].includes(t)) at[t] = G.colonies.length; }
  const proj = G.log.filter((e) => /🏗 PROJECT:/.test(e.msg));
  console.log(`  projects ${proj.length} first ${proj[0]?.turn ?? "-"} TF ${JSON.stringify(G.bodyTF)}`);
  const ov = G.log.filter((e) => /👑 OVERTURN/.test(e.msg));
  console.log(`  overturns ${ov.map((e) => `T${e.turn}`).join(",") || "-"} proxy ${G.log.filter((e) => /🕵 Proxy/.test(e.msg)).length}`);
  const ref = G.log.filter((e) => /🏕 Refugees flee/.test(e.msg)).length;
  const rev = G.log.filter((e) => /⚑ REVOLUTION:/.test(e.msg));
  const ind = G.colonies.filter((c) => isIndependent(c)).length;
  const bodies: Record<string, number> = {};
  for (const c of G.colonies) bodies[c.body] = (bodies[c.body] || 0) + 1;
  console.log(`seed ${seed}: cols ${JSON.stringify(at)} refugees ${ref} (${(ref / turns).toFixed(2)}/t) revolts ${rev.length} first ${rev[0]?.turn ?? "-"} indep ${ind}/${G.colonies.length} ${JSON.stringify(bodies)}`);
}
