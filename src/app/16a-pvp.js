/* =========================================================
   PvP КРАФТ — эксперимент, по умолчанию выключен (Дебаг → «Эксперименты»)
   Комната с таймером: все вносят одинаковый взнос и загадывают тикет 00000–99999 (один тикет — один игрок).
   По таймеру выпадает честный тикет — он же тикет крафта. Кто загадал ближе всех, крафтит на весь банк
   именно с этим тикетом: множитель — ранга выпавшего тикета. Ничья — банк поровну, тикет тот же.
   Один в комнате — крафт твой. Отдельной комиссии нет: весь банк идёт в обычный крафт (RTP 95%).
   Честность: зерно комнаты загадано до первого взноса (хеш виден сразу). Тикет = HMAC(зерно,
   ["pawn-pf-v1", id комнаты, "pvp", SHA-256(JSON тикетов в порядке входа), "0", блок]) — зерно зафиксировано
   раньше ставок, а список ставок — до розыгрыша, поэтому тикет не подогнать ни под одного игрока.
   Мок: соседи по комнате — заглушки (ники NICKS), в бою это живые игроки с сервера. Комната живёт в памяти.
   ========================================================= */
const PVP_FEES = [.5, 1, 5], PVP_TIME = 30, PVP_LOCK = 5;            // взносы, GRAM; длительность комнаты, с; за сколько секунд до старта тикеты фиксируются
let pvpFee = 1, pvpGuess = null, pvpView = null, pvpPoll = 0, pvpKey = '', pvpGo = false;
const pvpRand = () => Math.floor(Math.random() * TICKETS);

/* ---------- мок сервера (вызывается только из API в 17-api.js) ---------- */
const PVP_ROOMS = {};                                                 // текущая комната на каждый взнос
async function pvpNewRoom(fee){
  const e = await newEpoch(), now = Date.now(), t0 = now - Math.random() * 12000, endsAt = t0 + PVP_TIME * 1000;
  const n = Math.random() < .15 ? 0 : 1 + Math.floor(Math.random() * 6), nicks = [...NICKS].sort(() => Math.random() - .5), used = new Set();
  const bots = Array.from({ length: n }, (_, i) => { let g; do g = pvpRand(); while (used.has(g)); used.add(g); return { who: nicks[i % nicks.length], guess: g, at: t0 + Math.random() * (endsAt - 1500 - t0) }; }).sort((a, b) => a.at - b.at);
  return PVP_ROOMS[fee] = { id: e.id, fee, seed: e.seed, commitment: e.commitment, state: 'open', endsAt, bots, entries: [] };
}
function pvpAdvance(p){
  while (p.bots.length && p.bots[0].at <= Date.now()){ const b = p.bots.shift(); if (!p.entries.some(x => x.guess === b.guess)) p.entries.push(b); }
  if (p.state === 'open' && Date.now() >= p.endsAt){ p.state = 'drawing'; p.drawP = pvpDraw(p); }
}
async function pvpDraw(p){
  const guesses = p.entries.map(x => x.guess), hash = await sha(enc(JSON.stringify(guesses)));
  const { roll, block } = await rollOf(p.seed, p.id, 'pvp', hash, 0);
  const dist = guesses.map(g => Math.abs(g - roll)), best = Math.min(...dist), winners = dist.flatMap((d, i) => d === best ? [i] : []);
  const bank = nano(p.fee * guesses.length), share = bank / BigInt(Math.max(1, winners.length)) / 10000000n * 10000000n;   // доля — до сотых, вниз
  const pay = payoutOf(share, roll), rules = { kind: 'pvp', seats: 'timer', fee_nano: String(nano(p.fee)), distance: 'abs', tie: 'split', craft: CRAFT_RULES };
  p.proof = { version: PF_VER, reference: p.id, request_id: uuid(), epoch_id: p.id, commitment: p.commitment, client_seed: hash, server_seed: p.seed,
    nonce: '0', domain: 'pvp', block_counter: String(block), roll, rules_hash: await sha(enc(JSON.stringify(rules))), rules,
    inputs: { entries: guesses.map(String), bank_nano: String(bank) },
    result: { winners, distance: best, share_nano: String(share), multiplier_ppm: String(pay.ppm), payout_nano: String(pay.payout), segment: TIERS[pay.ti].key, zone: TIERS[pay.ti].zone } };
  Object.assign(p, { state: 'done', ticket: roll, winners, pay, share: Number(share) / 1e9 });
}
// разыгранная комната больше не открывается — дальше следующая; но если ты в ней, а итог ещё не забран (claimed), отдаём её
async function pvpOpenMock(fee){
  let p = PVP_ROOMS[fee]; if (p){ pvpAdvance(p); if (p.state === 'drawing') await p.drawP; }
  if (!p || (p.state !== 'open' && (p.claimed || !p.entries.some(x => x.me)))) p = await pvpNewRoom(fee);
  pvpAdvance(p); return pvpPublic(p);
}
async function pvpJoinMock(fee, guess){
  const p = PVP_ROOMS[fee]; if (!p) return { ok: false, error: 'closed' }; pvpAdvance(p);
  if (p.state !== 'open' || p.endsAt - Date.now() < 1000) return { ok: false, error: 'closed' };
  if (p.entries.some(x => x.me)) return { ok: false, error: 'already' };
  if (p.entries.some(x => x.guess === guess) || p.bots.some(x => x.guess === guess)) return { ok: false, error: 'taken' };
  p.entries.push({ who: 'GK', guess, me: true, at: Date.now() });
  return { ok: true, room: pvpPublic(p) };
}
// сменить тикет после входа: можно, пока до старта больше PVP_LOCK секунд; потом список тикетов зафиксирован (он и уходит в розыгрыш)
async function pvpChangeMock(fee, guess){
  const p = PVP_ROOMS[fee]; if (!p) return { ok: false, error: 'closed' }; pvpAdvance(p);
  const me = p.entries.find(x => x.me); if (!me) return { ok: false, error: 'closed' };
  if (p.state !== 'open' || p.endsAt - Date.now() <= PVP_LOCK * 1000) return { ok: false, error: 'locked' };
  if (p.entries.some(x => !x.me && x.guess === guess) || p.bots.some(x => x.guess === guess)) return { ok: false, error: 'taken' };
  me.guess = guess; return { ok: true, room: pvpPublic(p) };
}
async function pvpStateMock(fee){ const p = PVP_ROOMS[fee]; if (!p) return null; pvpAdvance(p); if (p.state === 'drawing') await p.drawP;
  if (p.state === 'done' && p.entries.some(x => x.me)) p.claimed = true;   // итог отдан игроку
  return pvpPublic(p); }
