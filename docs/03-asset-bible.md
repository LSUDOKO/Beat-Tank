# 03 — Asset Bible

Every 3D object in the level is generated with **Aholo Lux3D**. This file lists each asset with its ID, prompt, size, budgets, variants and processing needs. The generation pipeline is in `05-aholo-pipeline.md`; store these rows in `content/assets.json` so scripts can batch them.

---

## 1. Global style rules

**Lux3D style:** `photorealistic` (default) for everything — we want a "real game" stylized-realistic look like modern mobile tank games.

**Style suffix (append to every prompt):**
```
, stylized realistic game asset, clean readable silhouette, slightly chunky proportions, high quality PBR materials, single object, centered, no background, no text, no logos
```

**Two-state rule (grey ↔ neon):**
1. Generate the **neon holiday version** with text-to-3D (richer detail: string lights, ornaments, glowing signs).
2. Create the **grey version** with **material transfer** onto the same mesh using reference `mat_grey_concrete.jpg` (wet grey concrete / matte grey paint).
3. Both share geometry → the Remix dissolve shader can blend them perfectly (see `07`).
4. Emissive: in the engine, pixels of the neon texture above a brightness threshold become emissive (see `06`).

**Units:** 1 unit = 1 m. Pivot = bottom center. Forward = +Z for vehicles.

**Budgets (after Lux3D retopology):**

| Class | Triangles | Texture |
| --- | --- | --- |
| Hero (player tank, VOLT) | 25k–40k | 2048 |
| Boss | 40k | 2048 |
| Mid-boss / enemy vehicles | 12k–15k | 1024 |
| Buildings | 8k–15k | 1024 |
| Citizens | 10k | 1024 |
| Small props | 1.5k–4k | 512 |
| Drones / pickups | 3k | 512 |

---

## 2. Material reference images (for material transfer)

Keep as 1024×1024 square images in `content/materials/`. Make them yourself (photo) or from CC0 texture sites (Poly Haven / ambientCG) — not from the reference video.

| ID | Material | Used for |
| --- | --- | --- |
| mat_grey_concrete | wet matte grey concrete | grey state of buildings and props |
| mat_grey_stone | smooth grey statue stone | frozen citizens |
| mat_hush_felt | dark grey acoustic felt / foam | Hush enemies, Silencer panels |
| mat_neon_candy | glossy red-white candy stripes | camo "Candy Circuit" |
| mat_aurora | iridescent purple-teal metallic | camo "Aurora Static" |
| mat_tinsel_gold | gold tinsel / foil | camo "Tinsel Grid", decorations |
| mat_chrome | polished chrome | speakers, trims |
| mat_frost_glass | frosted glass with warm bokeh lights | windows (neon) |

---

## 3. Player

| ID | Asset | Lux3D prompt (before suffix) | Size | Process |
| --- | --- | --- | --- | --- |
| P_TANK_HULL | BT-01 Deckhound hull | "a low wide armored tank hull without turret, side armor skirts with built-in speaker grilles, rear exhaust shaped like subwoofer ports, LED light strips along the edges, dark gunmetal with cyan accents" | 7 m long | retopo 25k / 2048 |
| P_TANK_TURRET | Deckhound turret | "a tank turret built around a twin turntable DJ deck, two big speaker cones on the sides, a roof light bar, a short thick cannon with a glowing cyan muzzle ring, dark gunmetal with cyan accents" | 3.5 m wide | retopo 15k / 2048; **part split** to separate barrel (recoil) |
| P_TANK_ALT_1 | BT-02 "Subwoofer" (garage) | "a heavy boxy tank with one giant subwoofer on the turret, chrome trims, purple accents" | 7.5 m | optional |
| P_TANK_ALT_2 | BT-03 "Hi-Hat" (garage) | "a light fast tank with cymbal-shaped armor plates on the turret, gold accents" | 6 m | optional |
| P_VOLT | VOLT (DJ in hatch) | "a young DJ character in a black hoodie and big headphones wearing a smooth glowing cube-shaped visor helmet with a cyan screen, standing in T-pose, arms out" | 1.8 m | auto-rig → retarget: idle, wave, cheer, dance, point |
| P_CAMO_x | Camos | material transfer of hull+turret with mat_neon_candy / mat_aurora / mat_tinsel_gold | — | 3 variants |

**Tracks:** do **not** generate tracks. Build simple procedural tread meshes in code (box strip + scrolling tread normal map) attached under the hull so they animate with speed. Add 6 road wheels as simple cylinders hidden behind skirts.

**Animated parts in engine:** turret yaw, barrel pitch + recoil, speaker cone pump (vertex scale on kick, masked by UV region or separate mesh), light bar (emissive chase shader), laser emitters (VFX beams from 2 empty sockets).

---

## 4. Enemies & bosses (The Hush)

