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

await page.evaluate((id) => window.__debug.gotoScene(id), 2);
await page.waitForTimeout(400);

const groundY = await page.evaluate(() => window.__debug.getGroundY());
const ndc = await page.evaluate((gy) => window.__debug.projectWorld(0, gy, 0), groundY);
const pxY = (1 - ndc.y) / 2 * 900;
console.log('linha prevista dos pés em px:', pxY.toFixed(1));

await page.evaluate((y) => {
  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:0;right:0;top=' + y + 'px;height:2px;background:red;z-index:999;top:' + y + 'px';
  document.body.appendChild(d);
  var d2 = document.createElement('div');
  d2.style.cssText = 'position:fixed;left:0;top:' + (y - 14) + 'px;color:red;font:14px monospace;z-index:999;background:white';
  d2.textContent = 'groundY line';
  document.body.appendChild(d2);
}, pxY);

await page.screenshot({ path: path.join(ROOT, 'screenshots', 'verify-overlay-cena2.png') });
await browser.close();