// что видит игрок: чужие тикеты скрыты до розыгрыша, зерно — только после. my — твой итог (выплата считается сервером)
function pvpPublic(p){
  const done = p.state === 'done', mi = p.entries.findIndex(x => x.me), me = p.entries[mi];
  const my = done && me ? { guess: me.guess, won: p.winners.includes(mi), dist: Math.abs(me.guess - p.ticket) } : null;
  if (my?.won) Object.assign(my, { share: p.share, ti: p.pay.ti, mult: Math.round(Number(p.pay.ppm) / 1e4) / 100, win: Math.round(p.pay.win * 100) / 100, nft: p.pay.nft, change: Math.floor(Number(p.pay.tonPay) / 1e7) / 100 });
  return { id: p.id, fee: p.fee, commitment: p.commitment, state: p.state, endsAt: p.endsAt, bank: Math.round(p.fee * p.entries.length * 100) / 100,
    entries: p.entries.map((x, i) => ({ who: x.who, me: !!x.me, guess: x.me || done ? x.guess : null, dist: done ? Math.abs(x.guess - p.ticket) : null, win: done && p.winners.includes(i) })),
    ticket: done ? p.ticket : null, proof: done ? p.proof : null, my };
}

/* ---------- АРЕНА: отдельный экран поверх главной (тот же экран, что у крафта — рамка раскрывается на весь экран) ----------
   Колизей сверху: каменные трибуны, песок, факелы, в центре — горнило-банк с кольцом таймера.
   Места на трибунах — и есть вход: свободное место мерцает «+», тап — садишься в бой с выбранным тикетом; каждый вошедший кидает монету в банк.
   Тикет — ползунком по шкале рангов (те же 5 рангов, что на крафте, равные доли), тап по рангу или кубик — случайный.
   В Telegram «Назад» — системная кнопка, заголовок — в строке кнопок Telegram (как баланс на главной).
   По таймеру — огонь, все слетаются к банку, удар молота — и прямо здесь раскрытие тикета, без возврата на главную */
