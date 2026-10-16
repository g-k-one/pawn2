// Заставка старта арены: ночной колизей, из-за стены встаёт Цезарь, хохочет и бьёт молниями из глаз в песок,
// гладиаторы со спины вздрагивают. node prep.mjs (фон, гладиаторы, кадры эффектов) → node gen.mjs → rive . --once
// Персонаж собран приёмами из разбора примеров (../refs/NOTES.md): части из Magnific на сетках по контуру (../lab/meshes.json),
// волосы и венок — отдельные части на цепочках костей, глаза в масках-глазницах (радужка за целью, веко внутри маски),
// мимика — смена нарисованных форм (рот, глаза-смех, злые брови), руки — смена целых поз под рукавом туники (нахлёст).
// Артборд 390×844, 60 к/с, 180 кадров. Порядок отрисовки в Rive: первый ребёнок — сверху.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { board, doc, el, stroke, fill, radial, poly, jag, rnd, reseed, ramp, smooth, mul, inv, ap } from '../lib.mjs';
const here = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const W = 390, H = 844, UP = -Math.PI / 2, DOWN = Math.PI / 2;

// ---------- ассеты: свои (prep.mjs) + части персонажа из лаборатории ----------
const P = JSON.parse(readFileSync(here + 'img/parts.json')), LP = JSON.parse(readFileSync(here + '../lab/img/parts.json')), MESH = JSON.parse(readFileSync(here + '../lab/meshes.json'));
const FROM_LAB = ['bald', 'hairCap', 'laurelL', 'laurelR', 'kitBrowNL', 'kitBrowNR', 'kitBrowAL', 'kitBrowAR', 'kitLidL', 'kitLidR', 'kitLaughL', 'kitLaughR',
  'kSmirk', 'kGrin', 'kHa', 'kRoar', 'poseHang', 'poseFist', 'poseStop', 'poseUp'];
for (const n of FROM_LAB){ copyFileSync(here + `../lab/img/${n}.webp`, here + `img/${n}.webp`); P[n] = LP[n]; }

const B = board({ name: 'Caesar', width: W, height: H, duration: 180, loop: 'oneShot', parts: P, bg: 'FF0A0816' });
const scene = B.node(B.root, 'Scene');
const flash = B.shape(scene, 'Flash', W / 2, H / 2, [el('Rectangle', { width: W + 80, height: H + 80, name: 'P' }), fill('FF9FC8FF')], { opacity: 0, blendModeValue: 'screen' });

// ---------- гладиаторы (спиной, впереди): сетка на 3 кости — ноги стоят, таз приседает, голова втягивается ----------
const GS = .4, glads = [];
for (const [name, gx] of [['gSword', 78], ['gSpear', 318]]){
  const g = B.node(scene, name + 'Rig', gx, H + 22, { scaleX: GS, scaleY: GS }), h = P[name].h;
  const feet = B.rootBone(g, 'Feet', g, 0, -h * .05, UP, 10), hip = B.rootBone(g, 'Hip', g, 0, -h * .42, UP, h * .3), hd = B.bone(hip, 'Head', UP, h * .2);
  B.skinned(g, name, 0, -h / 2, 1, 6, 10, (px, py) => { const up = smooth(ramp(py, -h * .1, -h * .42)), hh = smooth(ramp(py, -h * .66, -h * .8)); return [[feet, 1 - up], [hip, up * (1 - hh)], [hd, up * hh]]; });
  glads.push({ g, hip, hd });
}
const fx = B.node(scene, 'FX');                                       // искры, дуги, волна
const impacts = [B.solo(scene, 'ImpactL', 0, 0), B.solo(scene, 'ImpactR', 0, 0)];
const bolts = [B.solo(scene, 'BoltL', 0, 0), B.solo(scene, 'BoltR', 0, 0)];

// ---------- фон: стена (небо над ней прозрачное) поверх Цезаря, небо — в самом низу ----------
const sky = P.sky, wall = P.wall, WALL_Y = 468, wS = W / wall.w, wTop = WALL_Y - wall.h * .37 * wS, SAND_Y = wTop + wall.h * .7 * wS;
const wallIm = B.img(scene, 'wall', W / 2, wTop + wall.h * wS / 2, wS);

