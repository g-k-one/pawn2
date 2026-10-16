// Векторизация с градиентами: node vectorize.mjs in.webp out.svg [порог краёв=14] [мин. площадь=40]
// Не трассировка по палитре: области делятся по РЕЗКИМ границам (контур, край материала), плавная светотень
// внутри области заменяется линейным градиентом, подобранным методом наименьших квадратов.
// Если градиент описывает область плохо — область делится на две по цвету, и так рекурсивно.
// Соседние области чуть заходят друг на друга (нахлёст), чтобы не было щелей.
import { chromium } from 'file:///C:/Users/gk_on/Desktop/pawn/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const [, , inp, out, EDGE = '14', MINA = '40', EPS = '1.6', RMS = '14', SOFTA = '0', BND = '6', STEPA = '0', SHBA = '4'] = process.argv; const SOFT = +SOFTA, STEP = +STEPA, SHB = +SHBA;

// ---------- пиксели ----------
const br = await chromium.launch(), pg = await br.newPage();
const { w, h, b64 } = await pg.evaluate(async src => { const i = new Image(); i.src = src; await i.decode();
  const c = new OffscreenCanvas(i.width, i.height), x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(0, 0, i.width, i.height).data;
  let s = ''; for (let k = 0; k < d.length; k += 32768) s += String.fromCharCode(...d.subarray(k, k + 32768)); return { w: i.width, h: i.height, b64: btoa(s) }; },
  'data:image/' + (inp.endsWith('.png') ? 'png' : 'webp') + ';base64,' + readFileSync(inp).toString('base64'));
await br.close();
const px = Buffer.from(b64, 'base64'), N = w * h;
// цвет в линейном Lab-подобном пространстве для расстояний (быстро: sRGB → линейный → «L, a, b» грубо)
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const LAB = new Float32Array(N * 3), A = new Uint8Array(N);
for (let i = 0; i < N; i++){ const r = lin(px[i * 4]), g = lin(px[i * 4 + 1]), b = lin(px[i * 4 + 2]); A[i] = px[i * 4 + 3];
  const X = .4124 * r + .3576 * g + .1805 * b, Y = .2126 * r + .7152 * g + .0722 * b, Z = .0193 * r + .1192 * g + .9505 * b;
  const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116, fx = f(X / .9505), fy = f(Y), fz = f(Z / 1.089);
  LAB[i * 3] = 116 * fy - 16; LAB[i * 3 + 1] = 500 * (fx - fy); LAB[i * 3 + 2] = 200 * (fy - fz); }

// ---------- резкие границы: разница Lab между соседями через 2 px (плавная светотень её не превышает) ----------
const edge = new Uint8Array(N), T = +EDGE;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const i = y * w + x; if (A[i] < 128){ edge[i] = 1; continue; }
  let m = 0; for (const [dx, dy] of [[2, 0], [0, 2], [-2, 0], [0, -2]]){ const X2 = x + dx, Y2 = y + dy; if (X2 < 0 || Y2 < 0 || X2 >= w || Y2 >= h) continue; const j = Y2 * w + X2; if (A[j] < 128) continue;
    const d = Math.hypot(LAB[i * 3] - LAB[j * 3], LAB[i * 3 + 1] - LAB[j * 3 + 1], LAB[i * 3 + 2] - LAB[j * 3 + 2]); if (d > m) m = d; }
  if (m > T) edge[i] = 1; }

// ---------- области: связные куски без резких границ; пиксели границ отходят ближайшей по цвету соседней области ----------
const lab = new Int32Array(N).fill(-1); let R = 0; const sizes = [];
for (let s = 0; s < N; s++){ if (edge[s] || lab[s] >= 0) continue; const st = [s]; lab[s] = R; let c = 0;
  while (st.length){ const q = st.pop(); c++; const x = q % w, y = (q / w) | 0; for (const n of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]){ if (n < 0 || n >= N || edge[n] || lab[n] >= 0) continue; lab[n] = R; st.push(n); } }
  sizes.push(c); R++; }
