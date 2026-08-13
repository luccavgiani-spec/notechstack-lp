import sharp from 'sharp';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([a-zA-Z]:)/, '$1');
const ROOT = path.resolve(DIR, '..');

// occlusionY novo, em % da altura (0=topo) — cobre o tampo da mesa, não só a base
const FIXES = {
  6: 0.79,
};

for (const [scene, frac] of Object.entries(FIXES)) {
  const bgPath = path.join(ROOT, 'assets', `cena${scene}-bg.webp`);
  const img = sharp(bgPath);
  const meta = await img.metadata();
  const { width, height } = meta;
  const cutY = Math.round(height * frac);

  const raw = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  for (let y = 0; y < info.height; y++) {
    if (y >= cutY) continue;
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * info.channels;
      data[idx + 3] = 0;
    }
  }
  const outPath = path.join(ROOT, 'assets', `cena${scene}-occlusion.webp`);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .webp({ quality: 90 })
    .toFile(outPath);
  console.log(`cena${scene}: occlusionY ${(frac * 100).toFixed(1)}% (y=${cutY}px de ${height}px) -> ${outPath}`);
}
