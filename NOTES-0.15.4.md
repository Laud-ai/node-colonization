# 0.15.4 — Needs tree: red only under a developed node

Tiago: "water, oxygen, food, energy, infrastructure and resources are all in red at the start when they should be grey, red only if directly below an existing developed green node that needs it." Display only; no rule changes.

- **Red (missing)** now means: a developed (green) node directly above needs this node and the colony doesn't have it. Being the Requires node (★) or a survival basic no longer makes a box red on its own.
- **Grey (possible expansion):** the basics (Resources, Infrastructure, Energy, Food, Water, Oxygen) whenever the colony doesn't have them, plus any node whose prerequisites the colony already has.
- **Other (locked):** everything else, whose prerequisites aren't there yet.
- A new colony therefore starts with its specialty in blue, the basics in grey and no red.
- The red "!" on an owned node that is under-covered (strain) is unchanged.