| ID | Asset | Prompt | Size | Process |
| --- | --- | --- | --- | --- |
| E_DRONE | Hush Drone | "a flying quadcopter drone wrapped in grey acoustic foam with a crossed-out speaker emblem shape, one red sensor eye" | 1.2 m | retopo 3k; hover bob + tilt in code |
| E_TOWER | Static Tower | "a tall grey metal antenna tower with stacked dish-shaped dampeners and a red warning light on top" | 8 m | retopo 8k; **part split** (dishes fall off on death) |
| E_MUTE_TANK_HULL | Mute Tank hull | "a boxy grey armored tank hull covered in acoustic foam panels, dull and industrial" | 6.5 m | retopo 12k |
| E_MUTE_TANK_TURRET | Mute Tank turret | "a boxy grey tank turret with a long thin cannon wrapped in foam" | 3 m | retopo 6k |
| E_PYLON | Silencer Pylon | "a grey industrial pylon with a glowing pale blue mute crystal on top and foam panels around the base" | 6 m | **part split** (crystal, panels) |
| MB_DOZER | Sleigh-Dozer | "a huge grey armored snowplow truck shaped like a sleigh with two giant plow blades at the front, industrial, dull grey metal" | 9 m | retopo 15k; **part split**: blade_L, blade_R, engine, body |
| B_SILENCER | The Silencer | "a giant machine shaped like an old gramophone horn wrapped in grey acoustic foam, four large rectangular dampener panels around it, a glowing pale blue crystal core in the center, heavy industrial base" | 14 m | retopo 40k / 2048; **part split**: panel_N, panel_E, panel_S, panel_W, crystal, horn, base |

Enemy destruction: all part-split pieces fly with Rapier physics, then turn into confetti + color burst (enemies are *remixed*, not gore).

---

## 5. Citizens (frozen → dancing)

All generated in **T-pose**, then **auto-rig + retarget**. Grey "frozen" version = material transfer with `mat_grey_stone`.

| ID | Prompt (T-pose, arms out) | Animations |
| --- | --- | --- |
| C_OFFICE | "an office worker in a long coat and scarf" | frozen pose (idle frame), dance A, cheer |
| C_KID | "a kid in a puffy winter jacket and bobble hat" | frozen, dance B, jump-cheer |
| C_GRANDMA | "a grandma in a knitted cardigan holding gift bags" | frozen, dance C, wave |
| C_SKATER | "a teen skater in a hoodie and beanie" | frozen, dance A, cheer |
| C_MUSICIAN | "a street musician with a long scarf" | frozen, dance B, clap |
| C_VENDOR | "a food cart vendor in an apron and winter hat" | frozen, dance C, wave |

Use 1–10 animation IDs per retarget call from the 85-animation library. Pick dance/cheer/clap/wave IDs if available; if the library has no dances, use idle + cheer + jump and add procedural bounce on the beat.

---

## 6. Buildings (neon version first, grey via material transfer)

| ID | Building | Prompt (neon holiday version) | Footprint | Zone |
| --- | --- | --- | --- | --- |
| B_CORNER_SHOP | Corner shop | "a two-story corner shop building with big windows, glowing neon sign shapes, string lights along the roof, wreath on the door, holiday decorations" | 10×10 m | A |
| B_BAKERY | Bakery | "a cozy two-story bakery with striped awning, warm glowing windows, gingerbread decorations, string lights" | 10×8 | A |
| B_RECORD | Record store | "a record store building with a giant vinyl record sign on the facade, neon trims, string lights" | 10×8 | A |
| B_CAFE | Cafe | "a small cafe with outdoor heater lamps, glowing windows, a big coffee cup sign, holiday lights" | 8×8 | A |
| B_TOY | Toy store | "a toy store with a giant teddy bear sign, colorful windows, garlands and lights" | 12×10 | A |
| B_APT_A | Apartment block A | "a four-story apartment building with balconies covered in colorful string lights, glowing windows" | 14×12 | A/B |
| B_APT_B | Apartment block B | "a five-story narrow apartment building with neon window frames and hanging lanterns" | 10×10 | B |
| B_MARKET_HALL | Market hall | "an old covered market hall with arched glass roof, glowing lanterns and garlands" | 20×14 | B |
| B_TRAM_STATION | Tram station | "a modern tram station shelter with glowing ad panels and holiday lights" | 14×5 | B |
| B_DEPT_STORE | Department store | "a grand three-story department store with huge display windows, giant ornaments on the facade, golden lights" | 24×16 | C |
| B_CINEMA | Cinema | "a retro cinema with a marquee sign full of bulbs, neon trims, star decorations" | 16×12 | C |
| B_CLOCK | Clock tower | "a tall clock tower with a glowing clock face, wrapped in spiral string lights, star on top" | 8×8×30 | C |

Reuse with rotation, scale (±10%) and camo-free material variants to fill streets (~45 placed buildings from 12 models).

---

## 7. Props & set dressing

