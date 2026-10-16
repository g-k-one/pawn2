/* =========================================================
   ГЛАДИАТОРЫ — заставка старта арены на Spine: два гладиатора выходят, замах, мечи скрещиваются (искры, звон).
   Рантайм spine-canvas — с CDN, грузится заранее при входе на арену; части персонажа и скелет — assets/glad
   (glad.json — кости и анимации idle / clash / win, событие hit — момент удара; два атласа: красная и синяя команда, синий отражён).
   Исходники для редактора Spine — design/spine/gladiator. Нет сети, лайт-режим или «Быстрый крафт» — старая заставка с молотом.
   ========================================================= */
const SPINE_JS = 'https://cdn.jsdelivr.net/npm/@esotericsoftware/spine-canvas@4.3.13/dist/iife/spine-canvas.min.js';
let gladP = null, spineP = null;
// рантайм Spine — один на всё (гладиаторы, огонь арены): грузится один раз
const spineRT = () => spineP ||= new Promise((res, rej) => { if (window.spine) return res(); const sc = document.createElement('script'); sc.src = SPINE_JS; sc.onload = res; sc.onerror = () => { spineP = null; rej(new Error('spine runtime')); }; document.head.appendChild(sc); });
function gladLoad(){
  if (S.lite) return Promise.resolve(null);
  return gladP ||= spineRT()
    .then(async () => { const am = new spine.AssetManager('assets/glad/'); am.loadText('glad.json'); am.loadTextureAtlas('glad-red.atlas'); am.loadTextureAtlas('glad-blue.atlas'); await am.loadAll(); return am; })
    .catch(e => { gladP = null; console.warn('gladiators', e); return null; });
}
// true — заставка сыграна; false — не успела загрузиться (тогда играет старая)
async function gladClash(){
  const am = await Promise.race([gladLoad(), wait(600).then(() => null)]); if (!am) return false;
  const fx = $('fx'), cv = document.createElement('canvas'), W = fx.clientWidth, H = fx.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
  cv.className = 'glad-cv'; cv.width = W * dpr; cv.height = H * dpr; fx.appendChild(cv);
  const ctx = cv.getContext('2d'), R = new spine.SkeletonRenderer(ctx);
  const sc = Math.min(W * .8, H * .55) / 430, ground = H * .66, gap = 140 * sc;   // 430 — рост гладиатора в единицах скелета; gap — полдистанции, на ней мечи сходятся
  const mk = (atlas, side) => { const d = new spine.SkeletonJson(new spine.AtlasAttachmentLoader(am.require(atlas))).readSkeletonData(am.require('glad.json'));
    const sk = new spine.Skeleton(d); sk.scaleX = sc * side; sk.scaleY = -sc; const st = new spine.AnimationState(new spine.AnimationStateData(d));
    st.data.defaultMix = .12; st.setAnimation(0, 'idle', true); return { sk, st, side }; };
  const G = [mk('glad-red.atlas', 1), mk('glad-blue.atlas', -1)], sparks = [];
  let flash = 0;
  const hit = (power) => {
    Sfx.clang(); haptic('heavy'); FullGlow.punch(0, power); flash = 1;
    const x = W / 2, y = ground - 300 * sc;
    for (let i = 0; i < 22; i++){ const a = Math.random() * Math.PI * 2, v = (120 + Math.random() * 360) * (.6 + power * .5);
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: .35 + Math.random() * .35, t: 0 }); }
    fx.querySelector('.fx-in')?.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${6 * power}px,${-4 * power}px)` }, { transform: 'translate(0,0)' }], { duration: 160 });
  };
  G[0].st.addListener({ event: (e, ev) => { if (ev.data.name === 'hit') hit(G[0].n++ ? 1 : .7); } }); G[0].n = 0;
  // сценарий: выход с краёв (0–0.45 с), удар, второй удар сильнее, исчезновение
  const plan = [[.45, () => G.forEach(g => g.st.setAnimation(0, 'clash', false))], [1.25, () => G.forEach(g => g.st.setAnimation(0, 'clash', false))]];
  Sfx.whoosh(); haptic('medium');
  let last = performance.now(), t = 0;
  await new Promise(done => {
    const frame = now => {
      const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
      while (plan.length && t >= plan[0][0]) plan.shift()[1]();
      const k = Math.min(1, t / .45), ease = 1 - Math.pow(1 - k, 3);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      for (const g of G){ g.sk.x = W / 2 - g.side * (gap + (1 - ease) * W * .6); g.sk.y = ground;
        g.st.update(dt); g.st.apply(g.sk); g.sk.updateWorldTransform(spine.Physics.update); R.draw(g.sk); }
      // вспышка и искры в точке удара — поверх
      ctx.globalCompositeOperation = 'lighter';
      if (flash > 0){ const x = W / 2, y = ground - 300 * sc, r = 90 * sc * (1.6 - flash), gr = ctx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(255,240,200,${flash})`); gr.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); flash = Math.max(0, flash - dt * 4); }
      for (const p of sparks){ p.t += dt; p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; const a = 1 - p.t / p.life; if (a <= 0) continue;
        ctx.strokeStyle = `rgba(255,${180 + 60 * a | 0},90,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .03, p.y - p.vy * .03); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
      if (t < 2.05) requestAnimationFrame(frame); else done();
    };
    requestAnimationFrame(frame);
  });
  await cv.animate([{ opacity: 1 }, { opacity: 0, filter: 'blur(4px)' }], { duration: 260, fill: 'forwards' }).finished;
  cv.remove(); return true;
}
