/**
 * 0.19.0 (Tiago) — relay lines, oxygen wars, nomad refugees & camps.
 * Each part is behind its own rule (rules.ts, group "Crises & Relays"); off = 0.18.0.
 * Functions are called at runtime from engine.ts / l4.ts (no top-level side effects → safe import cycle).
 */
import type { Colony, GameState, LogisticsLine, NodeType, ImportRoute } from "./types.js";
import type { Rng } from "./rng.js";
import { ruleNum, ruleOn } from "./rules.js";
import { extras, rp, freeLines, colonyLevel } from "./nodes.js";
import { lineCanServeTrade, reachSupports, reachForBody, isVitalNeed, pickExportLine } from "./trade.js";
import { isIndependent, INDEPENDENT_PATRON, canSendTrojan, trojanSendFreeLines, executeTrojanSend } from "./l3.js";
import { sameNation } from "./nation.js";
import {
  pushLog, friendlyColonies, opponentColonies, assistsColony, socialAffinity, findLine, clearRouteOnLine,
  lendableLines, lendLogisticsLine, returnLentLine, grantColonyImport, afterColonyAction, develop, makeColony,
  applyRouteStartEffects, annexColony,
} from "./engine.js";
import {
  survivalShortfall, survivalCover, survivalNeed, oxygenSuppliersNotTrading, oxygenDeaths, hasInvasionToken,
  burnMilitaryToken, destroyOneDevelopedNode, raiseEarthThreat, hasCasusBelli, westEastInvadeBlocked,
  STATIONED_DEFENSE, type SurvivalClockKind,
} from "./l4.js";

const on = (G: GameState, id: string) => !!G.rules && ruleOn(G, id);
const col = (G: GameState, id: string) => G.colonies.find((c) => c.id === id);
export const isCamp = (c: Colony) => !!c.nomad;

/** Lending / relay partner gate: allies yes, West↔East no (0.18.0 aiLendAllies), else the normal assist gate. */
export function partnerOk(G: GameState, giver: Colony, taker: Colony): boolean {
  if (isCamp(giver) || isCamp(taker)) return false;
  if (on(G, "aiLendAllies")) {
    if (opponentColonies(G, giver, taker)) return false;
    if (friendlyColonies(G, giver, taker)) return true;
  }
  return assistsColony(G, giver, taker) || sameNation(giver, taker);
}

// ── 1) Relay lines ─────────────────────────────────────────────────────────────────────────────

/** Lines of other colonies importing `node` only from Earth that could relay it to `taker`. */
export function relayCandidates(G: GameState, taker: Colony, node: NodeType): { giver: Colony; line: LogisticsLine }[] {
  const out: { giver: Colony; line: LogisticsLine }[] = [];
  for (const giver of G.colonies) {
    if (giver.id === taker.id) continue;
    for (const line of giver.logisticsLines) {
      const r = line.route;
      if (!r || r.sourceKind !== "earth" || r.node !== node || r.earthCycle || line.relayTo) continue;
      if (line.kind === "borrowed" || line.lentTo || line.trojanSend) continue;
      if (!reachSupports(line.reach ?? reachForBody(giver.body), giver.body, taker.body)) continue;
      if (!partnerOk(G, giver, taker)) continue;
      out.push({ giver, line });
    }
  }
  // prefer stable relays: the giver needs that good itself (its Requires / vital), so it won't cycle it away
  const stable = (x: { giver: Colony; line: LogisticsLine }) => Number(x.line.route!.node === x.giver.requires || !!x.line.route!.vital);
  return out.sort((a, b) => stable(b) - stable(a) || Number(friendlyColonies(G, b.giver, taker)) - Number(friendlyColonies(G, a.giver, taker))
    || Number(b.giver.body === taker.body) - Number(a.giver.body === taker.body) || a.giver.name.localeCompare(b.giver.name));
}

