// Тестовые сцены Rive (лаборатория анимации): node prep.mjs → node gen.mjs → rive . --once → build/lab.riv
// Артборды: Body (рука — смена поз под рукавом), FaceKit (лицо из частей), Cloth (ткань), BoltVector, BoltFrames, BoltJitter.
import { readFileSync, writeFileSync } from 'node:fs';
import { board, doc, id, el, poly, stroke, fill, radial, solid, jag, rnd, reseed, ramp, smooth, mul, inv, ap } from '../lib.mjs';
const P = JSON.parse(readFileSync(new URL('./img/parts.json', import.meta.url)));
const W = 360, H = 360, DOWN = Math.PI / 2;
const boards = [];
const mk = (name, duration, bg) => { const B = board({ name, width: W, height: H, duration, parts: P, bg }); B.x = boards.length * (W + 40); B.y = 0; boards.push(B); return B; };

// =============== 1. Полфигуры: рука — смена целых нарисованных поз, срез плеча спрятан под рукав (нахлёст) ===============
// Позы — правая рука персонажа (слева на экране), левая — та же картинка зеркально. Точка плеча на каждой позе снята по сетке.
// В проёме рукава — «плечо» (кожа с объёмом), чтобы при поднятой руке проём не был пустым.
{ const B = mk('Body', 240, 'FF1A1430');
  const RS = .26, rig = B.node(B.root, 'Rig', 237, 265, { scaleX: RS, scaleY: RS });   // единицы — пиксели туники
  const AK = 2.2, JX = -232, JY = -136;                                                // масштаб рук, сустав плеча под рукавом
  // точка среза у каждой позы и поворот позы вокруг плеча (поднятую руку отводим от головы)
  const POSES = { poseHang: [110, 50, 0], poseFist: [248, 222, 0], poseStop: [262, 270, 0], poseUp: [25, 390, -.42] };
  const head = B.node(rig, 'Head', 0, -345 + 70);
  B.img(head, 'kitRef', 0, -P.kitRef.h * 1.35 / 2, 1.35);
  B.img(rig, 'torso', 0, 0, 1);
  const deltoid = (x, flip) => B.shape(rig, 'Shoulder', x, -150, [el('Ellipse', { width: 96, height: 230, name: 'P' }),
    radial(120, [['FFF6B98E', 0], ['FFE69A6C', .55], ['FFB8684A', 1]], { feather: 6 })], { scaleX: flip });
  deltoid(-272, 1); deltoid(272, -1);
  const pose = (parent, name) => { const [ax, ay, r] = POSES[name], n = B.node(parent, name + 'Pivot', 0, 0, { rotation: r });
    B.img(n, name, (P[name].w / 2 - ax) * AK, (P[name].h / 2 - ay) * AK, AK); return n; };
  const armR = B.node(rig, 'ArmR', JX, JY), soloR = B.solo(armR, 'PoseR', 0, 0);
  soloR.frames = Object.keys(POSES).map(n => pose(soloR, n));
  const armL = B.node(rig, 'ArmL', -JX + 4, JY + 6, { scaleX: -1 }); pose(armL, 'poseHang');
  // смена позы — в момент быстрого движения: замах в сторону новой позы, подмена, проскок и сжатие, успокоение
  const swaps = [[44, 1, -.35], [112, 2, .25], [170, 3, -.3], [216, 0, .3]];
  B.soloK(soloR, [[0, 0], ...swaps.map(([f, i]) => [f, i])]);
  const rot = [[0, 0, 'io']], sx = [[0, 1, 'io']], sy = [[0, 1, 'io']];
  swaps.forEach(([f, , d]) => { rot.push([f - 6, -d * .4, 'in'], [f, d, 'out'], [f + 5, -d * .3, 'io'], [f + 12, 0, 'io']);
    sx.push([f - 2, 1, 'snap'], [f, 1.12, 'out'], [f + 6, .95, 'io'], [f + 12, 1, 'io']); sy.push([f - 2, 1, 'snap'], [f, .9, 'out'], [f + 6, 1.04, 'io'], [f + 12, 1, 'io']); });
  for (let k = 0; k < 6; k++) rot.push([60 + k * 7, (k % 2 ? 1 : -1) * .06, 'io']);   // трясёт кулаком
  B.key(armR, 'rotation', rot); B.key(armR, 'scaleX', sx); B.key(armR, 'scaleY', sy);
  B.key(armL, 'rotation', [[0, 0, 'io'], [60, .04, 'io'], [120, -.03, 'io'], [180, .03, 'io'], [240, 0]]);
  B.key(head, 'rotation', [[0, 0, 'io'], [44, -.04, 'back'], [100, .03, 'io'], [112, .05, 'back'], [170, -.06, 'back'], [216, 0, 'io']]);
  B.key(rig, 'y', [[0, 265, 'io'], [60, 262, 'io'], [120, 266, 'io'], [180, 262, 'io'], [240, 265]]);
}

