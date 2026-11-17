/**
 * assets-raw/*.glb (Lux3D output, ~8 MB each, 2048 PNG textures)
 *   → public/assets/*.glb (meshopt geometry, WebP textures, small props simplified)
 *   + public/assets/manifest.json consumed by the game.
 *
 *   pnpm optimize            # only new/changed files
 *   pnpm optimize --force    # rebuild everything
 */
import { readdirSync, statSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, meshopt, resample } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const ROOT = join(import.meta.dirname, '..');
const RAW = join(ROOT, 'assets-raw');
const OUT = join(ROOT, 'public/assets');
const force = process.argv.includes('--force');
const rows: { id: string; kind: string }[] = JSON.parse(readFileSync(join(ROOT, 'content/assets.json'), 'utf8'));
const kindOf = (id: string) => rows.find((r) => r.id === id)?.kind ?? 'prop';

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const manifest: Record<string, Record<string, string>> = {};
for (const f of readdirSync(RAW).filter((f) => f.endsWith('.glb')).sort()) {
  const m = f.match(/^(.+)_(neon|grey|rig|anim)\.glb$/);
  if (!m) continue;
  const [, id, variant] = m;
  if (variant === 'rig') continue; // the animated GLB supersedes the bare rig
  const src = join(RAW, f), dst = join(OUT, f);
  (manifest[id] ??= {})[variant] = f;
  if (!force && existsSync(dst) && statSync(dst).mtimeMs > statSync(src).mtimeMs) continue;
  const doc = await io.read(src);
  const kind = kindOf(id);
  const texSize = kind === 'tank' || kind === 'boss' ? 1024 : kind === 'building' ? 1024 : 512;
  const ratio = kind === 'prop' || kind === 'pickup' ? 0.35 : kind === 'enemy' ? 0.5 : kind === 'building' ? 0.6 : 1;
  const skinned = doc.getRoot().listSkins().length > 0;
  await doc.transform(
    dedup(), prune(),
    ...(skinned ? [resample()] : [weld(), ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002 })] : [])]),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texSize, texSize], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  await io.write(dst, doc);
  console.log(`${f}  ${(statSync(src).size / 1e6).toFixed(1)} MB → ${(statSync(dst).size / 1e6).toFixed(2)} MB`);
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('manifest:', Object.keys(manifest).length, 'assets');
