/* Горн — пакет «season»: эффекты оформления сезонов Пасса.
   Подключается после src/app/16e-forge.js: <script src="src/forge/season.js">. Когда сезон приходит в приложение — эффект переезжает в ядро.
   virus — вход на Арену Сезона 2 «Взлом Павна»: место игрока на полсекунды рассыпается помехами и собирается обратно. */
Forge.pack('season', k => {
  const { R, PI, easeOut, spawn, step, draw, sprite, quad, EMIT, DEF } = k;
  const MAG = [1, .17, .84], CYA = [0, .94, 1], ACID = [.71, 1, 0], CODE = [.3, 1, .45], HEAD = [.85, 1, .88];

  /* Вирус. Удар (1–3 кадра): белая вспышка, свечение раздваивается — маджента влево, циан вправо.
     Помехи: горизонтальные полосы со сдвигом цвета перерисовываются 16 раз в секунду (новая форма, а не плывут), к 0.6 с стихают.
     Пиксели разлетаются от места игрока; сверху вниз через место бегут колонки зелёного кода (голова светлее).
     Сборка: пиксели с кольца пружиной стягиваются в центр, в конце — кислотное кольцо-импульс. Всё — сплошная ячейка solid
     и свечения атласа aura, без новых картинок. Эффект задуман в px: size = 360 → 1 ед. = 1 px, место игрока — около 140 ед. */
  DEF.virus = { atlas: 'aura', period: 1.25,
    init: s => Object.assign(s, { px: [], bars: [], fl: 0, fired: false, back: false }),
    update(s, dt, at){
      const N = n => Math.max(1, Math.round(n * EMIT[k.quality])), SQ = at.map['solid:W0'], t = s.cycle;
      s.fl -= dt;
      if (t < .6 && s.fl <= 0){ s.fl = 1 / 16; s.bars.length = 0;
        const n = Math.round(3 + 11 * (1 - t / .6));
        for (let i = 0; i < n; i++) s.bars.push({ x: 180 + R(-46, 46), y: 180 + R(-72, 72), w: R(30, 150) * (1 - t * .7), h: R(3, 13), dx: R(4, 12), col: [MAG, CYA, ACID, HEAD][i % 4] }); }
      if (t >= .6) s.bars.length = 0;
      if (!s.fired){ s.fired = true; s.shake = 3;
        // рассыпание: пиксели разлетаются от места игрока
        for (let i = 0; i < N(46); i++){ const a = R(0, 2 * PI), r = R(10, 62), v = R(140, 420);
          spawn(s.px, { x: 180 + Math.cos(a) * r, y: 180 + Math.sin(a) * r, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: R(5, 10), life: R(.28, .45), drag: 5,
            cells: [SQ], add: .6, tint: [MAG, CYA, ACID][i % 3], fadeIn: .01, fadeOut: .5, pul: 0 }); }
        // зелёный код: колонки пикселей бегут сверху вниз; у каждой колонки своя задержка и скорость
        for (let col = -6; col <= 6; col++){ const x = 180 + col * 10 + R(-1.5, 1.5), v = R(300, 440), w0 = R(0, .2), n = N(7);
          for (let j = 0; j < n; j++){ const w = w0 + .03 + j * .028;
            spawn(s.px, { x, y: 90 - j * 9, vy: v, size: 5, stretch: 1.5, wait: w, life: w + R(.4, .55), cells: [SQ], add: .8, tint: j ? CODE : HEAD, alpha: 1 - j * .09, fadeIn: .02, fadeOut: .55, pul: 0 }); } }
      }
      // сборка обратно: пиксели с кольца пружиной стягиваются к месту игрока
      if (!s.back && t > .42){ s.back = true;
        for (let i = 0; i < N(34); i++){ const a = R(0, 2 * PI), r = R(80, 130), r1 = R(4, 30);
          spawn(s.px, { x: 180 + Math.cos(a) * r, y: 180 + Math.sin(a) * r, hx: 180 + Math.cos(a) * r1, hy: 180 + Math.sin(a) * r1, spring: 60, drag: 9, size: R(5, 8), life: R(.32, .45),
            cells: [SQ], add: .7, tint: [CYA, MAG, ACID][i % 3], fadeIn: .05, fadeOut: .35, pul: 0 }); } }
      step(s.px, dt);
    },
    render(s, c){ const at = c.at, t = s.cycle, SQ = at.map['solid:W0'], cell = at.cell, SG = at.map['sglow:W0'];
      // удар: свечение раздваивается — маджента влево, циан вправо; белое ядро — самый яркий кадр
      if (t < .3){ const q = t / .3, a = (1 - q) ** 2, d = 230 + 120 * easeOut(q);
        sprite(c, 172, 180, d, 0, a * .55, 1, SG, 1, MAG); sprite(c, 188, 180, d, 0, a * .55, 1, SG, 1, CYA); }
      if (t < .08) sprite(c, 180, 180, 110, 0, (1 - t / .08) * .9, 1, at.map['glow:W0'], 1, [.9, 1, 1]);
      // помехи: полоса и две её копии — маджента и циан — разъехались в стороны
      for (const b of s.bars){ const w = b.w / cell, h = b.h / cell;
        quad(c, SQ, w, 0, 0, h, b.x - b.dx, b.y, .5, 1, MAG);
        quad(c, SQ, w, 0, 0, h, b.x + b.dx, b.y, .5, 1, CYA);
        quad(c, SQ, w * .9, 0, 0, h * .6, b.x, b.y, .85, .3, b.col); }
      // собрался: кислотное кольцо-импульс
      if (t > .7 && t < 1.15){ const q = (t - .7) / .45;
        sprite(c, 180, 180, 130 + 170 * easeOut(q), 0, (1 - q) ** 2 * .95, 1, at.map['sring:W0'], 1, ACID);
        if (q < .3) sprite(c, 180, 180, 150, 0, (1 - q / .3) * .5, 1, SG, 1, CYA); }
      draw(c, s.px); } };
});
