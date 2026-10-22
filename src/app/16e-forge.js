/* ═══════════════════════════════════════════════════════════════════════════
   ГОРН (Forge) — наш движок частиц на WebGL, без Rive.
   Перенос лаборатории design/rive/lab-fx (те же атласы и настройки): рисованные маски из Magnific,
   перекрашенные по ступеням (atlas.mjs → assets/fx/fx-<эффект>.webp + карта FX_ATLAS).
   Один холст поверх экрана, кадр — по одному вызову отрисовки на эффект; без эффектов цикл стоит.
   Forge.play('fire', { x, y, size, loop, el }) → { stop() }. Эффект задуман в квадрате 360×360:
   x, y — центр квадрата на экране, size — его сторона в px; el — следовать за элементом (и обрезать по нему).
   Файл самодостаточный — не знает ни про какое приложение (Горн идёт и в другие проекты): всё про Pawn — в 16e-pawn-forge.js.
   Отдельно для других проектов собирается одним файлом: npm run forge → dist/forge (см. docs/FORGE.md).
   ЯДРО: движок + базовые эффекты (искры удара anvil, зелье potion). Остальное — пакеты src/forge/*.js (classic, particles, image, hits),
   подключаются только там, где нужны (витрина, лаборатория): Forge.pack(имя, k => { … }) — k даёт инструменты ядра (spawn, draw, sprite, band…),
   k.chunk(семья, текст) добавляет режим шейдера, k.DEF — эффекты. Свой эффект на месте: Forge.define(имя, k => ({ init, update, render })).
   ═══════════════════════════════════════════════════════════════════════════ */
