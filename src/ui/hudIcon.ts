/** HUD marker glyphs: L1–L20, drawn in the marker's color. */
import { luminance } from "./pinIcon.js";

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 20;
export const DEFAULT_COLOR = "#2EE9F0";

/** 10 o'clock in Canvas2D (angles clockwise from 3 o'clock). */
const ORIGIN = (-150 * Math.PI) / 180;

const INNER_NORM = 1;
const L1_NORM = 0.52;
const L2_NORM = 0.76;
const RING_GAP = 0.12;
const RING_WIDTH = 0.14;

export function clampLevel(n: number): number {
  if (!Number.isFinite(n)) return MIN_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(n)));
}

/** Ring fill flags after L10. `false` = empty stroke, `true` = solid band. */
export function ringFills(level: number): boolean[] {
  const lv = clampLevel(level);
  if (lv < 10) return [];
  const rings: boolean[] = [false];
  for (let n = 11; n <= lv; n++) {
    if (n % 2 === 1) rings[rings.length - 1] = true;
    else rings.push(false);
  }
  return rings;
}

/** Outermost radius in normalized units (L5 inner disc = 1). */
export function iconOuterNorm(level: number): number {
  const lv = clampLevel(level);
  if (lv <= 1) return L1_NORM;
  if (lv <= 4) return L2_NORM;
  return INNER_NORM + ringFills(lv).length * (RING_GAP + RING_WIDTH);
}

/** World-space plane width so L1 is small, L2–L4 medium, L5+ larger. */
export function worldPlaneSize(level: number): number {
  return 0.09 * iconOuterNorm(level);
}

export function drawHudIcon(
  ctx: CanvasRenderingContext2D,
  size: number,
  level: number,
  color: string,
  options: { selected?: boolean; fit?: boolean } = {},
): void {
  const lv = clampLevel(level);
  const selected = options.selected ?? false;
  const fit = options.fit ?? true;
  const ink = color.trim() || DEFAULT_COLOR;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const outer = iconOuterNorm(lv);
  const pad = size * 0.14;
  const maxR = size / 2 - pad;
  const unit = fit ? maxR / outer : maxR / iconOuterNorm(MAX_LEVEL);
  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(1.15, unit * 0.03);
  const glow = (selected ? size * 0.09 : size * 0.048) * (luminance(ink) < 0.18 ? 1.6 : 1);

  // 0.13.1: dark inks get a light halo so they read on the grey Moon
  ctx.shadowColor = luminance(ink) < 0.18 ? "rgba(241,245,249,0.95)" : toRgba(ink, selected ? 0.95 : 0.72);
  ctx.shadowBlur = glow;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;

  if (lv <= 1) {
    const r = L1_NORM * unit;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (lv <= 4) {
    drawWedgeDisc(ctx, cx, cy, L2_NORM * unit, 3, lv - 1, ink, stroke);
  } else if (lv <= 9) {
    drawWedgeDisc(ctx, cx, cy, INNER_NORM * unit, 6, lv - 4, ink, stroke);
  } else {
    const innerR = INNER_NORM * unit;
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fill();

    let r = innerR;
    for (const filled of ringFills(lv)) {
      r += RING_GAP * unit;
      const innerBand = r;
      const outerBand = r + RING_WIDTH * unit;
      if (filled) {
        ctx.beginPath();
        ctx.arc(cx, cy, outerBand, 0, Math.PI * 2, false);
        ctx.arc(cx, cy, innerBand, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fill("evenodd");
      } else {
        const mid = (innerBand + outerBand) / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, mid, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1.2, RING_WIDTH * unit * 0.38);
        ctx.stroke();
      }
      r = outerBand;
    }
  }

  if (selected) {
    ctx.shadowBlur = glow * 1.35;
    ctx.beginPath();
    ctx.arc(cx, cy, outer * unit + stroke * 2.2, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1.1, stroke * 0.7);
    ctx.strokeStyle = toRgba(ink, 0.55);
    ctx.stroke();
  }

  ctx.restore();
}

function drawWedgeDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  wedges: number,
  filled: number,
  color: string,
  lineWidth: number,
): void {
  const step = (Math.PI * 2) / wedges;
  if (filled >= wedges) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    return;
  }

  if (filled > 0) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, ORIGIN, ORIGIN + filled * step, false);
    ctx.closePath();
    ctx.fill();
  }

  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < wedges; i++) {
    const a = ORIGIN + i * step;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
}

function toRgba(color: string, alpha: number): string {
  const c = color.trim();
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3) {
      h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    }
    if (h.length >= 6) {
      const n = parseInt(h.slice(0, 6), 16);
      if (!Number.isNaN(n)) {
        return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
      }
    }
  }
  const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return `rgba(${m[1]},${m[2]},${m[3]},${alpha})`;
  return c;
}
