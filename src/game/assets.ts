/**
 * Asset loading: Lux3D GLBs from /assets/manifest.json, with procedural stand-ins
 * so the level is always playable (and so the demo never depends on a network call).
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface ManifestEntry { neon?: string; grey?: string; anim?: string; parts?: string }
let manifest: Record<string, ManifestEntry> = {};
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<GLTF | null>>();

export async function loadManifest() {
  try { manifest = await (await fetch('/assets/manifest.json')).json(); } catch { manifest = {}; }
  return manifest;
}
export const hasAsset = (id: string, v: keyof ManifestEntry = 'neon') => !!manifest[id]?.[v];

export function loadGLB(id: string, v: keyof ManifestEntry = 'neon'): Promise<GLTF | null> {
  const file = manifest[id]?.[v];
  if (!file) return Promise.resolve(null);
  const key = `${id}:${v}`;
  if (!cache.has(key)) cache.set(key, loader.loadAsync(`/assets/${file}`).catch((e) => { console.warn('GLB failed', file, e); return null; }));
  return cache.get(key)!;
}

/** Preload every model referenced by the level so placement is synchronous. */
export async function preload(ids: string[], onProgress?: (f: number) => void) {
  const jobs = ids.flatMap((id) => (['neon', 'grey', 'anim', 'parts'] as const).filter((v) => hasAsset(id, v)).map((v) => [id, v] as const));
  let done = 0;
  await Promise.all(jobs.map(([id, v]) => loadGLB(id, v).then(() => onProgress?.(++done / Math.max(1, jobs.length)))));
}
const resolved = new Map<string, GLTF | null>();
export async function resolveAll() {
  for (const [k, p] of cache) resolved.set(k, await p);
}
export const getGLB = (id: string, v: keyof ManifestEntry = 'neon') => resolved.get(`${id}:${v}`) ?? null;

export function cloneScene(g: GLTF): THREE.Object3D {
  return skeletonClone(g.scene);
}

/** Scale/centre a model so it sits on y=0 inside a w×d footprint (local axes) and h height. */
export function fitModel(obj: THREE.Object3D, w: number, d: number, h: number, mode: 'footprint' | 'contain' | 'height') {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  let s: number;
  if (mode === 'footprint') s = Math.min(w / size.x, d / size.z, (h * 1.5) / size.y);
  else if (mode === 'height') s = h / size.y;
  else s = Math.min(w / size.x, d / size.z, h / size.y);
  const c = box.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group();
  obj.position.set(-c.x * s, -box.min.y * s, -c.z * s);
  obj.scale.setScalar(s);
  wrap.add(obj);
  return wrap;
}

// ───────────────────────── procedural stand-ins ─────────────────────────
const tex = new Map<string, THREE.Texture>();
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  let t = tex.get(key);
  if (t) return t;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  tex.set(key, t);
  return t;
}

const PALETTE = ['#ff3ec8', '#3ee6ff', '#ffc83d', '#7cff6b', '#ff6b3d', '#a46bff'];
const pick = (i: number) => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];

function facade(seed: number, floors: number) {
  return canvasTex(`facade${seed}_${floors}`, 256, 256 * Math.max(1, floors / 3), (g) => {
    const W = 256, H = 256 * Math.max(1, floors / 3);
    const base = ['#8a5a44', '#6d7c8f', '#9b8c7a', '#5d6b78', '#a0685a'][seed % 5];
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * W, Math.random() * H, 6, 3); }
    const fh = H / floors;
    for (let f = 0; f < floors; f++) {
      for (let x = 0; x < 4; x++) {
        const lit = Math.random() < 0.75;
        g.fillStyle = lit ? (Math.random() < 0.3 ? pick(seed + x + f) : '#ffd98a') : '#1b2230';
        g.fillRect(18 + x * 60, f * fh + fh * 0.22, 38, fh * 0.5);
        g.fillStyle = '#2b2b2b'; g.fillRect(14 + x * 60, f * fh + fh * 0.72, 46, 4);
      }
      // string lights
      for (let x = 0; x < W; x += 9) { g.fillStyle = pick(x + f); g.beginPath(); g.arc(x, f * fh + 6 + Math.sin(x * 0.08) * 3, 2.5, 0, 7); g.fill(); }
    }
    g.fillStyle = pick(seed); g.fillRect(0, H - fh * 0.95, W, fh * 0.18); // shop sign band
  });
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.05, ...o });