// makeForge(host): host — элемент, внутри которого свой холст (эффект под интерфейсом, как фон арены); без host — общий холст поверх экрана
function makeForge(host){
  const R = (a, b) => a + Math.random() * (b - a), PI = Math.PI;
  const easeOut = t => { const u = 1 - Math.min(1, Math.max(0, t)); return 1 - u * u * u; };
  let base = 'assets/fx/';

  /* ── частицы: те же поля и та же физика, что в vfx.luau ── */
  const P0 = { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, size: 64, grow: 0, stretch: 1, age: 0, life: 1, cells: [0], add: 1, alpha: 1,
    drag: 0, grav: 0, sway: 0, fadeIn: .12, fadeOut: .4, orient: false, speedStretch: 0, tint: null, pul: .05, pf: 9,
    sc: null, scW: null, scH: null, shear: 0, mode: 0, heat: null, ero: null, ramp: null, bx: 0, by: 0, broke: false, ph: 0, tc: null, floor: null, bounce: .35,
    // сложное поведение (у простых частиц выключено — ничего не стоит): поток, притяжение, пружина домой, ожидание, след, дочерние частицы
    flow: 0, fz: 1, ax: null, ay: 0, pull: 0, swirl: 0, kr: 0, hx: null, hy: 0, spring: 0, wait: 0, trail: 0, tn: 0, th: 0, onDie: null };
  // пул: погибшие частицы не выбрасываются, а переиспользуются — нет мусора для сборщика, ровнее кадр
  const POOL = [];
  // след хранится в своём буфере частицы (_tr) и переживает пул — без новых массивов
  const spawn = (L, o) => { const p = Object.assign(POOL.pop() || {}, P0, o); if (o.ph == null) p.ph = Math.random() * 6.28;
    if (p.trail){ if (!p._tr || p._tr.length < p.trail * 2) p._tr = new Float32Array(p.trail * 2); p.tn = 0; p.th = 0; } L.push(p); return p; };
  // поле течения (curl noise): вихри без источников и стоков — частицы текут, закручиваются и не слипаются в точку.
  // Потенциал — сумма трёх волн; скорость — его ротор (производные посчитаны вручную). FT — общее время потока
  let FT = 0;
  const FV = [0, 0];
  function curl(x, y, z){
    x *= z; y *= z; const t = FT, A = x * .011 + t * .3, B = y * .013 - t * .2, C = x * .023 - y * .017 + t * .5, D = x * .041 + y * .037 - t * .7;
    const dx = .011 * Math.cos(A) * Math.cos(B) + .0115 * Math.cos(C) - .01025 * Math.sin(D), dy = -.013 * Math.sin(A) * Math.sin(B) - .0085 * Math.cos(C) - .00925 * Math.sin(D);
    FV[0] = dy / .02; FV[1] = -dx / .02; return FV;
  }
  function step(L, dt){
    for (let i = L.length; i--;){
      const p = L[i]; p.age += dt;
      if (p.age >= p.life || (p.kr && p.ax !== null && Math.abs(p.x - p.ax) + Math.abs(p.y - p.ay) < p.kr)){
        if (p.onDie) p.onDie(p, L);   // дочерние частицы: ракета → салют, капля → брызги
        L[i] = L[L.length - 1]; L.pop(); if (POOL.length < 3000) POOL.push(p); continue; }
      if (p.age < p.wait) continue;   // ждёт своей очереди: стоит на месте (рассыпание картинки идёт волной)
      if (p.flow){ const f = curl(p.x, p.y, p.fz), r = Math.min(1, dt * 3); p.vx += (f[0] * p.flow - p.vx) * r; p.vy += (f[1] * p.flow - p.vy) * r; }
      if (p.ax !== null){ const dx = p.ax - p.x, dy = p.ay - p.y, l = Math.hypot(dx, dy) + 1;   // притяжение к точке + закрутка вокруг неё (воронка)
        p.vx += (dx * p.pull - dy * p.swirl) / l * dt; p.vy += (dy * p.pull + dx * p.swirl) / l * dt; }
      if (p.hx !== null){ p.vx += (p.hx - p.x) * p.spring * dt; p.vy += (p.hy - p.y) * p.spring * dt; }   // пружина домой: собирается в картинку
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.grav * dt;
      p.x += (p.vx + Math.sin(p.age * 5 + p.ph) * p.sway) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      // пол (поверхность наковальни): падающая частица отскакивает, теряя скорость
      if (p.floor !== null && p.y > p.floor && p.vy > 0){ p.y = p.floor; p.vy *= -p.bounce; p.vx *= .7; }
      // след: кольцевой буфер последних позиций (раз в кадр)
      if (p.trail){ const T = p._tr; T[p.th * 2] = p.x; T[p.th * 2 + 1] = p.y; p.th = (p.th + 1) % p.trail; if (p.tn < p.trail) p.tn++; }
    }
  }
  // цвет по жизни: tc = [[доля жизни, [r, g, b]], …] — искра остывает (белая → жёлтая → оранжевая → красная); в общий черновик, без новых массивов
  const TC = [1, 1, 1], WHITE3 = [1, 1, 1];
  const tcol = (K, k) => { let i = 1; while (i < K.length - 1 && K[i][0] < k) i++; const [a, A] = K[i - 1], [b, B] = K[i], u = Math.min(1, Math.max(0, (k - a) / (b - a)));
    TC[0] = A[0] + (B[0] - A[0]) * u; TC[1] = A[1] + (B[1] - A[1]) * u; TC[2] = A[2] + (B[2] - A[2]) * u; return TC; };
  // мягкая кривая прозрачности: плавное появление и угасание
  const fade = (p, k) => { const a = p.fadeIn ? Math.min(1, Math.max(0, k / p.fadeIn)) : 1, b = Math.min(1, Math.max(0, (1 - k) / p.fadeOut)); return p.alpha * a * a * (3 - 2 * a) * b * b * (3 - 2 * b); };
  // накопитель частоты: rate штук в секунду, дробные остатки копятся
  const emit = (acc, k, rate, dt, f) => { acc[k] = (acc[k] || 0) + rate * dt * EMIT[quality]; while (acc[k] >= 1){ acc[k] -= 1; f(); } };
  const seq = (at, mask, ...st) => st.length ? st.map(s => at.map[mask + ':' + s]) : [at.map[mask]];

  /* ── отрисовка: вершины копятся в буфер кадра, один вызов на эффект ──
     Два режима частицы:
       0 — готовый цвет из атласа (маска уже перекрашена в atlas.mjs);
       1…1.5 — «по температуре», как в AAA (дробная часть × 0.6 — мягкость края): атлас даёт серую маску, цвет берётся из градиента (ramp) по яркости × жару,
           края съедает растворение по шуму (erosion), кончики колышет искажение шумом — основание стоит. */
  const VF = 20;                                       // чисел на вершину: p2 uv2 aa2 tn3 q2 fx4 cr4 rw1
  let stripT, cv, gl, vbo, ibo, buf = new Float32Array(VF * 4 * 512), nq = 0, W = 0, H = 0, dpr = 1, noiseT, rampT;
  const FULL = [0, 0, 1, 1], TRS = [0, 0, 1, 1], tex = {}, NOFX = [0, 0, 0, 0, -1], FXS = [0, 0, 0, 0, -1];   // FXS — общий черновик: без новых массивов на каждую частицу
  // кривая по ключам [[доля жизни, значение], …] — линейно между ключами
  const crv = (K, k) => { if (k <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (k <= K[i][0]){ const [a, va] = K[i - 1], [b, vb] = K[i]; return va + (vb - va) * (k - a) / (b - a); } return K[K.length - 1][1]; };
  // квадрат: (m00, m01) — образ оси x, (m10, m11) — оси y, в единицах эффекта; c — текущий эффект; fx = [режим, растворение, жар, зерно]
  // rect — своя рамка внутри ячейки [x0, y0, x1, y1] (жижа: квадрат только вокруг шариков)
  function quad(c, cell, m00, m01, m10, m11, tx, ty, a, add, tint, inset, fx, rect){
    if (a <= .003 || cell == null) return;
    const at = c.at, h = at.cell / 2, k = c.k, ox = c.ox, oy = c.oy, f = fx || NOFX; mask |= 1 << fam(f[0]);
    if ((nq + 1) * VF * 4 > buf.length){ const b = new Float32Array(buf.length * 2); b.set(buf); buf = b; }
    const du = 1 / at.cols, dv = 1 / at.rows, u0 = (cell % at.cols) * du, v0 = Math.floor(cell / at.cols) * dv, ins = inset || 0;
    const r = tint ? tint[0] : 1, g = tint ? tint[1] : 1, bl = tint ? tint[2] : 1, al = a * c.fade;
    // обрезка по видимой части ячейки (атлас знает её рамку): режимы, которые рисуют без маски (2–4, 6, 7, 9–13, 15), — во всю ячейку
    let tr = rect || ((f[0] < 2 || f[0] === 5 || f[0] === 8 || f[0] === 14 || (f[0] >= 18 && f[0] < 18.3)) && !ins && at.trim ? at.trim[cell] : FULL);
    // искажение шумом (режимы 1–1.5) тянет картинку из-за рамки — даём запас
    if (f[0] >= 1 && f[0] < 2 && tr !== FULL){ const e = .1; tr = TRS; TRS[0] = Math.max(0, at.trim[cell][0] - e); TRS[1] = Math.max(0, at.trim[cell][1] - e); TRS[2] = Math.min(1, at.trim[cell][2] + e); TRS[3] = Math.min(1, at.trim[cell][3] + e); }
    const ar = Math.abs(m00 * m11 - m01 * m10) * at.cell * at.cell * k * k * (tr[2] - tr[0]) * (tr[3] - tr[1]); if (ar === ar) fill += Math.min(ar, innerWidth * innerHeight);   // больше экрана не закрасить
    let o = nq * VF * 4;
    for (let i = 0; i < 4; i++){
      const lx = i === 0 || i === 3 ? tr[0] : tr[2], ly = i < 2 ? tr[1] : tr[3], qx = (lx * 2 - 1) * h, qy = (ly * 2 - 1) * h;
      const wx = m00 * qx + m10 * qy + tx, wy = m01 * qx + m11 * qy + ty;
      buf[o++] = (ox + (wx - 180) * k) * dpr; buf[o++] = (oy + (wy - 180) * k) * dpr;
      buf[o++] = u0 + (ins ? (lx ? 1 - ins : ins) : lx) * du; buf[o++] = v0 + (ins ? (ly ? 1 - ins : ins) : ly) * dv;
      buf[o++] = al; buf[o++] = add; buf[o++] = r; buf[o++] = g; buf[o++] = bl;
      buf[o++] = lx; buf[o++] = ly; buf[o++] = f[0]; buf[o++] = f[1]; buf[o++] = f[2]; buf[o++] = f[3];
      buf[o++] = u0; buf[o++] = v0; buf[o++] = du; buf[o++] = dv; buf[o++] = f[4] == null ? -1 : f[4];
    }
    nq++;
  }
  // произвольный четырёхугольник (лента хвоста): P — 4 угла [x, y], Q — 4 пары «вдоль/поперёк», A — 4 «пройдено от головы»
  function quad4(c, P, Q, A, alpha, add, tint, fx){
    if (alpha <= .003) return;
    if ((nq + 1) * VF * 4 > buf.length){ const b = new Float32Array(buf.length * 2); b.set(buf); buf = b; }
    const k = c.k, ox = c.ox, oy = c.oy, al = alpha * c.fade, f = fx; mask |= 1 << fam(f[0]);
    fill += Math.abs((P[2][0] - P[0][0]) * (P[3][1] - P[1][1]) - (P[3][0] - P[1][0]) * (P[2][1] - P[0][1])) / 2 * k * k;
    let o = nq * VF * 4;
    for (let i = 0; i < 4; i++){
      buf[o++] = (ox + (P[i][0] - 180) * k) * dpr; buf[o++] = (oy + (P[i][1] - 180) * k) * dpr; buf[o++] = 0; buf[o++] = 0;
      buf[o++] = al; buf[o++] = add; buf[o++] = tint[0]; buf[o++] = tint[1]; buf[o++] = tint[2];
      buf[o++] = Q[i][0]; buf[o++] = Q[i][1]; buf[o++] = f[0]; buf[o++] = f[1]; buf[o++] = f[2]; buf[o++] = f[3];
      buf[o++] = A[i]; buf[o++] = 0; buf[o++] = 0; buf[o++] = 0; buf[o++] = -1;
    }
    nq++;
  }
  // лента по точкам (от хвоста к голове): ширина w0 → w1, внутри бежит полоса row текстуры полос со скоростью speed
  function ribbon(c, pts, w0, w1, row, inten, speed, tint, alpha, add){
    const n = pts.length; if (n < 2) return;
    const d = [0]; for (let i = 1; i < n; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = d[n - 1] || 1, nr = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
    const side = (i, sg) => { const w = (w0 + (w1 - w0) * d[i] / L) / 2; return [pts[i][0] + nr[i][0] * w * sg, pts[i][1] + nr[i][1] * w * sg]; };
    const fx = [13, row, inten, speed];
    for (let i = 0; i < n - 1; i++){
      const u0 = d[i] / L, u1 = d[i + 1] / L, a0 = (L - d[i]) / 100, a1 = (L - d[i + 1]) / 100;
      quad4(c, [side(i, -1), side(i + 1, -1), side(i + 1, 1), side(i, 1)], [[u0, 0], [u1, 0], [u1, 1], [u0, 1]], [a0, a1, a1, a0], alpha, add, tint, fx);
    }
  }
  // мерцание светящихся частиц (сложение света): живое, а не ровное
  const flick = p => p.add > .5 && !p.mode ? .86 + .14 * Math.sin(p.age * 19 + p.ph * 3) : 1;
  // плавный «шум» для микро-движений: wob(время, зерно) в −1…1
  const wob = (t, k) => (Math.sin(t * 1.7 + k) + Math.sin(t * 2.9 + k * 1.3) * .6 + Math.sin(t * 5.3 + k * 2.1) * .3) / 1.9;
  // слой частиц: ячейка по доле жизни, поворот, растяжение, скос (изгиб по ветру), кривые ширины/высоты;
  // искры — головой по скорости
  function draw(c, L){
    const cell = c.at.cell;
    for (const p of L){
      const k = p.wait ? Math.max(0, p.age - p.wait) / (p.life - p.wait) : p.age / p.life, al = fade(p, k);
      if (al <= .003) continue;   // невидимую не считаем (тысячи частиц картинки — заметная экономия)
      const s = p.size * (p.sc ? crv(p.sc, k) : 1 + p.grow * k) * (p.pul ? 1 + p.pul * Math.sin(p.age * p.pf + p.ph) : 1) / cell, ce = p.cells.length > 1 ? p.cells[Math.min(p.cells.length - 1, Math.floor(k * p.cells.length))] : p.cells[0];
      if (p.tn > 1) trail(c, p, k, s * cell);
      let fx = null; if (p.mode){ fx = FXS; fx[0] = p.mode; fx[1] = p.ero ? crv(p.ero, k) : 0; fx[2] = p.heat ? crv(p.heat, k) : 1; fx[3] = p.ph; fx[4] = p.ramp ? RAMP_ROW[p.ramp] : -1; }
      if (p.orient){
        // маска искры нарисована по диагонали (голова внизу-слева): M = R(a − 3π/4) · (I + (st − 1)·u·uᵀ)
        const st = p.stretch * (1 + Math.hypot(p.vx, p.vy) * p.speedStretch), b = Math.atan2(p.vy, p.vx) - 2.35619449;
        const cb = Math.cos(b), sb = Math.sin(b), h = (st - 1) / 2;
        quad(c, ce, (cb * (1 + h) + sb * h) * s, (sb * (1 + h) - cb * h) * s, (-cb * h - sb * (1 + h)) * s, (cb * (1 + h) - sb * h) * s, p.x, p.y, al * flick(p), p.add, p.tc ? tcol(p.tc, k) : p.tint, 0, fx);
      } else {
        const cs = p.rot ? Math.cos(p.rot) : 1, sn = p.rot ? Math.sin(p.rot) : 0, w = s * (p.scW ? crv(p.scW, k) : 1), hh = s * p.stretch * (p.scH ? crv(p.scH, k) : 1), sh = p.shear || 0;
        // ось y со скосом: (sh, 1) — верх маски уходит вбок, основание на месте
        quad(c, ce, cs * w, sn * w, (cs * sh - sn) * hh, (sn * sh + cs) * hh, p.x, p.y, al * flick(p), p.add, p.tc ? tcol(p.tc, k) : p.tint, 0, fx);
      }
    }
  }
  // лента по точкам (режим 21): X — [x, y] от хвоста к голове, Wd — полная ширина в точке; поперёк — мягкий профиль с белым ядром (core),
  // вдоль — к хвосту гаснет. Вершины пишутся прямо в буфер, без новых массивов: лент сотни на кадр
  const BX = new Float32Array(512), BW = new Float32Array(256);
  function band(c, X, Wd, n, a, add, tint, core, inten){
    if (a <= .003 || n < 2) return;
    mask |= 1 << 12; const k2 = c.k;
    let x0 = X[0], y0 = X[1], nx0 = -(X[3] - y0), ny0 = X[2] - x0, l0 = Math.hypot(nx0, ny0) || 1; nx0 /= l0; ny0 /= l0;
    for (let i = 1; i < n; i++){
      const x1 = X[i * 2], y1 = X[i * 2 + 1], jn = Math.min(n - 1, i + 1) * 2, jp = (i - 1) * 2;
      let nx1 = -(X[jn + 1] - X[jp + 1]), ny1 = X[jn] - X[jp]; const l1 = Math.hypot(nx1, ny1); if (l1 < 1e-4){ nx1 = nx0; ny1 = ny0; } else { nx1 /= l1; ny1 /= l1; }
      const u0 = (i - 1) / (n - 1), u1 = i / (n - 1), w0 = Wd[i - 1] / 2, w1 = Wd[i] / 2;
      if ((nq + 1) * VF * 4 > buf.length){ const b = new Float32Array(buf.length * 2); b.set(buf); buf = b; }
      let o = nq * VF * 4;
      for (let v = 0; v < 4; v++){ const e = v === 0 || v === 3 ? 0 : 1, sd = v < 2 ? -1 : 1, x = e ? x1 : x0, y = e ? y1 : y0, nx = e ? nx1 : nx0, ny = e ? ny1 : ny0, ww = e ? w1 : w0;
        buf[o++] = (c.ox + (x + nx * ww * sd - 180) * k2) * dpr; buf[o++] = (c.oy + (y + ny * ww * sd - 180) * k2) * dpr; buf[o++] = 0; buf[o++] = 0;
        buf[o++] = a * c.fade; buf[o++] = add; buf[o++] = tint[0]; buf[o++] = tint[1]; buf[o++] = tint[2];
        buf[o++] = e ? u1 : u0; buf[o++] = v < 2 ? 0 : 1; buf[o++] = 21; buf[o++] = core; buf[o++] = inten; buf[o++] = 0;
        buf[o++] = 0; buf[o++] = 0; buf[o++] = 0; buf[o++] = 0; buf[o++] = -1; }
      nq++; fill += Math.hypot(x1 - x0, y1 - y0) * (w0 + w1) * k2 * k2;
      x0 = x1; y0 = y1; nx0 = nx1; ny0 = ny1;
    }
  }
  // след частицы: последние точки из кольцевого буфера → лента, к хвосту тоньше
  function trail(c, p, k, w){
    const T = p._tr, n = Math.min(p.tn, 256), N = p.trail, a = fade(p, k);
    if (a <= .003) return;
    for (let i = 0; i < n; i++){ const j = (p.th - n + i + N) % N * 2; BX[i * 2] = T[j]; BX[i * 2 + 1] = T[j + 1]; BW[i] = w * (.15 + .85 * i / (n - 1)); }
    band(c, BX, BW, n, a, p.add, p.tc ? tcol(p.tc, k) : (p.tint || WHITE3), .6, .8);
  }
  // дуга-взмах (шлейф оружия, серп по земле): по эллипсу (rx, ry) от угла a0 (хвост) к a1 (голова), ширина растёт к голове;
  // rot — поворот эллипса; ry < rx — «лежит на земле»
  function arcBand(c, cx, cy, rx, ry, rot, a0, a1, w, alpha, add, tint, core){
    const n = Math.max(6, Math.min(48, Math.ceil(Math.abs(a1 - a0) * 9))), cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
    for (let i = 0; i < n; i++){ const u = i / (n - 1), an = a0 + (a1 - a0) * u, x = Math.cos(an) * rx, y = Math.sin(an) * ry;
      BX[i * 2] = cx + x * cr - y * sr; BX[i * 2 + 1] = cy + x * sr + y * cr; BW[i] = w * Math.pow(Math.sin(Math.min(1, u * 1.15) * PI * .5), .7) * (u > .92 ? 1 - (u - .92) / .08 * .6 : 1); }
    band(c, BX, BW, n, alpha, add, tint, core == null ? .7 : core, 1);
  }
  // отрезок: ячейка, растянутая от точки до точки (мягкая — свечение, сплошная — ядро линии)
  function seg(c, x0, y0, x1, y1, w, alpha, add, cell, tint){
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, cs = dx / L, sn = dy / L, k = 1 / c.at.cell;
    quad(c, cell, cs * L * k * 1.15, sn * L * k * 1.15, -sn * w * k, cs * w * k, (x0 + x1) / 2, (y0 + y1) / 2, alpha, add, tint);
  }
  // ветвящаяся молния (фрактал): ствол — ломаная, от случайных изломов отходят ветки под 20–50°, от веток — веточки;
    // каждая ветвь тоньше и тусклее. Возвращает список [точки, толщина, яркость]
    function branch(x0, y0, x1, y1, amp, n, depth, w, out){
      const p = zig(x0, y0, x1, y1, amp, n); out.push([p, w, 1 / (1 + (3 - depth) * .6)]);
      if (depth <= 0) return out;
      const L = Math.hypot(x1 - x0, y1 - y0), a0 = Math.atan2(y1 - y0, x1 - x0);
      for (let i = 2; i < p.length - 2; i++) if (Math.random() < .2 + .1 * depth){
        const a = a0 + (Math.random() < .5 ? -1 : 1) * (.35 + Math.random() * .5), l = L * (.25 + Math.random() * .3) * (1 - i / p.length);
        branch(p[i][0], p[i][1], p[i][0] + Math.cos(a) * l, p[i][1] + Math.sin(a) * l, amp, Math.max(2, n - 1), depth - 1, w * .55, out);
      }
      return out;
    }
  // ломаная молния между точками: середины смещаем случайно (n уровней → 2ⁿ отрезков)
  function zig(x0, y0, x1, y1, amp, n){
    let p = [[x0, y0], [x1, y1]];
    for (let d = 0; d < n; d++){ const q = [p[0]];
      for (let i = 1; i < p.length; i++){ const [ax, ay] = p[i - 1], [bx, by] = p[i], L = Math.hypot(bx - ax, by - ay);
        q.push([(ax + bx) / 2 + (Math.random() - .5) * L * amp, (ay + by) / 2 + (Math.random() - .5) * L * amp], p[i]); }
      p = q; }
    return p;
  }
  // одна копия на кадр (свечение, руна, кольцо)
  function sprite(c, x, y, size, rot, alpha, add, cell, sy, tint, inset, fx, rect){
    // микро-жизнь: светящиеся спрайты чуть дышат и мерцают — у каждого свой ритм (по месту)
    if (add > .9 && !fx && size < 2000){ const w = wob(c.s.t * 2.3, (x + y) * .021); alpha *= 1 + .1 * w; size *= 1 + .035 * w; }
    const s = size / c.at.cell, st = sy == null ? 1 : sy, cs = Math.cos(rot), sn = Math.sin(rot);
    quad(c, cell, cs * s, sn * s, -sn * s * st, cs * s * st, x, y, alpha, add, tint, inset, fx, rect);
  }

  const VS = 'attribute vec2 p;attribute vec2 uv;attribute vec2 aa;attribute vec3 tn;attribute vec2 q;attribute vec4 fx;attribute vec4 cr;attribute float rw;uniform vec2 res;' +
    'varying vec2 vu;varying vec2 va;varying vec3 vt;varying vec2 vq;varying vec4 vf;varying vec4 vc;varying float vr;' +
    'void main(){gl_Position=vec4(p.x/res.x*2.-1.,1.-p.y/res.y*2.,0.,1.);vu=uv;va=aa;vt=tn;vq=q;vf=fx;vc=cr;vr=rw;}';
  // доля сложения света (add): 0 — обычное смешивание, 1 — чистое сложение (как additiveness в Rive)
  const FS = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform sampler2D tx;uniform sampler2D nz;uniform sampler2D rp;uniform sampler2D sp;uniform float tm;uniform float lq;uniform vec4 gp;uniform vec3 mb[24];uniform float mbn;' +
    'varying vec2 vu;varying vec2 va;varying vec3 vt;varying vec2 vq;varying vec4 vf;varying vec4 vc;varying float vr;' +
    // слой картинки (семья 22): своя текстура im; за краями картинки — пусто
    'uniform sampler2D im;vec4 IM(vec2 u){return texture2D(im,clamp(u,0.,1.))*step(0.,u.x)*step(u.x,1.)*step(0.,u.y)*step(u.y,1.);}' +
    'float H1(float n){return fract(sin(n)*43758.5453);}float H2(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}' +
    'void main(){float RW=vr<0.?gp.w:vr;' +
    // 19 — жижа (метаболы): поле Σ 1.3r²/(d² + 0.3r²) от шариков (без бесконечности в центре — внутри лужи нет бугров от каждой капли); поверхность — порог поля, шарики сливаются и тянутся нитями.
    // Объём: нормаль из градиента поля → рассеянный свет, блик, тёмная кромка; внутри течёт шум; вокруг — мягкое свечение
    '§10§if(vf.x>18.9&&vf.x<19.5){float t=tm*gp.z;vec2 p=vq;float f=0.;vec2 g=vec2(0.);' +
    'for(int i=0;i<24;i++){if(float(i)>=mbn)break;vec3 b=mb[i];vec2 d=p-b.xy;float r2=dot(d,d)+.3*b.z*b.z;float k=1.3*b.z*b.z/r2;f+=k;g-=2.*k/r2*d;}' +
    'if(f<.35){gl_FragColor=vec4(0.);return;}' +
    'if(vf.x>19.3&&vf.x<19.45){float rim=exp(-abs(f-1.)*7.);float gwn=exp(-abs(f-1.)*2.2)*.35;float hu=fract(atan(g.y,g.x)/6.2832+t*.08+p.x*.6);' +
    'vec3 nc=mix(vec3(.2,1.,.85),vec3(.55,1.,.3),smoothstep(.0,.35,hu));nc=mix(nc,vec3(1.,.95,.35),smoothstep(.35,.55,hu));nc=mix(nc,vec3(.85,.45,1.),smoothstep(.55,.85,hu));nc=mix(nc,vec3(.2,1.,.85),smoothstep(.85,1.,hu));' +
    'float ins=smoothstep(.97,1.04,f);float mist=texture2D(nz,p*1.4+vec2(t*.03,-t*.02)).r;float dt=0.;' +
    'vec3 inner=mix(vec3(.08,.05,.16),vec3(.2,.12,.35),mist)+mix(vec3(.4,.6,1.),vec3(.9,.5,1.),mist)*dt*.9;float A=max(ins*.72,rim);' +
    'gl_FragColor=vec4((inner*ins*.72+nc*(rim*1.15+gwn))*va.x,A*va.x);return;}' +
    'float a=smoothstep(.93,1.07,f);float gw=smoothstep(.35,1.,f)*(1.-a)*.5;' +
    'vec3 n=normalize(vec3(-g/max(f,1.)*.013,1.));vec3 L=normalize(vec3(-.45,-.65,.7));float dif=clamp(dot(n,L),0.,1.);float sp=pow(clamp(dot(reflect(-L,n),vec3(0.,0.,1.)),0.,1.),26.);' +
    'float th=smoothstep(1.,4.,f);float w=texture2D(nz,p*1.1+vec2(t*.05,-t*.08)).g;float w2=texture2D(nz,p*2.2+vec2(w*.5,t*.06)).b;' +
    'float x=clamp(.16+dif*.52+th*.2+(w2-.5)*.34,0.,1.);float ol=1.-smoothstep(1.,1.25,f);' +
    'vec3 col=texture2D(rp,vec2(x,RW)).rgb*(1.-ol*.5)+vec3(sp*.9);vec3 gc=texture2D(rp,vec2(.62,RW)).rgb;' +
    'gl_FragColor=vec4((col*a+gc*gw)*va.x,(a+gw*.15)*va.x);return;}' +
    // 20 — призрак из жижи: картинка с волной (хвост извивается сильнее), проявляется снизу вверх по линии vf.y,
    // на линии — светящаяся кромка зелья; vf.z — сила волны, vf.w — фаза
    '§11§if(vf.x>19.9&&vf.x<20.5){float t=tm*gp.z;vec2 q=vq;float tl=pow(q.y,1.6);' +
    'q.x+=sin(q.y*9.-t*7.+vf.w)*.05*tl*vf.z+sin(t*2.7+vf.w)*.012;q.y+=sin(q.x*7.+t*4.+vf.w)*.012*vf.z;' +
    'vec4 c=texture2D(tx,vc.xy+clamp(q,.01,.99)*vc.zw);float n=texture2D(nz,vq*1.5+vec2(vf.w,t*.3)).r;' +
    'float rv=vf.y;float sh=smoothstep(rv+.05,rv-.05,q.y+(n-.5)*.12);float ed=exp(-abs(q.y+(n-.5)*.12-rv)*28.)*step(.02,c.a);' +
    'vec3 col=mix(c.rgb*vt,texture2D(rp,vec2(.8,RW)).rgb,clamp(ed*1.2,0.,1.));float fl=.88+.12*sin(t*9.+vf.w*3.);' +
    'float A=c.a*sh*fl*va.x;gl_FragColor=vec4(col*A+texture2D(rp,vec2(.7,RW)).rgb*ed*.5*va.x,A);return;}' +
    // 21 — мягкая лента следа: поперёк — мягкий профиль с белым ядром (vf.y), вдоль — к хвосту (vq.x=0) гаснет; vf.z — яркость
    '§12§if(vf.x>20.9&&vf.x<21.5){float ac=abs(vq.y*2.-1.);float a=(1.-ac)*(1.-ac)*pow(vq.x,1.4)*vf.z*va.x;vec3 col=mix(vt,vec3(1.),exp(-ac*ac*10.)*vf.y*vq.x);gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    '§0§if(vf.x<.5){vec4 c=texture2D(tx,vu);float a=c.a*va.x;gl_FragColor=vec4(c.rgb*vt*a,a*(1.-va.y));return;}' +
    // шум бежит вверх по частице; у каждой частицы свой участок (зерно)
    '§1§vec2 nu=vq*vec2(.7,.55)+vec2(vf.w,vf.w*1.37)+vec2(0.,tm*gp.z);' +
    'vec3 n=texture2D(nz,nu).rgb;' +
    // искажение: кончик (верх, vq.y=0) колышется, основание стоит; не выходим за свою ячейку атласа
    'float tip=pow(1.-vq.y,1.6);' +
    'vec2 uv=clamp(vu+(n.rg-.5)*gp.y*tip*vc.zw,vc.xy+vc.zw*.02,vc.xy+vc.zw*.98);' +
    'vec4 c=texture2D(tx,uv);float m=c.r*clamp(c.a*4.,0.,1.);' +
    // растворение: тусклые края уходят первыми, шум делает край рваным
    'float e=vf.y;float v=m+(texture2D(nz,nu*1.9+vec2(.31,.17)).b-.5)*.32*min(1.,e*3.+.15);' +
    'float a=smoothstep(e,e+.07+(vf.x-1.)*.6,v);' +
    // цвет по температуре: яркость маски × жар → градиент; ступени — мультяшные полосы
    'float x=clamp(pow(m,.6)*vf.z,0.,1.);if(gp.x>0.){x=mix(x,floor(x*gp.x+.5)/gp.x,.6);}' +
    'vec3 col=texture2D(rp,vec2(x,RW)).rgb;' +
    'a*=va.x;gl_FragColor=vec4(col*vt*a,a*(1.-va.y));§E§}';

  /* ── шейдер по частям: в общем тексте FS каждый режим — свой кусок (метка §семья§). Программа эффекта собирается только из семей,
     которые он рисует: видеокарта меньше компилирует (первый кадр без рывка) и держит меньше регистров на пиксель — все пиксели считаются быстрее.
     Семьи: 0 — готовый цвет, 1 — по температуре, 2 — туманность/нити, 3 — режимы 4–12, дальше по одной: 13…21 → 4…12 */
  const fam = m => m < .5 ? 0 : m < 1.9 ? 1 : m < 3.9 ? 2 : m < 12.9 ? 3 : Math.floor(m + .05) - 9;   // +.05, а не больше: 23.9 — ещё семья 23, а не 24
  const FSP = (() => { const a = FS.split(/§(\d+|E)§/), parts = { head: a[0], tail: '' }, order = [];
    for (let i = 1; i < a.length; i += 2){ if (a[i] === 'E'){ parts.tail = a[i + 1]; continue; } parts[a[i]] = a[i + 1]; order.push(+a[i]); } return { parts, order }; })();
  // кусок режима из пакета: семьи 4+ (свой диапазон) — раньше открытых «всё, что больше» (3 — режимы 4–12, 2 — туманность), хвост — режим 1
  const rank = f => f >= 4 ? 0 : f === 0 ? 1 : f === 3 ? 2 : f === 2 ? 3 : 4;
  function chunk(f, src){ FSP.parts[f] = src; if (!FSP.order.includes(f)) FSP.order.push(f); FSP.order.sort((a, b) => rank(a) - rank(b)); for (const m in progs) if (m & 1 << f) delete progs[m]; }
  const fsFor = mask => FSP.parts.head + FSP.order.map(b => mask & 1 << b ? FSP.parts[b] : b === 1 ? 'gl_FragColor=vec4(0.);' : '').join('') + FSP.parts.tail;
  const AT = ['p', 'uv', 'aa', 'tn', 'q', 'fx', 'cr', 'rw'];
  let progs = {}, cur = null, fid = 0, mask = 0;
  // полосы для прокрутки грузим, только когда эффект их рисует (режимы 13, 14), — 89 КБ не качаются ради искр молота
  let stripsAsked = false;
  function strips(){
    if (stripsAsked) return; stripsAsked = true;
    const im = new Image(), g0 = gl; im.onload = () => { if (gl !== g0) return; gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, stripT); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      gl.activeTexture(gl.TEXTURE0); }; im.src = base + 'fx-strips.webp';
  }
  function program(m){
    if (progs[m]) return progs[m];
    if (m & 48) strips();
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const p = gl.createProgram(), vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, fsFor(m));
    gl.attachShader(p, vs); gl.attachShader(p, fs); AT.forEach((n, i) => gl.bindAttribLocation(p, i, n)); gl.linkProgram(p);   // места атрибутов общие — указатели ставим один раз
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)){ console.error('fx shader', m, gl.getProgramInfoLog(p), gl.getShaderInfoLog(fs)); return progs[m] = null; }
    gl.deleteShader(vs); gl.deleteShader(fs); gl.useProgram(p); cur = null;
    const u = n => gl.getUniformLocation(p, n);
    gl.uniform1i(u('tx'), 0); gl.uniform1i(u('nz'), 1); gl.uniform1i(u('rp'), 2); gl.uniform1i(u('sp'), 3); gl.uniform1i(u('im'), 4);
    return progs[m] = { p, f: -1, loc: { mb: u('mb'), mbn: u('mbn'), res: u('res'), lq: u('lq'), tm: u('tm'), gp: u('gp') } };
  }
  // шум: бесшовный 128×128, три независимых слоя (r, g — искажение, b — растворение).
  // Узлы решётки каждой октавы считаются один раз (раньше — 4 хеша на каждый пиксель × октаву × слой: ~80 мс на слабом телефоне),
  // результат тот же до бита; данные живут и после destroy — пересборка холста их не пересчитывает
  let noiseD = null;
  function noiseData(){
    if (noiseD) return noiseD;
    const N = 128, d = new Uint8Array(N * N * 4), hash = (x, y, s) => { const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };
    const L = [];   // L[слой][октава] — значения узлов per×per
    for (let ch = 0; ch < 3; ch++){ L.push([]); for (let o = 0, per = 4; o < 4; o++, per *= 2){ const g = new Float64Array(per * per); for (let j = 0; j < per; j++) for (let i = 0; i < per; i++) g[j * per + i] = hash(i, j, ch * 9 + o); L[ch].push(g); } }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let ch = 0; ch < 3; ch++){
      let v = 0, amp = .5, tot = 0;
      for (let o = 0, per = 4; o < 4; o++, per *= 2){ const X = x / N * per, Y = y / N * per, xi = Math.floor(X), yi = Math.floor(Y), fx = X - xi, fy = Y - yi, u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
        const g = L[ch][o], x1 = (xi + 1) % per, y1 = (yi + 1) % per;
        v += (g[yi * per + xi] * (1 - u) * (1 - w) + g[yi * per + x1] * u * (1 - w) + g[y1 * per + xi] * (1 - u) * w + g[y1 * per + x1] * u * w) * amp; tot += amp; amp *= .5; }
      d[(y * N + x) * 4 + ch] = v / tot * 255; d[(y * N + x) * 4 + 3] = 255;
    }
    return noiseD = d;
  }
  // запечённый шум (tools/fx-noise.mjs → assets/fx/fx-noise.png) — телефон его не считает; не загрузился — считаем сами
  function noiseTex(){
    const t = gl.createTexture(), g0 = gl, put = src => { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);   // байты как есть: без цветовой поправки браузера
      if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 128, 128, 0, gl.RGBA, gl.UNSIGNED_BYTE, noiseData());
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL); gl.activeTexture(gl.TEXTURE0); };
    gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    if (noiseD) put(null);
    else { const im = new Image(); im.onload = () => { if (gl === g0) put(im); }; im.onerror = () => { if (gl === g0) put(null); }; im.src = base + 'fx-noise.png'; }
    return t;
  }
  // градиенты температуры: строка на эффект, [доля, цвет]
  const RAMPS = {
    // огонь: тёмно-малиновый край → красный → оранжевый → жёлтый → кремовое ядро (без чисто белого)
    boom: [[0, '5a0a1e'], [.3, 'b81e2a'], [.55, 'f05a1e'], [.75, 'ffa62a'], [.9, 'ffe066'], [1, 'fff8d0']],
    // пламя: кончики тёмно-красные с коричневым дымом, середина оранжевая, низ жёлто-кремовый
    flame: [[0, '2a0804'], [.12, '6a1408'], [.28, 'b8300e'], [.45, 'ec5a14'], [.62, 'ff8e26'], [.78, 'ffc24a'], [.9, 'ffe9a0'], [1, 'fffbe8']],
    julia: [[0, '07031a'], [.3, '2a0f6a'], [.55, '5a2ad8'], [.75, '3ab8ff'], [.9, 'a8f4ff'], [1, 'ffffff']],
    gold: [[0, '2a1404'], [.3, '7a3a08'], [.55, 'd88a18'], [.8, 'ffd24a'], [1, 'fff6d0']],
    plasma: [[0, '120626'], [.3, '4a0f6a'], [.5, 'c02a8a'], [.7, 'ff7a4a'], [.88, 'ffd27a'], [1, 'fff4e0']],
    portal: [[0, '0a0420'], [.3, '3a1478'], [.55, '7a3ae8'], [.75, 'd070ff'], [.9, 'ffc2ff'], [1, 'ffffff']],
    pink: [[0, '2a0420'], [.35, '8a1460'], [.6, 'e83aa8'], [.8, 'ff9ad8'], [1, 'fff0fa']],
    redsph: [[0, '3a0204'], [.4, '9a0a0c'], [.65, 'e8201c'], [.85, 'ff7a4a'], [1, 'ffe0c0']],
    // мягкий дым/туман: тёплый тёмно-серый → светлый бежевый (плазма внутри круга — клубится, а не плоское пятно)
    haze: [[0, '1a120e'], [.35, '3a2c24'], [.65, '6e5a4a'], [.88, 'a89580'], [1, 'd8c8b4']],
    smoke: [[0, '1c1622'], [.35, '3a2e3c'], [.65, '5e4c5a'], [.9, '8c7884'], [1, 'b4a2aa']],
    sw_purple: [[0, '4a12b0'], [.5, '9a3ce8'], [.8, 'e070f0'], [1, 'ffc0ff']],
    sw_blue: [[0, '1a3ad8'], [.5, '2a8cff'], [.8, '5ad8ff'], [1, 'c8ffff']],
    sw_green: [[0, '0a8a3a'], [.5, '2ac040'], [.8, 'a8e840'], [1, 'f0ff90']],
    sw_yellow: [[0, 'f08a10'], [.5, 'ffb820'], [.8, 'ffd860'], [1, 'fff4b0']],
    teal: [[0, '04362f'], [.35, '0d7f72'], [.65, '2fd6c4'], [.88, 'a6fff2'], [1, 'ffffff']],
    violet: [[0, '0a0320'], [.3, '2e1270'], [.6, '6a3cf0'], [.85, 'b49cff'], [1, 'f2ecff']],
    fire: [[0, 'c42a22'], [.25, 'e0401e'], [.42, 'f4661e'], [.6, 'ff9228'], [.76, 'ffc444'], [.9, 'ffe58a'], [1, 'fff2cc']],
    // зелье: тёмно-изумрудный край → ядовито-зелёный → салатовый блик (яд — зелёный + жёлтый)
    potion: [[0, '0f5a22'], [.25, '1c9a2c'], [.5, '3fd43a'], [.7, '8ef04a'], [.88, 'd6ff7a'], [1, 'f6ffd6']],
  };
  const RAMP_ROW = {}, RAMP_N = 32;   // строк с запасом: градиентов уже больше 16
  let rampD = null;
  function rampTex(){
    // цвета ключей разбираем один раз (раньше — parseInt на каждый пиксель и канал); данные переживают destroy
    const d = rampD || (rampD = new Uint8Array(256 * RAMP_N * 4));
    if (!rampD.done){ rampD.done = 1; Object.entries(RAMPS).forEach(([name, st], row) => { RAMP_ROW[name] = (row + .5) / RAMP_N;
      const C = st.map(([, c]) => [0, 2, 4].map(k => parseInt(c.slice(k, k + 2), 16)));
      for (let i = 0; i < 256; i++){ const x = i / 255; let j = 1; while (j < st.length - 1 && st[j][0] < x) j++;
        const a = st[j - 1][0], b = st[j][0], A = C[j - 1], B = C[j], t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        for (let ch = 0; ch < 3; ch++) d[(row * 256 + i) * 4 + ch] = A[ch] + (B[ch] - A[ch]) * t;
        d[(row * 256 + i) * 4 + 3] = 255; } }); }
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, RAMP_N, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  }
  function setup(){
    cv = document.createElement('canvas'); cv.className = 'fx-cv';
    cv.style.cssText = host ? 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:none' : 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9000;display:none';   // до первого эффекта холст скрыт — иначе пустой слой на весь экран держит память
    (host || document.body).appendChild(cv);
    gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return false;
    // телефон может отнять контекст (мало памяти, долго в фоне) — тогда всё освобождаем, следующий эффект соберёт холст заново
    cv.addEventListener('webglcontextlost', release);
    document.addEventListener('visibilitychange', kick);
    if (!program(1)) return false;   // самая частая программа (готовый цвет из атласа: искры молота) — сразу; остальные — по первому эффекту
    vbo = gl.createBuffer(); ibo = gl.createBuffer();
    const idx = new Uint16Array(6 * 16000); for (let i = 0, v = 0; i < idx.length; i += 6, v += 4) idx.set([v, v + 1, v + 2, v, v + 2, v + 3], i);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    [[2, 0], [2, 2], [2, 4], [3, 6], [2, 9], [4, 11], [4, 15], [1, 19]].forEach(([size, off], l) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, VF * 4, off * 4); });
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.activeTexture(gl.TEXTURE1); noiseT = noiseTex();
    gl.activeTexture(gl.TEXTURE2); rampT = rampTex();
    // полосы для прокрутки (хвосты, огонь внутри маски): повтор по ширине; пока не загрузились — чёрные
    gl.activeTexture(gl.TEXTURE3); stripT = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, stripT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.activeTexture(gl.TEXTURE0);
    return true;
  }
  // картинка для слоя картинки (семья 22): по адресу или <img>; чужой сервер без CORS — не загрузится (err), эффект молча снимается.
  // Хранится, пока нужна: в простое выгружается вместе с атласами
  const imgs = {};
  function imgTex(src){
    const key = src.src || src; if (imgs[key]) return imgs[key];
    const t = imgs[key] = { ok: false, t: gl.createTexture(), w: 1, h: 1 }, g0 = gl;
    const im = typeof src === 'string' ? Object.assign(new Image(), { crossOrigin: 'anonymous', src }) : src;
    const go = () => { if (gl !== g0) return; try { gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, t.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
        t.w = im.naturalWidth; t.h = im.naturalHeight; t.ok = true; } catch (_){ t.err = true; } gl.activeTexture(gl.TEXTURE0); };
    if (im.complete && im.naturalWidth) go(); else { im.addEventListener('load', go); im.addEventListener('error', () => { t.err = true; }); }
    return t;
  }
  function texture(name){
    if (tex[name]) return tex[name];
    const t = tex[name] = { ok: false, t: gl.createTexture() }, im = new Image(), g0 = gl;
    im.onload = () => { if (gl !== g0) return;   // картинка догрузилась после destroy — старый контекст уже освобождён
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      t.ok = true; };
    im.onerror = () => { t.err = true; };   // для диагностики (Дебаг → строка внизу)
    im.src = base + 'fx-' + name + '.webp';
    return t;
  }

  /* ── эффекты (перенос tfire/tboom/… .luau) ──
     init(s) — состояние; update(s, dt); render(s, c) — рисует слоями; period — длина разового эффекта (сек) */
  const DEF = {};

  /* ── искры удара молота по наковальне (крафт и арена). Удар — 2–3 кадра: белая вспышка и блик-полоса; дальше
     раскалённые искры веером вверх и в стороны — тонкие росчерки, длина по скорости (размытие движения), остывают
     белый → жёлтый → оранжевый → тёмно-красный и гаснут в разное время; летевшие вниз отскакивают от наковальни.
     Затухание — угольки медленно всплывают и краснеют, на месте удара тлеет пятно. Кольцо и жар — в разметке (.fi-ring, .fi-heat).
     Цвет свечения — s.tint (ранг / огонь арены), искр — s.pal (Ставки — розовая). Эффект задуман в px: size = 360 → 1 ед. = 1 px */
  DEF.anvil = { atlas: 'aura', period: 2,
    // цвета искр (pal: [горячий, тёплый]) и свечения (tint)
    presets: { gold: { s: { pal: [[1, .95, .7], [1, .75, .25]], tint: [1, .8, .35] } }, pink: { s: { pal: [[1, .8, .95], [1, .35, .75]], tint: [1, .4, .8] } },
      ice: { s: { pal: [[.85, .97, 1], [.35, .75, 1]], tint: [.4, .75, 1] } }, toxic: { s: { pal: [[.9, 1, .7], [.45, 1, .3]], tint: [.4, 1, .35] } } },
    init: s => Object.assign(s, { sp: [], em: [], fired: false, tint: [1, .75, .35] }),
    update(s, dt, at){
      if (!s.fired){ s.fired = true; s.shake = 6; const N = n => Math.round(n * EMIT[quality]), hot = s.pal?.[0] || [1, .88, .55], warm = s.pal?.[1] || [1, .58, .2], G = at.map['glow:W0'];
        const tc = [[0, [1, 1, .94]], [.12, hot], [.5, warm], [1, [warm[0] * .7, warm[1] * .3, warm[2] * .3]]];
        // искры: веер ±100° от вертикали; медленных больше, чем быстрых. Ушедшие ниже горизонта бьются о наковальню
        for (let i = 0; i < N(72); i++){ const a = -PI / 2 + (Math.random() * 2 - 1) * 1.75, v = 240 + 760 * Math.random() ** 1.7, dn = Math.sin(a) > .05;
          spawn(s.sp, { x: 180 + R(-4, 4), y: 178, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(8, 13), stretch: 1.3, speedStretch: .009, life: R(.4, 1.05), drag: 1.7, grav: 950, orient: true,
            floor: dn ? 186 : null, bounce: R(.25, .45), cells: [G], add: 1, tc, fadeIn: .01, fadeOut: .35, pul: 0 }); }
        // удар: короткие белые росчерки — самые быстрые и яркие, живут 2–4 кадра
        for (let i = 0; i < N(14); i++){ const a = -PI / 2 + R(-1.4, 1.4), v = R(1000, 1500);
          spawn(s.sp, { x: 180, y: 178, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(9, 13), stretch: 1.3, speedStretch: .01, life: R(.07, .14), drag: 6, orient: true, cells: [G], add: 1, tint: [1, .97, .9], fadeIn: .01, fadeOut: .6, pul: 0 }); }
        // искристая пыль у места удара
        for (let i = 0; i < N(26); i++){ const a = -PI / 2 + R(-1.8, 1.8), v = R(60, 300);
          spawn(s.sp, { x: 180, y: 178, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(5, 9), life: R(.4, .9), drag: 2.5, grav: 160, cells: [G], add: 1, tc, fadeIn: .01, fadeOut: .6, pul: .3, pf: 18 }); }
        // угольки: всплывают и покачиваются, остывают дольше всех — «долгое затухание»
        for (let i = 0; i < N(12); i++){ const a = -PI / 2 + R(-1.2, 1.2), v = R(50, 170);
          spawn(s.em, { x: 180 + R(-10, 10), y: 176, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(9, 14), life: R(1.1, 1.9), drag: 1.8, grav: -35, sway: R(8, 18), cells: [G], add: 1,
            tc: [[0, hot], [.6, warm], [1, tc[3][1]]], fadeIn: .02, fadeOut: .45, pul: .25, pf: R(6, 11) }); }
      }
      step(s.sp, dt); step(s.em, dt);
    },
    render(s, c){ const at = c.at, t = s.cycle, T = s.tint, G = at.map['glow:W0'];
      // тлеющее пятно на месте удара: остывает дольше вспышки
      if (t < 1.2){ const k = t / 1.2; sprite(c, 180, 180, 70 + 30 * k, 0, (1 - k) ** 2 * .7, 1, at.map['sglow:W0'], .6, s.pal?.[1] || [1, .5, .2]); }
      if (t < .32){ const k = t / .32;
        sprite(c, 180, 180, 200 + 200 * easeOut(k), 0, (1 - k) ** 2 * .85, 1, at.map['sglow:W0'], 1, T);                   // свечение цветом ранга
        sprite(c, 180, 180, 420 * easeOut(Math.min(1, k * 2)), 0, (1 - k) ** 3 * .9, 1, G, .07, [1, .92, .8]); }            // блик-полоса удара
      if (t < .1){ const k = t / .1; sprite(c, 180, 180, 120 + 90 * k, k * .4, 1 - k, 1, at.map['star:W0'], 1, [1, .97, .9]); sprite(c, 180, 180, 90, 0, 1 - k, 1, G, 1, [1, 1, 1]); }   // белое ядро — самый яркий кадр
      draw(c, s.sp); draw(c, s.em); } };

  // Зелье — эффект входа на Арену. Жижа — метаболы (режим 19): шарики сливаются в одну поверхность с объёмом и бликом.
  // Ожидание: капли кружат воронкой и стягиваются в центр → удар: лужа-желе с перелётом, 7 струй по 3 бусины разлетаются,
  // тянутся нитями, рвутся на капли, падают и тают; лужа колышется и стягивается. Из жижи вырастают призраки (режим 20)
  const GOO = 600;   // сторона квадрата жижи в единицах эффекта
  DEF.potion = { atlas: 'potion', period: 2.5, rate: 1.5, gfx: { speed: 1.5, ramp: 'potion' },
    init: s => Object.assign(s, { b: [], gh: [], tw: [], mb: new Float32Array(72), mbn: 0, hit: false, ghosts: false, sw: Array.from({ length: 7 }, (_, i) => ({ a: i / 7 * 6.28, r: R(11, 16) })) }),
    update(s, dt, at){
      const HIT = .14, t = s.cycle, B = s.b;   // короткое ожидание: всплеск почти сразу с входом
      if (t < HIT){ const k = Math.min(1, t / HIT); B.length = 0;   // воронка: капли по спирали к центру, растут и сливаются
        for (const w of s.sw){ w.a += dt * (3 + k * 12); const d = 118 * (1 - k) ** 1.4 + 6; B.push({ x: 180 + Math.cos(w.a) * d, y: 182 + Math.sin(w.a) * d * .75, r: w.r * (.6 + k * .9) }); } }
      else if (!s.hit){ s.hit = true; s.shake = 0; B.length = 0;
        for (let i = 0; i < 3; i++) B.push({ core: true, ph: i * 2.1, x: 180, y: 182, r: 0 });
        for (let j = 0; j < 7; j++){ const a = j / 7 * 6.28 + R(-.2, .2), v = R(420, 600) * (Math.sin(a) < 0 ? 1.1 : .62), r0 = R(17, 23);
          for (let k = 0; k < 3; k++) B.push({ x: 180 + Math.cos(a) * 14, y: 182 + Math.sin(a) * 14, vx: Math.cos(a) * v * (1 - k * .24), vy: Math.sin(a) * v * (1 - k * .24) - 60,
            r0: r0 * (1 - k * .22), age: 0, life: R(.75, 1.05) - k * .08 }); }
        for (let i = 0; i < 10; i++){ const a = R(0, 6.28), v = R(80, 240);
          spawn(s.tw, { x: 180, y: 176, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, size: R(14, 26), life: R(.5, 1.1), drag: 2, grav: -30, cells: [at.map['twinkle:W0']], add: 1, tint: [.75, 1, .45], fadeIn: .05, fadeOut: .5, pul: .3, pf: 16 }); }
      }
      if (s.hit){ const k = t - HIT;
        for (const b of B){
          if (b.core){ const end = 1 - Math.min(1, Math.max(0, (k - 1.05) / .5)) ** 2;   // лужа: перелёт и затухающие колебания, в конце стягивается
            b.r = 50 * Math.min(1, k / .07) * (1 + .22 * Math.sin(k * 15 + b.ph) * Math.exp(-k * 4)) * end * (b.ph ? .7 : 1);
            b.x = 180 + Math.cos(b.ph + k * 3) * 16 * Math.exp(-k * 1.5); b.y = 184 + Math.sin(b.ph + k * 2.4) * 9; continue; }
          b.age += dt; const d = Math.max(0, 1 - 1.1 * dt); b.vx *= d; b.vy = b.vy * d + 1000 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
          const q = b.age / b.life; b.r = b.r0 * Math.min(1, b.age / .05) * (q < .6 ? 1 : Math.max(0, 1 - (q - .6) / .4)); }
      }
      // в шейдер: до 24 шариков, координаты и радиус — в долях квадрата жижи (шире эффекта: капли не обрезаются)
      let n = 0; for (const b of B){ if (n >= 24 || !(b.r > .5)) continue; s.mb[n * 3] = (b.x - 180) / GOO + .5; s.mb[n * 3 + 1] = (b.y - 180) / GOO + .5; s.mb[n * 3 + 2] = b.r / GOO; n++; } s.mbn = n;
      // призраки вырастают из жижи: проявляются снизу вверх (кромка зелья по линии выхода), хвост извивается, уплывают вверх
      if (!s.ghosts && t > HIT + .12){ s.ghosts = true;
        for (let i = 0; i < 4; i++){ const a = -PI / 2 + (i - 1.5) * .75 + R(-.1, .1), v = R(170, 230) * (i === 1 || i === 2 ? 1.15 : .85);
          spawn(s.gh, { x: 180 + Math.cos(a) * 34, y: 178 + R(-6, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 1.4, grav: -70, sway: R(16, 28), size: [96, 58, 80, 66][i] * R(.92, 1.08), rot: Math.cos(a) * .3, vr: 0,   // разного размера: крупный, мелкий, средние
            scW: [[0, .7], [.2, 1.05], [.4, 1]], scH: [[0, 1.3], [.2, .95], [.4, 1]], life: [1.95, 1.15, 1.6, 1.35][i] * R(.92, 1.08), cells: [at.map['ghost']], mode: 20,   // и гаснут в разное время ramp: 'potion',
            ero: [[0, -.05], [.32, 1.1], [1, 1.1]], heat: [[0, 1.8], [.4, 1], [1, .7]], add: .15, fadeIn: .02, fadeOut: [.35, .55, .45, .5][i], pul: 0 }); }
      }
      for (const p of s.gh) p.rot += (Math.sin(p.age * 4 + p.ph) * .25 - p.rot) * Math.min(1, dt * 3);   // покачивается, а не крутится
      step(s.gh, dt); step(s.tw, dt);
    },
    render(s, c){ const at = c.at, t = s.cycle - .14;
      if (t >= 0 && t < .5){ const k = t / .5; sprite(c, 180, 182, 240 + 260 * easeOut(k), 0, (1 - k) * .5, 1, at.map['sglow:W0'], 1, [.3, .9, .25]);   // отсвет и ударная волна
        sprite(c, 180, 182, 80 + 420 * easeOut(k), 0, (1 - k) * .6, 1, at.map['sglow:W0'], .55, [.55, 1, .4]); }
      // жижа — один квадрат, но только вокруг шариков (с запасом на свечение): видеокарта не красит пустоту
      if (s.mbn){ const m = s.mb, q = s.rect || (s.rect = [0, 0, 0, 0]); q[0] = q[1] = 1; q[2] = q[3] = 0;
        // запас — где поле всех шариков, собранных в одну точку, падает до порога свечения 0.35: Σ1.3r²/d² = 0.35
        let r2 = 0; for (let i = 0; i < s.mbn; i++){ r2 += m[i * 3 + 2] ** 2; q[0] = Math.min(q[0], m[i * 3]); q[1] = Math.min(q[1], m[i * 3 + 1]); q[2] = Math.max(q[2], m[i * 3]); q[3] = Math.max(q[3], m[i * 3 + 1]); }
        const e = Math.sqrt(r2 * 1.3 / .35); for (let i = 0; i < 4; i++) q[i] = Math.min(1, Math.max(0, q[i] + (i < 2 ? -e : e)));
        sprite(c, 180, 180, GOO, 0, 1, 0, at.map['glow:W0'], 1, null, 0, [19, 0, 0, 0, RAMP_ROW.potion], q); }
      draw(c, s.tw); draw(c, s.gh); } };

  /* ── запуск и цикл ── */
  const live = new Set();
  let raf = 0, last = 0, ok = null, idle30 = true;
  // качество: 2 — полное, 1 — среднее, 0 — эконом. Плотность холста, частота частиц, мелкая октава шума.
  // Авто: если кадр дольше 24 мс (меньше ~40 к/с) полторы секунды подряд — ступенью ниже, до конца сессии
  const DPR = [1, 1.25, 1.5], EMIT = [.5, .75, 1];
  let quality = 2, auto = true, slow = 0, maxDpr = 1.5, lastDraw = 0, gap = 16, lite = false;
  let fill = 0;
  const stats = { ms: 0, js: 0, quads: 0, over: 0 };   // замер: среднее время кадра движка и его расчётной части (мс), частиц на экране
  function frame(now){
    raf = 0;
    // одни зацикленные фоны (без разовых эффектов) — 30 к/с: движение медленное, глаз не заметит, батарея и нагрев — вдвое меньше
    if (idle30 && now - lastDraw < 30){ let amb = true; for (const e of live) if (e.def.period || e.stopping){ amb = false; break; } if (amb){ raf = requestAnimationFrame(frame); return; } }
    const t0 = performance.now(); let q = 0, js = 0; fill = 0;
    const dt = Math.min(1 / 20, (now - last) / 1000 || 1 / 60); last = now;
    // эффекты мягкие — полная плотность экрана не нужна: 1.5× вместо 2–3× = в 2–4 раза меньше пикселей для видеокарты
    gap = gap * .9 + Math.min(100, now - lastDraw) * .1;
    if (auto && quality > 0 && live.size){ slow = gap > 24 && gap < 90 ? slow + (now - lastDraw) : 0; if (slow > 1500){ quality--; slow = 0; } }
    lastDraw = now;
    const HR = host ? host.getBoundingClientRect() : null, w = HR ? HR.width : innerWidth, h = HR ? HR.height : innerHeight, d = Math.min(maxDpr, DPR[quality], devicePixelRatio || 1);
    if (HR && !host.isConnected){ live.clear(); raf = 0; return; }
    if (w !== W || h !== H || d !== dpr){ W = w; H = h; dpr = d; cv.width = Math.round(w * d); cv.height = Math.round(h * d); gl.viewport(0, 0, cv.width, cv.height); }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    FT = (now / 1000) % 1000;
    fid++;
    for (const e of live){
      if (e.el){ if (!e.el.isConnected){ live.delete(e); continue; }
        let r = e.el.getBoundingClientRect(); if (HR) r = { left: r.left - HR.left, top: r.top - HR.top, right: r.right - HR.left, bottom: r.bottom - HR.top, width: r.width, height: r.height };
        e.ox = r.left + r.width / 2; e.oy = r.top + r.height / 2; e.k = r.width / 360; e.clip = r; }
      const vis = !e.clip || (e.clip.bottom > 0 && e.clip.top < h && e.clip.right > 0 && e.clip.left < w);
      if (!vis) continue;                                                      // за экраном — не считаем и не рисуем
      if (e.img){ if (e.img.err){ live.delete(e); continue; } if (!e.img.ok) continue;   // картинка ещё грузится — эффект ждёт, время не идёт
        if (!e.s.W){ const r = e.img.w / e.img.h, B = e.s.o.box || 240; e.s.W = r >= 1 ? B : B * r; e.s.H = r >= 1 ? B / r : B; } }
      let edt = dt * (e.def.rate || 1); if (e.s.freeze > 0){ e.s.freeze -= dt; edt = 0; }   // стоп-кадр удара: время эффекта стоит, кадр держится
      e.s.t += edt; e.s.cycle += edt;   // rate — своя скорость времени эффекта (1.5 — в полтора раза быстрее)
      if (e.stopping){ e.fade = Math.max(0, e.fade - dt / .4); if (!e.fade){ live.delete(e); continue; } }
      if (e.def.period && !e.loop && e.s.cycle >= e.def.period){ if (!e.s.o.hold){ live.delete(e); continue; } e.s.cycle = e.def.period - 1e-3; }   // разовый эффект отыграл (hold — замирает на последнем кадре до stop)
      const j0 = performance.now();
      e.def.update(e.s, edt, e.at);
      if (!e.tex.ok) continue;
      e.dt = dt; const sh = e.s.shake || 0; if (sh > .1){ e.s.shake *= Math.pow(.02, dt); } const bx = e.ox, by = e.oy; e.ox += (Math.random() - .5) * sh * e.k; e.oy += (Math.random() - .5) * sh * e.k;
      nq = 0; mask = 0; e.def.render(e.s, e); js += performance.now() - j0; e.ox = bx; e.oy = by;
      if (!nq) continue;
      // программа — из семей, которые эффект рисовал (запоминаем на эффект: новая семья позже — одна перекомпиляция, а не каждый кадр)
      const pr = program(e.def.fm = (e.def.fm | 0) | mask); if (!pr) continue;
      if (cur !== pr){ gl.useProgram(pr.p); cur = pr; }
      const loc = pr.loc;
      if (pr.f !== fid){ pr.f = fid; gl.uniform2f(loc.res, cv.width, cv.height); gl.uniform1f(loc.tm, (now / 1000) % 200); gl.uniform1f(loc.lq, quality < 2 ? 1 : 0); }   // время по кругу: большие числа в шейдере теряют точность — шум «ступенится»
      if (e.clip){ gl.enable(gl.SCISSOR_TEST); gl.scissor(Math.round(e.clip.left * dpr), Math.round((h - e.clip.bottom) * dpr), Math.round(e.clip.width * dpr), Math.round(e.clip.height * dpr)); }
      else gl.disable(gl.SCISSOR_TEST);
      const g = e.def.gfx || {};   // параметры шейдера эффекта: мультяшные ступени, сила искажения, скорость шума, градиент
      gl.uniform4f(loc.gp, g.bands || 0, g.dist || 0, g.speed || .8, RAMP_ROW[g.ramp] || .5 / RAMP_N);
      gl.uniform1f(loc.mbn, e.s.mbn || 0); if (e.s.mbn) gl.uniform3fv(loc.mb, e.s.mb);   // шарики жижи эффекта (метаболы)
      if (e.img){ gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, e.img.t); gl.activeTexture(gl.TEXTURE0); }
      gl.bindTexture(gl.TEXTURE_2D, e.tex.t);
      gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, nq * VF * 4), gl.STREAM_DRAW);
      gl.drawElements(gl.TRIANGLES, Math.min(nq, 16000) * 6, gl.UNSIGNED_SHORT, 0); q += nq;   // индексов — на 16 000 квадратов
    }
    stats.ms = stats.ms * .95 + (performance.now() - t0) * .05; stats.js = stats.js * .95 + js * .05; stats.quads = q; stats.fps = 1000 / gap; stats.q = quality; stats.over = stats.over * .9 + fill / (w * h) * .1;   // перерисовка: сколько раз в среднем закрашен каждый пиксель экрана
    if (live.size && !document.hidden) raf = requestAnimationFrame(frame);
    else { gl.clear(gl.COLOR_BUFFER_BIT); if (!live.size) rest(); }
  }
  // простой: холст убираем совсем (пустой слой на весь экран iPhone всё равно склеивает каждый кадр) и сжимаем до 1×1 —
  // отдаём буфер кадра (на iPhone ≈3–6 МБ); через минуту простоя выгружаем атласы, кроме заранее подготовленных (preload)
  let idleT = 0;
  const pinned = new Set();
  function rest(){
    cv.style.display = 'none'; clearTimeout(idleT);
    // сжатие — через 3 с простоя: крафты подряд не перевыделяют буфер каждый раз
    idleT = setTimeout(() => { if (live.size || !gl) return; cv.width = cv.height = 1; W = H = 0;
      idleT = setTimeout(() => { if (live.size || !gl) return; for (const k in tex) if (!pinned.has(k) && tex[k].ok){ gl.deleteTexture(tex[k].t); delete tex[k]; }
        for (const k in imgs){ gl.deleteTexture(imgs[k].t); delete imgs[k]; } }, 57000); }, 3000);
  }
  const kick = () => { if (!raf && live.size){ last = performance.now(); raf = requestAnimationFrame(frame); } };
  // освободить всё: цикл, эффекты, текстуры и буферы видеокарты, сам контекст WebGL и холст, запасы частиц и точек картинок.
  // Движок не умирает: следующий play/preload соберёт всё заново
  function release(){
    if (raf) cancelAnimationFrame(raf); raf = 0; live.clear(); clearTimeout(idleT);
    document.removeEventListener('visibilitychange', kick);
    if (gl && !gl.isContextLost()){
      for (const k in tex) gl.deleteTexture(tex[k].t); for (const k in imgs) gl.deleteTexture(imgs[k].t);
      for (const t of [noiseT, rampT, stripT]) if (t) gl.deleteTexture(t);
      gl.deleteBuffer(vbo); gl.deleteBuffer(ibo); for (const k in progs) if (progs[k]) gl.deleteProgram(progs[k].p);
      gl.getExtension('WEBGL_lose_context')?.loseContext();   // контекст отдаём сразу, не ждём сборщика (в Telegram на iOS их число ограничено)
    }
    if (cv){ cv.removeEventListener('webglcontextlost', release); cv.remove(); }
    for (const k in tex) delete tex[k]; for (const k in imgs) delete imgs[k]; for (const f of cleanup) f();   // пакеты чистят своё (точки картинок и т. п.)
    cv = gl = vbo = ibo = noiseT = rampT = stripT = null; progs = {}; cur = null; ok = null; W = H = 0; stripsAsked = false;
    for (const k in DEF) delete DEF[k].fm;
    POOL.length = 0; buf = new Float32Array(VF * 4 * 512);
  }

  // инструменты ядра для пакетов и своих эффектов (то же, чем написаны встроенные)
  const cleanup = [];   // уборка пакетов при destroy
  const kit = { cleanup, P0, R, PI, easeOut, spawn, step, curl, tcol, WHITE3, fade, emit, seq, FULL, crv, quad, quad4, ribbon, flick, wob, draw, BX, BW, band, trail, arcBand, seg, branch, zig, sprite,
    RAMPS, RAMP_ROW, RAMP_N, EMIT, DEF, chunk, get quality(){ return quality; }, get base(){ return base; } };
  FORGE_KITS.push(kit); for (const f of FORGE_PACKS) f.fn(kit);
  return {
    get names(){ return Object.keys(DEF); }, stats,
    // для витрины: пресеты эффекта, нужна ли картинка, разовый ли (длина)
    meta: n => ({ presets: Object.keys(DEF[n]?.presets || {}), img: !!DEF[n]?.img, period: DEF[n]?.period || 0 }),
    // всё, что есть: [{ name, presets, img, period }]
    list(){ return Object.keys(DEF).map(n => ({ name: n, ...this.meta(n) })); },
    // пакет эффектов (src/forge/*.js) и свой эффект: k — инструменты ядра; эффект — { atlas, period?, presets?, init(s), update(s, dt, at), render(s, c) }
    pack: forgePack,
    // повторный define с тем же именем заменяет эффект (конструктор пересобирает его на каждое изменение)
    define: (name, make) => { const id = 'def:' + name, i = FORGE_PACKS.findIndex(p => p.name === id); if (i >= 0) FORGE_PACKS.splice(i, 1);
      forgePack(id, k => { k.DEF[name] = typeof make === 'function' ? make(k) : make; }); },
    get packs(){ return FORGE_PACKS.map(p => p.name); },
    set base(v){ base = v; },
    set maxDpr(v){ maxDpr = v; },
    // качество: 0 эконом · 1 среднее · 2 полное; auto — снижать само при тормозах
    get quality(){ return quality; }, set quality(v){ quality = Math.max(0, Math.min(2, v | 0)); },
    get auto(){ return auto; }, set auto(v){ auto = !!v; },
    // экономный режим: эффекты на минимуме, заранее ничего не готовим, видеопамять и контекст отдаём; выключили — полное качество
    get lite(){ return lite; }, set lite(v){ lite = !!v; quality = lite ? 0 : 2; if (lite) release(); },
    set idle30(v){ idle30 = !!v; },
    // x, y — центр квадрата эффекта на экране (px), size — его сторона; el — привязать к элементу
    play(name, o = {}){
      // пресет — имя:вариант ('glitch:hard'): готовый набор настроек; s — поправки состояния эффекта после init (цвета, палитры)
      const [nm, pv] = name.split(':'), def = DEF[nm]; if (!def) return null;
      const pre = pv && def.presets?.[pv]; if (pre) o = Object.assign({}, pre, o);
      if (ok === null) ok = setup(); if (!ok) return null;
      const a = FX_ATLAS[def.atlas];
      const e = { def, at: a, tex: texture(def.atlas), s: { t: 0, cycle: 0, acc: {}, o }, loop: !!o.loop, el: o.el || null, fade: 1, stopping: false,
        ox: o.x ?? (host ? host.clientWidth : innerWidth) / 2, oy: o.y ?? (host ? host.clientHeight : innerHeight) / 2, k: (o.size || Math.min(innerWidth, innerHeight)) / 360, clip: null };
      def.init.call(def, e.s, a); if (o.s) Object.assign(e.s, o.s);
      if (def.img){ if (!o.img) return null; e.img = imgTex(o.img); }
      clearTimeout(idleT); cv.style.display = ''; live.add(e); kick();
      return { stop(){ e.stopping = true; }, kill(){ live.delete(e); }, alive: () => live.has(e), set(k, v){ e.s[k] = v; } };
    },
    stopAll(){ live.forEach(e => e.stopping = true); },
    // освободить видеопамять и контекст WebGL (экономный режим: эффекты не нужны); следующий play соберёт всё заново
    destroy: release,
    // диагностика для Дебага: есть ли WebGL, загрузились ли атласы, видеокарта, сколько частиц в последнем кадре
    info(){ if (ok === null) return 'fx: —'; if (!ok) return 'fx: нет WebGL';
      const T = Object.entries(tex), bad = T.filter(([, v]) => v.err).map(([k]) => k), di = gl.getExtension('WEBGL_debug_renderer_info');
      return `fx: ${T.filter(([, v]) => v.ok).length}/${T.length}${bad.length ? ' ошибка ' + bad.join(',') : ''} · q${quality} · ${stats.quads | 0} · прогр. ${Object.keys(progs).length} · ${di ? String(gl.getParameter(di.UNMASKED_RENDERER_WEBGL)).slice(0, 40) : 'gpu ?'}${gl.isContextLost() ? ' · контекст потерян' : ''}`; },
    _noise: () => noiseData(),   // для tools/fx-noise.mjs
    // заранее: холст и атлас — чтобы первый эффект не пропал, пока грузится картинка; в экономном режиме — ничего
    preload(atlas){ if (lite) return; if (ok === null) ok = setup(); if (ok){ pinned.add(atlas); texture(atlas); } },
  };
}
// пакеты — общие для всех экземпляров движка (общий холст и холсты внутри элементов): новый экземпляр получает уже подключённые
const FORGE_PACKS = [], FORGE_KITS = [];
function forgePack(name, fn){ if (FORGE_PACKS.some(p => p.name === name)) return; FORGE_PACKS.push({ name, fn }); for (const k of FORGE_KITS) fn(k); }
const Forge = makeForge(null);
