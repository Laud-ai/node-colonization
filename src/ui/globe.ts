/**
 * 0.13.0 — 3D Moon / Mars globes as the live solar-side view.
 * Rendering approach + HUD glyphs reused from the Sep 1 Moon Globe (fully lit
 * MeshBasicMaterial mosaic, canvas-drawn HUD decals on the sphere).
 * Read-only: receives plain marker data from the UI; never touches sim state.
 * Loaded lazily (dynamic import) so three.js + textures only load when playing.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clampLevel, drawHudIcon, worldPlaneSize } from "./hudIcon.js";
import { drawAlertRing, drawPinHead, stemHeight } from "./pinIcon.js";
import type { NodeType } from "../types.js";
import moonUrl from "./textures/moon.jpg?url";
import marsUrl from "./textures/mars.jpg?url";

export type GlobeBody = "Moon" | "Mars";
export type MarkerStyle = "pin" | "glyph";
export interface GlobeMarker {
  id: string; lat: number; lon: number; level: number; color: string;
  /** Plain-text tooltip lines (first = title). */
  info: string[];
  /** 0.13.1 pin fields. */
  independent: boolean; fervor: number | null; specialty: NodeType;
  alert: boolean; war: boolean; fresh: boolean;
}

const RADIUS = 1;
const DECAL_OFFSET = 0.006;
const HUD_CANVAS = 128;
/** Game view is smaller on screen than the Sep 1 globe; enlarge glyphs a bit. */
const MARKER_SCALE = 1.5;
const OUT = new THREE.Vector3(0, 0, 1);
const TEXTURES: Record<GlobeBody, string> = { Moon: moonUrl, Mars: marsUrl };

/** Equirectangular maps centered on 0° lon; SphereGeometry puts texture center at +X. */
function latLonToVector3(lat: number, lon: number, r: number, t = new THREE.Vector3()): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(lon + 180);
  const theta = THREE.MathUtils.degToRad(90 - lat);
  const s = Math.sin(theta);
  return t.set(-Math.cos(phi) * s * r, Math.cos(theta) * r, Math.sin(phi) * s * r);
}

export interface GlobeRoute {
  id: string; kind: "regional" | "outer"; color: string;
  /** regional: a = source, b = destination. outer: a = this colony's site. */
  a: { lat: number; lon: number }; b?: { lat: number; lon: number };
  twoWay: boolean;
  /** outer only */
  inbound?: boolean; otherBody?: string; flagSvg?: string; label?: string; fanIndex?: number;
}

interface Pin {
  m: GlobeMarker; root: THREE.Group; pickables: THREE.Object3D[]; key: string;
  textures: THREE.Texture[]; materials: THREE.Material[]; geos: THREE.BufferGeometry[];
  alert?: THREE.Sprite;
}
const PIN_HEAD_PX = 128;
const PIN_SCALE = 0.095;

const views = new Set<GlobeView>();
let raf = 0;
function loop(): void {
  raf = requestAnimationFrame(loop);
  for (const v of views) v.frame();
}

