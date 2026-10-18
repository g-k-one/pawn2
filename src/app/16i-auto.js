/* =========================================================
   АВТОКРАФТ (как автоспин в слотах) — серия крафтов или раундов Ставок одной кнопкой, только со стоп-условиями
   Кнопка «Авто» рядом с наковальней (на Арене её нет). Перед стартом — шторка: сколько, стоп по проигрышу / выигрышу,
   стоп на крупном множителе, что делать с NFT. Без «удвоить ставку после проигрыша» — это против «честно».
   Каждый крафт — обычный крафт со своим доказательством; раскрытие короткое (число и ранг над наковальней), сверху — счётчик
   и «Стоп». Свернул приложение — пауза. Выпал NFT и выбрано «остановиться» — серия встаёт, дальше обычный экран выигрыша.
   В конце — итог серии. Только GRAM: подарки в ставке автокрафт не трогает
   ========================================================= */
const AC_N = [10, 25, 50, 100, 0], AC_LOSS = [0, 5, 10, 25, 50], AC_WIN = [0, 5, 10, 25, 50], AC_MULT = [0, 2, 3.5, 10];
const acCfg = (() => { try { return { n: 25, loss: 10, win: 0, mult: 10, nft: 'stop', ...JSON.parse(localStorage.getItem('bm-auto') || '{}') }; } catch(_){ return { n: 25, loss: 10, win: 0, mult: 10, nft: 'stop' }; } })();
let acRun = null;   // идущая серия: { n, done, staked, won, best, stop }
const acBets = () => typeof isT3 === 'function' && isT3();
const acStake = () => acBets() ? betsTotal() : S.ton;

// иконка — в меню («Игра», под «Быстрым крафтом»)
const AC_ICO = '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4"/>';
// можно ли запускать: на Арене нет, подарки не трогаем, нужна ставка
function acReady(){
  if (S.busy || acRun) return false;
  if (typeof isT2 === 'function' && isT2()){ haptic('rigid'); notify({ type: 'warn', icon: 'info', title: $t("Автокрафт — в Крафте и Ставках"), text: $t("На Арене общий таймер и соперники") }); return false; }
  if (S.demo && acBets()) return false;
  if (!acBets() && S.gifts.length){ haptic('rigid'); notify({ type: 'warn', icon: 'gift', title: $t("Автокрафт — только на GRAM"), text: $t("Убери подарки из ставки") }); return false; }
  if (acStake() <= 0){ haptic('rigid'); notify({ type: 'err', icon: 'coin', title: $t("Сначала сделай ставку"), text: acBets() ? $t("Выбери ячейку — ставь кнопками внизу") : $t("Добавь GRAM кнопками внизу") }); return false; }
  return true;
}
function acOpen(){ if (!acReady()) return; acRender(); if (openDrawer !== $('acDrawer')) showDrawer('acDrawer'); }
// шторка настроек
function acRender(){
  const st = acStake(), mode = acBets() ? $t("раундов Ставок") : $t("крафтов");
  const chip = (k, v, label, c) => `<button class="dbg-c${acCfg[k] === v ? ' on' : ''}" data-ac="${k}" data-v="${v}" style="--c:${c || '#fff'}">${label}</button>`;
  const g = n => n ? fmt(n) + ' GRAM' : $t("нет");
  $('acDrawer').classList.remove('ac-done'); $('acTitle').textContent = acBets() ? $t("Автоставки") : $t("Автокрафт");
  $('acBody').innerHTML =
    // заметная карточка, как предупреждения кошелька: что и сколько ставится + «играй ответственно»
    `<div class="wwarn ac-sum"><i>!</i><span><b>${$t("Ставка {0} GRAM за раз", fmt(st))}</b><small>${acBets() ? $t("та же раскладка фишек каждый раунд") : $t("каждый крафт — со своим доказательством честности")}. ${$t("Играй ответственно — задай стоп по проигрышу.")}</small></span></div>` +
    `<div class="dbg-l">${$t("Сколько")} ${mode}</div><div class="dbg-g">${AC_N.map(n => chip('n', n, n || '∞')).join('')}</div>` +
    `<div class="dbg-l">${$t("Стоп, если проиграл")}</div><div class="dbg-g">${AC_LOSS.map(n => chip('loss', n, g(n), n ? '#FF8A3C' : '')).join('')}</div>` +
    `<div class="dbg-l">${$t("Стоп, если выиграл")}</div><div class="dbg-g">${AC_WIN.map(n => chip('win', n, g(n), n ? '#12D53D' : '')).join('')}</div>` +
    `<div class="dbg-l">${$t("Стоп на множителе от")}</div><div class="dbg-g">${AC_MULT.map(n => chip('mult', n, n ? '×' + n : $t("нет"), n ? TIERS[n >= 10 ? 4 : n >= 3.5 ? 3 : 2].c : '')).join('')}</div>` +
    `<div class="dbg-l">${$t("Выпал NFT")}</div><div class="dbg-g">${chip('nft', 'stop', $t("Остановиться"))}${chip('nft', 'sell', $t("Сразу продать"), '#30A5FF')}</div>` +
    (acCfg.n || acCfg.loss ? '' : `<p class="dbg-n ac-warn">${$t("Без количества и без стопа по проигрышу серия идёт, пока не кончится баланс")}</p>`);
  $('acFoot').innerHTML = `<button class="btn-main" id="acGo">${$t("Запустить")}${acCfg.n ? ` · ${acCfg.n} × ${fmt(st)} GRAM` : ''}</button>`;
  $('acGo').onclick = () => { hideDrawer(); setTimeout(acStart, 260); };
}
$('acBody').addEventListener('click', e => { const c = e.target.closest('[data-ac]'); if (!c) return;
  const k = c.dataset.ac, v = c.dataset.v; acCfg[k] = k === 'nft' ? v : +v; try { localStorage.setItem('bm-auto', JSON.stringify(acCfg)); } catch(_){} haptic(); acRender(); });

