/**
 * BEATTANK asset generator — Aholo Lux3D batch pipeline.
 *
 *   pnpm gen                 # run every pending asset in content/assets.json order
 *   pnpm gen --only B_BAKERY # run a subset (comma separated)
 *   pnpm gen --reroll B_CAFE # drop the lock entry and regenerate
 *
 * Steps per asset (all resumable via content/assets.lock.json):
 *   gen      text-to-3D (G1-Turbo, GLB)                      -> assets-raw/<ID>_neon.glb
 *   grey     material transfer with a grey reference image  -> assets-raw/<ID>_grey.glb
 *   split    part splitting                                 -> assets-raw/<ID>_parts/*
 *   rig      humanoid auto-rig                              -> assets-raw/<ID>_rig.glb
 *   anim     animation retarget (combined clips)            -> assets-raw/<ID>_anim.glb
 *
 * Result URLs expire after 2 h, so every output is downloaded immediately and
 * re-uploaded with the asset SDK if a later step needs it after expiry.
 */
import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createLux3dClient, type HumanoidAnimationId } from '@manycore/aholo-sdk-lux3d';
import { createAssetClient } from '@manycore/aholo-sdk-asset';

type Kind = 'tank' | 'boss' | 'enemy' | 'building' | 'prop' | 'citizen' | 'pickup';
interface AssetRow {
  id: string;
  kind: Kind;
  prompt: string;
  style?: 'photorealistic' | 'cartoon' | 'anime' | 'hand_painted' | 'cyberpunk' | 'fantasy' | 'glass';
  faceCount?: number;
  grey?: string; // material reference id in content/materials/<id>.jpg
  partSplit?: boolean;
  rig?: boolean;
  animations?: string[];
}
interface StepState { taskId?: number; url?: string; urlAt?: number; files?: string[]; status: 'pending' | 'running' | 'done' | 'failed'; error?: string; ms?: number }
type Lock = Record<string, Record<string, StepState>> & { __materials?: Record<string, { url: string; at: number }> };

const ROOT = join(import.meta.dirname, '..');
const RAW = join(ROOT, 'assets-raw');
const LOCK_PATH = join(ROOT, 'content/assets.lock.json');
const rows: AssetRow[] = JSON.parse(readFileSync(join(ROOT, 'content/assets.json'), 'utf8'));
const lock: Lock = existsSync(LOCK_PATH) ? JSON.parse(readFileSync(LOCK_PATH, 'utf8')) : {};
const saveLock = () => writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2));

const SUFFIX = ', stylized realistic game asset, clean readable silhouette, slightly chunky proportions, high quality PBR materials, single object, centered, no background, no text, no logos';
const MAX = Number(process.env.AHOLO_MAX_CONCURRENCY ?? 2);
const URL_TTL = 100 * 60 * 1000; // treat URLs as stale after 100 min (real expiry 2 h)

