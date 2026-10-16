/* =========================================================
   СТАВКИ (tab3) — тоже копия главной, как Арена: класс mode-tab3 на body, тот же экран.
   Ранг — как в Арене: свайп по рангам сверху, ставка на него — кнопками «+0.1 … +5» внизу, как в крафте.
   На месте приза — поле: чёт/нечет и последняя цифра (тап — фишка последнего номинала, долгое нажатие — снять);
   корзина — сначала ставку на ранг, потом всё поле; в плашке — сумма ставок, над полем — до скольки GRAM
   даст самый удачный тикет. Ранги сверху и множитель — как на главной; тап по рангу на поле выбирает его и сверху.
   Тап по наковальне — удар и раскрытие тикета (как крафт), итог — по каждой ставке.
   Ядро ставок, лимиты, мок и доказательство — 16b-bets.js (домен "bets")
   ========================================================= */
const isT3 = () => document.body.classList.contains('mode-tab3');
let t3Tier = 2, t3Main = null, t3Gifts = null;   // свой ранг у таба; ранг крафта и его подарки — вернём при выходе
const t3Mult = i => betMult('rank', i);
const _setTier3 = setTier, _restartAuto3 = restartAuto, _showPrize3 = showPrize, _renderBet3 = renderBet;
setTier = (i, opts = {}) => { if (isT3()) t3MoveRank(i); _setTier3(i, opts); if (isT3()) t3Show(); };
// ставка на ранг одна — на выбранный сверху; сменил ранг свайпом — она переезжает на него
function t3MoveRank(i){ const v = TIERS.reduce((a, _, k) => a + (betsBoard['rank:' + k] || 0), 0); TIERS.forEach((_, k) => delete betsBoard['rank:' + k]); if (v) betsBoard['rank:' + i] = v; }
restartAuto = () => { if (isT3()){ clearInterval(auto); return; } _restartAuto3(); };
showPrize = dir => { if (!isT3()) _showPrize3(dir); };   // приза в ставках нет — на его месте поле
// плашка: сумма всех ставок на поле
renderBet = bump => { if (!isT3()) return _renderBet3(bump); const b = $('bet'), tot = betsTotal(); b.classList.remove('gifts');
  b.innerHTML = `<img src="assets/ton.svg" width="49" height="41.34" alt=""><b class="ton">${fmt(tot)}</b>`; if (bump) b.querySelector('.ton').classList.add('bump'); };
function t3Show(){ if (!isT3()) return; $('range').innerHTML = `<span class="xf">x${fmt(t3Mult(S.tier))}</span>`; t3Render(); }
function t3Enter(){
  t3Main = S.tier; t3Gifts = S.gifts; S.gifts = []; renderSlots(); $('giftCnt').hidden = true; clearInterval(auto);
  _setTier3(t3Tier); t3Show(); renderBet();
}
function t3Leave(){ t3Tier = S.tier; if (t3Gifts){ S.gifts = t3Gifts.filter(g => INV.includes(g)); t3Gifts = null; }
  document.querySelectorAll('.chips [data-add]').forEach(b => b.classList.remove('on')); renderBet(); setTier(t3Main ?? S.tier); restartAuto(); }

