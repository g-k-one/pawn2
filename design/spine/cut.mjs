// Вырезка частей с хромакея: node cut.mjs <in.png> <outDir> [minArea]
// Убирает зелёный, ищет связные куски, сохраняет каждый в part-N.png и печатает рамки.
import { chromium } from 'file:///C:/Users/gk_on/Desktop/pawn/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const [, , inp, out, minA = '4000'] = process.argv;
mkdirSync(out, { recursive: true });
const b = await chromium.launch(); const p = await b.newPage();
const res = await p.evaluate(async ({ src, minA }) => {
  const im = new Image(); im.src = src; await im.decode();
  const W = im.width, H = im.height, c = new OffscreenCanvas(W, H), x = c.getContext('2d');
  x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, W, H), a = d.data;
  for (let i = 0; i < a.length; i += 4){ const r = a[i], g = a[i + 1], bl = a[i + 2], m = Math.max(r, bl), k = g - m;
    const al = Math.max(0, Math.min(1, 1 - (k - 25) / 70)); a[i + 3] = Math.round(al * 255);
    if (k > 0) a[i + 1] = m + Math.round(k * Math.max(0, al - .0) * 0) ; } // зелёный отлив → до max(r,b)
  x.putImageData(d, 0, 0);
  // связные куски по маске alpha > 128
  const lab = new Int32Array(W * H), boxes = []; let n = 0;
  for (let s = 0; s < W * H; s++){ if (lab[s] || a[s * 4 + 3] < 128) continue; n++; const st = [s]; lab[s] = n; let x0 = W, y0 = H, x1 = 0, y1 = 0, cnt = 0;
    while (st.length){ const q = st.pop(), qx = q % W, qy = (q / W) | 0; cnt++; if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
      for (const nb of [q - 1, q + 1, q - W, q + W]){ if (nb < 0 || nb >= W * H || lab[nb]) continue; if ((nb === q - 1 && qx === 0) || (nb === q + 1 && qx === W - 1)) continue; if (a[nb * 4 + 3] >= 128){ lab[nb] = n; st.push(nb); } } }
    if (cnt >= minA) boxes.push({ n, x0, y0, x1, y1, cnt }); }
  const outs = [];
  for (const bx of boxes){ const pad = 4, X = Math.max(0, bx.x0 - pad), Y = Math.max(0, bx.y0 - pad), w = Math.min(W, bx.x1 + pad + 1) - X, h = Math.min(H, bx.y1 + pad + 1) - Y;
    const cc = new OffscreenCanvas(w, h), cx = cc.getContext('2d'), sub = x.getImageData(X, Y, w, h);
    // оставить только свой кусок (+ полупрозрачная кайма рядом)
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++){ const gi = (Y + yy) * W + X + xx, l = lab[gi];
      if (l && l !== bx.n) sub.data[(yy * w + xx) * 4 + 3] = 0; }
    cx.putImageData(sub, 0, 0); const bl = await cc.convertToBlob({ type: 'image/png' });
    const u8 = new Uint8Array(await bl.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode(...u8.subarray(i, i + 32768));
    outs.push({ X, Y, w, h, cnt: bx.cnt, b64: btoa(s) }); }
  return outs;
}, { src: 'data:image/png;base64,' + readFileSync(inp).toString('base64'), minA: +minA });
res.sort((u, v) => u.X - v.X || u.Y - v.Y);
res.forEach((r, i) => { writeFileSync(`${out}/part-${i}.png`, Buffer.from(r.b64, 'base64')); console.log(i, r.X, r.Y, r.w, r.h, r.cnt); });
await b.close();
