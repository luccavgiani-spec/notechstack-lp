import { NodeIO, Document, PropertyType } from '@gltf-transform/core';
import { mergeDocuments, prune, unpartition } from '@gltf-transform/functions';

// contrato nome-canônico -> arquivo fonte em build/raw/
const CLIPS = [
  ['cena1-idle', '02-sitting-idle'],
  ['cena1-angry', 'cena1-02-sitting-angry'],
  ['cena1-typing', '04-sitting-typing'],
  ['cena2-idle', 'cena2-01-standing-idle'],
  ['cena2-nod', 'cena2-02-head-nod-yes'],
  ['walk-inplace', '05-walking-inplace'],
  ['stand-to-sit', 'cena3-02-stand-to-sit'],
  ['cena3-idle-newspaper', 'cena3-03-sitting-idle-maos-frente'],
  ['cena3-discard', 'cena3-04-sitting-angry-descarte'],
  ['cena4-typing', '03-standing-typing'],
  ['cena5-talking', 'cena5-03-sitting-talking'],
  ['cena6-idle', 'cena6-01-sitting-tronco-inclinado'],
  ['cena7-wave', 'cena7-01-waving'],
];

const io = new NodeIO();
const target = new Document();

// Todos os 13 clipes compartilham o MESMO esqueleto (41 bones mixamorig) — se cada
// merge trouxer sua própria cópia de node "mixamorig:Hips" etc., o documento final
// acaba com 13 nodes de mesmo nome, e o GLTFLoader do three.js desambigua duplicatas
// sufixando "_1", "_2"... quebrando o retarget por nome pra quase todo mundo menos o
// primeiro clipe. Resolver customizado: todo Node é compartilhado por nome entre TODOS
// os merges (só accessors/animations/samplers/buffers ficam únicos por clipe).
const sharedNodesByName = new Map();
function makeResolver(target, source) {
  const propertyMap = new Map([[source.getRoot(), target.getRoot()]]);
  return (sourceProp) => {
    if (sourceProp.propertyType === PropertyType.TEXTURE_INFO) return sourceProp;
    if (sourceProp.propertyType === PropertyType.NODE) {
      const name = sourceProp.getName();
      let targetNode = sharedNodesByName.get(name);
      if (!targetNode) {
        targetNode = new (sourceProp.constructor)(target.getGraph());
        sharedNodesByName.set(name, targetNode);
      }
      propertyMap.set(sourceProp, targetNode);
      return targetNode;
    }
    let targetProp = propertyMap.get(sourceProp);
    if (!targetProp) {
      const PropertyClass = sourceProp.constructor;
      targetProp = new PropertyClass(target.getGraph());
      propertyMap.set(sourceProp, targetProp);
    }
    return targetProp;
  };
}

for (const [canonicalName, file] of CLIPS) {
  const src = await io.read(`build/raw/${file}.glb`);
  const root = src.getRoot();

  // remove mesh/skin de todos os nodes (2 dos clipes vieram "with skin" por engano
  // em sessão anterior — não queremos duplicar 5MB de geometria por clipe)
  for (const node of root.listNodes()) {
    node.setMesh(null);
    node.setSkin(null);
  }
  for (const mesh of root.listMeshes()) mesh.dispose();
  for (const skin of root.listSkins()) skin.dispose();
  for (const material of root.listMaterials()) material.dispose();
  for (const texture of root.listTextures()) texture.dispose();
  await src.transform(prune());

  const anims = root.listAnimations();
  if (anims.length === 0) {
    throw new Error(`${file}: nenhuma animação encontrada`);
  }
  anims.forEach((a, i) => a.setName(anims.length > 1 ? `${canonicalName}-${i}` : canonicalName));

  mergeDocuments(target, src, makeResolver(target, src));
  console.log(`+ ${canonicalName} <- ${file}.glb (${anims.length} anim, ${root.listNodes().length} nodes)`);
}

await target.transform(unpartition());
await io.write('build/raw/clips-merged.glb', target);

const finalDoc = await io.read('build/raw/clips-merged.glb');
const finalAnims = finalDoc.getRoot().listAnimations().map(a => a.getName());
console.log('\nAnimações no merge final:', finalAnims.length);
finalAnims.forEach(n => console.log(' -', n));

const missing = CLIPS.map(c => c[0]).filter(n => !finalAnims.includes(n));
if (missing.length) {
  console.error('FALTANDO:', missing);
  process.exit(1);
}

console.log('total de nodes no documento final:', finalDoc.getRoot().listNodes().length, '(esperado ~41, não 41x13)');

// sanity check: nenhum canal de animação deve mirar em node "mixamorigHips_3" etc.
let badTargets = 0;
for (const anim of finalDoc.getRoot().listAnimations()) {
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode();
    if (node && /_\d+$/.test(node.getName())) {
      console.error(`  suspeito: anim "${anim.getName()}" canal aponta pra node "${node.getName()}"`);
      badTargets++;
    }
  }
}
if (badTargets > 0) {
  console.error(`\nFALHA: ${badTargets} canais com node duplicado/sufixado.`);
  process.exit(1);
}

console.log('\nOK — todos os clipes esperados presentes, esqueleto compartilhado sem duplicatas.');
