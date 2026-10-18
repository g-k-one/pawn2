/* =========================================================
   РЕЖИМЫ — переключатель в самом низу экрана, в одном и том же месте на всех режимах (главная-крафт, PvP, Предикты):
   таблетки «Крафт · PvP · Предикты», активная подсвечена.
   Режимы-эксперименты появляются, только если включены в Дебаге; без них переключателя нет.
   ========================================================= */
// tab2 — копия главной (тот же экран, класс mode-tab2 на body): из неё будем собирать новый режим
// отдельного таба PvP больше нет — бой идёт прямо в tab2
// tab3 — «Ставки»: тоже копия главной (класс mode-tab3), ставка на ранг выпавшего тикета
const MODES = () => [['craft', $t("Крафт")], ['tab2', $t("Арена")], ['tab3', $t("Ставки")]];
const modeNow = () => arenaOn ? 'pvp' : betsOn ? 'bets' : document.body.classList.contains('mode-tab2') ? 'tab2' : document.body.classList.contains('mode-tab3') ? 'tab3' : 'craft';
const modeBar = (() => { const el = document.createElement('div'); el.className = 'abs modes'; el.id = 'modes'; $('fx').parentNode.appendChild(el); return el; })();
// затемнение низа — привязано к переключателю режимов и лежит поверх всего, кроме него: одинаковое во всех режимах
// (раньше тёмная полоса была частью панели и пропадала на Арене под колесом)
const modeFade = (() => { const el = document.createElement('div'); el.className = 'abs modes-fade'; modeBar.after(el); return el; })();
function renderModes(){
  const m = MODES(), cur = modeNow();
  // во время раскрытия крафта/боя переключатель прячем — он только на экранах выбора
  // прячем без выкидывания из раскладки (класс, а не hidden): иначе при возврате с экрана итога панель заново раскладывалась вместе с текстом — рывок
  modeBar.hidden = m.length < 2; modeBar.classList.toggle('off', $('fx').classList.contains('on') && !arenaOn && !betsOn); document.body.classList.toggle('has-modes', m.length > 1);
  // кнопки пересобираем, только если сменился набор режимов; белая подложка переезжает под активную
  const key = m.map(x => x[0]).join();
  if (modeBar.dataset.k !== key){ modeBar.dataset.k = key; modeBar.innerHTML = `<i class="mthumb"></i>` + m.map(([k, n]) => `<button data-m="${k}">${n}</button>`).join('');
    modeBar.querySelectorAll('[data-m]').forEach(x => modeRO?.observe(x)); }
  modeThumb(modeBusy ? modeTo : cur);   // во время перехода подложка уже стоит на новом режиме — не прыгает назад
}
let modeTo = 'craft';
// подложку меряем, только когда режим сменился: замер размеров кнопок заставляет браузер пересчитать раскладку всей страницы,
// а renderModes зовётся каждые 0.8 с — раньше это давало рывок, особенно сразу после экрана итога
let modeThumbAt = '';
// ширину меряем один раз на режим; если кнопка потом стала шире (догрузился шрифт) — подложка была уже текста. Следим за размером кнопок
const modeRO = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { modeThumbAt = ''; modeThumb(modeBusy ? modeTo : modeNow()); }) : null;
function modeThumb(cur){
  const b = modeBar.querySelector(`[data-m="${cur}"]`), th = modeBar.querySelector('.mthumb'); if (!b || !th) return;
  const key = cur + '|' + modeBar.dataset.k + '|' + LANG; if (modeThumbAt === key && th.style.width) return; modeThumbAt = key;
  modeBar.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === b));
  const w = b.offsetWidth; if (!w){ modeThumbAt = ''; return; }   // панель скрыта — размеров нет, померим, когда покажется
  th.style.width = w + 'px'; th.style.transform = `translateX(${b.offsetLeft - 3}px)`;
}
// смена экрана крафт ⇄ арена: старое уходит вглубь и гаснет, новое выплывает (crossfade с глубиной, как везде)
// уходит и выплывает весь контент экрана: ранги, шанс, множитель, центр режима, кнопка и плашка — переход без рывков
// гаснет и выплывает только то, что у режимов разное (центр, множитель); общее — кнопка, плашка, ранги — не исчезает, а перетекает
const MODE_C = { tab2: ['t2Arena', 't2Wheel', 't2Prev', 't2Next'], tab3: ['t3Sky', 't3Board', 't3Prev', 't3Next'], craft: ['drops', 'prize', 'slots'] };
const modeEls = (m, other) => [...(m === 'tab3' ? [] : ['range']), ...(MODE_C[m] || MODE_C.craft)].map($).filter(Boolean);   // ряд сверху не гаснет — подписи перетекают (tierMorph)
// прозрачность у надписи-приза своя (пульс «Сделай ставку») — её не трогаем, только масштаб; у остального — масштаб и прозрачность
const modeK = (el, a, b) => el.matches('.t2arr') ? [{}, { opacity: 0 }] : el.id === 'prize' ? [{ scale: a }, { scale: b }] : [{ opacity: a === 1 ? 1 : 0, scale: a }, { opacity: b === 1 ? 1 : 0, scale: b }];
// старое гаснет и остаётся невидимым, пока режим меняется (fill: forwards), — иначе на миг мелькало новое без анимации
let modeGone = [];
const modeOut = (m, n) => S.lite ? 0 : Promise.all((modeGone = modeEls(m, n).map(el => el.animate(modeK(el, 1, .9), { duration: 120, easing: 'cubic-bezier(.5,0,.8,.5)', fill: 'forwards' }))).map(a => a.finished));
const modeIn = (m, p) => { modeGone.forEach(a => a.cancel()); modeGone = []; if (S.lite) return; modeMorph(); modeEls(m, p).filter(el => !el.matches('.t2arr')).forEach((el, i) => el.animate(modeK(el, 1.06, 1), { duration: 260, delay: Math.min(i, 6) * 18, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' })); };
// переход: из любого режима — сначала закрываем текущий, потом открываем нужный; на главной наковальня уезжает в сторону
// переходы браузера (View Transitions) пробовали — на iPhone ломался порядок слоёв и нижний бар с затемнением прыгали отдельно. Выключено
const VT_ON = false;
let modeBusy = false;
async function switchMode(next, dir = 1){
  const cur = modeNow(); if (next === cur || modeBusy) return;
  if ((next === 'tab2' || next === 'tab3') && S.demo){ haptic('rigid'); notify({ type: 'demo', img: 'assets/fantik.webp', title: next === 'tab2' ? $t("Арена — только на GRAM") : $t("Ставки — только на GRAM"), text: $t("Выключи демо в меню") }); return; }
  if (cur === 'tab2' && t2Me()){ haptic('rigid'); notify({ type: 'info', icon: 'fire', title: $t("Ты на арене"), text: $t("Дождись боя — после него можно в другой режим") }); return; }
  modeBusy = true; modeTo = next; track('mode', { to: next === 'tab2' ? 'arena' : next === 'tab3' ? 'bets' : next }); haptic('medium'); Sfx.swipe(); const betW = $('bet').offsetWidth;
  try {
    // все три режима — один экран: старое уходит вглубь, класс режима меняется, новое выплывает
    if (cur === 'pvp') await leaveArena(); else if (cur === 'bets') await leaveBets();
    const swap = () => {
      if (cur === 'tab2'){ document.body.classList.remove('mode-tab2'); t2Leave(); }
      if (cur === 'tab3'){ document.body.classList.remove('mode-tab3'); t3Leave(); }
      if (next === 'tab2'){ document.body.classList.add('mode-tab2'); t2Enter(); }
      if (next === 'tab3'){ document.body.classList.add('mode-tab3'); t3Enter(); }
    };
    // View Transitions (iOS 18+): браузер снимает старый и новый экран, общие элементы (плашка, кнопка, ранги, стрелки) перетекают сами,
    // центр режима меняется с глубиной — анимирует видеокарта по готовым снимкам. Иначе — прежний ручной переход
    if (VT_ON && document.startViewTransition && !S.lite){   // выключено: на iPhone ломался порядок слоёв и низ «прыгал» — ручной переход ниже
      // подложка переключателя тоже перетекает снимком (своя CSS-анимация на время перехода выключена — класс vt)
      const root = document.documentElement; root.classList.add('vt');
      const vt = document.startViewTransition(() => { swap(); modeThumb(next); arrPlace(next, $('bet').offsetWidth, true); });
      await vt.updateCallbackDone; modeMorph();
      await vt.finished.catch(() => {}); root.classList.remove('vt'); modeOnb(next);   // шторка правил — после перехода (снимки рисуются поверх всего)
    } else {
      modeThumb(next); await modeOut(cur, next); swap();
      modeIn(next, cur); betMorph(betW); modeOnb(next);
    }
  } finally { modeBusy = false; renderModes(); }
}
modeBar.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b || S.busy && modeNow() === 'craft') return;
  const m = MODES().map(x => x[0]); switchMode(b.dataset.m, m.indexOf(b.dataset.m) > m.indexOf(modeNow()) ? 1 : -1); });
renderModes();
setInterval(renderModes, 800);   // режим мог смениться иначе (кнопка «Назад», конец боя) — подсветка догоняет

// общее перетекает: значок в кнопке сменяется с лёгким «впрыгиванием», плашка чуть пружинит (цвет плашки и шара переливается в CSS)
function modeMorph(){
  ['anvil', 'hammer'].map($).filter(Boolean).forEach(el => el.animate([{ opacity: 0, scale: .4 }, { opacity: 1, scale: 1.12, offset: .7 }, { opacity: 1, scale: 1 }], { duration: 300, easing: 'cubic-bezier(.3,1.3,.5,1)' }));
}
// плашка ставки не прыгает масштабом и не мигает — плавно меняет ширину и цвет под новый режим, содержимое меняется сразу
// стрелки режима (комнаты Арены, колоды Ставок) — у краёв плашки, на одном расстоянии; при смене режима едут вместе с её шириной
const modeArr = m => (m === 'tab2' ? ['t2Prev', 't2Next'] : m === 'tab3' ? ['t3Prev', 't3Next'] : []).map($).filter(Boolean);
function arrPlace(m = modeNow(), w = $('bet').offsetWidth, snap){ const [a, b] = modeArr(m); if (!a) return; const h = w / 2;
  [a, b].forEach(el => { if (snap) el.style.transition = 'none'; });
  a.style.left = `calc(50% - ${h + 62}px)`; b.style.left = `calc(50% + ${h + 18}px)`;
  if (snap){ a.offsetWidth; a.style.transition = b.style.transition = ''; } }
// стрелки нового режима: сразу на своём месте и уже с нужной яркостью (крайняя — тусклая), проявляются, когда плашка доехала
function arrShow(m, w){ arrPlace(m, w, true); modeArr(m).forEach(el => el.animate([{ opacity: 0 }, {}], { duration: 220, delay: 240, easing: 'ease-out', fill: 'backwards' })); }
// онбординг режима: при первом входе в Арену или Ставки сами открываются правила («как играть»), дальше — только по кнопке «i»
// (то же нажатие, что у «i»: на Арене правила показывают хеш зерна комнаты — ждём, пока комната загрузится)
function modeOnb(m){ if ((m !== 'tab2' && m !== 'tab3') || S.dbg.noOnb) return; const k = 'bm-onb-' + m;
  try { if (localStorage.getItem(k)) return; } catch(_){ return; }
  let n = 0; const go = () => { if (modeNow() !== m || S.busy) return;
    if (m === 'tab2' && typeof t2Room !== 'undefined' && !t2Room){ if (++n < 30) setTimeout(go, 150); return; }
    try { localStorage.setItem(k, '1'); } catch(_){}
    $('giftBtn').click(); };
  setTimeout(go, 480); }
let betMorphing = false;   // плашка меняет ширину — стрелки ведёт betMorph, остальные не переставляют (иначе брали бы промежуточную ширину)
function betMorph(w0){ const b = $('bet'), w1 = b.offsetWidth, m = modeNow(); if (S.lite || !w0){ arrPlace(m, w1, true); return; }
  arrShow(m, w1);
  if (Math.abs(w1 - w0) > 1){ betMorphing = true; b.animate([{ width: w0 + 'px', overflow: 'hidden' }, { width: w1 + 'px', overflow: 'hidden' }], { duration: 260, easing: 'cubic-bezier(.33,0,.2,1)' }).finished.finally(() => { betMorphing = false; }); }   // ровно, без «доезда»
}
