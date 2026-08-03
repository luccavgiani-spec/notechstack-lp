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

for (const id of [7, 1]) {
  await page.evaluate((i) => window.__debug.gotoScene(i), id);
  await page.waitForTimeout(400);

  const groundY = await page.evaluate(() => window.__debug.getGroundY());
  const feetY = await page.evaluate(() => {
    var bones = window.__debug.getBoneWorldY('toe');
    return bones.length ? Math.min.apply(null, bones.map(function(b){return b.y;})) : null;
  });
  const ndc = await page.evaluate((y) => window.__debug.projectWorld(0, y, 0), feetY);
  const pxY = (1 - ndc.y) / 2 * 900;

  await page.evaluate((y) => {
    document.querySelectorAll('.__marker').forEach(function(e){e.remove();});
    var d = document.createElement('div');
    d.className = '__marker';
    d.style.cssText = 'position:fixed;left:0;right:0;height:2px;background:red;z-index:999;top:' + y + 'px';
    document.body.appendChild(d);
  }, pxY);

  console.log(`cena ${id}: feetBoneY=${feetY.toFixed(3)} groundY=${groundY.toFixed(3)} linha_prevista_px=${pxY.toFixed(1)}`);
  await page.screenshot({ path: path.join(ROOT, 'screenshots', `verify-overlay2-cena${id}.png`) });
}

await browser.close();