// полоска серии: счётчик, итог по деньгам, «Стоп»
const AC_BAR = (() => { const b = document.createElement('div'); b.className = 'abs acbar'; b.hidden = true;
  b.innerHTML = `<span class="acb-n" id="acN"></span><b id="acNet"></b><button id="acStop">${$t("Стоп")}</button>`; $('stage').appendChild(b); return b; })();
$('acStop').onclick = () => { if (!acRun) return; haptic('medium'); acRun.stop = acRun.stop || $t("остановил сам"); };
function acBar(){ const r = acRun; $('acN').textContent = `${$t("Авто")} ${r.done}${r.n ? ' / ' + r.n : ''}`; const net = Math.round((r.won - r.staked) * 100) / 100;
  $('acNet').textContent = (net > 0 ? '+' : net < 0 ? '−' : '') + fmt(Math.abs(net)) + ' GRAM'; $('acNet').className = net > 0 ? 'pos' : ''; }
// результат над наковальней: тикет, ранг, множитель, выигрыш — короткая вспышка вместо полного раскрытия
function acPop(r, text){ const t = TIERS[r.ti], el = document.createElement('div'); el.className = 'abs acpop'; el.style.setProperty('--c', t.c);
  el.innerHTML = `<b>${tk(r.ticket)}</b><span>${t.name} · ${text}</span>`; $('stage').appendChild(el);
  el.animate([{ opacity: 0, transform: 'translate(-50%, 10px) scale(.9)' }, { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: .15 }, { opacity: 1, transform: 'translate(-50%, -8px)', offset: .75 }, { opacity: 0, transform: 'translate(-50%, -18px)' }],
    { duration: 1100, easing: 'ease-out' }).onfinish = () => el.remove(); }

