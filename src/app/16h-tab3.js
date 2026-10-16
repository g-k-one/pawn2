/* =========================================================
   СТАВКИ (tab3) — копия главной, как Арена: класс mode-tab3 на body, тот же экран.
   Колода таро на месте приза: свайп — листать карты (как приз в крафте), тап — поставить на исход / снять.
   Карты: Ранг (тот, что выбран свайпом сверху), Солнце и Луна (чёт / нечет), Цифра (последняя, внутри — барабан),
   Звезда семи (есть 7), Пентаграмма (все разные), Близнецы (пара), Весы (зеркало).
   Сумма — кнопками «+0.1 … +5», как в крафте: одна на каждую выбранную карту; корзина — сначала сумму, потом карты.
   В плашке — сумма × число карт. До 12 ставок за раунд. Фон — круг зодиака с глазом, медленно вращается (только поворот слоя).
   Тап по наковальне — удар и раскрытие тикета (как крафт). Ядро ставок, лимиты, мок и доказательство — 16b-bets.js (домен "bets")
   ========================================================= */
const isT3 = () => document.body.classList.contains('mode-tab3');
let t3Tier = 2, t3Main = null, t3Gifts = null;   // свой ранг у таба; ранг крафта и его подарки — вернём при выходе
let t3Stake = 0, t3Digit = 7, t3Last = null; const t3Sel = new Set();   // сумма на карту, цифра на барабане, выбранные исходы ('parity:1', 'digit:7'…)
const t3Mult = i => betMult('rank', i);
// поле ставок для ядра (16b): каждая выбранная карта — на одну и ту же сумму
function t3Sync(){ betsBoard = {}; if (t3Stake > 0) for (const k of t3Sel) betsBoard[k] = t3Stake; }
const _setTier3 = setTier, _restartAuto3 = restartAuto, _showPrize3 = showPrize, _renderBet3 = renderBet;
setTier = (i, opts = {}) => { _setTier3(i, opts); if (isT3()) t3Show(); };
restartAuto = () => { if (isT3()){ clearInterval(auto); return; } _restartAuto3(); };
showPrize = dir => { if (!isT3()) _showPrize3(dir); };   // приза в ставках нет — на его месте колода
// плашка: сумма на карту, справа — сколько карт (×3)
renderBet = bump => { if (!isT3()) return _renderBet3(bump); const b = $('bet'); b.classList.remove('gifts');
  b.innerHTML = `<img src="assets/ton.svg" width="49" height="41.34" alt=""><b class="ton">${fmt(t3Stake)}</b>${t3Sel.size > 1 ? `<span class="t3n">×${t3Sel.size}</span>` : ''}`;
  if (bump) b.querySelector('.ton').classList.add('bump'); };
function t3Show(){ if (!isT3()) return; $('range').innerHTML = `<span class="xf">x${fmt(t3Mult(S.tier))}</span>`; t3Render(); }
function t3Enter(){
  t3Main = S.tier; t3Gifts = S.gifts; S.gifts = []; renderSlots(); $('giftCnt').hidden = true; clearInterval(auto);
  _setTier3(t3Tier); t3Show(); renderBet(); requestAnimationFrame(t3Center);
}
function t3Leave(){ t3Tier = S.tier; if (t3Gifts){ S.gifts = t3Gifts.filter(g => INV.includes(g)); t3Gifts = null; }
  renderBet(); setTier(t3Main ?? S.tier); restartAuto(); }

