# 0.15.2 — Route flag fix; colonies fly their own flag

Tiago: "I think the flag update broke the flag trade route highlights" and "each colony should represent their own flag first in their node and have trade nodes as smaller flags so they don't end up overtaking the marker." Presentation only; no rule changes.

- **Bug fix:** since 0.15.0 the trade-partner flags on outer route labels were missing in Firefox. The new flag SVGs already declared their namespace and the route label code added a second one; Firefox rejects the duplicate and drew an empty label. The flag images now load in every browser, and the smoke test checks that route flags really render.
- **Own flag on every colony:** each pin carries the colony's flag as a small pennant just below its head (next to the glyph in Glyphs mode). Level number, fervor ring, badge and alerts stay as they were.
- **Smaller trade flags:** route ends now show only a small partner flag framed in the resource colour, clearly smaller than the colony's own flag. Hover it for the partner name and resource. It fades when it would sit on a pin, and pins always draw on top.
