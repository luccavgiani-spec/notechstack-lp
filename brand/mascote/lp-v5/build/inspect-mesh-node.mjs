import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization, ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

async function inspect(file) {
  const doc = await io.read(`build/raw/${file}.glb`);
  const root = doc.getRoot();
  console.log(`\n=== ${file} ===`);
  for (const node of root.listNodes()) {
    if (node.getMesh()) {
      console.log(`  mesh-node "${node.getName()}": T=${node.getTranslation()} R=${node.getRotation()} S=${node.getScale()}`);
      let p = node;
      const chain = [];
      // acha o pai percorrendo todos os nodes (gltf-transform nao expoe getParent direto)
      for (const candidate of root.listNodes()) {
        if (candidate.listChildren().includes(node)) chain.push(candidate);
      }
      chain.forEach(par => console.log(`    pai: "${par.getName()}" T=${par.getTranslation()} R=${par.getRotation()} S=${par.getScale()}`));
    }
    if (node.getSkin()) {
      const skin = node.getSkin();
      console.log(`  skin no node "${node.getName()}": skeleton root=${skin.getSkeleton() ? skin.getSkeleton().getName() : 'N/A'}`);
    }
  }
  for (const scene of root.listScenes()) {
    console.log('  scene children:', scene.listChildren().map(c => c.getName()));
  }
}

await inspect('model');
await inspect('model-optimized');
