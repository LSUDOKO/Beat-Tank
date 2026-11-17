# 02 — Level Design: "Silent Night District"

## 1. Summary

| Item | Value |
| --- | --- |
| Length | ~4:00 (intro cutscene 0:25 + gameplay ~3:00 + outro 0:20) |
| Music | 128 BPM, 4/4. 1 bar = 1.875 s. 16 bars = 30 s |
| Play space | 240 m × 160 m city block loop, 3 zones + plaza |
| Goal | Raise **City Color** to 100% → THE DROP → defeat The Silencer |
| Fail | Tank HP 0 → restart at last zone checkpoint (music jumps to that section) |
| Player | BT-01 Deckhound, 300 HP |

## 2. Map layout

```
                     N
   ┌───────────────────────────────────────────────┐
   │  ZONE C: PLAZA OF LIGHTS (boss arena, 70x70 m) │
   │      [Giant Tree]   [Stage]   [Silencer pit]   │
   └───────▲───────────────────────────────▲───────┘
           │ Grand Avenue (40 m wide)      │ Tram Line
   ┌───────┴───────────┐           ┌───────┴───────┐
   │ ZONE B: MARKET &  │◄─────────►│  Overpass     │
   │ OVERPASS          │  side st. │  (ramp, jump) │
   └───────▲───────────┘           └───────────────┘
           │ Slush Street (18 m wide, shops both sides)
   ┌───────┴───────────┐
   │ ZONE A: SLUSH     │   ← START (tank lands here)
   │ STREET            │
   └───────────────────┘
```

- **Zone A — Slush Street:** narrow shopping street. Teaches driving, aiming, firing on beat. Buildings: corner shop, bakery, record store, cafe, toy store, apartment blocks.
- **Zone B — Market & Overpass:** open market square with stalls + a raised overpass (ramp jump). First mixed enemy waves. Mid-boss **Sleigh-Dozer**.
- **Zone C — Plaza of Lights:** circular plaza with a 25 m unlit **Giant Tree**, an empty stage with speaker towers, department store, cinema, clock tower. Hosts THE DROP and the boss.

Invisible walls at the edges are disguised as grey Hush barricades (they turn into colorful gift-wrapped barriers when remixed).

## 3. City Color meter

- Each zone has its own meter; **City Color** = average of zones.
- Remixing a building adds 2–6% to its zone (by size). Props add 0.5–1%. Freeing a citizen adds 1%. Destroying a Silencer pylon adds 8%.
- Zone gate opens at **60%** of the current zone (a Hush barricade explodes into confetti).
- Plaza requires **100%** of Plaza meter → THE DROP.

## 4. Timeline (bars at 128 BPM)

| Bars | Time | Music section | Gameplay |
| --- | --- | --- | --- |
| — | 0:00–0:25 | Intro cutscene (filtered intro of track) | VOLT's room → glitch → tank lands on Slush Street (see `10`) |
| 1–8 | 0:00–0:15 | Intro (kick only, low-pass) | **Tutorial:** drive (prompt), aim, fire. Beat ring on crosshair. 3 grey buildings to remix, no enemies |
| 9–16 | 0:15–0:30 | Intro + hats | First enemies: 4 **Hush Drones**. Prompt: "Fire ON the beat for double paint!" |
| 17–32 | 0:30–1:00 | Build A | Zone A full: 2 **Static Towers**, drone waves of 6. Free 3 frozen citizens. Gate at 60% |
| 33–40 | 1:00–1:15 | Breakdown (pads, no kick) | Drive to Zone B. Calm: collect **Vinyl** collectibles, overpass jump. Power-up: **Subwoofer** |
| 41–56 | 1:15–1:45 | Build B (rising) | Zone B market fight: **Mute Tanks** ×3, drones ×8. Market stalls remix. |
| 57–64 | 1:45–2:00 | Pre-drop riser | **Sleigh-Dozer** mid-boss charges, pushing snow walls; break its 2 plow blades |
| 65–72 | 2:00–2:15 | Build C (snare roll) | Enter Plaza. 4 **Silencer Pylons** around the tree to destroy; Plaza meter rises fast |
| 73 | 2:15 | **THE DROP** | Plaza meter hits 100% exactly on the drop (meter waits on bar 72 if early; music loops 72 if late) — whole district flips to neon, tree lights up, crowd dances, lasers fire |
| 73–88 | 2:15–2:45 | Drop / chorus | **The Silencer** rises from the pit. Phase 1: break 4 dampener panels |
| 89–96 | 2:45–3:00 | Drop 2 (full energy) | Phase 2: exposed **Mute Crystal**; on-beat shots only damage it |
| — | 3:00–3:20 | Outro cutscene | Silencer explodes into fireworks; VOLT on stage on the tank; crowd; camera crane-up; results |

