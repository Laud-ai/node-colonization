/**
 * 0.21.0 Living Colony — deterministic event record + per-turn relation snapshots (rule `eventLog`).
 * Sources: explicit calls (blends with parents, foundings with tags), an end-of-turn state diff (patron / alliance /
 * ideology / culture changes, new and lost colonies) and stable log markers (wars, seizures, oxygen wars, raids, …).
 * Never touches the RNG, so the simulation is identical with the rule off. Built for 0.21.1 Lineage + cluster replay.
 */
import type { Body, Colony, GameEvent, GameEventType, GameState, TurnSnapshot } from "./types.js";
import { ruleOn } from "./rules.js";
import { colonyLevel } from "./nodes.js";

const INDEP = "Independent";
export function eventsOn(G: GameState): boolean { return !!G.rules && ruleOn(G, "eventLog"); }

type NewEvent = Omit<GameEvent, "seq" | "turn" | "names"> & { turn?: number; names?: string[] };
export function recordEvent(G: GameState, e: NewEvent): void {
  if (!eventsOn(G)) return;
  const ev = (G.events ??= []);
  const names = e.names ?? e.colonies.map((id) => G.colonies.find((c) => c.id === id)?.name ?? id);
  ev.push({ ...e, seq: ev.length, turn: e.turn ?? G.turn, names });
}

/** Explicit blend / change record with parents (called from the ideology / culture code paths). */
export function recordIdentity(G: GameState, c: Colony, kind: "ideology" | "culture", before: string[], tags: string[], parents: string[], source?: { colony?: Colony; bloc?: string }): void {
  if (!eventsOn(G)) return;
  const after = kind === "ideology" ? c.ideology.slice() : c.culture.slice();
  if (before.join("|") === after.join("|")) return;
  const cols = [c.id, ...(source?.colony ? [source.colony.id] : [])];
  const blocs = [c.patron, ...(source?.bloc ? [source.bloc] : [])].filter((b) => b !== INDEP);
  const verb = tags.includes("blend") ? "blends" : tags.includes("import") ? "imports" : tags.includes("overwrite") ? "turns to" : "adopts";
  recordEvent(G, {
    type: kind, colonies: cols, blocs, tags, parents, before: { [kind]: before }, after: { [kind]: after },
    text: `${c.name} ${verb} ${kind} ${after.join(" / ")}${parents.length ? ` (from ${parents.join(" + ")})` : ""}.`,
  });
  (G.__identityMarks ??= new Set<string>()).add(`${G.turn}|${c.id}|${kind}`);
}

function snapshotOf(G: GameState): TurnSnapshot {
  const alliances: Record<string, string> = {};
  for (const b of G.blocs) alliances[b.name] = b.alliance;
  return {
    turn: G.turn, alliances,
    cols: G.colonies.map((c) => ({
      id: c.id, name: c.name, patron: c.patron, liege: c.liegeId ?? null, body: c.body as Body, level: colonyLevel(c),
      ideology: c.ideology.slice(), culture: c.culture.slice(),
      trade: [...new Set(c.logisticsLines.filter((l) => l.route?.sourceKind === "colony").map((l) => l.route!.sourceId))],
      war: (c.proxyAgitation || 0) > 0 || (G.__warThisTurn?.has(c.id) ?? false),
      // 0.21.1 cluster graph inputs (record only)
      fervor: c.fervor ?? 0, hoarder: (c.hoarderUntil ?? 0) >= G.turn,
    })),
  };
}

/** Log markers → event types (stable strings from l3 / l4 / crises / l7). */
const MARKERS: { re: RegExp; type: GameEventType; tags: string[] }[] = [
  { re: /^⚑ REVOLUTION:/, type: "revolution", tags: [] },
  { re: /^⚔ .* invades .*!$/, type: "war", tags: ["invasion"] },
  { re: /^⚖ Justified war:/, type: "war", tags: ["justified", "oxygen"] },
  { re: /^⚑ .* annexes /, type: "annex", tags: ["conquest"] },
  { re: /^🛡 .* repels /, type: "war", tags: ["repelled"] },
  { re: /^🕵 Proxy war:/, type: "war", tags: ["proxy"] },
  { re: /^⚔ .* tries to seize Oxygen/, type: "seize", tags: ["oxygen", "attempt"] },
  { re: /^⚔ SEIZED:/, type: "seize", tags: ["oxygen", "won"] },
  { re: /^🛡 SEIZE FAILED:/, type: "seize", tags: ["oxygen", "lost"] },
  { re: /^🫁 PLEA ACCEPTED:/, type: "o2", tags: ["plea", "accepted"] },
  { re: /^🫁 PLEA REFUSED:/, type: "o2", tags: ["plea", "refused"] },
  { re: /^🏴 HOARDER:/, type: "o2", tags: ["hoarder"] },
  { re: /^⛺ RAID:/, type: "raid", tags: ["won"] },
  { re: /^🛡 RAID REPELLED:/, type: "raid", tags: ["repelled"] },
  { re: /^👑 OVERTURN:/, type: "patronChange", tags: ["overturn"] },
  { re: /^⚑ SOLAR BLOC:/, type: "allianceShift", tags: ["solarBloc"] },
  { re: /^🚀 BELT MILESTONE:/, type: "milestone", tags: ["belt"] },
  { re: /^🌊 WAVE/, type: "wave", tags: [] },
];