/** Taker receives `node` on a relay of a giver's Earth line (no own line used). Counts as the taker's action. */
export function tryRelay(G: GameState, taker: Colony, node: NodeType, rng: Rng): boolean {
  if (!on(G, "relayLines") || node === "Logistics") return false;
  // AI asks for a relay only for its Requires (a develop), a vital need, or Earth goods on Mars (no direct Earth trade)
  if (node !== taker.requires && !isVitalNeed(taker, node) && taker.body !== "Mars") return false;
  const cand = relayCandidates(G, taker, node)[0];
  if (!cand) return false;
  const { giver, line } = cand;
  const id = `R${taker.nextLineId++}`;
  const route: ImportRoute = { sourceKind: "colony", sourceId: giver.id, sourceName: giver.name, node, counterNode: null, counterConsent: false };
  if (isVitalNeed(taker, node)) route.vital = true;
  taker.logisticsLines.push({
    id, name: `relay via ${giver.name}`, kind: "borrowed", sourceLabel: giver.name, route, exportRoute: null, lentTo: null,
    reach: line.reach ?? reachForBody(giver.body), borrowedFrom: { colonyId: giver.id, lineId: line.id }, relay: true,
  });
  line.relayTo = { colonyId: taker.id, lineId: id, colonyName: taker.name };
  pushLog(G, `🔁 ${giver.name} relays Earth ${node} (${line.route!.sourceName}) on to ${taker.name}.`, true);
  applyRouteStartEffects(G, taker, { kind: "colony", colony: giver, node }, rng);
  if (node === taker.requires) develop(G, taker, rng);
  afterColonyAction(G, taker, rng);
  return true;
}

/** Remove the receiving side of a relay (giver line lost its Earth route, or taker cancelled). */
export function dropRelay(G: GameState, giverLine: LogisticsLine): void {
  const rt = giverLine.relayTo;
  giverLine.relayTo = null;
  if (!rt) return;
  const taker = col(G, rt.colonyId);
  if (!taker) return;
  const idx = taker.logisticsLines.findIndex((l) => l.id === rt.lineId);
  if (idx < 0) return;
  const node = taker.logisticsLines[idx]!.route?.node;
  taker.logisticsLines.splice(idx, 1);
  pushLog(G, `🔁 Relay of ${node ?? "?"} to ${taker.name} ends.`, true);
}

/** Taker-side line cleared: free the giver's relay slot. */
export function releaseRelaySlot(G: GameState, takerLine: LogisticsLine): void {
  const bf = takerLine.borrowedFrom;
  if (!takerLine.relay || !bf) return;
  const gl = col(G, bf.colonyId) && findLine(col(G, bf.colonyId)!, bf.lineId);
  if (gl && gl.relayTo?.lineId === takerLine.id) gl.relayTo = null;
}

/** End-of-turn consistency sweep for relays + expired timed state. */
export function sweepCrises(G: GameState): void {
  for (const c of G.colonies) {
    for (let i = c.logisticsLines.length - 1; i >= 0; i--) {
      const l = c.logisticsLines[i]!;
      if (!l.relay) continue;
      const g = l.borrowedFrom ? col(G, l.borrowedFrom.colonyId) : undefined;
      const gl = g ? findLine(g, l.borrowedFrom!.lineId) : undefined;
      const ok = !!l.route && !!gl && gl.route?.sourceKind === "earth" && gl.route.node === l.route.node && gl.relayTo?.lineId === l.id;
      if (!ok) { c.logisticsLines.splice(i, 1); if (gl?.relayTo?.lineId === l.id) gl.relayTo = null; }
    }
    for (const l of c.logisticsLines) {
      if (!l.relayTo) continue;
      const t = col(G, l.relayTo.colonyId);
      if (!t || !t.logisticsLines.some((x) => x.id === l.relayTo!.lineId) || l.route?.sourceKind !== "earth") l.relayTo = null;
    }
    if (c.fervorEvents?.length) c.fervorEvents = c.fervorEvents.filter((e) => e.until >= G.turn);
    if (c.casusBelli?.length) c.casusBelli = c.casusBelli.filter((e) => e.until >= G.turn);
  }
}

// ── 2) Oxygen wars ─────────────────────────────────────────────────────────────────────────────

const PRICE_NODES: NodeType[] = ["Money", "Culture", "Science", "Production", "Resources", "Infrastructure", "Energy",
  "Ideology", "Projects", "Terraforming", "Thrust", "Subversion", "Stability", "Military"];

