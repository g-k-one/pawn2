/* =========================================================
   ЗАМЕР СКОРОСТИ (только QA): Дебаг → «Замер».
   Плашка поверх экрана — кадров в секунду (среднее за 1 с), самый медленный кадр и доля рывков (кадр дольше 50 мс).
   Выключатели — по одному убираем подозреваемых и смотрим, вырастет ли FPS: рамка, вращение призов, анимации, дым и туман, лента «лайв».
   Пока плашка включена, сам замер будит страницу каждый кадр — это нормально, на итог почти не влияет
   ========================================================= */
const PF_KEYS = [['glow', () => $t("Рамка")], ['tilt', () => $t("Вращение призов")], ['anim', () => $t("Анимации")], ['smoke', () => $t("Дым и туман")], ['live', () => $t("Лента «лайв»")]];
const pfSave = () => { try { localStorage.setItem('bm-perf', JSON.stringify(S.pfOff)); } catch(_){} };
function pfApply(){
  const o = S.pfOff, bd = document.body;
  bd.classList.toggle('pf-noglow', !!o.glow); bd.classList.toggle('pf-noanim', !!o.anim); bd.classList.toggle('pf-nosmoke', !!o.smoke);
  // анимации из кода (дым, туман, клубы) CSS не остановит — ставим на паузу сами, пока выключатель стоит
  if (o.anim) document.getAnimations().forEach(a => { if (!(a instanceof CSSAnimation) && !(a instanceof CSSTransition) && a.playState === 'running' && a.effect?.getTiming().iterations === Infinity) a.pause(); });
  pfHud(!!o.hud);
}
setInterval(() => { if (S.pfOff.anim) pfApply(); }, 1000);
let pfLoop = 0;
function pfHud(on){
  let el = $('pfHud');
  if (!on){ if (el) el.remove(); cancelAnimationFrame(pfLoop); pfLoop = 0; return; }
  if (!el){ el = document.createElement('div'); el.id = 'pfHud'; el.className = 'pf-hud'; document.body.appendChild(el); }
  if (pfLoop) return;
  let n = 0, worst = 0, slow = 0, prev = 0, t0 = performance.now();
  const f = now => { if (prev){ const d = now - prev; n++; worst = Math.max(worst, d); if (d > 50) slow++; } prev = now;
    if (now - t0 >= 1000){ const fps = Math.round(n * 1000 / (now - t0)), off = PF_KEYS.filter(([k]) => S.pfOff[k]).map(([, l]) => l()).join(', ');
      el.innerHTML = `<b style="color:${fps >= 50 ? '#12D53D' : fps >= 30 ? '#FFB835' : '#FF4C35'}">${fps} FPS</b><span>${$t("худший кадр {0} мс · рывков {1}%", Math.round(worst), n ? Math.round(slow / n * 100) : 0)}</span>${off ? `<small>${$t("выкл:")} ${off}</small>` : ''}`;
      n = 0; worst = 0; slow = 0; t0 = now; }
    pfLoop = requestAnimationFrame(f); };
  pfLoop = requestAnimationFrame(f);
}
// вкладка дебага «Замер»: плашка FPS и выключатели
const pfDbg = () => `<div class="dbg-l">${$t("Плашка FPS поверх экрана")}</div><div class="dbg-g"><button class="dbg-c${S.pfOff.hud ? '' : ' on'}" data-pf="hud" data-v="0">${$t("Выключена")}</button><button class="dbg-c${S.pfOff.hud ? ' on' : ''}" data-pf="hud" data-v="1" style="--c:#12D53D">${$t("Включена")}</button></div>` +
  `<div class="dbg-l">${$t("Выключить для замера")}</div><div class="dbg-g">${PF_KEYS.map(([k, l]) => `<button class="dbg-c${S.pfOff[k] ? ' on' : ''}" data-pf="${k}" data-v="${S.pfOff[k] ? 0 : 1}" style="--c:#FF4C35">${l()}</button>`).join('')}</div>` +
  `<p class="dbg-n">${$t("Как мерить: включи плашку, закрой дебаг и подержи экран 10 секунд без касаний, запомни FPS. Потом выключай по одному пункту и смотри, на каком FPS заметно вырастет — это и тормозит. Настройки сохраняются до сброса.")}</p>`;
$('dbgBody').addEventListener('click', e => { const c = e.target.closest('[data-pf]'); if (!c) return; e.stopImmediatePropagation();
  const k = c.dataset.pf; S.pfOff[k] = c.dataset.v === '1'; if (!S.pfOff[k]) delete S.pfOff[k];
  if (k === 'anim' && !S.pfOff.anim) document.getAnimations().forEach(a => { if (a.playState === 'paused' && !(a instanceof CSSAnimation)) a.play(); });
  pfSave(); pfApply(); haptic(); renderDbg(); }, true);
pfApply();
// прогрев: первое уведомление стоило ~70 мс (браузер впервые разбирал начертание шрифта и раскладывал карточку) — и случалось
// ровно на возврате с экрана итога. Загружаем все начертания и один раз невидимо раскладываем уведомление, пока приложение простаивает
(window.requestIdleCallback || (f => setTimeout(f, 1500)))(() => {
  ['400', '700', '800'].forEach(w => document.fonts?.load(`${w} 16px SONGER`, 'Aa Яя 0123456789'));
  const host = document.querySelector('.notes'); if (!host) return;
  const el = document.createElement('div'); el.className = 'note'; el.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  el.innerHTML = '<span class="note-i img"><img src="assets/hero-gem-128.webp" alt=""></span><span class="note-t"><b>+0 GRAM</b><small>Выигрыш · win 0123456789</small></span><i class="note-bar"></i>';
  host.appendChild(el); el.offsetWidth; requestAnimationFrame(() => el.remove());
}, { timeout: 3000 });
// тихая предзагрузка: сразу после лоадера докачиваем в кэш картинки Арены, Ставок, меню, бонусов и кейсов и атласы частиц первого удара —
// первый вход в режим и первый крафт без подгрузки. Ничего не запускается и не рисуется (~0.5 МБ, один раз — дальше кэш)
setTimeout(() => (window.requestIdleCallback || (f => f()))(() => {
  if (navigator.connection?.saveData) return;
  ['arena-shield.svg', 'sword.svg', 'helm.svg', 'arena-puff.webp', 'ball.svg', 'wand.svg', 'empty-gem.webp',
   // меню, бонусы и кейсы — открываются без подгрузки
   'chest-durov.webp', 'chest-satoshi.webp', 'chest-beast.webp', 'chest-musk.webp', 'who-durov.webp', 'who-satoshi.webp', 'who-beast.webp', 'who-musk.webp',
   'referrals.webp', 'superdrop-logo.webp', 'top.webp', 'xp.webp', 'gem-white.svg',
   'fx/fx-strips.webp', 'fx/fx-fire.webp', 'fx/fx-aura.webp', 'fx/fx-coins.webp', 'fx/fx-confetti.webp'].forEach(f => { const im = new Image(); im.decoding = 'async'; im.src = 'assets/' + f; im.decode?.().catch(() => {}); });   // decode — картинка сразу готова к показу, без мигания
}, { timeout: 2000 }), 1200);   // сразу после лоадера, как только приложение показалось
