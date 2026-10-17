/* =========================================================
   КРАФТ
   ========================================================= */
/* заглушка: удар молота, вспышка цветом тира, тост. Настоящий крафт подключится сюда */
/* ---------- Provably Fair: протокол pawn-pf-v1 (как в бэкенде и на сайте проверки) ----------
   До игры показываем commitment = SHA-256 от 32 байт server seed. Ролл: HMAC-SHA256(зерно, JSON ["pawn-pf-v1", эпоха, домен, client seed, nonce, блок]),
   восемь 32-битных чисел big-endian, первое < 4 294 900 000 → mod 100 000; не подошло ни одно — следующий блок.
   Эпоха: зерно загадано заранее, его хеш виден; игры идут с растущим nonce; зерно раскрывается, когда игрок меняет свой ключ, и начинается новая эпоха */
const PF_VER = 'pawn-pf-v1';
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const enc = t => new TextEncoder().encode(t);
const unhex = h => Uint8Array.from(h.match(/../g).map(x => parseInt(x, 16)));
const sha = async b => hex(await crypto.subtle.digest('SHA-256', b));
const uuid = () => { if (crypto.randomUUID) return crypto.randomUUID(); const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = b[6] & 15 | 64; b[8] = b[8] & 63 | 128; const h = hex(b); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
const nano = v => BigInt(Math.round(v * 100)) * 10000000n;          // суммы в прототипе — с точностью до сотых
S.clientSeed = 'gk-' + hex(crypto.getRandomValues(new Uint8Array(4)));
S.nonce = 0;
async function rollOf(seed, epoch, domain, clientSeed, nonce){
  const key = await crypto.subtle.importKey('raw', unhex(seed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  for (let block = 0; ; block++){
    const dv = new DataView(await crypto.subtle.sign('HMAC', key, enc(JSON.stringify([PF_VER, epoch, domain, clientSeed, String(nonce), String(block)]))));
    for (let i = 0; i < 8; i++){ const w = dv.getUint32(i * 4, false); if (w < 4294900000) return { roll: w % TICKETS, block }; }
  }
}
async function newEpoch(){ const seed = hex(crypto.getRandomValues(new Uint8Array(32))); return { id: uuid(), seed, commitment: await sha(unhex(seed)) }; }
const openEpoch = () => newEpoch().then(e => Object.assign(e, { proofs: [] }));
let epochP = null;                                             // текущая эпоха: зерно загадано, хеш виден до игр
// S.ep — та же эпоха синхронно (для сохранения); ставим только если за это время эпоху не сменили
function setEpoch(p){ epochP = p; p.then(e => { if (epochP === p) S.ep = e; }); return p; }
setEpoch(openEpoch());
/* раскрыть зерно эпохи: всем её доказательствам дописываем server seed, ключ игрока меняется, загадывается новая эпоха */
async function revealEpoch(newClient = true){
  const e = await epochP; setEpoch(openEpoch());
  e.proofs.forEach(p => p.server_seed = e.seed); e.revealed = true;
  if (newClient) S.clientSeed = 'gk-' + hex(crypto.getRandomValues(new Uint8Array(4)));
  return e;
}
const proofBase = (ep, nonce, domain, block, roll) => ({ version: PF_VER, reference: String(nonce), request_id: uuid(), epoch_id: ep.id, commitment: ep.commitment,
  client_seed: S.clientSeed, server_seed: '', nonce: String(nonce), domain, block_counter: String(block), roll });
/* подтверждение хеша до игры — его сверяет сайт проверки */
async function receiptNow(){ const e = await epochP; return { version: PF_VER, epoch_id: e.id, commitment: e.commitment, client_seed: S.clientSeed }; }   // без номера игры — подходит ко всей эпохе
/* проверка доказательства прямо в приложении — тот же алгоритм, что в fair-verify.js */
async function checkProof(p){
  const hashOk = await sha(unhex(p.server_seed)) === p.commitment;
  const { roll, block } = await rollOf(p.server_seed, p.epoch_id, p.domain, p.client_seed, p.nonce);
  const ticketOk = hashOk && roll === p.roll && String(block) === p.block_counter;
  let rule = await sha(enc(JSON.stringify(p.rules))) === p.rules_hash;
  if (p.domain === 'craft'){
    const ppm = craftPpm(p.rules, p.roll), sg = p.rules.segments.find(x => p.roll >= x.start && p.roll <= x.end), pay = BigInt(p.inputs.bet_nano) * ppm / BigInt(p.rules.multiplier_scale);
    rule = rule && p.result.zone === sg.zone && BigInt(p.result.multiplier_ppm) === ppm && BigInt(p.result.payout_nano) === pay && BigInt(p.result.ton_payout_nano) + BigInt(p.result.gift_payout_value_nano) === pay;
  } else if (p.domain === 'pvp'){
    // PvP: client seed — хеш списка загаданных тикетов; победители — все с наименьшей разницей; крафт доли банка — по правилам крафта
    const d = p.inputs.entries.map(g => Math.abs(+g - p.roll)), best = Math.min(...d), w = d.flatMap((x, i) => x === best ? [i] : []);
    const share = BigInt(p.inputs.bank_nano) / BigInt(w.length) / 10000000n * 10000000n, ppm = craftPpm(p.rules.craft, p.roll);
    rule = rule && await sha(enc(JSON.stringify(p.inputs.entries.map(Number)))) === p.client_seed && best === p.result.distance && JSON.stringify(w) === JSON.stringify(p.result.winners) &&
      BigInt(p.result.share_nano) === share && BigInt(p.result.multiplier_ppm) === ppm && BigInt(p.result.payout_nano) === share * ppm / BigInt(p.rules.craft.multiplier_scale);
  } else if (p.domain === 'bets'){
    // предикты: каждая ставка выиграла по правилу своего вида; выплата — сумма ставок × множитель (RTP · тикетов / исходов), до сотых вниз
    const res = betsJudge(p.rules, p.inputs.bets, p.roll);
    rule = rule && JSON.stringify(res.wins) === JSON.stringify(p.result.wins) && String(res.payout) === p.result.payout_nano;
  } else { let tot = 0; const rw = p.rules.rewards.find(x => (tot += x.weight) > p.roll); rule = rule && rw.kind === p.result.kind && rw.amount === p.result.amount; }
  return { hash: hashOk, ticket: ticketOk, rule: ticketOk && rule };
}
/* ---------- дебаг: выбрать исход следующего крафта ---------- */
S.dbg = { arOut: null, btOut: null, arBots: null, tier: -1, near: false, keep: false, prevDelay: null, freeCases: false, ticket: null, fail: null, noOnb: (() => { try { return localStorage.getItem('bm-onb-off') === '1'; } catch(_){ return false; } })(),
  pvp: (() => { try { return localStorage.getItem('bm-pvp') === '1'; } catch(_){ return false; } })(),   // эксперимент «PvP крафт» — по умолчанию выкл
  bets: (() => { try { return localStorage.getItem('bm-bets') === '1'; } catch(_){ return false; } })() };   // эксперимент «Предикты» — по умолчанию выкл
function dbgWant(){
  const d = S.dbg; if (d.tier < 0 || d.ticket != null) return null;
  const t = TIERS[d.tier];
  if (d.near && TIERS[d.tier + 1]){ const m = Math.max(150, Math.floor((t.to - t.from + 1) * .04)); return n => n > t.to - m && n <= t.to; }   // «не хватило совсем чуть-чуть»
  return n => n >= t.from && n <= t.to;
}
const dbgLabel = () => S.dbg.ticket != null ? `${$t("тикет")} ${S.dbg.ticket}` : S.dbg.tier < 0 ? $t("выкл") : TIERS[S.dbg.tier].name + (S.dbg.near ? (" " + $t("· у порога")) : '') + (S.dbg.keep ? (" " + $t("· всегда")) : '');
let dbgTab = 'craft';
function renderDbg(){
  const d = S.dbg, last = TIERS.length - 1;
  const chip = (k, v, label, c, dis) => `<button class="dbg-c${d[k] === v ? ' on' : ''}" data-k="${k}" data-v="${v}" style="--c:${c || '#fff'}"${dis ? ' disabled' : ''}>${label}</button>`;
  // вкладки: всё по смыслу, чтобы не листать длинный список
  const tabs = [['craft', $t("Крафт")], ['player', $t("Игрок")], ['exp', $t("Арена и ставки")]];
  const sec = {
    craft: () =>
      `<div class="dbg-l">${$t("Точный тикет")}</div><div class="dbg-t"><input id="dbgTicket" type="number" inputmode="numeric" min="0" max="99999" placeholder="0 – 99 999" value="${d.ticket ?? ''}"><button class="dbg-c" data-k="ticketClear" data-v="1">${$t("Сброс")}</button></div>` +
      `<div class="dbg-l">${$t("Или ранг следующего крафта")}</div><div class="dbg-g">${chip('tier', -1, $t("Случайно"))}${TIERS.map((t, i) => chip('tier', i, t.name, t.c)).join('')}</div>` +
      `<div class="dbg-l">${$t("Где в ранге")}</div><div class="dbg-g">${chip('near', false, $t("Любой тикет"))}${chip('near', true, $t("Почти следующий ранг"), '#ffb835', d.tier === last || d.tier < 0)}</div>` +
      `<div class="dbg-l">${$t("Сколько раз")}</div><div class="dbg-g">${chip('keep', false, $t("Один крафт"))}${chip('keep', true, $t("Каждый крафт"))}</div>` +
      `<div class="dbg-l">${$t("Сбой (один раз)")}</div><div class="dbg-g">${chip('fail', null, $t("Нет"))}${chip('fail', 'craft', $t("Неудачный крафт"), '#FF4C35')}${chip('fail', 'case', $t("Кейс не открылся"), '#FF4C35')}${chip('fail', 'out', $t("Вывод NFT не прошёл"), '#FF4C35')}${chip('fail', 'relayer', $t("Вывод: не написал релееру"), '#FF4C35')}</div>` +
      `<div class="dbg-l">${$t("Супер дроп")}</div><div class="dbg-g"><button class="dbg-c${d.ticket === SUPER.target ? ' on' : ''}" data-k="super" data-v="1" style="--c:#EB57B0">${$t("Выбить супер дроп · тикет")} ${SUPER.target}</button></div>` +
      `<div class="dbg-l">${$t("NFT на главной при смене ставки")}</div><div class="dbg-g">${chip('prevDelay', null, $t("Сразу"))}${chip('prevDelay', 1500, $t("Ответ 1.5 с"))}${chip('prevDelay', 4000, $t("Ответ 4 с"))}</div>` +
      `<p class="dbg-n">${$t("Для ранга подбирается настоящий server seed — проверка честности сходится, но хеш до игры будет другим. Точный тикет подставляется напрямую, проверка для него не сойдётся. Только для тестов прототипа.")}</p>`,
    player: () =>
      `<div class="dbg-l">${$t("Кошелёк")}</div><div class="dbg-g">${[[null, $t("Не подключён")], ['Tonkeeper', 'Tonkeeper'], ['Telegram Wallet', 'Telegram Wallet']].map(([w, l]) => `<button class="dbg-c${(S.wallet?.name || null) === w && (!w || S.wallet?.fake) ? ' on' : ''}" data-k="wallet" data-v="${w || ''}" style="--c:#30A5FF">${l}</button>`).join('')}</div>` +
      `<div class="dbg-l">${$t("Запас бесплатных кейсов")}</div><div class="dbg-g">${[['beast', $t("Бист"), '#EB57B0'], ['musk', $t("Маск"), '#FF4C35']].map(([id, n, c]) => [0, 1, 3, 5].map(v => `<button class="dbg-c${S.stock[id] === v ? ' on' : ''}" data-k="stock" data-id="${id}" data-v="${v}" style="--c:${c}">${n} ×${v}</button>`).join('')).join('')}</div>` +
      `<div class="dbg-l">${$t("Кейсы")}</div><div class="dbg-g">${chip('freeCases', false, $t("По условиям"))}${chip('freeCases', true, $t("Без условий"))}</div>` +
      `<div class="dbg-l">${$t("Онбординг")}</div><div class="dbg-g">${chip('noOnb', false, $t("Показывать"))}${chip('noOnb', true, $t("Выключен"))}<button class="dbg-c" data-k="onbNow" data-v="1">${$t("Показать сейчас")}</button></div>` +
      `<div class="dbg-l">${$t("Сохранённый прогресс")}</div><div class="dbg-g"><button class="dbg-c" data-k="resetSave" data-v="1" style="--c:#FF4C35">${$t("Сбросить и начать заново")}</button></div>`,
    exp: () =>
      `<div class="dbg-l">${$t("Арена: исход боя")}</div><div class="dbg-g">${chip('arOut', null, $t("Как выпадет"))}${chip('arOut', 'win', $t("Победа"), '#12D53D')}${chip('arOut', 'lose', $t("Проигрыш"), '#FF4C35')}</div>` +
      `<div class="dbg-l">${$t("Арена: соперников в новой комнате")}</div><div class="dbg-g">${chip('arBots', null, $t("Случайно"))}${[0, 1, 3, 5].map(n => chip('arBots', n, String(n), '#ff8a3c')).join('')}</div>` +
      `<div class="dbg-l">${$t("Ставки: исход")}</div><div class="dbg-g">${chip('btOut', null, $t("Как выпадет"))}${chip('btOut', 'win', $t("Выигрыш"), '#12D53D')}${chip('btOut', 'lose', $t("Проигрыш"), '#FF4C35')}</div>` +
      `<p class="dbg-n">${$t("Подбирается настоящее зерно под нужный исход — проверка честности сходится.")}</p>`,
  };
  $('dbgBody').innerHTML =
    `<div class="dbg-tabs">${tabs.map(([k, l]) => `<button class="dbg-tab${dbgTab === k ? ' on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>` +
    sec[dbgTab]() +
    // версия сборки и размеры экрана — по скриншоту видно, открыта ли свежая версия (Telegram кэширует) и как посчиталась сцена
    `<p class="dbg-n dbg-ver">${diagLine()}</p>`;
}
$('dbgBody').addEventListener('input', e => { if (e.target.id !== 'dbgTicket') return; const v = e.target.value.trim(); S.dbg.ticket = v === '' ? null : Math.max(0, Math.min(TICKETS - 1, Math.floor(+v) || 0)); if (S.dbg.ticket != null) S.dbg.tier = -1; });
$('dbgBody').addEventListener('click', e => {
  const tb = e.target.closest('.dbg-tab'); if (tb){ dbgTab = tb.dataset.tab; haptic(); renderDbg(); $('dbgBody').scrollTop = 0; return; }
  const c = e.target.closest('.dbg-c'); if (!c || c.disabled) return;
  const k = c.dataset.k, v = c.dataset.v;
  if (k === 'wallet'){ S.wallet = v ? { name: v, addr: 'UQBv…k3Qf', fake: true } : null; syncBalBtn(); haptic(); renderDbg(); return; }   // дебаг: имитация подключённого кошелька
  if (k === 'resetSave'){ haptic('medium'); Store.reset(); return; }
  if (k === 'ticketClear'){ S.dbg.ticket = null; haptic(); renderDbg(); return; }
  if (k === 'stock'){ S.stock[c.dataset.id] = +v; haptic(); renderDbg(); return; }
  if (k === 'onbNow'){ hideDrawer(); setTimeout(() => Onb.start(true), 300); return; }
  if (k === 'arOut' || k === 'btOut' || k === 'arBots'){ S.dbg[k] = v === 'null' ? null : k === 'arBots' ? +v : v; haptic(); renderDbg(); return; }
  if (k === 'pvp'){ S.dbg.pvp = v === 'true'; try { localStorage.setItem('bm-pvp', S.dbg.pvp ? '1' : '0'); } catch(_){} haptic(); renderDbg(); renderModes(); return; }
  if (k === 'noOnb'){ S.dbg.noOnb = v === 'true'; try { localStorage.setItem('bm-onb-off', S.dbg.noOnb ? '1' : '0'); } catch(_){} haptic(); renderDbg(); return; }
  if (k === 'super'){ S.dbg.ticket = SUPER.target; S.dbg.tier = -1; haptic(); renderDbg(); return; }
  S.dbg[k] = k === 'tier' ? +v : k === 'prevDelay' ? (v === 'null' ? null : +v) : k === 'fail' ? (v === 'null' ? null : v) : v === 'true';
  if (k === 'tier') S.dbg.ticket = null;
  if (S.dbg.tier < 0 || S.dbg.tier === TIERS.length - 1) S.dbg.near = false;
  haptic(); renderDbg();
});
$('dbgDone').onclick = () => {
  hideDrawer();
  if (S.dbg.fail) notify({ type: 'warn', icon: 'bug', color: '#FF4C35', title: { craft: $t("Дебаг: следующий крафт не удастся"), case: $t("Дебаг: следующий кейс не откроется"), out: $t("Дебаг: следующий вывод NFT не пройдёт"), relayer: $t("Дебаг: вывод без сообщения релееру") }[S.dbg.fail], text: S.dbg.fail === 'out' || S.dbg.fail === 'relayer' ? $t("Увидишь уведомление об ошибке") : $t("Увидишь экран неудачи") });
  else if (S.dbg.ticket != null) notify({ type: 'warn', icon: 'bug', color: S.dbg.ticket === SUPER.target ? '#EB57B0' : null, title: S.dbg.ticket === SUPER.target ? $t("Дебаг: супер дроп") : `${$t("Дебаг: тикет")} ${S.dbg.ticket}`, text: S.dbg.ticket === SUPER.target ? `${$t("Следующий крафт от {0} GRAM выбьет тикет", SUPER.min)} ${SUPER.target}` : $t("для следующего крафта") });
  else if (S.dbg.tier >= 0) notify({ type: 'warn', icon: 'bug', color: TIERS[S.dbg.tier].c, title: `${$t("Дебаг:")} ${TIERS[S.dbg.tier].name}${S.dbg.near ? (" " + $t("у порога")) : ''}`, text: S.dbg.keep ? $t("для каждого крафта") : $t("только для следующего крафта") });
  else notify({ type: 'info', icon: 'bug', title: $t("Дебаг выключен"), text: $t("Исход снова случайный") });
};
// выплата крафта по тикету (общая для обычного и PvP крафта): множитель ранга; от NFT_FROM — самый дорогой NFT не дороже выигрыша, остаток — GRAM
function payoutOf(bet, roll){
  const ti = tierOfTicket(roll), ppm = craftPpm(CRAFT_RULES, roll), payout = bet * ppm / 1000000n, win = Number(payout) / 1e9;
  let nft = null, giftPay = 0n;
  if (win >= NFT_FROM){ const n = NFTS.filter(x => x.price <= win).slice(-1)[0], bg = n.bg;
    nft = { id: 'w' + Date.now(), num: n.num, nft: n, a: bg[0], b: bg[1], p: bg[2], value: n.price }; giftPay = nano(n.price); }
  return { ti, ppm, payout, win, nft, giftPay, tonPay: payout - giftPay };
}
async function fair(stake, gifts = [], tonStake = stake){
  const nonce = ++S.nonce, want = dbgWant(), domain = 'craft', forced = !!want || S.dbg.ticket != null;
  // дебаг играет в отдельной одноразовой эпохе, раскрытой сразу — основную эпоху не трогает
  let ep = forced ? await newEpoch() : await epochP, { roll, block } = await rollOf(ep.seed, ep.id, domain, S.clientSeed, nonce), tries = 0;
  // дебаг: перебираем настоящие зерна, пока ролл не попадёт в нужный диапазон — проверка сходится
  while (want && !want(roll) && tries < 60000){
    const batch = await Promise.all(Array.from({ length: 64 }, async () => { const e = await newEpoch(); return { e, ...(await rollOf(e.seed, e.id, domain, S.clientSeed, nonce)) }; }));
    const hit = batch.find(b => want(b.roll)); tries += batch.length;
    if (hit) ({ e: ep, roll, block } = hit);
  }
  let debug = !!want, manual = false; if (want && !S.dbg.keep) S.dbg.tier = -1;
  if (S.dbg.ticket != null){ roll = S.dbg.ticket; manual = debug = true; if (!S.dbg.keep) S.dbg.ticket = null; }   // тикет задан вручную
  const giftsIn = gifts.map(g => ({ id: g.id, value_nano: String(nano(g.value)) })), tonNano = nano(tonStake);
  const bet = tonNano + giftsIn.reduce((a, g) => a + BigInt(g.value_nano), 0n), { ti, ppm, payout, win, nft, giftPay, tonPay } = payoutOf(bet, roll);
  const proof = { ...proofBase(ep, nonce, domain, block, roll), rules_hash: await sha(enc(JSON.stringify(CRAFT_RULES))), rules: CRAFT_RULES,
    inputs: { bet_nano: String(bet), gifts: giftsIn, ton_bet_nano: String(tonNano) },
    result: { gift_payout_value_nano: String(giftPay), multiplier_ppm: String(ppm), payout_nano: String(payout), segment: TIERS[ti].key, ton_payout_nano: String(tonPay), zone: TIERS[ti].zone } };
  if (forced) proof.server_seed = ep.seed; else ep.proofs.push(proof);
  return S.lastFair = { kind: 'craft', proof, ticket: roll, ti, mult: Math.round(Number(ppm) / 1e4) / 100, stake, win: Math.round(win * 100) / 100, nft, change: Math.floor(Number(tonPay) / 1e7) / 100, debug, manual };
}

/* ---------- настройки: быстрый крафт, звук, экономный режим, демо ---------- */
const LS = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch(_){ return d; } };
const LSset = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch(_){} };
S.fast = LS('bm-fast', false);
S.sound = LS('bm-sound', true);
S.vibro = LS('bm-vibro', true);
S.lang = LANG;
S.lite = LS('bm-lite', !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches));
S.demo = false;
const swOn = (id, on) => { const el = document.querySelector(`#${id} .switch`); if (el) el.classList.toggle('on', on); };
function toggleFast(){ S.fast = !S.fast; swOn('fastRow', S.fast); haptic(); LSset('bm-fast', S.fast); }
function toggleVibro(){ S.vibro = !S.vibro; swOn('vibroRow', S.vibro); LSset('bm-vibro', S.vibro); haptic('medium'); }
function toggleSound(){ S.sound = !S.sound; swOn('soundRow', S.sound); haptic(); LSset('bm-sound', S.sound); if (S.sound) Sfx.tick(.8); }
function applyLite(){ document.body.classList.toggle('lite', S.lite); document.body.classList.toggle('nogl', S.lite || !!S.noGL); }
function setLite(on){
  S.lite = on; swOn('liteRow', on); LSset('bm-lite', on); applyLite(); haptic(); Forge.quality = on ? 0 : 2;
  if (!on){ Glow.resize(); FullGlow.resize(); }
  notify(on ? { type: 'ok', icon: 'leaf', title: $t("Экономный режим"), text: $t("Без свечения и анимаций, крафт сразу показывает итог") } : { type: 'info', icon: 'leaf', title: $t("Экономный режим выключен") });
}
function setDemo(on){
  if (S.busy) return;
  S.demo = on; swOn('demoRow', on); document.body.classList.toggle('demo', on); haptic('medium');
  if (on && typeof modeNow === 'function' && modeNow() !== 'craft') switchMode('craft');   // на арене демо нет
  S.ton = 0; S.gifts = [];
  $('balIco').src = on ? 'assets/fantik.webp' : 'assets/gem-balance.svg';
  $('bal').textContent = on ? '∞' : fmt(S.balance);
  const mt = document.querySelector('.mprof small'); if (mt) mt.textContent = on ? $t("∞ фантиков") : fmt(S.balance) + ' GRAM';
  renderBet(true);
  notify(on ? { type: 'demo', img: 'assets/fantik.webp', title: $t("Демо-режим"), text: $t("Играешь на фантики: баланс бесконечный, подарки недоступны") }
            : { type: 'info', icon: 'coin', title: $t("Демо выключено"), text: $t("Снова играешь на GRAM") });
}

