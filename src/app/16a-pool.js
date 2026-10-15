/* =========================================================
   КРАФТ В СКЛАДЧИНУ — эксперимент, по умолчанию выключен (Дебаг → «Эксперименты»)
   Игроки вносят одинаковый взнос и загадывают тикет 00000–99999. Когда места заполнены, разыгрывается
   честный тикет пула; кто загадал ближе всех — крафтит на весь банк (обычный крафт, RTP 95%). Ничья — банк
   делится поровну, каждый крафтит на свою долю. Отдельной комиссии нет: доход дома — RTP крафта.
   Честность: зерно пула загадано до первого взноса (хеш виден сразу). Тикет = HMAC(зерно,
   ["pawn-pf-v1", id пула, "pool", хеш списка загаданных тикетов, "0", блок]) — зерно зафиксировано раньше ставок,
   а список ставок — до розыгрыша, поэтому тикет не подогнать ни под одного игрока.
   Мок: соседи по пулу — заглушки (ники NICKS), в бою это живые игроки с сервера. Пул живёт только в памяти.
   ========================================================= */
const POOL_FEES = [.5, 1, 5], POOL_SEATS = 10;
let poolFee = 1, poolGuess = null, poolView = null, poolTimer = 0;
const poolRand = () => Math.floor(Math.random() * TICKETS);

/* ---------- мок сервера (вызывается только из API в 17-api.js) ---------- */
const POOLS = {};                                                     // открытый пул на каждый взнос
async function poolOpenMock(fee){
  let p = POOLS[fee];
  if (!p || p.state !== 'open'){
    const e = await newEpoch(), pre = 2 + Math.floor(Math.random() * 5), nicks = [...NICKS].sort(() => Math.random() - .5);
    p = POOLS[fee] = { id: e.id, fee, seed: e.seed, commitment: e.commitment, state: 'open', entries: [], t0: Date.now(), nicks };
    for (let i = 0; i < pre; i++) poolBot(p);                         // кто-то уже зашёл до тебя
  }
  return poolPublic(p);
}
function poolBot(p){
  const taken = new Set(p.entries.map(x => x.guess)); let g; do g = poolRand(); while (taken.has(g));
  p.entries.push({ who: p.nicks[p.entries.length % p.nicks.length], guess: g, at: Date.now() });
}
async function poolJoinMock(fee, guess){
  const p = POOLS[fee]; if (!p || p.state !== 'open') return { ok: false, error: 'closed' };
  if (p.entries.some(x => x.me)) return { ok: false, error: 'already' };
  if (p.entries.some(x => x.guess === guess)) return { ok: false, error: 'taken' };
  p.entries.push({ who: 'GK', guess, me: true, at: Date.now() });
  p.next = Date.now() + 700;                                          // дальше подтягиваются остальные
  return { ok: true, pool: poolPublic(p) };
}
async function poolStateMock(fee){
  const p = POOLS[fee]; if (!p) return null;
  while (p.state === 'open' && p.next && Date.now() >= p.next && p.entries.length < POOL_SEATS){ poolBot(p); p.next += 600 + Math.random() * 1100; }
  if (p.state === 'open' && p.entries.length >= POOL_SEATS){ p.state = 'drawing'; p.drawP = poolDraw(p); }
  if (p.state === 'drawing') await p.drawP;
  return poolPublic(p);
}
async function poolDraw(p){
  const entries = p.entries.map(x => x.guess), entriesHash = await sha(enc(JSON.stringify(entries)));
  const { roll, block } = await rollOf(p.seed, p.id, 'pool', entriesHash, 0);
  const dist = entries.map(g => Math.abs(g - roll)), best = Math.min(...dist), winners = dist.flatMap((d, i) => d === best ? [i] : []);
  const rules = { kind: 'pool', seats: POOL_SEATS, fee_nano: String(nano(p.fee)), distance: 'abs', tie: 'split' };
  p.proof = { version: PF_VER, reference: p.id, request_id: uuid(), epoch_id: p.id, commitment: p.commitment, client_seed: entriesHash, server_seed: p.seed,
    nonce: '0', domain: 'pool', block_counter: String(block), roll, rules_hash: await sha(enc(JSON.stringify(rules))), rules,
    inputs: { entries: entries.map(String) }, result: { winners, distance: best, bank_nano: String(nano(p.fee * entries.length)) } };
  Object.assign(p, { state: 'done', ticket: roll, winners, best });
}
// что видит игрок: чужие тикеты скрыты до розыгрыша, зерно — только после
const poolPublic = p => ({ id: p.id, fee: p.fee, commitment: p.commitment, state: p.state, seats: POOL_SEATS, bank: Math.round(p.fee * p.entries.length * 100) / 100,
  entries: p.entries.map((x, i) => ({ who: x.who, me: !!x.me, guess: x.me || p.state === 'done' ? x.guess : null, dist: p.state === 'done' ? Math.abs(x.guess - p.ticket) : null, win: p.state === 'done' && p.winners.includes(i) })),
  ticket: p.state === 'done' ? p.ticket : null, proof: p.state === 'done' ? p.proof : null });

