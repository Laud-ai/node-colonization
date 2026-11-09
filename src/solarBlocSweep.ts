/**
 * Headless solar-bloc / diplomacy timing sweep (0.9.3).
 * Usage: npx tsx src/solarBlocSweep.ts [--turns 70] [--seeds 42,7,99] [--out out/solar-bloc-sweep]
 *
 * One codebase, many param presets — no rebuild per variant.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { mulberry32 } from "./rng.js";
import {
  createGame, runTurn, applySolarBlocParams, applyFervorParams, DEFAULT_FERVOR_PARAMS,
} from "./engine.js";
import { SOLAR_BLOC_VARIANTS, type SolarBlocVariant } from "./solarBlocVariants.js";
import type { GameState } from "./types.js";

export interface SeedRunMetrics {
  seed: number;
  turns: number;
  firstSolarBlocTurn: number | null;
  earlyBlocLe10: boolean;
  earlyBlocLe20: boolean;
  blocsBy40: number;
  blocsBy60: number;
  blocsTotal: number;
  firstNeutralSoftenTurn: number | null;
  softensBy30: number;
  softensBy50: number;
  softensTotal: number;
  coloniesEnd: number;
}

export interface VariantSummary {
  id: string;
  label: string;
  params: SolarBlocVariant["params"];
  seeds: SeedRunMetrics[];
  medianFirstBloc: number | null;
  medianFirstSoften: number | null;
  anyEarlyBlocLe10: boolean;
  anyEarlyBlocLe20: boolean;
  meanBlocsTotal: number;
  meanSoftensTotal: number;
}

function parseArgs(argv: string[]) {
  let turns = 70;
  let seeds = [42, 7, 99];
  let outDir = "out/solar-bloc-sweep";
  let variantFilter: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--turns" && argv[i + 1]) turns = Math.max(1, Math.floor(Number(argv[++i])));
    else if (a === "--seeds" && argv[i + 1]) {
      seeds = String(argv[++i]).split(",").map((s) => Number(s.trim()) >>> 0).filter((n) => Number.isFinite(n));
    } else if (a === "--out" && argv[i + 1]) outDir = argv[++i]!;
    else if (a === "--variant" && argv[i + 1]) variantFilter = argv[++i]!;
  }
  if (!seeds.length) seeds = [42, 7, 99];
  return { turns, seeds, outDir, variantFilter };
}

function median(nums: number[]): number | null {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid]! : (a[mid - 1]! + a[mid]!) / 2;
}

function countMsgUpTo(G: GameState, maxTurn: number, re: RegExp): number {
  return G.log.filter((e) => e.turn <= maxTurn && re.test(e.msg)).length;
}

export function runSeedWithSolarParams(
  seed: number,
  turns: number,
  variant: SolarBlocVariant
): SeedRunMetrics {
  const rng = mulberry32(seed);
  const G = createGame(seed, rng);
  applyFervorParams(G, DEFAULT_FERVOR_PARAMS);
  applySolarBlocParams(G, variant.params);

  for (let i = 0; i < turns; i++) runTurn(G, rng);

  const blocLogs = G.log.filter((e) => /⚑ SOLAR BLOC:/.test(e.msg));
  const softenLogs = G.log.filter((e) => /alliance softens .+ → Neutral/.test(e.msg));
  const firstSolarBlocTurn = blocLogs.length ? blocLogs[0]!.turn : null;
  const firstNeutralSoftenTurn = softenLogs.length ? softenLogs[0]!.turn : null;

  return {
    seed,
    turns,
    firstSolarBlocTurn,
    earlyBlocLe10: blocLogs.some((e) => e.turn <= 10),
    earlyBlocLe20: blocLogs.some((e) => e.turn <= 20),
    blocsBy40: countMsgUpTo(G, 40, /⚑ SOLAR BLOC:/),
    blocsBy60: countMsgUpTo(G, 60, /⚑ SOLAR BLOC:/),
    blocsTotal: blocLogs.length,
    firstNeutralSoftenTurn,
    softensBy30: countMsgUpTo(G, 30, /alliance softens .+ → Neutral/),
    softensBy50: countMsgUpTo(G, 50, /alliance softens .+ → Neutral/),
    softensTotal: softenLogs.length,
    coloniesEnd: G.colonies.length,
  };
}

export function runSolarVariantSweep(
  variant: SolarBlocVariant,
  seeds: number[],
  turns: number
): VariantSummary {
  const seedRuns = seeds.map((s) => runSeedWithSolarParams(s, turns, variant));
  const firsts = seedRuns.map((r) => r.firstSolarBlocTurn).filter((t): t is number => t != null);
  const softens = seedRuns.map((r) => r.firstNeutralSoftenTurn).filter((t): t is number => t != null);
  return {
    id: variant.id,
    label: variant.label,
    params: variant.params,
    seeds: seedRuns,
    medianFirstBloc: median(firsts),
    medianFirstSoften: median(softens),
    anyEarlyBlocLe10: seedRuns.some((r) => r.earlyBlocLe10),
    anyEarlyBlocLe20: seedRuns.some((r) => r.earlyBlocLe20),
    meanBlocsTotal: seedRuns.reduce((s, r) => s + r.blocsTotal, 0) / seedRuns.length,
    meanSoftensTotal: seedRuns.reduce((s, r) => s + r.softensTotal, 0) / seedRuns.length,
  };
}

function toCsv(summaries: VariantSummary[]): string {
  const header = [
    "variant", "label", "blocAt", "softenAt", "medianFirstBloc", "medianFirstSoften",
    "anyEarlyLe10", "anyEarlyLe20", "meanBlocs", "meanSoftens",
    "seed", "firstBloc", "firstSoften", "by40", "by60", "blocs", "softens", "colonies",
  ].join(",");
  const rows: string[] = [header];
  for (const v of summaries) {
    const blocAt = Math.max(v.params.minTurnToFoundBloc, v.params.lateBlocWindowStart);
    for (const s of v.seeds) {
      rows.push([
        v.id,
        JSON.stringify(v.label),
        blocAt,
        v.params.midGameNeutralSofteningTurn,
        v.medianFirstBloc ?? "",
        v.medianFirstSoften ?? "",
        v.anyEarlyBlocLe10 ? 1 : 0,
        v.anyEarlyBlocLe20 ? 1 : 0,
        v.meanBlocsTotal.toFixed(2),
        v.meanSoftensTotal.toFixed(2),
        s.seed,
        s.firstSolarBlocTurn ?? "",
        s.firstNeutralSoftenTurn ?? "",
        s.blocsBy40,
        s.blocsBy60,
        s.blocsTotal,
        s.softensTotal,
        s.coloniesEnd,
      ].join(","));
    }
  }
  return rows.join("\n") + "\n";
}

function scoreVariant(s: VariantSummary): number {
  // Prefer: no early blocs; some mid soften; late blocs possible (not zero forever on 70t)
  let score = 0;
  if (!s.anyEarlyBlocLe10) score += 5;
  if (!s.anyEarlyBlocLe20) score += 3;
  if (s.medianFirstSoften != null && s.medianFirstSoften >= 18 && s.medianFirstSoften <= 45) score += 3;
  if (s.meanSoftensTotal >= 0.5) score += 2;
  if (s.medianFirstBloc != null && s.medianFirstBloc >= 35) score += 4;
  if (s.medianFirstBloc != null && s.medianFirstBloc >= 40 && s.medianFirstBloc <= 65) score += 2;
  if (s.meanBlocsTotal >= 0.3 && s.meanBlocsTotal <= 4) score += 2;
  if (s.id === "control_legacy") score -= 20;
  return score;
}

function main() {
  const { turns, seeds, outDir, variantFilter } = parseArgs(process.argv.slice(2));
  const variants = variantFilter
    ? SOLAR_BLOC_VARIANTS.filter((v) => v.id === variantFilter)
    : SOLAR_BLOC_VARIANTS;
  if (!variants.length) {
    console.error("No variants matched");
    process.exit(1);
  }

  console.log(`Solar-bloc sweep: ${variants.length} variants × ${seeds.length} seeds × ${turns} turns`);
  const summaries: VariantSummary[] = [];
  for (const v of variants) {
    process.stdout.write(`  ${v.id}... `);
    const t0 = Date.now();
    const summary = runSolarVariantSweep(v, seeds, turns);
    summaries.push(summary);
    console.log(
      `done ${(Date.now() - t0) / 1000}s` +
        ` firstBlocMed=${summary.medianFirstBloc ?? "—"}` +
        ` softenMed=${summary.medianFirstSoften ?? "—"}` +
        ` early10=${summary.anyEarlyBlocLe10}`
    );
  }

  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, "summary.json");
  const csvPath = join(outDir, "summary.csv");
  writeFileSync(jsonPath, JSON.stringify(summaries, null, 2));
  writeFileSync(csvPath, toCsv(summaries));

  const ranked = [...summaries].sort((a, b) => scoreVariant(b) - scoreVariant(a));
  const recommended = ranked[0]!;

  console.log("\n=== Compact summary ===");
  console.log(
    "id".padEnd(24) +
      "bloc@".padStart(6) +
      "firstB".padStart(8) +
      "soften".padStart(8) +
      "early10".padStart(8) +
      "blocs".padStart(7) +
      "score".padStart(7)
  );
  for (const s of summaries) {
    const blocAt = Math.max(s.params.minTurnToFoundBloc, s.params.lateBlocWindowStart);
    console.log(
      s.id.padEnd(24) +
        String(blocAt).padStart(6) +
        String(s.medianFirstBloc ?? "—").padStart(8) +
        String(s.medianFirstSoften ?? "—").padStart(8) +
        (s.anyEarlyBlocLe10 ? "YES" : "no").padStart(8) +
        s.meanBlocsTotal.toFixed(1).padStart(7) +
        String(scoreVariant(s)).padStart(7)
    );
  }
  console.log(`\nRecommended (heuristic): ${recommended.id} — ${recommended.label}`);
  console.log(`\nWrote ${jsonPath}\nWrote ${csvPath}`);
}

const isMain = process.argv[1]?.includes("solarBlocSweep");
if (isMain) main();
