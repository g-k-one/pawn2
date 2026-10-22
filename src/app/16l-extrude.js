/* ═══════════════════════════════════════════════════════════════════════════
   ОБЪЁМ (Extrude) — псевдо-3D текст: N копий надписи стопкой в глубину, плавные градиенты, крутится пальцем.
   Один холст WebGL на надпись; копии — плоские квадраты с одной картинкой-маской, рисуются от дальней к ближней
   (параллельные плоскости — порядок всегда точный, буфер глубины не нужен).
   В маске: R — буква, G/B — нормаль кромки (посчитана один раз на CPU по размытой маске) — боковины освещаются
   как настоящие, за одну выборку текстуры. Лицо — градиент до 4 цветов + мягкий блик, который скользит при повороте;
   боковины — градиент по глубине (от лица к задней стенке) + свет.
   Рисует только когда что-то меняется: покой — ни одного кадра (iPhone не греется). spin — постоянное вращение, только для коротких показов.
   Extrude.mount(el, { text, depth, face, side, … }) → { set(opts), rotate(yaw, pitch), destroy() }
   Файл самодостаточный (без общих переменных приложения) — его же грузит лаборатория design/extrude.
   ═══════════════════════════════════════════════════════════════════════════ */
function makeExtrude(){
  const DEF = {
    text: 'PAWN', font: '800 {s}px SONGER, system-ui, sans-serif', size: 0,   // size 0 — подогнать под элемент
    depth: 36, layers: 0,           // layers 0 — сколько нужно, чтоб копии слились (≈ глубина в пикселях экрана)
    face: ['#ffffff', '#8fd0ff', '#2f8bff'], faceAngle: 90,   // градиент лица: цвета сверху вниз (угол 90°), до 4
    side: ['#1d63ff', '#0a1640'],   // боковины: от лица к задней стенке, до 4
    gloss: .55, ambient: .45, light: [-.45, .7, .55],   // блик, тень в тени, откуда свет (x вправо, y вверх, z к зрителю)
    yaw: -22, pitch: 12, persp: 900, // поза покоя (градусы) и перспектива (дальше — площе)
    drag: true, spring: true, spin: 0, // крутить пальцем; возвращаться в позу; постоянное вращение (°/с)
    pad: 1.25,                       // запас по краям под выступ боковин (в долях глубины)
    // отделка лица (по полю расстояний до кромки; выключенное ничего не стоит):
    strokes: [],                     // линии внутри кромки: [{ color, width, inset }] (px), до 2 — например, светлая линия с отступом и тёмный кант
    innerGlow: null,                 // { color, size } — лицо разгорается к кромке
    glow: null,                      // { color, size, strength } — свечение вокруг надписи, поверх боковин
    sideEmit: 0,                     // боковины светятся сами (0 — только свет, 1 — без теней)
    bevel: 0,                        // фаска по краю лица, px: кромка скошена и ловит свет, как у литой буквы
    round: false,                    // фаска круглая (купол), а не скос: с большой фаской и grow — надутые буквы (bubble)
    grow: 0,                         // буквы толще на N px, углы скругляются
    metal: 0, curve: 0,              // металл: отражение неба и земли (0–1); изгиб лица «подушкой» — линия горизонта бежит по буквам
    shine: { color: '#ffffff', width: .22, time: .9 },   // пробегающий блик: t.shine() — один проход; shineEvery — сам раз в N секунд
    shineEvery: 0,
    skew: 0,                         // наклон букв (курсив), доля высоты: .2 — заметно
    lite: false,                     // слабый телефон: один неподвижный кадр
    onMove: null,                    // (yaw, pitch) — для звука/вибрации снаружи
  };
  const hex = c => { c = c.replace('#', ''); if (c.length === 3) c = c.replace(/./g, x => x + x); const n = parseInt(c, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const ramp = a => { const o = new Float32Array(12); a.slice(0, 4).forEach((c, i) => o.set(hex(c), i * 3)); return o; };

  const VS = `attribute vec3 aP;
uniform vec2 uSz, uRes, uIn; uniform float uDep, uN, uCam, uFront; uniform mat3 uR;
varying vec2 vUV, vS; varying float vL;
void main(){ vL = aP.z;
  // боковинам поле под свечение не нужно — их квадрат ужат до букв (меньше пустых точек)
  vUV = abs(aP.z - uFront) < .5 ? aP.xy : mix(uIn, 1. - uIn, aP.xy);
  float t = aP.z / max(uN - 1., 1.);
  vec3 p = uR * vec3((vUV.x - .5) * uSz.x, (.5 - vUV.y) * uSz.y, (.5 - t) * uDep);
  float k = uCam / max(uCam - p.z, 1.);
  gl_Position = vec4(p.xy * k / (uRes * .5), 0., 1.); vS = gl_Position.xy; }`;
  const FS = `precision highp float;
uniform sampler2D uTex, uSdf; uniform mat3 uR; uniform vec2 uDr; uniform float uN, uFront, uGloss, uAmb, uFc, uSc, uIgS, uGlS, uGlR, uEmit;
uniform vec3 uF[4], uS[4], uL, uK1C, uK2C, uIgC, uGlC, uShC; uniform vec2 uFd, uK1, uK2, uTx;
uniform float uBev, uRound, uMet, uCurv, uShX, uShW;
varying vec2 vUV, vS; varying float vL;
// металл: отражение выдуманного окружения — светлое небо, резкий горизонт, тёмная земля, яркое пятно от света
vec3 env(vec3 n, vec3 c){
  vec3 r = vec3(0., 0., -1.) + 2. * n.z * n;   // отражение взгляда (смотрим вдоль −z)
  float y = r.y + .28;
  vec3 sky = mix(c * 1.15, vec3(1.), smoothstep(.15, .95, y) * .7), gr = mix(c * .12, c * .55, smoothstep(-.9, -.05, y));
  return mix(gr, sky, smoothstep(-.04, .04, y)) + pow(max(dot(r, uL), 0.), 40.) * .9; }
// расстояние до кромки, px (внутри — минус): внутри и снаружи своя шкала
float sd(vec2 uv){ float v = texture2D(uSdf, uv).r - .5; return v * (v < 0. ? uDr.x : uDr.y); }
// блик-полоса по экрану (наискосок), uShX < −2 — выключен
float sweep(){ return uShX < -2. ? 0. : exp(-pow((vS.x + vS.y * .35 - uShX) / uShW, 2.)); }
vec3 rampF(float x){ x = clamp(x, 0., 1.) * (uFc - 1.); vec3 c = uF[0];
  for (int i = 1; i < 4; i++){ float f = float(i); if (f < uFc) c = mix(c, uF[i], clamp(x - f + 1., 0., 1.)); } return c; }
vec3 rampS(float x){ x = clamp(x, 0., 1.) * (uSc - 1.); vec3 c = uS[0];
  for (int i = 1; i < 4; i++){ float f = float(i); if (f < uSc) c = mix(c, uS[i], clamp(x - f + 1., 0., 1.)); } return c; }
// полоса внутри кромки: от inset до inset + width (px), мягкие края
float band(float x, vec2 k){ return k.y <= 0. ? 0. : smoothstep(k.x - .7, k.x + .3, x) * (1. - smoothstep(k.x + k.y - .3, k.x + k.y + .7, x)); }
void main(){
  vec4 m = texture2D(uTex, vUV); float a = m.r;
  bool face = abs(vL - uFront) < .5;
  if (a < .004 && !(face && uGlS > 0.)) discard;
  vec3 col;
  if (face){   // лицо (или задняя стенка, когда смотрим сзади)
    float zs = uFront < .5 ? 1. : -1.;
    float dd = sd(vUV);
    // нормаль лица: плоско, плюс «подушка» и фаска у кромки (направление — по полю расстояний, наружу)
    vec3 nl = vec3((vUV - .5) * vec2(1., -1.) * uCurv, 1.);
    if (uRound > 0.) nl.xy += (m.gb * 2. - 1.) * 2.;   // купол: наклон из маски
    else if (uBev > 0.){
      vec2 g = vec2(sd(vUV + vec2(uTx.x, 0.)) - sd(vUV - vec2(uTx.x, 0.)), sd(vUV - vec2(0., uTx.y)) - sd(vUV + vec2(0., uTx.y)));
      float t = clamp(1. + dd / uBev, 0., 1.), th = t * t * 1.15;   // у самой кромки скос ~65°, к середине — плоско
      nl.xy += normalize(g + 1e-6) * tan(th); }
    nl = normalize(nl); nl.z *= zs;
    vec3 n = uR * nl, base = rampF(dot(vUV - .5, uFd) + .5);
    col = base * (.72 + .28 * max(dot(n, uL), 0.));
    float sh = .45 - n.x * 1.1 + n.y * .5;   // мягкий блик: полоса по диагонали, едет вслед за поворотом
    col += exp(-pow((vUV.x * .8 + vUV.y * .45 - sh) * 2.6, 2.)) * uGloss * .55;
    if (uBev > 0. || uRound > 0.) col += pow(max(dot(n, normalize(uL + vec3(0., 0., 1.))), 0.), 30.) * uGloss * max(uRound, step(-uBev, dd));
    if (uRound > 0.) col += pow(max(dot(n, normalize(uL + vec3(0., 0., 1.))), 0.), 160.) * uGloss * 1.4;   // пластик: резкое белое пятно поверх мягкого
    if (uMet > 0.) col = mix(col, env(n, base), uMet);
    if (uIgS > 0.) col = mix(col, uIgC, exp(min(dd, 0.) / uIgS) * .85);
    col = mix(col, uK1C, band(-dd, uK1)); col = mix(col, uK2C, band(-dd, uK2));
    col += uShC * sweep();
    if (uGlS > 0.){ gl_FragColor = vec4(col * a + uGlC * uGlS * exp(-max(dd, 0.) / uGlR) * (1. - smoothstep(.55, 1., dd / (uDr.y * .5))) * (1. - a), a); return; }   // свечение — сложением, прозрачность не трогает; к краю поля гаснет в ноль (иначе виден квадрат)
  } else {                      // боковина: цвет по глубине + свет по нормали кромки
    vec2 e = m.gb * 2. - 1.; float el = length(e);
    vec3 n = uR * vec3(e / max(el, .001), 0.);
    float d = el > .06 ? max(dot(n, uL), 0.) : .35;
    float sp = el > .06 ? pow(max(dot(n, normalize(uL + vec3(0., 0., 1.))), 0.), 22.) : 0.;
    vec3 b = rampS(vL / max(uN - 1., 1.));
    col = mix(b * (uAmb + (1. - uAmb) * d), b, uEmit) + sp * uGloss * .5;
    if (uMet > 0. && el > .06) col = mix(col, env(n, b), uMet * .8);
    col += uShC * sweep() * .6;
  }
  gl_FragColor = vec4(col * a, a); }`;

  function mount(el, opts){
    const o = Object.assign({}, DEF, opts);
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block' + (o.drag ? ';touch-action:none;cursor:grab' : '');
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(cv);
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });   // края и так гладкие за счёт маски — сглаживание холста только тратит видеопамять
    let yaw = o.yaw, pitch = o.pitch, vy = 0, vp = 0, held = false, raf = 0, last = 0, dead = false;
    let N = 0, n = 0, frames = 0, sdf = null, inset = [0, 0], dr = [1, 1], tx = [0, 0], shT = -1, shTimer = 0, sz = [1, 1], cw = 1, ch = 1, dpr = 1, tex = null, bufF = null, bufB = null, prog = null, U = {};

    if (!gl){ el.textContent = o.text; return { set(){}, rotate(){}, destroy(){ cv.remove(); } }; }   // без WebGL — просто текст
    const sh = (t, s) => { const h = gl.createShader(t); gl.shaderSource(h, s); gl.compileShader(h); if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(h)); return h; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    ['uSz', 'uRes', 'uDep', 'uN', 'uCam', 'uR', 'uTex', 'uFront', 'uGloss', 'uAmb', 'uFc', 'uSc', 'uF', 'uS', 'uL', 'uFd', 'uIn', 'uSdf', 'uDr', 'uIgS', 'uGlS', 'uGlR', 'uEmit', 'uK1C', 'uK2C', 'uIgC', 'uGlC', 'uK1', 'uK2', 'uTx', 'uBev', 'uRound', 'uMet', 'uCurv', 'uShX', 'uShW', 'uShC'].forEach(k => U[k] = gl.getUniformLocation(prog, k));
    const aP = gl.getAttribLocation(prog, 'aP'); gl.enableVertexAttribArray(aP);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    bufF = gl.createBuffer(); bufB = gl.createBuffer(); tex = gl.createTexture(); sdf = gl.createTexture();

    // стопка квадратов: два буфера — от задней к лицу и наоборот (когда смотрим сзади)
    function geom(){
      const q = i => [0, 0, i, 1, 0, i, 0, 1, i, 1, 0, i, 1, 1, i, 0, 1, i], f = [], b = [];
      for (let i = N; i--;) f.push(...q(i));
      for (let i = 0; i < N; i++) b.push(...q(i));
      gl.bindBuffer(gl.ARRAY_BUFFER, bufF); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(f), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b), gl.STATIC_DRAW);
    }
    // запас под свечение (px картинки) — сторона квадрата лица больше букв на него
    const glowPx = () => o.glow ? Math.ceil(o.glow.size * 3 * dpr) : 0;
    function build(){
      dpr = Math.min(2, devicePixelRatio || 1); cw = Math.max(1, el.clientWidth); ch = Math.max(1, el.clientHeight);
      cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
      const room = o.depth * o.pad * 2 + 8 + (o.glow ? o.glow.size * 2 : 0);
      let fs = o.size;
      if (!fs){   // подгонка: надпись с запасом под боковины и свечение
        const x = document.createElement('canvas').getContext('2d'); x.font = o.font.replace('{s}', 100);
        const ls = String(o.text).split('\n'), tw = Math.max(1, ...ls.map(l => x.measureText(l).width)) + 105 * ls.length * Math.abs(o.skew || 0) + (o.grow || 0) * 2;
        fs = Math.max(8, Math.min((cw - room) / tw * 100, (ch - room) / (1.05 * ls.length)));
      }
      const m = maskData(fs);
      sz = [m.W / dpr, m.H / dpr]; inset = [m.gp / m.W, m.gp / m.H]; dr = [m.rIn * 2 / dpr, m.rOut * 2 / dpr]; tx = [1.5 / m.W, 1.5 / m.H];
      N = o.layers || Math.max(8, Math.min(128, Math.round(o.depth * dpr * .9)));
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      const up = (t, unit, fmt, data) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        if (data instanceof Uint8Array) gl.texImage2D(gl.TEXTURE_2D, 0, fmt, m.W, m.H, 0, fmt, gl.UNSIGNED_BYTE, data); else gl.texImage2D(gl.TEXTURE_2D, 0, fmt, fmt, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); };
      up(tex, 0, gl.RGBA, m.img); up(sdf, 1, gl.LUMINANCE, m.sdf); gl.activeTexture(gl.TEXTURE0);
      geom(); colors(); draw();
    }
    // расстояние до ближайшей точки маски (Фельценшвальб): проход по столбцам, потом по строкам; g — квадраты расстояний
    function edt(g, W, H){
      const L = Math.max(W, H), f = new Float64Array(L), d = new Float64Array(L), v = new Int32Array(L), z = new Float64Array(L + 1);
      const one = len => { let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
        for (let q = 1; q < len; q++){
          let s = (f[q] + q * q - f[v[k]] - v[k] * v[k]) / (2 * q - 2 * v[k]);
          while (s <= z[k]){ k--; s = (f[q] + q * q - f[v[k]] - v[k] * v[k]) / (2 * q - 2 * v[k]); }
          k++; v[k] = q; z[k] = s; z[k + 1] = 1e20; }
        k = 0; for (let q = 0; q < len; q++){ while (z[k + 1] < q) k++; const r = v[k]; d[q] = (q - r) * (q - r) + f[r]; } };
      for (let x = 0; x < W; x++){ for (let y = 0; y < H; y++) f[y] = g[y * W + x]; one(H); for (let y = 0; y < H; y++) g[y * W + x] = d[y]; }
      for (let y = 0; y < H; y++){ for (let x = 0; x < W; x++) f[x] = g[y * W + x]; one(W); for (let x = 0; x < W; x++) g[y * W + x] = d[x]; }
    }
    // маска + нормали в одну картинку RGBA (R — буква, G/B — нормаль, A — непрозрачно, чтобы браузер не трогал цвет)
    // и поле расстояний до кромки — отдельная серая картинка, считается только если есть отделка лица
    function maskData(fs){
      const lines = String(o.text).split('\n'), c = document.createElement('canvas'), x = c.getContext('2d'), font = o.font.replace('{s}', fs * dpr);
      x.font = font;
      const lh = fs * dpr * 1.05, sk = o.skew || 0, r = Math.max(2, Math.round(dpr * 2.5)), gp = glowPx(), gw = (o.grow || 0) * dpr, pad = r * 2 + 2 + gp + gw;
      const tw = Math.max(1, ...lines.map(l => x.measureText(l).width)) + Math.abs(sk) * lh * lines.length + gw * 2;
      const W = Math.min(2048, Math.ceil(tw + pad * 2)), H = Math.min(2048, Math.ceil(lh * lines.length + pad * 2));
      c.width = W; c.height = H; x.font = font; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.setTransform(1, 0, -sk, 1, sk * H / 2, 0);   // курсив: верх уходит вправо, середина на месте
      if (gw){ x.strokeStyle = '#fff'; x.lineWidth = gw * 2; x.lineJoin = 'round'; }
      lines.forEach((l, i) => { const y = H / 2 + (i - (lines.length - 1) / 2) * lh; x.fillText(l, W / 2, y); if (gw) x.strokeText(l, W / 2, y); });
      const img = x.getImageData(0, 0, W, H), d = img.data, n = W * H, A = new Float32Array(n), T = new Float32Array(n);
      for (let i = 0; i < n; i++) A[i] = d[i * 4 + 3] / 255;
      // размытие скользящим окном: строки, потом столбцы, дважды — почти гаусс
      const pass = (src, dst, horiz, r = rb) => { const L = horiz ? W : H, M = horiz ? H : W, at = (j, k) => horiz ? j * W + k : k * W + j;
        for (let j = 0; j < M; j++){ let s = 0; for (let k = 0; k <= r && k < L; k++) s += src[at(j, k)];
          for (let k = 0; k < L; k++){ dst[at(j, k)] = s / (r * 2 + 1); if (k + r + 1 < L) s += src[at(j, k + r + 1)]; if (k - r >= 0) s -= src[at(j, k - r)]; } } }, rb = r;
      const Bl = A.slice(), rr = o.round ? Math.max(r, Math.round((o.bevel || 8) * dpr / 2)) : r;
      for (let p = 0; p < (o.round ? 3 : 2); p++){ pass(Bl, T, true, rr); pass(T, Bl, false, rr); }
      const ks = o.round ? rr * 1.5 : 0;   // наклон купола: перепад высоты на пиксель × радиус
      for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++){
        const i = y * W + xx, g = (a, b) => Bl[Math.min(H - 1, Math.max(0, y + b)) * W + Math.min(W - 1, Math.max(0, xx + a))];
        const gx = g(1, 0) - g(-1, 0), gy = g(0, 1) - g(0, -1), l = Math.hypot(gx, gy);
        // наружу = против роста маски; в картинке y вниз, в мире — вверх
        const q = ks ? ks / 2 : 1 / Math.max(l, 1e-4);   // купол: наклон (до 2, ужат в 0–1); обычно — только направление
        const nx = l > 1e-4 ? Math.max(-1, Math.min(1, -gx * q)) : 0, ny = l > 1e-4 ? Math.max(-1, Math.min(1, gy * q)) : 0;
        d[i * 4] = A[i] * 255; d[i * 4 + 1] = (nx * .5 + .5) * 255; d[i * 4 + 2] = (ny * .5 + .5) * 255; d[i * 4 + 3] = 255;
      }
      // поле: + снаружи, − внутри (px картинки), кромка — где буква наполовину прозрачна; дальность — до самой дальней отделки
      const rIn = Math.max(4, ...(o.strokes || []).map(k => ((k.inset || 0) + k.width) * dpr + 2), o.innerGlow ? o.innerGlow.size * 3 * dpr : 0, o.bevel ? o.bevel * dpr + 3 : 0), rOut = Math.max(4, gp);
      const sdf = new Uint8Array(n).fill(128);
      if (o.strokes?.length || o.innerGlow || o.glow || o.bevel){
        const out = new Float64Array(n), inn = new Float64Array(n);
        for (let i = 0; i < n; i++){ const on = A[i] >= .5; out[i] = on ? 0 : 1e20; inn[i] = on ? 1e20 : 0; }
        edt(out, W, H); edt(inn, W, H);
        // у самой кромки — по прозрачности (доли пикселя), дальше — по расстоянию; потом сгладить, чтобы не было ступенек на диагоналях
        const F = new Float32Array(n);
        for (let i = 0; i < n; i++) F[i] = A[i] > .02 && A[i] < .98 ? .5 - A[i] : out[i] > 0 ? Math.sqrt(out[i]) - .5 : .5 - Math.sqrt(inn[i]);
        const sr = Math.max(1, Math.round(dpr));   // ~1 px экрана: ступеньки уходят, острые углы почти не тупятся
        for (let p = 0; p < 2; p++){ pass(F, T, true, sr); pass(T, F, false, sr); }
        const bw = sr * 4 + 2;   // полоса у края картинки — всегда «далеко снаружи», иначе по краю свечения видна рамка
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < bw || y < bw || x >= W - bw || y >= H - bw) F[y * W + x] = 1e3;
        for (let i = 0; i < n; i++){ const dd = F[i];
          sdf[i] = Math.max(0, Math.min(255, Math.round((.5 + dd / (2 * (dd < 0 ? rIn : rOut))) * 255))); }
      }
      return { W, H, img, sdf, gp, rIn, rOut };
    }
    function colors(){
      const a = o.faceAngle * Math.PI / 180, L = o.light, ll = Math.hypot(...L) || 1;
      gl.uniform3fv(U.uF, ramp(o.face)); gl.uniform1f(U.uFc, Math.min(4, o.face.length));
      gl.uniform3fv(U.uS, ramp(o.side)); gl.uniform1f(U.uSc, Math.min(4, o.side.length));
      gl.uniform2f(U.uFd, Math.cos(a), Math.sin(a)); gl.uniform3f(U.uL, L[0] / ll, L[1] / ll, L[2] / ll);
      gl.uniform1f(U.uGloss, o.gloss); gl.uniform1f(U.uAmb, o.ambient); gl.uniform1f(U.uEmit, o.sideEmit || 0);
      const k = o.strokes || [], ig = o.innerGlow, g = o.glow;
      [[U.uK1, U.uK1C, k[0]], [U.uK2, U.uK2C, k[1]]].forEach(([w, c, s]) => { gl.uniform2f(w, s ? s.inset || 0 : 0, s ? s.width : 0); gl.uniform3fv(c, hex(s ? s.color : '#000')); });
      gl.uniform1f(U.uIgS, ig ? ig.size : 0); gl.uniform3fv(U.uIgC, hex(ig ? ig.color : '#000'));
      gl.uniform1f(U.uGlS, g ? g.strength ?? 1 : 0); gl.uniform1f(U.uGlR, g ? g.size : 1); gl.uniform3fv(U.uGlC, hex(g ? g.color : '#000'));
      gl.uniform1f(U.uBev, o.bevel || 0); gl.uniform1f(U.uRound, o.round ? 1 : 0); gl.uniform1f(U.uMet, o.metal || 0); gl.uniform1f(U.uCurv, o.curve || 0);
      gl.uniform3fv(U.uShC, hex(o.shine.color)); gl.uniform1f(U.uShW, o.shine.width);
      gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uSdf, 1);
    }
    function draw(){
      if (dead) return; frames++;
      const Y = yaw * Math.PI / 180, P = pitch * Math.PI / 180, cy = Math.cos(Y), sy = Math.sin(Y), cp = Math.cos(P), sp = Math.sin(P);
      // R = Rx(pitch) · Ry(yaw), по столбцам (как ждёт WebGL)
      const R = [cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy];
      const front = R[8] >= 0;   // z лица после поворота: к нам — лицо, от нас — задняя стенка
      // копий — сколько пикселей выступает боковина под этим углом (+ разница перспективы у краёв): анфас — мало, в профиль — все
      n = o.layers ? N : Math.max(4, Math.min(N, Math.ceil(o.depth * dpr * (Math.hypot(R[6], R[7]) + Math.max(sz[0], sz[1]) / 2 / o.persp) * .9) + 2));
      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniformMatrix3fv(U.uR, false, R);
      gl.uniform2f(U.uSz, sz[0], sz[1]); gl.uniform2f(U.uRes, cw, ch); gl.uniform1f(U.uDep, o.depth); gl.uniform1f(U.uN, n);
      gl.uniform1f(U.uCam, o.persp); gl.uniform1f(U.uFront, front ? 0 : n - 1); gl.uniform2f(U.uIn, inset[0], inset[1]); gl.uniform2f(U.uDr, dr[0], dr[1]); gl.uniform2f(U.uTx, tx[0], tx[1]);
      gl.uniform1f(U.uShX, shT < 0 ? -9 : -1.8 + shT * 3.6);   // блик идёт слева направо через весь холст
      // ближние n копий: в bufF они в хвосте (от задней к лицу), в bufB — в начале
      gl.bindBuffer(gl.ARRAY_BUFFER, front ? bufF : bufB); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, front ? (N - n) * 72 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, n * 6);
    }

    // движение: инерция после броска, пружина в позу покоя, вращение — кадры идут, только пока что-то движется
    function tick(t){
      raf = 0; const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
      if (!held){
        const sp = o.spin && !calm;   // при постоянном вращении пружина держит только наклон
        if (o.spring){ if (!sp) vy += ((o.yaw - yaw) * 60 - vy * 9) * dt; else vy *= Math.exp(-dt * 3); vp += ((o.pitch - pitch) * 60 - vp * 9) * dt; }
        else { const f = Math.exp(-dt * 3); vy *= f; vp *= f; }
        yaw += (vy + (calm ? 0 : o.spin)) * dt; pitch = Math.max(-80, Math.min(80, pitch + vp * dt));
      }
      if (shT >= 0){ shT += dt / o.shine.time; if (shT > 1) shT = -1; }
      draw(); o.onMove?.(yaw, pitch);
      const still = Math.abs(vy) + Math.abs(vp) < .4 && (!o.spring || Math.abs(o.yaw - yaw) + Math.abs(o.pitch - pitch) < .05);
      if (held || (o.spin && !calm) || !still || shT >= 0) raf = requestAnimationFrame(tick); else last = 0;
    }
    // lite — один неподвижный кадр, без вращения; «уменьшение движения» в системе — без постоянного вращения и броска
    const rm = matchMedia('(prefers-reduced-motion: reduce)');
    let calm = rm.matches; rm.addEventListener?.('change', e => { calm = e.matches; });
    const wake = () => { if (dead) return; if (o.lite){ yaw = o.yaw; pitch = o.pitch; vy = vp = 0; draw(); return; } if (!raf) raf = requestAnimationFrame(tick); };

    let px = 0, py = 0, pt = 0;
    const down = e => { if (!o.drag || o.lite) return; held = true; px = e.clientX; py = e.clientY; pt = performance.now(); vy = vp = 0; cv.setPointerCapture?.(e.pointerId); cv.style.cursor = 'grabbing'; wake(); };
    const move = e => { if (!held) return; const now = performance.now(), dt = Math.max(1, now - pt) / 1000, dx = e.clientX - px, dy = e.clientY - py;
      yaw += dx * .5; pitch = Math.max(-80, Math.min(80, pitch - dy * .5));
      vy = vy * .5 + dx * .5 / dt * .5; vp = vp * .5 - dy * .5 / dt * .5; px = e.clientX; py = e.clientY; pt = now; };
    const up = () => { if (!held) return; held = false; cv.style.cursor = 'grab';
      if (o.spring) yaw = o.yaw + ((yaw - o.yaw) % 360 + 540) % 360 - 180;   // к позе — ближним путём, без лишних оборотов
      if (calm || performance.now() - pt > 80) vy = vp = 0; wake(); };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    // размер меняется — пересобрать один раз, когда успокоится (маска считается на процессоре)
    let rt = 0, ow = el.clientWidth, oh = el.clientHeight;
    const ro = new ResizeObserver(() => { if (el.clientWidth === ow && el.clientHeight === oh) return; ow = el.clientWidth; oh = el.clientHeight;
      clearTimeout(rt); rt = setTimeout(() => !dead && build(), 150); }); ro.observe(el);
    cv.addEventListener('webglcontextrestored', () => build());

    // шрифт ещё не загружен — нарисовать запасным и пересобрать один раз, когда придёт
    // блик: один проход по команде или сам раз в shineEvery секунд (между проходами — ни кадра)
    const shine = () => { if (dead || o.lite || calm) return; shT = 0; wake(); };
    const shLoop = () => { clearTimeout(shTimer); if (o.shineEvery > 0) shTimer = setTimeout(() => { shine(); shLoop(); }, o.shineEvery * 1000); };
    shLoop();
    const fk = o.font.replace('{s}', 100);
    build(); if (document.fonts && !document.fonts.check(fk)) document.fonts.load(fk).then(() => !dead && build(), () => {});
    if (o.spin) wake();
    return {
      set(p){ if ('shineEvery' in p && p.shineEvery !== o.shineEvery) setTimeout(shLoop);
        const re = ['text', 'font', 'size', 'depth', 'layers', 'pad', 'skew', 'strokes', 'innerGlow', 'glow', 'bevel', 'grow'].some(k => k in p && p[k] !== o[k]);
        Object.assign(o, p); yaw = o.yaw + ((yaw - o.yaw) % 360 + 540) % 360 - 180;   // после вращения — к позе ближним путём
        if (re) build(); else { colors(); draw(); }
        cv.style.touchAction = o.drag && !o.lite ? 'none' : ''; cv.style.cursor = o.drag && !o.lite ? 'grab' : ''; wake(); },
      // повернуть программно (например, «встряхнуть» надпись при выигрыше); с пружиной сама вернётся
      rotate(dy, dp = 0, kick = false){ if (kick){ vy += dy; vp += dp; } else { yaw = dy; pitch = dp; } wake(); },
      shine,
      get pose(){ return { yaw, pitch }; },
      get stats(){ return { layers: n, max: N, frames }; },   // для замера: копий в последнем кадре, сколько всего, кадров нарисовано
      destroy(){ dead = true; cancelAnimationFrame(raf); clearTimeout(rt); clearTimeout(shTimer); ro.disconnect(); gl.getExtension('WEBGL_lose_context')?.loseContext(); cv.remove(); },
    };
  }
  return { mount, defaults: DEF };
}
const Extrude = makeExtrude();
