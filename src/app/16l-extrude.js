/* ═══════════════════════════════════════════════════════════════════════════
   ОБЪЁМ (Extrude) — псевдо-3D текст: буквы с толщиной, плавные градиенты, крутится пальцем.
   Один холст WebGL на надпись. Рендер «лучом»: каждая буква — одна коробка своей толщины, для каждой точки
   шейдер пускает луч от глаза и шагает по полю расстояний буквы (sphere tracing выдавленного 2D SDF): лицо — за 1 шаг,
   боковины и края — за несколько; честная нормаль, круглая фаска, сглаживание по ближнему промаху. Не собрался шейдер — простой текст.
   Лицо — градиент до 4 цветов + мягкий блик, который скользит при повороте; боковины — градиент по глубине (от лица к задней стенке) + свет.
   Рисует только когда что-то меняется: покой — ни одного кадра (iPhone не греется). spin — постоянное вращение, только для коротких показов.
   Extrude.mount(el, { text, depth, face, side, … }) → { set(opts), rotate(yaw, pitch), destroy() }
   Файл самодостаточный, без зависимостей — подключается в любой проект (описание — docs/EXTRUDE.md, готовый файл — node tools/extrude-lab.mjs --vendor путь).
   В Pawn склеивается в приложение; его же грузит лаборатория design/extrude.
   ═══════════════════════════════════════════════════════════════════════════ */
