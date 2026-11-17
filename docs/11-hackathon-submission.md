# 11 — Hackathon Submission

## Key rules (official page)

- Deadline: **19 Nov 2026, 6:00 a.m. EST = 4:30 p.m. IST**. Judging 20–30 Nov; results early December 2026.
- Teams 1–3 (solo allowed). **Required tool: Aholo Lux3D.**
- Score = 70% expert panel + 30% community panel (50 AI practitioners).
- Credits: first allocation on registration; more after team formed + idea submitted. Team credits split once among members listed at idea submission.

## Judging → our evidence

| Criterion | Weight | Evidence to show |
| --- | --- | --- |
| Use of Manycore's tools | 30% | Every asset from Lux3D; material transfer = core mechanic (grey ↔ neon); part split bosses; rig + retarget citizens/VOLT; SpatialGen skyline; LuxReal trailer; optional garage runtime generation + export |
| Fun & engagement | 25% | Tank + rhythm + THE DROP; demo video shows it in the first 10 s |
| Innovation | 20% | "Remix the world's materials" as gameplay; music-driven level director |
| Completeness | 20% | Full level start → boss → results; settings; demo mode; stable link |
| Reach | 5% | X post + shareable before/after GIF |

## Awards to target

Main prizes (¥50k / ¥30k / ¥10k), **Gaming Application**, **Film & TV Application** (LuxReal trailer + cinematic level), **Technical Excellence**, **Wild Idea**, **Popularity**, **3D Printing** (if garage export STL is built). Special Award (¥100k): open-source the Remix shader + asset pipeline as a reusable kit.

## Idea submission text

> **BEATTANK: Remix the City** — a third-person arcade tank game where music is the weapon. You drive a DJ sound-system tank through a grey, silent holiday city; every shot fired on the beat "remixes" what it hits, turning grey concrete into glowing neon holiday color. Every asset is generated with Aholo Lux3D, and the core mechanic is built on Lux3D material transfer (grey and neon versions of the same models). Bosses break apart via part splitting, citizens are auto-rigged and retargeted to dance, and the skyline is an Aholo SpatialGen world. Playable in the browser.

## Required deliverables

1. **Project report (PDF or PPT)** — idea → result, process screenshots, asset iteration comparisons, final images.
2. **Working demo** — playable link (best) and/or video with real footage.

Bonus: X post with #Manycorehackathon (public until results), source code link, ModelScope link (+20 h GPU).

## Report outline (14 pages)

1. Title, tagline, play link + QR, team
2. The idea in one image: grey street vs neon street (same camera)
3. How it plays: drive → shoot on beat → remix → color meter → THE DROP → boss
4. Inspiration & originality: "dull city to party" structure; all characters, tank, assets and music original
5. **Aholo pipeline for one building:** prompt → Lux3D model → retopology → material transfer (grey) → in-game dissolve
6. **Aholo pipeline for the tank:** prompt → hull + turret → part split barrel → camos via material transfer
7. Boss: part-split exploded view → in-game breakable panels
8. Citizens: T-pose model → auto-rig → retargeted dance
9. World: SpatialGen skyline grey/neon
10. Asset iterations: prompt v1/v2/v3 comparisons (show what you changed and why)
11. Tech: Remix dissolve shader, beat clock, LevelDirector, architecture diagram
12. Table of every Aholo capability used + where
13. Results: FPS, asset count (~60 models, ~120 Aholo follow-up tasks), playtest quotes
14. Next steps + links

## 90-second demo video

| Time | Shot | Caption |
| --- | --- | --- |
| 0:00–0:06 | (Optional live-action) you at desk → glitch | "The city went silent." |
| 0:06–0:15 | Tank lands in grey street; first on-beat shot remixes a bakery | "Every beat brings the color back." |
| 0:15–0:35 | Gameplay montage: drones, Mute Tank, citizens waking and dancing | "Built entirely with Aholo Lux3D." |
| 0:35–0:50 | **THE DROP** full sequence | — (let the music speak) |
| 0:50–1:10 | Silencer boss: panels fly off, crystal shatters, fireworks | "Bosses break apart with Lux3D part splitting." |
| 1:10–1:22 | Split-screen pipeline: prompt → model → grey/neon → in game | "Material transfer powers the remix." |
| 1:22–1:30 | Logo, play link, #Manycorehackathon | "BEATTANK — Remix the City." |

## X post template

```
The city went silent. So I built a tank that shoots music. 🎛️💥

BEATTANK: Remix the City — every beat turns grey streets into neon.
Every 3D asset made with @<Aholo handle> Lux3D. Material transfer = the remix.

▶️ Play: <link>   💻 Code: <github>
#Manycorehackathon
```

## Final checklist

- [ ] Teammates added before idea submission
- [ ] Idea submitted (credits unlocked)
- [ ] Report uploaded
- [ ] Playable link tested in incognito (desktop) + `?demo=1` backup link
- [ ] Video uploaded (real footage)
- [ ] X post live
- [ ] GitHub public with README + credits
- [ ] ModelScope link submitted
- [ ] Submitted by 12:00 noon IST, 19 Nov
