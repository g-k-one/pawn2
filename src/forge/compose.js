/* Горн — пакет «compose»: эффект из описания слоёв, без кода. Его пишет конструктор (витрина → «Конструктор»), его же можно вставить руками:
   Forge.compose('мой-удар', { period: 1.2, hit: .15, shake: 8, freeze: .04, layers: [ { type: 'shape', shape: 'star', at: .15, dur: .8, from: 60, to: 240, color: '#ffb347' }, … ] })
   Слои: glow (мягкое свечение) · shape (форма: star, spiky, diamond, cross, ring, bokeh, ray, sun, dash, hex, bubble) · burst (частицы: sparks, stars, embers,
   bokeh, shards, lines, pillars) · swipe (дуга-взмах) · wave (кольцо расходится). Время — в секундах от начала; размеры — в единицах эффекта (квадрат 360).
   Нужны пакеты hits (формы) — подключать после него. */
Forge.pack('compose', k => {
  const { R, PI, easeOut, spawn, step, draw, sprite, arcBand, DEF } = k;
  const hex = h => { const n = parseInt(String(h || '#ffffff').replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const dark = c => c.map(v => v * .25);
  const SH = { star: 0, diamond: 1, cross: 2, ring: 3, spiky: 4, bokeh: 5, ray: 6, bubble: 7, hex: 8, sun: 9, dash: 9 };
  // параметры шейдера формы: [острота/толщина, второй параметр, лучи/зерно]
  const shp = (L, k1) => { const sh = L.shape || 'star', sharp = L.sharp ?? .7, pts = L.points ?? 4;
    switch (sh){
      case 'star': return [23, sharp, L.core ?? 0, pts];
      case 'spiky': return [23.4, sharp, L.rough ?? .1, Math.max(3, pts | 0) + .37];
      case 'diamond': return [23.1, L.width ?? .4, 0, 0];
      case 'cross': return [23.2, L.thick ?? .04, L.vertical ?? .8, 0];
      case 'ring': return [23.3, L.thick ?? .03, 0, 0];
      case 'bokeh': return [23.5, L.solid ? 1 : 0, 0, 0];
      case 'ray': return [23.6, L.width ?? .2, 0, 0];
      case 'bubble': return [23.7, 0, 0, 0];
      case 'hex': return [23.8, L.cells ?? 4, 0, 0];
      case 'sun': return [23.9, L.spike ?? .5, 0, pts > 4 ? pts : 16];
      case 'dash': return [23.9, L.speed ?? .1, 1, pts > 4 ? pts : 24];
    } return [23, sharp, 0, 4]; };
  // огибающая слоя: быстро появляется, к концу гаснет; pop — размер с перелётом
  const env = (L, q) => Math.min(1, q / (L.fadeIn ?? .08)) * Math.pow(1 - q, L.fadeOut ?? 1.5);
  const grow = (L, q) => L.pop ? (q < .14 ? easeOut(q / .14) * 1.15 : 1.15 - .15 * Math.min(1, (q - .14) / .2)) : easeOut(q);
  function burst(s, at, L, P){ const n = Math.round(L.count ?? 16), sp = L.speed || [150, 400], lf = L.life || [.4, .8], sz = L.size || [8, 14], kind = L.kind || 'sparks',
      c1 = hex(L.color), c2 = L.color2 ? hex(L.color2) : dark(c1), dir = (L.dir ?? -90) * PI / 180, spread = (L.spread ?? 360) * PI / 180, x = L.x ?? 180, y = L.y ?? 180, G = at.map['glow:W0'];
    for (let i = 0; i < n; i++){ const a = dir + (Math.random() - .5) * spread, v = R(sp[0], sp[1]), o = { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: R(lf[0], lf[1]), size: R(sz[0], sz[1]),
        drag: L.drag ?? 2, grav: L.gravity ?? 0, add: 1, fadeIn: .02, fadeOut: .45, pul: 0, tc: [[0, [1, 1, 1].map((w, j) => (w + c1[j] * 2) / 3)], [.25, c1], [1, c2]], trail: L.trail || 0 };
      if (kind === 'sparks') Object.assign(o, { cells: [G], orient: true, speedStretch: .01 });
      else if (kind === 'lines') Object.assign(o, { cells: [G], orient: true, speedStretch: .016, drag: 5, x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 30 });
      else if (kind === 'embers') Object.assign(o, { cells: [G], sway: 14, pul: .3, pf: 9 });
      else if (kind === 'stars') Object.assign(o, { cells: [0], mode: 23, ero: [[0, .8]], heat: [[0, 0]], ph: 4, rot: R(0, 1.6), vr: R(-3, 3), sc: [[0, .4], [.2, 1.1], [1, .5]] });
      else if (kind === 'bokeh') Object.assign(o, { cells: [0], mode: 23.5, add: .6, alpha: .7 });
      else if (kind === 'shards') Object.assign(o, { cells: [0], mode: 23.1, ero: [[0, .38]], stretch: 2.4, rot: a + PI / 2, add: .6 });
      else if (kind === 'pillars') Object.assign(o, { cells: [0], mode: 23.6, ero: [[0, .25]], stretch: 9, vx: R(-20, 20), vy: -v, x: x + R(-30, 30), drag: 3, sc: [[0, .6], [.3, 1], [1, .7]] });
      spawn(s.p, o); } }

  k.compose = (name, spec) => {
    const S = typeof spec === 'string' ? JSON.parse(spec) : spec, P = S.period || 1.2, layers = S.layers || [];
    DEF[name] = { atlas: 'aura', period: S.loop ? 0 : P, spec: S,
      init: s => Object.assign(s, { p: [], fired: new Set(), round: 0, hitDone: false }),
      update(s, dt, at){ const t = S.loop ? s.cycle % P : s.cycle, round = S.loop ? Math.floor(s.cycle / P) : 0;
        if (round !== s.round){ s.round = round; s.fired.clear(); s.hitDone = false; }
        if (!s.hitDone && t >= (S.hit ?? 0)){ s.hitDone = true; if (S.shake) s.shake = S.shake; if (S.freeze) s.freeze = S.freeze; }
        layers.forEach((L, i) => { if (L.type === 'burst' && !s.fired.has(i) && t >= (L.at || 0)){ s.fired.add(i); burst(s, at, L); } });
        step(s.p, dt); },
      render(s, c){ const t = S.loop ? s.cycle % P : s.cycle, at = c.at;
        for (const L of layers){ if (L.type === 'burst' || L.hidden) continue; const q = (t - (L.at || 0)) / (L.dur || .5); if (q < 0 || q > 1) continue;
          const col = hex(L.color), a = (L.alpha ?? 1) * env(L, q), g = grow(L, q), sz = (L.from ?? 40) + ((L.to ?? 240) - (L.from ?? 40)) * g, x = L.x ?? 180, y = L.y ?? 180, sy = L.flat ?? 1;
          if (L.type === 'glow') sprite(c, x, y, sz, 0, a, 1, at.map[L.soft === false ? 'glow:W0' : 'sglow:W0'], sy, col);
          else if (L.type === 'shape') sprite(c, x, y, sz, ((L.rot ?? 0) + (L.spin ?? 0) * q) * PI / 180, a, L.add ?? 1, 0, sy, col, 0, shp(L));
          else if (L.type === 'wave') sprite(c, x, y, sz, 0, a, 1, 0, sy, col, 0, [23.3, (L.thick ?? .03) * (1 - q * .5), 0, 0]);
          else if (L.type === 'swipe'){ const a0 = (L.start ?? -150) * PI / 180, sw = (L.sweep ?? 160) * PI / 180, h = a0 + sw * easeOut(Math.min(1, q * 1.6));
            arcBand(c, x, y, L.rx ?? 150, L.ry ?? 100, (L.tilt ?? 0) * PI / 180, h - sw * .7, h, L.width ?? 60, a, 1, col, .8); } }
        draw(c, s.p); } };
    return DEF[name];
  };
});
// Forge.compose — то же для всех экземпляров движка (пакет даёт k.compose в каждом)
Forge.compose = (name, spec) => Forge.define(name, k => k.compose(name, spec));
