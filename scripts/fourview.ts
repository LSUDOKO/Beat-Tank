/**
 * v2 step ②: four consistent views from an approved concept (review gate B).
 *
 *   npx tsx scripts/fourview.ts VH_DECKHOUND concept_v2.jpg [existingTaskId]
 * Writes view_front34 / view_opposite34 / view_side / view_back next to the concept,
 * plus urls.json (uploaded concept URL + view URLs, valid ~2 h) for the image-to-3D step.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d';
import { waitTask, outputUrls, download } from './lib/aholo';
import { createAssetClient } from '@manycore/aholo-sdk-asset';

const [id, conceptFile, reuseTask] = process.argv.slice(2);
const dir = join(import.meta.dirname, '..', 'content/concepts', id);
const lux3d = createLux3dClient({ region: 'com' });
const asset = createAssetClient({ region: 'com' });

const concept = (await asset.uploadFile(join(dir, conceptFile))).url;
const taskId = reuseTask ? Number(reuseTask) : await lux3d.imageToFourView.create({ img: concept });
const res = await waitTask(lux3d, taskId, 6000, 15 * 60_000);
// four-view returns one output whose content is a JSON-encoded array of 4 URLs
const urls = outputUrls(res);
const names = ['view_front34', 'view_opposite34', 'view_side', 'view_back'];
await Promise.all(urls.map(async (u, i) => {
  const ext = new URL(u).pathname.match(/\.(png|jpe?g|webp)$/i)?.[1] ?? 'png';
  writeFileSync(join(dir, `${names[i] ?? `view_${i}`}.${ext}`), await download(u));
}));
writeFileSync(join(dir, 'urls.json'), JSON.stringify({ at: Date.now(), concept, conceptFile, views: urls }, null, 2));
console.log(`task ${taskId}: ${urls.length} views saved in ${dir}`);
