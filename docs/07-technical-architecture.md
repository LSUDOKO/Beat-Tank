# 07 — Technical Architecture

## 1. Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript |
| Build | Vite |
| Base template | viber3d (React 19 + R3F + Drei + koota ECS + React Three Rapier + Zustand + Tailwind) — https://github.com/instructa/viber3d |
| Physics | Rapier (`@react-three/rapier`), vehicle raycast controller |
| Post FX | `@react-three/postprocessing` + `postprocessing` LUT3D |
| Cinematic camera | Custom Catmull-Rom rails (or Theatre.js) |
| Audio | Web Audio API (custom `AudioEngine` with stems, filters, beat clock) |
| UI | React + Tailwind overlay, Zustand store |
| Assets | GLB (meshopt + KTX2) in `/public/assets` |
| Backend (asset scripts + optional runtime garage) | Node 20+, `@manycore/aholo-sdk-lux3d`, Hono |
| Hosting | Vercel/Netlify (client), Render/Railway/Vercel functions (server) |

## 2. Folder structure

```
beattank/
├─ docs/                         ← this pack
├─ apps/game/src/
│  ├─ main.tsx, App.tsx          ← screen router: Title, Garage, Level, Results
│  ├─ core/
│  │  ├─ AudioEngine.ts          ← stems, filters, beat clock, calibration
│  │  ├─ BeatClock.ts
│  │  ├─ LevelDirector.ts        ← bars → sections, encounters, gates, scripted events
│  │  └─ store.ts                ← Zustand: hp, groove, meters, state
│  ├─ ecs/ (traits.ts, systems/)
│  ├─ level/
│  │  ├─ SilentNight.tsx         ← loads layout.json, places assets, colliders
│  │  ├─ layout.json             ← positions/rotations/scales of every placed asset
│  │  └─ RoadMeshes.tsx          ← procedural roads, sidewalks, plaza
│  ├─ tank/
│  │  ├─ Tank.tsx                ← hull, turret, barrel, procedural treads, vehicle physics
│  │  ├─ TankLights.tsx          ← light bar, underglow, lasers
│  │  └─ VoltInHatch.tsx         ← rigged VOLT animations
│  ├─ remix/
│  │  ├─ RemixMaterial.ts        ← dual-material dissolve shader
│  │  ├─ RemixSystem.ts          ← paint, states, meters
│  │  └─ emissiveFromNeon.ts
│  ├─ enemies/ (Drone, StaticTower, MuteTank, Pylon, SleighDozer, Silencer)
│  ├─ citizens/ Citizens.tsx      ← instanced/frozen → animated
│  ├─ vfx/ (Particles, Decals, Fireworks, Lasers, Shockwave, WorldText)
│  ├─ camera/ (ChaseCamera, CinematicRail, Shake)
│  ├─ post/ PostFX.tsx           ← bloom, AO, LUT blend, vignette
│  ├─ ui/ (HUD, Minimap, Pause, Settings, Results, Garage, Title)
│  └─ content/ (encounters.json, music-map.json)
├─ apps/server/src/ (index.ts, aholo/, queue.ts, storage.ts, safety.ts)
├─ scripts/ (gen-assets.ts, review-assets.ts, optimize.sh, gen-world.ts)
└─ content/ (assets.json, assets.lock.json, materials/)
```

## 3. Level layout

- Build a **greybox** first: roads, sidewalks, plaza as simple meshes; building boxes with correct footprints from `03`.
- `layout.json` lists every placement: `{ id, asset, pos, rotY, scale, zone, remix: {paintHp, colorValue} }`.
- A small in-game **dev placement tool** (press F2): click to place selected asset, arrow keys rotate, saves JSON. This makes populating the city fast.
- Colliders: buildings = box colliders from footprint (static); props = convex hull or box (kinematic → dynamic on hit).

## 4. Remix material (dual dissolve)

