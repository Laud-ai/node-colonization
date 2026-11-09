# 0.15.0 — Vexillological flags (nationality, function, ideology)

Tiago's request: "redesign the flag generation system to align with colony nationality, function and ideology following real vexilogical rules and design traditions." Presentation only; no rule changes.

- New flag grammar (`src/flagDesign.ts`, documented in `docs/flags.md`) following the NAVA principles: simple, meaningful, 2–3 standard tinctures (a 4th only with a named tradition), rule of tincture + contrast enforced, no lettering or seals, distinctive but related.
- **Nationality**: each of the 14 Earth blocs has a tradition template (stars and stripes, socialist red with star, Pan-Slavic and Pan-African tricolours, Nordic cross, Commonwealth ensign with union canton, crescent and star, sun disc, UN light blue…). Daughter colonies inherit palette + layout family and are differenced so siblings differ.
- **Function**: the colony's specialty is a simple charge (water drop, wheat, gear, shield, flask, rocket…) placed per tradition.
- **Ideology**: socialist → red + star, Islamic → green + crescent and star, corporate → black field + bars, and so on.
- **Body**: occasionally a Moon (lunar grey) or Mars (rust) shade of the same colour.
- **Independence / bloc flip**: a revolutionary redesign that keeps one heritage colour (or layout on a flip); all colonies of an independent nation share its flag.
- Used everywhere flags appear: colony cards, supplier cards, route labels on the globes, and now the solar map strip.
- Dev gallery: `?flags` or Rules tab → Flag gallery.
- Visual overhaul asset list (no reskin yet): `out/reports/visual-overhaul-assets.md`.
