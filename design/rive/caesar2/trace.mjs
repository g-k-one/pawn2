// Растр → вектор: вырезка частей с хромакея и трассировка каждой в цветные контуры (imagetracerjs, Unlicense).
// node trace.mjs <лист.png> <out.json> [minArea]
// Выход: [{ i, box:[x,y,w,h], layers:[{ color:'AARRGGBB', paths:[{ hole:bool, segs:[[type,x1,y1,x2,y2(,x3,y3)]...] }] }] }]
import { chromium } from 'file:///C:/Users/gk_on/Desktop/pawn/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const TRACER = 'C:/Users/gk_on/AppData/Local/Temp/claude/C--Users-gk-on-Desktop-pawn/27b0a0a0-1c02-4a55-9668-daa736843eaa/scratchpad/tracer/package/imagetracer_v1.2.6.js';
const [, , inp, out, minA = '1500'] = process.argv;
const b = await chromium.launch(); const p = await b.newPage();
await p.setContent('<body></body>'); await p.addScriptTag({ content: readFileSync(TRACER, 'utf8') });
const res = await p.evaluate(async ({ src, minA }) => {
  const im = new Image(); im.src = src; await im.decode();
  const W = im.width, H = im.height, c = new OffscreenCanvas(W, H), x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, W, H), a = d.data;
  // хромакей: зелёный → прозрачность, кайма без зелёного отлива
  for (let i = 0; i < a.length; i += 4){ const k = a[i + 1] - Math.max(a[i], a[i + 2]); const al = Math.max(0, Math.min(1, 1 - (k - 25) / 70)); a[i + 3] = Math.round(al * 255); if (k > 0) a[i + 1] = Math.max(a[i], a[i + 2]); }
  // связные куски
  const lab = new Int32Array(W * H), boxes = []; let n = 0;
  for (let s = 0; s < W * H; s++){ if (lab[s] || a[s * 4 + 3] < 128) continue; n++; const st = [s]; lab[s] = n; let x0 = W, y0 = H, x1 = 0, y1 = 0, cnt = 0;
    while (st.length){ const q = st.pop(), qx = q % W, qy = (q / W) | 0; cnt++; if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
      for (const nb of [q - 1, q + 1, q - W, q + W]){ if (nb < 0 || nb >= W * H || lab[nb]) continue; if ((nb === q - 1 && qx === 0) || (nb === q + 1 && qx === W - 1)) continue; if (a[nb * 4 + 3] >= 128){ lab[nb] = n; st.push(nb); } } }
    if (cnt >= minA) boxes.push({ n, x0, y0, x1, y1 }); }
  const out = [];
  for (const bx of boxes){ const pad = 3, X = Math.max(0, bx.x0 - pad), Y = Math.max(0, bx.y0 - pad), w = Math.min(W, bx.x1 + pad + 1) - X, h = Math.min(H, bx.y1 + pad + 1) - Y;
    const sub = new ImageData(w, h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++){ const gi = (Y + yy) * W + X + xx, si = (yy * w + xx) * 4, l = lab[gi];
      if (l && l !== bx.n) continue; for (let k = 0; k < 4; k++) sub.data[si + k] = a[gi * 4 + k];
      if (sub.data[si + 3] < 128) sub.data[si + 3] = 0; else sub.data[si + 3] = 255; }      // жёсткий край: вектору не нужна полупрозрачная кайма
    const td = ImageTracer.imagedataToTracedata(sub, { numberofcolors: 14, colorsampling: 2, colorquantcycles: 4, mincolorratio: 0, ltres: .6, qtres: .6, pathomit: 12, blurradius: 0, rightangleenhance: false, linefilter: true, roundcoords: 2 });
    const layers = [];
    td.layers.forEach((L, li) => { const cc = td.palette[li]; if (cc.a < 128) return;
      const paths = L.map(pp => ({ hole: !!pp.isholepath, segs: pp.segments.map(s => s.type === 'L' ? ['L', s.x1, s.y1, s.x2, s.y2] : ['Q', s.x1, s.y1, s.x2, s.y2, s.x3, s.y3]) })).filter(q => q.segs.length > 2);
      if (paths.length) layers.push({ color: 'FF' + [cc.r, cc.g, cc.b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase(), paths }); });
    out.push({ box: [X, Y, w, h], layers }); }
  return out;
}, { src: 'data:image/png;base64,' + readFileSync(inp).toString('base64'), minA: +minA });
res.sort((u, v) => u.box[1] - v.box[1] || u.box[0] - v.box[0]); res.forEach((r, i) => r.i = i);
writeFileSync(out, JSON.stringify(res));
for (const r of res) console.log(r.i, r.box.join(','), 'layers', r.layers.length, 'paths', r.layers.reduce((s, l) => s + l.paths.length, 0), 'segs', r.layers.reduce((s, l) => s + l.paths.reduce((t, q) => t + q.segs.length, 0), 0));
await b.close();
