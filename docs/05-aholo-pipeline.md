# 05 — Aholo Pipeline (how Claude Code + your API key build every asset)

> ⚠️ **Verify first.** Read the official OpenAPI spec / llms.txt linked from https://labs.aholo.ai/api-docs/en/api-reference and the `@manycore/aholo-sdk-lux3d` type definitions before coding. Version names differ between sources (`v2.0-preview` / `v1.0-pro` in the npm README; `G1`, `G1-Turbo`, `v3.0-standard` in skill docs). Wrap every call in one module (`server/aholo/`) so fixes happen in one place.

## 1. Accounts, key, credits

1. Register at https://www.aholo.ai/hackathon; create/confirm team (add teammates **before** submitting the idea — team credits are split once).
2. Submit the project idea → more credits.
3. Create a **Global** API key (labs.aholo.ai). Global and China keys are not interchangeable.
4. `.env` (server/scripts only): `AHOLO_API_KEY=...` — never in client code or git.
5. Raw HTTP auth header: `Authorization: <key>` (no `Bearer`).

## 2. Limits to design around

| Fact | Consequence |
| --- | --- |
| All generation is async (create → taskId → poll) | Scripts must poll; poll every 10–15 s |
| Status: 0 init, 1 running, 3 success, 4 failed, 6 cancelled | Retry on 4 once, then flag |
| **Result URLs expire after 2 hours** | Download immediately to `assets-raw/` |
| Concurrency: **2** in-flight on Free, **10** on Pro — shared across generation, material transfer, four-view, retopology, articulation, rigging, retargeting | Queue with `MAX_IN_FLIGHT`; over-limit errors (`GENERATION_CONCURRENCY_LIMIT_EXCEEDED`) create no task and cost nothing — just retry later |
| Part splitting has its own per-account limit | Separate small queue |
| Retopology accepts **static, non-Draco GLB** only | Compress *after* retopology |
| Retopology ranges: tri 2,000–1,000,000; texture 512/1024/2048/4096 | Use budgets from `03` |
| Text-to-3D styles: photorealistic, cartoon, anime, hand_painted, cyberpunk, fantasy, glass | We use `photorealistic` |
| Image-to-3D: `img` (1) or `imgs` (1–32), not both | Photo garage uses `img` |
| Retarget: rigged HTTPS GLB + 1–10 animation IDs (85 public IDs); output glb/fbx; `animateInPlace` | Dance/cheer per citizen |
| Export: zip/glb → usdz, obj_zip, fbx_zip, stl, 3mf | Garage export |
| Local file upload: asset token API (`/asset/v1/token`) | For photos & reference images |

## 3. SDK

```bash
npm i @manycore/aholo-sdk-lux3d
```
```ts
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d';
export const lux3d = createLux3dClient({ region: 'com' }); // reads AHOLO_API_KEY

// documented in README:
const taskId = await lux3d.imgTo3d.create({ img: 'https://.../photo.jpg' });
const result = await lux3d.tasks.waitFor(taskId);
// material transfer (README): { img: materialRefUrl, meshUrl: glbUrl }
```
For text-to-3D, retopology, part split, rig, retarget, articulation, export: read the SDK types; if a method is missing, call REST with `fetch` (see `07` §6 helper). Known REST paths seen in docs (verify): `POST /lux3d/v1/animations/retarget/task/create`, `POST /global/lux3d/v1/articulation-animation/task/create`; World API: `GET /global/asset/v1/token`, `POST /global/world/v1/generations`, `POST /global/world/v1/reconstructions`, `GET /global/world/v1/{worldId}`.

## 4. The batch generator (`scripts/gen-assets.ts`)

Reads `content/assets.json` (one row per asset from `03`), runs the right pipeline, writes `content/assets.lock.json` with status per step so it can **resume** after a crash.

