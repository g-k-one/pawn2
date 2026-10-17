/* =========================================================
   СВЕЧЕНИЕ РАМКИ (WebGL): цвета плавно перетекают при смене тира
   ========================================================= */
function makeGlow(cv, opt){
  const FRAG = `
uniform vec2 uRes; uniform float uSc;
uniform vec4 uRect; uniform float uR, uT0, uKs, uI, uUn, uPd, uO, uOuter, uPh, uBreath;
uniform sampler2D uPalT, uLobT; uniform vec3 uPlate, uPage, uLowC, uHighC;
uniform vec4 uWave; uniform float uWamp, uM;

float sdRR(vec2 p, vec2 hs, float r){ vec2 q = abs(p) - hs + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
vec3 pal(float t){ return texture2D(uPalT, vec2(t, .5)).rgb; }   // палитра по кругу — маленькая текстура 256×1, сдвиг цикла уже учтён
float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.) / k; return min(a, b) - h * h * k * .25; }
float cd(float a, float b){ float d = abs(fract(a - b)); return min(d, 1. - d); }   // расстояние по кругу

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uSc;
  vec2 hs = uRect.zw * .5, c = uRect.xy + hs, pc = p - c;
  float dd = -sdRR(pc, hs, uR);
  float cov = clamp(dd * uSc + .5, 0., 1.);                       // сглаживание края

  /* фигура: вертикальный градиент + мягкая подсветка снизу и сверху */
  float vy = clamp((p.y - uRect.y) / uRect.w, 0., 1.);
  float dk = vy < .55 ? 1. - .3 * vy / .55 : .7 + .3 * (vy - .55) / .45;
  vec2 lq = vec2(pc.x / (uRect.z * .6), (p.y - uRect.y - uRect.w * 1.08) / (uRect.w * .27));
  vec2 hq = vec2(pc.x / (uRect.z * .55), (p.y - uRect.y + uRect.w * .1) / (uRect.w * .22));
  vec3 base = uPlate * dk;
  base += (uLowC - base) * .26 * exp(-2.2 * dot(lq, lq)) + (uHighC - base) * .16 * exp(-2.2 * dot(hq, hq));
  base = mix(uPage, base, cov);
  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));

  /* глубоко внутри фигуры света нет — сразу отдаём фон (это бóльшая часть экрана) */
  if (dd > uT0 * 7. && uWave.y <= 0.){ gl_FragColor = vec4(base + (n - .5) / 255., 1.); return; }

  /* положение вдоль края берём у ближайшей точки края, а не по углу из центра —
     тогда цвета и «наплывы» уходят внутрь ровно по нормали, без клиньев к центру.
     Для этого края используем скругление побольше (rU), чтобы и в углах переход был плавным */
  float rU = min(max(uR, uT0 * 3.5), min(hs.x, hs.y));
  vec2 iq = hs - vec2(rU), cl = clamp(pc, -iq, iq), dv = pc - cl, eb;
  if (dot(dv, dv) > 1e-4) eb = cl + normalize(dv) * rU;
  else eb = (hs.x - abs(pc.x) < hs.y - abs(pc.y)) ? vec2(sign(pc.x) * hs.x, pc.y) : vec2(pc.x, sign(pc.y) * hs.y);
  float u = fract(atan(eb.y / uRect.w, eb.x / uRect.z) / 6.2831853 + 1.25);
  float a = 0., rim = 0., deep = 0.;
  if (cov > 0.){
    float D = max(dd, 0.);
    if (D < uT0 * 7.){
      /* глубина со скруглением к центру: плавный минимум расстояний до сторон и до контура */
      float ks = uKs, dl = min(p.x - uRect.x, uRect.x + uRect.z - p.x), dt = min(p.y - uRect.y, uRect.y + uRect.w - p.y);
      D = max(0., min(D, smin(D, smin(dl, dt, ks * 2.), ks * 2.) + ks * .5));
      /* «наплывы» толщины — бегут вдоль края с разной скоростью */
      float T = max(4., uT0 * uBreath * texture2D(uLobT, vec2(u, .5)).r * 2.);   // толщина вдоль края — текстура на кадр
      float z = D / T;
      a = (.78 * exp(-z * sqrt(z)) + .55 * exp(-D / (uT0 * .1))) * cov;
      a *= smoothstep(.8, .45, D / min(hs.x, hs.y));                   // до центра свет не доходит никогда
      rim = exp(-D / (uT0 * .06)) * cov;
      deep = smoothstep(0., 1., z * .9);
    }
  }
  if (uOuter > 0.){                                                 // выход света наружу (при отступе)
    float dO = max(-dd, 0.);
    a += .55 * exp(-pow(dO / uO + 1e-4, 1.3)) * (1. - cov);
    rim += exp(-dO / (uT0 * .06)) * .6 * (1. - cov);
  }
  a = min(1.2, a * uI * (.85 + .15 * uBreath));
  vec3 outc = base;
  if (a > .002){
    vec3 col = mix(pal(u), pal(u + .22), deep);       // вглубь — следующий оттенок
    col += (1. - col) * .4 * rim;                                   // у самого края — светлая кромка
    outc += col * a;
  }

  /* волна: размер s (1 — край, 0 — центр); к центру скругляется до пилюли, размывается и тает, контур неровный */
  if (uWave.y > 0.){
    float s = uWave.x;
    vec2 whs = max(hs * s - vec2(uM * .05) * s, vec2(2.));
    float rp = min(whs.x, whs.y), rr = mix(rp, min(uR * s, rp), smoothstep(.2, .85, s));
    float sw = sdRR(pc, whs, rr) + uWamp * s * (.55 * sin(18.85 * u + uWave.z) + .3 * sin(31.42 * u + uWave.w) + .15 * sin(56.55 * u + uWave.z * 1.7));
    float sg = mix(uM * .08, uM * .014, s);
    float ring = exp(-sw * sw / (sg * sg)) + .3 * exp(-abs(sw) / (sg * 3.));
    float fade = smoothstep(.07, .32, s) * smoothstep(1., .85, s) * uWave.y, wa = ring * fade * .75 * uI * cov;
    if (wa > .002) outc += pal(u + .1) * wa;
  }
  /* дизеринг против ступенек градиента */
  gl_FragColor = vec4(outc + (n - .5) / 255., 1.);
}`;
  const VERT = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }';
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  let gl, U = {}, palTex, lobTex, ok = false, W = 0, H = 0, SC = 1;
  const PAL = new Uint8Array(256 * 3), LOB = new Uint8Array(256);
  const target = TIERS[1].glow.map(rgb), cur = target.map(c => c.slice());
  try {
    gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (gl){
      const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, (hp && hp.precision > 0 ? 'precision highp float;' : 'precision mediump float;') + FRAG));
      gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const tex = unit => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
      palTex = tex(0); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 256, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
      lobTex = tex(1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 256, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, null);
      ['uRes', 'uSc', 'uRect', 'uR', 'uT0', 'uKs', 'uI', 'uUn', 'uPd', 'uO', 'uOuter', 'uPh', 'uBreath', 'uPalT', 'uLobT', 'uPlate', 'uPage', 'uLowC', 'uHighC', 'uWave', 'uWamp', 'uM']
        .forEach(n => U[n] = gl.getUniformLocation(prog, n));
      ok = true;
    }
  } catch(err){ console.warn('glow', err); ok = false; }
  if (!ok && opt.main){ S.noGL = true; document.body.classList.add('nogl'); }

  function resize(){
    const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    const [W0, H0] = opt.size();
    SC = Math.min(dpr * (r.width / W0), opt.maxSc || 1.5);      // свечение мягкое — полное разрешение не нужно            // точек холста на 1 px макета
    W = Math.round(W0 * SC); H = Math.round(H0 * SC);
    if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
    if (ok) gl.viewport(0, 0, W, H);
  }
  let ph = 0, last = 0, drawn = 0;
  // цикл не будит страницу каждый кадр экрана (60–120 раз в секунду): между кадрами свечения — таймер, в простое — редкая проверка
  function tick(now){ const d = frame(now); if (d > 0) setTimeout(() => requestAnimationFrame(tick), d); else requestAnimationFrame(tick); }
  function frame(now){
    if (!ok || document.hidden || S.lite || (opt.active && !opt.active())) return 100;
    // в покое — ~20 к/с: свет течёт медленно (циклы 7–24 с), глаз разницы не видит, а iPhone в Telegram греется заметно меньше; при ударе и переходах — каждый кадр
    const calm = !(energy(now) > .01 || (opt.hot && opt.hot()));
    if (calm && now - drawn < 44) return 48 - (now - drawn);
    drawn = now;
    if (Math.round(opt.size()[0] * SC) !== W || Math.round(opt.size()[1] * SC) !== H) resize();
    const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
    ph = (ph + dt / 12) % 1;
    const k = 1 - Math.exp(-dt / .22);
    cur.forEach((c, i) => { for (let j = 0; j < 3; j++) c[j] += (target[i][j] - c[j]) * k; });
    // рамка из макета: отступ 16 по бокам, 15 сверху, скругление 44, уходит под низ панели
    // спокойное «дыхание» яркости и толщины (цикл 7 с) + всплеск энергии от кнопки крафта
    const br = Math.sin(now / 1000 * Math.PI * 2 / 7), e = energy(now), g = opt.gain ? opt.gain(now) : 1;
    const R = opt.rect(now), x = R.x, y = R.y, w = R.w, h = R.h, m = R.m, T0 = 30 * (1 + 1.3 * e);
    const st = [cur[0], cur[1], cur[2], cur[3], cur[2], cur[1]];
    for (let q = 0; q < 256; q++){
      const t = ((q / 256 + ph) % 1) * 6, i = Math.floor(t), f0 = t - i, f = f0 * f0 * (3 - 2 * f0), a = st[i], b = st[(i + 1) % 6];
      for (let c = 0; c < 3; c++) PAL[q * 3 + c] = 255 * (a[c] + (b[c] - a[c]) * f) + .5;
      const u = q / 256, cd = c0 => { const d = Math.abs((((u - c0) % 1) + 1) % 1); return Math.min(d, 1 - d); };
      const l = Math.exp(-((cd(.1 + ph) / .16) ** 2)) + .8 * Math.exp(-((cd(.45 - ph) / .12) ** 2)) + .9 * Math.exp(-((cd(.75 + ph) / .18) ** 2));
      LOB[q] = 127.5 * Math.max(.5, Math.min(1.5, 1 + .35 * (l - .6)));
    }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, palTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGB, gl.UNSIGNED_BYTE, PAL);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lobTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, LOB);
    gl.uniform1i(U.uPalT, 0); gl.uniform1i(U.uLobT, 1);
    gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uSc, SC);
    gl.uniform4f(U.uRect, x, y, w, h); gl.uniform1f(U.uR, R.r);
    gl.uniform1f(U.uT0, T0); gl.uniform1f(U.uKs, 21); gl.uniform1f(U.uI, .42 * (1 + .12 * br) * (1 + 1.3 * e) * g); gl.uniform1f(U.uUn, .5);
    gl.uniform1f(U.uO, 22); gl.uniform1f(U.uOuter, .75);
    gl.uniform1f(U.uPh, ph); gl.uniform1f(U.uBreath, 1 + .1 * br);
    const lit = (1 + .2 * br + 1.2 * e) * g, plate = cur[0].map(v => v * .035 * lit), page = cur[0].map(v => v * .06 * (1 + .15 * br + 1 * e) * g);
    gl.uniform3fv(U.uPlate, plate); gl.uniform3fv(U.uPage, page); gl.uniform3fv(U.uLowC, cur[1]); gl.uniform3fv(U.uHighC, cur[3]);
    // волна от рамки к центру после удара
    const wt = opt.noWave ? 9 : (now - punchAt) / 1100;          // на экране крафта — без колец к центру
    gl.uniform4f(U.uWave, wt >= 0 && wt < 1 ? 1 - wt * (2 - wt) * .96 : 0, wt >= 0 && wt < 1 ? 1.4 : 0, 1.3, 4.1);
    gl.uniform1f(U.uWamp, 7); gl.uniform1f(U.uM, w);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return calm ? 40 : 0;
  }
  resize(); addEventListener('resize', resize);
  requestAnimationFrame(tick);
  /* энергия: быстрый подъём, затем мягкий спад ~1.8 с */
  let punchAt = -1e9;
  let punchPow = 1;
  function energy(now){ const t = (now - punchAt) / 1000; if (t < 0 || t > 3) return 0; return punchPow * (t < .15 ? t / .15 : Math.exp(-(t - .15) * 1.9)); }
  return { set(cols, snap){ cols.forEach((h, i) => { target[i] = rgb(h); if (snap) cur[i] = target[i].slice(); }); }, punch(delay = 0, pow = 1){ punchAt = performance.now() + delay; punchPow = pow; }, resize };
}
/* рамка панели: отступ медленно «плывёт» 0…20 px (цикл ~24 с), скругление = 64 − отступ */
const panelRect = (now, top = 0) => { const m = 10 + 10 * Math.sin(now / 1000 * Math.PI * 2 / 24); return { m, x: m, y: top + m - 1, w: SW - 2 * m, h: 659 - (m - 1) - (m + 4), r: Math.max(8, 64 - m) }; };
// свет мягкий: 1 точка холста на 1 px макета — вдвое меньше работы, чем 1.5
const Glow = makeGlow($('glow'), { main: true, size: () => [SW, 659], maxSc: .6, rect: now => panelRect(now), active: () => !FX.cover });
/* рамка экрана крафта: на весь экран, проявляется из черноты */
const FX = { on: false, gain: 0, gainTo: 0, last: 0, morph: 1, cover: false, hot: false };
const fxH = () => { const st = $('stage'); return st.offsetHeight || 844; };
const FullGlow = makeGlow($('fxGlow'), { size: () => [SW, fxH()], active: () => FX.on, hot: () => FX.hot, maxSc: .75, noWave: true,
  gain: now => { const dt = FX.last ? Math.min(.1, (now - FX.last) / 1000) : 0; FX.last = now; FX.gain += (FX.gainTo - FX.gain) * (1 - Math.exp(-dt / .7)); return FX.gain; },
  // morph 0 — точно рамка панели (внизу экрана), 1 — рамка на весь экран
  rect: now => { const h = fxH(), a = panelRect(now, h - 659), b = { m: 12, x: 12, y: 12, w: SW - 24, h: h - 24, r: 46 }, k = FX.morph, L = (p, q) => p + (q - p) * k;
    return { m: L(a.m, b.m), x: L(a.x, b.x), y: L(a.y, b.y), w: L(a.w, b.w), h: L(a.h, b.h), r: L(a.r, b.r) }; } });

