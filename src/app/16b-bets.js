/* =========================================================
   ПРЕДИКТЫ — ставки на исходы тикета. Эксперимент, по умолчанию выключен (Дебаг → «Эксперименты»)
   Игрок раскладывает фишки по исходам одного честного тикета 00000–99999: ранг (как в крафте), чёт/нечет,
   меньше/больше 50000, последняя цифра. Выплата каждой ставки = ставка × RTP 95% × 100 000 / число подходящих тикетов —
   одинаковый RTP на любой ставке, ни одна комбинация не бьёт дом. Выигрыш одной ставки — не больше BETS_CAP (лимит риска),
   поэтому крупные ставки на редкие исходы ограничены сразу при раскладке. Выплата — GRAM. В демо недоступно.
   Честность: тот же протокол, что у крафта и кейсов — эпоха, client seed, общий nonce, домен "bets"; в доказательстве —
   таблица ставок (правила), твои ставки и какие сыграли. Разбор режима — docs/BETS-MODE.md
   ========================================================= */
const BETS_CHIPS = [.1, .5, 1, 5], BETS_CAP = 1000, BETS_RTP = 950000n;   // фишки, GRAM; потолок выигрыша одной ставки, GRAM; RTP в ppm
const TARGET = '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>';
IC.target = TARGET;
// виды ставок: ключ, на что (sel), сколько тикетов подходят, выиграла ли при тикете n
const BET_KINDS = {
  rank:  { count: s => TIERS[s].to - TIERS[s].from + 1, win: (s, n) => tierOfTicket(n) === s },
  parity:{ count: () => TICKETS / 2, win: (s, n) => n % 2 === s },               // 0 — чёт, 1 — нечет
  half:  { count: () => TICKETS / 2, win: (s, n) => (n >= TICKETS / 2 ? 1 : 0) === s },   // 0 — 00000–49999, 1 — 50000–99999
  digit: { count: () => TICKETS / 10, win: (s, n) => n % 10 === s },             // последняя цифра
};
const betsRules = () => ({ kind: 'bets', rtp_ppm: String(BETS_RTP), tickets: TICKETS, cap_nano: String(nano(BETS_CAP)),
  table: Object.entries(BET_KINDS).flatMap(([k, d]) => (k === 'rank' ? TIERS.map((_, i) => i) : k === 'digit' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [0, 1]).map(s => ({ bet: k, sel: s, count: d.count(s) }))) });
const betMultPpm = (rules, bet, sel) => BETS_RTP * BigInt(rules.tickets) * 1000000n / BigInt(rules.table.find(x => x.bet === bet && x.sel === sel).count) / 1000000n;   // множитель, ppm
const betMult = (bet, sel) => Number(betMultPpm(betsRules(), bet, sel)) / 1e6;
// судья: какие ставки сыграли и сколько выплатить (общий для мока и для проверки честности в checkProof)
function betsJudge(rules, bets, n){
  const wins = bets.map(b => BET_KINDS[b.bet].win(+b.sel, n));
  const payout = bets.reduce((a, b, i) => a + (wins[i] ? BigInt(b.amount_nano) * betMultPpm(rules, b.bet, +b.sel) / 1000000n / 10000000n * 10000000n : 0n), 0n);
  return { wins, payout };
}
/* мок сервера: ролл по текущей эпохе (как крафт), вызывается только из API */
async function betsMock(bets){
  const nonce = ++S.nonce, domain = 'bets', ep = await epochP, { roll, block } = await rollOf(ep.seed, ep.id, domain, S.clientSeed, nonce);
  const rules = betsRules(), inputs = bets.map(b => ({ bet: b.bet, sel: b.sel, amount_nano: String(nano(b.amount)) })), res = betsJudge(rules, inputs, roll);
  const proof = { ...proofBase(ep, nonce, domain, block, roll), rules_hash: await sha(enc(JSON.stringify(rules))), rules, inputs: { bets: inputs },
    result: { wins: res.wins, payout_nano: String(res.payout) } };
  ep.proofs.push(proof);
  const stake = Math.round(bets.reduce((a, b) => a + b.amount, 0) * 100) / 100;
  return S.lastFair = { kind: 'bets', proof, ticket: roll, ti: tierOfTicket(roll), stake, tonStake: stake, gifts: [], win: Number(res.payout) / 1e9, nft: null, change: 0,
    bets: bets.map((b, i) => ({ ...b, won: res.wins[i], pay: res.wins[i] ? Math.floor(b.amount * betMult(b.bet, b.sel) * 100) / 100 : 0 })) };
}