const FIRE = '<path fill="currentColor" stroke="none" d="M12 2c.6 3.6 4.8 5.6 4.8 10.4a4.8 4.8 0 0 1-9.6 0c0-2.3 1.1-3.9 2.4-5 .1 1.8 1 2.9 2.3 3.4C11.3 8.3 11 5.2 12 2z"/>';
IC.fire = FIRE; NICON.fire = FIRE;                                    // иконка PvP: меню, история, уведомления
const DICE = '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.3" fill="currentColor"/><circle cx="15" cy="15" r="1.3" fill="currentColor"/><circle cx="15" cy="9" r="1.3" fill="currentColor"/><circle cx="9" cy="15" r="1.3" fill="currentColor"/>';
const FIRE_GLOW = ['#ff5a1f', '#b8320a', '#ffb347', '#ffe0b0'];
let arenaOn = false, arenaSeats = [];
const pvpWhenFree = fn => { if (!S.busy || arenaOn) return fn(); setTimeout(() => pvpWhenFree(fn), 400); };
const pvpLeft = v => Math.max(0, (v.endsAt - Date.now()) / 1000);
const mmss = s => { const c = Math.ceil(s); return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`; };
const pvpAva = x => `<span class="tav" style="--tc:${avc(x.who)}">${x.me ? '<img src="assets/avatar.webp" alt="">' : x.who[0].toUpperCase()}</span>`;
const tierOfN = n => TIERS[tierOfTicket(n)];
// системная кнопка «Назад» Telegram — пока открыта арена
const tgBack = on => { try { const b = Telegram.WebApp.BackButton; b.offClick(leaveArena); if (on){ b.onClick(leaveArena); b.show(); } else b.hide(); } catch(_){} };

/* колизей (вид сверху), рисуется один раз: трибуны ступенями, секции, арки, стена, песок, горнило, факелы */
const ARENA_SVG = (() => {
  const C = 200, ring = (r, s, w, extra = '') => `<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="${s}" stroke-width="${w}"${extra}/>`;
  let s = `<svg class="ar-art" viewBox="0 0 400 400" aria-hidden="true"><defs>` +
    `<radialGradient id="arStone"><stop offset=".7" stop-color="#2b1d14"/><stop offset=".86" stop-color="#4d3523"/><stop offset=".97" stop-color="#2a1c13"/><stop offset="1" stop-color="#140d08"/></radialGradient>` +
    `<radialGradient id="arSand"><stop offset="0" stop-color="#d98e48"/><stop offset=".6" stop-color="#9c5a27"/><stop offset="1" stop-color="#4e2b12"/></radialGradient>` +
    `<radialGradient id="arFire"><stop offset="0" stop-color="#fff3c8"/><stop offset=".3" stop-color="#ffb347"/><stop offset=".65" stop-color="#e2541c"/><stop offset="1" stop-color="#7a1d06" stop-opacity="0"/></radialGradient></defs>` +
    `<circle cx="${C}" cy="${C}" r="198" fill="url(#arStone)"/>`;
  for (const r of [188, 177, 166, 155]) s += ring(r, 'rgba(0,0,0,.42)', 2) + ring(r - 4, 'rgba(255,205,160,.07)', 1.5);   // ступени трибун
  for (let i = 0; i < 24; i++){ const a = i * Math.PI / 12, x1 = C + Math.cos(a) * 146, y1 = C + Math.sin(a) * 146, x2 = C + Math.cos(a) * 196, y2 = C + Math.sin(a) * 196;
    s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(0,0,0,.45)" stroke-width="2"/>`; }   // проходы между секциями
  s += ring(195, '#100a06', 5, ' stroke-dasharray="9 5"') +                          // арки внешней стены
    ring(143, '#6e4b30', 7) + ring(139, 'rgba(0,0,0,.55)', 2) +                       // стена арены
    `<circle cx="${C}" cy="${C}" r="137" fill="url(#arSand)"/>` + ring(112, 'rgba(0,0,0,.09)', 2) + ring(92, 'rgba(0,0,0,.07)', 2) +
    `<circle class="ar-fire" cx="${C}" cy="${C}" r="74" fill="url(#arFire)"/>`;
  for (let i = 0; i < 8; i++){ const a = Math.PI / 8 + i * Math.PI / 4, x = C + Math.cos(a) * 143, y = C + Math.sin(a) * 143;   // факелы на стене
    s += `<g class="ar-torch" style="animation-delay:${(i * .37).toFixed(2)}s"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" fill="url(#arFire)"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="#ffe7a8"/></g>`; }
  return s + `</svg>`;
})();

