// Общие помощники для сцен Rive из кода (RML → rive CLI → .riv): дерево объектов, кости, сетки с весами, ключи анимации.
// Порядок отрисовки в Rive: ПЕРВЫЙ ребёнок рисуется СВЕРХУ.
let nid = 10;
export const id = () => `0:${nid++}`;
const f4 = v => +(+v).toFixed(4);
const at = o => Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}="${typeof v === 'number' ? f4(v) : v}"`).join(' ');
export const el = (tag, attrs, kids = []) => kids.length ? `<${tag} ${at(attrs)}>\n${kids.join('\n')}\n</${tag}>` : `<${tag} ${at(attrs)}/>`;

// ---------- матрицы 2D [a b c d e f]: x' = a x + c y + e, y' = b x + d y + f ----------
export const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
export const inv = M => { const d = M[0] * M[3] - M[1] * M[2]; return [M[3] / d, -M[1] / d, -M[2] / d, M[0] / d, (M[2] * M[5] - M[3] * M[4]) / d, (M[1] * M[4] - M[0] * M[5]) / d]; };
export const T = (x, y) => [1, 0, 0, 1, x, y], R = r => [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0], S = (x, y = x) => [x, 0, 0, y, 0, 0];
export const ap = (M, [x, y]) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
export const chain = (...m) => m.reduce(mul);
export const ramp = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
export const smooth = t => t * t * (3 - 2 * t);
export const EASE = { out: [0, 0, .58, 1], in: [.42, 0, 1, 1], io: [.42, 0, .58, 1], back: [.34, 1.56, .64, 1], snap: [.1, .9, .2, 1], whip: [.6, 0, .2, 1], expo: [.16, 1, .3, 1] };
let seed = 7; export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; export const reseed = s => { seed = s; };

// ---------- артборд: дерево, ассеты, ключи, документ ----------
export function board({ name, width, height, bg = 'FF0A0816', fps = 60, duration = 120, loop = 'loop', parts = {} }){
  const objs = {}, keys = {}, B = { name, width, height, parts, objs, keys };
  B.O = (tag, attrs, parent) => { const o = { tag, a: { ...attrs }, kids: [], parent, id: attrs.id || id(), extra: [] }; o.a.id = o.id; objs[o.id] = o; parent?.kids.push(o); return o; };
  B.root = B.O('Artboard', { width, height, clip: 'true', name });
  const val = (o, k, d, pose) => pose?.[o.id]?.[k] ?? o.a[k] ?? d;
  B.local = (o, pose) => { const t = o.tag === 'Bone' ? T(val(o.parent, 'length', 0, pose), 0) : T(val(o, 'x', 0, pose), val(o, 'y', 0, pose));
    return chain(t, R(val(o, 'rotation', 0, pose)), S(val(o, 'scaleX', 1, pose), val(o, 'scaleY', 1, pose))); };
  B.world = (o, pose) => o.tag === 'Artboard' ? S(1) : mul(B.world(o.parent, pose), B.local(o, pose));
  B.node = (parent, name, x = 0, y = 0, extra = {}) => B.O('Node', { x, y, name, ...extra }, parent);
  B.img = (parent, name, x, y, s, extra = {}) => B.O('Image', { x, y, scaleX: s, scaleY: s, assetId: asset(name), name, ...extra }, parent);
  // фигура: geom — массив xml (Ellipse/Rectangle/PointsPath), paints — Fill/Stroke xml
  B.shape = (parent, name, x, y, kidsXml, extra = {}) => { const s = B.O('Shape', { x, y, name, ...extra }, parent); s.extra.push(...kidsXml); return s; };
  // кости: в пространстве узла space (его локальные координаты в покое), ang — направление кости
  B.rootBone = (parent, name, space, x, y, ang, len) => {
    const L = mul(inv(B.world(parent)), chain(B.world(space), T(x, y), R(ang)));
    const b = B.O('RootBone', { x: L[4], y: L[5], rotation: Math.atan2(L[1], L[0]), length: len, name }, parent); b.sAng = ang; b.pAng = parent.sAng || 0; return b; };
  B.bone = (parent, name, ang, len) => { const b = B.O('Bone', { rotation: ang - parent.sAng, length: len, name }, parent); b.sAng = ang; b.pAng = parent.sAng; return b; };
  // картинка с сеткой cols×rows; wf(px, py) → [[кость, вес], …] в координатах родителя картинки; bindPose — поза привязки
  B.skinned = (parent, name, x, y, s, cols, rows, wf, { rot = 0, bindPose, ...extra } = {}) => {
    const P = parts[name], w = P.w, h = P.h, im = B.img(parent, name, x, y, s, { rotation: rot || undefined, ...extra });
    const toP = chain(T(x, y), R(rot), S(s));
    const grid = []; for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) grid.push([i, j]);
    const edge = ([i, j]) => i === 0 || j === 0 || i === cols || j === rows;
    const loopV = []; for (let i = 0; i < cols; i++) loopV.push([i, 0]); for (let j = 0; j < rows; j++) loopV.push([cols, j]);
    for (let i = cols; i > 0; i--) loopV.push([i, rows]); for (let j = rows; j > 0; j--) loopV.push([0, j]);
    const order = [...loopV, ...grid.filter(g => !edge(g))], ix = new Map(order.map(([i, j], k) => [i + ',' + j, k]));
    const tris = []; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++){ const q = (a, b) => ix.get(a + ',' + b);
      tris.push(q(i, j), q(i + 1, j), q(i + 1, j + 1), q(i, j), q(i + 1, j + 1), q(i, j + 1)); }
    const bones = [], verts = order.map(([i, j], k) => {
      const vx = -w / 2 + w * i / cols, vy = -h / 2 + h * j / rows, [px, py] = ap(toP, [vx, vy]);
      const ws = wf(px, py).filter(([, v]) => v > .004).sort((a, b) => b[1] - a[1]).slice(0, 4), sum = ws.reduce((a, [, v]) => a + v, 0);
      const q = ws.map(([b, v]) => [b, Math.round(v / sum * 255)]); q[0][1] += 255 - q.reduce((a, [, v]) => a + v, 0);
      let ind = 0, vals = 0; q.forEach(([b, v], n) => { let t = bones.indexOf(b); if (t < 0) t = bones.push(b) - 1; ind |= (t + 1) << (8 * n); vals |= v << (8 * n); });
      return el(k < loopV.length ? 'ContourMeshVertex' : 'MeshVertex', { x: vx, y: vy, u: i / cols, v: j / rows }, [el('Weight', { values: vals >>> 0, indices: ind >>> 0 })]);
    });
    const m6 = M => ({ xx: M[0], xy: M[1], yx: M[2], yy: M[3], tx: M[4], ty: M[5] });
    const tend = bones.map(b => el('Tendon', { boneId: b.id, ...m6(B.world(b, bindPose)), name: b.a.name }));
    im.extra.push(el('Mesh', { triangleIndexBytes: Buffer.from(tris.flatMap(varuint)).toString('base64'), name: 'Mesh' }, [...verts, el('Skin', { ...m6(B.world(im)), name: 'Skin' }, tend)]));
    return im;
  };
  // картинка с готовой сеткой по контуру (tools/meshgen.mjs: verts — px от центра картинки, первые contour — по краю) на костях
  B.meshSkin = (parent, name, x, y, s, mesh, wf, { rot = 0, bindPose, ...extra } = {}) => {
    const im = B.img(parent, name, x, y, s, { rotation: rot || undefined, ...extra }), toP = chain(T(x, y), R(rot), S(s)), P = parts[name], bones = [];
    const verts = mesh.verts.map(([vx, vy], k) => { const [px, py] = ap(toP, [vx, vy]);
      const ws = wf(px, py).filter(([, v]) => v > .004).sort((a, b) => b[1] - a[1]).slice(0, 4), sum = ws.reduce((a, [, v]) => a + v, 0);
      const q = ws.map(([b, v]) => [b, Math.round(v / sum * 255)]); q[0][1] += 255 - q.reduce((a, [, v]) => a + v, 0);
      let ind = 0, vals = 0; q.forEach(([b, v], n) => { let t = bones.indexOf(b); if (t < 0) t = bones.push(b) - 1; ind |= (t + 1) << (8 * n); vals |= v << (8 * n); });
      return el(k < mesh.contour ? 'ContourMeshVertex' : 'MeshVertex', { x: vx, y: vy, u: vx / P.w + .5, v: vy / P.h + .5 }, [el('Weight', { values: vals >>> 0, indices: ind >>> 0 })]); });
    const m6 = M => ({ xx: M[0], xy: M[1], yx: M[2], yy: M[3], tx: M[4], ty: M[5] });
    im.extra.push(el('Mesh', { triangleIndexBytes: Buffer.from(mesh.tris.flatMap(varuint)).toString('base64'), name: 'Mesh' },
      [...verts, el('Skin', { ...m6(B.world(im)), name: 'Skin' }, bones.map(b => el('Tendon', { boneId: b.id, ...m6(B.world(b, bindPose)), name: b.a.name })))]));
    return im;
  };
  // вес «к ближайшим костям»: гаусс по расстоянию до отрезка кости (в координатах пространства родителя)
  B.boneSeg = b => { const W = mul(inv(B.world(b.space)), B.world(b)), a = ap(W, [0, 0]), e = ap(W, [b.a.length || 0, 0]); return [a, e]; };
  // картинка с сеткой без костей: точки двигаются ключами напрямую (ткань); verts — [{ id, u, v, x, y }]
  B.meshed = (parent, name, x, y, s, cols, rows, extra = {}) => {
    const P = parts[name], w = P.w, h = P.h, im = B.img(parent, name, x, y, s, extra), verts = [];
    const ix = (i, j) => j * (cols + 1) + i, tris = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) verts.push({ id: id(), u: i / cols, v: j / rows, x: -w / 2 + w * i / cols, y: -h / 2 + h * j / rows });
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) tris.push(ix(i, j), ix(i + 1, j), ix(i + 1, j + 1), ix(i, j), ix(i + 1, j + 1), ix(i, j + 1));
    im.extra.push(el('Mesh', { triangleIndexBytes: Buffer.from(tris.flatMap(varuint)).toString('base64'), name: 'Mesh' },
      verts.map(p => el('MeshVertex', { x: p.x, y: p.y, u: p.u, v: p.v, id: p.id }))));
    im.verts = verts; return im;
  };
  // ---------- ключи: [кадр, значение, изгиб]; значение-строка — ссылка (KeyFrameId), prop '#296' — по номеру свойства ----------
  B.key = (obj, prop, list) => { ((keys[obj.id || obj] ||= {})[prop] ||= []).push(...list); };
  B.rotK = (b, list) => B.key(b, 'rotation', list.map(([f, v, e]) => [f, b.a.rotation + v, e]));
  B.mvK = (b, list) => { const c = Math.cos(-b.pAng), s = Math.sin(-b.pAng);   // сдвиг корневой кости (dx, dy) в осях пространства → в осях родителя
    B.key(b, 'x', list.map(([f, dx, dy, e]) => [f, b.a.x + c * dx - s * dy, e])); B.key(b, 'y', list.map(([f, dx, dy, e]) => [f, b.a.y + s * dx + c * dy, e])); };
  B.sclK = (o, list) => { B.key(o, 'scaleX', list.map(([f, x, , e]) => [f, x, e])); B.key(o, 'scaleY', list.map(([f, , y, e]) => [f, y, e])); };
  B.solo = (parent, name, x, y, extra = {}) => { const s = B.O('Solo', { x, y, name, ...extra }, parent); s.off = B.O('Node', { name: 'off' }, s); s.a.activeComponentId = s.off.id; s.frames = []; return s; };
  B.soloK = (s, seq) => B.key(s, '#296', [[0, s.off.id], ...seq.map(([f, i]) => [f, i < 0 ? s.off.id : (typeof i === 'number' ? s.frames[i] : i).id])]);
  B.xml = () => {
    const kf = (frame, value, ease) => {
      if (typeof value === 'string') return el('KeyFrameId', { value, frame });
      if (ease === 'hold') return el('KeyFrameDouble', { value, frame, interpolationType: 'hold' });
      if (!ease || ease === 'linear') return el('KeyFrameDouble', { value, frame, interpolationType: 'linear' });
      const [x1, y1, x2, y2] = EASE[ease] || ease;
      return el('KeyFrameDouble', { value, frame, interpolationType: 'cubic' }, [el('CubicEaseInterpolator', { x1, y1, x2, y2 })]); };
    const aid = id(), smId = id(), stId = id(), styleId = id();
    const anim = el('LinearAnimation', { loopValue: loop, fps, duration, name: 'Main', id: aid }, Object.entries(keys).map(([obj, props]) => el('KeyedObject', { objectId: obj },
      Object.entries(props).map(([prop, list]) => el('KeyedProperty', prop[0] === '#' ? { propertyKey: prop.slice(1) } : { property: prop },
        [...new Map(list.map(k => [k[0], k])).values()].sort((a, b) => a[0] - b[0]).map(([fr, v, e]) => kf(fr, v, e)))))));
    const sm = el('StateMachine', { name: 'SM', id: smId }, [el('StateMachineLayer', { name: 'L', id: id() }, [
      el('AnyState', { x: 200, y: -120 }), el('ExitState', { x: 400, y: -120 }), el('EntryState', {}, [el('StateTransition', { stateToId: stId })]), el('AnimationState', { x: 200, animationId: aid, id: stId })])]);
    const tree = o => el(o.tag, o.a, [...o.kids.map(tree), ...o.extra]);
    Object.assign(B.root.a, { defaultStateMachineId: smId, styleId, x: B.x, y: B.y });
    return el('Artboard', B.root.a, [el('LayoutComponentStyle', { name: 'Style', id: styleId }), el('Fill', { name: 'Bg' }, [el('SolidColor', { colorValue: bg, name: 'C' })]),
      ...B.root.kids.map(tree), sm, anim]);
  };
  return B;
}
const assets = {}, assetXml = [];
export const asset = name => assets[name] ||= (() => { const i = id(); assetXml.push(el('ImageAsset', { file: `img/${name}.webp`, name, id: i })); return i; })();
export const doc = boards => `<Rive version="1" kind="fragment">\n${boards.map(b => b.xml()).join('\n')}\n${assetXml.join('\n')}\n</Rive>\n`;
const varuint = n => { const out = []; do { let b = n & 127; n >>>= 7; if (n) b |= 128; out.push(b); } while (n); return out; };

// ---------- рисование вектором ----------
export const solid = c => el('SolidColor', { colorValue: c, name: 'C' });
export const stroke = (thick, color, { feather, trim, cap = 'round' } = {}) => el('Stroke', { thickness: thick, cap, join: 'round', name: 'S' },
  [solid(color), ...(feather ? [el('Feather', { strength: feather, name: 'Fe' })] : []), ...(trim ? [trim] : [])]);
export const fill = (color, { feather } = {}) => el('Fill', { fillRule: 'clockwise', name: 'F' }, [solid(color), ...(feather ? [el('Feather', { strength: feather, name: 'Fe' })] : [])]);
export const radial = (r, stops, { feather } = {}) => el('Fill', { fillRule: 'clockwise', name: 'F' }, [el('RadialGradient', { startX: 0, startY: 0, endX: r, endY: 0, name: 'G' },
  stops.map(([c, p]) => el('GradientStop', { colorValue: c, position: p }))), ...(feather ? [el('Feather', { strength: feather, name: 'Fe' })] : [])]);
export const poly = (pts, closed = false, attrs = {}) => el('PointsPath', { isClosed: closed ? 'true' : 'false', name: 'P', ...attrs }, pts.map(([x, y]) => el('StraightVertex', { x, y })));
// ломаная молнии: середины отрезков смещаются поперёк (midpoint displacement)
export function jag(x0, y0, x1, y1, off, out = [[x0, y0]], minOff = 3){
  if (off < minOff){ out.push([x1, y1]); return out; }
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, t = (rnd() - .5) * off;
  const mx = (x0 + x1) / 2 + nx * t, my = (y0 + y1) / 2 + ny * t;
  jag(x0, y0, mx, my, off / 2, out, minOff); jag(mx, my, x1, y1, off / 2, out, minOff); return out;
}
