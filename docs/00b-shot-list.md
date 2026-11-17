# 00b — Reference Shot List & Visual Analysis

Sources analysed (reference only — nothing here ships in the game):

- **Video**: local copy of the reference music video, 3840×2160, 30 fps, 2:36. Contact sheets every 2 s.
- **Behance stills/GIFs**: 21 files listed in `download_mac_linux.sh` (18 GIFs, 3 PNG stills, 1 credits strip). Three frames were pulled from each GIF.

Frames and contact sheets are kept in `references/`, which is git-ignored because the material is copyrighted. They are never used as textures, model inputs or report images.

## 1. Shot list (video)

| Time | Shot | Camera | Location / state | Key objects | VFX | Our original equivalent |
| --- | --- | --- | --- | --- | --- | --- |
| 0:00–0:08 | Close-ups | Handheld push, macro | White banquet table, real-world | Cheese, candles, red drinks, armoured guests | Shallow DOF | VOLT's bedroom studio (intro) |
| 0:06–0:16 | Hero transforms | Extreme close-ups, spins | Black void, rim light | Helmet put on, jacket with graffiti print, neon-lit sneakers | Particle sparks, light trails | VOLT "boots up" the cube-visor helmet |
| 0:16–0:20 | Hero dive | Orbit | Desert night, blue | Hero flying, helmet with lightning-bolt decals | Speed lines | Glitch portal drop |
| 0:20–0:32 | Tank chase | Low tracking, top-down drone | Desert canyon lined with **stacked shipping containers** | Graffiti-camo tank, cranes | Green laser burst, dust, motion blur | Zone B container yard |
| 0:32–0:40 | City entry | Dutch angles, whip pans | Brownstone street, warm golden hour | Graffiti wall, holiday garlands, "CAFE" sign, paper-wrapped billboard | Sparks, confetti | Slush Street |
| 0:40 | Alley | Low static | Brick alley | Green dumpster, litter, graffiti | Cyan laser sweep | Dumpster prop, alley dressing |
| 0:42–0:46 | **Giant inflatables** | Fish-eye low angle | Container-stacked skyscrapers | Giant pigeon, giant rubber duck in striped hat and chain | Pink smoke burst | Giant parade balloons (our own designs) |
| 0:48–1:04 | Warp tunnel | Forward dolly | Black LED tunnel → space nebula | Glowing lightning-face disc | Light streaks, chromatic aberration | Drop transition / portal |
| 1:06–1:12 | City chaos | Top-down, tracking | Avenue grid, traffic | Cars, trucks, tank tearing through | Debris, dust | Avenue traffic props |
| 1:14–1:22 | **Container mech** | Low hero angle | Avenue, golden hour | Giant bipedal robot built from graffiti containers | Snow spray, glass shards | Mid-boss "THE STACKER" |
| 1:24 | Courier | Static wide | Brownstone + snowman + hydrant | Delivery man carrying a box | — | Citizen NPC |
| 1:26 | DJ booth | Fish-eye | Rooftop | DJ controller "pool" of glowing pads | Liquid light | Tank turret deck |
| 1:28–1:34 | Rooftops | Crane | Cranes, water towers, glass bridge | Glass walkway shatters | Shards | Overpass set piece (later) |
| 1:36–1:54 | Crowd | Orbit, swarm | Sky over skyline | **Yellow hazmat-suit crowd** floating | Volumetric light | Dancing citizens after THE DROP |
| 1:46–2:00 | Night | Tilted aerials | Night skyline, sunset band | Hero skating on a building | Laser, lens flares | Neon night state |
| 2:02–2:12 | Gift drop & tree | Tracking | Night street, giant tree | Wrapped gift falling, blue balloon-animal on tree | Glitch, bokeh | Giant tree + balloon-animal topper |
| 2:14–2:30 | Party | Hero shots | Rooftop party, snow | Hazmat crowd dancing, hero on tank turret | Lasers, snow | Outro |
| 2:32–2:36 | End card | Static | Black | Logos | — | Our own end card |

## 2. Art-direction findings

| Element | What the reference does | Rule for BEATTANK |
| --- | --- | --- |
| Palette | Warm golden-hour base (peach, cream, brick red) with **candy accents**: hot pink, acid green, cyan, sunflower yellow, royal blue. Night: deep blue / violet with magenta and cyan neon | Grey state: cool desaturated blue-grey. Neon state: golden-hour warm base plus candy accents, then violet night after THE DROP |
| Materials | Glossy toy-like plastic (inflatables, helmets), painted steel with heavy sticker/graffiti decals, corrugated containers, wet asphalt reflections, real snow | Every hero asset is PBR stylised-realistic: slightly chunky, glossy where playful, worn where industrial |
| City | NYC-style brownstones, red-brick tenements with fire escapes, art-deco towers, **shipping containers stacked into walls and buildings**, construction cranes everywhere, holiday garlands and string lights | Container stacks become the signature building type of Zone B; cranes on the skyline; garlands everywhere in the neon state |
| Hero | Masked DJ: bomber jacket with graffiti patches, cargo pants, chunky sneakers, glossy LED helmet | **VOLT**: same streetwear energy, but an original rounded-cube helmet with an equalizer-bar visor. No ears, no grin logo |
| Tank | Modern MBT silhouette, black base with neon-green circuit graffiti camo, turret speakers, an LED panel row with icons | **Deckhound**: MBT silhouette, black + acid-green/cyan graffiti circuit camo, twin speaker cones, LED panel row showing our own glyphs (equalizer, lightning, star) |
| Scale gags | Giant pigeon, giant rubber duck, balloon animals | Giant inflatable parade balloons are remixable set pieces |
| Crowd | Yellow hazmat suits with black visors | Hazmat ravers are our frozen citizens; remixed, they dance |
| Camera / post | Fish-eye low angles, whip pans, heavy motion blur, chromatic aberration, bloom | Chase cam + FOV kicks, radial blur on boost, chromatic aberration on hits, strong bloom at night |
| UI language | LED pads, billboard screens, sticker-bomb graphics | HUD panels look like **LED hardware**: dark glass, pixel-grid glow, sticker accents |

## 3. What we must not copy

The following are a real artist's identity or a publisher's trademarks. They never appear in any prompt, model, texture, UI element or report:

- the mouse-ear helmet silhouette and the toothy grin face;
- mouse-ear icons on the tank LED panels;
- deadmau5, World of Tanks / Blitz and "Hits Different" names, logos and lettering;
- the music;
- any frame or pixel from the video or the Behance page.

Generic ideas stay fair to use: a music tank, graffiti camo, a container city, giant inflatables, a hazmat crowd and a holiday party. They are re-expressed with our own designs.
