/* =========================================================
   ПРЕДИКТЫ — ставки на исходы тикета. Эксперимент, по умолчанию выключен (Дебаг → «Эксперименты»)
   Игрок раскладывает фишки по исходам одного честного тикета 00000–99999: ранг (как в крафте), чёт/нечет,
   последняя цифра (half — меньше/больше 50000 — есть в правилах, но на поле не выводится). Выплата каждой ставки =
   ставка × RTP 90% × 100 000 / число подходящих тикетов — одинаковый RTP на любой ставке. Лимит риска: выигрыш за раунд
   при любом тикете — не больше BETS_MAX_WIN (как потолок крафта: 50 GRAM × x14), общая ставка — до BET_MAX.
   Лимит проверяется сразу при раскладке фишек. Выплата — GRAM. В демо недоступно.
   Честность: тот же протокол, что у крафта и кейсов — эпоха, client seed, общий nonce, домен "bets"; в доказательстве —
   таблица ставок (правила), твои ставки и какие сыграли. Разбор режима — docs/BETS-MODE.md
   ========================================================= */
const BETS_CHIPS = [.1, .5, 1, 5], BETS_MAX_WIN = 700, BETS_MAX_N = 10, BETS_RTP = 900000n;   // фишки, GRAM; потолок выигрыша за раунд, GRAM; ставок за раунд — до 10; RTP в ppm (90% — ниже крафта, как у букмекеров)
const BETS_RTP_PC = Number(BETS_RTP) / 1e4;   // RTP ставок в процентах — для текстов
const TARGET = '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>';
IC.target = TARGET;
// виды ставок: ключ, на что (sel), сколько тикетов подходят, выиграла ли при тикете n
const BET_KINDS = {
  rank:  { count: s => TIERS[s].to - TIERS[s].from + 1, win: (s, n) => tierOfTicket(n) === s },
  parity:{ count: () => TICKETS / 2, win: (s, n) => n % 2 === s },               // 0 — чёт, 1 — нечет
  half:  { count: () => TICKETS / 2, win: (s, n) => (n >= TICKETS / 2 ? 1 : 0) === s },   // 0 — 00000–49999, 1 — 50000–99999
  digit: { count: () => TICKETS / 10, win: (s, n) => n % 10 === s },             // последняя цифра
  dpair: { count: () => TICKETS / 5, win: (s, n) => (n % 10 >> 1) === s },        // последняя цифра — пара: 0 — 0–1, 1 — 2–3 … 4 — 8–9
  // узоры тикета (sel всегда 0): «есть 7» — хоть одна семёрка; «все разные» — пять разных цифр; «пара» — две одинаковые рядом;
  // «зеркало» — читается одинаково с обеих сторон. Сколько тикетов подходит — перебором всех 100 000: 40951 · 30240 · 34390 · 1000
  has7:  { count: () => 40951, win: (s, n) => { const d = dg(n); return d[0] === 7 || d[1] === 7 || d[2] === 7 || d[3] === 7 || d[4] === 7; } },
  diff:  { count: () => 30240, win: (s, n) => { const d = dg(n); let m = 0; for (const x of d){ if (m & 1 << x) return false; m |= 1 << x; } return true; } },
  pair:  { count: () => 34390, win: (s, n) => { const d = dg(n); return d[0] === d[1] || d[1] === d[2] || d[2] === d[3] || d[3] === d[4]; } },
  mirror:{ count: () => 1000, win: (s, n) => { const d = dg(n); return d[0] === d[4] && d[1] === d[3]; } },
};
// цифры тикета слева направо — арифметикой, без строк: лимит выигрыша перебирает все 100 000 тикетов на каждую фишку
const DG = [0, 0, 0, 0, 0]; function dg(n){ for (let i = 4; i >= 0; i--){ DG[i] = n % 10; n = (n - DG[i]) / 10; } return DG; }
const BET_SELS = k => k === 'rank' ? TIERS.map((_, i) => i) : k === 'digit' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : k === 'dpair' ? [0, 1, 2, 3, 4] : k === 'parity' || k === 'half' ? [0, 1] : [0];
const BET_PATS = ['has7', 'diff', 'pair', 'mirror'];
const betsRules = () => ({ kind: 'bets', rtp_ppm: String(BETS_RTP), tickets: TICKETS, max_win_nano: String(nano(BETS_MAX_WIN)),
  table: Object.entries(BET_KINDS).flatMap(([k, d]) => BET_SELS(k).map(s => ({ bet: k, sel: s, count: d.count(s) }))) });