/* ---------- экран: поле ставок поверх главной (как арена) ---------- */
let betsOn = false, betsChip = .5, betsBoard = {}, betsLast = null;   // betsBoard: 'rank:2' → сумма, GRAM
const betLabel = (bet, sel) => bet === 'rank' ? TIERS[sel].name : bet === 'parity' ? (sel ? $t("Нечет") : $t("Чёт")) : bet === 'half' ? (sel ? '50000–99999' : '00000–49999') : $t("Последняя {0}", sel);
const betsTotal = () => Math.round(Object.values(betsBoard).reduce((a, v) => a + v, 0) * 100) / 100;
const betsList = () => Object.entries(betsBoard).filter(([, v]) => v > 0).map(([k, v]) => { const [bet, sel] = k.split(':'); return { bet, sel: +sel, amount: v }; });
const BETS_GLOW = ['#7c5cff', '#3b1e9e', '#30a5ff', '#d9ccff'];
const tgBackBets = on => { try { const b = Telegram.WebApp.BackButton; b.offClick(leaveBets); if (on){ b.onClick(leaveBets); b.show(); } else b.hide(); } catch(_){} };

async function openBets(){
  if (S.demo){ notify({ type: 'demo', icon: 'coin', title: $t("Предикты — только на GRAM"), text: $t("Выключи демо в меню") }); return; }
  if (betsOn || S.busy) return;
  if (openDrawer){ hideDrawer(); await wait(220); }
  betsOn = true; S.busy = true; CRAFT.classList.add('busy'); clearInterval(auto);
  renderBets(); await openFx(false, 'bets', BETS_GLOW); FX.gainTo = .5; tgBackBets(true);
}
async function leaveBets(){
  if (!betsOn) return; betsOn = false; haptic(); tgBackBets(false);
  await closeFx(); $('fx').classList.remove('bets'); CRAFT.classList.remove('busy'); S.busy = false; restartAuto();
}
function cellHTML(bet, sel, cls = ''){
  const k = bet + ':' + sel, v = betsBoard[k] || 0, c = bet === 'rank' ? TIERS[sel].c : '';
  return `<button class="bt-cell ${cls}${v ? ' on' : ''}" data-k="${k}"${c ? ` style="--c:${c}"` : ''}><b>${bet === 'digit' ? sel : betLabel(bet, sel)}</b><small>x${fmt(betMult(bet, sel))}</small>${v ? `<em>${fmt(v)}</em>` : ''}</button>`;
}
function renderBets(){
  const tot = betsTotal(), maxWin = betsList().reduce((a, b) => a + b.amount * betMult(b.bet, b.sel), 0);
  $('fxBets').innerHTML =
    `<div class="ar-top"><button class="ar-back" id="btBack" aria-label="${$t("Назад")}">${svg('<path d="M15 5l-7 7 7 7"/>')}</button>` +
      `<div class="ar-title bt"><i>${svg(TARGET)}</i><b>${$t("Предикты")}</b><span class="beta">β</span></div></div>` +
    `<div class="ar-sub"><div class="bt-chips">${BETS_CHIPS.map(c => `<button class="${c === betsChip ? 'on' : ''}" data-chip="${c}">${fmt(c)}</button>`).join('')}</div>` +
      `<button class="ar-info" id="btInfo" aria-label="${$t("Правила")}">${svg(IC.shield)}</button></div>` +
    `<div class="bt-board" id="btBoard">` +
      `<div class="bt-h">${$t("Ранг тикета")}</div><div class="bt-row r5">${TIERS.map((_, i) => cellHTML('rank', i, 'rank')).join('')}</div>` +
      `<div class="bt-row r4">${cellHTML('parity', 0)}${cellHTML('parity', 1)}${cellHTML('half', 0, 'sm')}${cellHTML('half', 1, 'sm')}</div>` +
      `<div class="bt-h">${$t("Последняя цифра")}</div><div class="bt-row r5 dg">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => cellHTML('digit', d)).join('')}</div>` +
    `</div>` +
    `<p class="bt-hint">${tot ? $t("Ставка {0} GRAM · если сыграет всё — до {1} GRAM", fmt(tot), fmt(Math.floor(maxWin * 100) / 100)) : $t("Тапни по исходу — положишь фишку. Долгое нажатие — снять")}</p>` +
    `<div class="bt-act"><button class="btn-ghost" id="btClear"${tot ? '' : ' disabled'}>${$t("Сбросить")}</button>` +
      `<button class="btn-main" id="btGo"${tot ? '' : ' disabled'}>${tot ? $t("Крутить · {0} GRAM", fmt(tot)) : (betsLast ? $t("Повторить прошлые") : $t("Крутить"))}</button></div>`;
  bindBets();
}
function bindBets(){
  $('btBack').onclick = leaveBets; $('btInfo').onclick = betsRulesModal;
  $('fxBets').querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { betsChip = +b.dataset.chip; Sfx.swipe(); haptic(); renderBets(); });
  $('btClear').onclick = () => { betsBoard = {}; haptic('medium'); Sfx.lock(); renderBets(); };
  const go = $('btGo'); if (!betsTotal() && betsLast){ go.disabled = false; go.onclick = () => { betsBoard = { ...betsLast }; haptic(); renderBets(); }; } else go.onclick = betsSpin;
  // тап — фишка на исход; долгое нажатие — снять все фишки с исхода
  $('btBoard').querySelectorAll('.bt-cell').forEach(c => {
    let lp = 0, long = false;
    c.onpointerdown = () => { long = false; lp = setTimeout(() => { long = true; if (betsBoard[c.dataset.k]){ delete betsBoard[c.dataset.k]; haptic('medium'); Sfx.lock(); renderBets(); } }, 450); };
    c.onpointerup = c.onpointerleave = c.onpointercancel = () => clearTimeout(lp);
    c.onclick = () => { if (long) return; betsAdd(c.dataset.k); };
  });
}
function betsAdd(k){
  const [bet, sel] = k.split(':'), next = Math.round(((betsBoard[k] || 0) + betsChip) * 100) / 100, cap = Math.floor(BETS_CAP / betMult(bet, +sel) * 100) / 100;
  if (next > cap){ haptic('rigid'); notify({ type: 'warn', icon: 'coin', title: $t("Максимум на «{0}» — {1} GRAM", betLabel(bet, +sel), fmt(cap)), text: $t("Выигрыш одной ставки — до {0} GRAM", BETS_CAP) }); return; }
  if (betsTotal() + betsChip > BET_MAX + 1e-9){ haptic('rigid'); notify({ type: 'warn', icon: 'coin', title: $t("Максимальная ставка {0} GRAM", BET_MAX), text: $t("За один раунд, на все исходы вместе") }); return; }
  betsBoard[k] = next; Sfx.coin(); haptic('light'); renderBets();
  const el = $('btBoard').querySelector(`[data-k="${k}"]`); el?.animate([{ scale: .9 }, { scale: 1.06, offset: .6 }, { scale: 1 }], { duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)' });
}
function betsRulesModal(){
  haptic();
  const rules = [$t("Положи фишки на исходы одного тикета 00000–99999 — сколько угодно исходов за раунд."), $t("Выплата каждой ставки — по шансу исхода, возврат 95% на любой ставке."),
    $t("Выигрыш одной ставки — до {0} GRAM; общая ставка за раунд — до {1} GRAM.", BETS_CAP, BET_MAX), $t("Тикет честный: хеш зерна виден до игры, исход можно проверить.")];
  modal(`<h4>${$t("Правила предиктов")}</h4><ol class="ar-rules">${rules.map(x => `<li>${x}</li>`).join('')}</ol>` +
    `<button class="btn-main" id="btOk">${$t("Понятно")}</button>`, '#7c5cff');
  $('btOk').onclick = closeModal;
}
/* крутить: та же анимация тикета, на экране — твои ставки; когда тикет встал — сыгравшие подсвечиваются */
async function betsSpin(){
  const bets = betsList(), tot = betsTotal(); if (!tot || betsSpin.on) return;
  if (tot > S.balance){ haptic('rigid'); notify({ type: 'err', icon: 'coin', title: $t("Недостаточно GRAM"), text: $t("Пополни баланс — тапни по нему сверху") }); return; }
  betsSpin.on = true; tgBackBets(false);
  setBalance(S.balance - tot); haptic('medium');
  const r = await API.bets(bets); betsLast = { ...betsBoard };
  $('fxPvp').innerHTML = `<div class="pvp-bank">${svg(TARGET)} ${$t("Предикты · ставка {0} GRAM", fmt(tot))}</div><div class="pvp-chips">` +
    r.bets.map(b => `<span class="pvc bt" style="--tc:${b.bet === 'rank' ? TIERS[b.sel].c : '#b9a6ff'}"><b>${betLabel(b.bet, b.sel)}</b><em>${fmt(b.amount)} · x${fmt(betMult(b.bet, b.sel))}</em><i class="pvd"></i></span>`).join('') + `</div>`;
  const fi = $('fxIn'); await fi.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished;
  $('fx').classList.remove('bets'); betsOn = false; fi.getAnimations().forEach(x => x.cancel());
  Sfx.clang(); FullGlow.punch(0, .8);
  betsSpin.on = false;
  await reveal(r, S.fast || S.lite);
}
// после того как тикет встал: сыгравшие ставки — зелёные с выплатой, остальные гаснут; затем итог
async function betsAfter(r){
  [...$('fxPvp').querySelectorAll('.pvc')].forEach((c, i) => { const b = r.bets[i]; c.classList.add(b.won ? 'win' : 'lose'); c.querySelector('.pvd').textContent = b.won ? '+' + fmt(b.pay) : ''; });
  haptic('heavy'); r.win > 0 ? Sfx.coin() : Sfx.lock();
  await wait(S.lite ? 500 : 1500);
  const won = r.bets.filter(b => b.won);
  // итог: сумма крупно, ниже — все ставки раунда: сыгравшие зелёные с выплатой, остальные приглушены
  $('fxDrop').innerHTML = `<div class="pz bt-res${r.win > 0 ? ' won' : ''}"><img src="assets/hero-gem.webp" alt=""><b>${r.win > 0 ? '+' + fmt(r.win) : '0'}<i class="u">GRAM</i></b>` +
    `<div class="pvp-chips">${r.bets.map(b => `<span class="pvc bt ${b.won ? 'win' : 'lose'}" style="--tc:${b.bet === 'rank' ? TIERS[b.sel].c : '#b9a6ff'}"><b>${betLabel(b.bet, b.sel)}</b><em>${b.won ? '+' + fmt(b.pay) : fmt(b.amount)}</em></span>`).join('')}</div></div>`;
  $('fxWin').innerHTML = `<span>${$t("Ставка {0} GRAM", fmt(r.stake))} · ${won.length ? $t("сыграло {0} из {1}", won.length, r.bets.length) : $t("ни одна не сыграла")}</span>`;
  $('fxBtns').innerHTML = `<button class="btn-main" id="btAgain">${$t("Ещё раз · {0} GRAM", fmt(r.stake))}</button><button class="btn-ghost" id="btEdit">${$t("Изменить ставки")}</button>` +
    `<div class="fx-links"><button class="btn-link pf" id="fxPfIn">${$t("Проверить честность")}</button><button class="btn-link pf" id="btHome">${$t("На главную")}</button></div>`;
  $('fx').classList.add('done'); if (r.win > 0 && !S.lite) setTimeout(burst, 200);
  if (r.win > 0) setBalance(S.balance + r.win);
  if (!S.demo){ logCraft(r, 'bets'); addXp(r.stake * .5); }
  setTimeout(() => { FX.hot = false; }, 900);
  $('fxPfIn').onclick = () => openPF(r);
  $('btAgain').onclick = () => betsBack(true);
  $('btEdit').onclick = () => betsBack(false);
  $('btHome').onclick = async () => { haptic(); await closeFx(); CRAFT.classList.remove('busy'); S.busy = false; restartAuto(); };
}
// обратно на поле ставок — без выхода на главную; «Ещё раз» — сразу крутить с теми же ставками
async function betsBack(again){
  haptic(); const fi = $('fxIn');
  await fi.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished;
  $('fx').classList.remove('done', 'fail'); $('fxDrop').innerHTML = $('fxWin').innerHTML = $('fxBtns').innerHTML = $('fxPvp').innerHTML = ''; Tilt.drop($('fxDrop'));
  betsBoard = { ...(betsLast || {}) }; $('fx').classList.add('bets'); betsOn = true; FullGlow.set(BETS_GLOW); FX.gainTo = .5; tgBackBets(true);
  renderBets(); fi.getAnimations().forEach(x => x.cancel());
  if (again) betsSpin();
}
