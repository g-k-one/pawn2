// Генератор скелетов Цезаря v2 (Spine 4.3 JSON): caesar.json (лицо по частям, сетки с весами), glads.json, bolt.json.
// Координаты: P — пиксели листа тела (parts-sheet), Fp — пиксели листа лица (face-sheet) → P. Скелет = P × K, origin — низ торса.
// node build-skeleton.mjs <папка вывода>
import { writeFileSync, readFileSync } from 'node:fs';
const OUT = process.argv[2] || 'C:/Users/gk_on/Desktop/pawn/assets/caesar/';
const K = .7, F = .45, O = [774, 980], FACE0 = [338, 528], FACE_AT = [774, 284];
const S = ([x, y]) => [+((x - O[0]) * K).toFixed(2), +((O[1] - y) * K).toFixed(2)];
const Fp = ([x, y]) => [FACE_AT[0] + (x - FACE0[0]) * F, FACE_AT[1] + (y - FACE0[1]) * F];
const SF = f => S(Fp(f)), fsz = ([w, h]) => [+(w * F * K).toFixed(1), +(h * F * K).toFixed(1)], bsz = ([w, h]) => [+(w * K).toFixed(1), +(h * K).toFixed(1)];
const ORIG = { head: [596, 531], jaw: [350, 235], lipUp: [305, 109], wreathL: [292, 253], wreathR: [289, 253], lidL: [172, 95], lidR: [173, 95], browL: [189, 89], browR: [189, 89],
  eyeL: [151, 93], eyeR: [153, 93], mouthIn: [275, 157], cheek: [560, 330], torso: [634, 610], armL: [413, 497], armR: [412, 495] };
// кости: имя, родитель, мировая позиция в установочной позе (поворотов нет — локальное = разность)
const BW = { root: [0, 0], body: [0, 0], chest: S([774, 600]), neck: S([774, 420]), head: SF(FACE0), face: SF(FACE0), jaw: SF([338, 470]),
  browL: SF([218, 255]), browR: SF([458, 255]), lidL: SF([223, 300]), lidR: SF([453, 300]), wreath: SF([338, 140]), armL: S([540, 500]), armR: S([1010, 500]) };
