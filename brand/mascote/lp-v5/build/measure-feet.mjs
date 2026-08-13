import { chromium } from 'playwright';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([a-zA-Z]:)/, '$1');
const ROOT = path.resolve(DIR, '..');
const FILE = path.join(ROOT, 'mascote-no-3d-v5.html');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('file:///' + FILE.replace(/\\/g, '/'));
await page.waitForFunction(() => document.getElementById('loading').style.display === 'none', { timeout: 30000 });
await page.waitForTimeout(500);

const groundY = await page.evaluate(() => window.__debug.getGroundY());
console.log('groundY (global min, todas as clips) =', groundY.toFixed(4));

for (let id = 1; id <= 7; id++) {
  await page.evaluate((i) => window.__debug.gotoScene(i), id);
  await page.waitForTimeout(400);
  const feet = await page.evaluate(() => window.__debug.getBoneWorldY('foot'));
  const toes = await page.evaluate(() => window.__debug.getBoneWorldY('toe'));
  const all = feet.concat(toes);
  const minY = all.length ? Math.min(...all.map(b => b.y)) : null;
  console.log(`cena ${id}: pés/dedos min.y=${minY !== null ? minY.toFixed(4) : 'N/A'}  detalhe=${JSON.stringify(all.map(b => ({ n: b.name, y: +b.y.toFixed(3) })))}`);
}

await browser.close();
