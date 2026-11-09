// 0.16.0 survival-clock probe: npm run sim:clocks -- [turns] [seeds]
// Modes: legacy (pre-0.9.4: no G.rules), legacyPop (pre-0.9.4 balance + 0.16.0 clock rule),
//        v094 (0.9.4–0.15.x shipped rules), v016 (0.16.0 rules)
import { mulberry32 } from "./rng.js";
import { applyRules, legacyRules } from "./rules.js";
import { createGame, runTurn } from "./engine.js";
import type { ClockTraceEntry } from "./l4.js";
const turns = Number(process.argv[2] || 120);
const seeds = (process.argv[3] || "42,7,99").split(",").map(Number);
const modes = (process.env.MODES || "legacy,legacyPop,v094,v016").split(",");
for (const mode of modes) {
  const tot = { adv: 0, advNoDevPop: 0, advStrainOnly: 0, fired: 0, firedNoDevPop: 0, refugees: 0, cols: 0 };
  for (const seed of seeds) {
    const rng = mulberry32(seed);
    const G = createGame(seed, rng);
    if (mode === "v094") applyRules(G, { survivalNeedsPopulation: false });
    if (mode === "v016") applyRules(G);
    // Pre-0.9.4 balance (trip 3, no cooldown/recovery) but with Tiago's clock rule
    if (mode === "legacyPop") applyRules(G, { ...legacyRules(), survivalNeedsPopulation: true });
    const trace: ClockTraceEntry[] = [];
    (G as unknown as { __clockTrace: ClockTraceEntry[] }).__clockTrace = trace;
    for (let t = 1; t <= turns; t++) runTurn(G, rng);
    for (const e of trace) {
      if (e.fired) { tot.fired++; if (e.devPop <= 0) tot.firedNoDevPop++; continue; }
      tot.adv++;
      if (e.devPop <= 0) tot.advNoDevPop++;
      if (e.strain <= 0) tot.advStrainOnly++;
    }
    tot.refugees += G.log.filter((e) => /🏕 Refugees flee/.test(e.msg)).length;
    tot.cols += G.colonies.length;
  }
  const n = seeds.length;
  console.log(`${mode.padEnd(9)} seeds ${seeds.join(",")} T${turns}: clock advances ${tot.adv} (without native Population ${tot.advNoDevPop} = ${tot.adv ? Math.round((100 * tot.advNoDevPop) / tot.adv) : 0}%; at zero strain ${tot.advStrainOnly}) · refugee events ${tot.refugees} (${(tot.refugees / n / turns).toFixed(2)}/turn/seed; ${tot.firedNoDevPop} of ${tot.fired} from colonies without native Population) · colonies at end ${(tot.cols / n).toFixed(1)}/seed`);
}
