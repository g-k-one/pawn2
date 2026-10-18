/* =========================================================
   API — граница между интерфейсом и «сервером».
   Сейчас это мок: всё считается в браузере (seed, баланс, инвентарь), прогресс — в localStorage.
   При переносе на бэкенд меняется только этот файл: каждая функция → запрос к эндпоинту из docs/BACKEND.md.
   Сигнатуры и форма ответов остаются, интерфейс трогать не нужно. Сбои из дебаг-панели тоже живут здесь —
   так интерфейс получает их так же, как настоящие ошибки сервера.
   ========================================================= */
const dbgFail = kind => { if (S.dbg.fail !== kind) return false; S.dbg.fail = null; return true; };
const API = {
  /* POST /craft {ton_bet_nano, gift_ids, client_seed} → результат крафта с доказательством pawn-pf-v1.
     Мок: ролл по текущей эпохе (05-craft.js → fair). Ошибка → ставка и подарки остаются у игрока */
  async craft(stake, gifts, tonStake){ track('craft', { stake, gifts: gifts.length }); if (dbgFail('craft')) throw new Error('craft_failed'); return fair(stake, gifts, tonStake); },
  /* POST /craft/:id/claim {how: 'take'|'sell'} — забрать NFT в инвентарь или продать. Мок: ничего не делает, баланс и инвентарь меняет finish() */
  async claimCraft(r, how){ track('claim', { how, nft: !!r.nft }); return { ok: true }; },
  /* POST /cases/:id/open {mult} → ролл кейса с доказательством. Цена списывается сервером */
  async openCase(c, m = 1){ track('case_open', { id: c.id, mult: m }); if (dbgFail('case')) throw new Error('case_failed'); return rollCase(c, m); },
  /* GET /fair/epoch → {epoch_id, commitment, client_seed} — хеш зерна до игры */
  receipt: () => receiptNow(),
  /* POST /fair/rotate {client_seed?} → раскрытое зерно прошлой эпохи + хеш новой */
  async rotateSeed(newClient = true){ track('seed_rotate'); return revealEpoch(newClient); },
  /* POST /wallet/withdraw {gift_id} — вывод ОДНОГО NFT (комиссия OUT_FEE). Ответ: {ok} | {ok:false, error:'relayer'|'failed'} */
  async withdrawNft(g){ track('withdraw', { value: g.value });
    if (dbgFail('relayer')) return { ok: false, error: 'relayer' };
    if (dbgFail('out')) return { ok: false, error: 'failed' };
    return { ok: true }; },
  /* POST /wallet/deposit {amount_nano, boc} — бэкенд ждёт подтверждения транзакции в сети и зачисляет. Мок: зачисляем сразу */
  async confirmDeposit(amount, boc){ track('deposit', { amount }); return { ok: true }; },
  /* POST /inventory/sell {gift_ids} → {balance}. Мок: сумма по оценке подарков */
  async sellNfts(list){ track('sell', { n: list.length }); return { ok: true, amount: Math.round(list.reduce((a, g) => a + g.value, 0) * 100) / 100 }; },
  /* --- PvP крафт (эксперимент, 16a-pvp.js) --- */
  /* GET /pvp?fee_nano → текущая комната: {id, fee, commitment, state, endsAt, bank, entries[]} (чужие тикеты скрыты до розыгрыша) */
  async pvpOpen(fee){ track('pvp_open', { fee }); return pvpOpenMock(fee); },
  /* POST /pvp/join {fee_nano, guess} — взнос списывается сервером. Ответ {ok, room} | {ok:false, error:'taken'|'closed'|'already'} */
  async pvpJoin(fee, guess){ track('pvp_join', { fee }); return pvpJoinMock(fee, guess); },
  /* GET /pvp/:id — состояние; после таймера — тикет, победители, твой итог (my: доля, множитель, выплата) и доказательство (domain 'pvp') */
  /* POST /pvp/change {fee_nano, guess} — сменить тикет после входа; можно, пока до старта > 5 с. {ok, room} | {ok:false, error:'locked'|'taken'|'closed'} */
  async pvpChange(fee, guess){ track('pvp_change', { fee }); return pvpChangeMock(fee, guess); },
  async pvpState(fee){ return pvpStateMock(fee); },
  /* --- предикты (эксперимент, 16b-bets.js) --- */
  /* POST /bets {bets: [{bet, sel, amount_nano}], client_seed} → тикет, какие ставки сыграли, выплата и доказательство (domain 'bets').
     Ставку списывает и выплату зачисляет сервер; лимиты — BET_MAX на ставку за раунд и BETS_MAX_WIN на выигрыш за раунд при любом тикете (проверяет и сервер) */
  /* --- бонусы: проверка и начисление — на сервере --- */
  /* POST /achievements/:id/check → {ok} — условие проверяется по нажатию «Проверить». Мок: условие считается в браузере */
  async checkAch(id, okFn){ await wait(500); return { ok: !!okFn() }; },
  /* POST /referrals/claim → {ok, amount} — забрать начисления за друзей */
  async claimRef(){ return { ok: true }; },
  /* POST /tasks/restore-day → {ok} — восстановить пропущенный день недели за 0.5 GRAM */
  async restoreDay(){ return { ok: true }; },
  /* POST /promo {code} → {ok, kind:'gram', amount} — GRAM на баланс | {ok, kind:'bonus', pct, max, left} — +pct% к ближайшему пополнению,
     не больше max GRAM, действует left мс | {ok:false, error:'unknown'|'used'|'expired'}. Код — один раз на игрока. Мок: тестовые коды */
  async promo(code, dbg){ track('promo');
    const P = { PAWN5: { kind: 'gram', amount: 5 }, BONUS10: { kind: 'bonus', pct: 10, max: 2, left: 600e3 }, BONUS50: { kind: 'bonus', pct: 50, max: 5, left: 1800e3 } }[code];
    if (!P) return { ok: false, error: 'unknown' }; if ((S.promoUsed ||= []).includes(code) && !dbg) return { ok: false, error: 'used' };
    S.promoUsed.push(code); return { ok: true, ...P }; },
  /* дебаг (только тест): баланс = v или + v. В бою этого эндпоинта нет */
  async dbgBalance(v, add){ return { ok: true }; },
  async dbgBonusOff(){ return { ok: true }; },   // дебаг: убрать бонус к пополнению
  /* дебаг «Нагрузка»: лента потоком (на сервере — боты играют, пока поток включён), спам запросов, боты. Мок — только лента и задержка */
  async dbgLive(ms){ return { ok: true }; },
  async dbgSpam(n){ const ms = await Promise.all(Array.from({ length: n }, async () => { const t = performance.now(); await netLag(); return performance.now() - t; })); return { ok: true, mock: true, ms, err: 0 }; },
  async dbgBots(){ return { ok: false, mock: true }; },
  async dbgRace(){ return { ok: false, mock: true }; },
  async dbgMax(){ return { ok: false, mock: true }; },
  async bets(list){ track('bets', { n: list.length, total: list.reduce((a, b) => a + b.amount, 0) }); return betsMock(list); },
};