/** Colony ids named in a message, in order of appearance (longest names first so "X Prime" beats "X"). */
function namedIn(msg: string, named: { id: string; name: string }[]): { ids: string[]; names: string[] } {
  const hits: { at: number; id: string; name: string }[] = [];
  const taken: [number, number][] = [];
  for (const c of [...named].sort((a, b) => b.name.length - a.name.length)) {
    let from = 0;
    for (;;) {
      const at = msg.indexOf(c.name, from);
      if (at < 0) break;
      const end = at + c.name.length;
      if (!taken.some(([s, e]) => at < e && end > s)) { taken.push([at, end]); hits.push({ at, id: c.id, name: c.name }); break; }
      from = at + 1;
    }
  }
  hits.sort((a, b) => a.at - b.at);
  const ids: string[] = [], names: string[] = [];
  for (const h of hits) if (!ids.includes(h.id)) { ids.push(h.id); names.push(h.name); }
  return { ids, names };
}

/** End of turn (cleanup): classify new log lines, diff against last snapshot, push the new snapshot. */
export function endTurnEvents(G: GameState): void {
  if (!eventsOn(G)) return;
  const tl = (G.timeline ??= []);
  const prev = tl[tl.length - 1];
  const named = [...G.colonies.map((c) => ({ id: c.id, name: c.name })), ...(prev?.cols ?? []).filter((p) => !G.colonies.some((c) => c.id === p.id)).map((p) => ({ id: p.id, name: p.name }))];
  // 1) log markers
  const from = G.__eventLogIdx ?? 0;
  const turnTypes = new Map<string, Set<GameEventType>>(); // colony id → types logged this turn
  for (let i = from; i < G.log.length; i++) {
    const msg = G.log[i]!.msg;
    const m = MARKERS.find((k) => k.re.test(msg));
    if (!m) continue;
    const { ids, names } = namedIn(msg, named);
    const blocs = [...new Set(ids.map((id) => G.colonies.find((c) => c.id === id)?.patron).filter((p): p is string => !!p && p !== INDEP))];
    for (const id of ids) { const s = turnTypes.get(id) ?? new Set(); s.add(m.type); turnTypes.set(id, s); }
    if (m.type === "war" || m.type === "seize" || m.type === "annex") for (const id of ids) (G.__warThisTurn ??= new Set()).add(id);
    recordEvent(G, { type: m.type, colonies: ids, names, blocs, tags: m.tags, text: msg.replace(/^\S+\s/, "") });
  }
  G.__eventLogIdx = G.log.length;
  // 2) diff
  const cur = snapshotOf(G);
  const was = new Map((prev?.cols ?? []).map((c) => [c.id, c]));
  const marks: Set<string> = G.__identityMarks ?? new Set();
  for (const c of cur.cols) {
    const p = was.get(c.id);
    const col = G.colonies.find((x) => x.id === c.id)!;
    if (!p) {
      const camp = !!col.nomad;
      const tags = col.foundTags?.slice() ?? (camp ? ["camp"] : c.patron === INDEP ? ["independent"] : ["tech"]);
      const parent = col.parentId ? G.colonies.find((x) => x.id === col.parentId) : undefined;
      const by = c.patron === INDEP ? (parent ? parent.name : "Independents") : c.patron;
      recordEvent(G, {
        type: camp ? "camp" : "found", colonies: parent ? [c.id, parent.id] : [c.id], blocs: c.patron === INDEP ? [] : [c.patron], tags,
        parentColony: col.parentId, after: { patron: c.patron, body: c.body, ideology: c.ideology, culture: c.culture },
        text: camp ? `${c.name}: a nomad camp settles on ${c.body}.`
          : `${c.name} is founded on ${c.body} by ${by}${tags.includes("daughter") && parent ? ` as a daughter of ${parent.name}` : ""}${tags.includes("first") ? " — first on the body" : ""}${tags.includes("wave") ? " (colonization wave)" : ""}.`,
      });
      continue;
    }
    if (p.patron !== c.patron) {
      const logged = turnTypes.get(c.id);
      const toIndep = c.patron === INDEP;
      const type: GameEventType = toIndep ? "independence" : p.patron === INDEP ? "annex" : "patronChange";
      const dup = (type === "independence" && logged?.has("revolution")) || (type === "annex" && logged?.has("annex"));
      if (!dup) {
        recordEvent(G, {
          type, colonies: [c.id], blocs: [p.patron, c.patron].filter((b) => b !== INDEP), tags: logged?.has("patronChange") ? ["overturn"] : [],
          before: { patron: p.patron, liege: p.liege }, after: { patron: c.patron, liege: c.liege },
          text: toIndep ? `${c.name} leaves ${p.patron} and stands Independent.` : `${c.name} passes from ${p.patron} to ${c.patron}.`,
        });
      } else {
        // enrich the logged event with before/after
        const ev = [...G.events!].reverse().find((e) => e.colonies.includes(c.id) && (e.type === "revolution" || e.type === "annex") && e.turn === G.turn);
        if (ev) { ev.before = { ...(ev.before ?? {}), patron: p.patron }; ev.after = { ...(ev.after ?? {}), patron: c.patron }; }
      }
    }
    for (const kind of ["ideology", "culture"] as const) {
      if (p[kind].join("|") !== c[kind].join("|") && !marks.has(`${G.turn}|${c.id}|${kind}`)) {
        recordEvent(G, {
          type: kind, colonies: [c.id], blocs: c.patron === INDEP ? [] : [c.patron], tags: ["shift"], parents: p[kind],
          before: { [kind]: p[kind] }, after: { [kind]: c[kind] },
          text: `${c.name}'s ${kind} shifts from ${p[kind].join(" / ") || "—"} to ${c[kind].join(" / ") || "—"}.`,
        });
      }
    }
  }
  for (const p of prev?.cols ?? []) {
    if (cur.cols.some((c) => c.id === p.id)) continue;
    recordEvent(G, { type: "lost", colonies: [p.id], names: [p.name], blocs: p.patron === INDEP ? [] : [p.patron], before: { patron: p.patron, body: p.body }, text: `${p.name} is gone (absorbed or abandoned).` });
  }
  if (prev) for (const [b, a] of Object.entries(cur.alliances)) {
    if (prev.alliances[b] && prev.alliances[b] !== a) recordEvent(G, { type: "allianceShift", colonies: [], blocs: [b], before: { alliance: prev.alliances[b]! }, after: { alliance: a }, text: `${b} shifts from ${prev.alliances[b]} to ${a}.` });
  }
  G.__identityMarks = new Set();
  G.__warThisTurn = new Set();
  tl.push(cur);
}

