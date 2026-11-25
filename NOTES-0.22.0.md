# 0.22.0 — Floating windows

Tiago: *"I want a grandstrategy style menu that we can open and close tabs from, move them around and resize them according to our will over the top of a fullscreen covering of the 3D map. The boxes should adjust to fit the size chosen."*

This is a UI-only release; the simulation is unchanged. There is a new Rules-tab group, **UI**, with one rule:

| id | default | what it does |
|---|---|---|
| `floatingWindows` | on | Floating windows over a full-screen map. **Off = the exact 0.21.1 docked layout** (side docks, tray, Windows ▾ menu). |

## Layout
- **The 3D map fills the whole viewport** behind everything. The globe bar (view modes, pins/glyphs, routes, legend) sits centred between the window columns.
- **The top menu bar** keeps the brand, turn / acting / phase, Auto-resolve, **End turn**, Found, Simulate N and New game. Below them is one button per window: Needs tree, Suppliers, Legal moves, Earth blocs, Solar independents, Game settings, Selected colony (Details / History), Colonies, Event log, Lineage, Cluster graph, Map legend and Solar map strip.
  - Clicking a button opens or closes that window.
  - Open windows are highlighted in gold; minimized ones have a dashed border.
  - **Reset layout** is at the right end.
  - Windows switched off by their own rule (Lineage, Cluster graph) are left out.
- **Windows float over the map:**
  - drag by the title bar
  - resize from any edge or corner (min 220 × 120)
  - **–** collapses to the title bar; **×** closes
  - clicking a window brings it to the front
  - windows stay inside the viewport below the menu bar, and are re-clamped when the browser is resized
- **Contents reflow** to the chosen size. A `ResizeObserver` gives each window `w-narrow` / `w-wide` classes and a `--win-w` variable.
  - Bodies flex to the window and scroll when needed; tables and chip rows wrap.
  - The cluster graph's SVG fills the window and refits its view.
  - The lineage tree scrolls inside its window.
  - The needs tree scales to the width.
- **The layout is remembered** in `localStorage` (`nc.float.v1`): position, size, open / minimized / closed, and z-order.
- **First-load default:** Needs tree and Legal moves stacked on the left edge, Selected colony and Colonies on the right edge (each column about 26% of the width, max 360 px). The map centre stays free.
- **Map interaction** (orbit, zoom, hover / click colonies) works anywhere no window is: the float layer passes pointer events through.

## Tests
- `tests/floatLayout022.test.ts` checks the pure layout store (`src/ui/floatLayout.ts`):
  - clamping to the viewport, the menu bar and the minimum size
  - edge / corner resizing
  - the default layout keeps the centre free and stacks columns without overlap
  - save / load round-trip, bad-value fallback, re-clamp to a smaller screen
  - z-order
- `tests/e2e/floating.spec.ts`:
  - full-screen map
  - every window listed in the menu, End turn reachable
  - map centre hits the globe
  - open / close from the menu, × close
  - drag
  - bring to front
  - SE-corner resize grows the inner width and the cluster SVG
  - minimum width holds
  - can't drag off-screen; browser resize re-clamps
  - **persistence across reload**
  - Reset layout
  - **rule off = docked layout**
  - screenshots: `out/smoke/floating-default.png`, `floating-resized.png`, `floating-off-docked.png`
- The pre-0.22 specs (smoke, belt, crises, history, lineage) start their games with `floatingWindows` off (`tests/e2e/docked.ts`), so they keep covering the docked layout.
