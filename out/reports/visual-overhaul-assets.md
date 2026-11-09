# Node Colonization — visual overhaul asset list (build 0.14.1)

Inventory of every visual element in the live 0.14.1 build and what a visual overhaul needs.
Aligned with the Designer's art direction (Nov 9). **Tiago's decisions win where they conflict.**
That applies to the 0.13.1 pin design, flags on route labels, map-first layout and Pins/Glyphs toggle; each conflict is flagged ⚠ below.
This is a list only: the UI reskin is **not** applied yet. Flags are being redesigned separately in 0.15.0 (see `docs/flags.md`).

**Columns:**
- **Method:** code/SVG, icon sprite, generated raster or audio.
- **Priority:** P1 = do first, P3 = nice to have.
- **Source:** `code` = written by us in TS/CSS/SVG; `NASA` = public-domain imagery; `rfab` = generated art on the rfab.ai budget (P2–P3 only, **no credits spent yet**).
- **Count:** rough number of assets.

## Designer art direction (reference)

| Token | Value |
|---|---|
| Background | `#0B0F14` |
| Panel | `#111822` |
| Header | `#16202C` |
| Border / hairline | `#2A3A4D` (1px) |
| Text | `#E6EDF3` |
| Muted text | `#7D8B99` |
| Accent (amber) | `#F2A541` (rule under the active header, primary buttons) |
| Routes | `#4C9BE8` |
| Water | `#5FC3E4` |
| Success / danger | `#3FB68B` / `#E5484D` |
| Bloc colors | Muted, colourblind-safe (Okabe-Ito tinted) |

- **Type:** IBM Plex Sans for UI and IBM Plex Mono for numbers, self-hosted (no CDN).
- **Shapes:** flat panels, 45° chamfered corners, 8px grid, cards with a 4px bloc stripe and the flag top-left.
- **Icons:** one 24px line-icon SVG sprite with a 1.5px stroke and distinct silhouettes per resource.
- **Mockup:** `/workspace/design/node-colonization/mockup_panel_card.svg`
- **Designer's P1 guess:** UI chrome, icon sprite, flags, globe textures, pins/routes. I agree, with the conflicts noted below.

---

## 1. UI frame: panels, windows, top bar, buttons

| Element | Current (0.14.1) | Proposed upgrade | Method | Pri | Source | Count |
|---|---|---|---|---|---|---|
| Design tokens | Ad-hoc CSS vars (`--bg #0b1020`, gold `#e0b84d`, blue-violet panels) | One `tokens.css` with the Designer palette above; replace every hard-coded hex in `style.css`, `flags.ts`, `needsView.ts` | code | P1 | code | 1 file, ~60 vars |
| Top bar | Sticky header, gold "0.14.1 / ROUTES" badge, rounded buttons | Flat `#16202C` bar, Plex Mono turn counter, amber rule under it, chamfered buttons; End turn as the single amber primary | code/CSS | P1 | code | 1 |
| Side windows (`.win`) | Rounded 8px panels, gold uppercase title, ⇄ – × text buttons | Chamfered panel (45° top-right and bottom-left as in the mockup), `#16202C` header, amber 2px rule under the **active** window header, icon buttons from the sprite | code/CSS | P1 | code | 10 windows, 1 component |
| Bottom tray / Windows menu | Plain chips, checkbox list | Chamfered chips with window icon + count badge; menu as a flat popover with icons | code | P2 | code | 2 |
| Buttons | Several colors (primary blue, good green, danger red, gold) | 3 variants only: amber primary (chamfered, dark text), ghost (hairline), danger `#E5484D`; 8px grid heights (32/24) | code/CSS | P1 | code | 3 variants |
| Inputs (seed, threshold, simulate) | Default browser inputs on dark | Hairline inputs, Plex Mono digits, stepper arrows from the sprite | code | P2 | code | ~6 |
| Scrollbars, focus rings | Browser default | Thin `#2A3A4D` scrollbars, amber focus ring (accessibility) | code | P2 | code | 1 |
| Map-first stage | Globes fill the centre (Tiago) | Keep. Add a chamfered frame and a small corner HUD (body name, lat/long readout in Plex Mono, as in the mockup) | code | P2 | code | 2 |