```jsonc
// content/assets.json (example rows)
[
  { "id": "B_BAKERY", "kind": "building", "prompt": "a cozy two-story bakery ...",
    "tris": 12000, "tex": 1024, "grey": "mat_grey_concrete", "partSplit": false },
  { "id": "B_SILENCER", "kind": "boss", "prompt": "a giant machine shaped like ...",
    "tris": 40000, "tex": 2048, "partSplit": true,
    "parts": ["panel_N","panel_E","panel_S","panel_W","crystal","horn","base"] },
  { "id": "C_KID", "kind": "citizen", "prompt": "a kid in a puffy winter jacket ... T-pose",
    "tris": 10000, "tex": 1024, "grey": "mat_grey_stone", "rig": true,
    "animations": ["<idle id>", "<dance id>", "<cheer id>"] }
]
```

### Pipelines by kind

```
building / prop:
  text-to-3D (neon prompt + suffix, style photorealistic)
  → download → retopology (tris, tex) → download   = <ID>_neon.glb
  → material transfer (img = grey ref, meshUrl = neon GLB) → download = <ID>_grey.glb
  → optimize both (meshopt + KTX2) → public/assets/<ID>_{neon,grey}.glb

player tank:
  hull: text-to-3D → retopo
  turret: text-to-3D → retopo → part split (barrel)
  camos: material transfer ×3 each part

enemy / boss:
  text-to-3D → retopo → part split (named parts) → map parts to names (by size/position, check visually)

citizen / VOLT:
  text-to-3D (T-pose) → retopo → auto-rig → retarget (animation IDs) → download glb
  citizen grey: material transfer with mat_grey_stone on the rigged GLB (if transfer breaks the rig, transfer BEFORE rigging)

world:
  World API generation (prompt) → poll worldId → download ply/spz/lodMeta + panoUrl
```

### Queue
- `MAX_IN_FLIGHT = Number(process.env.AHOLO_MAX_CONCURRENCY ?? 2)`.
- Each pipeline step is one job; a job releases its slot when its task finishes.
- Poll each task every 12 s; timeout 15 min → retry once → mark `failed`.
- Log a table at the end: ID, steps done, time, file sizes, triangle counts.

### Review step (important for quality)
`scripts/review-assets.ts` renders every `_neon.glb` and `_grey.glb` to a PNG contact sheet (headless three.js or `gltf-transform` + a simple renderer). Look at it; reroll bad ones (`--reroll B_CAFE` with a tweaked prompt).

## 5. Runtime Aholo features (optional, after the level works)

| Feature | Route | Pipeline |
| --- | --- | --- |
| Garage: tank from prompt | `POST /api/garage/prompt` | safety filter → text-to-3D (turret) → retopo → store → return URL |
| Garage: tank from photo | `POST /api/garage/photo` | upload → image-to-3D → retopo → store |
| Photo skin | `POST /api/garage/skin` | upload material photo → material transfer on hull + turret |
| Export | `POST /api/garage/export` | multi-format export → stl / 3mf / usdz |

All runtime routes: queue, immediate download, copy to your storage, fallback to presets on failure, and a `?demo=1` mode that only uses pre-generated assets.

## 6. World API (skyline)

- Prompt in `03` §9. Use generation (not reconstruction).
- Outputs: `plyPath`, `spzPath`, `lodMetaPath`, `panoUrl` (verify names).
- **Integration plan:** Option A: render 3DGS skyline with `@manycore/aholo-viewer` on a background canvas with synced camera; Option B (fallback, fastest): use `panoUrl` as an equirectangular background/environment in three.js. Start with B, upgrade to A if time allows.

## 7. LuxReal

- Use for the trailer and the intro "transported into the tank" shot (see `10`). Feed it renders of the tank and city for consistency.

## 8. Lux3D skill for Claude Code (dev-time)

```bash
git clone --depth 1 https://github.com/infometa/workbuddyskills.git /tmp/wbs
mkdir -p .claude/skills && cp -r /tmp/wbs/connectors/aholo-lux3d/skills/lux3d .claude/skills/lux3d
```

## 9. Prompt-writing tips for Lux3D

- One object per prompt; describe silhouette first, then materials, then details.
- For characters: "standing in T-pose, arms out" helps auto-rigging.
- Avoid text/logos in prompts (they come out garbled and can create IP issues).
- Keep color words consistent per object family (Hush = grey + pale blue crystal; player = gunmetal + cyan).
- If a result is too detailed/noisy, add "simple clean shapes, fewer small details".