/* ---------- рисунки карт: тонкие золотые линии, как гравюра таро ---------- */
const TC_ART = {
  rank: '<path d="M50 14l7 25 25-7-18 18 18 18-25-7-7 25-7-25-25 7 18-18-18-18 25 7z"/><circle cx="50" cy="50" r="9"/>',
  sun: '<circle cx="50" cy="50" r="15"/>' + Array.from({ length: 12 }, (_, i) => { const a = i * 30 * Math.PI / 180; return `<path d="M${(50 + Math.cos(a) * 21).toFixed(1)} ${(50 + Math.sin(a) * 21).toFixed(1)}L${(50 + Math.cos(a) * (i % 2 ? 28 : 33)).toFixed(1)} ${(50 + Math.sin(a) * (i % 2 ? 28 : 33)).toFixed(1)}"/>`; }).join(''),
  moon: '<path d="M60 22a28 28 0 1 0 0 56a22 22 0 1 1 0-56z"/><circle cx="72" cy="30" r="1.6"/><circle cx="78" cy="46" r="1.2"/>',
  has7: '<path d="M50 18l28 50H22z"/><path d="M42 40h16l-9 20"/><circle cx="50" cy="12" r="1.6"/><circle cx="24" cy="76" r="1.4"/><circle cx="76" cy="76" r="1.4"/>',
  diff: '<path d="M50 16l10 31h32l-26 19 10 31-26-19-26 19 10-31-26-19h32z"/><circle cx="50" cy="56" r="30"/>',
  pair: '<path d="M30 22c14 6 26 6 40 0M30 78c14-6 26-6 40 0M38 26v48M62 26v48"/>',
  mirror: '<path d="M50 20v58M28 34h44M28 34l-10 22h20zM72 34l-10 22h20zM36 80h28"/><circle cx="50" cy="18" r="3"/>',
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const t3Art = k => `<svg class="tc-art" viewBox="0 0 100 100" aria-hidden="true">${TC_ART[k]}</svg>`;
const t3Pct = (bet, sel) => { const c = (RULES_C ||= betsRules()).table.find(x => x.bet === bet && x.sel === sel).count; return fmt(Math.round(c / TICKETS * 10000) / 100) + '%'; };
const t3Chip = k => t3Sel.has(k) && t3Stake ? `<em class="tc-chip">${fmt(t3Stake)}</em>` : '';
function t3Cards(){
  const r = S.tier, rk = 'rank:' + r, dk = 'digit:' + t3Digit;
  const card = (n, k, art, name, bet, sel, extra = '') => `<div class="tcard${t3Sel.has(k) ? ' on' : ''}" data-k="${k}" style="--tc:${bet === 'rank' ? TIERS[sel].c : '#e8c46a'}"><i class="tc-num">${ROMAN[n]}</i>${art}<b class="tc-name">${name}</b><small class="tc-x">x${fmt(betMult(bet, sel))} · ${t3Pct(bet, sel)}</small>${extra}${t3Chip(k)}</div>`;
  const half = (i, art, name) => { const k = 'parity:' + i; return `<div class="tc-half${t3Sel.has(k) ? ' on' : ''}" data-k="${k}">${art}<b class="tc-name">${name}</b>${t3Chip(k)}</div>`; };
  const digs = [...t3Sel].filter(k => k.startsWith('digit:') && k !== dk).map(k => k.split(':')[1]);
  return card(0, rk, t3Art('rank'), TIERS[r].name, 'rank', r, [...t3Sel].some(k => k.startsWith('rank:') && k !== rk) ? `<small class="tc-more">${$t("ещё ранги")}: ${[...t3Sel].filter(k => k.startsWith('rank:') && k !== rk).length}</small>` : '') +
    `<div class="tcard duo" style="--tc:#e8c46a"><i class="tc-num">${ROMAN[1]}</i>${half(0, t3Art('sun'), $t("Солнце · чёт"))}${half(1, t3Art('moon'), $t("Луна · нечет"))}<small class="tc-x">x${fmt(betMult('parity', 0))} · 50%</small></div>` +
    `<div class="tcard dig${t3Sel.has(dk) ? ' on' : ''}" data-k="${dk}" style="--tc:#e8c46a"><i class="tc-num">${ROMAN[2]}</i>` +
      `<div class="tc-drum" id="t3Drum"><span>${(t3Digit + 9) % 10}</span><b>${t3Digit}</b><span>${(t3Digit + 1) % 10}</span></div>` +
      `<b class="tc-name">${$t("Последняя цифра")}</b><small class="tc-x">x${fmt(betMult('digit', 0))} · 10%</small>${digs.length ? `<small class="tc-more">${$t("ещё")}: ${digs.join(' · ')}</small>` : ''}${t3Chip(dk)}</div>` +
    BET_PATS.map((k, i) => card(3 + i, k + ':0', t3Art(k), betLabel(k, 0), k, 0)).join('');
}
const EYE_SVG = '<svg viewBox="0 0 400 400"><path d="M140 200q60-52 120 0q-60 52-120 0z"/><circle cx="200" cy="200" r="20"/><circle cx="200" cy="200" r="8" class="zs"/><path d="M200 120v18M200 262v18M120 200h-16M280 200h16"/></svg>';
// лёгкая магия: золотые искорки вокруг колоды мерцают и чуть всплывают — только прозрачность и сдвиг (видеокарта); в экономном режиме — нет
const SPARK = '<svg viewBox="0 0 20 20"><path d="M10 0c1 6 4 9 10 10c-6 1-9 4-10 10c-1-6-4-9-10-10c6-1 9-4 10-10z"/></svg>';
const T3_SPARKS = Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2 + .3, r = 120 + (i * 37 % 60);
  return `<i style="left:calc(50% + ${(Math.cos(a) * r * 1.25).toFixed(0)}px);top:calc(50% + ${(Math.sin(a) * r * .8).toFixed(0)}px);--s:${(.5 + (i * 7 % 10) / 14).toFixed(2)};animation-duration:${(3 + i % 4).toFixed(1)}s;animation-delay:-${(i * .7).toFixed(1)}s">${SPARK}</i>`; }).join('');
