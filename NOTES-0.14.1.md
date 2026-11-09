# 0.14.1 — Trade routes on the Moon / Mars globes

Tiago's request: "Make trade routes also show up in the body, through the body as an arrow for regional and into or out of space for outer with the line showing the flag of where it's going." Presentation only; no rule changes.

- Every active import route (importer side; Trojan sends skipped) is drawn on the globes, colored by the traded resource (node color).
- **Regional** (both colonies on the same body): an arc across the surface with an arrowhead at the importer; two arrows when the trade is two-way (consented bilateral counter).
- **Outer** (Earth↔Moon, Earth→Mars, Moon↔Mars): a line rising from the colony into space, arrow pointing in (import) or out (export), with a label at the end showing the partner's **flag**, `← / → Earth/Moon/Mars`, partner name and resource. Moon↔Mars colony routes show on both globes (out on the exporter, in on the importer). Several outer lines from one colony fan out.
- **Routes** toggle in the Solar view bar (remembered in this browser). Route meshes are rebuilt only when the route set changes.
