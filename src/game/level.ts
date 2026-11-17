/**
 * "Silent Night District" layout. 1 unit = 1 m, +Z = north (toward the Plaza).
 *
 *   Zone A  Slush Street      z   0 .. 84   x ±12
 *   Zone B  Market square     z  84 .. 158  x ±40
 *   Avenue                    z 158 .. 182  x ±10
 *   Zone C  Plaza of Lights   circle centre (0, 222) r 44
 */
export type Zone = 'A' | 'B' | 'C';

export interface Placed {
  asset: string;      // Lux3D asset id (falls back to a procedural mesh)
  x: number; z: number;
  rot: number;        // radians, the model's +Z faces this direction
  w: number; d: number; h: number; // target footprint/height (m)
  zone: Zone;
  kind: 'building' | 'prop' | 'tree' | 'balloon';
  y?: number;
  paintHp: number;
  weight: number;     // contribution to the zone colour meter
  solid: boolean;     // blocks the tank
}

const HALF_PI = Math.PI / 2;
export const placed: Placed[] = [];
const b = (asset: string, x: number, z: number, rot: number, w: number, d: number, h: number, zone: Zone) =>
  placed.push({ asset, x, z, rot, w, d, h, zone, kind: 'building', paintHp: 6, weight: 5, solid: true });
const p = (asset: string, x: number, z: number, rot: number, size: number, zone: Zone, solid = true, extra: Partial<Placed> = {}) =>
  placed.push({ asset, x, z, rot, w: size, d: size, h: size, zone, kind: 'prop', paintHp: 2, weight: 1, solid, ...extra });

// ── Zone A: Slush Street ──
const left = ['B_BAKERY', 'B_RECORD', 'B_APT_A', 'B_CAFE', 'B_TOY', 'B_CORNER_SHOP'];
const right = ['B_CORNER_SHOP', 'B_CAFE', 'B_TOY', 'B_BAKERY', 'B_APT_A', 'B_RECORD'];
[8, 22, 36, 50, 64, 78].forEach((z, i) => {
  b(left[i], -19, z, HALF_PI, 13, 13, left[i] === 'B_APT_A' ? 20 : 13, 'A');
  b(right[i], 19, z, -HALF_PI, 13, 13, right[i] === 'B_APT_A' ? 20 : 13, 'A');
});
for (let z = 4; z < 84; z += 14) { p('PR_LAMP', -10.6, z, HALF_PI, 4.5, 'A', false); p('PR_LAMP', 10.6, z + 7, -HALF_PI, 4.5, 'A', false); }
p('PR_CAR', -7.5, 18, 0, 4.2, 'A'); p('PR_CAR', 7.5, 44, Math.PI, 4.2, 'A'); p('PR_CAR', -7.5, 66, 0, 4.2, 'A');
p('PR_SNOWMAN', 9, 30, -0.4, 2.6, 'A'); p('PR_GIFTS', -9, 57, 0.3, 2.4, 'A'); p('PR_ORNAMENT', 8.5, 72, 0, 2.2, 'A');

// ── Zone B: Market & container yard ──
[98, 116, 134, 150].forEach((z, i) => {
  b(i % 2 ? 'B_APT_A' : 'B_CORNER_SHOP', -47, z, HALF_PI, 14, 14, i % 2 ? 22 : 14, 'B');
  b(i % 2 ? 'B_CINEMA' : 'B_APT_A', 47, z, -HALF_PI, 14, 14, i % 2 ? 15 : 22, 'B');
});
b('B_DEPT_STORE', -27, 166, Math.PI, 22, 14, 16, 'B'); b('B_TOY', 27, 166, Math.PI, 18, 14, 14, 'B');
b('B_CAFE', -27, 90, 0, 16, 10, 12, 'B'); b('B_BAKERY', 27, 90, 0, 16, 10, 12, 'B');
for (const x of [-22, -12, 12, 22]) for (const z of [104, 120, 136]) p('PR_STALL', x, z, x < 0 ? HALF_PI : -HALF_PI, 4.5, 'B');
for (const [x, z] of [[-34, 104], [34, 104], [-34, 142], [34, 142]] as const) p('PR_CONTAINERS', x, z, x < 0 ? 0 : Math.PI, 9, 'B', true, { paintHp: 4, weight: 3 });
placed.push({ asset: 'PR_BALLOON', x: -16, z: 128, y: 9, rot: 0.6, w: 8, d: 8, h: 8, zone: 'B', kind: 'balloon', paintHp: 3, weight: 3, solid: false });
placed.push({ asset: 'PR_BALLOON', x: 18, z: 110, y: 11, rot: -0.8, w: 8, d: 8, h: 8, zone: 'B', kind: 'balloon', paintHp: 3, weight: 3, solid: false });
p('PR_CAR', -4, 146, 0.4, 4.2, 'B'); p('PR_GIFTS', 4, 98, 0, 2.6, 'B'); p('PR_SNOWMAN', -30, 124, 0.5, 2.8, 'B'); p('PR_SNOWMAN', 30, 128, -0.5, 2.8, 'B');

