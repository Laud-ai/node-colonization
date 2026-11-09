import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runSim } from "../src/runSim.js";
import {
  createGame, isUncappedFounder, canBlocFound, foundingTax, earthSpontaneous, startRoute, cancelRoute,
  importLogistics, cleanup, startTurn, tryFound, listMoves, NODES, DEPS, NATION_ADJ,
  MAX_LABEL_LEN,
  earthClaimedCount, freeLineCount, occupiedLineCount, extras, strainOf, blocByName,
  rp, logisticsRpContribution, colonyLevel, develop, IDEOLOGIES, CULTURES, socialAffinity,
  startRouteWithLend, lendableLines, pickBestLender, autoAct, assistsColony, colonyTradeOk,
  tickFervor, cultureMisalignedWithPatron, ideologyMisalignedWithPatron, missingBasals,
  executeRevolution, tryIndependentFound, canIndependentFound, hasFriendlySource,
  trojanAcceptanceGate, nodeFixesHardIssue, sameBloc, makeColony, findSources,
  consentsExport, grantColonyImport, executeTrojanSend, computeFervorLedger, FERVOR_THRESHOLD,
  requestCounterTrade, consentCounterTrade, cancelTrojanSend,
  applyFervorParams, LEGACY_FERVOR_PARAMS, applySolarBlocParams, LEGACY_SOLAR_BLOC_PARAMS,
  onSubversionRouteStart, onSubversionDevelop,
  isVitalNeed, lineCanServeTrade, evaluateAllianceShifts, pushLog,
  renameColony, renameCulture, renameIdeology, renameIdeologyImported, nextColonyName,
  NAME_TEMPLATES, CULTURE_BANKS, SPECIALTY_TERMS, SUFFIXES, resolveCultureFamily,
  assembleColonyName,
  FOUNDING_COOLDOWN_TURNS, MOON_SOFT_CAP, foundingCooldownReady, foundingBody,
  foundingBodyFor, canFoundMars, hasStrongLunarBasis, MARS_MOON_MIN_COLONIES, MARS_MOON_RP_SUM,
  nationColorForColony, nationColorForEarth, nationRpEarth, leadingNation, sameNation,
  tryRelationFoundSolarBloc, cultureIdeologyAffinity,
  hasEarthReach, hasNationFeedSurplus, tryFreeLineForIndependentFound, needScore,
  cancelEarthCycleRoutes, tryEarthCycle, rankTradeSource, pickBestTradeSource,
  setIndependenceThreshold, independenceThresholdOf, tickSurvivalClocks, hasHealth,
  hasInvasionToken, canInvade, invade,
} from "../src/engine.js";
import { GameSession } from "../src/session.js";
import { mulberry32 } from "../src/rng.js";

/** Evocative modular names (0.7.3): non-empty, not the old dry Culture+Flavor+Body pattern. */
const OLD_DRY_NAME_RE = /^(Corporate American|Corporate Chinese|American|Chinese|European|Russian|Latin|African|Caliphate|South Asian|East Asian|Indochinese|British|UN|Commonwealth|International|Independent|Mixed) [A-Za-z]+ (Lunar|Martian)( \([^)]+\))?( \d+)?$/;
const SUFFIX_RE = /\b(Colony|Outpost|Settlement|Station|Base|Hab|Works)\b/;
const PREFIX_RE = /\b(Fort|Baza|Port|New|Omni-|Helix-|Apex-|Nova-|Nexus-|Platform-|Lattice-|Jade-)\b/;

function assertEvocativeName(name: string): void {
  assert.ok(name && name.trim().length > 0, "name empty");
  assert.ok(name.length >= 3, `name too short: ${name}`);
  assert.ok(!OLD_DRY_NAME_RE.test(name), `still old dry pattern: ${name}`);
  assert.ok(!/^(Lunar|Mars) /.test(name), `old-style body-first: ${name}`);
}

describe("determinism", () => {
  it("same seed identical log", () => {
    const a = runSim(42, 40), b = runSim(42, 40);
    assert.equal(a.logText, b.logText);
    assert.equal(a.leaderboard, b.leaderboard);
  });
  it("different seeds diverge", () => {
    assert.notEqual(runSim(1, 40).logText, runSim(7, 40).logText);
  });
  it("start state shape + random mode", () => {
    const G = createGame(42, mulberry32(42));
    assert.equal(G.gameMode, "random");
    for (const b of G.blocs) {
      assert.equal(b.tech, 0);
      assert.equal(b.excess.length, 1);
      assert.ok(b.excess.every((s) => s.claimedBy === null));
      assert.ok(NODES.includes(b.excess[0]!.node));
      assert.equal(canBlocFound(b), isUncappedFounder(b.name));
    }
    assert.equal(G.colonies.length, 2);
    assert.equal(G.colonies[0]!.patron, "United States");
    assert.equal(G.colonies[1]!.patron, "China");
    for (const c of G.colonies) {
      assert.equal(c.body, "Moon");
      assert.equal(c.bodyMod, 0);
      assert.ok(NODES.includes(c.specialty));
      assert.ok(NODES.includes(c.requires));
      assert.notEqual(c.specialty, c.requires);
      if (c.specialty === "Logistics") {
        assert.equal(c.logisticsLines.length, 2);
        assert.equal(c.logisticsLines[0]!.kind, "base");
        assert.equal(c.logisticsLines[1]!.kind, "specialty");
        assert.equal(freeLineCount(c), 2);
      } else {
        assert.equal(c.logisticsLines.length, 1);
        assert.equal(c.logisticsLines[0]!.kind, "base");
        assert.equal(freeLineCount(c), 1);
      }
      assert.equal(occupiedLineCount(c), 0);
      assert.equal(colonyLevel(c), 1);
      assertEvocativeName(c.name);
    }
  });
  it("develop within 40 turns", () => {
    const r = runSim(42, 40);
    assert.ok(r.logText.includes("develops +1"));
  });
  it("new colony naming convention", () => {
    const r = runSim(42, 40);
    const names = r.state.colonies.map((c) => c.name);
    for (const n of names) assertEvocativeName(n);
    assert.equal(new Set(names).size, names.length, "names should be unique");
  });
  it("seed 42 starter names are evocative and unique", () => {
    const G = createGame(42, mulberry32(42));
    assert.equal(G.colonies.length, 2);
    assertEvocativeName(G.colonies[0]!.name);
    assertEvocativeName(G.colonies[1]!.name);
    assert.notEqual(G.colonies[0]!.name, G.colonies[1]!.name);
    // Deterministic for seed
    const G2 = createGame(42, mulberry32(42));
    assert.equal(G.colonies[0]!.name, G2.colonies[0]!.name);
    assert.equal(G.colonies[1]!.name, G2.colonies[1]!.name);
  });
});

describe("routes + Earth growth", () => {
  it("claim grows; cancel rerolls from full NODES; import route-tied", () => {
    const rng = mulberry32(99);
    const G = createGame(99, rng);
    assert.equal(G.gameMode, "random");
    const actor = G.colonies[0]!;
    const bloc = blocByName(G, "United States")!;
    bloc.excess[0] = { node: "Food", claimedBy: null };
    const line = actor.logisticsLines[0]!;
    const before = extras(actor, "Food");
    assert.ok(startRoute(G, actor, line.id, { kind: "earth", bloc, node: "Food", slotIndex: 0 }, rng));
    assert.equal(extras(actor, "Food"), before + 1);
    assert.ok(bloc.excess.length >= 2);
    assert.equal(earthClaimedCount(bloc), 1);
    actor.acted = false;
    assert.ok(cancelRoute(G, actor, line.id, rng));
    assert.equal(extras(actor, "Food"), before);
    assert.ok(bloc.excess.length >= 2);
    assert.equal(bloc.excess[0]!.claimedBy, null);
    // random mode: reroll from full NODES, not specialty pool
    assert.ok(NODES.includes(bloc.excess[0]!.node));
  });
  it("grow only when all active", () => {
    const rng = mulberry32(7);
    const G = createGame(7, rng);
    const a = G.colonies[0]!, b = G.colonies[1]!;
    // Neutral Earth — both colonies may claim (East/West gate does not apply)
    const bloc = G.blocs.find((x) => x.name === "African Union")!;
    bloc.excess = [{ node: "Military", claimedBy: null }, { node: "Science", claimedBy: null }];
    assert.ok(startRoute(G, a, a.logisticsLines[0]!.id, { kind: "earth", bloc, node: "Military", slotIndex: 0 }, rng));
    assert.equal(bloc.excess.length, 2);
    a.acted = false; b.acted = false;
    assert.ok(startRoute(G, b, b.logisticsLines[0]!.id, { kind: "earth", bloc, node: "Science", slotIndex: 1 }, rng));
    assert.ok(bloc.excess.length >= 3);
    assert.ok(NODES.includes(bloc.excess[bloc.excess.length - 1]!.node));
  });
  it("cleanup keeps routes", () => {
    const rng = mulberry32(11);
    const G = createGame(11, rng);
    const actor = G.colonies[0]!;
    const bloc = G.blocs.find((x) => x.name === "European Union")!;
    bloc.excess = [{ node: "Science", claimedBy: null }];
    startRoute(G, actor, actor.logisticsLines[0]!.id, { kind: "earth", bloc, node: "Science", slotIndex: 0 }, rng);
    for (let i = 0; i < 8; i++) cleanup(G, rng);
    assert.ok(actor.logisticsLines[0]!.route);
  });
});

describe("clean + logistics naming", () => {
  it("developed strains; clean import does not", () => {
    const rng = mulberry32(13);
    const G = createGame(13, rng);
    const actor = G.colonies[0]!;
    actor.developed.Military = 1;
    const mid = strainOf(actor);
    assert.ok(mid > 0);
    const bloc = G.blocs.find((x) => x.name === "African Union")!;
    // Water is not a Military dependency — clean import must not change strain.
    bloc.excess = [{ node: "Water", claimedBy: null }];
    const free = actor.logisticsLines.find((l) => l.route === null)!;
    startRoute(G, actor, free.id, { kind: "earth", bloc, node: "Water", slotIndex: 0 }, rng);
    assert.equal(strainOf(actor), mid);
    assert.ok(extras(actor, "Water") >= 1);
  });
  it("Logistics import adds named free line", () => {
    const rng = mulberry32(17);
    const G = createGame(17, rng);
    const actor = G.colonies[0]!;
    const before = actor.logisticsLines.length;
    const freeBefore = freeLineCount(actor);
    // Neutral Earth — East/West gate does not apply
    const bloc = G.blocs.find((x) => x.name === "African Union")!;
    bloc.excess = [{ node: "Logistics", claimedBy: null }];
    assert.ok(importLogistics(G, actor, { kind: "earth", bloc, node: "Logistics", slotIndex: 0 }, rng));
    assert.equal(actor.logisticsLines.length, before + 1);
    const imp = actor.logisticsLines.find((l) => l.kind === "import");
    assert.ok(imp);
    assert.match(imp!.name, /Imported .+ logistics/i);
    assert.equal(imp!.route, null);
    assert.equal(imp!.reach, "earth");
    assert.equal(freeLineCount(actor), freeBefore + 1);
  });
});