// ---------- Цезарь: единицы — пиксели туники ----------
const SC = .36, CY = 478;
const caesar = B.node(scene, 'Caesar', W / 2, CY, { scaleX: SC, scaleY: SC });
const spine = B.rootBone(caesar, 'Spine', caesar, 0, 300, UP, 330), chest = B.bone(spine, 'Chest', UP, 300);
const HS = 1.6, HY = -585;                                            // голова крупнее, как у Brawl Stars; шея заходит под подбородок
const head = B.node(caesar, 'Head', 0, HY, { scaleX: HS, scaleY: HS });  // единицы головы — px картинок ×0.6 (как в лаборатории)
const look = B.node(scene, 'Look', W / 2, 300);                       // цель взгляда
const feat = B.node(head, 'Features');
const hb = B.rootBone(head, 'H', head, 0, 0, UP, 120), jaw = B.rootBone(head, 'Jaw', head, 0, 90, DOWN, 60), turn = B.rootBone(head, 'Turn', head, 0, 30, UP, 30);
const strands = [[-88, -96, -2.0], [-44, -120, -1.8], [0, -128, UP], [44, -120, -1.34], [88, -96, -1.14], [-128, -40, 1.75], [128, -40, 1.39]].map(([x, y, a], i) => {
  const r = B.rootBone(head, 'Hair' + i, head, x, y, a, 34), c = B.bone(r, 'HairTip' + i, a + (i < 5 ? (x < 0 ? -.25 : x > 0 ? .25 : 0) : 0), 34); return [r, c]; });
const laurel = [[-1, -62, -112, 2.55], [1, 62, -112, .59]].map(([sg, x, y, a]) => { const r = B.rootBone(head, 'Laurel' + (sg < 0 ? 'L' : 'R'), head, x, y, a, 52), c = B.bone(r, 'LaurelTip' + (sg < 0 ? 'L' : 'R'), a + sg * -.55, 56); return [r, c]; });
const seg = b => { const M = mul(inv(B.world(head)), B.world(b)); return [ap(M, [0, 0]), ap(M, [b.a.length, 0])]; };
const dseg = (p, [a, e]) => { const vx = e[0] - a[0], vy = e[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy))); return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t); };
const near = (p, bones, sigma) => bones.map(b => [b, Math.exp(-(dseg(p, seg(b)) ** 2) / (2 * sigma * sigma))]);
// черты лица (координаты сняты с образца; рты крепятся верхом к линии под носом)
const MOUTHS = [['kSmirk', .68], ['kGrin', .6], ['kHa', .6], ['kRoar', .57]], MI = n => MOUTHS.findIndex(m => m[0] === n);
const mouth = B.solo(feat, 'Mouth', 0, 81); mouth.frames = MOUTHS.map(([n, s]) => B.img(mouth, n, 0, 0, s, { originY: 0 }));
const brows = [[-55, -17, 'L'], [55, -20, 'R']].map(([dx, dy, s]) => { const b = B.solo(feat, 'Brow' + s, dx, dy); b.frames = [B.img(b, 'kitBrowN' + s, 0, 0, .8), B.img(b, 'kitBrowA' + s, 0, 0, .74)]; return b; });
const EYES = [[-50, 16], [52, 16]];
const glows = EYES.map(([ex, ey], k) => B.img(feat, 'glow', ex, ey, .42, { opacity: 0, blendModeValue: 'additive', name: 'Glow' + k }));
const laughs = EYES.map(([ex, ey], k) => B.img(feat, 'kitLaugh' + (k ? 'R' : 'L'), ex, ey + 2, .62, { opacity: 0 }));
const eyes = EYES.map(([ex, ey], k) => {
  const socket = B.shape(feat, 'Socket' + k, ex, ey, [el('Ellipse', { width: 50, height: 25, name: 'P' })]);
  const g = B.node(feat, 'Eye' + k, ex, ey), lid = B.img(g, 'kitLid' + (k ? 'R' : 'L'), 0, -34, .74), iris = B.node(g, 'Iris' + k, 0, 1);
  B.shape(iris, 'Glint', -3, -3, [el('Ellipse', { width: 4, height: 4, name: 'P' }), fill('F0FFFFFF')]);
  const pupil = B.shape(iris, 'Pupil', 0, 0, [el('Ellipse', { width: 9, height: 9, name: 'P' }), fill('FF1A0E08')]);
  B.shape(iris, 'Ring', 0, 0, [el('Ellipse', { width: 21, height: 21, name: 'P' }), radial(10.5, [['FFB86A22', 0], ['FF8A4512', .7], ['FF3A1A08', 1]])]);
  const white = B.shape(g, 'White', 0, 0, [el('Ellipse', { width: 52, height: 27, name: 'P' }), radial(26, [['FFFFFFFF', 0], ['FFF1E8E4', .7], ['FFC9A9A0', 1]])]);
  for (const o of [lid, iris, white]) o.extra.push(el('ClippingShape', { sourceId: socket.id, name: 'Clip' }));
  B.O('TranslationConstraint', { targetId: look.id, strength: .05, name: 'LookAt' }, iris);
  B.O('DistanceConstraint', { targetId: g.id, distance: 9, modeValue: 0, name: 'Keep' }, iris);
  return { g, lid, iris, pupil }; });
