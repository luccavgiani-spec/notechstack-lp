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

for (const id of [1, 2]) {
  await page.evaluate((i) => window.__debug.gotoScene(i), id);
  await page.waitForTimeout(400);
  const headTop = await page.evaluate(() => window.__debug.getHeadTopWorld());
  const scenes = await page.evaluate(() => window.__debug.getScenes());
  const cam = scenes[id].cam;
  const ndcHead = await page.evaluate((p) => window.__debug.projectWorld(p.x, p.y, p.z), { x: 0, y: headTop.y, z: 0 });
  const ndcFeet = await page.evaluate((gy) => window.__debug.projectWorld(0, gy, 0), groundY);
  console.log(`cena ${id}: cam=${JSON.stringify(cam)}`);
  console.log(`  headTop.y=${headTop.y.toFixed(3)} -> ndc.y=${ndcHead.y.toFixed(3)} (pixel_frac_top=${((1 - ndcHead.y) / 2 * 100).toFixed(1)}%)`);
  console.log(`  groundY=${groundY.toFixed(3)} -> ndc.y=${ndcFeet.y.toFixed(3)} (pixel_frac_top=${((1 - ndcFeet.y) / 2 * 100).toFixed(1)}%)`);
  await page.screenshot({ path: path.join(ROOT, 'screenshots', `verify-cena${id}.png`) });
}

await browser.close();
