# Node Colonization vs vibe-coding game pipelines

**Date:** 2026-11-09 (Europe/Lisbon)  
**Scope:** Research only — no project code changed.  
**Our tree:** `/workspace/node-colonization-l0` @ `0.12.0` (TypeScript + Vite, headless sim + lobby + frozen version snapshots).

Sources below were fetched this turn. Only those URLs are cited.

---

## 1. Common practices (7) from vibe-coding game devs

### 1. Ship a URL, not an archive
Browser games that open with no install / no login are the default format. Pieter Levels’ fly.pieter.com was built to open and play immediately; Vibe Jam rules (as summarized by guides that quote the jam) require free web play with no signup and almost no load time. Hosting options repeatedly named: Vercel, Netlify, Cloudflare Pages, itch.io.

- https://levels.io/fly-pieter-com-vibecoded-flight-simulator
- https://indiemakerlist.com/vibe-coding/learn/vibe-coding-a-game/
- https://www.aigamer.gg/guides/vibe-coding-games
- https://www.summerengine.com/vibe-jam

### 2. Git before the first prompt; commit every working step
Agents break working features. Guides treat a commit history as the save point and warn that “no version control = AI roulette.”

- https://www.aigamer.gg/guides/vibe-coding-games
- https://indiemakerlist.com/vibe-coding/learn/vibe-coding-a-game/
- https://pixelgamecraft.com/blog/ai-game-dev-workflow/

### 3. One-page design brief + persistent agent instructions
Write a short GAME.md / design brief before prompting. Keep a project file the agent re-reads every session (`CLAUDE.md` or `AGENTS.md`): stack, architecture rules, file-size limits, how to verify. Anthropic documents that Claude Code reads `CLAUDE.md` at session start (and can use `AGENTS.md`). Tony Dinh’s Survive 10 Waves `CLAUDE.md` caps files at 500 lines, bans narrative comments, and forbids unreliable screenshot E2E.

- https://indiemakerlist.com/vibe-coding/learn/vibe-coding-a-game/
- https://docs.anthropic.com/en/docs/claude-code/overview
- https://news.tonydinh.com/p/i-made-a-game-with-ai
- https://www.aigamer.gg/guides/vibe-coding-games (Mowtopia: 7-milestone requirements doc)

### 4. Small iterations; play (or otherwise verify) after every change
Prompt one feature at a time with a clear “done” check. Play the build yourself after each step. Levels’ fly.pieter.com build was many short Cursor rounds, not one big dump. PixelGameCraft: minimize change surface; never accept a change you can’t explain.

- https://levels.io/fly-pieter-com-vibecoded-flight-simulator
- https://www.aigamer.gg/guides/vibe-coding-games
- https://pixelgamecraft.com/blog/ai-game-dev-workflow/
- https://indiemakerlist.com/vibe-coding/learn/vibe-coding-a-game/

### 5. Separate logic from view; add automated checks early
Model/view split + headless tests catch AI regressions. AIGamer: once past a toy, add tests and run them before commits (Mowtopia ~60 tests). PixelGameCraft built a headless test scene that re-verifies board logic after every change.

- https://pixelgamecraft.com/blog/ai-game-dev-workflow/
- https://www.aigamer.gg/guides/vibe-coding-games

### 6. Give the agent eyes on the running UI (with care)
Web stacks let agents drive a headless browser. AIGamer cites Claude Code screenshot loops for visual review. Tony Dinh allows loading a browser to confirm the game boots, but bans screenshot end-to-end testing as unreliable for his game.

- https://www.aigamer.gg/guides/vibe-coding-games
- https://news.tonydinh.com/p/i-made-a-game-with-ai

### 7. Designer taste stays human; ship early and learn from players
AI generates; the human owns feel, balance targets, and what ships. Levels built in public and monetized attention. Tony Dinh spent most time on guns/enemies/progression numbers and heavy personal playtesting. PixelGameCraft: “AI prototypes, you decide the design.”

- https://levels.io/fly-pieter-com-vibecoded-flight-simulator
- https://news.tonydinh.com/p/i-made-a-game-with-ai
- https://pixelgamecraft.com/blog/ai-game-dev-workflow/

---

## 2. Comparison: where we match / lag

