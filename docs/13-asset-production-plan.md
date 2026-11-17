# 13 — Asset Production Plan (Art Direction v2)

**Status:** plan for review. Nothing in this document has been generated yet, apart from the pipeline test in §1.3.
**Goal:** replace the first-pass assets with a coherent, reference-quality 3D set (characters, tanks, enemies, city and 3D UI). Assets are generated **one at a time**, and each passes a review gate before the next starts.

Read with `00b-shot-list.md` (reference analysis) and `03-asset-bible.md` (the original list this plan supersedes).

---

## 1. Where we are

### 1.1 Repository

| Area | State |
| --- | --- |
| Engine | Vite + React 19 UI + plain three.js + `postprocessing` (R3F was dropped for an imperative game loop). TypeScript, typecheck clean |
| Game | One level playable end to end in code: title, intro cinematic, 3 zones, beat cannon, Remix dissolve shader, drones, Mute Tanks, towers, pylons, THE DROP, Silencer boss, outro, results. Built this session and **not committed yet** |
| Known bug | Crash in `updateTankVisual`: `NEON[(i + Math.floor(beat)) % 3]` is undefined while the beat clock is negative (first 0.1 s). One-line fix, held back until this plan is approved |
| Audio | Fully procedural 128 BPM track + SFX (Web Audio), with no licensing risk |
| Asset pipeline | `scripts/gen-assets.ts` (text-to-3D → material transfer → part split → rig → retarget, resumable lock file); `scripts/optimize.ts` (meshopt + WebP, about 10 MB → 0.6 MB per model) |
| Fallbacks | Every model has a procedural stand-in, so the game runs with zero generated assets |

### 1.2 Generated so far (first-pass prompts, text-to-3D only)

`B_BAKERY`, `B_RECORD`, `B_CAFE`, `B_CORNER_SHOP` (neon + grey twins), `P_TANK_HULL`, `P_TANK_TURRET` (+ part split), `B_SILENCER` (+ part split). The overnight batch stopped at 16:51 with `fetch failed` on every remaining task. That was a network drop, not a credit or API error; the lock file is resumable.

These seven are **kept as fallbacks** and will be superseded by the v2 assets below. The tank in particular does not match the reference look.

### 1.3 Pipeline test results (bakery)

| Step | Time | Result |
| --- | --- | --- |
| text-to-3D, G1-Turbo, 20k faces | 122 s | GLB, 2× 2048 PNG textures, about 9 MB |
| material transfer (grey) | 254 s | Same topology and identical bounds as the neon version, so the Remix dissolve lines up |

---

## 2. Aholo API — what it can and cannot do

Verified against the official OpenAPI spec (`labs.aholo.ai/api-docs/en/openapi.json`) and the SDK types (`@manycore/aholo-sdk-lux3d` 1.10.0). The key works on the `com` region (`https://api.aholo.ai/global/...`).

| Capability | Endpoint / SDK | Inputs | Use in BEATTANK |
| --- | --- | --- | --- |
| **Multimodal → image** | `multimodalToImage.create` | `prompt` and/or one `img` | **Concept art** for each asset in our style, and 2D UI key art |
| **Image → four views** | `imageToFourView.create` | `img` and/or `prompt` | Turns a concept into FRONT_¾, OPPOSITE_¾, SIDE and BACK views for multi-view 3D |
| **Image → 3D** | `imgTo3d.create` | `img` **or** `imgs` (1–32), `version` G1 / G1-Turbo, `faceCount` 10k–300k, `outputFormat` glb/zip/ply, `enablePbr`, `aiPredictSize` | **Main 3D path in v2**: concept + four views → model |
| Text → 3D | `textTo3d.create` | `prompt`, optional reference `img`, `style` (7 styles) | Fallback, and simple props |
| Material transfer | `materialTransfer.create` | material `img` + `meshUrl`, `v3.0-standard` | Grey "silenced" twins, tank camos, container colour variants |
| Part split | `partSplit.create` | `glbUrl` | Tank turret/hull separation, boss panels, mech limbs, debris |
| Articulation animation | `articulationAnimation.create` | `glbUrl` + motion `prompt` | Non-humanoid motion: turret rotation, mech walk cycle, crane swing, balloon bob |
| Humanoid auto-rig | `humanoidAutoRig.create` | `modelUrl` (HTTPS GLB) | VOLT, hazmat ravers, civilians, Hush agents |
| Animation retarget | `humanoidAnimationRetarget.create` | rigged GLB + 1–10 of 85 animation IDs, combined/separate, in-place | Idle, dance, cheer, walk, hit, death |
| Multi-format export | `multiFormatExport.create` | glb/zip → usdz, obj_zip, fbx_zip, stl, 3mf | Garage export (3D print / AR), optional |
| World generation | `world.generations.create` | text and/or 1 image | 3DGS / panorama skyline (grey and neon) |
| Asset upload | `asset.uploadFile` | local file | Concept images, material references, re-uploads after URL expiry |

