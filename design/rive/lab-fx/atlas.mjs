// Атласы частиц — свой маленький атлас на каждый эффект: node atlas.mjs
// Источники (Magnific): src/masks.png — 12 «жёстких» ч/б масок 4×3; src/soft.png — 16 мягких мобильных масок 4×4;
// src/items.png — 8 цветных предметов 4×2 на чёрном (монеты, гемы, блики).
// Маска × цветовая ступень (gradient map): яркость маски = прозрачность, цвет = смешение тёмного и светлого цвета ступени.
// Выход: fx-<эффект>.webp (сжато) + atlases.luau — модуль с картой ячеек { cols, rows, map = { ['маска:ступень'] = номер } }.
import { chromium } from 'file:///C:/Users/gk_on/Desktop/pawn/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const SHEETS = {
  hard: { file: 'src/masks.png', cols: 4, rows: 3, names: ['smoke1', 'smoke2', 'flame1', 'flame2', 'star', 'glow', 'streak', 'ring', 'rune', 'arc', 'swirl', 'noise'] },
  soft: { file: 'src/soft.png', cols: 4, rows: 4, names: ['puff', 'puffS', 'sflame', 'score', 'twinkle', 'sglow', 'spark', 'sring', 'bolt', 'crackle', 'sswirl', 'dust', 'ground', 'burst', 'circle', 'bokeh'] },
  fire: { file: 'src/fire.png', cols: 4, rows: 4, names: ['tongue1', 'tongue2', 'tongue3', 'tongue4', 'lick1', 'lick2', 'lick3', 'lick4', 'fbase', 'fcore', 'ember', 'specks', 'wisp', 'fpuff', 'haze', 'gglow'] },
  fire2: { file: 'src/fire2.png', cols: 4, rows: 4, rowsY: [[20, 545], [570, 1010], [1030, 1365], [1370, 1960]], names: ['ft1', 'ft2', 'ft3', 'ft4', 'ff1', 'ff2', 'ff3', 'ff4', 'fdrop', 'fcurl', 'fember', 'fpool', 'fcol', 'fnoise', 'fswirl', 'fburst'] },
  toon: { file: 'src/toon.png', cols: 4, rows: 4, names: ['tb1', 'tb2', 'tb3', 'tb4', 'tp1', 'tp2', 'tp3', 'tp4', 'td1', 'td2', 'td3', 'td4', 'tstar', 'tring', 'tcres', 'tspikes'] },
  items: { file: 'src/items.png', cols: 4, rows: 2, names: ['coinF', 'coinT', 'coinE', 'gem', 'gem2', 'gemP', 'goldStar', 'glint'], color: true },
  ghost: { file: 'src/ghost.png', cols: 1, rows: 1, names: ['ghost'], color: true },
};
const STAGES = { // [светлый, тёмный] — мягкие, насыщенные, без чисто чёрных теней (мобильный стиль)
  F0: ['FFFBEA', 'FFD25A'], F1: ['FFE48A', 'FF9A2E'], F2: ['FFB45A', 'F05A22'], F3: ['FF8A4A', 'B8322A'], F4: ['8A7A86', '4A3E52'],
  S0: ['FFE6B0', 'E06A2A'], S1: ['A8969C', '5A4A58'], S2: ['BDB2BE', '766A7E'], S3: ['DAD4E0', '9A92A6'],
  M0: ['FFFFFF', 'D2F4FF'], M1: ['A8ECFF', '4A8CFF'], M2: ['C6A0FF', '6A3CE0'], M3: ['F08CFF', '9A2CC8'],
  E0: ['FFFFFF', 'CDF6FF'], E1: ['B6F0FF', '4AA8FF'], E2: ['8C9CFF', '4A3CD0'],
  G0: ['FFF8D8', 'FFD050'], G1: ['FFE08A', 'F0A030'], P0: ['FFE0F6', 'FF6AD8'], P1: ['FF9AE6', 'C02CA8'],
  D0: ['F4E2CC', 'C49A74'], L: ['FFFFFF', '000000'], D1: ['D8BCA0', '8A684E'], W0: ['FFFFFF', 'E8E4FF'],
};
// что нужно каждому эффекту: [маска, ...ступени] или ['item:имя']. Ступень 'F2~0.3' — цвет F2 + растворение 0.3:
// тусклые края маски (яркость ниже порога) исчезают первыми — язык пламени к концу жизни истончается и рвётся
const FX = {
  // огонь красит шейдер игры по температуре: языки и основа — серые маски (ступень L), остальное — готовым цветом
  fire: { cell: 128, need: [['tongue1', 'L'], ['tongue2', 'L'], ['tongue3', 'L'], ['tongue4', 'L'], ['lick1', 'L'], ['lick2', 'L'], ['lick3', 'L'], ['lick4', 'L'], ['fbase', 'L'],
    ['fcore', 'F0'], ['ember', 'F0', 'F2'], ['specks', 'F0'], ['wisp', 'F4', 'F4~0.4'], ['fpuff', 'F4', 'F4~0.4'], ['gglow', 'F2'], ['sglow', 'F1', 'F2']] },
  bolt: { cell: 128, need: [['bolt', 'E0', 'E1'], ['arc', 'E0', 'E1'], ['crackle', 'E0', 'E1'], ['sglow', 'E1', 'E2'], ['burst', 'E0'], ['sring', 'E1'], ['spark', 'E0', 'E1'], ['dust', 'D0', 'D1'], ['ground', 'E1']] },
  boom: { cell: 128, need: [['smoke1', 'S0', 'S1', 'S2', 'S3'], ['smoke2', 'S0', 'S1', 'S2', 'S3'], ['flame1', 'F0', 'F1', 'F2', 'F3'], ['streak', 'F0', 'F1', 'F2', 'F3'], ['ring', 'F1'], ['glow', 'F0'], ['star', 'F0']] },
  coins: { cell: 112, need: [['item:coinF'], ['item:coinT'], ['item:coinE'], ['item:gem'], ['item:gem2'], ['item:gemP'], ['item:goldStar'], ['item:glint'], ['sglow', 'G0', 'G1'], ['twinkle', 'G0', 'W0'], ['burst', 'G0']] },
  confetti: { cell: 96, need: [['solid', 'W0'], ['sglow', 'W0', 'G0'], ['twinkle', 'W0', 'G0'], ['burst', 'W0']] },
  portal: { cell: 128, need: [['circle', 'M1', 'M2'], ['rune', 'M1', 'M2'], ['sring', 'M0', 'M1', 'M2', 'M3'], ['sswirl', 'M1', 'M2'], ['spark', 'M0', 'M1', 'M2', 'M3'], ['sglow', 'M0', 'M2', 'M3'], ['twinkle', 'M0']] },
  charge: { cell: 112, need: [['spark', 'P0', 'P1'], ['sglow', 'P0', 'P1'], ['crackle', 'P0', 'P1'], ['burst', 'P0'], ['sring', 'P0', 'P1'], ['twinkle', 'P0', 'W0']] },
  sparkle: { cell: 96, need: [['twinkle', 'W0', 'G0'], ['bokeh', 'M2', 'M1'], ['sglow', 'G1'], ['burst', 'G0']] },
  smoke: { cell: 128, need: [['puff', 'S3', 'S2', 'S1'], ['puffS', 'S3', 'S2'], ['sglow', 'F1'], ['twinkle', 'W0']] },
  shock: { cell: 128, need: [['ground', 'D0', 'G0'], ['dust', 'D0', 'D1'], ['puffS', 'D0', 'D1'], ['sglow', 'G0'], ['spark', 'G0', 'G1'], ['burst', 'G0']] },
  // ауры по видео-референсам: белые маски (красит цвет частицы) и серые (красит шейдер по градиенту)
  aura: { cell: 128, need: [['star', 'W0'], ['twinkle', 'W0'], ['sglow', 'W0'], ['sring', 'W0'], ['ring', 'W0'], ['glow', 'W0'], ['star5', 'W0'], ['shard', 'W0'],
    ['smoke1', 'L'], ['smoke2', 'L'], ['swirl', 'L'], ['puff', 'L'], ['solid', 'W0'], ['item:gem'], ['item:gemP']] },
  // мультяшные маски (огонь + взрыв) с нарисованными ступенями света: красит шейдер градиентом; плюс белые свечения
  toon: { cell: 160, need: [...['ft1', 'ft2', 'ft3', 'ft4', 'ff1', 'ff2', 'ff3', 'ff4', 'fdrop', 'fcurl', 'fember', 'fpool', 'fcol', 'fnoise', 'fswirl', 'fburst',
    'tb1', 'tb2', 'tb3', 'tb4', 'tp1', 'tp2', 'tp3', 'tp4', 'td1', 'td2', 'td3', 'td4', 'tstar', 'tring', 'tcres', 'tspikes'].map(n => [n, 'L']),
    ['sglow', 'W0'], ['glow', 'W0'], ['shard', 'W0'], ['twinkle', 'W0'], ['solid', 'W0'], ['ring', 'W0'], ['star', 'W0'], ['star5', 'W0'], ['sring', 'W0'], ['item:gemP']] },
  // зелье (эффект входа на Арену): жижу рисует шейдер (метаболы), в атласе — призрак и свечения
  potion: { cell: 160, need: [['item:ghost'], ['sglow', 'W0'], ['twinkle', 'W0'], ['glow', 'W0']] },
  comets: { cell: 96, need: [['spark', 'E0', 'E1', 'M2'], ['sglow', 'E1', 'M2'], ['twinkle', 'W0'], ['dust', 'E2']] },
};
const b = await chromium.launch(), pg = await b.newPage();
const game = dir + '../../../', js = {}; mkdirSync(game + 'assets/fx', { recursive: true });
const sheets = {};
for (const [k, s] of Object.entries(SHEETS)) sheets[k] = { ...s, data: 'data:image/png;base64,' + readFileSync(dir + s.file).toString('base64') };
let lua = '-- создано atlas.mjs: карта ячеек атласов эффектов (не править руками)\nreturn {\n', total = 0;
for (const [fx, spec] of Object.entries(FX)){
  const cells = []; for (const [m, ...st] of spec.need){ if (m.startsWith('item:')) cells.push([m.slice(5), null]); else for (const s of st) cells.push([m, s]); }
  const cols = Math.ceil(Math.sqrt(cells.length)), rows = Math.ceil(cells.length / cols);
  const res = await pg.evaluate(async ({ sheets, cells, cols, rows, CELL, STAGES }) => {
    const img = {}; for (const [k, s] of Object.entries(sheets)){ const i = new Image(); i.src = s.data; await i.decode(); img[k] = i; }
    const find = name => { if (name === 'solid') return ['solid', 0]; if (name === 'star5' || name === 'shard') return ['proc', name]; for (const [k, s] of Object.entries(sheets)){ const i = s.names.indexOf(name); if (i >= 0) return [k, i]; } throw new Error('нет маски ' + name); };
    const hex = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    const PAD = 3, W = CELL - PAD * 2, A = new OffscreenCanvas(cols * CELL, rows * CELL), ax = A.getContext('2d');
    cells.forEach(([name, st], n) => { const [k, i] = find(name);
      // сплошная белая ячейка — для векторных деталей (бумажки конфетти): тонируется цветом частицы
      if (k === 'solid'){ ax.fillStyle = '#fff'; ax.fillRect((n % cols) * CELL + PAD, Math.floor(n / cols) * CELL + PAD, W, W); return; }
      const c = new OffscreenCanvas(W, W), x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
      let s;
      if (k === 'proc'){
        // простые формы рисуем сами: пятиконечная звёздочка (мягкое свечение) и осколок-искра
        s = { color: false }; x.fillStyle = '#000'; x.fillRect(0, 0, W, W); x.fillStyle = '#fff'; x.shadowColor = '#fff';
        x.beginPath();
        if (i === 'star5'){ x.shadowBlur = W * .06; for (let j = 0; j < 10; j++){ const a = -Math.PI / 2 + j * Math.PI / 5, rr = (j % 2 ? .17 : .36) * W; x.lineTo(W / 2 + Math.cos(a) * rr, W / 2 + Math.sin(a) * rr); } }
        else { x.shadowBlur = W * .03; [[.5, .2], [.62, .52], [.5, .8], [.4, .5]].forEach(([u, v]) => x.lineTo(u * W, v * W)); }
        x.closePath(); x.fill(); x.fill();
      } else {
        s = sheets[k]; const im = img[k], cw = im.width / s.cols, ch = im.height / s.rows, side = Math.min(cw, ch);
        if (s.rowsY){ // неровная сетка источника: своя полоса на каждый ряд, вписываем с сохранением пропорций
          const [y0, y1] = s.rowsY[Math.floor(i / s.cols)], bh = y1 - y0, sc = W / (Math.max(cw, bh) * 1.06);
          x.fillStyle = '#000'; x.fillRect(0, 0, W, W);
          x.drawImage(im, (i % s.cols) * cw, y0, cw, bh, (W - cw * sc) / 2, (W - bh * sc) / 2, cw * sc, bh * sc);
        } else { if (s.blur) x.filter = `blur(${Math.round(W * s.blur)}px)`;   // мягкая маска: порог растворения плавно «растекается»
          x.drawImage(im, (i % s.cols) * cw + (cw - side) / 2, Math.floor(i / s.cols) * ch + (ch - side) / 2, side, side, 0, 0, W, W); x.filter = 'none'; }

      }
      const d = x.getImageData(0, 0, W, W), a = d.data;
      for (let p = 0; p < W * W; p++){ const X = p % W, Y = (p / W) | 0, e = Math.min(X, Y, W - 1 - X, W - 1 - Y), edge = e < 5 ? e / 5 : 1;
        const mx = Math.max(a[p * 4], a[p * 4 + 1], a[p * 4 + 2]) / 255, v = Math.max(0, (mx - .04) / .96) * edge;
        if (s.color){ // цветной предмет на чёрном: прозрачность по яркости, цвет — «распремноженный»
          const al = Math.min(1, v * 1.6); if (mx > 0) for (let q = 0; q < 3; q++) a[p * 4 + q] = Math.min(255, a[p * 4 + q] / Math.max(mx, .05)); a[p * 4 + 3] = al * 255; }
        else { const [sk, ero] = st.split('~'), e = +(ero || 0), [hi, lo] = STAGES[sk].map(hex), t = Math.min(1, v * 1.15);
          const d = e > 0 ? Math.min(1, Math.max(0, (v - e) / .25)) : 1, dis = d * d * (3 - 2 * d); a[p * 4] = lo[0] + (hi[0] - lo[0]) * t; a[p * 4 + 1] = lo[1] + (hi[1] - lo[1]) * t; a[p * 4 + 2] = lo[2] + (hi[2] - lo[2]) * t; a[p * 4 + 3] = Math.min(255, v * 300) * dis; } }
      x.putImageData(d, 0, 0); ax.drawImage(c, (n % cols) * CELL + PAD, Math.floor(n / cols) * CELL + PAD); });
    // обрезка: видимая часть каждой ячейки (доля 0…1) — движок рисует квадрат только по ней, меньше пустых пикселей для видеокарты
    const AD = ax.getImageData(0, 0, cols * CELL, rows * CELL).data, AW = cols * CELL, trim = [];
    cells.forEach((_, n) => { const cx = (n % cols) * CELL, cy = Math.floor(n / cols) * CELL; let x0 = CELL, y0 = CELL, x1 = -1, y1 = -1;
      for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) if (AD[((cy + y) * AW + cx + x) * 4 + 3] > 6){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      trim.push(x1 < 0 ? [0, 0, 1, 1] : [Math.max(0, x0 - 2) / CELL, Math.max(0, y0 - 2) / CELL, Math.min(CELL, x1 + 3) / CELL, Math.min(CELL, y1 + 3) / CELL].map(v => Math.round(v * 1000) / 1000)); });
    const u8 = new Uint8Array(await (await A.convertToBlob({ type: 'image/webp', quality: .84 })).arrayBuffer()); let t = '';
    for (let j = 0; j < u8.length; j += 32768) t += String.fromCharCode(...u8.subarray(j, j + 32768)); return [t, trim];
  }, { sheets, cells, cols, rows, CELL: spec.cell, STAGES });
  const buf = Buffer.from(res[0], 'latin1'); writeFileSync(dir + `fx-${fx}.webp`, buf); writeFileSync(game + `assets/fx/fx-${fx}.webp`, buf); total += buf.length;
  js[fx] = { cols, rows, cell: spec.cell, trim: res[1], map: Object.fromEntries(cells.map(([m, s], i) => [s ? m + ':' + s : m, i])) };
  lua += `\t${fx} = { cols = ${cols}, rows = ${rows}, cell = ${spec.cell}, map = { ${cells.map(([m, s], i) => `['${s ? m + ':' + s : m}'] = ${i}`).join(', ')} } },\n`;
  console.log(`fx-${fx}.webp: ${cells.length} ячеек ${cols}×${rows}×${spec.cell}px, ${(buf.length / 1024).toFixed(0)} КБ`);
}
// полосы для прокрутки (хвосты, огонь внутри маски): 8 горизонтальных полос → бесшовные по ширине, 1024×64 каждая
{ const data = 'data:image/png;base64,' + readFileSync(dir + 'src/strips.png').toString('base64');
  const res = await pg.evaluate(async data => {
    const im = new Image(); im.src = data; await im.decode();
    const c = new OffscreenCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, im.width, im.height).data, W = im.width, rows = [];
    for (let y = 0; y < im.height; y++){ let m = 0; for (let i = 0; i < W; i += 4) m = Math.max(m, d[(y * W + i) * 4]); rows.push(m); }
    // полосы — подряд идущие строки, где есть яркие пиксели; склеиваем разрывы < 30 строк
    const bands = []; let st = -1, gap = 0;
    rows.forEach((m, y) => { if (m > 40){ if (st < 0) st = y; gap = 0; } else if (st >= 0 && ++gap > 30){ bands.push([st, y - gap]); st = -1; } });
    if (st >= 0) bands.push([st, im.height - 1]);
    const O = new OffscreenCanvas(1024, 512), o = O.getContext('2d');
    bands.slice(0, 8).forEach(([a, z], i) => {
      const h = z - a + 1, pad = Math.round(h * .08), sy = Math.max(0, a - pad), sh = Math.min(im.height - sy, h + pad * 2);
      const T = new OffscreenCanvas(1024, 64), t = T.getContext('2d'); t.drawImage(im, 0, sy, W, sh, 0, 0, 1024, 64);
      // бесшовность: правые 20% плавно смешиваем с левым краем
      const td = t.getImageData(0, 0, 1024, 64), p = td.data, F = 200;
      for (let y = 0; y < 64; y++) for (let k = 0; k < F; k++){ const w = k / F, xr = 1024 - F + k, xl = k;
        for (let ch = 0; ch < 3; ch++){ const i = (y * 1024 + xr) * 4 + ch, j = (y * 1024 + xl) * 4 + ch; p[i] = p[i] * (1 - w) + p[j] * w; } }
      t.putImageData(td, 0, 0); o.drawImage(T, 0, i * 64);
    });
    const u8 = new Uint8Array(await (await O.convertToBlob({ type: 'image/webp', quality: .86 })).arrayBuffer()); let s = '';
    for (let j = 0; j < u8.length; j += 32768) s += String.fromCharCode(...u8.subarray(j, j + 32768));
    return [s, bands.length];
  }, data);
  const buf = Buffer.from(res[0], 'latin1'); writeFileSync(game + 'assets/fx/fx-strips.webp', buf); writeFileSync(dir + 'fx-strips.webp', buf);
  console.log(`fx-strips.webp: полос ${res[1]}, ${(buf.length / 1024).toFixed(0)} КБ`); }
await b.close();
writeFileSync(dir + 'atlases.luau', lua + '}\n');
// та же карта для JS-движка игры (src/app/16e-forge.js); картинки — assets/fx/
writeFileSync(game + 'src/app/16e-forge-atlas.js', '// создано design/rive/lab-fx/atlas.mjs: карта ячеек атласов частиц (не править руками)\nconst FX_ATLAS = ' + JSON.stringify(js) + ';\n');
console.log('всего', (total / 1024).toFixed(0), 'КБ');
