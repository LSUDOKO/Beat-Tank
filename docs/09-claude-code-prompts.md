# 09 — Prompts for Claude Code (paste in order)

Start every new session with **Prompt 0**. Do one prompt at a time; test before moving on. Commit after each step.

---

## Prompt 0 — Session context

```
You are building BEATTANK: Remix the City — one level, "Silent Night District" — for the
Manycore Aholo Global 3D AI Hackathon. Read every file in /docs (README, then 00–12).
Follow docs/08-build-plan.md and tell me which step you are on.
Stack: TypeScript, Vite, React 19, React Three Fiber, Drei, koota ECS, @react-three/rapier,
@react-three/postprocessing, Zustand, Tailwind (base: viber3d).
Rules:
- All assets are original. Never use deadmau5, mouse-head shapes, World of Tanks, Wargaming,
  or the song "Familiars".
- AHOLO_API_KEY lives only in server/scripts .env. Never in client code or git.
- Before any Aholo call, read the official OpenAPI spec/llms.txt (linked from
  https://labs.aholo.ai/api-docs/en/api-reference) and @manycore/aholo-sdk-lux3d types.
  Do not guess method names. Record what you find in docs/api-notes.md.
- Aholo tasks are async: poll every 10–15 s, download results immediately (URLs expire in 2 h),
  respect AHOLO_MAX_CONCURRENCY (2 on Free).
- Keep a playable build at all times. Ask me before changing the design.
```

## Prompt 1 — Repo setup

```
Create the monorepo in docs/07 §2 starting from github.com/instructa/viber3d.
Add: @react-three/postprocessing, postprocessing, three-csm (optional), @gltf-transform/cli,
@manycore/aholo-sdk-lux3d (scripts/server only), tsx, dotenv.
Add .env.example (docs/07 §8). Make `pnpm dev` run the game. Show me the tree.
```

## Prompt 2 — API notes + asset generator

```
1) Read the Aholo OpenAPI spec and SDK types. Write docs/api-notes.md listing exact calls for:
   text-to-3D (style param), image-to-3D, retopology, material transfer, part splitting,
   auto-rigging, animation retargeting (+ how to list animation IDs), multi-format export,
   World API generation, asset upload token, task status. Include request/response fields.
2) Build scripts/gen-assets.ts per docs/05 §4: reads content/assets.json, runs per-kind
   pipelines, queue with AHOLO_MAX_CONCURRENCY, polls every 12 s, downloads immediately,
   writes content/assets.lock.json (resumable), logs a summary table.
3) Test with only P_TANK_TURRET and B_BAKERY. Show me timings, file sizes, triangle counts.
```

## Prompt 3 — Full asset list + batch

```
Create content/assets.json with every asset row from docs/03 (prompts + style suffix,
budgets, grey material ref, part names, rig flags, animation IDs from api-notes).
Order: tank, Silencer, 6 buildings, giant tree + star, drones, citizens, rest.
Add scripts/optimize.sh (meshopt + KTX2) and scripts/review-assets.ts (PNG contact sheet of
all _neon and _grey models). Then start the batch and tell me how to monitor it.
```

## Prompt 4 — Greybox level + tank

```
Build the greybox of docs/02 §2: roads, sidewalks, Plaza circle, building boxes with the
footprints from docs/03 §6, invisible walls as barricades. Add the Tank (docs/04 §1):
Rapier raycast-vehicle physics, arcade handling numbers, hull/turret/barrel hierarchy with
placeholder boxes, procedural treads with scrolling texture, mouse-aimed turret.
Add ChaseCamera (docs/06 §5) with damping and wall push-in. Target 60 FPS.
```

## Prompt 5 — Audio + beat

```
Implement AudioEngine and BeatClock (docs/07 §5) with music-map.json, section looping on bar
boundaries, low-pass filter for grey state, stems if available. Add the crosshair beat ring,
speaker pump on kick, light-bar chase. Add Beat Cannon (docs/04 §3) with Perfect/Good/Off
judgement, projectiles, impact paint splash VFX, world-space hit words, calibration in settings.
```

## Prompt 6 — Remix system

```
Implement remix/ per docs/04 §4 and docs/07 §4: dual-mesh dissolve shader with glowing edge,
partial paint splats, paintHp, zone meters, emissive-from-neon, remix sting SFX, sparkle burst.
Add the F2 dev placement tool that writes level/layout.json. Replace greybox boxes with the
generated _grey/_neon GLBs as they become available (keep boxes as fallback).
```

## Prompt 7 — Enemies + LevelDirector

```
Implement LevelDirector (bars → sections, encounters.json, gates at 60%/100%, checkpoints,
scripted events list from docs/02 §6). Implement Hush Drone, Static Tower, Mute Tank,
Silencer Pylon per docs/04 §7 with part-split death debris (Rapier) turning into confetti.
Player HP, damage feedback, death → checkpoint restart with music jump.
```

## Prompt 8 — THE DROP

```
Build THE DROP exactly as docs/02 §7: 1-beat silence, crane camera, radial remix wave from the
tree at 60 m/s across all zones, tree light spiral + star, LUT grey→neon, skyline crossfade,
lasers, fireworks, citizens dance, text slam, return camera. Everything on beat. Make it the
best-looking 15 seconds of the game.
```

## Prompt 9 — Bosses

```
Implement The Silencer (docs/04 §9): rise from pit, phase 1 with 4 dampener panels (part-split
meshes as separate hitboxes), Mute Wave / Foam Rain / Drone Spawn, phase 2 crystal only damaged
by Good/Perfect shots, Silence Field, death on the downbeat with fireworks.
Then, if time allows, the Sleigh-Dozer mid-boss (docs/04 §8).
```

## Prompt 10 — Citizens + VOLT

```
Load rigged citizen GLBs: frozen state = grey stone material + paused first frame; when painted
(2 hits) → dissolve to color and play dance animation with random offset, bouncing on the beat.
Add VOLT in the turret hatch with idle/cheer/point animations reacting to events.
```

## Prompt 11 — UI + results + share

```
Build HUD (docs/06 §7), minimap, objective text, boss bar with part icons, pause, settings
(graphics presets docs/06 §8, volumes, audio offset, shake, sensitivity), title screen,
results (rank, score breakdown, before/after slider captured at level start and end, Tank Card,
Share to X intent with #Manycorehackathon), credits screen listing every Aholo capability used.
```

## Prompt 12 — Cinematics + polish

```
Add intro and outro cinematics from docs/10 using camera rails. Polish pass from docs/06:
post-processing, reflections, god-ray cones, snow/confetti particles, decals, audio mix and
ducking. Implement ?demo=1 (no Aholo calls). Profile and meet docs/07 §7 budgets.
```

## Prompt 13 — Optional runtime Aholo (garage)

```
Implement docs/05 §5 garage routes and UI: tank turret from prompt, from photo, photo skin via
material transfer, export STL/USDZ. Queue, safety filter, fallbacks to preset tanks.
```

## Prompt 14 — Deploy + README

```
Deploy client (Vercel/Netlify) and server if used. Write the public README: GIF, play link,
controls, features, "Built with Aholo" table (every capability + where it's used), setup,
credits/licences (docs/12). Verify the link in an incognito window.
```
