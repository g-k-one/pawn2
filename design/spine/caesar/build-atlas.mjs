// Цезарь v2: атлас из частей лица (face-sheet), тела (parts-sheet), гладиаторов, кадров молнии. Пишет assets/caesar/caesar.atlas+webp и parts.json (размеры).
import { chromium } from 'file:///C:/Users/gk_on/Desktop/pawn/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const SC = 'C:/Users/gk_on/AppData/Local/Temp/claude/C--Users-gk-on-Desktop-pawn/27b0a0a0-1c02-4a55-9668-daa736843eaa/scratchpad';
const PROJ = 'C:/Users/gk_on/Desktop/pawn', OUT = PROJ + '/assets/caesar', SRC = PROJ + '/design/spine/caesar/images';
mkdirSync(SRC, { recursive: true });
const FC = SC + '/face-cut/part-', b64 = f => 'data:image/png;base64,' + readFileSync(f).toString('base64');
// имя → [файл, масштаб региона]
const RF = .5, RB = .7, RG = .45;
const parts = {
  head: [FC + '0.png', RF], jaw: [FC + '2.png', RF], lipUp: [FC + '3.png', RF], wreathL: [FC + '4.png', RF], lidL: [FC + '5.png', RF], browL: [FC + '6.png', RF],
  eyeL: [FC + '7.png', RF], mouthIn: [FC + '8.png', RF], wreathR: [FC + '9.png', RF], browR: [FC + '10.png', RF], lidR: [FC + '11.png', RF], eyeR: [FC + '12.png', RF],
  torso: [SC + '/caesar-cut/part-1.png', RB], armL: [SC + '/caesar-cut/part-0.png', RB], armR: [SC + '/caesar-cut/part-4.png', RB],
  gSword: [SC + '/gback-cut/part-0.png', RG], gSpear: [SC + '/gback-cut/part-1.png', RG],
};
const b = await chromium.launch(); const p = await b.newPage();
const r = await p.evaluate(async ({ parts, bolt }) => {
  const load = async s => { const im = new Image(); im.src = s; await im.decode(); return im; };
  const cv = (w, h) => { const c = new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); return [c, c.getContext('2d')]; };
  const enc = async (c, type = 'image/png', q) => { const bl = await c.convertToBlob({ type, quality: q }); const u = new Uint8Array(await bl.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); };
  const img = {}, orig = {};
  // мягкие стыки: альфа × маска(x, y) на исходнике (пиксели листа лица)
  const feather = (im, fn) => { const [c, x] = cv(im.width, im.height); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height), q = d.data, W = c.width, H = c.height;
    for (let y = 0; y < H; y++) for (let i = 0; i < W; i++){ const k = fn(i, y, W, H); if (k < 1) q[(y * W + i) * 4 + 3] *= Math.max(0, k); } x.putImageData(d, 0, 0); return c; };
  const cl = v => Math.max(0, Math.min(1, v)), keep = (dx, a, b) => cl((b - Math.abs(dx)) / (b - a));
  const FIX = {
    // низ головы растворяется в щёки, кроме носа
    head: (x, y, W, H) => Math.min(1, cl((H - 6 - y) / 34) + keep(x - W / 2, 55, 95)),
    // у челюсти растворяются верхние углы и бока; губа и зубы по центру — чёткие
    jaw: (x, y, W, H) => Math.min(1, cl(y / 46) + keep(x - W / 2, 105, 140)) * cl(Math.min(x, W - x) / 22),
  };
  for (const k in parts){ let im = await load(parts[k][0]); const s = parts[k][1]; orig[k] = [im.width, im.height]; if (FIX[k]) im = feather(im, FIX[k]);
    const [c, x] = cv(im.width * s, im.height * s); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height); img[k] = c; }
  // щёки: кожа с низа головы (слева и справа от носа), вытянутая вниз; форма — по овалу лица, края мягкие
  { const H = await load(parts.head[0]), [c, x] = cv(560, 330), w = 560, h = 330;
    for (let y = 0; y < h; y++){ x.drawImage(H, 70, 498, 200, 8, 0, y, w / 2 + 1, 1.3); x.drawImage(H, H.width - 270, 498, 200, 8, w / 2, y, w / 2, 1.3); }
    const m = feather(c, (i, y) => { const t = y / h, hw = 225 - 60 * t * t; return cl((hw - Math.abs(i - w / 2)) / 10) * cl((h - y) / 40); });
    const [c2, x2] = cv(w * .5, h * .5); x2.drawImage(m, 0, 0, c2.width, c2.height); img.cheek = c2; orig.cheek = [560, 330]; }
  // свечение (глаза, точка удара)
  { const [c, x] = cv(128, 128), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(235,250,255,1)'); g.addColorStop(.2, 'rgba(150,215,255,.85)'); g.addColorStop(.55, 'rgba(60,140,255,.3)'); g.addColorStop(1, 'rgba(30,80,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); img.glow = c; orig.glow = [128, 128]; }
  // молния: 6 кадров по 256×864 → 128×432
  { const L = await load(bolt); for (let i = 0; i < 6; i++){ const [c, x] = cv(128, 432); x.imageSmoothingQuality = 'high'; x.drawImage(L, i * 256, 0, 256, 864, 0, 0, 128, 432);
      // края кадра растворяем: у яркого кадра свечение упиралось в рамку и в режиме additive давало прямоугольник
      img['bolt' + (i + 1)] = feather(c, (px, py, W, H) => cl(py / (H * .1)) * cl((H - py) / (H * .05)) * cl(Math.min(px, W - px) / (W * .22))); orig['bolt' + (i + 1)] = [256, 864]; } }
  const src = {}; for (const k in img) src[k] = await enc(img[k]);
  const order = Object.keys(img).sort((u, v) => img[v].height - img[u].height || img[v].width - img[u].width), W = 2048, pad = 2, pos = {};
  let x0 = pad, y0 = pad, sh = 0;
  for (const k of order){ const c = img[k]; if (x0 + c.width + pad > W){ x0 = pad; y0 += sh + pad; sh = 0; } pos[k] = [x0, y0, c.width, c.height]; x0 += c.width + pad; sh = Math.max(sh, c.height); }
  const AH = y0 + sh + pad, [ac, ax] = cv(W, AH); for (const k of order) ax.drawImage(img[k], pos[k][0], pos[k][1]);
  return { pos, AH, W, orig, atlas: await enc(ac, 'image/webp', .9), src };
}, { parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, [b64(v[0]), v[1]]])), bolt: b64(PROJ + '/design/spine/caesar/lightning-sheet.png') });
await b.close();
writeFileSync(OUT + '/caesar.webp', Buffer.from(r.atlas, 'base64'));
for (const k in r.src) writeFileSync(`${SRC}/${k}.png`, Buffer.from(r.src[k], 'base64'));
writeFileSync(OUT + '/caesar.atlas', ['caesar.webp', `size:${r.W},${r.AH}`, 'filter:Linear,Linear', 'pma:false', ...Object.entries(r.pos).flatMap(([k, [x, y, w, h]]) => [k, `bounds:${x},${y},${w},${h}`])].join('\n') + '\n');
writeFileSync(SC + '/c2-parts.json', JSON.stringify({ pos: r.pos, orig: r.orig }));
console.log(r.W, r.AH, JSON.stringify(r.orig));