B.O('TranslationConstraint', { targetId: look.id, strength: .02, name: 'Parallax' }, feat);
B.O('TranslationConstraint', { targetId: look.id, strength: .012, name: 'Parallax' }, turn);
B.meshSkin(head, 'laurelL', -92, -58, .86, MESH.laurelL, (px, py) => [...near([px, py], laurel[0], 30), [hb, .05]]);
B.meshSkin(head, 'laurelR', 92, -58, .86, MESH.laurelR, (px, py) => [...near([px, py], laurel[1], 30), [hb, .05]]);
B.meshSkin(head, 'hairCap', 0, -66, 1, MESH.hairCap, (px, py) => { const w2 = near([px, py], strands.flat(), 26).map(([b, v]) => [b, v * smooth(ramp(py, 0, -60))]), s2 = w2.reduce((a, [, v]) => a + v, 0); return [...w2, [hb, Math.max(.001, 1 - Math.min(1, s2))]]; });
B.meshSkin(head, 'bald', 0, 15, 1, MESH.bald, (px, py) => { const j = smooth(ramp(py, 70, 115)) * (1 - smooth(ramp(Math.abs(px), 70, 100))), r2 = (px / 110) ** 2 + ((py - 30) / 130) ** 2, t = Math.max(0, .7 * (1 - r2)) * (1 - j); return [[hb, Math.max(.001, 1 - j - t)], [jaw, j], [turn, t]]; });
// порядок в голове: венок, волосы, черты, основа
head.kids = [...head.kids.filter(o => /laurel|hairCap/.test(o.a.name || '')), feat, ...head.kids.filter(o => o !== feat && !/laurel|hairCap/.test(o.a.name || ''))];

// туника (дыхание) и кожа плеч под рукавами; руки — позы целиком, срез плеча под туникой
B.meshSkin(caesar, 'torso', 0, 0, 1, MESH.torso, (px, py) => { const t = smooth(ramp(py, 160, -140)); return [[spine, 1 - t], [chest, t]]; });
for (const [x, f] of [[-272, 1], [272, -1]]) B.shape(caesar, 'Shoulder', x, -150, [el('Ellipse', { width: 96, height: 230, name: 'P' }), radial(120, [['FFF6B98E', 0], ['FFE69A6C', .55], ['FFB8684A', 1]], { feather: 6 })], { scaleX: f });
const AK = 1.9, POSES = { poseHang: [110, 50, 0], poseFist: [248, 222, .55], poseStop: [262, 270, .25], poseUp: [25, 390, -.85] }, PN = Object.keys(POSES);
const arm = side => { const a = B.node(caesar, 'Arm' + (side > 0 ? 'R' : 'L'), side * -232, -136, { scaleX: side }), s = B.solo(a, 'Pose', 0, 0);
  s.frames = PN.map(n => { const [ax, ay, r] = POSES[n], pv = B.node(s, n, 0, 0, { rotation: r }); B.img(pv, n, (P[n].w / 2 - ax) * AK, (P[n].h / 2 - ay) * AK, AK); return pv; }); return { a, s, side }; };
