// Картинки для тестовых сцен: листы Magnific (src/expr.png, src/arms.png) → img/*.webp + img/parts.json
// Части режет ../../spine/cut.mjs; имена — по положению на листе (ряды сверху вниз, в ряду слева направо).
// Голову Цезаря, свечение и кадры молний/удара берём из ../caesar/img.
import { chromium } from 'file:///C:/Users/gk_on/Desktop/pawn/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), out = `${dir}img/`;
const cut = s => { const d = `${dir}src/cut/${s}`;
  return execFileSync('node', [`${dir}../../spine/cut.mjs`, `${dir}src/${s}.png`, d, '1500']).toString().trim().split('\n').map(l => { const [i, x, y, w, h] = l.split(' ').map(Number); return { f: `${d}/part-${i}.png`, x, y, w, h, cx: x + w / 2, cy: y + h / 2 }; }); };
const rows = (ps, n) => { const s = [...ps].sort((a, b) => a.cy - b.cy), out = []; let cur = [];   // ряды — по разрывам в y
  s.forEach((p, i) => { if (cur.length && p.cy - cur[cur.length - 1].cy > 120){ out.push(cur); cur = []; } cur.push(p); }); out.push(cur);
  if (out.length !== n) throw new Error(`рядов ${out.length}, ждали ${n}`); return out.map(r => r.sort((a, b) => a.cx - b.cx)); };
rmSync(out, { recursive: true, force: true }); mkdirSync(out);
const jobs = [];
// лицо: рты, пары глаз (с бровями), пары бровей
const [mo, ey, br] = rows(cut('expr'), 3);
['mSmirk', 'mGrin', 'mHa', 'mRoar', 'mO'].forEach((n, i) => jobs.push({ n, f: mo[i].f, soft: 22 }));
['eOpen', 'eLaugh', 'eAngry', 'eShock', 'eBlink'].forEach((n, i) => jobs.push({ n, f: ey[i].f, soft: 22 }));
['bNeutralL', 'bNeutralR', 'bRaiseL', 'bRaiseR', 'bAngryL', 'bAngryR'].forEach((n, i) => jobs.push({ n, f: br[i].f }));
// руки: прямые — высокие, согнутые — широкие внизу, кулаки — маленькие вверху, ладони — посередине
const A = cut('arms'), by = (f, s) => A.filter(f).sort(s);
const straight = by(p => p.h > 600, (a, b) => a.cx - b.cx), bent = by(p => p.w > 400 && p.h <= 600, (a, b) => a.cx - b.cx);
const small = by(p => p.h <= 600 && p.w <= 400, (a, b) => a.cy - b.cy || a.cx - b.cx), fists = small.slice(0, 2).sort((a, b) => a.cx - b.cx), hands = small.slice(2, 4).sort((a, b) => a.cx - b.cx);
[['armL', straight[0]], ['armR', straight[1]], ['bentL', bent[0]], ['bentR', bent[1]], ['fistL', fists[0]], ['fistR', fists[1]], ['handL', hands[0]], ['handR', hands[1]]].forEach(([n, p]) => jobs.push({ n, f: p.f }));
// вторые листы: руки целиком в 4 позах (верхний ряд), набор лица (образец, основа, черты без кожи вокруг)
const A2 = cut('arms2').filter(p => p.cy < 700).sort((a, b) => a.cx - b.cx);
['poseHang', 'poseFist', 'poseStop', 'poseUp'].forEach((n, i) => jobs.push({ n, f: A2[i].f }));
const F2 = cut('face2'), big = F2.filter(p => p.h > 500).sort((a, b) => a.cx - b.cx), mid = F2.filter(p => p.h < 500 && p.cy < 1000).sort((a, b) => a.cx - b.cx), low = F2.filter(p => p.h < 500 && p.cy >= 1000).sort((a, b) => a.cx - b.cx);
const KIT = { ref: big[0], base: big[1] };
['browNL', 'browNR', 'browAL', 'browAR', 'eyeL', 'eyeR', 'lidL', 'lidR', 'laughL', 'laughR'].forEach((n, i) => KIT[n] = mid[i]);
['kSmirk', 'kGrin', 'kHa', 'kRoar', 'kO'].forEach((n, i) => KIT[n] = low[i]);
for (const [n, p] of Object.entries(KIT)) jobs.push({ n: n.startsWith('k') || n === 'ref' || n === 'base' ? (n === 'ref' ? 'kitRef' : n === 'base' ? 'kitBase' : n) : 'kit' + n[0].toUpperCase() + n.slice(1), f: p.f });
// третий лист: лысая основа, шапка волос, венок двумя половинами (слева направо)
const HP = cut('headparts').sort((a, b) => a.cx - b.cx);
['bald', 'hairCap', 'laurelL', 'laurelR'].forEach((n, i) => jobs.push({ n, f: HP[i].f }));
const S = .6;
const b = await chromium.launch(), pg = await b.newPage(), parts = {};
for (const j of jobs){
  const r = await pg.evaluate(async ({ data, s, soft }) => { const im = new Image(); im.src = data; await im.decode();
    const w = Math.round(im.width * s), h = Math.round(im.height * s), c = new OffscreenCanvas(w, h), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, w, h);
    if (soft){ // глубина от края силуэта (слоями) → прозрачность плавно растёт на первых soft px
      const d = x.getImageData(0, 0, w, h), a = d.data, dep = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) dep[i] = a[i * 4 + 3] > 128 ? 1 : 0;
      for (let k = 1; k < soft; k++) for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++){ const i = y * w + xx; if (dep[i] === k && dep[i - 1] >= k && dep[i + 1] >= k && dep[i - w] >= k && dep[i + w] >= k) dep[i] = k + 1; }
      for (let i = 0; i < w * h; i++){ const t = Math.min(1, dep[i] / soft); a[i * 4 + 3] = Math.round(a[i * 4 + 3] * t * t * (3 - 2 * t)); }
      x.putImageData(d, 0, 0); }
    const u8 = new Uint8Array(await (await c.convertToBlob({ type: 'image/webp', quality: .92 })).arrayBuffer()); let t = '';
    for (let i = 0; i < u8.length; i += 32768) t += String.fromCharCode(...u8.subarray(i, i + 32768)); return { w, h, b64: btoa(t) };
  }, { data: 'data:image/png;base64,' + readFileSync(j.f).toString('base64'), s: S, soft: Math.round((j.soft || 0) * S) });
  writeFileSync(`${out}${j.n}.webp`, Buffer.from(r.b64, 'base64')); parts[j.n] = { w: r.w, h: r.h, s: S };
}
await b.close();
const C = JSON.parse(readFileSync(`${dir}../caesar/img/parts.json`));
for (const f of readdirSync(`${dir}../caesar/img`)) if (/^(head|glow|bolt\d|impact\d|sky|wall|torso)\.webp$/.test(f)) copyFileSync(`${dir}../caesar/img/${f}`, `${out}${f}`);
for (const k of ['head', 'glow', 'bolt', 'impact', 'sky', 'wall', 'torso']) parts[k] = C[k];
writeFileSync(`${out}parts.json`, JSON.stringify(parts, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
console.log(Object.keys(parts).join(' '));
