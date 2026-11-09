import { test } from "node:test";
import assert from "node:assert/strict";
import { flagSvg, solarMapSvg } from "../src/ui/flags.js";

test("0.11.0 flags are deterministic per identity and map renders colonies", () => {
  assert.equal(flagSvg("Nova|Lunar|Localism", "#3232e2"), flagSvg("Nova|Lunar|Localism", "#3232e2"));
  assert.notEqual(flagSvg("A|x|y", "#111111"), flagSvg("B|z|w", "#111111"));
  const svg = solarMapSvg([{ id: "c1", name: "X", body: "Mars", nationColor: "#fff", independent: true, projects: [] }], { Moon: 3, Mars: 1 }, null);
  assert.match(svg, /data-id="c1"/);
});