// --- History (template chronicle, no AI text) ---
export interface HistoryEntry { turn: number; type: GameEventType; text: string }
export interface HistoryEra { title: string; from: number; to: number; patron: string; ideology: string; entries: HistoryEntry[] }

/** Colony-perspective sentence for an event (templates only). */
function chronicleText(e: GameEvent, id: string): string {
  const i = e.colonies.indexOf(id);
  const other = (k: number) => e.names[k] ?? "?";
  const them = e.colonies.length > 1 ? other(i === 0 ? 1 : 0) : "";
  const tag = (t: string) => e.tags?.includes(t);
  switch (e.type) {
    case "found":
      if (i > 0) return `Seeds the daughter colony ${other(0)} on ${String(e.after?.body ?? "")}.`;
      return `Founded on ${String(e.after?.body)} by ${e.blocs[0] ?? (them || "Independents")}${tag("daughter") && them ? `, a daughter of ${them}` : ""}${tag("first") ? " — the bloc's first on this body" : ""}${tag("wave") ? ", riding a colonization wave" : ""}${tag("pressure") ? ", as colonization pressure peaked" : ""}.`;
    case "camp": return `Refugees settle here as a nomad camp.`;
    case "war":
      if (tag("proxy")) return i === 0 ? `Proxy war: agitated by ${them || "a rival camp"}.` : `Proxy war agitation.`;
      if (tag("repelled")) return i === 0 ? `Repels an invasion by ${them}.` : `Its invasion of ${them} is repelled.`;
      if (tag("justified")) return i === 0 ? `Goes to a justified war against ${them} (casus belli).` : `${them} declares a justified war on it.`;
      return i === 0 ? `Invades ${them}.` : `Invaded by ${them}.`;
    case "annex": return i === 0 ? `Annexes ${them}.` : `Annexed by ${them}${e.after?.patron ? ` — now ${String(e.after.patron)}` : ""}.`;
    case "seize":
      if (tag("won")) return i === 0 ? `Seizes an Oxygen node from ${them}.` : `Loses an Oxygen node to ${them}.`;
      if (tag("lost")) return i === 0 ? `Holds off ${them}'s Oxygen seizure.` : `Its Oxygen seizure of ${them} fails; Population dies.`;
      return i === 0 ? `Tries to seize Oxygen from ${them}.` : `${them} moves to seize its Oxygen.`;
    case "o2":
      if (tag("hoarder")) return i === 0 ? `Marked an Oxygen hoarder (refused ${them}).` : `${them} is marked a hoarder for refusing it Oxygen.`;
      if (tag("accepted")) return i === 0 ? `Sends Oxygen to ${them} on a plea.` : `Its Oxygen plea is answered by ${them}.`;
      return i === 0 ? `Refuses ${them} Oxygen — a casus belli.` : `Its Oxygen plea to ${them} is refused.`;
    case "raid": return tag("repelled") ? (i === 0 ? `Repels a raid by ${them}.` : `Its raid on ${them} is repelled.`) : (i === 0 ? `Raids ${them}'s stores.` : `Raided by ${them}.`);
    case "revolution": return `Revolution: breaks from ${String(e.before?.patron ?? "its patron")}.`;
    case "independence": return `Leaves ${String(e.before?.patron)} and stands Independent.`;
    case "patronChange": return tag("overturn") ? `Overturn: the solar hegemon takes over${e.after?.patron ? ` (${String(e.after.patron)})` : ""}.` : `Passes from ${String(e.before?.patron)} to ${String(e.after?.patron)}.`;
    case "ideology": case "culture": {
      const a = (e.after?.[e.type] as string[] | undefined) ?? [];
      if (i > 0) return `Its ${e.type} spreads to ${other(0)}.`;
      if (tag("blend")) return `${e.type === "ideology" ? "Ideology" : "Culture"} blends into ${a.join(" / ")} (from ${(e.parents ?? []).join(" + ")}).`;
      if (tag("import")) return `Imports ${e.type} ${a[a.length - 1] ?? ""}${them ? ` from ${them}` : e.blocs[1] ? ` from ${e.blocs[1]}` : ""}.`;
      const label = e.type === "ideology" ? "Ideology" : "Culture";
      const b = (e.before?.[e.type] as string[] | undefined) ?? [];
      const gained = a.filter((x) => !b.includes(x)), lost = b.filter((x) => !a.includes(x));
      const list = (xs: string[]) => xs.length > 3 ? `${xs.slice(0, 3).join(", ")} +${xs.length - 3} more` : xs.join(", ");
      if (b.length && (gained.length || lost.length))
        return `${label}${gained.length ? ` takes up ${list(gained)}` : ""}${gained.length && lost.length ? " and" : ""}${lost.length ? ` drops ${list(lost)}` : ""}.`;
      return `${label} becomes ${list(a) || "—"}.`;
    }
    case "lost": return `Disappears from the map.`;
    case "milestone": return `Reaches the asteroid belt — a milestone for its bloc.`;
    case "wave": return e.text;
    default: return e.text;
  }
}

/** Colony chronicle grouped into eras (a new era whenever bloc or ideology changes). */
export function colonyHistory(G: GameState, id: string): HistoryEra[] {
  const ev = (G.events ?? []).filter((e) => e.colonies.includes(id));
  const tl = (G.timeline ?? []).map((s) => ({ turn: s.turn, c: s.cols.find((c) => c.id === id) })).filter((x) => !!x.c);
  const eras: HistoryEra[] = [];
  for (const { turn, c } of tl) {
    const ideology = c!.ideology[0] ?? "—";
    const last = eras[eras.length - 1];
    if (last && last.patron === c!.patron && last.ideology === ideology) { last.to = turn; continue; }
    const n = eras.length + 1;
    const title = `Era ${n}: ${c!.patron === INDEP ? "Independent" : c!.patron} · ${ideology}`;
    eras.push({ title, from: turn, to: turn, patron: c!.patron, ideology, entries: [] });
  }
  for (const e of ev) {
    const era = [...eras].reverse().find((r) => r.from <= e.turn) ?? eras[0];
    if (!era) continue;
    era.entries.push({ turn: e.turn, type: e.type, text: chronicleText(e, id) });
  }
  return eras;
}
