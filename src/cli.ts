import { runSim } from "./runSim.js";

function parseArgs(argv: string[]) {
  let seed = 42;
  let turns = 40;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--seed" && argv[i + 1]) seed = Number(argv[++i]);
    else if (a === "--turns" && argv[i + 1]) turns = Number(argv[++i]);
  }
  if (!Number.isFinite(seed)) seed = 42;
  if (!Number.isFinite(turns) || turns < 0) turns = 40;
  return { seed: seed >>> 0, turns: Math.floor(turns) };
}

const { seed, turns } = parseArgs(process.argv.slice(2));
const result = runSim(seed, turns);
console.log(result.logText);
console.log("");
console.log(result.leaderboard);
console.log("");
console.log(
  "Done. seed=" + result.seed + " turns=" + result.turns +
  " finalTurn=" + result.state.turn + " colonies=" + result.state.colonies.length
);
