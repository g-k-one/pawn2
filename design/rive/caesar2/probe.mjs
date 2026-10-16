// Проба: все трассированные части на местах листа — сравнить вектор с исходником
import { readFileSync, writeFileSync } from 'node:fs';
import { part } from './vec.mjs';
const T = JSON.parse(readFileSync(new URL('./traced.json', import.meta.url))), minLen = +(process.argv[2] || 0);
const nodes = T.map(t => part(t, { name: 'p' + t.i, ax: t.box[0], ay: t.box[1], x: t.box[0], y: t.box[1], minLen }).xml);
writeFileSync(new URL('./probe/scene.rml', import.meta.url), `<Rive version="1" kind="fragment">
<Artboard width="1280" height="960" name="Probe" id="0:2"><Fill name="Bg"><SolidColor colorValue="FF2A2346" name="C"/></Fill>${nodes.join('')}</Artboard>
</Rive>
`);
