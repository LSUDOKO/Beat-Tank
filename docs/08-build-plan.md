# 08 — Build Plan (to the deadline)

**Deadline:** Thu 19 Nov 2026, **4:30 p.m. IST**. **Submit target: 12:00 noon IST.**
Starting point: Tue 17 Nov, ~7:30 p.m. IST. That's ~40 hours including sleep. Plan for **~24 working hours**.

**Rule:** always keep a playable build. If a step overruns, cut from the bottom of the priority list (§5), never the core loop.

---

## Tuesday 17 Nov — evening/night (setup + start asset generation)

| Time (IST) | Task | Done when |
| --- | --- | --- |
| 19:30–20:00 | Register, team, submit idea (text in `11`), get Global API key | Credits visible, key in `.env` |
| 20:00–20:45 | Create repo from viber3d; copy `/docs`; install Lux3D Claude skill; read OpenAPI spec → fill `docs/api-notes.md` with exact methods | `pnpm dev` runs |
| 20:45–21:30 | `scripts/gen-assets.ts` with queue + resume + immediate download; test on 2 assets (tank turret + bakery) | 2 assets downloaded, retopo works, material transfer grey works |
| 21:30–22:00 | Fill `content/assets.json` with all rows from `03`; **start the full batch** in priority order | Batch running (leave overnight) |
| 22:00–00:30 | Greybox level: roads, plaza, building boxes, colliders; tank with vehicle physics + chase camera | Can drive the whole map |
| 00:30 | Sleep. Batch keeps running. | |

## Wednesday 18 Nov — main build day

| Time (IST) | Task | Done when |
| --- | --- | --- |
| 08:00–08:30 | Check batch log; reroll failed/ugly assets; run optimize + review sheet | Contact sheet looks consistent |
| 08:30–10:00 | AudioEngine + BeatClock + music-map; beat ring; Beat Cannon with Perfect/Good/Off judgement | Firing feels on-beat |
| 10:00–12:00 | Remix system: dual dissolve shader, paint, meters, emissive from neon; place real buildings via layout tool | Shooting a building turns it neon with glowing edge |
| 12:00–13:00 | Lunch + playtest Zone A | |
| 13:00–14:30 | Enemies: Drone, Static Tower, Mute Tank; LevelDirector encounters by bar; HP, damage, death | Zones A–B playable |
| 14:30–16:00 | **THE DROP** sequence (build this before boss — it's the hero moment) + LUT blend + skyline crossfade + tree lighting | Drop looks amazing |
| 16:00–18:00 | The Silencer boss (part split panels, 2 phases); Sleigh-Dozer if time (else replace with a Mute Tank wave) | Level beatable start → finish |
| 18:00–19:00 | Citizens: frozen → dancing (rigged GLBs) | People dance after remix |
| 19:00–20:00 | HUD, minimap, results screen with before/after, Tank Card, Share to X | Full loop with UI |
| 20:00 | **Feature freeze.** Deploy to Vercel/Netlify, test on another PC | Public link works |
| 20:00–22:00 | Intro + outro cinematics (camera rails), VFX polish, audio mix | Feels like a real game |
| 22:00–23:30 | Bug bash: 3 full playthroughs; perf check; `?demo=1` mode | No blockers |
| 23:30 | Record raw gameplay footage (OBS 1080p60) — several takes of THE DROP and boss | Footage saved |

## Thursday 19 Nov — submission morning

| Time (IST) | Task |
| --- | --- |
| 07:30–09:00 | Edit 90 s demo video (script in `11`); optional LuxReal intro/trailer shot |
| 09:00–10:30 | Project report PDF/PPT (outline in `11`), screenshots, asset pipeline page |
| 10:30–11:00 | GitHub public + README; ModelScope publish; X post with #Manycorehackathon |
| 11:00–12:00 | Submit on the hackathon site; verify every link in incognito |
| 12:00–16:30 | Buffer only. Do not start new features |

---

## Definition of done (level)

- [ ] Intro cutscene → gameplay → THE DROP → boss → outro → results, without errors
- [ ] 60 FPS on a mid laptop on High (or Medium)
- [ ] All assets from Lux3D (document any exception)
- [ ] Grey/neon visible difference everywhere
- [ ] Settings: graphics preset, volume, audio offset
- [ ] `?demo=1` works with no network calls to Aholo
- [ ] No IP from the reference (names, logos, likeness, music)

## Priority list (cut from the bottom)

1. Drive + aim + beat cannon + remix shader (**must**)
2. City Color meter + zone gates (**must**)
3. THE DROP (**must**)
4. Silencer boss (**must**, can be phase 1 only)
5. Drones + Mute Tanks + Static Towers (**must**, at least drones)
6. HUD + results + share (**must**)
7. Intro/outro cinematics
8. Citizens dancing
9. Sleigh-Dozer mid-boss
10. Power-ups
11. 3DGS skyline via Aholo Viewer (panorama fallback first)
12. Garage prompt/photo/skin + export (runtime Aholo)
13. Mobile controls
