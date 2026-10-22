/* Горн — пакет «particles»: сложные частицы — поток, воронка, салют, рассыпание картинки.
   Подключается после src/app/16e-forge.js: <script src="src/forge/particles.js">. В приложение не входит — только то, что нужно игре, живёт в ядре. */
Forge.pack('particles', k => {
  const { R, easeOut, spawn, step, emit, wob, draw, trail, sprite, EMIT, DEF } = k;
  /* ── сложные частицы: приёмы потока, притяжения, следа, дочерних частиц и частиц из картинки ── */

  // точки картинки: сетка n×n, непрозрачные клетки → [x, y, r, g, b] (x, y — от −0.5 до 0.5). Картинка с чужого сервера без CORS
  // прочитаться не может — тогда точек нет и эффект молча пропускается. Кэш по адресу и сетке
  const PIX = {}; k.cleanup.push(() => { for (const key in PIX) delete PIX[key]; });
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
  DEF.dust = { atlas: 'aura', period: 2.6, img: true,   // img обязателен (адрес или <img>)
    presets: { in: { dir: 'in' }, gold: { tint: [1, .8, .3] }, ice: { tint: [.5, .85, 1] } },
    init(s){ const o = s.o || {}; Object.assign(s, { p: [], made: false, dir: o.dir || 'out', box: o.box || 220, T: o.tint || [1, .62, .25], px: pixels(o.img, [32, 44, 52][k.quality]) }); },
    update(s, dt, at){
      if (!s.made){ if (!s.px.ok) { s.cycle = 0; return; } s.made = true; s.cycle = 0;
        const P = s.px.pts, B = s.box, T = s.T, S = B / [32, 44, 52][k.quality] * 1.08, cell = at.map['solid:W0'];   // сплошные клетки встык — пока стоят, это сама картинка
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
    presets: { ember: { s: { tc: [[0, [1, .95, .7]], [.5, [1, .55, .15]], [1, [.6, .12, .05]]] } }, frost: { s: { tc: [[0, [1, 1, 1]], [.5, [.6, .85, 1]], [1, [.3, .5, 1]]] } },
      toxic: { s: { tc: [[0, [.9, 1, .7]], [.5, [.4, 1, .35]], [1, [.1, .5, .2]]] } } },
    init: s => Object.assign(s, { p: [], tc: [[0, [.7, 1, 1]], [.5, [.5, .55, 1]], [1, [.45, .2, .85]]] }),
    update(s, dt, at){
      emit(s.acc, 1, 18, dt, () => spawn(s.p, { x: 180 + R(-140, 140), y: R(120, 340), vy: -40, flow: 85, fz: 1.4, grav: -45, trail: 14, size: R(14, 22), life: R(2.2, 3.2), cells: [at.map['glow:W0']], add: 1,
        tc: s.tc, fadeIn: .12, fadeOut: .4, pul: .2, pf: R(5, 9) }));
      step(s.p, dt);
    },
    render(s, c){ draw(c, s.p); } };

  // Воронка (притяжение + закрутка): частицы со всех сторон затягивает по спирали в центр, где копится заряд
  DEF.vortex = { atlas: 'aura',
    presets: { gold: { s: { tc: [[0, [1, .6, .2]], [.5, [1, .85, .4]], [1, [1, 1, .9]]], core: [1, .75, .3] } }, blood: { s: { tc: [[0, [.6, .05, .1]], [.5, [1, .25, .2]], [1, [1, .85, .8]]], core: [1, .2, .15] } },
      teal: { s: { tc: [[0, [.1, .6, .6]], [.5, [.3, 1, .9]], [1, [.9, 1, 1]]], core: [.3, 1, .85] } } },
    init: s => Object.assign(s, { p: [], tc: [[0, [.55, .4, 1]], [.5, [.8, .6, 1]], [1, [1, .95, 1]]], core: [.6, .45, 1] }),
    update(s, dt, at){
      emit(s.acc, 1, 45, dt, () => { const a = R(0, 6.28), r = R(150, 175);
        spawn(s.p, { x: 180 + Math.cos(a) * r, y: 180 + Math.sin(a) * r, vx: -Math.sin(a) * 140, vy: Math.cos(a) * 140, ax: 180, ay: 180, pull: 900, swirl: 230, kr: 12, drag: 1.6, trail: 8,
          size: R(8, 13), life: 3, cells: [at.map['glow:W0']], add: 1, tc: s.tc, fadeIn: .15, fadeOut: .1, pul: 0 }); });
      step(s.p, dt);
    },
    render(s, c){ const at = c.at, w = wob(s.t * 3, 1);
      sprite(c, 180, 180, 150 + 20 * w, 0, .55, 1, at.map['sglow:W0'], 1, s.core); sprite(c, 180, 180, 60 + 8 * w, s.t * .8, .9, 1, at.map['star:W0'], 1, [1, .95, 1]);
      draw(c, s.p); } };

  // Салют (дочерние частицы): ракета со следом гаснет → из неё вылетает шар искр со следами, часть искр ещё раз трещит мелкими белыми
  const FW = [[1, .45, .3], [.45, .8, 1], [1, .85, .35], [.75, .45, 1], [.45, 1, .6]];
  DEF.fireworks = { atlas: 'aura',
    init: s => { Object.assign(s, { p: [], fl: [] }); s.acc[1] = .95; },   // первая ракета — сразу
    presets: { gold: { s: { pal: [[1, .85, .35], [1, .7, .25], [1, .95, .6]] } }, ice: { s: { pal: [[.5, .85, 1], [.8, .95, 1], [.45, .6, 1]] } }, party: {} },
    burst(s, at, p){ const P = s.pal || FW, col = P[(Math.random() * P.length) | 0], G = at.map['glow:W0'], n = Math.round(46 * EMIT[k.quality]);
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

  Object.assign(k, { pixels });
});