export function proceduralModel(id: string, seed = 0): THREE.Object3D {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  if (id.startsWith('B_')) {
    const floors = id === 'B_APT_A' ? 6 : id === 'B_CLOCK' ? 9 : id === 'B_DEPT_STORE' ? 4 : 3;
    const h = floors * 3.2;
    const mat = std({ map: facade(seed + id.length, floors) });
    add(new THREE.BoxGeometry(10, h, 10), mat, 0, h / 2, 0);
    add(new THREE.BoxGeometry(10.6, 0.6, 10.6), std({ color: '#44464f' }), 0, h + 0.3, 0);
    add(new THREE.BoxGeometry(8, 0.25, 1.6), std({ color: pick(seed + 3) }), 0, 3.4, 5.6); // awning
    if (id === 'B_CLOCK') add(new THREE.CylinderGeometry(2.2, 2.2, 0.4, 24), std({ color: '#fff3c4' }), 0, h - 3, 5.2).rotation.x = Math.PI / 2;
    return g;
  }
  switch (id) {
    case 'PR_LAMP':
      add(new THREE.CylinderGeometry(0.08, 0.12, 4.2, 8), std({ color: '#2a2d33', metalness: 0.6 }), 0, 2.1, 0);
      add(new THREE.SphereGeometry(0.32, 12, 8), std({ color: '#ffd27a' }), 0, 4.3, 0);
      add(new THREE.TorusGeometry(0.3, 0.06, 6, 12), std({ color: '#e0233a' }), 0, 3.9, 0);
      break;
    case 'PR_CAR': {
      const c = pick(seed);
      add(new THREE.BoxGeometry(1.8, 0.8, 4), std({ color: c, metalness: 0.4, roughness: 0.35 }), 0, 0.75, 0);
      add(new THREE.BoxGeometry(1.6, 0.7, 2.2), std({ color: '#cfe8ff', metalness: 0.2, roughness: 0.1 }), 0, 1.5, -0.2);
      for (const [x, z] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) add(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14), std({ color: '#111' }), x, 0.38, z).rotation.z = Math.PI / 2;
      add(new THREE.ConeGeometry(0.5, 1.2, 8), std({ color: '#1f7a3a' }), 0, 2.4, -0.2).rotation.z = Math.PI / 2;
      break;
    }
    case 'PR_STALL':
      add(new THREE.BoxGeometry(3.4, 1.1, 2), std({ color: '#8b5a2b' }), 0, 0.55, 0);
      add(new THREE.ConeGeometry(2.6, 1.2, 4), std({ map: canvasTex('stripes', 64, 64, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#e0233a'; c.fillRect(i * 8, 0, 8, 64); } }) }), 0, 3, 0).rotation.y = Math.PI / 4;
      for (const x of [-1.5, 1.5]) add(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), std({ color: '#5a3a1b' }), x, 1.2, 0.9);
      for (let i = 0; i < 6; i++) add(new THREE.SphereGeometry(0.12, 8, 6), std({ color: pick(i) }), -1.5 + i * 0.6, 2.3, 1);
      break;
    case 'PR_CONTAINERS':
      for (let i = 0; i < 3; i++) {
        const m = add(new THREE.BoxGeometry(2.6, 2.6, 6), std({ map: canvasTex(`cont${i}`, 128, 64, (c) => { c.fillStyle = pick(i + 1); c.fillRect(0, 0, 128, 64); for (let x = 0; x < 128; x += 6) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, 0, 2, 64); } c.fillStyle = pick(i + 3); c.font = 'bold 26px sans-serif'; c.fillText('~*~', 30, 42); }) }), (i - 1) * 0.6, 1.3 + i * 2.6, 0);
        m.rotation.y = i * 0.25;
      }
      break;
    case 'PR_BALLOON': {
      const body = std({ color: '#1d2433', roughness: 0.25 }), belly = std({ color: '#f4f4f4', roughness: 0.3 });
      add(new THREE.SphereGeometry(2.6, 24, 18), body, 0, 3, 0).scale.set(1, 1.25, 1);
      add(new THREE.SphereGeometry(2.1, 24, 18), belly, 0, 2.7, 0.9).scale.set(1, 1.2, 0.8);
      add(new THREE.SphereGeometry(1.7, 20, 16), body, 0, 6.6, 0);
      add(new THREE.ConeGeometry(0.5, 1.2, 12), std({ color: '#ffb02e' }), 0, 6.4, 1.9).rotation.x = Math.PI / 2;
      add(new THREE.ConeGeometry(1.1, 2.2, 16), std({ map: canvasTex('stripes', 64, 64, () => {}) }), 0, 8.8, 0);
      add(new THREE.TorusGeometry(1.6, 0.18, 8, 24), std({ color: '#ffc83d', metalness: 1, roughness: 0.2 }), 0, 5.2, 0.4).rotation.x = Math.PI / 2.4;
      break;
    }
    case 'PR_GIFTS':
      [[0, 0.6, 0, 1.4], [0.9, 0.45, 0.6, 0.9], [-0.2, 1.6, 0.1, 0.8]].forEach(([x, y, z, s], i) => {
        add(new THREE.BoxGeometry(s, s, s), std({ color: pick(i * 2) }), x, y, z);
        add(new THREE.BoxGeometry(s * 1.02, s * 1.02, s * 0.15), std({ color: '#ffd84a', metalness: 0.6 }), x, y, z);
      });
      break;
    case 'PR_SNOWMAN':
      add(new THREE.SphereGeometry(0.9, 16, 12), std({ color: '#f2f6ff' }), 0, 0.85, 0);
      add(new THREE.SphereGeometry(0.62, 16, 12), std({ color: '#f2f6ff' }), 0, 2.1, 0);
      add(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 12), std({ color: '#111' }), 0, 2.95, 0);
      add(new THREE.ConeGeometry(0.08, 0.4, 8), std({ color: '#ff8a1e' }), 0, 2.15, 0.65).rotation.x = Math.PI / 2;
      add(new THREE.TorusGeometry(0.5, 0.12, 8, 16), std({ color: '#e0233a' }), 0, 1.55, 0).rotation.x = Math.PI / 2;
      break;
    case 'PR_ORNAMENT':
      add(new THREE.SphereGeometry(1, 24, 18), std({ color: pick(seed), metalness: 0.8, roughness: 0.15 }), 0, 1, 0);
      add(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12), std({ color: '#ffd84a', metalness: 1, roughness: 0.2 }), 0, 2.05, 0);
      break;
    case 'PR_SPEAKER_TOWER':
      for (let i = 0; i < 4; i++) {
        add(new THREE.BoxGeometry(2.2, 1.6, 1.6), std({ color: '#16181d' }), 0, 0.8 + i * 1.62, 0);
        add(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 18), std({ color: '#3ee6ff' }), 0, 0.8 + i * 1.62, 0.82).rotation.x = Math.PI / 2;
      }
      break;
    case 'PR_STAGE':
      add(new THREE.BoxGeometry(14, 1.2, 8), std({ color: '#22252c' }), 0, 0.6, 0);
      for (const x of [-6.5, 6.5]) add(new THREE.BoxGeometry(0.4, 7, 0.4), std({ color: '#888', metalness: 0.8 }), x, 4.5, -3.5);
      add(new THREE.BoxGeometry(13.4, 0.4, 0.4), std({ color: '#888', metalness: 0.8 }), 0, 8, -3.5);
      for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.25, 0.3, 0.5, 10), std({ color: pick(i) }), -5 + i * 2, 7.6, -3.2);
      break;
    case 'PR_GIANT_TREE': {
      const green = std({ color: '#1f6b3a', roughness: 0.9 });
      for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(5.5 - i * 0.95, 6, 20), green, 0, 4 + i * 3.6, 0);
      add(new THREE.CylinderGeometry(0.8, 1, 3, 10), std({ color: '#4a2e1a' }), 0, 1.5, 0);
      for (let i = 0; i < 40; i++) {
        const t = i / 40, a = t * 30, r = 5.2 * (1 - t) + 0.4;
        add(new THREE.SphereGeometry(0.35, 10, 8), std({ color: pick(i), metalness: 0.7, roughness: 0.2 }), Math.sin(a) * r, 3 + t * 18, Math.cos(a) * r);
      }
      break;
    }
    case 'PR_BARRICADE':
      add(new THREE.BoxGeometry(4, 1.2, 0.8), std({ color: '#6b6e75' }), 0, 0.6, 0);
      add(new THREE.BoxGeometry(3.6, 0.8, 0.2), std({ color: '#3a3d44' }), 0, 1.5, 0);
      break;
    default:
      add(new THREE.BoxGeometry(1, 1, 1), std({ color: pick(seed) }), 0, 0.5, 0);
  }
  return g;
}

/** Ground textures. */
export const groundTex = {
  asphalt: () => canvasTex('asphalt', 512, 512, (g) => {
    g.fillStyle = '#2b2e34'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 6000; i++) { const v = 30 + Math.random() * 40; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(200,210,230,0.06)'; g.beginPath(); g.ellipse(Math.random() * 512, Math.random() * 512, 30 + Math.random() * 60, 10 + Math.random() * 20, Math.random() * 3, 0, 7); g.fill(); }
  }, [8, 8]),
  tiles: () => canvasTex('tiles', 256, 256, (g) => {
    g.fillStyle = '#5c5f66'; g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) { const v = 85 + Math.random() * 25; g.fillStyle = `rgb(${v},${v},${v + 6})`; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); }
  }, [12, 12]),
  lanes: () => canvasTex('lanes', 64, 512, (g) => {
    g.clearRect(0, 0, 64, 512);
    g.fillStyle = 'rgba(240,240,220,0.85)'; for (let y = 0; y < 512; y += 64) g.fillRect(28, y, 8, 36);
  }, [1, 6]),
};