/* ---------- старт ---------- */
applyLite();
renderBet();
requestAnimationFrame(() => setTier(1));
document.fonts?.ready.then(() => setTier(S.tier, { keepPrize: true }));
restartAuto();
/* ---------- онбординг при первом запуске. Выключается в дебаге ----------
   Приветствие → «попробуй сам» на рангах и ставке (шаг идёт дальше, когда игрок сделал действие; «Далее» — запасной путь) →
   меню → крафт с предложением начать на фантиках. Подсвеченный элемент живой: тапы проходят только в него и в карточку */
const Onb = (() => {
  const STEPS = [
    { t: $t("Добро пожаловать в Pawn"), d: $t("Ставишь GRAM или NFT-подарок, бьёшь по наковальне — и получаешь приз одного из пяти рангов, от «Базы» до «Джекпота». Покажу за полминуты."), next: $t("Поехали") },
    { sel: '#tiers', t: $t("Ранги"), d: $t("Нажми на любой ранг — увидишь, что можно выбить и с каким шансом. Потом можно и свайпать по экрану."), done: s => S.tier !== s.tier, ok: $t("Отлично! Приз и шанс поменялись") },
    { sel: '.chips', t: $t("Ставка"), d: $t("Добавь GRAM кнопкой, например +1. Ставка растёт — растёт и приз. Корзина слева всё сбросит."), done: s => S.ton > s.ton || S.gifts.length > s.gifts, ok: $t("Ставка есть — смотри, приз вырос") },
    { sel: '#modes', t: $t("Арена"), d: $t("Внизу — режимы. На Арене до 6 игроков загадывают тикет колесом: кто ближе всех к выпавшему — крафтит на весь банк.") },
    { sel: '#menuBtn', t: $t("Меню"), d: $t("Здесь бонусы и кейсы, история игр и проверка честности") },
    { sel: '#craft', t: $t("Крафт"), d: $t("Жми на наковальню — и узнаешь приз. Каждый исход можно проверить после игры. Хочешь сначала попробовать без риска?"), demo: true },
  ];
  let i = 0, el = null, poll = 0, hole = null;
  // тапы мимо подсветки и карточки гасим: живым остаётся только то, про что подсказка
  // на «Меню» подсветка только показывает (шторка поверх подсказки не нужна); на «Крафте» тап по наковальне закрывает подсказки и запускает крафт
  const guard = e => { if (!el) return; const c = el.querySelector('.onb-card'); if (c?.contains(e.target)) return;
    const s = STEPS[i], p = e.touches?.[0] || e, inHole = hole && p.clientX >= hole.left && p.clientX <= hole.right && p.clientY >= hole.top && p.clientY <= hole.bottom;
    if (!inHole || !(s.done || s.demo)){ e.stopPropagation(); e.preventDefault(); return; }
    if (s.demo && e.type === 'click') end(); };
  function show(){
    clearInterval(poll); hole = null;
    const s = STEPS[i], tg = s.sel && document.querySelector(s.sel); if (s.sel && !tg) return end();
    const dots = `<em class="onb-dots">${STEPS.map((_, k) => `<i${k === i ? ' class="on"' : k < i ? ' class="was"' : ''}></i>`).join('')}</em>`;
    const btns = s.demo ? `<span><button class="onb-skip">${$t("Играть на GRAM")}</button><button class="onb-next onb-demo">${$t("На фантиках")}</button></span>`
                        : `<span><button class="onb-skip">${$t("Пропустить")}</button><button class="onb-next">${s.next || $t("Далее")}</button></span>`;
    if (!tg){ el.innerHTML = `<i class="onb-hole none"></i><div class="onb-card mid">${dots}<b>${s.t}</b><p>${s.d}</p>${btns}</div>`; }
    else {
      const st = stage.getBoundingClientRect(), r = tg.getBoundingClientRect(), pad = 8;
      const x = (r.left - st.left) / K - pad, y = (r.top - st.top) / K - pad, w = r.width / K + pad * 2, h = r.height / K + pad * 2, below = y + h / 2 < stage.offsetHeight / 2;
      const ax = Math.max(28, Math.min(stage.offsetWidth - 28, x + w / 2)) - 16;   // стрелка карточки смотрит на центр подсветки
      hole = { left: r.left - pad * K, right: r.right + pad * K, top: r.top - pad * K, bottom: r.bottom + pad * K };
      el.innerHTML = `<i class="onb-hole" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></i>` +
        `<div class="onb-card ${below ? 'at-dn' : 'at-up'}" style="${below ? `top:${y + h + 16}px` : `bottom:${stage.offsetHeight - y + 16}px`};--ax:${ax}px">${dots}<b>${s.t}</b><p>${s.d}</p>${btns}</div>`;
    }
    el.querySelector('.onb-next').onclick = () => { haptic(); if (s.demo){ end(); if (!S.demo) setDemo(true); return; } step(); };
    el.querySelector('.onb-skip').onclick = () => { haptic(); end(); };
    if (s.done){ const was = { tier: S.tier, ton: S.ton, gifts: S.gifts.length };
      poll = setInterval(() => { if (!el || !s.done(was)) return; clearInterval(poll);
        const c = el.querySelector('.onb-card'); c.classList.add('good'); c.querySelector('p').textContent = s.ok; haptic('light');
        setTimeout(() => { if (el && STEPS[i] === s) step(); }, 1100); }, 150); }
  }
  const step = () => { i++; i < STEPS.length ? show() : end(); };
  function end(){ clearInterval(poll); S.onb = false; el?.remove(); el = null; hole = null; LSset('bm-onb-done', true); restartAuto(); }
  ['pointerdown', 'click', 'touchstart'].forEach(t => stage.addEventListener(t, guard, { capture: true, passive: false }));
  return { start(force){ if (el || (!force && (S.dbg.noOnb || LS('bm-onb-done', false)))) return; S.onb = true; clearInterval(auto); i = 0;
    el = document.createElement('div'); el.className = 'onb'; stage.appendChild(el); show(); } };
})();
setTimeout(() => { if (!S.busy && !openDrawer) Onb.start(); }, 1400);
addEventListener('resize', () => requestAnimationFrame(() => { placeInd(); placeChance(); }));
/* если телефон не вытягивает анимации — предлагаем экономный режим */
if (!S.lite && !LS('bm-lite-asked', false)) setTimeout(() => { let n = 0, t0 = 0;
  (function probe(now){ if (document.hidden) return; if (!t0) t0 = now; n++;
    if (now - t0 < 4000) return requestAnimationFrame(probe);
    if (n / ((now - t0) / 1000) < 40 && !S.lite){ LSset('bm-lite-asked', true); notify({ type: 'warn', icon: 'leaf', ms: 8000, title: $t("Телефону тяжеловато"), text: $t("Включить экономный режим без анимаций?"), action: { label: $t("Да"), fn: () => setLite(true) } }); }
  })(performance.now()); }, 2500);

// приложение дошло до конца запуска — ловушка в boot.js проверяет этот флаг
window.APP_OK = 1;
