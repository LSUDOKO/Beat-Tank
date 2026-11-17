import { useEffect, useState } from 'react';
import { useUI, type Quality } from '../game/store';
import { audio } from '../audio/AudioEngine';
import { game } from '../App';
import { Banner } from './HUD';

const click = () => audio().sfxUi();

export function Menus() {
  const screen = useUI((s) => s.screen);
  const [panel, setPanel] = useState<'none' | 'settings' | 'how' | 'credits'>('none');

  useEffect(() => {
    if (screen !== 'title') return;
    const start = () => { if (!audio().running) audio().start('title'); };
    window.addEventListener('pointerdown', start, { once: true });
    return () => window.removeEventListener('pointerdown', start);
  }, [screen]);

  if (panel !== 'none') return (
    <div className="screen dim">
      {panel === 'settings' && <Settings />}
      {panel === 'how' && <HowTo />}
      {panel === 'credits' && <Credits />}
      <button className="btn ghost" onClick={() => { click(); setPanel('none'); }}>BACK</button>
    </div>
  );

  switch (screen) {
    case 'title': return (
      <div className="screen title">
        <div className="logo">BEAT<span>TANK</span></div>
        <div className="tagline">REMIX THE CITY · <b>DROP THE BASS. BRING BACK THE COLOR.</b></div>
        <div className="menu">
          <button className="btn primary" onClick={() => { click(); audio().stop(); game?.startGame(); }}>PLAY — SILENT NIGHT DISTRICT</button>
          <button className="btn" onClick={() => { click(); setPanel('how'); }}>HOW TO PLAY</button>
          <button className="btn" onClick={() => { click(); setPanel('settings'); }}>SETTINGS</button>
          <button className="btn" onClick={() => { click(); setPanel('credits'); }}>CREDITS · MADE WITH AHOLO</button>
        </div>
        <div className="best">BEST SCORE {useUI.getState().best.toLocaleString()}</div>
        <div className="foot">Headphones recommended · every 3D asset generated with Aholo Lux3D</div>
      </div>
    );
    case 'intro': return (
      <div className="screen cine">
        <div className="letterbox top" /><div className="letterbox bottom" />
        <Banner />
        <div className="skip">CLICK / SPACE TO SKIP</div>
      </div>
    );
    case 'outro': return (
      <div className="screen cine"><div className="letterbox top" /><div className="letterbox bottom" /><Banner /></div>
    );
    case 'paused': return (
      <div className="screen dim">
        <h2>PAUSED</h2>
        <div className="menu">
          <button className="btn primary" onClick={() => { click(); game?.pause(false); }}>RESUME</button>
          <button className="btn" onClick={() => { click(); setPanel('settings'); }}>SETTINGS</button>
          <button className="btn" onClick={() => { click(); setPanel('how'); }}>CONTROLS</button>
          <button className="btn" onClick={() => { click(); game?.quitToTitle(); }}>QUIT TO TITLE</button>
        </div>
      </div>
    );
    case 'dead': return (
      <div className="screen dim red">
        <h2 className="glitch">MIX INTERRUPTED</h2>
        <p>The Hush muted your Deckhound. Back to the last checkpoint.</p>
        <button className="btn primary" onClick={() => { click(); game?.respawn(); }}>DROP BACK IN</button>
      </div>
    );
    case 'results': return <Results />;
    default: return null;
  }
}

function rankOf(s: ReturnType<typeof useUI.getState>['stats']) {
  const shots = s.perfect + s.good + s.off;
  const onBeat = shots ? (s.perfect + s.good) / shots : 0;
  if (s.deaths >= 2) return { r: 'C', onBeat };
  if (onBeat >= 0.7 && s.deaths === 0 && s.vinyls >= 8) return { r: 'S', onBeat };
  if (onBeat >= 0.5) return { r: 'A', onBeat };
  return { r: 'B', onBeat };
}