| Practice | Node Colonization today | Verdict |
| --- | --- | --- |
| Instant web play URL | Tiago extracts a tarball on Windows, `npm install`, `npm run dev` on localhost:5174. No public host. | **Lag** |
| Git + rollback | `git rev-parse` → no repo in the box tree. Delivery is versioned tarballs + frozen `public/versions/<ver>/`. | **Lag** on Git; **ahead** on in-app historical builds |
| Persistent agent brief | Many `NOTES-*.md` + `PLAN-L*.md` + README, but no single `AGENTS.md` / `CLAUDE.md` / `GAME.md` the agent is required to read every session. | **Partial** |
| Small iterate → play | Strong on **sim** sweeps (`sim:fervor`, `sim:solar`, `sim:growth`) and milestone ladder L0–L7. Weak on **UI**: builds verified by compile, not browser click-through. | **Match** on sims; **lag** on UI play loop |
| Logic / view split + tests | Headless seeded engine separate from Vite UI; `node:test` suite (`tests/determinism.test.ts`, `flags`, `rules`); balance reports under `out/reports/`. Config objects (`FervorParams`, `SolarBlocParams`, Rules) + lobby tabs. | **Match / ahead** for a strategy sim |
| Agent UI verification | No Playwright/smoke/screenshot gate in package scripts. | **Lag** |
| Human design authority | Tiago hand-plays; NOTES record “decided by Space Game, Tiago may override.” Rules/variants selectable in lobby. | **Match** |
| Frozen milestones | `npm run snapshot` → `public/versions/` + manifest + iframe Version/Ruleset tab. Rare among vibe pipelines (they usually only have Git tags). | **Ahead** |
| Public feedback loop | Private designer only; no hosted play link, no playtest telemetry. | **Lag** |

**Net:** we already look more like a serious sim studio pipeline (deterministic engine, param lobby, balance sweeps, frozen rulesets) than a weekend arcade vibe jam. The biggest gaps vs 2025–2026 vibe practice are **delivery friction**, **Git**, **session-start design file**, and **UI smoke verification**.

---

## 3. Ranked optimizations (for us)

Ranked by payoff / effort for this project and Tiago’s preference for free tools. Do not implement here — research deliverable only.

| Rank | Optimization | Effort | Payoff | Why |
| --- | --- | --- | --- | --- |
| 1 | **Init Git locally + optional private GitHub; tag each release (`v0.12.0`)** | Low | High | Industry-standard rollback when the agent regresses; replaces “hope the tarball is intact.” Free. Keeps snapshots too. |
| 2 | **Free static host of `vite build` (GitHub Pages / Cloudflare Pages / itch.io HTML5)** | Low–med | High | One URL for Tiago (and later playtesters) instead of tarball + npm each time. Matches fly.pieter / Vibe Jam delivery. Keep lobby + `public/versions/` on the same host. |
| 3 | **Add root `AGENTS.md` (or `GAME.md`) that agents must read each session** | Low | High | Collapse authoritative rules, defaults (`realistic_survival`, `solar_realist`), “never hardcode playtest outcomes,” delivery path, and “run `npm test` + one growth probe before claiming done” into one file. Mirrors CLAUDE.md / GAME.md practice. |
| 4 | **Playwright (or similar) smoke: lobby loads → pick defaults → start → one End turn / Simulate 1 → screenshot** | Med | High | Closes the known hole: UI only verified by build. Align with Tony’s “confirm load” rule; keep assertions structural, not flaky pixel diffs. |
| 5 | **Smaller ship cadence: one vertical slice + human/UI check before next L#** | Process only | Med–high | Ladder L5–L7 shipped end-to-end AI-side; vibe practice says play after every change. Pair each NOTES bump with a 5-minute hand play or smoke run. |
| 6 | **Lightweight playtest telemetry (optional, local-first)** | Med | Med | Log seed, ruleset version, turns played, first revolt turn, independence share — append-only JSON Tiago can paste back. No cloud required. Feeds balance reports the way public play fed Levels’ iteration. |
| 7 | **Periodic overnight “refactor / review” pass with a hard file-size rule** | Low–med | Med | Tony’s 500-line rule + Cursor overnight refactor. Our `src/` is ~7.7k lines across 23 files (`engine.ts` is the risk). Prevents silent monolith growth. |
| 8 | **Keep tarballs only as offline backup; make URL + Git the primary path** | Low | Med | Frugal: no new paid tools. Tarball copy-to-PC stays for air-gapped days; stop treating it as the main loop. |

### Explicit non-goals (for now)
- Multiplayer / WebSockets (Levels/Vibe Jam pattern) — wrong genre for Solar Realist colony sim.
- Paid art/SFX pipelines (Meshy, ElevenLabs, Suno) — polish, not pipeline bottleneck.
- Switching engine to Three.js/Phaser/Godot — our Vite + headless TS stack already fits the agent-friendly web pattern.

---

## 4. Source list (fetched this research)

1. https://levels.io/fly-pieter-com-vibecoded-flight-simulator  
2. https://indiemakerlist.com/vibe-coding/learn/vibe-coding-a-game/  
3. https://www.aigamer.gg/guides/vibe-coding-games  
4. https://news.tonydinh.com/p/i-made-a-game-with-ai  
5. https://pixelgamecraft.com/blog/ai-game-dev-workflow/  
6. https://docs.anthropic.com/en/docs/claude-code/overview  
7. https://www.summerengine.com/vibe-jam  
8. https://www.summerengine.com/blog/cursor-vibe-jam-2026-guide  

Local inspection: `package.json`, `scripts/snapshot.mjs`, `public/versions/manifest.json`, `NOTES-0.9.4.md`, `NOTES-0.12.0.md`, `README.md`, `tests/`, absence of Git / `AGENTS.md` / `CLAUDE.md` / `GAME.md`.

---

*End of report.*
