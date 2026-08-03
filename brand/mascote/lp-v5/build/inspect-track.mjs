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

const info = await page.evaluate(() => {
  var out = {};
  out.handScaleFactor = window.__debug.getHandScaleFactor();
  var actions = window.__debug.getActions();
  ['cena1-idle', 'cena2-idle', 'model-idle', 'cena4-typing'].forEach(function (name) {
    var a = actions[name];
    if (!a) { out[name] = 'MISSING'; return; }
    var clip = a.getClip();
    var track = clip.tracks.find(function (t) { return /hips/i.test(t.name) && t.name.indexOf('position') >= 0; });
    out[name] = {
      clipName: clip.name,
      trackName: track ? track.name : null,
      first6: track ? Array.from(track.values.slice(0, 6)) : null,
      nodeName: (function () {
        // encontra o node real usado como root do mixer
        return null;
      })()
    };
  });
  // nome real do bone hips no root carregado
  out.rootHipsName = window.__debug.getHipsWorld ? 'see below' : null;
  return out;
});
console.log(JSON.stringify(info, null, 2));

await browser.close();
