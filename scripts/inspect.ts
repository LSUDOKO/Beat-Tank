import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  const b = getBounds(doc.getRoot().listScenes()[0]);
  const tris = doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((a,p)=>a+(p.getIndices()?.getCount()??0)/3,0);
  const tex = doc.getRoot().listTextures().map(t=>t.getSize()?.join('x')+' '+t.getMimeType());
  console.log(f.split('/').pop(), 'min', b.min.map(v=>v.toFixed(2)), 'max', b.max.map(v=>v.toFixed(2)), 'tris', tris, tex);
}
