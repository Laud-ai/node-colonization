# 0.21.1 — Lineage & cluster graph

Tiago: "set up 0.21.1". This release is UI only. It is built from the 0.21.0 event log and per-turn relation snapshots, and it does not change the simulation or colony counts. Two new toggles in the Rules tab, group **History**, both default on. Off gives 0.21.0 (the windows are hidden from the docks, tray and Windows menu):

| id | default | what it does |
|---|---|---|
| `lineageView` | on | **Lineage** window: ideology and culture trees |
| `clusterGraph` | on | **Cluster graph** window: force layout of flags with a turn replay |

Both need `eventLog` (0.21.0) on. Without it they show a hint instead.

## Lineage window (dockable; starts minimized in the tray)
- **Ideology | Culture** sub-tabs. Each is a tree running top to bottom over game time: rows are turns, nodes are ideologies or cultures, and edges go to whatever they shifted or blended into.
  - Solid grey arrow = shift or overwrite.
  - Violet dashed arrow = blend. A blend node lists both parents ("A + B").
  - A tag first seen only as a blend parent sits half a row above the blend.
- **All colonies:** each node notes the colonies where it appeared and on which turn (founded, import, develop, blend, parent…). The first 3 are shown; **+N** has the full list on hover and opens a clickable list on click.
- **Selected colony** (the "Show:" switch): only that colony's own path, from its founding tag through each shift, blend and import, with turn and kind. Imports and developments are chained with dotted edges.
- Clicking a colony name in a note selects that colony and switches to its path. Colonies no longer on the map are greyed out.

## Cluster graph window (dockable; starts minimized in the tray)
- A force-directed layout of Earth bloc flags (with a short label) and colony flags (the existing flag renderer; frame = nation colour, white frame = Independent).
  - **Pulls:** colony ↔ patron, same bloc, allied blocs (same alliance), trade lines, shared lead ideology.
  - **Pushes:** war, seizure or raid pairs (last 6 turns), rival alliances (West vs East), O₂ hoarders (10 turns).
  - New colonies start beside their nation. The patron spring weakens and lengthens as fervor rises. Independents keep only a faint, long tie to their founding bloc, so they drift away.
- Optional faint edges: alliances (grey), wars (red dashed), and the selected colony's patron link (gold).
- **Replay slider** over every recorded turn, with ▶/⏸.
  - Each frame is warm-started from the previous turn's positions. A flag moves at most 30 units per turn, and the transition is tweened, so flags glide instead of jumping. The view refits smoothly.
  - Frames are computed once and cached; deterministic.
  - The slider follows the live game when it is at the end.
- Hovering a flag shows its name (bloc, or colony with patron and fervor). Clicking a colony flag selects it.
- Relation snapshots now also record each colony's `fervor` and hoarder mark (record only).

## Tests
- `tests/lineage021_1.test.ts`:
  - lineage built from blend events (both parents), shift edges, imports as sites only
  - the per-colony filter and its adopt chain
  - on a real game: every blend parent is a node, and colony paths reach their current tags
  - cluster graph: alliance pulls colonies closer, war pushes them farther, fervor drifts a colony from its bloc
  - replay determinism, random access = sequential, max 30 units per turn
- `tests/e2e/lineage.spec.ts` (seed 42, about 80 turns):
  - opens both windows, both sub-tabs, +N, and a colony click (scope switch plus selection)
  - scrubs the slider early and late, plays and pauses, clicks a flag
  - screenshots in `out/smoke/`: `lineage-general.png`, `lineage-culture.png`, `lineage-colony.png`, `cluster-early.png`, `cluster-late.png`
- Firefox runs now save their screenshots to `out/smoke/firefox/` in every spec, so they no longer overwrite the Chromium ones.

## Known
- Late in a game the cluster is mostly Independents, because almost every colony revolts by T80–120 (game behaviour). They gather by trade and shared ideology rather than around nations.
- Colonies that left the map have no current flag and show a plain nation-colour tile in the replay.
- The general tree can be wide (lanes × 176 px). The window scrolls horizontally.
