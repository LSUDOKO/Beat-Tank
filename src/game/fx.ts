/** Pooled VFX: particles (sparks/confetti/fireworks), shock rings, paint splats, word pops, lasers, snow. */
import * as THREE from 'three';

export const NEON = ['#ff3ec8', '#3ee6ff', '#ffc83d', '#7cff6b', '#ff6b3d', '#a46bff'].map((c) => new THREE.Color(c));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// ───────────────────────── particles ─────────────────────────
const MAX_P = 6000;
export class Particles {
  points: THREE.Points;
  private pos = new Float32Array(MAX_P * 3);
  private col = new Float32Array(MAX_P * 3);
  private size = new Float32Array(MAX_P);
  private vel = new Float32Array(MAX_P * 3);
  private life = new Float32Array(MAX_P);
  private maxLife = new Float32Array(MAX_P);
  private grav = new Float32Array(MAX_P);
  private baseSize = new Float32Array(MAX_P);
  private head = 0;
  constructor(scene: THREE.Scene) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      uniforms: { uScale: { value: 300 } },
      vertexShader: `attribute float size; varying vec3 vC; uniform float uScale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if(d>0.5) discard; gl_FragColor = vec4(vC * 2.2, smoothstep(0.5, 0.0, d)); }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  emit(p: THREE.Vector3, v: THREE.Vector3, c: THREE.Color, size: number, life: number, grav = 9) {
    const i = this.head; this.head = (this.head + 1) % MAX_P;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3); this.col.set([c.r, c.g, c.b], i * 3);
    this.baseSize[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav;
  }
  burst(p: THREE.Vector3, n: number, speed: number, opts: { colors?: THREE.Color[]; size?: number; life?: number; grav?: number; up?: number } = {}) {
    const v = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.3, 1));
      v.y += opts.up ?? 0;
      const cs = opts.colors ?? NEON;
      this.emit(p, v, cs[(Math.random() * cs.length) | 0], (opts.size ?? 0.35) * rand(0.6, 1.3), (opts.life ?? 1) * rand(0.6, 1.2), opts.grav ?? 9);
    }
  }
  update(dt: number) {
    for (let i = 0; i < MAX_P; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const j = i * 3;
      this.vel[j + 1] -= this.grav[i] * dt;
      this.vel[j] *= 0.985; this.vel[j + 2] *= 0.985;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.pos[j + 1] < 0.05) { this.pos[j + 1] = 0.05; this.vel[j + 1] *= -0.3; }
      this.size[i] = this.baseSize[i] * Math.min(1, (this.life[i] / this.maxLife[i]) * 2.5);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.color.needsUpdate = true;
  }
  clear() { this.life.fill(0); }
}

// ───────────────────────── rings ─────────────────────────
interface Ring { mesh: THREE.Mesh; t: number; dur: number; r0: number; r1: number; active: boolean }
export class Rings {
  private pool: Ring[] = [];
  constructor(private scene: THREE.Scene) {}
  spawn(p: THREE.Vector3, color: THREE.Color | string, r1: number, dur: number, y = 0.15, thick = 0.12) {
    let r = this.pool.find((x) => !x.active);
    if (!r) {
      const m = new THREE.Mesh(new THREE.RingGeometry(1 - thick, 1, 64), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; this.scene.add(m);
      r = { mesh: m, t: 0, dur, r0: 0.3, r1, active: true }; this.pool.push(r);
    }
    Object.assign(r, { t: 0, dur, r1, active: true });
    (r.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    r.mesh.position.set(p.x, y, p.z); r.mesh.visible = true;
  }
  update(dt: number) {
    for (const r of this.pool) {
      if (!r.active) continue;
      r.t += dt; const k = r.t / r.dur;
      if (k >= 1) { r.active = false; r.mesh.visible = false; continue; }
      const e = 1 - Math.pow(1 - k, 3);
      r.mesh.scale.setScalar(r.r0 + (r.r1 - r.r0) * e);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
    }
  }
  clear() { for (const r of this.pool) { r.active = false; r.mesh.visible = false; } }
}

// ───────────────────────── paint splats on the ground ─────────────────────────
export class Splats {
  private meshes: THREE.Mesh[] = [];
  private i = 0;
  private tex: THREE.Texture;
  constructor(private scene: THREE.Scene) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(64 + rand(-30, 30), 64 + rand(-30, 30), rand(8, 26), 0, 7); g.fill(); }
    g.beginPath(); g.arc(64, 64, 36, 0, 7); g.fill();
    this.tex = new THREE.CanvasTexture(c);
  }
  add(p: THREE.Vector3, size: number) {
    let m = this.meshes[this.i];
    if (!m) {
      m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; this.scene.add(m); this.meshes[this.i] = m;
    }
    this.i = (this.i + 1) % 160;
    m.position.set(p.x, 0.04 + this.i * 0.0004, p.z); m.rotation.z = Math.random() * 6.28; m.scale.setScalar(size * 2);
    (m.material as THREE.MeshBasicMaterial).color.copy(NEON[(Math.random() * NEON.length) | 0]).multiplyScalar(0.7);
  }
  clear() { for (const m of this.meshes) m.scale.setScalar(0.0001); }
}

// ───────────────────────── word pops ─────────────────────────
const wordTex = new Map<string, THREE.SpriteMaterial>();
function wordMat(text: string, color: string) {
  const key = text + color;
  let m = wordTex.get(key);
  if (m) return m;
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d')!;
  g.font = '900 78px Orbitron, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(text, 256, 64);
  g.fillStyle = color; g.fillText(text, 256, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false });
  wordTex.set(key, m);
  return m;
}
export class Words {
  private items: { s: THREE.Sprite; t: number; v: number }[] = [];
  constructor(private scene: THREE.Scene) {}
  pop(text: string, color: string, p: THREE.Vector3, scale = 3) {
    const s = new THREE.Sprite(wordMat(text, color).clone());
    s.position.copy(p); s.userData.base = scale; s.scale.set(scale, scale / 4, 1); s.renderOrder = 999;
    this.scene.add(s); this.items.push({ s, t: 0, v: 3 });
  }
  update(dt: number) {
    this.items = this.items.filter((w) => {
      w.t += dt; w.s.position.y += w.v * dt; w.v *= 0.92;
      const k = w.t / 0.9;
      (w.s.material as THREE.SpriteMaterial).opacity = 1 - Math.max(0, k - 0.5) * 2;
      const pop = w.t < 0.1 ? 0.6 + w.t * 6 : 1.2 - Math.min(0.2, (w.t - 0.1));
      const base = w.s.userData.base as number;
      w.s.scale.set(base * pop, (base / 4) * pop, 1);
      if (k >= 1) { this.scene.remove(w.s); return false; }
      return true;
    });
  }
}

// ───────────────────────── lasers ─────────────────────────
export class Lasers {
  group = new THREE.Group();
  beams: THREE.Mesh[] = [];
  active = 0; // seconds remaining
  constructor(scene: THREE.Scene) {
    for (let i = 0; i < 4; i++) {
      const g = new THREE.CylinderGeometry(0.06, 0.06, 1, 6, 1, true); g.translate(0, 0.5, 0);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: NEON[i % 3], transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; this.group.add(m); this.beams.push(m);
    }
    scene.add(this.group);
  }
  /** Beams start at origin and sweep; returns ground hit points for painting. */
  update(dt: number, origin: THREE.Vector3, yaw: number, t: number, sky: boolean): THREE.Vector3[] {
    const hits: THREE.Vector3[] = [];
    this.active = Math.max(0, this.active - dt);
    this.beams.forEach((b, i) => {
      b.visible = this.active > 0;
      if (!b.visible) return;
      b.position.copy(origin);
      const sweep = Math.sin(t * 2.2 + i * 1.6) * 0.9;
      const dir = new THREE.Vector3(Math.sin(yaw + sweep + (i - 1.5) * 0.25), sky ? 1.6 : -0.22, Math.cos(yaw + sweep + (i - 1.5) * 0.25)).normalize();
      const len = sky ? 120 : Math.min(60, origin.y / Math.max(0.05, -dir.y));
      b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      b.scale.set(1, len, 1);
      if (!sky) hits.push(origin.clone().addScaledVector(dir, len));
    });
    return hits;
  }
}

// ───────────────────────── snow ─────────────────────────
export class Snow {
  points: THREE.Points;
  private n = 2500;
  constructor(scene: THREE.Scene) {
    const pos = new Float32Array(this.n * 3);
    for (let i = 0; i < this.n; i++) pos.set([rand(-50, 50), rand(0, 40), rand(-50, 50)], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: '#dfe6f2', size: 0.14, transparent: true, opacity: 0.8, depthWrite: false });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false;
    scene.add(this.points);
  }
  update(dt: number, center: THREE.Vector3, sparkle: number, t: number) {
    const a = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const p = a.array as Float32Array;
    for (let i = 0; i < this.n; i++) {
      const j = i * 3;
      p[j + 1] -= dt * (1.6 + (i % 7) * 0.15);
      p[j] += Math.sin(t + i) * dt * 0.4;
      if (p[j + 1] < 0) { p[j + 1] = 40; p[j] = center.x + rand(-50, 50); p[j + 2] = center.z + rand(-50, 50); }
    }
    a.needsUpdate = true;
    const m = this.points.material as THREE.PointsMaterial;
    m.color.set(sparkle > 0.5 ? NEON[((t * 2) | 0) % NEON.length] : '#dfe6f2').lerp(new THREE.Color('#ffffff'), 0.6);
    m.size = 0.14 + sparkle * 0.08;
  }
}