async function openPvp(){
  if (S.demo){ notify({ type: 'demo', icon: 'fire', title: $t("PvP крафт — только на GRAM"), text: $t("Выключи демо в меню") }); return; }
  if (arenaOn || (S.busy && !arenaOn)) return;
  if (openDrawer){ hideDrawer(); await wait(220); }
  arenaOn = true; S.busy = true; CRAFT.classList.add('busy'); clearInterval(auto);
  pvpGo = false; pvpView = await API.pvpOpen(pvpFee); if (pvpGuess == null) pvpGuess = pvpRand(); pvpKey = ''; renderArena();
  await openFx(false, 'arena', FIRE_GLOW); FX.gainTo = .55; tgBack(true);
  pvpLoop();
}
async function leaveArena(){
  if (!arenaOn) return; arenaOn = false; haptic(); tgBack(false);  if (pvpView?.entries.some(x => x.me) && pvpView.state === 'open') notify({ type: 'info', icon: 'fire', title: $t("Ты в игре"), text: $t("Вернём на арену к старту") });
  await closeFx(); $('fx').classList.remove('arena'); CRAFT.classList.remove('busy'); S.busy = false; restartAuto();
}
async function pvpLoad(){ pvpGo = false; pvpView = await API.pvpOpen(pvpFee); pvpKey = ''; renderArena(); pvpLoop(); }
// опрос комнаты: пока ты на арене или в игре; таймер и банк обновляются без перерисовки всего экрана
// у каждой цепочки опроса свой номер: если запустили новую, старая (ещё ждущая ответа) выходит — иначе старт срабатывал дважды
let pvpTok = 0;
function pvpLoop(){
  clearTimeout(pvpPoll); const tok = ++pvpTok;
  const mine = pvpView?.entries.some(x => x.me);
  if (!pvpView || (!mine && !arenaOn) || pvpGo) return;
  pvpPoll = setTimeout(async () => {
    let v = await API.pvpState(pvpFee); if (!v || tok !== pvpTok) return;
    if (v.state === 'done' && !v.entries.some(x => x.me)){ v = await API.pvpOpen(pvpFee); if (tok !== pvpTok) return; }   // комната ушла без тебя — открывается следующая
    pvpView = v;
    if (v.state === 'done' && v.my){ if (pvpGo) return; pvpGo = true; pvpWhenFree(async () => { if (!arenaOn){ await reopenArena(); } pvpStart(v); }); return; }
    if (arenaOn) renderArena(); pvpLoop();
  }, 200);
}
// старт, пока ты был на главной: сначала возвращаем на арену
async function reopenArena(){
  arenaOn = true; S.busy = true; CRAFT.classList.add('busy'); clearInterval(auto); pvpKey = ''; renderArena();
  await openFx(true, 'arena', FIRE_GLOW); tgBack(true);
}