describe("founding + moves", () => {
  it("announcement queue + new name style", () => {
    const rng = mulberry32(3);
    const G = createGame(3, rng);
    assert.ok(tryFound(G, rng));
    assert.equal(G.pendingFoundings.length, 1);
    assertEvocativeName(G.pendingFoundings[0]!.colonyName);
    G.turn += 1;
    startTurn(G, rng);
    assert.equal(G.pendingFoundings.length, 0);
    assert.equal(G.turnAnnouncements.length, 1);
  });
  it("listMoves nonempty", () => {
    const G = createGame(21, mulberry32(21));
    const moves = listMoves(G, G.colonies[0]!);
    assert.ok(moves.some((m) => m.kind === "start" || m.kind === "import-logistics"));
  });
  it("name collision appends serial", () => {
    const G = createGame(5, mulberry32(5));
    const a = G.colonies[0]!;
    // Deterministic path (no rng) uses fixed bank picks — collide by priming nameSerial
    const n1 = nextColonyName(G, { culture: a.culture[0]!, specialty: a.specialty, body: "Moon", patron: a.patron });
    const n2 = nextColonyName(G, { culture: a.culture[0]!, specialty: a.specialty, body: "Moon", patron: a.patron });
    assert.notEqual(n1, n2);
    assert.ok(n2.startsWith(n1.split(/ (II|2|Beta|3)$/)[0]!.trim()) || n2.includes(n1) || / (II|2|Beta|\d+)$/.test(n2), `${n1} vs ${n2}`);
    assertEvocativeName(n1);
    // Collision marker present on second
    assert.ok(/ (II|2|Beta|\d+)$/.test(n2), `expected collision tag: ${n2}`);
  });
});

describe("regional power", () => {
  it("starters with only specialty show RP 1 (seed 42)", () => {
    const G = createGame(42, mulberry32(42));
    assert.equal(G.colonies.length, 2);
    for (const c of G.colonies) {
      assert.equal(rp(c, G.bodyTF), 1, `${c.name} should start at RP 1`);
      assert.equal(logisticsRpContribution(c), 0);
      assert.equal(c.logisticsLines[0]!.kind, "base");
      assert.equal(c.logisticsLines[0]!.lentTo ?? null, null);
    }
  });
  it("non-logistics import on base line raises RP by clean import only", () => {
    const rng = mulberry32(99);
    const G = createGame(99, rng);
    const actor = G.colonies[0]!;
    const bloc = blocByName(G, "United States")!;
    bloc.excess[0] = { node: "Food", claimedBy: null };
    const before = rp(actor, G.bodyTF);
    assert.equal(before, 1);
    assert.ok(startRoute(G, actor, actor.logisticsLines[0]!.id, { kind: "earth", bloc, node: "Food", slotIndex: 0 }, rng));
    // specialty + clean Food import; base line still not counted
    assert.equal(rp(actor, G.bodyTF), 2);
    assert.equal(logisticsRpContribution(actor), 0);
    assert.equal(occupiedLineCount(actor), 1);
  });
  it("Logistics import adds +1 RP; occupied extra line still counts", () => {
    const rng = mulberry32(17);
    const G = createGame(17, rng);
    const actor = G.colonies[0]!;
    assert.equal(rp(actor, G.bodyTF), 1);
    const bloc = G.blocs.find((x) => x.name === "African Union")!;
    bloc.excess = [{ node: "Logistics", claimedBy: null }];
    assert.ok(importLogistics(G, actor, { kind: "earth", bloc, node: "Logistics", slotIndex: 0 }, rng));
    assert.equal(logisticsRpContribution(actor), 1);
    assert.equal(rp(actor, G.bodyTF), 2);
    // put a route on the new line — still +1 for the line, +1 for the clean import
    const imp = actor.logisticsLines.find((l) => l.kind === "import")!;
    actor.acted = false;
    const waterBloc = G.blocs.find((x) => x.name === "Latin Federation")!;
    waterBloc.excess = [{ node: "Water", claimedBy: null }];
    assert.ok(startRoute(G, actor, imp.id, { kind: "earth", bloc: waterBloc, node: "Water", slotIndex: 0 }, rng));
    assert.equal(logisticsRpContribution(actor), 1);
    assert.equal(rp(actor, G.bodyTF), 3); // specialty + Water import + extra logistics line
  });
  it("lent extra logistics line does not count toward RP", () => {
    const rng = mulberry32(17);
    const G = createGame(17, rng);
    const actor = G.colonies[0]!;
    const bloc = G.blocs.find((x) => x.name === "African Union")!;
    bloc.excess = [{ node: "Logistics", claimedBy: null }];
    assert.ok(importLogistics(G, actor, { kind: "earth", bloc, node: "Logistics", slotIndex: 0 }, rng));
    assert.equal(rp(actor, G.bodyTF), 2);
    const imp = actor.logisticsLines.find((l) => l.kind === "import")!;
    imp.lentTo = G.colonies[1]!.id;
    assert.equal(logisticsRpContribution(actor), 0);
    assert.equal(rp(actor, G.bodyTF), 1);
    imp.lentTo = null;
    assert.equal(rp(actor, G.bodyTF), 2);
  });
});

describe("colony level + Logistics specialty (0.5.3)", () => {
  it("Food specialty starter → 1 line, level 1, RP 1", () => {
    const G = createGame(1, mulberry32(1));
    const c = G.colonies[0]!;
    assert.equal(c.specialty, "Food");
    assert.equal(c.logisticsLines.length, 1);
    assert.equal(c.logisticsLines[0]!.kind, "base");
    assert.equal(colonyLevel(c), 1);
    assert.equal(logisticsRpContribution(c), 0);
    assert.equal(rp(c, G.bodyTF), 1);
  });
  it("Logistics specialty starter → 2 lines, level 1, RP 1", () => {
    const G = createGame(4, mulberry32(4));
    const c = G.colonies[0]!;
    assert.equal(c.specialty, "Logistics");
    assert.equal(c.logisticsLines.length, 2);
    assert.equal(c.logisticsLines[0]!.kind, "base");
    assert.equal(c.logisticsLines[1]!.kind, "specialty");
    assert.equal(c.logisticsLines[1]!.route, null);
    assert.equal(c.logisticsLines[1]!.lentTo ?? null, null);
    assert.equal(freeLineCount(c), 2);
    assert.equal(colonyLevel(c), 1);
    assert.equal(logisticsRpContribution(c), 1); // specialty line once; no generic specialty +1
    assert.equal(rp(c, G.bodyTF), 1);
  });
  it("after one develop → level 2", () => {
    const rng = mulberry32(42);
    const G = createGame(42, rng);
    const c = G.colonies[0]!;
    assert.equal(colonyLevel(c), 1);
    develop(G, c, rng);
    assert.equal(colonyLevel(c), 2);
  });
});


describe("founding tax (0.6.0)", () => {
  it("US/China tax = colonyCount; others = 2+colonyCount", () => {
    const G = createGame(42, mulberry32(42));
    const us = blocByName(G, "United States")!;
    const cn = blocByName(G, "China")!;
    const eu = blocByName(G, "European Union")!;
    assert.equal(us.colonies, 1);
    assert.equal(cn.colonies, 1);
    assert.equal(eu.colonies, 0);
    assert.equal(foundingTax(us), 1); // uncapped: colonyCount
    assert.equal(foundingTax(cn), 1);
    assert.equal(foundingTax(eu), 2); // capped: 2+0
    eu.colonies = 2;
    assert.equal(foundingTax(eu), 4);
  });
  it("successful found deducts tax and increments colonies", () => {
    const rng = mulberry32(3);
    const G = createGame(3, rng);
    const us = blocByName(G, "United States")!;
    const cn = blocByName(G, "China")!;
    us.tech = 50;
    cn.tech = 0;
    assert.equal(foundingTax(us), 1);
    assert.ok(tryFound(G, rng));
    assert.equal(G.pendingFoundings[0]!.patron, "United States");
    assert.equal(us.colonies, 2);
    assert.equal(us.tech, 49); // 50 - 1
    assert.ok(G.log.some((e) => e.msg.includes("Founding tax 1")));
  });
  it("founding tax examples: US first extra costs 1; EU first costs 2", () => {
    const rng = mulberry32(8);
    const G = createGame(8, rng);
    const us = blocByName(G, "United States")!;
    const eu = blocByName(G, "European Union")!;
    // Force US to win by tech sort among uncapped — both US/China eligible; higher tech wins
    us.tech = 10;
    blocByName(G, "China")!.tech = 0;
    // 0.8.1: existing city must have feed surplus for another found
    G.colonies.find((c) => c.patron === "United States")!.developed.Food =
      (G.colonies.find((c) => c.patron === "United States")!.developed.Food || 0) + 1;
    const taxUs = foundingTax(us);
    assert.equal(taxUs, 1);
    assert.ok(tryFound(G, rng));
    assert.equal(G.pendingFoundings[0]!.patron, "United States");
    assert.equal(us.colonies, 2);
    assert.equal(us.tech, 9); // 10 - 1
    // EU: give enough tech and colonies=0
    eu.tech = 20;
    // Make US/China not win next: raise their colonies so... they are still always eligible.
    // Disable by making EU highest tech among ready — US/China always ready; sort by tech.
    us.tech = 0;
    blocByName(G, "China")!.tech = 0;
    eu.tech = 100;
    const taxEu = foundingTax(eu);
    assert.equal(taxEu, 2);
    // 0.8.2: founding once per turn — advance to next turn for second found
    G.turn += 1;
    assert.ok(tryFound(G, rng));
    assert.equal(G.pendingFoundings[G.pendingFoundings.length - 1]!.patron, "European Union");
    assert.equal(eu.colonies, 1);
    assert.equal(eu.tech, 98); // 100 - 2
  });
});

describe("strain stacking (0.6.0)", () => {
  it("2 Production need 2 Resources cover; 1 missing → strain 1", () => {
    const rng = mulberry32(13);
    const G = createGame(13, rng);
    const actor = G.colonies[0]!;
    actor.specialty = "Food"; // not Resources/Production
    actor.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof actor.developed;
    actor.developed.Production = 2;
    // No Resources cover → need 2 → strain at least 2 for Resources alone (plus other Production deps)
    const s = strainOf(actor);
    assert.ok(s >= 2, `expected strain>=2 got ${s}`);
    // Give 1 Resources via specialty
    actor.specialty = "Resources";
    // Production deps: Resources, Infrastructure, Energy, Population — need 2 each
    // specialty Resources covers 1 → still missing 1 Resources + 2 each of other 3 deps
    const s2 = strainOf(actor);
    assert.equal(extras(actor, "Resources"), 1);
    // missing Resources instances: 1; Infra 2; Energy 2; Pop 2 = 7
    assert.equal(s2, 7);
  });
  it("one Resources covers different types (Infra + Production×1)", () => {
    const rng = mulberry32(13);
    const G = createGame(13, rng);
    const actor = G.colonies[0]!;
    actor.specialty = "Resources";
    actor.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof actor.developed;
    actor.developed.Infrastructure = 1;
    actor.developed.Production = 1;
    // Resources needed max(1,1)=1 — covered by specialty
    // Infra needs Resources only — covered
    // Production needs Resources, Infra, Energy, Pop — Resources covered; Infra developed×1 covers Infra dep; Energy+Pop missing = 2
    assert.equal(strainOf(actor), 2);
  });
  it("clean import does not create developed strain", () => {
    const rng = mulberry32(13);
    const G = createGame(13, rng);
    const actor = G.colonies[0]!;
    actor.developed.Military = 1;
    const mid = strainOf(actor);
    assert.ok(mid > 0);
    const bloc = G.blocs.find((x) => x.name === "African Union")!;
    bloc.excess = [{ node: "Water", claimedBy: null }];
    const free = actor.logisticsLines.find((l) => l.route === null)!;
    startRoute(G, actor, free.id, { kind: "earth", bloc, node: "Water", slotIndex: 0 }, rng);
    assert.equal(strainOf(actor), mid);
  });
});