// мелкие области и границы — раздаём соседям (несколько проходов)
for (let i = 0; i < N; i++) if (lab[i] >= 0 && sizes[lab[i]] < +MINA) lab[i] = -1;
for (let pass = 0; pass < 60; pass++){ let changed = 0; const nl = lab.slice();
  for (let i = 0; i < N; i++){ if (lab[i] >= 0 || A[i] < 128) continue; const x = i % w; let best = -1, bd = 1e9;
    for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]){ if (n < 0 || n >= N || lab[n] < 0) continue;
      const d = Math.hypot(LAB[i * 3] - LAB[n * 3], LAB[i * 3 + 1] - LAB[n * 3 + 1], LAB[i * 3 + 2] - LAB[n * 3 + 2]); if (d < bd){ bd = d; best = lab[n]; } }
    if (best >= 0){ nl[i] = best; changed++; } }
  lab.set(nl); if (!changed) break; }

// ---------- градиент на область: цвет = c0 + gx·x + gy·y (по каналам sRGB), наименьшие квадраты ----------
function fit(ids){ let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; const sc = [0, 0, 0], scx = [0, 0, 0], scy = [0, 0, 0];
  for (const i of ids){ const x = i % w, y = (i / w) | 0; n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    for (let c = 0; c < 3; c++){ const v = px[i * 4 + c]; sc[c] += v; scx[c] += v * x; scy[c] += v * y; } }
  const mx = sx / n, my = sy / n, vxx = sxx / n - mx * mx, vyy = syy / n - my * my, vxy = sxy / n - mx * my, det = vxx * vyy - vxy * vxy || 1e-9;
  const g = [0, 1, 2].map(c => { const mc = sc[c] / n, cx = scx[c] / n - mx * mc, cy = scy[c] / n - my * mc;
    return { c0: mc, gx: (cx * vyy - cy * vxy) / det, gy: (cy * vxx - cx * vxy) / det }; });
  let err = 0; for (const i of ids){ const x = i % w - mx, y = ((i / w) | 0) - my; for (let c = 0; c < 3; c++){ const p = g[c].c0 + g[c].gx * x + g[c].gy * y; err += (px[i * 4 + c] - p) ** 2; } }
  return { n, mx, my, g, rms: Math.sqrt(err / (n * 3)) }; }
