/* =========================================================
   СТАВКИ (tab3) — копия главной, как Арена: класс mode-tab3 на body, тот же экран, свой мир — «обсерватория».
   Та же логика, что в крафте: в центре — на что играешь (карта колоды, листается свайпом), сверху — её шанс и множитель,
   кнопки «+0.1 … +5» — ставка на карту по центру, на плашке — сколько всего спишется, под колодой — «выиграешь до N GRAM».
   Ряд сверху вместо рангов — группы исходов: Ранг · Чёт/нечет · Цифра · Узор (тап — перемотать колоду к группе).
   Карты: 5 рангов, Чёт, Нечет, Последняя цифра (барабан внутри карты), Есть 7, Все разные, Пара, Зеркало. До 12 ставок за раунд.
   Корзина — сначала ставку с карты по центру, потом все. Кнопка — хрустальный шар. Ядро, лимиты, мок и доказательство — 16b-bets.js
   ========================================================= */
const isT3 = () => document.body.classList.contains('mode-tab3');
let t3Main = null, t3Gifts = null, t3Idx = 0, t3Digit = 7, t3Last = null;   // ранг и подарки крафта (вернём при выходе); карта по центру; цифра на барабане
const T3_VIOLET = '#b9a6ff';
// иконки карт — плоские сплошные силуэты, как молот, меч и шлем (viewBox 48×48, цвет — цвет карты)
const T3_ICO = {
  rank: '<path d="M15 8h18l9 11-18 23L6 19z"/>',
  sun: '<circle cx="24" cy="24" r="9"/>' + Array.from({ length: 8 }, (_, i) => { const a = i * 45 * Math.PI / 180, p = (r, d) => `${(24 + Math.cos(a + d) * r).toFixed(1)} ${(24 + Math.sin(a + d) * r).toFixed(1)}`;
    return `<path d="M${p(13, -.18)}L${p(21, 0)}L${p(13, .18)}z"/>`; }).join(''),
  moon: '<path d="M30 6a18 18 0 1 0 12 30A15 15 0 1 1 30 6z"/>',
  has7: '<path d="M12 8h26v6L24 42h-8l13-27H12z"/>',
  diff: '<path d="M24 5l5.6 12.2 13.4 1.5-10 9 2.8 13.2L24 34.2l-11.8 6.7 2.8-13.2-10-9 13.4-1.5z"/>',
  pair: '<circle cx="17" cy="24" r="11"/><circle cx="31" cy="24" r="11" opacity=".6"/>',
  mirror: '<path d="M6 10l16 14L6 38zM42 10L26 24l16 14z"/>',
};
const t3Ico = k => `<svg class="tc-ico" viewBox="0 0 48 48" aria-hidden="true" fill="currentColor">${T3_ICO[k]}</svg>`;
// колода: группа (для ряда сверху), ключ ставки, цвет, иконка, название
const T3C = [
  ...TIERS.map((t, i) => ({ g: 0, key: () => 'rank:' + i, c: t.c, ico: 'rank', name: () => t.name, glow: t.glow })),
  { g: 1, key: () => 'parity:0', c: '#ffc94a', ico: 'sun', name: () => $t("Чёт") },
  { g: 1, key: () => 'parity:1', c: T3_VIOLET, ico: 'moon', name: () => $t("Нечет") },
  { g: 2, key: () => 'digit:' + t3Digit, c: '#7ad7ff', ico: null, name: () => $t("Последняя цифра") },
  ...BET_PATS.map(k => ({ g: 3, key: () => k + ':0', c: T3_VIOLET, ico: k, name: () => betLabel(k, 0) })),
];
const T3G = [() => $t("Ранг"), () => $t("Чёт/нечет"), () => $t("Цифра"), () => $t("Узор")];
const t3Key = () => T3C[t3Idx].key();
const t3Bet = k => { const [b, s] = k.split(':'); return [b, +s]; };
const t3Chance = k => { const [b, s] = t3Bet(k), c = (RULES_C ||= betsRules()).table.find(x => x.bet === b && x.sel === s).count; return Math.round(c / TICKETS * 10000) / 100; };
// иконка ставки по ключу — для плиток раскрытия и полоски итога
const t3IcoOf = (bet, sel) => bet === 'rank' ? T3_ICO.rank : bet === 'parity' ? T3_ICO[sel ? 'moon' : 'sun'] : bet === 'digit' ? `<text x="24" y="35" text-anchor="middle" font-size="32" font-weight="700">${sel}</text>` : T3_ICO[bet] || '';
const t3ColOf = (bet, sel) => bet === 'rank' ? TIERS[sel].c : bet === 'parity' && !sel ? '#ffc94a' : bet === 'digit' ? '#7ad7ff' : T3_VIOLET;