/** Non-ally price: one developed node (most plentiful), else a step toward the supplier's bloc (its ideology). */
function payPleaPrice(G: GameState, buyer: Colony, seller: Colony): string {
  const n = PRICE_NODES.filter((x) => (buyer.developed[x] || 0) > 0)
    .sort((a, b) => (buyer.developed[b] || 0) - (buyer.developed[a] || 0))[0];
  if (n) {
    buyer.developed[n] -= 1;
    seller.developed[n] = (seller.developed[n] || 0) + 1;
    return `1 ${n}`;
  }
  const tag = seller.ideology[0];
  if (tag && !buyer.ideology.includes(tag)) buyer.ideology.push(tag);
  for (const t of seller.culture.slice(0, 1)) if (!buyer.culture.includes(t)) buyer.culture.push(t);
  return `a step toward ${seller.patron === INDEPENDENT_PATRON ? seller.name : seller.patron} (${tag ?? "culture"})`;
}

/** Supplier hands the crisis colony an Oxygen line: receiving line (own free, else lent by the supplier) + export slot (frees a non-vital export if needed). */
export function deliverOxygen(G: GameState, sup: Colony, c: Colony, rng: Rng): boolean {
  const src = { kind: "colony" as const, colony: sup, node: "Oxygen" as NodeType };
  let line = freeLines(c).find((l) => lineCanServeTrade(l, c, src));
  let borrowedId: string | null = null;
  if (!line) {
    const ll = lendableLines(sup).find((l) => lineCanServeTrade({ ...l, lentTo: null }, c, src));
    const b = ll ? lendLogisticsLine(G, sup, ll.id, c) : null;
    if (b) { line = b; borrowedId = b.id; }
  }
  if (!line) {
    // survival first: the crisis colony frees one of its own non-vital, non-Requires imports
    // (non-vital first; then any non-survival import — breathing beats every other need)
    const survival = (n: NodeType) => n === "Food" || n === "Water" || n === "Oxygen";
    const cands = c.logisticsLines.filter((l) => l.route && !l.relayTo && !l.trojanSend && !l.lentTo && !survival(l.route.node)
      && lineCanServeTrade({ ...l, route: null }, c, src));
    const own = cands.find((l) => !l.route!.vital && !isVitalNeed(c, l.route!.node) && l.route!.node !== c.requires) ?? cands[0];
    if (own) { clearRouteOnLine(G, c, own, rng, false); line = own; }
  }
  if (!line) {
    // …else the supplier frees one of its non-vital, non-Requires imports and lends that line
    const sl = sup.logisticsLines.filter((l) => l.kind !== "borrowed" && l.kind !== "base" && l.route && !l.route.vital && !l.relayTo && !l.lentTo
      && !l.exportRoute && !isVitalNeed(sup, l.route.node) && l.route.node !== sup.requires && !l.trojanSend)
      .find((l) => lineCanServeTrade({ ...l, route: null, lentTo: null }, c, src));
    if (sl) {
      clearRouteOnLine(G, sup, sl, rng, false);
      const b = lendLogisticsLine(G, sup, sl.id, c);
      if (b) { line = b; borrowedId = b.id; }
    }
  }
  if (!line) return false;
  if (!pickExportLine(sup, c)) {
    for (const l of sup.logisticsLines) {
      const ex = l.exportRoute;
      if (!ex || ex.vital) continue;
      const imp = col(G, ex.colonyId);
      const il = imp && findLine(imp, ex.importerLineId);
      if (imp && il && il.route) clearRouteOnLine(G, imp, il, rng, false);
      if (pickExportLine(sup, c)) break;
    }
  }
  const ok = !!pickExportLine(sup, c) && grantColonyImport(G, c, line.id, sup, "Oxygen", rng);
  if (!ok && borrowedId) returnLentLine(G, c, borrowedId);
  return ok;
}

