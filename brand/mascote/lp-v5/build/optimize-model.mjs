import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization, ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { quantize, prune } from '@gltf-transform/functions';
import sharp from 'sharp';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const doc = await io.read('build/raw/model.glb');
const root = doc.getRoot();

console.log('ANTES:');
console.log('  meshes:', root.listMeshes().length);
console.log('  skins:', root.listSkins().length);
console.log('  textures:', root.listTextures().length);

// redimensionar textura 2048 -> 1024 q86
for (const tex of root.listTextures()) {
  const image = tex.getImage();
  if (!image) continue;
  const resized = await sharp(Buffer.from(image))
    .resize(1024, 1024, { fit: 'fill' })
    .jpeg({ quality: 86 })
    .toBuffer();
  tex.setImage(resized).setMimeType('image/jpeg');
  console.log(`  textura redimensionada: ${image.length} -> ${resized.length} bytes`);
}

// remove skin duplicado (se houver) + outros recursos não usados
await doc.transform(prune());

console.log('APOS PRUNE:');
console.log('  meshes:', root.listMeshes().length);
console.log('  skins:', root.listSkins().length);

// quantize (precisa da extensão KHRMeshQuantization registrada p/ escrever)
await doc.transform(quantize());

await io.write('build/raw/model-optimized.glb', doc);

// ---- verificação pós-otimização ----
const check = await io.read('build/raw/model-optimized.glb');
const cRoot = check.getRoot();
console.log('\nVERIFICACAO:');
console.log('  meshes:', cRoot.listMeshes().length, '(esperado 1)');
console.log('  skins:', cRoot.listSkins().length, '(esperado 1)');
for (const mesh of cRoot.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const attrs = prim.listSemantics();
    console.log('  attrs:', attrs.join(', '));
    if (!attrs.includes('JOINTS_0') || !attrs.includes('WEIGHTS_0')) {
      console.error('  ERRO: faltando JOINTS_0/WEIGHTS_0');
      process.exit(1);
    }
  }
}
if (cRoot.listMeshes().length !== 1 || cRoot.listSkins().length !== 1) {
  console.error('ERRO: contagem de meshes/skins inesperada');
  process.exit(1);
}
console.log('\nOK.');