```ts
// RemixMaterial.ts (sketch) — both meshes share geometry; grey and neon materials get the same uniforms
const uniforms = {
  uOrigin: { value: new THREE.Vector3() },
  uRadius: { value: 0 },          // grows when remixing
  uEdge:   { value: 0.6 },
  uEdgeColor: { value: new THREE.Color('#3EE6FF') },
  uIsNeon: { value: 0 },          // 0 on grey mesh, 1 on neon mesh
};
// inject into MeshStandardMaterial via onBeforeCompile:
// float d = distance(vWorldPos, uOrigin) + snoise(vWorldPos*0.8)*1.5;
// float revealed = step(d, uRadius);           // 1 = neon area
// if (uIsNeon < 0.5 && revealed > 0.5) discard; // grey hides where revealed
// if (uIsNeon > 0.5 && revealed < 0.5) discard; // neon hides where not revealed
// float edge = smoothstep(uRadius - uEdge, uRadius, d) * revealed;
// totalEmissiveRadiance += uEdgeColor * edge * 6.0;
```
- Partial paint: store up to 4 splat origins per object (uniform array) and reveal small circles before full remix.
- Performance: one material instance per placed object type + per-instance uniforms via `InstancedBufferAttribute` for repeated props.

## 5. Beat clock

```ts
export class BeatClock {
  constructor(private ctx: AudioContext, public bpm = 128, public offsetMs = 0) {}
  start = 0;
  now() { return this.ctx.currentTime - this.start - this.offsetMs / 1000; }
  beat() { return this.now() * this.bpm / 60; }
  bar() { return Math.floor(this.beat() / 4) + 1; }
  judge(): 'perfect' | 'good' | 'off' {
    const b = this.beat(); const dist = Math.abs(b - Math.round(b)) * 60 / this.bpm * 1000;
    return dist <= 45 ? 'perfect' : dist <= 90 ? 'good' : 'off';
  }
}
```
`music-map.json` example:
```json
{ "bpm": 128, "sections": [
  { "name": "intro", "fromBar": 1, "toBar": 16 },
  { "name": "buildA", "fromBar": 17, "toBar": 32, "loop": [25, 32] },
  { "name": "breakdown", "fromBar": 33, "toBar": 40 },
  { "name": "buildB", "fromBar": 41, "toBar": 56, "loop": [49, 56] },
  { "name": "preDrop", "fromBar": 57, "toBar": 64 },
  { "name": "buildC", "fromBar": 65, "toBar": 72, "loop": [65, 72] },
  { "name": "drop", "fromBar": 73, "toBar": 88 },
  { "name": "drop2", "fromBar": 89, "toBar": 96, "loop": [89, 96] },
  { "name": "outro", "fromBar": 97, "toBar": 104 } ] }
```
Looping: schedule `AudioBufferSourceNode` segments with `start(when, offset, duration)` so loops land exactly on bar boundaries.

## 6. Aholo REST helper (server)

```ts
const BASE = process.env.AHOLO_BASE_URL!; // from OpenAPI spec
export async function aholo<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: process.env.AHOLO_API_KEY! },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(j)}`);
  return j as T;
}
```

## 7. Performance budget (desktop mid laptop, 1080p, High)

| Metric | Target |
| --- | --- |
| FPS | 60 |
| Draw calls | < 250 (instance repeated props) |
| Triangles on screen | < 2.5 M |
| Active dynamic bodies | < 80 |
| Lights | 1 directional + ≤ 8 point |
| Download | < 60 MB total, < 20 MB before first play (stream Plaza assets during Zone A) |

Techniques: InstancedMesh for lamps/bins/hydrants/etc., LOD for buildings (Lux3D retopo at two budgets), frustum culling, KTX2 textures, object pools for projectiles/particles/decals, dispose on level exit, pause off-screen citizen animations.

## 8. Environment variables

```
AHOLO_API_KEY=
AHOLO_REGION=com
AHOLO_BASE_URL=
AHOLO_MAX_CONCURRENCY=2
STORAGE_BUCKET=          # optional (runtime garage)
STORAGE_PUBLIC_URL=
```