// =============== 2. Лицо: основа на сетке (челюсть, поворот) + брови, глаза в маске-глазнице, веки, рты ===============
// Места и размеры черт сняты с собранного образца по сетке; рты крепятся ВЕРХОМ к линии под носом и раскрываются вниз,
// у каждого рта свой масштаб; большой рот опускает подбородок (кость челюсти гнёт сетку основы).
// Псевдо-3D поворот: середина лица сдвигается сильнее контура, черты — ещё сильнее (параллакс).
{ const B = mk('FaceKit', 300, 'FF1A1430');
  const HS = .92, neck = B.node(B.root, 'Neck', 180, 352, { scaleX: HS, scaleY: HS }), head = B.node(neck, 'Head', 0, 0);
  const CY = -P.kitBase.h / 2, at = (dx, dy) => [dx, CY + dy];          // от центра головы, px картинок
  const UP = -Math.PI / 2;
  const hb = B.rootBone(head, 'H', head, 0, CY, UP, 100), jaw = B.rootBone(head, 'Jaw', head, 0, CY + 84, Math.PI / 2, 60), turn = B.rootBone(head, 'Turn', head, 0, CY + 20, UP, 30);
  const feat = B.node(head, 'Features', 0, 0);
  // рты: верх — на линии +81, масштаб — по ширине рта на лице
  const MOUTHS = [['kSmirk', .68], ['kGrin', .6], ['kHa', .6], ['kRoar', .57], ['kO', .57]];
  const mouth = B.solo(feat, 'Mouth', ...at(0, 81)); mouth.frames = MOUTHS.map(([n, s]) => B.img(mouth, n, 0, 0, s, { originY: 0 }));
  const brows = [[-55, -17, 'L'], [55, -20, 'R']].map(([dx, dy, s]) => { const b = B.solo(feat, 'Brow' + s, ...at(dx, dy));
    b.frames = [B.img(b, 'kitBrowN' + s, 0, 0, .8), B.img(b, 'kitBrowA' + s, 0, 0, .74)]; return b; });
  const eyes = [[-50, 16, 'L'], [52, 16, 'R']].map(([dx, dy, s]) => {
    const lid = B.img(feat, 'kitLid' + s, ...at(dx, dy - 9), .7, { opacity: 0 });
    const e = B.solo(feat, 'Eye' + s, ...at(dx, dy));
    // глазница-маска: глаз двигается внутри (взгляд), край белка не вылезает на кожу
    const socket = B.shape(feat, 'Socket' + s, ...at(dx, dy), [el('Ellipse', { width: 52, height: 26, name: 'P' })]);
    const wrap = B.node(e, 'Look' + s), ball = B.img(wrap, 'kitEye' + s, 0, 0, .56);
    ball.extra.push(el('ClippingShape', { sourceId: socket.id, name: 'Clip' }));
    e.frames = [wrap, B.img(e, 'kitLaugh' + s, 0, 2, .62)]; e.lid = lid; e.ball = ball; return e; });
  const base = B.skinned(head, 'kitBase', 0, CY, 1, 10, 12, (px, py) => {
    const dy = py - CY, dx = px;
    const side = 1 - smooth(ramp(Math.abs(dx), 70, 105));
    const j = smooth(ramp(dy, 78, 118)) * side;                                   // подбородок — к челюсти
    const r2 = (dx / 120) ** 2 + ((dy - 20) / 150) ** 2, t = Math.max(0, .7 * (1 - r2)) * (1 - j);   // середина лица — к «повороту»
    return [[hb, Math.max(0, 1 - j - t)], [jaw, j], [turn, t]]; });
  // сценарий (кадры): ухмылка, взгляд влево-вправо с поворотом → моргнул → ХА-ХА → злость, рёв → удивление → ухмылка
  const HA = [86, 104, 122, 140, 158], RO = 196, SH = 244;
  const M = n => MOUTHS.findIndex(m => m[0] === n);
  B.soloK(mouth, [[0, M('kSmirk')], [72, M('kGrin')], ...HA.flatMap(f => [[f, M('kHa')], [f + 11, M('kGrin')]]), [180, M('kGrin')], [RO, M('kRoar')], [SH, M('kO')], [280, M('kSmirk')]]);
  // челюсть: смех — 14, рёв — 24, «о» — 10 (px картинки)
  const jd = [[0, 0, 'io'], [72, 4, 'io']]; HA.forEach(f => jd.push([f, 16, 'out'], [f + 11, 6, 'io'])); jd.push([180, 4, 'io'], [RO, 26, 'back'], [236, 22, 'io'], [SH, 12, 'back'], [276, 10, 'io'], [284, 0, 'io']);
  B.mvK(jaw, jd.map(([f, v, e]) => [f, 0, v, e]));
  // поворот головы: черты сдвигаются на 14 px, середина лица — на 8, контур стоит
  const tn = [[0, 0, 'io'], [16, -1, 'io'], [40, -1, 'io'], [52, 1, 'io'], [70, 1, 'io'], [80, 0, 'io'], [RO, 0, 'io'], [RO + 6, .3, 'io'], [236, .3, 'io'], [SH, 0, 'io']];
  B.key(feat, 'x', tn.map(([f, v, e]) => [f, v * 14, e])); B.mvK(turn, tn.map(([f, v, e]) => [f, v * 8, 0, e]));
  B.key(head, 'rotation', tn.map(([f, v, e]) => [f, v * .03, e]));
  // взгляд: глаз внутри глазницы опережает поворот головы
  for (const e of eyes) B.key(e.ball, 'x', [[0, 0, 'io'], [10, -5, 'out'], [40, -5, 'io'], [48, 5, 'out'], [70, 5, 'io'], [80, 0, 'io'], [RO, 0, 'io'], [RO + 4, 2, 'io'], [SH, 0, 'io']]);
  for (const b of brows){ B.soloK(b, [[0, 0], [180, 1], [SH, 0]]);
    B.key(b, 'y', [[0, b.a.y, 'io'], [82, b.a.y - 10, 'back'], [176, b.a.y - 7, 'io'], [182, b.a.y + 5, 'snap'], [240, b.a.y + 4, 'io'], [SH, b.a.y - 20, 'back'], [280, b.a.y, 'io']]); }
  for (const e of eyes){ B.soloK(e, [[0, 0], [86, 1], [176, 0]]);
    const ly = e.lid.a.y;
    B.key(e.lid, 'opacity', [[0, 0, 'hold'], [60, 1, 'hold'], [65, 0, 'hold'], [180, 1, 'hold'], [SH, 0, 'hold'], [286, 1, 'hold'], [290, 0, 'hold']]);
    B.key(e.lid, 'y', [[0, ly, 'hold'], [60, ly + 8, 'hold'], [65, ly, 'hold'], [180, ly + 2, 'hold'], [286, ly + 8, 'hold'], [290, ly, 'hold']]);
    B.sclK(e, [[0, 1, 1, 'io'], [240, 1, 1, 'io'], [SH, 1.15, 1.15, 'back'], [276, 1.1, 1.1, 'io'], [284, 1, 1]]); }
  const sx = [[0, 1, 'io'], [72, 1, 'io']], sy = [[0, 1, 'io'], [72, 1, 'io']], rot = [], y = [[0, 0, 'io']];
  HA.forEach((f, i) => { sx.push([f, .96, 'out'], [f + 6, 1.04, 'io'], [f + 14, .99, 'io']); sy.push([f, 1.05, 'out'], [f + 6, .95, 'io'], [f + 14, 1.01, 'io']);
    y.push([f, -8, 'out'], [f + 8, 3, 'io'], [f + 16, 0, 'io']); });
  sx.push([180, 1, 'io'], [RO, 1.06, 'back'], [236, 1.04, 'io'], [SH, .95, 'back'], [280, 1, 'io']); sy.push([180, 1, 'io'], [RO, .95, 'back'], [236, .97, 'io'], [SH, 1.06, 'back'], [280, 1, 'io']);
  for (let k = 0; k < 12; k++) rot.push([RO + 2 + k * 3, (k % 2 ? 1 : -1) * .02, 'linear']);
  B.key(neck, 'scaleX', sx.map(([f, v, e]) => [f, v * HS, e])); B.key(neck, 'scaleY', sy.map(([f, v, e]) => [f, v * HS, e])); B.key(neck, 'rotation', [[0, 0, 'io'], ...rot, [RO + 40, 0, 'io']]); B.key(head, 'y', y);
}

