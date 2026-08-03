import fs from 'node:fs';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([a-zA-Z]:)/, '$1');
const ROOT = path.resolve(DIR, '..');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function readB64(p) { return fs.readFileSync(p).toString('base64'); }

let html = read(path.join(DIR, 'template.html'));

// --- vendor lib + app script ---
const vendor = read(path.join(DIR, 'vendor-gltfloader.js'));
const app = read(path.join(DIR, 'app.js'));
html = html.replace('<!--VENDOR_GLTFLOADER-->', vendor);
html = html.replace('<!--APP_SCRIPT-->', app);

// --- assets: model, clips, eye-mask, 6x bg/occlusion ---
const modelB64 = read(path.join(DIR, 'model.b64.txt')).trim();
const clipsB64 = read(path.join(DIR, 'clips.b64.txt')).trim();
const eyeMaskB64 = read(path.join(DIR, 'eye-mask.b64.txt')).trim();

let assetTags = '';
assetTags += `<script id='glb-model' type='text/plain'>${modelB64}</script>\n`;
assetTags += `<script id='glb-clips' type='text/plain'>${clipsB64}</script>\n`;
assetTags += `<script id='eye-mask' type='text/plain'>${eyeMaskB64}</script>\n`;

for (let i = 1; i <= 6; i++) {
  const bgB64 = readB64(path.join(ROOT, 'assets', `cena${i}-bg.webp`));
  const occB64 = readB64(path.join(ROOT, 'assets', `cena${i}-occlusion.webp`));
  assetTags += `<script id='bg-cena${i}' type='text/plain'>${bgB64}</script>\n`;
  assetTags += `<script id='occ-cena${i}' type='text/plain'>${occB64}</script>\n`;
}

html = html.replace('<!--ASSETS-->', assetTags);

const outPath = path.join(ROOT, 'mascote-no-3d-v5.html');
fs.writeFileSync(outPath, html);
const sizeMB = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2);
console.log(`Escrito ${outPath} (${sizeMB} MB)`);