/* ---------- звук (WebAudio, синтез — без файлов). Включается в меню ---------- */
const Sfx = (() => {
  let ac = null;
  const ctx = () => { if (!S.sound) return null; if (!ac){ try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch(_){ return null; } } if (ac.state === 'suspended') ac.resume(); return ac; };
  const env = (a, t, peak, dur) => { const g = a.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + dur); g.connect(a.destination); return g; };
  const tone = (f, dur, peak = .08, type = 'sine', f2) => { const a = ctx(); if (!a) return; const t = a.currentTime, o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur); o.connect(env(a, t, peak, dur)); o.start(t); o.stop(t + dur + .02); };
  const noise = (dur, f, q, peak) => { const a = ctx(); if (!a) return; const t = a.currentTime, b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = a.createBufferSource(), bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(f, t); bp.frequency.exponentialRampToValueAtTime(f * 3, t + dur); bp.Q.value = q;
    s.buffer = b; s.connect(bp); bp.connect(env(a, t, peak, dur)); s.start(t); };
  return {
    // щелчок барабана; hi 0…1 — чем ближе следующий ранг, тем выше
    tick: (p = 1, hi = 0) => tone(1500 + 350 * p + 1100 * hi, .022, .045 * p, 'square'),
    lock: () => { tone(160, .16, .16, 'sine', 55); tone(2400, .03, .04, 'square'); },
    whoosh: () => noise(.45, 300, .8, .1),
    swipe: () => noise(.18, 900, 1.2, .05),
    up: ti => { tone(260 + 70 * ti, .32, .09, 'sawtooth', 900 + 160 * ti); setTimeout(() => tone(1046 + 120 * ti, .25, .05, 'triangle'), 120); },
    rank: ti => { const base = [392, 440, 523, 587, 659][ti]; [0, 4, 7, 12, 16].slice(0, 2 + ti).forEach((s, i) => setTimeout(() => tone(base * 2 ** (s / 12), .5, .07, 'triangle'), i * 90)); },
    clang: () => { tone(1900, .7, .05, 'triangle'); tone(2870, .55, .035, 'sine'); tone(130, .3, .2, 'sine', 45); noise(.14, 2200, .7, .14); },
    coin: () => { tone(1320, .08, .06, 'triangle'); setTimeout(() => tone(1760, .18, .06, 'triangle'), 70); },
    // колокольчики шара предиктов: тихое восходящее арпеджио
    chime: () => [0, 3, 7, 10, 14].forEach((st, i) => setTimeout(() => tone(988 * 2 ** (st / 12), .9, .03, 'sine'), i * 70)),
  };
})();