// =============== 2б. Ткань: туника на сетке, точки подола гуляют волной (сверху вниз — с запаздыванием) ===============
{ const B = mk('Cloth', 240, 'FF1A1430');
  const im = B.meshed(B.root, 'torso', 180, 170, .5, 10, 14);
  const STEP = 6, T = 240;
  for (const p of im.verts){
    const amp = smooth(ramp(p.v, .3, 1)) * (16 + 22 * p.v), xs = [], ys = [];
    for (let f = 0; f <= T; f += STEP){
      const ph = 2 * Math.PI * (f / 80) - p.v * 3.2 + p.u * 1.4, gust = .75 + .25 * Math.sin(2 * Math.PI * f / T * 3);   // ровно 3 и 1 период за цикл
      xs.push([f, p.x + amp * gust * Math.sin(ph) + amp * .25 * Math.sin(2.3 * ph), 'linear']);
      ys.push([f, p.y + amp * .22 * Math.cos(ph + p.u), 'linear']); }
    B.key(p.id, 'x', xs); B.key(p.id, 'y', ys); }
}

// =============== 2в. Голова по приёмам Wukong: сетки по контуру, глаза в масках, волосы и венок на цепочках, дыхание ===============
// Части — лист «лысая основа / шапка волос / венок двумя половинами» (одного масштаба) + черты лица из набора (kit*).
// Сетки — tools/meshgen.mjs (meshes.json): точки по силуэту и внутри, триангуляция Делоне.
{ const MESH = JSON.parse(readFileSync(new URL('./meshes.json', import.meta.url)));
  const B = mk('Head', 360, 'FF1A1430');
  const UP = -Math.PI / 2;
  // туловище с дыханием: позвоночник + грудь, сетка по контуру
  const body = B.node(B.root, 'Body', 180, 400, { scaleX: .44, scaleY: .44 });   // шея заходит под подбородок (нахлёст)
  const spine = B.rootBone(body, 'Spine', body, 0, 300, UP, 330), chestB = B.bone(spine, 'Chest', UP, 300);
  const head = B.node(B.root, 'Head', 180, 150, { scaleX: .6, scaleY: .6 });                  // единицы — px картинок ×0.6
  const look = B.node(B.root, 'Look', 180, 150);                                                // цель взгляда
  const feat = B.node(head, 'Features', 0, 0);
  const hb = B.rootBone(head, 'H', head, 0, 0, UP, 120), jaw = B.rootBone(head, 'Jaw', head, 0, 90, Math.PI / 2, 60), turn = B.rootBone(head, 'Turn', head, 0, 30, UP, 30);
  // пряди: 5 цепочек над лбом (вверх) и 2 по бокам (вниз), по 2 кости
  const strands = [[-88, -96, -2.0], [-44, -120, -1.8], [0, -128, UP], [44, -120, -1.34], [88, -96, -1.14], [-128, -40, 1.75], [128, -40, 1.39]].map(([x, y, a], i) => {
    const r = B.rootBone(head, 'Hair' + i, head, x, y, a, 34), c = B.bone(r, 'HairTip' + i, a + (i < 5 ? (x < 0 ? -.25 : x > 0 ? .25 : 0) : 0), 34); return [r, c]; });
  // венок: две цепочки от темени вниз по бокам
  const laurel = [[-1, -62, -112, 2.55], [1, 62, -112, .59]].map(([sg, x, y, a]) => { const r = B.rootBone(head, 'Laurel' + (sg < 0 ? 'L' : 'R'), head, x, y, a, 52), c = B.bone(r, 'LaurelTip' + (sg < 0 ? 'L' : 'R'), a + sg * -.55, 56); return [r, c]; });
  // расстояние от точки до отрезка кости (в координатах головы)
  const seg = b => { const W = mul(inv(B.world(head)), B.world(b)); return [ap(W, [0, 0]), ap(W, [b.a.length, 0])]; };
  const dseg = (p, [a, e]) => { const vx = e[0] - a[0], vy = e[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy))); return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t); };
  const near = (p, bones, sigma) => bones.map(b => [b, Math.exp(-(dseg(p, seg(b)) ** 2) / (2 * sigma * sigma))]);
  // лицо: подбородок — к челюсти, середина — к «повороту» (параллакс), остальное — к голове
  const faceW = (px, py) => { const j = smooth(ramp(py, 70, 115)) * (1 - smooth(ramp(Math.abs(px), 70, 100))); const r2 = (px / 110) ** 2 + ((py - 30) / 130) ** 2, t = Math.max(0, .7 * (1 - r2)) * (1 - j);
    return [[hb, Math.max(.001, 1 - j - t)], [jaw, j], [turn, t]]; };
  // черты: верх рта — на линии +81 от центра старой основы; новая основа (лысая) — на +15 ниже её центра (сверка по носу и ушам)
  const BALD_Y = 15;
  const mouth = B.solo(feat, 'Mouth', 0, 81); mouth.frames = [['kSmirk', .68], ['kGrin', .6], ['kHa', .6]].map(([n, s]) => B.img(mouth, n, 0, 0, s, { originY: 0 }));
  const brows = [[-55, -17, 'L'], [55, -20, 'R']].map(([dx, dy, s]) => B.img(feat, 'kitBrowN' + s, dx, dy, .8));
  const eyes = [[-50, 16], [52, 16]].map(([ex, ey], k) => {
    // глазница-маска: белок, радужка со зрачком (за целью), веко ездит внутри маски
    const socket = B.shape(feat, 'Socket' + k, ex, ey, [el('Ellipse', { width: 50, height: 25, name: 'P' })]);
    const g = B.node(feat, 'Eye' + k, ex, ey);
    const lid = B.img(g, 'kitLid' + (k ? 'R' : 'L'), 0, -34, .74);   // в покое веко над глазницей, видна только линия ресниц
    const iris = B.node(g, 'Iris' + k, 0, 1);
    B.shape(iris, 'Glint', -3, -3, [el('Ellipse', { width: 4, height: 4, name: 'P' }), fill('F0FFFFFF')]);
    B.shape(iris, 'Pupil', 0, 0, [el('Ellipse', { width: 9, height: 9, name: 'P' }), fill('FF1A0E08')]);
    B.shape(iris, 'Ring', 0, 0, [el('Ellipse', { width: 21, height: 21, name: 'P' }), radial(10.5, [['FFB86A22', 0], ['FF8A4512', .7], ['FF3A1A08', 1]])]);
    B.shape(g, 'White', 0, 0, [el('Ellipse', { width: 52, height: 27, name: 'P' }), radial(26, [['FFFFFFFF', 0], ['FFF1E8E4', .7], ['FFC9A9A0', 1]])]);
    for (const o of [lid, iris, g.kids.find(x => x.a.name === 'White')]) o.extra.push(el('ClippingShape', { sourceId: socket.id, name: 'Clip' }));
    B.O('TranslationConstraint', { targetId: look.id, strength: .05, name: 'LookAt' }, iris);
    B.O('DistanceConstraint', { targetId: g.id, distance: 9, modeValue: 0, name: 'Keep' }, iris);
    return { g, lid, iris }; });
  B.O('TranslationConstraint', { targetId: look.id, strength: .03, name: 'Parallax' }, feat);
  B.O('TranslationConstraint', { targetId: look.id, strength: .018, name: 'Parallax' }, turn);
  // слои: венок, шапка волос — над лысой основой; черты — под волосами
  const laurelIm = laurel.map(([r, c], k) => B.meshSkin(head, k ? 'laurelR' : 'laurelL', k ? 92 : -92, -58, .86, MESH[k ? 'laurelR' : 'laurelL'],
    (px, py) => { const w2 = near([px, py], [r, c], 30); return [...w2, [hb, .05]]; }));
  B.meshSkin(head, 'hairCap', 0, -66, 1.0, MESH.hairCap, (px, py) => {
    const sw = strands.flat(), w2 = near([px, py], sw, 26).map(([b, v]) => [b, v * smooth(ramp(py, 0, -60))]); const s2 = w2.reduce((a, [, v]) => a + v, 0);
    return [...w2, [hb, Math.max(.001, 1 - Math.min(1, s2))]]; });
  B.meshSkin(head, 'bald', 0, BALD_Y, 1.0, MESH.bald, faceW);
  // порядок отрисовки (первые — сверху): венок, волосы, черты лица, затем лысая основа и кости
  head.kids = [...head.kids.filter(o => o.tag === 'Image' && /laurel|hairCap/.test(o.a.name)), feat, ...head.kids.filter(o => o !== feat && !(o.tag === 'Image' && /laurel|hairCap/.test(o.a.name)))];
  B.meshSkin(body, 'torso', 0, 0, 1, MESH.torso, (px, py) => { const t = smooth(ramp(py, 160, -140)); return [[spine, 1 - t], [chestB, t]]; });
  B.root.kids = [head, look, body];

  // ---------- движение (360 кадров = 6 с, по кругу) ----------
  const T = 360;
  const wave = (amp, ph, cycles) => Array.from({ length: 25 }, (_, i) => { const f = i * T / 24; return [f, amp * Math.sin(2 * Math.PI * cycles * f / T + ph), 'linear']; });
  // дыхание: грудь поднимается (2 вдоха), голова чуть следом
  B.sclK(chestB, Array.from({ length: 9 }, (_, i) => { const f = i * T / 8, v = 1 + .025 * (i % 2 ? 1 : 0); return [f, v, 1 + .012 * (i % 2 ? 1 : 0), 'io']; }));
  B.key(head, 'y', Array.from({ length: 9 }, (_, i) => [i * T / 8, 150 - (i % 2 ? 3 : 0), 'io']));
  B.key(head, 'rotation', wave(.025, 0, 1));
  // волосы: каждая прядь качается волной со сдвигом фазы, кончик отстаёт
  strands.forEach(([r, c], i) => { B.rotK(r, wave(.07, i * .8, 2)); B.rotK(c, wave(.12, i * .8 - .9, 2)); });
  laurel.forEach(([r, c], k) => { B.rotK(r, wave(.05, k * 1.3, 2)); B.rotK(c, wave(.09, k * 1.3 - .8, 2)); });
  // взгляд: цель ходит восьмёркой и «стреляет» в стороны
  const lp = [[0, 180, 150], [40, 120, 140], [70, 120, 140], [90, 250, 170], [150, 250, 170], [170, 180, 120], [230, 180, 120], [250, 110, 190], [300, 110, 190], [330, 180, 150], [360, 180, 150]];
  B.key(look, 'x', lp.map(([f, x]) => [f, x, 'snap'])); B.key(look, 'y', lp.map(([f, , y]) => [f, y, 'snap']));
  // моргание: веко опускается внутри глазницы
  for (const e of eyes){ const y0 = e.lid.a.y; B.key(e.lid, 'y', [[0, y0, 'hold'], [96, y0, 'in'], [100, y0 + 26, 'out'], [105, y0, 'hold'], [236, y0, 'in'], [240, y0 + 26, 'out'], [244, y0 + 8, 'hold'], [248, y0, 'hold']]); }
  // рот: ухмылка → короткая улыбка на взгляде вправо
  B.soloK(mouth, [[0, 0], [150, 1], [200, 0], [300, 2], [318, 0]]);
  for (const b of brows) B.key(b, 'y', [[0, b.a.y, 'io'], [88, b.a.y - 5, 'io'], [150, b.a.y, 'io'], [298, b.a.y - 8, 'back'], [320, b.a.y, 'io']]);
}