/** Desperate seizure (L4 invade mechanics + bonus): win = take an Oxygen node; loss = uncovered Population dies. */
export function seizeOxygen(G: GameState, c: Colony, t: Colony, rng: Rng): boolean {
  const justified = hasCasusBelli(G, c, t);
  if (!justified && westEastInvadeBlocked(G, c, t)) return false;
  pushLog(G, `⚔ ${c.name} tries to seize Oxygen from ${t.name}${justified ? " (justified)" : ""}!`, true);
  destroyOneDevelopedNode(G, t);
  if (!justified) raiseEarthThreat(G, c, t);
  const bonus = ruleNum(G, "o2SeizeBonus");
  const a = rp(c, G.bodyTF) + bonus, d = rp(t, G.bodyTF);
  const crisis = c.oxygenCrisis;
  if (a > d) {
    if ((t.developed.Oxygen || 0) > 0) t.developed.Oxygen -= 1;
    c.developed.Oxygen = (c.developed.Oxygen || 0) + 1;
    pushLog(G, `⚔ SEIZED: ${c.name} takes an Oxygen node from ${t.name} (RP ${a} incl. +${bonus} > ${d}).`, true);
    G.turnAnnouncements.push(`${c.name} seizes Oxygen from ${t.name}.`);
    crisis?.actions?.push(`seized O₂ from ${t.name}`);
  } else {
    if (hasInvasionToken(c)) burnMilitaryToken(G, c, rng);
    pushLog(G, `🛡 SEIZE FAILED: ${t.name} holds (RP ${d} ≥ ${a}); ${c.name}'s uncovered Population dies.`, true);
    crisis?.actions?.push(`seizure of ${t.name} failed`);
    oxygenDeaths(G, c, survivalShortfall(G, c, "Oxygen"));
  }
  c.acted = true;
  return true;
}

/** Crisis colony's turn: plead (allies always accept; others for a price) → refusals = casus belli → seize. */
export function runOxygenCrisis(G: GameState, c: Colony, rng: Rng): boolean {
  if (!on(G, "oxygenWars") || !c.oxygenCrisis || isCamp(c)) return false;
  if (survivalShortfall(G, c, "Oxygen") <= 0) return false;
  const crisis = c.oxygenCrisis;
  crisis.actions ??= []; crisis.refusedBy ??= [];
  let acted = false;
  for (const s of oxygenSuppliersNotTrading(G, c)) {
    if (survivalShortfall(G, c, "Oxygen") <= 0) break;
    const sup = col(G, s.id);
    if (!sup || isCamp(sup)) continue;
    const ally = friendlyColonies(G, sup, c);
    const accepts = ally || (!opponentColonies(G, sup, c) && socialAffinity(G, sup, c) >= ruleNum(G, "o2PleaAffinity"));
    if (accepts) {
      if (deliverOxygen(G, sup, c, rng)) {
        const price = ally ? "free (ally)" : payPleaPrice(G, c, sup);
        pushLog(G, `🫁 PLEA ACCEPTED: ${sup.name} sends Oxygen to ${c.name} — price ${price}.`, true);
        crisis.actions.push(`plea: ${sup.name} sends O₂ (${price})`);
        G.turnAnnouncements.push(`${sup.name} answers ${c.name}'s Oxygen plea.`);
        acted = true;
      } else {
        pushLog(G, `🫁 ${sup.name} would send Oxygen to ${c.name} but has no line to spare.`, true);
      }
      continue;
    }
    if (!crisis.refusedBy.includes(sup.id)) crisis.refusedBy.push(sup.id);
    const until = G.turn + ruleNum(G, "o2CasusBelliTurns");
    c.casusBelli = [...(c.casusBelli ?? []).filter((x) => x.targetId !== sup.id), { targetId: sup.id, targetName: sup.name, until, reason: "refused Oxygen" }];
    pushLog(G, `🫁 PLEA REFUSED: ${sup.name} keeps its spare Oxygen from ${c.name} → casus belli until T${until}.`, true);
    crisis.actions.push(`threat: ${sup.name} refused → casus belli`);
    G.turnAnnouncements.push(`${sup.name} refuses Oxygen to ${c.name} — casus belli.`);
  }
  if (survivalShortfall(G, c, "Oxygen") > 0) {
    const targets = G.colonies
      .filter((t) => t.id !== c.id && !isCamp(t) && t.body === c.body && !sameNation(t, c) && !friendlyColonies(G, t, c)
        && survivalCover(t, "Oxygen") - survivalNeed(G, t, "Oxygen") > 0)
      .sort((a, b) => Number(crisis.refusedBy!.includes(b.id)) - Number(crisis.refusedBy!.includes(a.id))
        || rp(a, G.bodyTF) - rp(b, G.bodyTF) || a.name.localeCompare(b.name));
    if (targets[0] && seizeOxygen(G, c, targets[0], rng)) acted = true;
  }
  if (acted) afterColonyAction(G, c, rng);
  return acted;
}

