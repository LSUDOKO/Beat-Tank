# 06 — Art Direction, VFX, Camera, Audio, UI

Goal: **looks like a real shipped game**, not a prototype. Two clear visual states — **GREY** (silent) and **NEON** (remixed) — and a dramatic transition between them.

## 1. Two world states

| Element | GREY state | NEON state |
| --- | --- | --- |
| Time of day | Overcast dusk | Night, party |
| HDRI | Poly Haven overcast/dusk, exposure 0.8 | Poly Haven night city, exposure 1.0 |
| Key light | Cool directional, 5600K-ish, soft shadows | Warm directional dimmed + many colored point lights near remixed buildings (limit 8 real lights; fake the rest with emissive + bloom) |
| LUT / grading | Desaturated (−70%), slight blue, lifted blacks | Saturated (+25%), warm highlights, magenta/cyan split-tone |
| Fog | Dense grey-blue fog 40–180 m | Light colored haze 80–250 m |
| Road | Wet asphalt, grey slush | Wet asphalt with colorful reflections |
| Snow | Slow grey flakes | Sparkly white flakes + glitter particles |
| Skyline | SpatialGen grey | SpatialGen neon (crossfade at THE DROP) |
| Audio | Track low-passed (filter 600 Hz) in un-remixed areas | Full track |

The grade is **local**: use a screen-space mix by "how remixed is the area around the camera" (zone meter) so streets visibly change as you play; THE DROP forces full NEON.

## 2. Rendering features (three.js / R3F)

| Feature | How |
| --- | --- |
| Tone mapping | `ACESFilmicToneMapping` (or AgX), sRGB output |
| Shadows | One directional light with shadow map 2048, cascaded via `three-csm` if needed; soft PCF |
| Reflections | Road: `MeshReflectorMaterial` (drei) on the main avenue + plaza only; elsewhere roughness + env map |
| Emissive | Neon textures: shader extracts pixels with luminance > 0.75 (or saturation+value high) → emissive × 3; animated flicker per building |
| Post-processing | `@react-three/postprocessing`: Bloom (mipmap, threshold 0.8), N8AO (ambient occlusion), LUT3D (grey/neon blend), Vignette, ChromaticAberration (only on hits/drop), SMAA |
| Volumetric look | Fake god-ray cones (additive cylinders with gradient) on street lamps and stage lights |
| Particles | GPU instanced points/sprites: snow, confetti, sparks, paint splashes |
| Decals | Paint splats on roads via drei `Decal` (pooled, max 64) |
| Sky | Background = SpatialGen panorama/3DGS skyline + gradient fog |

## 3. Remix transition (signature effect)

1. Hit point = `origin`. Uniform `uRadius` grows from 0 to object size over 0.6 s (ease-out).
2. Fragment shader: `d = distance(worldPos, origin) + noise(worldPos * 0.8) * 1.5`.
   - `d < uRadius - edge` → neon material
   - `d > uRadius` → grey material
   - in between → bright cyan/magenta **glowing edge** (emissive 6) + sparks spawned along the edge
3. Sound: rising "zip" + chord sting in key of the track.
4. Light pop: point light flash at origin (0.2 s).
5. Camera: tiny 0.05 s FOV punch.

## 4. VFX list

| VFX | Description |
| --- | --- |
| Muzzle flash | Cyan ring + equalizer-bar burst from barrel, synced to kick |
| Sound slug | Glowing projectile with ribbon trail and soundwave rings |
| Impact | Paint splash (colored, random palette), confetti puff, decal on ground |
| Perfect hit | Gold shockwave ring + "PERFECT" world-space text |
| Tank lights | Light bar chase pattern (1/8 notes), underglow on remixed ground |
| Speaker pump | Turret speaker cones scale 1.0→1.12 on kick |
| Lasers | Two additive beams with sine sweep (Laser Show + THE DROP) |
| Drone death | Pop into confetti + small firework |
| Part-split debris | Parts fly with Rapier, then dissolve into sparkles after 2 s |
| Silence ring | Grey expanding ring with distortion (refraction) on the ground |
| Boss mute wave | Cone of grey distortion + desaturation along its path |
| Fireworks | Instanced particle bursts, synced to bars in finale |
| Tree lighting | String lights turn on bottom→top in a spiral over 1 bar; star ignites with lens flare |
| Dust / snow kick-up | From tracks, scaled by speed |

## 5. Camera

| Mode | Settings |
| --- | --- |
| Gameplay chase | Behind and above tank: offset (0, 4.5, −10), look at tank + 3 m ahead of aim; FOV 60; damped follow (position 0.12, rotation 0.08); collision push-in against walls |
| Aim assist | Soft magnetism to nearest remixable/enemy within 3° |
| Boost | FOV 60 → 72, motion streak particles |
| Beat pulse | FOV +0.6 on each kick (setting to disable) |
| Cinematics | Spline-based camera rail (Theatre.js or custom Catmull-Rom) for intro, THE DROP, boss rise, outro |
| Shake | Trauma-based, capped; separate scales for hits, landing, boss |

## 6. Audio

| Layer | Content |
| --- | --- |
| Music | One 128 BPM electro-house track, stems if possible: drums, bass, synth, pads, FX. Use stems to add layers with Groove tier and to mute/filter in grey areas |
| Music source | Your own track, or a royalty-free track whose licence allows use in games and online video. Never "Familiars" or any commercial song |
| SFX | Cannon (pitched to key), remix sting (3 variants, rising with combo), tank engine (pitch by speed), tracks crunch on snow, drone buzz, mute wave whoosh, boss horn, fireworks, crowd cheer (Plaza after drop) |
| Mixing | Web Audio: master → music bus (low-pass filter node for grey state) + SFX bus (compressor). Duck music −3 dB on big SFX |
| Sources | Kenney audio (CC0), freesound (check licence per sound), or your own recordings |

## 7. UI / HUD

**Style:** dark glass panels, cyan (#3EE6FF) primary, magenta (#FF3EC8) secondary, gold (#FFC83D) for Perfect/rare. Display font: a bold geometric sans (e.g., "Rajdhani" or "Orbitron" — OFL); body: "Inter".

| HUD element | Position |
| --- | --- |
| Crosshair + beat ring | Center |
| Groove multiplier + combo count | Right of crosshair |
| Tank HP bar + boost cooldown | Bottom left |
| Special + Bass Drop meter | Bottom center |
| City Color meter (3 zone pips + total %) | Top center |
| Minimap (zones, enemies, remix targets) | Top right |
| Objective text | Top left ("Remix Slush Street 0/60%") |
| Boss bar with part icons | Top, under color meter |
| Hit feedback words (PERFECT/GOOD) | World-space at impact |

**Screens:** Title (tank idling in grey street, logo), Garage (tank on turntable, camos, optional prompt/photo), Level intro card, Pause, Settings (graphics preset, audio offset, sensitivity, invert, volume, shake, accessibility), Results (rank letter, score breakdown, before/after slider image, Tank Card, Share to X), Credits ("Made with Aholo Lux3D" + list of capabilities).

## 8. Graphics presets

| Preset | Shadows | AO | Reflections | Bloom | Particles | 3DGS skyline |
| --- | --- | --- | --- | --- | --- | --- |
| Low | off | off | off | on (low) | 30% | panorama |
| Medium | 1024 | off | plaza only | on | 60% | panorama |
| High | 2048 | on | avenue + plaza | on | 100% | 3DGS if integrated |