function renderArena(){
  const v = pvpView, me = v.entries.find(x => x.me), a = $('fxArena'), left = pvpLeft(v), lock = !!me && left <= PVP_LOCK;
  const key = [v.id, v.state, !!me, lock, pvpFee].join('|');
  if (key !== pvpKey){
    pvpKey = key; arenaSeats = [];
    a.innerHTML =
      // верх — один ряд: «‹» (в Telegram — системная), взнос, правила. Заголовка нет: колизей с огнём и так говорит, где ты.
      // В Telegram ряд встаёт сразу под зону его кнопок — строка Close / ⌄••• остаётся пустой
      `<div class="ar-sub"><button class="ar-back" id="arBack" aria-label="${$t("Назад")}">${svg('<path d="M15 5l-7 7 7 7"/>')}</button>` +
        `<div class="ar-fees">${PVP_FEES.map(f => `<button class="${f === pvpFee ? 'on' : ''}" data-fee="${f}"${me ? ' disabled' : ''}>${fmt(f)}</button>`).join('')}</div>` +
        `<button class="ar-info" id="arInfo" aria-label="${$t("Правила")}">${svg(IC.shield)}</button></div>` +
      `<div class="ar-colw"><div class="ar-col" id="arPit">${ARENA_SVG}` +
        `<svg class="ar-ring" viewBox="0 0 400 400"><circle cx="200" cy="200" r="82" class="bg"/><circle cx="200" cy="200" r="82" class="fg" id="arRing"/></svg>` +
        `<div class="ar-bank" id="arBank"><small>${$t("Банк")}</small><b id="arBankV">${fmt(v.bank)}</b><em>GRAM</em><span class="ar-time" id="arTime"></span></div>` +
        `<div class="ar-seats" id="arSeats"></div></div></div>` +
      `<p class="ar-hint" id="arHint"></p>` +
      // QA, временно: старт без ожидания таймера (уберём вместе с экспериментом)
      (v.state === 'open' && !lock ? `<button class="ar-go" id="arGo">${svg(FIRE)} ${$t("Старт сейчас (QA)")}</button>` : '') +
      `<div class="ar-pick${lock ? ' locked' : ''}" id="arPick">` +
        `<div class="ar-tkrow"><div class="ar-tk" id="arTk"></div>${lock ? '' : `<button class="ar-dice" id="arDice" aria-label="${$t("Случайный")}">${svg(DICE)}</button>`}</div>` +
        `<div class="ar-track" id="arTrack">${TIERS.map(t => `<i style="--c:${t.c}"></i>`).join('')}<b class="ar-thumb" id="arThumb"></b></div>` +
        `<div class="ar-tiers">${TIERS.map((t, i) => `<button data-ti="${i}" style="--c:${t.c}"${lock ? ' disabled' : ''}><b>${t.name}</b><small>x${t.min}–${t.max}</small></button>`).join('')}</div></div>`;
    if (me && !pvpChange.wait) pvpGuess = me.guess;
    bindArena(); showTicket(pvpGuess);
  }
  seatsSync(v);
  // таймер: кольцо вокруг горнила тает, последние 5 секунд — красное и пульсирует
  const C = 2 * Math.PI * 82, ring = $('arRing');
  ring.style.strokeDasharray = C; ring.style.strokeDashoffset = (C * (1 - left / PVP_TIME)).toFixed(1);
  $('arTime').textContent = mmss(left); $('arPit').classList.toggle('hot', left <= 5);
  $('arHint').innerHTML = !me ? $t("Выбери тикет и займи свободное место")
    : lock ? `${$t("Тикеты зафиксированы")} · <b>${$t("старт через {0}", mmss(left))}</b>`
    : `${$t("Ты на арене · тикет можно сменить ещё {0}", mmss(left - PVP_LOCK))}`;
  $('arHint').classList.toggle('me', !!me);
}
// места на трибунах: ты — внизу; свободные (пока ты не в игре) — с «+», тап по ним садит в бой; новенький кидает монету в банк
function seatsSync(v){
  const box = $('arSeats'); if (!box) return;
  const mine = v.entries.some(x => x.me), list = [...v.entries].sort((a, b) => (b.me ? 1 : 0) - (a.me ? 1 : 0));
  const slots = Math.max(8, list.length + (mine ? 0 : 1)), pos = i => { const ang = Math.PI / 2 + i * 2 * Math.PI / slots; return [50 + Math.cos(ang) * 42.5, 50 + Math.sin(ang) * 42.5]; };
  if (arenaSeats.length !== slots || box.children.length !== slots){
    box.innerHTML = Array.from({ length: slots }, (_, i) => { const [x, y] = pos(i); return `<button class="ar-seat" style="left:${x}%;top:${y}%"></button>`; }).join(''); arenaSeats = Array(slots).fill(undefined);
  }
  // своё место — первое (внизу); если ты ещё не сел, первые места занимают другие, а свободные — после них
  const order = mine ? list : [undefined, ...list];   // пока не сел — свободное место внизу, по центру, ждёт тебя
  for (let i = 0; i < slots; i++){
    const x = order[i], id = x ? (x.me ? 'me' : x.who) : (mine ? 'empty' : 'free'), el = box.children[i];
    if (arenaSeats[i] === id) continue;
    const was = x && arenaSeats.includes(id); arenaSeats[i] = id;
    el.className = 'ar-seat ' + (x ? (x.me ? 'me' : 'taken') : (mine ? 'empty' : 'free'));
    el.innerHTML = x ? pvpAva(x) + (x.me ? `<small>${$t("Ты")}</small>` : '') : (mine ? '' : '<i>+</i>');
    el.disabled = !!x || mine; el.setAttribute('aria-label', x ? (x.me ? $t("Ты") : '@' + x.who) : $t("Занять место"));
    el.onclick = x || mine ? null : () => pvpJoinClick(el);
    if (x && !was && pvpKey && !S.lite) coinToBank(el);
  }
  const bv = $('arBankV'); if (bv && bv.textContent !== fmt(v.bank)) setTimeout(() => { bv.textContent = fmt(v.bank); $('arBank').classList.remove('bump'); void bv.offsetWidth; $('arBank').classList.add('bump'); }, S.lite ? 0 : 520);
}
function coinToBank(seat){
  const pit = $('arPit'), c = document.createElement('img'); c.src = 'assets/gem-small.svg'; c.className = 'ar-coin'; pit.appendChild(c);
  const x0 = seat.style.left, y0 = seat.style.top;
  seat.animate([{ scale: .3, opacity: 0 }, { scale: 1.15, opacity: 1, offset: .6 }, { scale: 1 }], { duration: 420, easing: 'cubic-bezier(.3,1.5,.5,1)' });
  c.animate([{ left: x0, top: y0, scale: .6, opacity: 0 }, { left: x0, top: `calc(${y0} - 6%)`, scale: 1, opacity: 1, offset: .25 }, { left: '50%', top: '50%', scale: .5, opacity: .9 }],
    { duration: 650, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' }).onfinish = () => c.remove();
  Sfx.coin(); haptic('light');
}

/* ---------- тикет: ползунок по шкале рангов ---------- */
function showTicket(n){
  const t = tierOfN(n), tkEl = $('arTk'); if (!tkEl) return;
  $('arPick').style.setProperty('--tc', t.c);
  tkEl.innerHTML = tk(n).split('').map(d => `<b>${d}</b>`).join('');
  $('arThumb').style.left = (ticketToP(n) / TIERS.length * 100).toFixed(2) + '%';
  $('arPick').querySelectorAll('.ar-tiers button').forEach((b, i) => b.classList.toggle('on', i === tierOfTicket(n)));
}
function setGuess(n, quiet){
  n = Math.max(0, Math.min(TICKETS - 1, Math.round(n)));
  const ti0 = tierOfTicket(pvpGuess); pvpGuess = n; showTicket(n);
  if (!quiet){ Sfx.tick(.5); if (tierOfTicket(n) !== ti0) selHaptic(); }
  pvpChangeSoon();
}
// уже на арене: новый тикет отправляем, когда палец отпустил ползунок (через паузу) — не на каждое движение
function pvpChangeSoon(){
  const me = pvpView?.entries.find(x => x.me); if (!me || me.guess === pvpGuess) return;
  clearTimeout(pvpChangeSoon.t); pvpChange.wait = true; pvpChangeSoon.t = setTimeout(pvpChange, 450);
}
async function pvpChange(){
  const me = pvpView?.entries.find(x => x.me); if (!me){ pvpChange.wait = false; return; }
  const r = await API.pvpChange(pvpFee, pvpGuess); pvpChange.wait = false;
  if (r.ok){ pvpView = r.room; haptic('light'); return; }
  haptic('rigid'); pvpGuess = me.guess; showTicket(pvpGuess);
  notify({ type: 'warn', icon: 'fire', title: r.error === 'taken' ? $t("Этот тикет уже занят") : $t("Тикеты уже зафиксированы"), text: r.error === 'taken' ? $t("Оставили прежний — выбери другой") : $t("За 5 секунд до старта менять нельзя") });
}
// кубик и тап по рангу: ползунок пролетает к новому тикету, число бежит за ним
function sweepTo(n){
  const p0 = ticketToP(pvpGuess), p1 = ticketToP(n);
  if (S.lite) return setGuess(n);
  haptic('medium'); let last = -1;
  tween(650, k => { const p = p0 + (p1 - p0) * k, v = k >= 1 ? n : Math.round(pToTicket(Math.min(TIERS.length - 1e-6, p))); pvpGuess = v; showTicket(v);
    const tick = Math.floor(k * 14); if (tick !== last){ last = tick; Sfx.tick(.3 + .5 * k); } }, EZ.out3).then(() => { setGuess(n, true); haptic('light'); });
}
function bindArena(){
  $('arBack').onclick = leaveArena;
  $('arInfo').onclick = arenaRules;
  if ($('arGo')) $('arGo').onclick = pvpForceStart;
  $('fxArena').querySelectorAll('[data-fee]').forEach(b => b.onclick = () => { if (b.disabled) return; pvpFee = +b.dataset.fee; Sfx.swipe(); haptic(); pvpLoad(); });
  if ($('arPick').classList.contains('locked')) return;
  $('fxArena').querySelectorAll('[data-ti]').forEach(b => b.onclick = () => { const t = TIERS[+b.dataset.ti]; sweepTo(t.from + Math.floor(Math.random() * (t.to - t.from + 1))); });
  $('arDice').onclick = () => sweepTo(pvpRand());
  // ползунок: тянешь — ранги и тикет меняются по шкале; на пересечении ранга — щелчок вибрации. Точнее — тянуть медленнее
  const tr = $('arTrack'); let drag = false;
  const at = e => { const r = tr.getBoundingClientRect(), p = Math.max(0, Math.min(.999999, (e.clientX - r.left) / r.width)) * TIERS.length; setGuess(pToTicket(p)); };
  tr.onpointerdown = e => { drag = true; tr.setPointerCapture(e.pointerId); at(e); tr.classList.add('drag'); };
  tr.onpointermove = e => { if (drag) at(e); };
  tr.onpointerup = tr.onpointercancel = () => { drag = false; tr.classList.remove('drag'); };
}
// правила и хеш зерна комнаты — в окне по кнопке-щиту, чтобы не загромождать арену
function arenaRules(){
  haptic();
  const rules = [$t("Все вносят одинаковый взнос и загадывают тикет. Один тикет — один игрок."), $t("Старт — по таймеру. Один на арене — крафт твой."),
    $t("Ближе всех к выпавшему тикету — крафтит на весь банк с этим тикетом: множитель — его ранга."), $t("Ничья — банк поровну."),
    $t("Тикет можно сменить после входа — до 5 секунд до старта. Дальше тикеты зафиксированы и уходят в розыгрыш.")];
  modal(`<h4>${$t("Правила арены")}</h4><ol class="ar-rules">${rules.map(x => `<li>${x}</li>`).join('')}</ol>` +
    `<div class="ar-hash"><small>${$t("Хеш зерна комнаты — показан до взносов. После старта зерно раскроется, и исход можно проверить.")}</small><code>${pvpView.commitment}</code></div>` +
    `<button class="btn-main" id="arOk">${$t("Понятно")}</button>`, '#ff8a3c');
  $('arOk').onclick = closeModal;
}
// сесть на место = вступить в бой с выбранным тикетом
async function pvpJoinClick(seat){
  const v = pvpView; if (!v || v.entries.some(x => x.me) || pvpJoinClick.on) return;
  if (pvpFee > S.balance){ haptic('rigid'); notify({ type: 'err', icon: 'coin', title: $t("Недостаточно GRAM"), text: $t("Пополни баланс — тапни по нему сверху") }); return; }
  pvpJoinClick.on = true;
  const r = await API.pvpJoin(pvpFee, pvpGuess); pvpJoinClick.on = false;
  if (!r.ok){ haptic('rigid'); notify({ type: 'err', icon: 'fire', title: r.error === 'taken' ? $t("Этот тикет уже занят") : $t("Комната уже стартует"), text: r.error === 'taken' ? $t("Сдвинь ползунок или выбери случайный") : $t("Открываем следующую") });
    if (r.error === 'taken') sweepTo(pvpRand()); else pvpLoad(); return; }
  setBalance(S.balance - pvpFee); haptic('medium'); Sfx.coin();
  pvpView = r.room; pvpKey = ''; renderArena(); pvpLoop();
}

// QA, временно: не в комнате — садимся со случайным тикетом; таймер комнаты мока — в ноль, опрос сам запускает бой
async function pvpForceStart(){
  if (pvpForceStart.on) return; pvpForceStart.on = true; haptic();
  try {
    if (!pvpView.entries.some(x => x.me)){ if (pvpGuess == null) setGuess(pvpRand(), true); await pvpJoinClick(); }
    const p = PVP_ROOMS[pvpFee]; if (p && p.state === 'open' && pvpView.entries.some(x => x.me)) p.endsAt = Date.now();
  } finally { pvpForceStart.on = false; }
}

/* ---------- старт: огонь, все слетаются к банку, удар молота — и раскрытие тикета прямо здесь ---------- */
// результат для экрана крафта — в той же форме, что у обычного крафта: дальше работают дроп, «Забрать/Продать», история и проверка
function pvpResult(v){
  const my = v.my, ti = tierOfTicket(v.ticket), win = my.won ? my : null, winner = v.entries.find(x => x.win);
  return { kind: 'craft', proof: v.proof, ticket: v.ticket, ti, mult: win ? win.mult : Math.round(Number(v.proof.result.multiplier_ppm) / 1e4) / 100,
    stake: win ? win.share : v.fee, tonStake: win ? win.share : v.fee, gifts: [], win: win ? win.win : 0, nft: win ? win.nft : null, change: win ? win.change : 0,
    pvp: { fee: v.fee, bank: v.bank, won: my.won, guess: my.guess, dist: my.dist, n: v.entries.length, ties: v.entries.filter(x => x.win).length,
      winner: winner.me ? null : winner.who, winnerGuess: winner.guess, players: v.entries.map(x => ({ who: x.who, me: x.me, guess: x.guess, dist: x.dist, win: x.win })) } };
}
async function pvpStart(v){
  ++pvpTok; clearTimeout(pvpPoll); tgBack(false);   // опрос останавливаем; pvpGo остаётся true до следующей комнаты; во время боя «Назад» нет
  const r = pvpResult(v), fast = S.fast || S.lite, a = $('fxArena');
  // все слетаются к банку, горнило вспыхивает
  if (!fast){
    $('arPit')?.classList.add('fire'); FullGlow.set(FIRE_GLOW); FullGlow.punch(0, 1); FX.gainTo = 1; Sfx.whoosh(); haptic('heavy');
    [...($('arSeats')?.children || [])].forEach(s => s.animate([{ left: s.style.left, top: s.style.top, scale: 1, opacity: 1 }, { left: '50%', top: '50%', scale: .3, opacity: 0 }], { duration: 520, delay: Math.random() * 120, easing: 'cubic-bezier(.6,0,.4,1)', fill: 'forwards' }));
    await wait(560);
  }
  await a.animate([{ opacity: 1 }, { opacity: 0, filter: 'blur(6px)' }], { duration: 260, fill: 'forwards' }).finished;
  // заставка старта боя — удар молота по наковальне
  if (!fast){
    const box = $('fxIntro'), ham = box.querySelector('.fi-h'), anv = box.querySelector('.fi-a'), orb = box.querySelector('.fi-orb');
    // все анимации блока — и завершённые «залипшие» тоже — снимаем: иначе силуэты оставались висеть поверх итога
    const clear = () => document.getAnimations().forEach(x => { const t = x.effect?.target; if (t && (t === box || box.contains(t)) && !t.classList.contains('fi-sp')) x.cancel(); });
    clear(); orb.style.visibility = 'hidden'; box.classList.add('fire');                         // круг кнопки крафта на огненной арене чужой — только молот и наковальня
    box.style.opacity = 1; ham.style.rotate = '62deg';                 // конечное состояние ставим сразу, анимации — без «залипания»
    box.animate([{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.3,1.3,.5,1)' });
    await ham.animate([{ rotate: '40deg' }, { rotate: '62deg' }], { duration: 500, easing: 'cubic-bezier(.3,1.2,.5,1)' }).finished;
    await anvilHit(box, ham, anv, '62deg');
    clear(); box.style.opacity = ''; ham.style.rotate = ''; orb.style.visibility = ''; box.classList.remove('fire');
  } else if (fast){ Sfx.lock(); FullGlow.punch(0, .8); }
  a.getAnimations().forEach(x => x.cancel());
  // игроки и их тикеты — по возрастанию, цвет — ранг тикета
  $('fxPvp').innerHTML = `<div class="pvp-bank">${svg(FIRE)} ${$t("PvP · банк {0} GRAM · игроков {1}", fmt(r.pvp.bank), r.pvp.n)}</div><div class="pvp-chips">` +
    [...r.pvp.players].sort((a, b) => a.guess - b.guess).map(x => `<span class="pvc${x.me ? ' me' : ''}" style="--tc:${tierOfN(x.guess).c}">${pvpAva(x)}<b>${tk(x.guess)}</b><em>${x.me ? $t("Ты") : '@' + x.who}</em><i class="pvd"></i></span>`).join('') + `</div>`;
  $('fx').classList.remove('arena'); arenaOn = false;  await reveal(r, fast);
}
// после того как тикет встал: подсветить победителя, показать разницу у каждого, потом — свой экран дропа
async function pvpAfter(r){
  const chips = [...$('fxPvp').querySelectorAll('.pvc')], sorted = [...r.pvp.players].sort((a, b) => a.guess - b.guess);
  chips.forEach((c, i) => { const x = sorted[i]; c.querySelector('.pvd').textContent = '±' + x.dist.toLocaleString(LOC); c.classList.add(x.win ? 'win' : 'lose'); });
  haptic('heavy'); r.pvp.won ? Sfx.rank(3) : Sfx.lock();
  await wait(S.lite ? 500 : 1700);
  if (r.pvp.won) return showDrop(r).then(() => $('fxWin').insertAdjacentHTML('afterbegin', `<span class="pvp-tag">${svg(FIRE)} ${r.pvp.ties > 1 ? $t("PvP · ничья, твоя доля банка") : $t("PvP · ты ближе всех — банк твой")}</span>`));
  pvpLoseDrop(r);
}
function pvpLoseDrop(r){
  const p = r.pvp, w = p.players.find(x => x.win);
  // коротко и с воздухом: кто забрал банк и два тикета рядом; расстояния — в истории и в проверке честности
  $('fxDrop').innerHTML = `<div class="pz pvp-lose"><span class="pvl-ava">${pvpAva(w)}</span><b>@${w.who}</b><small>${$t("забрал банк {0} GRAM", fmt(p.bank))}</small></div>`;
  $('fxWin').innerHTML = `<div class="pvl-pair"><span style="--tc:${tierOfN(w.guess).c}"><small>@${w.who}</small><b>${tk(w.guess)}</b></span><span class="mine" style="--tc:${tierOfN(p.guess).c}"><small>${$t("Ты")}</small><b>${tk(p.guess)}</b></span></div>`;
  $('fxBtns').innerHTML = `<button class="btn-main" id="pvpAgain">${svg(FIRE)}${$t("Снова на арену")}</button><button class="btn-ghost" id="pvpBack">${$t("На главную")}</button>` + PF_LINK;
  $('fx').classList.add('done');
  if (!S.demo){ logCraft(r, 'lose'); addXp(p.fee * .5); }
  $('pvpAgain').onclick = backToArena;
  $('pvpBack').onclick = async () => { if (pvpLoseDrop.on) return; pvpLoseDrop.on = true; haptic(); await closeFx(); CRAFT.classList.remove('busy'); S.busy = false; pvpLoseDrop.on = false; restartAuto(); };
  $('fxPfIn').onclick = () => openPF(r);
  $('fxShare').onclick = () => shareWin($t("Сыграл в PvP крафт в Pawn"));
  setTimeout(() => { FX.hot = false; }, 900);
}
// «Снова на арену» — без выхода на главную: экран крафта превращается обратно в арену
async function backToArena(){
  haptic(); const fi = $('fxIn');
  await fi.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).finished;
  $('fx').classList.remove('done', 'fail'); $('fxDrop').innerHTML = $('fxWin').innerHTML = $('fxBtns').innerHTML = $('fxPvp').innerHTML = ''; Tilt.drop($('fxDrop'));
  $('fx').classList.add('arena'); arenaOn = true; FullGlow.set(FIRE_GLOW); FX.gainTo = .55; tgBack(true);
  $('fxArena').style.opacity = ''; await pvpLoad();
  fi.getAnimations().forEach(x => x.cancel());
}