// ── Avenue ──
b('B_CORNER_SHOP', -19, 176, HALF_PI, 14, 12, 14, 'C'); b('B_RECORD', 19, 176, -HALF_PI, 14, 12, 14, 'C');

// ── Zone C: Plaza of Lights ──
export const PLAZA = { x: 0, z: 222, r: 44 };
export const TREE = { x: 0, z: 214 };
export const BOSS_POS = { x: 0, z: 244 };
placed.push({ asset: 'PR_GIANT_TREE', x: TREE.x, z: TREE.z, rot: 0, w: 12, d: 12, h: 24, zone: 'C', kind: 'tree', paintHp: 10, weight: 6, solid: true });
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + 0.2;
  const ang = Math.atan2(-Math.sin(a), -Math.cos(a)); // face the plaza centre
  const R = 52;
  const x = Math.sin(a) * R, z = PLAZA.z + Math.cos(a) * R;
  if (Math.abs(x) < 12 && z < PLAZA.z) continue; // avenue opening
  const asset = ['B_DEPT_STORE', 'B_CINEMA', 'B_CLOCK', 'B_APT_A', 'B_CLOCK', 'B_CINEMA', 'B_DEPT_STORE', 'B_TOY'][i];
  b(asset, x, z, ang, asset === 'B_CLOCK' ? 9 : 18, asset === 'B_CLOCK' ? 9 : 14, asset === 'B_CLOCK' ? 30 : 17, 'C');
}
p('PR_STAGE', 0, 268, Math.PI, 16, 'C', true, { paintHp: 4, weight: 3 });
p('PR_SPEAKER_TOWER', -11, 264, Math.PI, 7, 'C'); p('PR_SPEAKER_TOWER', 11, 264, Math.PI, 7, 'C');
for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p('PR_ORNAMENT', Math.sin(a) * 28, PLAZA.z + Math.cos(a) * 28, 0, 2.6, 'C'); }
p('PR_GIFTS', -6, 206, 0.4, 2.6, 'C'); p('PR_GIFTS', 7, 207, -0.2, 2.6, 'C');

// ── Citizens (frozen statues → dancers) ──
export interface CitizenDef { x: number; z: number; rot: number; zone: Zone; model: 'C_KID' | 'C_OFFICE' | 'C_PARTY' }
const models = ['C_KID', 'C_OFFICE', 'C_PARTY'] as const;
export const citizens: CitizenDef[] = [];
const cz = (x: number, z: number, zone: Zone) => citizens.push({ x, z, rot: Math.random() * 6.28, zone, model: models[citizens.length % 3] });
cz(-10, 12, 'A'); cz(10, 26, 'A'); cz(-10.5, 47, 'A'); cz(10, 60, 'A'); cz(-10, 74, 'A');
cz(-6, 112, 'B'); cz(6, 128, 'B'); cz(-17, 96, 'B'); cz(17, 146, 'B'); cz(-28, 133, 'B'); cz(28, 116, 'B');
for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; cz(Math.sin(a) * 18, PLAZA.z + Math.cos(a) * 18 + 4, 'C'); }

// ── Collectibles / pickups ──
export const vinyls = [
  { x: 0, z: 40 }, { x: -24, z: 84.5 }, { x: 0, z: 128 }, { x: -36, z: 124 },
  { x: 36, z: 150 }, { x: 0, z: 170 }, { x: -30, z: 236 }, { x: 30, z: 200 },
];
export const pickups: { x: number; z: number; type: 'repair' | 'subwoofer' | 'laser' | 'confetti' }[] = [
  { x: 4, z: 34, type: 'repair' }, { x: -4, z: 70, type: 'confetti' },
  { x: 0, z: 112, type: 'subwoofer' }, { x: -24, z: 148, type: 'repair' }, { x: 26, z: 96, type: 'laser' },
  { x: -20, z: 200, type: 'repair' }, { x: 22, z: 236, type: 'repair' }, { x: 0, z: 186, type: 'confetti' },
];

// ── Gates (Hush barricades) ──
export const gates = [
  { zone: 'A' as Zone, x: 0, z: 85, w: 24, d: 2 },
  { zone: 'B' as Zone, x: 0, z: 158, w: 20, d: 2 },
];

// ── Walkable area ──
export function inBounds(x: number, z: number, r = 0): boolean {
  if (z > -2 + r && z < 84 && Math.abs(x) < 12 - r) return true;
  if (z >= 84 && z < 158 - r && Math.abs(x) < 40 - r && (z > 84 + r || Math.abs(x) < 12 - r)) return true;
  if (z >= 156 && z < 190 && Math.abs(x) < 10 - r) return true;
  const dx = x - PLAZA.x, dz = z - PLAZA.z;
  return dx * dx + dz * dz < (PLAZA.r - r) * (PLAZA.r - r);
}

export function zoneAt(z: number): Zone { return z < 84 ? 'A' : z < 170 ? 'B' : 'C'; }

export const PLAYER_START = { x: 0, z: 4, rot: 0 };
export const CHECKPOINTS: Record<Zone, { x: number; z: number }> = { A: { x: 0, z: 4 }, B: { x: 0, z: 92 }, C: { x: 0, z: 186 } };
