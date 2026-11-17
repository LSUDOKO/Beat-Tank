# 04 — Gameplay Systems

## 1. Tank controls

| Action | Keyboard / mouse | Gamepad | Mobile (bonus) |
| --- | --- | --- | --- |
| Throttle / reverse | W / S | Right trigger / left trigger | Left stick up/down |
| Turn hull | A / D | Left stick X | Left stick X |
| Aim turret | Mouse | Right stick | Right stick (drag) |
| Fire Beat Cannon | Left click | RB | Fire button |
| Special (charged power-up) | Right click / E | LB | Special button |
| Boost (2 s, 6 s cooldown) | Shift | A | Boost button |
| Bass Drop shockwave (when meter full) | Space | Y | Big button |
| Pause | Esc | Start | Pause |

### Handling (arcade, not simulation)
| Param | Value |
| --- | --- |
| Max forward speed | 16 m/s (boost 24) |
| Reverse speed | 7 m/s |
| Acceleration | 0→16 in 1.6 s |
| Hull turn rate | 70°/s (40°/s at max speed) |
| Turret turn rate | 160°/s |
| Barrel pitch | −8° to +18° |
| HP | 300 |
| Collision | Rapier dynamic rigid body (box collider) with high mass, low center of mass, raycast suspension for 4 corners (bounce on landing) |

Physics: use a **raycast-vehicle style** setup (Rapier `DynamicRayCastVehicleController` or custom 4-ray suspension) so the tank bobs, tilts on ramps and lands with a bounce. Props are kinematic until hit, then dynamic (push cars, knock bins).

## 2. Beat clock

- Source of truth: `AudioContext.currentTime` (never `requestAnimationFrame` time).
- `beat = (audioTime - songStart) * BPM / 60`; `bar = floor(beat / 4) + 1`; `phase = beat % 1`.
- **Hit windows** (distance to nearest beat): Perfect ≤ 45 ms, Good ≤ 90 ms, else Off-beat.
- Calibration: settings offer audio offset (−150 to +150 ms) + a 4-tap calibration screen.
- Visual metronome: a ring around the crosshair shrinks onto the crosshair on each beat; speaker cones pump on each kick; light bar chases at 1/8 notes.

## 3. Beat Cannon (main weapon)

| Timing | Damage | Paint radius | Paint power | Feedback |
| --- | --- | --- | --- | --- |
| Perfect | 40 | 6 m | 2.0 | gold ring, "PERFECT", combo +2 |
| Good | 30 | 4.5 m | 1.5 | cyan ring, "GOOD", combo +1 |
| Off-beat | 20 | 3 m | 1.0 | small puff, combo reset |

- Fire rate cap: one shot per beat (+ one on the off-beat "and" if Good/Perfect streak ≥ 8: double-time unlock).
- Projectile: fast glowing "sound slug" (80 m/s) with a short trail, slight arc; explodes on contact into a paint splash.
- Every hit applies **paint** to remixable objects in radius (see Remix system).

## 4. Remix system (core mechanic)

Each remixable object has:
```ts
interface Remixable {
  id: string;
  zone: 'A' | 'B' | 'C';
  paintHp: number;        // e.g. building 6, prop 2
  paint: number;          // 0..paintHp
  colorValue: number;     // % added to zone meter when complete
  state: 'grey' | 'remixing' | 'neon';
  origin: Vector3;        // last hit point (dissolve starts here)
}
```
- A hit adds `paintPower` to every remixable in the splash radius (falloff by distance).
- When `paint >= paintHp` → state `remixing`: dissolve shader grows from `origin` to cover the object in 0.6 s (on the next beat for style), then `neon`.
- On `neon`: object's emissive lights turn on, a sparkle burst, small confetti, sound sting (pitched by combo), meter increases.
- Partial paint shows as color splats on the grey surface (decal-like via the same shader with a noise mask).
- Citizens: paint them (2 hits) → unfreeze → dance until level end, follow the beat.

