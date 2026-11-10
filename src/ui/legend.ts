/**
 * 0.20.0 — Map legend window: pins + badges (drawn with the real pin renderer), needs-tree colours,
 * route styles. Built once into the window body; canvases only (no SVG-as-image).
 */
import { drawAlertRing, drawPinHead, type PinStyle } from "./pinIcon.js";
import { NEED_STYLE } from "./needsView.js";
import { NODE_COLORS } from "../nodes.js";

const BLUE = "#3b82f6";
const PIN_SAMPLES: { label: string; p: Partial<PinStyle>; alert?: boolean }[] = [
  { label: "Bloc colony — head = bloc colour, number = level, badge = specialty", p: {} },
  { label: "Independent (white head, no fervor ring)", p: { independent: true, fervor: null } },
  { label: "Fervor ring 1 / 2 / 3 lit segments → independence; dashed outer ring = critical", p: { fervor: 0.93 } },
  { label: "⚔ invasion / proxy war", p: { war: true } },
  { label: "Dashed outline = founded this turn", p: { fresh: true } },
  { label: "O₂ badge = oxygen crisis (spare O₂ exists but nobody trades it)", p: { o2Crisis: true } },
  { label: "Tent = nomad camp (refugees; Independent if unsupplied)", p: { camp: true } },
  { label: "Hoarder = sitting on spare O₂ during a crisis", p: { hoarder: true } },
  { label: "Pulsing red ring = strain or a survival clock running", p: {}, alert: true },
];

function pinCanvas(s: Partial<PinStyle>, alert: boolean): HTMLCanvasElement {
  const px = 96;
  const cv = document.createElement("canvas");
  cv.width = cv.height = px;
  cv.className = "legend-pin";
  const ctx = cv.getContext("2d");
  if (ctx) {
    if (alert) drawAlertRing(ctx, px);
    const tmp = document.createElement("canvas");
    tmp.width = tmp.height = px;
    const t = tmp.getContext("2d");
    if (t) {
      drawPinHead(t, px, { level: 4, color: BLUE, independent: false, fervor: 0.3, specialty: "Thrust", ...s });
      ctx.drawImage(tmp, 0, 0);
    }
  }
  return cv;
}

function routeSwatch(kind: "regional" | "outer" | "grouped", color: string): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = 96; cv.height = 40; cv.className = "legend-route";
  const c = cv.getContext("2d");
  if (!c) return cv;
  c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 3;
  const arrow = (x: number, y: number, a: number) => {
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - 10 * Math.cos(a - 0.45), y - 10 * Math.sin(a - 0.45));
    c.lineTo(x - 10 * Math.cos(a + 0.45), y - 10 * Math.sin(a + 0.45)); c.closePath(); c.fill();
  };
  if (kind === "regional") {
    c.beginPath(); c.moveTo(8, 34); c.quadraticCurveTo(48, -6, 88, 34); c.stroke();
    arrow(86, 32, Math.PI * 0.3);
  } else {
    c.beginPath(); c.moveTo(10, 34); c.lineTo(62, 10); c.stroke();
    arrow(64, 9, -0.43);
    c.lineWidth = 2; c.strokeRect(66, 2, 22, 15);
    c.fillStyle = "#64748b"; c.fillRect(67, 3, 20, 13);
    if (kind === "grouped") {
      c.fillStyle = "rgba(5,7,13,0.9)"; c.beginPath(); c.arc(86, 26, 10, 0, Math.PI * 2); c.fill();
      c.strokeStyle = color; c.lineWidth = 2; c.stroke();
      c.fillStyle = "#fff"; c.font = "bold 12px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("3", 86, 27);
    }
  }
  return cv;
}

function row(icon: HTMLElement, text: string, key: string): HTMLElement {
  const d = document.createElement("div");
  d.className = "legend-row"; d.dataset.legend = key;
  const s = document.createElement("span"); s.textContent = text;
  d.append(icon, s);
  return d;
}
function head(t: string): HTMLElement { const h = document.createElement("h3"); h.textContent = t; return h; }

export function buildLegend(root: HTMLElement): void {
  if (root.dataset.built) return;
  root.dataset.built = "1";
  root.append(head("Pins"));
  PIN_SAMPLES.forEach((s, i) => root.append(row(pinCanvas(s.p, !!s.alert), s.label, `pin${i}`)));
  const own = document.createElement("p");
  own.className = "tags";
  own.textContent = "The small pennant on each stem is the colony's own flag. Stem height: short L1–4 · medium L5–9 · tall L10+.";
  root.append(own);
  root.append(head("Needs tree"));
  for (const [k, st] of Object.entries(NEED_STYLE)) {
    const sw = document.createElement("span");
    sw.className = "legend-need";
    sw.style.background = st.fill; sw.style.color = st.text;
    sw.style.border = `${Math.max(1, Math.round(st.width))}px ${st.dash ? "dashed" : "solid"} ${st.stroke}`;
    sw.textContent = `${st.icon} Node`;
    root.append(row(sw, st.label, `need-${k}`));
  }
  root.append(head("Routes"));
  root.append(row(routeSwatch("regional", NODE_COLORS.Water || "#38bdf8"), "Arc across the surface = regional trade (same body); arrow = direction, two arrows = two-way", "route-regional"));
  root.append(row(routeSwatch("outer", NODE_COLORS.Oxygen || "#22d3ee"), "Line into space = outer trade (Earth↔Moon, Moon↔Mars, Mars↔Belt); framed flag = trade partner, frame = resource colour", "route-outer"));
  root.append(row(routeSwatch("grouped", NODE_COLORS.Food || "#f59e0b"), "Number badge = several outer routes from one colony to the same body, grouped (hover for each partner)", "route-grouped"));
  const n = document.createElement("p");
  n.className = "tags";
  n.textContent = "Partner flags hide when they would overlap an earlier label and fade when they would cover a pin. Line colour = traded resource.";
  root.append(n);
}
