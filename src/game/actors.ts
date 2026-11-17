/** Mesh builders for the BT-01 Deckhound, Hush enemies, The Silencer and citizens. */
import * as THREE from 'three';
import { getGLB, cloneScene, fitModel } from './assets';

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.35, ...o });
const glow = (c: string, i = 3) => new THREE.MeshStandardMaterial({ color: '#000', emissive: c, emissiveIntensity: i, roughness: 0.4 });

export interface TankRig {
  root: THREE.Group; hull: THREE.Group; turret: THREE.Group; barrel: THREE.Group; muzzle: THREE.Object3D;
  speakers: THREE.Object3D[]; lightBar: THREE.Mesh[]; treads: THREE.Texture[]; underglow: THREE.PointLight;
  muzzleRing: THREE.MeshStandardMaterial; laserSocket: THREE.Object3D; hatch: THREE.Group;
}

function treadTexture() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 128; const g = c.getContext('2d')!;
  g.fillStyle = '#1a1b1f'; g.fillRect(0, 0, 32, 128);
  for (let y = 0; y < 128; y += 16) { g.fillStyle = '#3a3c43'; g.fillRect(0, y, 32, 9); g.fillStyle = '#55585f'; g.fillRect(2, y + 1, 28, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 4);
  return t;
}

function graffiti() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
  g.fillStyle = '#20232b'; g.fillRect(0, 0, 256, 256);
  const cols = ['#3ee6ff', '#ff3ec8', '#7cff6b', '#ffc83d'];
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = cols[i % 4]; g.lineWidth = 3 + Math.random() * 6; g.lineCap = 'round';
    g.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 90; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = cols[i % 4]; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, Math.random() * 3 + 1, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildTank(): TankRig {
  const root = new THREE.Group();
  const hull = new THREE.Group(); root.add(hull);
  const paint = std({ map: graffiti(), metalness: 0.45, roughness: 0.4 });
  const dark = std({ color: '#1b1d22', metalness: 0.6 });
  const treads: THREE.Texture[] = [];
  const hullGLB = getGLB('P_TANK_HULL');
  if (hullGLB) {
    const m = fitModel(cloneScene(hullGLB), 4.2, 7.2, 2.6, 'contain');
    m.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true; });
    hull.add(m);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 6.6), paint); body.position.y = 1.15; hull.add(body);
    const glacis = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 1.6), paint); glacis.position.set(0, 1.25, 3.4); glacis.rotation.x = -0.5; hull.add(glacis);
    for (const s of [-1, 1]) {
      const tt = treadTexture(); treads.push(tt);
      const tr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 7.2), std({ map: tt, metalness: 0.3, roughness: 0.8 })); tr.position.set(s * 1.95, 0.6, 0); hull.add(tr);
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 6.4), paint); skirt.position.set(s * 2.45, 1.05, 0); hull.add(skirt);
      for (let i = 0; i < 3; i++) { // skirt speaker grilles
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16), glow('#3ee6ff', 1.5)); sp.rotation.z = Math.PI / 2; sp.position.set(s * 2.54, 1.05, -1.8 + i * 1.8); hull.add(sp);
      }
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 6.4), glow('#ff3ec8', 4)); led.position.set(s * 2.55, 1.42, 0); hull.add(led);
    }
    for (const s of [-0.8, 0.8]) { const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 16), dark); ex.rotation.x = Math.PI / 2; ex.position.set(s, 1.2, -3.4); hull.add(ex); }
  }
  hull.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const turret = new THREE.Group(); turret.position.y = 2.05; root.add(turret);
  const speakers: THREE.Object3D[] = [];
  const turretGLB = getGLB('P_TANK_TURRET');
  if (turretGLB) {
    const m = fitModel(cloneScene(turretGLB), 3.2, 3.6, 1.6, 'contain');
    m.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    turret.add(m);
  } else {
    const tb = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 2.8), paint); tb.position.y = 0.3; turret.add(tb);
    // twin turntable deck on top
    for (const s of [-0.6, 0.6]) {
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 24), std({ color: '#0d0e10', metalness: 0.2, roughness: 0.3 })); plat.position.set(s, 0.75, -0.3); turret.add(plat);
      const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16), glow(s < 0 ? '#ff3ec8' : '#3ee6ff', 3)); lab.position.set(s, 0.78, -0.3); turret.add(lab);
      speakers.push(plat);
    }
    for (const s of [-1, 1]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 1), dark); box.position.set(s * 1.5, 0.35, 0); turret.add(box);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.18, 0.2, 20), std({ color: '#2b2d33', metalness: 0.2, roughness: 0.7 }));
      cone.rotation.z = Math.PI / 2; cone.position.set(s * 1.8, 0.35, 0); turret.add(cone); speakers.push(cone);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 24), glow('#3ee6ff', 3)); ring.rotation.y = Math.PI / 2; ring.position.set(s * 1.86, 0.35, 0); turret.add(ring);
    }
  }
  const hatch = new THREE.Group(); hatch.position.set(0, 0.75, -0.9); turret.add(hatch);
  // VOLT — cube-visor DJ peeking out of the hatch
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.6, 12), std({ color: '#121318', metalness: 0, roughness: 0.9 })); hood.position.y = 0.3; hatch.add(hood);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.46, 0.5), std({ color: '#0b0c10', metalness: 0.9, roughness: 0.15 })); visor.position.y = 0.82; hatch.add(visor);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26), glow('#3ee6ff', 4)); screen.position.set(0, 0.82, 0.26); hatch.add(screen);
  for (const s of [-1, 1]) { const ph = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 16, Math.PI), std({ color: '#222' })); ph.position.set(s * 0.27, 0.86, 0); ph.rotation.y = Math.PI / 2; hatch.add(ph); }

  const lightBar: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.12), glow('#ffffff', 0.5));
    l.position.set(-0.85 + i * 0.243, 0.82, 1.2); turret.add(l); lightBar.push(l);
  }
  const barrel = new THREE.Group(); barrel.position.set(0, 0.4, 1.3); turret.add(barrel);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 3.2, 16), dark); tube.rotation.x = Math.PI / 2; tube.position.z = 1.6; barrel.add(tube);
  const muzzleRing = glow('#3ee6ff', 4);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 10, 24), muzzleRing); ring.position.z = 3.2; barrel.add(ring);
  const muzzle = new THREE.Object3D(); muzzle.position.z = 3.5; barrel.add(muzzle);
  const laserSocket = new THREE.Object3D(); laserSocket.position.set(0, 1.2, -0.4); turret.add(laserSocket);
  turret.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });

  const underglow = new THREE.PointLight('#3ee6ff', 30, 12, 1.8); underglow.position.y = 0.4; root.add(underglow);
  return { root, hull, turret, barrel, muzzle, speakers, lightBar, treads, underglow, muzzleRing, laserSocket, hatch };
}