// фишка на карту — короткая вспышка искр из центра карты
function t3Burst(el){ if (S.lite || !el) return; const r = el.getBoundingClientRect(), box = t3Board.getBoundingClientRect();
  for (let i = 0; i < 8; i++){ const sp = document.createElement('i'); sp.className = 't3b-sp'; sp.innerHTML = SPARK; t3Board.appendChild(sp);
    const a = i / 8 * Math.PI * 2 + Math.random() * .5, d = 60 + Math.random() * 40;
    sp.style.left = (r.left + r.width / 2 - box.left) / K + 'px'; sp.style.top = (r.top + r.height / 2 - box.top) / K + 'px';
    sp.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px),calc(-50% + ${Math.sin(a) * d}px)) scale(1) rotate(90deg)`, opacity: 0 }],
      { duration: 600 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => sp.remove(); } }
const t3Board = (() => { const el = document.createElement('div'); el.className = 'abs t3b'; el.id = 't3Board';
  // круг зодиака крутится целиком отдельным слоем (видеокарта), глаз — свой слой поверх и стоит на месте
  el.innerHTML = `<div class="t3zod" aria-hidden="true">${ZODIAC_SVG()}</div><div class="t3eye" aria-hidden="true">${EYE_SVG}</div><div class="t3spk" aria-hidden="true">${T3_SPARKS}</div><div class="t3deck" id="t3Deck"></div>`; $('bet').parentNode.insertBefore(el, $('prize')); return el; })();
function ZODIAC_SVG(){
  // круг зодиака: 12 знаков (текстовые символы, не эмодзи), деления, звёзды; в центре — глаз
  const g = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'].map((z, i) => { const a = (i * 30 - 75) * Math.PI / 180;
    return `<text x="${(200 + Math.cos(a) * 160).toFixed(1)}" y="${(200 + Math.sin(a) * 160 + 7).toFixed(1)}">${z}&#xFE0E;</text><path d="M${(200 + Math.cos(a - .26) * 140).toFixed(1)} ${(200 + Math.sin(a - .26) * 140).toFixed(1)}L${(200 + Math.cos(a - .26) * 182).toFixed(1)} ${(200 + Math.sin(a - .26) * 182).toFixed(1)}"/>`; }).join('');
  const st = Array.from({ length: 24 }, (_, i) => { const a = i * 15 * Math.PI / 180, r = i % 2 ? 122 : 196; return `<circle class="zs" cx="${(200 + Math.cos(a) * r).toFixed(1)}" cy="${(200 + Math.sin(a) * r).toFixed(1)}" r="${i % 3 ? 1.2 : 2}"/>`; }).join('');
  return `<svg viewBox="0 0 400 400"><circle cx="200" cy="200" r="182"/><circle cx="200" cy="200" r="140"/><circle cx="200" cy="200" r="190" stroke-dasharray="2 6"/>${g}${st}</svg>`;
}
function t3Render(){
  if (!isT3()) return; const deck = $('t3Deck'), x = deck.scrollLeft;
  deck.innerHTML = t3Cards(); deck.scrollLeft = x; t3Cur();
}
// карта по центру — крупнее и ярче, соседние выглядывают по краям
function t3Cur(){ const deck = $('t3Deck'), mid = deck.scrollLeft + deck.clientWidth / 2;
  deck.querySelectorAll('.tcard').forEach(c => c.classList.toggle('cur', Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) < c.offsetWidth / 2)); }
