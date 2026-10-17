/* =========================================================
   ТИРЫ
   ========================================================= */
const tiersEl = $('tiers');
tiersEl.innerHTML = TIERS.map((t, i) => `<button class="tier" data-i="${i}" style="--c:${t.c}">${t.name}</button>`).join('') + '<i class="tind" id="tind"></i>';
// плашка шанса — по центру над активным тиром; пересчитывается и при смене размера окна (иначе остаётся там, где была)
function placeChance(){
  const lab = tiersEl.children[S.tier], pr = $('scene').getBoundingClientRect(), lr = lab.getBoundingClientRect(), k = K;
  const cw = $('chance').offsetWidth / 2 + 4;                       // не прижимать к краю экрана
  $('chance').style.left = Math.max(cw, Math.min(SW - cw, (lr.left + lr.width / 2 - pr.left) / k)) + 'px';
}
function placeInd(){ const lab = tiersEl.children[S.tier]; $('tind').style.width = lab.offsetWidth * .7 + 'px'; $('tind').style.transform = `translateX(${lab.offsetLeft + lab.offsetWidth * .15}px)`; }
/* смена ранга: dir = 1 — следующий (контент уезжает влево), −1 — предыдущий. from — где был контент при свайпе */
function setTier(i, opts = {}){
  S.tier = i;
  const t = TIERS[i], root = document.documentElement.style, dir = opts.dir || 0;
  root.setProperty('--tier', t.c); root.setProperty('--tierA', t.a); root.setProperty('--tierB', t.b);
  tiersEl.querySelectorAll('.tier').forEach((el, k) => el.classList.toggle('on', k === i));
  placeInd();
  $('chanceVal').textContent = t.chance + '%';
  const rg = $('range'), txt = `x${t.min} — x${t.max}`;
  rg.innerHTML = `<span class="xf">${txt}</span>`;                // мгновенно, как в экономном режиме — ничего не прыгает
  ['range', 'prize', 'drops'].forEach(id => { const el = $(id); if (el.style.opacity || el.style.scale){ const o = el.style.opacity || 1, sc = el.style.scale || 1; el.style.opacity = ''; el.style.scale = '';
    el.animate([{ opacity: o, scale: sc }, {}], { duration: 420, easing: 'cubic-bezier(.25,.8,.25,1)' }); } });
  rg.dataset.ready = 1;
  placeChance();
  Glow.set(t.glow);
  if (!opts.keepPrize) showPrize(dir);
}
/* смена текста наложением: старый тает, новый проявляется на том же месте — без прыжков */
function xfade(el, text, dir = 1){
  const cur = el.querySelector('.xf:not(.out)');
  if (cur && cur.textContent === text) return;
  if (!cur || S.lite){ el.innerHTML = `<span class="xf">${text}</span>`; return; }
  el.querySelectorAll('.xf.out').forEach(x => x.remove());
  const n = document.createElement('span'); n.className = 'xf in'; n.textContent = text; el.appendChild(n);
  cur.classList.add('out');
  const d = dir < 0 ? -1 : 1;
  cur.animate([{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: `0 ${-26 * d}px` }], { duration: 220, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' }).onfinish = () => cur.remove();
  n.animate([{ opacity: 0, translate: `0 ${26 * d}px` }, { opacity: 0, translate: `0 ${26 * d}px`, offset: .3 }, { opacity: 1, translate: '0 0' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.25,1)' }).onfinish = () => n.classList.remove('in');
}
let noClick = false;
tiersEl.addEventListener('click', e => {
  const b = e.target.closest('.tier'); if (!b || S.busy || noClick) return;
  const ni = +b.dataset.i; if (ni === S.tier) return;
  selHaptic(); setTier(ni, { dir: Math.sign(ni - S.tier) }); restartAuto();
});
const selHaptic = () => { if (S.vibro === false) return; try { Telegram.WebApp.HapticFeedback.selectionChanged(); } catch(_){ haptic(); } };
/* свайп влево/вправо по экрану — соседний ранг. Контент тянется за пальцем с параллаксом, на краях — сопротивление */
(() => {
  const movers = [['range', .55], ['prize', .28], ['drops', .42]];
  let x0 = null, y0 = 0, dx = 0, act = false, t0 = 0, pid = 0, lx = 0, lt = 0, vx = 0;
  $('scene').addEventListener('pointerdown', e => {
    // в Арене свайпа рангов нет вовсе (палец крутит колесо); колода ставок листается сама — её жест не переключает ранг
    if (S.busy || openDrawer || document.body.classList.contains('mode-tab2') || e.target.closest('button:not(.tier), .slot, .live, .bar, .bet, .t3b')) return;
    x0 = e.clientX; y0 = e.clientY; dx = 0; act = false; pid = e.pointerId; t0 = lt = performance.now(); lx = e.clientX; vx = 0;
  });
  addEventListener('pointermove', e => {
    if (x0 === null || e.pointerId !== pid) return;
    const mx = (e.clientX - x0) / K, my = (e.clientY - y0) / K, now = performance.now();
    if (!act){
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.2){ act = true; x0 = e.clientX; clearInterval(auto); movers.forEach(([id]) => $(id).getAnimations().forEach(a => a.cancel())); }
      else if (Math.abs(my) > 16) x0 = null;
      return;
    }
    vx = vx * .6 + ((e.clientX - lx) / K / Math.max(1, now - lt)) * .4; lx = e.clientX; lt = now;
    dx = (e.clientX - x0) / K;
    const edge = (dx > 0 && S.tier === 0) || (dx < 0 && S.tier === TIERS.length - 1);
    const k = Math.min(1, Math.abs(dx) / 140) * (edge ? .3 : 1);
    movers.forEach(([id, f]) => { const el = $(id); el.style.opacity = (1 - .45 * k * f * 1.6).toFixed(3); el.style.scale = (1 - .08 * k * f * 1.6).toFixed(4); });
    // линия под рангами за пальцем не едет — только после переключения
    const nb = tiersEl.children[S.tier + (dx < 0 ? 1 : -1)], cur = tiersEl.children[S.tier];
    if (false && nb && !edge){ const x = cur.offsetLeft + cur.offsetWidth * .15 + (nb.offsetLeft - cur.offsetLeft) * k * .45; $('tind').style.transition = 'none'; $('tind').style.transform = `translateX(${x}px)`; }
  });
  const end = e => {
    if (x0 === null || (e && e.pointerId !== pid)) return;
    const was = act; x0 = null; act = false; if (!was) return;
    $('tind').style.transition = '';
    noClick = true; setTimeout(() => noClick = false, 60);
    const dir = dx < 0 ? 1 : -1, ni = S.tier + dir;
    if ((Math.abs(dx) > 44 || Math.abs(vx) > .45) && Math.sign(-vx || -dx) === dir && ni >= 0 && ni < TIERS.length){
      selHaptic(); Sfx.swipe(); setTier(ni, { dir, from: dx });
    } else {
      if (ni < 0 || ni >= TIERS.length) haptic('rigid');
      placeInd(); movers.forEach(([id]) => { const el = $(id), o = el.style.opacity || 1, sc = el.style.scale || 1; el.style.opacity = ''; el.style.scale = ''; el.animate([{ opacity: o, scale: sc }, {}], { duration: 380, easing: 'cubic-bezier(.2,.7,.3,1)' }); });
    }
    restartAuto();
  };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
})();
let auto = 0;
function restartAuto(){ clearInterval(auto); auto = setInterval(() => { if (!S.busy && !openDrawer && !S.onb && !document.hidden) setTier((S.tier + 1) % TIERS.length, { dir: 1 }); }, AUTO_MS); }

/* ---------- что может выпасть ----------
   ставка 0 → подсказка «Сделай ставку» (мельче выигрыша, над гемом) и пустой светящийся гем;
   ожидаемый выигрыш (ставка × средний множитель тира) < 3.6 GRAM → GRAM: гем и сумма;
   ≥ 3.6 GRAM → NFT: одна, самая дорогая из доступных.
   Сцена перестраивается (с отскоком) только когда меняется её состав; сумма GRAM просто плавно доезжает до нового значения */
const LAYOUTS = {
  empty: [{ x: 55, y: 386, s: 280, r: [-3, 3], sw: 5 }],
  ton:   [{ x: 39, y: 405, s: 312, r: [-5, 4], sw: 4 }],
  1: [{ x: 55, y: 378, s: 280, r: [-4, 4], sw: 4.4 }],
  2: [{ x: 8, y: 438, s: 200, r: [-6, 3], sw: 3.8 }, { x: 150, y: 373, s: 245, r: [3, -4], sw: 4.6 }],
  3: [{ x: 4, y: 468, s: 160, r: [-7, 2], sw: 3.6 }, { x: 92, y: 398, s: 200, r: [3, -3], sw: 4.4 }, { x: 186, y: 368, s: 200, r: [-2, 5], sw: 5 }],
};
let sceneKey = '', shownValue = 0, valRaf = 0, prevTok = 0, prevReady = '';
function showPrize(dir = 0){
  const t = TIERS[S.tier], stake = total(), ev = stake * (t.min + t.max) / 2, p = $('prize');
  let mode, items;
  if (stake <= 0){ mode = 'empty'; items = [{ img: 'assets/empty-gem.webp' }]; }
  else if (ev < NFT_FROM){ mode = 'ton'; items = [{ img: 'assets/hero-gem.webp' }]; }
  else { mode = 'nft'; items = NFTS.filter(n => n.price <= ev).slice(-1).map(n => ({ ...n, img: n.src })); }      // приз — всегда одна NFT: самая дорогая из доступных
  let key = mode + ':' + items.map(i => i.img).join();
  // подбор NFT под ожидаемый выигрыш может ответить не сразу — пока ждём, на месте приза пульсирует подарок
  if (mode === 'nft' && S.dbg.prevDelay && key !== prevReady && key !== sceneKey){
    const tok = ++prevTok, want = key; items = [{ skel: true }]; key = 'skel';
    setTimeout(() => { if (tok !== prevTok) return; prevReady = want; showPrize(); }, S.dbg.prevDelay);
  } else prevTok++;

  p.className = 'abs prize ' + mode;
  p.innerHTML = `<span class="xf">${mode === 'ton' ? fmt(ev) : mode === 'empty' ? $t("Сделай ставку") : 'NFT'}</span>`;   // мгновенно, без прыжков
  if (key === sceneKey){
    // состав тот же — лёгкий «толчок» в сторону свайпа, чтобы смена ранга чувствовалась
    return;
  }
  sceneKey = key;
  const box = $('drops');
  const z0 = dir > 0 ? .94 : 1.05, z1 = dir > 0 ? 1.04 : .96;      // вперёд по рангам — «приближаемся», назад — «отдаляемся»
  const instant = !!box.querySelector('.drop');                 // первый показ — с появлением, дальше смена мгновенная
  box.querySelectorAll('.drop').forEach(d => { Tilt.drop(d); d.remove(); });
  const lay = mode === 'nft' ? LAYOUTS[items.length] : LAYOUTS[mode];
  items.forEach((it, i) => {
    const L = lay[i], d = document.createElement('div');
    d.className = instant ? 'drop still' : 'drop';
    d.style.cssText = `--z0:${z0};left:${L.x}px;top:${L.y}px;width:${L.s}px;height:${L.s}px;--dl:${(dir ? .06 : .12 + i * .09).toFixed(2)}s;--sw:${L.sw}s;--sd:${(-i * 1.3).toFixed(1)}s;--r0:${L.r[0]}deg;--r1:${L.r[1]}deg`;
    d.innerHTML = it.skel ? `<div class="sway"><div class="tw dskel"><img src="assets/empty-gem.webp" alt=""></div></div>` : `<div class="sway"><div class="tw"><img src="${it.img}" alt="${it.name || ''}"><span class="gl" style="--m:url('${it.img}')"><i></i></span></div></div>` +
      (it.price ? `<span class="tag"><i class="gm"></i>${it.price}</span>` : '');
    box.appendChild(d);
    if (!it.skel){ Tilt.add(d.querySelector('.tw'), d.querySelector('.tw img'), d.querySelector('.gl i'), .7); if (it.model) upgradeImg(d.querySelector('.tw img'), it, d.querySelector('.gl')); }
  });
}
function countValue(to){
  const p = $('prize'), from = shownValue, t0 = performance.now();
  cancelAnimationFrame(valRaf);
  (function f(now){
    const k = Math.min(1, (now - t0) / 450), v = from + (to - from) * (1 - Math.pow(1 - k, 3));
    shownValue = v; p.textContent = fmt(v);
    if (k < 1) valRaf = requestAnimationFrame(f);
  })(t0);
}
const giftSum = () => S.gifts.reduce((a, g) => a + g.value, 0);
const total = () => S.ton + giftSum();