const armR = arm(1), armL = arm(-1);
caesar.kids = [head, ...caesar.kids.filter(o => o !== head)];     // голова сверху; туника над плечами и руками
const skyIm = B.img(scene, 'sky', W / 2, H / 2, Math.max(W / sky.w, H / sky.h));

// ---------- молнии из глаз: кадры (Solo); голова в кадре удара почти в покое ----------
const Z = 112, HA = [50, 66, 82, 142, 158];
const eyeWorld = k => ap(B.world(eyes[k].g), [0, 0]);
const TG = [[W / 2 - 46, SAND_Y + 26], [W / 2 + 40, SAND_Y + 34]];
bolts.forEach((s, k) => { const [ex, ey] = eyeWorld(k), [tx, ty] = TG[k], L = Math.hypot(tx - ex, ty - ey);
  s.a.x = ex; s.a.y = ey; s.a.rotation = Math.atan2(ty - ey, tx - ex) - DOWN;
  const fr = P.bolt.frames, top = fr.reduce((a, f) => a + f.cy - f.h / 2, 0) / fr.length, bot = fr.reduce((a, f) => a + f.cy + f.h / 2, 0) / fr.length, kk = L / (bot - top), mx = fr.reduce((a, f) => a + f.cx, 0) / fr.length;
  s.frames = fr.map((f, i) => B.img(s, 'bolt' + i, (f.cx - mx) * kk * (k ? -1 : 1), (f.cy - top) * kk, kk, { scaleX: kk * (k ? -1 : 1), blendModeValue: 'additive' })); });
impacts.forEach((s, k) => { const [tx, ty] = TG[k], I = P.impact, kk = .72 * (k ? .9 : 1); s.a.x = tx; s.a.y = ty;
  s.frames = I.frames.map((f, i) => B.img(s, 'impact' + i, (f.cx - I.cell[0] / 2) * kk, -f.h / 2 * kk + 10, kk, { blendModeValue: 'additive' })); });
