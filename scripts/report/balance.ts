import { writeFileSync } from "node:fs";
import { mulberry32 } from "../../src/rng.js";
import { createGame, runTurn, applySolarBlocParams, applyFervorParams } from "../../src/engine.js";
import { FERVOR_VARIANTS } from "../../src/fervorVariants.js";
import { SOLAR_BLOC_VARIANTS } from "../../src/solarBlocVariants.js";
const F = ["realistic_survival","ferment_late","realistic_strict","control_legacy"];
const S = ["solar_realist","late_35","late_55","control_legacy"];
const seeds=[42,7,99], T=150; const rows:any[]=[];
const first=(G:any,re:RegExp)=>{const e=G.log.find((e:any)=>re.test(e.msg));return e?e.turn:null};
const cnt=(G:any,re:RegExp,m=1e9)=>G.log.filter((e:any)=>e.turn<=m&&re.test(e.msg)).length;
for(const f of F)for(const s of S)for(const seed of seeds){
  const rng=mulberry32(seed);const G:any=createGame(seed,rng);
  applyFervorParams(G,FERVOR_VARIANTS.find(v=>v.id===f)!.params);
  applySolarBlocParams(G,SOLAR_BLOC_VARIANTS.find(v=>v.id===s)!.params);
  const t0=Date.now(); for(let i=0;i<T;i++)runTurn(G,rng);
  const R=/⚑ REVOLUTION:/, B=/⚑ SOLAR BLOC:/, N=/alliance softens .+ → Neutral/;
  const cs=G.colonies; const ind=cs.filter((c:any)=>c.patron==="Independent").length;
  rows.push({f,s,seed,firstRev:first(G,R),r20:cnt(G,R,20),r40:cnt(G,R,40),r80:cnt(G,R,80),r150:cnt(G,R),
    firstBloc:first(G,B),firstSoft:first(G,N),blocs:cnt(G,B),refugees:cnt(G,/🏕 Refugees flee/),
    moon:cs.filter((c:any)=>c.body==="Moon").length,mars:cs.filter((c:any)=>c.body==="Mars").length,
    indShare:cs.length?ind/cs.length:0,ms:Date.now()-t0});
  console.log(f,s,seed,Date.now()-t0);
}
writeFileSync("out/reports/balance-0.9.3.raw.json",JSON.stringify(rows,null,1));