// делим плохо описанную область на две по цвету (k-means, 2 центра) и связности
function split(ids){ let a = ids[0], b = ids[ids.length - 1], ca, cb;
  const col = i => [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
  ca = col(a); cb = col(b); let A1 = [], B1 = [];
  for (let it = 0; it < 6; it++){ A1 = []; B1 = []; for (const i of ids){ const c = col(i); (Math.hypot(c[0] - ca[0], c[1] - ca[1], c[2] - ca[2]) < Math.hypot(c[0] - cb[0], c[1] - cb[1], c[2] - cb[2]) ? A1 : B1).push(i); }
    if (!A1.length || !B1.length) break; const m = s => [0, 1, 2].map(c => s.reduce((t, i) => t + px[i * 4 + c], 0) / s.length); ca = m(A1); cb = m(B1); }
  return [A1, B1].filter(s => s.length); }
// ---------- слияние: соседние области объединяются, пока ОДИН градиент описывает их с ошибкой < MERGE ----------
// статистика области — суммы для наименьших квадратов, поэтому ошибку объединения считаем без обхода пикселей
const ST = new Map(); const st = l => ST.get(l) || ST.set(l, { n: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0, s: [0, 0, 0], sxv: [0, 0, 0], syv: [0, 0, 0], svv: [0, 0, 0] }).get(l);
for (let i = 0; i < N; i++){ const l = lab[i]; if (l < 0) continue; const t = st(l), x = i % w, y = (i / w) | 0; t.n++; t.sx += x; t.sy += y; t.sxx += x * x; t.syy += y * y; t.sxy += x * y;
  for (let c = 0; c < 3; c++){ const v = px[i * 4 + c]; t.s[c] += v; t.sxv[c] += v * x; t.syv[c] += v * y; t.svv[c] += v * v; } }
const sum = (a, b) => ({ n: a.n + b.n, sx: a.sx + b.sx, sy: a.sy + b.sy, sxx: a.sxx + b.sxx, syy: a.syy + b.syy, sxy: a.sxy + b.sxy, s: a.s.map((v, c) => v + b.s[c]), sxv: a.sxv.map((v, c) => v + b.sxv[c]), syv: a.syv.map((v, c) => v + b.syv[c]), svv: a.svv.map((v, c) => v + b.svv[c]) });
const rmsOf = t => { const n = t.n, mx = t.sx / n, my = t.sy / n, Cxx = t.sxx - n * mx * mx, Cyy = t.syy - n * my * my, Cxy = t.sxy - n * mx * my, det = Cxx * Cyy - Cxy * Cxy;
  let sse = 0; for (let c = 0; c < 3; c++){ const mv = t.s[c] / n, Cxv = t.sxv[c] - n * mx * mv, Cyv = t.syv[c] - n * my * mv, Cvv = t.svv[c] - n * mv * mv;
    if (Math.abs(det) < 1e-6){ sse += Cvv; continue; } const gx = (Cxv * Cyy - Cyv * Cxy) / det, gy = (Cyv * Cxx - Cxv * Cxy) / det; sse += Math.max(0, Cvv - gx * Cxv - gy * Cyv); }
  return Math.sqrt(sse / (n * 3)); };
const parentOf = new Map(); const find = l => { let r = l; while (parentOf.has(r)) r = parentOf.get(r); return r; };
// граница между областями: средняя разница цвета (Lab) по парам соседних пикселей на стыке
const dE = (i, j) => Math.hypot(LAB[i * 3] - LAB[j * 3], LAB[i * 3 + 1] - LAB[j * 3 + 1], LAB[i * 3 + 2] - LAB[j * 3 + 2]);
let adj = new Map(); const ek = (l, m) => l < m ? l + ':' + m : m + ':' + l;
for (let i = 0; i < N; i++){ const l = lab[i]; if (l < 0) continue; const x = i % w; for (const n of [x < w - 1 ? i + 1 : -1, i + w]){ if (n < 0 || n >= N) continue; const m = lab[n]; if (m < 0 || m === l) continue;
  const k = ek(l, m), e = adj.get(k) || adj.set(k, { s: 0, c: 0 }).get(k); e.s += dE(i, n); e.c++; } }
const MERGE = +RMS, BOUND = +BND;
for (let round = 0; round < 4000; round++){ let best = null, bv = 1e9;
  for (const [k, e] of adj){ if (e.s / e.c > BOUND) continue; const [a, b] = k.split(':').map(Number), v = rmsOf(sum(ST.get(a), ST.get(b))); if (v < MERGE && v < bv){ bv = v; best = [a, b]; } }
  if (!best) break; const [a, b] = best; ST.set(a, sum(ST.get(a), ST.get(b))); ST.delete(b); parentOf.set(b, a);
  const na = new Map(); for (const [k, e] of adj){ const [x, y] = k.split(':').map(Number), rx = find(x), ry = find(y); if (rx === ry) continue; const k2 = ek(rx, ry), t = na.get(k2) || na.set(k2, { s: 0, c: 0 }).get(k2); t.s += e.s; t.c += e.c; } adj = na; }
for (let i = 0; i < N; i++) if (lab[i] >= 0) lab[i] = find(lab[i]);
const groups = new Map(); for (let i = 0; i < N; i++) if (lab[i] >= 0){ (groups.get(lab[i]) || groups.set(lab[i], []).get(lab[i])).push(i); }
const regions = [];
const take = (ids, depth) => { const f = fit(ids); regions.push({ ids, f }); };
for (const ids of groups.values()) take(ids, 0);

// ---------- контур области: маска (+1 px нахлёст) → обход границы → упрощение → сглаженные кривые ----------
function contours(ids){ let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const i of ids){ const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  x0 -= 2; y0 -= 2; x1 += 2; y1 += 2; const W = x1 - x0 + 1, H = y1 - y0 + 1, m = new Uint8Array(W * H);
  for (const i of ids){ const x = i % w - x0, y = ((i / w) | 0) - y0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) m[(y + dy) * W + x + dx] = 1; }   // нахлёст 1 px
  const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x];
  // marching squares по узлам сетки: рёбра между заполненной и пустой клеткой, собранные в петли
  const segs = new Map(), key = (x, y) => x + ',' + y;
  const add = (ax, ay, bx, by) => { const k = key(ax, ay); (segs.get(k) || segs.set(k, []).get(k)).push([bx, by]); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){ if (!at(x, y)) continue;
    if (!at(x, y - 1)) add(x, y, x + 1, y); if (!at(x + 1, y)) add(x + 1, y, x + 1, y + 1); if (!at(x, y + 1)) add(x + 1, y + 1, x, y + 1); if (!at(x - 1, y)) add(x, y + 1, x, y); }
  const loops = [];
  // в узле, где сходятся две границы (касание по диагонали), берём поворот направо — петли не перепутываются
  while (segs.size){ const [k0] = segs.keys(); let [cx, cy] = k0.split(',').map(Number), px0 = cx, py0 = cy - 1; const loop = [];
    for (let guard = 0; guard < 1e6; guard++){ const nk = key(cx, cy), arr = segs.get(nk); if (!arr || !arr.length) break;
      let pick = 0; if (arr.length > 1){ const dx = cx - px0, dy = cy - py0; let best = -9; arr.forEach(([nx, ny], j) => { const ex = nx - cx, ey = ny - cy, turn = dx * ey - dy * ex; if (turn > best){ best = turn; pick = j; } }); }
      const [nx, ny] = arr.splice(pick, 1)[0]; if (!arr.length) segs.delete(nk); loop.push([cx + x0, cy + y0]); px0 = cx; py0 = cy; cx = nx; cy = ny; }
    if (loop.length > 6) loops.push(loop); }
  return loops; }