**Limits:**

- **No retopology endpoint** exists. Use `faceCount`, then simplify locally with meshoptimizer.
- Result URLs expire after **2 h**; the pipeline downloads them immediately.
- Concurrency is **2** on Free; over-limit calls cost nothing and are retried.
- The animation library has exactly **one dance** (`Dance_Loop`). Variety comes from `Yes`, `Jump_Loop`, `Idle_Loop`, time offsets and procedural beat bounce.
- Aholo does **not** generate UI layouts, fonts or VFX. Those are built in code. Aholo supplies the 3D models that the 3D UI shows (garage turntable, rendered 3D icons) and 2D key art.

**Credits:** the API has no balance endpoint. Each asset costs about 4–6 tasks in v2 (concept, four-view, image-to-3D, grey, plus split or rig). **Watch the balance on the Aholo dashboard** while we go one by one.

---

## 3. v2 generation pipeline (per asset, with review gates)

```
① concept   multimodalToImage(prompt = STYLE + asset brief)            → review gate A (2D look)
② views     imageToFourView(img = approved concept)                    → review gate B (consistency)
③ model     imgTo3d(imgs = [concept, 4 views], G1, faceCount, glb,
                    aiPredictSize:false, enablePbr:true)               → review gate C (3D turntable render)
④ grey      materialTransfer(img = mat_grey_*, meshUrl)                (remixable assets only)
⑤ extra     partSplit | articulationAnimation | autoRig → retarget     (per asset)
⑥ optimize  meshopt + WebP + local simplify → public/assets/<category>/
⑦ in-game   placed in the level, screenshot reviewed                   → review gate D (in context)
```

- **Review gates** are where you and I look at the output: concept PNG, turntable contact sheet, in-game screenshot. A failed gate leads to a reroll with an adjusted prompt, and both versions are logged in the manifest. A maximum of 3 rerolls per gate keeps credits under control.
- **Fallback if multi-view input is rejected:** `imgTo3d` with only `img` = concept, or `textTo3d` with `img` = concept as a reference. The first asset tells us which mode gives the best result.
- **Why concept-first:** text-to-3D alone produced generic models in the first pass. A concept image lets us lock the reference look (palette, decals, proportions) *before* paying for 3D, and every later asset reuses the same style block, so the set stays coherent.
- No reference frame is ever uploaded as an input image. Concepts come from our own text prompts only (see `00b` §3).

### 3.1 Shared style block (prepended to every concept prompt)

```
STYLE = "Stylized-realistic 3D game asset render, high-end animated feature film look,
slightly chunky playful proportions, rich PBR materials: glossy toy-like plastics, painted
steel with sticker-bomb and abstract graffiti decals (no readable letters), worn corrugated
metal, warm golden-hour key light with soft bounce, candy accent palette of hot magenta
#FF3EC8, electric cyan #3EE6FF, acid green #7CFF6B, sunflower yellow #FFC83D and tangerine
#FF6B3D on a warm brick-and-cream base, festive holiday details. Single isolated object,
three-quarter view, full object in frame, centered, plain light-grey seamless studio
background, soft contact shadow, no text, no logos, no watermark, no people unless stated."
```

Characters append: `"Full body, standing in a clean T-pose, arms straight out to the sides, legs slightly apart, facing camera, neutral expression."` This T-pose rule is required for auto-rigging.

### 3.2 Grey material references (material transfer)