const lux3d = createLux3dClient({ region: 'com' });
const asset = createAssetClient({ region: 'com' });

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1]?.split(',') : undefined; };
const only = flag('--only');
const reroll = flag('--reroll');
for (const id of reroll ?? []) delete lock[id];

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function download(url: string, file: string) {
  mkdirSync(dirname(file), { recursive: true });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

/** Wait for a task; returns every http output URL. */
async function waitUrls(taskId: number): Promise<string[]> {
  const res = await lux3d.tasks.waitFor(taskId, { intervalMs: 12_000, timeoutMs: 20 * 60_000 });
  const urls = (res.outputs ?? []).map((o) => o.content ?? '').filter((c) => c.startsWith('http'));
  if (!urls.length) throw new Error(`task ${taskId} finished without URL outputs: ${JSON.stringify(res).slice(0, 400)}`);
  return urls;
}

const extOf = (u: string) => (new URL(u).pathname.match(/\.([a-z0-9_]+)$/i)?.[1] ?? 'bin').toLowerCase();

/** A fresh public URL for a step's primary file (re-upload when expired). */
async function freshUrl(st: StepState): Promise<string> {
  if (st.url && st.urlAt && Date.now() - st.urlAt < URL_TTL) return st.url;
  const up = await asset.uploadFile(st.files![0]);
  st.url = up.url; st.urlAt = Date.now(); saveLock();
  return up.url;
}

async function materialUrl(id: string): Promise<string> {
  lock.__materials ??= {};
  const m = lock.__materials[id];
  if (m && Date.now() - m.at < 24 * 3600_000) return m.url;
  const up = await asset.uploadFile(join(ROOT, 'content/materials', `${id}.jpg`));
  lock.__materials[id] = { url: up.url, at: Date.now() }; saveLock();
  return up.url;
}

async function step(row: AssetRow, name: string, run: () => Promise<number>, out: (urls: string[]) => Promise<string[]>) {
  const s = ((lock[row.id] ??= {})[name] ??= { status: 'pending' });
  if (s.status === 'done') return s;
  const t0 = Date.now();
  s.status = 'running'; s.error = undefined;
  try {
    if (!s.taskId) {
      // retry create on concurrency-limit / rate errors (they cost nothing)
      for (let i = 0; ; i++) {
        try { s.taskId = Number(await run()); break; } catch (e) {
          const msg = String((e as Error).message ?? e);
          if (i < 40 && /CONCURRENCY|RateLimit|429|limit/i.test(msg)) { await new Promise((r) => setTimeout(r, 20_000)); continue; }
          throw e;
        }
      }
      saveLock();
      log(row.id, name, 'task', s.taskId);
    }
    const urls = await waitUrls(s.taskId);
    s.url = urls[0]; s.urlAt = Date.now();
    s.files = await out(urls);
    s.status = 'done'; s.ms = Date.now() - t0;
    log(row.id, name, 'done', `${(s.ms / 1000).toFixed(0)}s`, s.files.join(' '));
  } catch (e) {
    s.status = 'failed'; s.error = String((e as Error).message ?? e).slice(0, 500);
    s.taskId = undefined; // next run recreates
    log(row.id, name, 'FAILED', s.error);
  }
  saveLock();
  return s;
}

async function pipeline(row: AssetRow) {
  const gen = await step(row, 'gen',
    () => lux3d.textTo3d.create({
      prompt: row.prompt + SUFFIX, style: row.style ?? 'photorealistic', version: 'G1-Turbo',
      faceCount: row.faceCount ?? 20000, outputFormat: ['glb'], aiPredictSize: false,
    }),
    async (urls) => [await download(urls.find((u) => extOf(u) === 'glb') ?? urls[0], join(RAW, `${row.id}_neon.glb`))]);
  if (gen.status !== 'done') return;

  if (row.grey) {
    await step(row, 'grey',
      async () => lux3d.materialTransfer.create({
        img: await materialUrl(row.grey!), meshUrl: await freshUrl(gen), version: 'v3.0-standard', outputFormat: ['glb'], aiPredictSize: false,
      }),
      async (urls) => [await download(urls.find((u) => extOf(u) === 'glb') ?? urls[0], join(RAW, `${row.id}_grey.glb`))]);
  }
  if (row.partSplit) {
    await step(row, 'split',
      async () => lux3d.partSplit.create({ glbUrl: await freshUrl(gen) }),
      async (urls) => Promise.all(urls.map((u, i) => download(u, join(RAW, `${row.id}_parts`, `part_${i}.${extOf(u)}`)))));
  }
  if (row.rig) {
    const rig = await step(row, 'rig',
      async () => lux3d.humanoidAutoRig.create({ modelUrl: await freshUrl(gen) }),
      async (urls) => [await download(urls.find((u) => extOf(u) === 'glb') ?? urls[0], join(RAW, `${row.id}_rig.glb`))]);
    if (rig.status === 'done' && row.animations?.length) {
      await step(row, 'anim',
        async () => lux3d.humanoidAnimationRetarget.create({
          rigModelUrl: await freshUrl(rig), animationIds: row.animations as HumanoidAnimationId[], animationOutputMode: 'combined', outFormat: 'glb', animateInPlace: true,
        }),
        async (urls) => [await download(urls.find((u) => extOf(u) === 'glb') ?? urls[0], join(RAW, `${row.id}_anim.glb`))]);
    }
  }
}

async function main() {
  const todo = rows.filter((r) => !only || only.includes(r.id));
  log(`assets: ${todo.length}, concurrency: ${MAX}`);
  let next = 0;
  // ponytail: one asset chain per worker keeps in-flight tasks <= MAX; per-step scheduling would pack the queue tighter.
  await Promise.all(Array.from({ length: MAX }, async () => {
    while (next < todo.length) await pipeline(todo[next++]);
  }));
  console.table(todo.map((r) => Object.fromEntries([['id', r.id], ...Object.entries(lock[r.id] ?? {}).map(([k, v]) => [k, `${v.status}${v.ms ? ` ${(v.ms / 1000) | 0}s` : ''}`])])));
}
main();
