// Генератор сцены Цезаря для Rive: пишет scene.rml (RML → rive CLI → caesar.riv).
// node gen.mjs  →  rive . --once  →  build/caesar.riv
// Координаты: артборд 390×844 (y вниз). Цезарь — в пикселях листа тела (P), лицо — в пикселях листа лица (Fp → P).
// Порядок отрисовки в Rive: ПЕРВЫЙ ребёнок рисуется СВЕРХУ.
import { writeFileSync } from 'node:fs';
const W = 390, H = 844, FPS = 60, DUR = 180;
let nid = 10; const id = () => `0:${nid++}`;
const f2 = v => +(+v).toFixed(3);
const at = o => Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}="${typeof v === 'number' ? f2(v) : v}"`).join(' ');
const el = (tag, attrs, kids = []) => kids.length ? `<${tag} ${at(attrs)}>\n${kids.join('\n')}\n</${tag}>` : `<${tag} ${at(attrs)}/>`;

// ---------- ассеты ----------
const assets = {}, assetXml = [];
const asset = name => assets[name] ||= (() => { const i = id(); assetXml.push(el('ImageAsset', { file: `img/${name}`, name, id: i })); return i; })();
const img = (file, x, y, s, extra = {}) => el('Image', { x, y, scaleX: s, scaleY: s, assetId: asset(file), name: file.replace(/\..*/, ''), ...extra });
const node = (name, x, y, kids, extra = {}) => { const i = extra.id || id(); return { id: i, xml: el('Node', { x, y, name, id: i, ...extra, id: i }, kids) }; };

// ---------- анимация: ключи копятся по объекту и свойству ----------
const keys = {};   // objId → prop → [[frame, value, ease]]
const key = (obj, prop, list) => { ((keys[obj] ||= {})[prop] ||= []).push(...list); };
const EASE = { out: [0, 0, .58, 1], in: [.42, 0, 1, 1], io: [.42, 0, .58, 1], back: [.34, 1.56, .64, 1], snap: [.1, .9, .2, 1] };
function kfXml(frame, value, ease){
  if (ease === 'hold') return el('KeyFrameDouble', { value, frame, interpolationType: 'hold' });
  if (!ease || ease === 'linear') return el('KeyFrameDouble', { value, frame, interpolationType: 'linear' });
  const [x1, y1, x2, y2] = EASE[ease] || ease;
  return el('KeyFrameDouble', { value, frame, interpolationType: 'cubic' }, [el('CubicEaseInterpolator', { x1, y1, x2, y2 })]);
}
const animXml = (name, loop) => { const objs = Object.entries(keys).map(([obj, props]) => el('KeyedObject', { objectId: obj },
    Object.entries(props).map(([prop, list]) => el('KeyedProperty', { property: prop }, list.sort((a, b) => a[0] - b[0]).map(([fr, v, e]) => kfXml(fr, v, e))))));
  const aid = id(); return { id: aid, xml: el('LinearAnimation', { loopValue: loop, fps: FPS, duration: DUR, name, id: aid }, objs) }; };

// ---------- фон ----------
const SKY = [768, 1152], bs = Math.max(W / SKY[0], H / SKY[1]), by = H - SKY[1] * bs;
const wallTop = by + 420 * bs, wallH = 732 * bs, rim = by + 600 * bs, sandY = by + 990 * bs;

// ---------- Цезарь ----------
const SP = .333;                                    // 1 px листа тела → px экрана
const P0 = [774, 980], cY = rim + 105;               // низ торса прячется за стеной
const Fp = (x, y) => [774 + (x - 338) * .45, 284 + (y - 528) * .45];
const rel = (a, b) => [a[0] - b[0], a[1] - b[1]];
const FS = .9, BS = 1 / .7;                          // масштаб картинок: лицо (лист ×0.5), тело (×0.7)
const headAt = Fp(338, 528), chestAt = [774, 600];

const jaw = node('Jaw', ...rel(Fp(338, 470), headAt), [img('jaw.webp', ...rel(Fp(338, 737), Fp(338, 470)), FS)]);
// полость рта и щёки «тянутся» за челюстью: узел с началом сверху, scaleY растёт вместе с опусканием челюсти
const mouthTop = Fp(338, 546.5), cheekTop = Fp(338, 500);
const mouth = node('MouthStretch', ...rel(mouthTop, headAt), [img('mouthIn.webp', 0, 157 * .45 / 2, FS)]);
const cheek = node('CheekStretch', ...rel(cheekTop, headAt), [img('cheek.webp', 0, 330 * .45 / 2, FS)]);
const browL = node('BrowL', ...rel(Fp(218, 255), headAt), [img('browL.webp', 0, 0, FS)]);
const browR = node('BrowR', ...rel(Fp(458, 255), headAt), [img('browR.webp', 0, 0, FS)]);
const lidL = node('LidL', ...rel(Fp(223, 300), headAt), [img('lidL.webp', 0, 0, FS)]);
const lidR = node('LidR', ...rel(Fp(453, 300), headAt), [img('lidR.webp', 0, 0, FS)]);
// свечение глаз — вектор: радиальный градиент + перо (мягкий край), режим screen
const glowShape = (name, x, y) => { const i = id(); return { id: i, xml: el('Shape', { x, y, blendModeValue: 'screen', name, id: i }, [
    el('Ellipse', { width: 70, height: 70, name: 'P' }),
    el('Fill', { fillRule: 'clockwise', name: 'F' }, [el('RadialGradient', { startX: 0, startY: 0, endX: 35, endY: 0, name: 'G' }, [
      el('GradientStop', { colorValue: 'FFEFFBFF', position: 0 }), el('GradientStop', { colorValue: 'CC6FC3FF', position: .3 }), el('GradientStop', { colorValue: '002A6BFF', position: 1 })]),
      el('Feather', { strength: 6, name: 'Soft' })]) ]) }; };
const eyeLc = rel(Fp(223, 374), headAt), eyeRc = rel(Fp(453, 374), headAt);
const glowL = glowShape('GlowL', ...eyeLc), glowR = glowShape('GlowR', ...eyeRc);
const face = node('Face', 0, 0, [
  browL.xml, browR.xml, lidL.xml, lidR.xml, glowL.xml, glowR.xml,
  img('eyeL.webp', ...eyeLc, FS * 143 / 151), img('eyeR.webp', ...eyeRc, FS * 145 / 153),
  img('lipUp.webp', ...rel(Fp(338, 580), headAt), FS), jaw.xml, mouth.xml]);
const wreath = node('Wreath', ...rel(Fp(338, 140), headAt), [img('wreathL.webp', (193 - 338) * .45, 0, FS), img('wreathR.webp', (483 - 338) * .45, 0, FS)]);
const head = node('Head', ...rel(headAt, chestAt), [wreath.xml, face.xml, img('head.webp', ...rel(Fp(338, 271.5), headAt), FS), cheek.xml]);
const armL = node('ArmL', ...rel([540, 500], chestAt), [img('armL.webp', 380.5 - 540, 577.5 - 500, BS)]);
const armR = node('ArmR', ...rel([1010, 500], chestAt), [img('armR.webp', 1176 - 1010, 578.5 - 500, BS)]);
const chest = node('Chest', ...rel(chestAt, P0), [head.xml, img('torso.webp', 0, 675 - 600, BS), armL.xml, armR.xml]);
const body = node('Body', 0, 0, [chest.xml]);
const caesar = node('Caesar', W / 2, cY, [body.xml], { scaleX: SP, scaleY: SP });

// глаза на экране (для молний): центр Цезаря + смещения
const eyeScr = c => [W / 2 + (c[0] + headAt[0] - P0[0]) * SP, cY + (c[1] + headAt[1] - P0[1]) * SP];
const E = [eyeScr(eyeLc), eyeScr(eyeRc)];

// ---------- молнии: вектор, ломаная от глаза до песка, «прорисовка» обрезкой контура ----------
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function jag(x0, y0, x1, y1, off, out){ if (off < 4){ out.push([x1, y1]); return; }
  const mx = (x0 + x1) / 2 + (rnd() - .5) * off, my = (y0 + y1) / 2 + (rnd() - .5) * off * .25; jag(x0, y0, mx, my, off / 2, out); jag(mx, my, x1, y1, off / 2, out); }
const bolts = [], trims = [], boltVar = [];
function boltShape(name, pts, scale){
  const pid = id(), mk = (thick, color, feather) => { const tid = id(); trims.push(tid);
    return el('Stroke', { thickness: thick * scale, cap: 'round', join: 'round', name: 'S' }, [el('SolidColor', { colorValue: color, name: 'C' }), ...(feather ? [el('Feather', { strength: feather * scale, name: 'Fe' })] : []), el('TrimPath', { start: 0, end: 0, modeValue: 'sequential', name: 'Trim', id: tid })]); };
  const i = id(); bolts.push(i);
  return el('Shape', { blendModeValue: 'screen', name, id: i }, [
    el('PointsPath', { isClosed: 'false', name: 'P', id: pid }, pts.map(([x, y]) => el('StraightVertex', { x, y }))),
    mk(3.2, 'FFFFFFFF'), mk(9, 'FFB8E4FF', 3), mk(24, 'CC3D8BFF', 16) ]);
}
const tgt = [[W / 2 - W * .17, sandY], [W / 2 + W * .17, sandY]], boltXml = [];
E.forEach(([ex, ey], k) => { const [tx, ty] = tgt[k];
  for (let v = 0; v < 2; v++){ const pts = [[ex, ey]]; jag(ex, ey, tx, ty, Math.hypot(tx - ex, ty - ey) * .32, pts); boltXml.push(boltShape(`Bolt${k}${v}`, pts, 1));
    // отростки: 2 коротких ветки от ствола
    for (let b = 0; b < 1; b++){ const p = pts[4 + (rnd() * (pts.length - 8) | 0)], a = Math.PI / 2 + (rnd() - .5) * 1.8, l = 50 + rnd() * 60, br = [p.slice()]; jag(p[0], p[1], p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l, l * .5, br); boltXml.push(boltShape(`Br${k}${v}${b}`, br, .5)); boltVar.push(v, v); } } });

// удар о песок: кольцо-волна и пятно света
const ringId = id(), spotId = id(), flashId = id();
const ring = el('Shape', { x: W / 2, y: sandY, scaleX: .2, scaleY: .2, opacity: 0, blendModeValue: 'screen', name: 'Ring', id: ringId }, [
  el('Ellipse', { width: 300, height: 70, name: 'P' }),
  el('Stroke', { thickness: 6, name: 'S' }, [el('SolidColor', { colorValue: 'FFBFE6FF', name: 'C' }), el('Feather', { strength: 6, name: 'F' })])]);
const spot = el('Shape', { x: W / 2, y: sandY, opacity: 0, blendModeValue: 'screen', name: 'Spot', id: spotId }, [
  el('Ellipse', { width: 360, height: 120, name: 'P' }),
  el('Fill', { fillRule: 'clockwise', name: 'F' }, [el('RadialGradient', { startX: 0, startY: 0, endX: 180, endY: 0, name: 'G' }, [
    el('GradientStop', { colorValue: 'FFEAF6FF', position: 0 }), el('GradientStop', { colorValue: '883C8CFF', position: .45 }), el('GradientStop', { colorValue: '001E50FF', position: 1 })]), el('Feather', { strength: 20, name: 'F' })])]);
const flash = el('Shape', { x: W / 2, y: H / 2, opacity: 0, blendModeValue: 'screen', name: 'Flash', id: flashId }, [
  el('Rectangle', { width: W + 80, height: H + 80, name: 'P' }), el('Fill', { name: 'F' }, [el('SolidColor', { colorValue: 'FF8FB4FF', name: 'C' })])]);

// ---------- гладиаторы ----------
const GS = .603, gl1 = node('G1', W / 2 - 70 * GS, H + 6, [img('gSword.webp', 0, -205 * GS / GS, 1)], { scaleX: GS, scaleY: GS }), gl2 = node('G2', W / 2 + 70 * GS, H + 6, [img('gSpear.webp', 0, -208, 1)], { scaleX: GS, scaleY: GS });

// ---------- сцена: тряска всей картинки — узел Scene ----------
const scene = node('Scene', 0, 0, [
  flash, gl1.xml, gl2.xml, ring, spot, ...boltXml,
  img('wall.webp', W / 2, wallTop + wallH / 2, bs), caesar.xml, img('sky.webp', W / 2, by + SKY[1] * bs / 2, bs)]);

// =============== ХОРЕОГРАФИЯ (кадры 60 fps) ===============
const U = .45;                                       // 1 px листа лица → P
// подъём из-за стены с перелётом
key(caesar.id, 'y', [[0, cY + 230, 'back'], [44, cY]]);
key(caesar.id, 'scaleY', [[0, SP * .94, 'back'], [44, SP]]);
// смех: 4 «ха» по 18 кадров (с 30), ещё 2 после разряда (со 140)
const HA = [30, 48, 66, 84, 140, 158];
const jawK = [[0, 0, 'out']], headY = [[0, 0, 'out']], headR = [[0, 0, 'out']], chestS = [[0, 1, 'out']], browY = [[0, 0, 'out']], lidY = [[0, 0, 'out']], armLR = [[0, 0, 'out']], armRR = [[0, 0, 'out']];
HA.forEach((f, i) => { const s = i % 2 ? 1 : -1;
  jawK.push([f, 4 * U, 'snap'], [f + 6, 38 * U, 'io'], [f + 18, 6 * U, 'out']);
  headY.push([f, 0, 'snap'], [f + 6, -10, 'io'], [f + 18, 0, 'out']);
  headR.push([f, 0, 'snap'], [f + 6, s * .045, 'io'], [f + 18, 0, 'out']);
  chestS.push([f, 1, 'snap'], [f + 6, 1.03, 'io'], [f + 18, 1, 'out']);
  browY.push([f, 0, 'snap'], [f + 6, -9, 'io'], [f + 18, -2, 'out']);
  lidY.push([f, 4, 'snap'], [f + 6, 10, 'io'], [f + 18, 5, 'out']);
  armLR.push([f, 0, 'snap'], [f + 6, -.07, 'io'], [f + 18, 0, 'out']); armRR.push([f, 0, 'snap'], [f + 6, .07, 'io'], [f + 18, 0, 'out']); });
// замах перед разрядом (102–111): голова назад, брови сдвинуты, глаза распахнуты и разгораются; удар — 111
const Z = 111;
jawK.push([102, 6 * U, 'io'], [Z - 2, 2 * U, 'snap'], [Z + 3, 52 * U, 'out'], [Z + 26, 44 * U, 'io'], [138, 6 * U, 'out']);
headY.push([102, 0, 'io'], [Z, -14, 'snap'], [Z + 6, 4, 'out'], [Z + 26, 0, 'out']);
headR.push([102, 0, 'io'], [Z, -.05, 'snap'], [Z + 8, .02, 'out'], [Z + 26, 0, 'out']);
chestS.push([102, 1, 'io'], [Z, 1.05, 'snap'], [Z + 8, .98, 'out'], [Z + 26, 1, 'out']);
browY.push([102, 0, 'io'], [Z, 6, 'out'], [136, 0, 'out']); lidY.push([102, 0, 'io'], [Z, -10, 'out'], [136, 0, 'out']);
armLR.push([102, 0, 'io'], [Z, .16, 'snap'], [Z + 20, 0, 'out']); armRR.push([102, 0, 'io'], [Z, -.16, 'snap'], [Z + 20, 0, 'out']);
key(jaw.id, 'y', jawK.map(([f, v, e]) => [f, rel(Fp(338, 470), headAt)[1] + v, e]));
const stretch = (h, list) => list.map(([f, v, e]) => [f, (h + v) / h, e]);
key(mouth.id, 'scaleY', stretch(157 * U * .9, jawK)); key(cheek.id, 'scaleY', stretch(330 * U * .95, jawK));
key(head.id, 'y', headY.map(([f, v, e]) => [f, rel(headAt, chestAt)[1] + v, e])); key(head.id, 'rotation', headR);
key(chest.id, 'scaleY', chestS); key(armL.id, 'rotation', armLR); key(armR.id, 'rotation', armRR);
for (const b of [browL, browR]) key(b.id, 'y', browY.map(([f, v, e]) => [f, rel(Fp(218, 255), headAt)[1] + v, e]));
key(browL.id, 'rotation', [[0, 0, 'out'], [102, 0, 'io'], [Z, .28, 'out'], [136, 0, 'out']]); key(browR.id, 'rotation', [[0, 0, 'out'], [102, 0, 'io'], [Z, -.28, 'out'], [136, 0, 'out']]);
for (const l of [lidL, lidR]) key(l.id, 'y', lidY.map(([f, v, e]) => [f, rel(Fp(223, 300), headAt)[1] + v, e]));
// лицо чуть «поворачивается»: лицо сильнее головы, венок — в обратную сторону (объём)
key(face.id, 'x', [[0, 0, 'io'], [60, 4, 'io'], [120, -3, 'io'], [180, 0]]); key(wreath.id, 'x', [[0, 0, 'io'], [60, -2, 'io'], [120, 1.5, 'io'], [180, 0]]);
// глаза: тлеют, разгораются перед ударом, вспышка
for (const g of [glowL, glowR]){ key(g.id, 'opacity', [[0, 0, 'out'], [40, .7, 'io'], [100, .7, 'in'], [Z, 1, 'out'], [150, .8, 'out']]);
  key(g.id, 'scaleX', [[0, .6, 'out'], [100, .9, 'in'], [Z, 2.4, 'out'], [Z + 14, 1.2, 'out'], [150, 1]]); key(g.id, 'scaleY', [[0, .6, 'out'], [100, .9, 'in'], [Z, 2.4, 'out'], [Z + 14, 1.2, 'out'], [150, 1]]); }
// молнии: прорисовка от глаза вниз за 4 кадра, мерцание, затухание
for (const t of trims) key(t, 'end', [[Z, 0, 'out'], [Z + 4, 1]]);
for (const t of trims) key(t, 'start', [[Z + 16, 0, 'in'], [Z + 30, 1]]);
bolts.forEach((b, i) => { const v = boltVar[i], on = k => (k + v) % 2 ? 0 : 1; key(b, 'opacity', [[0, 0, 'hold'], [Z, on(0), 'hold'], [Z + 4, on(1), 'hold'], [Z + 7, on(2), 'hold'], [Z + 10, on(3), 'hold'], [Z + 13, on(4), 'hold'], [Z + 16, on(5), 'hold'], [Z + 19, on(6) * .8, 'linear'], [Z + 32, 0]]); });
key(ringId, 'opacity', [[0, 0, 'hold'], [Z + 3, 1, 'out'], [Z + 30, 0]]); key(ringId, 'scaleX', [[Z + 3, .2, 'out'], [Z + 30, 1.6]]); key(ringId, 'scaleY', [[Z + 3, .2, 'out'], [Z + 30, 1.6]]);
key(spotId, 'opacity', [[0, 0, 'hold'], [Z + 3, 1, 'out'], [Z + 40, 0]]);
key(flashId, 'opacity', [[0, 0, 'hold'], [Z + 2, .55, 'out'], [Z + 18, 0]]);
// тряска
const shake = [[0, 0, 'hold']]; for (let k = 0; k < 9; k++) shake.push([Z + 2 + k * 2, (k % 2 ? -1 : 1) * 7 * (1 - k / 9), 'linear']); shake.push([Z + 20, 0]);
key(scene.id, 'x', shake); key(scene.id, 'y', shake.map(([f, v, e]) => [f, -v * .6, e]));
// гладиаторы: переминаются, вздрагивают от удара
key(gl1.id, 'scaleY', [[0, GS, 'io'], [50, GS * 1.015, 'io'], [100, GS, 'io'], [Z, GS, 'snap'], [Z + 4, GS * .93, 'out'], [Z + 22, GS, 'io'], [180, GS * 1.01]]);
key(gl2.id, 'scaleY', [[0, GS * 1.01, 'io'], [40, GS, 'io'], [90, GS * 1.015, 'io'], [Z, GS, 'snap'], [Z + 5, GS * .93, 'out'], [Z + 24, GS, 'io'], [180, GS]]);
key(gl1.id, 'x', [[Z, W / 2 - 70 * GS, 'snap'], [Z + 4, W / 2 - 70 * GS - 8, 'out'], [Z + 24, W / 2 - 70 * GS]]); key(gl2.id, 'x', [[Z, W / 2 + 70 * GS, 'snap'], [Z + 5, W / 2 + 70 * GS + 8, 'out'], [Z + 26, W / 2 + 70 * GS]]);

// ---------- документ ----------
const anim = animXml('Intro', 'oneShot'), smId = id(), stId = id();
const sm = el('StateMachine', { name: 'SM', id: smId }, [el('StateMachineLayer', { name: 'L', id: id() }, [
  el('AnyState', { x: 200, y: -120 }), el('ExitState', { x: 400, y: -120 }), el('EntryState', {}, [el('StateTransition', { stateToId: stId })]), el('AnimationState', { x: 200, animationId: anim.id, id: stId })])]);
const styleId = id();
const rml = `<Rive version="1" kind="fragment">
${el('Artboard', { defaultStateMachineId: smId, styleId, width: W, height: H, clip: 'true', name: 'Caesar', id: '0:2' }, [
  el('LayoutComponentStyle', { name: 'Style', id: styleId }), el('Fill', { name: 'Bg' }, [el('SolidColor', { colorValue: 'FF0A0816', name: 'C' })]), scene.xml, sm, anim.xml])}
${assetXml.join('\n')}
</Rive>
`;
writeFileSync(new URL('./scene.rml', import.meta.url), rml);
console.log('ok', nid, 'ids; eyes', E.map(e => e.map(Math.round)).join(' '), 'sand', Math.round(sandY));