| ID | Look | Used for |
| --- | --- | --- |
| `mat_grey_concrete` | wet matte grey concrete | buildings, props |
| `mat_grey_stone` | smooth pale statue stone | frozen citizens |
| `mat_hush_felt` | dark grey acoustic foam | Hush enemy variants |
| `mat_camo_circuit` | black base with acid-green / cyan graffiti circuit lines | Deckhound default camo |
| `mat_camo_candy` | glossy red-white candy stripes with gold flecks | camo "Candy Circuit" |
| `mat_camo_aurora` | iridescent violet-teal metallic | camo "Aurora Static" |

The three grey references already exist as procedural images. The camo references will be produced as concept images (step ①) and reviewed like any asset.

---

## 4. Asset inventory and prompts

Columns: **P** = priority (1 = first). **Steps** use the codes from §3. **Size** is the in-game target. **Faces** is the `faceCount` sent to Aholo before local simplification.

### A. Characters

| ID | P | Asset | Steps | Size | Faces |
| --- | --- | --- | --- | --- | --- |
| CH_VOLT | 2 | VOLT, player DJ | ①②③ rig, retarget `Idle_Loop, Yes, Dance_Loop, Driving_Loop, Jump_Loop` | 1.8 m | 40k |
| CH_RAVER | 5 | Hazmat raver (frozen → dancing crowd) | ①②③④ stone, rig, retarget `Dance_Loop, Jump_Loop, Yes, Idle_Loop` | 1.75 m | 25k |
| CH_COURIER | 9 | Delivery courier civilian | ①②③④ rig, retarget `Walk_Carry_Loop, Dance_Loop, Yes` | 1.8 m | 25k |
| CH_KID | 9 | Kid in puffer jacket | ①②③④ rig, retarget `Dance_Loop, Jump_Loop, Yes` | 1.3 m | 20k |
| CH_HUSH_AGENT | 6 | Hush enforcer (enemy infantry) | ①②③ rig, retarget `Walk_Loop, Pistol_Aim_Neutral, Pistol_Shoot, Hit_Chest, Death01` | 1.9 m | 25k |

**CH_VOLT:**
> STYLE + "an original masked street DJ character: oversized black satin bomber jacket covered in colourful abstract graffiti patches and neon stickers, magenta inner lining, baggy charcoal cargo pants with straps, chunky high-top sneakers with glowing cyan soles, fingerless gloves, over-ear headphones around the neck, wearing a glossy black rounded-cube helmet whose front is a full LED visor showing cyan equalizer bars and two pixel-dot eyes, small mirrored disco tiles on the helmet's top edges. Full body, standing in a clean T-pose…"

**CH_RAVER:**
> STYLE + "a festival raver in a puffy bright sunflower-yellow hazmat-style jumpsuit with black rubber gloves and boots, hood with a rounded glossy black face visor, small neon glow-stick bracelets, playful chunky proportions. Full body, standing in a clean T-pose…"

**CH_COURIER:**
> STYLE + "a city delivery courier in a red puffer vest over a grey hoodie, beanie with pom-pom, cargo shorts over leggings, sneakers, a wrapped holiday parcel strapped to the back. Full body, standing in a clean T-pose…"

**CH_KID:**
> STYLE + "a cheerful kid in a teal puffer jacket, striped knitted scarf, bobble hat with a big pom-pom, mittens, snow boots, chunky cute proportions. Full body, standing in a clean T-pose…"

**CH_HUSH_AGENT:**
> STYLE (grey palette override: "desaturated slate-grey and pale icy-blue only, no candy colours") + "an enforcer of a sinister soundproofing corporation: grey tactical suit padded with grey acoustic foam armour plates, smooth faceless pale-grey helmet with one horizontal icy-blue light slit, a bulky noise-dampener backpack with a small dish antenna. Full body, standing in a clean T-pose…"

### B. Tanks and combat vehicles

| ID | P | Asset | Steps | Size | Faces |
| --- | --- | --- | --- | --- | --- |
| **VH_DECKHOUND** | **1** | Player tank, full model | ①②③ part split (turret / hull / barrel), camos via ④ | 7.5 m | 60k |
| VH_MUTE_TANK | 4 | Enemy light tank | ①②③ part split (turret pops off) | 6.5 m | 30k |
| VH_HUSH_HEAVY | 6 | Enemy heavy tank | ①②③ part split | 8.5 m | 40k |
| VH_DRONE | 4 | Hush drone | ①②③ articulation `"four rotors spin, body bobs"` | 1.6 m | 15k |
| VH_HUSH_VAN | 8 | Hush armoured van (military vehicle / spawner) | ①②③④ | 6 m | 25k |
| BOSS_STACKER | 7 | Mid-boss: container mech | ①②③ part split, articulation `"bipedal walk, arms swing"`, ④ remixed variant | 16 m | 120k |
| BOSS_SILENCER | 7 | Final boss | ①②③ part split (4 panels, crystal, horn, base) | 14 m | 100k |