const betMultPpm = (rules, bet, sel) => BigInt(rules.rtp_ppm) * BigInt(rules.tickets) * 1000000n / BigInt(rules.table.find(x => x.bet === bet && x.sel === sel).count) / 1000000n;   // множитель, ppm
let RULES_C = null; const betMult = (bet, sel) => Number(betMultPpm(RULES_C ||= betsRules(), bet, sel)) / 1e6;   // правила не меняются — считаем один раз
// судья: какие ставки сыграли и сколько выплатить (общий для мока и для проверки честности в checkProof)
function betsJudge(rules, bets, n){
  const wins = bets.map(b => BET_KINDS[b.bet].win(+b.sel, n));
  const payout = bets.reduce((a, b, i) => a + (wins[i] ? BigInt(b.amount_nano) * betMultPpm(rules, b.bet, +b.sel) / 1000000n / 10000000n * 10000000n : 0n), 0n);
  return { wins, payout };
}
/* мок сервера: ролл по текущей эпохе (как крафт), вызывается только из API */
async function betsMock(bets){
  const nonce = ++S.nonce, domain = 'bets', rules = betsRules(), inputs = bets.map(b => ({ bet: b.bet, sel: b.sel, amount_nano: String(nano(b.amount)) }));
  let ep = await epochP, { roll, block } = await rollOf(ep.seed, ep.id, domain, S.clientSeed, nonce);
  // дебаг: нужный исход (выигрыш / проигрыш) — перебираем настоящие зерна в одноразовой эпохе, как дебаг крафта
  const want = S.dbg.btOut, ok = r => (betsJudge(rules, inputs, r).payout > 0n) === (want === 'win');
  if (want && !ok(roll)) for (let t = 0; t < 4000; t++){ const e = await newEpoch(), q = await rollOf(e.seed, e.id, domain, S.clientSeed, nonce); if (ok(q.roll)){ ep = Object.assign(e, { proofs: [], revealed: true }); ({ roll, block } = q); break; } }
  const res = betsJudge(rules, inputs, roll);
  const proof = { ...proofBase(ep, nonce, domain, block, roll), rules_hash: await sha(enc(JSON.stringify(rules))), rules, inputs: { bets: inputs },
    result: { wins: res.wins, payout_nano: String(res.payout) } };
  ep.proofs.push(proof); if (ep.revealed) proof.server_seed = ep.seed;   // дебаг-эпоха раскрыта сразу
  const stake = Math.round(bets.reduce((a, b) => a + b.amount, 0) * 100) / 100;
  const win = Number(res.payout) / 1e9, nn = win >= NFT_FROM ? NFTS.filter(x => x.price <= win).slice(-1)[0] : null;   // выигрыш от порога — NFT + сдача, как в крафте
  const nft = nn ? { id: 'w' + Date.now(), num: nn.num, nft: nn, a: nn.bg[0], b: nn.bg[1], p: nn.bg[2], value: nn.price } : null;
  // номер раунда ставок — как номер боя у Арены (в бою — сквозной номер с сервера, в моке — счётчик игрока)
  S.betsSeq = (S.betsSeq ?? S.hist.crafts.filter(c => c.r.bets).length) + 1;
  return S.lastFair = { kind: 'bets', no: S.betsSeq, proof, ticket: roll, ti: tierOfTicket(roll), stake, tonStake: stake, gifts: [], win, nft, change: nft ? (Math.round(win * 100) - Math.round(nft.value * 100)) / 100 : 0,
    bets: bets.map((b, i) => ({ ...b, won: res.wins[i], pay: res.wins[i] ? Math.floor(b.amount * betMult(b.bet, b.sel) * 100) / 100 : 0 })) };
}