const _setTier3 = setTier, _restartAuto3 = restartAuto, _showPrize3 = showPrize, _renderBet3 = renderBet;
// в Ставках ряд сверху — группы исходов: тап по группе перематывает колоду к её первой карте
setTier = (i, opts = {}) => { if (!isT3()) return _setTier3(i, opts); const n = T3C.findIndex(c => c.g === i); if (n >= 0) t3Go(n, true); };
restartAuto = () => { if (isT3()){ clearInterval(auto); return; } _restartAuto3(); };
showPrize = dir => { if (!isT3()) _showPrize3(dir); };   // приза в ставках нет — на его месте колода
// плашка — сколько всего спишется, как в крафте
renderBet = bump => { if (!isT3()) return _renderBet3(bump); const b = $('bet'); b.classList.remove('gifts');
  const tot = betsTotal(), n = betsList().length;
  // слева — сколько спишется, справа — сколько ставок и до скольки даст самый удачный тикет: плашка отвечает на «что поставил и что могу выиграть»
  b.innerHTML = `<img src="assets/ton.svg" width="49" height="41.34" alt=""><b class="ton">${fmt(tot)}</b>` +
    (tot ? `<span class="t3to"><small>${n} ${$n("ставка|ставки|ставок", n)} · ${$t("выигрыш")}</small><b>${$t("до {0}", fmt(betsMaxWin()))}</b></span>` : '');
  if (bump) b.querySelector('.ton').classList.add('bump'); };
function t3Enter(){
  t3Main = S.tier; t3Gifts = S.gifts; S.gifts = []; renderSlots(); $('giftCnt').hidden = true; clearInterval(auto);
  // ряд сверху: группы вместо рангов (5-я кнопка не нужна)
  tiersEl.querySelectorAll('.tier').forEach((b, i) => { b.hidden = i >= T3G.length; if (i < T3G.length){ b.textContent = T3G[i](); b.style.setProperty('--c', T3_VIOLET); } });
  t3Render(); renderBet(); requestAnimationFrame(() => t3Go(t3Idx, false));
}
function t3Leave(){ if (t3Gifts){ S.gifts = t3Gifts.filter(g => INV.includes(g)); t3Gifts = null; }
  tiersEl.querySelectorAll('.tier').forEach((b, i) => { b.hidden = false; b.textContent = TIERS[i].name; b.style.setProperty('--c', TIERS[i].c); });
  renderBet(); _setTier3(t3Main ?? S.tier); restartAuto(); }