/* сеть: каждый запрос к «серверу» проходит здесь. Нет интернета — сразу ошибка (интерфейс вернёт ставку и покажет, что делать).
   Дебаг → «Крафт» → «Сервер отвечает»: искусственная задержка или «нет связи» — так на телефоне видны все состояния ожидания */
const netLag = () => (S.dbg.net === 'off' || navigator.onLine === false) ? Promise.reject(new Error('offline')) : S.dbg.net > 0 ? wait(S.dbg.net) : Promise.resolve();
for (const k of ['craft', 'claimCraft', 'openCase', 'rotateSeed', 'withdrawNft', 'confirmDeposit', 'sellNfts', 'pvpJoin', 'pvpChange', 'bets', 'checkAch', 'claimRef', 'restoreDay', 'promo', 'dbgBalance', 'dbgBonusOff']){
  const f = API[k]; API[k] = async (...a) => { await netLag(); return f.apply(API, a); }; }
/* списки с сервера (история, топ, друзья, задания, достижения): GET-запрос. Мок: данные уже в браузере — только задержка сети */
API.list = async key => { await netLag(); return { ok: true }; };
/* скелеты: первое открытие списка — серые карточки той же формы, пока не придёт ответ; дальше — сразу последние данные и тихое
   обновление в фоне. Ответ быстрее 120 мс — скелет не показывается вовсе (без мигания). Ошибка — «Не удалось загрузить» и «Повторить» */
