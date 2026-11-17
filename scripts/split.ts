/**
 * v2 step ⑤: part split of a generated model.
 *   npx tsx scripts/split.ts VH_DECKHOUND [--task <id>]
 * Uses the model URL from content/concepts/<ID>/model.json (re-uploads if older than 100 min).
 * Output: assets-raw/<ID>_parts.glb (one GLB, one mesh node per part)
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d';
import { waitTask, outputUrls, download } from './lib/aholo';
import { createAssetClient } from '@manycore/aholo-sdk-asset';

const ROOT = join(import.meta.dirname, '..');
const [id, flag, reuse] = process.argv.slice(2);
const m = JSON.parse(readFileSync(join(ROOT, 'content/concepts', id, 'model.json'), 'utf8')) as { at: number; url: string };
const lux3d = createLux3dClient({ region: 'com' });
const glbUrl = Date.now() - m.at < 100 * 60_000 ? m.url : (await createAssetClient({ region: 'com' }).uploadFile(join(ROOT, 'assets-raw', `${id}_neon.glb`))).url;
const t0 = Date.now();
const taskId = flag === '--task' ? Number(reuse) : await lux3d.partSplit.create({ glbUrl });
console.log('task', taskId);
const res = await waitTask(lux3d, taskId, 10_000, 30 * 60_000);
const urls = outputUrls(res);
const glb = urls.find((x) => new URL(x).pathname.endsWith('.glb')) ?? urls[0];
writeFileSync(join(ROOT, 'assets-raw', `${id}_parts.glb`), await download(glb));
console.log(`done in ${((Date.now() - t0) / 1000) | 0}s (${urls.length} outputs) → assets-raw/${id}_parts.glb`);
