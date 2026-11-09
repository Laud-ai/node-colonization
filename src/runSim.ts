import { mulberry32, type Rng } from "./rng.js";
import {
  createGame,
  runTurn,
  formatLog,
  formatLeaderboard,
  type GameState,
} from "./engine.js";

export interface SimResult {
  state: GameState;
  logText: string;
  leaderboard: string;
  seed: number;
  turns: number;
}

export function runSim(seed: number, turns: number): SimResult {
  const rng: Rng = mulberry32(seed);
  const state = createGame(seed, rng);
  for (let i = 0; i < turns; i++) runTurn(state, rng);
  return {
    state,
    logText: formatLog(state),
    leaderboard: formatLeaderboard(state),
    seed,
    turns,
  };
}

export { createGame, runTurn, formatLog, formatLeaderboard, mulberry32 };
export type { GameState, Rng };
