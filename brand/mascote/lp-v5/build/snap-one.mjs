import { chromium } from 'playwright';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([a-zA-Z]:)/, '$1');
const ROOT = path.resolve(DIR, '..');
const FILE = path.join(ROOT, 'mascote-no-3d-v5.html');
const id = process.argv[2] || '6';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('file:///' + FILE.replace(/\\/g, '/'));
await page.waitForFunction(() => document.getElementById('loading').style.display === 'none', { timeout: 30000 });
await page.waitForTimeout(500);
await page.evaluate((i) => window.__debug.gotoScene(i), parseInt(id, 10));
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(ROOT, 'screenshots', `cena${id}.png`) });
await browser.close();
console.log('ok');