**VH_DECKHOUND:**
> STYLE + "an original modern main battle tank converted into a mobile DJ sound system: low wide hull with six road wheels and rubber tracks, side skirts with built-in speaker grilles, the turret built around a twin turntable DJ deck with two large chrome-ringed speaker cones on each side, a roof LED light bar, a row of three square LED panels on the turret side showing a cyan equalizer bar, a yellow lightning bolt and a magenta star, a long cannon ending in a glowing cyan ring muzzle, matte black base paint covered in acid-green and cyan graffiti circuit-line camouflage with magenta paint splashes, subwoofer-port exhausts at the rear."

**VH_MUTE_TANK:**
> STYLE (grey override) + "a compact boxy enemy light tank wrapped in dark grey acoustic foam panels, a narrow turret with a long thin cannon sleeved in foam, a single horizontal red sensor strip at the front, dull industrial steel tracks."

**VH_HUSH_HEAVY:**
> STYLE (grey override) + "a massive enemy heavy tank with angular slate-grey armour, thick stacked noise-dampener plates on the hull, a wide turret with twin short cannons and a radar dish shaped like a muted speaker, icy-blue indicator lights, rubber tracks."

**VH_DRONE:**
> STYLE (grey override) + "a hovering quadcopter drone wrapped in grey egg-crate acoustic foam, four ducted rotors, one big round red camera eye with a glowing ring, small antenna."

**VH_HUSH_VAN:**
> STYLE (grey override) + "an armoured grey corporate van with black steel bumpers, roof-mounted dampener dish, side windows covered by foam panels, icy-blue light bar."

**BOSS_STACKER:**
> STYLE + "a giant original bipedal mech robot assembled entirely from stacked shipping containers in red, blue, teal, orange and yellow, with heavy corrugated textures, sticker-bomb and abstract graffiti, a crane boom as one arm, a magnet claw as the other arm, a cab with glowing red windows as the head, hydraulic pistons at the joints, string lights tangled across its chest, snow on the shoulders."

**BOSS_SILENCER:**
> STYLE (grey override) + "a colossal machine shaped like an antique gramophone horn wrapped in grey acoustic foam, four large rectangular dampener panels mounted around it, a glowing pale-blue crystal core at the centre, a heavy riveted industrial base with exhaust vents, cables hanging down."

### C. City and environment

| ID | P | Asset | Steps | Footprint × height | Faces |
| --- | --- | --- | --- | --- | --- |
| ENV_CONTAINER | 3 | Single 40 ft shipping container | ①②③④, colour variants via ④ | 12×2.5×2.6 m | 15k |
| ENV_CONTAINER_STACK | 3 | Container-stack building (signature) | ①②③④ | 14×14×18 m | 60k |
| ENV_BROWNSTONE | 3 | Brownstone townhouse with stoop | ①②③④ | 10×12×14 m | 50k |
| ENV_TENEMENT | 3 | Red-brick tenement with fire escapes | ①②③④ | 14×12×22 m | 60k |
| ENV_CAFE_CORNER | 5 | Corner café / deli | ①②③④ | 12×12×10 m | 50k |
| ENV_RECORD_STORE | 5 | Record store | ①②③④ | 10×10×10 m | 50k |
| ENV_TOY_STORE | 8 | Toy store | ①②③④ | 12×10×12 m | 50k |
| ENV_DEPT_STORE | 5 | Plaza department store | ①②③④ | 24×16×18 m | 70k |
| ENV_ARTDECO_TOWER | 8 | Art-deco skyscraper (plaza ring / skyline) | ①②③④ | 18×18×60 m | 50k |
| ENV_CRANE | 8 | Construction tower crane | ①②③ articulation `"jib slowly rotates"` | 30 m tall | 30k |
| ENV_BILLBOARD | 8 | Rooftop billboard frame (screen texture in code) | ①②③④ | 12×6 m | 15k |
| ENV_STAGE | 7 | Plaza concert stage with truss | ①②③④ | 16×10 m | 50k |
| ENV_GIANT_TREE | 4 | 25 m giant holiday tree | ①②③④ | 12×25 m | 80k |