// =============== 3. Молния вектором: ломаные (6 вариантов), прорисовка TrimPath, свечение пером ===============
{ const B = mk('BoltVector', 120, 'FF0D0B1E');
  reseed(11);
  const glow = B.shape(B.root, 'Impact', 180, 330, [el('Ellipse', { width: 220, height: 70, name: 'P' }), radial(110, [['FFEAF6FF', 0], ['AA5AB4FF', .35], ['001E50FF', 1]], { feather: 18 })], { opacity: 0, blendModeValue: 'additive' });
  const flash = B.shape(B.root, 'Flash', 180, 180, [el('Rectangle', { width: W + 40, height: H + 40, name: 'P' }), fill('FF6F8FD8')], { opacity: 0, blendModeValue: 'screen' });
  const cloud = B.shape(B.root, 'Charge', 180, 6, [el('Ellipse', { width: 160, height: 60, name: 'P' }), radial(80, [['FFD6ECFF', 0], ['885AB4FF', .4], ['001E50FF', 1]], { feather: 14 })], { opacity: .25, blendModeValue: 'additive' });
  const solo = B.solo(B.root, 'Bolt', 0, 0), trims = [];
  for (let v = 0; v < 6; v++){
    const n = B.node(solo, 'v' + v); solo.frames.push(n);
    const tx = 180 + (rnd() - .5) * 60, main = jag(180 + (rnd() - .5) * 20, 0, tx, 330, 150);
    const br = []; for (let b = 0; b < 3; b++){ const p = main[6 + (rnd() * (main.length - 16) | 0)], a = DOWN + (rnd() - .5) * 2.2, l = 40 + rnd() * 70;
      br.push(jag(p[0], p[1], p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l, l * .5)); }
    const tr = () => { if (v) return undefined; const t = id(); trims.push(t); return el('TrimPath', { start: 0, end: 0, modeValue: 'sequential', name: 'Trim', id: t }); };   // прорисовка — только у первого варианта
    // ядро белое, средний слой голубой, внешнее свечение — широкое с пером
    B.shape(n, 'main', 0, 0, [poly(main), stroke(26, '993D7BFF', { feather: 18, trim: tr() }), stroke(9, 'FFA8DCFF', { feather: 3, trim: tr() }), stroke(3, 'FFFFFFFF', { trim: tr() })], { blendModeValue: 'additive' });
    B.shape(n, 'branch', 0, 0, [...br.map(b => poly(b)), stroke(12, '773D7BFF', { feather: 9 }), stroke(4, 'FFA8DCFF', { feather: 2 }), stroke(1.5, 'FFFFFFFF')], { blendModeValue: 'additive' });
  }
  const Z = 24;
  for (const t of trims){ B.key(t, 'end', [[0, 0, 'hold'], [Z, 0, 'out'], [Z + 3, 1, 'hold']]); }
  B.soloK(solo, [[Z, 0], [Z + 4, 1], [Z + 7, 2], [Z + 10, 1], [Z + 13, 3], [Z + 16, 4], [Z + 20, 5], [Z + 24, -1], [Z + 34, 2], [Z + 37, 3], [Z + 41, -1]]);
  B.key(glow, 'opacity', [[0, 0, 'hold'], [Z + 2, 1, 'hold'], [Z + 5, .6, 'hold'], [Z + 8, 1, 'out'], [Z + 28, .2, 'hold'], [Z + 34, 1, 'out'], [Z + 50, 0]]);
  B.sclK(glow, [[Z + 2, .6, .6, 'out'], [Z + 12, 1.2, 1.2, 'out'], [Z + 50, 1.5, 1.5]]);
  B.key(flash, 'opacity', [[0, 0, 'hold'], [Z, .5, 'out'], [Z + 3, .1, 'hold'], [Z + 6, .3, 'out'], [Z + 18, 0, 'hold'], [Z + 34, .3, 'out'], [Z + 44, 0]]);
  B.key(cloud, 'opacity', [[0, .2, 'in'], [Z - 2, .9, 'out'], [Z + 40, .3, 'io'], [120, .2]]);
}

