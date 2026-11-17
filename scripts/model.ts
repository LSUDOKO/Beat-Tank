/**
 * v2 step ③: image-to-3D from the approved concept + four views (review gate C).
 *
 *   npx tsx scripts/model.ts VH_DECKHOUND            # multi-view (concept + views)
 *   npx tsx scripts/model.ts VH_DECKHOUND --single   # concept image only
 *   npx tsx scripts/model.ts VH_DECKHOUND --task 123 # download an already finished task
 * Output: assets-raw/<ID>_neon.glb  (task id + URL logged to content/concepts/<ID>/model.json)
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d';
import { waitTask, outputUrls, download } from './lib/aholo';
import { createAssetClient } from '@manycore/aholo-sdk-asset';

const ROOT = join(import.meta.dirname, '..');
const [id, flag, reuse] = process.argv.slice(2);
const dir = join(ROOT, 'content/concepts', id);
const row = (JSON.parse(readFileSync(join(ROOT, 'content/assets-v2.json'), 'utf8')) as { id: string; model: { version: 'G1' | 'G1-Turbo'; faceCount: number } }[]).find((r) => r.id === id)!;
const u = JSON.parse(readFileSync(join(dir, 'urls.json'), 'utf8')) as { at: number; concept: string; conceptFile: string; views: string[] };
const lux3d = createLux3dClient({ region: 'com' });

let concept = u.concept;
if (Date.now() - u.at > 100 * 60_000) concept = (await createAssetClient({ region: 'com' }).uploadFile(join(dir, u.conceptFile))).url;
// views: [front34, opposite34, side, back]; opposite34 duplicates the concept angle, so skip it
const views = Date.now() - u.at > 100 * 60_000 ? [] : [u.views[2], u.views[3]].filter(Boolean);
const imgs = flag === '--single' ? undefined : [concept, ...views];
if (flag === '--task' && !reuse) throw new Error('--task needs a task id');

const t0 = Date.now();
const taskId = flag === '--task' ? Number(reuse) : await lux3d.imgTo3d.create({
  ...(imgs && imgs.length > 1 ? { imgs } : { img: concept }),
  version: row.model.version, faceCount: row.model.faceCount, outputFormat: ['glb'], enablePbr: true, aiPredictSize: false,
});
console.log('task', taskId, imgs ? `multi-view (${imgs.length} images)` : 'single image');
const res = await waitTask(lux3d, taskId, 10_000, 30 * 60_000);
const urls = outputUrls(res);
const glb = urls.find((x) => new URL(x).pathname.endsWith('.glb')) ?? urls[0];
const out = join(ROOT, 'assets-raw', `${id}_neon.glb`);
writeFileSync(out, await download(glb));
writeFileSync(join(dir, 'model.json'), JSON.stringify({ taskId, at: Date.now(), url: glb, mode: imgs ? 'multi' : 'single', seconds: (Date.now() - t0) / 1000 }, null, 2));
console.log(`done in ${((Date.now() - t0) / 1000) | 0}s → ${out}`);
