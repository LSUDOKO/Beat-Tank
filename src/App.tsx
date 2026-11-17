import { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import { loadManifest, preload, resolveAll } from './game/assets';
import { placed, citizens } from './game/level';
import { useUI } from './game/store';
import { audio } from './audio/AudioEngine';
import { HUD } from './ui/HUD';
import { Menus } from './ui/Menus';

export let game: Game | null = null;

const EXTRA = ['VH_DECKHOUND', 'P_TANK_HULL', 'P_TANK_TURRET', 'B_SILENCER', 'E_DRONE', 'E_MUTE_TANK', 'E_PYLON', 'PR_BARRICADE', 'PU_VINYL', 'PU_REPAIR', 'PU_SUBWOOFER'];

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const screen = useUI((s) => s.screen);
  const progress = useUI((s) => s.loadProgress);
  const settings = useUI((s) => s.settings);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadManifest();
      const ids = [...new Set([...placed.map((p) => p.asset), ...citizens.map((c) => c.model), ...EXTRA])];
      await preload(ids, (f) => useUI.getState().set({ loadProgress: f }));
      await resolveAll();
      if (cancelled || !canvas.current) return;
      game = new Game(canvas.current);
      (window as unknown as { game: Game }).game = game;
    })().catch((e) => { console.error(e); setErr(String(e)); });
    return () => { cancelled = true; game?.dispose(); game = null; };
  }, []);

  useEffect(() => {
    const a = audio();
    a.setVolumes(settings.master, settings.music, settings.sfx);
    a.offsetMs = settings.offsetMs;
    game?.applyQuality();
  }, [settings]);

  const nohud = new URLSearchParams(location.search).has('nohud');
  return (
    <>
      <canvas ref={canvas} className="game-canvas" />
      {screen === 'loading' && (
        <div className="screen loading">
          <div className="logo small">BEAT<span>TANK</span></div>
          <div className="loadbar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <p>{err || 'Loading Lux3D assets…'}</p>
        </div>
      )}
      {(screen === 'playing' || screen === 'dead' || screen === 'paused') && !nohud && <HUD />}
      <Menus />
    </>
  );
}
