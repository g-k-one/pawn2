/* Горн — пакет «motion»: удары и щиты второго круга по набору LoL (realtimevfx.com/t/20834: Leona, Lulu, Mundo, Morgana, Rakan, Ekko, Kindred)
   и моушн-дизайну (рваная клякса, шлейф, нарезка, неоновая жижа), плюс раскрытие рангов игры (tier: base → jackpot).
   Подключается после пакетов image и hits: формы режима 23 и слой картинки берутся оттуда. В приложение не входит. */
Forge.pack('motion', k => {
  const { R, PI, easeOut, spawn, step, draw, sprite, band, arcBand, BX, BW, pic, SHP, HITPAL, hitPresets, DEF } = k;
  const G = at => at.map['glow:W0'], SG = at => at.map['sglow:W0'];
  // всплеск формы: пружинит (перелёт 1.15 → 1), потом сжимается; k — доля жизни 0…1
  const pop = (k, peak = .12) => k < peak ? easeOut(k / peak) * 1.15 : 1.15 - .15 * Math.min(1, (k - peak) / .15) - .35 * Math.max(0, (k - .45) / .55);
  const twinkles = (s, at, n, P, x = 180, y = 180, v0 = 140, v1 = 320) => { for (let i = 0; i < n; i++){ const a = R(0, 6.28), v = R(v0, v1);
    spawn(s.p, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: R(0, 1.6), vr: R(-3, 3), size: R(18, 34), drag: 3, life: R(.45, .8), cells: [0], mode: 23, ero: [[0, .7]], heat: [[0, 0]], ph: 4,
      add: 1, tint: P[0], fadeIn: .02, fadeOut: .5, pul: 0, sc: [[0, .4], [.2, 1.1], [1, .6]] }); } };
  const shards = (s, n, P, x = 180, y = 180) => { for (let i = 0; i < n; i++){ const a = R(0, 6.28), v = R(280, 560);
    spawn(s.p, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, rot: a + PI / 2, size: R(16, 28), stretch: 2.4, drag: 3.5, grav: 300, life: R(.35, .6), cells: [0], mode: 23.1, ero: [[0, .38]], add: .6, tint: P[1], fadeIn: .01, fadeOut: .4, pul: 0 }); } };
  const speedLines = (s, at, n, P, x = 180, y = 180) => { for (let i = 0; i < n; i++){ const a = R(0, 6.28), v = R(550, 950);
    spawn(s.p, { x: x + Math.cos(a) * 40, y: y + Math.sin(a) * 40, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(9, 15), speedStretch: .012, orient: true, drag: 5, life: R(.25, .4), cells: [G(at)], add: 1, tint: P[0], fadeIn: .01, fadeOut: .5, pul: 0 }); } };
  // прямая лента от a к b, растёт за долю g (0…1), ширина w, к хвосту тоньше
  const blade = (c, ax, ay, bx, by, g, w, alpha, tint) => { const n = 10; for (let i = 0; i < n; i++){ const u = i / (n - 1) * g; BX[i * 2] = ax + (bx - ax) * u; BX[i * 2 + 1] = ay + (by - ay) * u; BW[i] = w * Math.sin(Math.min(1, i / (n - 1) * 1.2) * PI * .5); }
    band(c, BX, BW, n, alpha, 1, tint, .9, 1.6); };

  // крит: два клинка крест-накрест (Leona) → стоп-кадр, колючая мультяшная звезда (Mundo) с перелётом, крест-вспышка, ромбы, линии скорости, звёздочки
  DEF.crit = { atlas: 'aura', period: 1.15, presets: hitPresets,
    init: s => Object.assign(s, { p: [], hit: false, pal: HITPAL.fire }),
    update(s, dt, at){ const P = s.pal; if (!s.hit && s.cycle >= .17){ s.hit = true; s.shake = 11; s.freeze = .06; shards(s, 10, P); speedLines(s, at, 16, P); twinkles(s, at, 6, P); } step(s.p, dt); },
    render(s, c){ const at = c.at, t = s.cycle, P = s.pal;
      if (t < .3){ const g1 = Math.min(1, t / .09), g2 = Math.min(1, Math.max(0, (t - .05) / .09)), f = t < .17 ? 1 : 1 - (t - .17) / .13;
        blade(c, 70, 70, 290, 290, easeOut(g1), 34, f, P[0]); if (g2 > 0) blade(c, 290, 70, 70, 290, easeOut(g2), 34, f, P[0]); }
      if (t >= .17){ const k = (t - .17) / .95;
        if (k < .4) sprite(c, 180, 180, 330 * (1 + .5 * k), 0, (1 - k / .4) ** 2, 1, SG(at), 1, P[1]);
        if (k < 1){ const p = pop(k); sprite(c, 180, 180, 300 * p, .2 + k * .5, Math.min(1, (1 - k) * 2), .15, 0, 1, P[1], 0, SHP(4, .8, .15, 8.37));
          sprite(c, 180, 180, 150 * p, -.3 - k * .8, Math.min(1, (1 - k) * 2), .5, 0, 1, P[0], 0, SHP(4, .6, 0, 4.11));
          if (k < .5) sprite(c, 180, 180, 460 * (1 - .4 * k), 0, (1 - k / .5) ** 1.5, 1, 0, 1, P[0], 0, SHP(2, .035, .9, 0)); } }
      draw(c, s.p); } };

  // мультяшный хит (Lulu, Mundo): жёлтая колючая звезда с обводкой выскакивает с перелётом, внутри белая, вокруг разлетаются звёздочки и кольцо
  DEF.toonhit = { atlas: 'aura', period: .9, presets: hitPresets,
    init: s => Object.assign(s, { p: [], hit: false, pal: HITPAL.gold }),
    update(s, dt, at){ if (!s.hit){ s.hit = true; s.shake = 6; s.freeze = .04; twinkles(s, at, 7, s.pal, 180, 180, 180, 360); } step(s.p, dt); },
    render(s, c){ const at = c.at, k = s.cycle / .9, P = s.pal, p = pop(k, .1);
      if (k < .5){ const e = k / .5; sprite(c, 180, 180, 120 + 300 * easeOut(e), 0, (1 - e) ** 2, 1, 0, 1, P[0], 0, SHP(3, .04, 0, 0)); }
      sprite(c, 180, 180, 250 * p, .15, Math.min(1, (1 - k) * 2.2), 0, 0, 1, P[1], 0, SHP(4, .9, .05, 8.71));
      sprite(c, 180, 180, 120 * p, -.25, Math.min(1, (1 - k) * 2.2), .4, 0, 1, [1, 1, 1], 0, SHP(4, .7, 0, 6.29));
      draw(c, s.p); } };

  // щит из сот (Morgana): сфера-сетка шестиугольников, края светятся, соты вспыхивают; удары — волна; цикл
  DEF.hexshield = { atlas: 'aura', presets: { arcane: { s: { tint: [.6, .35, 1] } }, blood: { s: { tint: [1, .25, .2] } }, frost: { s: { tint: [.45, .8, 1] } }, gold: { s: { tint: [1, .75, .3] } } },
    init: s => Object.assign(s, { tint: [.55, .4, 1], rp: [], next: .9 }),
    update(s, dt){ s.next -= dt; if (s.hitAt != null || (s.o.hits !== false && s.next <= 0)){ s.rp.push({ a: s.hitAt ?? R(0, 6.28), t: 0 }); s.hitAt = null; s.next = R(.8, 1.4); s.shake = 3; }
      for (const r of s.rp) r.t += dt * 1.6; s.rp = s.rp.filter(r => r.t < 1); },
    render(s, c){ const t = s.t, pop1 = t < .5 ? 1 + .16 * Math.sin(Math.min(1, t / .5) * PI) * (1 - t / .5) : 1, sz = 300 * Math.min(1, easeOut(t / .28)) * pop1, r = s.rp[0];
      sprite(c, 180, 180, sz * 1.15, 0, .35 * Math.min(1, t / .2), 1, SG(c.at), 1, s.tint);
      sprite(c, 180, 180, sz, 0, Math.min(1, t / .15), .8, 0, 1, s.tint, 0, SHP(8, 4.2, r ? r.t : 0, r ? r.a : 0)); } };

  // кольцо-солнце (Rakan): обод с шипами наружу вырастает, медленно крутится, шипы дышат, угольки поднимаются; цикл (бафф, аура выигрыша)
  DEF.sunring = { atlas: 'aura', presets: hitPresets,
    init: s => Object.assign(s, { p: [], pal: HITPAL.fire }),
    update(s, dt, at){ const P = s.pal; k.emit(s.acc, 1, 10, dt, () => { const a = R(0, 6.28), r = R(80, 110);
        spawn(s.p, { x: 180 + Math.cos(a) * r, y: 180 + Math.sin(a) * r, vx: Math.cos(a) * 20, vy: -R(30, 70), size: R(6, 11), life: R(.8, 1.4), sway: 10, cells: [G(at)], add: 1, tc: [[0, P[0]], [.5, P[1]], [1, P[2]]], fadeIn: .1, fadeOut: .5, pul: .25, pf: 9 }); });
      step(s.p, dt); },
    render(s, c){ const t = s.t, g = Math.min(1, easeOut(t / .4)), P = s.pal, br = .5 + .5 * Math.sin(t * 2.4);
      sprite(c, 180, 180, 330 * g, 0, .18, 1, SG(c.at), 1, P[1]);
      sprite(c, 180, 180, 330 * g, t * .25, Math.min(1, t / .2), 1, 0, 1, P[1], 0, SHP(9, .55 + .2 * br, 0, 16));
      sprite(c, 180, 180, 300 * g, -t * .4, .5 * Math.min(1, t / .2), 1, 0, 1, P[0], 0, SHP(9, .25, 0, 8));
      draw(c, s.p); } };

  // пунктирное кольцо на земле (Ekko): два пунктира крутятся навстречу, раз в 1.2 с из центра расходится волна; цикл
  DEF.dashring = { atlas: 'aura', presets: hitPresets,
    init: s => Object.assign(s, { pal: HITPAL.frost, w: [] }),
    update(s, dt){ if ((s.w.length === 0 || s.w[s.w.length - 1] > 1.2)) s.w.push(0); for (let i = 0; i < s.w.length; i++) s.w[i] += dt; s.w = s.w.filter(x => x < 1.6); },
    render(s, c){ const t = s.t, P = s.pal, g = Math.min(1, easeOut(t / .35)), Y = 205, SY = .38;
      sprite(c, 180, Y, 310 * g, 0, .3, 1, SG(c.at), SY, P[1]);
      sprite(c, 180, Y, 300 * g, 0, 1, 1, 0, SY, P[0], 0, SHP(9, .08, 1, 24));   // крутится в шейдере: поворот квадрата наклонил бы сплюснутый круг
      sprite(c, 180, Y, 230 * g, 0, .8, 1, 0, SY, P[1], 0, SHP(9, -.13, 1, 12));
      for (const w of s.w){ const k = w / 1.6; sprite(c, 180, Y, 60 + 300 * easeOut(k), 0, (1 - k) ** 1.5 * .9, 1, 0, SY, P[0], 0, SHP(3, .03, 0, 0)); } } };

  // рваная клякса (моушн-дизайн): белая колючая клякса с рваным краем выбивается, в центре — тёмная дыра, разлетаются штрихи,
  // по сторонам — две «каракули» цветом, треугольники; всё за 1 с
  const INK = [[1, .38, .1], [.88, .12, .55], [.55, 1, .3]];
  DEF.inkburst = { atlas: 'aura', period: 1, presets: { warm: {}, cold: { s: { ink: [[.3, .7, 1], [.6, .3, 1], [1, .9, .3]] } } },
    init: s => Object.assign(s, { p: [], hit: false, ink: INK, sc: [0, 1].map(() => ({ a: R(0, 6.28), r: R(60, 120), f: R(2, 4), ph: R(0, 6) })) }),
    update(s, dt, at){ const C = s.ink;
      if (!s.hit){ s.hit = true; s.shake = 8; s.freeze = .05;
        for (let i = 0; i < 12; i++){ const a = R(0, 6.28), v = R(500, 900);   // штрихи
          spawn(s.p, { x: 180, y: 180, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(8, 14), speedStretch: .016, orient: true, drag: 6, life: R(.25, .45), cells: [G(at)], add: .3, tint: [1, 1, 1], fadeIn: .01, fadeOut: .4, pul: 0 }); }
        for (let i = 0; i < 9; i++){ const a = R(0, 6.28), v = R(140, 320);   // треугольники-ромбы цветом
          spawn(s.p, { x: 180, y: 180, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: R(0, 6.28), vr: R(-6, 6), size: R(12, 20), stretch: 1.4, drag: 2.5, life: R(.5, .9), cells: [0], mode: 23.1, ero: [[0, .8]], add: 0, tint: C[i % 3], fadeIn: .01, fadeOut: .3, pul: 0 }); } }
      step(s.p, dt); },
    render(s, c){ const t = s.cycle, C = s.ink, k = Math.min(1, t / .55), p = t < .07 ? easeOut(t / .07) * 1.1 : 1.1 - .1 * Math.min(1, (t - .07) / .1);
      if (k < 1){ sprite(c, 180, 180, 330 * p, .3, 1 - Math.max(0, (k - .6) / .4), 0, 0, 1, [1, 1, 1], 0, SHP(4, .35, .9, 14.53));
        sprite(c, 180, 180, 330 * p * (.25 + .5 * easeOut(k)), 0, 1, 0, 0, 1, [.05, .03, .06], 0, SHP(5, 1, 0, 0)); }
      // каракули: тонкие ленты по синусоиде, рисуются головой вперёд и гаснут
      s.sc.forEach((q, j) => { const g = Math.min(1, Math.max(0, (t - .04 - j * .06) / .35)), n = 24; if (g <= 0 || t > .95) return;
        for (let i = 0; i < n; i++){ const u = i / (n - 1) * g, an = q.a + u * 4.2; BX[i * 2] = 180 + Math.cos(an) * (q.r + 60 * u) + Math.sin(u * q.f * 6 + q.ph) * 14; BX[i * 2 + 1] = 180 + Math.sin(an) * (q.r + 60 * u) * .8; BW[i] = 5; }
        band(c, BX, BW, n, 1 - Math.max(0, (t - .6) / .35), .6, C[j], .2, 1.8); });
      draw(c, s.p); } };

  // неоновая жижа (видео 3): капли плавают и сливаются, по краю перелив бирюза → салатовый → жёлтый → сирень, внутри тёмный туман и светлые точки; цикл
  const GO = 600;
  DEF.neongoo = { atlas: 'aura',
    init: s => Object.assign(s, { p: [], mb: new Float32Array(72), mbn: 0, b: Array.from({ length: 12 }, (_, i) => ({ a: R(0, 6.28), r: R(20, 105), w: R(.25, .6) * (i % 2 ? 1 : -1), s: R(11, 24), ph: R(0, 6) })) }),
    update(s, dt, at){ let n = 0; for (const b of s.b){ b.a += b.w * dt; const rr = b.r + Math.sin(s.t * .9 + b.ph) * 25, x = 180 + Math.cos(b.a) * rr, y = 180 + Math.sin(b.a) * rr * .85, r = b.s * (1 + .15 * Math.sin(s.t * 2 + b.ph));
        s.mb[n * 3] = (x - 180) / GO + .5; s.mb[n * 3 + 1] = (y - 180) / GO + .5; s.mb[n * 3 + 2] = r / GO; n++; } s.mbn = n;
      // светлые точки внутри (боке): плавают от центров капель и тают
      k.emit(s.acc, 2, 9, dt, () => { const b = s.b[(Math.random() * s.b.length) | 0], rr = b.r + Math.sin(s.t * .9 + b.ph) * 25, a = R(0, 6.28), d = R(0, b.s * .8);
        spawn(s.p, { x: 180 + Math.cos(b.a) * rr + Math.cos(a) * d, y: 180 + Math.sin(b.a) * rr * .85 + Math.sin(a) * d, vx: R(-8, 8), vy: R(-14, -2), size: R(5, 12), life: R(1.2, 2.4), cells: [0], mode: 23.5,
          add: .7, tint: [[.45, .65, 1], [.75, .5, 1], [1, .55, .9], [.5, .9, 1]][(Math.random() * 4) | 0], fadeIn: .25, fadeOut: .35, pul: 0 }); });
      k.emit(s.acc, 1, 2.5, dt, () => { const a = R(0, 6.28), r = R(95, 125); spawn(s.p, { x: 180 + Math.cos(a) * r, y: 180 + Math.sin(a) * r * .85, size: R(16, 26), life: .6, cells: [0], mode: 23, ero: [[0, .85]], heat: [[0, 0]], ph: 4,
        add: 1, tint: [.9, .9, 1], fadeIn: .3, fadeOut: .5, pul: 0, sc: [[0, .3], [.5, 1], [1, .3]] }); });
      step(s.p, dt); },
    render(s, c){ const m = s.mb, q = s.rect || (s.rect = [0, 0, 0, 0]); q[0] = q[1] = 1; q[2] = q[3] = 0; let r2 = 0;
      for (let i = 0; i < s.mbn; i++){ r2 += m[i * 3 + 2] ** 2; q[0] = Math.min(q[0], m[i * 3]); q[1] = Math.min(q[1], m[i * 3 + 1]); q[2] = Math.max(q[2], m[i * 3]); q[3] = Math.max(q[3], m[i * 3 + 1]); }
      const e = Math.sqrt(r2 * 1.3 / .35); for (let i = 0; i < 4; i++) q[i] = Math.min(1, Math.max(0, q[i] + (i < 2 ? -e : e)));
      sprite(c, 180, 180, GO, 0, Math.min(1, s.t / .3), 0, G(c.at), 1, null, 0, [19.4, 0, 0, 0, -1], q); draw(c, s.p); } };

  // нарезка (видео 1): картинка уходит полосами вбок с разъездом цветов и белыми кромками (out) или собирается из полос (in)
  DEF.slice = { atlas: 'aura', img: true, period: 1.1, presets: { out: {}, in: { dir: 'in' } },
    init(){}, update(){},
    render(s, c){ let z = Math.min(1, s.cycle / 1); if (s.o.dir === 'in') z = 1 - z; pic(c, 180, 180, s.W, s.H, [24.6, 0, z, s.o.rows || 18], .9); } };

  // шлейф (моушн-дизайн): картинка влетает слева с эхом-шлейфом, приземляется с приплюскиванием, вокруг — штрихи
  DEF.smear = { atlas: 'aura', img: true, period: 1.2,
    init: s => Object.assign(s, { p: [], hit: false }),
    update(s, dt, at){ if (!s.hit && s.cycle > .22){ s.hit = true; s.shake = 6; for (let i = 0; i < 8; i++){ const a = PI + R(-.6, .6), v = R(300, 600);
        spawn(s.p, { x: 180 - s.W * .4, y: 180 + R(-s.H * .3, s.H * .3), vx: Math.cos(a) * v, vy: Math.sin(a) * v * .3, size: R(8, 12), speedStretch: .02, orient: true, drag: 5, life: R(.25, .4), cells: [G(at)], add: 1, tint: [1, 1, 1], fadeIn: .01, fadeOut: .5, pul: 0 }); } }
      step(s.p, dt); },
    render(s, c){ const t = s.cycle, W = s.W, H = s.H, X = u => -260 + 440 * easeOut(Math.min(1, u / .22));
      if (t < .3) for (let i = 5; i >= 1; i--){ const u = Math.max(0, t - i * .025); pic(c, X(u), 180, W * (1 + i * .04), H * (1 - i * .03), [24, 0, 0, 0], 0, .16 * (6 - i) / 5); }
      const k = Math.max(0, (t - .22) / .6), sq = k > 0 && k < 1 ? .14 * Math.exp(-k * 5) * Math.cos(k * 22) : 0;
      pic(c, X(t) + (t < .22 ? 0 : -W * sq * .5), 180 + H * sq * .5, W * (1 + sq), H * (1 - sq), [24, 0, 0, 0]); draw(c, s.p); } };

  // копьё (Kindred): длинный луч прошивает цель — голова яркая, хвост тонкий; удар — крест и искры; луч тает тонкой нитью
  DEF.spear = { atlas: 'aura', period: 1, presets: hitPresets,
    init: s => Object.assign(s, { p: [], hit: false, pal: HITPAL.frost }),
    update(s, dt, at){ if (!s.hit && s.cycle > .12){ s.hit = true; s.shake = 5; s.freeze = .04; twinkles(s, at, 6, s.pal, 180, 180, 100, 260); shards(s, 5, s.pal); } step(s.p, dt); },
    render(s, c){ const t = s.cycle, P = s.pal, g = Math.min(1, t / .12), hx = -20 + 220 * easeOut(g), fade = t < .12 ? 1 : Math.max(0, 1 - (t - .12) / .5);
      if (fade > 0){ const n = 12; for (let i = 0; i < n; i++){ const u = i / (n - 1); BX[i * 2] = -40 + (hx + 40) * u; BX[i * 2 + 1] = 200 - 20 * u; BW[i] = 4 + 26 * u ** 2 * (t < .12 ? 1 : .4 + .6 * fade); }
        band(c, BX, BW, n, fade, 1, P[1], .9, 1.6); sprite(c, hx, 180, 80 * (t < .12 ? 1 : fade), 0, fade, 1, G(c.at), 1, P[0]); }
      if (t >= .12){ const k = (t - .12) / .6; if (k < 1){ sprite(c, 180, 180, 320 * (1 - .3 * k), 0, (1 - k) ** 1.6, 1, 0, 1, P[0], 0, SHP(2, .03, .7, 0));
        sprite(c, 180, 180, 70 + 220 * easeOut(k), 0, (1 - k) ** 1.5, 1, 0, 1, P[1], 0, SHP(3, .03, 0, 0)); } }
      draw(c, s.p); } };

  // ранги игры (tier): чем дороже ранг, тем больше слоёв, ярче и дольше — по шкале важности Riot. База → Удача → Мега → Ультра → Джекпот
  const TIER = { base: [[.92, .95, 1], [.62, .7, .85], [.25, .3, .4]], luck: [[.9, 1, .9], [.4, .95, .5], [.08, .35, .15]], mega: [[.9, .9, 1], [.55, .5, 1], [.15, .1, .45]],
    ultra: [[1, .92, .85], [1, .45, .2], [.45, .08, .03]], jackpot: [[1, 1, .85], [1, .8, .25], [.5, .3, .02]] };
  const LV = { base: 0, luck: 1, mega: 2, ultra: 3, jackpot: 4 };
  DEF.tier = { atlas: 'aura', period: 2.4, presets: Object.fromEntries(Object.keys(TIER).map(n => [n, { tier: n }])),
    init: s => { const n = s.o.tier || 'mega'; Object.assign(s, { p: [], hit: false, L: LV[n], pal: TIER[n], bursts: [] }); },
    update(s, dt, at){ const L = s.L, P = s.pal, T = .1 + L * .06;
      if (!s.hit && s.cycle >= T){ s.hit = true; s.shake = 3 + L * 3; if (L >= 3) s.freeze = .04 + (L - 3) * .03;
        for (let i = 0; i < 10 + L * 8; i++){ const a = R(0, 6.28), v = R(160, 360 + L * 80);
          spawn(s.p, { x: 180, y: 180, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, size: R(7, 12), speedStretch: .009, orient: true, drag: 2, grav: 260, life: R(.5, .9 + L * .1), cells: [G(at)], add: 1, tc: [[0, P[0]], [.4, P[1]], [1, P[2]]], fadeIn: .01, fadeOut: .4, pul: 0 }); }
        if (L >= 1) twinkles(s, at, 3 + L * 2, P);
        if (L >= 2) speedLines(s, at, 6 + L * 3, P);
        if (L >= 3) for (let i = 0; i < 3 + L; i++) spawn(s.p, { x: 180 + R(-30, 30), y: 185, vy: -R(600, 900), size: R(14, 26), stretch: 9, life: R(.3, .5), drag: 3, cells: [0], mode: 23.6, ero: [[0, .25]], add: 1, tint: P[0], fadeIn: .02, fadeOut: .6, pul: 0, sc: [[0, .6], [.3, 1], [1, .7]] });
        if (L >= 4){ for (let i = 0; i < 26; i++){ const a = -PI / 2 + R(-1.3, 1.3), v = R(60, 200);
            spawn(s.p, { x: 180 + R(-20, 20), y: 190, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(7, 12), life: R(1.2, 2), drag: 1.5, grav: -50, sway: 14, cells: [G(at)], add: 1, tc: [[0, P[0]], [.6, P[1]], [1, P[2]]], fadeIn: .05, fadeOut: .5, pul: .3, pf: 8 }); }
          s.bursts = [.35, .6, .85].map((d, i) => ({ d, x: 180 + [-90, 95, -10][i], y: 180 + [-70, -40, 60][i], done: false })); } }
      for (const b of s.bursts) if (!b.done && s.cycle > T + b.d){ b.done = true; twinkles(s, at, 6, P, b.x, b.y, 120, 260); }
      step(s.p, dt); },
    render(s, c){ const at = c.at, t = s.cycle, L = s.L, P = s.pal, T = .1 + L * .06;
      if (t < T){ const k = t / T; sprite(c, 180, 180, 60 + 80 * k, 0, k * .9, 1, G(at), 1, P[1]); if (L >= 2) sprite(c, 180, 180, 220 * (1 - k * .5), t * 3, k * .6, 1, 0, 1, P[0], 0, SHP(3, .02, 0, 0)); }
      else { const k = (t - T) / (1.1 + L * .25), e = easeOut(Math.min(1, k * 4));
        if (k < 1){ sprite(c, 180, 180, (240 + L * 60) * (1 + .3 * k), 0, (1 - k) ** 2 * (.6 + L * .1), 1, SG(at), 1, P[1]);
          sprite(c, 180, 180, 90 + 150 * e, 0, (1 - k) ** 3, 1, G(at), 1, P[0]);
          sprite(c, 180, 180, (120 + L * 70) * easeOut(Math.min(1, k * 2.5)), 0, (1 - k) ** 1.5, 1, 0, 1, P[0], 0, SHP(3, .03, 0, 0));
          if (L >= 2) sprite(c, 180, 180, (190 + L * 30) * pop(k, .1), k * .8 + .4, Math.min(1, (1 - k) * 1.6), .4, 0, 1, P[1], 0, SHP(0, .75, .6, 4));
          if (L >= 3){ sprite(c, 180, 180, 520 * (1 - .3 * k), 0, (1 - k) ** 1.6, 1, 0, 1, P[1], 0, SHP(2, .035, .8, 0)); sprite(c, 180, 180, 330 * e, k, (1 - k) * .9, .7, 0, 1, P[1], 0, SHP(9, .5, 0, 16)); }
          if (L >= 4){ sprite(c, 180, 180, 360 * pop(k, .08), .2, Math.min(1, (1 - k) * 2), .15, 0, 1, P[1], 0, SHP(4, .85, .2, 12.37)); sprite(c, 180, 180, 170 * pop(k, .08), -.2, Math.min(1, (1 - k) * 2), .5, 0, 1, P[0], 0, SHP(4, .7, 0, 8.13)); } }
        for (const b of s.bursts) if (b.done){ const q = (t - T - b.d) / .4; if (q < 1) sprite(c, b.x, b.y, 80 + 120 * easeOut(q), 0, (1 - q) ** 2, 1, SG(at), 1, P[1]); } }
      draw(c, s.p); } };

  /* ── старые эффекты заново (раньше — пакет classic): мелкие и мутные стали чёткими формами, с ударом и затуханием ── */
  // попадание: белое ядро, 4-лучевая звезда, кольцо, линии скорости, ромбы — коротко (0.6 с), годится на любой тап
  DEF.hit = { atlas: 'aura', period: .65, presets: hitPresets,
    init: s => Object.assign(s, { p: [], hit: false, pal: HITPAL.arcane }),
    update(s, dt, at){ if (!s.hit){ s.hit = true; s.shake = 5; s.freeze = .03; speedLines(s, at, 9, s.pal); shards(s, 5, s.pal); } step(s.p, dt); },
    render(s, c){ const at = c.at, k = s.cycle / .65, P = s.pal;
      if (k < .3) sprite(c, 180, 180, 220 * (1 + k), 0, (1 - k / .3) ** 2 * .8, 1, SG(at), 1, P[1]);
      if (k < .12) sprite(c, 180, 180, 110, 0, 1 - k / .12, 1, G(at), 1, [1, 1, 1]);
      sprite(c, 180, 180, 200 * pop(k, .1), k * 1.5, Math.min(1, (1 - k) * 2), 1, 0, 1, P[0], 0, SHP(0, .8, 0, 4));
      sprite(c, 180, 180, 60 + 220 * easeOut(k), 0, (1 - k) ** 1.5, 1, 0, 1, P[1], 0, SHP(3, .035, 0, 0));
      draw(c, s.p); } };

  // взмах: широкий мягкий серп и тонкое яркое ядро по одной дуге, по ходу — искры; в конце — вспышка на кончике
  DEF.slash = { atlas: 'aura', period: .75, presets: hitPresets,
    init: s => Object.assign(s, { p: [], pal: HITPAL.frost }),
    update(s, dt, at){ const t = s.cycle, P = s.pal; if (t < .2) k.emit(s.acc, 1, 90, dt, () => { const h = -2.4 + 2.6 * easeOut(t / .18), x = 180 + Math.cos(h) * 140, y = 190 + Math.sin(h) * 100;
        spawn(s.p, { x, y, vx: -Math.sin(h) * R(80, 220), vy: Math.cos(h) * R(80, 220), size: R(5, 9), speedStretch: .01, orient: true, drag: 3, grav: 200, life: R(.25, .5), cells: [G(at)], add: 1, tint: P[0], fadeIn: .01, fadeOut: .5, pul: 0 }); });
      step(s.p, dt); },
    render(s, c){ const t = s.cycle, P = s.pal, g = easeOut(Math.min(1, t / .18)), h = -2.4 + 2.6 * g, f = t < .18 ? 1 : Math.max(0, 1 - (t - .18) / .3);
      if (f > 0){ arcBand(c, 180, 190, 140, 100, 0, h - 2.2, h, 95, f * .75, 1, P[1], .4); arcBand(c, 180, 190, 140, 100, 0, h - 1.6, h, 28, f, 1, P[0], 1); }
      if (t > .16){ const q = (t - .16) / .4; if (q < 1) sprite(c, 180 + Math.cos(.2) * 140, 190 + Math.sin(.2) * 100, 150 * pop(q, .15), q, (1 - q) ** 1.5, 1, 0, 1, P[0], 0, SHP(0, .85, 0, 4)); }
      draw(c, s.p); } };

  // звёздная волна: кольцо 4-лучевых звёзд расходится и крутится, за ним тонкое кольцо и боке
  DEF.starwave = { atlas: 'aura', period: 1.3, presets: hitPresets,
    init: s => Object.assign(s, { p: [], hit: false, pal: HITPAL.frost }),
    update(s, dt, at){ if (!s.hit){ s.hit = true; s.shake = 3; for (let i = 0; i < 10; i++){ const a = R(0, 6.28), v = R(40, 160);
        spawn(s.p, { x: 180, y: 180, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(10, 24), life: R(.7, 1.2), drag: 1.5, cells: [0], mode: 23.5, add: .6, alpha: .6, tint: s.pal[1], fadeIn: .05, fadeOut: .5, pul: 0 }); } }
      step(s.p, dt); },
    render(s, c){ const k = s.cycle / 1.3, P = s.pal, e = easeOut(k), r = 20 + 150 * e;
      if (k < .25) sprite(c, 180, 180, 200, 0, (1 - k / .25) ** 2, 1, SG(c.at), 1, P[1]);
      sprite(c, 180, 180, r * 2.3, 0, (1 - k) ** 1.3, 1, 0, 1, P[1], 0, SHP(3, .02, 0, 0));
      for (let i = 0; i < 12; i++){ const a = i / 12 * 6.28 + k * 1.2; sprite(c, 180 + Math.cos(a) * r, 180 + Math.sin(a) * r, 48 * (1 - k * .6) * (i % 2 ? .7 : 1), k * 3, (1 - k) ** 1.2, 1, 0, 1, P[0], 0, SHP(0, .8, 0, 4)); }
      draw(c, s.p); } };

  // блёстки (фон): чёткие 4-лучевые звёздочки вспыхивают в случайных местах (перелёт и угасание), между ними плывут мелкие боке; цикл
  DEF.sparkle = { atlas: 'aura', presets: { gold: { s: { tc: [1, .85, .45] } }, ice: { s: { tc: [.6, .85, 1] } }, rose: { s: { tc: [1, .6, .85] } } },
    init: s => Object.assign(s, { p: [], tc: [1, .95, .85] }),
    update(s, dt, at){ k.emit(s.acc, 1, 9, dt, () => { const a = R(0, 6.28), r = R(0, 130);
        spawn(s.p, { x: 180 + Math.cos(a) * r, y: 180 + Math.sin(a) * r, rot: R(-.3, .3), size: R(26, 56), life: R(.5, .9), cells: [0], mode: 23, ero: [[0, .85]], heat: [[0, 0]], ph: 4, add: 1, tint: s.tc, fadeIn: .2, fadeOut: .5, pul: 0, sc: [[0, .2], [.25, 1.1], [.4, 1], [1, .3]] }); });
      k.emit(s.acc, 2, 3, dt, () => spawn(s.p, { x: 180 + R(-140, 140), y: 180 + R(-120, 120), vx: R(-8, 8), vy: R(-16, -4), size: R(5, 10), life: R(1.5, 2.5), cells: [0], mode: 23.5, add: .7, alpha: .5, tint: s.tc, fadeIn: .3, fadeOut: .4, pul: 0 }));
      step(s.p, dt); },
    render(s, c){ draw(c, s.p); } };

  // звёздный всплеск: в центре выскакивает звезда, во все стороны летят звёздочки со следами и гаснут
  DEF.starburst = { atlas: 'aura', period: 1.2, presets: hitPresets,
    init: s => Object.assign(s, { p: [], hit: false, pal: HITPAL.arcane }),
    update(s, dt, at){ const P = s.pal; if (!s.hit){ s.hit = true; s.shake = 4; for (let i = 0; i < 14; i++){ const a = i / 14 * 6.28 + R(-.15, .15), v = R(260, 420);
        spawn(s.p, { x: 180, y: 180, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.4, grav: 60, trail: 8, rot: R(0, 1.5), vr: R(-4, 4), size: R(16, 26), life: R(.6, .9), cells: [0], mode: 23, ero: [[0, .8]], heat: [[0, 0]], ph: 4,
          add: 1, tint: P[0], fadeIn: .01, fadeOut: .45, pul: 0 }); } }
      step(s.p, dt); },
    render(s, c){ const k = s.cycle / 1.2, P = s.pal;
      if (k < .3) sprite(c, 180, 180, 260 * (1 + k), 0, (1 - k / .3) ** 2, 1, SG(c.at), 1, P[1]);
      sprite(c, 180, 180, 170 * pop(k, .1), k * 2, Math.min(1, (1 - k) * 2), 1, 0, 1, P[0], 0, SHP(0, .75, 0, 4));
      draw(c, s.p); } };

  // рамка с блёстками (аватар): тонкое светящееся кольцо, по нему бегут три звёздочки со следами, иногда на ободе вспыхивает звезда; цикл
  DEF.sparkring = { atlas: 'aura', presets: { gold: { s: { pal: HITPAL.gold } }, frost: { s: { pal: HITPAL.frost } }, toxic: { s: { pal: HITPAL.toxic } } },
    init: s => Object.assign(s, { p: [], pal: HITPAL.arcane, sat: [0, 2.1, 4.2].map(a => ({ a })) }),
    update(s, dt, at){ const P = s.pal;
      for (const q of s.sat){ q.a += dt * 1.6; spawn(s.p, { x: 180 + Math.cos(q.a) * 130, y: 180 + Math.sin(q.a) * 130, size: 15, life: .45, cells: [G(at)], add: 1, tint: P[0], fadeIn: .01, fadeOut: .9, pul: 0, sc: [[0, 1], [1, .2]] }); }
      k.emit(s.acc, 1, 1.4, dt, () => { const a = R(0, 6.28); spawn(s.p, { x: 180 + Math.cos(a) * 130, y: 180 + Math.sin(a) * 130, size: R(30, 48), life: .6, cells: [0], mode: 23, ero: [[0, .85]], heat: [[0, 0]], ph: 4,
        add: 1, tint: P[0], fadeIn: .2, fadeOut: .5, pul: 0, sc: [[0, .2], [.25, 1.1], [1, .3]] }); });
      step(s.p, dt); },
    render(s, c){ const g = Math.min(1, easeOut(s.t / .4)), P = s.pal;
      sprite(c, 180, 180, 300 * g, 0, .9, 1, 0, 1, P[1], 0, SHP(3, .018, 0, 0)); sprite(c, 180, 180, 330 * g, 0, .25, 1, SG(c.at), 1, P[1]);
      draw(c, s.p); } };
});