const LOADED = new Set();
const SKEL = { card: () => '<div class="sk sk-card"></div>'.repeat(4),
  row: () => '<div class="sk-row"><i class="sk sk-av"></i><span><b class="sk"></b><small class="sk"></small></span><em class="sk"></em></div>'.repeat(6),
  stat: () => '<div class="sk sk-card big"></div><div class="sk-grid">' + '<div class="sk sk-tile"></div>'.repeat(4) + '</div><div class="sk sk-card"></div>' };
function skelGate(key, el, rerender, kind = 'card', head = ''){
  if (LOADED.has(key)){ API.list(key).catch(() => {}); return false; }
  const t = setTimeout(() => { el.innerHTML = head + `<div class="skel">${SKEL[kind]()}</div>`; }, 120);
  API.list(key).then(() => { clearTimeout(t); LOADED.add(key); rerender(); }, () => { clearTimeout(t);
    el.innerHTML = head + `<div class="sk-err"><b>${$t("Не удалось загрузить")}</b><small>${$t("Проверь интернет и попробуй ещё раз")}</small><button class="pill-btn">${$t("Повторить")}</button></div>`;
    el.querySelector('.sk-err .pill-btn').onclick = () => { haptic(); rerender(); }; });
  return true;
}
/* кнопка-действие ждёт сервер: спиннер внутри (ширина не меняется), повторное нажатие не проходит; ошибка — кнопка возвращается и уведомление */
async function btnWait(btn, p){ btn?.classList.add('ld');
  try { return await p; } catch(e){ notify({ type: 'err', icon: 'err', title: e?.message === 'offline' ? $t("Нет связи") : $t("Сервер не ответил"), text: $t("Попробуй ещё раз") }); return null; }
  finally { btn?.classList.remove('ld'); } }
/* игра ждёт сервер внутри анимации: если ответа нет дольше 0.4 с — под тикетом три точки, дольше 5 с — «Связь медленная, ждём ответ» */
function netWait(p){ const el = $('fxWait'), t1 = setTimeout(() => el.classList.add('on'), 400), t2 = setTimeout(() => el.classList.add('slow'), 5000);
  const done = () => { clearTimeout(t1); clearTimeout(t2); el.classList.remove('on', 'slow'); }; p.then(done, done); return p; }
/* плашка «Нет связи» сверху — пока нет интернета (или так выбрано в дебаге) */
function netBar(){ let el = $('netBar'); if (!el){ el = document.createElement('div'); el.id = 'netBar'; el.className = 'abs netbar';
    el.innerHTML = `${svg('<path d="M3 3l18 18M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.2-2.5M19 12.9a10 10 0 0 0-2.4-1.7M2 9.3a15 15 0 0 1 4.6-2.8M22 9.3A15 15 0 0 0 11 5.1"/><circle cx="12" cy="20" r="1"/>')}<span>${$t("Нет связи — проверь интернет")}</span>`; $('fx').parentNode.appendChild(el); }
  const off = S.dbg.net === 'off' || navigator.onLine === false; el.classList.toggle('on', off); document.body.classList.toggle('netoff', off); }   // уведомления — ниже плашки
addEventListener('online', netBar); addEventListener('offline', netBar);

/* ---------- аналитика: события воронки. Мок копит их в window.__pawnEvents; в бою — отправка на сервер/в счётчик ---------- */
const EVENTS = window.__pawnEvents = [];
function track(name, props = {}){ EVENTS.push({ name, t: Date.now(), ...props }); if (EVENTS.length > 200) EVENTS.shift(); }