| ID | Prop | Prompt (neon version) | Count placed | Grey? |
| --- | --- | --- | --- | --- |
| PR_LAMP | Street lamp | "an ornate street lamp with a glowing warm lantern and a red ribbon" | 40 | yes |
| PR_BENCH | Bench | "a wooden park bench with a small garland" | 15 | yes |
| PR_BUSSTOP | Bus stop | "a bus stop shelter with glowing ad panel" | 4 | yes |
| PR_CAR_A | Parked car A | "a small hatchback car with a christmas tree tied to the roof" | 8 | yes |
| PR_CAR_B | Parked car B | "a vintage delivery van with gift boxes on top" | 5 | yes |
| PR_BILLBOARD | Billboard | "a large rooftop billboard frame with a glowing screen" | 4 | yes (screen texture swapped in code) |
| PR_HYDRANT | Hydrant | "a red fire hydrant with a tiny santa hat" | 12 | yes |
| PR_MAILBOX | Mailbox | "a mailbox stuffed with holiday letters" | 8 | yes |
| PR_KIOSK | Kiosk | "a newspaper kiosk with string lights" | 3 | yes |
| PR_STALL | Market stall | "a wooden christmas market stall with roof lights and hanging ornaments" | 10 | yes |
| PR_ARCH | Garland arch | "a big street arch made of garlands and glowing lights over a road" | 4 | yes |
| PR_ORNAMENT | Giant ornament | "a giant glossy christmas ornament ball, 3 meters tall" | 8 | yes |
| PR_GIFTS | Gift stack | "a stack of giant wrapped gift boxes with ribbons" | 10 | yes |
| PR_SNOWMAN | Snowman | "a friendly snowman with scarf and top hat" | 6 | yes |
| PR_CANDYCANE | Candy cane pillar | "a tall candy cane shaped pillar with lights" | 8 | yes |
| PR_TREE_SMALL | Small tree | "a decorated christmas tree, 4 meters tall" | 6 | yes |
| PR_GIANT_TREE | Giant tree | "a giant christmas tree 25 meters tall with huge ornaments, spiral string lights and a big star on top" | 1 | yes; star = separate generation `PR_STAR` |
| PR_STAR | Tree star | "a big glowing golden star topper" | 1 | yes |
| PR_STAGE | Stage | "an outdoor concert stage with truss frame, speaker stacks and light rigs" | 1 | yes |
| PR_SPEAKER_TOWER | Speaker tower | "a tall tower of stacked concert speakers" | 4 | yes |
| PR_TRAM | Tram car | "a modern city tram car decorated with lights" | 1 | yes |
| PR_TRAFFIC | Traffic light | "a city traffic light pole" | 10 | yes |
| PR_BIN | Trash bin | "a metal city trash bin" | 12 | yes |
| PR_SNOWPILE | Snow pile | "a pile of dirty snow" | 20 | grey only |
| PR_BARRICADE | Hush barricade | "a grey concrete road barricade with foam panels and a crossed-out speaker shape" | 12 | neon = "a road barricade wrapped like a gift with a big bow" |

---

## 8. Pickups & collectibles

| ID | Item | Prompt | Effect |
| --- | --- | --- | --- |
| PU_SUBWOOFER | Subwoofer power-up | "a glowing subwoofer speaker cube" | Shockwave special charge |
| PU_LASER | Laser cube | "a glowing crystal cube with laser beams" | Laser Show special |
| PU_CONFETTI | Confetti cannon | "a small party confetti cannon" | Wide paint blast |
| PU_REPAIR | Repair | "a glowing wrench with a ribbon" | +100 HP |
| COL_VINYL | Vinyl collectible | "a shiny vinyl record with a glowing cyan label" | 8 hidden in level |

---

## 9. Environment

| ID | Item | Source |
| --- | --- | --- |
| ENV_SKYLINE_GREY | Distant grey city skyline at dusk | **Aholo World API (SpatialGen)** prompt: "grey snowy city skyline at dusk, silent, no lights" → 3DGS or panorama |
| ENV_SKYLINE_NEON | Same skyline, neon holiday night | SpatialGen prompt: "colorful neon holiday city skyline at night with fireworks glow" (crossfade at THE DROP) |
| ENV_GROUND | Roads, sidewalks, plaza tiles | CC0 PBR textures (Poly Haven / ambientCG) on simple meshes built in code |
| ENV_HDRI | Lighting | Poly Haven dusk HDRI (grey state) + night city HDRI (neon state) |

---

## 10. Generation count & order

| Group | Models | Extra tasks |
| --- | --- | --- |
| Player | 2 (+2 optional) | retopo ×2, part split ×1, camo transfer ×6 |
| VOLT | 1 | retopo, rig, retarget |
| Enemies/bosses | 7 | retopo ×7, part split ×5, grey not needed |
| Citizens | 6 | retopo ×6, rig ×6, retarget ×6, grey transfer ×6 |
| Buildings | 12 | retopo ×12, grey transfer ×12 |
| Props | 25 | retopo ×25, grey transfer ×24 |
| Pickups | 5 | retopo ×5 |
| Worlds | 2 | — |
| **Total** | **~60 generations** | **~120 follow-up tasks** |

Order: **Tank → Silencer → 6 buildings → giant tree → drones → citizens → rest.** Start generation tonight; with a concurrency limit of 2, expect the batch to run for several hours.