function t3Center(){ const deck = $('t3Deck'), c = deck.querySelector('.tcard.dig'); if (c && !deck.dataset.init){ deck.dataset.init = 1; deck.scrollLeft = 0; } t3Cur(); }
{ const deck = $('t3Deck'); let raf = 0, lastCur = null;
  deck.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; t3Cur(); const c = deck.querySelector('.tcard.cur'); if (c && c !== lastCur){ lastCur = c; Sfx.swipe(); selHaptic(); } }); }, { passive: true }); }
// тап по карте (или половине Солнце/Луна) — поставить / снять; лимиты те же, что у ставок: до 12 карт, ставка и выигрыш за раунд
function t3Toggle(k){
  if (t3Sel.has(k)){ t3Sel.delete(k); haptic('medium'); Sfx.lock(); t3Sync(); t3Render(); renderBet(true); return; }
  if (t3Sel.size >= BETS_MAX_N){ haptic('rigid'); notify({ type: 'warn', icon: 'coin', title: $t("Максимум {0} ставок за раунд", BETS_MAX_N), text: $t("Сними одну из карт — повторный тап") }); return; }
  if (!t3Fits(t3Stake, t3Sel.size + 1, k)) return;
  t3Sel.add(k); t3Sync(); Sfx.coin(); haptic('light'); t3Render(); renderBet(true);
  const el = t3Board.querySelector(`[data-k="${k}"]`); el?.animate([{ scale: .92 }, { scale: 1.05, offset: .6 }, { scale: 1 }], { duration: 300, easing: 'cubic-bezier(.3,1.5,.5,1)' }); t3Burst(el);
}
// проверка лимитов для суммы v на n карт (k — добавляемая карта)
function t3Fits(v, n, k){
  if (v * n > BET_MAX + 1e-9){ haptic('rigid'); notify({ type: 'warn', icon: 'coin', title: $t("Максимальная ставка {0} GRAM", BET_MAX), text: $t("За раунд, на все карты вместе") }); return false; }
  const b = {}; for (const x of t3Sel) b[x] = v; if (k) b[k] = v;
  if (v > 0 && betsMaxWin(b) > BETS_MAX_WIN){ haptic('rigid'); notify({ type: 'warn', icon: 'coin', title: $t("Выигрыш за раунд — до {0} GRAM", BETS_MAX_WIN), text: $t("Уменьши сумму или сними редкую карту") }); return false; }
  return true;
}
t3Board.addEventListener('click', e => { if (S.busy || t3Board.dataset.drag) return; const c = e.target.closest('.tc-half, .tcard[data-k]'); if (!c) return;
  if (!c.classList.contains('cur') && !c.closest('.tcard.cur')){ c.closest('.tcard').scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); return; }   // тап по соседней карте — сначала подвинуть её в центр
  t3Toggle(c.dataset.k); });
