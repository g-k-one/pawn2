/* ═══════════════════════════════════════════════════════════════════════════
   ОБЪЁМ (Extrude) — псевдо-3D текст: буквы с толщиной, плавные градиенты, крутится пальцем.
   Один холст WebGL на надпись. Рендер «лучом» (по умолчанию): каждая буква — одна коробка своей толщины, для каждой точки
   шейдер пускает луч от глаза и шагает по полю расстояний буквы (sphere tracing выдавленного 2D SDF): лицо — за 1 шаг,
   боковины и края — за несколько; честная нормаль, круглая фаска, сглаживание по ближнему промаху, без стопки слоёв и смешивания.
   Запасной рендер «слоями» (render: 'layers'): N копий-квадратов стопкой в глубину, от дальней к ближней.
   Лицо — градиент до 4 цветов + мягкий блик, который скользит при повороте; боковины — градиент по глубине (от лица к задней стенке) + свет.
   Рисует только когда что-то меняется: покой — ни одного кадра (iPhone не греется). spin — постоянное вращение, только для коротких показов.
   Extrude.mount(el, { text, depth, face, side, … }) → { set(opts), rotate(yaw, pitch), destroy() }
   Файл самодостаточный (без общих переменных приложения) — его же грузит лаборатория design/extrude.
   ═══════════════════════════════════════════════════════════════════════════ */