// ───────────────────────── enemies ─────────────────────────
const foam = () => std({ color: '#5a5e68', roughness: 0.95, metalness: 0.05 });
const eye = () => glow('#ff2a3a', 4);
const crystalMat = () => new THREE.MeshStandardMaterial({ color: '#9fd8ff', emissive: '#6fc8ff', emissiveIntensity: 2.5, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.92 });

function useGLBOr(id: string, w: number, h: number, fallback: () => THREE.Object3D) {
  const g = getGLB(id);
  if (!g) return fallback();
  const m = fitModel(cloneScene(g), w, w, h, 'contain');
  m.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return m;
}

export function buildDrone() {
  return useGLBOr('E_DRONE', 1.8, 1.2, () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), foam()); body.scale.y = 0.6; g.add(body);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), eye()); e.position.z = 0.5; g.add(e);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 1.2), std({ color: '#3a3d44' })); arm.position.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5); arm.rotation.y = a; g.add(arm);
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 12), std({ color: '#222', transparent: true, opacity: 0.6 })); rotor.position.set(Math.sin(a) * 0.95, 0.12, Math.cos(a) * 0.95); g.add(rotor);
    }
    return g;
  });
}

export function buildMuteTank(big = false) {
  const s = big ? 1.6 : 1;
  const g = useGLBOr('E_MUTE_TANK', 4 * s, 2.8 * s, () => {
    const t = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 5.6), foam()); body.position.y = 1; t.add(body);
    for (const x of [-1.8, 1.8]) { const tr = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 6), std({ color: '#25272c' })); tr.position.set(x, 0.55, 0); t.add(tr); }
    const tur = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 2.4), foam()); tur.position.set(0, 2, -0.3); t.add(tur);
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 3.4, 10), std({ color: '#40434b' })); gun.rotation.x = Math.PI / 2; gun.position.set(0, 2, 2.4); t.add(gun);
    const e = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 0.1), eye()); e.position.set(0, 2.2, 0.92); t.add(e);
    if (big) { // Sleigh-Dozer plow blades
      for (const x of [-1, 1]) { const bl = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 0.3), std({ color: '#6d7078', metalness: 0.7 })); bl.position.set(x * 1.15, 0.9, 3.3); bl.rotation.y = -x * 0.35; t.add(bl); }
    }
    t.scale.setScalar(s);
    t.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    return t;
  });
  return g;
}