// поле ставок на месте приза
const t3Board = (() => { const el = document.createElement('div'); el.className = 'abs t3b'; el.id = 't3Board'; $('bet').parentNode.insertBefore(el, $('prize')); return el; })();
function t3Render(){
  if (!isT3()) return; const tot = betsTotal();
  t3Board.innerHTML = `<div class="t3max">${tot ? `${$t("Даст до")} <b><img src="assets/gem-balance.svg" alt="">${fmt(betsMaxWin())}</b>` : $t("Ставка на ранг — кнопками внизу, на чёт и цифру — тапом по полю")}</div>` +
    `<div class="bt-row r2">${cellHTML('parity', 0)}${cellHTML('parity', 1)}</div>` +
    `<div class="bt-row r10 dg">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => cellHTML('digit', d)).join('')}</div>` +
    `<div class="t3leg"><span>${$t("Чёт / нечет")} x${fmt(betMult('parity', 0))}</span><span>${$t("Последняя цифра")} x${fmt(betMult('digit', 0))}</span></div>`;
  document.querySelectorAll('.chips [data-add]').forEach(b => b.classList.toggle('on', +b.dataset.add === betsChip));
}
// фишка на исход — те же лимиты, что у ставок: выигрыш за раунд и общая ставка
function t3Add(k){
  const next = Math.round(((betsBoard[k] || 0) + betsChip) * 100) / 100;
  if (betsMaxWin({ ...betsBoard, [k]: next }) > BETS_MAX_WIN){ haptic('rigid'); notify({ type: 'warn', icon: 'coin', title: $t("Выигрыш за раунд — до {0} GRAM", BETS_MAX_WIN), text: $t("Возьми фишку меньше или другой исход") }); return; }
  if (betsTotal() + betsChip > BET_MAX + 1e-9){ haptic('rigid'); notify({ type: 'warn', icon: 'coin', title: $t("Максимальная ставка {0} GRAM", BET_MAX), text: $t("За один раунд, на все исходы вместе") }); return; }
  betsBoard[k] = next; Sfx.coin(); haptic('light'); t3Render(); renderBet(true);
  t3Board.querySelector(`[data-k="${k}"]`)?.animate([{ scale: .9 }, { scale: 1.06, offset: .6 }, { scale: 1 }], { duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)' });
}
{ let lp = 0, long = false;
  t3Board.addEventListener('pointerdown', e => { const c = e.target.closest('.bt-cell'); if (!c || S.busy) return; long = false;
    lp = setTimeout(() => { long = true; if (betsBoard[c.dataset.k]){ delete betsBoard[c.dataset.k]; haptic('medium'); Sfx.lock(); t3Render(); renderBet(true); } }, 450); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => t3Board.addEventListener(ev, () => clearTimeout(lp)));
  t3Board.addEventListener('click', e => { const c = e.target.closest('.bt-cell'); if (!c || long || S.busy) return;
    t3Add(c.dataset.k); });
}
// внизу: «+0.1 … +5» — номинал фишки, корзина — очистить поле
document.querySelector('.chips').addEventListener('click', e => { if (!isT3()) return; const b = e.target.closest('[data-add], #trash'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault(); if (S.busy) return;
  if (b.id === 'trash'){ const rk = 'rank:' + S.tier; if (betsBoard[rk]) delete betsBoard[rk]; else if (betsTotal()) betsBoard = {}; else return; haptic('medium'); Sfx.lock(); }
  else { betsChip = +b.dataset.add; t3Add('rank:' + S.tier); return; }
  t3Render(); renderBet(true); }, true);

// тап по наковальне / ставке: удар и раскрытие, как у крафта
const _craftClick3 = $('craft').onclick;
$('craft').onclick = () => isT3() ? t3Play() : _craftClick3();
async function t3Play(){
  if (S.busy) return; const amt = betsTotal(), fast = S.fast || S.lite;
  if (amt <= 0 && betsLast){ if (hamAnim) settle(); betsBoard = { ...betsLast }; t3Render(); renderBet(true); haptic(); return; }   // пустое поле — первый тап возвращает прошлые ставки
  if (amt <= 0){ if (hamAnim) settle(); haptic('rigid'); notify({ type: 'err', icon: 'coin', title: $t("Сначала сделай ставку"), text: $t("Кнопками внизу — на ранг, тапом по полю — на чёт и цифру") });
    $('bet').animate([{ translate: '-6px 0' }, { translate: '6px 0' }, { translate: '0 0' }], { duration: 220, iterations: 2 }); return; }
  if (amt > S.balance){ if (hamAnim) settle(); haptic('rigid'); notify({ type: 'err', icon: 'coin', title: $t("Недостаточно GRAM"), text: $t("Пополни баланс — тапни по нему сверху") }); return; }
  S.busy = true; CRAFT.classList.add('busy'); setBalance(S.balance - amt); $('fxTop').style.visibility = 'hidden';
  const bets = betsList(), pr = API.bets(bets); pr.catch(() => {});
  if (fast){ Sfx.lock(); await strike(.8, REST + 10); await openFx(true); } else await bigStrike();
  let r = null; try { r = await pr; } catch(_){}
  if (!r){ setBalance(S.balance + amt); await closeFx(); CRAFT.classList.remove('busy'); S.busy = false; notify({ type: 'err', icon: 'coin', title: $t("Ставка не прошла"), text: $t("GRAM вернулись на баланс") }); return; }
  betsLast = { ...betsBoard };
  // под барабаном — сумма ставок и сами ставки
  $('fxPvp').innerHTML = `<div class="pvp-bank"><small>${$t("Ставки")}</small><b><img src="assets/ton.svg" alt="">${fmt(amt)}</b></div><div class="pvp-chips">` +
    r.bets.map(b => `<span class="pvc bt" style="--tc:${b.bet === 'rank' ? TIERS[b.sel].c : '#b9a6ff'}"><b>${betLabel(b.bet, b.sel)}</b><em>${fmt(b.amount)} · x${fmt(betMult(b.bet, b.sel))}</em><i class="pvd"></i></span>`).join('') + `</div>`;
  $('fx').classList.add('btspin');
  await reveal(r, fast);
}
// итог — как у крафта: одна кнопка «Забрать», под ней «Проверить честность · Поделиться»; поле остаётся — «ещё раз» в один тап
const _betsAfter3 = betsAfter;
betsAfter = async r => {
  await _betsAfter3(r); if (!isT3()) return;
  $('fxBtns').innerHTML = `<button class="btn-main" id="btT3">${$t("Забрать")}</button>` + PF_LINK;
  $('fxPfIn').onclick = () => openPF(r);
  $('fxShare').onclick = () => shareWin($t("Поставил на тикет в Pawn"));
  $('btT3').onclick = async () => { haptic(); await closeFx(); $('fx').classList.remove('btspin'); CRAFT.classList.remove('busy'); S.busy = false; t3Render(); renderBet(); };
};
// кнопка подарков в ставках — правила (щит, как в Арене)
$('giftBtn').addEventListener('click', e => { if (!isT3()) return; e.stopImmediatePropagation(); betsRulesModal(); }, true);