/* ---------- экран: поле ставок поверх главной (как арена) ---------- */
let betsOn = false, betsChip = .5, betsBoard = {}, betsLast = null;   // betsBoard: 'rank:2' → сумма, GRAM
const PAT_NAME = { has7: () => $t("Есть 7"), diff: () => $t("Все разные"), pair: () => $t("Пара"), mirror: () => $t("Зеркало") };
const PAT_EX = { has7: '30718', diff: '61294', pair: '48853', mirror: '27472' };   // пример подходящего тикета — на карточке исхода
const betLabel = (bet, sel) => bet === 'rank' ? TIERS[sel].name : bet === 'parity' ? (sel ? $t("Нечет") : $t("Чёт")) : bet === 'half' ? (sel ? '50000–99999' : '00000–49999') : bet === 'dpair' ? `${sel * 2}–${sel * 2 + 1}` : PAT_NAME[bet] ? PAT_NAME[bet]() : $t("Последняя {0}", sel);
// короткое название исхода — для плиток раскрытия (16h-tab3.js)
const betShort = (bet, sel) => bet === 'digit' ? $t("Цифра {0}", sel) : betLabel(bet, sel);
const betsTotal = () => Math.round(Object.values(betsBoard).reduce((a, v) => a + v, 0) * 100) / 100;
// сколько можно выиграть за раунд при самом удачном тикете. Без узоров: ранг и последняя цифра независимы (в каждом ранге есть все цифры),
// чёт/нечет задаётся цифрой — 5 × 10 сочетаний. С узорами — честный перебор всех 100 000 тикетов
function betsMaxWin(board = betsBoard){
  const pay = k => board[k] ? Math.floor(board[k] * betMult(...k.split(':').map((x, i) => i ? +x : x)) * 100) / 100 : 0;
  let best = 0;
  const pats = Object.keys(board).filter(k => board[k] && BET_PATS.includes(k.split(':')[0]));
  if (!pats.length){ for (let r = 0; r < TIERS.length; r++) for (let d = 0; d < 10; d++) best = Math.max(best, pay('rank:' + r) + pay('digit:' + d) + pay('parity:' + d % 2)); }
  else { const bs = Object.keys(board).filter(k => board[k]).map(k => { const [b, s] = k.split(':'); return [BET_KINDS[b].win, +s, pay(k)]; });
    for (let n = 0; n < TICKETS; n++){ let v = 0; for (const [w, s, p] of bs) if (w(s, n)) v += p; if (v > best) best = v; } }
  return Math.round(best * 100) / 100;
}
const betsList = () => Object.entries(betsBoard).filter(([, v]) => v > 0).map(([k, v]) => { const [bet, sel] = k.split(':'); return { bet, sel: +sel, amount: v }; });
const BETS_GLOW = ['#7c5cff', '#3b1e9e', '#30a5ff', '#d9ccff'];
const tgBackBets = on => { try { const b = Telegram.WebApp.BackButton; b.offClick(leaveBets); if (on){ b.onClick(leaveBets); b.show(); } else b.hide(); } catch(_){} };

async function openBets(){
  if (S.demo){ notify({ type: 'demo', icon: 'coin', title: $t("Ставки — только на GRAM"), text: $t("Выключи демо в меню") }); return; }
  if (betsOn || S.busy) return;
  if (openDrawer){ hideDrawer(); await wait(220); }
  betsOn = true; S.busy = true; CRAFT.classList.add('busy'); clearInterval(auto);
  renderBets(); Sfx.chime(); await openFx(false, 'bets', BETS_GLOW); FX.gainTo = .5; tgBackBets(true);
}
async function leaveBets(){
  if (!betsOn) return; betsOn = false; haptic(); tgBackBets(false);
  await closeFx(); $('fx').classList.remove('bets'); CRAFT.classList.remove('busy'); S.busy = false; restartAuto();
}
function cellHTML(bet, sel, cls = ''){
  const k = bet + ':' + sel, v = betsBoard[k] || 0, c = bet === 'rank' ? TIERS[sel].c : '';
  return `<button class="bt-cell ${cls}${v ? ' on' : ''}" data-k="${k}"${c ? ` style="--c:${c}"` : ''}><b>${bet === 'digit' ? sel : betLabel(bet, sel)}</b>` +
    `${bet === 'rank' ? `<small>x${fmt(betMult(bet, sel))}</small>` : ''}${v ? `<em>${fmt(v)}</em>` : ''}</button>`;
}
// шар: пока пусто — туман и «?»; с фишками — сколько получишь, если предсказание сбудется
const orbHTML = (tot, max) => `<div class="bt-orb${tot ? ' on' : ''}" id="btOrb"><i class="fog"></i><i class="fog f2"></i><i class="stars"></i>` +
  `<div class="bt-orb-v">${tot ? `<b>${fmt(max)}</b><small>GRAM</small>` : '<b class="q">?</b>'}</div></div><i class="bt-stand"></i>`;
