// Подготовка картинок для сцены: листы из Magnific (src/*.png) → img/*.webp + img/parts.json (размеры, смещения кадров).
// node prep.mjs   (части с зелёного режет ../../spine/cut.mjs в src/cut/<лист>/part-N.png, порядок частей — по x, потом по y)
import { chromium } from 'file:///C:/Users/gk_on/Desktop/pawn/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const src = f => `${dir}src/${f}`, out = `${dir}img/`;
for (const s of ['face', 'body', 'glads']) if (!existsSync(src(`cut/${s}/part-0.png`)))
  execFileSync('node', [`${dir}../../spine/cut.mjs`, src(`${s}.png`), src(`cut/${s}`), '3000'], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out);

// имена частей по номеру (см. порядок cut.mjs); L/R — сторона на экране
const FACE = ['head', 'mouthClosed', 'wreathL', 'browL', 'lidL', 'laughL', 'eyeL', 'mouthOpen', 'wreathR', 'lidR', 'browR', 'eyeR', 'laughR'];
const BODY = ['fistL', 'foreL', 'upperL', 'handL', 'torso', 'handR', 'upperR', 'foreR', 'fistR'];
const GLAD = ['gSword', 'gSpear'];
// правки рисунка (пиксели вырезанной части): проймы туники — прозрачные (рука выходит из-под ткани),
// «срез» сустава на плече — закрасить кожей вокруг (иначе он читается как дыра)
const FIX = { torso: { erase: [[20, 193, 34, 104], [585, 193, 34, 104]] }, upperL: { fill: [[222, 98, 34, 88]] }, upperR: { fill: [[23, 98, 34, 88]] } };
// масштаб текстур: экран ×2 (лицо на экране мельче тела, гладиаторы — ещё мельче)
const jobs = [
  ...FACE.map((n, i) => ({ n, f: src(`cut/face/part-${i}.png`), s: .6 })),
  ...BODY.map((n, i) => ({ n, f: src(`cut/body/part-${i}.png`), s: 1, ...FIX[n] })),
  ...GLAD.map((n, i) => ({ n, f: src(`cut/glads/part-${i}.png`), s: .6 })),
  { n: 'glow', glow: 256 },
  { n: 'sky', f: src('sky.png'), w: 820, q: .86 },
  { n: 'wall', f: src('wall.png'), w: 820, key: 'top', q: .9 },
  { n: 'bolt', f: src('bolts1.png'), grid: [4, 2], s: .75 },
  { n: 'impact', f: src('impact.png'), grid: [4, 2], s: .6 },
];
const b = await chromium.launch(), p = await b.newPage(), info = {};
for (const j of jobs){
  const res = await p.evaluate(async ({ j, data }) => {
    const enc0 = async c => { const u8 = new Uint8Array(await (await c.convertToBlob({ type: 'image/webp', quality: .9 })).arrayBuffer());
      let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode(...u8.subarray(i, i + 32768)); return btoa(s); };
    if (j.glow){ // свечение глаз: мягкий круг белый → голубой → прозрачный (режим additive)
      const n = j.glow, c = new OffscreenCanvas(n, n), x = c.getContext('2d'), g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.18, 'rgba(200,240,255,.95)'); g.addColorStop(.45, 'rgba(70,170,255,.45)'); g.addColorStop(1, 'rgba(20,60,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, n, n); return { w: n, h: n, b64: await enc0(c) }; }
    const im = new Image(); im.src = data; await im.decode();
    const enc = async (c, q) => { const u8 = new Uint8Array(await (await c.convertToBlob({ type: 'image/webp', quality: q })).arrayBuffer());
      let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode(...u8.subarray(i, i + 32768)); return btoa(s); };
    const scaled = (img, w, h) => { const c = new OffscreenCanvas(w, h), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h); return c; };
    if (j.grid){ // кадры на чёрном: ячейки сетки → прозрачность по яркости, обрезка по содержимому, смещение от угла ячейки
      const [gc, gr] = j.grid, cw = im.width / gc, ch = im.height / gr, frames = [];
      for (let r = 0; r < gr; r++) for (let c = 0; c < gc; c++){
        const cv = new OffscreenCanvas(cw | 0, ch | 0), x = cv.getContext('2d'); x.drawImage(im, -c * cw, -r * ch);
        const d = x.getImageData(0, 0, cv.width, cv.height), a = d.data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (let i = 0; i < a.length; i += 4){ let m = Math.max(a[i], a[i + 1], a[i + 2]); m = m < 14 ? 0 : (m - 14) * 255 / 241;   // чёрный «шум» → 0
          const k = Math.max(a[i], a[i + 1], a[i + 2]) || 1; a[i] = a[i] * 255 / k; a[i + 1] = a[i + 1] * 255 / k; a[i + 2] = a[i + 2] * 255 / k; a[i + 3] = m;
          if (m > 8){ const px = (i / 4) % cv.width, py = (i / 4 / cv.width) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; } }
        x.putImageData(d, 0, 0); x0 = Math.max(0, x0 - 4); y0 = Math.max(0, y0 - 4); x1 = Math.min(cv.width - 1, x1 + 4); y1 = Math.min(cv.height - 1, y1 + 4);
        const cr = new OffscreenCanvas(x1 - x0 + 1, y1 - y0 + 1); cr.getContext('2d').drawImage(cv, -x0, -y0);
        const w = Math.round(cr.width * j.s), h = Math.round(cr.height * j.s);
        frames.push({ w, h, cx: (x0 + cr.width / 2) * j.s, cy: (y0 + cr.height / 2) * j.s, b64: await enc(scaled(cr, w, h), .9) }); }
      return { cell: [cw * j.s, ch * j.s], frames };
    }
    let srcIm = im;
    if (j.erase || j.fill){ // правки в пикселях части до масштаба
      const c0 = new OffscreenCanvas(im.width, im.height), x0 = c0.getContext('2d'); x0.drawImage(im, 0, 0);
      const d = x0.getImageData(0, 0, im.width, im.height), a = d.data, IW = im.width, IH = im.height;
      const inE = ([cx, cy, rx, ry], x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
      for (const e of j.erase || []) for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) if (inE(e, x, y)){
        const r = Math.sqrt(((x - e[0]) / e[2]) ** 2 + ((y - e[1]) / e[3]) ** 2); a[(y * IW + x) * 4 + 3] *= Math.min(1, Math.max(0, (r - .8) / .2)); }
      for (const e of j.fill || []){ // гармоническая заливка: значения с края эллипса диффундируют внутрь (гладкая кожа)
        const pts = []; for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) if (inE(e, x, y) && a[(y * IW + x) * 4 + 3] > 0) pts.push(y * IW + x);
        const isIn = new Uint8Array(IW * IH); pts.forEach(p => isIn[p] = 1);
        const ok = p => p >= 0 && p < IW * IH && a[p * 4 + 3] > 200;
        for (let it = 0; it < 600; it++) for (const p of pts){ let s0 = 0, s1 = 0, s2 = 0, n = 0;
          for (const q of [p - 1, p + 1, p - IW, p + IW]) if (ok(q)){ s0 += a[q * 4]; s1 += a[q * 4 + 1]; s2 += a[q * 4 + 2]; n++; }
          if (n){ a[p * 4] = s0 / n; a[p * 4 + 1] = s1 / n; a[p * 4 + 2] = s2 / n; } a[p * 4 + 3] = Math.max(a[p * 4 + 3], 255); } }
      x0.putImageData(d, 0, 0); srcIm = c0; }
    let w = j.w || Math.round(im.width * j.s), h = Math.round(im.height * w / im.width), c = scaled(srcIm, w, h);
    if (j.key === 'top'){ // стена: зелёный убираем только в верхней половине (растения на стене не трогаем)
      const x = c.getContext('2d'), d = x.getImageData(0, 0, w, h), a = d.data;
      for (let i = 0; i < a.length; i += 4){ if ((i / 4 / w) > h * .5) break; const m = Math.max(a[i], a[i + 2]), k = a[i + 1] - m;
        a[i + 3] = Math.round(Math.max(0, Math.min(1, 1 - (k - 25) / 70)) * 255); if (k > 0) a[i + 1] = m; }
      x.putImageData(d, 0, 0); }
    return { w, h, b64: await enc(c, j.q || .92) };
  }, { j, data: j.f ? 'data:image/png;base64,' + readFileSync(j.f).toString('base64') : '' });
  if (res.frames){ res.frames.forEach((f, i) => writeFileSync(`${out}${j.n}${i}.webp`, Buffer.from(f.b64, 'base64')));
    info[j.n] = { cell: res.cell, frames: res.frames.map(({ w, h, cx, cy }) => ({ w, h, cx, cy })) }; }
  else { writeFileSync(`${out}${j.n}.webp`, Buffer.from(res.b64, 'base64')); info[j.n] = { w: res.w, h: res.h, s: j.s || res.w / 1 }; }
}
await b.close();
writeFileSync(`${out}parts.json`, JSON.stringify(info, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
console.log(Object.keys(info).length, 'parts');
