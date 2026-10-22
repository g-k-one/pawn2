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
    onMove: null,                    // (yaw, pitch) — для звука/вибрации снаружи
  };
  const hex = c => { c = c.replace('#', ''); if (c.length === 3) c = c.replace(/./g, x => x + x); const n = parseInt(c, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const ramp = a => { const o = new Float32Array(12); a.slice(0, 4).forEach((c, i) => o.set(hex(c), i * 3)); return o; };

  const VS = `attribute vec3 aP;
uniform vec2 uSz, uRes; uniform float uDep, uN, uCam; uniform mat3 uR;
varying vec2 vUV; varying float vL;
void main(){ vUV = aP.xy; vL = aP.z;
  float t = aP.z / max(uN - 1., 1.);
  vec3 p = uR * vec3((aP.x - .5) * uSz.x, (.5 - aP.y) * uSz.y, (.5 - t) * uDep);
  float k = uCam / max(uCam - p.z, 1.);
  gl_Position = vec4(p.xy * k / (uRes * .5), 0., 1.); }`;
  const FS = `precision highp float;
uniform sampler2D uTex; uniform mat3 uR; uniform float uN, uFront, uGloss, uAmb, uFc, uSc;
uniform vec3 uF[4], uS[4], uL; uniform vec2 uFd;
varying vec2 vUV; varying float vL;
vec3 rampF(float x){ x = clamp(x, 0., 1.) * (uFc - 1.); vec3 c = uF[0];
  for (int i = 1; i < 4; i++){ float f = float(i); if (f < uFc) c = mix(c, uF[i], clamp(x - f + 1., 0., 1.)); } return c; }
vec3 rampS(float x){ x = clamp(x, 0., 1.) * (uSc - 1.); vec3 c = uS[0];
  for (int i = 1; i < 4; i++){ float f = float(i); if (f < uSc) c = mix(c, uS[i], clamp(x - f + 1., 0., 1.)); } return c; }
void main(){
  vec4 m = texture2D(uTex, vUV); float a = m.r; if (a < .004) discard;
  vec3 col;
  if (abs(vL - uFront) < .5){   // лицо (или задняя стенка, когда смотрим сзади)
    vec3 n = uR * vec3(0., 0., uFront < .5 ? 1. : -1.);
    col = rampF(dot(vUV - .5, uFd) + .5) * (.8 + .2 * max(dot(n, uL), 0.));
    float sh = .45 - n.x * 1.1 + n.y * .5;   // мягкий блик: полоса по диагонали, едет вслед за поворотом
    col += exp(-pow((vUV.x * .8 + vUV.y * .45 - sh) * 2.6, 2.)) * uGloss * .55;
  } else {                      // боковина: цвет по глубине + свет по нормали кромки
    vec2 e = m.gb * 2. - 1.; float el = length(e);
    vec3 n = uR * vec3(e / max(el, .001), 0.);
    float d = el > .06 ? max(dot(n, uL), 0.) : .35;
    float sp = el > .06 ? pow(max(dot(n, normalize(uL + vec3(0., 0., 1.))), 0.), 22.) : 0.;
    col = rampS(vL / max(uN - 1., 1.)) * (uAmb + (1. - uAmb) * d) + sp * uGloss * .5;
  }
  gl_FragColor = vec4(col * a, a); }`;

  function mount(el, opts){
    const o = Object.assign({}, DEF, opts);
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block' + (o.drag ? ';touch-action:none;cursor:grab' : '');
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(cv);
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true });
    let yaw = o.yaw, pitch = o.pitch, vy = 0, vp = 0, held = false, raf = 0, last = 0, dead = false;
    let N = 0, sz = [1, 1], cw = 1, ch = 1, dpr = 1, tex = null, bufF = null, bufB = null, prog = null, U = {};

    if (!gl){ el.textContent = o.text; return { set(){}, rotate(){}, destroy(){ cv.remove(); } }; }   // без WebGL — просто текст
    const sh = (t, s) => { const h = gl.createShader(t); gl.shaderSource(h, s); gl.compileShader(h); if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(h)); return h; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    ['uSz', 'uRes', 'uDep', 'uN', 'uCam', 'uR', 'uTex', 'uFront', 'uGloss', 'uAmb', 'uFc', 'uSc', 'uF', 'uS', 'uL', 'uFd'].forEach(k => U[k] = gl.getUniformLocation(prog, k));
    const aP = gl.getAttribLocation(prog, 'aP'); gl.enableVertexAttribArray(aP);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    bufF = gl.createBuffer(); bufB = gl.createBuffer(); tex = gl.createTexture();

    // стопка квадратов: два буфера — от задней к лицу и наоборот (когда смотрим сзади)
    function geom(){
      const q = i => [0, 0, i, 1, 0, i, 0, 1, i, 1, 0, i, 1, 1, i, 0, 1, i], f = [], b = [];
      for (let i = N; i--;) f.push(...q(i));
      for (let i = 0; i < N; i++) b.push(...q(i));
      gl.bindBuffer(gl.ARRAY_BUFFER, bufF); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(f), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b), gl.STATIC_DRAW);
    }
    function build(){
      dpr = Math.min(2, devicePixelRatio || 1); cw = Math.max(1, el.clientWidth); ch = Math.max(1, el.clientHeight);
      cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
      const room = o.depth * o.pad * 2 + 8;
      let fs = o.size;
      if (!fs){   // подгонка: надпись с запасом под боковины
        const x = document.createElement('canvas').getContext('2d'); x.font = o.font.replace('{s}', 100);
        const ls = String(o.text).split('\n'), tw = Math.max(1, ...ls.map(l => x.measureText(l).width));
        fs = Math.max(8, Math.min((cw - room) / tw * 100, (ch - room) / (1.05 * ls.length)));
      }
      const m = maskData(fs);
      sz = [m.W / dpr, m.H / dpr];
      N = o.layers || Math.max(8, Math.min(128, Math.round(o.depth * dpr * .9)));
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, m.img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      geom(); colors(); draw();
    }
    // маска + нормали в одну картинку RGBA (R — буква, G/B — нормаль, A — непрозрачно, чтобы браузер не трогал цвет)
    function maskData(fs){
      const lines = String(o.text).split('\n'), c = document.createElement('canvas'), x = c.getContext('2d'), font = o.font.replace('{s}', fs * dpr);
      x.font = font;
      const lh = fs * dpr * 1.05, tw = Math.max(1, ...lines.map(l => x.measureText(l).width)), r = Math.max(2, Math.round(dpr * 2.5)), pad = r * 2 + 2;
      const W = Math.min(2048, Math.ceil(tw + pad * 2)), H = Math.min(2048, Math.ceil(lh * lines.length + pad * 2));
      c.width = W; c.height = H; x.font = font; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      lines.forEach((l, i) => x.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lh));
      const img = x.getImageData(0, 0, W, H), d = img.data, n = W * H, A = new Float32Array(n), T = new Float32Array(n);
      for (let i = 0; i < n; i++) A[i] = d[i * 4 + 3] / 255;
      // размытие скользящим окном: строки, потом столбцы, дважды — почти гаусс
      const pass = (src, dst, horiz) => { const L = horiz ? W : H, M = horiz ? H : W, at = (j, k) => horiz ? j * W + k : k * W + j;
        for (let j = 0; j < M; j++){ let s = 0; for (let k = 0; k <= r && k < L; k++) s += src[at(j, k)];
          for (let k = 0; k < L; k++){ dst[at(j, k)] = s / (r * 2 + 1); if (k + r + 1 < L) s += src[at(j, k + r + 1)]; if (k - r >= 0) s -= src[at(j, k - r)]; } } };
      const Bl = A.slice(); for (let p = 0; p < 2; p++){ pass(Bl, T, true); pass(T, Bl, false); }
      for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++){
        const i = y * W + xx, g = (a, b) => Bl[Math.min(H - 1, Math.max(0, y + b)) * W + Math.min(W - 1, Math.max(0, xx + a))];
        const gx = g(1, 0) - g(-1, 0), gy = g(0, 1) - g(0, -1), l = Math.hypot(gx, gy);
        // наружу = против роста маски; в картинке y вниз, в мире — вверх
        const nx = l > 1e-4 ? -gx / l : 0, ny = l > 1e-4 ? gy / l : 0;
        d[i * 4] = A[i] * 255; d[i * 4 + 1] = (nx * .5 + .5) * 255; d[i * 4 + 2] = (ny * .5 + .5) * 255; d[i * 4 + 3] = 255;
      }
      return { W, H, img };
    }
    function colors(){
      const a = o.faceAngle * Math.PI / 180, L = o.light, ll = Math.hypot(...L) || 1;
      gl.uniform3fv(U.uF, ramp(o.face)); gl.uniform1f(U.uFc, Math.min(4, o.face.length));
      gl.uniform3fv(U.uS, ramp(o.side)); gl.uniform1f(U.uSc, Math.min(4, o.side.length));
      gl.uniform2f(U.uFd, Math.cos(a), Math.sin(a)); gl.uniform3f(U.uL, L[0] / ll, L[1] / ll, L[2] / ll);
      gl.uniform1f(U.uGloss, o.gloss); gl.uniform1f(U.uAmb, o.ambient);
    }
    function draw(){
      if (dead) return;
      const Y = yaw * Math.PI / 180, P = pitch * Math.PI / 180, cy = Math.cos(Y), sy = Math.sin(Y), cp = Math.cos(P), sp = Math.sin(P);
      // R = Rx(pitch) · Ry(yaw), по столбцам (как ждёт WebGL)
      const R = [cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy];
      const front = R[8] >= 0;   // z лица после поворота: к нам — лицо, от нас — задняя стенка
      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniformMatrix3fv(U.uR, false, R);
      gl.uniform2f(U.uSz, sz[0], sz[1]); gl.uniform2f(U.uRes, cw, ch); gl.uniform1f(U.uDep, o.depth); gl.uniform1f(U.uN, N);
      gl.uniform1f(U.uCam, o.persp); gl.uniform1f(U.uFront, front ? 0 : N - 1); gl.uniform1i(U.uTex, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, front ? bufF : bufB); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, N * 6);
    }

    // движение: инерция после броска, пружина в позу покоя, вращение — кадры идут, только пока что-то движется
    function tick(t){
      raf = 0; const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
      if (!held){
        if (o.spring){ vy += ((o.yaw - yaw) * 60 - vy * 9) * dt; vp += ((o.pitch - pitch) * 60 - vp * 9) * dt; }
        else { const f = Math.exp(-dt * 3); vy *= f; vp *= f; }
        yaw += (vy + o.spin) * dt; pitch = Math.max(-80, Math.min(80, pitch + vp * dt));
      }
      draw(); o.onMove?.(yaw, pitch);
      const still = Math.abs(vy) + Math.abs(vp) < .4 && (!o.spring || Math.abs(o.yaw - yaw) + Math.abs(o.pitch - pitch) < .05);
      if (held || o.spin || !still) raf = requestAnimationFrame(tick); else last = 0;
    }
    const wake = () => { if (!raf && !dead) raf = requestAnimationFrame(tick); };

    let px = 0, py = 0, pt = 0;
    const down = e => { if (!o.drag) return; held = true; px = e.clientX; py = e.clientY; pt = performance.now(); vy = vp = 0; cv.setPointerCapture?.(e.pointerId); cv.style.cursor = 'grabbing'; wake(); };
    const move = e => { if (!held) return; const now = performance.now(), dt = Math.max(1, now - pt) / 1000, dx = e.clientX - px, dy = e.clientY - py;
      yaw += dx * .5; pitch = Math.max(-80, Math.min(80, pitch - dy * .5));
      vy = vy * .5 + dx * .5 / dt * .5; vp = vp * .5 - dy * .5 / dt * .5; px = e.clientX; py = e.clientY; pt = now; };
    const up = () => { if (!held) return; held = false; cv.style.cursor = 'grab';
      if (o.spring) yaw = o.yaw + ((yaw - o.yaw) % 360 + 540) % 360 - 180;   // к позе — ближним путём, без лишних оборотов
      if (performance.now() - pt > 80) vy = vp = 0; wake(); };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    const ro = new ResizeObserver(() => build()); ro.observe(el);
    cv.addEventListener('webglcontextrestored', () => build());

    build(); document.fonts?.ready.then(() => !dead && build()); if (o.spin) wake();
    return {
      set(p){ const re = ['text', 'font', 'size', 'depth', 'layers', 'pad'].some(k => k in p && p[k] !== o[k]);
        Object.assign(o, p); if (re) build(); else { colors(); draw(); }
        if (o.drag) cv.style.touchAction = 'none'; wake(); },
      // повернуть программно (например, «встряхнуть» надпись при выигрыше); с пружиной сама вернётся
      rotate(dy, dp = 0, kick = false){ if (kick){ vy += dy; vp += dp; } else { yaw = dy; pitch = dp; } wake(); },
      get pose(){ return { yaw, pitch }; },
      destroy(){ dead = true; cancelAnimationFrame(raf); ro.disconnect(); gl.getExtension('WEBGL_lose_context')?.loseContext(); cv.remove(); },
    };
  }
  return { mount, defaults: DEF };
}
const Extrude = makeExtrude();
