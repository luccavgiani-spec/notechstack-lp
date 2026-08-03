import { NodeIO } from '@gltf-transform/core';

const io = new NodeIO();

async function inspect(file) {
  const doc = await io.read(`build/raw/${file}.glb`);
  const root = doc.getRoot();
  const anims = root.listAnimations();
  console.log(`\n=== ${file} ===`);
  for (const anim of anims) {
    for (const ch of anim.listChannels()) {
      const target = ch.getTargetNode();
      const path = ch.getTargetPath();
      const name = target ? target.getName() : '?';
      if (/hips/i.test(name) && path === 'translation') {
        const sampler = ch.getSampler();
        const out = sampler.getOutput();
        const arr = out.getArray();
        console.log(`  ${name}.${path}: count=${out.getCount()} first3=[${arr[0].toFixed(4)},${arr[1].toFixed(4)},${arr[2].toFixed(4)}] mid=[${arr[Math.floor(arr.length/2)]}]`);
      }
    }
  }
  // node rest transforms for any hips-named node
  for (const node of root.listNodes()) {
    if (/hips/i.test(node.getName())) {
      console.log(`  node ${node.getName()}: T=${node.getTranslation()} S=${node.getScale()}`);
    }
  }
}

await inspect('02-sitting-idle');
await inspect('cena2-01-standing-idle');
await inspect('model');