// =============== 4. Нарисованные кадры молнии + частицы удара (искры, дуги, волна, камешки) ===============
{ const B = mk('BoltFrames', 120, 'FF0D0B1E');
  reseed(5);
  const X = 180, Y = 318, Z = 20;
  const fx = B.node(B.root, 'FX', 0, 0);
  // искры: короткие черты по направлению полёта, баллистика (скорость + гравитация), гаснут и укорачиваются
  const spark = (t0, ang, sp, life, col, len) => {
    const s = B.shape(fx, 'spark', X, Y, [poly([[0, -1.6], [-len, 0], [0, 1.6]], true), fill(col, { feather: 3 }), poly([[0, -.8], [-len * .5, 0], [0, .8]], true), fill('FFE8F8FF')], { opacity: 0, blendModeValue: 'additive' });
    const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp, g = .32, xs = [], ys = [], rs = [], op = [[0, 0, 'hold']], sc = [];
    for (let t = 0; t <= life; t += 3){ const x = X + vx * t, y = Y + vy * t + g * t * t / 2, a = Math.atan2(vy + g * t, vx), k = t / life;
      xs.push([t0 + t, x, 'linear']); ys.push([t0 + t, y, 'linear']); rs.push([t0 + t, a, 'linear']); sc.push([t0 + t, 1 - k * .8, 1, 'linear']); }
    op.push([t0, 1, 'hold']); for (let t = 3; t < life; t += 3) op.push([t0 + t, (1 - t / life) * (rnd() < .3 ? .35 : 1), 'linear']); op.push([t0 + life, 0, 'hold']);
    B.key(s, 'x', xs); B.key(s, 'y', ys); B.key(s, 'rotation', rs); B.key(s, 'opacity', op); B.sclK(s, sc); };
  for (let i = 0; i < 70; i++){ const a = -Math.PI / 2 + (rnd() - .5) * 2.8, sp = 2.5 + rnd() ** 1.5 * 9, life = 10 + rnd() * 22 | 0;
    spark(Z + 1 + (rnd() * 8 | 0), a, sp, life, rnd() < .6 ? 'FF3D9BFF' : 'FF7FD8FF', 6 + rnd() * 14); }
  // электрические дуги у точки удара: короткие ломаные, вспыхивают на 2–3 кадра
  for (let i = 0; i < 10; i++){ const a = -Math.PI * rnd(), r = 30 + rnd() * 50, pts = jag(X, Y, X + Math.cos(a) * r, Y + Math.sin(a) * r * .7, r * .6);
    const s = B.shape(fx, 'arc', 0, 0, [poly(pts), stroke(6, 'AA57B8FF', { feather: 4 }), stroke(1.8, 'FFFFFFFF')], { opacity: 0, blendModeValue: 'additive' });
    const t = Z + 2 + (rnd() * 22 | 0); B.key(s, 'opacity', [[0, 0, 'hold'], [t, 1, 'hold'], [t + 2 + (rnd() * 2 | 0), 0, 'hold'], [t + 9, .7, 'hold'], [t + 11, 0, 'hold']]); }
  // ударная волна по песку
  const ring = B.shape(fx, 'ring', X, Y + 4, [el('Ellipse', { width: 80, height: 22, name: 'P' }), stroke(7, 'FFA8DCFF', { feather: 5 })], { opacity: 0, blendModeValue: 'additive' });
  B.key(ring, 'opacity', [[0, 0, 'hold'], [Z + 1, 1, 'out'], [Z + 24, 0]]); B.sclK(ring, [[Z + 1, .3, .3, 'expo'], [Z + 24, 3.4, 3.4]]);
  // камешки: тёмные, летят по дуге и падают
  for (let i = 0; i < 9; i++){ const sz = 4 + rnd() * 6, pts = Array.from({ length: 6 }, (_, k) => [Math.cos(k * 1.05) * sz * (.7 + rnd() * .5), Math.sin(k * 1.05) * sz * (.7 + rnd() * .5)]);
    const s = B.shape(fx, 'rock', X, Y, [poly(pts, true), fill('FF6B4A2E')], { opacity: 0 });
    const a = -Math.PI / 2 + (rnd() - .5) * 2, sp = 3 + rnd() * 4, vx = Math.cos(a) * sp, vy = Math.sin(a) * sp, xs = [], ys = [];
    for (let t = 0; t <= 36; t += 3){ xs.push([Z + 1 + t, X + vx * t, 'linear']); ys.push([Z + 1 + t, Math.min(Y + 6, Y + vy * t + .35 * t * t / 2), 'linear']); }
    B.key(s, 'x', xs); B.key(s, 'y', ys); B.key(s, 'rotation', [[Z + 1, 0, 'linear'], [Z + 37, (rnd() - .5) * 8]]); B.key(s, 'opacity', [[0, 0, 'hold'], [Z + 1, 1, 'hold'], [Z + 40, 1, 'linear'], [Z + 50, 0]]); }
  // нарисованные кадры: молния сверху вниз до точки удара, удар о землю
  const bolt = B.solo(B.root, 'Bolt', X, 0), BF = P.bolt, top = BF.frames.reduce((a, f) => a + f.cy - f.h / 2, 0) / 8, bot = BF.frames.reduce((a, f) => a + f.cy + f.h / 2, 0) / 8, k = Y / (bot - top), mx = BF.frames.reduce((a, f) => a + f.cx, 0) / 8;
  bolt.frames = BF.frames.map((f, i) => B.img(bolt, 'bolt' + i, (f.cx - mx) * k, (f.cy - top) * k, k, { blendModeValue: 'additive' }));
  const imp = B.solo(B.root, 'Impact', X, Y + 12), IF = P.impact;
  imp.frames = IF.frames.map((f, i) => B.img(imp, 'impact' + i, (f.cx - IF.cell[0] / 2) * .8, -f.h / 2 * .8, .8, { blendModeValue: 'additive' }));
  B.soloK(bolt, [[Z - 4, 0], [Z - 2, 1], [Z, 2], [Z + 2, 3], [Z + 5, 2], [Z + 7, 3], [Z + 9, 4], [Z + 12, 5], [Z + 15, 4], [Z + 18, 6], [Z + 22, 7], [Z + 26, -1]]);
  B.soloK(imp, [[Z, 0], [Z + 2, 1], [Z + 5, 2], [Z + 8, 3], [Z + 12, 4], [Z + 16, 5], [Z + 20, 6], [Z + 25, 7], [Z + 30, -1]]);
  const sand = B.shape(B.root, 'Sand', X, Y + 40, [el('Rectangle', { width: W, height: 80, name: 'P' }), fill('FF3A2A1E')]);
  const flash = B.shape(B.root, 'Flash', X, 180, [el('Rectangle', { width: W + 40, height: H + 40, name: 'P' }), fill('FF6F8FD8')], { opacity: 0, blendModeValue: 'screen' });
  B.key(flash, 'opacity', [[0, 0, 'hold'], [Z, .45, 'out'], [Z + 14, 0]]);
  // порядок отрисовки: вспышка, частицы, молния, удар — поверх песка
  B.root.kids = [flash, fx, bolt, imp, sand];
}