function makeExtrude(){
  const DEF = {
    text: 'TEXT', font: '800 {s}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', size: 0,   // шрифт: '{s}' — место размера; size 0 — подогнать под элемент
    depth: 36,                       // толщина букв, px
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
    shadow: null,                    // { x, y, blur, opacity } — тень от букв на их плоскости (px; y < 0 — вниз)
    rim: 0, rimColor: '#ffffff',     // контровой свет по краям силуэта (0–1)
    pattern: '', patternColor: '#ffffff', patternSize: 14, patternAmount: .5,   // узор на лице: 'stripes' (конфета), 'dots', 'grid'
    holo: 0,                         // голограмма: перелив цвета по углу взгляда (0–1)
    quality: 'auto',                 // 'auto' — если кадр не успевает, на время движения рисует в 0.75 разрешения (в покое — полное); 'high' / 'low'
    arc: 0,                          // текст по дуге: радиус px (> 0 — аркой вверх, < 0 — улыбкой), 0 — прямо
    flashColor: '#ffffff',           // цвет вспышки буквы (fl) в пресетах
    charset: '',                     // знаки, заранее положенные в атлас: смена текста из них — без пересборки (счётчик: '0123456789.')
    fit: '',                         // по какой строке подбирать размер (счётчик: '0000.00' — размер не скачет, пока растёт число)
    lite: false,                     // слабый телефон: один неподвижный кадр
    onMove: null,                    // (yaw, pitch) — для звука/вибрации снаружи
  };
  const hex = c => { c = c.replace('#', ''); if (c.length === 3) c = c.replace(/./g, x => x + x); const n = parseInt(c, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const ramp = a => { const o = new Float32Array(12); a.slice(0, 4).forEach((c, i) => o.set(hex(c), i * 3)); return o; };

  // общее для пиксельного шейдера: окружение металла, поле расстояний, блик-полоса, градиенты, полосы обводок
  const FCOM = `precision highp float;
uniform sampler2D uSdf; uniform vec2 uDr, uFd, uK1, uK2; uniform float uGloss, uAmb, uFc, uSc, uIgS, uGlS, uGlR, uEmit, uMet, uCurv, uShX, uShW, uBoost;
uniform vec3 uF[4], uS[4], uL, uK1C, uK2C, uIgC, uGlC, uShC;
varying vec2 vS; varying float vA;
// металл: отражение выдуманного окружения — светлое небо, резкий горизонт, тёмная земля, яркое пятно от света
vec3 env(vec3 n, vec3 c, float aa){
  vec3 r = vec3(0., 0., -1.) + 2. * n.z * n;   // отражение взгляда (смотрим вдоль −z)
  float y = r.y + .28;
  vec3 sky = mix(c * 1.15, vec3(1.), smoothstep(.15, .95, y) * .7), gr = mix(c * .12, c * .55, smoothstep(-.9, -.05, y));
  float w = .04 + aa * .45;
  return mix(gr, sky, smoothstep(-w, w, y)) + pow(max(dot(r, uL), 0.), mix(40., 6., aa)) * mix(.9, .45, aa); }
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
  // рендер лучом: коробка буквы (лицевые грани), луч в системе буквы, шаги по выдавленному полю расстояний
  // aB — угол коробки (px от опоры буквы, z = ±1 × половина толщины), aC — ячейка в атласе (u0, v0 верх, u1, v1 низ),
  // aE — края ячейки (px от опоры: лево, низ, право, верх), aA — опора буквы (px от центра надписи) и номер буквы
  const RVS = `attribute vec3 aB, aA; attribute vec4 aC, aE;
uniform vec2 uRes; uniform float uHd, uCam, uDpr, uK; uniform mat3 uR;
uniform vec4 uLT[32]; uniform vec4 uLZ[32]; uniform vec4 uLS[32];   // uLS: сжатие по ширине и высоте, вспышка
varying vec3 vP, vE, vW0, vW1, vW2; varying vec4 vC, vRect; varying vec2 vAnc, vS; varying float vA, vPx, vFl, vId;
mat3 rX(float a){ float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 rY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 rZ(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
void main(){
  int i = int(aA.z + .5); vec4 T = uLT[i]; vec4 Z = uLZ[i]; vA = Z.y; vFl = uLS[i].z; vId = aA.z;
  float s = max(T.z, .001);
  mat3 L = rZ(T.w) * rY(Z.w) * rX(Z.z);   // поворот буквы: в плоскости и перевороты
  vec3 sc = vec3(uLS[i].xy, 1.) * s;   // масштаб буквы по осям
  vec3 lp = vec3(aB.xy, aB.z * uHd), off = vec3(aA.xy + T.xy, Z.x);
  vec3 wp = uR * (off + L * (lp * sc)) * uK;   // uK — вписывание всей надписи в место
  float k = uCam / max(uCam - wp.z, 1.);
  gl_Position = vec4(wp.xy * k / (uRes * .5), 0., 1.); vS = gl_Position.xy;
  vE = ((vec3(0., 0., uCam / uK) * uR - off) * L) / sc;   // глаз в системе буквы (обратные повороты = транспонированные); луч прямой и в сжатой букве
  vP = lp; vC = aC; vRect = aE; vAnc = aA.xy;
  mat3 W = uR * L; vW0 = W[0]; vW1 = W[1]; vW2 = W[2];
  vPx = 1. / (uDpr * k * min(sc.x, sc.y) * uK);   // сколько px буквы в одном пикселе экрана
}`;
  const RFS = FCOM + `uniform sampler2D uTex; uniform vec2 uSz; uniform float uHd, uBr, uHolo, uRim; uniform vec3 uFlC, uRain, uRimC, uPatC; uniform vec4 uShd, uPat;
varying vec3 vP, vE, vW0, vW1, vW2; varying vec4 vC, vRect; varying vec2 vAnc; varying float vPx, vFl, vId;
// поворот оттенка (радуга по буквам)
vec3 hue(vec3 c, float a){ const vec3 k = vec3(.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1. - ca); }
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
    // снаружи буквы в плоскости: до её «столба» не меньше a по xy — луч может пройти a / |rd.xy|; у самой кромки (ближе 2 px) — обычный шаг, ради сглаживания
    if (a > vPx * 2.) st = max(st, (a - vPx) * .95 / max(length(rd.xy), .02));
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
    bool fh = !(a > b || zs * rd.z > 0.);   // попали в лицо (иначе — в боковину)
    vec3 n = uBr > 0. && a > 0. && b > 0. ? normalize(vec3(g * a, zs * b)) : fh ? vec3(0., 0., zs) : vec3(g, 0.);
    // фаска, видная на экране тоньше 2–3 пикселей (повёрнута к зрителю ребром): красится как продолжение лица.
    // Иначе её отражение (небо) рядом с лицом (земля) — тонкая контрастная линия, а тоньше пикселя она всегда идёт ступеньками
    float thin = 0.;   // 1 — фаска на экране уже пикселя, 0 — широкая
    if (uBr > 0. && a > 0. && b > 0. && !gone){ float bw = uBr * 1.41 * abs(dot(normalize(vec3(g, zs)), rd)) / vPx;
      thin = 1. - smoothstep(1.5, 6., bw); n = normalize(mix(n, vec3(0., 0., zs), thin * .8)); }
    vec2 tt = vec2((vAnc.x + p.x) / uSz.x + .5, .5 - (vAnc.y + p.y) / uSz.y);   // место в надписи 0–1
    // лицо ↔ боковина: на фаске — по нормали; на остром ребре — по расстоянию до ребра в пикселях экрана (с учётом наклона грани),
    // иначе ребро идёт лесенкой: соседние пиксели целиком «лицо» или целиком «боковина»
    vec3 nF = vec3(0., 0., zs), nS = vec3(g, 0.); float wf;
    // фаска задней стенки (повёрнута от зрителя) цвета лица не даёт — у края силуэта там видна боковина, иначе белые точки по кромке
    if (uBr > 0.){ wf = zs * rd.z > 0. ? 0. : smoothstep(.3, .85, abs(n.z)); nF = n; nS = n; }
    else { float fpF = vPx / max(abs(rd.z), .15), fpS = vPx / max(abs(dot(nS, rd)), .15);
      wf = fh ? clamp(.5 + max(-dc, 0.) / fpF, 0., 1.) : zs * rd.z < 0. ? clamp(.5 - (uHd - abs(p.z)) / fpS, 0., 1.) : 0.; }
    nF.xy += (tt - .5) * vec2(1., -1.) * uCurv; nF = normalize(nF);
    mat3 W = mat3(vW0, vW1, vW2);
    vec3 N = normalize(W * nF), NS = normalize(W * nS), H = normalize(uL + vec3(0., 0., 1.));
    // сглаживание подсветки: насколько фаска узкая в пикселях (1 — уже пикселя); на ней нормаль поворачивается на 90° —
    // острый блик и горизонт отражения становятся мягче, иначе соседние пиксели то ловят блик, то нет (точки по краю)
    // на круглой фаске нормаль на пиксель поворачивается примерно на vPx / uBr радиан: блик и горизонт отражения уже этого — мерцают точками
    float aa = uBr > 0. && a > 0. && b > 0. ? max(thin, clamp(vPx * 6. / uBr, 0., 1.)) : 0.;
    float dif = max(dot(N, uL), 0.), spc = pow(max(dot(N, H), 0.), mix(30., 5., aa)) * mix(1., .4, aa), difS = max(dot(NS, uL), 0.);
    vec3 fb = rampF(dot(tt - .5, uFd) + .5), fc = fb * (.72 + .28 * dif);
    float sh = .45 - N.x * 1.1 + N.y * .5;   // мягкий блик: полоса по диагонали, едет вслед за поворотом
    fc += exp(-pow((tt.x * .8 + tt.y * .45 - sh) * 2.6, 2.)) * uGloss * .55 + spc * uGloss * step(.001, uBr) * (1. - wf * .5);
    // где поверхность к зрителю ребром (край силуэта, внешняя кромка фаски) — отражение металла гасится к основному цвету:
    // под скользящим углом оно всегда «небо», и частично закрытые пиксели края горели тонкой ступенчатой линией
    vec3 V = -normalize(W * rd); float gz = smoothstep(.06, .4, abs(dot(N, V))), gzS = smoothstep(.06, .4, abs(dot(NS, V)));
    if (uMet > 0.) fc = mix(fc, mix(fb * .55, env(N, fb, aa), gz), uMet);
    if (uIgS > 0.) fc = mix(fc, uIgC, exp(min(dc, 0.) / uIgS) * .85);
    fc = mix(fc, uK1C, band(-dc, uK1)); fc = mix(fc, uK2C, band(-dc, uK2));
    // голограмма: оттенок зависит от угла взгляда и места на надписи (палитра на косинусах)
#ifdef HOLO
    if (uHolo > 0.){ float v = dot(N, -normalize(W * rd));
      vec3 hc = .55 + .45 * cos(6.2832 * (vec3(0., .33, .67) + v * 1.6 + tt.x * .8 + tt.y * .3));
      fc = mix(fc, hc * (.65 + .35 * dif) + spc * .8, uHolo); }
#endif
#ifdef PATTERN
    // узор на лице в px надписи: полосы-конфета, точки, сетка; край — гладкий на 1 пиксель
    if (uPat.x > 0.){ vec2 q = (vAnc + p.xy) / uPat.y; float aa = vPx / uPat.y * 1.5, m;
      if (uPat.x < 1.5){ float v = abs(fract((q.x + q.y) * .7071) - .5) * 2.; m = smoothstep(.5 - aa, .5 + aa, v); }
      else if (uPat.x < 2.5){ float r = length(fract(q) - .5); m = 1. - smoothstep(.27 - aa, .27 + aa, r); }
      else { vec2 f = abs(fract(q) - .5); m = smoothstep(.44 - aa, .44 + aa, max(f.x, f.y)); }
      fc = mix(fc, uPatC * (.75 + .25 * dif) + spc * uGloss * .4, m * uPat.z); }
#endif
    vec3 sb = rampS((uHd - p.z) / (2. * uHd)), sc = mix(sb * (uAmb + (1. - uAmb) * difS), sb, uEmit) + pow(max(dot(NS, H), 0.), mix(22., 5., aa)) * mix(1., .4, aa) * uGloss * .5;
    if (uMet > 0.) sc = mix(sc, mix(sb * .55, env(NS, sb, aa), gzS), uMet * .8);
    col = mix(sc, fc, wf) + uShC * sweep() * mix(.6, 1., wf);
    if (uRim > 0.){ float fr = pow(1. - abs(dot(mix(NS, N, wf), -normalize(W * rd))), 3.); col += uRimC * fr * uRim; }   // контровой свет: ярче там, где поверхность к нам ребром
    col *= 1. + uBoost * .6;
    if (uRain.x > 0.) col = mix(col, hue(col, uRain.y + vId * uRain.z), uRain.x);
    col += uFlC * vFl;
  }
  // свечение: где луч прошёл мимо — по расстоянию до буквы на лицевой плоскости, обращённой к глазу
  vec3 glw = vec3(0.); float sha = 0.;
  if ((uGlS > 0. || uShd.w > 0.) && cov < 1.){
    float zf = vE.z >= 0. ? uHd : -uHd, tp = max((zf - ro.z) / rs.z, 0.); vec2 pp = (ro + rd * tp).xy;
    if (uGlS > 0.){ float dg = max(d2(pp), 0.); glw = uGlC * uGlS * (1. + uBoost * 2.) * exp(-dg / uGlR) * (1. - smoothstep(.55, 1., dg / (uDr.y * .5))) * (1. - cov); }
    // тень: та же буква, сдвинутая и размытая, на её плоскости — тёмным, под самой буквой
    if (uShd.w > 0.){ float ds = d2(pp - uShd.xy); sha = uShd.w * (1. - smoothstep(-uShd.z * .5, uShd.z, ds)) * (1. - smoothstep(.6, 1., ds / (uDr.y * .5))) * (1. - cov); }
  }
  gl_FragColor = vA * vec4(col * cov + glw, cov + sha);
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
    let fitK = 1;   // вписывание: < 1, если текст не помещается
    let tracks = [], cur = null, holdG = 0, rs = 1, slow = 0;   // rs — доля разрешения холста (1 или 0.75); slow — сколько кадров подряд не успели   // дорожки анимаций; cur — чья сейчас считается; holdG — стоп-кадр всей сцены
    let frames = 0, sdf = null, PR = null, mode = '', bufR = null, inset = [0, 0], dr = [1, 1], G = [], cellH = 0, AW = 1, AH = 1, CELLS = {}, LH = 1, EX = 0, MX = null, gpx = 0, boost = 0, tx = [0, 0], shT = -1, shTimer = 0, sz = [1, 1], cw = 1, ch = 1, dpr = 1, tex = null, U = {};

    if (!gl){ el.textContent = o.text; return { set(){}, rotate(){}, destroy(){ cv.remove(); } }; }   // без WebGL — просто текст
    const sh = (t, s) => { const h = gl.createShader(t); gl.shaderSource(h, s); gl.compileShader(h); if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(h)); return h; };
    const UN = ['uSz', 'uRes', 'uCam', 'uR', 'uTex', 'uGloss', 'uAmb', 'uFc', 'uSc', 'uF', 'uS', 'uL', 'uFd', 'uSdf', 'uDr', 'uIgS', 'uGlS', 'uGlR', 'uEmit', 'uK1C', 'uK2C', 'uIgC', 'uGlC', 'uK1', 'uK2', 'uBev', 'uMet', 'uCurv', 'uShX', 'uShW', 'uShC', 'uLT', 'uLZ', 'uLS', 'uBoost', 'uHd', 'uBr', 'uDpr', 'uFlC', 'uRain', 'uHolo', 'uRim', 'uRimC', 'uPatC', 'uShd', 'uPat', 'uK'];
    // программа: шейдеры, адреса параметров и атрибутов; null — не собралась
    function mk(vs, fs, attrs){ try {
      const pg = gl.createProgram(); gl.attachShader(pg, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pg);
      if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pg));
      const U = {}; UN.forEach(k => U[k] = gl.getUniformLocation(pg, k));
      return { pg, U, A: attrs.map(a => gl.getAttribLocation(pg, a)) };
    } catch (e){ console.warn('Extrude:', e.message); return null; } }
    // варианты шейдера: редкие образы (голограмма, узор) вкомпилированы, только если включены; готовые — в кеше
    const RAYS = {};
    const rayKey = () => (o.holo ? 'H' : '') + (o.pattern ? 'P' : '');
    const rayProg = k => k in RAYS ? RAYS[k] : (RAYS[k] = mk(RVS, (k.includes('H') ? '#define HOLO\n' : '') + (k.includes('P') ? '#define PATTERN\n' : '') + RFS, ['aB', 'aC', 'aE', 'aA']));
    const PRAY = rayProg('');
    if (!PRAY){ cv.remove(); el.textContent = o.text; return { set(){}, rotate(){}, play: () => Promise.resolve(), destroy(){} }; }   // шейдер не собрался — простой текст
    // включить вариант шейдера: своя программа, свои атрибуты, параметры цвета заново
    function useMode(){ const rk = rayKey(); if (PR && rk === mode) return; mode = rk; PR = rayProg(rk) || PRAY;
      for (let i = 0; i < 16; i++) gl.disableVertexAttribArray(i);
      gl.useProgram(PR.pg); U = PR.U; PR.A.forEach(a => a >= 0 && gl.enableVertexAttribArray(a));
      if (G.length) colors(); }
    // движение букв: на каждую — сдвиг x, y, масштаб, поворот и сдвиг к зрителю, прозрачность (до 32 букв; дальше — как последняя)
    const LT = new Float32Array(128), LZ = new Float32Array(128), LS = new Float32Array(128);   // LZ: сдвиг к зрителю, прозрачность, переворот вокруг x, вокруг y; LS: масштаб по ширине, по высоте, вспышка, растворение
    let pY = 0, pP = 0;   // покачивание всей надписи поверх позы (градусы) — от анимаций «жизни»
    let rain = [0, 0, 0];   // радуга по буквам: сила, сдвиг оттенка, шаг оттенка на букву
    const still0 = () => { for (let i = 0; i < 32; i++){ LT.set([0, 0, 1, G[i]?.br || 0], i * 4); LZ.set([0, 1, 0, 0], i * 4); LS.set([1, 1, 0, 0], i * 4); } boost = 0; pY = pP = 0; rain = [0, 0, 0]; };
    still0();
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    bufR = gl.createBuffer(); tex = gl.createTexture(); sdf = gl.createTexture();
    useMode();

    // геометрия: коробка на букву (12 треугольников)
    function geom(){
      const v = [];
      G.forEach((g, gi) => { const ax = g.ax, ay = g.ay, l = (g.pen - g.l) / dpr - (g.pen + g.adv / 2) / dpr, r = l + g.w / dpr, t = cellH / 2 / dpr, b = t - cellH / dpr;
        const C = [g.ux / AW, g.uy / AH, (g.ux + g.w) / AW, (g.uy + cellH) / AH], E = [l, b, r, t], k = Math.min(31, gi);
        // шесть граней, углы против часовой, если смотреть снаружи
        [[[l, b, 1], [r, b, 1], [r, t, 1], [l, t, 1]], [[r, b, -1], [l, b, -1], [l, t, -1], [r, t, -1]], [[r, b, 1], [r, b, -1], [r, t, -1], [r, t, 1]],
         [[l, b, -1], [l, b, 1], [l, t, 1], [l, t, -1]], [[l, t, 1], [r, t, 1], [r, t, -1], [l, t, -1]], [[l, b, -1], [r, b, -1], [r, b, 1], [l, b, 1]]]
          .forEach(f => [0, 1, 2, 0, 2, 3].forEach(j => v.push(...f[j], ...C, ...E, ax, ay, k))); });
      gl.bindBuffer(gl.ARRAY_BUFFER, bufR); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    }
    // запас под свечение (px картинки) — сторона квадрата лица больше букв на него; дальше 2.5 размеров свечение уже не видно
    const glowPx = () => Math.ceil(Math.max(o.glow ? o.glow.size * 2.5 : 0, o.shadow ? Math.max(Math.abs(o.shadow.x || 0), Math.abs(o.shadow.y || 0)) + (o.shadow.blur ?? 6) * 1.5 + 2 : 0) * dpr);
    let bn = 0, ready = Promise.resolve(), PEND = null;   // PEND — знаки атласа, который сейчас собирается в фоне
    // сборка: размер и атлас букв рисуются сразу, тяжёлый счёт по пикселям (размытие, нормали, поле расстояний) — в фоновом потоке,
    // чтобы интерфейс не замирал; до готовности на холсте остаётся прежняя надпись (или пусто)
    // размер шрифта: заданный или подгонка под элемент с запасом под боковины и свечение
    let builtFs = 0;
    function fsFor(){ if (o.size) return o.size;
      const room = o.depth * o.pad * 2 + 8 + (o.glow ? o.glow.size * 2 : 0), x = (fsFor.x ||= document.createElement('canvas').getContext('2d')); x.font = o.font.replace('{s}', 100);
      const ls = String(o.fit || o.text).split('\n'), tw = Math.max(1, ...ls.map(l => x.measureText(l).width)) + 105 * ls.length * Math.abs(o.skew || 0);
      return Math.max(8, Math.min((Math.max(1, el.clientWidth) - room) / tw * 100, (Math.max(1, el.clientHeight) - room) / (1.05 * ls.length))); }
    function build(){
      dpr = Math.min(2, devicePixelRatio || 1); cw = Math.max(1, el.clientWidth); ch = Math.max(1, el.clientHeight);
      const fs = builtFs = fsFor();
      const m = atlas(fs), my = ++bn, W0 = cw, H0 = ch, D0 = dpr; PEND = m.cells;
      return ready = proc(m.job).then(res => { if (dead || my !== bn) return; PEND = null; m.img.data.set(res.d); apply(m, res.sdf, W0, H0, D0); });
    }
    // размер холста по доле разрешения (CSS-размер не меняется); low — всегда 0.75
    const fitCanvas = () => { const k = o.quality === 'low' ? .75 : rs; cv.width = Math.round(cw * dpr * k); cv.height = Math.round(ch * dpr * k); };
    function apply(m, sdfData, W0, H0, D0){
      cw = W0; ch = H0; dpr = D0; fitCanvas();
      CELLS = m.cells; cellH = m.cellH; AW = m.W; AH = m.H; gpx = m.gp; LH = m.lh; EX = m.ex; MX = m.mx; layout();
      inset = [m.gp / m.W, m.gp / m.H]; dr = [m.rIn * 2 / dpr, m.rOut * 2 / dpr]; tx = [1.5 / m.W, 1.5 / m.H];
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
      const job = { W, H, d: img.data, r, deco: true, rIn, rOut, sr: Math.max(1, Math.round(dpr)) };
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
      // опоры букв (px от центра надписи); по дуге — на окружности радиуса arc, с поворотом по касательной
      const A0 = o.arc || 0;
      G.forEach(g => { const x = (g.pen + g.adv / 2) / dpr, y = g.cy / dpr;
        if (!A0){ g.ax = x; g.ay = y; g.br = 0; return; }
        const th = x / A0; g.ax = A0 * Math.sin(th); g.ay = y - A0 * (1 - Math.cos(th)); g.br = -th; });
      for (let i = 0; i < 32; i++) LT[i * 4 + 3] = G[i]?.br || 0;
      const room = o.depth * o.pad * 2 + 8 + (o.glow ? o.glow.size * 2 : 0);
      fitK = Math.min(1, (cw - room) / Math.max(1, sz[0]), (ch - room) / Math.max(1, sz[1]));   // текст шире места (смена текста, окно стало меньше) — уменьшить без пересборки
    }
    // текст из уже готовых ячеек — только переложить квадраты (дёшево); есть новый знак — пересобрать атлас
    const covered = t => [...String(t)].every(c => !c.trim() || CELLS[c]);
    // знаки есть в атласе, который уже собирается, — новую сборку не начинать: она отменила бы ту, и атлас не доехал бы никогда
    // (готовая сборка сама разложит текущий текст)
    const coming = t => PEND && [...String(t)].every(c => !c.trim() || PEND[c]);
    function retext(){ layout(); geom(); }
    // «форма» атласа: всё, от чего зависят картинка букв и поле расстояний
    const shape = q => JSON.stringify([q.font, q.size, q.depth, q.pad, q.skew, q.charset, q.fit, q.bevel || 0,
      (q.strokes || []).map(k => [k.width, k.inset || 0]), q.innerGlow ? q.innerGlow.size : 0, q.glow ? q.glow.size : 0,
      q.shadow ? [q.shadow.x || 0, q.shadow.y || 0, q.shadow.blur ?? 6] : 0]);

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
      gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uSdf, 1);   // маска с нормалями — 0, поле расстояний — 1
    }
    function draw(){
      if (dead) return; frames++;
      const Y = (yaw + pY) * Math.PI / 180, P = (pitch + pP) * Math.PI / 180, cy = Math.cos(Y), sy = Math.sin(Y), cp = Math.cos(P), sp = Math.sin(P);
      // R = Rx(pitch) · Ry(yaw), по столбцам (как ждёт WebGL)
      const R = [cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy];
      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      drawRay(R);
    }
    // лучом: одна коробка на букву, один проход; фаска не толще половины буквы и не дальше точного поля внутри
    function drawRay(R){
      gl.uniformMatrix3fv(U.uR, false, R); gl.uniform2f(U.uSz, sz[0], sz[1]); gl.uniform2f(U.uRes, cw, ch);
      gl.uniform1f(U.uK, fitK); gl.uniform1f(U.uHd, o.depth / 2); gl.uniform1f(U.uCam, o.persp); gl.uniform1f(U.uDpr, cv.width / cw);   // пикселей холста на px — сглаживание остаётся в 1 пиксель и при пониженном разрешении
      gl.uniform1f(U.uBr, Math.max(0, Math.min(o.bevel || 0, o.depth / 2 - .5, dr[0] / 2 - 1)));
      gl.uniform3fv(U.uFlC, hex(o.flashColor));
      gl.uniform1f(U.uHolo, o.holo || 0); gl.uniform1f(U.uRim, o.rim || 0); gl.uniform3fv(U.uRimC, hex(o.rimColor)); gl.uniform3fv(U.uPatC, hex(o.patternColor));
      const sd0 = o.shadow; gl.uniform4f(U.uShd, sd0 ? sd0.x || 0 : 0, sd0 ? sd0.y || 0 : 0, sd0 ? Math.max(.5, sd0.blur ?? 6) : 1, sd0 ? sd0.opacity ?? .5 : 0);
      gl.uniform4f(U.uPat, { stripes: 1, dots: 2, grid: 3 }[o.pattern] || 0, o.patternSize || 14, o.patternAmount ?? .5, 0);
      gl.uniform3f(U.uRain, Math.min(1, rain[0] + rainSet[0]), rain[1] + rainSet[1], rain[2] + rainSet[2]);
      gl.uniform4fv(U.uLT, LT); gl.uniform4fv(U.uLZ, LZ); gl.uniform4fv(U.uLS, LS); gl.uniform1f(U.uBoost, boost); gl.uniform2f(U.uDr, dr[0], dr[1]);
      gl.uniform1f(U.uShX, shT < 0 ? -9 : -1.8 + shT * 3.6);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufR);
      const [aB, aC, aE, aA] = PR.A;
      gl.vertexAttribPointer(aB, 3, gl.FLOAT, false, 56, 0); gl.vertexAttribPointer(aC, 4, gl.FLOAT, false, 56, 12);
      gl.vertexAttribPointer(aE, 4, gl.FLOAT, false, 56, 28); gl.vertexAttribPointer(aA, 3, gl.FLOAT, false, 56, 44);
      // от дальней буквы к ближней: коробки соседей перекрываются при повороте, буфера глубины нет
      const ord = G.map((g, i) => { const k = Math.min(31, i), x = g.ax + LT[k * 4], y = g.ay + LT[k * 4 + 1], z = LZ[k * 4];
        return [R[2] * x + R[5] * y + R[8] * z, i]; }).sort((a, b) => a[0] - b[0]);
      for (const [, i] of ord) gl.drawArrays(gl.TRIANGLES, i * 36, 36);
    }

    // движение: инерция после броска, пружина в позу покоя, вращение — кадры идут, только пока что-то движется
    function tick(t){
      raf = 0; const raw = last ? t - last : 16, dt = Math.min(.1, raw / 1000); last = t;
      // кадр дольше 24 мс (меньше ~40 к/с) восемь раз подряд — до конца движения рисуем в 0.75 разрешения (56% пикселей)
      if (o.quality === 'auto' && rs === 1){ slow = raw > 24 ? slow + 1 : 0; if (slow >= 8){ rs = .75; fitCanvas(); } }   // до 0.1 с на кадр: на слабом телефоне (10–20 к/с) анимации не растягиваются по времени
      if (!held){
        const sp = o.spin && !calm;   // при постоянном вращении пружина держит только наклон
        if (o.spring){ if (!sp) vy += ((o.yaw - yaw) * 60 - vy * 9) * dt; else vy *= Math.exp(-dt * 3); vp += ((o.pitch - pitch) * 60 - vp * 9) * dt; }
        else { const f = Math.exp(-dt * 3); vy *= f; vp *= f; }
        yaw += (vy + (calm ? 0 : o.spin)) * dt; pitch = Math.max(-80, Math.min(80, pitch + vp * dt));
      }
      if (shT >= 0){ shT += dt / o.shine.time; if (shT > 1) shT = -1; }
      if (tracks.length) compose(dt);
      draw(); o.onMove?.(yaw, pitch);
      const still = Math.abs(vy) + Math.abs(vp) < .4 && (!o.spring || Math.abs(o.yaw - yaw) + Math.abs(o.pitch - pitch) < .05);
      if (held || (o.spin && !calm) || !still || shT >= 0 || tracks.some(A => !A.ended)) raf = requestAnimationFrame(tick);
      else { last = 0; slow = 0; if (rs < 1){ rs = 1; fitCanvas(); draw(); } }   // покой — один кадр в полном разрешении
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
    const ro = new ResizeObserver(() => { const w = el.clientWidth, h = el.clientHeight; if (w === ow && h === oh) return; ow = w; oh = h;
      if (dead || !G.length) return;
      cw = Math.max(1, w); ch = Math.max(1, h); fitCanvas(); layout(); geom(); draw();
      clearTimeout(rt); const d = Math.min(2, devicePixelRatio || 1), k = fsFor() / (builtFs || 1);
      if (d !== dpr || k > 1.15 || k < .87) rt = setTimeout(() => !dead && build(), 300); }); ro.observe(el);
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
    const anc = g => [g.ax, g.ay];   // опора буквы от центра надписи
    // буква: x, y (вверх), z (к зрителю), s — масштаб, r — поворот в плоскости, a — прозрачность, fx/fy — перевороты, sx/sy — сжатие
    // only: номер строки — двигается только она, остальные скрыты
    // дорожки складываются: сдвиги, повороты, вспышка и растворение — суммой; масштаб и прозрачность — произведением
    // fl — вспышка буквы (0–1, цветом flashColor)
    const put = (i, st) => { if (i > 31) return; const g = G[i]; let a = st.a ?? 1; if (cur?.o.only != null && g && g.li !== cur.o.only) a = 0;
      LT[i * 4] += st.x || 0; LT[i * 4 + 1] += st.y || 0; LT[i * 4 + 2] *= st.s ?? 1; LT[i * 4 + 3] += st.r || 0;
      LZ[i * 4] += st.z || 0; LZ[i * 4 + 1] *= a; LZ[i * 4 + 2] += st.fx || 0; LZ[i * 4 + 3] += st.fy || 0;
      LS[i * 4] *= st.sx ?? 1; LS[i * 4 + 1] *= st.sy ?? 1; LS[i * 4 + 2] += st.fl || 0; };
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
      label: (A, t, du, spread) => { boost += Math.max(0, .5 * Math.sin(Math.PI * clamp((t - spread * .5) / .5))); return null; } });
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
      if (p >= 1 && !A.hit.has(-1)){ land(A, -1); holdG = Math.max(holdG, .06); }
      const k = 1 + (1 - e) * .7 + (p >= 1 ? .1 * Math.exp(-q / .08) * Math.cos(q * 30) : 0), [sx, sy] = p >= 1 ? shake(q, 7, 15, .1) : [0, 0], sq = p >= 1 ? 1 - spring(q, .25, .5) : 0;
      G.forEach((g, i) => { const [ax, ay] = anc(g); put(i, { x: sx + ax * (k - 1), y: sy + ay * (k - 1), z: (1 - e) * 120, s: k, a: clamp(p * 3), sx: 1 + .1 * sq, sy: 1 - .12 * sq }); });
      boost += p >= 1 ? Math.exp(-q / .2) : 0;
      return q < .5; };

    // ── ЖИЗНЬ (тихо, конечно: по умолчанию 2.4–3 с, потом надпись замирает) ──
    const env = (t, du) => Math.sin(Math.PI * clamp(t / du));   // плавно нарастает и стихает
    P.wave = (A, t) => { const du = A.o.time ?? 2.4, en = env(t, du), h = H();
      G.forEach((g, i) => { const w = Math.sin(t * 4.4 - i * .45); put(i, { y: w * .07 * h * en, r: w * .03 * en, s: 1 + w * .02 * en }); }); return t < du; };
    P.breathe = (A, t) => { const du = A.o.time ?? 3, k = 1 + .025 * Math.sin(t * 2 * Math.PI * .33) * env(t, du);
      G.forEach((g, i) => { const [ax, ay] = anc(g); put(i, { x: ax * (k - 1), y: ay * (k - 1), s: k }); }); boost += .15 * env(t, du) * (.5 + .5 * Math.sin(t * 2.1)); return t < du; };
    // парение всей надписи в 3D: покачивание 5° / 2.5° на несовпадающих частотах
    P.float = (A, t) => { const du = A.o.time ?? 3.2, en = env(t, du); pY += 5 * Math.sin(t * 2 * Math.PI * .22) * en; pP += 2.5 * Math.sin(t * 2 * Math.PI * .31) * en;
      G.forEach((g, i) => put(i, { y: 3 * Math.sin(t * 2.2) * en })); return t < du; };
    // пульс свечения (без мигания: < 1 Гц)
    P.glow = (A, t) => { const du = A.o.time ?? 2.6; boost += .45 * (.5 - .5 * Math.cos(t * 2 * Math.PI * .7)) * env(t, du); G.forEach((g, i) => put(i, {})); return t < du; };
    // желе: буквы по очереди мягко сплющиваются
    P.jelly = (A, t) => { const du = A.o.time ?? 2.4, en = env(t, du);
      G.forEach((g, i) => { const w = Math.sin(t * 7 - i * .9) * .07 * en; put(i, { sx: 1 + w, sy: 1 - w }); }); return t < du; };

    // ── АКЦЕНТ (коротко, ≤ 0.5 с, затухает) ──
    // удар масштабом: 1 → 1.15 за 80 мс, назад пружиной ζ 0.45; буквы от центра с шагом 15 мс; вспышка
    P.punch = per({ group: 'accent', each: .015, from: 'center', time: .08 + settle(.3, .45), land: 0, L: (A, p, i, n, g, tl) => {
        const k = tl < .08 ? 1 + .15 * E.outC(clamp(tl / .08)) : 1 + .15 * (1 - spring(tl - .08, .3, .45)); return { s: k }; },
      label: (A, t) => { boost += t < .05 ? t / .05 : Math.exp(-(t - .05) / .25); return null; } });
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
    P.flash = (A, t) => { const b = t < .05 ? t / .05 : Math.exp(-(t - .05) / .25); boost += b; if (t === 0) land(A, -1);
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
      boost += p >= 1 ? (1 - q) ** 2 : 0;
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
      if (o.lite || calm || ff){ o.text = String(text); retext(); draw(); return; }
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
    // кадр сцены: всё к покою, потом каждая дорожка добавляет своё; закончившаяся с keep (уход) держит последний кадр, пока её не сменят
    function compose(dt){
      still0();
      if (holdG > 0){ holdG -= dt; dt = 0; }
      for (const A of tracks.slice()){ cur = A;
        if (A.ended){ A.f(A.t); continue; }
        A.t += dt * (A.o.speed || 1);   // speed — общий множитель скорости пресета
        if (!A.f(A.t)){ A.ended = true; if (!A.keep) tracks.splice(tracks.indexOf(A), 1); A.res(); } }
      cur = null;
    }
    const drop = A => { const k = tracks.indexOf(A); if (k >= 0) tracks.splice(k, 1); if (!A.ended){ A.ended = true; A.res(); } };
    const LAYER = n => GROUPS.idle.includes(n) ? 'idle' : GROUPS.accent.includes(n) ? 'accent' : 'base';
    // play: база (появление, уход, смена, счётчик) сменяет базу; «жизнь» и акцент — слоем поверх (тот же слой сменяет свой); opt.layer — свой слой
    function play(name, opt = {}){
      const f = ANIM[name]; if (!f) return Promise.resolve();
      const grp = opt.layer || LAYER(name);
      tracks.filter(A => A.grp === grp).forEach(drop);
      return new Promise(res => {
        const A = { t: 0, o: opt, hit: new Set(), keep: false, pop: [], tick: -1, seed: Math.random() * 100, lt: {}, grp, res, ended: false };
        A.perm = G.map((g, i) => i).sort(() => Math.random() - .5);
        const L = A.o.onLand; A.o = { ...opt, onLand: i => { A.lt[i] = A.t; L?.(i); } };   // время удара каждой буквы — для тряски на приземлении
        A.f = t => f(A, t); tracks.push(A);
        if (o.lite || calm || ff){ cur = A; A.f(1e3); cur = null; if (!GROUPS.out.includes(name)) G.forEach((g, i) => land(A, i));
          A.ended = true; if (!A.keep) tracks.splice(tracks.indexOf(A), 1); compose(0); draw(); res(); return; }
        compose(0); draw(); wake(); });
    }
    // радуга по буквам: t.rainbow(сила 0–1, сдвиг, шаг на букву) — оттенок поворачивается от буквы к букве
    const rainbow = (k = 1, ph = 0, step = .5) => { rainSet = [k, ph, step]; draw(); };
    let rainSet = [0, 0, 0];

    // ── ЕЩЁ: на вспышке, радуге и слоях ──
    const tb = (t, q) => Math.floor(t / q);   // номер «тика» (для дрожи и мерцания ступеньками, а не каждый кадр)
    // появление: буквы зажигаются по очереди — вспышка на пике выскока
    P.ignite = per({ group: 'in', each: .06, time: .45, land: .25, L: (A, p, i, n, g, tl) => ({ s: .6 + .4 * spring(tl, .28, .55), fl: .5 * Math.max(0, 1 - tl / .25) * clamp(tl / .04), a: clamp(tl / .05) }) });
    // появление: качель — буква повисает на рывке и раскачивается до покоя (пружина ζ 0.3)
    P.swing = per({ group: 'in', each: .05, time: settle(.5, .3), land: .1, L: (A, p, i, n, g, tl) => ({ r: (i % 2 ? 1 : -1) * 1.1 * (1 - spring(tl, .5, .3)), y: .5 * H() * (1 - spring(tl, .25, .8)), a: clamp(tl / .08) }) });
    // появление: взрыв из центра — вся надпись из нуля пружиной с перелётом, вспышка
    P.boom = (A, t) => { const k = Math.max(0, spring(t, .42, .42)); if (t === 0) land(A, -1);
      G.forEach((g, i) => { const [ax, ay] = anc(g); put(i, { x: ax * (k - 1), y: ay * (k - 1), s: k, a: clamp(t / .06) }); }); boost += Math.exp(-t / .3); return t < settle(.42, .42); };
    // появление: марш — буквы заходят слева прыжками
    P.march = per({ group: 'in', each: .07, time: .5, land: 1, L: (A, p) => { const e = E.outC(p); return { x: -1.2 * H() * (1 - e), y: .35 * H() * Math.abs(Math.sin(Math.PI * 2 * p)) * (1 - p), a: clamp(p / .2) }; } });

    // жизнь: бегущие огни, как лампочки казино (огонь по буквам по кругу)
    P.chase = (A, t) => { const du = A.o.time ?? 3, en = env(t, du), n = G.length;
      G.forEach((g, i) => { const w = Math.cos(t * 9 - i * 1.1); put(i, { fl: .32 * Math.max(0, w) ** 6 * en }); }); return t < du; };
    // жизнь: радуга течёт по буквам
    P.rainflow = (A, t) => { const du = A.o.time ?? 3, en = env(t, du); rain[0] += .75 * en; rain[1] += t * 2.2; rain[2] += .55; G.forEach((g, i) => put(i, {})); return t < du; };
    // жизнь: мерцание — изредка буква подмигивает (ступеньками по 90 мс, < 3 вспышек в секунду)
    P.flicker = (A, t) => { const du = A.o.time ?? 3, k = tb(t, .09);
      G.forEach((g, i) => { const r = rnd(A, i, k), off = r < .06 && t < du - .2 ? .35 + r * 4 : 1; put(i, { a: off, fl: off < 1 ? 0 : .08 * Math.sin(t * 40 + i) ** 2 }); }); boost += .2 * env(t, du); return t < du; };
    // жизнь: облёт — надпись медленно поворачивается в 3D (шире, чем парение)
    P.orbit = (A, t) => { const du = A.o.time ?? 4, en = env(t, du); pY += 24 * Math.sin(t * 2 * Math.PI / du) * en; pP += 6 * Math.sin(t * 2 * Math.PI / du * 2) * en; G.forEach((g, i) => put(i, {})); return t < du; };
    // жизнь: маятник — буквы покачиваются вразнобой
    P.pendulum = (A, t) => { const du = A.o.time ?? 3, en = env(t, du); G.forEach((g, i) => put(i, { r: .12 * Math.sin(t * 3.2 + i * .9) * en })); return t < du; };

    // акцент: глитч — 0.45 с рывков, сдвигов и цветовых сбоев ступеньками по 40 мс
    P.glitch = (A, t) => { const k = tb(t, .04), on = t < .45; if (t === 0) land(A, -1);
      G.forEach((g, i) => { const r = rnd(A, i, k), hit = on && r < .45; put(i, hit ? { x: (rnd(A, i, k + 50) * 2 - 1) * 9, y: (rnd(A, i, k + 90) * 2 - 1) * 3, sx: 1 + (r - .2) * .5, fl: .25 * rnd(A, i, k + 7) } : {}); });
      if (on && rnd(A, 0, k + 3) < .25){ rain[0] += .45; rain[1] += (rnd(A, 1, k) - .5) * 1.6; } return t < .5; };
    // акцент: рябь — волна увеличения бежит от центра к краям
    P.ripple = (A, t) => { const n = G.length, m = (n - 1) / 2;
      G.forEach((g, i) => { const d = Math.abs(i - m) / Math.max(1, m), w = Math.exp(-((((t / .5) - d) * 4) ** 2)); put(i, { s: 1 + .28 * w, y: .12 * H() * w, fl: .25 * w }); }); return t < .65; };
    // акцент: сердцебиение — два толчка «тук-тук»
    P.heartbeat = (A, t) => { const b = (u, k) => u < 0 ? 0 : k * Math.exp(-u / .09) * Math.sin(Math.min(Math.PI, u / .09 * Math.PI)) ** 2, k = 1 + b(t, .14) + b(t - .2, .1);
      if (t === 0) land(A, -1); G.forEach((g, i) => { const [ax, ay] = anc(g); put(i, { x: ax * (k - 1), y: ay * (k - 1), s: k }); }); boost += (k - 1) * 2.5; return t < .55; };
    // акцент: печать — короткий удар сверху с замахом и сплющиванием (для «NEW RECORD»)
    P.stamp = (A, t) => { const du = .16, p = clamp(t / du), q = Math.max(0, t - du), k = p < 1 ? 1.45 - .45 * E.inC(p) : 1, sq = p >= 1 ? 1 - spring(q, .22, .45) : 0;
      if (p >= 1 && !A.hit.has(-1)){ land(A, -1); holdG = Math.max(holdG, .05); } const [sx, sy] = p >= 1 ? shake(q, 4, 18, .08) : [0, 0];
      G.forEach((g, i) => { const [ax, ay] = anc(g); put(i, { x: sx + ax * (k - 1), y: sy + ay * (k - 1), s: k, sx: 1 + .1 * sq, sy: 1 - .14 * sq, a: clamp(p * 4) }); }); boost += p >= 1 ? Math.exp(-q / .15) * .8 : 0; return q < .45; };
    // акцент: искра — вспышка пробегает по буквам слева направо
    P.spark = per({ group: 'accent', each: .035, time: .3, land: 0, L: (A, p) => ({ fl: .42 * Math.sin(Math.PI * p) ** 2, s: 1 + .06 * Math.sin(Math.PI * p) }) });

    // уход: взрыв — от центра наружу с вращением и ростом, гаснет
    P.blast = per({ group: 'out', keep: true, each: 0, time: .45, L: (A, p, i, n, g) => { const e = E.outX(p), [ax, ay] = anc(g), d = Math.hypot(ax, ay) || 1, k = 2.4 * H() * e;
        return { x: ax / d * k + (rnd(A, i, 11) * 2 - 1) * .5 * H() * e, y: ay / d * k + (rnd(A, i, 12) * 2 - 1) * .5 * H() * e, r: (rnd(A, i, 13) * 2 - 1) * 3 * e, s: 1 + .5 * e, a: 1 - E.inQ(p), fl: .6 * (1 - p) }; } });
    // уход: погружение — буквы уходят «в пол» со сплющиванием
    P.sink = per({ group: 'out', keep: true, each: .03, time: .35, L: (A, p) => { const e = E.inC(p); return { y: -.9 * H() * e, sy: 1 - .5 * e, sx: 1 + .15 * e, a: 1 - clamp((p - .5) / .5) }; } });
    // уход: вихрь — спиралью из центра наружу
    P.swirl = per({ group: 'out', keep: true, each: .02, from: 'center', time: .5, L: (A, p, i, n, g) => { const e = E.inC(p), [ax, ay] = anc(g), th = 2.5 * e, c = Math.cos(th), sn = Math.sin(th), f = 1 + 1.5 * e;
        return { x: (ax * c - ay * sn) * f - ax, y: (ax * sn + ay * c) * f - ay, r: th, s: 1 - .7 * e, a: 1 - e }; } });

    // ── ЕЩЁ 14 ──
    // появление: раскрытие — буквы разворачиваются из ребра (поворот 90° вокруг вертикали) от краёв к центру
    P.unfold = per({ group: 'in', each: .05, from: 'edges', time: .55, land: .7, L: (A, p, i, n, g) => { const e = E.back(p, 1.4), [ax] = anc(g); return { fy: (ax < 0 ? -1 : 1) * 1.57 * (1 - e), a: clamp(p / .2) }; } });
    // появление: из глубины — буквы летят издалека к зрителю
    P.zoom = per({ group: 'in', each: .04, time: .6, land: .75, L: (A, p) => { const e = E.outX(p); return { z: -900 * (1 - e), a: clamp(p / .25) }; } });
    // появление: резинка — растягивается вверх от строки и пружинит
    P.elastic = per({ group: 'in', each: .04, time: settle(.35, .35), land: .2, L: (A, p, i, n, g, tl) => { const k = spring(tl, .35, .35); return { sy: Math.max(.02, k), sx: 1 + .25 * (1 - Math.min(1, k)), y: -.5 * H() * (1 - k), a: clamp(tl / .05) }; } });
    // появление: кубики — буквы катятся слева, переворачиваясь через грань
    P.dice = per({ group: 'in', each: .06, time: .6, land: .9, L: (A, p) => { const e = E.outC(p); return { x: -1.4 * H() * (1 - e), fx: -3.14 * (1 - e), a: clamp(p / .15) }; } });
    // жизнь: качание — буквы поочерёдно поднимаются и опускаются
    P.bob = (A, t) => { const du = A.o.time ?? 3, en = env(t, du), h = H(); G.forEach((g, i) => put(i, { y: (i % 2 ? 1 : -1) * .05 * h * Math.sin(t * 3.5) * en })); return t < du; };
    // жизнь: крен — вся надпись медленно кренится в 3D, как на волнах
    P.sway = (A, t) => { const du = A.o.time ?? 3.5, en = env(t, du); pY += 9 * Math.sin(t * 1.8) * en; pP += 4 * Math.sin(t * 1.3 + 1) * en;
      G.forEach((g, i) => { const [ax] = anc(g); put(i, { r: -.03 * Math.sin(t * 1.8) * en, z: ax * .08 * Math.sin(t * 1.8) * en }); }); return t < du; };
    // акцент: шатание — вся надпись качается вокруг центра с затуханием
    P.wobble = (A, t) => { const r = .16 * Math.exp(-t / .22) * Math.sin(t * 22); if (t === 0) land(A, -1);
      G.forEach((g, i) => { const [ax, ay] = anc(g), c = Math.cos(r) - 1, sn = Math.sin(r); put(i, { x: ax * c - ay * sn, y: ax * sn + ay * c, r }); }); return t < .7; };
    // акцент: подскок — вся надпись подпрыгивает и приземляется со сплющиванием
    P.bounce = (A, t) => { const up = t < .32 ? Math.sin(Math.PI * t / .32) : 0, sq = t >= .32 ? (1 - spring(t - .32, .22, .45)) : 0; if (t >= .32 && !A.hit.has(-1)) land(A, -1);
      G.forEach((g, i) => { const [ax, ay] = anc(g), sx = 1 + .08 * sq, sy = 1 - .12 * sq; put(i, { x: ax * (sx - 1), y: .5 * H() * up + ay * (sy - 1), sx, sy }); }); return t < .32 + settle(.22, .45); };
    // акцент: выдох — волна выдвигает буквы к зрителю
    P.pulse3d = per({ group: 'accent', each: .04, time: .45, land: 0, L: (A, p) => { const w = Math.sin(Math.PI * p); return { z: 90 * w, fl: .18 * w }; } });
    // акцент: озноб — мелкая дрожь букв ступеньками по 30 мс
    P.shiver = (A, t) => { const k = tb(t, .03), e = Math.max(0, 1 - t / .6); if (t === 0) land(A, -1);
      G.forEach((g, i) => put(i, { x: (rnd(A, i, k) * 2 - 1) * 2.5 * e, y: (rnd(A, i, k + 40) * 2 - 1) * 1.5 * e, r: (rnd(A, i, k + 80) * 2 - 1) * .04 * e })); return t < .6; };
    // уход: сжатие — буквы схлопываются по ширине в полоску
    P.drain = per({ group: 'out', keep: true, each: .025, from: 'center', time: .3, L: (A, p) => { const e = E.inC(p); return { sx: Math.max(.01, 1 - e), sy: 1 + .15 * e, a: 1 - clamp((p - .6) / .4) }; } });
    // уход: на зрителя — буквы летят в камеру и гаснут
    P.fly = per({ group: 'out', keep: true, each: .03, from: 'random', time: .4, L: (A, p) => { const e = E.inQ(p); return { z: 240 * e, s: 1 + .2 * e, a: 1 - E.inC(p) }; } });
    // уход: кувырок вперёд — буквы переворачиваются вниз и уезжают
    P.tumble = per({ group: 'out', keep: true, each: .035, time: .4, L: (A, p) => { const e = E.inQ(p); return { fx: 2.4 * e, y: -.8 * H() * e, a: 1 - clamp((p - .55) / .45) }; } });
    GROUPS.in.push('unfold', 'zoom', 'elastic', 'dice'); GROUPS.idle.push('bob', 'sway'); GROUPS.accent.push('wobble', 'bounce', 'pulse3d', 'shiver'); GROUPS.out.push('drain', 'fly', 'tumble');

    /* ── СЦЕНЫ: готовые игровые моменты из пресетов (тексты — от вызывающего, переводы снаружи)
       t.scene('countdown', { steps: ['3', '2', '1', 'GO!'] }) · 'combo' { from: 2, to: 5, prefix: 'x' } · 'levelup' { text } · 'record' { text }
       · 'fight' { text } · 'win' { text }; onLand / onStep — для звука и вибрации */
    // пропуск сцены (t.skip): ждущие паузы сразу заканчиваются, анимации доигрывают мгновенно
    let skipN = 0, ff = 0, sceneN = 0;   // ff — сцена пропущена: её оставшиеся шаги идут мгновенно
    const wait = s => new Promise(r => { const n0 = skipN; if (calm || o.lite || ff) return r(); const id = setTimeout(r, s * 1000), chk = setInterval(() => { if (skipN !== n0){ clearTimeout(id); clearInterval(chk); r(); } }, 30); setTimeout(() => clearInterval(chk), s * 1000 + 50); });
    const ensure = async txt => { const need = [...new Set(txt.join(''))].filter(c => c.trim() && !CELLS[c]); if (need.length){ o.charset = [...new Set((o.charset || '') + need.join(''))].join(''); build(); await ready; } };
    const say = txt => { o.text = String(txt); retext(); };
    const SCENES = {
      // обратный отсчёт: каждая цифра — удар, держится, уходит; GO! — взрыв из центра, тряска, разлёт
      countdown: async (op, L) => { const st = op.steps || ['3', '2', '1', 'GO!']; await ensure(st);
        for (let i = 0; i < st.length; i++){ const last = i === st.length - 1; say(st[i]); op.onStep?.(i, st[i]);
          if (!last){ await play('stamp', { onLand: L }); await wait(.25); await play('fade'); }
          else { await play('boom', { onLand: L }); play('shake', { onLand: L }); await wait(.5); await play('blast'); } } },
      // комбо: число растёт, каждая ступень — барабан + толчок + покачивание
      combo: async (op, L) => { const a = op.from ?? 2, b = op.to ?? 5, pf = op.prefix ?? 'x', txt = []; for (let k = a; k <= b; k++) txt.push(pf + k); await ensure(txt);
        say(txt[0]); await play('pop', { onLand: L });
        for (let k = 1; k < txt.length; k++){ await wait(.35); await swap(txt[k], { style: 'roll', onLand: L }); op.onStep?.(k, txt[k]); play('punch', { onLand: L }); play('jiggle', { layer: 'idle' }); }
        await wait(.6); await play('fall'); },
      // повышение уровня: подъём, вспышка-искра, бегущие огни и радуга, растворение
      levelup: async (op, L) => { await ensure([op.text || 'LEVEL UP']); say(op.text || 'LEVEL UP');
        await play('rise', { onLand: L }); play('spark'); play('chase', { time: 2 }); play('rainflow', { layer: 'rain', time: 2 }); shine(); await wait(2); await play('fade'); },
      // рекорд: печать, сердцебиение, блик, уход вниз
      record: async (op, L) => { await ensure([op.text || 'NEW RECORD']); say(op.text || 'NEW RECORD');
        await play('stamp', { onLand: L }); shine(); await wait(.3); await play('heartbeat', { onLand: L }); play('glow', { time: 1.6 }); await wait(1.2); await play('sink'); },
      // бой: огромное слово влетает, удар, глитч, взрыв прочь
      fight: async (op, L) => { await ensure([op.text || 'FIGHT!']); say(op.text || 'FIGHT!');
        await play('slam', { onLand: L }); await play('glitch', { onLand: L }); await wait(.25); await play('blast'); },
      // выигрыш: удар, блик, волна с пульсом, толчок, осыпание
      win: async (op, L) => { await ensure([op.text || 'WIN!']); say(op.text || 'WIN!');
        await play('slam', { onLand: L }); shine(); play('wave', { time: 2 }); play('glow', { layer: 'glow', time: 2 }); await wait(1.1); await play('punch', { onLand: L }); await wait(.6); await play('fall'); },
    };
    const scene = (name, op = {}) => { if (!SCENES[name]) return Promise.resolve(); const id = ++sceneN; ff = 0;
      return SCENES[name](op, op.onLand).finally(() => { if (sceneN === id){ ff = 0; sceneN = 0; } }); };
    // пропустить: каждая идущая дорожка доигрывает до конца за один кадр (финальная поза — как после неё), паузы сцены кончаются
    function skip(){ skipN++; if (sceneN) ff = 1; for (const A of tracks.slice()) if (!A.ended){ cur = A; A.t = 1e3; A.f(A.t); cur = null; A.ended = true; if (!A.keep) tracks.splice(tracks.indexOf(A), 1); A.res(); }
      compose(0); draw(); }
    GROUPS.in.push('ignite', 'swing', 'boom', 'march');
    GROUPS.idle.push('chase', 'rainflow', 'flicker', 'orbit', 'pendulum');
    GROUPS.accent.push('glitch', 'ripple', 'heartbeat', 'stamp', 'spark');
    GROUPS.out.push('blast', 'sink', 'swirl');
    GROUPS.scene = Object.keys(SCENES);

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
        // пересборка букв — только если меняется то, что в картинке букв (размеры отделки, шрифт); цвета — без пересборки
        const before = shape(o), tx = 'text' in p && p.text !== o.text || 'arc' in p && p.arc !== o.arc;
        Object.assign(o, p);
        let re = shape(o) !== before;
        if (tx && !re && !covered(o.text) && !coming(o.text)) re = true;
        yaw = o.yaw + ((yaw - o.yaw) % 360 + 540) % 360 - 180;   // после вращения — к позе ближним путём
        useMode(); if ('quality' in p) fitCanvas();   // useMode сам переключит вариант шейдера (голограмма, узор)
        if (re) build(); else { if (tx && !PEND) retext(); colors(); if (tracks.length) compose(0); draw(); }
        cv.style.touchAction = o.drag && !o.lite ? 'none' : ''; cv.style.cursor = o.drag && !o.lite ? 'grab' : ''; wake(); },
      // повернуть программно (например, «встряхнуть» надпись при выигрыше); с пружиной сама вернётся
      rotate(dy, dp = 0, kick = false){ if (kick){ vy += dy; vp += dp; } else { yaw = dy; pitch = dp; } wake(); },
      shine, play, count, swap, scene, skip, groups: GROUPS,
      // прервать: анимация и блик кончаются сразу, буквы — на место (ждущий play/count завершается)
      stop(){ shT = -1; holdG = 0; tracks.slice().forEach(drop); still0(); draw(); },
      rainbow,
      get pose(){ return { yaw, pitch }; },
      get text(){ return o.text; },
      get ready(){ return ready; },   // Promise: надпись собрана (сборка идёт в фоне)
      get stats(){ return { frames, scale: cv.width / Math.max(1, cw * dpr) }; },   // для замера: копий в последнем кадре, сколько всего, кадров нарисовано
      destroy(){ dead = true; cancelAnimationFrame(raf); clearTimeout(rt); clearTimeout(shTimer); ro.disconnect(); gl.getExtension('WEBGL_lose_context')?.loseContext(); cv.remove(); },
    };
  }
  return { mount, defaults: DEF };
}
const Extrude = makeExtrude();