**ENV_CONTAINER:**
> STYLE + "a single 40-foot steel shipping container, deep corrugated walls, cargo doors with lock bars, paint in saturated teal with sticker-bomb patches and abstract graffiti tags, light rust on the edges, a strand of holiday string lights along the top."

**ENV_CONTAINER_STACK:**
> STYLE + "a building made from shipping containers stacked five high in a staggered pattern, containers painted red, cobalt blue, teal, orange and yellow, covered in abstract graffiti and sticker-bomb art, metal stairs and walkways between levels, windows cut into some containers glowing warm, holiday garlands and string lights draped across, snow on the top edges."

**ENV_BROWNSTONE:**
> STYLE + "a classic four-storey brownstone townhouse with a front stoop, tall sash windows with warm light, ornate cornice, wreaths on the door, garlands on the stoop railings, a striped shop awning at street level, a little snow on the ledges."

**ENV_TENEMENT:**
> STYLE + "a six-storey red-brick tenement building with black iron fire escapes zig-zagging across the facade, water tower on the roof, ground-floor shops with colourful signs shaped as simple icons, holiday string lights hanging from the fire escapes, graffiti murals on the side wall."

**ENV_CAFE_CORNER:**
> STYLE + "a two-storey corner café on a brick building, big glowing windows, outdoor patio heaters, a large coffee-cup-shaped sign, pastel pink and mint shopfront, garlands and fairy lights."

**ENV_RECORD_STORE:**
> STYLE + "a two-storey record store building with a giant vinyl disc sculpture on the facade, neon-trimmed windows filled with record sleeves of abstract art, magenta and cyan accents, string lights."

**ENV_TOY_STORE:**
> STYLE + "a playful toy store building with a giant teddy-bear statue on the roof, round porthole windows, candy-striped columns, garlands and lights."

**ENV_DEPT_STORE:**
> STYLE + "a grand three-storey department store with tall arched display windows, giant glossy holiday ornaments mounted on the facade, golden lights tracing the cornices, revolving door entrance, red velvet banners with abstract patterns."

**ENV_ARTDECO_TOWER:**
> STYLE + "a slim art-deco skyscraper with stepped setbacks, vertical ribbing, golden crown spire, windows warmly lit, a large blank LED screen near the top."

**ENV_CRANE:**
> STYLE + "a yellow-and-orange construction tower crane with lattice mast, long jib, counterweight, hook block with a hanging shipping container, red warning lights."

**ENV_BILLBOARD:**
> STYLE + "a rooftop billboard frame with steel scaffolding legs, catwalk, spotlights, and a large blank glowing white screen."

**ENV_STAGE:**
> STYLE + "an outdoor concert stage with a black steel truss roof, stacked speaker towers on both sides, moving-head lights, LED wall panels, confetti cannons at the front edge."

**ENV_GIANT_TREE:**
> STYLE + "a giant 25-metre holiday pine tree, lush needles, huge glossy ornaments in candy colours, spiralling string lights, a large inflatable blue balloon-animal dog wrapped around the upper branches, a big golden star on top."

### D. Props, set dressing and giant inflatables

