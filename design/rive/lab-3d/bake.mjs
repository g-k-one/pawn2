// Запекание 3D Цезаря для Luau-скрипта: node bake.mjs → c3d.bin (+ tex.webp делает prep.mjs)
// Скрипту в Rive не нужно разбирать GLB и считать иерархию: здесь обе анимации проигрываются на 30 к/с,
// и для каждого кадра пишутся готовые матрицы кожи (кость × обратная привязка), 12 чисел на кость.
// Формат (little-endian): 'C3D1', nV, nT, nJ, nF, fLaugh, fStrike (u32) · cx, cy, cz, h (f32)
//   · позиции f32×3·nV · uv f32×2·nV · индексы u16×3·nT · кости u8×4·nV · веса u8×4·nV (сумма 255) · матрицы f32×12·nJ·nF
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const glb = f => { const b = readFileSync(dir + '../lab-3d-src/' + f), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString()), bo = 20 + jl;
  return { j, bin: b.slice(bo + 8, bo + 8 + b.readUInt32LE(bo)) }; };
const acc = (g, i) => { const a = g.j.accessors[i], v = g.j.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType], es = T.BYTES_PER_ELEMENT, stride = v.byteStride || es * n;
  const out = new T(a.count * n), base = (v.byteOffset || 0) + (a.byteOffset || 0), dv = new DataView(g.bin.buffer, g.bin.byteOffset);
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++){ const o = base + k * stride + c * es;
    out[k * n + c] = es === 4 ? (T === Float32Array ? dv.getFloat32(o, true) : dv.getUint32(o, true)) : es === 2 ? dv.getUint16(o, true) : dv.getUint8(o); }
  return out; };
const A = glb('laugh.glb'), B = glb('strike.glb'), J = A.j, p = J.meshes[0].primitives[0];
const pos = acc(A, p.attributes.POSITION), uv = acc(A, p.attributes.TEXCOORD_0), idx = acc(A, p.indices), jn = acc(A, p.attributes.JOINTS_0), wt = acc(A, p.attributes.WEIGHTS_0);
const nV = pos.length / 3, nT = idx.length / 3, skin = J.skins[0], joints = skin.joints, nJ = joints.length, ibm = acc(A, skin.inverseBindMatrices);

// ---------- матрицы 4×4, по столбцам (как glTF) ----------
const mul = (a, b) => { const o = new Float64Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++){ let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
const trs = (t, q, s) => { const [x, y, z, w] = q, m = new Float64Array(16);
  m[0] = (1 - 2 * (y * y + z * z)) * s[0]; m[1] = 2 * (x * y + z * w) * s[0]; m[2] = 2 * (x * z - y * w) * s[0];
  m[4] = 2 * (x * y - z * w) * s[1]; m[5] = (1 - 2 * (x * x + z * z)) * s[1]; m[6] = 2 * (y * z + x * w) * s[1];
  m[8] = 2 * (x * z + y * w) * s[2]; m[9] = 2 * (y * z - x * w) * s[2]; m[10] = (1 - 2 * (x * x + y * y)) * s[2];
  m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; m[15] = 1; return m; };
const parent = new Array(J.nodes.length).fill(-1); J.nodes.forEach((n, i) => (n.children || []).forEach(c => parent[c] = i));
const restT = J.nodes.map(n => n.translation || [0, 0, 0]), restR = J.nodes.map(n => n.rotation || [0, 0, 0, 1]), restS = J.nodes.map(n => n.scale || [1, 1, 1]);
const slerp = (a, b, t) => { let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], bb = b; if (d < 0){ d = -d; bb = b.map(v => -v); }
  if (d > .9995){ const r = a.map((v, i) => v + (bb[i] - v) * t), l = Math.hypot(...r); return r.map(v => v / l); }
  const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s; return a.map((v, i) => v * wa + bb[i] * wb); };
function clipFrames(g){
  const an = g.j.animations[0], ch = an.channels.map(c => { const s = an.samplers[c.sampler]; return { node: c.target.node, path: c.target.path, t: acc(g, s.input), v: acc(g, s.output) }; });
  const dur = Math.max(...ch.map(c => c.t[c.t.length - 1])), nF = Math.round(dur * 30) + 1, frames = [];
  for (let f = 0; f < nF; f++){ const time = f / 30, T = restT.map(x => [...x]), Rq = restR.map(x => [...x]), S = restS.map(x => [...x]);
    for (const c of ch){ const n = c.path === 'rotation' ? 4 : 3; let k = 0; while (k < c.t.length - 2 && c.t[k + 1] <= time) k++;
      const t0 = c.t[k], t1 = c.t[Math.min(k + 1, c.t.length - 1)], u = t1 > t0 ? Math.min(1, Math.max(0, (time - t0) / (t1 - t0))) : 0;
      const a = Array.from(c.v.slice(k * n, k * n + n)), b = Array.from(c.v.slice(Math.min(k + 1, c.t.length - 1) * n, Math.min(k + 1, c.t.length - 1) * n + n));
      const val = n === 4 ? slerp(a, b, u) : a.map((x, i) => x + (b[i] - x) * u);
      (c.path === 'rotation' ? Rq : c.path === 'translation' ? T : S)[c.node] = val; }
    const world = []; const W = i => world[i] ||= (parent[i] >= 0 ? mul(W(parent[i]), trs(T[i], Rq[i], S[i])) : trs(T[i], Rq[i], S[i]));
    frames.push(joints.map((jn2, j) => mul(W(jn2), ibm.subarray(j * 16, j * 16 + 16)))); }
  return frames; }
const FL = clipFrames(A), FS = clipFrames(B), F = [...FL, ...FS], nF = F.length;
// рамка модели в позе покоя
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < nV; i++) for (let c = 0; c < 3; c++){ mn[c] = Math.min(mn[c], pos[i * 3 + c]); mx[c] = Math.max(mx[c], pos[i * 3 + c]); }
// ---------- запись ----------
const size = 4 + 6 * 4 + 4 * 4 + nV * 12 + nV * 8 + nT * 6 + (nT * 6 % 4 ? 2 : 0) + nV * 4 + nV * 4 + nF * nJ * 48, out = Buffer.alloc(size); let o = 0;
out.write('C3D1', 0); o = 4; for (const v of [nV, nT, nJ, nF, FL.length, FS.length]){ out.writeUInt32LE(v, o); o += 4; }
for (const v of [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2, mx[1] - mn[1]]){ out.writeFloatLE(v, o); o += 4; }
for (const v of pos){ out.writeFloatLE(v, o); o += 4; } for (const v of uv){ out.writeFloatLE(v, o); o += 4; }
for (const v of idx){ out.writeUInt16LE(v, o); o += 2; } if (o % 4) o += 2;
for (const v of jn) out.writeUInt8(v, o++);
for (let i = 0; i < nV; i++){ const w = Array.from(wt.slice(i * 4, i * 4 + 4)), s = w.reduce((a, b) => a + b, 0) || 1, q = w.map(x => Math.round(x / s * 255)); q[q.indexOf(Math.max(...q))] += 255 - q.reduce((a, b) => a + b, 0); for (const v of q) out.writeUInt8(v, o++); }
for (const fr of F) for (const m of fr) for (const k of [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]){ out.writeFloatLE(m[k], o); o += 4; }
writeFileSync(dir + 'c3d.bin', out.subarray(0, o));
console.log({ nV, nT, nJ, nF, laugh: FL.length, strike: FS.length, bytes: o, h: mx[1] - mn[1] });