/* ---------- уведомления: стопка сверху на всю ширину, с иконкой, смахиваются вверх ---------- */
const NICON = {
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.4"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  err: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.4v.4"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.4v.4"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 9h7l-3.5 7.5z"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19l7-7"/>',
  gift: IC.gift,
  candy: '<path d="M7.5 12L3 8v8zM16.5 12L21 8v8z"/><circle cx="12" cy="12" r="5"/>',
  bolt: '<path d="M13.5 2L4 14h6.5L9 22l10-13h-6.6z"/>',
  bug: '<rect x="7" y="7" width="10" height="13" rx="5"/><path d="M12 11v9M7 12H3M21 12h-4M7 17l-3 2M17 17l3 2M8 7L6 4M16 7l2-3"/>',
  vibro: '<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M4.5 8v8M19.5 8v8"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>',
};
const NCOL = { info: '#30a5ff', ok: '#12d53d', err: '#ff4c35', warn: '#ffb835', demo: '#AE3FC4' };
const notesEl = $('notes');
function notesFlip(fn){
  const y = new Map([...notesEl.children].map(e => [e, e.getBoundingClientRect().top]));
  fn();
  [...notesEl.children].forEach(e => { if (!y.has(e)) return; const d = (y.get(e) - e.getBoundingClientRect().top) / K;
    if (Math.abs(d) > .5) e.animate([{ translate: `0 ${d}px` }, { translate: '0 0' }], { duration: 340, easing: 'cubic-bezier(.25,.9,.3,1)' }); });
}
function notify(o){
  if (typeof o === 'string') o = { title: o };
  const type = o.type || 'info', c = o.color || NCOL[type] || NCOL.info, ms = o.ms || 3400, key = o.key || o.title + '|' + (o.text || '');   // одинаковые уведомления склеиваются; key — чтобы не склеивать
  const dup = [...notesEl.children].find(n => n.dataset.key === key && !n.classList.contains('bye'));
  if (dup){ dup.restart(); dup.animate([{ scale: 1.03 }, { scale: 1 }], { duration: 240 }); return; }
  const el = document.createElement('div'); el.className = 'note'; el.dataset.key = key; el.setAttribute('role', 'status');
  el.style.setProperty('--c', c); el.style.setProperty('--ms', ms + 'ms');
  el.innerHTML = `<span class="note-i${o.img ? ' img' : ''}">${o.img ? `<img src="${o.img}" alt="">` : svg(NICON[o.icon || type] || NICON.info)}</span>` +
    `<span class="note-t"><b>${o.title}</b>${o.text ? `<small>${o.text}</small>` : ''}</span>` +
    (o.action ? `<button class="note-a">${o.action.label}</button>` : '') + '<i class="note-bar"></i>';
  let timer = 0, left = ms, t0 = 0;
  const run = () => { t0 = performance.now(); clearTimeout(timer); timer = setTimeout(close, left); el.classList.remove('hold'); };
  const hold = () => { clearTimeout(timer); left -= performance.now() - t0; el.classList.add('hold'); };
  function close(){
    if (el.classList.contains('bye')) return; el.classList.add('bye'); clearTimeout(timer);
    el.animate([{ opacity: +getComputedStyle(el).opacity }, { opacity: 0, translate: '0 -18px', scale: .96 }], { duration: 220, easing: 'ease-in', fill: 'forwards' })
      .onfinish = () => notesFlip(() => el.remove());
  }
  el.close = close;
  el.restart = () => { left = ms; const bar = el.querySelector('.note-bar'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; run(); };
  // тап — закрыть, свайп вверх — смахнуть, удержание — пауза
  let y0 = null, dy = 0;
  el.addEventListener('pointerdown', e => { if (e.target.closest('.note-a')) return; y0 = e.clientY; dy = 0; hold(); try { el.setPointerCapture(e.pointerId); } catch(_){} });
  el.addEventListener('pointermove', e => { if (y0 === null) return; dy = (e.clientY - y0) / K; el.style.transform = `translateY(${dy < 0 ? dy : dy * .25}px)`; el.style.opacity = Math.max(0, 1 + Math.min(0, dy) / 90); });
  const up = () => { if (y0 === null) return; y0 = null; if (dy < -26 || Math.abs(dy) < 4) close(); else { el.style.transform = ''; el.style.opacity = ''; run(); } };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  if (o.action) el.querySelector('.note-a').onclick = () => { o.action.fn(); close(); };
  notesFlip(() => notesEl.prepend(el));
  el.animate([{ opacity: 0, translate: '0 -24px', scale: .94 }, { opacity: 1, translate: '0 0', scale: 1 }], { duration: 420, easing: 'cubic-bezier(.2,1.25,.4,1)' });
  const live = [...notesEl.children].filter(n => !n.classList.contains('bye'));
  if (live.length > 3) live[live.length - 1].close();                      // больше трёх не держим — старое уходит
  run();
  if (S.vibro !== false) try { const h = Telegram.WebApp.HapticFeedback; if (type === 'err') h.notificationOccurred('error'); else if (type === 'ok') h.notificationOccurred('success'); else if (type === 'warn') h.notificationOccurred('warning'); } catch(_){}
}
const toast = (title, type = 'info') => notify({ title, type });

/* ---------- переход: UI тает, рамка панели вытягивается на весь экран (и обратно) ---------- */
const tween = (dur, fn, ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2) => new Promise(res => {
  const t0 = performance.now(); (function f(now){ const k = Math.min(1, (now - t0) / dur); fn(ease(k)); k < 1 ? requestAnimationFrame(f) : res(); })(t0); });
let faded = [];
function fadeUI(out, dur){
  if (out){
    // на арене баланс и лайв-лента остаются — они сквозные, как на главной
    const keepTop = $('fx').classList.contains('arena');
    const els = [...document.querySelectorAll('#scene > *')].filter(el => !/flash|panel/.test(el.className) && !(keepTop && /sheet/.test(el.className))).concat(keepTop ? [] : [document.querySelector('.balance')]);
    faded = els.map(el => el.animate([{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(4px)' }], { duration: dur, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }));
  } else {
    faded.forEach(a => { a.updatePlaybackRate ? a.updatePlaybackRate(a.effect.getTiming().duration / dur) : 0; a.reverse(); });
    const list = faded; faded = [];
    setTimeout(() => list.forEach(a => a.cancel()), dur + 80);
  }
}

/* ---------- крафт ---------- */
$('craft').onclick = async () => {
  if (S.busy) return; $('fxTop').style.visibility = 'hidden';   // ячейки тикета — только с раскрытием
  if (total() <= 0){ strike(.25, REST + 6).then(settle); notify({ type: 'err', icon: 'coin', title: $t("Сначала сделай ставку"), text: S.demo ? $t("Добавь фантики кнопками внизу") : $t("Добавь GRAM или подарки кнопками внизу") }); haptic('rigid'); $('bet').animate([{ translate: '-6px 0' }, { translate: '6px 0' }, { translate: '0 0' }], { duration: 220, iterations: 2 }); return; }
  if (total() < BET_MIN || total() > BET_MAX){ haptic('rigid'); return notify({ type: 'err', icon: 'coin', title: total() < BET_MIN ? `${$t("Минимальная ставка {0} GRAM", BET_MIN)}` : `${$t("Максимальная ставка {0} GRAM", BET_MAX)}`, text: $t("С учётом подарков в крафте") }); }
  if (!S.demo && S.ton > S.balance){ notify({ type: 'err', icon: 'coin', title: $t("Недостаточно GRAM"), text: `${$t("На балансе {0} GRAM", fmt(S.balance))}` }); haptic('rigid'); return; }
  S.busy = true; CRAFT.classList.add('busy'); clearInterval(auto);
  const stake = total(), used = S.gifts.slice(), tonStake = S.ton, fast = S.fast || S.lite;
  const pf = API.craft(stake, used, tonStake); pf.catch(() => {});   // ошибку разберём ниже, после анимации удара
  if (S.ton > 0) moveBal(-S.ton);   // в демо — фантики: только всплывашка, настоящий баланс не трогается
  if (fast){ Sfx.lock(); await strike(.8, REST + 10); INV = INV.filter(g => !used.includes(g)); S.gifts = []; await openFx(true); }
  else { INV = INV.filter(g => !used.includes(g)); S.gifts = []; await bigStrike(); }
  let r = null; try { r = await pf; } catch(_){}
  if (!r){                                                     // сбой: ставка возвращается, показываем экран неудачи
    if (tonStake > 0) moveBal(tonStake);
    INV = [...used, ...INV];
    notify({ type: 'err', icon: 'err', title: $t("Ошибка крафта"), text: S.demo ? $t("Попробуй ещё раз") : $t("Ставка и подарки вернулись — попробуй ещё раз") });
    return failScreen('craft', { ton: tonStake, gifts: used });
  }
  r.gifts = used; r.tonStake = tonStake;
  r.super = !S.demo && r.stake >= SUPER.min && r.ticket === SUPER.target ? { ...SUPER.nft } : null;   // загаданный тикет супер дропа
  r.superMiss = !r.super && r.ticket === SUPER.target;
  await reveal(r, fast);
};
async function openFx(fast, mode, glow){
  const fx = $('fx');
  fx.className = 'fx' + (mode ? ' ' + mode : ''); $('fxIn').style.opacity = 0; fx.style.setProperty('--tc', TIERS[S.tier].c);
  FullGlow.set(TIERS[S.tier].glow, true); FX.gain = 1; FX.gainTo = 1; FX.morph = 0; FX.on = true; FX.hot = true; FullGlow.resize();
  fadeUI(true, fast ? 220 : 300);
  fx.classList.add('on');                                     // холст повторяет рамку панели — шов незаметен
  await wait(240);                                            // экран крафта полностью проявился поверх панели…
  document.body.classList.add('glowoff');                     // …и только теперь прячем рамку панели — двух рамок не видно
  Sfx.whoosh(); haptic('medium');
  FullGlow.set(glow || NEUTRAL); FX.gainTo = .4;
  await tween(fast ? 280 : 440, k => FX.morph = k);           // рамка вытягивается на весь экран
  FX.cover = true;                                            // панель под экраном крафта не видна — её не рисуем
  $('fxIn').style.opacity = 1;
}
/* обычный режим: молот на кнопке замахивается, молот с наковальней вырастают из кнопки в большие силуэты,
   рамка тем временем раскрывается на весь экран — удар, искры, и запускается прокрут */
async function bigStrike(){
  const fx = $('fx'), box = $('fxIntro'), ham = box.querySelector('.fi-h'), anv = box.querySelector('.fi-a'), keep = { fill: 'forwards' };
  CRAFT.classList.add('live'); haptic('medium');
  await hamTo([{ rotate: getRot() + 'deg' }, { rotate: '50deg' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.3,1)' });
  /* силуэты стартуют ровно поверх кнопки (масштаб 1/3 — та же геометрия) */
  box.getAnimations({ subtree: true }).forEach(a => a.cancel()); box.querySelectorAll('.fi-sp').forEach(x => x.remove());   // хвосты прошлого удара
  const st = stage.getBoundingClientRect(), cb = CB.getBoundingClientRect(), br = box.getBoundingClientRect();
  const dx = (cb.left + cb.width / 2 - br.left - br.width / 2) / K, dy = (cb.top + cb.height / 2 - br.top - br.height / 2) / K;
  ham.style.rotate = '50deg'; box.style.opacity = 1; HAM.style.visibility = ANV.style.visibility = 'hidden';
  const cbFade = CB.animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: .7 }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
  fx.className = 'fx'; $('fxIn').style.opacity = 0; fx.style.setProperty('--tc', TIERS[S.tier].c);
  FullGlow.set(TIERS[S.tier].glow, true); FX.gain = 1; FX.gainTo = 1; FX.morph = 0; FX.on = true; FX.hot = true; FullGlow.resize();
  fadeUI(true, 300); fx.classList.add('on'); Sfx.whoosh();
  FullGlow.set(NEUTRAL); FX.gainTo = .4;
  setTimeout(() => document.body.classList.add('glowoff'), 240);
  const grow = box.animate([{ transform: `translate(${dx}px,${dy}px) scale(${1 / 3})` }, { transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.55,0,.15,1)', ...keep });
  /* фон кнопки летит вместе с молотом и наковальней: растёт в 3 раза и наливается оранжевым, как раскалённый металл */
  const orb = box.querySelector('.fi-orb'), orbRot = getComputedStyle(CB.querySelector('.orb')).rotate;
  const r0 = parseFloat(orbRot) || 0; orb.style.rotate = '';
  orb.animate([{ filter: getComputedStyle(CB.querySelector('.orb')).filter, opacity: 1, rotate: r0 + 'deg' }, { filter: 'sepia(1) saturate(5) hue-rotate(-28deg) blur(3px)', opacity: .55, rotate: (r0 + 150) + 'deg', offset: .4 },
    { filter: 'sepia(1) saturate(6) hue-rotate(-34deg) blur(12px)', opacity: 0, rotate: (r0 + 320) + 'deg' }], { duration: 560, easing: 'cubic-bezier(.4,0,.4,1)', ...keep });
  ham.animate([{ rotate: '50deg' }, { rotate: '60deg' }], { duration: 600, easing: 'ease-in-out', ...keep });     // замах добирается в полёте
  await Promise.all([grow.finished, wait(240).then(() => tween(520, k => FX.morph = k))]);
  FX.cover = true;
  await wait(70);
  await anvilHit(box, ham, anv, '60deg');
  // кнопка под экраном крафта — возвращаем ей молот в покое
  hamAnim?.cancel(); hamAnim = null; CRAFT.classList.remove('live'); HAM.style.visibility = ANV.style.visibility = ''; cbFade.cancel();
  $('fxIn').style.opacity = 1;
}
/* удар молота по наковальне (общий для крафта и PvP арены): молот падает из замаха, звон, искры, наковальня приседает,
   экран и рамка вздрагивают; затем силуэты тают */
async function anvilHit(box, ham, anv, from){
  const keep = { fill: 'forwards' };
  await ham.animate([{ rotate: from }, { rotate: '-16deg' }], { duration: 110, easing: 'cubic-bezier(.7,0,1,.6)', ...keep }).finished;
  Sfx.clang(); haptic('heavy'); FullGlow.punch(0, .9);

  box.querySelector('.fi-ring').animate([{ opacity: .9, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(1.9,1.4)' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' });
  box.querySelector('.fi-heat').animate([{ opacity: 0 }, { opacity: 1, offset: .12 }, { opacity: 0 }], { duration: 900, easing: 'ease-out' });
  anv.animate([{ transform: 'none' }, { transform: 'translateY(3px) scale(1.07,.88)' }, { transform: 'none' }], { duration: 280, easing: 'ease-out' });
  box.animate([{ translate: '0 0' }, { translate: '-7px 4px' }, { translate: '6px -3px' }, { translate: '-3px 2px' }, { translate: '0 0' }], { duration: 300 });
  // искры — Горн (эффект anvil) поверх всего: веер во все стороны, крупные пролетают «в камеру»; цвет — свечения молота
  if (!S.lite){ const r = box.getBoundingClientRect(), ic = getComputedStyle(box).getPropertyValue('--ic').trim(), hx = /^#[0-9a-f]{6}$/i.test(ic) ? ic : '#ffb347';
    const h = Forge.play('anvil', { x: r.left + r.width * 141 / 258, y: r.top + r.height * 129 / 258, size: 360 });
    h?.set('tint', box.classList.contains('fire') ? [1, .55, .2] : [1, 2, 4].map(k => parseInt(hx.slice(k, k + 2), 16) / 255)); }

  ham.animate([{ rotate: '-16deg' }, { rotate: '-5deg', offset: .3 }, { rotate: '22deg' }], { duration: 340, easing: 'cubic-bezier(.3,1.4,.5,1)', ...keep });
  await wait(420);
  await box.animate([{ opacity: 1, filter: 'blur(0px)', scale: 1 }, { opacity: 0, filter: 'blur(10px)', scale: 1.25 }], { duration: 300, easing: 'cubic-bezier(.5,0,.8,.5)', ...keep }).finished;
  // искры не обрываем: отменённая анимация не удаляет искру, и она застывала на наковальне до следующего крафта
  box.getAnimations({ subtree: true }).forEach(a => { if (!a.effect?.target?.classList?.contains('fi-sp')) a.cancel(); }); box.style.opacity = ''; ham.style.rotate = '';
}
async function closeFx(){
  FX.cover = false; FX.hot = true;
  $('fxIn').style.opacity = 0;
  await wait(220);
  FullGlow.set(TIERS[S.tier].glow); FX.gainTo = 1;
  await tween(520, k => FX.morph = 1 - k);                    // рамка сжимается ровно в рамку панели…
  document.body.classList.remove('glowoff');                  // …под ней снова появляется рамка панели…
  await wait(60);
  fadeUI(false, 360); $('fx').classList.remove('on');         // …и экран крафта тает, открывая интерфейс
  await wait(320);
  FX.on = false; FX.hot = false; $('fx').classList.remove('done', 'case', 'pvpl', 'pvpw', 'lost', 'btmany'); Tilt.drop($('fxDrop'));
  // итог прошлой игры убираем целиком: следующий экран (крафт, бой, кейс) не должен мелькнуть старым тикетом и призом
  ['fxDrop', 'fxPvp', 'fxWin', 'fxBtns', 'fxPl'].forEach(id => $(id)?.replaceChildren()); $('fxTop').style.visibility = 'hidden';
}

/* ---------- раскрытие тикета: «подъём по рангам» ----------
   Число растёт от 00000 к выпавшему тикету, как счётчик в краш-игре. Шкала из пяти рангов под ним
   заполняется; чем ближе следующий порог — тем медленнее счётчик, ярче рамка, выше щелчки,
   и порог начинает пульсировать. Пробил порог — вспышка, новый цвет и ранг. Не дотянул — остановится
   прямо у порога. Всё честно: анимация лишь показывает путь к уже выпавшему тикету. */
const NEUTRAL = ['#ff8a3c', '#c2410c', '#ffc27a', '#ffe6c8'];       // кузня: тёплый огонь вместо холодного сиреневого
const CELL = 96;
const pToTicket = p => { const i = Math.min(TIERS.length - 1, Math.floor(p)), t = TIERS[i]; return Math.min(t.to, t.from + (p - i) * (t.to - t.from + 1)); };
const ticketToP = n => { const i = tierOfTicket(n), t = TIERS[i]; return i + (n - t.from) / (t.to - t.from + 1); };
const hexMix = (a, b, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const glowMix = (i, k) => TIERS[i].glow.map((c, j) => k > 0 && TIERS[i + 1] ? hexMix(c, TIERS[i + 1].glow[j], k) : c);
const EZ = { lin: x => x, in2: x => x * x, out: x => 1 - (1 - x) ** 2, out3: x => 1 - (1 - x) ** 3, out5: x => 1 - (1 - x) ** 5, io: x => x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2 };
const GEN = [$t("Базы"), $t("Удачи"), $t("Меги"), $t("Ультры"), $t("Джекпота")];

function odoBuild(){
  return [...$('digits').children].map(sp => { const strip = sp.querySelector('i'); strip.getAnimations().forEach(a => a.cancel()); strip.style.filter = ''; sp.className = '';
    strip.innerHTML = [9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1].map(d => `<b>${d}</b>`).join(''); return { sp, strip, pos: -1, blur: false }; });
}
// одометр: младшая цифра крутится непрерывно, старшие доворачиваются, когда младшие переходят через 9
function odoSet(D, v, blurOk = true){
  let lower = 0;
  for (let i = 4; i >= 0; i--){
    const place = 10 ** (4 - i); let pos;
    if (i === 4) pos = v % 10;
    else { const r = Math.max(0, lower - 9); pos = Math.floor(v / place) % 10 + r * r * (3 - 2 * r); }   // доворот, пока правая цифра едет 9→0
    lower = pos;
    const d = D[i], dp = Math.abs(pos - d.pos), fastNow = blurOk && d.pos >= 0 && Math.min(dp, 10 - dp) > .28;
    d.pos = pos; d.strip.style.transform = `translateY(${(-(pos + 1) * CELL).toFixed(1)}px)`;
    if (fastNow !== d.blur){ d.blur = fastNow; d.sp.classList.toggle('blur', fastNow); }
  }
}
function ladderBuild(){ const L = $('ladder'); L.className = 'ladder'; L.innerHTML = TIERS.map(t => `<div class="lg" style="--c:${t.c}"><b><i></i></b><span>${t.name}</span></div>`).join(''); return [...L.children]; }
function ladderSet(L, p, q){
  const cur = Math.min(TIERS.length - 1, Math.floor(p));
  L.forEach((el, i) => { el.firstChild.firstChild.style.transform = `translateX(${((Math.max(0, Math.min(1, p - i)) - 1) * 100).toFixed(2)}%)`; el.classList.toggle('cur', i === cur); el.classList.toggle('next', i === cur + 1 && q > 0); });
  if (L[cur + 1]) L[cur + 1].style.setProperty('--q', q.toFixed(2));
}
function rankLabel(ti, pop){
  const t = TIERS[ti], el = $('fxTier');
  $('fx').style.setProperty('--tc', t.c); el.style.setProperty('--tc', t.c); el.textContent = t.name;
  if (pop){ el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
}
function rankUp(ti){
  rankLabel(ti, true);
  FullGlow.set(TIERS[ti].glow); FullGlow.punch(0, .45); Sfx.up(ti); haptic('heavy');
  if (!S.lite) $('fxTop').animate([{ translate: '0 0' }, { translate: '-5px 2px' }, { translate: '4px -2px' }, { translate: '-2px 1px' }, { translate: '0 0' }], { duration: 300 });
}
function needSet(el, tierNow, tk, q, final){
  const nx = TIERS[tierNow + 1];
  if (!nx){ el.className = 'fx-need'; el.innerHTML = final ? '' : $t("максимальный ранг"); return; }
  const rem = nx.from - tk;
  el.style.setProperty('--nc', nx.c);
  if (final){
    const tw = TIERS[tierNow].to - TIERS[tierNow].from + 1;
    if (rem <= Math.max(500, tw * .14)){ el.className = 'fx-need'; void el.offsetWidth; el.className = 'fx-need miss'; el.innerHTML = `${$t("не хватило")}<b>${rem.toLocaleString(LOC)}</b> ${$t("до")} ${GEN[tierNow + 1]}`; }
    else { el.className = 'fx-need'; el.innerHTML = ''; }
    return;
  }
  el.className = 'fx-need' + (q > .45 ? ' hot' : '');
  el.innerHTML = `${$t("до")} ${GEN[tierNow + 1]}<b>${rem.toLocaleString(LOC)}</b>`;
}
/* раскрытие: шкала рангов заполняется как график в краш-игре — всё быстрее и быстрее, у каждого порога
   притормаживает, и может оборваться в любой момент. Цифры тем временем крутятся и встают справа налево,
   старшая (решает ранг) — только когда шкала остановилась, так что по цифрам исход заранее не прочитать.
   Шкала никогда не заходит дальше настоящего тикета и не откатывается назад. */
function climbSim(pf){
  const c = .78, k = .33, out = [0]; let p = 0, t = 0;
  const dt = 1 / 120;
  while (p < pf && t < 14){
    let v = k * (p + c);                                              // разгон, как у множителя в краш-игре
    const nb = Math.floor(p) + 1, d = nb - p;
    if (nb < TIERS.length && d < .16) v *= .06 + .94 * (d / .16) ** 1.6;   // у порога — вязко, почти замирает
    if (p - Math.floor(p) < .07 && p >= 1) v *= 1.7;                  // прорвался — рывок
    p = Math.min(pf, p + v * dt); t += dt; out.push(p);
  }
  return out;                                                          // положение шкалы каждые 1/120 с
}
function spin(r, D, L){
  const digits = String(r.ticket).padStart(5, '0').split('').map(Number), pf = ticketToP(r.ticket);
  // путь шкалы растягиваем минимум до 2.2–2.8 с: иначе при низком тикете шкала замирала в первую секунду и исход был виден заранее
  const path0 = climbSim(pf), N = Math.max(path0.length, Math.round((2.2 + Math.random() * .6) * 120)),
    path = Array.from({ length: N }, (_, i) => path0[Math.round(i / (N - 1) * (path0.length - 1))]), T0 = 900, Tstop = T0 + (path.length - 1) / 120 * 1000;
  const TB = [650, 760, 720, 680, 640], P = [3, 3, 3, 3, 3];
  const END = [Math.max(Tstop, 2700) + 650, 2600, 2050, 1500, 1000];      // младшие встают справа налево, старшая — после остановки шкалы
  const V = [22, 22, 20, 18, 16];
  const R = D.map((d, i) => {
    const s0 = Math.random() * 10, tB = END[i] - TB[i], posA = V[i] * tB / 1000, want = V[i] * TB[i] / 1000 / P[i];
    const minD = Math.max(4, want - 5), DB = minD + ((((digits[i] - s0 - posA - minD) % 10) + 10) % 10);
    return { s0, tB, posA, DB, done: false };
  });
  const dg = $('digits'), need = $('fxNeed');
  $('ladder').classList.remove('anim');
  let tierNow = 0, lastTick = -1, lastTickT = 0, lastHap = 0, stopped = false;
  return new Promise(res => {
    const t0 = performance.now();
    (function f(now){
      const t = now - t0;
      /* барабаны */
      R.forEach((c, i) => {
        if (c.done) return;
        let pos, vel;
        if (t < c.tB){ pos = V[i] * t / 1000; vel = V[i]; }
        else { const k = Math.min(1, (t - c.tB) / TB[i]); pos = c.posA + c.DB * (1 - (1 - k) ** P[i]); vel = c.DB * P[i] * (1 - k) ** (P[i] - 1) / TB[i] * 1000;
          if (k >= 1){ c.done = true; pos = c.posA + c.DB; vel = 0; } }
        const disp = ((c.s0 + pos) % 10 + 10) % 10, d = D[i];
        d.strip.style.transform = `translateY(${(-(disp + 1) * CELL).toFixed(1)}px)`;
        const bl = vel > 7; if (bl !== d.blur){ d.blur = bl; d.sp.classList.toggle('blur', bl); }
        if (c.done){ d.sp.classList.add('lock'); haptic(i ? 'light' : 'heavy'); if (i) Sfx.lock(); }
      });
      /* шкала */
      if (t >= T0 && !stopped){
        const idx = Math.min(path.length - 1, Math.floor((t - T0) / 1000 * 120)), p = path[idx];
        const ti = Math.min(TIERS.length - 1, Math.floor(p));
        if (ti > tierNow){ tierNow = ti; rankUp(ti); }
        const q = tierNow + 1 < TIERS.length ? Math.max(0, Math.min(1, 1 - (tierNow + 1 - p) / .2)) : 0;
        ladderSet(L, p, q);
        FullGlow.set(glowMix(tierNow, q * .55)); FX.gainTo = .45 + .1 * tierNow + .3 * q;
        dg.style.setProperty('--ds', (1 + .05 * q).toFixed(3));
        // обратный отсчёт до следующего ранга: сколько тикетов осталось шкале до порога — тает по мере подъёма
        const nx = TIERS[tierNow + 1], rem = nx ? Math.max(0, nx.from - Math.floor(pToTicket(p))) : 0;
        const nt = nx ? `${$t("до")} ${GEN[tierNow + 1]}<b>${rem.toLocaleString(LOC)}</b>` : $t("максимальный ранг"), nc = 'fx-need' + (q > .4 ? ' hot' : '') + (nx ? '' : ' top');
        if (nt !== need.dataset.t){ need.dataset.t = nt; need.innerHTML = nt; }
        if (nc !== need.className) need.className = nc;
        if (nx) need.style.setProperty('--nc', nx.c);
        const tk = Math.floor(p * 40);
        if (tk !== lastTick && now - lastTickT > 40){ lastTick = tk; lastTickT = now; Sfx.tick(.5 + .5 * q, q); if (q > .3 && now - lastHap > 90){ lastHap = now; haptic('soft'); } }
        if (idx >= path.length - 1){                                   // оборвалась — удар
          stopped = true; FullGlow.punch(0, .5); haptic('heavy'); Sfx.lock();
          $('ladder').animate([{ filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], { duration: 500 });
          dg.classList.add('focus');
        }
      }
      if (!R[0].done) requestAnimationFrame(f); else { dg.classList.remove('focus'); res(); }
    })(t0);
  });
}
async function reveal(r, fast){
  const fx = $('fx'), t = TIERS[r.ti], dg = $('digits'), pf = ticketToP(r.ticket);
  $('fxTop').style.visibility = '';
  dg.className = 'digits run'; dg.style.removeProperty('--tc'); dg.style.setProperty('--ds', 1); dg.style.setProperty('--q', 0);
  $('fxTier').className = 'fx-tier on'; rankLabel(0, false); dg.classList.remove('focus');
  $('fxDrop').innerHTML = ''; $('fxWin').innerHTML = ''; $('fxBtns').innerHTML = '';
  const D = odoBuild(), L = ladderBuild();
  odoSet(D, 0, false); ladderSet(L, 0, 0); $('fxNeed').className = 'fx-need'; $('fxNeed').innerHTML = ''; $('fxNeed').dataset.t = '';
  if (fast){
    await wait(40);
    $('ladder').classList.add('anim'); odoSet(D, r.ticket, false); ladderSet(L, pf, 0);
  } else {
    await wait(260);
    await spin(r, D, L);
    odoSet(D, r.ticket, false);
    needSet($('fxNeed'), r.ti, r.ticket, 0, true);
  }
  /* итог */
  D.forEach((d, i) => { d.sp.classList.remove('blur'); setTimeout(() => d.sp.classList.add('lock'), (4 - i) * 45); });
  rankLabel(r.ti, true); ladderSet(L, pf, 0);
  dg.classList.add('tiered'); dg.style.setProperty('--tc', t.c); dg.style.setProperty('--ds', 1); dg.style.setProperty('--q', 0);
  FullGlow.set(t.glow); FullGlow.punch(0, .8); FX.gainTo = .8; Sfx.lock(); Sfx.rank(r.ti); haptic('heavy');
  await wait(fast ? 380 : 950);
  r.bets ? betsAfter(r) : r.pvp ? pvpAfter(r) : showDrop(r);   // PvP: сначала — кто ближе всех (16a-pvp.js); предикты — какие ставки сыграли (16b-bets.js)
}
/* ---------- дроп: число переезжает наверх, крупный приз проявляется, затем сумма и кнопки ---------- */
/* NFT-подарок в Telegram: t.me/nft/<коллекция без пробелов и знаков>-<номер> */
const nftLink = n => `https://t.me/nft/${n.name.replace(/[^A-Za-z0-9]/g, '')}-${n.num}`;
function openNft(g){ haptic(); tgOpen(nftLink(g.nft)); }
const dropCard = g => { tiltCard($('pz'), 1.4); upgradeImg($('pz').querySelector('.nc-img'), g.nft); Tilt.grab($('pz').querySelector('.nc-t'), () => openNft(g)); };
const PF_LINK = `<div class="fx-links"><button class="btn-link pf" id="fxPfIn">${$t("Проверить честность")}</button><button class="btn-link pf" id="fxShare">${$t("Поделиться")}</button></div>`;
/* поделиться выигрышем: в Telegram — окно «Поделиться» с реф-ссылкой, в браузере — системное или копирование */
// выиграл NFT — сначала ссылка на подарок (Telegram покажет его карточку), затем текст, затем приглашение с реф-ссылкой.
// Без NFT ссылка одна — реф-ссылка; Telegram всегда ставит её первой строкой, поэтому приглашение ссылается на неё
function shareWin(text, g){
  haptic(); const url = g ? nftLink(g.nft) : REF.link;
  text += '\n' + (g ? `${$t("Забирай бонус 10% на первый деп:")} ${REF.link}` : $t("Забирай бонус 10% на первый деп по ссылке"));
  if (tgOpen('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text))) return;
  if (navigator.share) return void navigator.share({ text: url + '\n' + text }).catch(() => {});
  try { navigator.clipboard.writeText(url + '\n' + text).catch(() => {}); } catch(_){}
  notify({ type: 'ok', icon: 'ok', title: $t("Ссылка скопирована"), text: $t("Отправь её друзьям") });
}
function fillDrop(r){
  const drop = $('fxDrop');
  if (false){
  } else if (r.nft){
    drop.innerHTML = `<div class="pz" id="pz">${cardHTML(r.nft, 266, true)}</div>`;
    dropCard(r.nft);
    if (S.demo){
      $('fxWin').innerHTML = `<span>${$t("в демо призы не выдаются")}</span>`;
      $('fxBtns').innerHTML = `<button class="btn-main" id="fxTake">${$t("Ещё раз")}</button>` + PF_LINK;
    } else {
      $('fxWin').innerHTML = r.change > 0 ? `<span>${$t("и на баланс +{0} GRAM", fmt(r.change))}</span>` : '';   // цена NFT — на кнопке «Продать за …»
      $('fxBtns').innerHTML = `<button class="btn-main" id="fxSell">${$t("Продать за {0} GRAM", fmt(r.nft.value))}</button><button class="btn-ghost" id="fxTake">${$t("Забрать")}</button>` + PF_LINK;
    }
  } else {
    drop.innerHTML = `<div class="pz"><div class="tw" id="pz"><img src="assets/hero-gem.webp" alt=""><span class="gl" style="--m:url('assets/hero-gem.webp')"><i></i></span></div></div>`;
    Tilt.add($('pz'), $('pz').querySelector('img'), $('pz').querySelector('.gl i'), 1.5);
    $('fxWin').innerHTML = `<b>+${fmt(r.win)}${S.demo ? `<img class="cur" src="assets/fantik.webp" alt=" ${$t("фантиков")}">` : ' GRAM'}</b><span>${$t("ставка {0} · x{1}", S.demo ? fmt(r.stake) : fmt(r.stake) + ' GRAM', r.mult)}</span>`;
    $('fxBtns').innerHTML = `<button class="btn-main" id="fxTake">${$t("Забрать")}</button>` + PF_LINK;
  }
  if (r.super) $('fxWin').insertAdjacentHTML('beforeend', `<span class="sdnext">${$t("★ А после — супер дроп")}</span>`);
  $('fxTop').querySelector('.sdtip')?.remove();
  if (r.superMiss) $('fxTop').insertAdjacentHTML('beforeend', `<div class="sdtip"><b>${$t("Тикет супер дропа!")}</b> ${S.demo ? $t("В демо не разыгрывается") : `${$t("Нужна ставка от {0} GRAM", SUPER.min)}`}</div>`);
  $('fxPfIn').onclick = () => openPF(r);
  $('fxShare').onclick = () => shareWin(r.nft ? `${$t("Скрафтил {0} #{1} в Pawn", r.nft.nft.name, r.nft.num)}` : `${$t("Скрафтил +{0} GRAM (x{1}) в Pawn", fmt(r.win), r.mult)}`, r.nft);
  $('fxTake').onclick = () => finish(r, 'take');
  if ($('fxSell')) $('fxSell').onclick = () => finish(r, 'sell');
}
async function showDrop(r){
  const stub = false;                                        // NFT при крафте уже известен — сразу показываем
  if (stub){
    // подбор NFT под сумму идёт на бэкенде — пока ждём, показываем заглушку
    $('fxDrop').innerHTML = `<div class="pz"><div class="skel"><span class="shim"></span><span class="tq">${GIFT_Q}</span><b>${$t("Подбираем NFT")}</b><small>${$t("под выигрыш {0} GRAM", fmt(r.win))}</small></div></div>`;
    $('fxWin').innerHTML = `<b>${fmt(r.win)} GRAM</b><span>${$t("ищем лучший подарок на эту сумму…")}</span>`; $('fxBtns').innerHTML = '';
  } else fillDrop(r);
  const top = $('fxTop'), y0 = top.getBoundingClientRect().top;
  $('fx').classList.add('done');
  const y1 = top.getBoundingClientRect().top;
  if (!S.lite) top.animate([{ transform: `translateY(${(y0 - y1) / K}px)` }, { transform: 'none' }], { duration: 720, easing: 'cubic-bezier(.25,.9,.25,1)' });
  setTimeout(() => { FX.hot = false; }, 1200);
  if (!stub){ if (!S.lite) setTimeout(burst, 260); return; }
  await pickNft(r); r.nftReady = true;
  const sk = $('fxDrop').firstElementChild;
  if (sk && !S.lite) await sk.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.9)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' }).finished;
  fillDrop(r); haptic('heavy'); Sfx.rank(r.ti);
  if (!S.lite){ ['fxWin', 'fxBtns'].forEach((id, i) => $(id).animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 120 + i * 120, easing: 'cubic-bezier(.25,.9,.3,1)', fill: 'backwards' })); burst(); }
}
function burst(){
  const box = $('fxDrop');
  for (let i = 0; i < 18; i++){
    const b = document.createElement('i'); b.className = 'burst'; box.appendChild(b);
    const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 90;
    b.animate([{ transform: 'scale(.4)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(0)`, opacity: 0 }],
      { duration: 800 + Math.random() * 500, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'backwards' }).onfinish = () => b.remove();
  }
}
/* ---------- забрать / продать ---------- */
async function finish(r, how){
  if (finish.on) return; finish.on = true;
  const t = TIERS[r.ti];
  let add = r.change;
  if (S.demo) add = r.nft ? 0 : r.win;
  else if (!r.nft) add = r.win;
  else if (how === 'sell') add += r.nft.value;
  else INV = [{ ...r.nft, id: 'g' + Date.now() }, ...INV];
  haptic('medium'); if (add > 0) Sfx.coin();
  if (!S.demo){ API.claimCraft(r, how); logCraft(r, how); bumpTasks(r); xpTurn(r.pvp ? r.pvp.fee : r.stake); setTimeout(checkAch, 1200); }
  renderBet();
  if (r.super){                                               // приз крафта получен — и сверху ещё супер дроп
    if (add > 0) moveBal(add);
    notify(r.nft ? { type: 'ok', color: t.c, img: r.nft.nft.src, title: how === 'sell' ? `${$t("Продано: +{0} GRAM", fmt(add))}` : `${r.nft.nft.name} ${$t("в инвентаре")}`, text: $t("Приз крафта") }
                 : { type: 'ok', color: t.c, img: 'assets/hero-gem.webp', title: `+${fmt(add)} GRAM`, text: $t("Приз крафта зачислен") });
    finish.on = false; return superStage(r);
  }
  await closeFx();
  if (add > 0) moveBal(add);
  if (S.demo) notify(r.nft ? { type: 'demo', img: r.nft.nft.src, title: r.nft.nft.name, text: $t("В реальном режиме он был бы твоим") }
                           : { type: 'demo', img: 'assets/fantik.webp', title: `${$t("Демо: +")}${fmt(add)}`, text: $t("Фантики не настоящие — просто попробовать") });
  else if (!r.nft) notify({ type: 'ok', color: t.c, img: 'assets/hero-gem.webp', title: `+${fmt(add)} GRAM`, text: `${t.name} ${$t("· x{0} · зачислено на баланс", r.mult)}` });
  else if (how === 'sell') notify({ type: 'ok', color: t.c, img: r.nft.nft.src, title: `${$t("Продано: +{0} GRAM", fmt(add))}`, text: `${r.nft.nft.name} ${$t("за {0} GRAM", fmt(r.nft.value))}${r.change > 0 ? ` ${$t("и {0} GRAM сверху", fmt(r.change))}` : ''}` });
  else notify({ type: 'ok', color: t.c, img: r.nft.nft.src, title: `${r.nft.nft.name} ${$t("в инвентаре")}`, text: r.change > 0 ? `${$t("На баланс +{0} GRAM", fmt(r.change))}` : $t("Можно положить в следующий крафт") });
  setTimeout(() => pushLive(liveHTML(r.ticket, { me: true, stake: r.stake, win: r.win, arena: r.pvp ? { bank: r.pvp.bank, n: r.pvp.n } : null })), 300);
  fitBet(); CRAFT.classList.remove('busy'); S.busy = false; finish.on = false; restartAuto();
}
/* неудачный крафт или открытие кейса: грустный смайлик, тикет 00000, «Попробовать ещё раз» и «Вернуться» */
function failScreen(kind, ctx){
  $('fxTop').style.visibility = '';
  const fx = $('fx'), craft = kind === 'craft';
  fx.classList.add('fail');
  if (craft){
    const dg = $('digits'); dg.className = 'digits'; const D = odoBuild(); odoSet(D, 0, false); D.forEach(d => d.sp.classList.add('lock'));
    dg.classList.add('tiered'); dg.style.setProperty('--tc', '#FF4C35'); dg.style.setProperty('--ds', 1); dg.style.setProperty('--q', 0);
    const tl = $('fxTier'); tl.className = 'fx-tier on pop'; tl.style.setProperty('--tc', '#FF4C35'); tl.textContent = $t("Сбой");
    ladderBuild(); $('fxNeed').innerHTML = '';
  }
  $('fxDrop').innerHTML = `<div class="pz"><div class="tw failw" id="pz"><img src="assets/fail.svg" alt=""></div></div>`;
  if (!S.lite) $('pz').animate([{ transform: 'scale(.4) rotate(-20deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, easing: 'cubic-bezier(.3,1.5,.5,1)' });
  const back = craft ? (S.demo ? $t("Фантики остались на месте") : $t("Ставка вернулась на баланс")) : (ctx.c.price ? `${fmt(ctx.c.price)} ${$t("GRAM вернулись на баланс")}` : $t("Кейс остался доступным"));
  $('fxWin').innerHTML = `<b class="failt">${craft ? $t("Крафт не удался") : $t("Кейс не открылся")}</b>${craft ? '' : `<span class="failtk">${$t("тикет 00000")}</span>`}<span>${back}</span>`;
  $('fxBtns').innerHTML = `<button class="btn-main" id="failRetry">${$t("Попробовать ещё раз")}</button><button class="btn-ghost" id="failBack">${$t("Вернуться")}</button>`;
  FullGlow.set(glowOf('#FF4C35')); FullGlow.punch(0, .5); FX.gainTo = .6; Sfx.lock(); haptic('rigid');
  fx.classList.add('done'); setTimeout(() => { FX.hot = false; }, 900);
  const free = () => { CRAFT.classList.remove('busy'); S.busy = false; };
  const restoreBet = () => { if (craft){ S.ton = ctx.ton; S.gifts = ctx.gifts.filter(g => INV.includes(g)); renderBet(); } };
  let on = false;
  $('failBack').onclick = async () => { if (on) return; on = true; haptic(); await closeFx(); fx.classList.remove('fail'); restoreBet(); free(); restartAuto(); if (!craft) openCases(); };
  $('failRetry').onclick = async () => { if (on) return; on = true; haptic('medium');
    if (craft){ await closeFx(); fx.classList.remove('fail'); restoreBet(); free(); setTimeout(() => $('craft').onclick(), 120); }
    else { fx.classList.remove('fail'); caseRun(ctx.c, true); } };
}
/* второй экран: супер дроп поверх приза крафта */
async function superStage(r){
  const g = r.super, ids = ['fxDrop', 'fxWin', 'fxBtns'];
  if (!S.lite) await Promise.all(ids.map(id => $(id).animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.96)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' }).finished));
  Tilt.drop($('fxDrop'));
  $('fxDrop').innerHTML = `<div class="pz" id="pz">${cardHTML(g, 266, true)}</div>`; dropCard(g);
  $('fxWin').innerHTML = `<img class="sdwin" src="assets/superdrop-logo.webp" alt="Super Drop"><span class="sdgot">${$t("Ты первым выбил тикет")} ${tk(r.ticket)}</span>`;
  $('fxBtns').innerHTML = `<button class="btn-main" id="sdSell">${$t("Продать за {0} GRAM", fmt(g.value))}</button><button class="btn-ghost" id="sdTake">${$t("Забрать")}</button>`;
  ids.forEach(id => $(id).getAnimations().forEach(a => a.cancel()));
  if (!S.lite) ids.forEach((id, i) => $(id).animate([{ opacity: 0, transform: id === 'fxDrop' ? 'scale(.7)' : 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: i * 120, easing: 'cubic-bezier(.25,1.3,.4,1)', fill: 'backwards' }));
  FullGlow.set(glowOf('#EB57B0')); FullGlow.punch(0, 1); FX.hot = true; Sfx.rank(4); haptic('heavy');
  if (!S.lite) setTimeout(burst, 200);
  setTimeout(() => { FX.hot = false; }, 1400);
  let on = false;
  const take = async how => {
    if (on) return; on = true; haptic('medium'); Sfx.coin();
    if (how === 'take') INV = [{ ...g, id: 'sd' + Date.now() }, ...INV];
    SUPER.last.unshift(['gk', g.nft.name, $t("только что")]); newSuper();
    await closeFx();
    if (how === 'sell') setBalance(S.balance + g.value);
    notify({ type: 'ok', color: '#EB57B0', img: g.nft.src, title: how === 'sell' ? `${$t("Супер дроп продан: +{0} GRAM", fmt(g.value))}` : `${$t("Супер дроп: {0} твой", g.nft.name)}`, text: $t("Новый загаданный тикет уже в бонусах") });
    setTimeout(() => pushLive(liveHTML(r.ticket, { me: true, stake: r.stake, win: r.win })), 300);
    fitBet(); CRAFT.classList.remove('busy'); S.busy = false; restartAuto();
  };
  $('sdSell').onclick = () => take('sell'); $('sdTake').onclick = () => take('take');
}