export function buildTower() {
  const g = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 9, 8), std({ color: '#55585f', metalness: 0.7 })); mast.position.y = 4.5; g.add(mast);
  for (let i = 0; i < 3; i++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(1.4 - i * 0.3, 0.3, 0.5, 16), foam()); d.position.y = 3 + i * 2.2; g.add(d); }
  const l = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), eye()); l.position.y = 9.2; g.add(l);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}

export function buildPylon() {
  return useGLBOr('E_PYLON', 3, 6, () => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.4, 8), foam()); base.position.y = 0.7; g.add(base);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 4, 8), std({ color: '#5a5d64', metalness: 0.7 })); col.position.y = 3.2; g.add(col);
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), crystalMat()); c.position.y = 6; g.add(c);
    return g;
  });
}

// ───────────────────────── The Silencer ─────────────────────────
export interface BossRig { root: THREE.Group; body: THREE.Object3D; panels: THREE.Mesh[]; crystal: THREE.Mesh; horn: THREE.Object3D; hornMouth: THREE.Object3D }
export function buildSilencer(): BossRig {
  const root = new THREE.Group();
  let body: THREE.Object3D;
  const g = getGLB('B_SILENCER');
  const horn = new THREE.Group();
  if (g) {
    body = fitModel(cloneScene(g), 12, 12, 14, 'contain');
    body.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  } else {
    body = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(5, 6.5, 4, 12), std({ color: '#3a3d44', metalness: 0.7 })); base.position.y = 2; body.add(base);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2, 5, 12), foam()); neck.position.y = 6; body.add(neck);
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector2(0.8 + Math.pow(t, 2.6) * 5.5, t * 7)); }
    const hornMesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshStandardMaterial({ color: '#6b6f78', roughness: 0.9, side: THREE.DoubleSide }));
    hornMesh.rotation.x = Math.PI / 2.4; hornMesh.position.set(0, 9, -1); horn.add(hornMesh);
    body.add(horn);
  }
  root.add(body);
  const hornMouth = new THREE.Object3D(); hornMouth.position.set(0, 10, 6); root.add(hornMouth);
  const panels: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 0.8), new THREE.MeshStandardMaterial({ color: '#4c5059', roughness: 0.95, emissive: '#000', emissiveIntensity: 1 }));
    p.position.set(Math.sin(a) * 6.6, 5.5, Math.cos(a) * 6.6); p.rotation.y = a; p.castShadow = true;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 0.1), glow('#8fd0ff', 3)); strip.position.z = 0.45; p.add(strip);
    root.add(p); panels.push(p);
  }
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), crystalMat()); crystal.position.y = 7.5; crystal.scale.y = 1.5; root.add(crystal);
  return { root, body, panels, crystal, horn, hornMouth };
}

// ───────────────────────── citizens ─────────────────────────
export function buildCitizenFallback(seed: number) {
  const g = new THREE.Group();
  const cols = ['#e04a6d', '#3e8cff', '#ffc83d', '#7cff6b', '#ff7a3d', '#a46bff'];
  const c = cols[seed % cols.length];
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.8, 6, 12), std({ color: c, metalness: 0, roughness: 0.8 })); body.position.y = 0.95; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), std({ color: '#f0c8a0', metalness: 0, roughness: 0.7 })); head.position.y = 1.72; g.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 12), std({ color: cols[(seed + 2) % cols.length], metalness: 0 })); hat.position.y = 2.05; g.add(hat);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), std({ color: '#fff', metalness: 0 })); pom.position.y = 2.28; g.add(pom);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 4, 8), std({ color: c, metalness: 0 })); arm.position.set(s * 0.42, 1.1, 0); arm.rotation.z = s * 0.4; arm.name = s < 0 ? 'armL' : 'armR'; g.add(arm); }
  return g;
}