## 2. Typography

| Element | Current | Proposed | Method | Pri | Source | Count |
|---|---|---|---|---|---|---|
| UI font | `Segoe UI` / system stack | IBM Plex Sans (400/600/700), self-hosted WOFF2 in `src/ui/fonts/` (OFL licence file included) | code | P1 | code (OFL font) | 3 weights |
| Numbers | Proportional system digits | IBM Plex Mono for turn, RP, fervor, coordinates and costs (tabular) | code | P1 | code (OFL font) | 2 weights |
| Canvas text (pin numbers, route labels, specialty codes) | `system-ui` 800 | Plex Sans 700 / Plex Mono loaded before the globe draws (`document.fonts.ready`) | code | P1 | code | 3 draw sites |
| Type scale | Mixed 10–18px | 8px-grid scale: 11 / 12 / 13 / 16 / 20; uppercase tracked section labels (letter-spacing 1.5) | code | P1 | code | 1 scale |

## 3. Icons

| Element | Current | Proposed | Method | Pri | Source | Count |
|---|---|---|---|---|---|---|
| Resource/node symbols (all 19 nodes) | Coloured dot + text code (`H₂O`, `O₂`, `Fd`, `Lg`, `Mil`, `TF`…) in pin badges, supplier cards and the needs tree | One 24px line-icon SVG sprite with a 1.5px stroke and a **distinct silhouette per node**. Shapes: drop (Water), O₂ ring (Oxygen), wheat (Food), bolt (Energy), ore hex (Resources), girder (Infrastructure), people (Population), mask (Culture), banner (Ideology), coin (Money), orbit ring (Logistics), flask (Science), gear (Production), shield (Military), balance (Stability), eye (Subversion), planet + leaf (Terraforming), rocket nozzle (Thrust), crane (Projects). Node colour stays as the accent | SVG sprite | P1 | code | 19 icons |
| Specialty badge on pins | Coloured circle + 2–3 letter code | Same circle, icon from the sprite (white or dark by contrast). Code kept in the tooltip | code | P1 | code | 19 (reuse) |
| Alert icons | Pulsing red ring, crossed swords drawn in canvas, dashed outline | Keep Tiago's semantics ⚠. Redraw the swords with the sprite style; add icons for food/water/O₂ clocks and strain (warning triangle) | SVG sprite | P1 | code | 6 |
| Window/action icons | Text glyphs ⇄ – × ▾ 🌳 | Sprite icons: dock-left/right, minimize, close, menu, tree, routes, pins, glyphs, globe-both/moon/mars | SVG sprite | P1 | code | ~14 |
| Bloc / alliance icons | None (colour dot only) | Small alliance marks (West / East / Neutral / Independent) for cards and tooltips; no seals or letters | SVG | P2 | code | 4 |
| Ideology icons | Text only | Optional mini-glyphs matching the flag charge grammar (star, crescent, bars, gear…) for chips | SVG | P3 | code | ~22 ideologies → ~10 glyph families |
| Culture icons | Text only | Not recommended (cultures blend into hybrids). Keep text chips | — | P3 | — | 0 |

## 4. Markers / pins and routes