/** Population died of no Oxygen → everyone who refused this crisis is marked a hoarder. */
export function markHoarders(G: GameState, c: Colony): void {
  if (!on(G, "oxygenWars")) return;
  const turns = ruleNum(G, "o2HoarderTurns"), amount = ruleNum(G, "o2HoarderFervor");
  for (const id of c.oxygenCrisis?.refusedBy ?? []) {
    const h = col(G, id);
    if (!h || (h.hoarderUntil ?? -1) >= G.turn) continue;
    h.hoarderUntil = G.turn + turns;
    const partners = new Set<string>();
    for (const l of h.logisticsLines) {
      if (l.route?.sourceKind === "colony") partners.add(l.route.sourceId);
      if (l.exportRoute) partners.add(l.exportRoute.colonyId);
    }
    for (const o of G.colonies) if (o.logisticsLines.some((l) => l.route?.sourceKind === "colony" && l.route.sourceId === h.id)) partners.add(o.id);
    partners.delete(h.id);
    for (const pid of partners) {
      const p = col(G, pid);
      if (p) (p.fervorEvents ??= []).push({ until: G.turn + turns, amount, why: `trades with hoarder ${h.name}` });
    }
    G.turnAnnouncements.push(`${h.name} marked an Oxygen hoarder.`);
    pushLog(G, `🏴 HOARDER: ${h.name} refused Oxygen while ${c.name} lost Population (fervor +${amount} in ${partners.size} trade partner${partners.size === 1 ? "" : "s"}).`, true);
  }
}

/** Timed fervor (hoarder partners, refugee hosts). */
export function timedFervor(G: GameState, c: Colony): number {
  return (c.fervorEvents ?? []).filter((e) => e.until >= G.turn).reduce((s, e) => s + e.amount, 0);
}

// ── 3) Nomad refugees & camps ──────────────────────────────────────────────────────────────────

/** Food/Water refugees: score hosts, try best first: accept / arm (rival Trojan) / refuse; all refuse → camp. */
export function nomadRefugees(G: GameState, origin: Colony, reason: SurvivalClockKind, rng: Rng): boolean {
  if (!on(G, "nomadCamps") || (reason !== "food" && reason !== "water")) return false;
  const res = reason === "food" ? "Food" : "Water";
  const spare = (h: Colony) => survivalCover(h, res) - survivalNeed(G, h, res);
  const score = (h: Colony) => (h.body === origin.body ? 3 : 0) + 2 * Math.min(3, Math.max(0, spare(h)))
    + rp(h, G.bodyTF) / 5 + (h.ideology.some((t) => origin.ideology.includes(t)) ? 2 : 0);
  const hosts = G.colonies.filter((h) => h.id !== origin.id && !isCamp(h))
    .map((h) => ({ h, s: score(h) })).sort((a, b) => b.s - a.s || a.h.name.localeCompare(b.h.name));
  const rejected: string[] = [];
  for (const { h } of hosts) {
    const friendly = friendlyColonies(G, h, origin) || (!opponentColonies(G, h, origin) && socialAffinity(G, h, origin) >= 1);
    // the newcomer Population must be fed, hydrated and (off a livable body) oxygenated by the host's spare
    const roomy = spare(h) > 0 && (["Food", "Water", "Oxygen"] as const).every((r) => r === res
      || (r === "Oxygen" && survivalNeed(G, h, "Oxygen") === 0 && (G.bodyTF[h.body] || 0) >= 10)
      || survivalCover(h, r) - survivalNeed(G, h, r) > 0);
    if (roomy && friendly) {
      h.developed.Population = (h.developed.Population || 0) + 1;
      for (const t of origin.culture) if (t && !h.culture.includes(t)) h.culture.push(t);
      const f = ruleNum(G, "refugeeAcceptFervor");
      if (f > 0) (h.fervorEvents ??= []).push({ until: G.turn + 10, amount: f, why: `took in refugees from ${origin.name}` });
      pushLog(G, `🏕 REFUGEES ACCEPTED: ${h.name} takes in ${res}-refugees from ${origin.name} (+1 Population).`, true);
      return true;
    }
    const rival = opponentColonies(G, h, origin) || socialAffinity(G, h, origin) <= 0;
    if (rival && canSendTrojan(G, h, origin)) {
      const line = trojanSendFreeLines(h)[0];
      if (line && executeTrojanSend(G, h, origin, line.id)) {
        pushLog(G, `🏕 REFUGEES ARMED: ${h.name} arms refugees from ${origin.name} and sends them back (Trojan).`, true);
        return true;
      }
    }
    rejected.push(h.id);
  }
  pushLog(G, `🏕 REFUGEES REFUSED by ${rejected.length} colon${rejected.length === 1 ? "y" : "ies"} (${origin.name}).`, true);
  const camps = G.colonies.filter(isCamp).length;
  if (camps >= ruleNum(G, "nomadMaxCamps")) return false; // stranded as before
  const nearRejecters = rejected.filter((id) => col(G, id)?.body === origin.body);
  const camp = makeColony(G, {
    patron: INDEPENDENT_PATRON, body: origin.body, specialty: "Resources", requires: res,
    culture: origin.culture.slice(0, 2), ideology: ["Nomad"], name: campName(G, origin), rng,
  });
  camp.liegeId = camp.id;
  camp.nomad = { since: G.turn, originId: origin.id, originName: origin.name, rejectedBy: nearRejecters, resource: res, repels: 0 };
  G.colonies.push(camp);
  pushLog(G, `⛺ NOMAD CAMP: refugees from ${origin.name} settle ${camp.name} on ${origin.body} (raids ${nearRejecters.length} colon${nearRejecters.length === 1 ? "y" : "ies"} that refused them).`, true);
  G.turnAnnouncements.push(`Nomad camp ${camp.name} on ${origin.body}.`);
  return true;
}