const BSEQ = [[0, 0], [2, 1], [4, 2], [6, 3], [9, 2], [11, 3], [13, 4], [16, 5], [18, 3], [20, 4], [23, 5], [26, 6], [29, 7], [32, -1]];
bolts.forEach((s, k) => B.soloK(s, BSEQ.map(([f, i]) => [Z + f + k, i])));
const ISEQ = [[1, 0], [3, 1], [6, 2], [9, 3], [13, 4], [17, 5], [21, 6], [26, 7], [31, -1]];
impacts.forEach((s, k) => B.soloK(s, ISEQ.map(([f, i]) => [Z + f + k, i])));
// частицы удара (рассчитаны заранее): искры по баллистике, электрические дуги, волна по песку
reseed(5);
for (const [X, Y] of TG){
  for (let i = 0; i < 40; i++){ const a = -Math.PI / 2 + (rnd() - .5) * 2.8, sp = 2.5 + rnd() ** 1.5 * 9, life = 10 + rnd() * 22 | 0, t0 = Z + 1 + (rnd() * 8 | 0), len = 6 + rnd() * 14, col = rnd() < .6 ? 'FF3D9BFF' : 'FF7FD8FF';
    const s = B.shape(fx, 'spark', X, Y, [poly([[0, -1.6], [-len, 0], [0, 1.6]], true), fill(col, { feather: 3 }), poly([[0, -.8], [-len * .5, 0], [0, .8]], true), fill('FFE8F8FF')], { opacity: 0, blendModeValue: 'additive' });
    const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp, xs = [], ys = [], rs = [], sc = [], op = [[0, 0, 'hold'], [t0, 1, 'hold']];
    for (let t = 0; t <= life; t += 3){ xs.push([t0 + t, X + vx * t, 'linear']); ys.push([t0 + t, Y + vy * t + .32 * t * t / 2, 'linear']); rs.push([t0 + t, Math.atan2(vy + .32 * t, vx), 'linear']); sc.push([t0 + t, 1 - t / life * .8, 1, 'linear']); if (t) op.push([t0 + t, (1 - t / life) * (rnd() < .3 ? .35 : 1), 'linear']); }
    op.push([t0 + life, 0, 'hold']); B.key(s, 'x', xs); B.key(s, 'y', ys); B.key(s, 'rotation', rs); B.key(s, 'opacity', op); B.sclK(s, sc); }
  for (let i = 0; i < 6; i++){ const a = -Math.PI * rnd(), r = 30 + rnd() * 45, pts = jag(X, Y, X + Math.cos(a) * r, Y + Math.sin(a) * r * .7, r * .6);
    const s = B.shape(fx, 'arc', 0, 0, [poly(pts), stroke(6, 'AA57B8FF', { feather: 4 }), stroke(1.8, 'FFFFFFFF')], { opacity: 0, blendModeValue: 'additive' }), t = Z + 2 + (rnd() * 20 | 0);
    B.key(s, 'opacity', [[0, 0, 'hold'], [t, 1, 'hold'], [t + 3, 0, 'hold'], [t + 9, .7, 'hold'], [t + 11, 0, 'hold']]); }
  const ring = B.shape(fx, 'ring', X, Y + 4, [el('Ellipse', { width: 80, height: 22, name: 'P' }), stroke(7, 'FFA8DCFF', { feather: 5 })], { opacity: 0, blendModeValue: 'additive' });
  B.key(ring, 'opacity', [[0, 0, 'hold'], [Z + 1, 1, 'out'], [Z + 24, 0]]); B.sclK(ring, [[Z + 1, .3, .3, 'expo'], [Z + 24, 3.2, 3.2]]);
}
// порядок сцены: вспышка, гладиаторы, частицы, удар, молнии, стена, Цезарь, небо (цель взгляда ничего не рисует)
scene.kids = [flash, ...glads.map(g => g.g), fx, ...impacts, ...bolts, wallIm, caesar, skyIm, look];

// =============== ХОРЕОГРАФИЯ ===============
B.key(caesar, 'y', [[0, CY + 560, 'back'], [38, CY, 'io'], [180, CY]]);
B.sclK(caesar, [[0, SC * 1.04, SC * .9, 'back'], [38, SC, SC, 'io']]);
// дыхание и вторичное движение весь ролик
const wave = (amp, ph, cyc) => Array.from({ length: 25 }, (_, i) => { const f = i * 180 / 24; return [f, amp * Math.sin(2 * Math.PI * cyc * f / 180 + ph), 'linear']; });
B.sclK(chest, Array.from({ length: 7 }, (_, i) => [i * 30, 1 + .025 * (i % 2), 1 + .012 * (i % 2), 'io']));
strands.forEach(([r, c], i) => { B.rotK(r, wave(.08, i * .8, 2)); B.rotK(c, wave(.14, i * .8 - .9, 2)); });
laurel.forEach(([r, c], k) => { B.rotK(r, wave(.06, k * 1.3, 2)); B.rotK(c, wave(.1, k * 1.3 - .8, 2)); });
// мимика: ухмылка → «хе» → ХА×3 (рот ха/улыбка, глаза-дуги, брови вверх) → замах (злые брови, глаза горят, взгляд вниз) → рёв на ударе → ХА×2
B.soloK(mouth, [[0, MI('kSmirk')], [44, MI('kGrin')], ...HA.filter(f => f < Z).flatMap(f => [[f, MI('kHa')], [f + 11, MI('kGrin')]]), [98, MI('kSmirk')], [Z - 2, MI('kRoar')], [136, MI('kGrin')],
  ...HA.filter(f => f > Z).flatMap(f => [[f, MI('kHa')], [f + 11, MI('kGrin')]]), [176, MI('kSmirk')]]);