// барабан цифры: тянешь вверх-вниз — цифра крутится, как на тикете
{ let y0 = null, d0 = 0;
  t3Board.addEventListener('pointerdown', e => { if (!e.target.closest('#t3Drum') || S.busy) return; y0 = e.clientY; d0 = t3Digit; e.target.closest('#t3Drum').setPointerCapture(e.pointerId); });
  t3Board.addEventListener('pointermove', e => { if (y0 == null) return; const st = Math.round((y0 - e.clientY) / 22), d = ((d0 + st) % 10 + 10) % 10;
    if (Math.abs(y0 - e.clientY) > 6) t3Board.dataset.drag = 1;
    if (d !== t3Digit){ t3Digit = d; Sfx.tick(.5); selHaptic(); const dr = $('t3Drum'); dr.innerHTML = `<span>${(d + 9) % 10}</span><b>${d}</b><span>${(d + 1) % 10}</span>`;
      const c = dr.closest('.tcard'), k = 'digit:' + d; c.dataset.k = k; c.classList.toggle('on', t3Sel.has(k)); c.querySelector('.tc-chip')?.remove(); if (t3Sel.has(k) && t3Stake) c.insertAdjacentHTML('beforeend', `<em class="tc-chip">${fmt(t3Stake)}</em>`); } });
  const up = () => { if (y0 == null) return; y0 = null; if (t3Board.dataset.drag){ setTimeout(() => { delete t3Board.dataset.drag; }, 0); t3Render(); } };
  t3Board.addEventListener('pointerup', up); t3Board.addEventListener('pointercancel', up); }