export class GlobeView {
  readonly el: HTMLElement;
  private canvas = document.createElement("canvas");
  private tip = document.createElement("div");
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.05, 400);
  private controls: OrbitControls;
  private group = new THREE.Group();
  private sphere: THREE.Mesh;
  private pins = new Map<string, Pin>();
  private geo = new THREE.PlaneGeometry(1, 1);
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private selectedId: string | null = null;
  private hoverId: string | null = null;
  private down = { x: 0, y: 0 };
  private textureRequested = false;
  /** Until the player drags/zooms, keep the camera aimed at the colonies. */
  private userMoved = false;

  constructor(el: HTMLElement, readonly body: GlobeBody, private onSelect: (id: string) => void) {
    this.el = el;
    el.classList.add("globe-view");
    el.dataset.body = body;
    el.dataset.markers = "0";
    this.canvas.className = "globe-canvas";
    this.tip.className = "globe-tip";
    this.tip.hidden = true;
    const label = document.createElement("div");
    label.className = "globe-label";
    label.textContent = body.toUpperCase();
    el.append(this.canvas, label, this.tip);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(0x05070d, 1);

    this.camera.position.copy(body === "Moon" ? new THREE.Vector3(0, -1.35, 2.55) : new THREE.Vector3(0, 0.25, 2.9));
    this.controls = new OrbitControls(this.camera, this.canvas);
    Object.assign(this.controls, {
      enablePan: false, enableDamping: true, dampingFactor: 0.08, rotateSpeed: 0.55, zoomSpeed: 0.85,
      minDistance: 1.25, maxDistance: 6, minPolarAngle: 0.04, maxPolarAngle: Math.PI - 0.04,
    });

    // Near side (0° lon) faces the camera.
    this.group.rotation.y = -Math.PI / 2;
    this.scene.add(this.group, makeStars(1600));
    this.sphere = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS, 96, 64),
      new THREE.MeshBasicMaterial({ color: body === "Moon" ? 0x8a8a8a : 0x8a4a32 }),
    );
    this.group.add(this.sphere);

    this.controls.addEventListener("start", () => { this.userMoved = true; });
    this.canvas.addEventListener("pointerdown", (e) => { this.down = { x: e.clientX, y: e.clientY }; });
    this.canvas.addEventListener("pointerup", (e) => {
      if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5) return;
      const id = this.pick(e);
      if (id) this.onSelect(id);
    });
    this.canvas.addEventListener("pointermove", (e) => this.hover(e));
    this.canvas.addEventListener("pointerleave", () => { this.hoverId = null; this.tip.hidden = true; this.canvas.style.cursor = ""; });

    views.add(this);
    if (!raf) raf = requestAnimationFrame(loop);
  }

  /** Lazy texture load: only once the view is first shown. */
  private ensureTexture(): void {
    if (this.textureRequested) return;
    this.textureRequested = true;
    new THREE.TextureLoader().load(TEXTURES[this.body], (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      const mat = this.sphere.material as THREE.MeshBasicMaterial;
      mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true;
      this.el.dataset.texture = "loaded";
    }, undefined, () => { this.el.dataset.texture = "failed"; });
  }

  private routeRoot = new THREE.Group();
  private routeKey = "";
  private routeDisposables: { dispose(): void }[] = [];

  /** 0.14.1 trade routes: regional arcs across the surface, outer lines into space with a flag label. */
  setRoutes(routes: GlobeRoute[], visible: boolean): void {
    this.routeRoot.visible = visible;
    if (!this.routeRoot.parent) this.group.add(this.routeRoot);
    const key = JSON.stringify(routes);
    if (key === this.routeKey) return;
    this.routeKey = key;
    this.routeDisposables.forEach((d) => d.dispose());
    this.routeDisposables = [];
    this.routeRoot.clear();
    const coneGeo = new THREE.ConeGeometry(0.013, 0.038, 10);
    this.routeDisposables.push(coneGeo);
    const UP = new THREE.Vector3(0, 1, 0);
    const cone = (mat: THREE.Material, at: THREE.Vector3, dir: THREE.Vector3) => {
      const c = new THREE.Mesh(coneGeo, mat);
      c.position.copy(at);
      c.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
      this.routeRoot.add(c);
    };
    for (const r of routes) {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(r.color) });
      this.routeDisposables.push(mat);
      if (r.kind === "regional" && r.b) {
        const va = latLonToVector3(r.a.lat, r.a.lon, 1).normalize();
        const vb = latLonToVector3(r.b.lat, r.b.lon, 1).normalize();
        const ang = va.angleTo(vb);
        const lift = 0.025 + 0.12 * (ang / Math.PI);
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 32; i++) {
          const t = i / 32;
          const v = new THREE.Vector3().copy(va).lerp(vb, t);
          if (v.lengthSq() < 1e-6) v.set(0, 1, 0);
          v.normalize().multiplyScalar(RADIUS + DECAL_OFFSET + lift * Math.sin(Math.PI * t));
          pts.push(v);
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const geo = new THREE.TubeGeometry(curve, 48, 0.0035, 6, false);
        this.routeDisposables.push(geo);
        this.routeRoot.add(new THREE.Mesh(geo, mat));
        cone(mat, curve.getPointAt(0.88), curve.getTangentAt(0.88));
        if (r.twoWay) cone(mat, curve.getPointAt(0.12), curve.getTangentAt(0.12).negate());
      } else {
        const n = latLonToVector3(r.a.lat, r.a.lon, 1).normalize();
        let t1 = new THREE.Vector3().crossVectors(n, UP);
        if (t1.lengthSq() < 1e-4) t1 = new THREE.Vector3(1, 0, 0);
        t1.normalize().applyAxisAngle(n, (r.fanIndex || 0) * 1.25);
        const dir = n.clone().add(t1.multiplyScalar(0.45)).normalize();
        const start = n.clone().multiplyScalar(RADIUS + DECAL_OFFSET);
        const end = start.clone().add(dir.clone().multiplyScalar(0.42));
        const geo = new THREE.TubeGeometry(new THREE.LineCurve3(start, end), 4, 0.0035, 6, false);
        this.routeDisposables.push(geo);
        this.routeRoot.add(new THREE.Mesh(geo, mat));
        if (r.inbound || r.twoWay) cone(mat, start.clone().add(dir.clone().multiplyScalar(0.06)), dir.clone().negate());
        if (!r.inbound || r.twoWay) cone(mat, end.clone(), dir);
        // Flag + label at the far end
        const cw = 256, ch = 80;
        const canvas = document.createElement("canvas");
        canvas.width = cw; canvas.height = ch;
        const ctx = canvas.getContext("2d")!;
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        const paint = (img?: HTMLImageElement) => {
          ctx.clearRect(0, 0, cw, ch);
          ctx.fillStyle = "rgba(8,12,22,0.85)";
          ctx.strokeStyle = r.color; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.roundRect(2, 2, cw - 4, ch - 4, 10); ctx.fill(); ctx.stroke();
          if (img) ctx.drawImage(img, 10, 14, 72, 48);
          ctx.fillStyle = "#e8eefc"; ctx.font = "700 22px system-ui, sans-serif"; ctx.textBaseline = "top";
          ctx.fillText(`${r.inbound ? "←" : "→"} ${r.otherBody ?? ""}`, 92, 12);
          ctx.font = "16px system-ui, sans-serif"; ctx.fillStyle = "#cbd5e1";
          ctx.fillText((r.label ?? "").slice(0, 22), 92, 44);
          tex.needsUpdate = true;
        };
        paint();
        if (r.flagSvg) {
          const img = new Image();
          img.onload = () => paint(img);
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(r.flagSvg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '));
        }
        const smat = new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthWrite: false, transparent: true });
        const sprite = new THREE.Sprite(smat);
        sprite.position.copy(end.clone().add(dir.clone().multiplyScalar(0.05)));
        sprite.scale.set(0.2, 0.0625, 1);
        sprite.renderOrder = 5;
        this.routeRoot.add(sprite);
        this.routeDisposables.push(tex, smat);
      }
    }
    this.el.dataset.routes = String(routes.length);
  }

  private style: MarkerStyle = "pin";
  setStyle(style: MarkerStyle): void {
    if (style === this.style) return;
    this.style = style;
    for (const [id, p] of [...this.pins]) this.dispose(p, id);
    this.update(this.lastMarkers, this.selectedId);
  }
  private lastMarkers: GlobeMarker[] = [];

  update(markers: GlobeMarker[], selectedId: string | null): void {
    this.lastMarkers = markers;
    this.selectedId = selectedId;
    const live = new Set(markers.map((m) => m.id));
    for (const [id, p] of [...this.pins]) if (!live.has(id)) this.dispose(p, id);
    for (const m of markers) {
      const sel = m.id === selectedId;
      const key = [this.style, clampLevel(m.level), m.color, sel, m.independent, m.fervor === null ? "-" : Math.round(m.fervor * 20),
        m.specialty, m.alert, m.war, m.fresh, m.lat.toFixed(3), m.lon.toFixed(3)].join("|");
      const old = this.pins.get(m.id);
      if (old && old.key === key) { old.m = m; continue; }
      if (old) this.dispose(old, m.id);
      const p = this.style === "pin" ? this.buildPin(m, sel) : this.buildGlyph(m, sel);
      p.key = key;
      for (const o of p.pickables) o.userData.id = m.id;
      this.group.add(p.root);
      this.pins.set(m.id, p);
    }
    this.el.dataset.markers = String(this.pins.size);
    if (!this.userMoved && this.pins.size) this.aimAtColonies();
  }

  /** Face the hemisphere that shows the most colonies (direction among marker sites). */
  private aimAtColonies(): void {
    this.group.updateMatrixWorld();
    const dirs = [...this.pins.values()].map((p) => p.pickables[0]!.getWorldPosition(new THREE.Vector3()).normalize());
    let best = dirs[0]!, bestScore = -1;
    for (const d of dirs) {
      const near = dirs.filter((o) => o.dot(d) > 0.55);
      const c = near.reduce((a, o) => a.add(o), new THREE.Vector3()).normalize();
      const score = dirs.reduce((a, o) => a + Math.max(0, o.dot(c) - 0.3), 0);
      if (score > bestScore) { bestScore = score; best = c; }
    }
    // Slight tilt toward the equator so polar sites are not edge-on.
    const flat = new THREE.Vector3(best.x, 0, best.z);
    const dir = flat.lengthSq() > 1e-4 ? best.clone().lerp(flat.normalize(), 0.25).normalize() : best.clone();
    this.camera.position.copy(dir.multiplyScalar(this.camera.position.length()));
    this.controls.update();
  }

  private canvasTex(size: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) draw(ctx);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildGlyph(m: GlobeMarker, sel: boolean): Pin {
    const tex = this.canvasTex(HUD_CANVAS, (ctx) => drawHudIcon(ctx, HUD_CANVAS, m.level, m.color, { selected: sel, fit: true }));
    tex.premultiplyAlpha = true;
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, premultipliedAlpha: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false,
    });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.renderOrder = 2;
    const pos = latLonToVector3(m.lat, m.lon, RADIUS + DECAL_OFFSET);
    mesh.position.copy(pos);
    mesh.quaternion.setFromUnitVectors(OUT, pos.clone().normalize());
    const s = worldPlaneSize(m.level) * MARKER_SCALE * (sel ? 1.15 : 1);
    mesh.scale.set(s, s, 1);
    const root = new THREE.Group();
    root.add(mesh);
    return { m, root, pickables: [mesh], key: "", textures: [tex], materials: [mat], geos: [] };
  }

  private buildPin(m: GlobeMarker, sel: boolean): Pin {
    const root = new THREE.Group();
    const base = latLonToVector3(m.lat, m.lon, RADIUS);
    const n = base.clone().normalize();
    const tip = n.clone().multiplyScalar(RADIUS + stemHeight(m.level));
    // Stem: thin cylinder (WebGL lines are 1px), with a dark sleeve for contrast on the bright Moon
    const h = stemHeight(m.level);
    const stemGeo = new THREE.CylinderGeometry(0.0032, 0.0032, h, 6, 1, true);
    const sleeveGeo = new THREE.CylinderGeometry(0.0055, 0.0055, h, 6, 1, true);
    const stemMat = new THREE.MeshBasicMaterial({ color: m.independent ? 0xffffff : new THREE.Color(m.color) });
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x05070d, transparent: true, opacity: 0.55, depthWrite: false });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    const shadow = new THREE.Mesh(sleeveGeo, shadowMat);
    for (const o of [stem, shadow]) {
      o.position.copy(n.clone().multiplyScalar(RADIUS + h / 2));
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    }
    shadow.renderOrder = 1; stem.renderOrder = 2;
    const footGeo = new THREE.CircleGeometry(0.008, 12);
    const footMat = new THREE.MeshBasicMaterial({ color: 0x05070d, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.copy(n.clone().multiplyScalar(RADIUS + DECAL_OFFSET));
    foot.quaternion.setFromUnitVectors(OUT, n);
    const tex = this.canvasTex(PIN_HEAD_PX, (ctx) => drawPinHead(ctx, PIN_HEAD_PX, {
      level: m.level, color: m.color, independent: m.independent, fervor: m.fervor,
      specialty: m.specialty, selected: sel, war: m.war, fresh: m.fresh,
    }));
    const headMat = new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthWrite: false, transparent: true });
    const head = new THREE.Sprite(headMat);
    head.position.copy(tip);
    const sc = PIN_SCALE * (sel ? 1.2 : 1);
    head.scale.set(sc, sc, 1);
    head.renderOrder = 4;
    root.add(shadow, stem, foot, head);
    const pin: Pin = { m, root, pickables: [head], key: "", textures: [tex], materials: [stemMat, shadowMat, footMat, headMat], geos: [stemGeo, sleeveGeo, footGeo] };
    if (m.alert) {
      const atex = this.canvasTex(PIN_HEAD_PX, (ctx) => drawAlertRing(ctx, PIN_HEAD_PX));
      const amat = new THREE.SpriteMaterial({ map: atex, sizeAttenuation: false, depthWrite: false, transparent: true });
      const ring = new THREE.Sprite(amat);
      ring.position.copy(tip);
      ring.scale.set(sc * 0.78, sc * 0.78, 1);
      ring.renderOrder = 3;
      root.add(ring);
      pin.alert = ring;
      pin.textures.push(atex); pin.materials.push(amat);
    }
    return pin;
  }

  /** Turn the camera toward a marker, keeping distance. Returns false if not on this body. */
  focus(id: string): boolean {
    const p = this.pins.get(id);
    if (!p) return false;
    const w = p.pickables[0]!.getWorldPosition(new THREE.Vector3()).normalize();
    this.camera.position.copy(w.multiplyScalar(this.camera.position.length()));
    this.controls.update();
    return true;
  }

  private pick(e: PointerEvent): string | null {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hits = this.ray.intersectObjects([this.sphere, ...[...this.pins.values()].flatMap((p) => p.pickables)], false);
    for (const h of hits) {
      if (h.object === this.sphere) break; // marker behind the globe
      const id = h.object.userData.id as string | undefined;
      if (id) return id;
    }
    return null;
  }

  private hover(e: PointerEvent): void {
    const id = this.pick(e);
    this.canvas.style.cursor = id ? "pointer" : "";
    if (!id) { this.hoverId = null; this.tip.hidden = true; return; }
    const p = this.pins.get(id)!;
    if (this.hoverId !== id) {
      this.hoverId = id;
      this.tip.innerHTML = "";
      p.m.info.forEach((line, i) => {
        const d = document.createElement("div");
        d.textContent = line;
        if (i === 0) { d.className = "globe-tip-title"; d.style.borderLeftColor = p.m.color; }
        this.tip.append(d);
      });
    }
    const r = this.el.getBoundingClientRect();
    this.tip.style.left = `${Math.min(e.clientX - r.left + 14, r.width - 200)}px`;
    this.tip.style.top = `${e.clientY - r.top + 12}px`;
    this.tip.hidden = false;
  }

  frame(): void {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return; // hidden view: skip render
    this.ensureTexture();
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      // Narrow (side-by-side) views: widen vertical FOV so the whole globe fits horizontally.
      const half = THREE.MathUtils.degToRad(20);
      this.camera.fov = w >= h ? 40 : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) / (w / h)));
      this.camera.updateProjectionMatrix();
    }
    this.controls.update();
    const t = performance.now() / 1000;
    for (const p of this.pins.values()) {
      if (p.alert) (p.alert.material as THREE.SpriteMaterial).opacity = 0.25 + 0.75 * Math.abs(Math.sin(t * 2.6));
    }
    this.renderer.render(this.scene, this.camera);
  }

  private dispose(p: Pin, id: string): void {
    this.group.remove(p.root);
    p.textures.forEach((t) => t.dispose());
    p.materials.forEach((m) => m.dispose());
    p.geos.forEach((g) => g.dispose());
    this.pins.delete(id);
  }
}

function makeStars(count: number): THREE.Points {
  // Fixed-pattern starfield (cosmetic; own tiny LCG, never the sim RNG).
  let s = 1234567;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const th = 2 * Math.PI * rnd(), ph = Math.acos(2 * rnd() - 1), r = 90;
    pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.35, color: 0xcfd6e6, transparent: true, opacity: 0.8, depthWrite: false }));
}