const laughOn = [[0, 0, 'hold'], [HA[0], 1, 'hold'], [98, 0, 'hold'], [HA[3], 1, 'hold'], [174, 0, 'hold']];
for (const o of laughs) B.key(o, 'opacity', laughOn); for (const e of eyes) B.key(e.g, 'opacity', laughOn.map(([f, v]) => [f, 1 - v, 'hold']));
for (const b of brows){ B.soloK(b, [[0, 0], [98, 1], [138, 0]]);
  B.key(b, 'y', [[0, b.a.y, 'io'], [46, b.a.y - 4, 'io'], ...HA.filter(f => f < Z).flatMap(f => [[f, b.a.y - 14, 'out'], [f + 12, b.a.y - 8, 'io']]), [98, b.a.y + 4, 'snap'], [Z, b.a.y + 6, 'io'], [138, b.a.y - 6, 'io'],
    ...HA.filter(f => f > Z).flatMap(f => [[f, b.a.y - 14, 'out'], [f + 12, b.a.y - 8, 'io']]), [176, b.a.y, 'io']]); }
for (const e of eyes){ const y0 = e.lid.a.y; B.key(e.lid, 'y', [[0, y0, 'hold'], [26, y0, 'in'], [30, y0 + 26, 'out'], [35, y0, 'hold'], [100, y0, 'io'], [Z - 3, y0 + 8, 'snap'], [Z + 1, y0 - 2, 'out'], [136, y0, 'io']]);
  B.sclK(e.pupil, [[0, 1, 1, 'io'], [100, 1, 1, 'in'], [Z - 2, .55, .55, 'snap'], [Z + 18, .7, .7, 'io'], [140, 1, 1]]); }
for (const g of glows){ B.key(g, 'opacity', [[0, 0, 'hold'], [98, 0, 'in'], [Z - 2, .9, 'out'], [Z, 1, 'hold'], [Z + 26, 1, 'in'], [150, 0]]);
  B.sclK(g, [[98, .12, .12, 'in'], [Z - 2, .3, .3, 'snap'], [Z, .55, .55, 'out'], [Z + 4, .38, .38, 'hold'], [Z + 7, .5, .5, 'hold'], [Z + 10, .36, .36, 'hold'], [Z + 14, .45, .45, 'out'], [150, .2, .2]]); }
// взгляд: вперёд, в сторону на смехе → на замахе вниз, на гладиаторов → после удара снова вперёд
B.key(look, 'x', [[0, W / 2, 'io'], [70, W / 2 + 60, 'io'], [96, W / 2, 'io'], [Z, W / 2, 'io'], [150, W / 2 - 50, 'io'], [180, W / 2]]);
B.key(look, 'y', [[0, 300, 'io'], [100, 300, 'io'], [Z - 4, 760, 'snap'], [136, 760, 'io'], [150, 300, 'io']]);
// голова: «ха» — вверх и вытянуться, потом осесть; рёв — подалась вперёд (шире); подбородок — челюсть
const hsx = [[0, HS, 'io'], [44, HS, 'io']], hsy = [[0, HS, 'io'], [44, HS, 'io']], hr = [[0, 0, 'io']], hy = [[0, HY, 'io']], jw = [[0, 0, 'io'], [44, 4, 'io']];
HA.forEach((f, i) => { const s = i % 2 ? 1 : -1; hsx.push([f, HS * .95, 'out'], [f + 6, HS * 1.04, 'io'], [f + 14, HS, 'io']); hsy.push([f, HS * 1.06, 'out'], [f + 6, HS * .95, 'io'], [f + 14, HS, 'io']);
  hr.push([f, s * .05, 'out'], [f + 14, 0, 'io']); hy.push([f, HY - 22, 'out'], [f + 8, HY + 8, 'io'], [f + 16, HY, 'io']); jw.push([f, 16, 'out'], [f + 11, 6, 'io']); });
