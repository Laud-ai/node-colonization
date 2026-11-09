/**
 * 0.13.1 — Pin marker head (Tiago's design): bloc-colored head (Independent = white
 * with black outline), bold level number, fervor ring toward the independence
 * threshold (green → amber → red), specialty badge, alert overlays.
 * Pure Canvas2D; no game state.
 */
import { NODE_COLORS } from "../nodes.js";
import type { NodeType } from "../types.js";

export interface PinStyle {
  level: number; color: string; independent: boolean;
  /** 0..1 of the independence threshold; null = no ring (Independents). */
  fervor: number | null;
  specialty: NodeType;
  selected?: boolean;
  /** Crossed swords: invasion / proxy war involvement. */
  war?: boolean;
  /** Dashed outline: founded this turn. */
  fresh?: boolean;
}

/** Short specialty codes for the badge (legend in the Rules tab / tooltip). */
export const SPECIALTY_CODE: Record<NodeType, string> = {
  Resources: "Rs", Infrastructure: "In", Water: "H₂O", Oxygen: "O₂", Food: "Fd", Energy: "En",
  Population: "Pp", Culture: "Cu", Ideology: "Id", Money: "$", Logistics: "Lg", Science: "Sc",
  Production: "Pr", Military: "Mil", Stability: "St", Subversion: "Sv", Terraforming: "TF",
  Thrust: "Th", Projects: "Pj",
};

export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6);
  const n = parseInt(f, 16);
  if (Number.isNaN(n)) return 0.5;
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

/** Halo/outline that contrasts with the fill (dark fills get a light halo on the grey Moon). */
export function haloFor(color: string): string {
  return luminance(color) < 0.18 ? "#f1f5f9" : "#0b1020";
}

/** Fervor ring color: green → amber → red as it nears the threshold. */
export function fervorColor(f: number): string {
  if (f >= 0.8) return "#ef4444";
  if (f >= 0.5) return "#f59e0b";
  return "#22c55e";
}

export function drawPinHead(ctx: CanvasRenderingContext2D, size: number, p: PinStyle): void {
  const c = size / 2;
  const R = size * 0.27; // head radius
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  const fill = p.independent ? "#ffffff" : p.color;
  const outline = p.independent ? "#000000" : haloFor(p.color);

  // Fervor ring track + fill (clockwise from 12 o'clock)
  const ringR = R + size * 0.075;
  if (p.fervor !== null) {
    ctx.lineWidth = size * 0.055;
    ctx.strokeStyle = "rgba(10,14,24,0.75)";
    ctx.beginPath(); ctx.arc(c, c, ringR, 0, Math.PI * 2); ctx.stroke();
    const f = Math.max(0, Math.min(1, p.fervor));
    if (f > 0) {
      ctx.strokeStyle = fervorColor(f);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(c, c, ringR, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
    }
  }

  // Halo for readability on light/dark ground
  ctx.shadowColor = outline === "#f1f5f9" ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)";
  ctx.shadowBlur = size * 0.05;
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // Outline: dashed when founded this turn
  ctx.lineWidth = size * (p.selected ? 0.045 : 0.03);
  ctx.strokeStyle = p.selected ? "#2ee9f0" : outline;
  if (p.fresh) ctx.setLineDash([size * 0.05, size * 0.035]);
  ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  // Level number
  const text = String(p.level);
  ctx.fillStyle = p.independent ? "#000" : luminance(fill) > 0.35 ? "#0b1020" : "#ffffff";
  ctx.font = `800 ${Math.round(R * (text.length > 1 ? 1.05 : 1.3))}px system-ui, "Segoe UI", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, c, c + R * 0.06);

  // Specialty badge (top-right)
  const br = size * 0.115, bx = c + R * 0.92, by = c - R * 0.92;
  ctx.fillStyle = NODE_COLORS[p.specialty] || "#94a3b8";
  ctx.strokeStyle = "#0b1020"; ctx.lineWidth = size * 0.018;
  ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const code = SPECIALTY_CODE[p.specialty] || "?";
  ctx.fillStyle = luminance(ctx.fillStyle as string) > 0.35 ? "#0b1020" : "#fff";
  ctx.font = `700 ${Math.round(br * (code.length > 2 ? 0.8 : 1.05))}px system-ui, sans-serif`;
  ctx.fillText(code, bx, by + br * 0.06);

  // Crossed swords (bottom-left)
  if (p.war) {
    const sx = c - R * 0.95, sy = c + R * 0.95, sr = size * 0.1;
    ctx.fillStyle = "#7f1d1d"; ctx.strokeStyle = "#fff"; ctx.lineWidth = size * 0.014;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = size * 0.022; ctx.lineCap = "round"; ctx.strokeStyle = "#fde68a";
    const d = sr * 0.6;
    ctx.beginPath(); ctx.moveTo(sx - d, sy - d); ctx.lineTo(sx + d, sy + d); ctx.moveTo(sx + d, sy - d); ctx.lineTo(sx - d, sy + d); ctx.stroke();
    ctx.lineWidth = size * 0.016;
    ctx.beginPath(); ctx.moveTo(sx - d * 0.2, sy + d * 0.6); ctx.lineTo(sx - d * 0.8, sy); ctx.moveTo(sx + d * 0.2, sy + d * 0.6); ctx.lineTo(sx + d * 0.8, sy); ctx.stroke();
  }
  ctx.restore();
}

/** Alert ring (pulsed by the globe via opacity/scale). */
export function drawAlertRing(ctx: CanvasRenderingContext2D, size: number): void {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.lineWidth = size * 0.05;
  ctx.strokeStyle = "#ff3b3b";
  ctx.shadowColor = "#ff3b3b"; ctx.shadowBlur = size * 0.06;
  ctx.beginPath(); ctx.arc(c, c, size * 0.43, 0, Math.PI * 2); ctx.stroke();
}

/** Stem height (world units above the surface) by tier: L1–4 short, L5–9 medium, L10+ tall. */
export function stemHeight(level: number): number {
  return level >= 10 ? 0.16 : level >= 5 ? 0.1 : 0.055;
}
