// Сетка по контуру картинки (как в примерах Wukong и Snake): node meshgen.mjs out.json img1.webp[:шаг[:точек_контура]] ...
// Силуэт по прозрачности → обход края → упрощение до N точек → точки внутри (шаг сетки, не ближе 0.6 шага к краю)
// → триангуляция Делоне → выбрасываем треугольники вне силуэта. Координаты — пиксели картинки от её центра.
import { chromium } from 'file:///C:/Users/gk_on/Desktop/pawn/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const [, , out, ...specs] = process.argv;
const res = existsSync(out) ? JSON.parse(readFileSync(out)) : {};
const br = await chromium.launch(), pg = await br.newPage();
for (const spec of specs){
  const [file, stepA = '26', nA = '48'] = spec.split(':'), name = file.split(/[\\/]/).pop().replace(/\.\w+$/, ''), STEP = +stepA, NC = +nA;
  const { w, h, a } = await pg.evaluate(async src => { const i = new Image(); i.src = src; await i.decode(); const c = new OffscreenCanvas(i.width, i.height), x = c.getContext('2d'); x.drawImage(i, 0, 0);
    const d = x.getImageData(0, 0, i.width, i.height).data, a = []; for (let k = 3; k < d.length; k += 4) a.push(d[k] > 40 ? 1 : 0); return { w: i.width, h: i.height, a }; },
    'data:image/' + (file.endsWith('.png') ? 'png' : 'webp') + ';base64,' + readFileSync(file).toString('base64'));
  // маска чуть расширена (1 px), чтобы сетка накрывала мягкий край
  const m = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ let v = 0; for (let dy = -2; dy <= 2 && !v; dy++) for (let dx = -2; dx <= 2 && !v; dx++){ const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && a[Y * w + X]) v = 1; } m[y * w + x] = v; }
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x];
  // самый длинный внешний контур (обход по Муру)
  let sx = -1, sy = -1; outer: for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y)){ sx = x; sy = y; break outer; }
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], loop = [];
  let cx = sx, cy = sy, d = 6; do { loop.push([cx, cy]); let k = 0; for (; k < 8; k++){ const nd = (d + 6 + k) % 8, [dx, dy] = dirs[nd]; if (at(cx + dx, cy + dy)){ cx += dx; cy += dy; d = nd; break; } } if (k === 8) break; } while ((cx !== sx || cy !== sy) && loop.length < 200000);
  // N точек по контуру равномерно по длине, потом сглаживание
  const L = [0]; for (let i = 1; i <= loop.length; i++){ const p = loop[i - 1], q = loop[i % loop.length]; L.push(L[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1])); }
  const total = L[L.length - 1], contour = [];
  for (let k = 0; k < NC; k++){ const t = total * k / NC; let i = 0; while (L[i + 1] < t) i++; const p = loop[i], q = loop[(i + 1) % loop.length], u = (t - L[i]) / ((L[i + 1] - L[i]) || 1); contour.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]); }
  // внутренние точки: шахматная сетка, только внутри и не ближе 0.6 шага к краю
  const inner = []; for (let y = STEP / 2; y < h; y += STEP) for (let x = STEP / 2 + ((y / STEP | 0) % 2) * STEP / 2; x < w; x += STEP){ if (!at(x | 0, y | 0)) continue;
    if (contour.some(([px, py]) => Math.hypot(px - x, py - y) < STEP * .6)) continue; let ok = true; for (let r = 0; r < 6 && ok; r++){ const an = r * Math.PI / 3; if (!at((x + Math.cos(an) * STEP * .45) | 0, (y + Math.sin(an) * STEP * .45) | 0)) ok = false; } if (ok) inner.push([x, y]); }
  const pts = [...contour, ...inner];
  // Делоне (Боуэр–Уотсон)
  const big = 1e5, P = [...pts, [-big, -big], [big * 2, -big], [-big, big * 2]], n = pts.length;
  let tris = [[n, n + 1, n + 2]];
  const circ = ([a, b, c]) => { const [ax, ay] = P[a], [bx, by] = P[b], [cx2, cy2] = P[c], D = 2 * (ax * (by - cy2) + bx * (cy2 - ay) + cx2 * (ay - by));
    const ux = ((ax * ax + ay * ay) * (by - cy2) + (bx * bx + by * by) * (cy2 - ay) + (cx2 * cx2 + cy2 * cy2) * (ay - by)) / D, uy = ((ax * ax + ay * ay) * (cx2 - bx) + (bx * bx + by * by) * (ax - cx2) + (cx2 * cx2 + cy2 * cy2) * (bx - ax)) / D;
    return [ux, uy, (ax - ux) ** 2 + (ay - uy) ** 2]; };
  let cc = tris.map(circ);
  for (let i = 0; i < n; i++){ const [x, y] = P[i], bad = [], keep = [], keepC = [];
    tris.forEach((t, k) => { const [ux, uy, r2] = cc[k]; if ((x - ux) ** 2 + (y - uy) ** 2 < r2) bad.push(t); else { keep.push(t); keepC.push(cc[k]); } });
    const edges = new Map(); for (const t of bad) for (const [p, q] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]){ const k = p < q ? p + ',' + q : q + ',' + p; edges.set(k, edges.has(k) ? null : [p, q]); }
    tris = keep; cc = keepC; for (const e of edges.values()) if (e){ const t = [e[0], e[1], i]; tris.push(t); cc.push(circ(t)); } }
  // только треугольники из наших точек, центр — внутри силуэта, и не по «впадинам» вдоль контура
  const inPoly = (x, y) => { let c = false; for (let i = 0, j = contour.length - 1; i < contour.length; j = i++){ const [xi, yi] = contour[i], [xj, yj] = contour[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  tris = tris.filter(t => t.every(v => v < n) && inPoly((pts[t[0]][0] + pts[t[1]][0] + pts[t[2]][0]) / 3, (pts[t[0]][1] + pts[t[1]][1] + pts[t[2]][1]) / 3));
  res[name] = { w, h, contour: contour.length, verts: pts.map(([x, y]) => [+(x - w / 2).toFixed(1), +(y - h / 2).toFixed(1)]), tris: tris.flat() };
  console.log(`${name}: ${w}×${h}, контур ${contour.length}, внутри ${inner.length}, треугольников ${tris.length}`);
}
await br.close(); writeFileSync(out, JSON.stringify(res));