// =============== 5. Лёгкая молния: одна ломаная, точки которой переставляются каждые 2 кадра (без картинок) ===============
{ const B = mk('BoltJitter', 120, 'FF0D0B1E');
  reseed(23);
  const Z = 20, STATES = 10, X0 = 180, X1 = 172;
  // одинаковое число точек в каждом состоянии: jag с теми же длиной и порогом
  const states = Array.from({ length: STATES }, () => jag(X0, 0, X1 + (rnd() - .5) * 30, 330, 140, undefined, 9));
  const brStates = Array.from({ length: STATES }, (_, k) => { const p = states[k][Math.floor(states[k].length * .45)]; return jag(p[0], p[1], p[0] + 70 + rnd() * 30, p[1] + 90, 50, undefined, 9); });
  const n = Math.min(...states.map(s => s.length)), nb = Math.min(...brStates.map(s => s.length));
  const pathXml = (pts, ids) => el('PointsPath', { isClosed: 'false', name: 'P' }, pts.map(([x, y], i) => el('StraightVertex', { x, y, id: ids[i] })));
  const ids = Array.from({ length: n }, () => id()), bids = Array.from({ length: nb }, () => id()), trimIds = [id(), id(), id()];
  const main = B.shape(B.root, 'Bolt', 0, 0, [pathXml(states[0].slice(0, n), ids),
    stroke(26, '993D7BFF', { feather: 18, trim: el('TrimPath', { start: 0, end: 0, modeValue: 'sequential', name: 'T', id: trimIds[0] }) }),
    stroke(9, 'FFA8DCFF', { feather: 3, trim: el('TrimPath', { start: 0, end: 0, modeValue: 'sequential', name: 'T', id: trimIds[1] }) }),
    stroke(3, 'FFFFFFFF', { trim: el('TrimPath', { start: 0, end: 0, modeValue: 'sequential', name: 'T', id: trimIds[2] }) })], { opacity: 0, blendModeValue: 'additive' });
  const branch = B.shape(B.root, 'Branch', 0, 0, [pathXml(brStates[0].slice(0, nb), bids), stroke(12, '773D7BFF', { feather: 9 }), stroke(4, 'FFA8DCFF', { feather: 2 }), stroke(1.5, 'FFFFFFFF')], { opacity: 0, blendModeValue: 'additive' });
  // точки: новое положение каждые 2 кадра, без плавности (так мерцает молния)
  for (let i = 0; i < n; i++){ const xs = [], ys = []; for (let k = 0; k < STATES; k++){ const f = Z + k * 2 + (k > 6 ? 6 : 0); xs.push([f, states[k][i][0], 'hold']); ys.push([f, states[k][i][1], 'hold']); }
    B.key(ids[i], 'x', xs); B.key(ids[i], 'y', ys); }
  for (let i = 0; i < nb; i++){ const xs = [], ys = []; for (let k = 0; k < STATES; k++){ const f = Z + k * 2 + (k > 6 ? 6 : 0); xs.push([f, brStates[k][i][0], 'hold']); ys.push([f, brStates[k][i][1], 'hold']); }
    B.key(bids[i], 'x', xs); B.key(bids[i], 'y', ys); }
  for (const t of trimIds) B.key(t, 'end', [[0, 0, 'hold'], [Z, 0, 'out'], [Z + 3, 1, 'hold']]);
  B.key(main, 'opacity', [[0, 0, 'hold'], [Z, 1, 'hold'], [Z + 15, .5, 'hold'], [Z + 17, 1, 'hold'], [Z + 26, .8, 'linear'], [Z + 34, 0, 'hold']]);
  B.key(branch, 'opacity', [[0, 0, 'hold'], [Z + 3, 1, 'hold'], [Z + 9, 0, 'hold'], [Z + 12, 1, 'hold'], [Z + 16, 0, 'hold'], [Z + 20, .8, 'hold'], [Z + 24, 0, 'hold']]);
  const glow = B.shape(B.root, 'Impact', 176, 330, [el('Ellipse', { width: 220, height: 70, name: 'P' }), radial(110, [['FFEAF6FF', 0], ['AA5AB4FF', .35], ['001E50FF', 1]], { feather: 18 })], { opacity: 0, blendModeValue: 'additive' });
  B.key(glow, 'opacity', [[0, 0, 'hold'], [Z + 2, 1, 'out'], [Z + 14, .5, 'hold'], [Z + 17, 1, 'out'], [Z + 40, 0]]);
  const flash = B.shape(B.root, 'Flash', 180, 180, [el('Rectangle', { width: W + 40, height: H + 40, name: 'P' }), fill('FF6F8FD8')], { opacity: 0, blendModeValue: 'screen' });
  B.key(flash, 'opacity', [[0, 0, 'hold'], [Z, .4, 'out'], [Z + 12, 0, 'hold'], [Z + 17, .25, 'out'], [Z + 28, 0]]);
  B.root.kids = [flash, branch, main, glow];
}

// FIRST=Имя — этот артборд первым (rive --screenshot снимает первый)
const first = process.env.FIRST; if (first) boards.sort((a, b) => (b.name === first) - (a.name === first));
writeFileSync(new URL('./scene.rml', import.meta.url), doc(boards));
console.log('ok', boards.map(b => b.name).join(' '));
