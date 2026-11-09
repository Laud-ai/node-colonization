/**
 * 0.15.3 — Globe occlusion for billboards (pure math, no three.js; unit-tested).
 * Pin heads, pin flags and route flags are sprites drawn WITHOUT a depth test (a flat billboard near
 * the limb would otherwise be cut by the sphere = "clipping through the body"). Instead each sprite's
 * anchor is ray-tested against the body: hidden when the body is in front of it, faded near the
 * horizon, fully visible otherwise.
 */
export interface V3 { x: number; y: number; z: number }

/** 0 = hidden behind the body, 1 = clear; fades to `minFade` as the anchor nears the horizon. */
export function limbVisibility(cam: V3, p: V3, radius = 1, fadeBelow = 0.18, minFade = 0.35): number {
  const dx = p.x - cam.x, dy = p.y - cam.y, dz = p.z - cam.z;
  const L = Math.hypot(dx, dy, dz);
  if (L < 1e-9) return 1;
  const ux = dx / L, uy = dy / L, uz = dz / L;
  const b = ux * cam.x + uy * cam.y + uz * cam.z;
  const c = cam.x * cam.x + cam.y * cam.y + cam.z * cam.z - radius * radius;
  const disc = b * b - c;
  if (disc > 0) {
    const t0 = -b - Math.sqrt(disc);
    if (t0 > 0 && t0 < L - 1e-3) return 0; // the body sits between camera and anchor
  }
  // Elevation of the line of sight above the local horizon at the anchor.
  const pl = Math.hypot(p.x, p.y, p.z) || 1;
  const e = (-(ux * p.x + uy * p.y + uz * p.z)) / pl; // cos(angle between normal and direction to camera)
  if (e >= fadeBelow) return 1;
  return Math.max(minFade, minFade + ((1 - minFade) * Math.max(0, e)) / fadeBelow);
}