| ID | P | Asset | Steps | Size | Faces |
| --- | --- | --- | --- | --- | --- |
| PR_INFLATABLE_DUCK | 4 | Giant inflatable rubber duck | ①②③④, articulation `"gently bobs and sways"` | 10 m | 30k |
| PR_INFLATABLE_PIGEON | 8 | Giant inflatable pigeon | ①②③④ | 10 m | 30k |
| PR_DUMPSTER | 5 | Graffiti dumpster | ①②③④ | 2 m | 15k |
| PR_LAMP | 5 | Street lamp with garland | ①②③④ | 5 m | 10k |
| PR_TRAFFIC_LIGHT | 8 | Traffic light pole | ①②③④ | 6 m | 10k |
| PR_HYDRANT | 8 | Fire hydrant with tiny hat | ①②③④ | 1 m | 10k |
| PR_TAXI | 6 | Yellow city taxi | ①②③④ part split (wheels) | 4.8 m | 25k |
| PR_BOX_TRUCK | 8 | Delivery box truck | ①②③④ | 7 m | 25k |
| PR_SNOWMAN | 6 | Snowman | ①②③④ | 2.6 m | 10k |
| PR_GIFTS | 6 | Gift stack | ①②③④ | 2.4 m | 10k |
| PR_ORNAMENT | 8 | Giant ornament | ①②③④ | 2.5 m | 10k |
| PR_MARKET_STALL | 6 | Holiday market stall | ①②③④ | 4.5 m | 20k |
| PR_SPEAKER_TOWER | 7 | Speaker tower | ①②③④ | 7 m | 15k |
| PR_BARRICADE | 5 | Hush barricade (grey) + gift-wrapped (neon) | ① both looks, ③ each | 4 m | 10k |
| PR_PYLON | 4 | Silencer pylon | ①②③ part split (crystal) | 6 m | 15k |
| PR_PLANTER_TREE | 8 | Street tree in planter | ①②③④ | 4 m | 15k |

**Prompts** (each is STYLE + the brief):

- **PR_INFLATABLE_DUCK** — "a giant glossy inflatable parade balloon of a yellow rubber duck wearing oversized DJ headphones and a knitted red-and-white scarf, tether ropes hanging below, slightly wrinkled vinyl seams."
- **PR_INFLATABLE_PIGEON** — "a giant inflatable parade balloon of a chubby grey city pigeon with iridescent green-purple neck feathers, wearing a tiny red beanie, tether ropes below."
- **PR_DUMPSTER** — "a lime-green metal city dumpster with black lids, scuffed paint, colourful abstract graffiti tags and stickers, trash bags beside it."
- **PR_LAMP** — "an ornate black cast-iron street lamp with a warm glowing lantern, wrapped in a pine garland with a red bow."
- **PR_TRAFFIC_LIGHT** — "a city traffic light pole with a horizontal arm, three-lamp signal head, pedestrian signal, a small wreath tied to the pole."
- **PR_HYDRANT** — "a chunky red fire hydrant wearing a tiny knitted holiday hat."
- **PR_TAXI** — "a boxy yellow city taxi cab with a checker stripe, roof sign light, a small wrapped present strapped on the roof."
- **PR_BOX_TRUCK** — "a delivery box truck with a white cab and a box body painted with colourful abstract graffiti, roll-up rear door."
- **PR_SNOWMAN** — "a friendly snowman with coal eyes, carrot nose, a striped scarf, a black top hat and stick arms."
- **PR_GIFTS** — "a stack of three giant wrapped gift boxes in magenta, cyan and gold paper with big glossy ribbons and bows."
- **PR_ORNAMENT** — "a giant glossy holiday ornament ball in metallic magenta with a gold cap and a swirl pattern."
- **PR_MARKET_STALL** — "a wooden holiday market stall with a peaked red-and-white striped roof, hanging ornaments and lanterns, counter with treats."
- **PR_SPEAKER_TOWER** — "a tall tower of stacked black concert speaker cabinets with chrome cones and cyan LED rings."
- **PR_BARRICADE** (grey) — "a grey concrete road barrier wrapped in dark acoustic foam with an icy-blue warning light." (neon) — "a road barrier wrapped like a present in glossy magenta paper with a huge gold bow."
- **PR_PYLON** — STYLE (grey override) + "an industrial pylon on a foam-padded base, a central steel column, a glowing pale-blue crystal floating on top inside a ring."
- **PR_PLANTER_TREE** — "a small pine tree in a square concrete planter, decorated with tiny lights and a bow."

### E. Pickups and currency

| ID | P | Asset | Faces |
| --- | --- | --- | --- |
| PU_VINYL | 6 | Collectible vinyl, black disc + glowing cyan label | 10k |
| PU_SUBWOOFER | 6 | Subwoofer power-up cube, glowing purple | 10k |
| PU_LASER | 6 | Laser crystal cube with beams | 10k |
| PU_REPAIR | 6 | Golden wrench with red ribbon | 10k |
| PU_CONFETTI | 6 | Confetti cannon | 10k |
| PU_BEAT_TOKEN | 7 | Currency coin: chunky gold coin with an equalizer emboss | 10k |

