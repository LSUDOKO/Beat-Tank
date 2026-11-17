// Procedural material reference images for Lux3D material transfer (no third-party textures).
import sharp from 'sharp';
const mats: Record<string, [number, number, number, number]> = {
  mat_grey_concrete: [118, 120, 124, 22], // r g b noise
  mat_grey_stone: [150, 150, 152, 12],
  mat_hush_felt: [58, 60, 66, 10],
};
for (const [id, [r, g, b, n]] of Object.entries(mats)) {
  const W = 1024, px = Buffer.alloc(W * W * 3);
  for (let i = 0; i < W * W; i++) { const k = (Math.random() - 0.5) * 2 * n; px[i * 3] = r + k; px[i * 3 + 1] = g + k; px[i * 3 + 2] = b + k; }
  await sharp(px, { raw: { width: W, height: W, channels: 3 } }).blur(1.2).jpeg({ quality: 88 }).toFile(`content/materials/${id}.jpg`);
  console.log('wrote', id);
}
