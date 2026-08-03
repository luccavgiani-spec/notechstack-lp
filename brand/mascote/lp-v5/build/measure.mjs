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

const H = await page.evaluate(() => window.__debug.getH());
const groundY = await page.evaluate(() => window.__debug.getGroundY());
console.log('H =', H, ' groundY =', groundY);

const results = {};
for (let id = 1; id <= 7; id++) {
  await page.evaluate((i) => window.__debug.gotoScene(i), id);
  await page.waitForTimeout(400);
  const headTop = await page.evaluate(() => window.__debug.getHeadTopWorld());
  const hips = await page.evaluate(() => window.__debug.getHipsWorld());
  results[id] = { headTop, hips };
  console.log('cena', id, 'headTop.y=', headTop && headTop.y.toFixed(3), 'hips.y=', hips && hips.y.toFixed(3));
}

await browser.close();
