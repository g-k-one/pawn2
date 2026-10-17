/* =========================================================
   СТАВКИ (tab3) — копия главной, как Арена: класс mode-tab3 на body, тот же экран.
   Ранги сверху — как на главной (свайп/тап), над ними шанс, крупно — множитель выбранной ячейки.
   На месте приза — табло 3×2, как ячейки игроков на Арене: табло исходов — таблетки «Ранг · Тикет · Цифра» сверху, ниже крупные карточки выбранной группы.
   Тап по ячейке — сразу ставка фишкой; «+0.1 … +5» — номинал фишки; долгое нажатие — снять ставку;
   корзина — сначала ставку с выбранной ячейки, потом всё. Одна ставка или несколько (до 12).
   Плашка — сколько всего спишется и до скольки даст. Ядро, лимиты, мок и доказательство — 16b-bets.js
   ========================================================= */
const isT3 = () => document.body.classList.contains('mode-tab3');
let t3Main = null, t3Gifts = null, t3Sel = 5, t3Last = null, t3Tier = 1;   // ранг и подарки крафта; выбранная ячейка; цифра; свой ранг
const T3_VIOLET = '#b9a6ff';
// иконки карт — плоские сплошные силуэты, как молот, меч и шлем (viewBox 48×48, цвет — цвет карты)
const T3_ICO = {
  rank: '<path d="M15 8h18l9 11-18 23L6 19z"/>',
  sun: '<circle cx="24" cy="24" r="9"/>' + Array.from({ length: 8 }, (_, i) => { const a = i * 45 * Math.PI / 180, p = (r, d) => `${(24 + Math.cos(a + d) * r).toFixed(1)} ${(24 + Math.sin(a + d) * r).toFixed(1)}`;
    return `<path d="M${p(13, -.18)}L${p(21, 0)}L${p(13, .18)}z"/>`; }).join(''),
  moon: '<path d="M30 6a18 18 0 1 0 12 30A15 15 0 1 1 30 6z"/>',
  has7: '<g transform="translate(10.50 9.00) scale(1.000)"><path d="M23.6769 0L22.2231 0.642858C18.6923 2.35714 14.7462 2.78571 11.0077 1.71429C9.76154 1.28571 8.30769 0 6.85385 0H0V15H4.56923C4.56923 12.6429 6.64615 10.0714 9.13846 10.0714H14.5385L11.4231 13.9286C7.68462 18.6429 4.77692 24.2143 3.32308 30H17.8615C17.8615 23.3571 19.5231 16.9286 22.8462 11.3571L27 4.5L23.6769 0Z"/></g>',   // assets/seven.svg
  diff: '<path d="M24 5l5.6 12.2 13.4 1.5-10 9 2.8 13.2L24 34.2l-11.8 6.7 2.8-13.2-10-9 13.4-1.5z"/>',
  pair: '<g transform="translate(5.00 7.50) scale(1.000)"><path d="M35.792 8.46533C36.8432 8.80397 37.4205 9.93064 37.082 10.9819L30.4932 31.4497C30.1546 32.5009 29.0279 33.0792 27.9766 32.7407L19.541 30.0249L26.5693 27.4429C29.1612 26.4905 30.4902 23.6178 29.5381 21.0259L23.4648 4.49756L35.792 8.46533Z"/><rect y="6.84009" width="19.8349" height="25.502" rx="2" transform="rotate(-20.1727 0 6.84009)"/></g>',   // assets/pair.svg
  mirror: '<path d="M6 10l16 14L6 38zM42 10L26 24l16 14z"/>',
};
const t3Ico = k => `<svg class="tc-ico" viewBox="0 0 48 48" aria-hidden="true" fill="currentColor">${T3_ICO[k]}</svg>`;
const T3_Q = '<g transform="translate(10.50 0.50) scale(1.000)"><path d="M13.0759 35.5C16.6099 35.5 19.5079 38.0309 19.5079 41.0556C19.5079 44.2654 16.6099 46.7346 13.0759 46.7346C9.40053 46.7346 6.64398 44.2654 6.64398 41.0556C6.64398 38.0309 9.40053 35.5 13.0759 35.5ZM14.1361 0C21.5576 0 27 7.16049 27 16.4815C27 25.3086 22.5471 31.9753 11.4503 31.9753H7.56283V23.9506H11.5209C15.9738 23.9506 17.5995 20.679 17.5995 16.5432C17.5995 11.6667 15.9031 7.90124 14.1361 7.90124C13.2173 7.90124 11.1675 7.96297 9.32984 18.642L0 17.3457C1.48429 9.07407 4.17017 0 14.1361 0Z"/></g>';   // знак вопроса — assets/last-num.svg
const t3IcoOf = (bet, sel) => bet === 'dpair' ? T3_Q : bet === 'rank' ? T3_ICO.rank : bet === 'half' ? (sel ? '<path d="M24 6l16 18H31v18H17V24H8z"/>' : '<path d="M24 42L8 24h9V6h14v18h9z"/>') : bet === 'parity' ? T3_ICO[sel ? 'moon' : 'sun'] : bet === 'digit' ? `<text x="24" y="35" text-anchor="middle" font-size="32" font-weight="700">${sel}</text>` : T3_ICO[bet] || '';
const T3_COL = { 'parity:0': '#ffd23f', 'parity:1': '#b48cff', 'half:0': '#3df5a6', 'half:1': '#ff7a59', 'has7:0': '#ff5fa8', 'diff:0': '#4fd8ff', 'pair:0': '#ffa53d', 'mirror:0': '#c86bff' };
const t3ColOf = (bet, sel) => T3_COL[bet + ':' + sel] || (bet === 'digit' || bet === 'dpair' ? '#5ee3ff' : bet === 'rank' ? TIERS[sel].c : T3_VIOLET);
// одинаковый оптический вес у всех иконок исходов: у каждой — свой масштаб и центр (замерено по площади заливки и габаритам)
const T3_INK = { rank: [.945, 23.9, 24.9], 'parity:0': [.935, 23.9, 23.9], 'parity:1': [1.1, 26.1, 23.8], half: [1.02, 23.9, 23.9], has7: [1.15, 23.9, 23.9], pair: [.96, 23.8, 24.1], dpair: [.8, 23.9, 23.8] };
const t3Ink = (bet, sel, body) => { const v = T3_INK[bet + ':' + sel] || T3_INK[bet]; return v ? `<g transform="translate(24 24) scale(${v[0]}) translate(${-v[1]} ${-v[2]})">${body}</g>` : body; };
const t3Svg = (bet, sel) => `<svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">${t3Ink(bet, sel, bet === 'rank' ? T3_GEM_I : t3IcoOf(bet, sel))}</svg>`;
const T3_GEM_I = '<path d="M15 8h18l9 11-18 23L6 19z"/>';
// ячейки табло: ключ ставки (ранг и цифра — текущие) и название
const T3C = [
  ...TIERS.map((t, n) => ({ g: 'rank', key: () => 'rank:' + n, name: () => t.name })),
  { g: 'mid', key: () => 'parity:0', name: () => $t("Чёт") },
  { g: 'mid', key: () => 'parity:1', name: () => $t("Нечет") },
  { g: 'mid', key: () => 'half:0', name: () => $t("До 50000") },
  { g: 'mid', key: () => 'half:1', name: () => $t("От 50000") },
  { g: 'mid', key: () => 'has7:0', name: () => betLabel('has7', 0) },
  { g: 'mid', key: () => 'pair:0', name: () => betLabel('pair', 0) },
  ...[0, 1, 2, 3, 4].map(d => ({ g: 'dg', key: () => 'dpair:' + d, name: () => `${d * 2}–${d * 2 + 1}` })),   // последняя цифра — пары: 0–1 … 8–9
];
let t3Digit = 7;
const t3Bet = k => { const [b, s] = k.split(':'); return [b, +s]; };
const t3Key = () => T3C[t3Sel].key();
const t3Chance = k => { const [b, s] = t3Bet(k), c = (RULES_C ||= betsRules()).table.find(x => x.bet === b && x.sel === s).count; return Math.round(c / TICKETS * 10000) / 100; };