/* ---------- экран ---------- */
function openPool(){
  if (S.demo){ notify({ type: 'demo', icon: 'coin', title: $t("Складчина — только на GRAM"), text: $t("Выключи демо в меню") }); return; }
  swapDrawer('poolDrawer', () => poolLoad());
}
async function poolLoad(){ poolView = await API.poolOpen(poolFee); if (poolGuess == null) poolGuess = poolRand(); renderPool(); poolTick(); }
function poolTick(){
  clearTimeout(poolTimer);
  if (!$('poolDrawer').classList.contains('open') || !poolView) return;
  const mine = poolView.entries.some(x => x.me);
  if (mine && poolView.state !== 'done') poolTimer = setTimeout(async () => { const v = await API.poolState(poolFee); if (v){ const was = poolView.entries.length; poolView = v; renderPool(was); } poolTick(); }, 450);
}
const poolDigits = (n, cls = '') => `<div class="sddig${cls}">${tk(n).split('').map(d => `<b>${d}</b>`).join('')}</div>`;
function renderPool(wasCount){
  const v = poolView, me = v.entries.find(x => x.me), done = v.state === 'done', b = $('poolBody'), go = $('poolGo');
  const head = `<div class="pool-h"><b>${$t("Крафт в складчину")}</b><span class="beta">β</span></div>` +
    `<p class="bnote pool-lead">${$t("Все вносят одинаковый взнос и загадывают тикет. Кто окажется ближе всех к честному тикету пула — крафтит на весь банк.")}</p>`;
  const fees = `<div class="pool-fees">${POOL_FEES.map(f => `<button class="pill-btn${f === poolFee ? ' on' : ''}" data-fee="${f}"${me && !done ? ' disabled' : ''}>${fmt(f)} GRAM</button>`).join('')}</div>`;
  const stats = `<div class="stats pool-stats"><div><small>${$t("Банк")}</small><b class="g">${fmt(v.bank)}${GU}</b></div><div><small>${$t("Мест")}</small><b>${v.entries.length} / ${v.seats}</b></div></div>`;
  const seat = (x, i) => `<div class="trow${x.me ? ' me' : ''}${x.win ? ' win' : ''}"><span class="tav" style="--tc:${avc(x.who)}">${x.me ? '<img src="assets/avatar.webp" alt="">' : x.who[0].toUpperCase()}</span>` +
    `<span class="tn"><b>${x.me ? $t("Ты") : '@' + x.who}</b><small>${x.guess == null ? '•••••' : tk(x.guess)}${x.dist != null ? ` · ${$t("до тикета")} ${x.dist.toLocaleString(LOC)}` : ''}</small></span>` +
    (x.win ? `<span class="tb2 g">${$t("ближе всех")}</span>` : '') + `</div>`;
  const list = (done ? [...v.entries].sort((a, c) => a.dist - c.dist) : v.entries).map(seat).join('');
  const fair = `<div class="pool-fair"><small>${$t("Хеш зерна пула — показан до взносов")}</small><code>${v.commitment}</code>` +
    (done ? `<small>${$t("Зерно")}</small><code>${v.proof.server_seed}</code><button class="btn-main pf-check pool-check">${$t("Проверить честность")}</button>` : '') + `</div>`;
  if (!me){
    b.innerHTML = head + fees + stats +
      `<div class="sdtarget pool-pick"><small>${$t("Твой тикет")}</small>${poolDigits(poolGuess)}<div class="pool-in"><input id="poolIn" inputmode="numeric" maxlength="5" placeholder="00000" value="${tk(poolGuess)}"><button class="pill-btn" data-act="poolRand">${$t("Случайный")}</button></div></div>` +
      `<div class="sect"><div class="sect-h"><span><b>${$t("Уже в пуле")}</b><small>${$t("чужие тикеты откроются после розыгрыша")}</small></span></div>${list}</div>` + fair +
      rulesHTML([$t("Взнос одинаковый для всех, мест — {0}. Розыгрыш — когда места заполнены.", POOL_SEATS), $t("Один тикет — один игрок: занятый выбрать нельзя."),
        $t("Ближе всех — по модулю разницы с тикетом пула. Ничья — банк делится поровну."), $t("Победитель крафтит на банк обычным крафтом: множитель от x0.4 до x14."), $t("Зерно пула загадано до первого взноса, тикет зависит и от зерна, и от всех загаданных тикетов.")]);
    go.textContent = `${$t("Вступить за {0} GRAM", fmt(poolFee))}`; go.className = 'btn-main';
  } else if (!done){
    b.innerHTML = head + stats + `<div class="sdtarget pool-pick"><small>${$t("Твой тикет")}</small>${poolDigits(me.guess)}<p>${$t("Ждём остальных — розыгрыш, когда займут все места")}</p></div>` +
      `<div class="sect"><div class="sect-h"><span><b>${$t("Участники")}</b></span></div>${list}</div>` + fair;
    go.textContent = `${$t("Ждём игроков")} · ${v.entries.length}/${v.seats}`; go.className = 'btn-main off';
    if (wasCount != null && v.entries.length > wasCount) Sfx.tick(.7);
  } else {
    const win = me.win, nw = v.entries.filter(x => x.win).length, share = Math.floor(v.bank / nw * 100) / 100, best = v.entries.find(x => x.win);
    b.innerHTML = head + `<div class="sdtarget pool-pick pool-res${win ? ' won' : ''}"><small>${$t("Тикет пула")}</small>${poolDigits(v.ticket, ' res')}` +
      `<p>${win ? (nw > 1 ? `${$t("Ничья! Твоя доля банка — {0} GRAM", fmt(share))}` : `${$t("Ты ближе всех! Банк {0} GRAM — твой крафт", fmt(v.bank))}`) : `${$t("Ближе всех")} ${best.me ? $t("Ты") : '@' + best.who} · ${$t("до тикета")} ${best.dist.toLocaleString(LOC)}`}</p></div>` +
      `<div class="sect"><div class="sect-h"><span><b>${$t("Итог")}</b></span></div>${list}</div>` + fair;
    go.textContent = win ? `${$t("Крафт на {0} GRAM", fmt(share))}` : $t("Ещё раз"); go.className = 'btn-main';
    go.dataset.share = win ? share : '';
    if (wasCount != null){ haptic('heavy'); win ? Sfx.rank(3) : Sfx.lock(); }
  }
  bindPool();
}
function bindPool(){
  const inp = $('poolIn');
  if (inp) inp.oninput = () => { const d = inp.value.replace(/\D/g, '').slice(0, 5); inp.value = d; if (d.length){ poolGuess = Math.min(TICKETS - 1, +d); $('poolBody').querySelector('.pool-pick .sddig').outerHTML = poolDigits(poolGuess); } };
  if (inp) inp.onblur = () => { inp.value = tk(poolGuess); };
}
$('poolBody').addEventListener('click', async e => {
  const f = e.target.closest('[data-fee]'); if (f && !f.disabled){ poolFee = +f.dataset.fee; Sfx.swipe(); haptic(); poolLoad(); return; }
  if (e.target.closest('[data-act="poolRand"]')){ poolGuess = poolRand(); haptic(); renderPool(); return; }
  const ck = e.target.closest('.pool-check'); if (ck && !ck.classList.contains('wait')){
    ck.classList.add('wait'); ck.textContent = $t("Проверяем…"); haptic();
    const r = await checkProof(poolView.proof), ok = r.hash && r.ticket && r.rule;
    ck.classList.remove('wait'); ck.classList.add(ok ? 'done' : 'bad'); ck.textContent = ok ? $t("Всё честно ✓") : $t("Проверка не сошлась");
  }
});
$('poolGo').onclick = async () => {
  const go = $('poolGo'), v = poolView; if (!v || go.classList.contains('off')) return;
  if (v.state === 'done'){
    if (go.dataset.share){ const share = +go.dataset.share; go.dataset.share = ''; hideDrawer(); setTimeout(() => poolCraft(share), 300); }
    else { haptic(); poolLoad(); }
    return;
  }
  if (poolFee > S.balance){ notify({ type: 'err', icon: 'coin', title: $t("Недостаточно GRAM"), text: $t("Пополни баланс — тапни по нему сверху") }); return; }
  const r = await API.poolJoin(poolFee, poolGuess);
  if (!r.ok){ haptic('rigid'); notify({ type: 'err', icon: 'err', title: r.error === 'taken' ? $t("Этот тикет уже занят") : $t("Пул уже закрыт"), text: r.error === 'taken' ? $t("Выбери другой тикет") : $t("Открываем новый") });
    if (r.error === 'taken'){ poolGuess = poolRand(); renderPool(); } else poolLoad(); return; }
  setBalance(S.balance - poolFee); Sfx.coin(); haptic('medium');
  poolView = r.pool; renderPool(); poolTick();
};
/* победитель крафтит на банк: обычный крафт, ставка — банк (не со своего баланса), твоя ставка на главном экране не меняется */
function poolCraft(stake){
  if (S.busy) return;
  const prev = S.pool = { stake, prevTon: S.ton, prevGifts: S.gifts.slice() }; S.ton = stake; S.gifts = []; renderBet(true);
  $('craft').onclick();
  // крафт забирает S.pool синхронно, до первой паузы; если флаг остался — крафт не стартовал: откатываем, чтобы следующий обычный крафт не прошёл бесплатно
  if (S.pool === prev){ S.pool = null; S.ton = prev.prevTon; S.gifts = prev.prevGifts; renderBet(); }
}