function renderBets(){
  const tot = betsTotal(), max = betsMaxWin();
  $('fxBets').innerHTML =
    `<div class="ar-top"><button class="ar-back" id="btBack" aria-label="${$t("Назад")}">${svg('<path d="M15 5l-7 7 7 7"/>')}</button>` +
      `<div class="ar-title bt"><i>${svg(TARGET)}</i><b>${$t("Ставки")}</b><span class="beta">β</span></div></div>` +
    orbHTML(tot, max) +
    `<p class="bt-hint">${tot ? $t("Столько даст шар, если предсказание сбудется") : $t("Тапни по исходу — фишка, долгое нажатие — снять")}</p>` +
    `<div class="ar-sub"><div class="bt-chips">${BETS_CHIPS.map(c => `<button class="${c === betsChip ? 'on' : ''}" data-chip="${c}">${fmt(c)}</button>`).join('')}</div>` +
      `<button class="ar-info" id="btInfo" aria-label="${$t("Правила")}">${svg(IC.shield)}</button></div>` +
    `<div class="bt-board" id="btBoard">` +
      `<div class="bt-h">${$t("Ранг тикета")}</div><div class="bt-row r5">${TIERS.map((_, i) => cellHTML('rank', i, 'rank')).join('')}</div>` +
      `<div class="bt-h">${$t("Чёт или нечет")} <span>x${fmt(betMult('parity', 0))}</span></div><div class="bt-row r2">${cellHTML('parity', 0)}${cellHTML('parity', 1)}</div>` +
      `<div class="bt-h">${$t("Последняя цифра")} <span>x${fmt(betMult('digit', 0))}</span></div><div class="bt-row r10 dg">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => cellHTML('digit', d)).join('')}</div>` +
    `</div>` +
    `<div class="bt-act"><button class="btn-ghost" id="btClear"${tot ? '' : ' disabled'}>${$t("Сбросить")}</button>` +
      `<button class="btn-main" id="btGo"${tot ? '' : ' disabled'}>${tot ? $t("Предсказать · {0} GRAM", fmt(tot)) : (betsLast ? $t("Повторить прошлые") : $t("Предсказать"))}</button></div>`;
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
  const next = Math.round(((betsBoard[k] || 0) + betsChip) * 100) / 100;
  if (betsMaxWin({ ...betsBoard, [k]: next }) > BETS_MAX_WIN){ haptic('rigid'); notify({ type: 'warn', icon: 'coin', title: $t("Выигрыш за раунд — до {0} GRAM", BETS_MAX_WIN), text: $t("Как в крафте. Возьми фишку меньше или выбери исход почаще") }); return; }
  if (betsTotal() + betsChip > BET_MAX + 1e-9){ haptic('rigid'); notify({ type: 'warn', icon: 'coin', title: $t("Максимальная ставка {0} GRAM", BET_MAX), text: $t("За один раунд, на все исходы вместе") }); return; }
  betsBoard[k] = next; Sfx.coin(); haptic('light'); renderBets();
  const el = $('btBoard').querySelector(`[data-k="${k}"]`); el?.animate([{ scale: .9 }, { scale: 1.06, offset: .6 }, { scale: 1 }], { duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)' });
  if (!S.lite) $('btOrb').animate([{ filter: 'brightness(1.8)', scale: 1.06 }, { filter: 'brightness(1)', scale: 1 }], { duration: 420, easing: 'cubic-bezier(.3,1.4,.5,1)' });   // шар вспыхивает на каждую фишку
}
// RTP ставок — своя карточка цветом Ставок: он ниже, чем в крафте, и игрок это видит в «Честности», статистике и проверке ставки
const betsRtpCard = (mine, pc = BETS_RTP_PC) => `<div class="pfi-rtp bt"><b>${pc}%</b><span><b>${$t("RTP ставок")}</b><small>${mine != null ? $t("Твой — {0}%.", mine) + ' ' : ''}${$t("Ставки на длинной дистанции возвращают игрокам {0}% — меньше, чем крафт (95%). Это значение записано в правилах каждого доказательства ставок — rtp_ppm.", pc)}</small></span></div>`;
// правила ставок — та же шторка и те же шаги, что у правил арены (16a-pvp.js): цветной номер, заголовок, строка пояснения
function betsRulesModal(){
  haptic();
  // правила под нынешний экран: колоды сверху, фишка внизу, тап по исходу
  const steps = [[TIERS[0].c, $t("Выбери фишку и исход"), $t("Внизу — номинал фишки. Тап по исходу на карте кладёт фишку, долгое нажатие — снимает. До {0} ставок за раунд.", BETS_MAX_N)],
    [TIERS[1].c, $t("Три колоды"), $t("Сверху переключай: Ранг — в какой ранг попадёт тикет. Тикет — чёт, нечет, до или от 50000, есть 7, пара. Последняя цифра — пары: 0–1, 2–3 и так далее.")],
    [TIERS[2].c, $t("Пара и есть 7"), $t("Пара — две одинаковые цифры рядом, как 44. Есть 7 — в тикете хоть одна семёрка.")],
    [TIERS[3].c, $t("Выплата — по шансу"), $t("Чем реже исход, тем больше множитель. Возврат — {0}% на любой ставке (в крафте — 95%).", BETS_RTP_PC)],
    [TIERS[4].c, $t("Лимиты"), $t("За раунд: ставка — до {0} GRAM, выигрыш при любом тикете — до {1} GRAM.", BET_MAX, BETS_MAX_WIN)]];
  const html = `<div class="ar-steps">` + steps.map(([c, t, d], i) => `<div class="pfi-step" style="--c:${c}"><i>${i + 1}</i><div><b>${t}</b><p>${d}</p></div></div>`).join('') +
    `<div class="pfi-step ar-pf" style="--c:#12D53D"><i>${svg(IC.shield)}</i><div><b>${$t("Честность")}</b><p>${$t("Тикет честный: хеш зерна виден до игры, исход можно проверить.")}</p></div></div></div>`;
  swapDrawer('arRulesDrawer', () => { $('arRulesT').textContent = $t("Правила ставок"); $('arRulesBody').innerHTML = html; });
}
/* крутить: та же анимация тикета, на экране — твои ставки; когда тикет встал — сыгравшие подсвечиваются */
async function betsSpin(){
  const bets = betsList(), tot = betsTotal(); if (!tot || betsSpin.on) return;
  if (tot > S.balance){ haptic('rigid'); notify({ type: 'err', icon: 'coin', title: $t("Недостаточно GRAM"), text: $t("Пополни баланс — тапни по нему сверху") }); return; }
  betsSpin.on = true; tgBackBets(false);
  setBalance(S.balance - tot); haptic('medium');
  const r = await API.bets(bets); betsLast = { ...betsBoard };
  $('fxPvp').innerHTML = `<div class="pvp-bank">${svg(TARGET)} ${$t("Шар смотрит в тикет · {0} GRAM", fmt(tot))}</div><div class="pvp-chips">` +
    r.bets.map(b => `<span class="pvc bt" style="--tc:${b.bet === 'rank' ? TIERS[b.sel].c : '#b9a6ff'}"><b>${betLabel(b.bet, b.sel)}</b><em>${fmt(b.amount)} · x${fmt(betMult(b.bet, b.sel))}</em><i class="pvd"></i></span>`).join('') + `</div>`;
  const fi = $('fxIn'); await fi.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished;
  $('fx').classList.remove('bets'); $('fx').classList.add('btspin'); betsOn = false; fi.getAnimations().forEach(x => x.cancel());   // btspin: в раскрытии ставок нет строки «не хватило до ранга» — она про крафт
  Sfx.chime(); FullGlow.punch(0, .8);
  betsSpin.on = false;
  await reveal(r, S.fast || S.lite);
}
// после того как тикет встал: сыгравшие ставки — зелёные с выплатой, остальные гаснут; затем итог
async function betsAfter(r){ await betsChipsReveal(r); betsResult(r); }
async function betsChipsReveal(r){
  // саспенс: ставки раскрываются по одной — от частых исходов к редким (самая крупная — последней), выплата растёт на глазах.
  // Исход уже известен и проверяем; меняется только порядок показа
  const chips = [...$('fxPvp').querySelectorAll('.pvc')], bank = $('fxPvp').querySelector('.pvp-bank');
  const order = r.bets.map((b, i) => i).sort((x, y) => betMult(r.bets[x].bet, r.bets[x].sel) - betMult(r.bets[y].bet, r.bets[y].sel));
  const step = S.lite || S.fast ? 160 : 520; let sum = 0;
  for (const i of order){
    const b = r.bets[i], c = chips[i]; if (!c) continue;
    c.classList.add('pend'); await wait(step * .55);
    c.classList.remove('pend'); c.classList.add(b.won ? 'win' : 'lose');
    if (b.won){ sum = Math.round((sum + b.pay) * 100) / 100; c.querySelector('.pvd').textContent = '+' + fmt(b.pay); Sfx.coin(); haptic('medium');
      // сверху остаётся «Ставки N» — выплата видна на плитках сыгравших ставок и на итоге
      }
    else { Sfx.tick(.6); haptic('light'); }
    await wait(step * .45);
  }
  haptic(r.win > 0 ? 'heavy' : 'rigid');
  await wait(S.lite ? 300 : 900);
}
function betsResult(r){
  const won = r.bets.filter(b => b.won);
  // итог: сумма крупно, ниже — все ставки раунда: сыгравшие зелёные с выплатой, остальные приглушены
  $('fxDrop').innerHTML = `<div class="pz bt-res${r.win > 0 ? ' won' : ''}${r.nft ? ' nft' : ''}">${r.nft ? `<img src="${r.nft.nft.src}" alt="" style="background:linear-gradient(160deg,${r.nft.a},${r.nft.b})"><b>${r.nft.nft.name}</b><small class="bt-ch">${fmt(r.nft.value)} GRAM${r.change > 0 ? ` · ${$t("и на баланс +{0} GRAM", fmt(r.change))}` : ''}</small>` : `<img src="assets/hero-gem.webp" alt=""><b>${r.win > 0 ? '+' + fmt(r.win) : '0'}<i class="u">GRAM</i></b>`}` +
    `<div class="pvp-chips">${r.bets.map(b => `<span class="pvc bt ${b.won ? 'win' : 'lose'}" style="--tc:${b.bet === 'rank' ? TIERS[b.sel].c : '#b9a6ff'}"><b>${betLabel(b.bet, b.sel)}</b><em>${b.won ? '+' + fmt(b.pay) : fmt(b.amount)}</em></span>`).join('')}</div></div>`;
  $('fxWin').innerHTML = `<span>${$t("Ставка {0} GRAM", fmt(r.stake))} · ${won.length ? $t("сбылось {0} из {1}", won.length, r.bets.length) : $t("не сбылось")}</span>`;
  $('fxBtns').innerHTML = `<button class="btn-main" id="btAgain">${$t("Ещё раз · {0} GRAM", fmt(r.stake))}</button><button class="btn-ghost" id="btEdit">${$t("Изменить ставки")}</button>` +
    `<div class="fx-links"><button class="btn-link pf" id="fxPfIn">${$t("Проверить честность")}</button><button class="btn-link pf" id="btHome">${$t("На главную")}</button></div>`;
  $('fx').classList.add('done'); if (r.win > 0 && !S.lite) setTimeout(burst, 200);
  if (r.nft){ INV.unshift(r.nft); if (r.change > 0) setBalance(S.balance + r.change); } else if (r.win > 0) setBalance(S.balance + r.win);   // NFT — в инвентарь, сдача — на баланс
  if (!S.demo){ if (r.win > 0) API.claimCraft(r, r.nft ? 'take' : 'bets'); logCraft(r, 'bets'); xpTurn(r.stake); }
  if (r.win > 0) setTimeout(() => pushLive(liveHTML(r.ticket, { me: true, stake: r.stake, win: r.win, nft: r.nft, bets: true })), 300);   // выигрыш в ленту «лайв»
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
  $('fx').classList.remove('done', 'fail', 'btspin'); $('fxDrop').innerHTML = $('fxWin').innerHTML = $('fxBtns').innerHTML = $('fxPvp').innerHTML = ''; Tilt.drop($('fxDrop'));
  betsBoard = { ...(betsLast || {}) }; $('fx').classList.add('bets'); betsOn = true; FullGlow.set(BETS_GLOW); FX.gainTo = .5; tgBackBets(true);
  renderBets(); fi.getAnimations().forEach(x => x.cancel());
  if (again) betsSpin();
}