const _setTier3 = setTier, _restartAuto3 = restartAuto, _showPrize3 = showPrize, _renderBet3 = renderBet;
// ранги — как на главной; выбор ранга сверху — это ячейка «Ранг»
setTier = (i, opts = {}) => { if (!isT3()) return _setTier3(i, opts); t3Go(Math.max(0, Math.min(T3G.length - 1, i))); };
let t3Grp = 0;   // колода по центру: 0 — ранг, 1 — тикет, 2 — цифры
function t3Go(g){ if (g === t3Grp && t3Board.innerHTML) return t3Head(); const d = Math.sign(g - t3Grp); t3Grp = g; S.tier = g; t3Render();
  if (!S.lite && d) t3Board.querySelector('.tc3.cur')?.animate([{ translate: `${d * 60}px 0`, scale: .85, opacity: .4 }, { translate: '0 0', scale: 1, opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.8,.3,1.1)' }); }
// ряд сверху: 3 подписи вместо рангов, подчёркивание — под колодой по центру
// подписи ряда перетекают: текст меняется с лёгким проявлением, лишние кнопки плавно схлопываются (без исчезновения ряда)
function tierMorph(names, colors){
  tiersEl.querySelectorAll('.tier').forEach((b, i) => { const gone = i >= names.length; b.classList.toggle('gone', gone);
    if (!gone && b.textContent !== names[i]) b.textContent = names[i];   // слово меняется сразу, цвет перетекает (transition в CSS)
    if (!gone) b.style.setProperty('--c', colors[i]); });
}
function t3Head(){
  tierMorph(T3G.map(([, t]) => t()), T3G.map(() => T3_VIOLET));
  tiersEl.querySelectorAll('.tier').forEach((b, i) => b.classList.toggle('on', i === t3Grp));
  Glow.set(TIERS[3].glow); document.documentElement.style.setProperty('--tier', T3_VIOLET); document.documentElement.style.setProperty('--tierA', '#b48cff'); document.documentElement.style.setProperty('--tierB', '#6a3fd6');
  const g = T3G[t3Grp][0], n = T3C.filter(c => c.g === g && betsBoard[c.key()]).length;
  $('chance').firstElementChild.textContent = $t("ставок"); $('chanceVal').textContent = n; placeChance();   // линия под выбранной колодой — цветом подписей
  t3Arrows[0].disabled = t3Grp <= 0; t3Arrows[1].disabled = t3Grp >= T3G.length - 1;
  clearTimeout(t3Head.t); t3Head.t = setTimeout(t3Place, 340);   // подписи ещё раскрываются — после них подвинуть плашку и линию точно
  t3Place();
}
function t3Place(){ if (!isT3()) return; placeChance();
  const lab = tiersEl.children[t3Grp]; if (lab){ $('tind').style.width = lab.offsetWidth * .7 + 'px'; $('tind').style.transform = `translateX(${lab.offsetLeft + lab.offsetWidth * .15}px)`; }
}
restartAuto = () => { if (isT3()){ clearInterval(auto); return; } _restartAuto3(); };
showPrize = dir => { if (!isT3()) _showPrize3(dir); };   // приза нет — на его месте табло
// плашка — сколько всего спишется; справа — сколько ставок и до скольки даст
renderBet = bump => { if (!isT3()) return _renderBet3(bump); const b = $('bet'); b.classList.remove('gifts');
  const tot = betsTotal(), n = betsList().length;
  b.innerHTML = `<img src="assets/ton.svg" width="49" height="41.34" alt=""><b class="ton">${fmt(tot)}</b>` +
    (tot ? `<span class="t3to"><small>${n} ${$n("ставка|ставки|ставок", n)} · ${$t("выигрыш")}</small><b>${$t("до {0}", fmt(betsMaxWin()))}</b></span>` : '');
  if (bump) b.querySelector('.ton').classList.add('bump'); requestAnimationFrame(t3ArrPlace); };
// стрелки колод — вплотную к краям плашки ставки: плашка шире/уже — стрелки едут вместе с ней
function t3ArrPlace(){ if (!isT3() || typeof t3Arrows === 'undefined') return; const w = $('bet').offsetWidth / 2;
  t3Arrows[0].style.left = `calc(50% - ${w + 46}px)`; t3Arrows[1].style.left = `calc(50% + ${w + 2}px)`; }
function t3Enter(){ t3SkyOn(true); setTimeout(t3Chips); t3Main = S.tier; S.tier = t3Grp; t3Gifts = S.gifts; S.gifts = []; renderSlots(); $('giftCnt').hidden = true; clearInterval(auto); t3Render(); renderBet(); requestAnimationFrame(() => requestAnimationFrame(t3Head)); }
function t3Leave(){ t3SkyOn(false); $('chance').firstElementChild.textContent = $t("шанс"); setTimeout(t3Chips); tierMorph(TIERS.map(t => t.name), TIERS.map(t => t.c)); setTimeout(() => { if (!isT3()){ placeChance(); placeInd(); } }, 340); if (t3Gifts){ S.gifts = t3Gifts.filter(g => INV.includes(g)); t3Gifts = null; } renderBet(); _setTier3(t3Main ?? S.tier); restartAuto(); }

const t3Board = (() => { const el = document.createElement('div'); el.className = 'abs t3grid'; el.id = 't3Board'; $('bet').parentNode.insertBefore(el, $('prize')); return el; })();
// 4 колоды по 5–6 исходов: ранг · тикет · последняя цифра 0–4 · 5–9
const T3G = [['rank', () => $t("Ранг")], ['mid', () => $t("Тикет")], ['dg', () => $t("Последняя цифра")]];
const T3_ART = { rank: T3_ICO.rank, mid: T3_ICO.sun, dg2: '<text x="24" y="36" text-anchor="middle" font-size="34" font-weight="700">9</text>', dg: '<text x="24" y="36" text-anchor="middle" font-size="34" font-weight="700">7</text>' };
// исход — медальон, как места на Арене: тёмный выпуклый кружок со знаком в цвете исхода, под ним название и множитель;
// со ставкой — медальон заливается цветом, вокруг светится кольцо, сумма — метка на медальоне
const T3_GEM = '<path d="M15 8h18l9 11-18 23L6 19z"/>';
function t3Cell(c, i){
  const k = c.key(), v = betsBoard[k] || 0, [b, s] = t3Bet(k);
  const ico = t3Svg(b, s);   // все иконки — одного оптического веса
  return `<span class="t3x t3m${v ? ' on' : ''}" data-i="${i}" style="--tc:${t3ColOf(b, s)}"><i class="t3md">${ico}${v ? `<span class="t3in">${fmt(v)}</span>` : ''}</i>` +
    `<b>${c.name()}</b><small>x${fmt(betMult(b, s))}</small></span>`;
}
// фон карты — узор, как колизей у Арены, только мистический: круги, лучи и звезда (вектор, рисуется один раз)
const T3_MAND = (() => {
  const C = 150, f = v => v.toFixed(1); let g = '';
  [140, 118, 96, 60, 34].forEach((r, n) => g += `<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="#b48cff" stroke-width="${n % 2 ? 1 : 2}" opacity="${n ? (.32 - n * .03).toFixed(2) : .1}"${n === 1 ? ' stroke-dasharray="2 6"' : ''}/>`);
  for (let k = 0; k < 24; k++){ const a = k * Math.PI / 12; g += `<line x1="${f(C + Math.cos(a) * 60)}" y1="${f(C + Math.sin(a) * 60)}" x2="${f(C + Math.cos(a) * (k % 2 ? 96 : 118))}" y2="${f(C + Math.sin(a) * (k % 2 ? 96 : 118))}" stroke="#b48cff" stroke-width="1" opacity=".18"/>`; }
  for (let k = 0; k < 8; k++){ const a = k * Math.PI / 4, b = a + Math.PI / 8; g += `<path d="M${C} ${C}L${f(C + Math.cos(a) * 34)} ${f(C + Math.sin(a) * 34)}L${f(C + Math.cos(b) * 14)} ${f(C + Math.sin(b) * 14)}z" fill="#f0c76a" opacity=".22"/>`; }
  for (let k = 0; k < 12; k++){ const a = k * Math.PI / 6 + .26; g += `<circle cx="${f(C + Math.cos(a) * 129)}" cy="${f(C + Math.sin(a) * 129)}" r="2.2" fill="#f0c76a" opacity=".25"/>`; }
  return `<svg class="tc3-bg" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g class="tc3-rot">${g}</g></svg>`;
})();
// три карты таро: по центру — крупная с исходами своей колоды, по бокам — соседние, маленькие (тап — перейти к ней)
function t3Render(){
  if (!isT3()) return;
  // карты уже есть — обновляем только исходы и положение карт: узор и фон не пересоздаются, их вращение не сбивается
  const cards = t3Board.querySelectorAll('.tc3');
  if (cards.length === T3G.length){
    cards.forEach((el, n) => { const g = T3G[n][0];
      el.className = `tc3 ${n === t3Grp ? 'cur' : n < t3Grp ? 'l' : 'r'}${Math.abs(n - t3Grp) > 1 ? ' far' : ''}`;
      el.querySelector('.tc3-b').innerHTML = T3C.map((c, i) => c.g === g ? t3Cell(c, i) : '').join(''); });
    return t3Head();
  }
  t3Board.innerHTML = `<div class="t3deck3">` + T3G.map(([g, t], n) => {
    const pos = n === t3Grp ? 'cur' : n < t3Grp ? 'l' : 'r', far = Math.abs(n - t3Grp) > 1 ? ' far' : '', bets = T3C.filter(c => c.g === g && betsBoard[c.key()]).length;
    return `<div class="tc3 ${pos}${far}" data-n="${n}"><i class="tc3-rim"></i>${T3_MAND}<div class="tc3-h"><i>${t3Svg('', 0).replace('></svg>', '>' + T3_ART[g] + '</svg>')}</i><b>${t()}</b></div>` +
      `<div class="tc3-b g-${g === 'dg' ? 'dp' : g} v3">${T3C.map((c, i) => c.g === g ? t3Cell(c, i) : '').join('')}</div></div>`; }).join('') + `</div>`;
  t3Head();
}
// + к ставке на выбранную ячейку; лимиты — до 12 ставок, общая ставка, выигрыш за раунд
function t3Add(add){
  const k = t3Key(), next = Math.round(((betsBoard[k] || 0) + add) * 100) / 100;
  if (!betsBoard[k] && betsList().length >= BETS_MAX_N){ haptic('rigid'); notify({ type: 'warn', icon: 'coin', title: $t("Максимум {0} ставок за раунд", BETS_MAX_N), text: $t("Убери ставку с другой ячейки — корзиной") }); return; }
  if (betsTotal() + add > BET_MAX + 1e-9){ haptic('rigid'); notify({ type: 'warn', icon: 'coin', title: $t("Максимальная ставка {0} GRAM", BET_MAX), text: $t("За раунд, на все ячейки вместе") }); return; }
  if (betsMaxWin({ ...betsBoard, [k]: next }) > BETS_MAX_WIN){ haptic('rigid'); notify({ type: 'warn', icon: 'coin', title: $t("Выигрыш за раунд — до {0} GRAM", BETS_MAX_WIN), text: $t("Уменьши ставку на редкий исход") }); return; }
  betsBoard[k] = next; Sfx.coin(); haptic('light'); t3Render(); renderBet(true); $('chance').animate([{ scale: 1.2 }, { scale: 1 }], { duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)' });
     // у звёздного взрыва нет конца — гасим сами, вспышка короткая
  t3Board.querySelector(`[data-i="${t3Sel}"]`)?.animate([{ scale: .94 }, { scale: 1.05, offset: .6 }, { scale: 1 }], { duration: 300, easing: 'cubic-bezier(.3,1.5,.5,1)' });
}
// тап по ячейке — выбрать; повторный тап по выбранной со ставкой — ещё столько же (частое действие в один тап)
t3Board.addEventListener('click', e => { if (S.busy) return;
  const sc = e.target.closest('.tc3:not(.cur)'); if (sc){ selHaptic(); Sfx.swipe(); t3Go(+sc.dataset.n); return; }
  const dd = e.target.closest('[data-dd]'); if (dd){ t3Digit = (t3Digit + +dd.dataset.dd + 10) % 10; haptic(); Sfx.tick(.5); t3Render(); return; }
  const gb = e.target.closest('[data-g]'); if (gb){ const n = T3C.findIndex(c => c.g === gb.dataset.g); if (T3C[t3Sel].g !== gb.dataset.g){ t3Sel = n; haptic(); Sfx.swipe(); t3Render(); } return; }
  const c = e.target.closest('.t3x'); if (!c || t3Long) return;
  if (!t3Chip){ haptic('rigid'); notify({ type: 'info', icon: 'coin', title: $t("Выбери фишку внизу"), text: $t("Потом тапай по исходам — каждый тап кладёт фишку") });
    document.querySelector('.chips').animate([{ scale: 1 }, { scale: 1.08 }, { scale: 1 }], { duration: 360, easing: 'cubic-bezier(.3,1.5,.5,1)' }); return; }
  t3Sel = +c.dataset.i; t3Add(t3Chip); });   // тап по ячейке — ставка фишкой выбранного номинала
// долгое нажатие на ячейку — снять с неё ставку
let t3Long = false;
{ let lp = 0;
  t3Board.addEventListener('pointerdown', e => { const c = e.target.closest('.t3x'); if (!c || S.busy) return; t3Long = false;
    lp = setTimeout(() => { const k = T3C[+c.dataset.i].key(); if (!betsBoard[k]) return; t3Long = true; delete betsBoard[k]; t3Sel = +c.dataset.i; haptic('medium'); Sfx.lock(); t3Render(); renderBet(true); }, 450); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => t3Board.addEventListener(ev, () => { clearTimeout(lp); setTimeout(() => { t3Long = false; }, 0); })); }
// внизу: «+0.1 … +5» — номинал фишки (выбранный подсвечен); корзина — сначала ставку с последней ячейки, потом всё
document.querySelector('.chips').addEventListener('click', e => { if (!isT3()) return; const b = e.target.closest('[data-add], #trash'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault(); if (S.busy) return;
  if (b.id === 'trash'){ const k = t3Key(); if (betsBoard[k]) delete betsBoard[k]; else if (betsTotal()) betsBoard = {}; else return; haptic('medium'); Sfx.lock(); t3Render(); renderBet(true); return; }
  const v = +b.dataset.add; t3Chip = t3Chip === v ? 0 : v; betsChip = t3Chip || .5; haptic(); Sfx.swipe(); t3Chips(); }, true);   // повторный тап по выбранной фишке — снять выбор
let t3Chip = .5;   // выбранный номинал фишки (0 — не выбран)
// фишки в ставках — номинал без «+» (это не «добавить», а какой фишкой ставишь); на выходе «+» возвращается
const t3Chips = () => document.querySelectorAll('.chips [data-add]').forEach(b => { b.classList.toggle('on', isT3() && +b.dataset.add === t3Chip);
  const t = b.querySelector('b'); if (t) t.textContent = (isT3() ? '' : '+') + fmt(+b.dataset.add); });

// тап по наковальне / ставке: удар и раскрытие, как у крафта
const _craftClick3 = $('craft').onclick;
$('craft').onclick = () => isT3() ? t3Play() : _craftClick3();
async function t3Play(){
  if (S.busy) return; const amt = betsTotal(), fast = S.fast || S.lite;
  if (amt <= 0 && t3Last){ if (hamAnim) settle(); betsBoard = { ...t3Last }; t3Render(); renderBet(true); haptic(); return; }   // пусто — первый тап возвращает прошлые ставки
  if (amt <= 0){ if (hamAnim) settle(); haptic('rigid'); notify({ type: 'err', icon: 'coin', title: $t("Сначала сделай ставку"), text: $t("Выбери ячейку — ставь кнопками внизу") });
    $('bet').animate([{ translate: '-6px 0' }, { translate: '6px 0' }, { translate: '0 0' }], { duration: 220, iterations: 2 }); return; }
  if (amt > S.balance){ if (hamAnim) settle(); haptic('rigid'); notify({ type: 'err', icon: 'coin', title: $t("Недостаточно GRAM"), text: $t("Пополни баланс — тапни по нему сверху") }); return; }
  S.busy = true; CRAFT.classList.add('busy'); setBalance(S.balance - amt); $('fxTop').style.visibility = 'hidden';
  const bets = betsList(), pr = API.bets(bets); pr.catch(() => {});
  if (fast){ Sfx.lock(); await strike(.8, REST + 10); await openFx(true); } else await bigStrike();
  let r = null; try { r = await pr; } catch(_){}
  if (!r){ setBalance(S.balance + amt); await closeFx(); CRAFT.classList.remove('busy'); S.busy = false; notify({ type: 'err', icon: 'coin', title: $t("Ставка не прошла"), text: $t("GRAM вернулись на баланс") }); return; }
  betsLast = { ...betsBoard }; t3Last = { ...betsBoard };
  // под барабаном — как на арене: сверху сумма ставок, ниже плитки ставок (карточки игроков арены: 3 в ряд, больше 6 ставок — карточки ниже)
  $('fxPvp').innerHTML = `<div class="pvp-bank"><small>${$t("Ставки")}</small><b><img src="assets/ton.svg" alt="">${fmt(amt)}</b></div><div class="pvp-avas bt-avas${r.bets.length > 6 ? ' c4' : ''}">` +   // больше 6 ставок — 4 в ряд, ниже: 12 ставок = 3 ряда, влезает
    r.bets.map(b => t3Tile(b, r.bets.length > 6)).join('') + `<span class="pvc pva empty${r.bets.length > 6 ? ' many' : ''}"></span>`.repeat(r.bets.length > 6 ? (4 - r.bets.length % 4) % 4 : (3 - r.bets.length % 3) % 3) + `</div>`;
  $('fx').classList.add('btspin');
  await reveal(r, fast);
}
// плитка ставки при раскрытии — карточка игрока арены: в кружке иконка карты, ниже название и сумма (после — выплата)
const t3Tile = (b, many) => `<span class="pvc pva btt${many ? ' many' : ''}" style="--tc:${t3ColOf(b.bet, b.sel)}"><i class="tav">${t3Svg(b.bet, b.sel)}</i><b>${betShort(b.bet, b.sel)}</b><i class="pvd">${fmt(b.amount)}</i></span>`;
// итог — экран дропа крафта: выиграл — приз крупно (выигрыш от порога — NFT и сдача, «Продать» / «Забрать»), не сыграло — тусклый гем и «Вернуться».
// Под суммой — компактная полоска всех ставок раунда: значок карты, сыгравшие — зелёные с выплатой, остальные тусклые с −ставкой
const _betsAfter3 = betsAfter;
betsAfter = async r => {
  if (!isT3()) return _betsAfter3(r);
  await betsChipsReveal(r);
  const won = r.bets.filter(b => b.won), line = `${$t("ставка {0} GRAM", fmt(r.stake))} · ${won.length ? $t("сбылось {0} из {1}", won.length, r.bets.length) : $t("не сбылось")}`;
  $('fxPvp').innerHTML = '';
  await showDrop(r);
  $('fx').classList.toggle('lost', !(r.win > 0)); $('fx').classList.toggle('btmany', r.bets.length > 6);   // много ставок — приз компактнее, кнопки влезают
  if (r.nft) $('fxWin').insertAdjacentHTML('beforeend', `<span>${line}</span>`);
  else $('fxWin').innerHTML = `<b>${r.win > 0 ? '+' + fmt(r.win) : '0'} GRAM</b><span>${line}</span>`;
  let el = $('fxPl'); if (!el){ el = document.createElement('div'); el.className = 'fx-pl'; el.id = 'fxPl'; $('fxWin').after(el); }
  el.innerHTML = '';   // на итоге — только строка «ставка · сбылось N из M», без списка исходов
  if (r.win > 0){
    $('fxTake').onclick = () => t3Finish(r, 'take'); if ($('fxSell')) $('fxSell').onclick = () => t3Finish(r, 'sell');
    $('fxShare').onclick = () => shareWin(r.nft ? $t("Выиграл {0} #{1} на ставках в Pawn", r.nft.nft.name, r.nft.num) : $t("Выиграл +{0} GRAM на ставках в Pawn", fmt(r.win)), r.nft);
  } else {
    $('pz')?.classList.add('t3lose'); $('pz')?.querySelectorAll('img').forEach(im => { im.src = 'assets/empty-gem.webp'; });
    const gl = $('pz')?.querySelector('.gl'); if (gl) gl.style.setProperty('--m', "url('assets/empty-gem.webp')");
    $('fxBtns').innerHTML = `<button class="btn-main" id="fxTake">${$t("Вернуться")}</button>` + PF_LINK;
    $('fxTake').onclick = () => t3Finish(r, 'take');
    $('fxShare').onclick = () => shareWin($t("Ставлю на тикет в Pawn"));
  }
  $('fxPfIn').onclick = () => openPF(r);
};
async function t3Finish(r, how){
  if (t3Finish.on) return; t3Finish.on = true;
  const add = r.nft ? (how === 'sell' ? r.nft.value : 0) + (r.change || 0) : r.win;
  if (r.nft && how !== 'sell') INV = [{ ...r.nft, id: 'g' + Date.now() }, ...INV];
  haptic('medium'); if (add > 0) Sfx.coin();
  if (!S.demo){ logCraft(r, r.nft ? how : 'bets'); addXp(r.stake * .5); }
  await closeFx(); $('fx').classList.remove('btspin');
  if (add > 0) moveBal(add);
  if (r.nft) notify({ type: 'ok', img: r.nft.nft.src, title: how === 'sell' ? $t("Продано: +{0} GRAM", fmt(add)) : `${r.nft.nft.name} ${$t("в инвентаре")}`, text: r.change > 0 && how !== 'sell' ? $t("На баланс +{0} GRAM", fmt(r.change)) : $t("Выигрыш ставок") });
  else if (add > 0) notify({ type: 'ok', img: 'assets/hero-gem.webp', title: `+${fmt(add)} GRAM`, text: $t("Выигрыш ставок зачислен") });
  if (r.win > 0) setTimeout(() => pushLive(liveHTML(r.ticket, { me: true, stake: r.stake, win: r.win, bets: true })), 300);
  CRAFT.classList.remove('busy'); S.busy = false; t3Finish.on = false; t3Render(); renderBet();
}
// кнопка подарков в ставках — правила (щит, как в Арене)
$('giftBtn').addEventListener('click', e => { if (!isT3()) return; e.stopImmediatePropagation(); betsRulesModal(); }, true);

/* ---------- фон «обсерватория»: плоский звёздный купол сверху — как колизей у арены (сплошные заливки, без тонких линий) ---------- */
const OBS_SVG = (() => {
  let r = 11; const R = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const stars = Array.from({ length: 46 }, () => { const a = R() * Math.PI * 2, d = 40 + R() * 150; return `<circle cx="${(200 + Math.cos(a) * d).toFixed(1)}" cy="${(200 + Math.sin(a) * d).toFixed(1)}" r="${(1 + R() * 2.2).toFixed(1)}"/>`; }).join('');
  const con = [[[120, 120], [150, 100], [185, 115], [210, 90]], [[250, 270], [285, 250], [300, 285], [270, 305]], [[110, 260], [135, 290], [100, 305]]]
    .map(p => `<path d="M${p.map(q => q.join(' ')).join('L')}"/>` + p.map(q => `<circle cx="${q[0]}" cy="${q[1]}" r="4"/>`).join('')).join('');
  return `<svg class="obs" viewBox="0 0 400 400" aria-hidden="true"><circle cx="200" cy="200" r="196" fill="#1b1033"/><circle cx="200" cy="200" r="168" fill="#221440"/><circle cx="200" cy="200" r="122" fill="#2a184d"/>` +
    `<circle cx="200" cy="200" r="182" fill="none" stroke="#3a2668" stroke-width="10" stroke-dasharray="3 9"/><g fill="#8f7ad6">${stars}</g><g class="con" fill="#c9b8ff" stroke="#6f5bb5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${con}</g>` +
    `<path d="M318 96a30 30 0 1 0 6 40 24 24 0 1 1-6-40z" fill="#c9b8ff" opacity=".85"/></svg>`;
})();
// искорки вокруг колоды мерцают и чуть всплывают — только прозрачность и сдвиг (видеокарта); в экономном режиме — нет
const SPARK = '<svg viewBox="0 0 20 20"><path d="M10 0c1 6 4 9 10 10c-6 1-9 4-10 10c-1-6-4-9-10-10c6-1 9-4 10-10z"/></svg>';
const T3_SPARKS = Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2 + .3, r = 130 + (i * 37 % 50);
  return `<i style="left:calc(50% + ${(Math.cos(a) * r * 1.2).toFixed(0)}px);top:calc(50% + ${(Math.sin(a) * r * .75).toFixed(0)}px);--s:${(.5 + (i * 7 % 10) / 14).toFixed(2)};animation-duration:${(3 + i % 4).toFixed(1)}s;animation-delay:-${(i * .7).toFixed(1)}s">${SPARK}</i>`; }).join('');

// круг зодиака — тонкие золотые кольца, 12 секторов со знаками, звёзды по ободу; медленно вращается под табло
const ZOD_SVG = (() => {
  const C = 200, f = v => v.toFixed(1), ring = (r, w, o = 1) => `<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke-width="${w}" opacity="${o}"/>`;
  const GL = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
  let s = `<svg class="zod" viewBox="0 0 400 400" aria-hidden="true"><g fill="none" stroke="#f0c76a">` + ring(196, 2) + ring(186, 1, .6) + ring(152, 1.5) + ring(110, 1.5) + ring(70, 1.2, .8) + ring(56, 1, .5);
  for (let i = 0; i < 12; i++){ const a = (i * 30 - 90) * Math.PI / 180; s += `<line x1="${f(C + Math.cos(a) * 70)}" y1="${f(C + Math.sin(a) * 70)}" x2="${f(C + Math.cos(a) * 152)}" y2="${f(C + Math.sin(a) * 152)}" stroke-width="1" opacity=".7"/>`; }
  for (let i = 0; i < 16; i++){ const a = i * Math.PI / 8, x = C + Math.cos(a) * 44, y = C + Math.sin(a) * 44, x2 = C + Math.cos(a + Math.PI / 16) * 26, y2 = C + Math.sin(a + Math.PI / 16) * 26;
    s += `<path d="M${f(C)} ${f(C)}L${f(x)} ${f(y)}L${f(x2)} ${f(y2)}z" stroke-width="1" opacity=".6"/>`; }   // солнце в центре
  s += `</g><g fill="#f0c76a" font-size="26" text-anchor="middle" dominant-baseline="central" font-family="serif">`;
  GL.forEach((g, i) => { const a = (i * 30 + 15 - 90) * Math.PI / 180; s += `<text x="${f(C + Math.cos(a) * 131)}" y="${f(C + Math.sin(a) * 131)}">${g}︎</text>`; });
  s += `</g><g fill="#f0c76a">`;
  for (let i = 0; i < 24; i++){ const a = i * Math.PI / 12, x = C + Math.cos(a) * 169, y = C + Math.sin(a) * 169;
    s += i % 2 ? `<circle cx="${f(x)}" cy="${f(y)}" r="1.6" opacity=".7"/>` : `<path d="M${f(x)} ${f(y - 6)}l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z"/>`; }
  return s + `</g></svg>`;
})();
// мистический фон под табло: звёздный купол медленно вращается, искры мерцают, сквозь — фиолетовая туманность Горна
// звёздные круги из точек вокруг карты — как публика на трибунах Арены, только мистика: точки-звёзды разного размера, кое-где созвездия
const T3_STARS = (() => {
  // звёзды — группами (маленькие созвездия по 3–5 точек); каждая группа сама гаснет и загорается в своё время
  let rnd = 13; const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647, f = v => v.toFixed(1);
  let s = '';
  for (let g = 0; g < 16; g++){ const a = g / 16 * 2 * Math.PI + R() * .3, d = 165 + R() * 70, cx = 250 + Math.cos(a) * d, cy = 250 + Math.sin(a) * d * .9;
    let dots = '', path = '', n = 3 + Math.floor(R() * 3), px = cx, py = cy;
    for (let k = 0; k < n; k++){ const x = cx + (R() - .5) * 46, y = cy + (R() - .5) * 46, z = 1.1 + R() * 1.8; dots += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(z)}"/>`;
      if (k) path += `M${f(px)} ${f(py)}L${f(x)} ${f(y)}`; px = x; py = y; }
    s += `<g class="stg" style="animation-duration:${f(5 + R() * 5)}s;animation-delay:-${f(R() * 10)}s"><path d="${path}"/>${dots}</g>`; }
  return `<svg viewBox="0 0 500 500" aria-hidden="true"><g fill="#e3d4ff" stroke="#c9b8ff" stroke-width=".7" stroke-opacity=".45">${s}</g></svg>`;
})();
const t3Sky = (() => { const el = document.createElement('div'); el.className = 'abs t3sky'; el.id = 't3Sky';
  el.innerHTML = `<div class="t3neb" id="t3Neb"></div><div class="t3stars">${T3_STARS}</div>`;
  $('bet').parentNode.insertBefore(el, t3Board); return el; })();
/* туманность — как дым на Арене: одна картинка клуба (arena-puff.webp, перекрашена в фиолетовый), 7 копий медленно плывут,
   поворачиваются и то густеют, то тают. Только сдвиг, поворот и прозрачность — видеокарта не греется, WebGL не нужен */
function t3SkyOn(on){
  const box = $('t3Neb'), run = on && !S.lite;
  if (box.childElementCount){ box.getAnimations({ subtree: true }).forEach(x => run ? x.play() : x.pause()); return; }   // не видно — анимации на паузе
  if (!on) return;
  for (let i = 0; i < 7; i++){
    const a = i / 7 * Math.PI * 2 + Math.random() * .6, r = 14 + Math.random() * 16, sz = 38 + Math.random() * 22;   // в % от коробки
    const im = document.createElement('img'); im.src = 'assets/arena-puff.webp'; im.alt = ''; im.className = 'npuff';
    im.style.cssText = `left:${(50 + Math.cos(a) * r - sz / 2).toFixed(1)}%;top:${(50 + Math.sin(a) * r * .8 - sz / 2).toFixed(1)}%;width:${sz.toFixed(1)}%`;
    box.appendChild(im);
    const R = () => (Math.random() - .5) * 2, dx = R() * 14, dy = R() * 14, rot = R() * 70, s0 = .9 + Math.random() * .2;
    im.animate([{ transform: `translate(0,0) rotate(0deg) scale(${s0})`, opacity: .25 }, { transform: `translate(${dx}%,${dy}%) rotate(${rot / 2}deg) scale(${s0 + .15})`, opacity: .85, offset: .5 },
      { transform: `translate(${-dy / 2}%,${dx / 2}%) rotate(${rot}deg) scale(${s0})`, opacity: .3 }],
      { duration: 11000 + Math.random() * 8000, delay: -Math.random() * 19000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
  }
}
// под экраном раскрытия туманность гаснет — силы не тратит
setInterval(() => { if (isT3()) t3SkyOn(!$('fx').classList.contains('on')); }, 500);



// свайп по ячейке цифры — листать цифру
{ let x0 = null; t3Board.addEventListener('pointerdown', e => { x0 = e.target.closest('.t3drum') ? e.clientX : null; });
  t3Board.addEventListener('pointerup', e => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) < 30) return;
    t3Digit = (t3Digit + (dx < 0 ? 1 : -1) + 10) % 10; t3Long = true; setTimeout(() => { t3Long = false; }, 0); haptic(); Sfx.tick(.5); t3Render(); }); }

// стрелки по бокам карты — как у комнат на Арене: листают колоды
const t3Arrows = (() => { const mk = (id, d, path) => { const b = document.createElement('button'); b.className = 'abs t2arr t3arrw'; b.id = id;
    b.setAttribute('aria-label', d < 0 ? $t("Назад") : $t("Дальше")); b.innerHTML = svg(path);
    b.onclick = () => { const n = t3Grp + d; if (n < 0 || n >= T3G.length || S.busy){ haptic('rigid'); return; } selHaptic(); Sfx.swipe(); t3Go(n); }; $('bet').parentNode.appendChild(b); return b; };
  return [mk('t3Prev', -1, '<path d="M15 5l-7 7 7 7"/>'), mk('t3Next', 1, '<path d="M9 5l7 7-7 7"/>')]; })();

