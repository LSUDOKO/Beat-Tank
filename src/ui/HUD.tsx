import { useEffect, useRef, useState } from 'react';
import { useUI } from '../game/store';
import { audio } from '../audio/AudioEngine';
import { game } from '../App';
import { PLAZA } from '../game/level';

const ZONES = [['A', 'SLUSH ST'], ['B', 'MARKET'], ['C', 'PLAZA']] as const;

export function HUD() {
  const s = useUI();
  const ring = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState('');

  // beat ring: shrinks onto the crosshair on every beat (driven by the audio clock)
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = audio().phase();
      if (ring.current) {
        const k = 1 - p; // 1 → 0 across the beat
        ring.current.style.transform = `translate(-50%,-50%) scale(${1 + k * 1.6})`;
        ring.current.style.opacity = String(0.25 + (1 - k) * 0.75);
      }
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!s.lastJudge) return;
    setFlash(s.lastJudge.j);
    const t = setTimeout(() => setFlash(''), 160);
    return () => clearTimeout(t);
  }, [s.lastJudge]);

  const total = (s.meters.A + s.meters.B + s.meters.C) / 3;
  const hurtRecent = Date.now() - s.hurt < 300;

  return (
    <div className="hud">
      {hurtRecent && <div className="hurt" key={s.hurt} />}
      <div className="hud-top">
        <div className="meter">
          <div className="meter-title">CITY COLOR <b>{Math.round(total)}%</b></div>
          <div className="meter-bar"><i style={{ width: `${total}%` }} /></div>
          <div className="pips">
            {ZONES.map(([z, name]) => (
              <div key={z} className={`pip ${s.zone === z ? 'on' : ''}`}>
                <span>{name}</span>
                <div className="pipbar"><i style={{ width: `${s.meters[z]}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        {s.boss && (
          <div className="bossbar">
            <div className="bossname">{s.boss.name} <small>PHASE {s.boss.phase}</small></div>
            <div className="bossparts">{s.boss.parts.map((h, i) => <div key={i} className="bpart"><i style={{ width: `${h * 100}%` }} /></div>)}</div>
          </div>
        )}
      </div>
      <div className="objective">{s.objective}</div>
      <Minimap />

      <div className={`crosshair ${flash}`}>
        <div className="dot" />
        <div className="beatring" ref={ring} />
      </div>
      <div className="combo">
        <div className="combo-n">{s.combo}<small>COMBO</small></div>
        <div className={`tier t${s.tier}`}>GROOVE x{s.tier}</div>
      </div>

      <div className="bottom-left">
        <div className="label">DECKHOUND <b>{Math.ceil(s.hp)}</b>/{s.maxHp}</div>
        <div className="hp"><i style={{ width: `${(s.hp / s.maxHp) * 100}%` }} /></div>
        <div className="label small">BOOST [SHIFT]</div>
        <div className="boost"><i style={{ width: `${s.boost * 100}%` }} /></div>
      </div>
      <div className="bottom-center">
        <div className={`bassdrop ${s.bassDrop >= 1 ? 'ready' : ''}`}>
          <i style={{ width: `${s.bassDrop * 100}%` }} />
          <span>{s.bassDrop >= 1 ? 'BASS DROP READY — [SPACE]' : 'BASS DROP'}</span>
        </div>
        {s.special && <div className="special">{s.special.type.toUpperCase()} {s.special.type === 'confetti' ? `×${s.special.left}` : `${Math.ceil(s.special.left)}s`}</div>}
      </div>
      <div className="bottom-right">
        <div>VINYL {s.stats.vinyls}/8</div>
        <div className="score">{s.stats.score.toLocaleString()}</div>
      </div>
      <Banner />
      <Toast />
    </div>
  );
}

export function Banner() {
  const b = useUI((s) => s.banner);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!b || !b.text) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(t);
  }, [b]);
  if (!b || !show) return null;
  return (
    <div className="banner" key={b.id}>
      <div className="banner-text">{b.text}</div>
      {b.sub && <div className="banner-sub">{b.sub}</div>}
    </div>
  );
}

function Toast() {
  const t = useUI((s) => s.toast);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!t) return;
    setShow(true);
    const h = setTimeout(() => setShow(false), 2400);
    return () => clearTimeout(h);
  }, [t]);
  if (!t || !show) return null;
  return <div className="toast" key={t.id}>{t.text}</div>;
}

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const c = ref.current, g = game; if (!c || !g) return;
      const x = c.getContext('2d')!; const W = c.width, H = c.height;
      const S = 0.62, cx = W / 2, cy = H / 2;
      const tx = (wx: number, wz: number) => [cx - (wx - g.pos.x) * S, cy - (wz - g.pos.z) * S] as const;
      x.clearRect(0, 0, W, H);
      x.save(); x.beginPath(); x.arc(cx, cy, W / 2 - 2, 0, 7); x.clip();
      x.fillStyle = 'rgba(8,10,18,0.75)'; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(120,130,150,0.25)';
      const rect = (minX: number, maxX: number, minZ: number, maxZ: number) => { const [a, b] = tx(maxX, maxZ); x.fillRect(a, b, (maxX - minX) * S, (maxZ - minZ) * S); };
      rect(-12, 12, -2, 84); rect(-40, 40, 84, 158); rect(-10, 10, 156, 190);
      { const [a, b] = tx(PLAZA.x, PLAZA.z); x.beginPath(); x.arc(a, b, PLAZA.r * S, 0, 7); x.fill(); }
      for (const r of g.remix) {
        if (r.kind === 'citizen') continue;
        const [a, b] = tx(r.root.position.x, r.root.position.z);
        x.fillStyle = r.state === 'grey' ? '#6b7280' : '#ff3ec8';
        const sz = r.kind === 'building' ? 7 : 3; x.fillRect(a - sz / 2, b - sz / 2, sz, sz);
      }
      for (const e of g.enemies) { if (!e.alive) continue; const [a, b] = tx(e.pos.x, e.pos.z); x.fillStyle = '#ff2a3a'; x.beginPath(); x.arc(a, b, e.kind === 'drone' ? 2.2 : 3.5, 0, 7); x.fill(); }
      for (const p of g.pickups) { if (p.taken) continue; const [a, b] = tx(p.pos.x, p.pos.z); x.fillStyle = p.type === 'vinyl' ? '#3ee6ff' : '#ffc83d'; x.fillRect(a - 1.5, b - 1.5, 3, 3); }
      x.restore();
      x.save(); x.translate(cx, cy); x.rotate(-g.yaw); // +X is screen-left, so a positive yaw turns the arrow counter-clockwise
      x.fillStyle = '#3ee6ff'; x.beginPath(); x.moveTo(0, -7); x.lineTo(5, 6); x.lineTo(-5, 6); x.closePath(); x.fill(); x.restore();
      x.strokeStyle = 'rgba(62,230,255,0.6)'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, W / 2 - 2, 0, 7); x.stroke();
    }, 100);
    return () => clearInterval(id);
  }, []);
  return <canvas ref={ref} className="minimap" width={170} height={170} />;
}
