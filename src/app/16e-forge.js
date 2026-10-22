/* ═══════════════════════════════════════════════════════════════════════════
   ГОРН (Forge) — наш движок частиц на WebGL, без Rive.
   Перенос лаборатории design/rive/lab-fx (те же атласы и настройки): рисованные маски из Magnific,
   перекрашенные по ступеням (atlas.mjs → assets/fx/fx-<эффект>.webp + карта FX_ATLAS).
   Один холст поверх экрана, кадр — по одному вызову отрисовки на эффект; без эффектов цикл стоит.
   Forge.play('fire', { x, y, size, loop, el }) → { stop() }. Эффект задуман в квадрате 360×360:
   x, y — центр квадрата на экране, size — его сторона в px; el — следовать за элементом (и обрезать по нему).
   Файл самодостаточный (без общих переменных приложения) — его же грузит лаборатория.
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
  const TC = [1, 1, 1];
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
  let stripT, cv, gl, prog, vbo, ibo, loc, buf = new Float32Array(VF * 4 * 512), nq = 0, W = 0, H = 0, dpr = 1, noiseT, rampT;
  const FULL = [0, 0, 1, 1], TRS = [0, 0, 1, 1], tex = {}, NOFX = [0, 0, 0, 0, -1], FXS = [0, 0, 0, 0, -1];   // FXS — общий черновик: без новых массивов на каждую частицу
  // кривая по ключам [[доля жизни, значение], …] — линейно между ключами
  const crv = (K, k) => { if (k <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (k <= K[i][0]){ const [a, va] = K[i - 1], [b, vb] = K[i]; return va + (vb - va) * (k - a) / (b - a); } return K[K.length - 1][1]; };
  // квадрат: (m00, m01) — образ оси x, (m10, m11) — оси y, в единицах эффекта; c — текущий эффект; fx = [режим, растворение, жар, зерно]
  // rect — своя рамка внутри ячейки [x0, y0, x1, y1] (жижа: квадрат только вокруг шариков)
  function quad(c, cell, m00, m01, m10, m11, tx, ty, a, add, tint, inset, fx, rect){
    if (a <= .003 || cell == null) return;
    const at = c.at, h = at.cell / 2, k = c.k, ox = c.ox, oy = c.oy, f = fx || NOFX;
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
    const k = c.k, ox = c.ox, oy = c.oy, al = alpha * c.fade, f = fx;
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
  // след частицы: сплошная мягкая лента (режим 21) по последним точкам — к хвосту тоньше и прозрачнее, по оси белое ядро.
  // Вершины пишутся прямо в буфер, без новых массивов: следов сотни на кадр
  function trail(c, p, k, w){
    const T = p._tr, n = p.tn, N = p.trail, a = fade(p, k) * c.fade, tint = p.tc ? tcol(p.tc, k) : (p.tint || FULL), k2 = c.k, add = p.add;
    if (a <= .003) return;
    const P = i => (p.th - n + i + N) % N * 2;   // i-я точка от хвоста
    let j0 = P(0), x0 = T[j0], y0 = T[j0 + 1], j1 = P(1), nx0 = -(T[j1 + 1] - y0), ny0 = T[j1] - x0, l0 = Math.hypot(nx0, ny0) || 1; nx0 /= l0; ny0 /= l0;
    for (let i = 1; i < n; i++){
      const j = P(i), x1 = T[j], y1 = T[j + 1], jn = P(Math.min(n - 1, i + 1)), jp = P(i - 1);
      let nx1 = -(T[jn + 1] - T[jp + 1]), ny1 = T[jn] - T[jp]; const l1 = Math.hypot(nx1, ny1); if (l1 < 1e-4){ nx1 = nx0; ny1 = ny0; } else { nx1 /= l1; ny1 /= l1; }
      const u0 = (i - 1) / (n - 1), u1 = i / (n - 1), w0 = w * (.15 + .85 * u0) / 2, w1 = w * (.15 + .85 * u1) / 2;
      if ((nq + 1) * VF * 4 > buf.length){ const b = new Float32Array(buf.length * 2); b.set(buf); buf = b; }
      let o = nq * VF * 4;
      for (let v = 0; v < 4; v++){ const e = v === 0 || v === 3 ? 0 : 1, sd = v < 2 ? -1 : 1, x = e ? x1 : x0, y = e ? y1 : y0, nx = e ? nx1 : nx0, ny = e ? ny1 : ny0, ww = e ? w1 : w0;
        buf[o++] = (c.ox + (x + nx * ww * sd - 180) * k2) * dpr; buf[o++] = (c.oy + (y + ny * ww * sd - 180) * k2) * dpr; buf[o++] = 0; buf[o++] = 0;
        buf[o++] = a; buf[o++] = add; buf[o++] = tint[0]; buf[o++] = tint[1]; buf[o++] = tint[2];
        buf[o++] = e ? u1 : u0; buf[o++] = v < 2 ? 0 : 1; buf[o++] = 21; buf[o++] = .6; buf[o++] = .8; buf[o++] = 0;
        buf[o++] = 0; buf[o++] = 0; buf[o++] = 0; buf[o++] = 0; buf[o++] = -1; }
      nq++; fill += Math.hypot(x1 - x0, y1 - y0) * (w0 + w1) * k2 * k2;
      x0 = x1; y0 = y1; nx0 = nx1; ny0 = ny1;
    }
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
    'void main(){float RW=vr<0.?gp.w:vr;' +
    // 19 — жижа (метаболы): поле Σ 1.3r²/(d² + 0.3r²) от шариков (без бесконечности в центре — внутри лужи нет бугров от каждой капли); поверхность — порог поля, шарики сливаются и тянутся нитями.
    // Объём: нормаль из градиента поля → рассеянный свет, блик, тёмная кромка; внутри течёт шум; вокруг — мягкое свечение
    'if(vf.x>18.9&&vf.x<19.5){float t=tm*gp.z;vec2 p=vq;float f=0.;vec2 g=vec2(0.);' +
    'for(int i=0;i<24;i++){if(float(i)>=mbn)break;vec3 b=mb[i];vec2 d=p-b.xy;float r2=dot(d,d)+.3*b.z*b.z;float k=1.3*b.z*b.z/r2;f+=k;g-=2.*k/r2*d;}' +
    'if(f<.35){gl_FragColor=vec4(0.);return;}' +
    'float a=smoothstep(.93,1.07,f);float gw=smoothstep(.35,1.,f)*(1.-a)*.5;' +
    'vec3 n=normalize(vec3(-g/max(f,1.)*.013,1.));vec3 L=normalize(vec3(-.45,-.65,.7));float dif=clamp(dot(n,L),0.,1.);float sp=pow(clamp(dot(reflect(-L,n),vec3(0.,0.,1.)),0.,1.),26.);' +
    'float th=smoothstep(1.,4.,f);float w=texture2D(nz,p*1.1+vec2(t*.05,-t*.08)).g;float w2=texture2D(nz,p*2.2+vec2(w*.5,t*.06)).b;' +
    'float x=clamp(.16+dif*.52+th*.2+(w2-.5)*.34,0.,1.);float ol=1.-smoothstep(1.,1.25,f);' +
    'vec3 col=texture2D(rp,vec2(x,RW)).rgb*(1.-ol*.5)+vec3(sp*.9);vec3 gc=texture2D(rp,vec2(.62,RW)).rgb;' +
    'gl_FragColor=vec4((col*a+gc*gw)*va.x,(a+gw*.15)*va.x);return;}' +
    // 20 — призрак из жижи: картинка с волной (хвост извивается сильнее), проявляется снизу вверх по линии vf.y,
    // на линии — светящаяся кромка зелья; vf.z — сила волны, vf.w — фаза
    'if(vf.x>19.9&&vf.x<20.5){float t=tm*gp.z;vec2 q=vq;float tl=pow(q.y,1.6);' +
    'q.x+=sin(q.y*9.-t*7.+vf.w)*.05*tl*vf.z+sin(t*2.7+vf.w)*.012;q.y+=sin(q.x*7.+t*4.+vf.w)*.012*vf.z;' +
    'vec4 c=texture2D(tx,vc.xy+clamp(q,.01,.99)*vc.zw);float n=texture2D(nz,vq*1.5+vec2(vf.w,t*.3)).r;' +
    'float rv=vf.y;float sh=smoothstep(rv+.05,rv-.05,q.y+(n-.5)*.12);float ed=exp(-abs(q.y+(n-.5)*.12-rv)*28.)*step(.02,c.a);' +
    'vec3 col=mix(c.rgb*vt,texture2D(rp,vec2(.8,RW)).rgb,clamp(ed*1.2,0.,1.));float fl=.88+.12*sin(t*9.+vf.w*3.);' +
    'float A=c.a*sh*fl*va.x;gl_FragColor=vec4(col*A+texture2D(rp,vec2(.7,RW)).rgb*ed*.5*va.x,A);return;}' +
    // 16 — фрактал Жюлиа: z → z² + c, c медленно ходит по кругу (узор дышит и закручивается); цвет — по «скорости убегания»
    // и ловушке орбиты (как близко точка подходила к кругу) — даёт светящиеся нити. На экономном качестве — вдвое меньше шагов
    'if(vf.x>15.9&&vf.x<16.5){float t=tm*gp.z;vec2 p=(vq-.5)*2.;float rr=length(p);if(rr>1.){gl_FragColor=vec4(0.);return;}' +
    'float an=t*.21+vf.w;vec2 cc=vec2(-.745,.115)+.06*vec2(cos(an),sin(an*1.3));float ca=cos(t*.05),sa=sin(t*.05);vec2 z=mat2(ca,-sa,sa,ca)*p*1.25*vf.y;' +
    'float it=0.;float trap=9.;float N=lq>.5?14.:28.;for(int i=0;i<28;i++){if(float(i)>=N)break;z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+cc;trap=min(trap,abs(length(z)-.55));if(dot(z,z)>16.)break;it+=1.;}' +
    'float sm=it/N;float esc=step(it,N-.5);float gl=exp(-trap*22.);float v=clamp(esc*pow(sm,.7)*1.1+gl*.75,0.,1.);' +
    'float a=smoothstep(.08,.5,v)*smoothstep(1.,.6,rr)*vf.z;vec3 col=texture2D(rp,vec2(clamp(v*.95,0.,1.),RW)).rgb*vt;a*=va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    // 17 — плазма: шум, искажённый шумом, искажённым шумом (f(p + f(p + f(p)))) — течёт как жидкость; круглая маска
    'if(vf.x>16.9&&vf.x<17.5){float t=tm*gp.z;vec2 p=vq*1.4+vf.w;float rr=length(vq*2.-1.);if(rr>1.){gl_FragColor=vec4(0.);return;}' +
    'vec2 q=vec2(texture2D(nz,p*.5+vec2(t*.02,0.)).r,texture2D(nz,p*.5+vec2(.37,.11)-vec2(0.,t*.025)).g);' +
    'vec2 w=vec2(texture2D(nz,p*.5+q*.9+vec2(.17,.92)+t*.015).b,texture2D(nz,p*.5+q*.9+vec2(.83,.28)).r);' +
    'float f=texture2D(nz,p*.5+w*1.1+vec2(t*.01)).g;if(lq<.5){f=f*.75+texture2D(nz,p*1.3+w*.6).b*.25;}' +
    'float v=clamp((f*f*1.6+length(q)*.25+w.x*.35)*.72,0.,1.);float a=smoothstep(1.,.55,rr)*vf.z*(.45+v*.55);' +
    'vec3 col=mix(texture2D(rp,vec2(v,RW)).rgb,vt,clamp(length(w)*.6-.2,0.,.6));a=clamp(a,0.,1.)*va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    // 18 — плазма в форме: внутри маски (или круга) течёт шум, искажённый шумом, искажённым шумом; воронка — закручивает к центру
    // (быстрее у центра). vf.y — растворение (края рвутся по плазме), vf.z — жар, vf.w — зерно; цвет — градиент частицы
    'if(vf.x>17.9&&vf.x<18.6){float t=tm*gp.z;float md=floor(fract(vf.x+.001)*10.+.5);float m;' +
    'if(md>3.5){m=smoothstep(1.,.62,length(vq*2.-1.));}else{vec4 tc=texture2D(tx,vu);m=tc.r*clamp(tc.a*4.,0.,1.);}' +
    'if(m<.004){gl_FragColor=vec4(0.);return;}' +
    'vec2 u=vq;vec2 fl=vec2(0.,t*.09);if(md>1.5&&md<2.5||md>4.5){vec2 c=vq-.5;float r=length(c);float an=atan(c.y,c.x)+t*.5+.55/(r+.12);u=vec2(cos(an),sin(an))*r+.5;fl=vec2(0.);}' +
    'vec2 pp=u*1.5+vf.w;' +
    'vec2 q=vec2(texture2D(nz,pp*.5+fl+vec2(t*.015,0.)).r,texture2D(nz,pp*.5+fl+vec2(.37,.11)-vec2(0.,t*.02)).g);' +
    'vec2 w=lq>.5?q:vec2(texture2D(nz,pp*.5+q*1.1+fl*1.3+vec2(.17,.92)).b,texture2D(nz,pp*.5+q*1.1+fl*1.3+vec2(.83,.28)).r);' +
    'float f=texture2D(nz,pp*.55+w*1.2+fl*1.6).g;float v=clamp((f*f*1.6+length(q)*.25+w.x*.35)*.8,0.,1.);' +
    'float e=vf.y;float a=smoothstep(e,e+.16,m*(.5+v*.75));float x=clamp(m*vf.z*(.4+v*.9),0.,1.);' +
    'vec3 col=texture2D(rp,vec2(x,RW)).rgb*vt;a*=va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    // 15 — объёмное пламя из шума (принцип симуляций): одно сплошное тело, шум течёт вверх с искажением (domain warp),
    // к верху шума больше — пламя рвётся на языки; цвет — по «температуре» = яркость, которая падает с высотой.
    // vq.y=1 — низ. vf.y — ветер (изгиб к верху), vf.z — жар, vf.w — зерно
    'if(vf.x>14.9&&vf.x<15.5){float t=tm*gp.z;float h=1.-vq.y;float sd=vf.w;' +
    // за пределами возможного тела — сразу пусто, без чтения шума
    'if(abs(vq.x-.5-vf.y*h*h)>mix(.34,.08,pow(h,.75))+.22){gl_FragColor=vec4(0.);return;}' +
    // плазма внутри: шум q искажает шум w, w искажает основной — пламя течёт и закручивается, как жидкость (на экономе — одно искажение)
    'vec2 q=vec2(texture2D(nz,vec2(vq.x*.5+sd,vq.y*.4+t*.18)).g,texture2D(nz,vec2(vq.x*.5+sd+.31,vq.y*.4+t*.15)).b)-.5;if(lq>.5)q*=0.;' +
    'vec2 w=(vec2(texture2D(nz,vec2(vq.x*.7+sd,vq.y*.55+t*.3)+q*1.3).r,texture2D(nz,vec2(vq.x*.7+sd+.5,vq.y*.55+t*.26)+q*1.3).g)-.5)*2.;' +
    'float n=texture2D(nz,vec2(vq.x*1.3+sd,vq.y*1.1+t*.75)+w*.22).b*.55+texture2D(nz,vec2(vq.x*2.6+sd*1.7,vq.y*2.2+t*1.4)+w*.14).r*.3;' +
    // мелкая октава — только на полном качестве
    'n+=lq>.5?.075:texture2D(nz,vec2(vq.x*5.+sd*2.3,vq.y*4.4+t*2.4)).g*.15;' +
    'n=clamp((n-.5)*2.6,-1.,1.);' +
    'float md=floor(fract(vf.x+.001)*10.+.5);' +
    'float px=vq.x-.5+vf.y*h*h+w.x*.2*(.3+h);float wd=mix(.34,.06,pow(h,.85));' +
    'float shp=(1.-smoothstep(wd*.15,wd,abs(px)))*smoothstep(0.,md>1.5&&md<2.5?.4:.06,h)*(1.-smoothstep(.75,1.,h))*(1.-smoothstep(.4,.5,abs(vq.x-.5)));' +
    'float rg=1.-abs(n);float i=shp*(1.05-h*.4-n*(.3+h*1.25))+shp*rg*rg*h*.25-h*.06;i*=vf.z;' +
    'float a=md>2.5?smoothstep(.4,.8,i):smoothstep(.0,.24,i);' +
    // прожилки плазмы внутри тела: искажённый шум светлит/темнит пламя волнами, которые текут вверх и закручиваются
    'float pv=lq>.5?.5:texture2D(nz,vec2(vq.x*.9+sd*1.3,vq.y*.8+t*.42)+w*.55+q*1.2).r;float x=clamp(i*(.5+pv*.8),0.,1.);if(gp.x>0.){x=mix(x,floor(x*gp.x+.5)/gp.x,.55);}' +
    'vec3 col=texture2D(rp,vec2(x,RW)).rgb*vt;a*=va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    // 13 — лента хвоста: внутри бежит полоса (строка vf.y текстуры полос), к голове ярче и шире, белое ядро по оси
    'if(vf.x>12.9&&vf.x<13.5){float t=tm*gp.z;float ac=abs(vq.y*2.-1.);float tp=vq.x;float n=texture2D(nz,vec2(vc.x*.2-t*.3,vq.y*.5)).r;' +
    'vec2 su=vec2(vc.x*.32+t*vf.w,(vf.y+.08+clamp(vq.y+(n-.5)*.25*(1.-tp),0.,1.)*.84)/8.);float st=texture2D(sp,su).r;' +
    'float ed=smoothstep(1.,.5,ac);float core=exp(-ac*ac*14.)*pow(tp,1.6);float body=ed*pow(tp,1.1)*.45;float a=(st*ed*pow(tp,.45)*1.6+core*.75+body)*vf.z;' +
    'vec3 col=mix(vt,vec3(1.),clamp(core*1.1+st*st*.3,0.,1.));a=clamp(a,0.,1.)*va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    // 14 — маска × бегущая полоса: силуэт стоит, внутри течёт рисунок (огонь вверх); vf.y — растворение, vf.z — жар, vf.w — строка полос
    'if(vf.x>13.9&&vf.x<14.5){float t=tm*gp.z;vec4 tc=texture2D(tx,vu);float m=tc.r*clamp(tc.a*4.,0.,1.);if(m<.004){gl_FragColor=vec4(0.);return;}' +
    'float n=texture2D(nz,vq*.7+vec2(vf.w*.37,t*.4)).g;float st=texture2D(sp,vec2(vq.y*.55+t*.55+vf.w*.21,(floor(vf.w)+.1+fract(vq.x+(n-.5)*.3)*.8)/8.)).r;' +
    'float v=m*(.62+st*.6)+(n-.5)*.12;float e=vf.y;float a=smoothstep(e,e+.05,v);float x=clamp(pow(v,.75)*vf.z,0.,1.);if(gp.x>0.){x=floor(x*gp.x+.5)/gp.x;}' +
    'vec3 col=texture2D(rp,vec2(x,RW)).rgb*vt;a*=va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    // 21 — мягкая лента следа: поперёк — мягкий профиль с белым ядром (vf.y), вдоль — к хвосту (vq.x=0) гаснет; vf.z — яркость
    'if(vf.x>20.9&&vf.x<21.5){float ac=abs(vq.y*2.-1.);float a=(1.-ac)*(1.-ac)*pow(vq.x,1.4)*vf.z*va.x;vec3 col=mix(vt,vec3(1.),exp(-ac*ac*10.)*vf.y*vq.x);gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    'if(vf.x<.5){vec4 c=texture2D(tx,vu);float a=c.a*va.x;gl_FragColor=vec4(c.rgb*vt*a,a*(1.-va.y));return;}' +
    // 4 — лучи света веером (шум по углу), 5 — радужный обод (форма из атласа, цвет по углу и времени),
    // 6 — серп-взмах (дуга с утончёнными концами и белым ядром), 7 — поток внутри скруглённой кнопки (бегущие прожилки + блик)
    'if(vf.x>3.9){vec2 cc=vq*2.-1.;float r=length(cc);float an=atan(cc.y,cc.x);float t=tm*gp.z;vec3 col=vt;float a=0.;' +
    'if(vf.x<4.5){float n=texture2D(nz,vec2(an/6.2832*vf.y+t*.03+vf.w,.37)).r;float n2=texture2D(nz,vec2(an/6.2832*vf.y*2.-t*.05+vf.w,.71)).g;' +
    'a=pow(clamp(n*.6+n2*.5,0.,1.),3.)*2.2*(1.-smoothstep(.15,1.,r))*smoothstep(0.,.12,r)*vf.z;}' +
    'else if(vf.x<5.5){float m=texture2D(tx,vu).a;float h=fract(an/6.2832+t*.15+vf.w);col=mix(.5+.5*cos(6.2832*(h+vec3(0.,.33,.67))),vec3(1.),.3)*vt;a=m*vf.z;}' +
    'else if(vf.x<6.5){float f=max(vf.y,.01);float u=(an/(3.1416*f)+1.)*.5;float inA=step(0.,u)*step(u,1.);float th=vf.z*pow(max(sin(u*3.1416),0.),.8);' +
    'float d=abs(r-.72);float core=1.-smoothstep(th-.015,th+.005,d);float gl=exp(-max(d-th,0.)/.05)*.55*sin(clamp(u,0.,1.)*3.1416);a=max(core,gl)*inA;col=mix(vt,vec3(1.),core*smoothstep(th,0.,d)*.7);}' +
    'else if(vf.x<7.5){vec2 pp=(vq-.5)*vec2(vf.y,1.);vec2 hs=vec2(vf.y*.5,.5)-.42;float sd=length(max(abs(pp)-hs,0.))-.42;float mk=smoothstep(.01,-.02,sd);' +
    'float w1=texture2D(nz,vec2(vq.x*vf.y*.25-t*.12,vq.y*.3+.2)).r;float ln=pow(1.-abs(sin((vq.y+w1*.45)*7.+t*1.2)),9.)*.7;' +
    'float sw=exp(-pow((pp.x+pp.y*.6-(fract(t*.25+vf.w)*2.-1.)*(vf.y*.5+1.))*3.5,2.));a=(ln*.55+sw*.6)*mk*vf.z;col=mix(vt,vec3(1.),sw*.7+ln*.3);}' +
    // 8 — мультяшная форма: жёсткий край по порогу (растворение по шуму), 3 ступени цвета, тёмная обводка по краю
    'else if(vf.x<8.5){vec4 tc=texture2D(tx,vu);float m=tc.r*clamp(tc.a*4.,0.,1.);if(m<.004){gl_FragColor=vec4(0.);return;}float n=texture2D(nz,vq*.8+vec2(vf.w,t*.25)).b;float v=m+(n-.5)*.22;' +
    'float e=max(vf.y,.05);a=smoothstep(e,e+.02,v);float ol=1.-smoothstep(e+.05,e+.07,v);float x=clamp(v*vf.z,0.,1.);x=floor(x*3.+.5)/3.;' +
    'vec4 t2=texture2D(tx,clamp(vu+vec2(-.03,.06)*vc.zw,vc.xy,vc.xy+vc.zw));float sh=smoothstep(.04,.14,t2.r*clamp(t2.a*4.,0.,1.)-m);' +
    'col=texture2D(rp,vec2(x,RW)).rgb;col=mix(col,texture2D(rp,vec2(.15,RW)).rgb*.8,sh*.85);col=mix(col,texture2D(rp,vec2(0.,RW)).rgb*.6,ol)*vt;}' +
    // 9 — спираль-фон (два рукава, яркий центр), градиент — строка vf.w
    'else if(vf.x<9.5){float lr=log(max(r,.02));float sp=sin(an*vf.y+lr*4.5-t*2.);float x=clamp(1.15-r*.85+sp*.13,0.,1.);col=texture2D(rp,vec2(x,vf.w)).rgb;a=vf.z;}' +
    // 10 — хвост из точек (полутон): точки растут к голове (+x) и к оси хвоста; сетка vf.y × vf.w
    'else if(vf.x<10.5){vec2 gr=vec2(vf.y,vf.w);vec2 g=vq*gr;vec2 f=fract(g)-.5;vec2 id=(floor(g)+.5)/gr;float it=pow(id.x,1.6)*(1.-pow(abs(id.y*2.-1.),2.));' +
    'float rd=.48*it;float dt=smoothstep(rd,rd-.12,length(f));float gw=pow(vq.x,2.)*(1.-pow(abs(vq.y*2.-1.),1.5))*.45;a=max(dt*vf.z,gw);col=mix(vt,vec3(1.),dt*it*.5);}' +
    // 11 — правильный многоугольник: vf.y сторон, vf.z толщина (0 — залитый), vf.w поворот
    'else if(vf.x<12.5){float R=.62;float rr=r/R;float n=texture2D(nz,vec2(an/6.2832*2.+t*.04+vf.w,rr*.5-t*.12)).r;' +
    'float ln=pow(1.-abs(sin(rr*6.+n*7.-t*1.3)),5.)*smoothstep(1.,.35,rr);float fr=pow(clamp(rr,0.,1.),5.);' +
    'vec3 c1=mix(vt,vt*.4,ln*.85);c1=mix(c1,min(vt*1.2+.25,1.),step(.45,fr));c1=mix(c1,vec3(1.,.92,.78),step(.78,fr));' +
    'float ins=smoothstep(R+.008,R-.008,r);float gw=exp(-max(r-R,0.)/.05);a=max(ins,gw*.85);col=mix(mix(vt,vec3(1.,.85,.7),.6),c1,ins);}' +
    'else{float sg=6.2832/vf.y;float aa=mod(an+vf.w+sg*.5,sg)-sg*.5;float d=r*cos(aa)-.7;float cr;float gd;' +
    'if(vf.z<.001){cr=smoothstep(.015,-.015,d);gd=max(d,0.);}else{cr=smoothstep(vf.z,vf.z-.03,abs(d));gd=max(abs(d)-vf.z,0.);}a=max(cr,exp(-gd/.07)*.5);col=mix(vt,vec3(1.),cr*.6);}' +
    'a=clamp(a,0.,1.)*va.x;gl_FragColor=vec4(col*a,a*(1.-va.y));return;}' +
    // 2 — туманность, 3 — нити: рисуются целиком из шума, без маски атласа (круглое мягкое пятно, цвет — из градиента)
    'if(vf.x>1.9){vec2 cc=vq*2.-1.;float rr=length(cc);float mk=smoothstep(1.,.45,rr);float t=tm*gp.z;' +
    'float n1=texture2D(nz,vq*.9+vec2(vf.w,0.)+vec2(t*.03,t*.02)).r;float n2=texture2D(nz,vq*1.6+vec2(0.,vf.w)-vec2(t*.025,-t*.035)).g;' +
    'vec2 w=vec2(n1,n2)-.5;float v;' +
    'if(vf.x<2.5){float n3=texture2D(nz,vq*1.3+w*.7+vec2(t*.02,-t*.015)).b;v=smoothstep(.3,.8,n3*.75+n1*.45-.12);float rd=1.-abs(n2*2.-1.);v+=pow(rd,7.)*.7;}' +
    'else{float n3=texture2D(nz,vq*1.15+w*.55+vec2(-t*.03,t*.02)).b;float rd=1.-abs(n3*2.-1.);v=pow(rd,20.)*1.2+pow(rd,4.)*.1;}' +
    'v*=mk*vf.z;float a=clamp(v,0.,1.)*va.x;vec3 col=texture2D(rp,vec2(clamp(v,0.,1.),RW)).rgb;gl_FragColor=vec4(col*vt*a,a*(1.-va.y));return;}' +
    // шум бежит вверх по частице; у каждой частицы свой участок (зерно)
    'vec2 nu=vq*vec2(.7,.55)+vec2(vf.w,vf.w*1.37)+vec2(0.,tm*gp.z);' +
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
    'a*=va.x;gl_FragColor=vec4(col*vt*a,a*(1.-va.y));}';

  // шум: бесшовный 128×128, три независимых слоя (r, g — искажение, b — растворение)
  function noiseTex(){
    const N = 128, d = new Uint8Array(N * N * 4), hash = (x, y, s) => { const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };
    const vn = (x, y, per, s) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
      const g = (a, b) => hash(((a % per) + per) % per, ((b % per) + per) % per, s);
      return g(xi, yi) * (1 - u) * (1 - w) + g(xi + 1, yi) * u * (1 - w) + g(xi, yi + 1) * (1 - u) * w + g(xi + 1, yi + 1) * u * w; };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let ch = 0; ch < 3; ch++){
      let v = 0, amp = .5, tot = 0; for (let o = 0, per = 4; o < 4; o++, per *= 2){ v += vn(x / N * per, y / N * per, per, ch * 9 + o) * amp; tot += amp; amp *= .5; }
      d[(y * N + x) * 4 + ch] = v / tot * 255; d[(y * N + x) * 4 + 3] = 255;
    }
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
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
  function rampTex(){
    const d = new Uint8Array(256 * RAMP_N * 4);
    Object.entries(RAMPS).forEach(([name, st], row) => { RAMP_ROW[name] = (row + .5) / RAMP_N;
      for (let i = 0; i < 256; i++){ const x = i / 255; let j = 1; while (j < st.length - 1 && st[j][0] < x) j++;
        const [a, ca] = st[j - 1], [b, cb] = st[j], t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        for (let ch = 0; ch < 3; ch++){ const A = parseInt(ca.slice(ch * 2, ch * 2 + 2), 16), B = parseInt(cb.slice(ch * 2, ch * 2 + 2), 16); d[(row * 256 + i) * 4 + ch] = A + (B - A) * t; }
        d[(row * 256 + i) * 4 + 3] = 255; } });
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
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)){ console.error('fx shader', gl.getProgramInfoLog(prog), gl.getShaderInfoLog(gl.getAttachedShaders(prog)[1])); return false; }
    gl.useProgram(prog);
    loc = { mb: gl.getUniformLocation(prog, 'mb'), mbn: gl.getUniformLocation(prog, 'mbn'), res: gl.getUniformLocation(prog, 'res'), lq: gl.getUniformLocation(prog, 'lq'), tm: gl.getUniformLocation(prog, 'tm'), gp: gl.getUniformLocation(prog, 'gp') };
    gl.uniform1i(gl.getUniformLocation(prog, 'tx'), 0); gl.uniform1i(gl.getUniformLocation(prog, 'nz'), 1); gl.uniform1i(gl.getUniformLocation(prog, 'rp'), 2); gl.uniform1i(gl.getUniformLocation(prog, 'sp'), 3);
    vbo = gl.createBuffer(); ibo = gl.createBuffer();
    const idx = new Uint16Array(6 * 16000); for (let i = 0, v = 0; i < idx.length; i += 6, v += 4) idx.set([v, v + 1, v + 2, v, v + 2, v + 3], i);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    [['p', 2, 0], ['uv', 2, 2], ['aa', 2, 4], ['tn', 3, 6], ['q', 2, 9], ['fx', 4, 11], ['cr', 4, 15], ['rw', 1, 19]].forEach(([n, size, off]) => {
      const l = gl.getAttribLocation(prog, n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, VF * 4, off * 4); });
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.activeTexture(gl.TEXTURE1); noiseT = noiseTex();
    gl.activeTexture(gl.TEXTURE2); rampT = rampTex();
    // полосы для прокрутки (хвосты, огонь внутри маски): повтор по ширине; пока не загрузились — чёрные
    gl.activeTexture(gl.TEXTURE3); stripT = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, stripT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    { const im = new Image(); im.onload = () => { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, stripT); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      gl.activeTexture(gl.TEXTURE0); }; im.src = base + 'fx-strips.webp'; }
    gl.activeTexture(gl.TEXTURE0);
    return true;
  }
  function texture(name){
    if (tex[name]) return tex[name];
    const t = tex[name] = { ok: false, t: gl.createTexture() }, im = new Image();
    im.onload = () => { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      t.ok = true; };
    im.onerror = () => { t.err = true; };   // для диагностики (Дебаг → строка внизу)
    im.src = base + 'fx-' + name + '.webp';
    return t;
  }

const PL = (row, ero, heat, seed, md) => [18 + (md || 0), ero, heat, seed, RAMP_ROW[row]];   // плазма для sprite()
  /* ── эффекты (перенос tfire/tboom/… .luau) ──
     init(s) — состояние; update(s, dt); render(s, c) — рисует слоями; period — длина разового эффекта (сек) */
  const DEF = {};

  // Костёр по приёмам стилизованного огня (LoL / Overwatch / мобильные): серые маски красит шейдер по температуре,
  // два слоя цвета — внешняя оболочка (красно-оранжевая) и ядро (жёлто-кремовое) теми же силуэтами поменьше;
  // язык рождается приплюснутым, вытягивается и сужается, гнётся по ветру скосом (основание стоит),
  // кончик колышет шум, к концу жизни язык рвётся по шуму (растворение) и остывает — краснеет.
  const FIRE_W = [[0, 1.3], [.3, 1], [.75, .8], [1, .6]], FIRE_H = [[0, .5], [.22, 1.05], [.7, 1.15], [1, 1.05]];
  DEF.boom = { atlas: 'boom', period: 2.4,
    init: s => Object.assign(s, { fired: false, smoke: [], fire: [], sparks: [] }),
    update(s, dt, at){
      const CX = 180, CY = 200;
      if (s.cycle >= 2.4){ s.cycle -= 2.4; s.fired = false; }
      if (!s.fired && s.cycle > .05){ s.fired = true;
        for (let i = 1; i <= 16; i++){ const a = i / 16 * 6.28 + R(0, .3), sp = R(150, 350);
          spawn(s.smoke, { x: CX, y: CY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .8 - 40, rot: R(0, 6.28), vr: R(-.75, .75), size: R(70, 110), grow: 1.4, life: R(1, 1.4),
            cells: seq(at, i % 2 ? 'smoke2' : 'smoke1', 'S0', 'S0', 'S1', 'S2', 'S3'), add: .35, alpha: .95, drag: 3.2, grav: -60, fadeIn: .04, fadeOut: .45 }); }
        // ядро огненного шара — плазма в форме клубов: течёт и кипит, остывает от жёлтого к тёмно-красному, края рвутся
        for (let i = 0; i < 5; i++){ const a = i / 5 * 6.28 + R(-.3, .3), sp = R(60, 180);
          spawn(s.smoke, { x: CX, y: CY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .8 - 30, rot: R(0, 6.28), vr: R(-.6, .6), size: R(105, 135), grow: .8, life: R(.65, .9), drag: 3,
            cells: [at.map[i % 2 ? 'smoke2:S0' : 'smoke1:S0']], mode: 18, ramp: 'flame', add: .55, heat: [[0, 1.5], [.4, 1.05], [1, .55]], ero: [[0, .02], [.6, .12], [1, .7]], fadeIn: .02, fadeOut: .3 }); }
        for (let i = 0; i < 10; i++) spawn(s.smoke, { x: CX + R(-30, 30), y: CY - 20, vx: R(-20, 20), vy: R(-80, -40), rot: R(0, 6.28), vr: R(-.25, .25), size: 90, grow: 1.6, life: 2,
          cells: seq(at, 'smoke1', 'S1', 'S2', 'S3'), add: 0, alpha: .55, sway: 12, fadeIn: .25, fadeOut: .5 });
        for (let i = 1; i <= 10; i++){ const a = i / 10 * 6.28;
          spawn(s.fire, { x: CX, y: CY, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 - 60, rot: a + PI / 2, size: 110, grow: -.4, life: .45, cells: seq(at, 'flame1', 'F0', 'F1', 'F2', 'F3'), add: 1, drag: 2, fadeIn: .05, fadeOut: .5 }); }
        for (let i = 0; i < 34; i++){ const a = R(0, 6.28), sp = R(300, 750);
          spawn(s.sparks, { x: CX, y: CY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(22, 38), life: R(.5, .9), cells: seq(at, 'streak', 'F0', 'F1', 'F2', 'F3'), add: 1, drag: 1.5, grav: 700, orient: true, speedStretch: .0015, fadeIn: .02, fadeOut: .5 }); }
      }
      for (const L of [s.smoke, s.fire, s.sparks]) step(L, dt);
    },
    render(s, c){
      const at = c.at, CX = 180, CY = 200, t = s.cycle - .05;
      draw(c, s.smoke);
      if (t >= 0 && t < .5){ const k = t / .5; sprite(c, CX, CY, 60 + 460 * (1 - (1 - k) ** 3), 0, (1 - k) * .9, 1, at.map['ring:F1']); }
      draw(c, s.fire); draw(c, s.sparks);
      if (t >= 0 && t < .35){ const k = t / .35;
        sprite(c, CX, CY, 260 + 200 * k, k * .5, 1 - k, 1, at.map['glow:F0']);
        if (t < .16) sprite(c, CX, CY, 140 + 360 * (t / .16), .2, 1 - t / .16, 1, at.map['star:F0']); }
    } };

  DEF.portal = { atlas: 'portal',
    init: s => Object.assign(s, { wisps: [], tun: [], inP: [] }),
    update(s, dt, at){
      const CX = 180, CY = 180;
      emit(s.acc, 1, 2.6, dt, () => spawn(s.tun, { x: CX, y: CY, size: 300, grow: -.7, life: 1.5, rot: R(0, 6.28), vr: .6, cells: seq(at, 'sring', 'M3', 'M2', 'M1'), add: 1, alpha: .32, fadeIn: .35, fadeOut: .3 }));
      emit(s.acc, 2, 3, dt, () => s.wisps.push({ a: R(0, 6.28), r: 150, age: 0, life: R(1.1, 1.5), cell: at.map[Math.random() < .5 ? 'sswirl:M1' : 'sswirl:M2'] }));
      emit(s.acc, 3, 40, dt, () => { const a = R(0, 6.28);
        spawn(s.inP, { x: CX + Math.cos(a) * 160, y: CY + Math.sin(a) * 160, vx: -Math.sin(a) * 240 - Math.cos(a) * 40, vy: Math.cos(a) * 240 - Math.sin(a) * 40, size: R(18, 28), life: .9,
          cells: seq(at, 'spark', 'M3', 'M2', 'M1', 'M0'), add: 1, alpha: .9, orient: true, speedStretch: .0015, fadeIn: .2, fadeOut: .3 }); });
      // притяжение искр к центру (ближе — сильнее); у центра исчезают
      for (const p of s.inP){ const dx = CX - p.x, dy = CY - p.y, d = Math.max(Math.hypot(dx, dy), 8), g = 48000 / d;
        p.vx += dx / d * g * dt; p.vy += dy / d * g * dt; if (d < 30) p.age = Math.max(p.age, p.life * .75); }
      // завитки: угловая скорость растёт при сужении орбиты (как вода в воронке)
      s.wisps = s.wisps.filter(w => { w.age += dt; if (w.age >= w.life) return false; w.r = 150 * (1 - w.age / w.life) ** 1.3 + 20; w.a += (1.2 + 160 / w.r) * dt; return true; });
      step(s.tun, dt); step(s.inP, dt);
    },
    render(s, c){
      const at = c.at, CX = 180, CY = 180, t = s.t, pulse = 1 + .05 * Math.sin(t * 5);
      sprite(c, CX, CY, 380, 0, .5, 1, at.map['sglow:M2']);
      sprite(c, CX, CY, 330, t * .25, .5, 1, at.map['rune:M1']);
      // тёмное окно: свечение, перекрашенное почти в чёрный, обычным смешиванием
      sprite(c, CX, CY, 240 * pulse, 0, .95, 0, at.map['sglow:M2'], 1, [.16, .08, .3]);
      // плазменная воронка: жидкий фиолетовый вихрь закручивается к центру
      sprite(c, CX, CY, 250 * pulse, 0, 1, .25, 0, 1, null, 0, PL('portal', .05, .62, .4, .5));
      draw(c, s.tun);
      sprite(c, CX, CY, 250 * pulse, 0, .7, 1, at.map['sring:M1']);
      for (const w of s.wisps){ const k = w.age / w.life, al = Math.min(1, k / .2) * Math.min(1, (1 - k) / .35);
        sprite(c, CX + Math.cos(w.a) * w.r, CY + Math.sin(w.a) * w.r, 80 * (.5 + .5 * w.r / 170), w.a + 3.6, .8 * al, 1, w.cell); }
      draw(c, s.inP);
      sprite(c, CX, CY, 90 * pulse, 0, .35, 1, at.map['sglow:M0']);
      sprite(c, CX, CY, 60 * pulse, 0, .5, 1, at.map['sglow:M3']);
      for (let k = 0; k < 8; k++){ const ph = (t * .6 + k * .37) % 1, tw = Math.max(0, Math.sin(ph * PI)) ** 2, a = k * .785 + .3;
        if (tw > .02) sprite(c, CX + Math.cos(a) * (140 + k * 4), CY + Math.sin(a) * (140 + k * 4), 44 * tw, t, tw, 1, at.map['twinkle:M0']); }
    } };

  DEF.bolt = { atlas: 'bolt', period: 1.8,
    init: s => Object.assign(s, { fired: false, dust: [], sparks: [], jit: [] }),
    update(s, dt, at){
      const GX = 180, GY = 318;
      if (s.cycle >= 1.8){ s.cycle -= 1.8; s.fired = false; }
      if (!s.fired && s.cycle > .4){ s.fired = true;
        for (let i = 1; i <= 12; i++){ const side = i % 2 ? -1 : 1;
          spawn(s.dust, { x: GX + side * R(10, 30), y: GY - R(0, 12), vx: side * R(80, 220), vy: R(-60, -20), rot: R(0, 6.28), vr: R(-1, 1), size: R(50, 80), grow: .9, life: R(.8, 1.2),
            cells: seq(at, 'dust', 'D0', 'D1'), add: 0, alpha: .75, drag: 2.6, grav: -20, fadeIn: .05, fadeOut: .6 }); }
        for (let i = 0; i < 22; i++){ const a = -PI / 2 + R(-1.2, 1.2), sp = R(250, 520);
          spawn(s.sparks, { x: GX, y: GY - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(16, 26), life: R(.4, .7), cells: seq(at, 'spark', 'E0', 'E1'), add: 1, drag: 1.2, grav: 900, orient: true, speedStretch: .002, fadeIn: .02, fadeOut: .5 }); }
      }
      // дуги вокруг молнии — новые раз в кадр анимации (20 к/с), а не каждый кадр экрана
      const f = Math.floor((s.cycle - .4) / .05);
      if (f !== s.jf){ s.jf = f; s.jit = [0, 1, 2].map(() => [R(-40, 40), R(80, 280), R(70, 110), R(0, 6.28)]); s.cr = [R(-10, 10), R(0, 6.28)]; }
      step(s.dust, dt); step(s.sparks, dt);
    },
    render(s, c){
      const at = c.at, GX = 180, GY = 318, cy = s.cycle, pre = Math.min(1, cy / .4), after = Math.min(1, Math.max(0, 1 - (cy - .4) / 1));
      const back = [], top = [];
      back.push([GX, 20, 300, 0, .25 + .45 * pre * pre * (cy > .4 ? after : 1), 1, at.map['sglow:E2'], .6]);
      const t = cy - .4;
      if (t >= 0){
        const frame = Math.floor(t / .05), live = t < .32 && (frame < 4 || frame % 2 === 0);
        if (live){ const sx = frame % 3 === 1 ? -1 : 1, dx = (frame % 3 - 1) * 10;
          back.push([GX, GY / 2, 600, 0, .55, 1, at.map['sglow:E1'], 1.2]);
          top.push([GX + dx, GY / 2 + 10, 300 * sx, .1 * sx, .85, 1, at.map['bolt:E1'], 2 / sx]);
          top.push([GX + dx, GY / 2 + 10, 230 * sx, .1 * sx, 1, 1, at.map['bolt:E0'], 2.6 / sx]);
          s.jit.forEach((j, k) => top.push([GX + j[0], j[1], j[2], j[3], .8, 1, at.map[k % 2 ? 'arc:E1' : 'arc:E0']])); }
        if (t < .6){ const k = t / .6;
          back.push([GX, GY, 80 + 340 * easeOut(k), 0, (1 - k) * .9, 1, at.map['sring:E1'], .32]);
          back.push([GX, GY - 4, 220, 0, (1 - k) * .8, 1, at.map['ground:E1'], .6]);
          top.push([GX, GY - 20, 140 + 120 * k, 0, (1 - k) ** 2, 1, at.map['burst:E0']]);
          if (frame % 2 === 0) top.push([GX + s.cr[0], GY - 10, 110, s.cr[1], 1 - k, 1, at.map['crackle:E0']]); }
        if (t < .12) top.push([180, 180, 900, 0, .35 * (1 - t / .12), 1, at.map['sglow:E1']]);
      }
      back.forEach(a => sprite(c, ...a)); draw(c, s.dust); top.forEach(a => sprite(c, ...a)); draw(c, s.sparks);
    } };

  DEF.coins = { atlas: 'coins', period: 3,
    init: s => Object.assign(s, { fired: false, items: [], tw: [] }),
    update(s, dt, at){
      const FLOOR = 318;
      if (s.cycle >= 3){ s.cycle -= 3; s.fired = false; }
      if (!s.fired && s.cycle > .1){ s.fired = true; s.items = [];
        for (let i = 1; i <= 22; i++){ const a = -PI / 2 + R(-.6, .6), sp = R(380, 620);
          s.items.push({ x: 180 + R(-10, 10), y: 250, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spin: R(0, 6.28), vs: R(9, 16), rot: R(-.3, .3), size: R(36, 48),
            gem: i % 6 === 0 ? 1 : i % 7 === 0 ? 2 : i % 11 === 0 ? 3 : 0, rest: false }); } }
      for (const c of s.items){ if (c.rest) continue;
        c.vy += 1300 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.spin += c.vs * dt;
        if (c.y > FLOOR - c.size * .4 && c.vy > 0){ c.y = FLOOR - c.size * .4; c.vy *= -.42; c.vx *= .6; c.vs *= .6; if (Math.abs(c.vy) < 70){ c.rest = true; c.vy = 0; c.spin = 0; } } }
      // блики: на случайной монете вспыхивает звёздочка
      if (s.items.length && Math.random() < dt * 14){ const c = s.items[Math.floor(Math.random() * s.items.length)];
        spawn(s.tw, { x: c.x + R(-8, 8), y: c.y + R(-10, 4), size: R(26, 40), life: .45, rot: R(0, 1), vr: 2, cells: seq(at, 'twinkle', 'W0', 'G0'), add: 1, fadeIn: .35, fadeOut: .5 }); }
      step(s.tw, dt);
    },
    render(s, c){
      const at = c.at, t = s.cycle - .1, all = Math.min(1, Math.max(0, (3 - s.cycle) / .35));
      sprite(c, 180, 250, 360, 0, .35 * all, 1, at.map['sglow:G1'], .8);
      if (t >= 0 && t < .5){ const k = t / .5; sprite(c, 180, 250, 160 + 260 * easeOut(k), k * .6, 1 - k, 1, at.map['burst:G0']); sprite(c, 180, 250, 220, 0, (1 - k) * .8, 1, at.map['sglow:G0']); }
      for (const it of s.items){
        let cell, sx = 1;
        if (it.gem) cell = at.map[['gem', 'gem2', 'gemP'][it.gem - 1]];
        else { const cs = Math.cos(it.spin), a = Math.abs(cs); cell = at.map[a > .7 ? 'coinF' : a > .25 ? 'coinT' : 'coinE']; sx = cs < 0 ? -1 : 1; }
        // зеркало по знаку cos — монета вращается в обе стороны
        sprite(c, it.x, it.y, it.size * sx * 1.6, it.rot * (it.rest ? .3 : 1), all, 0, cell, sx);
      }
      draw(c, s.tw);
    } };

  DEF.confetti = { atlas: 'confetti', period: 3.2,
    init: s => Object.assign(s, { fired: false, parts: [], tw: [] }),
    update(s, dt, at){
      const COLS = [[1, .43, .77], [1, .81, .33], [.38, .81, 1], [.51, .91, .59], [.69, .52, 1]];
      if (s.cycle >= 3.2){ s.cycle -= 3.2; s.fired = false; s.parts = []; }
      if (!s.fired && s.cycle > .1){ s.fired = true;
        for (const [x, dir] of [[20, 1], [340, -1]]) for (let i = 0; i < 60; i++){ const a = -PI / 2 + dir * R(.25, .75), sp = R(420, 900);
          s.parts.push({ x, y: 330, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a: R(0, 6.28), va: R(-6, 6), flip: R(0, 6.28), vf: R(6, 14), ph: R(0, 6.28), col: COLS[Math.floor(Math.random() * 5)], w: R(4.5, 7), age: 0 }); } }
      for (const p of s.parts){ p.age += dt; const d = 1 - 2.6 * dt;
        p.vx *= d; p.vy = Math.min(p.vy * d + 420 * dt, 110);   // предельная скорость падения: бумажка порхает
        p.x += (p.vx + Math.sin(p.age * 5 + p.ph) * 40) * dt; p.y += p.vy * dt; p.a += p.va * dt; p.flip += p.vf * dt; }
      if (s.cycle > .3 && s.cycle < 2.6 && s.parts.length && Math.random() < dt * 10){ const p = s.parts[Math.floor(Math.random() * s.parts.length)];
        spawn(s.tw, { x: p.x, y: p.y, size: R(22, 36), life: .5, vr: 2, cells: seq(at, 'twinkle', 'W0', 'G0'), add: 1, fadeIn: .35, fadeOut: .5 }); }
      step(s.tw, dt);
    },
    render(s, c){
      const at = c.at, t = s.cycle - .1, solid = at.map['solid:W0'], cell = at.cell;
      if (t >= 0 && t < .45){ const k = t / .45;
        for (const x of [26, 334]){ sprite(c, x, 322, 120 + 180 * easeOut(k), k * .4, 1 - k, 1, at.map['burst:W0']); sprite(c, x, 322, 200, 0, (1 - k) * .8, 1, at.map['sglow:G0']); } }
      // бумажка: сплошная ячейка, тонированная цветом; высота = cos переворота (кувыркается)
      for (const p of s.parts){ const life = Math.min(1, Math.max(0, 1 - (p.age - 2.4) / .5)); if (life <= 0) continue;
        const w = p.w * life / cell, h = (p.w * 1.6 * Math.abs(Math.cos(p.flip)) * life + .5) / cell, cs = Math.cos(p.a), sn = Math.sin(p.a);
        quad(c, solid, cs * w, sn * w, -sn * h, cs * h, p.x, p.y, 1, 0, p.col, .3); }
      draw(c, s.tw);
    } };

  DEF.charge = { atlas: 'charge', period: 2.4,
    init: s => Object.assign(s, { fired: false, inP: [], rings: [], out: [] }),
    update(s, dt, at){
      const CX = 180, CY = 180, CH = 1.5;
      if (s.cycle >= 2.4){ s.cycle -= 2.4; s.fired = false; }
      const cy = s.cycle;
      if (cy < CH){
        // темп нарастает к разряду
        emit(s.acc, 1, 20 + 50 * (cy / CH), dt, () => { const a = R(0, 6.28), d = R(130, 170);
          spawn(s.inP, { x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 60, size: R(18, 28), life: .5, cells: seq(at, 'spark', 'P1', 'P0'), add: 1, orient: true, speedStretch: .002, fadeIn: .3, fadeOut: .2 }); });
        emit(s.acc, 2, 2.2, dt, () => spawn(s.rings, { x: CX, y: CY, size: 300, grow: -.8, life: .6, cells: seq(at, 'sring', 'P1', 'P0'), add: 1, alpha: .5, fadeIn: .4, fadeOut: .2 }));
      }
      if (!s.fired && cy >= CH){ s.fired = true;
        for (let i = 0; i < 26; i++){ const a = R(0, 6.28), sp = R(260, 520);
          spawn(s.out, { x: CX, y: CY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(24, 40), life: R(.5, .8), rot: R(0, 6.28), vr: R(-4, 4), cells: seq(at, 'twinkle', 'W0', 'P0'), add: 1, drag: 3, fadeIn: .02, fadeOut: .6 }); } }
      // искры ускоряются к центру
      for (const p of s.inP){ const dx = CX - p.x, dy = CY - p.y, d = Math.max(Math.hypot(dx, dy), 6); p.vx += dx / d * 900 * dt; p.vy += dy / d * 900 * dt; if (d < 22) p.age = p.life; }
      for (const L of [s.inP, s.rings, s.out]) step(L, dt);
    },
    render(s, c){
      const at = c.at, CX = 180, CY = 180, CH = 1.5, cy = s.cycle, k = Math.min(1, cy / CH);
      const orb = cy < CH ? 30 + 70 * k * k : 100 * Math.max(0, 1 - (cy - CH) / .5), jit = 1 + .06 * Math.sin(cy * 40) * k, f = Math.floor(cy * 20);
      sprite(c, CX, CY, 360, 0, .25 + .3 * k, 1, at.map['sglow:P1']);
      draw(c, s.rings); draw(c, s.inP);
      if (orb > 1){ sprite(c, CX, CY, orb * 2.6 * jit, 0, .7, 1, at.map['sglow:P1']); sprite(c, CX, CY, orb * 1.6 * jit, 0, 1, .6, 0, 1, null, 0, PL('pink', .04, .6 + .2 * k, .7, .5)); sprite(c, CX, CY, orb * .5, 0, .45, 1, at.map['sglow:P0']);
        if (cy < CH && f % 3) sprite(c, CX, CY, orb * 2.2, f * 1.7, .4 + .6 * k, 1, at.map[f % 2 ? 'crackle:P1' : 'crackle:P0']); }
      const t = cy - CH;
      if (t >= 0 && t < .5){ const e = t / .5; sprite(c, CX, CY, 200 + 260 * easeOut(e), e, (1 - e) * .8, 1, at.map['burst:P0']); sprite(c, CX, CY, 80 + 420 * easeOut(e), 0, (1 - e) * .9, 1, at.map['sring:P0']); }
      draw(c, s.out);
    } };

  DEF.sparkle = { atlas: 'sparkle',
    init(s, at){ Object.assign(s, { bokeh: [], tw: [], bursts: [] }); for (let i = 0; i < 8; i++) this.bk(s, at, R(20, 360), R(0, 2)); },
    bk: (s, at, y, age) => spawn(s.bokeh, { x: R(20, 340), y, vx: R(-8, 8), vy: R(-18, -6), size: R(40, 90), life: R(3, 5), age, cells: seq(at, 'bokeh', Math.random() < .5 ? 'M2' : 'M1'), add: 1, alpha: R(.2, .4), sway: 6, fadeIn: .3, fadeOut: .4 }),
    update(s, dt, at){
      emit(s.acc, 1, 2, dt, () => this.bk(s, at, R(60, 360), 0));
      emit(s.acc, 2, 16, dt, () => { const a = R(0, 6.28), d = Math.random() ** .7 * 150;
        spawn(s.tw, { x: 180 + Math.cos(a) * d, y: 180 + Math.sin(a) * d, vy: R(-24, -8), size: R(18, 44), grow: .3, life: R(.6, 1), rot: R(0, .8), vr: R(-2, 2),
          cells: seq(at, 'twinkle', Math.random() < .6 ? 'W0' : 'G0'), add: 1, fadeIn: .4, fadeOut: .45 }); });
      emit(s.acc, 3, .9, dt, () => spawn(s.bursts, { x: R(70, 290), y: R(70, 290), size: R(90, 130), grow: .4, life: .55, vr: 1, cells: seq(at, 'burst', 'G0'), add: 1, alpha: .8, fadeIn: .15, fadeOut: .7 }));
      for (const L of [s.bokeh, s.tw, s.bursts]) step(L, dt);
    },
    render(s, c){ sprite(c, 180, 180, 380 * (1 + .04 * Math.sin(s.t * 1.7)), 0, .3, 1, c.at.map['sglow:G1']); for (const L of [s.bokeh, s.bursts, s.tw]) draw(c, L); } };

  DEF.smoke = { atlas: 'smoke',
    init: s => Object.assign(s, { puffs: [], small: [], tw: [] }),
    update(s, dt, at){
      const BX = 180, BY = 320, w = Math.sin(s.t * .8) * 20;
      emit(s.acc, 1, 4.5, dt, () => spawn(s.puffs, { x: BX + R(-20, 20), y: BY, vx: R(-10, 10), vy: R(-90, -70), rot: R(0, 6.28), vr: R(-.4, .4), size: R(70, 90), grow: 1.6, life: R(3, 3.6),
        cells: [at.map['puff:S3']], mode: 18, ramp: 'smoke', heat: [[0, 1.25], [1, .8]], ero: [[0, .05], [.7, .1], [1, .5]], add: 0, alpha: .9, drag: .25, sway: 10, fadeIn: .12, fadeOut: .45 }));
      emit(s.acc, 2, 5, dt, () => spawn(s.small, { x: BX + R(-40, 40), y: BY - R(0, 20), vx: R(-30, 30), vy: R(-60, -40), rot: R(0, 6.28), vr: R(-.8, .8), size: R(36, 50), grow: .8, life: R(1.4, 2),
        cells: seq(at, 'puffS', 'S3', 'S2'), add: 0, alpha: .7, sway: 14, fadeIn: .15, fadeOut: .5 }));
      emit(s.acc, 3, 3, dt, () => spawn(s.tw, { x: BX + R(-30, 30), y: BY - 20, vx: R(-30, 30), vy: R(-150, -90), size: R(14, 22), life: R(.8, 1.2), vr: 3, cells: seq(at, 'twinkle', 'W0'), add: 1, alpha: .8, sway: 30, fadeIn: .2, fadeOut: .5 }));
      for (const L of [s.puffs, s.small]) for (const p of L) p.vx += w * dt;
      for (const L of [s.puffs, s.small, s.tw]) step(L, dt);
    },
    render(s, c){ sprite(c, 180, 330, 220 * (1 + .06 * Math.sin(s.t * 4)), 0, .55, 1, c.at.map['sglow:F1'], .45); for (const L of [s.small, s.puffs, s.tw]) draw(c, L); } };

  DEF.shock = { atlas: 'shock', period: 2,
    init: s => Object.assign(s, { fired: false, dust: [], sparks: [] }),
    update(s, dt, at){
      const GX = 180, GY = 280;
      if (s.cycle >= 2){ s.cycle -= 2; s.fired = false; }
      if (!s.fired && s.cycle > .1){ s.fired = true;
        for (let i = 1; i <= 18; i++){ const a = i / 18 * 6.28 + R(-.1, .1), sp = R(240, 340), sm = i % 2 === 0;
          spawn(s.dust, { x: GX + Math.cos(a) * 20, y: GY + Math.sin(a) * 7, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .32 - 20, rot: R(0, 6.28), vr: R(-1, 1), size: sm ? R(50, 64) : R(66, 90), grow: .9,
            life: R(.9, 1.3), cells: seq(at, sm ? 'puffS' : 'dust', 'D0', 'D1'), add: 0, alpha: .85, drag: 2.8, grav: -12, fadeIn: .04, fadeOut: .55 }); }
        for (let i = 0; i < 20; i++){ const a = -PI / 2 + R(-.9, .9), sp = R(280, 560);
          spawn(s.sparks, { x: GX, y: GY - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(18, 28), life: R(.5, .8), cells: seq(at, 'spark', 'G0', 'G1'), add: 1, drag: 1, grav: 1000, orient: true, speedStretch: .002, fadeIn: .02, fadeOut: .4 }); }
      }
      step(s.dust, dt); step(s.sparks, dt);
    },
    render(s, c){
      const at = c.at, GX = 180, GY = 280, t = s.cycle - .1;
      if (t >= 0 && t < .7){ const k = t / .7, e = easeOut(k);
        sprite(c, GX, GY, 120 + 420 * e, 0, (1 - k) * .9, 1, at.map['ground:D0'], .55);
        sprite(c, GX, GY, 60 + 260 * e, 0, (1 - k) ** 2, 1, at.map['ground:G0'], .5);
        sprite(c, GX, GY, 260, 0, (1 - k) * .6, 1, at.map['sglow:G0'], .5); }
      draw(c, s.dust); draw(c, s.sparks);
      if (t >= 0 && t < .3){ const k = t / .3; sprite(c, GX, GY - 20, 150 + 160 * k, k * .3, 1 - k, 1, at.map['burst:G0']); }
    } };

  DEF.comets = { atlas: 'comets',
    launch: () => ({ x: R(-60, 120), y: R(-60, 20), vx: R(170, 260), vy: R(120, 200), hue: Math.random() < .6 ? 0 : 1 }),
    init(s){ Object.assign(s, { kom: [], trail: [], bits: [], hits: [] }); for (let i = 1; i <= 3; i++){ const k = this.launch(); k.x += i * 70; k.y += i * 40; s.kom.push(k); } },
    update(s, dt, at){
      const GROUND = 330;
      s.kom.forEach((k, i) => {
        k.vy += 160 * dt; const px = k.x, py = k.y; k.x += k.vx * dt; k.y += k.vy * dt;
        const glow = at.map[k.hue ? 'sglow:M2' : 'sglow:E1'];
        // штампы хвоста: по 3 на кадр вдоль пройденного отрезка — хвост не рвётся на любой скорости
        for (let j = 1; j <= 3; j++) spawn(s.trail, { x: px + (k.x - px) * j / 3, y: py + (k.y - py) * j / 3, size: 34, grow: -.8, life: .5, cells: [glow], add: 1, alpha: .45, fadeIn: .01, fadeOut: .9 });
        if (Math.random() < dt * 22) spawn(s.bits, { x: k.x + R(-6, 6), y: k.y + R(-6, 6), vx: -k.vx * .15 + R(-30, 30), vy: -k.vy * .15 + R(-30, 30), size: R(10, 18), life: R(.5, .8), vr: 3,
          cells: [at.map[Math.random() < .5 ? 'twinkle:W0' : 'dust:E2']], add: 1, alpha: .8, fadeIn: .1, fadeOut: .6 });
        if (k.y > GROUND - 6){ spawn(s.hits, { x: k.x, y: GROUND - 6, size: 70, grow: 1.6, life: .4, cells: [glow], add: 1, stretch: .45, fadeIn: .02, fadeOut: .8 }); s.kom[i] = this.launch(); }
      });
      for (const L of [s.trail, s.bits, s.hits]) step(L, dt);
    },
    render(s, c){
      const at = c.at;
      for (const L of [s.trail, s.bits, s.hits]) draw(c, L);
      for (const k of s.kom){
        sprite(c, k.x, k.y, 70, 0, .7, 1, at.map[k.hue ? 'sglow:M2' : 'sglow:E1']);
        sprite(c, k.x, k.y, 26, 0, 1, 1, at.map['sglow:E1']);
        draw(c, [Object.assign({}, P0, { x: k.x, y: k.y, vx: k.vx, vy: k.vy, size: 46, stretch: 1.3, age: .5, life: 1, cells: [at.map[k.hue ? 'spark:M2' : 'spark:E0']], fadeIn: 1e-4, fadeOut: 1e-4, orient: true })]);
      }
    } };

  /* ── ауры по видео-референсам (циклы для фона редкого предмета) ──
     белые маски атласа aura красим цветом частицы (tint), серые — шейдером по градиенту; туманность и нити — целиком из шума */
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // 1. мерцание: ~60 четырёхлучевых звёзд в овале, каждая вспыхивает и гаснет (размер 0 → 1 → 0)
  DEF.twinkle = { atlas: 'aura',
    init: s => Object.assign(s, { st: [] }),
    update(s, dt, at){
      emit(s.acc, 1, s.t < .1 ? 600 : 70, dt, () => {
        const a = R(0, 6.28), d = Math.sqrt(Math.random()), dot = Math.random() < .3, life = R(.5, 1.1);
        spawn(s.st, { x: 180 + Math.cos(a) * d * 150, y: 180 + Math.sin(a) * d * 95, size: dot ? R(14, 22) : R(34, 80) * (Math.random() < .15 ? 1.5 : 1), sc: [[0, 0], [.45, 1], [1, 0]],
          life, age: s.t < .1 ? R(0, life) : 0, cells: [at.map[dot ? 'glow:W0' : 'star:W0']], add: 1, alpha: R(.7, 1), tint: Math.random() < .5 ? [1, 1, 1] : [.5, .85, 1], fadeIn: .01, fadeOut: .01 });
      });
      step(s.st, dt);
    },
    render(s, c){
      // ореол: то же мерцание мягким голубым пятном под каждой звездой
      for (const p of s.st){ const k = p.age / p.life, a = Math.sin(Math.min(1, k) * PI); sprite(c, p.x, p.y, p.size * .9 * a, 0, .55 * a * p.alpha, 1, c.at.map['sglow:W0'], 1, [.2, .6, 1]); }
      draw(c, s.st);
    } };

  // 2. дух: большие клубы дыма бирюзой (шейдер: градиент, искажение, растворение), яркое ядро ниже центра, белые осколки
  DEF.spirit = { atlas: 'aura', gfx: { dist: .35, speed: .6, ramp: 'teal' },
    wisp: (s, at, age) => spawn(s.sm, { x: 180 + R(-40, 40), y: 175 + R(-40, 40), rot: R(0, 6.28), vr: R(-.5, .5), size: R(200, 260), life: R(2.6, 3.6), age,
      cells: [at.map[pick(['smoke1:L', 'smoke2:L', 'puff:L'])]], mode: 18, ramp: 'teal', add: .45, alpha: .65,
      heat: [[0, .55], [.5, .72], [1, .5]], ero: [[0, .6], [.3, .2], [.7, .25], [1, .8]], fadeIn: .2, fadeOut: .3 }),
    init(s, at){ Object.assign(s, { sm: [], sh: [] }); for (let i = 0; i < 9; i++) this.wisp(s, at, R(0, 2.5)); },
    update(s, dt, at){
      emit(s.acc, 1, 3, dt, () => this.wisp(s, at, 0));
      emit(s.acc, 2, 35, dt, () => { const a = R(0, 6.28), d = R(0, 75);
        spawn(s.sh, { x: 180 + Math.cos(a) * d, y: 185 + Math.sin(a) * d * .9, vx: -Math.sin(a) * 20, vy: Math.cos(a) * 20 - 8, rot: R(0, 6.28), vr: R(-6, 6), size: R(7, 15), life: R(.3, .7),
          cells: [at.map['shard:W0']], add: 1, tint: [.85, 1, 1], fadeIn: .2, fadeOut: .5 }); });
      step(s.sm, dt); step(s.sh, dt);
    },
    render(s, c){
      const at = c.at, pl = 1 + .06 * Math.sin(s.t * 3);
      sprite(c, 180, 180, 330, 0, .35, 1, at.map['sglow:W0'], 1, [.1, .55, .5]);
      draw(c, s.sm);
      sprite(c, 182, 205, 150 * pl, 0, .55, 1, at.map['sglow:W0'], .9, [.2, .8, .9]);
      sprite(c, 182, 208, 70 * pl, 0, .45, 1, at.map['sglow:W0'], .9, [.6, 1, 1]);
      draw(c, s.sh);
    } };

  // 3. звёздный взрыв: горячее белое ядро с роем искорок, большое пурпурное свечение, редкие вспышки-лучи,
  //    розовые пятиконечные звёздочки медленно уплывают (больше — вправо-вниз, как в референсе)
  DEF.starburst = { atlas: 'aura',
    init: s => Object.assign(s, { core: [], st: [], fl: [] }),
    update(s, dt, at){
      emit(s.acc, 1, 30, dt, () => spawn(s.core, { x: 180 + R(-22, 22), y: 180 + R(-14, 14), vx: R(-15, 15), vy: R(-15, 15), size: R(10, 26), sc: [[0, 0], [.4, 1], [1, 0]], life: R(.3, .6),
        cells: [at.map[Math.random() < .6 ? 'twinkle:W0' : 'glow:W0']], add: 1, tint: Math.random() < .5 ? [1, 1, 1] : [1, .6, 1], rot: R(0, 1), fadeIn: .01, fadeOut: .01 }));
      emit(s.acc, 2, 9, dt, () => { const a = R(-.6, 1.6), sp = R(15, 45);
        spawn(s.st, { x: 180 + Math.cos(a) * 20, y: 180 + Math.sin(a) * 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: R(0, 6.28), vr: R(-1.5, 1.5), size: R(12, 22), life: R(1.4, 2.4),
          cells: [at.map['star5:W0']], add: .7, tint: [1, .5, .82], fadeIn: .1, fadeOut: .4 }); });
      emit(s.acc, 3, .8, dt, () => spawn(s.fl, { x: 180 + R(-10, 10), y: 180 + R(-8, 8), size: R(110, 170), sc: [[0, .3], [.3, 1], [1, .6]], life: .35, rot: R(-.3, .3),
        cells: [at.map['star:W0']], add: 1, alpha: .9, fadeIn: .2, fadeOut: .6 }));
      for (const L of [s.core, s.st, s.fl]) step(L, dt);
    },
    render(s, c){
      const at = c.at, pl = 1 + .04 * Math.sin(s.t * 4);
      sprite(c, 180, 182, 300 * pl, 0, .9, 1, at.map['sglow:W0'], 1, [.55, .12, .85]);
      sprite(c, 180, 180, 120 * pl, 0, .8, 1, at.map['sglow:W0'], 1, [1, .55, 1]);
      sprite(c, 178, 178, 50, 0, 1, 1, at.map['glow:W0'], 1, [1, .95, 1]);
      draw(c, s.st); draw(c, s.core); draw(c, s.fl);
    } };

  // 4. облако: 4 мягких синих пятна медленно плавают друг через друга, разноцветные точки мерцают
  DEF.cloud = { atlas: 'aura',
    init(s){ Object.assign(s, { dots: [], blobs: [[.2, .4, 1], [.25, .55, 1], [.15, .35, .95], [.3, .75, 1]].map((tint, i) => ({ ph: i * 1.7, r: R(8, 22), sp: R(.25, .5), size: R(230, 290), tint })) }); },
    update(s, dt, at){
      emit(s.acc, 1, s.t < .1 ? 300 : 22, dt, () => { const a = R(0, 6.28), d = Math.sqrt(Math.random());
        spawn(s.dots, { x: 180 + Math.cos(a) * d * 110, y: 180 + Math.sin(a) * d * 70, vx: R(-6, 6), vy: R(-6, 6), size: R(6, 16), life: R(1.5, 3), age: s.t < .1 ? R(0, 1.5) : 0,
          cells: [at.map['glow:W0']], add: 1, alpha: R(.6, 1), tint: pick([[.6, 1, 1], [1, 1, 1], [1, .6, .35], [1, .5, .8], [.4, .8, 1]]), fadeIn: .3, fadeOut: .4 }); });
      step(s.dots, dt);
    },
    render(s, c){
      const at = c.at, t = s.t;
      sprite(c, 180, 180, 330, 0, .45, 1, at.map['sglow:W0'], .75, [.1, .2, .7]);
      for (const b of s.blobs) sprite(c, 180 + Math.cos(t * b.sp + b.ph) * b.r * 1.5, 180 + Math.sin(t * b.sp * 1.3 + b.ph) * b.r * .6, b.size, 0, .4, .8, at.map['sglow:W0'], .78, b.tint);
      draw(c, s.dots);
    } };

  // 5. нити: светящиеся прожилки (гребни шума) двумя слоями навстречу — переплетаются, как плазма
  DEF.threads = { atlas: 'aura', gfx: { speed: .5, ramp: 'violet' },
    init(){}, update(){},
    render(s, c){
      const at = c.at, t = s.t;
      sprite(c, 180, 180, 320, 0, .35, 1, at.map['sglow:W0'], 1, [.2, .06, .5]);
      sprite(c, 180, 180, 310, t * .05, .8, 1, 0, 1, null, 0, [3, 0, .62, .3]);
      sprite(c, 180, 180, 270, -t * .07, .6, 1, 0, 1, null, 0, [3, 0, .55, 2.1]);
    } };

  // 6. туманность: облака шума с тёмными провалами и прожилками, поверх — звёздная пыль, всё медленно вращается
  DEF.nebula = { atlas: 'aura', gfx: { speed: .4, ramp: 'violet' },
    init(s){ s.dust = Array.from({ length: 140 }, () => ({ a: R(0, 6.28), d: Math.sqrt(Math.random()) * 130, s: R(2.5, 7), ph: R(0, 6.28), sp: R(1, 3) })); },
    update(){},
    render(s, c){
      const at = c.at, t = s.t;
      sprite(c, 180, 180, 360, t * .03, .85, .8, 0, 1, null, 0, [2, 0, .62, .7]);
      sprite(c, 180, 180, 300, -t * .05, .5, 1, 0, 1, null, 0, [2, 0, .5, 3.3]);
      for (const p of s.dust){ const a = p.a + t * .04;
        sprite(c, 180 + Math.cos(a) * p.d, 180 + Math.sin(a) * p.d, p.s * 2.4, 0, .35 + .35 * Math.sin(t * p.sp + p.ph), 1, at.map['glow:W0'], 1, [.6, .5, 1]); }
    } };

  // 7. кольцо: толстые мягкие кольца-эллипсы поворачиваются в разных фазах — кольцо будто крутится в объёме; тонкий яркий обод сверху
  DEF.ring = { atlas: 'aura',
    init(){}, update(){},
    render(s, c){
      const at = c.at, t = s.t;
      for (let i = 0; i < 3; i++){ const ph = t * (1.1 + i * .35) + i * 2.1;
        sprite(c, 180 + Math.cos(ph) * 3, 180 + Math.sin(ph * 1.3) * 3, 340, ph * .5, i ? .4 : .7, .5, at.map['sring:W0'], .9 + .08 * Math.sin(ph), [.05, .14, .95]); }
      for (let i = 0; i < 2; i++){ const ph = t * (1.6 + i * .5) + i * 3;
        sprite(c, 180, 180, 318, -ph * .6, .5, 1, at.map['ring:W0'], .92 + .07 * Math.sin(ph * 1.2), [.3, .5, 1]); }
    } };

  /* ── по GIF-примерам (Clash Royale / Kitchen Masters / Misfitz): фазы и тайминг важнее числа частиц ── */
  // раскрытие (как альбом в Clash Royale): ожидание ~2/3 времени — предмет дышит, радужный обод, расходятся круги,
  // искры стягиваются, лучи разгоняются, предмет трясёт → белая вспышка на весь экран → предмет уже новый, выпрыгивает
  DEF.reveal = { atlas: 'aura', period: 3.4, gfx: { speed: 1 },
    init: s => Object.assign(s, { inS: [], outS: [], rip: [], fired: false, rr: 0 }),
    update(s, dt, at){
      if (s.cycle >= 3.4){ s.cycle -= 3.4; s.fired = false; }
      const c = s.cycle, pre = Math.min(1, c / 1.9);
      s.rr += (c < 2.05 ? .3 + pre * 2.2 : .25) * dt;
      if (c < 1.9){
        emit(s.acc, 1, 10 + 30 * c, dt, () => { const a = R(0, 6.28), d = R(120, 170);
          spawn(s.inS, { x: 180 + Math.cos(a) * d, y: 180 + Math.sin(a) * d, vx: -Math.cos(a) * d * 1.4, vy: -Math.sin(a) * d * 1.4, size: R(14, 26), life: .6, rot: R(0, 1),
            cells: [at.map['twinkle:W0']], add: 1, tint: [.7, .85, 1], fadeIn: .3, fadeOut: .3 }); });
        emit(s.acc, 2, 2.8, dt, () => spawn(s.rip, { x: 180, y: 180, size: 150, grow: 1.6, life: .7, cells: [at.map['ring:W0']], add: 1, alpha: .5, tint: [.6, .8, 1], fadeIn: .05, fadeOut: .7 }));
      }
      if (!s.fired && c >= 2.05){ s.fired = true;
        for (let i = 0; i < 30; i++){ const a = R(0, 6.28), sp = R(200, 480);
          spawn(s.outS, { x: 180, y: 180, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(16, 34), life: R(.6, 1.1), rot: R(0, 6), vr: R(-5, 5),
            cells: [at.map[Math.random() < .5 ? 'twinkle:W0' : 'star5:W0']], add: 1, drag: 2.5, tint: Math.random() < .5 ? [1, 1, 1] : [.85, .6, 1], fadeIn: .02, fadeOut: .6 }); } }
      for (const L of [s.inS, s.outS, s.rip]) step(L, dt);
    },
    render(s, c){
      const at = c.at, t = s.cycle, pre = Math.min(1, t / 1.9), post = t - 2.05, before = post < 0;
      const shake = before ? pre * pre * 4 : 0, jx = Math.sin(t * 61) * shake, jy = Math.cos(t * 47) * shake;
      sprite(c, 180, 180, 420 * (before ? .6 + pre * .5 : 1.1), s.rr, before ? pre * pre * .9 : Math.max(.35, 1 - post * 1.5), 1, 0, 1, before ? [.6, .8, 1] : [1, .85, 1], 0, [4, 9, 1, .3]);
      sprite(c, 180, 180, 300 * (1 + .15 * Math.sin(t * (4 + pre * 10))), 0, .35 + .4 * pre, 1, at.map['sglow:W0'], 1, before ? [.25, .5, 1] : [.6, .3, 1]);
      draw(c, s.rip);
      sprite(c, 180 + jx, 180 + jy, 200 * (1 + .06 * Math.sin(t * 8)), 0, before ? .6 + .4 * pre : Math.max(0, .8 - post), 1, at.map['sring:W0'], 1, null, 0, [5, 0, 1, 0]);
      // предмет: до вспышки синий гем, после — фиолетовый, выпрыгивает с перелётом
      const pop = before ? 1 + .05 * Math.sin(t * 6) : 1 + .35 * Math.exp(-post * 6) * Math.cos(post * 14);
      sprite(c, 180 + jx, 180 + jy, (before ? 120 : 140) * pop, Math.sin(t * 2) * .08, 1, 0, at.map[before ? 'gem' : 'gemP']);
      draw(c, s.inS);
      if (post >= 0 && post < .5){ const k = post / .5;
        sprite(c, 180, 180, 120 + 500 * easeOut(k), 0, (1 - k) * .9, 1, at.map['sring:W0'], 1, [.8, .6, 1]);
        sprite(c, 180, 180, 200 + 200 * k, k, 1 - k, 1, at.map['star:W0']); }
      draw(c, s.outS);
      // белая вспышка на весь экран: быстро набирается, полсекунды гаснет
      const wf = t < 1.9 ? 0 : before ? (t - 1.9) / .15 : Math.max(0, 1 - post / .45);
      if (wf > 0) sprite(c, 180, 180, 4000, 0, wf, 0, at.map['solid:W0'], 1, [1, 1, 1], .3);
    } };

  // комбо (как диско-шары в Kitchen Masters): два шара сближаются, между ними трещат молнии (новые каждые 0.05 с),
  // вокруг — радужное поле → радужная волна наружу, белая вспышка, осколки по всему экрану
  DEF.combo = { atlas: 'aura', period: 2.8, gfx: { speed: 1 },
    init: s => Object.assign(s, { arcs: [], sp: [], fired: false, jt: 0, ax: 110, bx: 250 }),
    update(s, dt, at){
      if (s.cycle >= 2.8){ s.cycle -= 2.8; s.fired = false; }
      const c = s.cycle, d = c < 1.5 ? 70 - 25 * c / 1.5 : 45 * Math.max(0, 1 - (c - 1.5) / .12);
      s.ax = 180 - d; s.bx = 180 + d; s.jt -= dt;
      if (c < 1.55){ if (s.jt <= 0){ s.jt = .05; s.arcs = [0, 1, 2].map(() => zig(s.ax + 14, 180 + R(-6, 6), s.bx - 14, 180 + R(-6, 6), .45, 4)); } }
      else s.arcs = [];
      if (!s.fired && c >= 1.62){ s.fired = true;
        for (let i = 0; i < 40; i++){ const a = R(0, 6.28), sp = R(250, 600);
          spawn(s.sp, { x: 180, y: 180, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(14, 30), life: R(.5, 1), rot: R(0, 6), vr: R(-6, 6),
            cells: [at.map[pick(['twinkle:W0', 'shard:W0', 'star5:W0'])]], add: 1, drag: 2, grav: 200, tint: [.5 + .5 * Math.random(), .5 + .5 * Math.random(), 1], fadeIn: .02, fadeOut: .5 }); } }
      step(s.sp, dt);
    },
    render(s, c){
      const at = c.at, t = s.cycle, ch = Math.min(1, t / 1.5);
      if (t < 1.62){
        sprite(c, 180, 180, 260 + 80 * ch, 0, .3 + .4 * ch, 1, at.map['sglow:W0'], .7, [.6, .4, 1]);
        sprite(c, 180, 180, 230 + 40 * Math.sin(t * 12), t * 2, .5 + .3 * ch, 1, at.map['sring:W0'], .62, null, 0, [5, 0, 1, 0]);
        for (const x of [s.ax, s.bx]){
          sprite(c, x, 180, 90, 0, .9, 1, at.map['sglow:W0'], 1, [.7, .8, 1]);
          sprite(c, x, 180, 74, t * 3, 1, 1, at.map['sring:W0'], 1, null, 0, [5, 0, 1, x / 100]);
          sprite(c, x, 180, 40, 0, 1, 1, at.map['glow:W0'], 1, [1, 1, 1]); }
        for (const p of s.arcs) for (let i = 1; i < p.length; i++){
          seg(c, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 14, .6, 1, at.map['sglow:W0'], [.4, .7, 1]);
          seg(c, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 3, 1, 1, at.map['solid:W0'], [1, 1, 1]); }
      }
      const post = t - 1.62;
      if (post >= 0){ const k = Math.min(1, post / .6);
        sprite(c, 180, 180, 120 + 520 * easeOut(k), post * 2, 1 - k, .8, at.map['sring:W0'], 1, null, 0, [5, 0, 1.2, 0]);
        if (post < .35) sprite(c, 180, 180, 300 + 400 * post, 0, 1 - post / .35, 1, at.map['glow:W0'], 1, [1, 1, 1]);
        const wf = post < .06 ? post / .06 : Math.max(0, 1 - (post - .06) / .3);
        if (wf > 0) sprite(c, 180, 180, 4000, 0, wf * .85, 0, at.map['solid:W0'], 1, [1, 1, 1], .3); }
      draw(c, s.sp);
    } };

  // кнопка (как Kitchen Masters): внутри скруглённой кнопки бегут прожилки и проходит блик, мигают звёздочки;
  // квадрат 300×100 в центре — ставится поверх кнопки
  DEF.button = { atlas: 'aura', gfx: { speed: 1 },
    init: s => Object.assign(s, { tw: [] }),
    update(s, dt, at){
      emit(s.acc, 1, 6, dt, () => spawn(s.tw, { x: 180 + R(-120, 120), y: 180 + R(-30, 30), size: R(10, 22), sc: [[0, 0], [.5, 1], [1, 0]], life: R(.5, .9), rot: R(0, 1),
        cells: [at.map['twinkle:W0']], add: 1, tint: [1, 1, .85], fadeIn: .01, fadeOut: .01 }));
      step(s.tw, dt);
    },
    render(s, c){ sprite(c, 180, 180, 300, 0, 1, 1, 0, 1 / 3, [.75, 1, .75], 0, [7, 3, 1, 0]); draw(c, s.tw); } };

  // взмах (как «Speed Up» в Misfitz): три серпа с белым ядром растут и втягиваются, проворачиваясь вокруг центра
  DEF.slash = { atlas: 'aura', period: 1.1, gfx: { speed: 1 },
    init: s => Object.assign(s, { gl: [] }),
    update(s, dt, at){
      if (s.cycle >= 1.1) s.cycle -= 1.1;
      emit(s.acc, 1, 14, dt, () => { const a = R(0, 6.28), d = R(60, 110);
        spawn(s.gl, { x: 180 + Math.cos(a) * d, y: 180 + Math.sin(a) * d, vx: -Math.sin(a) * 80, vy: Math.cos(a) * 80, size: R(10, 20), life: R(.3, .5),
          cells: [at.map['twinkle:W0']], add: 1, tint: [.6, 1, 1], fadeIn: .1, fadeOut: .6 }); });
      step(s.gl, dt);
    },
    render(s, c){
      const at = c.at, t = s.cycle;
      sprite(c, 180, 180, 280, 0, .35, 1, at.map['sglow:W0'], .8, [.1, .5, .7]);
      for (let i = 0; i < 3; i++){ const k = (t - i * .12) / .7; if (k <= 0 || k >= 1) continue;
        sprite(c, 180, 180, 230 - i * 30, -1.2 + k * 4.2 + i * 2.09, 1, .6, 0, 1, [.35, .95, 1], 0, [6, Math.sin(k * PI) * .42, .07 * Math.sin(k * PI) + .01, 0]); }
      draw(c, s.gl);
    } };

  /* ── по второй пачке GIF (Misfitz, Bubble Busters, Clash, Squad Busters) ── */
  // спираль-фон (подбор соперника, Squad Busters): двухрукавная спираль из градиента крутится, палитра меняется раз в 3 с,
  // из центра летят на камеру предметы (растут и разгоняются — перспектива)
  const SW = ['sw_purple', 'sw_blue', 'sw_green', 'sw_yellow'];
  DEF.swirl = { atlas: 'aura', gfx: { speed: .8 },
    init: s => Object.assign(s, { fl: [] }),
    update(s, dt, at){ const i = Math.floor(s.t / 3) % 4;
      emit(s.acc, 1, 5, dt, () => { const a = R(0, 6.28), sp = R(40, 90);
        spawn(s.fl, { x: 180 + Math.cos(a) * 20, y: 180 + Math.sin(a) * 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: R(0, 6.28), vr: R(-2, 2), size: R(10, 16), grow: 3.5, life: R(2, 3), drag: -.6,
          cells: [at.map[['star5:W0', 'shard:W0', 'gem', 'glow:W0'][i]]], add: i === 2 ? 0 : .8, alpha: .9, tint: i === 2 ? null : [1, 1, 1], fadeIn: .3, fadeOut: .3 }); });
      step(s.fl, dt); },
    render(s, c){ const t = s.t, i = Math.floor(t / 3) % 4, x = Math.min(1, (t / 3 % 1) / .15);
      if (x < 1) sprite(c, 180, 180, 720, 0, 1, 0, 0, 1, null, 0, [9, 2, 1, RAMP_ROW[SW[(i + 3) % 4]]]);
      sprite(c, 180, 180, 720, 0, x, 0, 0, 1, null, 0, [9, 2, 1, RAMP_ROW[SW[i]]]);
      draw(c, s.fl); } };

  // раскрытие героя (Squad Busters): белый шестиугольник пульсирует всё чаще, расходятся контуры-шестиугольники, лучи,
  // вокруг плывут шестиугольнички → белая вспышка на экран → предмет выпрыгивает, широкая волна-шестиугольник
  DEF.hexreveal = { atlas: 'aura', period: 3, gfx: { speed: 1 },
    init: s => Object.assign(s, { hx: [] }),
    update(s, dt){ if (s.cycle >= 3) s.cycle -= 3;
      emit(s.acc, 1, 6, dt, () => { const a = R(0, 6.28), d = R(60, 160); s.hx.push({ x: 180 + Math.cos(a) * d, y: 180 + Math.sin(a) * d * .7, vy: R(-20, -5), s: R(14, 30), age: 0, life: R(1, 1.8) }); });
      s.hx = s.hx.filter(h => { h.age += dt; h.y += h.vy * dt; return h.age < h.life; }); },
    render(s, c){ const at = c.at, t = s.cycle, pre = Math.min(1, t / 2), pulse = 1 + .12 * Math.sin(t * (6 + pre * 14));
      sprite(c, 180, 180, 520, 0, .55, 0, at.map['sglow:W0'], 1, [.45, .1, .85]);
      sprite(c, 180, 180, 460, t * .3, .5 + .4 * pre, 1, 0, 1, [1, .75, 1], 0, [4, 10, 1, .2]);
      for (const h of s.hx){ const al = Math.sin(h.age / h.life * PI); sprite(c, h.x, h.y, h.s * 2, 0, al * .8, 1, 0, 1, [.95, .8, 1], 0, [11, 6, 0, 0]); }
      for (let i = 0; i < 3; i++){ const k = (t * 1.2 + i / 3) % 1; sprite(c, 180, 180, 120 + 300 * k, 0, (1 - k) * .7 * pre, 1, 0, 1, [1, .85, 1], 0, [11, 6, .03, 0]); }
      if (t < 2.05) sprite(c, 180, 180, 110 * pulse * (1 + pre * .3), 0, 1, 1, 0, 1, [1, 1, 1], 0, [11, 6, 0, 0]);
      const p = t - 2.05;
      if (p >= 0){ const wf = p < .08 ? p / .08 : Math.max(0, 1 - (p - .08) / .5); if (wf > 0) sprite(c, 180, 180, 4000, 0, wf, 0, at.map['solid:W0'], 1, [1, 1, 1], .3);
        const k = Math.min(1, p / .6); sprite(c, 180, 180, 150 + 500 * easeOut(k), 0, 1 - k, 1, 0, 1, [1, .8, 1], 0, [11, 6, .05, 0]);
        sprite(c, 180, 180, 140 * (1 + .3 * Math.exp(-p * 6) * Math.cos(p * 14)), Math.sin(t * 2) * .08, Math.min(1, p * 4), 0, at.map['gemP']); }
    } };

  // попадание (attack result): кадр 1 — белая точка, кадры 2–3 — четырёхлучевая звезда с тёмным кольцом,
  // потом — фиолетовые осколки и жёлтые «зёрна» по скорости разлетаются и тормозят, свечение тает (всё ~1 с)
  DEF.hit = { atlas: 'aura', period: 1.3, gfx: { speed: 1 },
    init: s => Object.assign(s, { pt: [], fired: false }),
    update(s, dt, at){ if (s.cycle >= 1.3){ s.cycle -= 1.3; s.fired = false; }
      if (!s.fired && s.cycle > .26){ s.fired = true;
        for (let i = 0; i < 14; i++){ const a = i / 14 * 6.28 + R(-.2, .2), sp = R(160, 320), y = i % 2;
          spawn(s.pt, { x: 180, y: 180, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: y ? R(16, 22) : R(22, 34), life: R(.5, .9), drag: 5, orient: true, stretch: y ? 1.8 : 1.4,
            cells: [at.map[y ? 'glow:W0' : 'shard:W0']], add: 1, tint: y ? [1, .8, .25] : [.8, .5, 1], fadeIn: .02, fadeOut: .5 }); } }
      step(s.pt, dt); },
    render(s, c){ const at = c.at, t = s.cycle - .1;
      if (t < 0) return;
      if (t < .08) sprite(c, 180, 180, 60 + 400 * t, 0, 1, 1, at.map['glow:W0'], 1, [1, .9, 1]);
      else if (t < .18){ const k = (t - .08) / .1;
        sprite(c, 180, 180, 200, 0, 1, 1, at.map['sglow:W0'], 1, [.8, .4, 1]);
        sprite(c, 180, 180, 260 + 60 * k, 0, 1, 1, at.map['star:W0'], 1, [1, .85, 1]);
        sprite(c, 180, 180, 90, 0, 1, 0, 0, 1, [.3, .15, .08], 0, [11, 40, .06, 0]);
        sprite(c, 180, 180, 60, 0, 1, 1, at.map['glow:W0'], 1, [1, 1, 1]); }
      else { const k = Math.min(1, (t - .18) / .9); sprite(c, 180, 180, 220 + 60 * k, 0, (1 - k) * .6, 1, at.map['sglow:W0'], 1, [.6, .35, .85]);
        if (k < .3) sprite(c, 180, 180, 140 * (1 - k / .3), k * 3, 1 - k / .3, 1, at.map['twinkle:W0'], 1, [1, .8, 1]); }
      draw(c, s.pt);
    } };

  // волна звёзд (Janet, Brawl Stars): вспышка-эллипс у ствола → пять звёзд строем летят вперёд и тормозят,
  // сыплют осколки-треугольники, в конце разламываются; каждый выстрел — другой цвет (синий / розовый)
  DEF.starwave = { atlas: 'aura', period: 2.2, gfx: { speed: 1 },
    init: s => Object.assign(s, { st: [], bits: [], fired: false, n: 0 }),
    update(s, dt, at){ if (s.cycle >= 2.2){ s.cycle -= 2.2; s.fired = false; s.n++; }
      const col = s.n % 2 ? [1, .35, .6] : [.35, .7, 1];
      if (!s.fired && s.cycle > .15){ s.fired = true;
        for (let i = 0; i < 5; i++){ const off = (i - 2) * 34;
          spawn(s.st, { x: 70, y: 180 + off * .4, vx: 560, vy: off * 1.1, rot: R(0, 6), vr: R(-3, 3), size: R(46, 60), life: 1.05, drag: 3.2, cells: [at.map['star5:W0']], add: .8, tint: col, fadeIn: .05, fadeOut: .25 }); } }
      for (const p of s.st){
        if (p.age > .05 && Math.random() < dt * 40) spawn(s.bits, { x: p.x - 10, y: p.y + R(-14, 14), vx: R(-60, -10), vy: R(-30, 30), rot: R(0, 6), vr: R(-6, 6), size: R(8, 14), life: R(.3, .6),
          cells: [at.map['shard:W0']], add: 1, tint: col, fadeIn: .05, fadeOut: .6 });
        if (p.age > .8 && !p.broke){ p.broke = true;
          for (let j = 0; j < 4; j++){ const a = R(0, 6.28); spawn(s.bits, { x: p.x, y: p.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 + 30, rot: R(0, 6), vr: R(-8, 8), size: R(12, 20), life: .5,
            cells: [at.map['shard:W0']], add: 1, tint: col, fadeIn: .02, fadeOut: .6 }); } } }
      step(s.st, dt); step(s.bits, dt); },
    render(s, c){ const at = c.at, t = s.cycle - .1, col = s.n % 2 ? [1, .35, .7] : [.5, .6, 1];
      if (t > 0 && t < .4){ const k = t / .4; sprite(c, 70 + 60 * k, 180, 90 + 60 * k, 0, 1 - k, 1, at.map['ring:W0'], 1.8, col); }
      draw(c, s.bits);
      for (const p of s.st){ const k = p.age / p.life; sprite(c, p.x, p.y, p.size * 1.8, 0, .5 * (1 - k), 1, at.map['sglow:W0'], 1, col); }
      draw(c, s.st); } };

  /* ── по Unity/Unreal-роликам: уровень «как в движке», но всё — несколько вызовов отрисовки ── */
  // гриб-взрыв (video-1-front): появляется за 2 кадра целиком — ножка и шапка из мультяшных клубов,
  // свет снизу (верхние края темнее), клубы медленно кипят; через ~1.6 с растворяется по шуму на клочья
  DEF.mushroom = { atlas: 'aura', period: 3.2, gfx: { speed: 1, ramp: 'boom' },
    init: s => Object.assign(s, { lobes: [], spk: [], emb: [], fired: false }),
    update(s, dt, at){
      if (s.cycle >= 3.2){ s.cycle -= 3.2; s.fired = false; }
      if (!s.fired && s.cycle > .1){ s.fired = true;
        const L = [];
        for (let i = 0; i < 6; i++) L.push([R(-55, 55), 300 - R(0, 20), R(70, 95), 1.15]);          // подушка у земли
        for (let i = 0; i < 5; i++) L.push([R(-25, 25), 270 - i * 22, R(70, 90), 1.25]);           // ножка
        for (let i = 0; i < 9; i++) L.push([R(-80, 80), R(95, 165), R(85, 120), 1.05]);            // шапка
        L.forEach(([dx, y, sz, heat], i) => spawn(s.lobes, { x: 180 + dx, y, vx: dx * .1, vy: -R(8, 22), rot: R(-.5, .5), vr: R(-.4, .4), size: sz * 1.3,
          sc: [[0, .3], [.06, 1.05], [.6, 1.1], [1, 1.15]], life: R(2.1, 2.5), cells: [at.map[pick(['smoke1:L', 'smoke2:L', 'puff:L'])]], mode: 8, add: 0, ph: i * .37,
          ero: [[0, .07], [.6, .1], [.8, .35], [1, .95]], heat: [[0, heat * 1.3], [.5, heat], [1, heat * .8]], fadeIn: .005, fadeOut: .02 }));
        for (let i = 0; i < 6; i++){ const a = -PI / 2 + (i < 3 ? -1 : 1) * R(.9, 1.4), sp = R(500, 800);
          spawn(s.spk, { x: 180, y: 290, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(40, 60), life: .3, drag: 6, orient: true, stretch: 2.5, cells: [at.map['shard:W0']], add: 1, tint: [1, .95, .6], fadeIn: .01, fadeOut: .5 }); }
      }
      if (s.cycle > .2 && s.cycle < 2) emit(s.acc, 1, 18, dt, () => spawn(s.emb, { x: 180 + R(-90, 90), y: R(150, 300), vx: R(-60, 60), vy: R(-140, -60), size: R(5, 9), life: R(.5, 1),
        cells: [at.map['glow:W0']], add: 1, tint: [1, .7, .3], fadeIn: .1, fadeOut: .5 }));
      for (const L of [s.lobes, s.spk, s.emb]) step(L, dt);
    },
    render(s, c){ const at = c.at, t = s.cycle - .1;
      if (t > 0 && t < 2.2){ const k = Math.min(1, t / 2.2); sprite(c, 180, 305, 300 + 60 * k, 0, (1 - k) * .9, 1, at.map['sglow:W0'], .28, [1, .45, .15]); }
      if (t > 0 && t < .4){ const k = t / .4; sprite(c, 180, 300, 120 + 300 * easeOut(k), 0, 1 - k, 1, at.map['sring:W0'], .3, [1, .7, .3]); }
      draw(c, s.lobes); draw(c, s.spk); draw(c, s.emb);
    } };

  // энергосфера (magic-sphere): красный шар с мультяшным ободом, внутри кружат тёмные дуги, по ободу и над ним
  // ползут молнии (новые 7 раз в секунду), внутри плавают тёмные осколки, у земли — красный отсвет
  DEF.sphere = { atlas: 'aura', gfx: { speed: 1 },
    init: s => Object.assign(s, { arcs: [], jt: 0, sh: [], emb: [] }),
    update(s, dt, at){
      s.jt -= dt;
      if (s.jt <= 0){ s.jt = R(.1, .18);
        s.arcs = [0, 1].map(() => { const a0 = R(0, 6.28), sp = R(.7, 1.4), pts = [];
          const bulge = R(8, 30); for (let i = 0; i <= 14; i++){ const a = a0 + sp * i / 14, rr = 93 + Math.sin(i / 14 * PI) * bulge + R(-3, 3); pts.push([180 + Math.cos(a) * rr, 175 + Math.sin(a) * rr]); }
          return pts; }); }
      emit(s.acc, 1, 4, dt, () => { const a = R(0, 6.28), d = R(10, 70);
        spawn(s.sh, { x: 180 + Math.cos(a) * d, y: 175 + Math.sin(a) * d, vx: -Math.sin(a) * 30, vy: Math.cos(a) * 30, rot: R(0, 6), vr: R(-3, 3), size: R(10, 22), life: R(1, 1.8),
          cells: [at.map['shard:W0']], add: 0, alpha: .8, tint: [.25, .02, .03], fadeIn: .3, fadeOut: .4 }); });
      emit(s.acc, 2, 6, dt, () => { const a = R(0, 6.28);
        spawn(s.emb, { x: 180 + Math.cos(a) * 100, y: 175 + Math.sin(a) * 100, vx: Math.cos(a) * 20, vy: -R(20, 60), size: R(4, 8), life: R(.8, 1.5), cells: [at.map['glow:W0']], add: 1, tint: [1, .5, .3], fadeIn: .2, fadeOut: .5 }); });
      step(s.sh, dt); step(s.emb, dt);
    },
    render(s, c){ const at = c.at, t = s.t;
      sprite(c, 180, 285, 260, 0, .6, 1, at.map['sglow:W0'], .22, [1, .2, .1]);
      sprite(c, 180, 175, 300, 0, 1, .3, 0, 1, [.95, .1, .08], 0, [12, 0, 0, 0]);
      sprite(c, 180, 175, 196, 0, .9, .3, 0, 1, null, 0, PL('redsph', .1, .72, .2, .5));
      draw(c, s.sh);
      for (const p of s.arcs) for (let i = 1; i < p.length; i++){
        seg(c, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 20, .55, 1, at.map['sglow:W0'], [1, .5, .3]);
        seg(c, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 3.5, 1, 1, at.map['solid:W0'], [1, .95, .85]); }
      draw(c, s.emb);
      sprite(c, 180, 175, 330 + 10 * Math.sin(t * 3), 0, .25, 1, at.map['sglow:W0'], 1, [1, .25, .15]);
    } };

  // извержение (kuny-az, Unreal): искры стягиваются по кругу на земле, загорается знак → по кольцу встают лучи света →
  // огненный выброс на весь кадр → смена цвета: бирюзовый столп, искры и обломки летят, по земле — светящиеся трещины,
  // бирюзовое кольцо-след и пыль медленно гаснут
  DEF.eruption = { atlas: 'aura', period: 3.8, gfx: { speed: 1.2, ramp: 'fire' },
    init: s => Object.assign(s, { inS: [], fire: [], tq: [], spk: [], deb: [], cracks: [], fired: false }),
    update(s, dt, at){
      if (s.cycle >= 3.8){ s.cycle -= 3.8; s.fired = false; s.cracks = []; }
      const c = s.cycle, GX = 180, GY = 285;
      if (c < .9) emit(s.acc, 1, 30 + 60 * c, dt, () => { const a = R(0, 6.28);
        spawn(s.inS, { x: GX + Math.cos(a) * 130, y: GY + Math.sin(a) * 36, vx: -Math.cos(a) * 180, vy: -Math.sin(a) * 50, size: R(8, 16), life: .7, orient: true, stretch: 1.6,
          cells: [at.map['shard:W0']], add: 1, tint: [1, .65, .25], fadeIn: .2, fadeOut: .3 }); });
      if (!s.fired && c >= 1){ s.fired = true;
        for (let i = 0; i < 22; i++) spawn(s.fire, { x: GX + R(-60, 60), y: GY - R(0, 40), vx: R(-80, 80), vy: R(-650, -380), rot: R(-.3, .3), size: R(110, 160), life: R(.35, .55), drag: 2,
          cells: [at.map[pick(['smoke1:L', 'smoke2:L', 'puff:L'])]], mode: 1.3, add: .45, stretch: 1.5, heat: [[0, 1.15], [1, .75]], ero: [[0, .02], [.6, .15], [1, .7]], fadeIn: .02, fadeOut: .3 });
        for (let i = 0; i < 16; i++) spawn(s.tq, { x: GX + R(-50, 50), y: GY - R(0, 30), vx: R(-40, 40), vy: R(-260, -140), rot: R(-.4, .4), vr: R(-.5, .5), size: R(110, 170), grow: .6, life: R(1, 1.6), age: -R(.15, .3),
          cells: [at.map[pick(['smoke1:L', 'smoke2:L', 'swirl:L'])]], add: .9, alpha: .55, stretch: 1.3, tint: [.15, .85, .7], drag: 1.5, fadeIn: .15, fadeOut: .5 });
        for (let i = 0; i < 70; i++){ const a = -PI / 2 + R(-1.4, 1.4), sp = R(250, 700), teal = i % 3 === 0;
          spawn(s.spk, { x: GX + R(-20, 20), y: GY - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(10, 20), life: R(.6, 1.4), drag: 1.2, grav: 700, orient: true, speedStretch: .003,
            cells: [at.map['shard:W0']], add: 1, tint: teal ? [.3, 1, .85] : [1, .7, .3], fadeIn: .02, fadeOut: .4 }); }
        for (let i = 0; i < 14; i++){ const a = -PI / 2 + R(-1.2, 1.2), sp = R(200, 450);
          spawn(s.deb, { x: GX, y: GY - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: R(0, 6), vr: R(-8, 8), size: R(8, 16), life: R(1, 1.6), grav: 900,
            cells: [at.map['shard:W0']], add: 0, alpha: .9, tint: [.18, .2, .2], fadeIn: .02, fadeOut: .2 }); }
        for (let i = 0; i < 7; i++){ const a = i / 7 * 6.28 + R(-.3, .3), L = R(80, 140);
          s.cracks.push(zig(GX, GY, GX + Math.cos(a) * L, GY + Math.sin(a) * L * .3, .5, 3)); }
      }
      for (const L of [s.inS, s.fire, s.tq, s.spk, s.deb]) step(L, dt);
      // обломки отскакивают от земли
      for (const p of s.deb) if (p.y > GY + 30 && p.vy > 0){ p.vy *= -.35; p.vx *= .6; p.vr *= .5; }
    },
    render(s, c){ const at = c.at, t = s.cycle, GX = 180, GY = 285, pre = Math.min(1, t / 1), post = t - 1;
      if (t < 1){
        sprite(c, GX, GY, 120 + 100 * pre, 0, .3 + .6 * pre, 1, at.map['sglow:W0'], .35, [1, .5, .2]);
        sprite(c, GX, GY, 100 + 80 * pre, 0, pre * pre, 1, at.map['star:W0'], .35, [1, .75, .4]);
        if (t > .45){ const k = (t - .45) / .55;
          sprite(c, GX, GY, 270, 0, k, 1, at.map['sring:W0'], .3, [1, .55, .2]);
          for (let i = 0; i < 10; i++){ const a = i / 10 * 6.28 + .3, bx = GX + Math.cos(a) * 125, by = GY + Math.sin(a) * 34, h = 260 * Math.min(1, k * 1.5 - i * .04);
            if (h > 0) seg(c, bx, by, bx, by - h, 34, .75 * k, 1, at.map['sglow:W0'], [1, .6, .25]); } }
      } else {
        const k = Math.min(1, post / 2.6);
        if (post < .25) sprite(c, GX, GY - 80, 700, 0, .6 * (1 - post / .25), 1, at.map['sglow:W0'], 1, [1, .75, .4]);
        sprite(c, GX, GY, 280 + 40 * k, 0, (1 - k) * .9, 1, at.map['sring:W0'], .3, [.2, 1, .8]);
        sprite(c, GX, GY, 200, 0, (1 - k) * .6, 0, at.map['sglow:W0'], .3, [.05, .12, .12]);
        const ca = Math.max(0, 1 - post / 1.6);
        if (ca > 0) for (const p of s.cracks) for (let i = 1; i < p.length; i++){
          seg(c, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 10, .5 * ca, 1, at.map['sglow:W0'], [.2, 1, .8]);
          seg(c, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 2, ca, 1, at.map['solid:W0'], [.7, 1, .95]); }
      }
      draw(c, s.inS); draw(c, s.tq); draw(c, s.fire); draw(c, s.deb); draw(c, s.spk);
    } };

  /* ── мультяшные маски с нарисованными ступенями света (fx-toon) ── */
  const TM = at => n => at.map[n + ':L'];
  // костёр: силуэт — рисованная раскадровка (4 кадра, 10 к/с), внутри течёт огненная полоса; вокруг языки живут
  // своей жизнью (растут, гнутся по ветру, остывают и рвутся по шуму), отрываются капли, летят угольки, сверху — дым
  DEF.firetoon = { atlas: 'toon', gfx: { bands: 4, dist: .12, speed: 1, ramp: 'fire' },
    init: s => Object.assign(s, { wind: 0, tg: [], dr: [], emb: [], sm: [], tw: [] }),
    update(s, dt, at){
      const m = TM(at), BX = 180, BY = 300, t = s.t, NEST = [-38, -14, 12, 36];
      s.wind = wob(t * .6, 1) * .6;
      const w = s.wind;
      emit(s.acc, 1, 7, dt, () => { const nx = NEST[Math.floor(Math.random() * 4)], cen = 1 - Math.abs(nx) / 60, size = R(110, 150) * (.7 + .4 * cen);
        spawn(s.tg, { bx: BX + nx + R(-6, 6), by: BY - 6, vy: R(-60, -35), size, life: R(.7, 1), cells: [m('ft' + (1 + Math.floor(Math.random() * 4)))], mode: 14, ph: 1 + Math.random() * .9,
          add: .3, sc: [[0, .25], [.2, 1], [.7, 1.05], [1, .8]], heat: [[0, 1.15], [.5, .95], [1, .7]], ero: [[0, .05], [.55, .1], [.85, .35], [1, .8]], fadeIn: .05, fadeOut: .1, pul: 0 }); });
      emit(s.acc, 2, 3.5, dt, () => spawn(s.dr, { x: BX + R(-30, 30) + w * 30, y: BY - R(120, 160), vx: R(-20, 20) + w * 40, vy: R(-120, -80), rot: R(-.3, .3), size: R(26, 42),
        sc: [[0, .5], [.2, 1], [1, .4]], life: R(.5, .8), cells: [m('fdrop')], mode: 1, add: .4, heat: [[0, 1.2], [1, .65]], ero: [[0, .05], [.6, .1], [1, .7]], fadeIn: .05, fadeOut: .2 }));
      emit(s.acc, 3, 6, dt, () => { const vx = R(-40, 40) + w * 50;
        spawn(s.emb, { x: BX + R(-40, 40), y: BY - R(30, 80), vx, vy: R(-220, -140), size: R(14, 22), life: R(.8, 1.4), cells: [m('fember')], mode: 1, add: .8, heat: [[0, 1.4], [1, .9]],
          orient: true, drag: .7, sway: 50, fadeIn: .05, fadeOut: .5 }); });
      emit(s.acc, 4, 1.4, dt, () => spawn(s.sm, { x: BX + R(-12, 12), y: BY - 205, vx: w * 25, vy: R(-45, -30), rot: R(-.3, .3), vr: R(-.3, .3), size: R(60, 80), grow: .8, life: 2.4,
        cells: [m(Math.random() < .5 ? 'fcurl' : 'tp' + (1 + Math.floor(Math.random() * 4)))], mode: 1.4, ramp: 'smoke', add: 0, alpha: .45, heat: [[0, .9], [1, .6]],
        ero: [[0, .3], [.3, .15], [.8, .35], [1, .9]], sway: 10, fadeIn: .3, fadeOut: .3 }));
      emit(s.acc, 5, 4, dt, () => spawn(s.tw, { x: BX + R(-60, 60), y: BY - R(60, 180), vx: R(-10, 10), vy: R(-50, -20), size: R(8, 14), sc: [[0, 0], [.5, 1], [1, 0]], life: R(.4, .7),
        cells: [at.map['twinkle:W0']], add: 1, tint: [1, .85, .5], fadeIn: .01, fadeOut: .01 }));
      for (const p of s.tg){ const k = Math.min(1, Math.max(0, p.age / p.life));
        p.by += p.vy * dt; p.bx += w * 60 * k * dt;
        p.x = p.bx; p.y = p.by - p.size * .36 * crv(p.sc, k); p.shear = -(w * .5 * (.3 + k) + wob(p.age * 2, p.ph * 7) * .12); p.rot = w * .05; }
      for (let i = s.tg.length; i--;){ const p = s.tg[i]; p.age += dt; if (p.age >= p.life){ s.tg[i] = s.tg[s.tg.length - 1]; s.tg.pop(); } }
      for (const L of [s.dr, s.emb, s.sm, s.tw]) step(L, dt);
    },
    render(s, c){
      const at = c.at, m = TM(at), BX = 180, BY = 300, t = s.t, w = s.wind;
      const fl = 1 + wob(t * 6, 2) * .06, fr = Math.floor(t * 10) % 4, fr2 = (fr + 2) % 4;
      sprite(c, BX + w * 14, BY - 100, 480 * fl, 0, .38, 1, at.map['sglow:W0'], 1.05, [1, .45, .15]);
      sprite(c, BX, BY + 6, 330 * fl, 0, .7, 1, at.map['sglow:W0'], .28, [1, .55, .2]);
      sprite(c, BX, BY - 4, 220 * (1 + wob(t * 4, 5) * .04), 0, 1, .6, m('fpool'), .55, null, 0, [1, 0, .9 + wob(t * 7, 3) * .12, 0]);
      draw(c, s.sm);
      // тело костра: раскадровка × бегущая полоса огня, два слоя (сзади — крупнее и холоднее)
      sprite(c, BX - 4 + w * 8, BY - 98, 270 * fl, w * .05, 1, .25, m('ff' + (fr2 + 1)), 1.1, null, 0, [14, .06, .72, 1.2]);
      for (const p of s.tg) if (p.size > 120) draw(c, [p]);
      sprite(c, BX + 3 + w * 10, BY - 82, 220 * fl, w * .07, 1, .35, m('ff' + (fr + 1)), 1.05, null, 0, [14, .08, .98, 1.55]);
      for (const p of s.tg) if (p.size <= 120) draw(c, [p]);
      draw(c, s.dr);
      sprite(c, BX, BY - 40, 150 * fl, 0, .35 + wob(t * 9, 4) * .08, 1, at.map['sglow:W0'], .7, [1, .85, .5]);
      draw(c, s.emb); draw(c, s.tw);
    } };

  // костёр по принципам симуляций: тело — три вложенных объёма пламени из шума (сзади крупный и холодный, спереди
  // маленький и горячий), шум течёт вверх, к макушке пламя рвётся на языки; цвет — по высоте и жару.
  // Живость: мерцание из трёх ритмов, порывы ветра гнут макушку, от верха отрываются языки, угольки — мягкие светящиеся
  // шарики с ореолом, сверху — тёмный дым, на земле дышит отсвет
  DEF.fire = { atlas: 'toon', gfx: { bands: 0, speed: .9, ramp: 'flame' },
    init: s => Object.assign(s, { wind: 0, gust: 0, wisps: [], emb: [], sm: [] }),
    update(s, dt, at){
      const BX = 180, BY = 312, t = s.t;
      s.wind = wob(t * .45, 1) * .16 + wob(t * 1.3, 6) * .04; s.gust = Math.max(0, wob(t * .7, 4));
      const w = s.wind;
      emit(s.acc, 2, 5, dt, () => { const big = Math.random() < .2;
        spawn(s.emb, { x: BX + R(-45, 45), y: BY - R(20, 140), vx: R(-25, 25) + w * 150, vy: R(-150, -60), size: big ? R(12, 18) : R(5, 10), life: R(1, 2.2), sway: R(15, 40),
          cells: [at.map['glow:W0']], add: 1, tint: Math.random() < .5 ? [1, .62, .25] : [1, .82, .45], fadeIn: .15, fadeOut: .5, pul: .25, pf: R(6, 14) }); });
      if (0) emit(s.acc, 3, 1.6, dt, () => spawn(s.sm, { x: BX + R(-15, 15) + w * 200, y: BY - 240, vx: w * 120, vy: R(-45, -30), size: R(80, 120), grow: 1.2, life: 2.6,
        cells: [at.map['sglow:W0']], add: 0, alpha: .32, tint: [.16, .08, .07], sway: 10, fadeIn: .4, fadeOut: .5, pul: 0 }));
      for (const p of s.emb) p.vx += w * 40 * dt;
      for (const L of [s.emb, s.sm]) step(L, dt);
    },
    render(s, c){
      const at = c.at, BX = 180, BY = 312, t = s.t, w = s.wind, g = s.gust;
      const fl = 1 + wob(t * 7, 2) * .05 + wob(t * 15, 3) * .03;
      sprite(c, BX + w * 40, BY - 130, 480 * fl, 0, .3, 1, at.map['sglow:W0'], 1.15, [1, .4, .12]);
      sprite(c, BX, BY + 4, 360 * fl, 0, .75, 1, at.map['sglow:W0'], .26, [1, .45, .14]);
      draw(c, s.sm);
      // объём пламени: квадрат size, растянут по высоте на sy, низ стоит на земле
      const vol = (S, sy, bend, heat, seed, add, dx, md) => sprite(c, BX + (dx || 0), BY + 6 - S * sy / 2, S, w * .25, 1, add, 0, sy, null, 0, [md || 15, bend, heat, seed]);
      vol(250, 1.15 + g * .12, w * 1.3, .95 * fl, .57, .55, 0);
      vol(150, 1 + g * .08, w * .8, 1.05 * fl, .91, .7, 0, 15.3);
      sprite(c, BX, BY - 22, 140 * fl, 0, .4, 1, at.map['sglow:W0'], .55, [1, .8, .45]);
      // угольки с ореолом
      for (const p of s.emb){ const k = p.age / p.life, a = Math.min(1, k / .15) * Math.min(1, (1 - k) / .5);
        sprite(c, p.x, p.y, p.size * 4, 0, .3 * a, 1, at.map['sglow:W0'], 1, p.tint); }
      draw(c, s.emb);
    } };

  // мультяшный взрыв: ожидание (ядро пульсирует всё чаще, плюётся искрами, дрожит) → кадр-звезда, тряска →
  // огненный шар из рисованных клубов с перелётом размера, вокруг с задержкой «хлопают» малые клубы;
  // цвет по остыванию: белый → жёлтый → оранжевый → красный, края рвутся по шуму → тёмный дым поднимается и тает;
  // ударное кольцо из клубов, серпы-обломки, угольки по баллистике, отсвет на земле
  DEF.toonboom = { atlas: 'toon', period: 2.9, gfx: { bands: 4, dist: .06, speed: 1, ramp: 'boom' },
    init: s => Object.assign(s, { pre: [], ball: [], sm: [], deb: [], emb: [], ring: [], fired: false }),
    update(s, dt, at){
      const m = TM(at), GX = 180, GY = 185, T = .9;
      if (s.cycle >= 2.9){ s.cycle -= 2.9; s.fired = false; }
      const c = s.cycle;
      if (c < T){ const k = c / T; s.shake = 1 + k * k * 4;
        emit(s.acc, 1, 6 + 26 * k, dt, () => { const a = R(0, 6.28), sp = R(80, 200);
          spawn(s.pre, { x: GX + Math.cos(a) * 14, y: GY + Math.sin(a) * 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, size: R(16, 26), life: R(.25, .45), grav: 300,
            cells: [m('fember')], mode: 1, add: .8, heat: [[0, 1.5], [1, 1]], orient: true, fadeIn: .05, fadeOut: .4 }); }); }
      if (!s.fired && c >= T){ s.fired = true; s.shake = 16;
        const ball = (x, y, size, delay, life, cell, vx, vy) => spawn(s.ball, { x, y, vx, vy, rot: R(-.4, .4), vr: R(-.5, .5), size, age: -delay, life, drag: 3.5, cells: [m(cell)], mode: 1, add: .15,
          sc: [[0, .3], [.07, 1.15], [.18, 1], [1, 1.1]], heat: [[0, 2.1], [.12, 1.6], [.35, 1.15], [.6, .95], [1, .8]], ero: [[0, 0], [.45, .05], [.65, .2], [.85, .5], [1, .95]], fadeIn: .01, fadeOut: .03, pul: .03, pf: 7 });
        ball(GX, GY, 300, 0, 1.15, 'tb' + (1 + Math.floor(Math.random() * 4)), 0, -10);
        for (let i = 0; i < 7; i++){ const a = i / 7 * 6.28 + R(-.3, .3), d = R(70, 110);
          ball(GX + Math.cos(a) * d * .6, GY + Math.sin(a) * d * .5, R(110, 160), R(.03, .16), R(.8, 1), 'tp' + (1 + i % 4), Math.cos(a) * 120, Math.sin(a) * 90 - 20); }
        for (let i = 0; i < 6; i++){ const a = R(-PI, 0), d = R(20, 70);
          spawn(s.sm, { x: GX + Math.cos(a) * d, y: GY + Math.sin(a) * d * .6, vx: R(-20, 20), vy: R(-70, -40), rot: R(0, 6.28), vr: R(-.4, .4), size: R(140, 200), grow: .4, age: -R(.45, .7), life: R(1.1, 1.5),
            cells: [m('tp' + (1 + i % 4))], mode: 1.3, ramp: 'smoke', add: 0, alpha: .9, heat: [[0, 1], [1, .8]], ero: [[0, .02], [.5, .1], [1, .9]], fadeIn: .15, fadeOut: .05 }); }
        spawn(s.ring, { x: GX, y: GY, size: 160, sc: [[0, .5], [1, 2.6]], life: .45, cells: [m('tring')], mode: 1, add: .5, heat: [[0, 1.6], [1, .9]], ero: [[0, 0], [.4, .1], [1, .8]], fadeIn: .01, fadeOut: .05, pul: 0 });
        for (let i = 0; i < 6; i++){ const a = i / 6 * 6.28 + R(-.3, .3), sp = R(320, 480);
          spawn(s.deb, { x: GX, y: GY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: a + PI / 2, vr: R(-5, 5), size: R(60, 90), life: R(.45, .65), drag: 3.5, cells: [m('tcres')], mode: 1, add: .3,
            heat: [[0, 1.4], [1, .7]], ero: [[0, 0], [.4, .1], [1, .9]], fadeIn: .01, fadeOut: .05 }); }
        for (let i = 0; i < 28; i++){ const a = R(0, 6.28), sp = R(300, 700);
          spawn(s.emb, { x: GX, y: GY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100, size: R(14, 26), life: R(.5, 1), drag: 1.8, grav: 700, cells: [m('fember')], mode: 1, add: .9,
            heat: [[0, 1.6], [1, .8]], orient: true, speedStretch: .002, fadeIn: .01, fadeOut: .4 }); }
      }
      for (const L of [s.pre, s.ball, s.sm, s.deb, s.emb, s.ring]) step(L, dt);
    },
    render(s, c){
      const at = c.at, m = TM(at), GX = 180, GY = 185, T = .9, t = s.cycle, p = t - T;
      if (t < T){ const k = t / T, pl = .5 + .5 * Math.sin(t * (10 + 40 * k));
        sprite(c, GX, GY, 150 + 90 * k, 0, (.3 + .5 * k) * (.6 + .4 * pl), 1, at.map['sglow:W0'], 1, [1, .35, .15]);
        sprite(c, GX, GY, (40 + 30 * k) * (1 + pl * .2), t * 3, .6 + .4 * k, 1, at.map['twinkle:W0'], 1, [1, .9, .6]); }
      if (p >= 0){ const k = Math.min(1, p / 1.6); sprite(c, GX, GY + 110, 380, 0, (1 - k) * .7, 1, at.map['sglow:W0'], .25, [1, .35, .1]); }
      draw(c, s.sm); draw(c, s.ring); draw(c, s.deb); draw(c, s.ball);
      if (p >= 0 && p < .12){ const q = p / .12;
        sprite(c, GX, GY, 380 + 160 * q, .4 * q, 1 - q * .3, .4, m('tstar'), 1, null, 0, [1, 0, 2.2, 0]);
        sprite(c, GX, GY, 480, -.2, 1 - q, 1, m('tspikes'), 1, [1, .95, .7], 0, [1, 0, 2, 0]); }
      if (p >= 0 && p < .2) sprite(c, 180, 180, 4000, 0, .45 * (1 - p / .2), 1, at.map['solid:W0'], 1, [1, .85, .6], .3);
      draw(c, s.emb); draw(c, s.pre);
    } };

  // снаряд (Bubble Busters): голова — горячее ядро, вокруг крутятся два серпа («зацикленный узор»), дышит свечение;
  // хвост — лента по следу полёта: внутри бегут полутоновые точки и световые штрихи, к голове шире и ярче;
  // раз в 1.6 с попадание: белый диск → звезда-шипы, кольцо-серп проворачивается, разлёт точек
  DEF.bubble = { atlas: 'toon', gfx: { speed: 1 },
    init: s => Object.assign(s, { trail: [], hits: [], sh: [], hp: 1.2, bx: 180, by: 180 }),
    update(s, dt, at){
      const t = s.t;
      s.bx = 180 + Math.sin(t * 1.25) * 125 + Math.sin(t * 3.1) * 8; s.by = 180 + Math.sin(t * 2.5) * 80;
      const l = s.trail[s.trail.length - 1];
      if (!l || Math.hypot(l[0] - s.bx, l[1] - s.by) > 7){ s.trail.push([s.bx, s.by]); if (s.trail.length > 40) s.trail.shift(); }
      emit(s.acc, 1, 16, dt, () => spawn(s.sh, { x: s.bx + R(-10, 10), y: s.by + R(-10, 10), vx: R(-30, 30), vy: R(-30, 30), size: R(8, 16), sc: [[0, 0], [.4, 1], [1, 0]], life: R(.3, .6),
        cells: [at.map[Math.random() < .5 ? 'twinkle:W0' : 'glow:W0']], add: 1, tint: [1, .9, .55], fadeIn: .01, fadeOut: .01 }));
      s.hp -= dt; if (s.hp <= 0){ s.hp = 1.6; s.shake = 6; spawn(s.hits, { x: s.bx, y: s.by, life: .6, size: 1, cells: [0], pul: 0 });
        for (let i = 0; i < 10; i++){ const a = R(0, 6.28), sp = R(150, 320);
          spawn(s.sh, { x: s.bx, y: s.by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(10, 18), life: R(.35, .6), drag: 4, cells: [at.map['glow:W0']], add: 1, tint: [1, .85, .4], fadeIn: .01, fadeOut: .5 }); } }
      step(s.hits, dt); step(s.sh, dt);
    },
    render(s, c){
      const at = c.at, m = TM(at), t = s.t, pts = s.trail.concat([[s.bx, s.by]]), pl = 1 + wob(t * 5, 1) * .1;
      ribbon(c, pts, 30, 84, 1, .55, 1.6, [1, .45, .12], 1, .8);
      ribbon(c, pts, 26, 66, 2, 1.4, 1.2, [1, .72, .2], 1, .9);
      ribbon(c, pts, 6, 30, 0, 1, 2.4, [1, .92, .65], 1, 1);
      sprite(c, s.bx, s.by, 130 * pl, 0, .75, 1, at.map['sglow:W0'], 1, [1, .7, .2]);
      sprite(c, s.bx, s.by, 52, t * 9, .8, .8, 0, 1, [1, .85, .45], 0, [6, .5, .04, 0]);
      sprite(c, s.bx, s.by, 52, t * 9 + PI, .8, .8, 0, 1, [1, .85, .45], 0, [6, .5, .04, 0]);
      sprite(c, s.bx, s.by, 46 * pl, 0, 1, 1, at.map['glow:W0'], 1, [1, .97, .8]);
      draw(c, s.sh);
      for (const h of s.hits){ const k = h.age / h.life;
        if (k < .18) sprite(c, h.x, h.y, 70 + 140 * k / .18, 0, 1, 1, at.map['glow:W0'], 1, [1, 1, .9]);
        if (k < .4){ const q = k / .4; sprite(c, h.x, h.y, 90 + 90 * q, q, .8 * (1 - q), 1, m('tspikes'), 1, [1, .9, .4], 0, [1, 0, 1.4, 0]); }
        sprite(c, h.x, h.y, 100 + 110 * easeOut(k), k * 5, 1 - k, 1, 0, 1, [1, .85, .3], 0, [6, .8, .05 * (1 - k) + .01, 0]);
        sprite(c, h.x, h.y, 200 * (1 - k * .3), 0, (1 - k) * .5, 1, at.map['sglow:W0'], 1, [1, .7, .2]); }
    } };

  /* ── рамки аватара (Discord): эффект обнимает предмет, простой и зацикленный ── */
  // огненное кольцо: две ленты огня бегут по кругу навстречу (огонь течёт вдоль), языки срываются наружу по касательной,
  // по кругу летают два «спутника» (здесь гемы) с огненным хвостом, вокруг — тёплое свечение
  DEF.firering = { atlas: 'toon', gfx: { speed: 1, ramp: 'flame', bands: 4 },
    init: s => Object.assign(s, { emb: [] }),
    update(s, dt, at){
      emit(s.acc, 1, 14, dt, () => { const a = R(0, 6.28), rr = R(112, 128);
        spawn(s.emb, { x: 180 + Math.cos(a) * rr, y: 180 + Math.sin(a) * rr, vx: -Math.sin(a) * 60 + Math.cos(a) * 30, vy: Math.cos(a) * 60 + Math.sin(a) * 30 - 20, size: R(4, 8), life: R(.4, .9),
          cells: [at.map['glow:W0']], add: 1, tint: [1, .7, .3], fadeIn: .1, fadeOut: .5, pul: .3, pf: 12 }); });
      step(s.emb, dt);
    },
    render(s, c){ const at = c.at, t = s.t, R0 = 120;
      sprite(c, 180, 180, 400, 0, .22, 1, at.map['sring:W0'], 1, [1, .4, .1]);
      const arc = (a0, len, w0, w1, row, sp, tint, al) => { const pts = []; for (let i = 0; i <= 24; i++){ const a = a0 + len * i / 24, rr = R0 + wob(t * 3 + i * .4, a0) * 5; pts.push([180 + Math.cos(a) * rr, 180 + Math.sin(a) * rr]); }
        ribbon(c, pts, w0, w1, row, 1, sp, tint, al, .8); };
      for (let k = 0; k < 2; k++){ const a0 = t * 1.6 + k * PI;
        arc(a0 - 2.9, 2.9, 10, 78, 1, 1.6, [1, .42, .1], 1);
        arc(a0 - 2.2, 2.2, 8, 48, 1, 2.2, [1, .7, .25], 1);
        arc(a0 - 1.4, 1.4, 4, 24, 0, 2.8, [1, .92, .6], .9); }
      for (let k = 0; k < 2; k++){ const a = t * 1.6 + k * PI, x = 180 + Math.cos(a) * R0, y = 180 + Math.sin(a) * R0;
        sprite(c, x, y, 90, 0, .7, 1, at.map['sglow:W0'], 1, [1, .5, .15]);
        sprite(c, x, y, 110 * (1 + wob(t * 4, k) * .06), Math.sin(t * 3 + k) * .3, 1, 0, at.map['gemP']); }
      draw(c, s.emb);
    } };

  // блёстки: при появлении — вспышка разноцветных звёздочек вокруг, потом редкие звёздочки вспыхивают по ободу
  DEF.sparkring = { atlas: 'aura', period: 6,
    init: s => Object.assign(s, { st: [], fired: false }),
    update(s, dt, at){ if (s.cycle >= 6){ s.cycle -= 6; s.fired = false; }
      const COL = [[.3, 1, .95], [1, .35, .8], [1, .95, .35], [.45, 1, .5]];
      const star = (a, rr, big, vOut) => spawn(s.st, { x: 180 + Math.cos(a) * rr, y: 180 + Math.sin(a) * rr, vx: Math.cos(a) * vOut, vy: Math.sin(a) * vOut, size: big ? R(55, 95) : R(26, 44), sc: [[0, 0], [.3, 1], [1, 0]],
        life: R(.4, .8), rot: R(-.3, .3), drag: 3, cells: [at.map['star:W0']], add: 1, tint: pick(COL), fadeIn: .01, fadeOut: .01 });
      if (!s.fired){ s.fired = true; for (let i = 0; i < 26; i++) star(R(0, 6.28), R(90, 135), i < 8, R(30, 120)); }
      emit(s.acc, 1, 9, dt, () => star(R(0, 6.28), R(112, 130), Math.random() < .15, 0));
      step(s.st, dt);
    },
    render(s, c){ for (const p of s.st){ const k = p.age / p.life, a = Math.sin(k * PI); sprite(c, p.x, p.y, p.size * 1.4 * a, 0, .5 * a, 1, c.at.map['sglow:W0'], 1, p.tint); } draw(c, s.st); } };

  /* ── фракталы: природная сложность из формулы (ветвление, самоподобие), почти без картинок ── */
  // ветвящаяся молния: нарастание (искры трещат у цели, небо светлеет) → удар (ствол + ветви, перерисовка 15 раз в секунду,
  // 3 вспышки-«перескока») → затухание (ветви гаснут раньше ствола, у земли кольцо и искры). Фокус — ствол, ветви вторичны
  DEF.fbolt = { atlas: 'aura', period: 2,
    init: s => Object.assign(s, { tree: [], jt: 0, sp: [], fired: false }),
    update(s, dt, at){
      if (s.cycle >= 2){ s.cycle -= 2; s.fired = false; }
      const c = s.cycle, T = .45, GX = 180 + Math.sin(s.t * .7) * 30, GY = 320;
      s.jt -= dt;
      if (c > T && c < T + .55 && s.jt <= 0){ s.jt = 1 / 15; s.tree = branch(180 + R(-30, 30), -10, GX, GY, .42, 5, 3, 7, []); }
      if (c >= T + .55) s.tree = [];
      if (c < T) emit(s.acc, 1, 30, dt, () => { const a = R(-PI, 0), sp = R(40, 120);
        spawn(s.sp, { x: GX, y: GY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(6, 12), life: R(.15, .3), cells: [at.map['shard:W0']], add: 1, orient: true, stretch: 1.8, tint: [.7, .85, 1], fadeIn: .05, fadeOut: .5 }); });
      if (!s.fired && c >= T){ s.fired = true; s.shake = 8; s.gx = GX;
        for (let i = 0; i < 26; i++){ const a = -PI / 2 + R(-1.3, 1.3), sp = R(200, 480);
          spawn(s.sp, { x: GX, y: GY - 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: R(10, 18), life: R(.4, .7), drag: 1.2, grav: 900, cells: [at.map['shard:W0']], add: 1, orient: true, speedStretch: .002, tint: [.75, .9, 1], fadeIn: .02, fadeOut: .5 }); } }
      step(s.sp, dt);
    },
    render(s, c){
      const at = c.at, t = s.cycle, T = .45, p = t - T, GY = 320;
      sprite(c, 180, 0, 420, 0, .2 + .5 * Math.min(1, t / T) * (p < 0 ? 1 : Math.max(0, 1 - p)), 1, at.map['sglow:W0'], .5, [.35, .45, 1]);
      if (p >= 0 && p < .55){
        const fl = p < .06 || (p > .14 && p < .2) || (p > .28 && p < .32) ? 1 : .7;   // три «перескока» яркости
        const fade = Math.max(0, 1 - p / .55);
        for (const [pts, w, b] of s.tree){ const a = fl * (b > .9 ? Math.min(1, fade * 1.6) : fade * fade) * b;
          for (let i = 1; i < pts.length; i++){
            seg(c, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w * 5, .45 * a, 1, at.map['sglow:W0'], [.45, .6, 1]);
            seg(c, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w * .55 + .8, a, 1, at.map['solid:W0'], [.92, .96, 1]); } }
        if (p < .1) sprite(c, 180, 180, 4000, 0, .35 * (1 - p / .1), 1, at.map['solid:W0'], 1, [.7, .8, 1], .3);
        sprite(c, s.gx, GY, 160 + 200 * easeOut(p / .55), 0, fade, 1, at.map['ring:W0'], .3, [.6, .8, 1]);
        sprite(c, s.gx, GY - 6, 150, 0, fade, 1, at.map['sglow:W0'], .6, [.6, .75, 1]);
      }
      draw(c, s.sp);
    } };

  // аура Жюлиа: фрактал за предметом медленно закручивается и дышит (c ходит по кругу), светящиеся нити — ловушка орбиты;
  // сверху — мягкое ядро и редкие звёздочки по краю. Для Ультра/Джекпота: «бесконечная» глубина
  DEF.julia = { atlas: 'aura', gfx: { speed: 1, ramp: 'julia' },
    init: s => Object.assign(s, { st: [] }),
    update(s, dt, at){
      emit(s.acc, 1, 5, dt, () => { const a = R(0, 6.28), d = R(100, 150);
        spawn(s.st, { x: 180 + Math.cos(a) * d, y: 180 + Math.sin(a) * d, size: R(14, 30), sc: [[0, 0], [.4, 1], [1, 0]], life: R(.5, .9), rot: R(0, 1), cells: [at.map['twinkle:W0']], add: 1, tint: [.75, .9, 1], fadeIn: .01, fadeOut: .01 }); });
      step(s.st, dt);
    },
    render(s, c){ const at = c.at, t = s.t, pl = 1 + wob(t * 1.3, 2) * .03;
      sprite(c, 180, 180, 380, 0, .45, 1, at.map['sglow:W0'], 1, [.25, .15, .7]);
      sprite(c, 180, 180, 340 * pl, 0, 1, .85, 0, 1, null, 0, [16, 1, 1, 0]);
      sprite(c, 180, 180, 120 * pl, 0, .5, 1, at.map['sglow:W0'], 1, [.6, .8, 1]);
      draw(c, s.st); } };

  // кристалл: из центра растёт снежинка-фрактал — 6 лучей, от каждого ветки под 60°, от веток — веточки (рисуем осколками);
  // рост по кривой с замедлением, по граням бежит блик, после роста кристалл дышит и мерцает; цикл — рост, жизнь, рассыпание
  DEF.crystal = { atlas: 'aura', period: 4,
    init(s){ s.sh = []; s.arm = []; const add = (x, y, a, len, d, t0) => { const n = 3; s.arm = s.arm || []; s.arm.push({ x, y, x1: x + Math.cos(a) * len, y1: y + Math.sin(a) * len, w: 2 + d * 2.5, t: t0, dur: .35 * (1 + (2 - d) * .3) });
        for (let i = 1; i <= n; i++){ const k = i / n, px = x + Math.cos(a) * len * k, py = y + Math.sin(a) * len * k;
        if (i === n || d === 0) s.sh.push({ x: px, y: py, a, size: len * .45 * (d ? .8 : 1.2), t: t0 + k * .35 * (1 + (2 - d) * .3), d });
        if (d > 0 && i > 1 && i < n) for (const sg of [-1, 1]) add(px, py, a + sg * 1.05, len * .42, d - 1, t0 + k * .35); } };
      for (let i = 0; i < 6; i++) add(180, 180, i / 6 * 6.28 - PI / 2, 120, 2, 0); s.burst = []; s.fired = false; },
    update(s, dt, at){ if (s.cycle >= 4){ s.cycle -= 4; s.fired = false; }
      if (!s.fired && s.cycle > 3.3){ s.fired = true; for (const p of s.sh) if (Math.random() < .6) spawn(s.burst, { x: p.x, y: p.y, vx: (p.x - 180) * R(.8, 1.6), vy: (p.y - 180) * R(.8, 1.6) + 30, rot: p.a, vr: R(-6, 6), size: p.size * .7, life: R(.4, .7), drag: 1.5, grav: 300, cells: [at.map['shard:W0']], add: .8, tint: [.6, .9, 1], fadeIn: .01, fadeOut: .5 }); }
      step(s.burst, dt); },
    render(s, c){ const at = c.at, t = s.cycle, out = t > 3.3 ? Math.max(0, 1 - (t - 3.3) / .2) : 1;
      sprite(c, 180, 180, 340, 0, .35 * out, 1, at.map['sglow:W0'], 1, [.3, .6, 1]);
      for (const a of s.arm){ const k = easeOut(Math.min(1, Math.max(0, (t - a.t) / a.dur))); if (k <= 0) continue; const x1 = a.x + (a.x1 - a.x) * k, y1 = a.y + (a.y1 - a.y) * k;
        const gl = Math.max(0, 1 - Math.abs(((t * .6) % 1.6) - Math.hypot(a.x - 180, a.y - 180) / 150) * 4);
        seg(c, a.x, a.y, x1, y1, a.w * 5, .35 * out, 1, at.map['sglow:W0'], [.35, .7, 1]);
        seg(c, a.x, a.y, x1, y1, a.w, out, 1, at.map['solid:W0'], [.6 + gl * .4, .9 + gl * .1, 1]); }
      for (const p of s.sh){ const k = easeOut(Math.min(1, Math.max(0, (t - p.t) / .3))); if (k <= 0) continue;
        const gl = Math.max(0, 1 - Math.abs(((t * .6) % 1.6) - Math.hypot(p.x - 180, p.y - 180) / 150) * 4);   // блик бежит от центра
        const tw = 1 + wob(s.t * 3, p.x * .1) * .1;
        sprite(c, p.x, p.y, p.size * k * 2.2, 0, .25 * out, 1, at.map['sglow:W0'], 1, [.4, .75, 1]);
        sprite(c, p.x, p.y, p.size * k * tw, p.a + PI / 2, out * (.75 + gl * .25), .9, at.map['shard:W0'], .45, [.55 + gl * .45, .85 + gl * .15, 1]); }
      sprite(c, 180, 180, 60 * (1 + wob(s.t * 2, 1) * .08), 0, out, 1, at.map['glow:W0'], 1, [.8, .95, 1]);
      draw(c, s.burst); } };

  // трещины от удара: из точки по земле растут ветвящиеся светящиеся трещины (фрактал), свет течёт по ним от центра,
  // из трещин бьют лучи и пыль, потом трещины остывают — тускнеют и краснеют
  DEF.cracks = { atlas: 'aura', period: 2.4,
    init: s => Object.assign(s, { tr: [], fired: false, dust: [] }),
    update(s, dt, at){ if (s.cycle >= 2.4){ s.cycle -= 2.4; s.fired = false; }
      if (!s.fired && s.cycle > .15){ s.fired = true; s.shake = 10; s.tr = [];
        for (let i = 0; i < 6; i++){ const a = i / 6 * 6.28 + R(-.3, .3), L = R(110, 160); branch(180, 260, 180 + Math.cos(a) * L, 260 + Math.sin(a) * L * .38, .55, 4, 2, 5, s.tr); }
        for (let i = 0; i < 14; i++){ const a = R(0, 6.28), sp = R(80, 200);
          spawn(s.dust, { x: 180, y: 260, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .35 - 20, rot: R(0, 6), vr: R(-1, 1), size: R(50, 80), grow: .8, life: R(.8, 1.2), drag: 2.5, cells: [at.map['sglow:W0']], add: 0, alpha: .5, tint: [.5, .4, .35], fadeIn: .05, fadeOut: .6 }); } }
      step(s.dust, dt); },
    render(s, c){ const at = c.at, p = s.cycle - .15; if (p < 0) return;
      const grow = easeOut(Math.min(1, p / .35)), cool = Math.min(1, Math.max(0, (p - .5) / 1.5));
      const col = [1, .85 - cool * .5, .45 - cool * .35], a = 1 - Math.max(0, (p - 1.6) / .6);
      if (p < .3) sprite(c, 180, 255, 260 + 200 * p, 0, (1 - p / .3), 1, at.map['sglow:W0'], .45, [1, .8, .4]);
      draw(c, s.dust);
      for (const [pts, w, b] of s.tr){ const n = Math.max(1, Math.floor((pts.length - 1) * grow));
        for (let i = 1; i <= n; i++){
          seg(c, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w * 4, .4 * a * b, 1, at.map['sglow:W0'], col);
          seg(c, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w * .6 + .6, a * b, 1, at.map['solid:W0'], [1, .95 - cool * .4, .8 - cool * .6]); } }
      if (p < .6) for (let i = 0; i < 5; i++){ const x = 180 + Math.cos(i * 1.26) * 70 * grow, k = p / .6; seg(c, x, 260 + Math.sin(i * 1.26) * 25 * grow, x, 260 - 140 * k, 26, (1 - k) * .45, 1, at.map['sglow:W0'], [1, .8, .4]); }
    } };

  // плазма-сфера: жидкий узор из шума, искажённого шумом (тройное искажение) — переливается, как магма/туманность,
  // мягкий обод и свечение. Фон для наград
  DEF.plasma = { atlas: 'aura', gfx: { speed: 1, ramp: 'plasma' },
    init(){}, update(){},
    render(s, c){ const at = c.at, pl = 1 + wob(s.t * 1.1, 3) * .03;
      sprite(c, 180, 180, 400, 0, .45, 1, at.map['sglow:W0'], 1, [.6, .15, .5]);
      sprite(c, 180, 180, 300 * pl, 0, 1, .3, 0, 1, null, 0, [17, 0, 1, .3]);
      sprite(c, 180, 180, 300 * pl, 0, .8, 1, at.map['ring:W0'], 1, [1, .55, .7]);
      } };

  /* ── арена PvP: лёгкий туман и пыль по краю арены. Холст больше арены в 1.5 раза (край трибун — радиус ≈120 из 360):
     мягкие клубы дыма медленно плывут по кругу у трибун и за ними, рвутся по шуму и тают; в воздухе висит тёплая пыль.
     s.hot = 1 — последние 5 секунд: туман чуть гуще и теплее, плывёт быстрее; s.dense — множитель плотности (tab2 — гуще) */
  DEF.arena = { atlas: 'aura', gfx: { speed: .5, ramp: 'smoke' },
    puff(s, at, age){ const a = R(0, 6.28), r = R(128, 185);
      spawn(s.fog, { x: 180 + Math.cos(a) * r, y: 180 + Math.sin(a) * r, a, r, rot: R(0, 6.28), vr: R(-.15, .15), size: R(110, 180), grow: .4, life: R(5, 8), age,
        cells: [0], mode: 18.4, ramp: 'haze', add: .12, alpha: R(.22, .38) * (s.dense || 1), heat: [[0, .9], [1, .75]], ero: [[0, .3], [.5, .18], [1, .4]], ph: R(0, 9), fadeIn: .3, fadeOut: .35, pul: 0 }); },
    init(s, at){ Object.assign(s, { fog: [], dust: [], hotK: 0 }); for (let i = 0; i < 16; i++) this.puff(s, at, R(0, 5)); },
    update(s, dt, at){
      s.hotK += ((s.hot ? 1 : 0) - s.hotK) * Math.min(1, dt * 2);
      emit(s.acc, 1, 2.2 + s.hotK * 1.5, dt, () => this.puff(s, at, 0));
      emit(s.acc, 2, 6, dt, () => { const a = R(0, 6.28), r = R(60, 175);
        spawn(s.dust, { x: 180 + Math.cos(a) * r, y: 180 + Math.sin(a) * r, vx: R(-6, 6), vy: R(-10, -2), size: R(3, 6), life: R(2, 4), sway: 4,
          cells: [at.map['glow:W0']], add: 1, alpha: R(.25, .55), tint: [1, .8, .55], fadeIn: .3, fadeOut: .4, pul: .2, pf: R(2, 5) }); });
      // клубы плывут по кругу (медленнее у края), чуть дышат по радиусу
      const w = (.05 + s.hotK * .06) * dt;
      for (const p of s.fog){ p.a += w * (150 / p.r); const rr = p.r + Math.sin(s.t * .3 + p.ph) * 4; p.x = 180 + Math.cos(p.a) * rr; p.y = 180 + Math.sin(p.a) * rr; p.age += dt; }
      for (let i = s.fog.length; i--;) if (s.fog[i].age >= s.fog[i].life){ s.fog[i] = s.fog[s.fog.length - 1]; s.fog.pop(); }
      step(s.dust, dt);
    },
    render(s, c){
      for (const p of s.fog) p.tint = [1, 1 - s.hotK * .15, 1 - s.hotK * .3]; draw(c, s.fog); draw(c, s.dust); } };

  /* ── искры удара молота по наковальне (крафт и арена). Удар — 2–3 кадра: белая вспышка и блик-полоса; дальше
     раскалённые искры веером вверх и в стороны — тонкие росчерки, длина по скорости (размытие движения), остывают
     белый → жёлтый → оранжевый → тёмно-красный и гаснут в разное время; летевшие вниз отскакивают от наковальни.
     Затухание — угольки медленно всплывают и краснеют, на месте удара тлеет пятно. Кольцо и жар — в разметке (.fi-ring, .fi-heat).
     Цвет свечения — s.tint (ранг / огонь арены), искр — s.pal (Ставки — розовая). Эффект задуман в px: size = 360 → 1 ед. = 1 px */
  DEF.anvil = { atlas: 'aura', period: 2,
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
      if (t < 1.2){ const k = t / 1.2; sprite(c, 180, 180, 70 + 30 * k, 0, (1 - k) ** 2 * .7, 1, at.map['sglow:W0'], .6, [1, .5, .2]); }
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

  /* ── сложные частицы: приёмы потока, притяжения, следа, дочерних частиц и частиц из картинки ── */

  // точки картинки: сетка n×n, непрозрачные клетки → [x, y, r, g, b] (x, y — от −0.5 до 0.5). Картинка с чужого сервера без CORS
  // прочитаться не может — тогда точек нет и эффект молча пропускается. Кэш по адресу и сетке
  const PIX = {};
  function pixels(src, n){
    const key = (src.src || src) + '|' + n; if (PIX[key]) return PIX[key];
    const r = PIX[key] = { ok: false, pts: [] }, im = typeof src === 'string' ? Object.assign(new Image(), { crossOrigin: 'anonymous', src }) : src;
    const go = () => { try { const c2 = document.createElement('canvas'); c2.width = c2.height = n; const g = c2.getContext('2d', { willReadFrequently: true });
        const k = Math.min(n / im.naturalWidth, n / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k; g.drawImage(im, (n - w) / 2, (n - h) / 2, w, h);
        const d = g.getImageData(0, 0, n, n).data;
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++){ const i = (y * n + x) * 4; if (d[i + 3] > 110) r.pts.push((x + .5) / n - .5, (y + .5) / n - .5, d[i] / 255, d[i + 1] / 255, d[i + 2] / 255); }
      } catch (_){ r.pts = []; } r.ok = true; };
    if (im.complete && im.naturalWidth) go(); else { im.addEventListener('load', go); im.addEventListener('error', () => { r.ok = true; }); }
    return r;
  }

  // Рассыпание / сборка картинки (продажа, вывод, раскрытие NFT): каждая клетка картинки — частица своего цвета.
  // 'out' — волна слева направо: клетка вспыхивает (раскалённая кромка), отрывается, уносится потоком вверх, остывает и гаснет;
  // 'in' — частицы слетаются вихрем и пружиной встают на место, волной слева направо, в конце — вспышка.
  // Forge.play('dust', { x, y, size, img: адрес или <img>, dir: 'out' | 'in', box: сторона картинки в ед. эффекта (220), tint: цвет кромки })
  DEF.dust = { atlas: 'aura', period: 2.6,
    init(s){ const o = s.o || {}; Object.assign(s, { p: [], made: false, dir: o.dir || 'out', box: o.box || 220, T: o.tint || [1, .62, .25], px: pixels(o.img || base + '../hero-gem.webp', [32, 44, 52][quality]) }); },
    update(s, dt, at){
      if (!s.made){ if (!s.px.ok) { s.cycle = 0; return; } s.made = true; s.cycle = 0;
        const P = s.px.pts, B = s.box, T = s.T, S = B / [32, 44, 52][quality] * 1.08, cell = at.map['solid:W0'];   // сплошные клетки встык — пока стоят, это сама картинка
        for (let i = 0; i < P.length; i += 5){ const u = P[i], v = P[i + 1], col = [P[i + 2], P[i + 3], P[i + 4]], hx = 180 + u * B, hy = 180 + v * B;
          if (s.dir === 'out'){ const w = .12 + (u + .5) * 1.05 + v * .18 + R(0, .1);
            spawn(s.p, { x: hx, y: hy, vx: R(20, 70), vy: R(-50, -10), wait: w, life: w + R(.8, 1.3), flow: 70, fz: 2, grav: -70, drag: .8, size: S, cells: [cell], add: .1,
              sc: [[0, 1], [.12, 1.25], [1, .1]], tc: [[0, col], [.06, [1, .96, .85]], [.35, T], [1, [T[0] * .4, T[1] * .2, T[2] * .2]]], fadeIn: 0, fadeOut: .45, pul: 0 }); }
          else { const a = R(0, 6.28), d = R(90, 210), w = (u + .5) * .55 + R(0, .08);
            spawn(s.p, { x: hx + Math.cos(a) * d, y: hy + Math.sin(a) * d, vx: -Math.sin(a) * 160, vy: Math.cos(a) * 160, hx, hy, spring: 90, drag: 7, wait: w, life: 2.55, size: S, cells: [cell], add: .1,
              sc: [[0, .3], [.3, 1]], tc: [[0, T], [.25, [1, .96, .85]], [.4, col], [1, col]], fadeIn: .08, fadeOut: .02, pul: 0 }); }
        }
      }
      step(s.p, dt);
    },
    render(s, c){ const at = c.at, t = s.cycle;
      if (s.made && s.dir === 'in' && t > 1.05 && t < 1.6){ const k = (t - 1.05) / .55; sprite(c, 180, 180, s.box * (1 + .9 * easeOut(k)), 0, (1 - k) ** 2 * .7, 1, at.map['sglow:W0'], 1, s.T); }
      draw(c, s.p); } };

  // Огоньки (поток): частицы текут по вихревому полю и тянут за собой след — живое движение без ручных траекторий
  DEF.wisps = { atlas: 'aura',
    init: s => Object.assign(s, { p: [] }),
    update(s, dt, at){
      emit(s.acc, 1, 18, dt, () => spawn(s.p, { x: 180 + R(-140, 140), y: R(120, 340), vy: -40, flow: 85, fz: 1.4, grav: -45, trail: 14, size: R(14, 22), life: R(2.2, 3.2), cells: [at.map['glow:W0']], add: 1,
        tc: [[0, [.7, 1, 1]], [.5, [.5, .55, 1]], [1, [.45, .2, .85]]], fadeIn: .12, fadeOut: .4, pul: .2, pf: R(5, 9) }));
      step(s.p, dt);
    },
    render(s, c){ draw(c, s.p); } };

  // Воронка (притяжение + закрутка): частицы со всех сторон затягивает по спирали в центр, где копится заряд
  DEF.vortex = { atlas: 'aura',
    init: s => Object.assign(s, { p: [] }),
    update(s, dt, at){
      emit(s.acc, 1, 45, dt, () => { const a = R(0, 6.28), r = R(150, 175);
        spawn(s.p, { x: 180 + Math.cos(a) * r, y: 180 + Math.sin(a) * r, vx: -Math.sin(a) * 140, vy: Math.cos(a) * 140, ax: 180, ay: 180, pull: 900, swirl: 230, kr: 12, drag: 1.6, trail: 8,
          size: R(8, 13), life: 3, cells: [at.map['glow:W0']], add: 1, tc: [[0, [.55, .4, 1]], [.5, [.8, .6, 1]], [1, [1, .95, 1]]], fadeIn: .15, fadeOut: .1, pul: 0 }); });
      step(s.p, dt);
    },
    render(s, c){ const at = c.at, w = wob(s.t * 3, 1);
      sprite(c, 180, 180, 150 + 20 * w, 0, .55, 1, at.map['sglow:W0'], 1, [.6, .45, 1]); sprite(c, 180, 180, 60 + 8 * w, s.t * .8, .9, 1, at.map['star:W0'], 1, [1, .95, 1]);
      draw(c, s.p); } };

  // Салют (дочерние частицы): ракета со следом гаснет → из неё вылетает шар искр со следами, часть искр ещё раз трещит мелкими белыми
  const FW = [[1, .45, .3], [.45, .8, 1], [1, .85, .35], [.75, .45, 1], [.45, 1, .6]];
  DEF.fireworks = { atlas: 'aura',
    init: s => { Object.assign(s, { p: [], fl: [] }); s.acc[1] = .95; },   // первая ракета — сразу
    burst(s, at, p){ const col = FW[(Math.random() * FW.length) | 0], G = at.map['glow:W0'], n = Math.round(46 * EMIT[quality]);
      s.fl.push({ x: p.x, y: p.y, t: 0, col });
      const crack = (q, L) => { for (let i = 0; i < 3; i++){ const a = R(0, 6.28); spawn(L, { x: q.x, y: q.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, size: 8, life: R(.08, .16), cells: [G], add: 1, tint: [1, 1, 1], fadeIn: .01, fadeOut: .6, pul: 0 }); } };
      for (let i = 0; i < n; i++){ const a = i / n * 6.28 + R(-.05, .05), v = R(260, 400) * Math.sqrt(R(.35, 1));
        spawn(s.p, { x: p.x, y: p.y, vx: Math.cos(a) * v + p.vx * .3, vy: Math.sin(a) * v + p.vy * .3, drag: 1.7, grav: 140, trail: 8, size: R(9, 14), life: R(.8, 1.3), cells: [G], add: 1,
          tc: [[0, [1, 1, .95]], [.15, col], [.7, col.map(x => x * .6)], [1, col.map(x => x * .2)]], fadeIn: .01, fadeOut: .35, pul: 0, onDie: Math.random() < .25 ? crack : null }); } },
    update(s, dt, at){
      emit(s.acc, 1, 1.2, dt, () => spawn(s.p, { x: R(110, 250), y: 370, vx: R(-40, 40), vy: R(-580, -500), grav: 380, drag: .3, life: R(.75, .95), trail: 14, size: 12, cells: [at.map['glow:W0']], add: 1,
        tint: [1, .8, .5], fadeIn: .02, fadeOut: .05, pul: 0, onDie: q => this.burst(s, at, q) }));
      step(s.p, dt); for (const f of s.fl) f.t += dt; s.fl = s.fl.filter(f => f.t < .35);
    },
    render(s, c){ for (const f of s.fl){ const k = f.t / .35; sprite(c, f.x, f.y, 90 + 140 * easeOut(k), 0, (1 - k) ** 2 * .8, 1, c.at.map['sglow:W0'], 1, f.col); }
      draw(c, s.p); } };

  /* ── запуск и цикл ── */
  const live = new Set();
  let raf = 0, last = 0, ok = null, idle30 = true;
  // качество: 2 — полное, 1 — среднее, 0 — эконом. Плотность холста, частота частиц, мелкая октава шума.
  // Авто: если кадр дольше 24 мс (меньше ~40 к/с) полторы секунды подряд — ступенью ниже, до конца сессии
  const DPR = [1, 1.25, 1.5], EMIT = [.5, .75, 1];
  let quality = 2, auto = true, slow = 0, maxDpr = 1.5, lastDraw = 0, gap = 16;
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
    gl.uniform2f(loc.res, cv.width, cv.height); gl.uniform1f(loc.tm, (now / 1000) % 200); gl.uniform1f(loc.lq, quality < 2 ? 1 : 0);   // время по кругу: большие числа в шейдере теряют точность — шум «ступенится»
    for (const e of live){
      if (e.el){ if (!e.el.isConnected){ live.delete(e); continue; }
        let r = e.el.getBoundingClientRect(); if (HR) r = { left: r.left - HR.left, top: r.top - HR.top, right: r.right - HR.left, bottom: r.bottom - HR.top, width: r.width, height: r.height };
        e.ox = r.left + r.width / 2; e.oy = r.top + r.height / 2; e.k = r.width / 360; e.clip = r; }
      const vis = !e.clip || (e.clip.bottom > 0 && e.clip.top < h && e.clip.right > 0 && e.clip.left < w);
      if (!vis) continue;                                                      // за экраном — не считаем и не рисуем
      const edt = dt * (e.def.rate || 1); e.s.t += edt; e.s.cycle += edt;   // rate — своя скорость времени эффекта (1.5 — в полтора раза быстрее)
      if (e.stopping){ e.fade = Math.max(0, e.fade - dt / .4); if (!e.fade){ live.delete(e); continue; } }
      if (e.def.period && !e.loop && e.s.cycle >= e.def.period){ live.delete(e); continue; }   // разовый эффект отыграл
      const j0 = performance.now();
      e.def.update(e.s, edt, e.at);
      if (!e.tex.ok) continue;
      e.dt = dt; const sh = e.s.shake || 0; if (sh > .1){ e.s.shake *= Math.pow(.02, dt); } const bx = e.ox, by = e.oy; e.ox += (Math.random() - .5) * sh * e.k; e.oy += (Math.random() - .5) * sh * e.k;
      nq = 0; e.def.render(e.s, e); js += performance.now() - j0; e.ox = bx; e.oy = by;
      if (!nq) continue;
      if (e.clip){ gl.enable(gl.SCISSOR_TEST); gl.scissor(Math.round(e.clip.left * dpr), Math.round((h - e.clip.bottom) * dpr), Math.round(e.clip.width * dpr), Math.round(e.clip.height * dpr)); }
      else gl.disable(gl.SCISSOR_TEST);
      const g = e.def.gfx || {};   // параметры шейдера эффекта: мультяшные ступени, сила искажения, скорость шума, градиент
      gl.uniform4f(loc.gp, g.bands || 0, g.dist || 0, g.speed || .8, RAMP_ROW[g.ramp] || .5 / RAMP_N);
      gl.uniform1f(loc.mbn, e.s.mbn || 0); if (e.s.mbn) gl.uniform3fv(loc.mb, e.s.mb);   // шарики жижи эффекта (метаболы)
      gl.bindTexture(gl.TEXTURE_2D, e.tex.t);
      gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, nq * VF * 4), gl.STREAM_DRAW);
      gl.drawElements(gl.TRIANGLES, nq * 6, gl.UNSIGNED_SHORT, 0); q += nq;
    }
    stats.ms = stats.ms * .95 + (performance.now() - t0) * .05; stats.js = stats.js * .95 + js * .05; stats.quads = q; stats.fps = 1000 / gap; stats.q = quality; stats.over = stats.over * .9 + fill / (w * h) * .1;   // перерисовка: сколько раз в среднем закрашен каждый пиксель экрана
    if (live.size && !document.hidden) raf = requestAnimationFrame(frame);
    else { gl.clear(gl.COLOR_BUFFER_BIT); if (!live.size) cv.style.display = 'none'; }   // простой: холст убираем совсем — пустой слой на весь экран iPhone всё равно склеивает каждый кадр
  }
  const kick = () => { if (!raf && live.size){ last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', kick);

  return {
    names: Object.keys(DEF), stats,
    set base(v){ base = v; },
    set maxDpr(v){ maxDpr = v; },
    // качество: 0 эконом · 1 среднее · 2 полное; auto — снижать само при тормозах
    get quality(){ return quality; }, set quality(v){ quality = Math.max(0, Math.min(2, v | 0)); },
    get auto(){ return auto; }, set auto(v){ auto = !!v; },
    set idle30(v){ idle30 = !!v; },
    // x, y — центр квадрата эффекта на экране (px), size — его сторона; el — привязать к элементу
    play(name, o = {}){
      const def = DEF[name]; if (!def) return null;
      if (ok === null){ ok = setup(); if (typeof S !== 'undefined' && S.lite) quality = 0; } if (!ok) return null;
      const a = FX_ATLAS[def.atlas];
      const e = { def, at: a, tex: texture(def.atlas), s: { t: 0, cycle: 0, acc: {}, o }, loop: !!o.loop, el: o.el || null, fade: 1, stopping: false,
        ox: o.x ?? (host ? host.clientWidth : innerWidth) / 2, oy: o.y ?? (host ? host.clientHeight : innerHeight) / 2, k: (o.size || Math.min(innerWidth, innerHeight)) / 360, clip: null };
      def.init.call(def, e.s, a);
      cv.style.display = ''; live.add(e); kick();
      return { stop(){ e.stopping = true; }, kill(){ live.delete(e); }, alive: () => live.has(e), set(k, v){ e.s[k] = v; } };
    },
    stopAll(){ live.forEach(e => e.stopping = true); },
    // диагностика для Дебага: есть ли WebGL, загрузились ли атласы, видеокарта, сколько частиц в последнем кадре
    info(){ if (ok === null) return 'fx: —'; if (!ok) return 'fx: нет WebGL';
      const T = Object.entries(tex), bad = T.filter(([, v]) => v.err).map(([k]) => k), di = gl.getExtension('WEBGL_debug_renderer_info');
      return `fx: ${T.filter(([, v]) => v.ok).length}/${T.length}${bad.length ? ' ошибка ' + bad.join(',') : ''} · q${quality} · ${stats.quads | 0} · ${di ? String(gl.getParameter(di.UNMASKED_RENDERER_WEBGL)).slice(0, 40) : 'gpu ?'}${gl.isContextLost() ? ' · контекст потерян' : ''}`; },
    // заранее: холст и атлас — чтобы первый эффект (удар молота на первом крафте) не пропал, пока грузится картинка
    preload(atlas){ if (ok === null){ ok = setup(); if (typeof S !== 'undefined' && S.lite) quality = 0; } if (ok) texture(atlas); },
  };
}
const Forge = makeForge(null);
// заранее, но в простое: сразу после старта подготовка (шум, текстуры) подвешивала слабый телефон на 0.2–0.75 с
const forgeIdle = window.requestIdleCallback || (f => setTimeout(f, 2500));
forgeIdle(() => { try { Forge.preload('aura'); } catch(_){} }, { timeout: 4000 });