function Results() {
  const s = useUI((st) => st.stats);
  const best = useUI((st) => st.best);
  const { r, onBeat } = rankOf(s);
  const [split, setSplit] = useState(50);
  const shareText = encodeURIComponent(`I remixed the Silent Night District in BEATTANK — rank ${r}, ${s.score.toLocaleString()} pts, ${Math.round(onBeat * 100)}% on-beat 🎛️💥\nEvery 3D asset made with Aholo Lux3D.\n#Manycorehackathon`);
  const mm = Math.floor(s.time / 60), ss = Math.floor(s.time % 60).toString().padStart(2, '0');
  return (
    <div className="screen dim results">
      <div className="res-left">
        <div className={`rank r${r}`}>{r}</div>
        <div className="res-score">{s.score.toLocaleString()}</div>
        <div className="res-best">{s.score >= best ? 'NEW BEST!' : `BEST ${best.toLocaleString()}`}</div>
        <table className="res-table"><tbody>
          <tr><td>Time</td><td>{mm}:{ss}</td></tr>
          <tr><td>On-beat shots</td><td>{Math.round(onBeat * 100)}% <small>({s.perfect} perfect · {s.good} good · {s.off} off)</small></td></tr>
          <tr><td>Objects remixed</td><td>{s.remixed}</td></tr>
          <tr><td>Citizens freed</td><td>{s.citizens}</td></tr>
          <tr><td>Hush defeated</td><td>{s.enemies}</td></tr>
          <tr><td>Max combo</td><td>{s.maxCombo}</td></tr>
          <tr><td>Vinyls</td><td>{s.vinyls}/8</td></tr>
          <tr><td>Deaths</td><td>{s.deaths}</td></tr>
        </tbody></table>
        <div className="menu row">
          <button className="btn primary" onClick={() => { click(); game?.quitToTitle(); setTimeout(() => game?.startGame(), 50); }}>PLAY AGAIN</button>
          <a className="btn x" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${shareText}`}>SHARE ON X</a>
          <button className="btn" onClick={() => { click(); game?.quitToTitle(); }}>TITLE</button>
        </div>
      </div>
      {game?.beforeShot && game?.afterShot && (
        <div className="beforeafter">
          <div className="ba-label">BEFORE / AFTER — drag</div>
          <div className="ba-frame">
            <img src={game.afterShot} alt="after" />
            <div className="ba-before" style={{ width: `${split}%` }}><img src={game.beforeShot} alt="before" /></div>
            <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(+e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Settings() {
  const st = useUI((s) => s.settings);
  const set = useUI((s) => s.setSettings);
  const slider = (label: string, key: 'master' | 'music' | 'sfx' | 'sensitivity', min = 0, max = 1, step = 0.05) => (
    <label className="set-row"><span>{label}</span><input type="range" min={min} max={max} step={step} value={st[key]} onChange={(e) => set({ [key]: +e.target.value })} /><b>{st[key].toFixed(2)}</b></label>
  );
  const [taps, setTaps] = useState<number[]>([]);
  const tap = () => {
    const a = audio();
    if (!a.running) { a.start('title'); return; }
    const b = a.beat(); const err = (b - Math.round(b)) * a.spb * 1000;
    const next = [...taps, err].slice(-8); setTaps(next);
    if (next.length >= 4) set({ offsetMs: Math.round(st.offsetMs + next.reduce((x, y) => x + y, 0) / next.length) });
  };
  return (
    <div className="panel">
      <h2>SETTINGS</h2>
      {slider('Master volume', 'master')}{slider('Music', 'music')}{slider('Effects', 'sfx')}
      {slider('Mouse sensitivity', 'sensitivity', 0.3, 2.5, 0.1)}
      <label className="set-row"><span>Graphics</span>
        <select value={st.quality} onChange={(e) => set({ quality: e.target.value as Quality })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      <label className="set-row"><span>Audio offset (ms)</span><input type="range" min={-150} max={150} step={5} value={st.offsetMs} onChange={(e) => set({ offsetMs: +e.target.value })} /><b>{st.offsetMs}</b></label>
      <div className="set-row"><span>Calibrate</span><button className="btn small" onClick={tap}>TAP ON THE KICK ({taps.length})</button></div>
      <label className="set-row"><span>Invert Y</span><input type="checkbox" checked={st.invertY} onChange={(e) => set({ invertY: e.target.checked })} /></label>
      <label className="set-row"><span>Camera shake</span><input type="checkbox" checked={st.shake} onChange={(e) => set({ shake: e.target.checked })} /></label>
      <label className="set-row"><span>Beat camera pulse</span><input type="checkbox" checked={st.beatPulse} onChange={(e) => set({ beatPulse: e.target.checked })} /></label>
    </div>
  );
}

function HowTo() {
  return (
    <div className="panel">
      <h2>HOW TO PLAY</h2>
      <p>The Hush silenced Neon City. Your <b>BT-01 Deckhound</b> fires music — every shell <b>remixes</b> grey concrete back into neon holiday color.</p>
      <table className="keys"><tbody>
        <tr><td>W A S D</td><td>Drive / turn the hull</td></tr>
        <tr><td>Mouse</td><td>Aim the turret (click the screen to lock the mouse)</td></tr>
        <tr><td>Left click</td><td>Fire the Beat Cannon — <b>on the beat</b> = PERFECT / GOOD = bigger paint, more damage, combo</td></tr>
        <tr><td>Shift</td><td>Boost (2 s, 6 s cooldown)</td></tr>
        <tr><td>Space</td><td>BASS DROP shockwave when charged</td></tr>
        <tr><td>Esc / P</td><td>Pause</td></tr>
      </tbody></table>
      <p>The ring around the crosshair closes on every kick drum — fire when it lands. Remix 60% of each zone to break the Hush barricade, destroy the 4 pylons in the Plaza, fill it to 100% and <b>THE DROP</b> hits. Then defeat <b>The Silencer</b>.</p>
    </div>
  );
}

function Credits() {
  return (
    <div className="panel credits">
      <h2>MADE WITH AHOLO</h2>
      <p>Every model in BEATTANK was generated with <b>Aholo Lux3D</b> from our own prompts:</p>
      <ul>
        <li><b>Text-to-3D (G1-Turbo)</b> — tank hull + turret, The Silencer, buildings, props, enemies, citizens, pickups</li>
        <li><b>Material Transfer</b> — the grey "silenced" twin of every building and prop; the Remix shader dissolves between the two</li>
        <li><b>Part Splitting</b> — tank turret and The Silencer broken into parts</li>
        <li><b>Humanoid Auto-Rig + Animation Retarget</b> — frozen citizens that dance when remixed</li>
        <li><b>Asset upload API</b> — material reference images</li>
      </ul>
      <p>Music &amp; sound: synthesized live in the browser (Web Audio) — 100% original. Engine: three.js + postprocessing. Fonts: Orbitron, Rajdhani (OFL).</p>
      <p className="muted">An original game. Not affiliated with any artist, label or game publisher.</p>
    </div>
  );
}
