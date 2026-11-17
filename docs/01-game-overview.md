# 01 — Game Overview

## Pitch

**BEATTANK: Remix the City** is a third-person arcade tank game where your weapon is music. You drive a DJ sound-system tank through a grey, silent holiday city. Every shot "remixes" what it hits — grey concrete becomes neon holiday color, frozen people start dancing. Fire on the beat for bigger blasts. Fill the city's color, trigger **THE DROP**, and take down **The Silencer**.

**Tagline:** *Drop the bass. Bring back the color.*

## Key facts

| Item | Decision |
| --- | --- |
| Genre | Third-person arcade tank action + rhythm bonus |
| Scope for hackathon | **One complete level**: "Silent Night District", ~4 minutes, one boss |
| Camera | Third-person chase camera behind the tank, mouse-aimed turret (like modern arcade tank games) |
| Platform | Web browser (desktop first; mobile twin-stick as bonus) |
| Engine | three.js via React Three Fiber, Rapier physics, TypeScript |
| Music | Original / royalty-free 128 BPM electro-house track with intro, build, breakdown, drop |
| Core Aholo use | Lux3D generates every asset; **material transfer** creates grey + neon versions of the city; part splitting for boss; auto-rig + retarget for citizens and VOLT; SpatialGen skyline; LuxReal trailer |

## Story

**Neon City** used to throw the biggest holiday party in the world. Then **The Hush**, a faceless grey corporation, bought the city and installed **Silencers** — giant machines that drain sound and color. Now it's the night before the holiday: the streets are grey, the lights are dead, and every citizen is frozen mid-step like a statue.

**VOLT** is a bedroom DJ who refuses to let the party die. One night, mid-livestream, the music glitches — and VOLT is pulled through the speakers into the city, landing in the cockpit of an old armored sound-system tank: the **BT-01 Deckhound**.

Every beat the Deckhound fires blasts color back into the world. Street by street, VOLT remixes the city — until the giant tree in the Plaza of Lights is ready for THE DROP, and The Silencer itself rises to stop the party.

### Characters (all original)

| Character | Role | Look |
| --- | --- | --- |
| **VOLT** | Player, DJ, tank commander | Hoodie, headphones, glowing **cube-visor helmet** that shows animated equalizer bars; visible in the turret hatch |
| **The Hush** | Faceless grey corporation (antagonist) | Grey uniforms, felt dampener panels, logo = a crossed-out speaker cone |
| **The Silencer** | Level boss | A 14 m tall machine shaped like a giant gramophone horn wrapped in acoustic foam, 4 dampener panels, a core "mute crystal" |
| **Sleigh-Dozer** | Mid-boss | A grey armored snowplow that pushes snow walls and plows decorations away |
| **Citizens** | Frozen grey statues → colorful dancers | Office worker, kid in scarf, grandma with gift bags, skater, street musician, food-cart vendor |

## Design pillars

1. **Music is the weapon.** Everything pulses to the beat; on-beat play is rewarded.
2. **Color is progress.** The player literally sees their progress as the city changes.
3. **One perfect level.** Polish beats size: every street has a moment.
4. **Feels like a real game.** Third-person chase camera, physics, cinematic lighting, real VFX, full UI.
5. **Made with Aholo.** Every 3D object came from Lux3D, and the game shows it off.

## Why this scores well

| Criterion | Weight | BEATTANK answer |
| --- | --- | --- |
| Use of Manycore tools | 30% | Lux3D for every asset; material transfer *is the core mechanic*; part splitting, rigging, retargeting, SpatialGen, LuxReal, export |
| Fun & engagement | 25% | Driving a party tank + rhythm + spectacular DROP moment; made for clips |
| Innovation | 20% | "Remix the world's materials" as gameplay; garage tank from any photo |
| Completeness | 20% | One finished level with intro, boss, outro, results, settings |
| Reach | 5% | Before/after city GIF + tank card shared to X with #Manycorehackathon |

## Optional runtime Aholo features (after the level works)

- **Garage — custom tank:** type a prompt or upload a photo → Lux3D builds a new turret/hull (pre-validated archetype stats).
- **Photo skin:** photograph any material (your hoodie, a pizza) → material transfer re-skins your tank.
- **Export:** download your tank as STL (3D print) or USDZ (AR).
