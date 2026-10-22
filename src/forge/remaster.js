/* Горн — пакет «remaster»: старые эффекты пакета classic, собранные заново на чётких формах (23) и объёмных предметах (26).
   Имена те же — подключённый после classic, пакет заменяет старые версии. Нужны hits и matter. В приложение не входит. */
Forge.pack('remaster', k => {
  const { R, PI, easeOut, spawn, step, draw, sprite, seg, zig, DEF, SHP, bit, glint } = k;
  const G = at => at.map['glow:W0'], SG = at => at.map['sglow:W0'];
  const shade = (c, m) => [c[0] * m, c[1] * m, c[2] * m];   // светлее/темнее одним множителем — оттенок не плывёт
  const pop = (q, pk = .12) => q < pk ? easeOut(q / pk) * 1.15 : 1.15 - .15 * Math.min(1, (q - pk) / .15) - .35 * Math.max(0, (q - .45) / .55);
  const ring = (c, x, y, d, a, col, th = .03, sy = 1) => sprite(c, x, y, d, 0, a, 1, 0, sy, col, 0, SHP(3, th, 0, 0));
  const star = (c, x, y, d, rot, a, col, sharp = .8) => sprite(c, x, y, d, rot, a, 1, 0, 1, col, 0, SHP(0, sharp, 0, 4));
  const shock = (s, n, col, x = 180, y = 180, v0 = 200, v1 = 600, at) => { for (let i = 0; i < n; i++){ const a = R(0, 6.28), v = R(v0, v1);
    spawn(s.p, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(6, 11), speedStretch: .01, orient: true, drag: 2.5, grav: 300, life: R(.4, .8), cells: [G(at)], add: 1,
      tc: [[0, [1, 1, .95]], [.25, col], [1, col.map(v => v * .3)]], fadeIn: .01, fadeOut: .4, pul: 0 }); } };
  const puff = (L, o) => bit(L, 'puff', Object.assign({ f3: false, rot: R(0, 6.28), vr: R(-.6, .6), add: 0, fadeIn: .08, fadeOut: .5, pul: 0 }, o));

  // ── монеты из сундука: фонтан монет и камней вверх, кувыркаются, падают и отскакивают, блестят; золотая вспышка у основания
  DEF.coins = { atlas: 'aura', period: 3, imgOpt: true,   // img — своя монетка
    init: s => Object.assign(s, { p: [], c: [], hit: false }),
    update(s, dt, at){ if (!s.hit && s.cycle > .08){ s.hit = true; s.shake = 6;
        for (let i = 0; i < 30; i++){ const a = -PI / 2 + R(-.6, .6), v = R(420, 760);
          bit(s.c, i % 6 ? 'coin' : 'gem', { img: !!s.o.img, x: 180 + R(-14, 14), y: 300, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: .5, grav: 1200, floor: 322, bounce: R(.3, .45), size: i % 6 ? R(22, 34) : R(24, 32), stretch: i % 6 ? 1 : 1.25,
            life: R(2.2, 2.8), w3x: R(8, 15) * (Math.random() < .5 ? -1 : 1), w3y: R(-3, 3), vr: R(-3, 3), tint: i % 6 ? shade([1, .78, .3], R(.92, 1.05)) : [[.3, .65, 1], [.85, .25, .9], [.25, .95, .55]][i % 3], fadeOut: .15 }); }
        shock(s, 24, [1, .8, .35], 180, 300, 150, 400, at); }
      for (const c of s.c) if (Math.random() < dt * 2.5 && Math.abs(Math.cos(c.t3x) * Math.cos(c.t3y)) > .9) glint(s.p, c.x, c.y, .8);
      step(s.c, dt); step(s.p, dt); },
    render(s, c){ const q = (s.cycle - .08) / .7; if (q > 0 && q < 1){ sprite(c, 180, 300, 360 * (.6 + .4 * easeOut(q)), 0, (1 - q) ** 2, 1, SG(c.at), .55, [1, .75, .3]); ring(c, 180, 305, 80 + 260 * easeOut(q), (1 - q) ** 1.5, [1, .9, .6], .03, .35); }
      draw(c, s.c); draw(c, s.p); } };

  // ── конфетти: две хлопушки снизу, бумажки кувыркаются и порхают вниз (предельная скорость), ленты-серпантин, блики
  const CONF = [[1, .43, .77], [1, .81, .33], [.38, .81, 1], [.51, .91, .59], [.69, .52, 1], [1, .5, .35]];
  DEF.confetti = { atlas: 'aura', period: 3.4,
    init: s => Object.assign(s, { p: [], b: [], hit: false }),
    update(s, dt){ if (!s.hit && s.cycle > .06){ s.hit = true; s.shake = 4;
        for (const [x, dir] of [[20, 1], [340, -1]]) for (let i = 0; i < 46; i++){ const a = -PI / 2 + dir * R(.2, .7), v = R(500, 950);
          bit(s.b, 'paper', { x, y: 330, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.4, grav: 380, sway: R(20, 45), size: R(9, 14), stretch: R(.5, .8), life: R(2.6, 3.2),
            w3x: R(6, 14), w3y: R(4, 12), vr: R(-4, 4), tint: CONF[(Math.random() * CONF.length) | 0], fadeOut: .12 }); } }
      for (const b of s.b) if (b.vy > 140) b.vy = 140;   // бумажка не падает быстрее — порхает
      for (const b of s.b) if (Math.random() < dt * .4) glint(s.p, b.x, b.y, .5);
      step(s.b, dt); step(s.p, dt); },
    render(s, c){ const q = (s.cycle - .06) / .4; if (q > 0 && q < 1) for (const x of [26, 334]){ sprite(c, x, 320, 200 * easeOut(q), 0, (1 - q) ** 2 * .8, 1, SG(c.at), 1, [1, .9, .7]); }
      draw(c, s.b); draw(c, s.p); } };

  // ── заряд: энергия стягивается спиралями со следами, ядро растёт и пульсирует всё чаще, вокруг бьют мелкие разряды, кольца сжимаются → выброс:
  //    вспышка, колючая звезда, две волны, искры
  DEF.charge = { atlas: 'aura', period: 2.6, presets: { arcane: { s: { col: [.75, .45, 1] } }, frost: { s: { col: [.45, .8, 1] } }, toxic: { s: { col: [.45, 1, .4] } }, fire: { s: { col: [1, .5, .15] } } },
    init: s => Object.assign(s, { p: [], hit: false, col: [1, .45, .85], arcs: [], next: 0 }),
    update(s, dt, at){ const T = 1.6, t = s.cycle, C = s.col;
      if (t < T){ const q = t / T; s.shake = q * q * 4;
        k.emit(s.acc, 1, 30 + q * 60, dt, () => { const a = R(0, 6.28), r = R(140, 175); spawn(s.p, { x: 180 + Math.cos(a) * r, y: 180 + Math.sin(a) * r, vx: -Math.sin(a) * 160, vy: Math.cos(a) * 160, ax: 180, ay: 180, pull: 1100, swirl: 280, kr: 16, drag: 1.8,
          trail: 7, size: R(6, 10), life: 2, cells: [G(at)], add: 1, tc: [[0, C], [1, [1, 1, 1]]], fadeIn: .1, fadeOut: .1, pul: 0 }); });
        s.next -= dt; if (s.next <= 0){ s.next = R(.05, .2) * (1 - q * .7); const a = R(0, 6.28), r = 30 + q * 20; s.arcs.push({ p: zig(180 + Math.cos(a) * r, 180 + Math.sin(a) * r, 180 + Math.cos(a + R(-.6, .6)) * (r + R(40, 80)), 180 + Math.sin(a + R(-.6, .6)) * (r + R(40, 80)), .35, 3), t: 0 }); } }
      else if (!s.hit){ s.hit = true; s.shake = 12; s.freeze = .05; shock(s, 40, C, 180, 180, 300, 800, at); }
      for (const a of s.arcs) a.t += dt; s.arcs = s.arcs.filter(a => a.t < .09); step(s.p, dt); },
    render(s, c){ const at = c.at, t = s.cycle, T = 1.6, C = s.col;
      if (t < T){ const q = t / T, beat = .5 + .5 * Math.sin(t * (6 + q * 30)), sz = 30 + 70 * q * q;
        sprite(c, 180, 180, sz * 4, 0, .35 + q * .4, 1, SG(at), 1, C); sprite(c, 180, 180, sz * (1 + .15 * beat), 0, 1, 1, G(at), 1, [1, 1, 1]); star(c, 180, 180, sz * 1.8 * (1 + .2 * beat), t * 2, .5 + .5 * q, C);
        for (let i = 0; i < 2; i++){ const w = (q * 2.5 + i * .5) % 1; ring(c, 180, 180, 330 * (1 - w) + sz, w * (.4 + q * .5), C, .02); }
        for (const a of s.arcs) for (let i = 1; i < a.p.length; i++) seg(c, a.p[i - 1][0], a.p[i - 1][1], a.p[i][0], a.p[i][1], 3, 1, 1, at.map['solid:W0'], [1, 1, 1]); }
      else { const q = (t - T) / .9; if (q < 1){ sprite(c, 180, 180, 460, 0, (1 - q) ** 2.5, 1, SG(at), 1, C); if (q < .1) sprite(c, 180, 180, 220, 0, 1 - q / .1, 1, G(at), 1, [1, 1, 1]);
        sprite(c, 180, 180, 300 * pop(q, .1), .3, Math.min(1, (1 - q) * 2), .3, 0, 1, C, 0, SHP(4, .85, .1, 10.29)); ring(c, 180, 180, 80 + 380 * easeOut(Math.min(1, q * 2)), (1 - q) ** 1.5, [1, 1, 1]); ring(c, 180, 180, 60 + 300 * easeOut(q), (1 - q) ** 2 * .7, C, .05); } }
      draw(c, s.p); } };

  // ── дым (цикл): клубы поднимаются, растут, медленно вращаются и тают; светлый верх, тёмный низ; снизу — тлеющий отсвет
  DEF.smoke = { atlas: 'aura', presets: { dark: { s: { col: [.22, .2, .22] } }, magic: { s: { col: [.55, .4, .85] } }, toxic: { s: { col: [.35, .6, .3] } } },
    init: s => Object.assign(s, { p: [], col: [.5, .47, .48] }),
    update(s, dt){ k.emit(s.acc, 1, 10, dt, () => puff(s.p, { x: 180 + R(-22, 22), y: 320, vx: R(-14, 14), vy: -R(50, 90), drag: .4, flow: 25, fz: 1.2, grow: 2.6, size: R(60, 90), life: R(3, 4),
        alpha: R(.55, .8), tint: shade(s.col, R(.85, 1.15)), fadeIn: .12, fadeOut: .55 }));
      step(s.p, dt); },
    render(s, c){ sprite(c, 180, 325, 160, 0, .35 + .1 * Math.sin(s.t * 3), 1, SG(c.at), .4, [1, .5, .2]); draw(c, s.p); } };

  // ── ударная волна по земле: вспышка-крест, сплюснутые кольца расходятся, клубы пыли катятся в стороны, камешки отскакивают
  DEF.shock = { atlas: 'aura', period: 2, presets: { magic: { s: { col: [.7, .55, 1], dust: [.55, .45, .7] } }, ice: { s: { col: [.6, .85, 1], dust: [.75, .85, .95] } } },
    init: s => Object.assign(s, { p: [], hit: false, col: [1, .85, .6], dust: [.62, .55, .48] }),
    update(s, dt, at){ if (!s.hit){ s.hit = true; s.shake = 10; s.freeze = .04;
        for (let i = 0; i < 16; i++){ const dir = i % 2 ? 1 : -1, v = R(120, 340);
          puff(s.p, { x: 180 + dir * R(5, 30), y: 250 + R(-6, 6), vx: dir * v, vy: -R(10, 50), drag: 2.4, grow: 1.6, size: R(40, 70), life: R(1, 1.6), alpha: .75, tint: shade(s.dust, R(.85, 1.1)) }); }
        for (let i = 0; i < 12; i++){ const a = -PI / 2 + R(-1.2, 1.2), v = R(250, 520);
          bit(s.p, 'ash', { x: 180, y: 250, vx: Math.cos(a) * v, vy: Math.sin(a) * v, grav: 1400, floor: 262, bounce: .35, drag: .6, size: R(9, 16), life: R(1, 1.4), w3x: R(-8, 8), w3y: R(-8, 8), tint: [3, 2.8, 2.6], fadeOut: .2 }); }
        shock(s, 18, s.col, 180, 248, 300, 600, at); }
      step(s.p, dt); },
    render(s, c){ const q = s.cycle / 1.2, C = s.col; if (q < 1){ sprite(c, 180, 250, 380, 0, (1 - q) ** 2.5, 1, SG(c.at), .4, C);
        if (q < .3) sprite(c, 180, 245, 420 * (1 - q), 0, (1 - q / .3) ** 1.5, 1, 0, 1, [1, 1, 1], 0, SHP(2, .025, .4, 0));
        ring(c, 180, 252, 60 + 420 * easeOut(q), (1 - q) ** 1.4, [1, 1, 1], .025, .3); ring(c, 180, 252, 40 + 300 * easeOut(Math.min(1, q * 1.3)), (1 - q) ** 2, C, .05, .3); }
      draw(c, s.p); } };

  // ── мерцание (аура): звёздное поле в овале — точки мерцают, иногда вспыхивает крупная звезда с крестом лучей
  DEF.twinkle = { atlas: 'aura', presets: { gold: { s: { col: [1, .85, .45] } }, rose: { s: { col: [1, .6, .85] } } },
    init: s => Object.assign(s, { p: [], col: [.55, .8, 1] }),
    update(s, dt, at){ const C = s.col;
      k.emit(s.acc, 1, 26, dt, () => { const a = R(0, 6.28), r = Math.sqrt(Math.random()); spawn(s.p, { x: 180 + Math.cos(a) * r * 150, y: 180 + Math.sin(a) * r * 95, size: R(8, 16), life: R(.8, 1.6), cells: [G(at)], add: 1, tint: C, fadeIn: .4, fadeOut: .5, pul: .4, pf: R(6, 12) }); });
      k.emit(s.acc, 2, 2.6, dt, () => { const a = R(0, 6.28), r = Math.sqrt(Math.random()), x = 180 + Math.cos(a) * r * 140, y = 180 + Math.sin(a) * r * 85;
        spawn(s.p, { x, y, size: R(70, 110), life: .7, cells: [0], mode: 23.2, ero: [[0, .02]], heat: [[0, .7]], add: 1, tint: C, fadeIn: .3, fadeOut: .6, pul: 0, sc: [[0, .3], [.3, 1], [1, .4]] }); glint(s.p, x, y, 1, [1, 1, 1]); });
      step(s.p, dt); },
    render(s, c){ sprite(c, 180, 180, 360, 0, .3, 1, SG(c.at), .62, s.col); draw(c, s.p); } };

  // ── дух (аура): призрачные клубы светятся и текут вверх по вихрю, в центре мягкое ядро, огоньки со следами
  DEF.spirit = { atlas: 'aura', presets: { violet: { s: { col: [.65, .45, 1] } }, ember: { s: { col: [1, .5, .2] } } },
    init: s => Object.assign(s, { p: [], col: [.3, 1, .85] }),
    update(s, dt, at){ const C = s.col;
      k.emit(s.acc, 1, 10, dt, () => puff(s.p, { x: 180 + R(-50, 50), y: 230 + R(-20, 20), vy: -R(30, 70), flow: 45, fz: 1.4, grow: 1.3, size: R(50, 80), life: R(1.8, 2.6), add: 1, alpha: .3, tint: C }));
      k.emit(s.acc, 2, 8, dt, () => spawn(s.p, { x: 180 + R(-60, 60), y: 240, vy: -R(40, 90), flow: 70, fz: 1.6, trail: 10, size: R(7, 11), life: R(1.4, 2.2), cells: [G(at)], add: 1, tint: C.map(v => (v + 1) / 2), fadeIn: .15, fadeOut: .4, pul: .2, pf: 8 }));
      step(s.p, dt); },
    render(s, c){ const w = .5 + .5 * Math.sin(s.t * 2); sprite(c, 180, 200, 260, 0, .35 + .15 * w, 1, SG(c.at), 1, s.col); sprite(c, 180, 200, 70 + 10 * w, 0, .6, 1, G(c.at), 1, [1, 1, 1]); draw(c, s.p); } };

  // ── облако (аура): пухлое облако из клубов медленно клубится, подсвечено изнутри, вокруг искорки
  DEF.cloud = { atlas: 'aura', presets: { storm: { s: { col: [.45, .5, .65], glow: [.5, .7, 1] } }, sunset: { s: { col: [1, .75, .65], glow: [1, .6, .3] } } },
    init: s => { Object.assign(s, { p: [], q: [], col: [.85, .9, 1], glow: [.4, .65, 1] }); for (let i = 0; i < 9; i++) s.q.push({ x: R(-80, 80), y: R(-25, 25), r: R(55, 90), ph: R(0, 6), rot: R(0, 6) }); },
    update(s, dt, at){ k.emit(s.acc, 1, 6, dt, () => glint(s.p, 180 + R(-120, 120), 180 + R(-60, 60), R(.5, .9), [1, 1, 1])); step(s.p, dt); },
    render(s, c){ const t = s.t; sprite(c, 180, 185, 320, 0, .45, 1, SG(c.at), .6, s.glow);
      for (const q of s.q){ const x = 180 + q.x + Math.sin(t * .4 + q.ph) * 6, y = 180 + q.y + Math.cos(t * .5 + q.ph) * 4, sz = q.r * (1 + .05 * Math.sin(t + q.ph));
        sprite(c, x, y, sz, q.rot + t * .1, .95, .15, 0, 1, s.col, 0, [26.7, 0, 1, q.ph]); }
      draw(c, s.p); } };

  // ── магический круг (аура): кольцо-солнце и пунктир крутятся навстречу, по ободу бегут звёзды-руны, свет дышит, искры поднимаются
  DEF.ring = { atlas: 'aura', presets: { gold: { s: { col: [1, .78, .3] } }, blood: { s: { col: [1, .25, .2] } }, frost: { s: { col: [.45, .8, 1] } } },
    init: s => Object.assign(s, { p: [], col: [.5, .55, 1] }),
    update(s, dt, at){ const C = s.col; k.emit(s.acc, 1, 10, dt, () => { const a = R(0, 6.28); spawn(s.p, { x: 180 + Math.cos(a) * 125, y: 180 + Math.sin(a) * 125, vy: -R(20, 50), size: R(5, 9), life: R(.8, 1.4), cells: [G(at)], add: 1, tint: C, fadeIn: .1, fadeOut: .5, pul: .3, pf: 9 }); });
      step(s.p, dt); },
    render(s, c){ const t = s.t, C = s.col, g = Math.min(1, easeOut(t / .5));
      sprite(c, 180, 180, 360 * g, 0, .3, 1, SG(c.at), 1, C); sprite(c, 180, 180, 300 * g, t * .3, 1, 1, 0, 1, C, 0, SHP(9, .28, 0, 24)); sprite(c, 180, 180, 220 * g, 0, .9, 1, 0, 1, C, 0, SHP(9, -.15, 1, 18));
      for (let i = 0; i < 6; i++){ const a = i / 6 * 6.28 - t * .6; star(c, 180 + Math.cos(a) * 108 * g, 180 + Math.sin(a) * 108 * g, 26, -a, .9, [1, 1, 1]); }
      draw(c, s.p); } };

  // ── комбо: три быстрых удара в разных местах, каждый больше (×1 ×2 ×3), затем финальный — колючая звезда, волна, искры
  DEF.combo = { atlas: 'aura', period: 2, presets: { fire: { s: { col: [1, .5, .15] } }, arcane: { s: { col: [.7, .4, 1] } } },
    init: s => Object.assign(s, { p: [], col: [.35, .8, 1], h: [{ t: .05, x: 120, y: 150, k: .7 }, { t: .35, x: 245, y: 170, k: .85 }, { t: .62, x: 165, y: 230, k: 1 }], fin: 1, done: new Set() }),
    update(s, dt, at){ const C = s.col; s.h.forEach((h, i) => { if (!s.done.has(i) && s.cycle >= h.t){ s.done.add(i); s.shake = 4 + i * 2; s.freeze = .03; shock(s, 10 + i * 4, C, h.x, h.y, 200, 450, at); } });
      if (!s.done.has(9) && s.cycle >= s.fin){ s.done.add(9); s.shake = 12; s.freeze = .06; shock(s, 40, C, 180, 180, 300, 800, at); for (let i = 0; i < 8; i++) glint(s.p, 180 + R(-100, 100), 180 + R(-100, 100), 1.1); }
      step(s.p, dt); },
    render(s, c){ const t = s.cycle, C = s.col;
      for (const h of s.h){ const q = (t - h.t) / .35; if (q < 0 || q > 1) continue; sprite(c, h.x, h.y, 200 * h.k, 0, (1 - q) ** 2, 1, SG(c.at), 1, C); star(c, h.x, h.y, 150 * h.k * pop(q, .12), q * 2, Math.min(1, (1 - q) * 2), [1, 1, 1]); ring(c, h.x, h.y, 40 + 160 * h.k * easeOut(q), (1 - q) ** 1.5, C); }
      const q = (t - s.fin) / .9; if (q > 0 && q < 1){ sprite(c, 180, 180, 480, 0, (1 - q) ** 2.4, 1, SG(c.at), 1, C); sprite(c, 180, 180, 320 * pop(q, .1), .2, Math.min(1, (1 - q) * 2), .3, 0, 1, C, 0, SHP(4, .85, .12, 12.13));
        sprite(c, 180, 180, 150 * pop(q, .1), -.2, Math.min(1, (1 - q) * 2), 1, 0, 1, [1, 1, 1], 0, SHP(4, .7, 0, 8.77)); ring(c, 180, 180, 80 + 380 * easeOut(Math.min(1, q * 2)), (1 - q) ** 1.5, [1, 1, 1]); sprite(c, 180, 180, 500 * (1 - .3 * q), 0, (1 - q) ** 2, 1, 0, 1, [1, 1, 1], 0, SHP(2, .03, .8, 0)); }
      draw(c, s.p); } };

  // ── галактика (фон подбора, цикл): звёзды по двум спиральным рукавам медленно вращаются, яркое ядро, редкие вспышки
  DEF.swirl = { atlas: 'aura', presets: { gold: { s: { col: [1, .75, .35], col2: [1, .45, .2] } }, teal: { s: { col: [.3, 1, .85], col2: [.25, .5, 1] } } },
    init: s => { Object.assign(s, { p: [], st: [], col: [.85, .5, 1], col2: [.4, .5, 1] }); for (let i = 0; i < 160; i++){ const arm = i % 2, d = Math.pow(Math.random(), .7);
      s.st.push({ d: 15 + d * 155, a: arm * PI + d * 4.2 + R(-.35, .35) * (1 - d * .5), sz: R(6, 12) * (1.3 - d * .6), ph: R(0, 6), c: Math.random() < .5 }); } },
    update(s, dt){ k.emit(s.acc, 1, 1.5, dt, () => { const q = s.st[(Math.random() * s.st.length) | 0], a = q.a + s.t * .25; glint(s.p, 180 + Math.cos(a) * q.d, 180 + Math.sin(a) * q.d * .8, .8, [1, 1, 1]); }); step(s.p, dt); },
    render(s, c){ const t = s.t, at = c.at; sprite(c, 180, 180, 400, 0, .45, 1, SG(at), .8, s.col2); sprite(c, 180, 180, 170, 0, .85, 1, SG(at), .8, s.col); sprite(c, 180, 180, 50, 0, .9, 1, G(at), 1, [1, 1, 1]);
      for (const q of s.st){ const a = q.a + t * .25 * (1.6 - q.d / 170); sprite(c, 180 + Math.cos(a) * q.d, 180 + Math.sin(a) * q.d * .8, q.sz * (.8 + .3 * Math.sin(t * 3 + q.ph)), 0, .9, 1, G(at), 1, q.c ? s.col : s.col2); }
      draw(c, s.p); } };

  // ── раскрытие: самоцвет в сиянии — свет дышит всё быстрее, лучи крутятся, трясёт → вспышка (мягкая, не на весь экран) → камень выскакивает
  //    с перелётом и поворачивается к нам, блики, звёзды разлетаются, лучи медленно гаснут
  DEF.reveal = { atlas: 'aura', period: 3.4, presets: { gold: { s: { col: [1, .78, .3] } }, emerald: { s: { col: [.25, .95, .55] } }, ruby: { s: { col: [1, .3, .35] } } },
    init: s => Object.assign(s, { p: [], hit: false, col: [.75, .45, 1] }),
    update(s, dt, at){ const T = 1.3, C = s.col; if (s.cycle < T) s.shake = (s.cycle / T) ** 2 * 5;
      else if (!s.hit){ s.hit = true; s.shake = 10; s.freeze = .05; shock(s, 30, C, 180, 180, 250, 650, at);
        for (let i = 0; i < 12; i++){ const a = R(0, 6.28), v = R(160, 360); spawn(s.p, { x: 180, y: 180, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.2, trail: 7, rot: R(0, 1.5), vr: R(-4, 4), size: R(18, 28), life: R(.7, 1),
          cells: [0], mode: 23, ero: [[0, .8]], heat: [[0, 0]], ph: 4, add: 1, tint: [1, 1, 1], fadeIn: .01, fadeOut: .4, pul: 0 }); } }
      if (s.hit && Math.random() < dt * 2.5) glint(s.p, 180 + R(-40, 40), 180 + R(-50, 30), 1.1, [1, 1, 1]);
      step(s.p, dt); },
    render(s, c){ const at = c.at, t = s.cycle, T = 1.3, C = s.col;
      if (t < T){ const q = t / T, b = .5 + .5 * Math.sin(t * (5 + q * 25)); sprite(c, 180, 180, 200 + 120 * q, 0, .4 + .4 * q * b, 1, SG(at), 1, C); sprite(c, 180, 180, 330, t * (1 + q * 3), .25 + q * .5, 1, 0, 1, C, 0, SHP(9, .5 + q * .3, 0, 20));
        sprite(c, 180, 180, 120 * (.8 + .2 * b), t * .5, .9, 0, 0, 1.25, C.map(v => v * .7), 0, [26.4, 0, .4, 0]); }
      else { const q = (t - T) / 2.1, e = Math.min(1, (t - T) / .5);
        if (q < .12) sprite(c, 180, 180, 360, 0, (1 - q / .12) * .9, 1, SG(at), 1, [1, 1, 1]);
        sprite(c, 180, 180, 360, -t * .3, (1 - q) ** 1.5 * .5, 1, 0, 1, C, 0, SHP(9, .7, 0, 24)); sprite(c, 180, 180, 300 * (1 - q * .2), 0, (1 - q) * .45, 1, SG(at), 1, C);
        ring(c, 180, 180, 100 + 300 * easeOut(Math.min(1, q * 4)), Math.max(0, 1 - q * 4) ** 1.5, [1, 1, 1]);
        const turn = (1 - easeOut(e)) * 7, sc = pop(Math.min(1, (t - T) / 1.2), .15) / 1.15;
        sprite(c, 180, 180, 150 * Math.max(.2, sc), 0, 1, 0, 0, 1.25, C, 0, [26.4, 0, Math.cos(turn), 0]); }
      draw(c, s.p); } };

  // ── раскрытие с гранями: сфера из сот собирается, трескается и разлетается осколками-самоцветами — внутри камень
  DEF.hexreveal = { atlas: 'aura', period: 3, presets: { gold: { s: { col: [1, .78, .3] } }, frost: { s: { col: [.45, .8, 1] } } },
    init: s => Object.assign(s, { p: [], hit: false, col: [.65, .45, 1] }),
    update(s, dt, at){ const T = 1.1, C = s.col; if (s.cycle < T) s.shake = (s.cycle / T) ** 3 * 6;
      else if (!s.hit){ s.hit = true; s.shake = 12; s.freeze = .06;
        for (let i = 0; i < 26; i++){ const a = R(0, 6.28), v = R(250, 600); bit(s.p, 'gem', { x: 180 + Math.cos(a) * 60, y: 180 + Math.sin(a) * 60, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 1.8, grav: 500, size: R(12, 22), stretch: 1.3, life: R(.8, 1.3),
          w3x: R(-12, 12), w3y: R(-12, 12), add: .3, tint: shade(C, R(.9, 1.2)), fadeOut: .4 }); }
        shock(s, 24, C, 180, 180, 250, 600, at); }
      step(s.p, dt); },
    render(s, c){ const at = c.at, t = s.cycle, T = 1.1, C = s.col;
      if (t < T){ const q = t / T; sprite(c, 180, 180, 300 * easeOut(Math.min(1, q * 2.5)), 0, Math.min(1, q * 3), .8, 0, 1, C, 0, SHP(8, 4 + q * 2, 0, 0)); sprite(c, 180, 180, 360, 0, .2 + q * .4, 1, SG(at), 1, C); }
      else { const q = (t - T) / 1.9; if (q < .12) sprite(c, 180, 180, 360, 0, (1 - q / .12), 1, SG(at), 1, [1, 1, 1]);
        sprite(c, 180, 180, 280, 0, (1 - q) * .4, 1, SG(at), 1, C); ring(c, 180, 180, 120 + 300 * easeOut(Math.min(1, q * 3)), Math.max(0, 1 - q * 3), [1, 1, 1]);
        sprite(c, 180, 180, 140 * pop(Math.min(1, q * 1.4), .15) / 1.15, 0, 1, 0, 0, 1.25, C, 0, [26.4, 0, Math.cos((1 - easeOut(Math.min(1, q * 3))) * 6), 0]); }
      draw(c, s.p); } };

  // ── энергосфера (цикл): пузырь-щит с энергией внутри, вокруг по орбитам бегут искры со следами, редкие разряды по поверхности
  DEF.sphere = { atlas: 'aura', presets: { arcane: { s: { col: [.65, .4, 1] } }, frost: { s: { col: [.45, .8, 1] } }, toxic: { s: { col: [.45, 1, .4] } } },
    init: s => Object.assign(s, { p: [], col: [1, .35, .25], o: [0, 1, 2].map(i => ({ a: i * 2.1, tilt: R(-.8, .8), sp: R(2, 3.2) })), arc: null, next: .5 }),
    update(s, dt, at){ for (const o of s.o){ o.a += o.sp * dt; const x = 180 + Math.cos(o.a) * 135, y = 180 + Math.sin(o.a) * 135 * Math.cos(o.tilt) + Math.cos(o.a) * 40 * Math.sin(o.tilt);
        spawn(s.p, { x, y, size: 12, life: .3, cells: [G(at)], add: 1, tint: s.col.map(v => (v + 1) / 2), fadeIn: .01, fadeOut: .9, pul: 0, sc: [[0, 1], [1, .2]] }); }
      s.next -= dt; if (s.next <= 0){ s.next = R(.3, .9); const a = R(0, 6.28), b = a + R(.4, .9); s.arc = { p: zig(180 + Math.cos(a) * 110, 180 + Math.sin(a) * 110, 180 + Math.cos(b) * 110, 180 + Math.sin(b) * 110, .5, 3), t: 0 }; }
      if (s.arc){ s.arc.t += dt; if (s.arc.t > .1) s.arc = null; } step(s.p, dt); },
    render(s, c){ const t = s.t, g = Math.min(1, easeOut(t / .4)); sprite(c, 180, 180, 330 * g, 0, .3, 1, SG(c.at), 1, s.col); sprite(c, 180, 180, 250 * g, 0, 1, .85, 0, 1, s.col, 0, SHP(7, 0, 0, 0));
      if (s.arc) for (let i = 1; i < s.arc.p.length; i++) seg(c, s.arc.p[i - 1][0], s.arc.p[i - 1][1], s.arc.p[i][0], s.arc.p[i][1], 3, 1, 1, c.at.map['solid:W0'], [1, 1, 1]);
      draw(c, s.p); } };

  /* ── взрыв заново: точка набухает → стоп-кадр, вспышка и крест → огненный шар из клубов (остывает белый → жёлтый → оранжевый → тёмно-красный),
     две волны, искры и обломки-угольки по дугам со следами → поверх поднимается тёмный дым, снизу — отсвет */
  DEF.boom = { atlas: 'aura', period: 2.8, presets: { blue: { s: { fire: [[.9, .97, 1], [.45, .75, 1], [.15, .3, .9], [.04, .06, .2]] } }, toxic: { s: { fire: [[.95, 1, .85], [.6, 1, .3], [.15, .6, .1], [.04, .12, .03]] } } },
    init: s => Object.assign(s, { p: [], f: [], sm: [], hit: false, fire: [[1, .97, .85], [1, .72, .25], [.95, .3, .06], [.25, .05, .03]] }),
    update(s, dt, at){ const T = .14, F = s.fire;
      if (s.cycle < T) s.shake = s.cycle / T * 3;
      else if (!s.hit){ s.hit = true; s.shake = 14; s.freeze = .05;
        for (let i = 0; i < 11; i++){ const a = R(0, 6.28), v = R(40, 240);   // огненный шар — клубы
          puff(s.f, { x: 180 + Math.cos(a) * 12, y: 190 + Math.sin(a) * 12, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .8 - 50, drag: 2.6, grav: -40, grow: 1.2, size: R(70, 110), life: R(.7, 1.15), add: 1,
            tc: [[0, F[0]], [.2, F[1]], [.55, F[2]], [1, F[3]]], alpha: .95, fadeIn: .02, fadeOut: .45 }); }
        for (let i = 0; i < 9; i++){ const a = R(0, 6.28), v = R(30, 120);   // дым — появляется следом, поднимается
          puff(s.sm, { x: 180 + Math.cos(a) * 30, y: 180 + Math.sin(a) * 25, vx: Math.cos(a) * v, vy: -R(40, 90), wait: R(.15, .4), drag: 1.2, grav: -50, grow: 1.5, size: R(70, 100), life: R(1.8, 2.4),
            alpha: .75, tint: shade([.34, .3, .29], R(.8, 1.2)), fadeIn: .15, fadeOut: .5 }); }
        for (let i = 0; i < 12; i++){ const a = -PI / 2 + R(-1.5, 1.5), v = R(350, 650);   // обломки-угольки со следами
          bit(s.p, 'ember', { f3: false, x: 180, y: 190, vx: Math.cos(a) * v, vy: Math.sin(a) * v, grav: 900, drag: .8, trail: 9, size: R(8, 13), life: R(.8, 1.2), add: 1, tint: F[1], fadeOut: .3 }); }
        shock(s, 46, F[1], 180, 190, 300, 900, at); }
      step(s.f, dt); step(s.sm, dt); step(s.p, dt); },
    render(s, c){ const at = c.at, t = s.cycle, T = .14, F = s.fire;
      if (t < T){ const q = t / T; sprite(c, 180, 190, 40 + 80 * q, 0, q, 1, G(at), 1, F[0]); }
      else { const q = (t - T) / 1.4;
        if (q < .7){ const w = q / .7; sprite(c, 180, 200, 420, 0, (1 - w) ** 2.5 * .8, 1, SG(at), 1, F[1]); sprite(c, 180, 300, 360, 0, (1 - w) ** 2 * .5, 1, SG(at), .3, F[2]); }
        if (q < 1){
          if (q < .06) sprite(c, 180, 190, 260, 0, 1 - q / .06, 1, G(at), 1, [1, 1, 1]);
          if (q < .3){ const w = q / .3; sprite(c, 180, 190, 520 * (1 - .3 * w), 0, (1 - w) ** 1.5, 1, 0, 1, F[0], 0, SHP(2, .025, .7, 0)); sprite(c, 180, 190, 260 * pop(w, .2), .3, (1 - w), 1, 0, 1, F[1], 0, SHP(4, .85, .15, 14.31)); }
          if (q < .5){ const w = q / .5; ring(c, 180, 190, 80 + 420 * easeOut(w), (1 - w) ** 1.5, F[0]); ring(c, 180, 195, 60 + 330 * easeOut(w), (1 - w) ** 2 * .6, F[1], .05, .55); } } }
      draw(c, s.sm); draw(c, s.f); draw(c, s.p); } };

  /* ── усложнение остальных старых: их ядро (шейдер огня, плазмы, фракталы…) остаётся, вокруг — новые слои частиц.
     Обёртка вызывает старый эффект и добавляет своё в s.x2 (имя не пересекается со старыми полями) */
  const wrap = (name, ex) => { const o = DEF[name]; if (!o) return;
    DEF[name] = Object.assign({}, o, { presets: Object.assign({}, o.presets, ex.presets),
      init(s, at){ o.init.call(o, s, at); s.x2 = []; s.lastC = 0; s.hits = new Set(); ex.init?.(s, at); },
      update(s, dt, at){ o.update.call(o, s, dt, at); if (s.cycle < s.lastC) s.hits.clear(); s.lastC = s.cycle;   // старые зацикливают cycle сами — удары повторяются
        for (const [t, f] of ex.at || []) if (!s.hits.has(t) && s.cycle >= t){ s.hits.add(t); f(s, at); }
        ex.update?.(s, dt, at); step(s.x2, dt); },
      render(s, c){ ex.under?.(s, c); o.render.call(o, s, c); draw(c, s.x2); } }); };
  const embers = (L, x, y, n, tint = [1, .5, .15], v0 = 60, v1 = 220, spread = 1.3) => { for (let i = 0; i < n; i++){ const a = -PI / 2 + R(-spread, spread), v = R(v0, v1);
    spawn(L, { x: x + R(-20, 20), y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 1.4, grav: -40, sway: 14, size: R(6, 12), life: R(1, 1.8), cells: [0], mode: 26.3, add: 1, tc: [[0, [1, .92, .7]], [.4, tint], [1, tint.map(v => v * .3)]], fadeIn: .05, fadeOut: .5, pul: .3, pf: 10 }); } };
  const groundHit = (s, at, x, y, col, dust = [.5, .45, .4]) => { s.shake = Math.max(s.shake || 0, 8);
    for (let i = 0; i < 10; i++){ const dir = i % 2 ? 1 : -1; puff(s.x2, { x: x + dir * R(4, 24), y: y + R(-4, 4), vx: dir * R(100, 260), vy: -R(10, 50), drag: 2.4, grow: 1.6, size: R(40, 64), life: R(.9, 1.4), alpha: .65, tint: shade(dust, R(.85, 1.1)) }); }
    for (let i = 0; i < 18; i++){ const a = -PI / 2 + R(-1.3, 1.3), v = R(250, 600); spawn(s.x2, { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(6, 10), speedStretch: .012, orient: true, drag: 2, grav: 900, life: R(.4, .8), cells: [G(at)], add: 1,
      tc: [[0, [1, 1, .95]], [.3, col], [1, col.map(v => v * .3)]], fadeIn: .01, fadeOut: .4, pul: 0 }); }
    embers(s.x2, x, y - 4, 10, col); };

  // костры: угольки поднимаются, у кончиков пламени — дымок, снизу дышит отсвет, раз в ~0.8 с огонь «стреляет» искрами
  for (const n of ['fire', 'firetoon']) wrap(n, {
    update(s, dt, at){ k.emit(s.acc, 91, 12, dt, () => embers(s.x2, 180, 300, 1, [1, .5, .15], 80, 200, .5));
      k.emit(s.acc, 92, 2.5, dt, () => puff(s.x2, { x: 180 + R(-25, 25), y: 120 + R(-10, 10), vx: R(-10, 10), vy: -R(40, 70), grow: 1.6, size: R(34, 50), life: R(1.6, 2.2), alpha: .18, tint: [.25, .22, .22], fadeIn: .3, fadeOut: .5, flow: 25, fz: 1.3 }));
      k.emit(s.acc, 93, 1.2, dt, () => { for (let i = 0; i < 8; i++){ const a = -PI / 2 + R(-.8, .8), v = R(200, 420); spawn(s.x2, { x: 180 + R(-20, 20), y: 280, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(5, 8), speedStretch: .012, orient: true, drag: 1.5, grav: 500, life: R(.4, .7), cells: [G(at)], add: 1, tint: [1, .75, .3], fadeIn: .01, fadeOut: .5, pul: 0 }); } }); },
    under(s, c){ const w = .5 + .5 * Math.sin(s.t * 7) * Math.sin(s.t * 4.3 + 1); sprite(c, 180, 312, 300, 0, .35 + .2 * w, 1, SG(c.at), .35, [1, .5, .15]); } });
  wrap('firering', { update(s, dt){ k.emit(s.acc, 91, 14, dt, () => { const a = R(0, 6.28); embers(s.x2, 180 + Math.cos(a) * 128, 180 + Math.sin(a) * 128, 1, [1, .55, .15], 30, 90, 3.2); }); } });
  // плазма и фракталы: вокруг бегут блики, раз в 1.2 с расходится тонкая волна, медленно крутится пунктир
  for (const [n, col] of [['plasma', [1, .55, .75]], ['julia', [.55, .65, 1]], ['crystal', [.7, .9, 1]]]) wrap(n, {
    update(s, dt){ k.emit(s.acc, 91, 2.2, dt, () => { const a = R(0, 6.28), r = R(60, 140); glint(s.x2, 180 + Math.cos(a) * r, 180 + Math.sin(a) * r, R(.6, 1), [1, 1, 1]); });
      if (n === 'crystal') k.emit(s.acc, 92, 4, dt, () => bit(s.x2, 'petal', { x: 180 + R(-150, 150), y: 0, vx: R(-10, 10), vy: R(30, 60), sway: 25, size: R(8, 13), life: R(4, 6), w3x: R(1, 3), w3y: R(2, 4), tint: [.9, .96, 1], add: .4, fadeIn: .1, fadeOut: .2 })); },
    under(s, c){ const w = (s.t / 1.2) % 1; ring(c, 180, 180, 120 + 260 * easeOut(w), (1 - w) ** 2 * .45, col, .015); } });
  // туманность, нити, кометы: звёздное поле — точки мерцают, иногда вспыхивает звезда
  for (const n of ['nebula', 'threads', 'comets']) wrap(n, {
    update(s, dt, at){ k.emit(s.acc, 91, 14, dt, () => spawn(s.x2, { x: R(10, 350), y: R(10, 350), size: R(3, 7), life: R(1, 2), cells: [G(at)], add: 1, tint: [.8, .85, 1], fadeIn: .4, fadeOut: .5, pul: .4, pf: R(6, 12) }));
      k.emit(s.acc, 92, .8, dt, () => glint(s.x2, R(40, 320), R(40, 320), R(.7, 1.1), [1, 1, 1])); } });
  // портал: обломки и угольки затягивает спиралью в центр со следами, по ободу бегают блики
  wrap('portal', { update(s, dt, at){ k.emit(s.acc, 91, 9, dt, () => { const a = R(0, 6.28), r = R(160, 180);
      bit(s.x2, Math.random() < .5 ? 'ash' : 'gem', { x: 180 + Math.cos(a) * r, y: 180 + Math.sin(a) * r, vx: -Math.sin(a) * 120, vy: Math.cos(a) * 120, ax: 180, ay: 180, pull: 700, swirl: 260, kr: 18, drag: 1.2, trail: 6,
        size: R(8, 14), life: 3, w3x: R(-6, 6), w3y: R(-6, 6), tint: [.75, .55, 1], add: .3, fadeIn: .1, fadeOut: .1 }); });
    k.emit(s.acc, 92, 3, dt, () => { const a = R(0, 6.28); glint(s.x2, 180 + Math.cos(a) * 118, 180 + Math.sin(a) * 118, .8, [1, .9, 1]); }); } });
  // удары о землю: пыль катится, искры и угольки — в момент удара старого эффекта
  wrap('bolt', { at: [[.4, (s, at) => groundHit(s, at, 180, 318, [.75, .85, 1])]] });
  wrap('fbolt', { at: [[.45, (s, at) => groundHit(s, at, 180 + Math.sin(s.t * .7) * 30, 320, [.75, .85, 1])]] });
  wrap('cracks', { at: [[.15, (s, at) => groundHit(s, at, 180, 260, [1, .6, .25])]] });
  wrap('mushroom', { at: [[.1, (s, at) => groundHit(s, at, 180, 305, [1, .6, .2])]], update(s, dt){ if (s.cycle > .3 && s.cycle < 2.4) k.emit(s.acc, 91, 10, dt, () => embers(s.x2, 180, 220, 1, [1, .55, .2], 60, 160, 1.4)); } });
  wrap('toonboom', { at: [[.9, (s, at) => { embers(s.x2, 180, 190, 22, [1, .55, .2], 150, 420, 2.2); for (let i = 0; i < 10; i++){ const a = -PI / 2 + R(-1.5, 1.5), v = R(350, 600);
    bit(s.x2, 'ember', { f3: false, x: 180, y: 190, vx: Math.cos(a) * v, vy: Math.sin(a) * v, grav: 900, drag: .8, trail: 8, size: R(8, 12), life: R(.8, 1.2), add: 1, tint: [1, .6, .2], fadeOut: .3 }); } }]] });
  wrap('eruption', { at: [[.9, (s, at) => groundHit(s, at, 180, 285, [1, .55, .2])]], update(s, dt){ if (s.cycle > .9 && s.cycle < 2.6) k.emit(s.acc, 91, 16, dt, () => embers(s.x2, 180, 250, 1, [1, .5, .15], 120, 300, .5)); } });
  wrap('bubble', { update(s, dt, at){ k.emit(s.acc, 91, 6, dt, () => glint(s.x2, 180 + R(-120, 120), 180 + R(-120, 120), .6, [1, .9, .6])); } });
});
