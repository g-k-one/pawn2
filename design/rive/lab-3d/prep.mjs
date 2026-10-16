// Подготовка 3D Цезаря из Magnific для Rive: node prep.mjs
// src/laugh.glb и src/strike.glb — одна модель с одним скелетом, у каждой своё движение.
// → caesar.glb: сетка + скелет + обе анимации (без текстуры, касательных и лишнего), tex.webp: текстура 1024 px.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'file:///C:/Users/gk_on/Desktop/pawn/node_modules/playwright/index.mjs';
const dir = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const glb = f => { const b = readFileSync(dir + '../lab-3d-src/' + f), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString()), bo = 20 + jl;
  const bl = b.readUInt32LE(bo); return { j, bin: b.slice(bo + 8, bo + 8 + bl) }; };
const A = glb('laugh.glb'), B = glb('strike.glb');

// текстура
const img = A.j.images[0], bv = A.j.bufferViews[img.bufferView], jpg = A.bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
const br = await chromium.launch(), pg = await br.newPage();
const webp = await pg.evaluate(async src => { const i = new Image(); i.src = src; await i.decode(); const n = 1024, c = new OffscreenCanvas(n, n), x = c.getContext('2d');
  x.imageSmoothingQuality = 'high'; x.drawImage(i, 0, 0, n, n); const u8 = new Uint8Array(await (await c.convertToBlob({ type: 'image/webp', quality: .9 })).arrayBuffer());
  let s = ''; for (let k = 0; k < u8.length; k += 32768) s += String.fromCharCode(...u8.subarray(k, k + 32768)); return btoa(s); }, 'data:image/jpeg;base64,' + jpg.toString('base64'));
await br.close(); writeFileSync(dir + 'tex.webp', Buffer.from(webp, 'base64'));

// новый GLB: переносим нужные accessors с упаковкой bufferViews
const out = { asset: A.j.asset, scene: A.j.scene, scenes: A.j.scenes, nodes: A.j.nodes, skins: [], meshes: [], accessors: [], bufferViews: [], buffers: [], animations: [] };
const chunks = []; let off = 0;
const copyAcc = (src, i) => { const a = src.j.accessors[i], v = src.j.bufferViews[a.bufferView], es = { 5126: 4, 5125: 4, 5123: 2, 5121: 1, 5122: 2, 5120: 1 }[a.componentType];
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type], stride = v.byteStride || es * n, start = (v.byteOffset || 0) + (a.byteOffset || 0);
  const data = Buffer.alloc(a.count * es * n); for (let k = 0; k < a.count; k++) src.bin.copy(data, k * es * n, start + k * stride, start + k * stride + es * n);
  const pad = (4 - (off % 4)) % 4; if (pad){ chunks.push(Buffer.alloc(pad)); off += pad; }
  out.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: data.length }); chunks.push(data); off += data.length;
  const na = { ...a, bufferView: out.bufferViews.length - 1 }; delete na.byteOffset; out.accessors.push(na); return out.accessors.length - 1; };
const p = A.j.meshes[0].primitives[0], attrs = {};
for (const k of ['POSITION', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']) attrs[k] = copyAcc(A, p.attributes[k]);
out.meshes.push({ primitives: [{ attributes: attrs, indices: copyAcc(A, p.indices), mode: p.mode }] });
const sk = A.j.skins[0]; out.skins.push({ ...sk, inverseBindMatrices: copyAcc(A, sk.inverseBindMatrices) });
for (const [src, name] of [[A, 'laugh'], [B, 'strike']]){ const an = src.j.animations[0], map = new Map();
  const acc = i => map.has(i) ? map.get(i) : (map.set(i, copyAcc(src, i)), map.get(i));
  out.animations.push({ name, samplers: an.samplers.map(s => ({ input: acc(s.input), output: acc(s.output), interpolation: s.interpolation })), channels: an.channels }); }
const bin = Buffer.concat(chunks); out.buffers.push({ byteLength: bin.length });
let js = Buffer.from(JSON.stringify(out)); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
const binP = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]), total = 12 + 8 + js.length + 8 + binP.length, h = Buffer.alloc(12);
h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(total, 8);
const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4E4F534A, 4); const c2 = Buffer.alloc(8); c2.writeUInt32LE(binP.length, 0); c2.writeUInt32LE(0x004E4942, 4);
writeFileSync(dir + 'caesar.glb', Buffer.concat([h, c1, js, c2, binP]));
console.log('caesar.glb', total, 'bytes; tex.webp', Buffer.from(webp, 'base64').length);