describe("ideology + culture (0.6.0)", () => {
  it("Population import permanently appends culture; cancel does not reverse", () => {
    const rng = mulberry32(21);
    const G = createGame(21, rng);
    const actor = G.colonies[0]!;
    const before = actor.culture.slice();
    // Neutral Earth — culture tag still appends from source bloc
    const bloc = blocByName(G, "Latin Federation")!;
    bloc.excess = [{ node: "Population", claimedBy: null }];
    const line = actor.logisticsLines[0]!;
    assert.ok(startRoute(G, actor, line.id, { kind: "earth", bloc, node: "Population", slotIndex: 0 }, rng));
    assert.ok(actor.culture.includes("Latin"));
    assert.ok(actor.culture.length >= before.length);
    actor.acted = false;
    assert.ok(cancelRoute(G, actor, line.id, rng));
    assert.ok(actor.culture.includes("Latin"), "culture must survive cancel");
  });
  it("Ideology import permanently appends; cancel does not reverse", () => {
    const rng = mulberry32(22);
    const G = createGame(22, rng);
    const actor = G.colonies[0]!;
    const bloc = blocByName(G, "New Caliphate")!;
    bloc.excess = [{ node: "Ideology", claimedBy: null }];
    const line = actor.logisticsLines[0]!;
    const tag = IDEOLOGIES["New Caliphate"];
    assert.ok(startRoute(G, actor, line.id, { kind: "earth", bloc, node: "Ideology", slotIndex: 0 }, rng));
    assert.ok(actor.ideology.includes(tag));
    assert.ok(actor.ideologyImported.includes(tag));
    actor.acted = false;
    assert.ok(cancelRoute(G, actor, line.id, rng));
    assert.ok(actor.ideology.includes(tag), "ideology must survive cancel");
  });
  it("first Ideology develop appends; second overwrites index 0", () => {
    const rng = mulberry32(23);
    const G = createGame(23, rng);
    const actor = G.colonies[0]!;
    if (actor.specialty === "Ideology") actor.specialty = "Food";
    actor.ideology = ["Democratic Free Market"];
    actor.ideologyDevelopCount = 0;
    actor.ideologyImported = [];
    // Force develop Ideology by stubbing: call develop until we get Ideology, or set directly via multiple develops
    // Directly exercise by setting requires path — use develop in a loop with fresh rng copies is hard.
    // Instead set developed and call internal path: re-run develop many times tracking Ideology.
    let sawFirst = false;
    for (let i = 0; i < 200; i++) {
      const before = actor.ideologyDevelopCount;
      const snap = actor.ideology.slice();
      develop(G, actor, rng);
      if (actor.ideologyDevelopCount === before + 1) {
        if (!sawFirst) {
          assert.equal(actor.ideologyDevelopCount, 1);
          assert.ok(actor.ideology.length >= 2, `expected coexist, got ${actor.ideology}`);
          assert.equal(actor.ideology[0], "Democratic Free Market");
          sawFirst = true;
        } else {
          assert.ok(actor.ideologyDevelopCount >= 2);
          // overwrite index 0
          assert.notEqual(actor.ideology[0], "Democratic Free Market");
          break;
        }
      }
      // reset requires noise — develop already changes requires
      if (i === 199) assert.fail("did not develop Ideology twice in 200 tries");
    }
  });
  it("import then develop Ideology creates blend", () => {
    const rng = mulberry32(24);
    const G = createGame(24, rng);
    const actor = G.colonies[0]!;
    if (actor.specialty === "Ideology") actor.specialty = "Food";
    actor.ideology = ["Democratic Free Market"];
    actor.ideologyDevelopCount = 0;
    actor.ideologyImported = [];
    // Neutral Earth Ideology (East/West gate does not apply)
    const bloc = blocByName(G, "New Caliphate")!;
    bloc.excess = [{ node: "Ideology", claimedBy: null }];
    actor.logisticsLines[0]!.route = null;
    actor.acted = false;
    assert.ok(startRoute(G, actor, actor.logisticsLines[0]!.id, { kind: "earth", bloc, node: "Ideology", slotIndex: 0 }, rng));
    const imported = IDEOLOGIES["New Caliphate"];
    assert.ok(actor.ideologyImported.includes(imported));
    for (let i = 0; i < 200; i++) {
      const before = actor.ideologyDevelopCount;
      develop(G, actor, rng);
      if (actor.ideologyDevelopCount === before + 1) {
        assert.equal(actor.ideology.length, 1);
        assert.match(actor.ideology[0]!, /-/); // blend Imported-Developed
        assert.ok(actor.ideology[0]!.startsWith(imported));
        return;
      }
    }
    assert.fail("Ideology develop not rolled");
  });
});

describe("Oxygen + social assist + lend (0.6.1)", () => {
  it("Oxygen is in NODES and DEPS.Oxygen = [Infrastructure]", () => {
    assert.ok(NODES.includes("Oxygen"));
    assert.deepEqual(DEPS.Oxygen, ["Infrastructure"]);
    assert.ok(!((DEPS.Population || []) as string[]).includes("Oxygen"));
  });

  it("socialAffinity: bloc only = 1; ideology+culture = 2 > bloc", () => {
    const G = createGame(1, mulberry32(1));
    const a = G.colonies[0]!;
    const b = G.colonies[1]!;
    // Different patrons, cultures, ideologies → 0
    assert.equal(socialAffinity(G, a, b), 0);

    // Same patron (bloc) only
    const clone = { ...b, patron: a.patron, culture: ["X"], ideology: ["Y"], ideologyImported: [] as string[] };
    assert.equal(socialAffinity(G, a, clone as typeof a), 1);

    // Ideology + culture shared; Neutral patron → no alliance bloc point with West US
    const friend = {
      ...b,
      patron: "Latin Federation",
      culture: [a.culture[0]!, "Extra"],
      ideology: [a.ideology[0]!, "Other"],
      ideologyImported: [] as string[],
    };
    assert.equal(socialAffinity(G, a, friend as typeof a), 2);
    assert.ok(socialAffinity(G, a, friend as typeof a) > 1);
  });

  it("lend frees an import when borrower has 0 free lines", () => {
    const rng = mulberry32(42);
    const G = createGame(42, rng);
    const borrower = G.colonies[0]!;
    const lender = G.colonies[1]!;
    // 0.8.3: West↔East needs aff ≥ 2 (culture + ideology), not culture alone
    lender.culture = [borrower.culture[0]!, ...lender.culture];
    lender.ideology = [borrower.ideology[0]!, ...lender.ideology];
    lender.ideologyImported = [];
    assert.equal(socialAffinity(G, lender, borrower) >= 2, true);
    assert.equal(assistsColony(G, lender, borrower), true);

    // Occupy borrower base line
    const bloc = blocByName(G, "United States")!;
    bloc.excess[0] = { node: "Food", claimedBy: null };
    assert.ok(startRoute(G, borrower, borrower.logisticsLines[0]!.id,
      { kind: "earth", bloc, node: "Food", slotIndex: 0 }, rng));
    assert.equal(freeLineCount(borrower), 0);
    borrower.acted = false;

    // Lender has a free line
    assert.ok(lendableLines(lender).length >= 1);
    const pick = pickBestLender(G, borrower);
    assert.ok(pick);
    assert.equal(pick!.colony.id, lender.id);

    const waterBloc = blocByName(G, "African Union")!;
    waterBloc.excess = [{ node: "Water", claimedBy: null }];
    assert.ok(startRouteWithLend(
      G, borrower, lender.id, pick!.line.id,
      { kind: "earth", bloc: waterBloc, node: "Water", slotIndex: 0 }, rng
    ));
    const borrowed = borrower.logisticsLines.find((l) => l.kind === "borrowed");
    assert.ok(borrowed);
    assert.ok(borrowed!.route);
    assert.equal(borrowed!.route!.node, "Water");
    assert.equal(borrowed!.name.includes("via ["), true);
    assert.equal(pick!.line.lentTo, borrower.id);
    assert.equal(extras(borrower, "Water"), 1);
  });

  it("autoAct still deterministic for a fixed seed", () => {
    const a = createGame(42, mulberry32(42));
    const b = createGame(42, mulberry32(42));
    const ra = mulberry32(999);
    const rb = mulberry32(999);
    // Run a few auto acts on starters
    for (let i = 0; i < 3; i++) {
      for (const c of a.colonies) { c.acted = false; autoAct(a, c, ra); }
      for (const c of b.colonies) { c.acted = false; autoAct(b, c, rb); }
    }
    assert.equal(
      a.log.map((e) => e.msg).join("\n"),
      b.log.map((e) => e.msg).join("\n")
    );
  });
});

