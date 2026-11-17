/**
 * v2 step ①: concept art with Aholo multimodal-to-image (review gate A).
 *
 *   npx tsx scripts/concept.ts VH_DECKHOUND        # 2 variants → content/concepts/VH_DECKHOUND/
 *   npx tsx scripts/concept.ts VH_DECKHOUND 3      # 3 variants
 */
import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d';
import { waitTask, outputUrls, download } from './lib/aholo';

const STYLE = 'Stylized-realistic 3D game asset render, high-end animated feature film look, slightly chunky playful proportions, rich PBR materials: glossy toy-like plastics, painted steel with sticker-bomb and abstract graffiti decals (no readable letters), worn corrugated metal, warm golden-hour key light with soft bounce, candy accent palette of hot magenta, electric cyan, acid green, sunflower yellow and tangerine on a warm brick-and-cream base, festive holiday details.';
const FRAME = 'Single isolated object, three-quarter view, full object in frame, centered, plain light-grey seamless studio background, soft contact shadow, no text, no logos, no watermark, no people.';
const GREY = 'Palette override: desaturated slate-grey and pale icy-blue only, no candy colours.';
const TPOSE = 'Full body, standing in a clean T-pose, arms straight out to the sides, legs slightly apart, facing camera, neutral expression. Single character, centered, plain light-grey seamless studio background, no text, no logos, no watermark.';

const ROOT = join(import.meta.dirname, '..');
const [id, n = '2'] = process.argv.slice(2);
const rows = JSON.parse(readFileSync(join(ROOT, 'content/assets-v2.json'), 'utf8')) as { id: string; brief: string; styleOverride: string | null; character: boolean }[];
const row = rows.find((r) => r.id === id);
if (!row) throw new Error(`unknown asset ${id}`);
const prompt = [STYLE, row.styleOverride === 'grey' ? GREY : '', `Subject: ${row.brief}.`, row.character ? TPOSE : FRAME].filter(Boolean).join(' ');

const lux3d = createLux3dClient({ region: 'com' });
const dir = join(ROOT, 'content/concepts', id);
mkdirSync(dir, { recursive: true });
const start = readdirSync(dir).filter((f) => f.startsWith('concept_')).length;

await Promise.all(Array.from({ length: Number(n) }, async (_, i) => {
  const t0 = Date.now();
  const taskId = await lux3d.multimodalToImage.create({ prompt });
  const res = await waitTask(lux3d, taskId, 6000, 10 * 60_000);
  const url = outputUrls(res)[0];
  if (!url) throw new Error(`task ${taskId}: no image in ${JSON.stringify(res).slice(0, 300)}`);
  const ext = new URL(url).pathname.match(/\.(png|jpe?g|webp)$/i)?.[1] ?? 'png';
  const file = join(dir, `concept_v${start + i + 1}.${ext}`);
  writeFileSync(file, await download(url));
  console.log(`task ${taskId} → ${file} (${((Date.now() - t0) / 1000) | 0}s)`);
}));
writeFileSync(join(dir, 'prompt.txt'), prompt + '\n');