hsx.push([98, HS, 'io'], [Z - 3, HS * .97, 'snap'], [Z + 1, HS * 1.07, 'back'], [Z + 24, HS * 1.03, 'io'], [138, HS, 'io']); hsy.push([98, HS, 'io'], [Z - 3, HS * 1.03, 'snap'], [Z + 1, HS * .94, 'back'], [Z + 24, HS * .97, 'io'], [138, HS, 'io']);
hr.push([98, 0, 'io'], [Z, 0, 'io']); hy.push([98, HY, 'io'], [Z - 3, HY - 12, 'snap'], [Z + 2, HY + 14, 'out'], [Z + 24, HY, 'io']); jw.push([98, 0, 'io'], [Z - 3, 0, 'snap'], [Z, 24, 'out'], [Z + 22, 20, 'io'], [138, 4, 'io']);
B.key(head, 'scaleX', [...hsx, [176, HS, 'io']]); B.key(head, 'scaleY', [...hsy, [176, HS, 'io']]); B.key(head, 'rotation', [...hr, [176, 0, 'io']]); B.key(head, 'y', [...hy, [176, HY, 'io']]); B.mvK(jaw, [...jw, [176, 0, 'io']].map(([f, v, e]) => [f, 0, v, e]));
// руки: висят → кулаки вверх и трясут в такт → «стоп» на замахе → вверх на ударе → кулаки → опустить
const swaps = [[44, 1, -.35], [100, 2, .25], [Z, 3, -.3], [140, 1, .3], [176, 0, .2]];
for (const A of [armR, armL]){ B.soloK(A.s, [[0, 0], ...swaps.map(([f, i]) => [f, i])]);
  const rot = [[0, 0, 'io']], sx = [[0, 1, 'io']], sy = [[0, 1, 'io']];
  swaps.forEach(([f, , d]) => { rot.push([f - 6, -d * .4, 'in'], [f, d, 'out'], [f + 5, -d * .3, 'io'], [f + 12, 0, 'io']); sx.push([f - 2, 1, 'snap'], [f, 1.1, 'out'], [f + 6, .96, 'io'], [f + 12, 1, 'io']); sy.push([f - 2, 1, 'snap'], [f, .92, 'out'], [f + 6, 1.03, 'io'], [f + 12, 1, 'io']); });
  for (const f of HA) rot.push([f, -.1, 'out'], [f + 8, .06, 'io']);
  B.key(A.a, 'rotation', rot); B.key(A.a, 'scaleX', sx.map(([f, v, e]) => [f, v * A.side, e])); B.key(A.a, 'scaleY', sy); }
// вспышка, тряска, гладиаторы вздрагивают
B.key(flash, 'opacity', [[0, 0, 'hold'], [Z, .65, 'out'], [Z + 4, .15, 'hold'], [Z + 7, .4, 'out'], [Z + 22, 0]]);
const shake = [[0, 0, 'hold'], [Z - 1, 0, 'linear']]; for (let k = 0; k < 11; k++) shake.push([Z + 1 + k * 2, (k % 2 ? -1 : 1) * 9 * (1 - k / 11), 'linear']); shake.push([Z + 24, 0]);
B.key(scene, 'x', shake); B.key(scene, 'y', shake.map(([f, v, e]) => [f, -v * .7, e]));
glads.forEach(({ g, hip, hd }, k) => { const d = k ? 1 : -1, z = Z + 2 + k;
  B.mvK(hip, [[0, 0, 0, 'io'], [50 + k * 10, 0, -6, 'io'], [100, 0, 0, 'io'], [z, 0, 0, 'snap'], [z + 4, -d * 30, 70, 'out'], [z + 30, -d * 8, 16, 'io'], [180, 0, 0]]);
  B.key(g, 'x', [[z, g.a.x, 'snap'], [z + 5, g.a.x + d * 10, 'out'], [z + 34, g.a.x + d * 4, 'io'], [180, g.a.x]]);
  B.rotK(hip, [[0, 0, 'io'], [z, 0, 'snap'], [z + 4, d * .16, 'out'], [z + 28, d * .02, 'io'], [180, 0]]);
  B.rotK(hd, [[0, 0, 'io'], [z, 0, 'snap'], [z + 3, -d * .35, 'out'], [z + 30, -d * .05, 'io'], [180, 0]]); });

// машина состояний — SM, анимация — Intro (так их ищет src/app/16d-caesar.js)
writeFileSync(here + 'scene.rml', doc([B]).replace('name="Main"', 'name="Intro"'));
console.log('ok; глаза', [0, 1].map(k => eyeWorld(k).map(Math.round)).join(' '), 'песок', Math.round(SAND_Y));