describe("L3 fervor + revolution + Independent + Trojan (0.7.0)", () => {
  it("fervor tick: misalignment + missing basals raise fervor; Independents skip", () => {
    const rng = mulberry32(100);
    const G = createGame(100, rng);
    const c = G.colonies[0]!;
    // Misaligned culture + ideology vs US patron
    c.culture = ["Chinese"];
    c.ideology = ["Chinese Socialism"];
    c.ideologyImported = [];
    c.subversionMark = false;
    c.fervor = 0;
    for (const l of c.logisticsLines) l.route = null;
    assert.equal(cultureMisalignedWithPatron(c), true);
    assert.equal(ideologyMisalignedWithPatron(c), true);
    assert.equal(missingBasals(c).length >= 1, true);

    tickFervor(G, c, rng);
    const revolted = c.patron === "Independent";
    if (revolted) {
      assert.equal(c.fervor, 0);
      assert.equal(c.liegeId, c.id);
    } else {
      // Ledger: +cult +ideo +each missing basal +low RP — should be high
      assert.equal(c.fervor >= 2, true, `expected fervor ledger >=2 got ${c.fervor}`);
    }

    // Independents skip fervor ticks (hold prior value)
    c.patron = "Independent";
    c.liegeId = c.id;
    c.fervor = 2;
    tickFervor(G, c, rng);
    assert.equal(c.fervor, 2);
  });

  it("fervor drivers accumulate without revolt when below threshold path uses decay-friendly subject", () => {
    const rng = mulberry32(105);
    const G = createGame(105, rng);
    const c = G.colonies[0]!;
    // Aligned subject importing from patron — −1 terms dominate
    c.culture = ["American"];
    c.ideology = ["Democratic Free Market"];
    c.ideologyImported = [];
    c.subversionMark = false;
    const bloc = blocByName(G, "United States")!;
    bloc.excess[0] = { node: "Food", claimedBy: null };
    c.specialty = "Resources";
    c.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof c.developed;
    for (const n of ["Infrastructure", "Energy", "Water", "Oxygen", "Food"] as const) {
      c.developed[n] = 1;
    }
    startRoute(G, c, c.logisticsLines[0]!.id, { kind: "earth", bloc, node: "Food", slotIndex: 0 }, rng);
    c.acted = false;
    tickFervor(G, c, rng);
    assert.equal(c.fervor <= 2, true, `aligned subject should stay low, got ${c.fervor}`);
    assert.notEqual(c.patron, "Independent");
  });

  it("revolution severs former patron links only", () => {
    const rng = mulberry32(101);
    const G = createGame(101, rng);
    const us = G.colonies[0]!;
    const cn = G.colonies[1]!;
    assert.equal(us.patron, "United States");
    // Give US an Earth import from its patron
    const bloc = blocByName(G, "United States")!;
    bloc.excess[0] = { node: "Food", claimedBy: null };
    assert.ok(startRoute(G, us, us.logisticsLines[0]!.id,
      { kind: "earth", bloc, node: "Food", slotIndex: 0 }, rng));
    assert.ok(us.logisticsLines[0]!.route);
    assert.equal(bloc.excess[0]!.claimedBy, us.id);

    // Force revolution
    us.acted = false;
    us.fervor = 5;
    us.culture = ["Chinese"];
    us.ideology = ["Situationism"];
    // Ensure independence score positive: clear dependence by severing? still has patron import
    // Clear route so not dependent, high exit safety
    us.acted = false;
    cancelRoute(G, us, us.logisticsLines[0]!.id, rng);
    us.acted = false;
    us.fervor = 5;
    // Local basal coverage: give specialty Resources + develop a few? Simpler: executeRevolution directly
    executeRevolution(G, us, rng);
    assert.equal(us.patron, "Independent");
    assert.equal(us.liegeId, us.id);
    assert.equal(us.fervor, 0);
    // Earth claim released
    assert.equal(bloc.excess[0]!.claimedBy, null);
    // China (different patron) unaffected
    assert.equal(cn.patron, "China");
    assert.ok(G.log.some((e) => e.msg.includes("REVOLUTION")));
  });

  it("Independent founding consumes free non-base logistics line", () => {
    const rng = mulberry32(102);
    const G = createGame(102, rng);
    const founder = G.colonies[0]!;
    founder.patron = "Independent";
    founder.liegeId = founder.id;
    founder.fervor = 0;
    // Add a free specialty logistics line to spend
    founder.logisticsLines.push({
      id: "L99", name: `${founder.name} specialty logistics`, kind: "specialty",
      route: null, lentTo: null,
    });
    assert.ok(canIndependentFound(founder));
    const beforeLines = founder.logisticsLines.length;
    const beforeColonies = G.colonies.length;
    assert.ok(tryIndependentFound(G, founder, rng));
    assert.equal(founder.logisticsLines.length, beforeLines - 1);
    assert.equal(G.colonies.length, beforeColonies + 1);
    const child = G.colonies[G.colonies.length - 1]!;
    assert.equal(child.patron, "Independent");
    assert.equal(child.liegeId, founder.id);
    assert.deepEqual(child.culture, founder.culture);
    assert.ok(G.pendingFoundings.some((f) => f.patron === "Independent"));
  });

  it("Trojan acceptance gate rejects when allies available", () => {
    const rng = mulberry32(103);
    const G = createGame(103, rng);
    const victim = G.colonies[0]!;
    const ally = G.colonies[1]!;
    // 0.8.3: West↔East friend needs aff ≥ 2
    ally.culture = [victim.culture[0]!, ...ally.culture.filter((t) => t !== victim.culture[0])];
    ally.ideology = [victim.ideology[0]!, ...ally.ideology.filter((t) => t !== victim.ideology[0])];
    ally.ideologyImported = [];
    assert.equal(socialAffinity(G, victim, ally) >= 2, true);

    // Ally has Food excess; victim requires Food and has no Food
    victim.requires = "Food";
    if (victim.specialty === "Food") victim.specialty = "Military";
    ally.specialty = "Food";
    // Earth also might have Food — clear Earth unclaimed Food by claiming all or setting no Food
    for (const b of G.blocs) {
      b.excess = b.excess.map((s) => s.node === "Food" ? { node: "Science", claimedBy: null } : s);
    }
    // Ally consents and has Food → friendly source exists
    assert.ok(hasFriendlySource(G, victim, "Food"));
    assert.equal(trojanAcceptanceGate(G, victim, "Food"), false);

    // Remove ally ability to supply: change specialty, no extras
    ally.specialty = "Military";
    ally.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof ally.developed;
    // No Earth Food
    assert.equal(hasFriendlySource(G, victim, "Food"), false);
    assert.equal(nodeFixesHardIssue(victim, "Food"), true);
    assert.equal(trojanAcceptanceGate(G, victim, "Food"), true);
  });

  it("socialAffinity Independent same liegeId counts as bloc", () => {
    const G = createGame(104, mulberry32(104));
    const a = G.colonies[0]!;
    const b = G.colonies[1]!;
    a.patron = "Independent";
    a.liegeId = a.id;
    a.culture = ["X"];
    a.ideology = ["Y"];
    a.ideologyImported = [];
    b.patron = "Independent";
    b.liegeId = a.id;
    b.culture = ["Z"];
    b.ideology = ["W"];
    b.ideologyImported = [];
    assert.equal(socialAffinity(G, a, b), 1); // bloc only
    assert.ok(sameBloc(a, b));
  });
});

describe("0.7.1 East/West vital+fair + logistics two-way + reach + alliance", () => {
  it("opposite-alliance Earth blocked without vital+fair", () => {
    const rng = mulberry32(201);
    const G = createGame(201, rng);
    const actor = G.colonies[0]!; // US / West
    // Non-vital node that actor already has via specialty or developed
    actor.requires = "Science";
    actor.specialty = "Food";
    actor.developed.Resources = 1;
    // Give Resources so Food basal isn't the issue — pick Ideology as non-vital opposite ask
    const cn = blocByName(G, "China")!;
    cn.excess = [{ node: "Ideology", claimedBy: null }];
    // Same-alliance / Neutral alternatives for Ideology none — but Ideology is not vital
    assert.equal(isVitalNeed(actor, "Ideology"), false);
    const sources = findSources(G, actor, "Ideology");
    assert.ok(!sources.some((s) => s.kind === "earth" && s.bloc.name === "China"));
    assert.equal(
      startRoute(G, actor, actor.logisticsLines[0]!.id,
        { kind: "earth", bloc: cn, node: "Ideology", slotIndex: 0 }, rng),
      false
    );
  });

  it("vital+fair allows opposite Earth when no alternative", () => {
    const rng = mulberry32(202);
    const G = createGame(202, rng);
    const actor = G.colonies[0]!; // US West Moon
    actor.requires = "Energy";
    if (actor.specialty === "Energy") actor.specialty = "Military";
    // Strip local Energy
    actor.developed.Energy = 0;
    // Remove all non-China Energy excess; China (East) has Energy
    for (const b of G.blocs) {
      if (b.name === "China") b.excess = [{ node: "Energy", claimedBy: null }];
      else b.excess = b.excess.map((s) => s.node === "Energy" ? { ...s, node: "Science" } : s);
    }
    // No colony Energy friends
    for (const c of G.colonies) {
      if (c.id === actor.id) continue;
      if (c.specialty === "Energy") c.specialty = "Military";
      c.developed.Energy = 0;
    }
    assert.ok(isVitalNeed(actor, "Energy"));
    const sources = findSources(G, actor, "Energy");
    assert.ok(sources.some((s) => s.kind === "earth" && s.bloc.name === "China"));
    assert.ok(startRoute(G, actor, actor.logisticsLines[0]!.id,
      { kind: "earth", bloc: blocByName(G, "China")!, node: "Energy", slotIndex: 0 }, rng));
  });

  it("two-way: one line holds import and export simultaneously", () => {
    const rng = mulberry32(203);
    const G = createGame(203, rng);
    const a = G.colonies[0]!;
    const b = G.colonies[1]!;
    // 0.8.3: West↔East needs aff ≥ 2
    b.culture = [a.culture[0]!, ...b.culture];
    b.ideology = [a.ideology[0]!, ...b.ideology];
    b.ideologyImported = [];
    a.specialty = "Food";
    b.specialty = "Water";
    assert.equal(extras(a, "Food") >= 1, true);
    assert.equal(extras(b, "Water") >= 1, true);
    assert.equal(colonyTradeOk(G, b, a), true);
    const aLine = a.logisticsLines[0]!;
    const bLine = b.logisticsLines[0]!;
    assert.equal(startRoute(G, a, aLine.id, { kind: "colony", colony: b, node: "Water" }, rng), true);
    assert.ok(aLine.route);
    assert.ok(bLine.exportRoute);
    assert.equal(bLine.exportRoute!.colonyId, a.id);
    // b can still import on same line (export occupied, import free) — bilateral partner
    a.acted = false; b.acted = false;
    assert.equal(bLine.route === null, true);
    assert.equal(startRoute(G, b, bLine.id, { kind: "colony", colony: a, node: "Food" }, rng), true);
    assert.equal(bLine.route?.node, "Food");
    assert.ok(bLine.exportRoute);
    assert.ok(aLine.exportRoute);
    assert.equal(aLine.route?.node, "Water");
  });

  it("Mars line rejects Earth import; Earth line rejects Moon–Mars", () => {
    const rng = mulberry32(204);
    const G = createGame(204, rng);
    const moon = G.colonies[0]!;
    // Create a Mars colony under US
    const mars = makeColony(G, {
      patron: "United States", body: "Mars", specialty: "Military", requires: "Food",
      culture: ["American"], ideology: ["Democratic Free Market"],
    });
    G.colonies.push(mars);
    const us = blocByName(G, "United States")!;
    us.excess = [{ node: "Food", claimedBy: null }];
    const marsLine = mars.logisticsLines[0]!;
    assert.equal(marsLine.reach, "mars");
    assert.equal(lineCanServeTrade(marsLine, mars, { kind: "earth", bloc: us, node: "Food", slotIndex: 0 }), false);
    assert.equal(
      startRoute(G, mars, marsLine.id, { kind: "earth", bloc: us, node: "Food", slotIndex: 0 }, rng),
      false
    );
    // Import Earth logistics → earth reach on Mars → Earth import OK
    us.excess = [{ node: "Logistics", claimedBy: null }, { node: "Food", claimedBy: null }];
    mars.acted = false;
    assert.ok(importLogistics(G, mars, { kind: "earth", bloc: us, node: "Logistics", slotIndex: 0 }, rng));
    const earthLine = mars.logisticsLines.find((l) => l.kind === "import")!;
    assert.equal(earthLine.reach, "earth");
    mars.acted = false;
    assert.ok(lineCanServeTrade(earthLine, mars, { kind: "earth", bloc: us, node: "Food", slotIndex: 1 }));
    // Earth-sourced line cannot serve Moon–Mars colony trade
    assert.equal(
      lineCanServeTrade(earthLine, mars, { kind: "colony", colony: moon, node: "Food" }),
      false
    );
  });

  it("alliance can shift under forced social conditions", () => {
    const rng = mulberry32(205);
    const G = createGame(205, rng);
    applySolarBlocParams(G, LEGACY_SOLAR_BLOC_PARAMS);
    const us = blocByName(G, "United States")!;
    assert.equal(us.alliance, "West");
    const subj = G.colonies[0]!;
    // Push subject ideology/culture toward East + high fervor
    subj.ideology = ["Chinese Socialism"];
    subj.ideologyImported = ["Chinese Socialism"];
    subj.culture = ["Chinese"];
    subj.fervor = 3;
    evaluateAllianceShifts(G, CULTURES, IDEOLOGIES, pushLog, true);
    assert.equal(us.alliance, "Neutral");
  });

  it("session snapshot includes independentGroups", () => {
    const session = GameSession.create(206);
    const G = session.state;
    const founder = G.colonies[0]!;
    founder.patron = "Independent";
    founder.liegeId = founder.id;
    founder.fervor = 0;
    const child = makeColony(G, {
      patron: "Independent", body: "Moon", specialty: "Science", requires: "Food",
      culture: founder.culture.slice(), ideology: founder.ideology.slice(),
      liegeId: founder.id,
    });
    G.colonies.push(child);
    const snap = session.snapshot();
    assert.ok(Array.isArray(snap.independentGroups));
    assert.ok(snap.independentGroups.length >= 1);
    const g = snap.independentGroups.find((x) => x.liegeId === founder.id);
    assert.ok(g);
    assert.equal(g!.colonyCount, 2);
    assert.ok(g!.members.length === 2);
  });
});


