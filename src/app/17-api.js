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
  /* --- крафт в складчину (эксперимент, 16a-pool.js) --- */
  /* GET /pool?fee_nano → открытый пул: {id, fee, commitment, state, seats, bank, entries[]} (чужие тикеты скрыты до розыгрыша) */
  async poolOpen(fee){ track('pool_open', { fee }); return poolOpenMock(fee); },
  /* POST /pool/join {fee_nano, guess} — взнос списывается сервером. Ответ {ok, pool} | {ok:false, error:'taken'|'closed'|'already'} */
  async poolJoin(fee, guess){ track('pool_join', { fee }); return poolJoinMock(fee, guess); },
  /* GET /pool/:id — состояние; после розыгрыша — тикет, победители и доказательство (domain 'pool', зерно раскрыто) */
  async poolState(fee){ return poolStateMock(fee); },
};

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
    nonce: S.nonce, clientSeed: S.clientSeed, ep: S.ep && { id: S.ep.id, seed: S.ep.seed, commitment: S.ep.commitment }, refPending: REF.pending });
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
    Object.assign(S.hist, d.hist); S.nonce = d.nonce; S.clientSeed = d.clientSeed;
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