| Element | Current (Tiago-approved 0.13.1 / 0.14.1) | Proposed | Method | Pri | Source | Count |
|---|---|---|---|---|---|---|
| Pin head | Bloc-colour disc, bold level number, fervor ring green→amber→red, specialty badge, halo for dark colours | **Keep the design** ⚠ (the Designer's mockup shows a small amber dot pin; Tiago's pin wins). Restyle only: Plex number, sprite badge icon, muted Okabe-Ito bloc colours if Tiago approves the palette swap, 1.5px dark keyline | code (canvas) | P1 | code | 1 drawer |
| Pin stem | Thin cylinder with dark sleeve, 3 tier heights | Keep; match the stem colour to the hairline token at low tiers | code | P2 | code | 1 |
| Glyph markers (Sep 1 HUD style) | Selectable alternative style | Keep as an option; restyle to 1.5px stroke weight | code | P3 | code | 1 |
| Regional routes | Arc tube coloured by resource + cone arrows | Designer: single route colour `#4C9BE8`, dashed. Proposal: base `#4C9BE8` with a small resource icon at the arc midpoint (keeps the resource legible); animated dash flow showing direction | code | P1 | code | 1 |
| Outer routes | Line into space with a label sprite: **partner flag** + body + name + resource | **Keep the flag** ⚠ (Tiago asked for it). Restyle the label as a chamfered tag (Plex Mono), hairline border, route-blue stroke | code | P1 | code | 1 |
| Selection / hover | Cyan outline, HTML tooltip | Amber selection ring (accent), tooltip as a mini card (flag top-left, 4px bloc stripe) | code | P2 | code | 2 |

## 5. Globes

| Element | Current | Proposed | Method | Pri | Source | Count |
|---|---|---|---|---|---|---|
| Moon texture | NASA SVS CGI Moon Kit LROC WAC, 3072×1536, fully lit | Keep. Optional 4k plus the LOLA bump map from the same kit for relief (the Sep 1 project already has `moon-bump.jpg`) | raster | P2 | NASA | 1–2 |
| Mars texture | Viking MDIM 2.1 colourised, 3072×1536 | Keep. Optional MOLA shaded-relief blend for more depth | raster | P2 | NASA/USGS | 1–2 |
| Atmosphere glow | None | Thin rim shader: faint dust-orange haze for Mars, none or subtle for the Moon (realism) | code (shader) | P2 | code | 2 |
| Lighting | Fully lit (Tiago's Sep 1 choice) | Keep fully lit ⚠. Optional soft limb darkening for depth, without a terminator | code | P3 | code | 1 |
| Earth in sky | None | Small Earth sprite in the Moon view's backdrop (NASA Blue Marble, public domain); Phobos/Deimos as dots for Mars | raster | P3 | NASA | 2–3 |
| Starfield | Fixed procedural points | Keep procedural; add slight colour variance and parallax on rotate | code | P3 | code | 1 |
| Body labels / graticule | "MOON"/"MARS" text | Plex Mono label + optional faint lat/long graticule toggle and the coordinate readout from the mockup | code | P2 | code | 2 |

## 6. Flags

| Element | Current (L6) | Proposed (**0.15.0, being built now**) | Method | Pri | Source | Count |
|---|---|---|---|---|---|---|
| Colony flags | Hash → one of 5 random layouts from an 8-colour muted palette; no meaning | Vexillology grammar: Earth tradition per bloc, inherited by daughters with differencing, specialty charge, ideology charge and colours, independence redesign keeping one heritage element. NAVA rules enforced (≤3 tinctures, contrast) | code/SVG | P1 | code | Procedural |
| Earth bloc flags | Same generator keyed by name | Fixed per-bloc base flags in their real tradition (14 blocs) | code/SVG | P1 | code | 14 |
| Flag sizes | 21×14, 30×20, 48×32 | Fixed 3:2 at 3 sizes; 1px keyline `#2A3A4D` per the Designer | code | P1 | code | 3 |
| Bloc palette vs flags | Nation colour = UI accent | UI stripes/pins may use the muted Okabe-Ito bloc palette; **flags keep real tincture colours** ⚠ (per steering: tradition first) | code | P1 | code | — |

## 7. Colony cards and supplier cards

| Element | Current | Proposed | Method | Pri | Source | Count |
|---|---|---|---|---|---|---|
| Colony list card | 4px left border in bloc colour, inline 21×14 flag, text lines | Matches the Designer: 4px bloc stripe, flag top-left (30×20), name 13/600, Plex Mono stats row (RP, level, fervor), sprite icons for clocks and strain | code | P1 | code | 1 template |
| Selected colony detail | Chip groups (ideology/culture/developed…) | Same data, card sections with uppercase muted labels; editable chips keep their behaviour | code | P2 | code | 1 |
| Supplier card | Title, location badge, centred flag, resource circle, relation, line/effect text, action button | Keep Tiago's content (flag **centred** as he asked ⚠; Designer puts it top-left). Restyle: 4px bloc stripe, resource sprite icon, amber chamfered action button ("Import" rather than the mockup's "CONTRACT"), Plex Mono numbers | code | P1 | code | 1 |
| Needs tree | SVG boxes: bloc colour ✓, red ✗, grey | Sprite icon per node inside each box, hairline edges, missing = `#E5484D` outline, success `#3FB68B` tick | code | P1 | code | 1 |
| Legal-move cards | Bordered cards with chips | Same card system, small icons for move kind (import, switch, lend, trojan, invade) | code + sprite | P2 | code | ~8 icons |