## 5. Combo / Groove meter

- Combo increases with Good/Perfect shots and remixes; resets on off-beat or taking a big hit.
- Groove tiers: x1 → x2 (10) → x3 (25) → x4 (50). Higher tiers add music layers (extra synth stem) and stronger visuals.
- Groove also fills the **Bass Drop** meter (Space): a 20 m shockwave that remixes everything in range and knocks back enemies. Max 1 charge.

## 6. Power-ups (specials)

| Power-up | Effect | Duration |
| --- | --- | --- |
| Subwoofer | Ground shockwave every beat around tank (8 m), damages drones, paints | 8 bars |
| Laser Show | Two sweeping lasers from the turret, auto-paint buildings they touch | 4 bars |
| Confetti Cannon | Next 4 shots paint 2× radius | 4 shots |
| Repair | +100 HP | instant |

## 7. Enemies

| Enemy | HP | Behaviour | Attack | Remix on death |
| --- | --- | --- | --- | --- |
| Hush Drone | 40 | Flies in arcs, keeps 15–25 m distance, swarms in groups | Grey "mute pulse" orb, 10 dmg, slows tank 20% for 1 s | Bursts into colored confetti + paints 3 m |
| Static Tower | 200 | Static | Every 2 bars: expanding silence ring (18 m) — 15 dmg + dims beat ring for 1 bar (harder timing) | Dishes fall off (part split), area paint 8 m |
| Mute Tank | 260 | Patrols, keeps line of sight, flanks | Mute shell every 3 beats, 25 dmg | Turret pops off, area paint 6 m |
| Silencer Pylon | 300 | Static, shields giant tree | Beam that drains Plaza meter while alive | Crystal shatters, +8% Plaza |

Spawns are driven by `LevelDirector` from `content/encounters.json` (bar-based).

## 8. Mid-boss: Sleigh-Dozer

- HP: body 600, blade_L 250, blade_R 250, engine 400 (exposed after blades break).
- Pattern A: **Charge** across the market (telegraph: headlights flash 2 beats). Dodge with boost.
- Pattern B: **Snow Wall** — plows a wall of snow that blocks a lane (remix it to melt it into gift boxes).
- Pattern C (after blades break): **Spin-out** sliding attack.
- Death: engine explodes into a fountain of gifts; huge Zone B paint burst.

## 9. Boss: The Silencer

| Phase | Bars | Weak points | Attacks |
| --- | --- | --- | --- |
| 1 | 73–88 | 4 dampener panels (300 HP each) | **Mute Wave** (horn blast cone, telegraphed 1 bar); **Foam Rain** (lobbed foam blobs that create slow zones); **Drone Spawn** every 8 bars |
| 2 | 89–96 | Mute Crystal (800 HP) — only **Good/Perfect** shots damage it | **Silence Field**: music low-pass + screen desaturates; stay in remixed (neon) zones to keep beat ring visible; faster Mute Waves |

- Each panel destroyed → panel flies off (part split physics) + a section of the plaza ring lights up.
- Music reacts: phase 1 the boss "fights" the track (filter sweeps when it attacks); phase 2 full drop.
- Death: crystal shatters on the downbeat of bar 97 → fireworks finale → outro.

## 10. Damage, health, fail

- Tank HP 300; on hit: screen-edge red flash + controller rumble + camera shake (small).
- Repair pickups placed: 2 in Zone A, 2 in B, 3 in Plaza.
- Death → 1.5 s slow-mo, "MIX INTERRUPTED", restart at checkpoint.

## 11. Scoring

| Event | Points |
| --- | --- |
| Building remixed | 500 |
| Prop remixed | 100 |
| Citizen freed | 250 |
| Drone / Tower / Mute Tank | 150 / 600 / 800 |
| Pylon | 1000 |
| Sleigh-Dozer | 5000 |
| Silencer | 15000 |
| Vinyl | 1000 |

All multiplied by Groove tier. Rank rules in `02` §9.