Steps: ①③ only (no grey twin). Prompt = STYLE + "a floating collectible game pickup: <brief>, glowing rim light, chunky readable shape."

### F. 3D UI and key art

Aholo cannot draw UI. The plan is to make **every UI element feel physical** by combining three kinds of sources.

| Source | Element | How |
| --- | --- | --- |
| Lux3D models, live 3D | Main-menu backdrop (Deckhound idling in the container street), garage turntable, level-select diorama cards, results podium | three.js scenes behind and inside the menus |
| Lux3D models, rendered to images | Item / weapon / camo / enemy icons, avatar portrait, badges | Offline turntable renderer: `scripts/render-icons.ts`, three.js headless (or Playwright), transparent PNG/WebP 256–512 px |
| `multimodalToImage` (2D) | Loading-screen art ×3, level-select card art, sticker-decal sheet for panels, menu key art | Style block plus a scene brief. **No text is baked into images**; all type comes from fonts |
| Code (CSS / WebGL) | Panels, buttons, HUD | "LED hardware" look: dark smoked glass, pixel-grid glow, bevelled edges, 3D tilt on hover (CSS perspective), sticker accents, beat-synced pulse |

**UI screen list (implementation after the asset foundation is approved):**

loading, title/main menu, profile and avatar, level select, garage (tank, camo, turret upgrade), upgrade shop, HUD (HP and armour, ammo/heat, special, Bass Drop, minimap, objectives, combo/groove, score and beat tokens, boss and enemy health bars), pause, settings, mission complete (results with before/after), game over.

**Key-art prompts (2D):**

- **UI_KEYART_MENU** — STYLE (scene override: "wide cinematic 16:9 scene, low fish-eye camera") + "an original graffiti-camo DJ tank with speaker turret parked in a snowy golden-hour street of brownstones and stacked colourful shipping containers, cranes in the sky, holiday garlands, giant inflatable rubber duck balloon floating between buildings."
- **UI_LOADING_1/2/3** — the same scene language: (1) container yard at sunset with the tank drifting; (2) plaza with the giant tree and stage at violet night with lasers; (3) the container mech looming over an avenue.
- **UI_STICKERS** — STYLE (flat override: "sticker sheet, flat vector stickers with white die-cut borders on a dark background") + "set of 12 abstract graffiti stickers: lightning bolts, stars, equalizer bars, speaker cones, music notes, smiley pixel faces, splats, no letters."

### G. VFX (code, not Aholo)

Muzzle flashes, bullet trails, explosions, smoke and fire, track dust, snow and sparkle snow, confetti, lasers, fireworks, remix dissolve edge, shockwaves, hit flashes, UI transitions. These are already partly implemented as pooled GPU particles. v2 adds flipbook textures (smoke, fire, explosion) authored procedurally, plus radial blur on boost.

### H. Environment backdrop (World API)

| ID | P | Asset | Notes |
| --- | --- | --- | --- |
| WORLD_SKYLINE_DAY | 9 | Grey/golden skyline backdrop | `world.generations` prompt: "snowy NYC-style city skyline at golden hour with construction cranes and stacked shipping containers, seen from street level" → panorama used as the far background |
| WORLD_SKYLINE_NIGHT | 9 | Violet neon night skyline | Same prompt with "violet night, neon signs, fireworks glow"; crossfades at THE DROP |

---

## 5. Roadmap (one asset at a time)

| Order | Asset(s) | Why this order |
| --- | --- | --- |
| **1** | **VH_DECKHOUND** | It is on screen 100% of gameplay and in every menu, so it defines the art direction. It also validates the full v2 pipeline (concept → four views → multi-view 3D → part split) on the hardest object before credits go anywhere else |
| 2 | CH_VOLT | Hero identity; validates the character path (T-pose → rig → retarget). Sits in the hatch and appears on the profile and results screens |
| 3 | ENV_CONTAINER, ENV_CONTAINER_STACK, ENV_BROWNSTONE, ENV_TENEMENT | The city's signature look. Four models fill most of the street once colour variants are applied |
| 4 | VH_MUTE_TANK, VH_DRONE, PR_PYLON, ENV_GIANT_TREE, PR_INFLATABLE_DUCK | Core enemies plus the two hero set pieces |
| 5 | CH_RAVER, ENV_CAFE_CORNER, ENV_RECORD_STORE, ENV_DEPT_STORE, PR_DUMPSTER, PR_LAMP, PR_BARRICADE | Crowd and street dressing |
| 6 | VH_HUSH_HEAVY, CH_HUSH_AGENT, PR_TAXI, PR_SNOWMAN, PR_GIFTS, PR_MARKET_STALL, pickups | Variety pass |
| 7 | BOSS_STACKER, BOSS_SILENCER, ENV_STAGE, PR_SPEAKER_TOWER, PU_BEAT_TOKEN | Boss fights and finale |
| 8 | Remaining props, ENV_CRANE, ENV_BILLBOARD, ENV_ARTDECO_TOWER, PR_INFLATABLE_PIGEON, VH_HUSH_VAN, PR_BOX_TRUCK | Polish |
| 9 | World skylines, UI key art, icon render pass | Presentation layer |
| 10 | UI/UX implementation | Only after the assets above are approved |

