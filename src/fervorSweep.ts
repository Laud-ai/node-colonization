/**
 * Headless fervor-parameter sweep (0.9.1).
 * Usage: npx tsx src/fervorSweep.ts [--turns 100] [--seeds 42,7,99] [--out out/fervor-sweep]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { mulberry32 } from "./rng.js";
import { createGame, runTurn, isIndependent, applyFervorParams } from "./engine.js";
import { FERVOR_VARIANTS, type FervorVariant } from "./fervorVariants.js";
import type { GameState } from "./types.js";

export interface SeedRunMetrics {
  seed: number;
  turns: number;
  firstIndependenceTurn: number | null;
  independencesBy20: number;
  independencesBy40: number;
  independencesBy80: number;
  independencesTotal: number;
  earlyIndependence: boolean; // any ≤ turn 10
  shareIndependentEnd: number;
  coloniesEnd: number;
  independentEnd: number;
  revolutionLogCount: number;
  causes: string[];
}

export interface VariantSummary {
  id: string;
  label: string;
  params: FervorVariant["params"];
  seeds: SeedRunMetrics[];
  medianFirstIndependence: number | null;
  meanShareIndependentEnd: number;
  anyEarlyIndependence: boolean;
  totalIndependencesMedian: number;
}

function parseArgs(argv: string[]) {
  let turns = 100;
  let seeds = [42, 7, 99];
  let outDir = "out/fervor-sweep";
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

function countRevolutionsUpTo(G: GameState, maxTurn: number): number {
  return G.log.filter(
    (e) => e.turn <= maxTurn && /⚑ REVOLUTION:/.test(e.msg)
  ).length;
}

export function runSeedWithParams(
  seed: number,
  turns: number,
  variant: FervorVariant
): SeedRunMetrics {
  const rng = mulberry32(seed);
  const G = createGame(seed, rng);
  applyFervorParams(G, variant.params);

  for (let i = 0; i < turns; i++) runTurn(G, rng);

  const revLogs = G.log.filter((e) => /⚑ REVOLUTION:/.test(e.msg));
  const firstIndependenceTurn = revLogs.length ? revLogs[0]!.turn : null;
  const earlyIndependence = revLogs.some((e) => e.turn <= 10);
  const causeSet = new Set<string>();
  if (revLogs.length) causeSet.add("revolution");
  for (const e of G.log) {
    if (/subversion mark/.test(e.msg)) causeSet.add("subversion_mark");
    if (/vital intra-nation route cancelled/.test(e.msg)) causeSet.add("vital_cancel");
    if (/imports Subversion|develops Subversion/.test(e.msg)) causeSet.add("subversion_tool");
  }

  const independentEnd = G.colonies.filter((c) => isIndependent(c)).length;
  const coloniesEnd = G.colonies.length;
  const revolutionLogCount = revLogs.length;

  return {
    seed,
    turns,
    firstIndependenceTurn,
    independencesBy20: countRevolutionsUpTo(G, 20),
    independencesBy40: countRevolutionsUpTo(G, 40),
    independencesBy80: countRevolutionsUpTo(G, 80),
    independencesTotal: revolutionLogCount,
    earlyIndependence,
    shareIndependentEnd: coloniesEnd ? independentEnd / coloniesEnd : 0,
    coloniesEnd,
    independentEnd,
    revolutionLogCount,
    causes: [...causeSet].sort(),
  };
}

export function runVariantSweep(
  variant: FervorVariant,
  seeds: number[],
  turns: number
): VariantSummary {
  const seedRuns = seeds.map((s) => runSeedWithParams(s, turns, variant));
  const firsts = seedRuns
    .map((r) => r.firstIndependenceTurn)
    .filter((t): t is number => t != null);
  const totals = seedRuns.map((r) => r.independencesTotal);
  return {
    id: variant.id,
    label: variant.label,
    params: variant.params,
    seeds: seedRuns,
    medianFirstIndependence: median(firsts),
    meanShareIndependentEnd:
      seedRuns.reduce((s, r) => s + r.shareIndependentEnd, 0) / seedRuns.length,
    anyEarlyIndependence: seedRuns.some((r) => r.earlyIndependence),
    totalIndependencesMedian: median(totals) ?? 0,
  };
}

function toCsv(summaries: VariantSummary[]): string {
  const header = [
    "variant", "label", "threshold", "minAge", "medianFirstInd",
    "meanShareIndEnd", "anyEarlyLe10", "medianTotalRevolts",
    "seed", "firstInd", "by20", "by40", "by80", "total", "shareEnd", "early", "causes",
  ].join(",");
  const rows: string[] = [header];
  for (const v of summaries) {
    for (const s of v.seeds) {
      rows.push([
        v.id,
        JSON.stringify(v.label),
        v.params.threshold,
        v.params.minAgeTurns,
        v.medianFirstIndependence ?? "",
        v.meanShareIndependentEnd.toFixed(3),
        v.anyEarlyIndependence ? 1 : 0,
        v.totalIndependencesMedian,
        s.seed,
        s.firstIndependenceTurn ?? "",
        s.independencesBy20,
        s.independencesBy40,
        s.independencesBy80,
        s.independencesTotal,
        s.shareIndependentEnd.toFixed(3),
        s.earlyIndependence ? 1 : 0,
        JSON.stringify(s.causes.join("|")),
      ].join(","));
    }
  }
  return rows.join("\n") + "\n";
}

function main() {
  const { turns, seeds, outDir, variantFilter } = parseArgs(process.argv.slice(2));
  const variants = variantFilter
    ? FERVOR_VARIANTS.filter((v) => v.id === variantFilter)
    : FERVOR_VARIANTS;
  if (!variants.length) {
    console.error("No variants matched");
    process.exit(1);
  }

  console.log(`Sweep: ${variants.length} variants × ${seeds.length} seeds × ${turns} turns`);
  const summaries: VariantSummary[] = [];
  for (const v of variants) {
    process.stdout.write(`  ${v.id}... `);
    const t0 = Date.now();
    const summary = runVariantSweep(v, seeds, turns);
    summaries.push(summary);
    console.log(
      `done ${(Date.now() - t0) / 1000}s` +
        ` firstMed=${summary.medianFirstIndependence ?? "—"}` +
        ` share=${summary.meanShareIndependentEnd.toFixed(2)}` +
        ` early=${summary.anyEarlyIndependence}`
    );
  }

  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, "summary.json");
  const csvPath = join(outDir, "summary.csv");
  writeFileSync(jsonPath, JSON.stringify(summaries, null, 2));
  writeFileSync(csvPath, toCsv(summaries));

  // Compact table to stdout
  console.log("\n=== Compact summary ===");
  console.log(
    "id".padEnd(24) +
      "thr".padStart(4) +
      "firstMed".padStart(10) +
      "shareEnd".padStart(10) +
      "early?".padStart(8) +
      "revMed".padStart(8)
  );
  for (const s of summaries) {
    console.log(
      s.id.padEnd(24) +
        String(s.params.threshold).padStart(4) +
        String(s.medianFirstIndependence ?? "—").padStart(10) +
        s.meanShareIndependentEnd.toFixed(3).padStart(10) +
        (s.anyEarlyIndependence ? "YES" : "no").padStart(8) +
        String(s.totalIndependencesMedian).padStart(8)
    );
  }
  console.log(`\nWrote ${jsonPath}\nWrote ${csvPath}`);
}

const isMain = process.argv[1]?.includes("fervorSweep");
if (isMain) main();
