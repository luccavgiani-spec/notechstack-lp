import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([a-zA-Z]:)/, '$1');
const ROOT = path.resolve(DIR, '..');
const FILE = path.join(ROOT, 'mascote-no-3d-v5.html');
const OUT = path.join(ROOT, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push('pageerror: ' + err.message));

await page.goto('file:///' + FILE.replace(/\\/g, '/'));
await page.waitForFunction(() => {
  const el = document.getElementById('loading');
  return el && el.style.display === 'none';
}, { timeout: 30000 });
await page.waitForTimeout(1200);

for (let i = 1; i <= 7; i++) {
  if (i > 1) {
    await page.click(`.scene-btn[data-s='${i}']`);
    // aguarda o fade completo (0.35s cada lado) + assentar animação
    await page.waitForTimeout(1400);
  } else {
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: path.join(OUT, `cena${i}.png`) });
  console.log(`cena${i}.png capturada`);
}

// 1 screenshot durante uma transição (overlay visível)
await page.click(`.scene-btn[data-s='2']`);
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(OUT, 'transicao.png') });
console.log('transicao.png capturada');
await page.waitForTimeout(1400);

// 1 screenshot com olhos verdes (cena 5, deve forçar automaticamente)
await page.click(`.scene-btn[data-s='5']`);
await page.waitForTimeout(1400);
await page.screenshot({ path: path.join(OUT, 'cena5-olhos-verdes.png') });
console.log('cena5-olhos-verdes.png capturada');

console.log('\nerros de console/página:', consoleErrors.length);
consoleErrors.slice(0, 20).forEach(e => console.log(' -', e));

await browser.close();
