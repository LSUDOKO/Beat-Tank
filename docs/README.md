# BEATTANK: Remix the City — Level 1 "Silent Night District"

**Drop the bass. Bring back the color.**

A third-person 3D arcade tank game for the **Manycore Aholo Global 3D AI Hackathon**. You drive a DJ sound-system tank through a grey, silent holiday city. Every shot fired on the beat "remixes" what it hits: grey concrete turns into glowing neon holiday color. Fill the city's color meter, trigger **THE DROP**, and defeat **The Silencer**.

This pack describes **one complete, polished level** — inspired by the *structure and feeling* of the WoT Blitz x deadmau5 "Familiars" music video (dull city → colorful holiday party, driven by a music tank) — but with **100% original story, characters, tank, assets and music**.

> Deadline: **Thu 19 Nov 2026, 6:00 a.m. EST = 4:30 p.m. IST.** Target submit: **12:00 noon IST**.

---

## Read in this order

| # | File | Purpose |
| --- | --- | --- |
| 00 | `00-reference-analysis.md` | What the reference video/event is, what we borrow (structure, beats, vibe), what we must NOT copy, how to do frame-by-frame analysis |
| 01 | `01-game-overview.md` | Concept, story, characters, pillars, why it wins |
| 02 | `02-level-design-silent-night.md` | The level, bar by bar: map, zones, encounters, scripted events, THE DROP, boss, outro |
| 03 | `03-asset-bible.md` | Every asset: ID, Lux3D prompt, grey + neon variants, size, poly budget, rig needs |
| 04 | `04-gameplay-systems.md` | Tank controls, beat clock, shooting, Remix system, combo, power-ups, enemies, boss, citizens, scoring |
| 05 | `05-aholo-pipeline.md` | How to generate every asset with Lux3D / World API / LuxReal; scripts, limits, error handling |
| 06 | `06-art-direction-vfx-audio.md` | "Real game" look: lighting, LUTs, reflections, VFX, camera, music, SFX, UI |
| 07 | `07-technical-architecture.md` | Stack, folders, systems, Remix dissolve shader, beat clock code, performance |
| 08 | `08-build-plan.md` | Hour-by-hour plan to the deadline with checklists |
| 09 | `09-claude-code-prompts.md` | Paste-ready prompts for Claude Code, in order |
| 10 | `10-cinematics-and-trailer.md` | Intro/outro cutscenes, LuxReal trailer, live-action "transported into the tank" shot |
| 11 | `11-hackathon-submission.md` | Judging criteria, awards, report outline, video script, X post, checklist |
| 12 | `12-references-and-legal.md` | Links, licences, IP do/don't list |

---

## Tell your Claude Code this first

```
Read every file in /docs (README.md, then 00 to 12) before writing any code.
We are building ONE level of BEATTANK: "Silent Night District". Follow docs/08-build-plan.md.
All assets are original. Never use deadmau5, the mouse-head logo, World of Tanks, Wargaming,
or the song "Familiars". All Aholo calls go through the server; never expose AHOLO_API_KEY.
Before calling Aholo, read the official OpenAPI spec / llms.txt linked from
https://labs.aholo.ai/api-docs/en/api-reference and the @manycore/aholo-sdk-lux3d types.
```

---

## Accuracy note

- I could not play the reference video or open the Behance page directly (both blocked automated access). `00-reference-analysis.md` is based on official press releases and award write-ups, and marks clearly what is **confirmed** vs **our design**. Section 5 of that file explains how to extract frames from your own copy so Claude can analyze them.
- Aholo API details come from the official hackathon page, API reference overview, the official npm SDK README and third-party skill docs. **Verify method names and versions against the official spec before coding.**