function makeExtrude(){
  const DEF = {
    text: 'PAWN', font: '800 {s}px SONGER, system-ui, sans-serif', size: 0,   // size 0 — подогнать под элемент
    depth: 36, layers: 0,           // layers — только для render: 'layers' (0 — сколько нужно, чтоб копии слились)
    render: 'ray',                   // 'ray' — лучом (быстро, честная фаска); 'layers' — стопкой копий (запасной, для сравнения)
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
    bevel: 0,                        // фаска по краю лица, px: кромка скруглена и ловит свет, как у литой буквы (лучом — настоящая, в геометрии)
    metal: 0, curve: 0,              // металл: отражение неба и земли (0–1); изгиб лица «подушкой» — линия горизонта бежит по буквам
    shine: { color: '#ffffff', width: .22, time: .9 },   // пробегающий блик: t.shine() — один проход; shineEvery — сам раз в N секунд
    shineEvery: 0,
    skew: 0,                         // наклон букв (курсив), доля высоты: .2 — заметно
    charset: '',                     // знаки, заранее положенные в атлас: смена текста из них — без пересборки (счётчик: '0123456789.')
    fit: '',                         // по какой строке подбирать размер (счётчик: '0000.00' — размер не скачет, пока растёт число)
    lite: false,                     // слабый телефон: один неподвижный кадр
    onMove: null,                    // (yaw, pitch) — для звука/вибрации снаружи
  };
  const hex = c => { c = c.replace('#', ''); if (c.length === 3) c = c.replace(/./g, x => x + x); const n = parseInt(c, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const ramp = a => { const o = new Float32Array(12); a.slice(0, 4).forEach((c, i) => o.set(hex(c), i * 3)); return o; };

  // буквы: у каждой своя ячейка в атласе и своё движение (uLT: сдвиг x, y, масштаб, поворот; uLZ: сдвиг к зрителю, прозрачность)
  const VS = `attribute vec3 aP; attribute vec4 aQ; attribute vec3 aA;
uniform vec2 uSz, uRes, uInPx, uInUV; uniform float uDep, uN, uCam, uFront; uniform mat3 uR;
uniform vec4 uLT[32]; uniform vec4 uLZ[32]; uniform vec2 uLS[32];
varying vec2 vUV, vS, vT, vRot; varying float vL, vA;
void main(){ vL = aP.z;
  int i = int(aA.z + .5); vec4 T = uLT[i]; vec4 Z = uLZ[i]; vA = Z.y;
  vec2 loc = aQ.xy; vUV = aP.xy;
  vT = vec2((aA.x + loc.x) / uSz.x + .5, .5 - (aA.y + loc.y) / uSz.y);   // место в надписи 0–1 — для градиента лица, без учёта движения
  // боковинам поле под свечение не нужно — их квадрат ужат до буквы (меньше пустых точек)
  if (abs(aP.z - uFront) >= .5){ loc -= aQ.zw * uInPx; vUV -= aQ.zw * vec2(uInUV.x, -uInUV.y); }
  float c = cos(T.w), s = sin(T.w); vRot = vec2(c, s);
  loc = mat2(c, s, -s, c) * (loc * uLS[i]) * T.z;
  float t = aP.z / max(uN - 1., 1.);
  vec3 p = uR * vec3(aA.xy + loc + T.xy, (.5 - t) * uDep * T.z + Z.x);
  float k = uCam / max(uCam - p.z, 1.);
  gl_Position = vec4(p.xy * k / (uRes * .5), 0., 1.); vS = gl_Position.xy; }`;
  // общее для обоих рендеров: окружение металла, поле расстояний, блик-полоса, градиенты, полосы обводок
  const FCOM = `precision highp float;
uniform sampler2D uSdf; uniform vec2 uDr, uFd, uK1, uK2; uniform float uGloss, uAmb, uFc, uSc, uIgS, uGlS, uGlR, uEmit, uMet, uCurv, uShX, uShW, uBoost;
uniform vec3 uF[4], uS[4], uL, uK1C, uK2C, uIgC, uGlC, uShC;
varying vec2 vS; varying float vA;
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
`;
  // рендер слоями: копия-квадрат на букву, лицо — ближняя копия
  const FS = FCOM + `uniform sampler2D uTex; uniform mat3 uR; uniform float uN, uFront, uBev; uniform vec2 uTx;
varying vec2 vUV, vT, vRot; varying float vL;
vec2 rot(vec2 v){ return vec2(vRot.x * v.x - vRot.y * v.y, vRot.y * v.x + vRot.x * v.y); }
void main(){
  vec4 m = texture2D(uTex, vUV); float a = m.r;
  bool face = abs(vL - uFront) < .5;
  if (a < .004 && !(face && uGlS > 0.)) discard;
  vec3 col;
  if (face){   // лицо (или задняя стенка, когда смотрим сзади)
    float zs = uFront < .5 ? 1. : -1.;
    float dd = sd(vUV);
    // нормаль лица: плоско, плюс «подушка» и фаска у кромки (направление — по полю расстояний, наружу)
    vec3 nl = vec3((vT - .5) * vec2(1., -1.) * uCurv, 1.);
    if (uBev > 0.){
      vec2 g = vec2(sd(vUV + vec2(uTx.x, 0.)) - sd(vUV - vec2(uTx.x, 0.)), sd(vUV - vec2(0., uTx.y)) - sd(vUV + vec2(0., uTx.y)));
      float t = clamp(1. + dd / uBev, 0., 1.), th = t * t * 1.15;   // у самой кромки скос ~65°, к середине — плоско
      nl.xy += normalize(g + 1e-6) * tan(th); }
    nl.xy = rot(nl.xy); nl = normalize(nl); nl.z *= zs;
    vec3 n = uR * nl, base = rampF(dot(vT - .5, uFd) + .5);
    col = base * (.72 + .28 * max(dot(n, uL), 0.));
    float sh = .45 - n.x * 1.1 + n.y * .5;   // мягкий блик: полоса по диагонали, едет вслед за поворотом
    col += exp(-pow((vT.x * .8 + vT.y * .45 - sh) * 2.6, 2.)) * uGloss * .55;
    if (uBev > 0.) col += pow(max(dot(n, normalize(uL + vec3(0., 0., 1.))), 0.), 30.) * uGloss * step(-uBev, dd);
    if (uMet > 0.) col = mix(col, env(n, base), uMet);
    if (uIgS > 0.) col = mix(col, uIgC, exp(min(dd, 0.) / uIgS) * .85);
    col = mix(col, uK1C, band(-dd, uK1)); col = mix(col, uK2C, band(-dd, uK2));
    col += uShC * sweep(); col *= 1. + uBoost * .6;
    if (uGlS > 0.){ gl_FragColor = vA * vec4(col * a + uGlC * uGlS * (1. + uBoost * 2.) * exp(-max(dd, 0.) / uGlR) * (1. - smoothstep(.55, 1., dd / (uDr.y * .5))) * (1. - a), a); return; }   // свечение — сложением, прозрачность не трогает; к краю поля гаснет в ноль (иначе виден квадрат)
  } else {                      // боковина: цвет по глубине + свет по нормали кромки
    vec2 e = rot(m.gb * 2. - 1.); float el = length(e);
    vec3 n = uR * vec3(e / max(el, .001), 0.);
    float d = el > .06 ? max(dot(n, uL), 0.) : .35;
    float sp = el > .06 ? pow(max(dot(n, normalize(uL + vec3(0., 0., 1.))), 0.), 22.) : 0.;
    vec3 b = rampS(vL / max(uN - 1., 1.));
    col = mix(b * (uAmb + (1. - uAmb) * d), b, uEmit) + sp * uGloss * .5;
    if (uMet > 0. && el > .06) col = mix(col, env(n, b), uMet * .8);
    col += uShC * sweep() * .6; col *= 1. + uBoost * .6;
  }
  gl_FragColor = vA * vec4(col * a, a); }`;

  // рендер лучом: коробка буквы (лицевые грани), луч в системе буквы, шаги по выдавленному полю расстояний
  // aB — угол коробки (px от опоры буквы, z = ±1 × половина толщины), aC — ячейка в атласе (u0, v0 верх, u1, v1 низ),
  // aE — края ячейки (px от опоры: лево, низ, право, верх), aA — опора буквы (px от центра надписи) и номер буквы
  const RVS = `attribute vec3 aB, aA; attribute vec4 aC, aE;
uniform vec2 uRes; uniform float uHd, uCam, uDpr; uniform mat3 uR;
uniform vec4 uLT[32]; uniform vec4 uLZ[32]; uniform vec2 uLS[32];   // uLS: сжатие-растяжение буквы по ширине и высоте
varying vec3 vP, vE, vW0, vW1, vW2; varying vec4 vC, vRect; varying vec2 vAnc, vS; varying float vA, vPx;
mat3 rX(float a){ float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 rY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 rZ(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
void main(){
  int i = int(aA.z + .5); vec4 T = uLT[i]; vec4 Z = uLZ[i]; vA = Z.y;
  float s = max(T.z, .001);
  mat3 L = rZ(T.w) * rY(Z.w) * rX(Z.z);   // поворот буквы: в плоскости и перевороты
  vec3 sc = vec3(uLS[i], 1.) * s;   // масштаб буквы по осям
  vec3 lp = vec3(aB.xy, aB.z * uHd), off = vec3(aA.xy + T.xy, Z.x);
  vec3 wp = uR * (off + L * (lp * sc));
  float k = uCam / max(uCam - wp.z, 1.);
  gl_Position = vec4(wp.xy * k / (uRes * .5), 0., 1.); vS = gl_Position.xy;
  vE = ((vec3(0., 0., uCam) * uR - off) * L) / sc;   // глаз в системе буквы (обратные повороты = транспонированные); луч прямой и в сжатой букве
  vP = lp; vC = aC; vRect = aE; vAnc = aA.xy;
  mat3 W = uR * L; vW0 = W[0]; vW1 = W[1]; vW2 = W[2];
  vPx = 1. / (uDpr * k * min(sc.x, sc.y));   // сколько px буквы в одном пикселе экрана
}`;
  const RFS = FCOM + `uniform sampler2D uTex; uniform vec2 uSz; uniform float uHd, uBr;
varying vec3 vP, vE, vW0, vW1, vW2; varying vec4 vC, vRect; varying vec2 vAnc; varying float vPx;
vec2 uvOf(vec2 q){ vec2 f = clamp((q - vRect.xy) / (vRect.zw - vRect.xy), 0., 1.); return vec2(mix(vC.x, vC.z, f.x), mix(vC.w, vC.y, f.y)); }
float d2(vec2 q){ return sd(uvOf(q)); }
// буква с толщиной 2·uHd и круглой фаской uBr (iq: выдавливание 2D-поля со скруглением)
float map(vec3 p, float a0){ float a = a0 + uBr, b = abs(p.z) - uHd + uBr; return min(max(a, b), 0.) + length(max(vec2(a, b), 0.)) - uBr; }
void main(){
  vec3 ro = vP, rd = normalize(vP - vE);
  vec3 rs = vec3(abs(rd.x) < 1e-5 ? 1e-5 : rd.x, abs(rd.y) < 1e-5 ? 1e-5 : rd.y, abs(rd.z) < 1e-5 ? 1e-5 : rd.z);
  vec3 t1 = (vec3(vRect.xy, -uHd) - ro) / rs, t2 = (vec3(vRect.zw, uHd) - ro) / rs, tf = max(t1, t2);
  float tEx = min(min(tf.x, tf.y), tf.z);   // где луч выходит из коробки
  float t = 0., dm = 1e5, tm = 0., dc = 0., sm = 0.; bool gone = false;
  for (int k = 0; k < 56; k++){
    vec3 p = ro + rd * t; float a = d2(p.xy), d = map(p, a), st = max(d * .9, vPx * .75);   // чуть короче шага: 8-битное поле у углов привирает; вдоль грани — не мельче 0.75 px
    if (d < dm){ dm = d; tm = t; dc = a; sm = st; }
    if (d < vPx * .2) break;
    if (t > tEx){ gone = true; break; }
    t += st;
  }
  // промах рядом с силуэтом: шаги могли перешагнуть точку наибольшего сближения — уточнить её (тернарный поиск вокруг лучшей пробы),
  // иначе соседние пиксели края получают разное покрытие и край идёт пунктиром
  if (gone && dm < vPx * 2.){
    float lo = max(tm - sm, 0.), hi = tm + sm;
    for (int k = 0; k < 4; k++){
      float m1 = mix(lo, hi, .382), m2 = mix(lo, hi, .618); vec3 p1 = ro + rd * m1, p2 = ro + rd * m2;
      float a1 = d2(p1.xy), a2 = d2(p2.xy), f1 = map(p1, a1), f2 = map(p2, a2);
      if (f1 < dm){ dm = f1; tm = m1; dc = a1; } if (f2 < dm){ dm = f2; tm = m2; dc = a2; }
      if (f1 < f2) hi = m2; else lo = m1;
    }
  }
  // покрытие пикселя по ближнему промаху — гладкий край без MSAA; шаги кончились у самой поверхности (луч скользит вдоль грани) —
  // это попадание, а не промах: иначе на скользящих гранях рябь из полупрозрачных точек
  float cov = !gone && dm < vPx ? 1. : clamp(1. - dm / vPx, 0., 1.);
  vec3 col = vec3(0.);
  if (cov > 0.){
    vec3 p = ro + rd * tm; float zs = p.z >= 0. ? 1. : -1.;
    // нормаль кромки — гладкая, из атласа (посчитана по размытой маске); где её нет — по полю расстояний
    vec2 g = texture2D(uTex, uvOf(p.xy)).gb * 2. - 1.;
    g = length(g) > .2 ? normalize(g) : normalize(vec2(d2(p.xy + vec2(.75, 0.)) - dc, d2(p.xy + vec2(0., .75)) - dc) + 1e-6);
    float a = dc + uBr, b = abs(p.z) - uHd + uBr;
    // на круглой фаске — плавная нормаль; у острого ребра — нормаль ближайшей грани (промах чуть мимо ребра иначе ловит блик «между гранями» — искры)
    // грань лица, повёрнутая от зрителя (промах за задней кромкой), цвета не даёт — там видна боковина
    vec3 n = uBr > 0. && a > 0. && b > 0. ? normalize(vec3(g * a, zs * b)) : a > b || zs * rd.z > 0. ? vec3(g, 0.) : vec3(0., 0., zs);
    float wf = smoothstep(.3, .85, abs(n.z));   // лицо ↔ боковина (фаска — между)
    vec2 tt = vec2((vAnc.x + p.x) / uSz.x + .5, .5 - (vAnc.y + p.y) / uSz.y);   // место в надписи 0–1
    n.xy += (tt - .5) * vec2(1., -1.) * uCurv * wf; n = normalize(n);
    vec3 N = normalize(mat3(vW0, vW1, vW2) * n), H = normalize(uL + vec3(0., 0., 1.));
    float dif = max(dot(N, uL), 0.), spc = pow(max(dot(N, H), 0.), 30.);
    vec3 fb = rampF(dot(tt - .5, uFd) + .5), fc = fb * (.72 + .28 * dif);
    float sh = .45 - N.x * 1.1 + N.y * .5;   // мягкий блик: полоса по диагонали, едет вслед за поворотом
    fc += exp(-pow((tt.x * .8 + tt.y * .45 - sh) * 2.6, 2.)) * uGloss * .55 + spc * uGloss * step(.001, uBr) * (1. - wf * .5);
    if (uMet > 0.) fc = mix(fc, env(N, fb), uMet);
    if (uIgS > 0.) fc = mix(fc, uIgC, exp(min(dc, 0.) / uIgS) * .85);
    fc = mix(fc, uK1C, band(-dc, uK1)); fc = mix(fc, uK2C, band(-dc, uK2));
    vec3 sb = rampS((uHd - p.z) / (2. * uHd)), sc = mix(sb * (uAmb + (1. - uAmb) * dif), sb, uEmit) + pow(max(dot(N, H), 0.), 22.) * uGloss * .5;
    if (uMet > 0.) sc = mix(sc, env(N, sb), uMet * .8);
    col = mix(sc, fc, wf) + uShC * sweep() * mix(.6, 1., wf);
    col *= 1. + uBoost * .6;
  }
  // свечение: где луч прошёл мимо — по расстоянию до буквы на лицевой плоскости, обращённой к глазу
  vec3 glw = vec3(0.);
  if (uGlS > 0. && cov < 1.){
    float zf = vE.z >= 0. ? uHd : -uHd, tp = max((zf - ro.z) / rs.z, 0.), dg = max(d2((ro + rd * tp).xy), 0.);
    glw = uGlC * uGlS * (1. + uBoost * 2.) * exp(-dg / uGlR) * (1. - smoothstep(.55, 1., dg / (uDr.y * .5))) * (1. - cov);
  }
  gl_FragColor = vA * vec4(col * cov + glw, cov);
}`;

  // счёт по пикселям для атласа: R — буква, G/B — нормаль кромки, A — непрозрачно; sdf — расстояние до кромки.
  // Самодостаточная: её исходный текст запускается в фоновом потоке (Worker)
  function PROC(j){
    const { W, H, d, r, deco, rIn, rOut, sr } = j, n = W * H, A = new Float32Array(n), T = new Float32Array(n);
    for (let i = 0; i < n; i++) A[i] = d[i * 4 + 3] / 255;
    // размытие скользящим окном: строки, потом столбцы — почти гаусс за 2 прохода
    const bh = (a, b, r) => { const k = 1 / (r * 2 + 1); for (let y = 0; y < H; y++){ const o = y * W; let s = 0; for (let x = 0; x <= r && x < W; x++) s += a[o + x];
      for (let x = 0; x < W; x++){ b[o + x] = s * k; if (x + r + 1 < W) s += a[o + x + r + 1]; if (x >= r) s -= a[o + x - r]; } } };
    const bv = (a, b, r) => { const k = 1 / (r * 2 + 1); for (let x = 0; x < W; x++){ let s = 0; for (let y = 0; y <= r && y < H; y++) s += a[y * W + x];
      for (let y = 0; y < H; y++){ b[y * W + x] = s * k; if (y + r + 1 < H) s += a[(y + r + 1) * W + x]; if (y >= r) s -= a[(y - r) * W + x]; } } };
    const Bl = A.slice(); for (let p = 0; p < 2; p++){ bh(Bl, T, r); bv(T, Bl, r); }
    for (let i = 0; i < n; i++){ d[i * 4] = A[i] * 255; d[i * 4 + 1] = d[i * 4 + 2] = 128; d[i * 4 + 3] = 255; }
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++){
      const i = y * W + x, gx = Bl[i + 1] - Bl[i - 1], gy = Bl[i + W] - Bl[i - W], l = Math.hypot(gx, gy);
      if (l < 1e-4) continue;
      // наружу = против роста маски; в картинке y вниз, в мире — вверх; хранится только направление
      const nx = -gx / l, ny = gy / l;
      d[i * 4 + 1] = (nx * .5 + .5) * 255; d[i * 4 + 2] = (ny * .5 + .5) * 255; }
    const sdf = new Uint8Array(n).fill(128);
    if (deco){
      // расстояние до ближайшей точки (Фельценшвальб): столбцы, потом строки; g — квадраты расстояний
      const L = Math.max(W, H), f = new Float64Array(L), e = new Float64Array(L), v = new Int32Array(L), z = new Float64Array(L + 1);
      const one = len => { let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
        for (let q = 1; q < len; q++){ let s = (f[q] + q * q - f[v[k]] - v[k] * v[k]) / (2 * q - 2 * v[k]);
          while (s <= z[k]){ k--; s = (f[q] + q * q - f[v[k]] - v[k] * v[k]) / (2 * q - 2 * v[k]); }
          k++; v[k] = q; z[k] = s; z[k + 1] = 1e20; }
        k = 0; for (let q = 0; q < len; q++){ while (z[k + 1] < q) k++; const r = v[k]; e[q] = (q - r) * (q - r) + f[r]; } };
      const edt = g => { for (let x = 0; x < W; x++){ for (let y = 0; y < H; y++) f[y] = g[y * W + x]; one(H); for (let y = 0; y < H; y++) g[y * W + x] = e[y]; }
        for (let y = 0; y < H; y++){ const o = y * W; for (let x = 0; x < W; x++) f[x] = g[o + x]; one(W); for (let x = 0; x < W; x++) g[o + x] = e[x]; } };
      const out = new Float32Array(n), inn = new Float32Array(n);
      for (let i = 0; i < n; i++){ const on = A[i] >= .5; out[i] = on ? 0 : 1e20; inn[i] = on ? 1e20 : 0; }
      edt(out); edt(inn);
      // у самой кромки — по прозрачности (доли пикселя), дальше — по расстоянию; потом сгладить (ступеньки на диагоналях)
      const F = new Float32Array(n);
      for (let i = 0; i < n; i++) F[i] = A[i] > .02 && A[i] < .98 ? .5 - A[i] : out[i] > 0 ? Math.sqrt(out[i]) - .5 : .5 - Math.sqrt(inn[i]);
      for (let p = 0; p < 2; p++){ bh(F, T, sr); bv(T, F, sr); }
      const bw = sr * 4 + 2;   // полоса у края картинки — всегда «далеко снаружи», иначе по краю свечения видна рамка
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < bw || y < bw || x >= W - bw || y >= H - bw) F[y * W + x] = 1e3;
      for (let i = 0; i < n; i++){ const dd = F[i]; sdf[i] = Math.max(0, Math.min(255, Math.round((.5 + dd / (2 * (dd < 0 ? rIn : rOut))) * 255))); }
    }
    return { d, sdf };
  }
  // фоновый поток — один на все надписи; нет потока (запрет, ошибка) — считаем тут же
  let WK = null, wkN = 0;
  const wkJobs = new Map();
  function proc(job){
    if (WK === null) try {
      WK = new Worker(URL.createObjectURL(new Blob([`const PROC = ${PROC.toString()};\nonmessage = e => { const r = PROC(e.data); postMessage({ id: e.data.id, d: r.d, sdf: r.sdf }, [r.d.buffer, r.sdf.buffer]); };`], { type: 'text/javascript' })));
      WK.onmessage = e => { const k = wkJobs.get(e.data.id); wkJobs.delete(e.data.id); k?.res(e.data); };
      WK.onerror = () => { WK = false; wkJobs.forEach(k => k.res(PROC(k.job))); wkJobs.clear(); };
    } catch (_){ WK = false; }
    if (!WK) return Promise.resolve(PROC(job));
    return new Promise(res => { job.id = ++wkN; wkJobs.set(job.id, { res, job }); WK.postMessage(job); });   // копия, не передача: при сбое потока посчитаем ещё раз тут
  }

  function mount(el, opts){
    const o = Object.assign({}, DEF, opts);
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block' + (o.drag ? ';touch-action:none;cursor:grab' : '');
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(cv);
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });   // края и так гладкие за счёт маски — сглаживание холста только тратит видеопамять
    let yaw = o.yaw, pitch = o.pitch, vy = 0, vp = 0, held = false, raf = 0, last = 0, dead = false;
    let N = 0, n = 0, frames = 0, sdf = null, PR = null, mode = '', bufR = null, inset = [0, 0], dr = [1, 1], G = [], cellH = 0, AW = 1, AH = 1, CELLS = {}, LH = 1, EX = 0, MX = null, gpx = 0, boost = 0, anim = null, tx = [0, 0], shT = -1, shTimer = 0, sz = [1, 1], cw = 1, ch = 1, dpr = 1, tex = null, bufF = null, bufB = null, prog = null, U = {};

    if (!gl){ el.textContent = o.text; return { set(){}, rotate(){}, destroy(){ cv.remove(); } }; }   // без WebGL — просто текст
    const sh = (t, s) => { const h = gl.createShader(t); gl.shaderSource(h, s); gl.compileShader(h); if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(h)); return h; };
    const UN = ['uSz', 'uRes', 'uDep', 'uN', 'uCam', 'uR', 'uTex', 'uFront', 'uGloss', 'uAmb', 'uFc', 'uSc', 'uF', 'uS', 'uL', 'uFd', 'uSdf', 'uDr', 'uIgS', 'uGlS', 'uGlR', 'uEmit', 'uK1C', 'uK2C', 'uIgC', 'uGlC', 'uK1', 'uK2', 'uTx', 'uBev', 'uMet', 'uCurv', 'uShX', 'uShW', 'uShC', 'uInPx', 'uInUV', 'uLT', 'uLZ', 'uLS', 'uBoost', 'uHd', 'uBr', 'uDpr'];
    // программа: шейдеры, адреса параметров и атрибутов; {} — не собралась (тогда запасной рендер)
    function mk(vs, fs, attrs){ try {
      const pg = gl.createProgram(); gl.attachShader(pg, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pg);
      if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pg));
      const U = {}; UN.forEach(k => U[k] = gl.getUniformLocation(pg, k));
      return { pg, U, A: attrs.map(a => gl.getAttribLocation(pg, a)) };
    } catch (e){ console.warn('Extrude:', e.message); return null; } }
    const PL = mk(VS, FS, ['aP', 'aQ', 'aA']), PRAY = mk(RVS, RFS, ['aB', 'aC', 'aE', 'aA']);
    // включить рендер: своя программа, свои атрибуты (чужие выключить — иначе WebGL ругается на пустые массивы), параметры цвета заново
    function useMode(){ const want = o.render === 'layers' || !PRAY ? 'layers' : 'ray'; if (want === mode) return; mode = want; PR = want === 'ray' ? PRAY : PL;
      for (let i = 0; i < 16; i++) gl.disableVertexAttribArray(i);
      gl.useProgram(PR.pg); U = PR.U; PR.A.forEach(a => a >= 0 && gl.enableVertexAttribArray(a));
      if (want === 'ray'){ gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); } else gl.disable(gl.CULL_FACE);
      if (G.length){ geom(); colors(); } }
    // движение букв: на каждую — сдвиг x, y, масштаб, поворот и сдвиг к зрителю, прозрачность (до 32 букв; дальше — как последняя)
    const LT = new Float32Array(128), LZ = new Float32Array(128), LS = new Float32Array(64);   // LZ: сдвиг к зрителю, прозрачность, переворот вокруг x, вокруг y; LS: масштаб по ширине и высоте
    let pY = 0, pP = 0;   // покачивание всей надписи поверх позы (градусы) — от анимаций «жизни»
    const still0 = () => { for (let i = 0; i < 32; i++){ LT.set([0, 0, 1, 0], i * 4); LZ.set([0, 1, 0, 0], i * 4); LS.set([1, 1], i * 2); } boost = 0; pY = pP = 0; };
    still0();
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    bufF = gl.createBuffer(); bufB = gl.createBuffer(); bufR = gl.createBuffer(); tex = gl.createTexture(); sdf = gl.createTexture();
    useMode();

    // стопка квадратов: на каждую копию — по квадрату на букву; два буфера — от задней к лицу и наоборот (когда смотрим сзади)
    // вершина: ячейка в атласе (u, v), копия, угол относительно опоры буквы (px), знак угла (для ужатия боковин), опора буквы (px), номер буквы
    function geom(){
      if (mode === 'ray') return geomRay();
      const q = []; G.forEach((g, gi) => { const ax = (g.pen + g.adv / 2) / dpr, ay = g.cy / dpr, l = (g.pen - g.l) / dpr - ax, r = l + g.w / dpr, t = (g.cy + cellH / 2) / dpr - ay, b = t - cellH / dpr;
        const u0 = g.ux / AW, u1 = (g.ux + g.w) / AW, v0 = g.uy / AH, v1 = (g.uy + cellH) / AH, k = Math.min(31, gi);
        const V = (u, v, x, y, sx, sy) => [u, v, 0, x, y, sx, sy, ax, ay, k];
        q.push(V(u0, v0, l, t, -1, 1), V(u1, v0, r, t, 1, 1), V(u0, v1, l, b, -1, -1), V(u1, v0, r, t, 1, 1), V(u1, v1, r, b, 1, -1), V(u0, v1, l, b, -1, -1)); });
      const f = new Float32Array(N * q.length * 10), bb = new Float32Array(N * q.length * 10);
      const put = (A, slot, i) => q.forEach((v, j) => { const o = (slot * q.length + j) * 10; A.set(v, o); A[o + 2] = i; });
      for (let i = 0; i < N; i++){ put(f, N - 1 - i, i); put(bb, i, i); }
      gl.bindBuffer(gl.ARRAY_BUFFER, bufF); gl.bufferData(gl.ARRAY_BUFFER, f, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufB); gl.bufferData(gl.ARRAY_BUFFER, bb, gl.STATIC_DRAW);
    }
    function geomRay(){
      const v = [];
      G.forEach((g, gi) => { const ax = (g.pen + g.adv / 2) / dpr, ay = g.cy / dpr, l = (g.pen - g.l) / dpr - ax, r = l + g.w / dpr, t = (g.cy + cellH / 2) / dpr - ay, b = t - cellH / dpr;
        const C = [g.ux / AW, g.uy / AH, (g.ux + g.w) / AW, (g.uy + cellH) / AH], E = [l, b, r, t], k = Math.min(31, gi);
        // шесть граней, углы против часовой, если смотреть снаружи
        [[[l, b, 1], [r, b, 1], [r, t, 1], [l, t, 1]], [[r, b, -1], [l, b, -1], [l, t, -1], [r, t, -1]], [[r, b, 1], [r, b, -1], [r, t, -1], [r, t, 1]],
         [[l, b, -1], [l, b, 1], [l, t, 1], [l, t, -1]], [[l, t, 1], [r, t, 1], [r, t, -1], [l, t, -1]], [[l, b, -1], [r, b, -1], [r, b, 1], [l, b, 1]]]
          .forEach(f => [0, 1, 2, 0, 2, 3].forEach(j => v.push(...f[j], ...C, ...E, ax, ay, k))); });
      gl.bindBuffer(gl.ARRAY_BUFFER, bufR); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    }
    // запас под свечение (px картинки) — сторона квадрата лица больше букв на него; дальше 2.5 размеров свечение уже не видно
    const glowPx = () => o.glow ? Math.ceil(o.glow.size * 2.5 * dpr) : 0;
    let bn = 0, ready = Promise.resolve(), PEND = null;   // PEND — знаки атласа, который сейчас собирается в фоне
    // сборка: размер и атлас букв рисуются сразу, тяжёлый счёт по пикселям (размытие, нормали, поле расстояний) — в фоновом потоке,
    // чтобы интерфейс не замирал; до готовности на холсте остаётся прежняя надпись (или пусто)
    function build(){
      dpr = Math.min(2, devicePixelRatio || 1); cw = Math.max(1, el.clientWidth); ch = Math.max(1, el.clientHeight);
      const room = o.depth * o.pad * 2 + 8 + (o.glow ? o.glow.size * 2 : 0);
      let fs = o.size;
      if (!fs){   // подгонка: надпись с запасом под боковины и свечение
        const x = document.createElement('canvas').getContext('2d'); x.font = o.font.replace('{s}', 100);
        const ls = String(o.fit || o.text).split('\n'), tw = Math.max(1, ...ls.map(l => x.measureText(l).width)) + 105 * ls.length * Math.abs(o.skew || 0);
        fs = Math.max(8, Math.min((cw - room) / tw * 100, (ch - room) / (1.05 * ls.length)));
      }
      const m = atlas(fs), my = ++bn, W0 = cw, H0 = ch, D0 = dpr; PEND = m.cells;
      return ready = proc(m.job).then(res => { if (dead || my !== bn) return; PEND = null; m.img.data.set(res.d); apply(m, res.sdf, W0, H0, D0); });
    }
    function apply(m, sdfData, W0, H0, D0){
      cv.width = Math.round(W0 * D0); cv.height = Math.round(H0 * D0);
      CELLS = m.cells; cellH = m.cellH; AW = m.W; AH = m.H; gpx = m.gp; LH = m.lh; EX = m.ex; MX = m.mx; layout();
      inset = [m.gp / m.W, m.gp / m.H]; dr = [m.rIn * 2 / dpr, m.rOut * 2 / dpr]; tx = [1.5 / m.W, 1.5 / m.H];
      N = o.layers || Math.max(8, Math.min(128, Math.round(o.depth * dpr * .9)));
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      const up = (t, unit, fmt, data) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        if (data instanceof Uint8Array) gl.texImage2D(gl.TEXTURE_2D, 0, fmt, m.W, m.H, 0, fmt, gl.UNSIGNED_BYTE, data); else gl.texImage2D(gl.TEXTURE_2D, 0, fmt, fmt, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); };
      up(tex, 0, gl.RGBA, m.img); up(sdf, 1, gl.LUMINANCE, sdfData); gl.activeTexture(gl.TEXTURE0);
      geom(); colors(); draw();
    }
    // атлас: ячейка на каждый знак (из текста и charset), одинаковые буквы делят одну ячейку; в job — всё для счёта по пикселям
    function atlas(fs){
      // willReadFrequently: холст в обычной памяти — снятие пикселей не ждёт видеокарту (а она может быть занята кадрами)
      const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true }), font = o.font.replace('{s}', fs * dpr);
      x.font = font;
      const lh = fs * dpr * 1.05, sk = o.skew || 0, r = Math.max(2, Math.round(dpr * 2.5)), gp = glowPx();
      const pad = r * 2 + 2 + gp + 2;   // поле ячейки: размытие и свечение не задевают соседей
      const cellH = Math.ceil(lh + pad * 2), ex = Math.abs(sk) * lh / 2;
      const mx = document.createElement('canvas').getContext('2d'); mx.font = font;   // для раскладки без пересборки
      const glyphs = [...new Set([...String(o.text) + (o.charset || '')].filter(ch => ch.trim()))].map(ch => {
        const mt = x.measureText(ch), L = Math.max(0, mt.actualBoundingBoxLeft || 0) + ex + pad, Rt = Math.max(mt.width, mt.actualBoundingBoxRight || 0) + ex + pad;
        return { ch, adv: mt.width, l: L, w: Math.ceil(L + Rt) }; });
      // ячейки — рядами в атлас до 2048 px
      let W = 0, H = cellH, cx = 0;
      glyphs.forEach(g => { if (cx + g.w > 2048){ cx = 0; H += cellH; } g.ux = cx; g.uy = H - cellH; cx += g.w; W = Math.max(W, cx); });
      W = Math.max(1, W); H = Math.min(2048, H);
      c.width = W; c.height = H; x.font = font; x.fillStyle = '#fff'; x.textAlign = 'left'; x.textBaseline = 'middle';
      glyphs.forEach(g => { const y = g.uy + cellH / 2;   // знак — в свою ячейку
        x.setTransform(1, 0, -sk, 1, sk * y, 0);   // курсив: верх уходит вправо, середина строки на месте
        x.fillText(g.ch, g.ux + g.l, y); });
      x.setTransform(1, 0, 0, 1, 0, 0);
      const img = x.getImageData(0, 0, W, H);
      // поле расстояний: внутри — до самой дальней отделки, снаружи — до края свечения
      const rIn = Math.max(4, ...(o.strokes || []).map(k => ((k.inset || 0) + k.width) * dpr + 2), o.innerGlow ? o.innerGlow.size * 3 * dpr : 0, o.bevel ? o.bevel * dpr + 3 : 0), rOut = Math.max(4, gp);
      const job = { W, H, d: img.data, r, deco: o.render !== 'layers' || !!(o.strokes?.length || o.innerGlow || o.glow || o.bevel), rIn, rOut, sr: Math.max(1, Math.round(dpr)) };
      return { W, H, img, gp, rIn, rOut, cells: Object.fromEntries(glyphs.map(g => [g.ch, g])), cellH, lh, ex, mx, job };
    }
    // раскладка текста по ячейкам атласа: позиция буквы — по ширине всего, что левее (кернинг); с charset — по ширинам знаков (цифры не пляшут)
    function layout(){
      const lines = String(o.text).split('\n'); let tw = 1, base = 0; G = [];
      lines.forEach((l, li) => { const cy = ((lines.length - 1) / 2 - li) * LH, ch = [...l];
        const pens = []; let acc = 0, pre = '';
        ch.forEach(c => { pens.push(o.charset ? acc : MX.measureText(pre).width); pre += c; acc += CELLS[c]?.adv ?? MX.measureText(c).width; });
        const lw = o.charset ? acc : MX.measureText(l).width; tw = Math.max(tw, lw);
        ch.forEach((c, i) => { const k = CELLS[c]; if (k) G.push({ ...k, pen: -lw / 2 + pens[i], cy, li, ci: base + i }); }); base += ch.length + 1; });
      sz = [(tw + EX * 2) / dpr, LH * lines.length / dpr];
    }
    // текст из уже готовых ячеек — только переложить квадраты (дёшево); есть новый знак — пересобрать атлас
    const covered = t => [...String(t)].every(c => !c.trim() || CELLS[c]);
    // знаки есть в атласе, который уже собирается, — новую сборку не начинать: она отменила бы ту, и атлас не доехал бы никогда
    // (готовая сборка сама разложит текущий текст)
    const coming = t => PEND && [...String(t)].every(c => !c.trim() || PEND[c]);
    function retext(){ layout(); geom(); }

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
      gl.uniform1f(U.uBev, o.bevel || 0); gl.uniform1f(U.uMet, o.metal || 0); gl.uniform1f(U.uCurv, o.curve || 0);
      gl.uniform3fv(U.uShC, hex(o.shine.color)); gl.uniform1f(U.uShW, o.shine.width);
      gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uSdf, 1);   // в обоих рендерах: маска с нормалями — 0, поле расстояний — 1
    }
    function draw(){
      if (dead) return; frames++;
      const Y = (yaw + pY) * Math.PI / 180, P = (pitch + pP) * Math.PI / 180, cy = Math.cos(Y), sy = Math.sin(Y), cp = Math.cos(P), sp = Math.sin(P);
      // R = Rx(pitch) · Ry(yaw), по столбцам (как ждёт WebGL)
      const R = [cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy];
      const front = R[8] >= 0;   // z лица после поворота: к нам — лицо, от нас — задняя стенка
      // копий — сколько пикселей выступает боковина под этим углом (+ разница перспективы у краёв): анфас — мало, в профиль — все
      n = o.layers ? N : Math.max(4, Math.min(N, Math.ceil(o.depth * dpr * (Math.hypot(R[6], R[7]) + Math.max(sz[0], sz[1]) / 2 / o.persp) * .9) + 2));
      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      if (mode === 'ray') return drawRay(R);
      gl.uniformMatrix3fv(U.uR, false, R);
      gl.uniform2f(U.uSz, sz[0], sz[1]); gl.uniform2f(U.uRes, cw, ch); gl.uniform1f(U.uDep, o.depth); gl.uniform1f(U.uN, n);
      gl.uniform1f(U.uCam, o.persp); gl.uniform1f(U.uFront, front ? 0 : n - 1); gl.uniform2f(U.uInUV, inset[0], inset[1]); gl.uniform2f(U.uInPx, gpx / dpr, gpx / dpr);
      gl.uniform4fv(U.uLT, LT); gl.uniform4fv(U.uLZ, LZ); gl.uniform2fv(U.uLS, LS); gl.uniform1f(U.uBoost, boost); gl.uniform2f(U.uDr, dr[0], dr[1]); gl.uniform2f(U.uTx, tx[0], tx[1]);
      gl.uniform1f(U.uShX, shT < 0 ? -9 : -1.8 + shT * 3.6);   // блик идёт слева направо через весь холст
      // ближние n копий: в bufF они в хвосте (от задней к лицу), в bufB — в начале
      const per = G.length * 6, off = front ? (N - n) * per * 40 : 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, front ? bufF : bufB);
      const [aP, aQ, aA] = PR.A;
      gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 40, off); gl.vertexAttribPointer(aQ, 4, gl.FLOAT, false, 40, off + 12); gl.vertexAttribPointer(aA, 3, gl.FLOAT, false, 40, off + 28);
      if (per) gl.drawArrays(gl.TRIANGLES, 0, n * per);
    }
    // лучом: одна коробка на букву, один проход; фаска не толще половины буквы и не дальше точного поля внутри
    function drawRay(R){
      n = 1;
      gl.uniformMatrix3fv(U.uR, false, R); gl.uniform2f(U.uSz, sz[0], sz[1]); gl.uniform2f(U.uRes, cw, ch);
      gl.uniform1f(U.uHd, o.depth / 2); gl.uniform1f(U.uCam, o.persp); gl.uniform1f(U.uDpr, dpr);
      gl.uniform1f(U.uBr, Math.max(0, Math.min(o.bevel || 0, o.depth / 2 - .5, dr[0] / 2 - 1)));
      gl.uniform4fv(U.uLT, LT); gl.uniform4fv(U.uLZ, LZ); gl.uniform2fv(U.uLS, LS); gl.uniform1f(U.uBoost, boost); gl.uniform2f(U.uDr, dr[0], dr[1]);
      gl.uniform1f(U.uShX, shT < 0 ? -9 : -1.8 + shT * 3.6);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufR);
      const [aB, aC, aE, aA] = PR.A;
      gl.vertexAttribPointer(aB, 3, gl.FLOAT, false, 56, 0); gl.vertexAttribPointer(aC, 4, gl.FLOAT, false, 56, 12);
      gl.vertexAttribPointer(aE, 4, gl.FLOAT, false, 56, 28); gl.vertexAttribPointer(aA, 3, gl.FLOAT, false, 56, 44);
      // от дальней буквы к ближней: коробки соседей перекрываются при повороте, буфера глубины нет
      const ord = G.map((g, i) => { const k = Math.min(31, i), x = (g.pen + g.adv / 2) / dpr + LT[k * 4], y = g.cy / dpr + LT[k * 4 + 1], z = LZ[k * 4];
        return [R[2] * x + R[5] * y + R[8] * z, i]; }).sort((a, b) => a[0] - b[0]);
      for (const [, i] of ord) gl.drawArrays(gl.TRIANGLES, i * 36, 36);
    }

    // движение: инерция после броска, пружина в позу покоя, вращение — кадры идут, только пока что-то движется
    function tick(t){
      raf = 0; const dt = Math.min(.1, (t - (last || t)) / 1000); last = t;   // до 0.1 с на кадр: на слабом телефоне (10–20 к/с) анимации не растягиваются по времени
      if (!held){
        const sp = o.spin && !calm;   // при постоянном вращении пружина держит только наклон
        if (o.spring){ if (!sp) vy += ((o.yaw - yaw) * 60 - vy * 9) * dt; else vy *= Math.exp(-dt * 3); vp += ((o.pitch - pitch) * 60 - vp * 9) * dt; }
        else { const f = Math.exp(-dt * 3); vy *= f; vp *= f; }
        yaw += (vy + (calm ? 0 : o.spin)) * dt; pitch = Math.max(-80, Math.min(80, pitch + vp * dt));
      }
      if (shT >= 0){ shT += dt / o.shine.time; if (shT > 1) shT = -1; }
      if (anim){ if (anim.hold > 0) anim.hold -= dt; else { anim.t += dt; if (!anim.f(anim.t)) finish(); } }   // hold — стоп-кадр на ударе
      draw(); o.onMove?.(yaw, pitch);
      const still = Math.abs(vy) + Math.abs(vp) < .4 && (!o.spring || Math.abs(o.yaw - yaw) + Math.abs(o.pitch - pitch) < .05);
      if (held || (o.spin && !calm) || !still || shT >= 0 || anim) raf = requestAnimationFrame(tick); else last = 0;
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

    /* ── ПРЕСЕТЫ: t.play(имя, { time, each, from, only, onLand(i) }) → Promise · t.swap(текст, { style }) · t.count(до, …)
       Параметры — из исследования (research_notes/…/motion_presets.md, game_win_text.md): GSAP SplitText, Material 3, пружины Apple,
       слоты и мобильные игры. Правила «дорогого» движения: вход дольше выхода; прозрачность и свечение без перелёта; отскок —
       только праздник; удар (onLand) — в кадр наибольшего сжатия, туда же звук и вибрация; «жизнь» — тихая и конечная.
       Кадры идут только пока играет; конец — буквы на месте (после ухода — скрыты). lite и «уменьшение движения» — сразу конец. */
    const clamp = v => Math.max(0, Math.min(1, v));
    // кривая Безье как в CSS (решение по x методом Ньютона)
    const bez = (x1, y1, x2, y2) => p => { if (p <= 0) return 0; if (p >= 1) return 1; let t = p;
      for (let k = 0; k < 6; k++){ const u = 1 - t, x = 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t - p, dx = 3 * u * u * x1 + 6 * u * t * (x2 - x1) + 3 * t * t * (1 - x2);
        if (Math.abs(dx) < 1e-6) break; t = Math.min(1, Math.max(0, t - x / dx)); }
      const u = 1 - t; return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t; };
    const E = {
      dec: bez(.05, .7, .1, 1), acc: bez(.3, 0, .8, .15),   // Material 3: «выразительное» торможение и разгон
      outC: p => 1 - (1 - p) ** 3, outQ: p => 1 - (1 - p) ** 5, outX: p => p >= 1 ? 1 : 1 - 2 ** (-10 * p),
      inQ: p => p * p, inC: p => p * p * p,
      back: (p, c = 1.70158) => 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2, inBack: (p, c = 1.70158) => (c + 1) * p ** 3 - c * p * p,
    };
    // пружина: T — время отклика (с), z — затухание (1 — без перелёта, .5 — заметный отскок); x(0) = 0 → 1
    const spring = (t, T = .4, z = .7) => { if (t <= 0) return 0; const w = 2 * Math.PI / T;
      if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
      const wd = w * Math.sqrt(1 - z * z), e = Math.exp(-z * w * t); return 1 - e * (Math.cos(wd * t) + z * w / wd * Math.sin(wd * t)); };
    const settle = (T, z) => .92 * T / Math.min(1, z) + .05;   // когда пружина успокоилась (отклонение < 0.3%)
    // случайное, но одно и то же для буквы в рамках проигрыша
    const rnd = (A, i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233 + A.seed) * 43758.5453; return x - Math.floor(x); };
    // порядок букв: start · end · center · edges · random
    const rank = (A, i, n) => { const f = A.o.from || A.from || 'start', m = (n - 1) / 2;
      return f === 'end' ? n - 1 - i : f === 'center' ? Math.abs(i - m) : f === 'edges' ? m - Math.abs(i - m) : f === 'random' ? A.perm[i] : i; };
    const H = () => LH / dpr;   // высота строки, px
    const anc = g => [(g.pen + g.adv / 2) / dpr, g.cy / dpr];   // опора буквы от центра надписи
    // буква: x, y (вверх), z (к зрителю), s — масштаб, r — поворот в плоскости, a — прозрачность, fx/fy — перевороты, sx/sy — сжатие
    // only: номер строки — двигается только она, остальные скрыты
    const put = (i, st) => { const g = G[i]; let a = st.a ?? 1; if (anim?.o.only != null && g && g.li !== anim.o.only) a = 0; i = Math.min(31, i);
      LT[i * 4] = st.x || 0; LT[i * 4 + 1] = st.y || 0; LT[i * 4 + 2] = st.s ?? 1; LT[i * 4 + 3] = st.r || 0;
      LZ[i * 4] = st.z || 0; LZ[i * 4 + 1] = a; LZ[i * 4 + 2] = st.fx || 0; LZ[i * 4 + 3] = st.fy || 0; LS[i * 2] = st.sx ?? 1; LS[i * 2 + 1] = st.sy ?? 1; };
    const land = (A, i) => { if (!A.hit.has(i)){ A.hit.add(i); A.o.onLand?.(i); } };
    // затухающая тряска всей надписи: амплитуда px, частота Гц, спад с
    const shake = (t, amp = 7, f = 15, tau = .1) => { const e = Math.exp(-t / tau) * amp; return [Math.sin(t * f * 6.283) * e, Math.cos(t * f * 5.1) * e * .5]; };

    /* Пресет по буквам: each — шаг между буквами (с), time — длительность буквы, from — порядок, L(A, p, i, n, g, tl) → состояние буквы
       на её прогрессе p ∈ 0…1 (tl — время с её старта), label(A, t) — общее для надписи (тряска, вспышка, покачивание), land — p удара */
    const P = {};
    const per = (def) => (A, t) => { const n = G.length, du = A.o.time ?? def.time;
      let maxR = 0; for (let i = 0; i < n; i++) maxR = Math.max(maxR, rank(A, i, n));
      // разбег по буквам не дольше 0.4 с (уход — 0.3 с): длинная надпись иначе собирается дольше, чем читается
      const each = Math.min(A.o.each ?? def.each ?? 0, (A.o.spread ?? (def.keep ? .3 : .4)) / Math.max(1, maxR));
      const lab = def.label ? def.label(A, t, du, maxR * each) : null;
      G.forEach((g, i) => { const tl = t - rank(A, i, n) * each, p = clamp(tl / du), st = def.L(A, p, i, n, g, tl, du);
        if (lab){ st.x = (st.x || 0) + (lab.x || 0); st.y = (st.y || 0) + (lab.y || 0); if (lab.k){ const [ax, ay] = anc(g); st.x += ax * (lab.k - 1); st.y += ay * (lab.k - 1); st.s = (st.s ?? 1) * lab.k; } }
        put(i, st); if (def.land != null && p >= def.land) land(A, i); });
      if (def.keep) A.keep = true;
      return t < maxR * each + du + (def.tail || 0); };

    // ── ПОЯВЛЕНИЕ ──
    // спокойный по умолчанию: подъём снизу, проявление за первые 60%
    P.rise = per({ group: 'in', each: .03, time: .45, land: .6, L: (A, p) => { const e = E.dec(p); return { y: -.5 * H() * (1 - e), a: clamp(p / .6) }; } });
    // въезд сбоку (GSAP: x 150, 0.7 с, power4, шаг 0.04)
    P.slide = per({ group: 'in', each: .04, time: .7, land: .5, L: (A, p) => { const e = E.outQ(p); return { x: 150 * (1 - e), a: clamp(p / .4), sx: 1 + .25 * (1 - e) }; } });
    // выскок из точки от центра: пружина T 0.3, ζ 0.6 (~10% перелёта), вспышка на пике
    P.pop = per({ group: 'in', each: .025, time: settle(.3, .6), from: 'center', land: .35, L: (A, p, i, n, g, tl) => ({ s: Math.max(0, .3 + .7 * spring(tl, .3, .6)), a: clamp(tl / .12) }),
      label: (A, t, du, spread) => { boost = Math.max(0, .5 * Math.sin(Math.PI * clamp((t - spread * .5) / .5))); return null; } });
    // падение с растяжкой в полёте и сплющиванием при ударе, микротряска на каждом приземлении
    P.drop = per({ group: 'in', each: .045, time: .26 + settle(.25, .5), land: .26 / (.26 + settle(.25, .5)), L: (A, p, i, n, g, tl) => {
        const fall = .26; if (tl < fall){ const q = clamp(tl / fall); return { y: 1.5 * H() * (1 - E.inC(q)), sy: 1 + .15 * q, sx: 1 - .06 * q, a: clamp(q * 4) }; }
        const k = 1 - spring(tl - fall, .25, .5); return { sy: 1 - .15 * k, sx: 1 + .12 * k }; },
      label: (A, t) => { const last = Math.max(-1, ...[...A.hit].filter(x => x >= 0)); if (last < 0) return null; const [x, y] = shake(t - (A.lt ??= {})[last], 2.5, 16, .12); return { x, y }; } });
    // 3D-переворот вниз-вверх (GSAP: rotationX −100, 0.8 с, power3, шаг)
    P.flip = per({ group: 'in', each: .05, time: .7, land: .7, L: (A, p) => ({ fx: -1.66 * (1 - E.outC(p)), a: clamp(p / .4) }) });
    // карта: переворот вокруг вертикали от центра, с перелётом
    P.spin = per({ group: 'in', each: .04, time: .6, from: 'center', land: .6, L: (A, p) => ({ fy: Math.PI * (1 - E.back(p, 1.2)), a: clamp(p / .3) }) });
    // спираль к центру: поворот ±270°, издалека, из мелкого
    P.spiral = per({ group: 'in', each: .03, time: .8, from: 'center', land: .8, L: (A, p, i, n, g) => { const e = E.outX(p), [ax, ay] = anc(g), d = Math.hypot(ax, ay) || 1, k = 2.5 * H() * (1 - e), sg = ax < 0 ? -1 : 1;
        return { x: ax / d * k, y: ay / d * k, r: sg * 4.7 * (1 - e), s: .2 + .8 * e, a: clamp(p / .3) }; } });
    // печатная машинка: буква появляется с маленьким щелчком
    P.type = per({ group: 'in', each: .05, time: .12, land: 0, L: (A, p) => ({ a: p > 0 ? 1 : 0, s: p > 0 ? 1 + .15 * (1 - p) : 1 }) });
    // смаз: влёт с растяжкой по движению (вместо размытия)
    P.smear = per({ group: 'in', each: .02, time: .35, land: .5, L: (A, p) => { const e = E.outX(p); return { x: .4 * H() * (1 - e), sx: 1 + .3 * (1 - e), a: clamp(p / .3) }; } });
    // бросок: сверху с разворотом ±80° (GSAP words: y −100, rotation random(−80, 80), back, шаг)
    P.toss = per({ group: 'in', each: .06, time: .7, land: .6, L: (A, p, i) => { const e = E.back(p); return { y: 100 * (1 - e), r: (rnd(A, i, 1) * 2 - 1) * 1.4 * (1 - e), a: clamp(p / .3) }; } });
    // сборка из разлёта
    P.gather = per({ group: 'in', each: .02, time: .6, from: 'random', land: .7, L: (A, p, i) => { const e = E.outX(p), h = 1.5 * H() * (1 - e);
        return { x: (rnd(A, i, 2) * 2 - 1) * h, y: (rnd(A, i, 3) * 2 - 1) * h, r: (rnd(A, i, 4) * 2 - 1) * 1.6 * (1 - e), s: .6 + .4 * e, a: clamp(p / .4) }; } });
    // удар: вся надпись влетает в лицо, стоп-кадр 60 мс, сплющивание, тряска и вспышка
    P.slam = (A, t) => { const du = A.o.time ?? .38, p = clamp(t / du), e = E.inQ(p), q = Math.max(0, t - du);
      if (p >= 1 && !A.hit.has(-1)){ land(A, -1); A.hold = .06; }
      const k = 1 + (1 - e) * .7 + (p >= 1 ? .1 * Math.exp(-q / .08) * Math.cos(q * 30) : 0), [sx, sy] = p >= 1 ? shake(q, 7, 15, .1) : [0, 0], sq = p >= 1 ? 1 - spring(q, .25, .5) : 0;
      G.forEach((g, i) => { const [ax, ay] = anc(g); put(i, { x: sx + ax * (k - 1), y: sy + ay * (k - 1), z: (1 - e) * 120, s: k, a: clamp(p * 3), sx: 1 + .1 * sq, sy: 1 - .12 * sq }); });
      boost = p >= 1 ? Math.exp(-q / .2) : 0;
      return q < .5; };

    // ── ЖИЗНЬ (тихо, конечно: по умолчанию 2.4–3 с, потом надпись замирает) ──
    const env = (t, du) => Math.sin(Math.PI * clamp(t / du));   // плавно нарастает и стихает
    P.wave = (A, t) => { const du = A.o.time ?? 2.4, en = env(t, du), h = H();
      G.forEach((g, i) => { const w = Math.sin(t * 4.4 - i * .45); put(i, { y: w * .07 * h * en, r: w * .03 * en, s: 1 + w * .02 * en }); }); return t < du; };
    P.breathe = (A, t) => { const du = A.o.time ?? 3, k = 1 + .025 * Math.sin(t * 2 * Math.PI * .33) * env(t, du);
      G.forEach((g, i) => { const [ax, ay] = anc(g); put(i, { x: ax * (k - 1), y: ay * (k - 1), s: k }); }); boost = .15 * env(t, du) * (.5 + .5 * Math.sin(t * 2.1)); return t < du; };
    // парение всей надписи в 3D: покачивание 5° / 2.5° на несовпадающих частотах
    P.float = (A, t) => { const du = A.o.time ?? 3.2, en = env(t, du); pY = 5 * Math.sin(t * 2 * Math.PI * .22) * en; pP = 2.5 * Math.sin(t * 2 * Math.PI * .31) * en;
      G.forEach((g, i) => put(i, { y: 3 * Math.sin(t * 2.2) * en })); return t < du; };
    // пульс свечения (без мигания: < 1 Гц)
    P.glow = (A, t) => { const du = A.o.time ?? 2.6; boost = .45 * (.5 - .5 * Math.cos(t * 2 * Math.PI * .7)) * env(t, du); G.forEach((g, i) => put(i, {})); return t < du; };
    // желе: буквы по очереди мягко сплющиваются
    P.jelly = (A, t) => { const du = A.o.time ?? 2.4, en = env(t, du);
      G.forEach((g, i) => { const w = Math.sin(t * 7 - i * .9) * .07 * en; put(i, { sx: 1 + w, sy: 1 - w }); }); return t < du; };

    // ── АКЦЕНТ (коротко, ≤ 0.5 с, затухает) ──
    // удар масштабом: 1 → 1.15 за 80 мс, назад пружиной ζ 0.45; буквы от центра с шагом 15 мс; вспышка
    P.punch = per({ group: 'accent', each: .015, from: 'center', time: .08 + settle(.3, .45), land: 0, L: (A, p, i, n, g, tl) => {
        const k = tl < .08 ? 1 + .15 * E.outC(clamp(tl / .08)) : 1 + .15 * (1 - spring(tl - .08, .3, .45)); return { s: k }; },
      label: (A, t) => { boost = t < .05 ? t / .05 : Math.exp(-(t - .05) / .25); return null; } });
    // тряска с затуханием: 8 px, 15 Гц, спад 0.1 с, плюс поворот ±2.5°
    P.shake = (A, t) => { const [x, y] = shake(t, 8, 15, .1), r = Math.sin(t * 70) * Math.exp(-t / .1) * .045; if (t === 0) land(A, -1);
      G.forEach((g, i) => { const [ax, ay] = anc(g); put(i, { x: x + (-ay * r), y: y + ax * r, r }); }); return t < .4; };
    // покачивание букв: ±8° в случайную сторону, назад пружиной ζ 0.4
    P.jiggle = per({ group: 'accent', each: .02, from: 'random', time: settle(.28, .4), land: 0, L: (A, p, i, n, g, tl) => ({ r: (rnd(A, i, 5) < .5 ? -1 : 1) * .14 * (1 - spring(tl, .28, .4)) }) });
    // сплющивание всей надписи: 60 мс в лепёшку, назад пружиной
    P.squash = (A, t) => { const k = t < .06 ? E.outC(t / .06) : 1 - spring(t - .06, .25, .5); if (t === 0) land(A, -1);
      G.forEach((g, i) => { const [ax, ay] = anc(g), sx = 1 + .08 * k, sy = 1 - .12 * k; put(i, { x: ax * (sx - 1), y: ay * (sy - 1) - .06 * H() * k, sx, sy }); }); return t < .06 + settle(.25, .5); };
    // прыжок волной: буквы по очереди подпрыгивают и приземляются со сплющиванием
    P.hop = per({ group: 'accent', each: .05, time: .5, land: .62, L: (A, p) => { const up = p < .62 ? Math.sin(Math.PI * p / .62) : 0, sq = p >= .62 ? Math.sin(Math.PI * (p - .62) / .38) : 0;
        return { y: .35 * H() * up, sy: 1 + .1 * up - .12 * sq, sx: 1 - .05 * up + .1 * sq }; } });
    // вспышка: свечение 0 → 1 за 50 мс, спад 250 мс, лёгкое увеличение
    P.flash = (A, t) => { const b = t < .05 ? t / .05 : Math.exp(-(t - .05) / .25); boost = b; if (t === 0) land(A, -1);
      G.forEach((g, i) => { const [ax, ay] = anc(g), k = 1 + .04 * b; put(i, { x: ax * (k - 1), y: ay * (k - 1), s: k }); }); return t < .9; };
    // кувырок: каждая буква делает полный оборот вокруг вертикали
    P.twirl = per({ group: 'accent', each: .04, time: .55, land: 1, L: (A, p) => ({ fy: 2 * Math.PI * E.dec(p) }) });

    // ── УХОД (быстрее входа, разгоном) ──
    P.fade = per({ group: 'out', keep: true, each: .015, time: .22, L: (A, p) => { const e = E.acc(p); return { y: -.3 * H() * e, a: 1 - e }; } });
    // падение с гравитацией и разворотом, в случайном порядке
    P.fall = per({ group: 'out', keep: true, each: .025, from: 'random', time: .45, L: (A, p, i) => { const e = E.inQ(p); return { y: -2.5 * H() * e, r: (rnd(A, i, 6) * 2 - 1) * .6 * e, a: 1 - clamp((p - .7) / .3) }; } });
    // разлёт: быстро в стороны, с поворотом, мельче
    P.scatter = per({ group: 'out', keep: true, each: .01, from: 'random', time: .4, L: (A, p, i) => { const e = E.outX(p), h = 1.5 * H() * e;
        return { x: (rnd(A, i, 7) * 2 - 1) * h, y: (rnd(A, i, 8) * 2 - 1) * h, r: (rnd(A, i, 9) * 2 - 1) * 1.6 * e, s: 1 - .4 * e, a: 1 - e }; } });
    // схлопывание к центру, с краёв
    P.implode = per({ group: 'out', keep: true, each: .02, from: 'edges', time: .28, L: (A, p, i, n, g) => { const e = E.inC(p), [ax, ay] = anc(g); return { x: -ax * e, y: -ay * e, s: 1 - e, a: 1 - e }; } });
    // переворот прочь
    P.flipout = per({ group: 'out', keep: true, each: .03, time: .3, L: (A, p) => { const e = E.inC(p); return { fx: 1.6 * e, a: 1 - clamp((p - .4) / .6) }; } });
    // зум прочь с замахом: чуть крупнее, потом в ноль
    P.zoomout = (A, t) => { const k = t < .1 ? 1 + .08 * E.outC(t / .1) : 1.08 * (1 - E.inBack(clamp((t - .1) / .2), 2)), a = 1 - clamp((t - .15) / .15); A.keep = true;
      G.forEach((g, i) => { const [ax, ay] = anc(g), s = Math.max(0, k); put(i, { x: ax * (s - 1), y: ay * (s - 1), s, a }); }); return t < .3; };
    // уход съёживанием (как раньше)
    P.out = per({ group: 'out', keep: true, each: .03, time: .32, L: (A, p) => ({ y: p * 14, s: 1 - p * p * .9, a: 1 - p }) });

    // счётчик: число накручивается до суммы (только вверх, до настоящего выигрыша), сменившаяся цифра подпрыгивает, в конце — удар и вспышка
    P.count = (A, t) => { const { from, to, fmt } = A.o, du = A.o.time ?? 2, p = clamp(t / du), q = clamp((t - du) / .45);
      const txt = fmt(p >= 1 ? to : from + (to - from) * (1 - (1 - p) ** 3));
      if (txt !== o.text){ const old = [...String(o.text)].reverse(), now = [...txt].reverse();
        o.text = txt; if (PEND && coming(txt)) {} else if (covered(txt)) retext(); else build();
        now.forEach((c, j) => { if (c !== old[j]) A.pop[j] = t; });   // счёт позиций справа: разряды не сдвигаются, когда число растёт
        if (t - A.tick > .06){ A.tick = t; A.said = txt; A.o.onTick?.(txt); } }   // щелчок не чаще 60 мс
      if (p >= 1 && A.said !== o.text){ A.said = o.text; A.o.onTick?.(o.text); }   // итог — всегда, даже если последняя смена попала в паузу
      if (p >= 1) land(A, -1);
      const fin = p >= 1 ? Math.sin(q * Math.PI) * .16 : 0, L = G.length;
      // wave: волна по буквам, пока меняется текст (px), к финальному удару стихает
      const wa = (A.o.wave || 0) * Math.min(1, t * 4) * (1 - q);
      G.forEach((g, i) => { const u = clamp((t - (A.pop[L - 1 - i] ?? -9)) / .2), b = (1 - u) ** 2 * .22, k = 1 + b + fin, w = Math.sin(t * 10 - i * .75), [ax, ay] = anc(g);
        put(i, { x: ax * fin, y: b * 9 + ay * fin + w * wa, s: k, r: w * wa * .006 }); });
      boost = p >= 1 ? (1 - q) ** 2 : 0;
      return q < 1; };

    // ── СМЕНА ТЕКСТА: уходят только сменившиеся знаки, потом приходят новые ──
    // половинки: out — старая буква, in — новая; changed — номера знаков (ci), которые меняются
    const SW = {
      roll: { // барабан / одометр: старая уезжает вверх, новая приезжает снизу с растяжкой и мягкой посадкой
        out: (p) => ({ y: .6 * H() * E.inQ(p), sy: 1 + .2 * p, a: 1 - p }), outT: .15,
        in: (p, tl) => { const k = spring(tl, .35, .75); return { y: -.6 * H() * (1 - k), sy: 1 + .2 * (1 - clamp(tl / .15)), a: clamp(tl / .1) }; }, inT: settle(.35, .75) },
      flip: { // перекидное табло: верх уходит на ребро, новая доворачивается с отскоком
        out: (p) => ({ fx: -1.57 * E.inC(p) }), outT: .09,
        in: (p, tl) => ({ fx: 1.57 * (1 - spring(tl, .25, .5)) }), inT: settle(.25, .5) },
      morph: { // перетекание: старая вверх и гаснет, новая снизу
        out: (p) => ({ y: .4 * H() * E.inQ(p), a: 1 - p }), outT: .18,
        in: (p) => ({ y: -.4 * H() * (1 - E.dec(p)), a: p }), inT: .25 },
      pop: { // схлоп и выскок
        out: (p) => ({ s: 1 - E.inC(p), a: 1 - p }), outT: .12,
        in: (p, tl) => ({ s: spring(tl, .3, .55), a: clamp(tl / .1) }), inT: settle(.3, .55) },
    };
    P._swapOut = (A, t) => { const sw = SW[A.o.style], each = A.o.each ?? .035, ch = A.o.changed;
      let k = 0, last = 0; G.forEach((g, i) => { if (!ch.has(g.ci)) return put(i, {}); const p = clamp((t - k++ * each) / sw.outT); last = Math.max(last, (k - 1) * each + sw.outT); put(i, sw.out(p)); });
      A.keep = true; return t < last; };
    P._swapIn = (A, t) => { const sw = SW[A.o.style], each = A.o.each ?? .035, ch = A.o.changed;
      let k = 0, last = 0; G.forEach((g, i) => { if (!ch.has(g.ci)) return put(i, {}); const tl = t - k++ * each; last = Math.max(last, (k - 1) * each + sw.inT);
        if (tl >= 0 && !A.hit.has(i)) land(A, i); put(i, sw.in(clamp(tl / sw.inT), Math.max(0, tl))); });
      return t < last; };
    // расшифровка: сменившиеся знаки перебирают случайные, фиксируются слева направо (шаг 40 мс, смена раз в 50 мс)
    P._scramble = (A, t) => { const tgt = [...A.o.text], pool = A.o.pool, ch = A.o.changed, each = A.o.each ?? .04, idx = [...ch].sort((a, b) => a - b);
      const lock = Math.floor(t / each), frame = Math.floor(t / .05);
      const s2 = tgt.map((c, j) => { const r = idx.indexOf(j); return r < 0 || r < lock - 4 || !c.trim() ? c : pool[Math.floor(rnd(A, j, frame) * pool.length)]; }).join('');
      if (s2 !== o.text){ o.text = s2; retext(); }
      G.forEach((g, i) => { const r = idx.indexOf(g.ci), done = r >= 0 && r < lock - 4, u = done ? clamp((t - (r + 4) * each) / .15) : 1; if (done && !A.hit.has(i)) land(A, i);
        put(i, { s: r >= 0 && done ? 1 + .18 * (1 - u) : 1, a: 1 }); });
      return lock - 4 <= idx.length; };
    async function swap(text, opt = {}){
      const style = opt.style || 'roll', old = [...String(o.text)], now = [...String(text)];
      // числа выравниваем по правому краю (разряды на местах), слова — по левому
      const right = opt.align ? opt.align === 'right' : /^[\d\s.,+\-]*$/.test(o.text + text), d = now.length - old.length;
      const chNew = new Set(), chOld = new Set();
      now.forEach((c, j) => { const oj = right ? j - d : j; if (old[oj] !== c) chNew.add(j); });
      old.forEach((c, j) => { const nj = right ? j + d : j; if (now[nj] !== c) chOld.add(j); });
      // знаков нет в атласе — сначала дособрать (на экране пока старый текст)
      if (!covered(text)){ o.charset = [...new Set((o.charset || '') + text)].join(''); build(); await ready; }
      if (o.lite || calm){ o.text = String(text); retext(); draw(); return; }
      if (style === 'scramble'){ const pool = Object.keys(CELLS).filter(c => /[^\s]/.test(c));
        await play('_scramble', { ...opt, text, changed: chNew, pool }); o.text = String(text); retext(); draw(); return; }
      await play('_swapOut', { ...opt, style, changed: chOld });
      o.text = String(text); retext();
      await play('_swapIn', { ...opt, style, changed: chNew });
    }
    const ANIM = P;
    // группы для витрины: по смыслу
    const GROUPS = { in: ['rise', 'slide', 'pop', 'drop', 'flip', 'spin', 'spiral', 'type', 'smear', 'toss', 'gather', 'slam'],
      idle: ['wave', 'breathe', 'float', 'glow', 'jelly'], accent: ['punch', 'shake', 'jiggle', 'squash', 'hop', 'flash', 'twirl'],
      out: ['fade', 'fall', 'scatter', 'implode', 'flipout', 'zoomout', 'out'], swap: Object.keys(SW).concat('scramble') };
    // t.count(до, { from, time, format(v) → строка, onTick(текст), onLand, wave }) — накрутка суммы (или любой смены текста по шагам)
    const count = (to, opt = {}) => play('count', { from: 0, ...opt, to, fmt: opt.format || (v => v.toFixed(2)) });
    let done = null;
    function finish(){ const A = anim; anim = null; if (!A?.keep) still0(); boost = 0; pY = pP = 0; draw(); const d = done; done = null; d?.(); }
    function play(name, opt = {}){
      const f = ANIM[name]; if (!f) return Promise.resolve();
      if (anim) finish();
      return new Promise(res => { done = res;
        const A = { t: 0, o: opt, hit: new Set(), keep: false, pop: [], tick: -1, hold: 0, seed: Math.random() * 100, lt: {} };
        A.perm = G.map((g, i) => i).sort(() => Math.random() - .5);
        const L = A.o.onLand; A.o = { ...opt, onLand: i => { A.lt[i] = A.t; L?.(i); } };   // время удара каждой буквы — для тряски на приземлении
        A.f = t => f(A, t); anim = A;
        if (o.lite || calm){ A.f(1e3); if (!GROUPS.out.includes(name)) G.forEach((g, i) => land(A, i)); finish(); return; }
        A.f(0); draw(); wake(); });
    }

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
        let re = ['font', 'size', 'depth', 'layers', 'pad', 'skew', 'strokes', 'innerGlow', 'glow', 'bevel', 'charset', 'fit', 'render'].some(k => k in p && p[k] !== o[k]);
        const tx = 'text' in p && p.text !== o.text;
        if (tx && !re && !covered(p.text) && !coming(p.text)) re = true;
        Object.assign(o, p); yaw = o.yaw + ((yaw - o.yaw) % 360 + 540) % 360 - 180;   // после вращения — к позе ближним путём
        useMode();
        if (re) build(); else { if (tx && !PEND) retext(); colors(); draw(); }
        cv.style.touchAction = o.drag && !o.lite ? 'none' : ''; cv.style.cursor = o.drag && !o.lite ? 'grab' : ''; wake(); },
      // повернуть программно (например, «встряхнуть» надпись при выигрыше); с пружиной сама вернётся
      rotate(dy, dp = 0, kick = false){ if (kick){ vy += dy; vp += dp; } else { yaw = dy; pitch = dp; } wake(); },
      shine, play, count, swap, groups: GROUPS,
      // прервать: анимация и блик кончаются сразу, буквы — на место (ждущий play/count завершается)
      stop(){ shT = -1; if (anim){ anim.keep = false; finish(); } },
      get pose(){ return { yaw, pitch }; },
      get text(){ return o.text; },
      get ready(){ return ready; },   // Promise: надпись собрана (сборка идёт в фоне)
      get stats(){ return { layers: n, max: mode === 'ray' ? 1 : N, frames, render: mode }; },   // для замера: копий в последнем кадре, сколько всего, кадров нарисовано
      destroy(){ dead = true; cancelAnimationFrame(raf); clearTimeout(rt); clearTimeout(shTimer); ro.disconnect(); gl.getExtension('WEBGL_lose_context')?.loseContext(); cv.remove(); },
    };
  }
  return { mount, defaults: DEF };
}
const Extrude = makeExtrude();