describe("0.7.2/0.7.3 corp cultures + evocative naming + rename", () => {
  it("SpaceX / Corporate China culture and ideology labels", () => {
    assert.equal(CULTURES.SpaceX, "Corporate American");
    assert.equal(CULTURES["Corporate China"], "Corporate Chinese");
    assert.equal(IDEOLOGIES.SpaceX, "Corporate Pioneerism");
    assert.equal(IDEOLOGIES["Corporate China"], "Platform Socialism");
    assert.equal(NATION_ADJ.SpaceX, "Corporate American");
    assert.equal(NATION_ADJ["Corporate China"], "Corporate Chinese");
    assert.notEqual(NATION_ADJ.SpaceX, "SpaceX");
  });

  it("SpaceX founding gets Corporate American culture and evocative name", () => {
    const rng = mulberry32(11);
    const G = createGame(11, rng);
    const sx = blocByName(G, "SpaceX")!;
    sx.tech = 99;
    assert.ok(tryFound(G, rng));
    const col = G.colonies.find((c) => c.patron === "SpaceX");
    assert.ok(col);
    assert.deepEqual(col!.culture, ["Corporate American"]);
    assert.deepEqual(col!.ideology, ["Corporate Pioneerism"]);
    assertEvocativeName(col!.name);
    assert.ok(!col!.name.startsWith("SpaceX"));
    assert.ok(!col!.name.startsWith("Corporate American Transit"));
  });

  it("Corporate China founding gets Corporate Chinese + Platform Socialism", () => {
    const rng = mulberry32(13);
    const G = createGame(13, rng);
    const cc = blocByName(G, "Corporate China")!;
    cc.tech = 99;
    assert.ok(tryFound(G, rng));
    const col = G.colonies.find((c) => c.patron === "Corporate China");
    assert.ok(col);
    assert.deepEqual(col!.culture, ["Corporate Chinese"]);
    assert.deepEqual(col!.ideology, ["Platform Socialism"]);
    assertEvocativeName(col!.name);
    assert.ok(!col!.name.startsWith("Corporate Chinese "));
  });

  it("evocative names: diversity across 30 seeded foundations", () => {
    const names: string[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const rng = mulberry32(seed);
      const G = createGame(seed, rng);
      for (const c of G.colonies) names.push(c.name);
      // Force a few foundings
      for (const b of G.blocs) b.tech = 99;
      for (let i = 0; i < 2; i++) tryFound(G, rng);
      for (const c of G.colonies) names.push(c.name);
    }
    const unique = new Set(names);
    assert.ok(unique.size >= 40, `expected pattern diversity, got ${unique.size} unique of ${names.length}`);
    for (const n of names) assertEvocativeName(n);
    // Soft: some suffixes / prefixes appear over many rolls
    const withSuffix = names.filter((n) => SUFFIX_RE.test(n));
    const withPrefix = names.filter((n) => PREFIX_RE.test(n));
    assert.ok(withSuffix.length >= 10, `expected some Colony/Outpost/… suffixes, got ${withSuffix.length}`);
    assert.ok(withPrefix.length >= 3, `expected some Fort/Baza/corp prefixes, got ${withPrefix.length}`);
  });

  it("culture family banks resolve correctly", () => {
    assert.equal(resolveCultureFamily("American"), "American");
    assert.equal(resolveCultureFamily("Corporate American"), "Corporate American");
    assert.equal(resolveCultureFamily("Chinese"), "Chinese");
    assert.equal(resolveCultureFamily("Corporate Chinese"), "Corporate Chinese");
    assert.equal(resolveCultureFamily("Russian"), "Russian");
    assert.equal(resolveCultureFamily("Mixed", "SpaceX"), "Corporate American");
    assert.ok(CULTURE_BANKS.American.roots.includes("Armstrong"));
    assert.ok(CULTURE_BANKS.Chinese.roots.includes("Nüwa"));
    assert.ok(CULTURE_BANKS.Russian.roots.includes("Korolyova"));
    assert.ok(NAME_TEMPLATES.length >= 5);
    assert.ok(SPECIALTY_TERMS.Science.includes("Research"));
    assert.ok(SUFFIXES.includes("Colony"));
  });

  it("renameColony / renameCulture / renameIdeology persist", () => {
    const session = GameSession.create(42);
    const id = session.state.colonies[0]!.id;
    assert.ok(session.renameColony(id, "Fort Example"));
    assert.equal(session.state.colonies[0]!.name, "Fort Example");
    assert.ok(session.renameCulture(id, 0, "Neo-American"));
    assert.equal(session.state.colonies[0]!.culture[0], "Neo-American");
    assert.ok(session.renameIdeology(id, 0, "Orbital Liberalism"));
    assert.equal(session.state.colonies[0]!.ideology[0], "Orbital Liberalism");
    const a = session.state.colonies[0]!;
    const b = session.state.colonies[1]!;
    b.culture = ["Neo-American"];
    assert.ok(socialAffinity(session.state, a, b) >= 1);
    assert.equal(session.renameColony(id, "   "), false);
    assert.equal(session.state.colonies[0]!.name, "Fort Example");
    const long = "X".repeat(MAX_LABEL_LEN + 20);
    assert.ok(session.renameColony(id, long));
    assert.equal(session.state.colonies[0]!.name.length, MAX_LABEL_LEN);
    const id2 = session.state.colonies[1]!.id;
    assert.ok(session.renameColony(id2, session.state.colonies[0]!.name));
    assert.ok(session.state.colonies[1]!.name.endsWith(" 2"));
    const snap = session.snapshot();
    assert.equal(snap.colonies.find((c) => c.id === id)?.culture[0], "Neo-American");
  });

  it("renameIdeologyImported works", () => {
    const G = createGame(9, mulberry32(9));
    const c = G.colonies[0]!;
    c.ideologyImported = ["Political Islam"];
    assert.ok(renameIdeologyImported(G, c.id, 0, "Faith Network"));
    assert.equal(c.ideologyImported[0], "Faith Network");
  });

  it("nextColonyName collision serial is deterministic (no rng)", () => {
    const G = createGame(3, mulberry32(3));
    const n1 = nextColonyName(G, { culture: "American", specialty: "Military", body: "Moon" });
    const n2 = nextColonyName(G, { culture: "American", specialty: "Military", body: "Moon" });
    assert.equal(n1, "Fort Armstrong Colony");
    assert.ok(n2.startsWith("Fort Armstrong Colony"));
    assert.ok(/ (II|2|Beta|\d+)$/.test(n2), n2);
  });
});