## 8. Lobby and setup screens

| Element | Current | Proposed | Method | Pri | Source | Count |
|---|---|---|---|---|---|---|
| Setup card + 4 tabs | Centred card, gold title badge, variant button grids | Full-bleed title screen: key art behind, chamfered tab strip, variant cards in the card system | code | P2 | code | 1 |
| Version / Ruleset list | Button grid | Timeline list (version, date, summary), live badge in amber | code | P2 | code | 1 |
| Rules tab | Checkbox/number form | Grouped toggles with help text; flag gallery link (0.15.0) | code | P3 | code | 1 |
| Snapshot overlay | Plain black bar + iframe | Chamfered top bar "Playing frozen 0.x.y" + back button | code | P3 | code | 1 |

## 9. Event log and banners

| Element | Current | Proposed | Method | Pri | Source | Count |
|---|---|---|---|---|---|---|
| Announcement banners | Gold boxes over the map | Toast cards: icon by event type (founding, revolution, invasion, project, overturn), auto-fade, click to locate on the globe | code + sprite | P2 | code | ~6 event icons |
| Event log | Text lines, bold for important ones | Mono timestamp column (T#), event icons, filter chips (trade / war / politics / growth) | code | P2 | code | 1 |
| Event illustrations | None | Small vignette art for major events (revolution, overturn, invasion, first Mars colony, terraforming milestone, project completion) | generated raster | P3 | rfab | ~6–8 |

## 10. Illustrations

| Element | Current | Proposed | Method | Pri | Source | Count |
|---|---|---|---|---|---|---|
| Title screen / key art | None | One key art (Moon base with Mars on the horizon) for the lobby background and social preview | generated raster | P2 | rfab | 1 (+1 crop) |
| Logo / wordmark | Text "NODE COLONIZATION" | Wordmark in Plex Sans + simple orbit mark; favicon | SVG | P2 | code | 2 |
| Colony portraits | None | Optional portraits by body × specialty tier (L1–4 outpost, L5–9 town, L10+ city). Restrict to body × 3 tiers × ~6 specialty families | generated raster | P3 | rfab | ~36 (or 6 minimum: body × tier) |
| Earth bloc emblems | None | Not needed if bloc flags (0.15.0) are used as the emblem | — | — | — | 0 |

## 11. Sound (optional)

| Element | Proposed | Method | Pri | Source | Count |
|---|---|---|---|---|---|
| UI clicks, end turn, alert ping, revolution sting, ambient hum | Short, quiet SFX with a mute toggle | Public-domain/CC0 libraries or generated | P3 | code (CC0) | ~6 |

## 12. Designer review additions (0.15.1)

List rows only. The UI reskin is **not** implemented; the one exception is the fervor ring non-colour cue, which shipped in 0.15.1.

| Element | Current | Proposed | Method | Pri | Source | Count |
|---|---|---|---|---|---|---|
| Bloc colour table | Per-bloc nation colours (EARTH_NATION_COLORS), not CVD-checked | 14-entry table: 8 colourblind-safe hues (Okabe-Ito based) × light/dark; verify with a CVD simulation (protan/deutan/tritan); the flag is always shown as a second cue | Code + CVD sim script | P1 | code | 14 entries |
| Fervor non-colour cue | Green → amber → red ring | **Done in 0.15.1:** ring split into 3 segments, 1/2/3 lit (<50%, 50–80%, ≥80% of threshold), plus a dashed outer ring when critical (≥90%); colour kept as a second cue | Code (`pinIcon.ts` `fervorCue`) | P1 | code | 1 |
| Alert red token | Several reds (#ef4444, #E5484D, bloc/flag reds) | One alert-red token (Designer danger #E5484D); flag reds (gules/rust) never used in alert UI | Code (tokens) | P1 | code | 1 token |
| Font fallback | system-ui | Plex-metric system fallback stack (size-adjust / ascent overrides) so layout doesn't jump before Plex loads | Code (CSS @font-face) | P1 | code | 2 faces |
| UI states | Mostly none | Empty, loading, disabled and error states for windows/cards/buttons + a turn-transition indicator | Code | P2 | code | ~5 states + 1 indicator |
| Motion + legibility | No reduced-motion handling; some muted text <11px | `prefers-reduced-motion` (no globe auto-spin, no dash flow) and a ≥11px minimum for muted text | Code (CSS) | P2 | code | global |
| Legend window | Collapsible legend text under the globes | Legend window: anatomy of a pin (head, level, fervor ring, badge, alerts, stem tiers) + route colours | Code + 24px sprite | P2 | code | 1 window |
| Small-viewport docking | Side windows dock left/right at any width | Rules for small viewports: auto-minimize to the tray, single dock side, bottom sheet under ~900px | Code | P2 | code | 1 rule set |
| Favicon + OG image | None | Favicon (SVG + 32px PNG) and a 1200×630 OG share image | Code (SVG) / rfab for OG art | P3 | code / rfab | 2–3 files |

---

## P1 summary (do first)

1. **Tokens and chrome:** Designer palette, Plex Sans/Mono self-hosted, chamfered flat panels with amber active rule, 3 button variants. All code, no art budget.
2. **Icon sprite:** 24px 1.5px-stroke sprite covering 19 resource nodes plus about 20 UI/alert icons, reused in pins, cards, needs tree and route midpoints.
3. **Flags:** vexillology-based generator (shipped 0.15.0; 0.15.1 small mode, lighter keyline, multinational fixes), 14 Earth base flags, real tinctures kept over the muted UI palette.
4. **Pins and routes restyle:** keep Tiago's pin and route-flag designs, restyle in the token system, routes in `#4C9BE8` with resource icon and dash flow.
5. **Cards:** colony, supplier and needs-tree cards moved to the 4px-stripe card system. Supplier flag stays centred (Tiago) unless he okays the Designer's top-left.
6. **Accessibility (Designer review, 0.15.1):** CVD-checked 14-entry bloc colour table with the flag as second cue, fervor non-colour cue (shipped), one alert-red token, Plex-metric font fallback.

**Globe textures** (Designer P1) are already shipped from NASA and are listed as P2 polish here.

## Where the Designer and Tiago differ (Tiago wins unless he changes his mind)

- **Pin:** the mockup shows an amber dot with a halo. Tiago approved the 0.13.1 pin (bloc head, level number, fervor ring, badge, alerts). Keep that, restyled.
- **Routes:** the mockup has a single dashed blue route with no flag. Tiago asked for **flags on outer route labels**, so keep the flag.
- **Supplier card flag:** Designer puts it top-left; Tiago asked for a **centre** flag image. Keep it centred on supplier cards and use top-left on colony list cards.
- **Bloc colours:** muted Okabe-Ito tints are fine for UI stripes and pins (needs Tiago's okay since pins are his). **Flags use real tradition tinctures.**
- **Mockup content** ("CONTRACT", "₵ 320", "ETA 9 turns", "FE 12") is placeholder. The game has no currency or ETA mechanic; the cards show only real game data.
