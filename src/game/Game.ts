/**
 * BEATTANK runtime. Plain three.js + postprocessing, driven by the AudioEngine clock.
 * React only renders the HUD/menus from the zustand store (useUI).
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, HueSaturationEffect, VignetteEffect, ChromaticAberrationEffect,
  ToneMappingEffect, ToneMappingMode, SMAAEffect, BrightnessContrastEffect,
} from 'postprocessing';
import { audio, type Judgement, type Section } from '../audio/AudioEngine';
import { placed, citizens as citizenDefs, vinyls, pickups as pickupDefs, gates as gateDefs, inBounds, zoneAt, PLAZA, TREE, BOSS_POS, CHECKPOINTS, type Zone, type Placed } from './level';
import { proceduralModel, fitModel, getGLB, cloneScene, groundTex } from './assets';
import { newRemixUniforms, applyRemix, remixTime, type RemixUniforms } from './remix';
import { Particles, Rings, Splats, Words, Lasers, Snow, NEON } from './fx';
import { buildTank, buildDrone, buildMuteTank, buildTower, buildPylon, buildSilencer, buildCitizenFallback, type TankRig, type BossRig } from './actors';
import { useUI, banner, toast, emptyStats } from './store';

const V = () => new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const damp = THREE.MathUtils.damp;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Collider { minX: number; maxX: number; minZ: number; maxZ: number; h: number; tag?: string }

interface Remixable {
  zone: Zone; root: THREE.Object3D; grey: THREE.Object3D; neon: THREE.Object3D; u: RemixUniforms;
  paint: number; hp: number; weight: number; state: 'grey' | 'remixing' | 'neon';
  center: THREE.Vector3; radius: number; t: number; size: number; kind: string;
  citizen?: { mixers: THREE.AnimationMixer[]; dance?: THREE.AnimationAction; fallback?: THREE.Object3D; phase: number };
}

type EnemyKind = 'drone' | 'tower' | 'mute' | 'dozer' | 'pylon';
interface Enemy {
  kind: EnemyKind; obj: THREE.Object3D; pos: THREE.Vector3; hp: number; maxHp: number; radius: number; zone: Zone;
  t: number; cd: number; vel: THREE.Vector3; yaw: number; alive: boolean; hitFlash: number;
}
interface Proj {
  mesh: THREE.Mesh; pos: THREE.Vector3; vel: THREE.Vector3; owner: 'player' | 'enemy'; dmg: number; life: number;
  judge: Judgement; radius: number; power: number; kind: 'slug' | 'orb' | 'shell' | 'foam';
}

const ENEMY_STATS: Record<EnemyKind, { hp: number; r: number; pts: number }> = {
  drone: { hp: 40, r: 1.2, pts: 150 }, tower: { hp: 200, r: 1.8, pts: 600 }, mute: { hp: 260, r: 2.8, pts: 800 },
  dozer: { hp: 900, r: 4.2, pts: 5000 }, pylon: { hp: 300, r: 1.8, pts: 1000 },
};
const JUDGE = {
  perfect: { dmg: 40, r: 6, power: 2, combo: 2, color: '#FFC83D', word: 'PERFECT' },
  good: { dmg: 30, r: 4.5, power: 1.5, combo: 1, color: '#3EE6FF', word: 'GOOD' },
  off: { dmg: 20, r: 3, power: 1, combo: 0, color: '#9aa3b5', word: 'OFF' },
} as const;

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
  composer: EffectComposer;
  bloom: BloomEffect; hue: HueSaturationEffect; chroma: ChromaticAberrationEffect; bc: BrightnessContrastEffect;
  sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight;
  sky!: THREE.Mesh; skyU = { uTop: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() }, uNeon: { value: 0 }, uTime: { value: 0 } };
  skyline!: THREE.InstancedMesh; skylineMat!: THREE.MeshStandardMaterial;
  groundMats: THREE.MeshStandardMaterial[] = [];
  particles: Particles; rings: Rings; splats: Splats; words: Words; lasers: Lasers; snow: Snow;
  tank!: TankRig;
  colliders: Collider[] = [];
  gateColliders: Collider[] = [];
  gateMeshes: THREE.Object3D[][] = [];
  remix: Remixable[] = [];
  enemies: Enemy[] = [];
  projs: Proj[] = [];
  pickups: { obj: THREE.Object3D; pos: THREE.Vector3; type: string; taken: boolean }[] = [];
  boss: (BossRig & { hp: number[]; crystalHp: number; phase: number; rise: number; t: number; waveT: number; nextAttack: number; foam: { pos: THREE.Vector3; t: number; mesh: THREE.Mesh }[]; alive: boolean; telegraph?: THREE.Mesh }) | null = null;
  portal!: THREE.Mesh;
  treeLights!: THREE.Points; treeStar!: THREE.Mesh; treeLit = 0;
  plazaLights: THREE.PointLight[] = [];

  // player
  pos = V(); yaw = 0; speed = 0; vy = 0; turretYaw = 0; pitch = 0; hp = 300;
  boostT = 0; boostCd = 0; slowT = 0; lastShot = -9; recoil = 0; invuln = 0; airborne = false;
  special: { type: string; left: number } | null = null;
  bassDrop = 0;
  camYaw = 0; camPitch = 0.22; camPos = V(); camLook = V(); shake = 0; fovKick = 0;
  keys = new Set<string>(); mouseDown = false; locked = false;
  aim = V();

  // progression
  mode: 'title' | 'intro' | 'play' | 'drop' | 'outro' | 'dead' | 'paused' = 'title';
  t = 0; modeT = 0; neon = 0; neonTarget = 0; dropDone = false;
  combo = 0; tier = 1;
  gateOpen: Record<Zone, boolean> = { A: false, B: false, C: false };
  visited: Record<Zone, boolean> = { A: true, B: false, C: false };
  spawned = { A: 0, B: 0, C: 0 };
  pylonsLeft = 4; dozerSpawned = false; checkpoint: Zone = 'A';
  stats = emptyStats();
  beforeShot = ''; afterShot = '';
  private captureCb: ((url: string) => void) | null = null;
  private clock = new THREE.Clock();
  private hudT = 0;
  private raf = 0;
  private tutorial = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    this.scene.fog = new THREE.Fog('#8b93a1', 30, 190);

    this.hemi = new THREE.HemisphereLight('#c9d4e6', '#3a3a40', 1.1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#dfe8ff', 1.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -60; sc.right = sc.top = 60; sc.far = 260; this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.75, luminanceSmoothing: 0.2, intensity: 1.1, radius: 0.75 });
    this.hue = new HueSaturationEffect({ saturation: -0.5 });
    this.bc = new BrightnessContrastEffect({ contrast: 0.08 });
    this.chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0, 0), radialModulation: true, modulationOffset: 0.2 });
    this.composer.addPass(new EffectPass(this.camera, this.bloom, this.chroma));
    this.composer.addPass(new EffectPass(this.camera, this.hue, this.bc, new VignetteEffect({ darkness: 0.55, offset: 0.3 }), new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }), new SMAAEffect()));

    this.particles = new Particles(this.scene); this.rings = new Rings(this.scene); this.splats = new Splats(this.scene);
    this.words = new Words(this.scene); this.lasers = new Lasers(this.scene); this.snow = new Snow(this.scene);

    this.buildSky(); this.buildGround(); this.buildWorld(); this.buildTree();
    this.tank = buildTank(); this.scene.add(this.tank.root);
    this.portal = new THREE.Mesh(new THREE.TorusGeometry(6, 0.5, 16, 64), new THREE.MeshBasicMaterial({ color: '#3ee6ff' }));
    this.portal.rotation.x = Math.PI / 2; this.portal.visible = false; this.scene.add(this.portal);

    this.applyQuality();
    this.resize();
    window.addEventListener('resize', this.resize);
    this.bindInput();
    this.bindAudio();
    this.resetRun();
    this.setMode('title');
    this.raf = requestAnimationFrame(this.loop);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }

  // ═══════════════════════════ build ═══════════════════════════
  private buildSky() {
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyU,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; uniform vec3 uTop; uniform vec3 uBottom; uniform float uNeon; uniform float uTime;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        void main(){
          float y = clamp(vP.y, -0.1, 1.0);
          vec3 c = mix(uBottom, uTop, pow(max(y,0.0), 0.6));
          // aurora ribbons after the remix
          float band = sin(vP.x*6.0 + uTime*0.3 + sin(vP.z*4.0+uTime*0.2)*1.5) * 0.5 + 0.5;
          float aur = smoothstep(0.15, 0.55, y) * smoothstep(0.75, 0.35, y) * pow(band, 3.0);
          c += uNeon * aur * mix(vec3(0.9,0.2,0.8), vec3(0.2,0.9,1.0), band) * 0.55;
          vec2 g = floor(vP.xz / max(0.2, vP.y) * 160.0);
          float star = step(0.9965, h(g)) * smoothstep(0.2, 0.6, y) * uNeon;
          gl_FragColor = vec4(c + star * 1.4, 1.0);
        }`,
    }));
    this.scene.add(this.sky);
    // distant skyline ring: windows light up with the remix
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d')!;
    g.fillStyle = '#000'; g.fillRect(0, 0, 64, 256);
    for (let y = 4; y < 256; y += 10) for (let x = 4; x < 64; x += 10) if (Math.random() < 0.55) { g.fillStyle = ['#ffd27a', '#ff3ec8', '#3ee6ff', '#ffffff'][(Math.random() * 4) | 0]; g.fillRect(x, y, 5, 6); }
    const em = new THREE.CanvasTexture(c); em.colorSpace = THREE.SRGBColorSpace; em.wrapS = em.wrapT = THREE.RepeatWrapping;
    this.skylineMat = new THREE.MeshStandardMaterial({ color: '#2a2e38', emissive: '#ffffff', emissiveMap: em, emissiveIntensity: 0.05, roughness: 0.9, fog: true });
    const N = 140;
    this.skyline = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.skylineMat, N);
    const m = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, r = rand(230, 320), h = rand(30, 120), w = rand(14, 30);
      m.compose(new THREE.Vector3(Math.sin(a) * r, h / 2 - 2, 130 + Math.cos(a) * r), new THREE.Quaternion().setFromAxisAngle(UP, a), new THREE.Vector3(w, h, w));
      this.skyline.setMatrixAt(i, m);
    }
    this.scene.add(this.skyline);
  }

  private buildGround() {
    const snow = new THREE.MeshStandardMaterial({ color: '#c6ccd6', roughness: 0.95 });
    const base = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), snow); base.rotation.x = -Math.PI / 2; base.receiveShadow = true; this.scene.add(base);
    const asphalt = new THREE.MeshStandardMaterial({ map: groundTex.asphalt(), roughness: 0.6, metalness: 0.1, color: '#ffffff' });
    const tiles = new THREE.MeshStandardMaterial({ map: groundTex.tiles(), roughness: 0.7, metalness: 0.05 });
    this.groundMats.push(asphalt, tiles, snow);
    const plane = (w: number, d: number, x: number, z: number, mat: THREE.Material, y = 0.02) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = true; this.scene.add(p); return p;
    };
    plane(26, 90, 0, 40, tiles, 0.015); plane(18, 90, 0, 40, asphalt);
    plane(84, 76, 0, 121, tiles, 0.015); plane(22, 32, 0, 172, asphalt);
    const lanes = new THREE.MeshBasicMaterial({ map: groundTex.lanes(), transparent: true, depthWrite: false });
    plane(0.6, 88, 0, 40, lanes, 0.03);
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(PLAZA.r + 2, 64), tiles); plaza.rotation.x = -Math.PI / 2; plaza.position.set(PLAZA.x, 0.018, PLAZA.z); plaza.receiveShadow = true; this.scene.add(plaza);
    // glowing ring around the plaza (lights at THE DROP)
    const ring = new THREE.Mesh(new THREE.RingGeometry(PLAZA.r - 0.6, PLAZA.r, 96), new THREE.MeshBasicMaterial({ color: '#3a3f4a' }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(PLAZA.x, 0.03, PLAZA.z); ring.name = 'plazaRing'; this.scene.add(ring);
    // boss pit
    const pit = new THREE.Mesh(new THREE.CircleGeometry(8, 48), new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 1 }));
    pit.rotation.x = -Math.PI / 2; pit.position.set(BOSS_POS.x, 0.035, BOSS_POS.z); this.scene.add(pit);
  }

  private buildWorld() {
    placed.forEach((def, i) => {
      const r = this.makeRemixable(def, i);
      if (def.solid) {
        const hw = def.kind === 'building' ? Math.max(def.w, def.d) / 2 : def.w * 0.4;
        // buildings are axis aligned or rotated by 90°: use the rotated footprint
        const c = Math.abs(Math.cos(def.rot)), s = Math.abs(Math.sin(def.rot));
        const ex = def.kind === 'building' ? (def.w * c + def.d * s) / 2 : hw, ez = def.kind === 'building' ? (def.w * s + def.d * c) / 2 : hw;
        this.colliders.push({ minX: def.x - ex, maxX: def.x + ex, minZ: def.z - ez, maxZ: def.z + ez, h: r.size });
      }
    });
    citizenDefs.forEach((c, i) => this.makeCitizen(c.x, c.z, c.rot, c.zone, c.model, i));
    gateDefs.forEach((g) => {
      const col: Collider = { minX: g.x - g.w / 2, maxX: g.x + g.w / 2, minZ: g.z - g.d / 2, maxZ: g.z + g.d / 2, h: 2, tag: g.zone };
      this.gateColliders.push(col);
      const meshes: THREE.Object3D[] = [];
      for (let x = -g.w / 2 + 2; x < g.w / 2; x += 4) {
        const glb = getGLB('PR_BARRICADE');
        const m = glb ? fitModel(cloneScene(glb), 4, 1.5, 2, 'contain') : proceduralModel('PR_BARRICADE');
        m.position.set(g.x + x, 0, g.z); this.scene.add(m); meshes.push(m);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(g.w, 0.15, 0.15), new THREE.MeshBasicMaterial({ color: '#ff2a3a' }));
      beam.position.set(g.x, 2.4, g.z); this.scene.add(beam); meshes.push(beam);
      this.gateMeshes.push(meshes);
    });
  }

  private makeRemixable(def: Placed, i: number): Remixable {
    const u = newRemixUniforms();
    const fit = (o: THREE.Object3D) => fitModel(o, def.w, def.d, def.h, def.kind === 'building' ? 'footprint' : 'contain');
    const neonG = getGLB(def.asset), greyG = getGLB(def.asset, 'grey');
    const neon = fit(neonG ? cloneScene(neonG) : proceduralModel(def.asset, i));
    const grey = fit(greyG ? cloneScene(greyG) : neonG ? cloneScene(neonG) : proceduralModel(def.asset, i));
    applyRemix(neon, u, 1, false);
    applyRemix(grey, u, 0, !greyG);
    const root = new THREE.Group();
    root.add(grey, neon); neon.visible = false;
    root.position.set(def.x, def.y ?? 0, def.z); root.rotation.y = def.rot;
    this.scene.add(root);
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(V()); const size = box.getSize(V());
    const r: Remixable = { zone: def.zone, root, grey, neon, u, paint: 0, hp: def.paintHp, weight: def.weight, state: 'grey', center, radius: Math.max(size.x, size.y, size.z) * 0.5, t: 0, size: size.y, kind: def.kind };
    this.remix.push(r);
    return r;
  }

  private makeCitizen(x: number, z: number, rot: number, zone: Zone, model: string, i: number) {
    const u = newRemixUniforms();
    const anim = getGLB(model, 'anim');
    const root = new THREE.Group(); root.position.set(x, 0, z); root.rotation.y = rot;
    const mixers: THREE.AnimationMixer[] = [];
    let dance: THREE.AnimationAction | undefined, fallback: THREE.Object3D | undefined;
    let grey: THREE.Object3D, neon: THREE.Object3D;
    if (anim) {
      const mk = () => fitModel(cloneScene(anim), 1.2, 1.2, 1.75, 'height');
      grey = mk(); neon = mk();
      const clip = (name: string) => anim.animations.find((a) => a.name.toLowerCase().includes(name)) ?? anim.animations[0];
      const mg = new THREE.AnimationMixer(grey); const idle = mg.clipAction(clip('idle')); idle.play(); mg.update(0.3); // frozen mid-pose
      const mn = new THREE.AnimationMixer(neon); dance = mn.clipAction(clip('dance')); dance.play(); dance.time = Math.random() * 2;
      mixers.push(mn);
    } else {
      grey = buildCitizenFallback(i); neon = buildCitizenFallback(i); fallback = neon;
    }
    applyRemix(grey, u, 0, true); applyRemix(neon, u, 1, false);
    neon.visible = false;
    root.add(grey, neon); this.scene.add(root);
    this.remix.push({ zone, root, grey, neon, u, paint: 0, hp: 2, weight: 1, state: 'grey', center: new THREE.Vector3(x, 1, z), radius: 1.2, t: 0, size: 2, kind: 'citizen', citizen: { mixers, dance, fallback, phase: Math.random() * 6 } });
  }

  private buildTree() {
    const n = 420; const pos = new Float32Array(n * 3); const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = i / n, a = t * 34, r = 5.6 * (1 - t) + 0.5;
      pos.set([TREE.x + Math.sin(a) * r, 2 + t * 21, TREE.z + Math.cos(a) * r], i * 3);
      const c = NEON[i % NEON.length]; col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setDrawRange(0, 0);
    this.treeLights = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(this.treeLights);
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, r = i % 2 ? 0.9 : 2.1; i ? shape.lineTo(Math.sin(a) * r, Math.cos(a) * r) : shape.moveTo(0, r); }
    this.treeStar = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffc83d', emissiveIntensity: 0.2 }));
    this.treeStar.position.set(TREE.x, 25.5, TREE.z); this.scene.add(this.treeStar);
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(NEON[i].getHex(), 0, 45, 1.5); const a = (i / 4) * Math.PI * 2;
      l.position.set(PLAZA.x + Math.sin(a) * 24, 9, PLAZA.z + Math.cos(a) * 24); this.scene.add(l); this.plazaLights.push(l);
    }
  }

  // ═══════════════════════════ lifecycle ═══════════════════════════
  resetRun() {
    // world back to grey
    for (const r of this.remix) { r.state = 'grey'; r.paint = 0; r.u.uRadius.value = -1; r.grey.visible = true; r.neon.visible = false; }
    for (const e of this.enemies) this.scene.remove(e.obj);
    this.enemies = [];
    for (const p of this.projs) this.scene.remove(p.mesh);
    this.projs = [];
    for (const p of this.pickups) this.scene.remove(p.obj);
    this.pickups = [];
    if (this.boss) { this.scene.remove(this.boss.root); this.boss.foam.forEach((f) => this.scene.remove(f.mesh)); this.boss.telegraph && this.scene.remove(this.boss.telegraph); this.boss = null; }
    this.gateMeshes.forEach((ms) => ms.forEach((m) => (m.visible = true)));
    this.gateOpen = { A: false, B: false, C: false };
    this.visited = { A: true, B: false, C: false };
    this.spawned = { A: 0, B: 0, C: 0 };
    this.pylonsLeft = 4; this.dozerSpawned = false; this.checkpoint = 'A';
    this.dropDone = false; this.neon = 0; this.neonTarget = 0; this.treeLit = 0;
    this.combo = 0; this.tier = 1; this.bassDrop = 0; this.special = null; this.tutorial = 0;
    this.stats = emptyStats();
    this.particles.clear(); this.rings.clear(); this.splats.clear();
    this.placeSpawn('A');
    for (const v of vinyls) this.addPickup(v.x, v.z, 'vinyl');
    for (const p of pickupDefs) this.addPickup(p.x, p.z, p.type);
    // pylons guard the tree from the start
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; this.spawnEnemy('pylon', TREE.x + Math.sin(a) * 13, TREE.z + Math.cos(a) * 13, 'C'); }
    this.hp = 300;
    useUI.getState().set({ hp: 300, boss: null, special: null, combo: 0, tier: 1, meters: { A: 0, B: 0, C: 0 }, stats: this.stats, objective: '' });
  }

  private placeSpawn(z: Zone) {
    const c = CHECKPOINTS[z];
    this.pos.set(c.x, 0, c.z); this.yaw = 0; this.speed = 0; this.vy = 0; this.turretYaw = 0; this.camYaw = 0;
    this.camPos.set(c.x, 6, c.z - 12); this.camLook.set(c.x, 2, c.z + 5);
  }

  setMode(m: Game['mode']) {
    this.mode = m; this.modeT = 0;
    const ui = useUI.getState();
    const a = audio();
    if (m === 'title') { ui.set({ screen: 'title' }); this.tank.root.visible = true; }
    if (m === 'intro') {
      ui.set({ screen: 'intro' });
      this.tank.root.visible = false;
      a.start('intro'); a.engineStart();
    }
    if (m === 'play') { ui.set({ screen: 'playing' }); this.tank.root.visible = true; }
    if (m === 'outro') { ui.set({ screen: 'outro' }); document.exitPointerLock?.(); }
  }

  startGame() { this.resetRun(); this.setMode('intro'); }
  skipIntro() { if (this.mode === 'intro' && this.modeT > 0.5) this.modeT = 13; }
  pause(on: boolean) {
    if (on && (this.mode === 'play' || this.mode === 'drop')) { this.prevMode = this.mode; this.mode = 'paused'; audio().ctx.suspend(); useUI.getState().set({ screen: 'paused' }); }
    else if (!on && this.mode === 'paused') { this.mode = this.prevMode; audio().ctx.resume(); useUI.getState().set({ screen: 'playing' }); this.canvas.requestPointerLock?.(); }
  }
  private prevMode: Game['mode'] = 'play';
  quitToTitle() {
    audio().stop(); audio().engineStop(); audio().ctx.resume();
    this.resetRun(); this.setMode('title');
    audio().start('title');
  }

  // ═══════════════════════════ input ═══════════════════════════
  private bindInput() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Escape' && this.mode === 'paused') this.pause(false);
      if (e.code === 'Space' && this.mode === 'intro') this.skipIntro();
      if (e.code === 'Space' && (this.mode === 'play' || this.mode === 'drop')) this.fireBassDrop();
      if ((e.code === 'KeyE') && (this.mode === 'play' || this.mode === 'drop')) this.useSpecial();
      if (e.code === 'KeyP') this.pause(this.mode !== 'paused');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.mode === 'intro') { this.skipIntro(); return; }
      if (!this.locked && (this.mode === 'play' || this.mode === 'drop')) { this.canvas.requestPointerLock?.(); return; }
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.useSpecial();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked && (this.mode === 'play' || this.mode === 'drop')) this.pause(true);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const s = useUI.getState().settings;
      this.camYaw -= e.movementX * 0.0022 * s.sensitivity;
      this.camPitch = clamp(this.camPitch + e.movementY * 0.0018 * s.sensitivity * (s.invertY ? -1 : 1), -0.1, 0.75);
    });
  }

  // ═══════════════════════════ audio / director ═══════════════════════════
  private bindAudio() {
    const a = audio();
    a.gate = (s: Section) => {
      if (s === 'title' || s === 'end') return false;
      if (s === 'buildA') return this.gateOpen.A;
      if (s === 'buildB') return this.gateOpen.B;
      if (s === 'buildC') return this.meter('C') >= 100;
      if (s === 'drop') return !!this.boss && this.boss.phase >= 2;
      if (s === 'drop2') return !!this.boss && !this.boss.alive;
      return true;
    };
    a.onBeat = (b) => this.onBeat(b);
    a.onBar = (bar, sec, sb) => this.onBar(bar, sec, sb);
    a.onSection = (s) => this.onSection(s);
  }

  private onBeat(b: number) {
    if (this.mode === 'title' || this.mode === 'paused') return;
    this.tank.speakers.forEach((s) => s.scale.setScalar(1.18));
    if (useUI.getState().settings.beatPulse) this.fovKick = Math.max(this.fovKick, 0.9);
    if (this.special?.type === 'subwoofer' && this.mode !== 'outro') {
      this.rings.spawn(this.pos, '#a46bff', 8, 0.5);
      this.paintAt(this.pos.clone().setY(1), 8, 1.2, 'good');
      this.damageArea(this.pos, 8, 25);
    }
    // towers pulse silence rings every 2 bars
    if (b === 0) for (const e of this.enemies) if (e.alive && e.kind === 'tower') {
      e.yaw++; // towers never turn, so yaw doubles as their bar counter
      if (e.yaw % 2 === 0) { this.rings.spawn(e.pos, '#8fa1b8', 18, 1.6, 0.2, 0.06); this.silenceRing(e.pos); }
    }
    if (this.boss?.alive && this.boss.rise >= 1) this.boss.panels.forEach((p, i) => { if (this.boss!.hp[i] > 0) (p.children[0] as THREE.Mesh).scale.x = 1.2; });
  }

  private silenceRing(center: THREE.Vector3) {
    const p = center.clone();
    const t0 = audio().now();
    const check = () => {
      const r = (audio().now() - t0) / 1.6 * 18;
      const d = Math.hypot(this.pos.x - p.x, this.pos.z - p.z);
      if (Math.abs(d - r) < 1.6 && this.invuln <= 0) { this.hurt(15); this.slowT = 1.5; return; }
      if (r < 18) requestAnimationFrame(check);
    };
    check();
  }

  private onSection(s: Section) {
    if (this.mode === 'title') return;
    const tierLayer = Math.max(0, this.tier - 1);
    audio().intensity = tierLayer;
    if (s === 'intro2' && this.mode === 'play') this.objective();
    if (s === 'breakdown') toast('Breakdown — cruise to the Market and grab the Vinyls');
    if (s === 'preDrop' && !this.dozerSpawned) {
      this.dozerSpawned = true;
      const z = this.pos.z < 150 ? Math.min(150, this.pos.z + 30) : 150;
      this.spawnEnemy('dozer', 0, z, 'B'); banner('SLEIGH-DOZER', 'It plows the party away. Break it!');
    }
    if (s === 'silence') this.dropSilence();
    if (s === 'drop' && !this.dropDone) this.theDrop();
    if (s === 'outro' && this.mode !== 'outro') { /* boss death handles */ }
  }

  private onBar(bar: number, sec: Section, sb: number) {
    if (this.mode !== 'play' && this.mode !== 'drop') return;
    // tutorial prompts
    if (this.tutorial < 4 && bar >= 1) {
      const msgs = ['WASD to drive · MOUSE to aim', 'CLICK to fire — shoot the grey shops!', 'Fire ON THE BEAT for bigger paint splashes', 'Remix 60% of Slush Street to break the barricade'];
      if (bar % 2 === 1) toast(msgs[this.tutorial++]);
    }
    const zone = zoneAt(this.pos.z);
    const alive = (k?: EnemyKind) => this.enemies.filter((e) => e.alive && (!k || e.kind === k) && e.zone === zone).length;
    if (zone === 'A' && !this.gateOpen.A) {
      if (bar >= 8 && bar % 4 === 0 && alive('drone') < 4 && this.spawned.A < 22) this.spawnWave('drone', 3, 'A');
      if (sec === 'buildA' && sb === 0 && alive('tower') === 0 && this.spawned.A < 30) { this.spawnEnemy('tower', -8.5, 58, 'A'); this.spawnEnemy('tower', 8.5, 30, 'A'); }
    }
    if (zone === 'B' && !this.gateOpen.B) {
      if (bar % 4 === 0 && alive('mute') < 2 && this.spawned.B < 7) { this.spawnEnemy('mute', rand(-25, 25), Math.min(150, this.pos.z + 35), 'B'); }
      if (bar % 4 === 2 && alive('drone') < 6 && this.spawned.B < 34) this.spawnWave('drone', 4, 'B');
    }
    if (zone === 'C' && !this.dropDone && bar % 4 === 0 && alive('drone') < 6) this.spawnWave('drone', 3, 'C');
    if (this.boss?.alive && this.boss.rise >= 1 && bar % 8 === 4 && alive('drone') < 6) this.spawnWave('drone', 3, 'C');
  }

  private objective() {
    const ui = useUI.getState();
    let text = '';
    if (!this.gateOpen.A) text = `Remix Slush Street  ${this.meter('A') | 0}/60%`;
    else if (!this.gateOpen.B) text = `Remix the Market  ${this.meter('B') | 0}/60%`;
    else if (!this.dropDone) text = this.pylonsLeft > 0 ? `Plaza of Lights  ${this.meter('C') | 0}%  ·  Pylons left ${this.pylonsLeft}` : `Fill the Plaza  ${this.meter('C') | 0}/100% for THE DROP`;
    else if (this.boss && this.boss.phase < 2) text = 'Break the 4 dampener panels';
    else if (this.boss?.alive) text = 'Hit the Mute Crystal ON THE BEAT';
    if (text !== ui.objective) ui.set({ objective: text });
  }

  meter(z: Zone) {
    let tot = 0, done = 0;
    for (const r of this.remix) if (r.zone === z) { tot += r.weight; if (r.state !== 'grey') done += r.weight; }
    const frac = tot ? done / tot : 0;
    if (z === 'C') return Math.min(100, (Math.min(1, frac / 0.55) * 0.5 + (4 - this.pylonsLeft) * 0.125) * 100);
    return Math.min(100, (frac / 0.75) * 100);
  }

  private checkGates() {
    for (const z of ['A', 'B'] as Zone[]) {
      if (!this.gateOpen[z] && this.meter(z) >= 60) {
        this.gateOpen[z] = true;
        const idx = z === 'A' ? 0 : 1;
        this.gateMeshes[idx].forEach((m) => { m.visible = false; this.particles.burst(m.position.clone().setY(1.5), 50, 12, { up: 6, size: 0.45, life: 1.6 }); });
        audio().sfxExplode(true);
        banner(z === 'A' ? 'SLUSH STREET REMIXED' : 'MARKET REMIXED', z === 'A' ? 'The barricade is down — roll to the Market' : 'Grand Avenue is open — the Plaza awaits');
        this.addScore(2000);
      }
    }
  }

  // ═══════════════════════════ THE DROP ═══════════════════════════
  private dropSilence() {
    if (this.dropDone) return;
    this.mode = 'drop'; this.modeT = 0;
    this.hue.saturation = -1;
    banner('', '');
  }

  private theDrop() {
    this.dropDone = true; this.mode = 'drop'; this.modeT = 0;
    const origin = new THREE.Vector3(TREE.x, 3, TREE.z);
    for (const r of this.remix) {
      if (r.state !== 'grey') continue;
      const d = r.center.distanceTo(origin);
      setTimeout(() => this.startRemix(r, r.center.clone().setY(0), false), (d / 60) * 1000);
    }
    this.neonTarget = 1;
    this.bloom.intensity = 2.6;
    this.lasers.active = audio().spb * 16;
    for (let i = 0; i < 8; i++) setTimeout(() => this.firework(new THREE.Vector3(rand(-60, 60), rand(30, 55), PLAZA.z + rand(-40, 60))), i * 260);
    banner('THE DROP', 'The district is back in color!');
    audio().sfxCheer();
    this.addScore(5000);
    this.shake = 1.2;
    const ring = this.scene.getObjectByName('plazaRing') as THREE.Mesh;
    (ring.material as THREE.MeshBasicMaterial).color.set('#ff3ec8');
    // the Silencer rises two bars later
    setTimeout(() => this.spawnBoss(), audio().spb * 8 * 1000);
  }

  private firework(p: THREE.Vector3) {
    const c = NEON[(Math.random() * NEON.length) | 0];
    this.particles.burst(p, 140, 22, { colors: [c, c, new THREE.Color('#ffffff')], size: 0.9, life: 1.8, grav: 4 });
    audio().sfxFirework();
  }

  // ═══════════════════════════ boss ═══════════════════════════
  private spawnBoss() {
    if (this.boss) return;
    const rig = buildSilencer();
    rig.root.position.set(BOSS_POS.x, -16, BOSS_POS.z);
    this.scene.add(rig.root);
    this.boss = { ...rig, hp: [300, 300, 300, 300], crystalHp: 800, phase: 1, rise: 0, t: 0, waveT: 0, nextAttack: 4, foam: [], alive: true };
    banner('THE SILENCER', 'Break its 4 dampener panels');
    audio().sfxHorn();
    this.shake = 1.5;
    this.colliders.push({ minX: BOSS_POS.x - 7, maxX: BOSS_POS.x + 7, minZ: BOSS_POS.z - 7, maxZ: BOSS_POS.z + 7, h: 14, tag: 'boss' });
    this.syncBossUI();
  }
  private syncBossUI() {
    const b = this.boss; if (!b) return;
    useUI.getState().set({ boss: b.alive ? { name: 'THE SILENCER', parts: b.phase < 2 ? b.hp.map((h) => h / 300) : [b.crystalHp / 800], phase: b.phase } : null });
  }

  private updateBoss(dt: number) {
    const b = this.boss; if (!b || !b.alive) return;
    b.t += dt;
    if (b.rise < 1) {
      b.rise = Math.min(1, b.rise + dt / 4);
      b.root.position.y = -16 + 16 * (1 - Math.pow(1 - b.rise, 3));
      this.shake = Math.max(this.shake, 0.4);
      if (Math.random() < 0.5) this.particles.burst(new THREE.Vector3(BOSS_POS.x + rand(-8, 8), 0.5, BOSS_POS.z + rand(-8, 8)), 3, 4, { colors: [new THREE.Color('#8a8f99')], size: 0.8, life: 1.5, up: 4 });
      return;
    }
    // face the player slowly
    const want = Math.atan2(this.pos.x - BOSS_POS.x, this.pos.z - BOSS_POS.z);
    b.root.rotation.y = damp(b.root.rotation.y, want, 0.6, dt);
    b.panels.forEach((p, i) => { const s = p.children[0] as THREE.Mesh; s.scale.x = damp(s.scale.x, 1, 8, dt); if (b.hp[i] <= 0 && p.visible) { p.position.y -= dt * 4; p.rotation.x += dt * 2; if (p.position.y < -5) p.visible = false; } });
    b.crystal.rotation.y += dt * (b.phase === 2 ? 2.5 : 0.6);
    (b.crystal.material as THREE.MeshStandardMaterial).emissiveIntensity = 2 + Math.sin(b.t * 6) * 0.8 + (b.phase === 2 ? 2 : 0);
    // attacks
    b.nextAttack -= dt;
    if (b.nextAttack <= 0) {
      const r = Math.random();
      if (r < 0.5) this.bossMuteWave(); else this.bossFoamRain();
      b.nextAttack = (b.phase === 2 ? 4 : 6) * audio().spb;
    }
    if (b.telegraph) {
      b.waveT += dt;
      const mat = b.telegraph.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.15 + 0.25 * Math.abs(Math.sin(b.waveT * 10));
      if (b.waveT >= audio().spb * 4) { // fire!
        const ang = b.telegraph.userData.ang as number;
        const dx = this.pos.x - BOSS_POS.x, dz = this.pos.z - BOSS_POS.z;
        let da = Math.atan2(dx, dz) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < 0.38 && Math.hypot(dx, dz) < 60 && this.invuln <= 0) { this.hurt(35); this.slowT = 2; }
        this.rings.spawn(new THREE.Vector3(BOSS_POS.x, 0, BOSS_POS.z), '#9fb3c9', 55, 0.9, 0.3, 0.05);
        audio().sfxHorn(); this.shake = 0.8; this.hue.saturation = -0.9;
        this.scene.remove(b.telegraph); b.telegraph = undefined;
      }
    }
    b.foam = b.foam.filter((f) => {
      f.t -= dt; f.mesh.scale.setScalar(Math.min(1, f.t));
      if (f.t <= 0) { this.scene.remove(f.mesh); return false; }
      if (Math.hypot(this.pos.x - f.pos.x, this.pos.z - f.pos.z) < 3.5) this.slowT = Math.max(this.slowT, 0.3);
      return true;
    });
  }

  private bossMuteWave() {
    const b = this.boss!; if (b.telegraph) return;
    const ang = Math.atan2(this.pos.x - BOSS_POS.x, this.pos.z - BOSS_POS.z);
    const g = new THREE.CircleGeometry(60, 32, -0.38, 0.76); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#c9d7ea', transparent: true, opacity: 0.2, depthWrite: false }));
    // wedge is centred on +X after rotateX; rotating +X by (ang - π/2) points it at (sin ang, cos ang)
    m.position.set(BOSS_POS.x, 0.08, BOSS_POS.z); m.rotation.y = ang - Math.PI / 2; m.userData.ang = ang;
    this.scene.add(m); b.telegraph = m; b.waveT = 0;
    toast('MUTE WAVE — get out of the cone!');
  }

  private bossFoamRain() {
    const b = this.boss!;
    for (let i = 0; i < (b.phase === 2 ? 6 : 4); i++) {
      const target = new THREE.Vector3(this.pos.x + rand(-10, 10), 0, this.pos.z + rand(-10, 10));
      const from = b.hornMouth.getWorldPosition(V());
      const T = 1.6;
      const vel = target.clone().sub(from).divideScalar(T); vel.y = (0 - from.y) / T + 0.5 * 9.8 * T;
      this.spawnProj(from, vel, 'enemy', 18, 'foam');
    }
  }

  private hitBoss(p: THREE.Vector3, dmg: number, j: Judgement): boolean {
    const b = this.boss; if (!b || !b.alive || b.rise < 1) return false;
    if (b.phase === 1) {
      for (let i = 0; i < 4; i++) {
        if (b.hp[i] <= 0) continue;
        const wp = b.panels[i].getWorldPosition(V());
        if (wp.distanceTo(p) < 4.2) {
          b.hp[i] = Math.max(0, b.hp[i] - dmg);
          (b.panels[i].material as THREE.MeshStandardMaterial).emissive.set('#ff3ec8');
          setTimeout(() => (b.panels[i].material as THREE.MeshStandardMaterial).emissive.set('#000'), 80);
          if (b.hp[i] <= 0) {
            this.particles.burst(wp, 120, 16, { up: 5, size: 0.6, life: 1.6 }); audio().sfxExplode(true); this.addScore(2500); this.shake = 0.9;
            toast(`Panel down! ${b.hp.filter((h) => h > 0).length} left`);
            if (b.hp.every((h) => h <= 0)) { b.phase = 2; banner('PHASE 2', 'Mute Crystal exposed — ON-BEAT shots only!'); }
          }
          this.syncBossUI();
          return true;
        }
      }
      if (b.crystal.getWorldPosition(V()).distanceTo(p) < 4) { this.words.pop('SHIELDED', '#9aa3b5', p.clone().setY(p.y + 2)); return true; }
    } else {
      const cp = b.crystal.getWorldPosition(V());
      if (cp.distanceTo(p) < 4.5) {
        if (j === 'off') { this.words.pop('ON THE BEAT!', '#9aa3b5', cp.clone().setY(cp.y + 3)); return true; }
        b.crystalHp = Math.max(0, b.crystalHp - dmg * (j === 'perfect' ? 1.5 : 1));
        this.particles.burst(p, 20, 8, { colors: [new THREE.Color('#9fd8ff'), new THREE.Color('#ffffff')] });
        if (b.crystalHp <= 0) this.killBoss();
        this.syncBossUI();
        return true;
      }
    }
    return false;
  }

  private killBoss() {
    const b = this.boss!; b.alive = false;
    const cp = b.crystal.getWorldPosition(V());
    for (let i = 0; i < 4; i++) setTimeout(() => this.particles.burst(cp, 300, 30, { size: 0.8, life: 2.2, grav: 5 }), i * 120);
    for (let i = 0; i < 24; i++) setTimeout(() => this.firework(new THREE.Vector3(rand(-70, 70), rand(25, 60), PLAZA.z + rand(-50, 60))), 300 + i * 330);
    audio().sfxExplode(true); audio().sfxCheer();
    b.crystal.visible = false; this.shake = 2;
    this.addScore(15000);
    for (const e of this.enemies) if (e.alive) this.killEnemy(e, false);
    this.colliders = this.colliders.filter((c) => c.tag !== 'boss');
    banner('PARTY\'S BACK.', 'The Silencer is remixed into fireworks');
    useUI.getState().set({ boss: null });
    setTimeout(() => { this.scene.remove(b.root); }, 2500);
    setTimeout(() => this.setMode('outro'), 1800);
  }

  // ═══════════════════════════ enemies ═══════════════════════════
  private spawnWave(kind: EnemyKind, n: number, zone: Zone) {
    for (let i = 0; i < n; i++) {
      const a = rand(-1.2, 1.2) + this.yaw;
      let x = this.pos.x + Math.sin(a) * rand(30, 45), z = this.pos.z + Math.cos(a) * rand(30, 45);
      if (zone === 'A') x = clamp(x, -10, 10);
      if (zone === 'C' && !this.dropDone) { x = clamp(x, -35, 35); z = clamp(z, 190, 255); }
      this.spawnEnemy(kind, x, z, zone);
    }
  }

  spawnEnemy(kind: EnemyKind, x: number, z: number, zone: Zone) {
    const obj = kind === 'drone' ? buildDrone() : kind === 'tower' ? buildTower() : kind === 'pylon' ? buildPylon() : buildMuteTank(kind === 'dozer');
    const st = ENEMY_STATS[kind];
    const pos = new THREE.Vector3(x, kind === 'drone' ? 22 : 0, z);
    obj.position.copy(pos); this.scene.add(obj);
    this.enemies.push({ kind, obj, pos, hp: st.hp, maxHp: st.hp, radius: st.r, zone, t: Math.random() * 3, cd: 0, vel: V(), yaw: 0, alive: true, hitFlash: 0 });
    this.spawned[zone]++;
    if (kind !== 'pylon') this.rings.spawn(pos.clone().setY(0), '#ff2a3a', 3, 0.6);
  }

  private updateEnemies(dt: number) {
    const spb = audio().spb;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.t += dt; e.cd -= dt; e.hitFlash = Math.max(0, e.hitFlash - dt);
      const toP = new THREE.Vector3(this.pos.x - e.pos.x, 0, this.pos.z - e.pos.z);
      const dist = toP.length(); toP.normalize();
      if (e.kind === 'drone') {
        const orbit = new THREE.Vector3(-toP.z, 0, toP.x).multiplyScalar(Math.sin(e.t * 0.7) > 0 ? 1 : -1);
        const want = toP.clone().multiplyScalar(dist > 20 ? 1 : dist < 14 ? -1 : 0).add(orbit.multiplyScalar(0.8));
        e.vel.lerp(want.multiplyScalar(9), dt * 1.5);
        e.pos.addScaledVector(e.vel, dt);
        e.pos.y = damp(e.pos.y, 7 + Math.sin(e.t * 2) * 1.2, 1.5, dt);
        e.obj.position.copy(e.pos);
        e.obj.rotation.set(e.vel.z * 0.04, Math.atan2(toP.x, toP.z), -e.vel.x * 0.04);
        if (e.cd <= 0 && dist < 45 && this.mode !== 'outro') {
          e.cd = spb * rand(6, 10);
          const from = e.pos.clone(); const target = this.pos.clone().setY(1.5);
          this.spawnProj(from, target.sub(from).normalize().multiplyScalar(16), 'enemy', 10, 'orb');
        }
      } else if (e.kind === 'mute' || e.kind === 'dozer') {
        const desired = e.kind === 'dozer' ? 0 : 22;
        const charge = e.kind === 'dozer' && Math.sin(e.t * 0.45) > 0.6;
        const fwd = dist > desired ? 1 : -0.4;
        const ang = Math.atan2(toP.x, toP.z);
        e.yaw += Math.atan2(Math.sin(ang - e.yaw), Math.cos(ang - e.yaw)) * Math.min(1, dt * (charge ? 3 : 1.4));
        const sp = (e.kind === 'dozer' ? (charge ? 18 : 5) : 5.5) * fwd;
        const nx = e.pos.x + Math.sin(e.yaw) * sp * dt, nz = e.pos.z + Math.cos(e.yaw) * sp * dt;
        if (inBounds(nx, nz, 3) && !this.collides(nx, nz, 2.5)) { e.pos.x = nx; e.pos.z = nz; }
        e.obj.position.copy(e.pos); e.obj.rotation.y = e.yaw;
        if (e.kind === 'dozer' && dist < 5.5 && this.invuln <= 0) { this.hurt(30); this.speed = -8; this.shake = 1; }
        if (e.cd <= 0 && dist < 50 && this.mode !== 'outro') {
          e.cd = spb * (e.kind === 'dozer' ? 4 : 3) * rand(1, 1.6);
          const from = e.pos.clone().setY(2.2).addScaledVector(toP, 3);
          this.spawnProj(from, this.pos.clone().setY(1.2).sub(from).normalize().multiplyScalar(34), 'enemy', e.kind === 'dozer' ? 30 : 25, 'shell');
        }
      } else if (e.kind === 'pylon') {
        // beam drains the tree: pulse
        e.obj.rotation.y += dt * 0.8;
      }
      if (e.hitFlash > 0) e.obj.scale.setScalar(1 + e.hitFlash * 0.6); else e.obj.scale.setScalar(1);
    }
  }

  private damageEnemy(e: Enemy, dmg: number, at: THREE.Vector3) {
    e.hp -= dmg; e.hitFlash = 0.12;
    this.particles.burst(at, 10, 6, { size: 0.3, life: 0.4 });
    if (e.hp <= 0) this.killEnemy(e, true);
  }

  private killEnemy(e: Enemy, score: boolean) {
    e.alive = false;
    const p = e.pos.clone().setY(e.kind === 'drone' ? e.pos.y : 2);
    this.particles.burst(p, e.kind === 'drone' ? 70 : 160, e.kind === 'drone' ? 10 : 16, { up: 4, size: 0.45, life: 1.4 });
    this.rings.spawn(p.clone().setY(0), '#ffc83d', e.kind === 'drone' ? 5 : 10, 0.6);
    audio().sfxExplode(e.kind !== 'drone');
    this.paintAt(p, e.kind === 'drone' ? 3 : e.kind === 'pylon' ? 8 : 6, 2, 'good');
    // part-split style debris: pieces fly then vanish
    const obj = e.obj;
    const pieces = [...obj.children];
    pieces.forEach((c) => {
      const v = new THREE.Vector3(rand(-6, 6), rand(6, 12), rand(-6, 6)); const spin = new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6));
      const start = performance.now();
      const step = () => {
        const t = (performance.now() - start) / 1000; if (t > 1.6) { this.scene.remove(obj); return; }
        c.position.addScaledVector(v, 0.016); v.y -= 0.016 * 18; c.rotation.x += spin.x * 0.016; c.rotation.y += spin.y * 0.016;
        c.scale.multiplyScalar(t > 1 ? 0.92 : 1);
        requestAnimationFrame(step);
      };
      step();
    });
    if (!pieces.length) this.scene.remove(obj);
    if (!score) return;
    this.stats.enemies++;
    this.addScore(ENEMY_STATS[e.kind].pts);
    this.bumpCombo(1);
    this.bassDrop = Math.min(1, this.bassDrop + 0.08);
    if (e.kind === 'pylon') {
      this.pylonsLeft--;
      toast(this.pylonsLeft ? `Pylon down! ${this.pylonsLeft} left` : 'All pylons down — fill the Plaza!');
    }
    if (e.kind === 'dozer') banner('SLEIGH-DOZER REMIXED', 'It exploded into a fountain of gifts');
    if (e.kind === 'dozer') for (let i = 0; i < 5; i++) this.addPickup(e.pos.x + rand(-4, 4), e.pos.z + rand(-4, 4), i === 0 ? 'repair' : 'gift');
  }

  // ═══════════════════════════ projectiles ═══════════════════════════
  private projGeo = new THREE.SphereGeometry(1, 12, 8);
  private spawnProj(from: THREE.Vector3, vel: THREE.Vector3, owner: 'player' | 'enemy', dmg: number, kind: Proj['kind'], judge: Judgement = 'off') {
    const color = owner === 'player' ? JUDGE[judge].color : kind === 'foam' ? '#8b8f99' : '#bcd3ff';
    const m = new THREE.Mesh(this.projGeo, new THREE.MeshBasicMaterial({ color }));
    const r = owner === 'player' ? (judge === 'perfect' ? 0.42 : 0.32) : kind === 'shell' ? 0.3 : kind === 'foam' ? 0.9 : 0.45;
    m.scale.setScalar(r); m.position.copy(from); this.scene.add(m);
    const j = JUDGE[judge];
    const conf = owner === 'player' && this.special?.type === 'confetti';
    this.projs.push({ mesh: m, pos: from.clone(), vel, owner, dmg, life: 2.5, judge, radius: j.r * (conf ? 2 : 1), power: j.power, kind });
    if (owner === 'enemy') audio().sfxEnemyShot();
  }

  private updateProjs(dt: number) {
    const prev = V();
    this.projs = this.projs.filter((p) => {
      prev.copy(p.pos);
      if (p.kind === 'foam') p.vel.y -= 9.8 * dt;
      p.pos.addScaledVector(p.vel, dt); p.life -= dt; p.mesh.position.copy(p.pos);
      if (p.owner === 'player' && Math.random() < 0.9) this.particles.emit(p.pos, V(), NEON[(Math.random() * 6) | 0], 0.25, 0.25, 0);
      let hit = false; let target: Enemy | null = null;
      if (p.owner === 'player') {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const c = e.pos.clone().setY(e.kind === 'drone' ? e.pos.y : e.kind === 'pylon' ? 3 : e.kind === 'tower' ? 4.5 : 1.6);
          if (segSphere(prev, p.pos, c, e.radius + (e.kind === 'tower' || e.kind === 'pylon' ? 1.5 : 0.4))) { hit = true; target = e; break; }
        }
        if (!hit && this.hitBoss(p.pos, p.dmg, p.judge)) hit = true;
      } else if (this.invuln <= 0 && p.pos.distanceTo(this.pos.clone().setY(1.4)) < 2.6 + (p.kind === 'foam' ? 0.5 : 0)) {
        this.hurt(p.dmg); if (p.kind === 'orb') this.slowT = 1; hit = true;
      }
      if (!hit && (p.pos.y <= 0.1 || this.pointInCollider(p.pos))) hit = true;
      if (hit || p.life <= 0) {
        this.scene.remove(p.mesh); (p.mesh.material as THREE.Material).dispose();
        if (p.owner === 'player') {
          if (target) this.damageEnemy(target, p.dmg, p.pos);
          this.impact(p.pos, p.judge, p.radius, p.power);
        } else if (p.kind === 'foam' && this.boss) {
          const fm = new THREE.Mesh(new THREE.CircleGeometry(3.5, 20), new THREE.MeshStandardMaterial({ color: '#6b6f78', roughness: 1 }));
          fm.rotation.x = -Math.PI / 2; fm.position.set(p.pos.x, 0.06, p.pos.z); this.scene.add(fm);
          this.boss.foam.push({ pos: p.pos.clone(), t: 6, mesh: fm });
        } else this.particles.burst(p.pos, 12, 5, { colors: [new THREE.Color('#a9b4c6')], size: 0.3, life: 0.4 });
        return false;
      }
      return true;
    });
  }

  private impact(p: THREE.Vector3, j: Judgement, radius: number, power: number) {
    const c = JUDGE[j];
    this.particles.burst(p, j === 'off' ? 18 : 45, j === 'off' ? 5 : 9, { up: 3, size: j === 'perfect' ? 0.55 : 0.4, life: 0.9 });
    this.rings.spawn(new THREE.Vector3(p.x, 0, p.z), c.color, radius, 0.45);
    if (p.y < 2) this.splats.add(p, radius * 0.45);
    this.paintAt(p, radius, power, j);
    this.damageArea(p, radius * 0.5, 10);
  }

  private damageArea(p: THREE.Vector3, r: number, dmg: number) {
    for (const e of this.enemies) if (e.alive && e.kind !== 'pylon' && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < r) this.damageEnemy(e, dmg, e.pos.clone().setY(1.5));
  }

  // ═══════════════════════════ remix ═══════════════════════════
  private paintAt(p: THREE.Vector3, radius: number, power: number, j: Judgement) {
    for (const r of this.remix) {
      if (r.state !== 'grey') continue;
      const d = Math.max(0, r.center.distanceTo(p) - r.radius);
      if (d > radius) continue;
      const fall = 1 - (d / radius) * 0.6;
      r.paint += power * fall;
      if (r.paint < r.hp) {
        // partial paint: reveal a patch around the impact
        if (r.u.uRadius.value < 0) r.u.uOrigin.value.copy(p);
        r.u.uRadius.value = Math.max(r.u.uRadius.value, (r.paint / r.hp) * r.radius * 0.9);
        r.neon.visible = true;
      } else this.startRemix(r, p, true, j);
    }
  }

  private startRemix(r: Remixable, origin: THREE.Vector3, scored: boolean, j?: Judgement) {
    if (r.state !== 'grey') return;
    r.state = 'remixing'; r.t = 0; r.neon.visible = true;
    if (r.u.uRadius.value < 0) r.u.uOrigin.value.copy(origin);
    if (r.citizen) {
      if (r.citizen.mixers[0]) {/* animated GLB */} r.root.rotation.y = Math.atan2(this.pos.x - r.root.position.x, this.pos.z - r.root.position.z);
    }
    if (!scored) return;
    const pts = r.kind === 'building' ? 500 : r.kind === 'citizen' ? 250 : r.kind === 'tree' ? 2000 : 100;
    this.addScore(pts); this.bumpCombo(1); this.stats.remixed++;
    if (r.kind === 'citizen') { this.stats.citizens++; this.words.pop('FREED!', '#7cff6b', r.center.clone().setY(3.4), 2.6); }
    audio().sfxRemix(this.combo);
    this.particles.burst(r.center, r.kind === 'building' ? 90 : 30, r.kind === 'building' ? 12 : 6, { up: 5, size: 0.5, life: 1.3 });
    this.bassDrop = Math.min(1, this.bassDrop + (r.kind === 'building' ? 0.06 : 0.02));
    if (this.stats.remixed === 1) { banner('REMIXED!', 'You just brought the color back'); this.slowmo = 0.35; }
    this.fovKick = Math.max(this.fovKick, 2);
    void j;
  }
  private slowmo = 0;

  private updateRemix(dt: number) {
    for (const r of this.remix) {
      if (r.state === 'remixing') {
        r.t += dt;
        const k = Math.min(1, r.t / 0.7);
        r.u.uRadius.value = Math.max(r.u.uRadius.value, (1 - Math.pow(1 - k, 2)) * (r.radius * 2.6 + 3));
        if (k >= 1) { r.state = 'neon'; r.grey.visible = false; r.u.uRadius.value = 9999; }
      }
      if (r.citizen && r.state !== 'grey') {
        for (const m of r.citizen.mixers) m.update(dt);
        if (r.citizen.fallback) { // procedural dance
          const ph = audio().beat() * Math.PI + r.citizen.phase;
          r.neon.position.y = Math.abs(Math.sin(ph)) * 0.25; r.neon.rotation.y = Math.sin(ph * 0.5) * 0.6;
          const L = r.citizen.fallback.getObjectByName('armL'), R = r.citizen.fallback.getObjectByName('armR');
          if (L && R) { L.rotation.z = -0.4 - Math.abs(Math.sin(ph)) * 2.2; R.rotation.z = 0.4 + Math.abs(Math.cos(ph)) * 2.2; }
        } else r.neon.position.y = Math.abs(Math.sin(audio().beat() * Math.PI)) * 0.08;
      }
    }
  }

  // ═══════════════════════════ player ═══════════════════════════
  private tryFire() {
    const a = audio();
    const now = a.now();
    if (now - this.lastShot < a.spb * 0.72) return;
    this.lastShot = now;
    const { j } = a.judge();
    this.stats[j]++;
    const c = JUDGE[j];
    const from = this.tank.muzzle.getWorldPosition(V());
    const dir = this.aim.clone().sub(from).normalize();
    this.spawnProj(from, dir.multiplyScalar(90), 'player', c.dmg * this.tier ** 0.3, 'slug', j);
    a.sfxShoot(j);
    this.recoil = 1;
    this.particles.burst(from, j === 'off' ? 8 : 24, 6, { colors: [new THREE.Color(c.color)], size: 0.35, life: 0.3, grav: 0 });
    this.tank.muzzleRing.emissive.set(c.color);
    if (j === 'off') { if (this.combo > 4) toast('Off-beat — combo lost'); this.combo = 0; }
    else this.bumpCombo(c.combo);
    useUI.getState().set({ lastJudge: { j, id: Math.random() } });
    if (j !== 'off') this.words.pop(c.word, c.color, from.clone().add(new THREE.Vector3(0, 2.5, 0)), j === 'perfect' ? 3.2 : 2.6);
    if (this.special?.type === 'confetti') { this.special.left--; if (this.special.left <= 0) this.special = null; }
    this.shake = Math.max(this.shake, 0.15);
  }

  private bumpCombo(n: number) {
    this.combo += n;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    const t = this.combo >= 50 ? 4 : this.combo >= 25 ? 3 : this.combo >= 10 ? 2 : 1;
    if (t > this.tier) { this.words.pop(`GROOVE x${t}`, '#ff3ec8', this.pos.clone().setY(6), 3.6); audio().intensity = t - 1; }
    this.tier = t;
  }
  private addScore(n: number) { this.stats.score += Math.round(n * this.tier); }

  private hurt(n: number) {
    if (this.mode === 'outro' || this.invuln > 0) return;
    this.hp = Math.max(0, this.hp - n);
    this.invuln = 0.35;
    audio().sfxHurt();
    this.shake = Math.max(this.shake, 0.5);
    this.chroma.offset.set(0.006, 0.004);
    if (n >= 25) this.combo = Math.max(0, this.combo - 5);
    useUI.getState().set({ hurt: Date.now() });
    if (this.hp <= 0) this.die();
  }

  private die() {
    this.mode = 'dead'; this.modeT = 0; this.stats.deaths++;
    useUI.getState().set({ screen: 'dead' });
    this.particles.burst(this.pos.clone().setY(2), 200, 14, { size: 0.6, life: 1.5 });
    audio().sfxExplode(true);
    document.exitPointerLock?.();
  }

  respawn() {
    const z: Zone = this.dropDone ? 'C' : this.gateOpen.B ? 'C' : this.gateOpen.A ? 'B' : 'A';
    this.placeSpawn(z);
    if (this.dropDone) { this.pos.set(0, 0, 196); this.camPos.set(0, 8, 184); }
    this.hp = 300; this.invuln = 2; this.combo = 0;
    for (const e of this.enemies) if (e.alive && e.kind !== 'pylon' && e.kind !== 'tower' && e.pos.distanceTo(this.pos) < 30) { e.alive = false; this.scene.remove(e.obj); }
    const a = audio();
    if (!this.dropDone) a.jump(z === 'A' ? 'buildA' : z === 'B' ? 'buildB' : 'buildC');
    this.mode = this.dropDone ? 'drop' : 'play';
    useUI.getState().set({ screen: 'playing', hp: 300 });
    this.canvas.requestPointerLock?.();
  }

  private fireBassDrop() {
    if (this.bassDrop < 1) { toast('Bass Drop not charged — keep the groove going'); return; }
    this.bassDrop = 0;
    this.rings.spawn(this.pos, '#ff3ec8', 20, 0.8, 0.2, 0.2); this.rings.spawn(this.pos, '#3ee6ff', 16, 0.6, 0.25, 0.15);
    this.paintAt(this.pos.clone().setY(2), 20, 6, 'perfect');
    this.damageArea(this.pos, 20, 120);
    for (const e of this.enemies) if (e.alive && e.kind !== 'pylon' && e.pos.distanceTo(this.pos) < 20) { const k = e.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(6); e.pos.add(k); }
    audio().sfxExplode(true); this.shake = 1.2; this.bloom.intensity = 2.4;
    this.words.pop('BASS DROP!', '#ff3ec8', this.pos.clone().setY(6), 4.2);
  }

  private useSpecial() {
    if (!this.special || this.special.type === 'confetti') return;
  }

  private addPickup(x: number, z: number, type: string) {
    let obj: THREE.Object3D;
    const glbId = type === 'vinyl' ? 'PU_VINYL' : type === 'repair' ? 'PU_REPAIR' : type === 'subwoofer' ? 'PU_SUBWOOFER' : '';
    const g = glbId ? getGLB(glbId) : null;
    if (g) obj = fitModel(cloneScene(g), 1.6, 1.6, 1.6, 'contain');
    else {
      const color = type === 'vinyl' ? '#3ee6ff' : type === 'repair' ? '#7cff6b' : type === 'gift' ? '#ff3ec8' : '#ffc83d';
      obj = new THREE.Group();
      const core = type === 'vinyl' ? new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 32), new THREE.MeshStandardMaterial({ color: '#0b0b0d', metalness: 0.6, roughness: 0.25 }))
        : new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), new THREE.MeshStandardMaterial({ color: '#111', emissive: color, emissiveIntensity: 1.6 }));
      if (type === 'vinyl') { core.rotation.x = Math.PI / 2; const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 20), new THREE.MeshStandardMaterial({ emissive: color, emissiveIntensity: 3, color: '#000' })); lab.rotation.x = Math.PI / 2; obj.add(lab); }
      obj.add(core);
    }
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.3, 32), new THREE.MeshBasicMaterial({ color: type === 'vinyl' ? '#3ee6ff' : '#ffc83d', transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = -1.1; obj.add(halo);
    obj.position.set(x, 1.6, z); this.scene.add(obj);
    this.pickups.push({ obj, pos: obj.position, type, taken: false });
  }

  private updatePickups(dt: number) {
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.obj.rotation.y += dt * 2; p.obj.position.y = 1.6 + Math.sin(this.t * 3 + p.pos.x) * 0.25;
      if (Math.hypot(this.pos.x - p.pos.x, this.pos.z - p.pos.z) < 3.2) {
        p.taken = true; this.scene.remove(p.obj); audio().sfxPickup();
        this.particles.burst(p.pos, 40, 6, { up: 3, size: 0.4, life: 0.8 });
        const spb = audio().spb;
        if (p.type === 'vinyl') { this.stats.vinyls++; this.addScore(1000); toast(`Vinyl ${this.stats.vinyls}/8`); }
        if (p.type === 'repair') { this.hp = Math.min(300, this.hp + 100); toast('+100 HP'); }
        if (p.type === 'gift') { this.addScore(500); this.bassDrop = Math.min(1, this.bassDrop + 0.2); }
        if (p.type === 'subwoofer') { this.special = { type: 'subwoofer', left: spb * 32 }; toast('SUBWOOFER — shockwave on every beat!'); }
        if (p.type === 'laser') { this.special = { type: 'laser', left: spb * 16 }; this.lasers.active = spb * 16; toast('LASER SHOW — lasers paint everything!'); }
        if (p.type === 'confetti') { this.special = { type: 'confetti', left: 4 }; toast('CONFETTI CANNON — next 4 shots paint double'); }
      }
    }
  }

  private collides(x: number, z: number, r: number) {
    for (const c of this.colliders) if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    for (let i = 0; i < this.gateColliders.length; i++) {
      const c = this.gateColliders[i];
      if (this.gateOpen[c.tag as Zone]) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  }
  private pointInCollider(p: THREE.Vector3) {
    for (const c of this.colliders) if (p.x > c.minX && p.x < c.maxX && p.z > c.minZ && p.z < c.maxZ && p.y < c.h) return true;
    for (const c of this.gateColliders) if (!this.gateOpen[c.tag as Zone] && p.x > c.minX && p.x < c.maxX && p.z > c.minZ && p.z < c.maxZ && p.y < 2.5) return true;
    return false;
  }

  private updatePlayer(dt: number) {
    const k = this.keys;
    const thr = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const turn = (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) - (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0);
    this.boostCd = Math.max(0, this.boostCd - dt);
    if ((k.has('ShiftLeft') || k.has('ShiftRight')) && this.boostCd <= 0 && thr > 0) { this.boostT = 2; this.boostCd = 6; audio().sfxBoost(); }
    this.boostT = Math.max(0, this.boostT - dt); this.slowT = Math.max(0, this.slowT - dt);
    const maxF = (this.boostT > 0 ? 24 : 16) * (this.slowT > 0 ? 0.6 : 1);
    const target = thr > 0 ? maxF : thr < 0 ? -7 : 0;
    const acc = thr === 0 ? 14 : Math.sign(target - this.speed) !== Math.sign(this.speed) && this.speed !== 0 ? 22 : 10;
    this.speed += clamp(target - this.speed, -acc * dt, acc * dt);
    const turnRate = THREE.MathUtils.degToRad(lerp(75, 42, Math.abs(this.speed) / 24));
    this.yaw += turn * turnRate * dt * (this.speed < -0.5 ? -1 : 1);
    const nx = this.pos.x + Math.sin(this.yaw) * this.speed * dt, nz = this.pos.z + Math.cos(this.yaw) * this.speed * dt;
    const R = 2.6;
    const ok = (x: number, z: number) => inBounds(x, z, R) && !this.collides(x, z, R);
    if (ok(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
    else if (ok(nx, this.pos.z)) { this.pos.x = nx; this.speed *= 0.96; }
    else if (ok(this.pos.x, nz)) { this.pos.z = nz; this.speed *= 0.96; }
    else { if (Math.abs(this.speed) > 8) { this.shake = 0.3; this.particles.burst(this.pos.clone().setY(1).add(new THREE.Vector3(Math.sin(this.yaw) * 3, 0, Math.cos(this.yaw) * 3)), 10, 4, { colors: [new THREE.Color('#ddd')] }); } this.speed *= -0.25; }
    // vertical (landing from the portal)
    if (this.pos.y > 0 || this.vy !== 0) {
      this.vy -= 30 * dt; this.pos.y += this.vy * dt;
      if (this.pos.y <= 0) { if (this.vy < -12) this.land(); this.pos.y = 0; this.vy = 0; }
    }
    // turret aims at the crosshair point
    const tp = this.pos;
    const wantYaw = Math.atan2(this.aim.x - tp.x, this.aim.z - tp.z);
    let d = wantYaw - this.turretYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.turretYaw += clamp(d, -THREE.MathUtils.degToRad(200) * dt, THREE.MathUtils.degToRad(200) * dt);
    const mz = this.tank.muzzle.getWorldPosition(V());
    const flat = Math.hypot(this.aim.x - mz.x, this.aim.z - mz.z);
    this.pitch = damp(this.pitch, clamp(Math.atan2(this.aim.y - mz.y, flat), -0.14, 0.32), 10, dt);
    if (this.mouseDown) this.tryFire();
    this.invuln = Math.max(0, this.invuln - dt);
    audio().engineSet(Math.abs(this.speed) / 24);
    // dust from tracks
    if (Math.abs(this.speed) > 4 && Math.random() < 0.7) {
      const back = new THREE.Vector3(-Math.sin(this.yaw) * 3.4, 0.3, -Math.cos(this.yaw) * 3.4).add(this.pos);
      this.particles.emit(back, new THREE.Vector3(rand(-1, 1), rand(1, 2.5), rand(-1, 1)), new THREE.Color(this.neon > 0.5 ? '#ff9ee6' : '#9aa0aa').multiplyScalar(0.35), 0.7, 0.6, 1);
    }
    if (this.boostT > 0) this.particles.emit(this.pos.clone().setY(1.2), new THREE.Vector3(-Math.sin(this.yaw) * 10, 1, -Math.cos(this.yaw) * 10), NEON[1], 0.5, 0.35, 0);
    // special timers
    if (this.special && this.special.type !== 'confetti') { this.special.left -= dt; if (this.special.left <= 0) this.special = null; }
    if (this.special?.type === 'laser' || (this.lasers.active > 0 && this.dropDone && this.mode === 'drop')) {
      // laser ground hits paint
    }
    // zone visit
    const z = zoneAt(this.pos.z);
    if (!this.visited[z]) { this.visited[z] = true; this.checkpoint = z; banner(z === 'B' ? 'ZONE B — MARKET' : 'PLAZA OF LIGHTS', z === 'B' ? 'Mute Tanks incoming' : 'Destroy the 4 Silencer Pylons around the tree'); }
  }

  private land() {
    this.shake = 1.4;
    this.particles.burst(this.pos.clone().setY(0.5), 160, 14, { colors: [new THREE.Color('#e8eef8'), new THREE.Color('#ffffff')], size: 0.7, life: 1.4, up: 6 });
    this.rings.spawn(this.pos, '#3ee6ff', 14, 0.7, 0.15, 0.2);
    audio().sfxExplode(true);
  }

  private updateTankVisual(dt: number) {
    const t = this.tank;
    t.root.position.copy(this.pos);
    t.root.rotation.y = this.yaw;
    // suspension wobble on acceleration
    const accelTilt = clamp((this.speed - (this.lastSpeed ?? 0)) / dt * -0.004, -0.08, 0.08);
    this.lastSpeed = this.speed;
    t.hull.rotation.x = damp(t.hull.rotation.x, accelTilt, 6, dt);
    t.turret.rotation.y = this.turretYaw - this.yaw;
    t.turret.rotation.x = t.hull.rotation.x;
    this.recoil = damp(this.recoil, 0, 9, dt);
    t.barrel.rotation.x = -this.pitch;
    t.barrel.position.z = 1.3 - this.recoil * 0.5;
    for (const tr of t.treads) tr.offset.y -= this.speed * dt * 0.12;
    t.speakers.forEach((s) => s.scale.setScalar(damp(s.scale.x, 1, 12, dt)));
    const beat = audio().beat();
    t.lightBar.forEach((l, i) => {
      const on = ((Math.floor(beat * 2) + i) % 8) < 2 || (Math.floor(beat * 2) - i + 64) % 8 < 1;
      const m = l.material as THREE.MeshStandardMaterial;
      m.emissive.copy(NEON[(((i + Math.floor(beat)) % 3) + 3) % 3]); m.emissiveIntensity = on ? 6 : 0.25; // beat is negative for the first 0.1 s
    });
    t.underglow.intensity = 25 + Math.abs(Math.sin(beat * Math.PI)) * 30;
    t.hatch.rotation.y = Math.sin(beat * Math.PI) * 0.25;
    t.hatch.position.y = 0.75 + Math.abs(Math.sin(beat * Math.PI)) * 0.06;
    (t.muzzleRing).emissiveIntensity = damp(t.muzzleRing.emissiveIntensity, 4, 4, dt);
  }
  private lastSpeed?: number;

  // ═══════════════════════════ camera ═══════════════════════════
  private ray = new THREE.Raycaster();
  private updateCamera(dt: number) {
    const s = useUI.getState().settings;
    const shake = s.shake ? this.shake : 0;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.fovKick = damp(this.fovKick, 0, 6, dt);
    let fov = 60 + (this.boostT > 0 ? 10 : 0) + this.fovKick;

    if (this.mode === 'play' || this.mode === 'drop' || this.mode === 'dead' || this.mode === 'paused') {
      const dist = 12, h = 3.2 + this.camPitch * 9;
      const want = new THREE.Vector3(this.pos.x - Math.sin(this.camYaw) * dist * Math.cos(this.camPitch * 0.6), this.pos.y + h, this.pos.z - Math.cos(this.camYaw) * dist * Math.cos(this.camPitch * 0.6));
      // pull in when a building blocks the view
      const head = this.pos.clone().setY(this.pos.y + 3);
      for (let k = 1; k >= 0.3; k -= 0.1) { const c = head.clone().lerp(want, k); if (!this.pointInCollider(c)) { want.copy(c); break; } }
      if (this.mode === 'drop' && this.modeT < audio().spb * 4 && !this.boss) {
        // crane up around the tree during the silence + first bar of THE DROP
        const k2 = Math.min(1, this.modeT / (audio().spb * 4));
        const crane = new THREE.Vector3(TREE.x - 40 * Math.sin(this.camYaw + k2), 40, TREE.z - 40 * Math.cos(this.camYaw + k2));
        want.lerp(crane, Math.sin(k2 * Math.PI) * 0.85);
      }
      this.camPos.x = damp(this.camPos.x, want.x, 10, dt); this.camPos.y = damp(this.camPos.y, want.y, 10, dt); this.camPos.z = damp(this.camPos.z, want.z, 10, dt);
      const look = new THREE.Vector3(this.pos.x + Math.sin(this.camYaw) * 14, this.pos.y + 2.2 + (0.4 - this.camPitch) * 6, this.pos.z + Math.cos(this.camYaw) * 14);
      this.camLook.lerp(look, 1 - Math.exp(-14 * dt));
    } else if (this.mode === 'title') {
      const a = this.t * 0.08;
      this.camPos.set(this.pos.x + Math.sin(a) * 13, 4.2, this.pos.z + Math.cos(a) * 13 + 4);
      this.camLook.set(this.pos.x, 2, this.pos.z + 2);
    } else if (this.mode === 'intro') this.introCamera();
    else if (this.mode === 'outro') {
      const a = this.modeT * 0.12; const r = 70 - this.modeT * 1.5;
      this.camPos.set(PLAZA.x + Math.sin(a) * r, 18 + this.modeT * 3, PLAZA.z + Math.cos(a) * r);
      this.camLook.set(TREE.x, 12, TREE.z);
      fov = 55;
    }
    this.camera.position.copy(this.camPos).add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shake * shake * 0.5));
    this.camera.lookAt(this.camLook);
    this.camera.fov = damp(this.camera.fov, fov, 8, dt); this.camera.updateProjectionMatrix();

    // aim = what the screen centre looks at
    this.ray.setFromCamera(new THREE.Vector2(0, 0.08), this.camera);
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    let best = 160;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const c = e.pos.clone().setY(e.kind === 'drone' ? e.pos.y : 2);
      const t = rayAABBorSphere(o, d, c, e.radius + 1.2); // generous for aim assist
      if (t > 4 && t < best) best = t;
    }
    if (this.boss?.alive && this.boss.rise >= 1) {
      const targets = this.boss.phase < 2 ? this.boss.panels.filter((_, i) => this.boss!.hp[i] > 0) : [this.boss.crystal];
      for (const p of targets) { const t = rayAABBorSphere(o, d, p.getWorldPosition(V()), 3.5); if (t > 4 && t < best) best = t; }
    }
    for (const c of this.colliders) { const t = rayBox(o, d, c); if (t > 4 && t < best) best = t; }
    if (d.y < 0) { const t = -o.y / d.y; if (t > 4 && t < best) best = t; }
    this.aim.copy(o).addScaledVector(d, best);
  }

  private introCamera() {
    const T = this.modeT;
    if (T < 4.5) { // slow dolly down the silent grey street
      const k = T / 4.5;
      this.camPos.set(lerp(-4, 3, k), lerp(9, 5, k), lerp(78, 52, k));
      this.camLook.set(0, 3, 20);
      if (T < 0.05) banner('NEON CITY', 'The night before the biggest party of the year…');
      if (Math.abs(T - 2.4) < 0.02) banner('THE HUSH', 'bought the city — and silenced everything.');
    } else if (T < 8) { // the glitch portal opens, the Deckhound drops in
      const k = (T - 4.5) / 3.5;
      this.camPos.set(lerp(14, 10, k), 3.5, lerp(22, 18, k));
      this.camLook.set(0, lerp(14, 2.5, Math.min(1, k * 1.4)), 6);
      this.portal.visible = T < 7.2;
      this.portal.position.set(0, 26, 4);
      this.portal.rotation.z += 0.2;
      this.portal.scale.setScalar(Math.min(1, k * 4) * (1 + Math.sin(T * 30) * 0.05));
      if (T > 5.4 && !this.tank.root.visible) { this.tank.root.visible = true; this.pos.set(0, 24, 4); this.vy = -6; }
      if (Math.random() < 0.6 && this.portal.visible) this.particles.emit(new THREE.Vector3(rand(-5, 5), 26, 4 + rand(-5, 5)), new THREE.Vector3(0, -6, 0), NEON[(Math.random() * 6) | 0], 0.6, 1.2, 0);
    } else { // swing behind the tank
      const k = Math.min(1, (T - 8) / 4);
      const a = lerp(Math.PI * 0.6, 0, 1 - Math.pow(1 - k, 3));
      this.camPos.set(this.pos.x - Math.sin(a) * 12, 5, this.pos.z - Math.cos(a) * 12);
      this.camLook.set(this.pos.x, 2.4, this.pos.z + 6);
      if (Math.abs(T - 8.6) < 0.02) banner('SILENT NIGHT DISTRICT', 'Level 1 — Drop the bass. Bring back the color.');
      if (T > 9.5 && T < 9.53) this.captureNext((u) => (this.beforeShot = u));
      if (T > 12.5) { this.portal.visible = false; this.tank.root.visible = true; this.pos.y = 0; this.vy = 0; this.camYaw = 0; this.setMode('play'); toast('CLICK to take control'); }
    }
  }

  captureNext(cb: (url: string) => void) { this.captureCb = cb; }

  // ═══════════════════════════ ambience ═══════════════════════════
  private updateAmbience(dt: number) {
    // how "remixed" the world around the camera is
    const z = zoneAt(this.camPos.z);
    const local = this.mode === 'title' ? 0 : this.dropDone ? 1 : this.meter(z) / 100 * 0.75;
    this.neon = damp(this.neon, Math.max(local, this.neonTarget), 1.2, dt);
    const n = this.neon;
    const fog = this.scene.fog as THREE.Fog;
    fog.color.set('#8b93a1').lerp(new THREE.Color('#1a1030'), n);
    fog.near = lerp(25, 60, n); fog.far = lerp(170, 320, n);
    this.skyU.uTop.value.set('#7d8696').lerp(new THREE.Color('#0d0820'), n);
    this.skyU.uBottom.value.set('#a6adb8').lerp(new THREE.Color('#5a1f6e'), n);
    this.skyU.uNeon.value = n; this.skyU.uTime.value = this.t;
    this.hemi.color.set('#c9d4e6').lerp(new THREE.Color('#8f6bff'), n); this.hemi.groundColor.set('#3a3a40').lerp(new THREE.Color('#ff3ec8'), n * 0.4);
    this.hemi.intensity = lerp(1.1, 0.7, n);
    this.sun.color.set('#dfe8ff').lerp(new THREE.Color('#ffb87a'), n); this.sun.intensity = lerp(1.6, 0.9, n);
    this.sun.position.set(this.pos.x + 40, 70, this.pos.z - 30); this.sun.target.position.copy(this.pos);
    this.skylineMat.emissiveIntensity = 0.05 + n * 2.2;
    this.scene.environmentIntensity = lerp(0.35, 0.55, n);
    for (const m of this.groundMats) { m.roughness = lerp(0.85, 0.32, n); m.metalness = lerp(0.05, 0.25, n); }
    const satTarget = this.mode === 'drop' && !this.dropDone ? -1 : lerp(-0.5, 0.18, n);
    this.hue.saturation = damp(this.hue.saturation, satTarget, 3, dt);
    this.bloom.intensity = damp(this.bloom.intensity, lerp(0.9, 1.5, n), 1.5, dt);
    this.chroma.offset.x = damp(this.chroma.offset.x, 0, 6, dt); this.chroma.offset.y = damp(this.chroma.offset.y, 0, 6, dt);
    this.snow.update(dt, this.camPos, n, this.t);
    // tree lights spiral up after THE DROP
    if (this.dropDone && this.treeLit < 1) this.treeLit = Math.min(1, this.treeLit + dt / (audio().spb * 4));
    this.treeLights.geometry.setDrawRange(0, Math.floor(420 * this.treeLit));
    (this.treeStar.material as THREE.MeshStandardMaterial).emissiveIntensity = this.treeLit >= 1 ? 4 + Math.sin(this.t * 4) : 0.2;
    this.treeStar.rotation.y += dt;
    this.plazaLights.forEach((l, i) => { l.intensity = this.dropDone ? 200 + Math.sin(audio().beat() * Math.PI + i) * 120 : 0; });
    audio().grey = this.mode === 'title' ? 1 : 1 - Math.min(1, local / 0.75 + (this.dropDone ? 1 : 0));
    // lasers
    const lp = this.tank.laserSocket.getWorldPosition(V());
    const hits = this.lasers.update(dt, lp, this.turretYaw, this.t, this.dropDone && this.special?.type !== 'laser');
    if (this.special?.type === 'laser') for (const h of hits) { this.paintAt(h, 3, 0.25, 'good'); this.damageArea(h, 3, 40 * dt); }
  }

  // ═══════════════════════════ loop ═══════════════════════════
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    let dt = Math.min(0.05, this.clock.getDelta());
    if (this.slowmo > 0) { this.slowmo -= dt; dt *= 0.3; }
    const paused = this.mode === 'paused';
    if (!paused) { this.t += dt; this.modeT += dt; remixTime.value = this.t; }
    if (!paused) {
      if (this.mode === 'play' || this.mode === 'drop') {
        this.updatePlayer(dt); this.updateEnemies(dt); this.updateProjs(dt); this.updatePickups(dt); this.updateBoss(dt);
        this.checkGates(); this.stats.time += dt;
      } else if (this.mode === 'intro' || this.mode === 'outro' || this.mode === 'dead') {
        if (this.mode === 'intro' && this.pos.y > 0) { this.vy -= 30 * dt; this.pos.y = Math.max(0, this.pos.y + this.vy * dt); if (this.pos.y === 0) { this.land(); this.vy = 0; } }
        this.updateEnemies(dt); this.updateProjs(dt);
        if (this.mode === 'outro') {
          if (Math.random() < 0.08) this.firework(new THREE.Vector3(rand(-70, 70), rand(25, 55), PLAZA.z + rand(-40, 60)));
          if (this.modeT > 6.5 && !this.afterShot) this.captureNext((u) => (this.afterShot = u));
          if (this.modeT > 9 && useUI.getState().screen !== 'results') this.finish();
        }
      }
      this.updateRemix(dt);
      this.updateTankVisual(dt);
      this.updateAmbience(dt);
      this.particles.update(dt); this.rings.update(dt); this.words.update(dt);
    }
    this.updateCamera(paused ? 0 : dt);
    this.composer.render(dt);
    if (this.captureCb) { const cb = this.captureCb; this.captureCb = null; try { cb(this.renderer.domElement.toDataURL('image/jpeg', 0.8)); } catch { /* ignore */ } }
    this.hudT -= dt;
    if (this.hudT <= 0 && (this.mode === 'play' || this.mode === 'drop')) { this.hudT = 0.1; this.pushHUD(); }
  };

  private pushHUD() {
    this.objective();
    useUI.getState().set({
      hp: this.hp, combo: this.combo, tier: this.tier, zone: zoneAt(this.pos.z),
      meters: { A: this.meter('A'), B: this.meter('B'), C: this.meter('C') },
      special: this.special ? { type: this.special.type, left: this.special.left } : null,
      bassDrop: this.bassDrop, boost: this.boostCd > 0 ? 1 - this.boostCd / 6 : 1, stats: { ...this.stats },
    });
  }

  private finish() {
    this.pushHUD();
    const s = this.stats;
    const shots = s.perfect + s.good + s.off;
    s.score += Math.max(0, Math.round((420 - s.time) * 20));
    const onBeat = shots ? (s.perfect + s.good) / shots : 0;
    const ui = useUI.getState();
    const best = Math.max(ui.best, s.score);
    localStorage.setItem('beattank.best', String(best));
    ui.set({ screen: 'results', stats: { ...s }, best });
    void onBeat;
  }

  // ═══════════════════════════ settings ═══════════════════════════
  applyQuality() {
    const q = useUI.getState().settings.quality;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sun.shadow.mapSize.setScalar(q === 'high' ? 2048 : 1024);
    this.sun.shadow.map?.dispose(); this.sun.shadow.map = null as never;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === 'high' ? 1.75 : q === 'medium' ? 1.25 : 1));
    this.resize();
  }
  resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false); this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  };
}

// ── geometry helpers ──
function segSphere(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, r: number) {
  const ab = b.clone().sub(a), ac = c.clone().sub(a);
  const t = clamp(ac.dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1);
  return a.clone().addScaledVector(ab, t).distanceToSquared(c) < r * r;
}
function rayAABBorSphere(o: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, r: number) {
  const oc = c.clone().sub(o); const t = oc.dot(d); if (t < 0) return Infinity;
  const d2 = oc.lengthSq() - t * t; return d2 < r * r ? t - Math.sqrt(r * r - d2) : Infinity;
}
function rayBox(o: THREE.Vector3, d: THREE.Vector3, c: Collider) {
  let tmin = -Infinity, tmax = Infinity;
  const ax: [number, number, number, number][] = [[o.x, d.x, c.minX, c.maxX], [o.y, d.y, 0, c.h], [o.z, d.z, c.minZ, c.maxZ]];
  for (const [p, v, lo, hi] of ax) {
    if (Math.abs(v) < 1e-8) { if (p < lo || p > hi) return Infinity; continue; }
    let t1 = (lo - p) / v, t2 = (hi - p) / v; if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return Infinity;
  }
  return tmin >= 0 ? tmin : Infinity;
}
