import { solarMapSvg } from "./flags.js";
import { flagDesignToSvg } from "../flagDesign.js";
import { flagGalleryHtml } from "./flagGallery.js";
import { SiteBook } from "./colonySites.js";
import type { GlobeMarker, GlobeRoute, GlobeView, MarkerStyle } from "./globe.js";
import { NODE_COLORS } from "../nodes.js";
import { SPECIALTY_CODE } from "./pinIcon.js";
import { initWindows, openWindow, isOpen } from "./windows.js";
import { needsTreeHtml, suppliersHtml } from "./needsView.js";
import type { NodeType } from "../types.js";
import {
  GameSession,
  randomSeed,
  FERVOR_VARIANTS,
  DEFAULT_VARIANT_ID,
  variantById,
  variantKnobLine,
  SOLAR_BLOC_VARIANTS,
  DEFAULT_SOLAR_VARIANT_ID,
  solarVariantById,
  solarVariantKnobLine,
  RULE_DEFS,
  defaultRules,
  legacyRules,
  type Rules,
  type UiSnapshot,
  type MoveOption,
} from "../session.js";

type UiPhase = "setup" | "playing";
type SetupTab = "fervor" | "solar" | "versions" | "rules";
let selectedRules: Rules = defaultRules();

let uiPhase: UiPhase = "setup";
let setupTab: SetupTab = "fervor";
let selectedVariantId = DEFAULT_VARIANT_ID;
let selectedSolarVariantId = DEFAULT_SOLAR_VARIANT_ID;
/** Session exists only while playing (created on Begin). */
let session: GameSession | null = null;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function esc(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function showPhase(phase: UiPhase): void {
  uiPhase = phase;
  const setup = $("setupScreen");
  const play = $("playScreen");
  if (phase === "setup") {
    setup.hidden = false;
    play.hidden = true;
  } else {
    setup.hidden = true;
    play.hidden = false;
  }
}

function renderSetupTabs(): void {
  document.querySelectorAll<HTMLElement>("[data-setup-tab]").forEach((btn) => {
    const id = btn.dataset.setupTab as SetupTab;
    const on = id === setupTab;
    btn.classList.toggle("selected", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  const fervorPanel = document.getElementById("setupTabFervor");
  const solarPanel = document.getElementById("setupTabSolar");
  if (fervorPanel) fervorPanel.hidden = setupTab !== "fervor";
  if (solarPanel) solarPanel.hidden = setupTab !== "solar";
  const verPanel = document.getElementById("setupTabVersions");
  if (verPanel) verPanel.hidden = setupTab !== "versions";
  if (setupTab === "versions") void renderVersions();
  const rulesPanel = document.getElementById("setupTabRules");
  if (rulesPanel) rulesPanel.hidden = setupTab !== "rules";
  if (setupTab === "rules") renderRules();
}

function renderSetup(): void {
  renderSetupTabs();

  const grid = $("fervorVariantButtons");
  grid.innerHTML = FERVOR_VARIANTS.map((v) => {
    const sel = v.id === selectedVariantId ? " selected" : "";
    const def = v.id === DEFAULT_VARIANT_ID ? ' <span class="variant-default">default</span>' : "";
    return `<button type="button" class="variant-btn${sel}" data-variant="${esc(v.id)}">
      <span class="variant-id">${esc(v.id)}${def}</span>
      <span class="variant-label">${esc(v.label)}</span>
    </button>`;
  }).join("");

  const v = variantById(selectedVariantId) ?? FERVOR_VARIANTS[0]!;
  $("fervorVariantTitle").textContent = `${v.id} — ${v.label}`;
  $("fervorVariantSummary").textContent = v.summary;
  $("fervorVariantKnobs").textContent = variantKnobLine(v);

  const solarGrid = document.getElementById("solarVariantButtons");
  if (solarGrid) {
    solarGrid.innerHTML = SOLAR_BLOC_VARIANTS.map((sv) => {
      const sel = sv.id === selectedSolarVariantId ? " selected" : "";
      const def = sv.id === DEFAULT_SOLAR_VARIANT_ID ? ' <span class="variant-default">default</span>' : "";
      return `<button type="button" class="variant-btn${sel}" data-solar-variant="${esc(sv.id)}">
        <span class="variant-id">${esc(sv.id)}${def}</span>
        <span class="variant-label">${esc(sv.label)}</span>
      </button>`;
    }).join("");
  }
  const sv = solarVariantById(selectedSolarVariantId) ?? SOLAR_BLOC_VARIANTS[0]!;
  const st = document.getElementById("solarVariantTitle");
  const ss = document.getElementById("solarVariantSummary");
  const sk = document.getElementById("solarVariantKnobs");
  if (st) st.textContent = `${sv.id} — ${sv.label}`;
  if (ss) ss.textContent = sv.summary;
  if (sk) sk.textContent = solarVariantKnobLine(sv);

  const thr = $("setupThreshold") as HTMLInputElement;
  if (document.activeElement !== thr) thr.value = String(v.params.threshold);
}

function beginSimulation(): void {
  const raw = ($("setupSeed") as HTMLInputElement).value.trim();
  const seed = raw === "" ? randomSeed() : (Number(raw) >>> 0) || randomSeed();
  ($("setupSeed") as HTMLInputElement).value = String(seed);
  ($("seedInput") as HTMLInputElement).value = String(seed);

  const thrRaw = Number(($("setupThreshold") as HTMLInputElement).value);
  const thr = Number.isFinite(thrRaw) && thrRaw >= 1 ? Math.floor(thrRaw) : undefined;

  session = GameSession.create(seed || 1, {
    rules: { ...selectedRules },
    variantId: selectedVariantId,
    solarVariantId: selectedSolarVariantId,
    independenceThreshold: thr,
  });

  const live = document.getElementById("fervorVariantLive");
  if (live) live.textContent = session.fervorVariantId;
  const liveSolar = document.getElementById("solarVariantLive");
  if (liveSolar) liveSolar.textContent = session.solarVariantId;

  sites = null;
  showPhase("playing");
  render();
}

function returnToSetup(): void {
  session = null;
  // Keep last selected variant + threshold for convenience
  const thrEl = document.getElementById("indepThreshold") as HTMLInputElement | null;
  if (thrEl) {
    const n = Number(thrEl.value);
    if (Number.isFinite(n) && n >= 1) ($("setupThreshold") as HTMLInputElement).value = String(Math.floor(n));
  }
  const seedPlay = ($("seedInput") as HTMLInputElement).value.trim();
  if (seedPlay) ($("setupSeed") as HTMLInputElement).value = seedPlay;
  showPhase("setup");
  renderSetup();
}

function requireSession(): GameSession {
  if (!session) throw new Error("No active session");
  return session;
}

function render(): void {
  if (uiPhase !== "playing" || !session) return;
  const snap = session.snapshot();
  $("turn").textContent = String(snap.turn);
  $("seed").textContent = String(snap.seed);
  $("phase").textContent = snap.phase;
  $("acting").textContent = snap.actingName ?? "none — end turn";
  const thrEl = document.getElementById("indepThreshold") as HTMLInputElement | null;
  if (thrEl && document.activeElement !== thrEl) thrEl.value = String(snap.independenceThreshold ?? 10);
  const live = document.getElementById("fervorVariantLive");
  if (live) live.textContent = session.fervorVariantId;
  const liveSolar = document.getElementById("solarVariantLive");
  if (liveSolar) liveSolar.textContent = session.solarVariantId;
  renderAnnouncements(snap);
  const leadEl = document.getElementById("leadingNation");
  if (leadEl) {
    const parts: string[] = [];
    if (snap.leadingNationLabel) parts.push(`Leading nation: ${snap.leadingNationLabel}`);
    if ((snap.threatLevel || 0) > 0) parts.push(`West↔East threat ${snap.threatLevel}/3`);
    leadEl.textContent = parts.join(" · ");
    leadEl.hidden = parts.length === 0;
  }
  renderBlocs(snap);
  renderIndependents(snap);
  renderColonies(snap);
  renderSolarMap(snap);
  renderGlobes(snap);
  renderDetail(snap);
  renderNeeds(snap);
  renderSuppliers(snap);
  renderLogistics(snap);
  renderMoves(snap);
  renderLog(snap);
  ($("btnAuto") as HTMLButtonElement).disabled = !snap.actingId;
  const foundBtn = $("btnFound") as HTMLButtonElement;
  foundBtn.disabled = !snap.canFound;
  foundBtn.title = snap.foundingTaxHint ?? "No bloc eligible to found";
  const taxEl = document.getElementById("foundTaxHint");
  if (taxEl) {
    taxEl.textContent = snap.canFound && snap.foundingTaxHint ? snap.foundingTaxHint : "";
    (taxEl as HTMLElement).hidden = !(snap.canFound && snap.foundingTaxHint);
  }
}

function renderAnnouncements(snap: UiSnapshot): void {
  const el = $("announcements");
  if (!snap.turnAnnouncements.length) { el.innerHTML = ""; el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = snap.turnAnnouncements.map((m) => `<div class="announce-banner">${esc(m)}</div>`).join("");
}

function renderBlocs(snap: UiSnapshot): void {
  $("blocs").innerHTML = snap.blocs.map((b) => {
    const chips = b.excess.map((s) => {
      const cls = s.claimedBy ? "node-chip claimed" : "node-chip free";
      const label = s.claimedBy ? `${esc(s.node)} → ${esc(s.claimedName || s.claimedBy)}` : esc(s.node);
      return `<span class="${cls}"><span class="dot" style="background:${s.color}"></span>${label}</span>`;
    }).join(" ");
    let tech = b.activeColonial
      ? `<span class="active-colonial">Active colonial player</span><div class="tags">founding tax ${b.foundingTax}</div>`
      : `<div class="tags">tech ${b.tech}/${b.cap}</div><div class="tech-bar"><span style="width:${Math.min(100,(b.tech/Math.max(1,b.cap))*100)}%"></span></div>`;
    const lead = b.leadingNation ? ' <span class="rp">leading nation</span>' : "";
    return `<div class="bloc${b.activeColonial ? " active-bloc" : ""}" style="border-left:4px solid ${esc(b.nationColor)}">
      <div class="name"><span class="dot" style="background:${esc(b.nationColor)};display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px"></span>${esc(b.name)} <span class="rp">${esc(b.alliance)}</span>${lead}</div>
      <div class="tags">Nation RP: ${b.nationRp} · excess ${b.claimed}/${b.excessCount} · colonies ${b.colonies}</div>
      ${tech}
      <div class="tags" style="margin-top:6px">${chips || "—"}</div>
    </div>`;
  }).join("");
}

function renderIndependents(snap: UiSnapshot): void {
  const el = document.getElementById("independents");
  if (!el) return;
  if (!snap.independentGroups.length) {
    el.innerHTML = `<div class="tags">No Independent networks yet.</div>`;
    return;
  }
  el.innerHTML = snap.independentGroups.map((g) => {
    const members = g.members.map((m) => esc(m)).join(", ");
    const lead = g.leadingNation ? ' <span class="rp">leading nation</span>' : "";
    const color = g.nationColor || "#94a3b8";
    return `<div class="bloc" style="border-left:4px solid ${esc(color)}">
      <div class="name"><span class="dot" style="background:${esc(color)};display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px"></span>${esc(g.liegeName)} <span class="rp">Independent</span>${lead}</div>
      <div class="tags">Nation RP: ${g.nationRp ?? g.totalRp} · ${g.colonyCount} colonies</div>
      <div class="tags" style="margin-top:6px">${members}</div>
    </div>`;
  }).join("");
}

function l6On(): boolean { return session?.state.rules?.l6Presentation !== false && !!session?.state.rules; }
function renderSolarMap(snap: UiSnapshot): void {
  const card = $("solarMapCard");
  card.hidden = !l6On();
  if (card.hidden) return;
  $("solarMap").innerHTML = solarMapSvg(
    snap.colonies.map((c) => ({ id: c.id, name: c.name, body: c.body, nationColor: c.nationColor || "#64748b", independent: c.independent, projects: c.projectsDone, flag: c.flag })),
    snap.bodyTF as Record<string, number>, snap.selectedId);
}
// --- 0.13.0 Moon / Mars globes (render reads the UI snapshot only) ---
let sites: SiteBook | null = null;
let globes: { Moon: GlobeView; Mars: GlobeView } | null = null;
let globesLoading = false;
let markerStyle: MarkerStyle = (() => { try { return localStorage.getItem("nc.markerStyle") === "glyph" ? "glyph" : "pin"; } catch { return "pin"; } })();
let showRoutes = (() => { try { return localStorage.getItem("nc.routes") !== "off"; } catch { return true; } })();
function syncRoutesButton(): void {
  const b = document.getElementById("btnRoutes");
  if (b) { b.classList.toggle("selected", showRoutes); b.setAttribute("aria-pressed", String(showRoutes)); }
}
syncRoutesButton();
document.getElementById("btnRoutes")?.addEventListener("click", () => {
  showRoutes = !showRoutes;
  try { localStorage.setItem("nc.routes", showRoutes ? "on" : "off"); } catch { /* private mode */ }
  syncRoutesButton();
  if (session) renderGlobes(session.snapshot());
});
function syncStyleButtons(): void {
  document.querySelectorAll<HTMLElement>("[data-marker-style]").forEach((b) => b.classList.toggle("selected", b.dataset.markerStyle === markerStyle));
}
syncStyleButtons();
document.querySelector(".marker-styles")?.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("[data-marker-style]") as HTMLElement | null;
  if (!btn?.dataset.markerStyle) return;
  markerStyle = btn.dataset.markerStyle === "glyph" ? "glyph" : "pin";
  try { localStorage.setItem("nc.markerStyle", markerStyle); } catch { /* private mode */ }
  syncStyleButtons();
  globes?.Moon.setStyle(markerStyle); globes?.Mars.setStyle(markerStyle);
});
function selectFromGlobe(id: string): void {
  if (!session) return;
  session.select(id);
  openWindow("needs");
  render();
  document.querySelector(`#colonies .colony[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
}
function renderGlobes(snap: UiSnapshot): void {
  if (!globes) {
    if (!globesLoading) {
      globesLoading = true;
      $("globeStatus").textContent = "Loading globes…";
      import("./globe.js").then(({ GlobeView }) => {
        globes = { Moon: new GlobeView($("globeMoon"), "Moon", selectFromGlobe), Mars: new GlobeView($("globeMars"), "Mars", selectFromGlobe) };
        globes.Moon.setStyle(markerStyle); globes.Mars.setStyle(markerStyle);
        $("globeStatus").textContent = "";
        if (session) renderGlobes(session.snapshot());
      }).catch((err: unknown) => {
        console.warn("Globe view unavailable", err);
        $("globeStatus").textContent = "3D globes unavailable in this browser (WebGL) — the solar map strip below still shows colonies.";
        $("solarMapCard").hidden = false;
      });
    }
    return;
  }
  if (!sites || sites.seed !== snap.seed) sites = new SiteBook(snap.seed);
  const placed = sites.place(snap.colonies.map((c) => ({ id: c.id, body: c.body })));
  const by: Record<"Moon" | "Mars", GlobeMarker[]> = { Moon: [], Mars: [] };
  for (const c of snap.colonies) {
    const site = placed.get(c.id)!;
    const ideo = c.ideology.length ? c.ideology.join(" / ") : "—";
    const thr = Math.max(1, snap.independenceThreshold || 10);
    const need = c.strain > 0 || c.foodClock > 0 || c.waterClock > 0 || c.oxygenClock > 0;
    const fresh = c.foundedTurn === snap.turn && snap.turn > 1;
    const alerts: string[] = [];
    if (c.strain > 0) alerts.push(`strain ${c.strain}`);
    if (c.foodClock > 0) alerts.push(`food clock ${c.foodClock}`);
    if (c.waterClock > 0) alerts.push(`water clock ${c.waterClock}`);
    if (c.oxygenClock > 0) alerts.push(`O₂ clock ${c.oxygenClock}`);
    if (c.atWar) alerts.push(c.proxyAgitation > 0 ? `proxy war (agitation ${c.proxyAgitation})` : "invasion");
    if (fresh) alerts.push("founded this turn");
    by[c.body].push({
      id: c.id, lat: site.lat, lon: site.lon, level: c.level, color: c.nationColor || "#64748b",
      independent: c.independent, fervor: c.independent ? null : Math.max(0, c.fervor) / thr,
      specialty: c.specialty, alert: need, war: c.atWar, fresh,
      flagSvg: flagDesignToSvg(c.flag, 30, 20),
      info: [
        c.name,
        `L${c.level} · ${c.body} · ${c.independent ? "Independent" : c.patron}`,
        `Specialty ${c.specialty} (${SPECIALTY_CODE[c.specialty]}) · requires ${c.requires}`,
        `RP ${c.rp} · Nation RP ${c.nationRp}${c.independent ? "" : ` · Fervor ${c.fervor}/${thr}`}`,
        `Ideology: ${ideo}`,
        ...(alerts.length ? [`⚠ ${alerts.join(" · ")}`] : []),
      ],
    });
  }
  globes.Moon.update(by.Moon, snap.selectedId);
  globes.Mars.update(by.Mars, snap.selectedId);
  // 0.14.1 trade routes on the bodies
  const rt: Record<"Moon" | "Mars", GlobeRoute[]> = { Moon: [], Mars: [] };
  const fan = new Map<string, number>();
  const nextFan = (id: string) => { const n = fan.get(id) ?? 0; fan.set(id, n + 1); return n; };
  for (const r of snap.routes) {
    const to = placed.get(r.toId);
    if (!to) continue;
    const color = NODE_COLORS[r.node] || "#94a3b8";
    const counter = r.counterNode ? ` ⇄ ${r.counterNode}` : "";
    if (r.fromKind === "colony" && r.fromBody === r.toBody) {
      const from = placed.get(r.fromId);
      if (!from) continue;
      rt[r.toBody].push({ id: r.id, kind: "regional", color, a: from, b: to, twoWay: !!r.counterNode });
      continue;
    }
    rt[r.toBody].push({
      id: r.id, kind: "outer", color, a: to, inbound: true, twoWay: !!r.counterNode, otherBody: String(r.fromBody),
      flagSvg: flagDesignToSvg(r.fromFlag, 30, 20), label: `${r.fromName} · ${r.node}${counter}`, fanIndex: nextFan(r.toId),
    });
    if (r.fromKind === "colony" && r.fromBody !== "Earth") {
      const from = placed.get(r.fromId);
      if (from) rt[r.fromBody as "Moon" | "Mars"].push({
        id: r.id + ":out", kind: "outer", color, a: from, inbound: false, twoWay: !!r.counterNode, otherBody: r.toBody,
        flagSvg: flagDesignToSvg(r.toFlag, 30, 20), label: `${r.toName} · ${r.node}${counter}`, fanIndex: nextFan(r.fromId),
      });
    }
  }
  globes.Moon.setRoutes(rt.Moon, showRoutes);
  globes.Mars.setRoutes(rt.Mars, showRoutes);
}
document.querySelector(".globe-modes")?.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("[data-globe-mode]") as HTMLElement | null;
  if (!btn?.dataset.globeMode) return;
  document.querySelectorAll(".globe-modes [data-globe-mode]").forEach((b) => b.classList.toggle("selected", b === btn));
  $("globeWrap").className = `globe-wrap mode-${btn.dataset.globeMode}`;
});

// --- 0.14.0 Needs tree + suppliers ---
let supplierFilter: NodeType | null = null;
let supplierFor: string | null = null;
function renderNeeds(snap: UiSnapshot): void {
  const el = document.getElementById("needsTree");
  if (!el || !session) return;
  const sel = snap.selected;
  if (!sel) { el.textContent = "Select a colony (click a pin or a colony card)."; return; }
  const tree = session.needsTree(sel.id);
  if (!tree) return;
  el.innerHTML = needsTreeHtml(tree, { name: sel.name, color: sel.nationColor || "#64748b", requires: sel.requires });
}
function renderSuppliers(snap: UiSnapshot): void {
  const el = document.getElementById("suppliers");
  if (!el || !session) return;
  const sel = snap.selected;
  if (!sel) { el.textContent = "Select a colony."; return; }
  if (supplierFor !== sel.id) { supplierFor = sel.id; supplierFilter = null; }
  if (!isOpen("suppliers")) return; // computed only when visible (keeps turns fast)
  const tree = session.needsTree(sel.id) ?? [];
  const chips = tree.filter((t) => t.state === "missing" || t.state === "expand").map((t) => ({ node: t.node, state: t.state }));
  const list = session.suppliers(sel.id, supplierFilter);
  el.innerHTML = suppliersHtml(list, sel.name, supplierFilter, chips, snap.actingId === sel.id);
}
document.getElementById("needsTree")?.addEventListener("click", (e) => {
  const n = (e.target as Element).closest?.("[data-node]")?.getAttribute("data-node");
  if (!n || !session) return;
  supplierFilter = n as NodeType;
  openWindow("suppliers");
  render();
});
document.getElementById("suppliers")?.addEventListener("click", (e) => {
  if (!session) return;
  const t = e.target as HTMLElement;
  const key = t.closest("[data-move-key]")?.getAttribute("data-move-key");
  if (key) { session.applyByKey(key); render(); return; }
  const nb = t.closest("[data-sup-node]");
  if (nb) { const v = nb.getAttribute("data-sup-node"); supplierFilter = v ? (v as NodeType) : null; render(); }
});

function renderColonies(snap: UiSnapshot): void {
  $("colonies").innerHTML = snap.colonies.map((c) => {
    const classes = ["colony", c.isActing ? "active" : "", c.id === snap.selectedId ? "selected" : "", c.acted ? "acted-dim" : ""].filter(Boolean).join(" ");
    const ideo = c.ideology.length ? c.ideology.map(esc).join(" / ") : "—";
    const cult = c.culture.length ? c.culture.map(esc).join(" / ") : "—";
    const blendNote = [...c.ideology, ...c.culture].some((t) => /hybrid|Eurasian|Atlantic|-/i.test(t))
      ? '<div class="tags">blend noted</div>' : "";
    const fervorLine = c.independent
      ? `<div class="tags">Independent · liege ${esc(c.liegeId || "—")}${c.canFoundIndependent ? " · can found" : ""}</div>`
      : `<div class="tags need">Fervor ${c.fervor}</div>`;
    const clockBits: string[] = [];
    if (c.foodClock > 0) clockBits.push(`food⏱${c.foodClock}`);
    if (c.waterClock > 0) clockBits.push(`water⏱${c.waterClock}`);
    if (c.oxygenClock > 0) clockBits.push(`O₂⏱${c.oxygenClock}`);
    if (c.hasMilitaryToken) clockBits.push("⚔Mil");
    const clockLine = clockBits.length ? `<div class="tags need">${clockBits.map(esc).join(" · ")}</div>` : "";
    const nc = c.nationColor || "#64748b";
    return `<div class="${classes}" data-id="${c.id}" style="border-left:4px solid ${esc(nc)}">
      <div class="name">${l6On() ? flagDesignToSvg(c.flag, 21, 14, c.name) + " " : `<span class="dot" style="background:${esc(nc)};display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px"></span>`}${esc(c.name)} <span class="rp">L${c.level}</span> <span class="rp">RP ${c.rp}</span></div>
      <div class="tags">${c.body} · ${esc(c.patron)} · Nation RP ${c.nationRp} · ${c.specialty} · ${c.acted ? "acted" : "waiting"}</div>
      <div class="tags need">Requires ${c.requires} · lines ${c.logiAvail}/${c.logiCap} (occ ${c.occupied}) · strain ${c.strain}</div>
      ${fervorLine}
      ${clockLine}
      ${c.projectsDone.length || c.projectActive ? `<div class="tags">🏗 ${esc(c.projectsDone.join(", "))}${c.projectActive ? `${c.projectsDone.length ? " · " : ""}building ${esc(c.projectActive)} ${c.projectProgress}` : ""}</div>` : ""}
      <div class="tags">Ideology: ${ideo}</div>
      <div class="tags">Culture: ${cult}</div>
      ${blendNote}
    </div>`;
  }).join("");
}

function renderLogistics(snap: UiSnapshot): void {
  const el = $("logistics");
  if (!el) return;
  const c = snap.selected;
  if (!c) { el.innerHTML = ""; return; }
  const nc = c.nationColor || "#64748b";
  el.innerHTML = `<div class="summary-title" style="border-left:4px solid ${esc(nc)};padding-left:8px">Logistics — ${esc(c.name)}</div>` +
    c.lines.map((l) => {
      const reach = l.reach ? ` [${esc(l.reach)}]` : "";
      const vital = l.vital ? " vital" : "";
      return `<div class="logi-line ${l.free ? "free" : "busy"}${vital}"><span>${esc(l.name)}${reach}${l.vital ? " · vital" : ""}</span><span>${esc(l.status)}</span></div>`;
    }).join("");
}

function editableChip(label: string, kind: string, index: number, colonyId: string): string {
  return `<span class="chip editable-chip" contenteditable="true" spellcheck="false"
    data-edit="${kind}" data-index="${index}" data-colony="${esc(colonyId)}"
    title="Edit · Enter or blur to save">${esc(label)}</span>`;
}

function renderDetail(snap: UiSnapshot): void {
  const el = $("detail");
  const sel = snap.selected;
  if (!sel) { el.textContent = "Select a colony."; return; }
  const group = (title: string, items: string[], cls: string) =>
    `<div class="summary-group ${cls}"><div class="summary-title">${title}</div><div class="summary-items">${
      items.length ? items.map((x) => `<span class="chip">${esc(x)}</span>`).join("") : '<span class="tags">—</span>'
    }</div></div>`;
  const rows = sel.nodes.map((n) => {
    if (n.specialty) return `<tr><td>${n.node} ★ ◇</td><td>${n.extras}</td><td class="ok">specialty</td></tr>`;
    const miss = n.missingDeps.length ? `needs ${n.missingDeps.join(", ")}` : (n.developed > 0 ? "ok" : "clean");
    return `<tr><td>${n.node}${n.clean > 0 ? " ◇" : ""}</td><td>${n.extras}</td><td class="${n.covered ? "ok" : "bad"}">${miss}</td></tr>`;
  }).join("");
  const needsItems: string[] = [`Requires ${sel.requires}`];
  for (const n of sel.summary.inUseStrained) {
    const row = sel.nodes.find((x) => x.node === n);
    const miss = row?.missingDeps ?? [];
    if (miss.length) needsItems.push(`${n} missing ${miss.join(", ")}`);
  }
  const ideoChips = sel.ideology.map((t, i) => editableChip(t, "ideology", i, sel.id)).join("");
  const importedChips = sel.ideologyImported.map((t, i) => editableChip(t, "ideologyImported", i, sel.id)).join("");
  const cultChips = sel.culture.map((t, i) => editableChip(t, "culture", i, sel.id)).join("");
  const developNote = sel.ideologyDevelopCount
    ? `<span class="tags">developed×${sel.ideologyDevelopCount}</span>` : "";
  const fervorDetail = sel.independent
    ? `<div class="tags">Independent · liege ${esc(sel.liegeId || "—")}</div>`
    : `<div class="tags need">Fervor ${sel.fervor}</div>`;
  const clockDetailBits: string[] = [];
  if (sel.foodClock > 0) clockDetailBits.push(`Food clock ${sel.foodClock}/3`);
  if (sel.waterClock > 0) clockDetailBits.push(`Water clock ${sel.waterClock}/3`);
  if (sel.oxygenClock > 0) clockDetailBits.push(`Oxygen clock ${sel.oxygenClock}/3`);
  if (sel.populationStress > 0) clockDetailBits.push(`Pop stress ${sel.populationStress}`);
  if (sel.hasMilitaryToken) clockDetailBits.push("Invasion token ready");
  if (sel.bodyLivable) clockDetailBits.push("Body livable (TF≥10)");
  const clockDetail = clockDetailBits.length
    ? `<div class="tags need">${clockDetailBits.map(esc).join(" · ")}</div>` : "";
  el.innerHTML = `
    <div class="tags"><button type="button" data-open-needs>🌳 Needs tree &amp; suppliers</button></div>
    <div class="detail-head">
      <div class="name">
        <span class="editable-name" contenteditable="true" spellcheck="false"
          data-edit="colony" data-colony="${esc(sel.id)}" title="Edit colony name">${esc(sel.name)}</span>
        <span class="rp">Level ${sel.level}</span>
      </div>
      <div class="tags" style="border-left:3px solid ${esc(sel.nationColor || "#64748b")};padding-left:8px">RP ${sel.rp} · Nation RP ${sel.nationRp} · strain ${sel.strain} · ${esc(sel.patron)}</div>
      <div class="tags need">Requires ${sel.requires}</div>
      ${fervorDetail}
      ${clockDetail}
      <div class="tags edit-hint">Click name / culture / ideology chips to rename</div>
    </div>
    <div class="summary-group ideology"><div class="summary-title">Ideology</div>
      <div class="summary-items">${ideoChips || '<span class="tags">—</span>'}${importedChips ? ` <span class="tags">imported:</span> ${importedChips}` : ""}${developNote}</div></div>
    <div class="summary-group culture"><div class="summary-title">Culture</div>
      <div class="summary-items">${cultChips || '<span class="tags">—</span>'}</div></div>
    ${group("Developed", sel.summary.developed, "developed")}
    ${group("Clean imports", sel.summary.cleanImports, "imports")}
    ${group("Free excess", sel.summary.freeExcess, "free")}
    ${group("Needs", needsItems, "needed")}
    <table><thead><tr><th>Node</th><th>Extra</th><th>Deps</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="3" class="tags">No extras.</td></tr>`}</tbody></table>`;
}

function commitEditable(el: HTMLElement): void {
  const s = requireSession();
  const kind = el.getAttribute("data-edit");
  const colonyId = el.getAttribute("data-colony");
  if (!kind || !colonyId) return;
  const raw = (el.textContent || "").replace(/\u00a0/g, " ").trim();
  const c = s.state.colonies.find((x) => x.id === colonyId);
  if (!c) return;
  let changed = false;
  if (kind === "colony") {
    const before = c.name;
    if (s.renameColony(colonyId, raw)) changed = c.name !== before || raw === "";
    else changed = true;
  } else if (kind === "culture") {
    const index = Number(el.getAttribute("data-index"));
    const before = c.culture[index];
    if (s.renameCulture(colonyId, index, raw)) changed = c.culture[index] !== before;
    else changed = true;
  } else if (kind === "ideology") {
    const index = Number(el.getAttribute("data-index"));
    const before = c.ideology[index];
    if (s.renameIdeology(colonyId, index, raw)) changed = c.ideology[index] !== before;
    else changed = true;
  } else if (kind === "ideologyImported") {
    const index = Number(el.getAttribute("data-index"));
    const before = c.ideologyImported[index];
    if (s.renameIdeologyImported(colonyId, index, raw)) changed = c.ideologyImported[index] !== before;
    else changed = true;
  }
  if (changed) render();
}

function moveCard(o: MoveOption): string {
  const badges = o.badges.map((b) => `<span class="chip">${esc(b)}</span>`).join("");
  const hi = o.fillsRequires ? " requires-hit" : "";
  const label = o.kind.startsWith("cancel") ? "Cancel"
    : o.kind === "switch" ? "Switch"
    : o.kind === "found-colony" ? "Found"
    : o.kind === "trojan" ? "Trojan"
    : o.kind === "invade" ? "Invade"
    : "Take";
  return `<div class="move-card${hi}" data-key="${esc(o.key)}">
    <div class="move-title">${esc(o.title)}</div>
    <div class="move-badges">${badges}</div>
    <div class="move-effect">${esc(o.effect)}</div>
    <button class="good move-take" data-key="${esc(o.key)}">${label}</button>
  </div>`;
}

function renderMoves(snap: UiSnapshot): void {
  const el = $("moves");
  const label = $("movesActing");
  if (label) label.textContent = snap.actingName ? `(${snap.actingName})` : "";
  if (!snap.actingId) { el.innerHTML = `<div class="tags">All acted — End turn.</div>`; return; }
  el.innerHTML = snap.moveOptions.map(moveCard).join("") +
    `<div class="move-card" data-action="pass"><div class="move-title">Pass</div><button data-action="pass">Pass</button></div>` +
    `<div class="move-card" data-action="auto"><div class="move-title">Auto</div><button class="primary" data-action="auto">Auto</button></div>`;
}

function renderLog(snap: UiSnapshot): void {
  $("log").innerHTML = snap.log.slice(0, 120)
    .map((e) => `<div class="log-line ${e.imp ? "imp" : ""}">T${e.turn}: ${esc(e.msg)}</div>`).join("");
}

// --- Rules tab ---
function renderRules(): void {
  const el = document.getElementById("rulesForm");
  if (!el) return;
  let group = "";
  el.innerHTML = RULE_DEFS.map((r) => {
    const head = r.group !== group ? `<h4>${esc((group = r.group))}</h4>` : "";
    const v = selectedRules[r.id];
    const input = r.kind === "bool"
      ? `<input type="checkbox" data-rule="${r.id}"${v ? " checked" : ""} />`
      : `<input type="number" data-rule="${r.id}" value="${v}" min="${r.min ?? ""}" max="${r.max ?? ""}" step="${r.step ?? 1}" style="width:5em" />`;
    return `${head}<label class="rule-row" title="${esc(r.help)}">${input} ${esc(r.label)} <span class="tags">(default ${r.def}, legacy ${r.legacy})</span></label><br/>`;
  }).join("");
}
document.getElementById("rulesForm")?.addEventListener("change", (e) => {
  const t = e.target as HTMLInputElement;
  const id = t.dataset.rule;
  if (!id) return;
  selectedRules[id] = t.type === "checkbox" ? t.checked : Number(t.value);
});
document.getElementById("rulesDefault")?.addEventListener("click", () => { selectedRules = defaultRules(); renderRules(); });
document.getElementById("rulesLegacy")?.addEventListener("click", () => { selectedRules = legacyRules(); renderRules(); });

// --- Version / Ruleset snapshots ---
interface VersionEntry { version: string; summary: string; available: boolean; date: string | null; path: string | null; reason?: string }
async function renderVersions(): Promise<void> {
  const el = document.getElementById("versionList");
  if (!el) return;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}versions/manifest.json`, { cache: "no-store" });
    const m = (await r.json()) as { live: string; versions: VersionEntry[] };
    el.innerHTML = m.versions.map((v) => {
      const live = v.version === m.live ? ' <span class="variant-default">live</span>' : "";
      const dis = v.available ? "" : " disabled";
      const sub = v.available ? `${esc(v.summary)}${v.date ? ` · ${v.date}` : ""}` : `unavailable — ${esc(v.summary)}`;
      return `<button type="button" class="variant-btn"${dis} data-snapshot="${esc(v.path ?? "")}" data-ver="${esc(v.version)}">
        <span class="variant-id">${esc(v.version)}${live}</span><span class="variant-label">${sub}</span></button>`;
    }).join("");
  } catch {
    el.textContent = "No snapshot manifest found (run node scripts/snapshot.mjs).";
  }
}
document.getElementById("versionList")?.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("[data-snapshot]") as HTMLButtonElement | null;
  if (!btn || btn.disabled || !btn.dataset.snapshot) return;
  ($("snapshotFrame") as HTMLIFrameElement).src = `${import.meta.env.BASE_URL}${btn.dataset.snapshot}`;
  $("snapshotLabel").textContent = `Snapshot ${btn.dataset.ver} (frozen rules)`;
  $("snapshotOverlay").hidden = false;
});
document.getElementById("snapshotBack")?.addEventListener("click", () => {
  ($("snapshotFrame") as HTMLIFrameElement).src = "about:blank";
  $("snapshotOverlay").hidden = true;
});

// --- Setup bindings ---
document.querySelector(".setup-tabs")?.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("[data-setup-tab]") as HTMLElement | null;
  if (!btn?.dataset.setupTab) return;
  setupTab = btn.dataset.setupTab as SetupTab;
  renderSetup();
});
$("fervorVariantButtons").addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("[data-variant]") as HTMLElement | null;
  if (!btn?.dataset.variant) return;
  selectedVariantId = btn.dataset.variant;
  renderSetup();
});
document.getElementById("solarVariantButtons")?.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("[data-solar-variant]") as HTMLElement | null;
  if (!btn?.dataset.solarVariant) return;
  selectedSolarVariantId = btn.dataset.solarVariant;
  renderSetup();
});
$("btnBeginSim").onclick = () => beginSimulation();

// --- Play bindings (guarded: only when session exists) ---
$("colonies").addEventListener("click", (e) => {
  if (!session) return;
  const t = (e.target as HTMLElement).closest(".colony") as HTMLElement | null;
  if (!t?.dataset.id) return;
  session.select(t.dataset.id);
  render();
  if (globes) { globes.Moon.focus(t.dataset.id) || globes.Mars.focus(t.dataset.id); }
});
$("solarMap").addEventListener("click", (e) => {
  const id = (e.target as Element).getAttribute?.("data-id");
  if (!session || !id) return;
  session.select(id);
  render();
});
$("moves").addEventListener("click", (e) => {
  if (!session) return;
  const btn = (e.target as HTMLElement).closest("[data-key],[data-action]") as HTMLElement | null;
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  if (action === "pass") { session.pass(); render(); return; }
  if (action === "auto") { session.autoActOnce(); render(); return; }
  const key = btn.getAttribute("data-key");
  if (key) { session.applyByKey(key); render(); }
});
$("btnAuto").onclick = () => { if (!session) return; session.autoActOnce(); render(); };
$("btnEnd").onclick = () => { if (!session) return; session.endTurn(); render(); };
$("btnFound").onclick = () => { if (!session) return; session.tryFound(); render(); };
$("btnSim").onclick = () => {
  if (!session) return;
  const n = Number(($("simN") as HTMLInputElement).value) || 10;
  session.simulateTurns(Math.max(1, Math.min(200, n)));
  render();
};
$("btnNew").onclick = () => returnToSetup();

const thrInput = document.getElementById("indepThreshold") as HTMLInputElement | null;
if (thrInput) {
  thrInput.addEventListener("change", () => {
    if (!session) return;
    session.setIndependenceThreshold(Number(thrInput.value));
    render();
  });
}

$("detail").addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest("[data-open-needs]")) { openWindow("needs"); openWindow("suppliers"); render(); }
});
$("detail").addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement;
  if (!t?.getAttribute?.("data-edit")) return;
  if (e.key === "Enter") {
    e.preventDefault();
    t.blur();
  } else if (e.key === "Escape") {
    e.preventDefault();
    render();
  }
});
$("detail").addEventListener("focusout", (e) => {
  const t = e.target as HTMLElement;
  if (!t?.getAttribute?.("data-edit")) return;
  if (!session) return;
  commitEditable(t);
});

initWindows(() => { if (uiPhase === "playing" && session) render(); });

// Boot into setup lobby (do not auto-start a game).
showPhase("setup");
renderSetup();

// --- 0.15.0 dev flag gallery (?flags or Rules tab → Flag gallery) ---
function openFlagGallery(): void {
  const el = document.getElementById("flagGallery");
  if (!el) return;
  $("flagGalleryBody").innerHTML = flagGalleryHtml();
  el.hidden = false;
}
document.getElementById("flagGalleryBtn")?.addEventListener("click", openFlagGallery);
document.getElementById("flagGalleryClose")?.addEventListener("click", () => {
  const el = document.getElementById("flagGallery");
  if (el) el.hidden = true;
});
if (new URLSearchParams(location.search).has("flags")) openFlagGallery();