const rdp = (pts, eps) => { if (pts.length < 3) return pts; let dm = 0, idx = 0; const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1], L = Math.hypot(bx - ax, by - ay) || 1;
  for (let i = 1; i < pts.length - 1; i++){ const d = Math.abs((by - ay) * pts[i][0] - (bx - ax) * pts[i][1] + bx * ay - by * ax) / L; if (d > dm){ dm = d; idx = i; } }
  return dm > eps ? [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)] : [pts[0], pts[pts.length - 1]]; };
// замкнутая петля → кривые Безье по Катмулл-Рому (гладко, проходит через точки)
const smoothPath = loop => { const n = loop.length, P = i => loop[(i + n) % n]; let d = `M${P(0)[0].toFixed(1)} ${P(0)[1].toFixed(1)}`;
  for (let i = 0; i < n; i++){ const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), t = 1 / 6;
    d += `C${(p1[0] + (p2[0] - p0[0]) * t).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) * t).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * t).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) * t).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`; }
  return d + 'Z'; };

// ---------- SVG: большие области снизу, мелкие сверху ----------
regions.sort((a, b) => b.ids.length - a.ids.length);
const hex = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
let defs = '', body = '', grads = 0, shade = '', nShade = 0, bigBody = '', smallBody = '';
// замкнутую петлю упрощаем двумя половинами (от начала до самой дальней точки и обратно)
const simplify = (l, eps) => { let far = 0, dm = 0; for (let i = 1; i < l.length; i++){ const d = Math.hypot(l[i][0] - l[0][0], l[i][1] - l[0][1]); if (d > dm){ dm = d; far = i; } }
  return [...rdp(l.slice(0, far + 1), eps).slice(0, -1), ...rdp([...l.slice(far), l[0]], eps).slice(0, -1)]; };