const PARENT = { body: 'root', chest: 'body', neck: 'chest', head: 'neck', face: 'head', jaw: 'face', browL: 'face', browR: 'face', lidL: 'face', lidR: 'face', wreath: 'head', armL: 'chest', armR: 'chest' };
const bones = Object.keys(BW).map(n => n === 'root' ? { name: n } : { name: n, parent: PARENT[n], x: +(BW[n][0] - BW[PARENT[n]][0]).toFixed(2), y: +(BW[n][1] - BW[PARENT[n]][1]).toFixed(2) });
const BI = Object.fromEntries(bones.map((b, i) => [b.name, i]));
const rel = (c, bone) => [+(c[0] - BW[bone][0]).toFixed(2), +(c[1] - BW[bone][1]).toFixed(2)];
const region = (name, c, size, bone) => { const [x, y] = rel(c, bone); return { [name]: { x, y, width: size[0], height: size[1] } }; };
const sm = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
// сетка: прямоугольная решётка cols×rows, веса — функция (u, v) → [[кость, вес]…]
function mesh(name, c, size, cols, rows, wf){
  const uvs = [], verts = [], tris = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++){
    const u = i / cols, v = j / rows, wx = c[0] + (u - .5) * size[0], wy = c[1] + (.5 - v) * size[1], ws = wf(u, v).filter(([, w]) => w > 1e-3), sum = ws.reduce((s, [, w]) => s + w, 0);
    uvs.push(u, v); verts.push(ws.length); for (const [bn, w] of ws){ const [lx, ly] = rel([wx, wy], bn); verts.push(BI[bn], lx, ly, +(w / sum).toFixed(4)); } }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++){ const a = j * (cols + 1) + i, b = a + 1, d = a + cols + 1, e = d + 1; tris.push(a, d, b, b, d, e); }
  return { [name]: { type: 'mesh', uvs, triangles: tris, vertices: verts, hull: 0, width: size[0], height: size[1] } };
}
const slots = [
  ['armL', 'armL'], ['armR', 'armR'], ['torso', 'body'], ['cheek', 'head'], ['head', 'head'], ['mouthIn', 'head'], ['jaw', 'jaw'], ['lipUp', 'face'],
  ['eyeL', 'face'], ['eyeR', 'face'], ['glowL', 'face', 'glow', 'additive'], ['glowR', 'face', 'glow', 'additive'],
  ['lidL', 'lidL'], ['lidR', 'lidR'], ['browL', 'browL'], ['browR', 'browR'], ['wreathL', 'wreath'], ['wreathR', 'wreath'],
].map(([name, bone, att = name, blend]) => ({ name, bone, attachment: att, ...(blend ? { blend } : {}) }));
const torsoC = S([774, 675]);
const A = {
  armL: region('armL', S([380.5, 577.5]), bsz(ORIG.armL), 'armL'), armR: region('armR', S([1176, 578.5]), bsz(ORIG.armR), 'armR'),
  // торс гнётся: низ — на body, грудь и плечи — на chest (дыхание, тряска от смеха)
  torso: mesh('torso', torsoC, bsz(ORIG.torso), 4, 6, (u, v) => { const w = sm(.85, .35, v); return [['chest', w], ['body', 1 - w]]; }),
  // щёки и рот тянутся между головой и челюстью — без щелей
  cheek: mesh('cheek', SF([338, 665]), fsz(ORIG.cheek), 4, 6, (u, v) => { const w = sm(.12, .6, v); return [['jaw', w], ['head', 1 - w]]; }),
  head: region('head', SF([338, 271.5]), fsz(ORIG.head), 'head'),
  mouthIn: mesh('mouthIn', SF([338, 625]), fsz(ORIG.mouthIn), 3, 4, (u, v) => { const w = sm(.3, .7, v); return [['jaw', w], ['face', 1 - w]]; }),
  jaw: region('jaw', SF([338, 737]), fsz(ORIG.jaw), 'jaw'), lipUp: region('lipUp', SF([338, 580]), fsz(ORIG.lipUp), 'face'),
  eyeL: region('eyeL', SF([223, 374]), fsz([143, 88]), 'face'), eyeR: region('eyeR', SF([453, 374]), fsz([145, 88]), 'face'),
  glowL: region('glow', SF([223, 374]), [60, 60], 'face'), glowR: region('glow', SF([453, 374]), [60, 60], 'face'),
  lidL: region('lidL', SF([223, 300]), fsz(ORIG.lidL), 'lidL'), lidR: region('lidR', SF([453, 300]), fsz(ORIG.lidR), 'lidR'),
  browL: region('browL', SF([218, 255]), fsz(ORIG.browL), 'browL'), browR: region('browR', SF([458, 255]), fsz(ORIG.browR), 'browR'),
  wreathL: region('wreathL', SF([193, 140]), fsz(ORIG.wreathL), 'wreath'), wreathR: region('wreathR', SF([483, 140]), fsz(ORIG.wreathR), 'wreath'),
};
const U = F * K;                       // 1 px листа лица в единицах скелета
const glowC = c => [{ color: c }];
const anim = {};
// покой: дыхание, лицо чуть «поворачивается» (лицо сдвигается сильнее головы — объём), моргание
anim.idle = { bones: {
    chest: { scale: [{}, { time: 1.2, y: 1.012 }, { time: 2.4 }] },
    head: { rotate: [{}, { time: 1.2, value: -1.2 }, { time: 2.4 }] },
    face: { translate: [{}, { time: 1.2, x: 1.6 }, { time: 2.4 }] }, wreath: { translate: [{}, { time: 1.2, x: -.8 }, { time: 2.4 }] },
    browL: { translate: [{}, { time: 1.2, y: 1 }, { time: 2.4 }] }, browR: { translate: [{}, { time: 1.2, y: 1 }, { time: 2.4 }] },
    lidL: { translate: [{}, { time: 1.9 }, { time: 1.97, y: -46 * U }, { time: 2.06 }] }, lidR: { translate: [{}, { time: 1.9 }, { time: 1.97, y: -46 * U }, { time: 2.06 }] },
    armL: { rotate: [{}, { time: 1.2, value: 1.5 }, { time: 2.4 }] }, armR: { rotate: [{}, { time: 1.2, value: -1.5 }, { time: 2.4 }] },
  }, slots: { glowL: { rgba: [{ color: 'ffffff88' }, { time: 1.2, color: 'ffffffcc' }, { time: 2.4, color: 'ffffff88' }] }, glowR: { rgba: [{ color: 'ffffff88' }, { time: 1.2, color: 'ffffffcc' }, { time: 2.4, color: 'ffffff88' }] } } };