Music sync rule: the level director (`LevelDirector`) advances sections by bar count, but **gates** (60%, 100%) can hold the music on a loopable 8-bar section until the player meets the condition. Each section has a loop region marked in `content/music-map.json`.

## 5. Encounters

| ID | Where | Bars | Enemies | Notes |
| --- | --- | --- | --- | --- |
| E1 | Zone A | 9–16 | 4 Hush Drones | Fly in from rooftops, slow |
| E2 | Zone A | 17–24 | 6 Drones + 1 Static Tower | Tower emits silence rings (slow + dims beat ring) |
| E3 | Zone A | 25–32 | 6 Drones + 1 Static Tower | Tower on cafe roof |
| E4 | Zone B | 41–48 | 2 Mute Tanks + 4 Drones | Tanks fire grey "mute shells" |
| E5 | Zone B | 49–56 | 1 Mute Tank + 8 Drones | Drones swarm from overpass |
| MB | Zone B | 57–64 | Sleigh-Dozer | Charges, plows walls of snow; weak points: 2 plow blades, then engine |
| E6 | Plaza | 65–72 | 4 Silencer Pylons (static) + 6 Drones | Pylons shield tree; destroying all = meter jump |
| BOSS | Plaza | 73–96 | The Silencer | See `04` boss section |

## 6. Scripted moments (polish list)

1. **Tank landing** — tank drops from a glitch portal, suspension bounce, snow burst, camera shake.
2. **First remix** — slow-mo 0.3 s on the first building that flips; tutorial text: "You just remixed it."
3. **Citizen wakes** — first frozen kid unfreezes, color spreads from feet up, she starts dancing and waves.
4. **Billboard reboot** — giant billboard flickers on and shows "PARTY'S BACK" (our own text).
5. **Overpass jump** — ramp with a light gate; jumping on the beat gives a bonus and a camera slow-mo.
6. **Market lights** — remixing the central stall turns on string lights across the whole market in a chase pattern.
7. **Sleigh-Dozer entrance** — smashes through a grey wall, horn blast (muted, then pitched as you damage it).
8. **THE DROP** — see section 7.
9. **Silencer rise** — pit opens, foam-wrapped horn rises, music filter sweeps down (it "eats" the sound), then you fight it back up.
10. **Victory fireworks** — boss explodes into fireworks synced to the last 8 bars.

## 7. THE DROP (hero moment — build first)

Sequence (all on the beat):
- **Bar 72 beat 4:** all audio cuts to silence for 1 beat; screen desaturates fully; camera pulls back and up (2 s crane).
- **Bar 73 beat 1:** kick hits —
  - every remaining grey asset in all zones flips to neon via the **Remix dissolve**, radiating from the tree outward at 60 m/s;
  - giant tree lights up from bottom to top (string lights chase, star ignites);
  - post-processing LUT switches grey → neon; bloom +50% for 1 bar;
  - all citizens play dance animations (random offsets);
  - tank fires lasers into the sky; light bar strobes;
  - sparkle-snow begins falling;
  - fireworks ×6 over the skyline.
- **Bar 73–74:** text slam "THE DROP" + combo bonus; camera returns to player over 1 bar.
- **Bar 75:** the ground shakes → The Silencer rises.

## 8. Checkpoints

| Checkpoint | Music restart |
| --- | --- |
| Start | bar 1 |
| Zone B entry | bar 33 |
| Plaza entry | bar 65 |
| Boss phase 2 | bar 89 |

## 9. Scoring & rank

Score = remix points + enemy points + combo multiplier + collectibles + time bonus.

| Rank | Requirement |
| --- | --- |
| S | 100% color, ≥ 70% on-beat shots, no deaths, all 8 vinyls |
| A | 100% color, ≥ 50% on-beat |
| B | Level complete |
| C | Level complete with 2+ deaths |