regions.forEach((r, k) => { const loops = contours(r.ids).map(l => simplify(l, +EPS)).filter(l => l.length >= 3); if (!loops.length) return;
  const { g, mx, my } = r.f, gx = g.map(c => c.gx), gy = g.map(c => c.gy);
  // направление градиента — по сумме изменений каналов; концы — по проекции области
  let dx = gx.reduce((a, v) => a + Math.abs(v), 0) ? gx[0] + gx[1] + gx[2] : 0, dy = gy[0] + gy[1] + gy[2], L = Math.hypot(dx, dy);
  const col = (x, y) => '#' + g.map(c => hex(c.c0 + c.gx * (x - mx) + c.gy * (y - my))).join('');
  let fill;
  const strength = Math.hypot(...gx, ...gy);
  if (L > 1e-6 && strength > .08){ dx /= L; dy /= L; let lo = 1e9, hi = -1e9; for (const i of r.ids){ const t = (i % w - mx) * dx + (((i / w) | 0) - my) * dy; if (t < lo) lo = t; if (t > hi) hi = t; }
    const a = [mx + dx * lo, my + dy * lo], b = [mx + dx * hi, my + dy * hi];
    defs += `<linearGradient id="g${k}" gradientUnits="userSpaceOnUse" x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"><stop offset="0" stop-color="${col(...a)}"/><stop offset="1" stop-color="${col(...b)}"/></linearGradient>`;
    fill = `url(#g${k})`; grads++; }
  else fill = col(mx, my);
  const el = `<path d="${loops.map(smoothPath).join('')}" fill="${fill}" fill-rule="evenodd"${k && SOFT ? ' filter="url(#soft)"' : ''}/>`; body += el; if (r.ids.length >= 300) bigBody += el; else smallBody += el; });
// ---------- светотень: в каждой области — вложенные слои «темнее/светлее основы» с пером ----------
if (STEP > 0) regions.forEach((r, k) => { if (r.ids.length < 300) return; const { g, mx, my } = r.f;
  const Lfit = i => { const x = i % w - mx, y = ((i / w) | 0) - my; const rgb = g.map(c => c.c0 + c.gx * x + c.gy * y); return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]; };
  const res = new Map(); for (const i of r.ids){ const L = .2126 * px[i * 4] + .7152 * px[i * 4 + 1] + .0722 * px[i * 4 + 2]; res.set(i, L - Lfit(i)); }
  for (const sign of [-1, 1]) for (let lv = 1; lv <= 4; lv++){ const t = lv * STEP, ids = r.ids.filter(i => sign * res.get(i) > t); if (ids.length < 60) break;
    const avg = [0, 1, 2].map(c => ids.reduce((a, i) => a + px[i * 4 + c], 0) / ids.length);
    const loops = contours(ids).map(l => simplify(l, +EPS * 1.4)).filter(l => l.length >= 3); if (!loops.length) continue;
    shade += `<path d="${loops.map(smoothPath).join('')}" fill="#${avg.map(hex).join('')}" fill-rule="evenodd" filter="url(#shade)"/>`; nShade++; } });
if (STEP > 0) defs += `<filter id="shade" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${SHB}"/></filter>`;
if (SOFT) defs += `<filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${SOFT}"/></filter>`;
// слои светотени кладём над своей основой: проще — над всеми основами, но под мелкими деталями (глаза, брови) — они в body после крупных
writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${bigBody}${shade}${smallBody}</svg>`);
console.log('слоёв светотени', nShade);
console.log(`${w}×${h}: областей ${regions.length}, градиентов ${grads}, ${(Buffer.byteLength(body + defs) / 1024).toFixed(0)} КБ`);