describe("0.8.0 nation identity + founding throttle + drift + solar bloc", () => {
  it("nationColor stable for Earth; generated for Independent liege", () => {
    const G = createGame(42, mulberry32(42));
    const us = G.colonies[0]!;
    assert.equal(nationColorForColony(us), nationColorForEarth("United States"));
    assert.match(nationColorForEarth("United States"), /^#[0-9a-fA-F]{6}$/);
    us.patron = "Independent";
    us.liegeId = us.id;
    const c1 = nationColorForColony(us);
    const c2 = nationColorForColony(us);
    assert.equal(c1, c2);
    assert.match(c1, /^#[0-9a-fA-F]{6}$/);
  });

  it("nationRp in snapshot for Earth blocs and Independents", () => {
    const session = GameSession.create(42);
    const snap = session.snapshot();
    assert.ok(snap.blocs.every((b) => typeof b.nationRp === "number"));
    assert.ok(snap.blocs.every((b) => typeof b.nationColor === "string"));
    assert.ok(snap.colonies.every((c) => typeof c.nationRp === "number"));
    const us = snap.blocs.find((b) => b.name === "United States")!;
    assert.equal(us.nationRp, nationRpEarth(session.state, "United States"));
    assert.ok(snap.leadingNationLabel);
  });

  it("founding once per turn: consecutive turns OK, same turn blocked", () => {
    const rng = mulberry32(3);
    const G = createGame(3, rng);
    assert.equal(FOUNDING_COOLDOWN_TURNS, 0);
    blocByName(G, "United States")!.tech = 50;
    blocByName(G, "China")!.tech = 0;
    for (const c of G.colonies.filter((x) => x.patron === "United States")) {
      c.developed.Food = (c.developed.Food || 0) + 2;
    }
    assert.ok(tryFound(G, rng));
    assert.equal(G.lastFoundTurn, G.turn);
    assert.equal(foundingCooldownReady(G), false);
    assert.equal(tryFound(G, rng), false);
    G.turn += 1;
    assert.ok(foundingCooldownReady(G));
    for (const c of G.colonies.filter((x) => x.patron === "United States")) {
      c.developed.Food = (c.developed.Food || 0) + 2;
    }
    assert.ok(tryFound(G, rng));
  });

  it("Mars gate: blocked without lunar basis, Moon soft-cap raised", () => {
    const rng = mulberry32(9);
    const G = createGame(9, rng);
    assert.ok(MOON_SOFT_CAP >= 8);
    // US has 1 Moon starter — not strong basis
    assert.equal(hasStrongLunarBasis(G, "United States"), false);
    assert.equal(canFoundMars(G, "United States", socialAffinity), false);
    assert.equal(foundingBodyFor(G, "United States", socialAffinity), "Moon");
    // Add a second Moon city with RP so basis opens
    const m2 = makeColony(G, {
      patron: "United States", body: "Moon", specialty: "Food", requires: "Water",
      culture: ["American"], ideology: ["Democratic Free Market"],
    });
    m2.developed.Food = 3;
    G.colonies.push(m2);
    // Boost starter RP too
    const m1 = G.colonies.find((c) => c.patron === "United States" && c.body === "Moon" && c.id !== m2.id)!;
    m1.developed.Energy = 3;
    assert.ok(hasStrongLunarBasis(G, "United States"));
    assert.ok(canFoundMars(G, "United States", socialAffinity));
    // Soft-cap not yet hit → still prefer Moon even with gate open
    assert.equal(foundingBodyFor(G, "United States", socialAffinity), "Moon");
    // Past soft-cap with gate open → Mars
    while (G.colonies.filter((c) => c.body === "Moon").length < MOON_SOFT_CAP) {
      G.colonies.push(makeColony(G, {
        patron: "United States", body: "Moon", specialty: "Food", requires: "Water",
        culture: ["American"], ideology: ["Democratic Free Market"],
      }));
    }
    assert.equal(foundingBodyFor(G, "United States", socialAffinity), "Mars");
  });

  it("seed 42 × 40 turns runs and stays deterministic", () => {
    const a = runSim(42, 40);
    const b = runSim(42, 40);
    assert.equal(a.logText, b.logText);
    assert.ok(a.state.colonies.length >= 2);
  });

  it("reach blocks bad lend — Mars lender cannot serve Earth import", () => {
    const rng = mulberry32(77);
    const G = createGame(77, rng);
    const moon = G.colonies[0]!;
    // Mars lender with lendable line
    const mars = makeColony(G, {
      patron: moon.patron, body: "Mars", specialty: "Science", requires: "Food",
      culture: moon.culture.slice(), ideology: moon.ideology.slice(),
    });
    G.colonies.push(mars);
    // Fill moon lines so it must lend
    for (const l of moon.logisticsLines) {
      // leave free so we test startRouteWithLend reach gate directly
    }
    const us = blocByName(G, "United States")!;
    us.excess = [{ node: "Food", claimedBy: null }];
    const lenderLine = lendableLines(mars)[0]!;
    assert.ok(lenderLine);
    assert.equal(lenderLine.reach, "mars");
    // Force no free lines on moon
    for (const l of moon.logisticsLines) {
      l.route = { sourceKind: "earth", sourceId: "African Union", sourceName: "AU", node: "Water" };
    }
    moon.acted = false;
    moon.lendAttemptsThisTurn = 0;
    const ok = startRouteWithLend(
      G, moon, mars.id, lenderLine.id,
      { kind: "earth", bloc: us, node: "Food", slotIndex: 0 },
      rng
    );
    assert.equal(ok, false);
    assert.equal(moon.lendAttemptsThisTurn, 1);
    // Second attempt same turn blocked
    assert.equal(
      startRouteWithLend(G, moon, mars.id, lenderLine.id, { kind: "earth", bloc: us, node: "Food", slotIndex: 0 }, rng),
      false
    );
  });

  it("alliance drift: forced ideology develops can flip within ~5 turns", () => {
    const rng = mulberry32(205);
    const G = createGame(205, rng);
    applySolarBlocParams(G, LEGACY_SOLAR_BLOC_PARAMS); // unit: no mid-game soften gate
    const us = blocByName(G, "United States")!;
    assert.equal(us.alliance, "West");
    const subj = G.colonies[0]!;
    subj.ideology = ["Chinese Socialism"];
    subj.ideologyImported = ["Chinese Socialism"];
    subj.culture = ["Chinese"];
    subj.fervor = 3;
    let flipped = false;
    for (let i = 0; i < 5; i++) {
      evaluateAllianceShifts(G, CULTURES, IDEOLOGIES, pushLog, i === 0);
      if (us.alliance !== "West") { flipped = true; break; }
      G.turn += 1;
    }
    assert.ok(flipped, `alliance still ${us.alliance}`);
    assert.notEqual(us.alliance, "West");
  });

  it("solar bloc from close relations (affinity≥2 + shared route)", () => {
    const rng = mulberry32(301);
    const G = createGame(301, rng);
    applySolarBlocParams(G, LEGACY_SOLAR_BLOC_PARAMS); // unit test mechanics, not timing gates
    const a = G.colonies[0]!;
    const b = G.colonies[1]!;
    // 0.8.3: set aff≥2 BEFORE colony trade
    a.culture = ["American", "Chinese"];
    b.culture = ["American", "Chinese"];
    a.ideology = ["Pioneerism"];
    b.ideology = ["Pioneerism"];
    a.ideologyImported = [];
    b.ideologyImported = [];
    assert.equal(cultureIdeologyAffinity(a, b) >= 2, true);
    assert.equal(colonyTradeOk(G, a, b), true);
    // Colony↔colony route without triggering develop (import ≠ requires)
    a.developed.Food = (a.developed.Food || 0) + 2;
    b.requires = "Science";
    const free = b.logisticsLines.find((l) => l.route === null)!;
    assert.equal(startRoute(G, b, free.id, { kind: "colony", colony: a, node: "Food" }, rng), true);
    b.acted = false;
    a.acted = false;
    a.fervor = 2;
    b.fervor = 2;
    G.lastSolarBlocTurn = -999;
    G.lastFoundTurn = -999;
    assert.ok(tryRelationFoundSolarBloc(G, rng));
    assert.equal(a.patron, "Independent");
    assert.equal(b.patron, "Independent");
    assert.equal(a.liegeId, b.liegeId);
    assert.ok(G.log.some((e) => /SOLAR BLOC|Solar Bloc/i.test(e.msg)));
  });

  it("vital flag set on Requires import", () => {
    const rng = mulberry32(88);
    const G = createGame(88, rng);
    const actor = G.colonies[0]!;
    // Avoid develop: import a basal that is vital via missing basal, not Requires
    actor.requires = "Science";
    actor.specialty = "Military";
    // Clear Food extras so Food is a missing basal → vital
    actor.developed.Food = 0;
    // Ensure no Food import yet
    for (const l of actor.logisticsLines) l.route = null;
    const bloc = G.blocs.find((x) => x.name === "African Union")!;
    bloc.excess = [{ node: "Food", claimedBy: null }];
    const line = actor.logisticsLines[0]!;
    assert.ok(isVitalNeed(actor, "Food"));
    assert.ok(startRoute(G, actor, line.id, { kind: "earth", bloc, node: "Food", slotIndex: 0 }, rng));
    assert.ok(line.route);
    assert.equal(line.route!.vital, true);
  });
});

describe("0.8.1 feed gate + Mars Earth-logistics + Independent free-line", () => {
  it("tryFound skips nation with 2+ cities but no feed surplus", () => {
    const rng = mulberry32(401);
    const G = createGame(401, rng);
    const us = blocByName(G, "United States")!;
    us.tech = 50;
    blocByName(G, "China")!.tech = 0;
    // Strip feed from US/China, then give US a second city so gate applies (3rd needs feed)
    for (const c of G.colonies.filter((x) => x.patron === "United States" || x.patron === "China")) {
      for (const n of ["Food", "Water", "Oxygen", "Energy", "Population", "Infrastructure", "Resources", "Money"] as const) {
        c.developed[n] = 0;
        if (c.specialty === n) c.specialty = "Science";
      }
    }
    // Push both uncapped founders to 2 cities so feed gate applies to both
    for (const patron of ["United States", "China"] as const) {
      const city = G.colonies.find((c) => c.patron === patron)!;
      const extra = makeColony(G, {
        patron, body: "Moon", specialty: "Science", requires: "Food",
        culture: city.culture.slice(), ideology: city.ideology.slice(),
      });
      extra.specialty = "Science";
      for (const n of ["Food", "Water", "Oxygen", "Energy", "Population", "Infrastructure", "Resources", "Money"] as const) {
        extra.developed[n] = 0;
      }
      G.colonies.push(extra);
      blocByName(G, patron)!.colonies = 2;
    }
    assert.equal(hasNationFeedSurplus(G, "United States"), false);
    assert.equal(hasNationFeedSurplus(G, "China"), false);
    assert.equal(tryFound(G, rng), false);
    // Restore feed → found succeeds
    const usCity = G.colonies.find((c) => c.patron === "United States")!;
    usCity.developed.Food = 2;
    assert.ok(hasNationFeedSurplus(G, "United States"));
    assert.ok(tryFound(G, rng));
    assert.ok(G.log.some((e) => /feeds newborn|underfed/.test(e.msg)));
  });

  it("autoAct Mars without earth reach prefers Earth Logistics", () => {
    const rng = mulberry32(402);
    const G = createGame(402, rng);
    const mars = makeColony(G, {
      patron: "United States", body: "Mars", specialty: "Science", requires: "Food",
      culture: ["American"], ideology: ["Democratic Free Market"],
    });
    G.colonies.push(mars);
    assert.equal(hasEarthReach(mars), false);
    // Same-alliance / Neutral Earth Logistics (West US subject → SpaceX West)
    for (const b of G.blocs) {
      b.excess = b.name === "SpaceX"
        ? [{ node: "Logistics", claimedBy: null }]
        : [{ node: "Subversion", claimedBy: null }];
    }
    // Moon starters: mark acted so only mars acts via direct autoAct
    for (const c of G.colonies) c.acted = c.id !== mars.id;
    mars.acted = false;
    autoAct(G, mars, rng);
    assert.ok(hasEarthReach(mars) || G.log.some((e) => /imports Logistics|Logistics from/.test(e.msg) && e.msg.includes(mars.name)),
      `Mars should seek Earth Logistics; log tail: ${G.log.slice(-5).map((e) => e.msg).join(" | ")}`);
  });

  it("Independent can free non-vital line for founding", () => {
    const rng = mulberry32(403);
    const G = createGame(403, rng);
    const founder = G.colonies[0]!;
    founder.patron = "Independent";
    founder.liegeId = founder.id;
    founder.requires = "Science";
    founder.logisticsLines.push({
      id: "Lfree", name: `${founder.name} logistics works`, kind: "develop",
      route: { sourceKind: "earth", sourceId: "African Union", sourceName: "AU", node: "Culture" },
      exportRoute: null, lentTo: null, reach: "moon",
    });
    // Line occupied with non-vital Culture → not free yet
    assert.equal(canIndependentFound(founder), false);
    assert.ok(tryFreeLineForIndependentFound(G, founder, rng));
    assert.ok(canIndependentFound(founder));
  });

  it("seed 42 × 40 still deterministic", () => {
    const a = runSim(42, 40);
    const b = runSim(42, 40);
    assert.equal(a.logText, b.logText);
    assert.ok(a.state.colonies.length >= 2);
  });
});

describe("0.8.2 earthCycle + Earth prefer + Mars gate", () => {
  it("earthCycle cancel next turn rerolls Earth excess", () => {
    const rng = mulberry32(501);
    const G = createGame(501, rng);
    const actor = G.colonies[0]!;
    // Satisfy Needs so cycle is the interesting path
    actor.requires = "Science";
    for (const n of ["Resources", "Infrastructure", "Energy", "Food", "Water", "Oxygen"] as const) {
      actor.developed[n] = Math.max(actor.developed[n] || 0, 2);
    }
    const us = blocByName(G, "United States")!;
    us.excess = [
      { node: "Culture", claimedBy: null },
      { node: "Culture", claimedBy: null },
      { node: "Culture", claimedBy: null },
    ];
    const free = actor.logisticsLines.find((l) => l.route === null)!;
    assert.ok(free);
    // Manual cycle start
    assert.ok(tryEarthCycle(G, actor, rng));
    const cyc = actor.logisticsLines.find((l) => l.route?.earthCycle);
    assert.ok(cyc?.route);
    assert.equal(cyc!.route!.earthCycle, true);
    const slotIdx = cyc!.route!.slotIndex!;
    const claimedNode = us.excess[slotIdx]!.node;
    assert.equal(us.excess[slotIdx]!.claimedBy, actor.id);
    // Next turn cancel
    actor.acted = false;
    const n = cancelEarthCycleRoutes(G, actor, rng);
    assert.equal(n, 1);
    assert.equal(cyc!.route, null);
    assert.equal(us.excess[slotIdx]!.claimedBy, null);
    // Reroll may change node
    assert.ok(typeof us.excess[slotIdx]!.node === "string");
    void claimedNode;
  });

  it("Mars blocked without Moon basis; allowed with 2+ Moon siblings", () => {
    const rng = mulberry32(502);
    const G = createGame(502, rng);
    blocByName(G, "United States")!.tech = 80;
    blocByName(G, "China")!.tech = 0;
    // Only 1 Moon for US → force Moon even if soft-cap would say Mars globally
    while (G.colonies.filter((c) => c.body === "Moon").length < MOON_SOFT_CAP) {
      G.colonies.push(makeColony(G, {
        patron: "China", body: "Moon", specialty: "Food", requires: "Water",
        culture: ["Chinese"], ideology: ["Chinese Socialism"],
      }));
    }
    assert.equal(foundingBody(G), "Mars"); // global soft-cap
    assert.equal(foundingBodyFor(G, "United States", socialAffinity), "Moon"); // gate closed
    // Give US 2 Moon cities with RP
    const extra = makeColony(G, {
      patron: "United States", body: "Moon", specialty: "Military", requires: "Food",
      culture: ["American"], ideology: ["Democratic Free Market"],
    });
    extra.developed.Military = 2;
    G.colonies.push(extra);
    const usMoon = G.colonies.filter((c) => c.patron === "United States" && c.body === "Moon");
    for (const c of usMoon) c.developed.Food = (c.developed.Food || 0) + 2;
    assert.ok(usMoon.length >= 2);
    assert.ok(hasStrongLunarBasis(G, "United States"));
    assert.equal(foundingBodyFor(G, "United States", socialAffinity), "Mars");
  });

  it("Earth preferred in ranking when both Earth and colony sources exist", () => {
    const rng = mulberry32(503);
    const G = createGame(503, rng);
    const actor = G.colonies[0]!;
    const donor = G.colonies[1]!;
    donor.developed.Food = (donor.developed.Food || 0) + 3;
    const us = blocByName(G, actor.patron)!;
    us.excess = [{ node: "Food", claimedBy: null }, { node: "Water", claimedBy: null }, { node: "Energy", claimedBy: null }];
    const sources = [
      { kind: "earth" as const, bloc: us, node: "Food" as const, slotIndex: 0 },
      { kind: "colony" as const, colony: donor, node: "Food" as const },
    ];
    const best = pickBestTradeSource(G, actor, sources);
    assert.ok(best);
    assert.equal(best!.kind, "earth");
    assert.ok(rankTradeSource(G, actor, sources[0]!) < rankTradeSource(G, actor, sources[1]!));
  });
});

describe("0.8.3 affinity≥2 + fervor ledger + Trojan send + bilateral", () => {
  it("US colony cannot import from China at aff 1; can at aff 2", () => {
    const rng = mulberry32(8301);
    const G = createGame(8301, rng);
    const us = G.colonies[0]!;
    const cn = G.colonies[1]!;
    cn.specialty = "Food";
    us.requires = "Food";
    if (us.specialty === "Food") us.specialty = "Military";
    us.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof us.developed;
    // Affinity 1: share culture only
    cn.culture = [us.culture[0]!];
    cn.ideology = ["Chinese Socialism"];
    cn.ideologyImported = [];
    assert.equal(socialAffinity(G, us, cn), 1);
    assert.equal(colonyTradeOk(G, cn, us), false);
    assert.equal(consentsExport(G, cn, us, "Food"), false);
    assert.equal(findSources(G, us, "Food").some((s) => s.kind === "colony" && s.colony.id === cn.id), false);

    // Affinity 2: culture + ideology
    cn.ideology = [us.ideology[0]!];
    assert.equal(socialAffinity(G, us, cn) >= 2, true);
    assert.equal(colonyTradeOk(G, cn, us), true);
    assert.equal(consentsExport(G, cn, us, "Food"), true);
    assert.equal(findSources(G, us, "Food").some((s) => s.kind === "colony" && s.colony.id === cn.id), true);
  });

  it("Neutral-patron colony trades without aff≥2", () => {
    const rng = mulberry32(8302);
    const G = createGame(8302, rng);
    const us = G.colonies[0]!;
    const other = G.colonies[1]!;
    other.patron = "Latin Federation"; // Neutral
    other.specialty = "Water";
    other.culture = ["Latin"];
    other.ideology = ["Situationism"];
    other.ideologyImported = [];
    assert.equal(socialAffinity(G, us, other), 0);
    assert.equal(colonyTradeOk(G, other, us), true);
    assert.equal(consentsExport(G, other, us, "Water"), true);
  });

  it("fervor ledger matches fixture terms; independence at threshold", () => {
    const rng = mulberry32(8303);
    const G = createGame(8303, rng);
    applyFervorParams(G, LEGACY_FERVOR_PARAMS); // uncapped basals, thr=5, no minAge
    const c = G.colonies[0]!;
    c.culture = ["Chinese"];
    c.ideology = ["Chinese Socialism"];
    c.ideologyImported = [];
    c.subversionMark = true;
    c.specialty = "Military";
    c.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof c.developed;
    for (const l of c.logisticsLines) { l.route = null; l.exportRoute = null; }
    const score = computeFervorLedger(G, c);
    // +subversion +6 missing basals +cult +ideo +low RP (≥1) ≥ 9
    assert.equal(score >= 8, true, `ledger ${score}`);
    c.fervor = score;
    assert.equal(score >= 5, true);
    // Force revolt via tick
    tickFervor(G, c, rng);
    assert.equal(c.patron, "Independent");
  });

  it("Trojan send sets permanent mark without granting trade node", () => {
    const rng = mulberry32(8304);
    const G = createGame(8304, rng);
    const atk = G.colonies[0]!;
    const vic = G.colonies[1]!;
    atk.specialty = "Subversion";
    atk.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof atk.developed;
    // aff 0 enemies
    atk.culture = ["American"];
    atk.ideology = ["Democratic Free Market"];
    vic.culture = ["Chinese"];
    vic.ideology = ["Chinese Socialism"];
    vic.ideologyImported = [];
    vic.subversionMark = false;
    const beforeExtras = extras(vic, "Subversion");
    const line = atk.logisticsLines[0]!;
    assert.equal(executeTrojanSend(G, atk, vic, line.id), true);
    assert.equal(vic.subversionMark, true);
    assert.equal(!!line.trojanSend, true);
    assert.equal(extras(vic, "Subversion"), beforeExtras); // no trade node granted
    assert.equal(cancelTrojanSend(G, atk, line.id), true);
    assert.equal(line.trojanSend == null || line.trojanSend === null, true);
    assert.equal(vic.subversionMark, true); // mark remains
  });

  it("bilateral trade: A gets X, B can add Y with consent on same route", () => {
    const rng = mulberry32(8305);
    const G = createGame(8305, rng);
    const a = G.colonies[0]!;
    const b = G.colonies[1]!;
    // aff ≥ 2 so they can trade
    b.culture = [a.culture[0]!];
    b.ideology = [a.ideology[0]!];
    b.ideologyImported = [];
    b.specialty = "Food";
    a.specialty = "Water";
    a.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof a.developed;
    b.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof b.developed;
    assert.equal(colonyTradeOk(G, b, a), true);
    assert.equal(grantColonyImport(G, a, a.logisticsLines[0]!.id, b, "Food", rng), true);
    const route = a.logisticsLines[0]!.route;
    assert.ok(route);
    assert.equal(route!.node, "Food");
    assert.equal(extras(a, "Food"), 1);
    // B counter-requests Water; A consents
    assert.equal(requestCounterTrade(G, b, a.logisticsLines[0]!.id, "Water"), true);
    assert.equal(route!.counterNode, "Water");
    assert.equal(consentCounterTrade(G, a, a.logisticsLines[0]!.id, true), true);
    assert.equal(route!.counterConsent, true);
    assert.equal(extras(b, "Water"), 1); // inbound counter
  });
});

describe("0.9.0 L4 survival / invade / threshold", () => {
  it("editable independence threshold gates revolt", () => {
    const rng = mulberry32(9001);
    const G = createGame(9001, rng);
    applyFervorParams(G, { ...LEGACY_FERVOR_PARAMS, threshold: 5, minAgeTurns: 0 });
    const c = G.colonies[0]!;
    c.culture = ["Chinese"];
    c.ideology = ["Chinese Socialism"];
    c.ideologyImported = [];
    c.subversionMark = true;
    c.specialty = "Military";
    c.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof c.developed;
    for (const l of c.logisticsLines) { l.route = null; l.exportRoute = null; }
    const score = computeFervorLedger(G, c);
    assert.ok(score >= 5, `ledger ${score}`);
    setIndependenceThreshold(G, 99);
    c.fervor = score;
    assert.equal(tickFervor(G, c, rng), false);
    assert.notEqual(c.patron, "Independent");
    setIndependenceThreshold(G, 5);
    c.fervor = score;
    assert.equal(tickFervor(G, c, rng), true);
    assert.equal(c.patron, "Independent");
  });

  it("survival clocks trip refugees at 3", () => {
    const rng = mulberry32(9002);
    const G = createGame(9002, rng);
    const c = G.colonies[0]!;
    const host = G.colonies[1]!;
    // Strain via developed node missing deps
    c.specialty = "Science";
    c.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof c.developed;
    c.developed.Production = 1; // needs Resources/Infra/Energy/Pop — creates strain
    c.foodClock = 0;
    c.waterClock = 0;
    c.oxygenClock = 0;
    // Host can accept: same body, has Food specialty
    host.specialty = "Food";
    host.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof host.developed;
    // Ensure c lacks Food/Water
    assert.ok(extras(c, "Food") <= 0);
    assert.ok(strainOf(c) > 0);
    // Tick without Health on odd turns
    G.turn = 1;
    tickSurvivalClocks(G, c, rng);
    assert.equal(c.foodClock, 1);
    G.turn = 3;
    tickSurvivalClocks(G, c, rng);
    assert.equal(c.foodClock, 2);
    G.turn = 5;
    tickSurvivalClocks(G, c, rng);
    // At 3 → refugee reset
    assert.equal(c.foodClock, 0);
    assert.ok(G.log.some((e) => e.msg.includes("Refugees")));
  });

  it("Health (Stability) slows clocks to every other turn", () => {
    const rng = mulberry32(9003);
    const G = createGame(9003, rng);
    const c = G.colonies[0]!;
    c.specialty = "Stability"; // hasHealth
    c.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof c.developed;
    c.developed.Production = 1;
    c.foodClock = 0;
    assert.equal(hasHealth(c), true);
    assert.ok(strainOf(c) > 0);
    G.turn = 2; // even — skip
    tickSurvivalClocks(G, c, rng);
    assert.equal(c.foodClock, 0);
    G.turn = 3; // odd — tick
    tickSurvivalClocks(G, c, rng);
    assert.equal(c.foodClock, 1);
  });

  it("invade RP win flips ideology + patron", () => {
    const rng = mulberry32(9004);
    const G = createGame(9004, rng);
    const atk = G.colonies[0]!; // US
    const def = G.colonies[1]!; // China
    // Clean specialties (no strain); bodyMod gap survives destroy-first
    atk.specialty = "Military";
    atk.bodyMod = 5;
    atk.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof atk.developed;
    atk.militaryTokenBurned = false;
    def.specialty = "Food";
    def.bodyMod = 0;
    def.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof def.developed;
    def.developed.Infrastructure = 1; // destroyed first, then RP compare
    def.ideology = ["Chinese Socialism"];
    assert.equal(hasInvasionToken(atk), true);
    assert.equal(canInvade(G, atk, def), true);
    assert.equal(invade(G, atk, def, rng), true);
    assert.equal(def.patron, "United States");
    assert.equal(def.ideology[0], atk.ideology[0]);
    assert.equal(def.developed.Infrastructure || 0, 0);
  });

  it("invade defender win burns Military token", () => {
    const rng = mulberry32(9005);
    const G = createGame(9005, rng);
    const atk = G.colonies[0]!;
    const def = G.colonies[1]!;
    atk.specialty = "Food";
    atk.bodyMod = 0;
    atk.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof atk.developed;
    atk.developed.Military = 1;
    def.specialty = "Food";
    def.bodyMod = 5; // stays ahead after Infrastructure destroy
    def.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof def.developed;
    def.developed.Infrastructure = 1;
    assert.equal(invade(G, atk, def, rng), true);
    assert.equal(atk.developed.Military || 0, 0);
    assert.equal(def.patron, "China"); // unchanged on defender win
  });

  it("Neutral-patron and aff≥2 trade rules untouched", () => {
    const rng = mulberry32(9006);
    const G = createGame(9006, rng);
    const us = G.colonies[0]!;
    const other = G.colonies[1]!;
    other.patron = "Latin Federation";
    other.specialty = "Water";
    other.culture = ["Latin"];
    other.ideology = ["Situationism"];
    other.ideologyImported = [];
    assert.equal(colonyTradeOk(G, other, us), true);
    // West↔East still needs aff≥2
    other.patron = "China";
    other.culture = [us.culture[0]!];
    other.ideology = ["Chinese Socialism"];
    assert.equal(socialAffinity(G, us, other), 1);
    assert.equal(colonyTradeOk(G, other, us), false);
    other.ideology = [us.ideology[0]!];
    assert.equal(colonyTradeOk(G, other, us), true);
  });
});


describe("0.9.1 subversion importer + fervor params", () => {
  it("importer of Subversion does not gain subversionMark or independence fervor from import alone", () => {
    const rng = mulberry32(9101);
    const G = createGame(9101, rng);
    applyFervorParams(G, { ...LEGACY_FERVOR_PARAMS, threshold: 5, minAgeTurns: 0 });
    const c = G.colonies[0]!;
    c.culture = ["American"];
    c.ideology = ["Democratic Free Market"];
    c.ideologyImported = [];
    c.subversionMark = false;
    c.specialty = "Resources";
    c.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof c.developed;
    for (const n of ["Infrastructure", "Energy", "Water", "Oxygen", "Food"] as const) {
      c.developed[n] = 1;
    }
    for (const l of c.logisticsLines) { l.route = null; l.exportRoute = null; }
    const before = computeFervorLedger(G, c);
    onSubversionRouteStart(G, c);
    assert.equal(!!c.subversionMark, false, "importer must not be marked");
    const afterImport = computeFervorLedger(G, c);
    assert.equal(afterImport, before, `import must not change ledger (${before}→${afterImport})`);
    onSubversionDevelop(G, c);
    assert.equal(!!c.subversionMark, false);
    const afterDev = computeFervorLedger(G, c);
    assert.equal(afterDev, before);
    tickFervor(G, c, rng);
    assert.notEqual(c.patron, "Independent");
  });

  it("Trojan target still receives permanent subversionMark (sender does not)", () => {
    const rng = mulberry32(9102);
    const G = createGame(9102, rng);
    const atk = G.colonies[0]!;
    const vic = G.colonies[1]!;
    atk.specialty = "Subversion";
    atk.developed = Object.fromEntries(NODES.map((n) => [n, 0])) as typeof atk.developed;
    atk.subversionMark = false;
    atk.culture = ["American"];
    atk.ideology = ["Democratic Free Market"];
    vic.culture = ["Chinese"];
    vic.ideology = ["Chinese Socialism"];
    vic.ideologyImported = [];
    vic.subversionMark = false;
    const line = atk.logisticsLines[0]!;
    assert.equal(executeTrojanSend(G, atk, vic, line.id), true);
    assert.equal(vic.subversionMark, true);
    assert.equal(!!atk.subversionMark, false);
  });

  it("turn-1 Subversion import alone cannot trigger independence", () => {
    const rng = mulberry32(9103);
    const G = createGame(9103, rng);
    applyFervorParams(G, { ...LEGACY_FERVOR_PARAMS, threshold: 5, minAgeTurns: 0 });
    const c = G.colonies[0]!;
    assert.equal(G.turn, 1);
    c.subversionMark = false;
    const fervorBefore = computeFervorLedger(G, c);
    onSubversionRouteStart(G, c);
    assert.equal(!!c.subversionMark, false);
    tickFervor(G, c, rng);
    assert.equal(computeFervorLedger(G, c), fervorBefore);
    assert.ok(
      c.patron !== "Independent" || fervorBefore >= 5,
      "must not become Independent from Subversion import alone on turn 1"
    );
  });
});



describe("0.9.2 fervor setup variants", () => {
  it("every named variant applies without throw and sets independence threshold", async () => {
    const { FERVOR_VARIANTS, DEFAULT_VARIANT_ID, variantById, defaultVariant } = await import("../src/fervorVariants.js");
    assert.ok(FERVOR_VARIANTS.length >= 10, "expected ≥10 named variants");
    assert.equal(defaultVariant().id, DEFAULT_VARIANT_ID);
    assert.equal(DEFAULT_VARIANT_ID, "realistic_survival");

    for (const v of FERVOR_VARIANTS) {
      assert.ok(v.id && v.label && v.summary, `variant ${v.id} needs id/label/summary`);
      const G = createGame(9200 + v.id.length, mulberry32(9200));
      const applied = applyFervorParams(G, v.params);
      assert.equal(applied.threshold, v.params.threshold, `${v.id} threshold via apply`);
      assert.equal(independenceThresholdOf(G), v.params.threshold, `${v.id} threshold synced`);
      assert.equal(G.independenceThreshold, v.params.threshold);
    }

    const session = GameSession.create(42, { variantId: "control_legacy" });
    assert.equal(session.fervorVariantId, "control_legacy");
    assert.equal(session.getIndependenceThreshold(), variantById("control_legacy")!.params.threshold);

    const def = GameSession.create(7);
    assert.equal(def.fervorVariantId, "realistic_survival");
    assert.equal(def.getIndependenceThreshold(), 10);

    const overridden = GameSession.create(9, {
      variantId: "realistic_survival",
      independenceThreshold: 17,
    });
    assert.equal(overridden.getIndependenceThreshold(), 17);
  });
});




describe("0.9.3 earth spontaneous + solar timing", () => {
  it("spontaneous tech stops once colonial player (at cap); no over-cap log spam", () => {
    const rng = mulberry32(505);
    const G = createGame(505, rng);
    const eu = G.blocs.find((b) => b.name === "European Union")!;
    eu.tech = eu.cap;
    assert.equal(canBlocFound(eu), true);
    const before = eu.tech;
    for (let i = 0; i < 30; i++) earthSpontaneous(G, rng);
    assert.equal(eu.tech, before, "tech must not rise past colonial eligibility");
    assert.equal(
      G.log.filter((e) => e.msg.includes("European Union spontaneous tech")).length,
      0,
      "no spontaneous tech log after cap"
    );
  });

  it("spontaneous still grows capped blocs below max, never past cap", () => {
    const rng = mulberry32(506);
    const G = createGame(506, rng);
    const au = G.blocs.find((b) => b.name === "African Union")!;
    au.tech = 0;
    for (let i = 0; i < 80; i++) earthSpontaneous(G, rng);
    assert.ok(au.tech <= au.cap);
    if (au.tech >= au.cap) {
      assert.equal(canBlocFound(au), true);
      const logs = G.log.filter((e) => /African Union spontaneous tech → (\d+)\/(\d+)/.test(e.msg));
      for (const e of logs) {
        const m = e.msg.match(/→ (\d+)\/(\d+)/)!;
        assert.ok(Number(m[1]) <= Number(m[2]));
      }
    }
  });

  it("default solar params block turn-2 relation founding; legacy still allows", () => {
    const mkPair = (seed: number, legacy: boolean) => {
      const rng = mulberry32(seed);
      const G = createGame(seed, rng);
      if (legacy) applySolarBlocParams(G, LEGACY_SOLAR_BLOC_PARAMS);
      else applySolarBlocParams(G, { minTurnToFoundBloc: 45, lateBlocWindowStart: 45, requireSharedRoute: 1, requireSeedFervor: 1, minCitiesToFound: 2 });
      const a = G.colonies[0]!;
      const b = G.colonies[1]!;
      a.culture = ["American", "Chinese"];
      b.culture = ["American", "Chinese"];
      a.ideology = ["Pioneerism"];
      b.ideology = ["Pioneerism"];
      a.fervor = 5;
      b.fervor = 5;
      a.developed.Food = (a.developed.Food || 0) + 2;
      b.requires = "Science";
      const free = b.logisticsLines.find((l) => l.route === null)!;
      assert.equal(startRoute(G, b, free.id, { kind: "colony", colony: a, node: "Food" }, rng), true);
      G.lastSolarBlocTurn = -999;
      return { G, rng };
    };
    const early = mkPair(901, false);
    assert.equal(tryRelationFoundSolarBloc(early.G, early.rng), false, "gated before min turn");
    early.G.turn = 50;
    assert.ok(tryRelationFoundSolarBloc(early.G, early.rng), "allowed in late window");

    const leg = mkPair(902, true);
    assert.ok(tryRelationFoundSolarBloc(leg.G, leg.rng), "legacy still founds early for unit tests");
  });

  it("solar variants apply via session and expose ids", async () => {
    const { SOLAR_BLOC_VARIANTS, DEFAULT_SOLAR_VARIANT_ID, defaultSolarVariant } = await import("../src/solarBlocVariants.js");
    assert.ok(SOLAR_BLOC_VARIANTS.length >= 10);
    assert.equal(defaultSolarVariant().id, DEFAULT_SOLAR_VARIANT_ID);
    const session = GameSession.create(42, {
      variantId: "realistic_survival",
      solarVariantId: "control_legacy",
    });
    assert.equal(session.solarVariantId, "control_legacy");
    const def = GameSession.create(11);
    assert.equal(def.solarVariantId, "solar_realist");
  });
});