// верх экрана — по карте в центре: группа подчёркнута, над ней шанс, крупно — множитель; свечение рамки — цвет карты
function t3Head(){
  if (!isT3()) return; const c = T3C[t3Idx], k = c.key(), [b, sl] = t3Bet(k), lab = tiersEl.children[c.g], root = document.documentElement.style;
  S.tier = c.g;   // ряд сверху — группы: тап по уже выбранной группе ничего не делает, по другой — листает (раньше «Чёт/нечет» не срабатывал)
  tiersEl.querySelectorAll('.tier').forEach((el, i) => el.classList.toggle('on', i === c.g));
  $('tind').style.width = lab.offsetWidth * .7 + 'px'; $('tind').style.transform = `translateX(${lab.offsetLeft + lab.offsetWidth * .15}px)`;
  $('chanceVal').textContent = fmt(t3Chance(k)) + '%';
  const pr = $('scene').getBoundingClientRect(), lr = lab.getBoundingClientRect(), cw = $('chance').offsetWidth / 2 + 10;
  $('chance').style.left = Math.max(cw, Math.min(SW - cw, (lr.left + lr.width / 2 - pr.left) / K)) + 'px';
  xfade($('range'), 'x' + fmt(betMult(b, sl)));
  root.setProperty('--tier', c.c); root.setProperty('--tierA', c.c); root.setProperty('--tierB', c.c);
  Glow.set(c.glow || BETS_GLOW);
}

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
// ставка на карту — короткая вспышка искр из центра карты
function t3Burst(el){ if (S.lite || !el) return; const r = el.getBoundingClientRect(), box = t3Board.getBoundingClientRect();
  for (let i = 0; i < 8; i++){ const sp = document.createElement('i'); sp.className = 't3b-sp'; sp.innerHTML = SPARK; t3Board.appendChild(sp);
    const a = i / 8 * Math.PI * 2 + Math.random() * .5, d = 60 + Math.random() * 40;
    sp.style.left = (r.left + r.width / 2 - box.left) / K + 'px'; sp.style.top = (r.top + r.height / 2 - box.top) / K + 'px';
    sp.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px),calc(-50% + ${Math.sin(a) * d}px)) scale(1) rotate(90deg)`, opacity: 0 }],
      { duration: 600 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => sp.remove(); } }
const t3Board = (() => { const el = document.createElement('div'); el.className = 'abs t3b'; el.id = 't3Board';
  el.innerHTML = `<div class="t3obs">${OBS_SVG}</div><div class="t3spk" aria-hidden="true">${T3_SPARKS}</div><div class="t3deck" id="t3Deck"></div><div class="t3max" id="t3Max"></div>`;
  $('bet').parentNode.insertBefore(el, $('prize')); return el; })();

function t3Card(c, i){
  const k = c.key(), v = betsBoard[k] || 0, [b, sl] = t3Bet(k);
  const art = c.ico ? t3Ico(c.ico) : `<div class="tc-drum" id="t3Drum"><span>${(t3Digit + 9) % 10}</span><b>${t3Digit}</b><span>${(t3Digit + 1) % 10}</span></div>`;
  const more = c.g === 2 ? Object.keys(betsBoard).filter(x => x.startsWith('digit:') && x !== k).map(x => x.split(':')[1]) : [];
  return `<div class="tcard${v ? ' on' : ''}${i === t3Idx ? ' cur' : ''}" data-i="${i}" style="--tc:${c.c}">${art}<b class="tc-name">${c.name()}</b>` +
    `<small class="tc-x">x${fmt(betMult(b, sl))}</small>${more.length ? `<small class="tc-more">${$t("ещё")}: ${more.join(' · ')}</small>` : ''}${v ? `<em class="tc-chip">${fmt(v)}</em>` : ''}</div>`;
}
function t3Render(){
  if (!isT3()) return; const deck = $('t3Deck'), x = deck.scrollLeft;
  deck.innerHTML = T3C.map(t3Card).join(''); deck.scrollLeft = x;
  $('t3Max').innerHTML = betsTotal() ? '' : $t("Листай карты · ставка — кнопками внизу");   // «до скольки даст» — в плашке ставки
  t3Head();
}
// перемотать колоду к карте n (smooth — плавно)
function t3Go(n, smooth){ const deck = $('t3Deck'), c = deck.children[n]; if (!c) return; t3Idx = n;
  deck.scrollTo({ left: c.offsetLeft + c.offsetWidth / 2 - deck.clientWidth / 2, behavior: smooth ? 'smooth' : 'auto' }); t3Cur(); t3Head(); }
// карта по центру — крупнее и ярче, соседние выглядывают по краям
function t3Cur(){ const deck = $('t3Deck'), mid = deck.scrollLeft + deck.clientWidth / 2; let best = 0, bd = 1e9;
  [...deck.children].forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < bd){ bd = d; best = i; } });
  [...deck.children].forEach((c, i) => c.classList.toggle('cur', i === best)); return best; }
{ const deck = $('t3Deck'); let raf = 0;
  deck.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const n = t3Cur(); if (n !== t3Idx){ t3Idx = n; Sfx.swipe(); selHaptic(); t3Head(); } }); }, { passive: true }); }
// ставка на карту по центру: + номинал; лимиты — до 12 ставок, общая ставка и выигрыш за раунд
function t3Add(add){
  const k = t3Key(), next = Math.round(((betsBoard[k] || 0) + add) * 100) / 100;
  if (!betsBoard[k] && betsList().length >= BETS_MAX_N){ haptic('rigid'); notify({ type: 'warn', icon: 'coin', title: $t("Максимум {0} ставок за раунд", BETS_MAX_N), text: $t("Убери ставку с другой карты — корзиной") }); return; }
  if (betsTotal() + add > BET_MAX + 1e-9){ haptic('rigid'); notify({ type: 'warn', icon: 'coin', title: $t("Максимальная ставка {0} GRAM", BET_MAX), text: $t("За раунд, на все карты вместе") }); return; }
  if (betsMaxWin({ ...betsBoard, [k]: next }) > BETS_MAX_WIN){ haptic('rigid'); notify({ type: 'warn', icon: 'coin', title: $t("Выигрыш за раунд — до {0} GRAM", BETS_MAX_WIN), text: $t("Уменьши ставку на редкую карту") }); return; }
  betsBoard[k] = next; betsChip = add; Sfx.coin(); haptic('light'); t3Render(); renderBet(true);
  const el = $('t3Deck').children[t3Idx]; el?.animate([{ scale: .94 }, { scale: 1.05, offset: .6 }, { scale: 1 }], { duration: 300, easing: 'cubic-bezier(.3,1.5,.5,1)' }); t3Burst(el);
}
// тап по соседней карте — подвинуть её в центр; по карте в центре — ещё ставка тем же номиналом (частое действие в один тап)
t3Board.addEventListener('click', e => { if (S.busy || t3Board.dataset.drag) return; const c = e.target.closest('.tcard'); if (!c) return;
  const n = +c.dataset.i; if (n !== t3Idx){ t3Go(n, true); return; } t3Add(betsChip || .5); });
// барабан цифры: тянешь вверх-вниз — цифра крутится, как на тикете
{ let y0 = null, d0 = 0;
  t3Board.addEventListener('pointerdown', e => { if (!e.target.closest('#t3Drum') || S.busy) return; y0 = e.clientY; d0 = t3Digit; e.target.closest('#t3Drum').setPointerCapture(e.pointerId); });
  t3Board.addEventListener('pointermove', e => { if (y0 == null) return; const st = Math.round((y0 - e.clientY) / 22), d = ((d0 + st) % 10 + 10) % 10;
    if (Math.abs(y0 - e.clientY) > 6) t3Board.dataset.drag = 1;
    if (d !== t3Digit){ t3Digit = d; Sfx.tick(.5); selHaptic(); const dr = $('t3Drum'); dr.innerHTML = `<span>${(d + 9) % 10}</span><b>${d}</b><span>${(d + 1) % 10}</span>`; t3Head(); } });
  const up = () => { if (y0 == null) return; y0 = null; if (t3Board.dataset.drag){ setTimeout(() => { delete t3Board.dataset.drag; }, 0); t3Render(); } };
  t3Board.addEventListener('pointerup', up); t3Board.addEventListener('pointercancel', up); }
// внизу: «+0.1 … +5» — ставка на карту по центру (как ставка в крафте); корзина — сначала ставку с карты по центру, потом все
document.querySelector('.chips').addEventListener('click', e => { if (!isT3()) return; const b = e.target.closest('[data-add], #trash'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault(); if (S.busy) return;
  if (b.id === 'trash'){ const k = t3Key(); if (betsBoard[k]) delete betsBoard[k]; else if (betsTotal()) betsBoard = {}; else return; haptic('medium'); Sfx.lock(); t3Render(); renderBet(true); return; }
  t3Add(+b.dataset.add); }, true);

// тап по наковальне / ставке: удар и раскрытие, как у крафта
const _craftClick3 = $('craft').onclick;
$('craft').onclick = () => isT3() ? t3Play() : _craftClick3();
async function t3Play(){
  if (S.busy) return; const amt = betsTotal(), fast = S.fast || S.lite;
  if (amt <= 0 && t3Last){ if (hamAnim) settle(); betsBoard = { ...t3Last }; t3Render(); renderBet(true); haptic(); return; }   // пусто — первый тап возвращает прошлые ставки
  if (amt <= 0){ if (hamAnim) settle(); haptic('rigid'); notify({ type: 'err', icon: 'coin', title: $t("Сначала сделай ставку"), text: $t("Листай карты и ставь кнопками внизу") });
    $('bet').animate([{ translate: '-6px 0' }, { translate: '6px 0' }, { translate: '0 0' }], { duration: 220, iterations: 2 }); return; }
  if (amt > S.balance){ if (hamAnim) settle(); haptic('rigid'); notify({ type: 'err', icon: 'coin', title: $t("Недостаточно GRAM"), text: $t("Пополни баланс — тапни по нему сверху") }); return; }
  S.busy = true; CRAFT.classList.add('busy'); setBalance(S.balance - amt); $('fxTop').style.visibility = 'hidden';
  const bets = betsList(), pr = API.bets(bets); pr.catch(() => {});
  if (fast){ Sfx.lock(); await strike(.8, REST + 10); await openFx(true); } else await bigStrike();
  let r = null; try { r = await pr; } catch(_){}
  if (!r){ setBalance(S.balance + amt); await closeFx(); CRAFT.classList.remove('busy'); S.busy = false; notify({ type: 'err', icon: 'coin', title: $t("Ставка не прошла"), text: $t("GRAM вернулись на баланс") }); return; }
  betsLast = { ...betsBoard }; t3Last = { ...betsBoard };
  // под барабаном — как на арене: сверху сумма ставок, ниже плитки ставок (карточки игроков арены: 3 в ряд, больше 6 ставок — карточки ниже)
  $('fxPvp').innerHTML = `<div class="pvp-bank"><small>${$t("Ставки")}</small><b><img src="assets/ton.svg" alt="">${fmt(amt)}</b></div><div class="pvp-avas bt-avas">` +
    r.bets.map(b => t3Tile(b, r.bets.length > 6)).join('') + `<span class="pvc pva empty${r.bets.length > 6 ? ' many' : ''}"></span>`.repeat((3 - r.bets.length % 3) % 3) + `</div>`;
  $('fx').classList.add('btspin');
  await reveal(r, fast);
}
// плитка ставки при раскрытии — карточка игрока арены: в кружке иконка карты, ниже название и сумма (после — выплата)
const t3Svg = (bet, sel) => `<svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">${t3IcoOf(bet, sel)}</svg>`;
const t3Tile = (b, many) => `<span class="pvc pva btt${many ? ' many' : ''}" style="--tc:${t3ColOf(b.bet, b.sel)}"><i class="tav">${t3Svg(b.bet, b.sel)}</i><b>${betShort(b.bet, b.sel)}</b><i class="pvd">${fmt(b.amount)}</i></span>`;
// итог — экран дропа крафта: выиграл — приз крупно (выигрыш от порога — NFT и сдача, «Продать» / «Забрать»), не сыграло — тусклый гем и «Вернуться».
// Под суммой — компактная полоска всех ставок раунда: значок карты, сыгравшие — зелёные с выплатой, остальные тусклые с −ставкой
const _betsAfter3 = betsAfter;
betsAfter = async r => {
  if (!isT3()) return _betsAfter3(r);
  await betsChipsReveal(r);
  const won = r.bets.filter(b => b.won), line = `${$t("ставка {0} GRAM", fmt(r.stake))} · ${won.length ? $t("сбылось {0} из {1}", won.length, r.bets.length) : $t("предсказание не сбылось")}`;
  $('fxPvp').innerHTML = '';
  await showDrop(r);
  $('fx').classList.toggle('lost', !(r.win > 0));
  if (r.nft) $('fxWin').insertAdjacentHTML('beforeend', `<span>${line}</span>`);
  else $('fxWin').innerHTML = `<b>${r.win > 0 ? '+' + fmt(r.win) : '0'} GRAM</b><span>${line}</span>`;
  let el = $('fxPl'); if (!el){ el = document.createElement('div'); el.className = 'fx-pl'; el.id = 'fxPl'; $('fxWin').after(el); }
  el.innerHTML = `<div class="t3strip">${r.bets.map(b => `<span class="${b.won ? 'w' : 'l'}" style="--tc:${t3ColOf(b.bet, b.sel)}"><i>${t3Svg(b.bet, b.sel)}</i><small>${b.won ? '+' + fmt(b.pay) : '−' + fmt(b.amount)}</small></span>`).join('')}</div>`;
  if (r.win > 0){
    $('fxTake').onclick = () => t3Finish(r, 'take'); if ($('fxSell')) $('fxSell').onclick = () => t3Finish(r, 'sell');
    $('fxShare').onclick = () => shareWin(r.nft ? $t("Выиграл {0} #{1} на ставках в Pawn", r.nft.nft.name, r.nft.num) : $t("Выиграл +{0} GRAM на ставках в Pawn", fmt(r.win)), r.nft);
  } else {
    $('pz')?.classList.add('t3lose');
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