// смех: 4 «ха» по 0.3 с — рот раскрывается (щёки тянутся), голова подпрыгивает, глаза щурятся, брови вверх, плечи трясутся
{ const T = .3, n = 4, k = { jaw: [], head: [], hr: [], chest: [], aL: [], aR: [], lid: [], brow: [] }, ev = [];
  for (let i = 0; i <= n; i++){ const t = i * T, m = t + T * .38, end = i === n;
    const add = (key, a, b) => { k[key].push([t, a]); if (!end) k[key].push([m, b]); };
    add('jaw', -6 * U, -40 * U); add('head', 0, 4); add('hr', 0, i % 2 ? 1.6 : -1.6); add('chest', 1, 1.025); add('aL', 0, 4); add('aR', 0, -4); add('lid', -10 * U, -18 * U); add('brow', 3, 6);
    if (!end) ev.push({ time: +t.toFixed(3), name: 'ha' }); }
  const tr = (arr, axis) => arr.map(([t, v]) => (t ? { time: +t.toFixed(3), [axis]: +v.toFixed(2) } : { [axis]: +v.toFixed(2) }));
  anim.laugh = { bones: {
      jaw: { translate: tr(k.jaw, 'y') }, head: { translate: tr(k.head, 'y'), rotate: tr(k.hr, 'value') }, chest: { scale: tr(k.chest, 'y') },
      armL: { rotate: tr(k.aL, 'value') }, armR: { rotate: tr(k.aR, 'value') }, lidL: { translate: tr(k.lid, 'y') }, lidR: { translate: tr(k.lid, 'y') },
      browL: { translate: tr(k.brow, 'y') }, browR: { translate: tr(k.brow, 'y') } },
    slots: { glowL: { rgba: glowC('ffffffcc') }, glowR: { rgba: glowC('ffffffcc') } }, events: ev }; }
// разряд: брови сдвинуты (злость), глаза распахнуты и вспыхивают, рот настежь, голова назад; zap — момент удара
anim.zap = { bones: {
    head: { rotate: [{}, { time: .16, value: 3 }, { time: .3, value: -1.5 }, { time: .8 }], translate: [{}, { time: .16, y: 6 }, { time: .3, y: -2 }, { time: .8 }] },
    jaw: { translate: [{ y: -6 * U }, { time: .16, y: -52 * U }, { time: .55, y: -46 * U }, { time: .8, y: -8 * U }] },
    browL: { rotate: [{}, { time: .12, value: -14 }, { time: .6, value: -12 }, { time: .8 }], translate: [{}, { time: .12, y: -4 }, { time: .8 }] },
    browR: { rotate: [{}, { time: .12, value: 14 }, { time: .6, value: 12 }, { time: .8 }], translate: [{}, { time: .12, y: -4 }, { time: .8 }] },
    lidL: { translate: [{ y: -10 * U }, { time: .12, y: 6 }, { time: .6, y: 5 }, { time: .8 }] }, lidR: { translate: [{ y: -10 * U }, { time: .12, y: 6 }, { time: .6, y: 5 }, { time: .8 }] },
    chest: { scale: [{}, { time: .16, x: 1.02, y: 1.035 }, { time: .3, x: .99, y: .99 }, { time: .8 }] },
    armL: { rotate: [{}, { time: .16, value: 9 }, { time: .8 }] }, armR: { rotate: [{}, { time: .16, value: -9 }, { time: .8 }] },
  }, slots: {
    glowL: { rgba: [{ color: 'ffffffcc' }, { time: .14, color: 'ffffffff' }, { time: .8, color: 'ffffffcc' }] }, glowR: { rgba: [{ color: 'ffffffcc' }, { time: .14, color: 'ffffffff' }, { time: .8, color: 'ffffffcc' }] },
  }, events: [{ time: .2, name: 'zap' }] };
const caesar = { skeleton: { spine: '4.3.13', images: './images/' }, bones, slots, skins: [{ name: 'default', attachments: A }], events: { ha: {}, zap: {} }, animations: anim };
// молния: 6 рисованных кадров (последовательность), вспышка additive; кость смотрит вниз — код поворачивает её на цель и тянет по длине
const bolt = { skeleton: { spine: '4.3.13', images: './images/' }, bones: [{ name: 'root' }],
  slots: [{ name: 'bolt', bone: 'root', attachment: 'bolt', blend: 'additive' }],
  skins: [{ name: 'default', attachments: { bolt: { bolt: { x: 0, y: -180, width: 128, height: 432, sequence: { count: 6, start: 1, digits: 1 } } } } }],
  animations: { strike: { slots: { bolt: { rgba: [{ color: 'ffffffff' }, { time: .22, color: 'ffffffff' }, { time: .4, color: 'ffffff00' }] } },
    attachments: { default: { bolt: { bolt: { sequence: [{ mode: 'once', delay: .065 }] } } } } } } };
const glads = JSON.parse(readFileSync(OUT + 'glads.json', 'utf8'));
for (const [f, j] of [['caesar.json', caesar], ['bolt.json', bolt], ['glads.json', glads]]) writeFileSync(OUT + f, JSON.stringify(j));
console.log('ok', bones.length, 'bones', slots.length, 'slots');