Rough budget: about 55 assets × about 5 tasks ≈ 275 Aholo tasks. At about 2–4 min per task and 2 in flight, that is **about 6–9 hours of generation**, plus review time. Order 1–5 (about 20 assets) is the minimum for a convincing demo.

**Deadline check:** the submission is due Thu 19 Nov, 16:30 IST. Generation for orders 1–5 must start tonight to leave Wednesday for UI and integration.

---

## 6. Folder structure and tracking

Adapted to this repo (Vite serves `public/`; raw downloads stay out of git):

```
content/
  assets.json            ← source of truth: one row per asset (prompts, steps, status, review)
  assets.lock.json       ← machine state: task IDs, URLs, files per step (resumable)
  materials/             ← material-transfer reference images
  concepts/<ID>/         ← approved concept + four views (PNG, small, committed)
assets-raw/              ← raw Lux3D GLBs (git-ignored, ~10 MB each)
public/assets/
  characters/  vehicles/  environment/  props/  pickups/  ui/icons/  ui/art/
  manifest.json          ← generated by scripts/optimize.ts, read by the game
references/              ← reference frames and contact sheets (git-ignored, copyrighted)
docs/asset-tracker.md    ← generated table: ID · category · status · review · file · prompt version
```

`content/assets.json` row schema (v2):

```jsonc
{
  "id": "VH_DECKHOUND", "category": "vehicles", "priority": 1,
  "brief": "…asset-specific prompt…", "styleOverride": null,
  "refs": ["video 0:20-0:32", "behance 17-0"],      // what we looked at; never uploaded
  "steps": ["concept", "fourView", "model", "split"],
  "model": { "version": "G1", "faceCount": 60000, "multiView": true },
  "grey": null, "rig": null, "animations": [], "articulation": null,
  "target": { "length": 7.5 },
  "status": "planned",                                // planned → concept → views → model → done
  "review": { "A": null, "B": null, "C": null, "D": null, "notes": "" },
  "rerolls": 0
}
```

**Script changes (after approval):**

- `gen-assets.ts` gains the `concept`, `fourView`, `imgTo3d` (multi-view) and `articulation` steps.
- Stage control: `--only <ID> --until concept|views|model|all` stops at each review gate.
- `--approve <ID>:<gate>` marks a gate as passed.
- `scripts/review.ts` renders turntable contact sheets of the GLB (gate C).
- `scripts/tracker.ts` regenerates `docs/asset-tracker.md`.

---

## 7. Quality checklist (applied at every gate)

- [ ] Matches the reference *language* (palette, materials, proportions, holiday dressing) without copying protected designs
- [ ] Reads clearly at gameplay distance (silhouette test: black-fill render)
- [ ] Real 3D volume: no flat cards, no baked background, no floating debris
- [ ] PBR textures are sharp at 1024 after optimisation, with no visible seams on hero faces
- [ ] Correct scale against the 7.5 m tank and the 1.8 m character
- [ ] Pivot sits at the bottom centre, and the front faces +Z (fixed in code if not)
- [ ] Grey twin aligns with the neon model (bounds within 1%)
- [ ] Triangle count after simplification is within budget; GLB under 1.5 MB (hero) / 0.6 MB (props)
- [ ] Characters: clean T-pose, rig binds with no candy-wrapper joints, dance loop plays
- [ ] Consistent with the assets already approved (side-by-side sheet)
