# 00 — Reference Analysis

## 1. What the reference is

| Item | Facts (confirmed from official/press sources) |
| --- | --- |
| Title | *WoT Blitz x deadmau5: Familiars* |
| Type | Music video / promotional cinematic for a game event — **not gameplay footage** |
| Client | Wargaming (World of Tanks Blitz, MS-1 studio) |
| Agency / production | Playsense (agency), with AVE and CLAN on art direction, CG and VFX; live-action by lookadmeusa; director Anton Shavkero |
| Format | Live-action + CG character animation + CG environments |
| Music | deadmau5 — "Familiars" (released Nov 29, 2024) |
| Event | "deadmau5 in the House", Dec 2–26, 2024 — a holiday dance-party event |
| Story | deadmau5 escapes from his on-set reality, becomes his masked persona, and takes command of a DJ-controller tank. Wherever the tank fires, the dull city turns into a colorful holiday metropolis |
| In-game items | A themed tank with music-making gear, speakers, lights and lasers; camos (one inspired by a famous car wrap); masks; quests; battle pass |
| Creative strategy | Younger players see Christmas/New Year less as a family holiday and more as a party → "a fresh, party-style Christmas" |
| Recognition | NYX Game Awards entry/winner, category "Game Video – Music Video" |
| Credits also list | Character roles: a "godfather", a "consigliere" and the "godfather's brother" (CG characters with actors). Exact appearance not verified |

## 2. The structure we borrow (story beats, not assets)

These beats are generic storytelling tools and are the **skeleton of our level**:

1. **Real world → game world.** The hero leaves a mundane "real" setting and is pulled into the game.
2. **Hero transforms** into a masked DJ persona and climbs into a sound-system tank.
3. **Dull city.** Grey, cold, empty streets; holiday decorations dead and unlit.
4. **Music as a weapon.** Every shot spreads color and light instead of destruction.
5. **Escalation.** More of the city transforms; people come back to life and dance.
6. **The climax.** The biggest beat of the track = the whole city explodes into holiday color.
7. **Party ending.** Lights, lasers, crowd, celebration.

## 3. What we change (our version)

| Reference element | BEATTANK original replacement |
| --- | --- |
| deadmau5 (real artist, likeness) | **VOLT** — an original DJ character with a glowing **cube-visor helmet** (no ears, no mouse, no existing mascot) |
| mau5head masks | VOLT's cube-visor; collectible visor skins with our own patterns |
| DJ-controller tank ("mau5tank") | **BT-01 "Deckhound"** — original sound-system tank: low wide hull, turret built around a twin-turntable deck, side speaker stacks, roof light bar, rear laser emitters |
| World of Tanks Blitz game/tanks | Our own arcade tank game, our own vehicle designs |
| "Familiars" track | Original/royalty-free 128 BPM electro-house track with a clear build + drop |
| Holiday camo inspired by a famous car | Our own camo set: "Candy Circuit", "Aurora Static", "Tinsel Grid" |
| Mafia-style characters ("godfather" etc.) | **The Hush** — a faceless grey corporation; boss **The Silencer** (a giant machine). No mob characters |
| Dull city → holiday metropolis | Same idea, executed with **Lux3D material transfer** (grey → neon holiday variants) |
| Live-action opening | Optional: film **yourself** at a desk/studio, then transition via LuxReal (see `10`) |

**Rule:** structure and feeling are fine to be inspired by; **names, likeness, logos, designs, music and footage are not.** No frame, texture, model or audio from the reference goes into the game, trailer or report.

## 4. Visual language observed in the event (from published descriptions) → our art rules

| Observed/described | Our rule |
| --- | --- |
| Dull urban landscape | Grey state: desaturated, cool blue-grey LUT, overcast dusk, slush, unlit decorations, dead billboards |
| Pulsating, colorful holiday metropolis | Neon state: saturated warm LUT, emissive signs, string lights, giant ornaments, laser beams, falling sparkle-snow |
| Tank loaded with speakers, lights, lasers | Tank is a light show: speaker cones pump on kick drum, light bar chases, lasers fire on the drop |
| Party / dance energy | Citizens dance; camera pulses on beat; world reacts to music |
| Live action + CG mix | Intro cutscene uses stylized "real world" set then glitch transition into the game |

## 5. Frame-by-frame analysis (do this with your own copy)

I could not watch the video. To analyze it properly, give Claude Code frames from a copy you are allowed to view (e.g., the official upload on the publisher's channel). Use the frames **only as reference notes**, never as game assets.

```bash
# 1 frame every 2 seconds
ffmpeg -i reference.mp4 -vf fps=0.5,scale=960:-1 frames/f_%03d.jpg
# scene-change frames only
ffmpeg -i reference.mp4 -vf "select='gt(scene,0.35)',scale=960:-1" -vsync vfr frames/scene_%03d.jpg
# contact sheet (one image, 6x6 grid)
ffmpeg -i reference.mp4 -vf "fps=0.25,scale=320:-1,tile=6x6" sheet.jpg
```

Then prompt Claude:
```
Look at frames/*.jpg. For each scene write: timestamp, shot type (wide/close/aerial),
camera move, location, lighting (grey or color state), key objects, VFX, and what beat of
the music it is on. Output docs/00b-shot-list.md. Then update docs/03-asset-bible.md with
any ORIGINAL equivalents we need (never copy designs or logos).
```

Also useful: write down the **music structure** of our own track (intro / build / breakdown / drop / outro, in bars) and map level events to it (see `02`).

## 6. Shot list template (fill after frame analysis)

| # | Time | Shot | Camera | Location | State | Key objects | VFX | Music section | Our level equivalent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 0:00 | | | | grey | | | intro | Intro cutscene shot 1 |
| … | | | | | | | | | |