function campName(G: GameState, origin: Colony): string {
  const base = `${origin.name.split(" ")[0]} Nomad Camp`;
  let name = base, i = 2;
  while (G.colonies.some((c) => c.name === name)) name = `${base} ${i++}`;
  return name;
}
const campDefense = (t: Colony) => STATIONED_DEFENSE + (hasInvasionToken(t) ? 2 : 0) + (extras(t, "Stability") > 0 ? 1 : 0);

/** A camp's action: become an Independent founder, else raid a colony that refused it (weak invasion). */
export function campAct(G: GameState, camp: Colony, rng: Rng): void {
  const n = camp.nomad!;
  const age = G.turn - n.since;
  if (age >= ruleNum(G, "nomadCampTurns")) {
    camp.nomad = null;
    camp.ideology = ["Localism"];
    pushLog(G, `⛺→⚑ ${camp.name} survived ${age} turns and becomes an Independent founder.`, true);
    afterColonyAction(G, camp, rng);
    return;
  }
  const every = ruleNum(G, "nomadRaidEvery");
  const target = n.rejectedBy.map((id) => col(G, id)).filter((t): t is Colony => !!t && t.body === camp.body && !isCamp(t)
      && (t.developed[n.resource] || 0) > 0 && survivalCover(t, n.resource) - survivalNeed(G, t, n.resource) > 0) // raids take surplus stores only
    .sort((a, b) => campDefense(a) - campDefense(b) || extras(b, n.resource) - extras(a, n.resource) || a.name.localeCompare(b.name))[0];
  if (target && G.turn - (n.lastRaid ?? n.since) >= every) {
    n.lastRaid = G.turn;
    const attack = 2 + Math.floor(age / 10);
    const defense = campDefense(target);
    if (attack > defense) {
      target.developed[n.resource] -= 1;
      camp.developed[n.resource] = (camp.developed[n.resource] || 0) + 1;
      pushLog(G, `⛺ RAID: ${camp.name} raids ${target.name}'s ${n.resource} stores (${attack} > ${defense}).`, true);
    } else {
      n.repels += 1;
      pushLog(G, `🛡 RAID REPELLED: ${target.name} stops ${camp.name} (${defense} ≥ ${attack}; ${n.repels}/${ruleNum(G, "nomadMaxRepels")}).`, true);
      if (n.repels >= ruleNum(G, "nomadMaxRepels")) {
        camp.nomad = null;
        annexColony(G, target, camp);
        pushLog(G, `⛺ ${camp.name} is broken up and absorbed by ${target.name}.`, true);
      }
    }
  }
  afterColonyAction(G, camp, rng);
}

export { colonyLevel };
