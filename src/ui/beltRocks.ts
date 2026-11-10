/**
 * 0.20.0 — named asteroids of the belt view (pure data; no three.js).
 * Sizes are exaggerated for play (Ceres ≈ 940 km, Eros ≈ 17 km in reality). `weight` biases colony siting.
 * Ceres and Vesta are textured with NASA Dawn maps; the rest are procedural shaded rocks.
 */
export interface BeltRockDef {
  name: string; r: number; angle: number; y: number;
  /** ellipsoid scale (x, y, z) */
  shape: [number, number, number];
  color: string; textured: boolean; weight: number;
}
export const BELT_RING_RADIUS = 3.0;
export const BELT_ROCKS: BeltRockDef[] = [
  { name: "Ceres", r: 0.42, angle: 0, y: 0, shape: [1, 0.93, 1], color: "#8d8a86", textured: true, weight: 5 },
  { name: "Vesta", r: 0.32, angle: 33, y: 0.06, shape: [1, 0.82, 1.04], color: "#9a948a", textured: true, weight: 4 },
  { name: "Pallas", r: 0.3, angle: 62, y: -0.08, shape: [1.05, 0.92, 1], color: "#7f8389", textured: false, weight: 3 },
  { name: "Hygiea", r: 0.27, angle: 95, y: 0.05, shape: [1, 0.96, 0.98], color: "#5f5c58", textured: false, weight: 2 },
  { name: "Psyche", r: 0.22, angle: 128, y: -0.04, shape: [1.3, 0.8, 1], color: "#9b8f7a", textured: false, weight: 3 },
  { name: "Juno", r: 0.2, angle: 160, y: 0.09, shape: [1.15, 0.85, 0.95], color: "#8a7a68", textured: false, weight: 2 },
  { name: "Interamnia", r: 0.21, angle: 192, y: -0.06, shape: [1, 0.9, 1.05], color: "#626066", textured: false, weight: 1 },
  { name: "Davida", r: 0.19, angle: 222, y: 0.03, shape: [1.2, 0.9, 0.9], color: "#6c6a65", textured: false, weight: 1 },
  { name: "Europa", r: 0.18, angle: 252, y: -0.1, shape: [1.1, 0.85, 1], color: "#706c66", textured: false, weight: 1 },
  { name: "Sylvia", r: 0.18, angle: 282, y: 0.07, shape: [1.3, 0.85, 0.85], color: "#5d5f63", textured: false, weight: 1 },
  { name: "Eunomia", r: 0.17, angle: 308, y: -0.03, shape: [1.35, 0.8, 0.85], color: "#a08f78", textured: false, weight: 1 },
  { name: "Eros", r: 0.13, angle: 336, y: 0.05, shape: [2.1, 0.8, 0.8], color: "#9c8468", textured: false, weight: 1 },
];
export function rockByName(name: string | undefined): BeltRockDef | undefined {
  return BELT_ROCKS.find((r) => r.name === name);
}
