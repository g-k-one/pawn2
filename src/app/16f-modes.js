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
function renderModes(){
  const m = MODES(), cur = modeNow();
  // во время раскрытия крафта/боя переключатель прячем — он только на экранах выбора
  modeBar.hidden = m.length < 2 || ($('fx').classList.contains('on') && !arenaOn && !betsOn); document.body.classList.toggle('has-modes', m.length > 1);
  // кнопки пересобираем, только если сменился набор режимов; белая подложка переезжает под активную
  const key = m.map(x => x[0]).join();
  if (modeBar.dataset.k !== key){ modeBar.dataset.k = key; modeBar.innerHTML = `<i class="mthumb"></i>` + m.map(([k, n]) => `<button data-m="${k}">${n}</button>`).join(''); }
  modeThumb(modeBusy ? modeTo : cur);   // во время перехода подложка уже стоит на новом режиме — не прыгает назад
}
let modeTo = 'craft';
function modeThumb(cur){
  const b = modeBar.querySelector(`[data-m="${cur}"]`), th = modeBar.querySelector('.mthumb'); if (!b || !th) return;
  modeBar.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === b));
  th.style.width = b.offsetWidth + 'px'; th.style.transform = `translateX(${b.offsetLeft - 3}px)`;
}
// смена экрана крафт ⇄ арена: старое уходит вглубь и гаснет, новое выплывает (crossfade с глубиной, как везде)
// уходит и выплывает весь контент экрана: ранги, шанс, множитель, центр режима, кнопка и плашка — переход без рывков
// гаснет и выплывает только то, что у режимов разное (центр, множитель); общее — кнопка, плашка, ранги — не исчезает, а перетекает
const MODE_C = { tab2: ['t2Arena', 't2Wheel'], tab3: ['t3Sky', 't3Board'], craft: ['drops', 'prize', 'slots'] };
const modeEls = (m, other) => [...(m === 'tab3' ? [] : ['range']), ...(MODE_C[m] || MODE_C.craft)].map($).filter(Boolean);   // ряд сверху не гаснет — подписи перетекают (tierMorph)
// прозрачность у надписи-приза своя (пульс «Сделай ставку») — её не трогаем, только масштаб; у остального — масштаб и прозрачность
const modeK = (el, a, b) => el.id === 'prize' ? [{ scale: a }, { scale: b }] : [{ opacity: a === 1 ? 1 : 0, scale: a }, { opacity: b === 1 ? 1 : 0, scale: b }];
// старое гаснет и остаётся невидимым, пока режим меняется (fill: forwards), — иначе на миг мелькало новое без анимации
let modeGone = [];
const modeOut = (m, n) => S.lite ? 0 : Promise.all((modeGone = modeEls(m, n).map(el => el.animate(modeK(el, 1, .9), { duration: 120, easing: 'cubic-bezier(.5,0,.8,.5)', fill: 'forwards' }))).map(a => a.finished));
const modeIn = (m, p) => { modeGone.forEach(a => a.cancel()); modeGone = []; if (S.lite) return; modeMorph(); modeEls(m, p).forEach((el, i) => el.animate(modeK(el, 1.06, 1), { duration: 260, delay: Math.min(i, 6) * 18, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' })); };
// переход: из любого режима — сначала закрываем текущий, потом открываем нужный; на главной наковальня уезжает в сторону
let modeBusy = false;
async function switchMode(next, dir = 1){
  const cur = modeNow(); if (next === cur || modeBusy) return;
  if ((next === 'tab2' || next === 'tab3') && S.demo){ haptic('rigid'); notify({ type: 'demo', img: 'assets/fantik.webp', title: next === 'tab2' ? $t("Арена — только на GRAM") : $t("Ставки — только на GRAM"), text: $t("Выключи демо в меню") }); return; }
  if (cur === 'tab2' && t2Me()){ haptic('rigid'); notify({ type: 'info', icon: 'fire', title: $t("Ты на арене"), text: $t("Дождись боя — после него можно в другой режим") }); return; }
  modeBusy = true; modeTo = next; haptic('medium'); Sfx.swipe(); modeThumb(next);
  try {
    // все три режима — один экран: старое уходит вглубь, класс режима меняется, новое выплывает
    if (cur === 'pvp') await leaveArena(); else if (cur === 'bets') await leaveBets();
    await modeOut(cur, next);
    if (cur === 'tab2'){ document.body.classList.remove('mode-tab2'); t2Leave(); }
    if (cur === 'tab3'){ document.body.classList.remove('mode-tab3'); t3Leave(); }
    if (next === 'tab2'){ document.body.classList.add('mode-tab2'); t2Enter(); }
    if (next === 'tab3'){ document.body.classList.add('mode-tab3'); t3Enter(); }
    modeIn(next, cur);
  } finally { modeBusy = false; renderModes(); }
}
modeBar.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b || S.busy && modeNow() === 'craft') return;
  const m = MODES().map(x => x[0]); switchMode(b.dataset.m, m.indexOf(b.dataset.m) > m.indexOf(modeNow()) ? 1 : -1); });
renderModes();
setInterval(renderModes, 800);   // режим мог смениться иначе (кнопка «Назад», конец боя) — подсветка догоняет

// общее перетекает: значок в кнопке сменяется с лёгким «впрыгиванием», плашка чуть пружинит (цвет плашки и шара переливается в CSS)
function modeMorph(){
  ['anvil', 'hammer'].map($).filter(Boolean).forEach(el => el.animate([{ opacity: 0, scale: .4 }, { opacity: 1, scale: 1.12, offset: .7 }, { opacity: 1, scale: 1 }], { duration: 300, easing: 'cubic-bezier(.3,1.3,.5,1)' }));
  $('bet').animate([{ scale: .94 }, { scale: 1.03, offset: .6 }, { scale: 1 }], { duration: 300, easing: 'cubic-bezier(.3,1.3,.5,1)' });
}
