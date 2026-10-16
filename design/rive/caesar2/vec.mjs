// Контуры трассировки → RML (вектор Rive). Общие функции для сборки сцены.
// part(t, opts) → { xml, ids } : Node с цветными Shape; каждый контур — PointsPath из CubicDetachedVertex (кривые) или StraightVertex.
let nid = 1000;
export const id = () => `0:${nid++}`;
const f = v => +(+v).toFixed(2);
// сегменты одного контура → вершины: у каждой вершины «вход» — от предыдущего сегмента, «выход» — от следующего
function vertices(segs, ox, oy){
  const n = segs.length, V = segs.map(s => ({ x: s[1] - ox, y: s[2] - oy, inx: null, iny: null, outx: null, outy: null }));
  segs.forEach((s, i) => { const v0 = V[i], v1 = V[(i + 1) % n];
    if (s[0] === 'Q'){ const qx = s[3] - ox, qy = s[4] - oy, ex = s[5] - ox, ey = s[6] - oy;
      v0.outx = v0.x + 2 / 3 * (qx - v0.x); v0.outy = v0.y + 2 / 3 * (qy - v0.y);
      v1.inx = ex + 2 / 3 * (qx - ex); v1.iny = ey + 2 / 3 * (qy - ey); } });
  return V.map(v => {
    if (v.inx == null && v.outx == null) return `<StraightVertex x="${f(v.x)}" y="${f(v.y)}"/>`;
    const pol = (cx, cy) => cx == null ? [0, 0] : [Math.atan2(cy - v.y, cx - v.x), Math.hypot(cx - v.x, cy - v.y)];
    const [ir, id_] = pol(v.inx, v.iny), [or, od] = pol(v.outx, v.outy);
    return `<CubicDetachedVertex x="${f(v.x)}" y="${f(v.y)}" inRotation="${f(ir)}" inDistance="${f(id_)}" outRotation="${f(or)}" outDistance="${f(od)}"/>`;
  }).join('');
}
// часть: начало координат узла — точка (ax, ay) листа; минимальная площадь контура — мелочь выбрасываем
export function part(t, { name, ax, ay, x = 0, y = 0, scale = 1, minLen = 0, extra = '' } = {}){
  const nodeId = id(), shapes = [];
  for (const L of t.layers){
    const paths = L.paths.filter(q => q.segs.length >= minLen).map(q => `<PointsPath isClosed="true" name="p">${vertices(q.segs, ax - t.box[0], ay - t.box[1])}</PointsPath>`);
    if (!paths.length) continue;
    shapes.push(`<Shape name="c${L.color.slice(2)}">${paths.join('')}<Fill fillRule="evenOdd" name="F"><SolidColor colorValue="${L.color}" name="C"/></Fill></Shape>`);
  }
  // крупные заливки рисуем снизу: в Rive первый ребёнок — сверху, поэтому мелкие детали — первыми
  return { id: nodeId, xml: `<Node x="${f(x)}" y="${f(y)}" scaleX="${f(scale)}" scaleY="${f(scale)}" name="${name}" id="${nodeId}"${extra}>${shapes.reverse().join('')}</Node>` };
}
