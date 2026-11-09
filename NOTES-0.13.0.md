# 0.13.0 — 3D Moon + Mars globes as the live solar view

Presentation only — no rule or engine changes (sim stays headless; determinism tests unchanged).

- **Solar view card** (play screen): fully lit 3D Moon and Mars globes, side by side or one at a time (Moon + Mars / Moon / Mars toggle). Drag to rotate, wheel to zoom.
- Rendering approach and HUD glyphs reused from the Sep 1 Moon Globe: L1 small full circle, L2–L4 3-wedge fills, L5–L9 6-wedge fills, L10 solid disc + empty ring, then add/fill rings after L10.
- Every Moon/Mars colony is a HUD marker on its body: glyph = colony level, color = its nation/bloc color (same as the colony cards). Markers update every render (founding, level-ups, bloc/ideology flips, independence, destruction).
- Hover a marker for name / level / patron / RP / ideology; click selects the same colony as the list (and clicking a colony card turns the globe to it).
- Sites are deterministic per game seed (hash of seed + colony id), spaced ≥10° apart, stable across turns. Cosmetic siting bias: Moon favours the south-polar region, Mars low–mid latitudes. No hardcoded names or events.
- three.js + textures load lazily on entering play. Old solar map strip kept below the globes (Earth + TF bars); it is also the fallback if WebGL is unavailable.
- Textures (public domain): Moon — NASA SVS CGI Moon Kit (LRO LROC WAC color mosaic); Mars — Viking MDIM 2.1 colorized global mosaic (NASA/JPL/USGS, via Wikimedia Commons). Credits in the Rules tab.