// внизу: «+0.1 … +5» — прибавляют сумму на карту (как ставку в крафте); корзина — сначала сумму, потом карты
document.querySelector('.chips').addEventListener('click', e => { if (!isT3()) return; const b = e.target.closest('[data-add], #trash'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault(); if (S.busy) return;
  if (b.id === 'trash'){ if (t3Stake) t3Stake = 0; else if (t3Sel.size) t3Sel.clear(); else return; haptic('medium'); Sfx.lock(); }
  else { const v = Math.round((t3Stake + +b.dataset.add) * 100) / 100; if (!t3Fits(v, Math.max(1, t3Sel.size))) return; t3Stake = v; Sfx.coin(); haptic('light'); }
  t3Sync(); t3Render(); renderBet(true); }, true);

// тап по наковальне / ставке: удар и раскрытие, как у крафта
const _craftClick3 = $('craft').onclick;
$('craft').onclick = () => isT3() ? t3Play() : _craftClick3();
async function t3Play(){
  if (S.busy) return; const amt = betsTotal(), fast = S.fast || S.lite;
  if (!t3Sel.size && !t3Stake && t3Last){ if (hamAnim) settle(); t3Last.sel.forEach(k => t3Sel.add(k)); t3Stake = t3Last.stake; t3Sync(); t3Render(); renderBet(true); haptic(); return; }   // пусто — первый тап возвращает прошлые ставки
  if (!t3Sel.size){ if (hamAnim) settle(); haptic('rigid'); notify({ type: 'err', icon: 'coin', title: $t("Выбери карту"), text: $t("Листай колоду и тапни по исходу") }); return; }
  if (amt <= 0){ if (hamAnim) settle(); haptic('rigid'); notify({ type: 'err', icon: 'coin', title: $t("Сначала сделай ставку"), text: $t("Кнопками внизу — сумма на каждую карту") });
    $('bet').animate([{ translate: '-6px 0' }, { translate: '6px 0' }, { translate: '0 0' }], { duration: 220, iterations: 2 }); return; }
  if (amt > S.balance){ if (hamAnim) settle(); haptic('rigid'); notify({ type: 'err', icon: 'coin', title: $t("Недостаточно GRAM"), text: $t("Пополни баланс — тапни по нему сверху") }); return; }
  S.busy = true; CRAFT.classList.add('busy'); setBalance(S.balance - amt); $('fxTop').style.visibility = 'hidden';
  const bets = betsList(), pr = API.bets(bets); pr.catch(() => {});
  if (fast){ Sfx.lock(); await strike(.8, REST + 10); await openFx(true); } else await bigStrike();
  let r = null; try { r = await pr; } catch(_){}
  if (!r){ setBalance(S.balance + amt); await closeFx(); CRAFT.classList.remove('busy'); S.busy = false; notify({ type: 'err', icon: 'coin', title: $t("Ставка не прошла"), text: $t("GRAM вернулись на баланс") }); return; }
  betsLast = { ...betsBoard }; t3Last = { sel: [...t3Sel], stake: t3Stake };
  // под барабаном — как на арене: сверху сумма ставок, ниже плитки ставок (карточки игроков арены: 3 в ряд, больше 6 ставок — карточки ниже)
  $('fxPvp').innerHTML = `<div class="pvp-bank"><small>${$t("Ставки")}</small><b><img src="assets/ton.svg" alt="">${fmt(amt)}</b></div><div class="pvp-avas bt-avas">` +
    r.bets.map(b => betTile(b, r.bets.length > 6)).join('') + `<span class="pvc pva empty${r.bets.length > 6 ? ' many' : ''}"></span>`.repeat((3 - r.bets.length % 3) % 3) + `</div>`;
  $('fx').classList.add('btspin');
  await reveal(r, fast);
}
// итог — как у арены: выиграл — приз крупно (экран дропа крафта: NFT — «Продать» / «Забрать», GRAM — «Забрать»), под суммой — ставка и сколько сбылось;
// не сыграло ничего — карточка «Ставки» с теми же плитками и «Вернуться». Начисление — по кнопке; поле остаётся с теми же ставками
const _betsAfter3 = betsAfter;
betsAfter = async r => {
  if (!isT3()) return _betsAfter3(r);
  await betsChipsReveal(r);
  const won = r.bets.filter(b => b.won), line = `${$t("ставка {0} GRAM", fmt(r.stake))} · ${won.length ? $t("сбылось {0} из {1}", won.length, r.bets.length) : $t("предсказание не сбылось")}`;
  if (r.win > 0){
    $('fxPvp').innerHTML = '';
    await showDrop(r);
    if (!r.nft) $('fxWin').innerHTML = `<b>+${fmt(r.win)} GRAM</b><span>${line}</span>`;
    else $('fxWin').insertAdjacentHTML('beforeend', `<span>${line}</span>`);
    $('fxTake').onclick = () => t3Finish(r, 'take'); if ($('fxSell')) $('fxSell').onclick = () => t3Finish(r, 'sell');
    $('fxShare').onclick = () => shareWin(r.nft ? $t("Выиграл {0} #{1} на ставках в Pawn", r.nft.nft.name, r.nft.num) : $t("Выиграл +{0} GRAM на ставках в Pawn", fmt(r.win)), r.nft);
  } else {
    const tiles = $('fxPvp').querySelector('.bt-avas')?.outerHTML || ''; $('fxPvp').innerHTML = '';
    $('fxDrop').innerHTML = ''; $('fxWin').innerHTML = '';
    let el = $('fxPl'); if (!el){ el = document.createElement('div'); el.className = 'fx-pl'; el.id = 'fxPl'; $('fxWin').after(el); }
    el.innerHTML = `<div class="sect pvls"><div class="sect-h"><span><b>${$t("Ставки")}</b><small>${line}</small></span></div>${tiles}</div>`;
    $('fx').classList.add('pvpl', 'done'); setTimeout(() => { FX.hot = false; }, 900);
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