/* ---------- сохранение прогресса (мок базы данных) ----------
   Что хранит бэкенд в бою — то здесь пишется в localStorage: баланс, XP, инвентарь, история, задания, запас кейсов,
   достижения, эпоха provably fair (с зерном — только в моке!), nonce и client seed. Настройки (звук, язык…) — отдельными ключами bm-*.
   NFT в сохранении — ссылкой «имя#номер» на запись из relay.json */
const Store = (() => {
  const NKEY = n => n.name + '#' + n.num, NBY = new Map(NFTS.map(n => [NKEY(n), n])), NSET = new Set(NFTS);
  const CAP = 200;                                             // в истории храним последние 200 записей каждого вида
  const mskDay = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);   // сутки по Москве: задания обновляются в 00:00 МСК
  const snapshot = () => ({ v: 1, day: mskDay(), balance: S.balance, xp: S.xp, inv: INV, tasks: S.tasks, week: S.week, stock: S.stock, ach: S.ach,
    hist: { crafts: S.hist.crafts.slice(0, CAP), cases: S.hist.cases.slice(0, CAP), wallet: S.hist.wallet.slice(0, CAP), rewards: S.hist.rewards.slice(0, CAP) },
    nonce: S.nonce, clientSeed: S.clientSeed, bonus: S.bonus, promoUsed: S.promoUsed, ep: S.ep && { id: S.ep.id, seed: S.ep.seed, commitment: S.ep.commitment }, refPending: REF.pending });
  const ser = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && NSET.has(x) ? { $n: NKEY(x) } : x);
  let last = '';
  function save(){
    if (S.busy || !S.ep) return;                               // посреди крафта не пишем: состояние промежуточное
    try { const j = ser(snapshot()); if (j !== last){ localStorage.setItem(SAVE_KEY, j); last = j; } } catch(_){}
  }
  function load(){
    if (!SAVE) return;
    const d = JSON.parse(JSON.stringify(SAVE), (k, x) => x && typeof x === 'object' && x.$n ? NBY.get(x.$n) || NFTS.find(n => n.name === x.$n.split('#')[0]) || NFTS[0] : x);
    S.balance = d.balance; S.xp = d.xp; INV = d.inv; S.stock = d.stock; S.ach = d.ach; S.week = d.week; REF.pending = d.refPending || 0;
    Object.assign(S.hist, d.hist); S.nonce = d.nonce; S.clientSeed = d.clientSeed; S.bonus = d.bonus || null; S.promoUsed = d.promoUsed || [];
    // новый день по Москве — задания дня с нуля (в бою это делает сервер)
    S.tasks = d.day === mskDay() ? d.tasks : { early: 0, turnover: 0, crafts: 0, done: {} };
    if (d.ep){ const proofs = [...S.hist.crafts, ...S.hist.cases].map(x => x.r.proof).filter(p => p.epoch_id === d.ep.id && !p.server_seed);
      setEpoch(Promise.resolve({ ...d.ep, proofs })); }
    $('bal').textContent = fmt(S.balance);
  }
  function reset(){ try { localStorage.removeItem(SAVE_KEY); } catch(_){} last = ''; Store.off = true; location.reload(); }
  return { save, load, reset, off: false };
})();
Store.load();
setInterval(() => { if (!Store.off && !document.hidden) Store.save(); }, 2000);
addEventListener('pagehide', () => Store.off || Store.save());
document.addEventListener('visibilitychange', () => { if (document.hidden && !Store.off) Store.save(); });

/* ---------- нет сети: одно уведомление, пока не вернётся ---------- */
addEventListener('offline', () => notify({ type: 'warn', icon: 'warn', ms: 6000, title: $t("Нет сети"), text: $t("Крафт и кошелёк заработают, когда интернет вернётся") }));
addEventListener('online', () => notify({ type: 'ok', icon: 'ok', title: $t("Сеть снова есть") }));
track('app_open', { lang: LANG, saved: !!SAVE });