async function acStart(){
  if (S.busy || acRun) return;
  const bets = acBets(), stake = acStake(), list = bets ? betsList() : null;
  acRun = { n: acCfg.n, done: 0, staked: 0, won: 0, best: null, stop: null, bets, t0: Date.now() };
  S.busy = true; CRAFT.classList.add('busy'); clearInterval(auto); document.body.classList.add('acon'); AC_BAR.hidden = false; acBar(); track('auto_start', { bets, n: acCfg.n, stake });
  let nftR = null;
  while (!acRun.stop){
    if (document.hidden){ await wait(400); continue; }   // свернул приложение — пауза
    if (!S.demo && stake > S.balance + 1e-9){ acRun.stop = $t("не хватает GRAM"); break; }
    const t0 = performance.now(); strike(.55, REST + 8);
    let r = null; try { r = bets ? await API.bets(list) : await API.craft(stake, [], stake); } catch(_){ acRun.stop = $t("сервер не ответил"); break; }
    if (bets || !S.demo) setBalance(S.balance - stake); else moveBal(-stake);
    acRun.done++; acRun.staked += stake; Sfx.rank(r.ti); haptic(r.ti >= 3 ? 'heavy' : 'light'); Glow.set(TIERS[r.ti].glow);
    // лучший: в крафте — самый большой множитель; в Ставках множителя нет — самый высокий ранг, при равном — крупнейший выигрыш
    const score = bets ? r.ti * 1e6 + (r.win || 0) : (r.mult || 0); if (!acRun.best || score > acRun.bestScore){ acRun.best = r; acRun.bestScore = score; }
    if (r.nft && acCfg.nft === 'stop' && !S.demo){ nftR = r; acRun.stop = $t("выпал NFT"); break; }   // выигрыш с подарком — обычный экран, решение за игроком
    // зачисление — как «Забрать» на экране выигрыша; NFT по настройке — продаём сразу
    const how = r.nft ? 'sell' : bets ? 'bets' : 'gram', add = r.nft ? Math.round((r.change + r.nft.value) * 100) / 100 : r.win;
    if (!S.demo && r.win > 0){ try { await API.claimCraft(r, how); } catch(_){ acRun.stop = $t("сервер не ответил"); } }
    if (add > 0){ if (bets || !S.demo) setBalance(S.balance + add); else moveBal(add); }
    acRun.won += add;
    if (!S.demo){ logCraft(r, how); if (!bets) bumpTasks(r); xpTurn(stake); }
    const got = add > 0 ? `<em class="pos">+${fmt(add)}</em>` : '<em>0</em>';   // пришло — зелёным, как везде
    acPop(r, bets ? `${$t("сбылось {0} из {1}", r.bets.filter(b => b.won).length, r.bets.length)} · ${got}` : `×${r.mult} · ${got}`);
    if (add > 0) pushLive(liveHTML(r.ticket, { me: true, stake, win: r.win, nft: r.nft, bets }));   // в ленту — только выигрыши
    acBar();
    const net = acRun.won - acRun.staked;
    if (acRun.n && acRun.done >= acRun.n) acRun.stop = acRun.stop || $t("серия закончилась");
    else if (acCfg.loss && -net >= acCfg.loss) acRun.stop = $t("стоп по проигрышу");
    else if (acCfg.win && net >= acCfg.win) acRun.stop = $t("стоп по выигрышу");
    else if (acCfg.mult && (r.mult || 0) >= acCfg.mult) acRun.stop = $t("крупный множитель ×{0}", r.mult);
    await wait(Math.max(0, 750 - (performance.now() - t0)));   // не чаще ~1.3 в секунду: каждое раскрытие видно глазом
  }
  const run = acRun; acRun = null; AC_BAR.hidden = true; document.body.classList.remove('acon'); settle(); Glow.set(TIERS[S.tier].glow);
  track('auto_stop', { done: run.done, why: run.stop });
  if (nftR){ nftR.gifts = []; nftR.tonStake = stake; await reveal(nftR, true); acSummary(run, true); return; }   // дальше «Забрать / Продать» — как обычно
  CRAFT.classList.remove('busy'); S.busy = false; restartAuto(); renderBet(); acSummary(run);
}
// итог серии
function acSummary(r, quiet){
  const net = Math.round((r.won - r.staked) * 100) / 100, best = r.best, bt = best && TIERS[best.ti];
  if (quiet) return notify({ type: 'info', icon: 'info', ms: 6000, title: `${$t("Серия: {0}", r.done)} · ${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))} GRAM`, text: $t("Остановлено: {0}", r.stop) });
  $('acDrawer').classList.add('ac-done');   // без заголовка: главное — сумма
  $('acBody').innerHTML = `<div class="ac-res"><b class="${net > 0 ? 'pos' : ''}">${net > 0 ? '+' : net < 0 ? '−' : ''}${fmt(Math.abs(net))} GRAM</b><small>${$t("Остановлено: {0}", r.stop)}</small></div>` +
    `<div class="ac-stats">` + fxStats([[r.bets ? $t("Раундов") : $t("Крафтов"), String(r.done)], [$t("Поставлено"), fxGv(Math.round(r.staked * 100) / 100)], [$t("Получено"), fxGv(Math.round(r.won * 100) / 100), r.won > 0 ? 'pos' : ''],
      bt ? [$t("Лучший"), `<span style="color:${bt.c}">${best.mult ? '×' + best.mult : bt.name}</span>`] : null]) + `</div>`;   // множитель цветом ранга — в одну строку
  $('acFoot').innerHTML = `<button class="btn-main" id="acAgain">${$t("Ещё серия")}</button><button class="btn-ghost" id="acClose">${$t("Закрыть")}</button>`;
  $('acAgain').onclick = () => { haptic(); if (acReady()) acRender(); }; $('acClose').onclick = () => { haptic(); hideDrawer(); };
  showDrawer('acDrawer');
}
