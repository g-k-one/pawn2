/* =========================================================
   PvP КРАФТ — эксперимент, по умолчанию выключен (Дебаг → «Эксперименты»)
   Комната с таймером: все вносят одинаковый взнос и загадывают тикет 00000–99999 (один тикет — один игрок).
   По таймеру выпадает честный тикет — он же тикет крафта. Кто загадал ближе всех, крафтит на весь банк
   именно с этим тикетом: множитель — ранга выпавшего тикета. Ничья (двое одинаково близко — выше и ниже тикета) — банк пополам, тикет тот же.
   Один в комнате — крафт твой. Отдельной комиссии нет: весь банк идёт в обычный крафт (RTP 95%).
   Честность: зерно комнаты загадано до первого взноса (хеш виден сразу). Тикет = HMAC(зерно,
   ["pawn-pf-v1", id комнаты, "pvp", SHA-256(JSON тикетов в порядке входа), "0", блок]) — зерно зафиксировано
   раньше ставок, а список ставок — до розыгрыша, поэтому тикет не подогнать ни под одного игрока.
   Мок: соседи по комнате — заглушки (ники NICKS), в бою это живые игроки с сервера. Комната живёт в памяти.
   ========================================================= */
const PVP_FEES = [.5, 1, 2], PVP_TIME = 30, PVP_LOCK = 5, PVP_MAX = 6;   // … ; мест в комнате (в арене: 5 соперников + ты на кнопке)            // взносы, GRAM; длительность комнаты, с; за сколько секунд до старта тикеты фиксируются
let pvpFee = .5, pvpGuess = null, pvpView = null, pvpPoll = 0, pvpKey = '', pvpGo = false;
const pvpRand = () => Math.floor(Math.random() * TICKETS);

/* ---------- мок сервера (вызывается только из API в 17-api.js) ---------- */
const PVP_ROOMS = {};
let pvpSeq = 10230 + Math.floor(Math.random() * 400);   // порядковый номер боя (заглушка: в бою — с сервера)                                                 // текущая комната на каждый взнос
async function pvpNewRoom(fee){
  // таймер не идёт, пока в комнате пусто: стартует с первым входом (своим или соперника) — у всех ровно 30 с
  const e = await newEpoch(), t0 = Date.now() + 2000 + Math.random() * 8000, endsAt = null;
  const n = S.dbg.arBots ?? (Math.random() < .15 ? 0 : 1 + Math.floor(Math.random() * PVP_MAX)), nicks = [...NICKS].sort(() => Math.random() - .5), used = new Set();
  const bots = Array.from({ length: n }, (_, i) => { let g; do g = pvpRand(); while (used.has(g)); used.add(g); return { who: nicks[i % nicks.length], guess: g, at: i ? t0 + Math.random() * (PVP_TIME * 1000 - 1500) : t0 }; }).sort((a, b) => a.at - b.at);
  return PVP_ROOMS[fee] = { id: e.id, no: ++pvpSeq, fee, seed: e.seed, commitment: e.commitment, state: 'open', endsAt, bots, entries: [] };
}
function pvpAdvance(p){
  while (p.bots.length && p.bots[0].at <= Date.now()){ const b = p.bots.shift(); if ((p.endsAt && b.at >= p.endsAt) || p.entries.length >= PVP_MAX) continue;
    if (!p.entries.some(x => x.guess === b.guess)){ p.entries.push(b); p.endsAt ||= b.at + PVP_TIME * 1000; } }
  if (p.state === 'open' && p.endsAt && Date.now() >= p.endsAt){ p.state = 'drawing'; p.drawP = pvpDraw(p); }
}
async function pvpDraw(p){
  const guesses = p.entries.map(x => x.guess), hash = await sha(enc(JSON.stringify(guesses)));
  let { roll, block } = await rollOf(p.seed, p.id, 'pvp', hash, 0);
  // дебаг: нужный исход для тебя — перебираем настоящие зерна комнаты, пока не выйдет (проверка честности сходится)
  const mi = p.entries.findIndex(x => x.me), want = S.dbg.arOut;
  if (want && mi >= 0 && guesses.length > 1){
    const ok = r => { const d = guesses.map(g => Math.abs(g - r)), b = Math.min(...d), w = d.flatMap((x, i) => x === b ? [i] : []); return want === 'win' ? w.includes(mi) : !w.includes(mi); };
    for (let t = 0; t < 4000 && !ok(roll); t++){ const e = await newEpoch(); const q = await rollOf(e.seed, p.id, 'pvp', hash, 0); if (ok(q.roll)){ p.seed = e.seed; p.commitment = e.commitment; ({ roll, block } = q); } }
  }
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
  if (p.state !== 'open' || (p.endsAt && p.endsAt - Date.now() < 1000)) return { ok: false, error: 'closed' };
  if (p.entries.some(x => x.me)) return { ok: false, error: 'already' };
  if (p.entries.length >= PVP_MAX) return { ok: false, error: 'full' };
  if (p.entries.some(x => x.guess === guess) || p.bots.some(x => x.guess === guess)) return { ok: false, error: 'taken' };
  p.entries.push({ who: 'GK', guess, me: true, at: Date.now() }); p.endsAt ||= Date.now() + PVP_TIME * 1000;
  return { ok: true, room: pvpPublic(p) };
}
// сменить тикет после входа: можно, пока до старта больше PVP_LOCK секунд; потом список тикетов зафиксирован (он и уходит в розыгрыш)
async function pvpChangeMock(fee, guess){
  const p = PVP_ROOMS[fee]; if (!p) return { ok: false, error: 'closed' }; pvpAdvance(p);
  const me = p.entries.find(x => x.me); if (!me) return { ok: false, error: 'closed' };
  if (p.state !== 'open' || (p.endsAt && p.endsAt - Date.now() <= PVP_LOCK * 1000)) return { ok: false, error: 'locked' };
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
  return { id: p.id, no: p.no, fee: p.fee, commitment: p.commitment, state: p.state, endsAt: p.endsAt, bank: Math.round(p.fee * p.entries.length * 100) / 100,
    entries: p.entries.map((x, i) => ({ who: x.who, me: !!x.me, guess: x.me || done ? x.guess : null, dist: done ? Math.abs(x.guess - p.ticket) : null, win: done && p.winners.includes(i) })),
    ticket: done ? p.ticket : null, proof: done ? p.proof : null, my,
    winNft: done ? p.pay.nft : null, winChange: done ? Math.floor(Number(p.pay.tonPay) / 1e7) / 100 : 0 };
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
const pvpLeft = v => v.endsAt ? Math.max(0, (v.endsAt - Date.now()) / 1000) : PVP_TIME;   // пусто — таймер ещё не пошёл
const mmss = s => { const c = Math.ceil(s); return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`; };
const pvpAva = x => `<span class="tav" style="--tc:${avc(x.who)}">${x.me ? '<img src="assets/avatar.webp" alt="">' : x.who[0].toUpperCase()}</span>`;
const tierOfN = n => TIERS[tierOfTicket(n)];
// системная кнопка «Назад» Telegram — пока открыта арена
const tgBack = on => { try { const b = Telegram.WebApp.BackButton; b.offClick(leaveArena); if (on){ b.onClick(leaveArena); b.show(); } else b.hide(); } catch(_){} };


async function openPvp(){
  if (S.demo){ notify({ type: 'demo', icon: 'fire', title: $t("Арена — только на GRAM"), text: $t("Выключи демо в меню") }); return; }
  if (arenaOn || (S.busy && !arenaOn)) return;
  if (openDrawer){ hideDrawer(); await wait(220); }
  arenaOn = true; S.busy = true; CRAFT.classList.add('busy'); clearInterval(auto);
  pvpGo = false; pvpView = await API.pvpOpen(pvpFee); if (pvpGuess == null) pvpGuess = pvpRand(); pvpKey = ''; renderArena();
  await openFx(false, 'arena', FIRE_GLOW); FX.gainTo = .55; tgBack(true);
  pvpLoop();
}
async function leaveArena(){
  if (!arenaOn) return; arenaOn = false; haptic(); tgBack(false); arSeat = null;  if (pvpView?.entries.some(x => x.me) && pvpView.state === 'open') notify({ type: 'info', icon: 'fire', title: $t("Ты в игре"), text: $t("Вернём на арену к старту") });
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

/* колизей (вид сверху), вектор, рисуется один раз. Внутри арены — песок с мягкой разметкой, стена с факелами, трибуны ступенями
   с секциями и арками; снаружи — продолжение колец (внешние галереи, ров, дорожки), которые плавно тают к краям экрана */
const ARENA_SVG = (() => {
  const C = 200, f = v => v.toFixed(1);
  const ring = (r, s, w, extra = '') => `<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="${s}" stroke-width="${w}"${extra}/>`;
  const rays = (r0, r1, n, s, w, off = 0) => { let o = ''; for (let i = 0; i < n; i++){ const a = (i + off) * 2 * Math.PI / n;
    o += `<line x1="${f(C + Math.cos(a) * r0)}" y1="${f(C + Math.sin(a) * r0)}" x2="${f(C + Math.cos(a) * r1)}" y2="${f(C + Math.sin(a) * r1)}" stroke="${s}" stroke-width="${w}"/>`; } return o; };
  let s = `<svg class="ar-art" viewBox="-200 -200 800 800" aria-hidden="true"><defs>` +
    `<radialGradient id="arStone" cx="200" cy="200" r="200" gradientUnits="userSpaceOnUse"><stop offset=".7" stop-color="#2e1f15"/><stop offset=".84" stop-color="#4f3624"/><stop offset=".95" stop-color="#2c1d13"/><stop offset="1" stop-color="#160e09"/></radialGradient>` +
    `<radialGradient id="arSand" cx="200" cy="200" r="138" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#c98444"/><stop offset=".55" stop-color="#9a5a2a"/><stop offset=".88" stop-color="#6a3a18"/><stop offset="1" stop-color="#3e210d"/></radialGradient>` +
    `<radialGradient id="arFire"><stop offset="0" stop-color="#fff3c8"/><stop offset=".3" stop-color="#ffb347"/><stop offset=".65" stop-color="#e2541c"/><stop offset="1" stop-color="#7a1d06" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="arOut" cx="200" cy="200" r="400" gradientUnits="userSpaceOnUse"><stop offset=".48" stop-color="#fff"/><stop offset=".95" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<mask id="arFade"><rect x="-200" y="-200" width="800" height="800" fill="url(#arOut)"/></mask></defs>`;
  // снаружи: внешние галереи и дорожки — те же кольца и секции, тают к краям
  s += `<g mask="url(#arFade)" opacity=".85">` +
    ring(214, 'rgba(110,70,40,.55)', 10) + ring(214, 'rgba(0,0,0,.4)', 2, ' stroke-dasharray="14 6"') +
    ring(238, 'rgba(255,190,130,.10)', 1.5) + ring(262, 'rgba(80,50,30,.5)', 18) + ring(262, 'rgba(0,0,0,.35)', 1.5, ' stroke-dasharray="3 9"') +
    ring(300, 'rgba(255,190,130,.07)', 1.5) + ring(330, 'rgba(70,44,26,.45)', 26) + ring(372, 'rgba(255,190,130,.05)', 1.5) +
    rays(205, 360, 24, 'rgba(0,0,0,.28)', 2) + rays(250, 360, 48, 'rgba(255,190,130,.05)', 1, .5) + `</g>`;
  // трибуны
  s += `<circle cx="${C}" cy="${C}" r="198" fill="url(#arStone)"/>`;
  for (const r of [189, 179, 169, 159]) s += ring(r, 'rgba(0,0,0,.42)', 2) + ring(r - 4, 'rgba(255,205,160,.08)', 1.5);   // ступени
  s += rays(146, 196, 24, 'rgba(0,0,0,.45)', 2.2);                                                                         // проходы
  for (let i = 0; i < 24; i++){ const a = (i + .5) * Math.PI / 12, x = C + Math.cos(a) * 172, y = C + Math.sin(a) * 172;     // скамьи-подушки
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="2.2" fill="rgba(170,40,30,.55)"/>`; }
  s += ring(196, '#120b07', 5, ' stroke-dasharray="9 5"') +                         // арки внешней стены
    ring(145, '#7a5234', 8) + ring(145, 'rgba(255,215,170,.18)', 1.5, ' stroke-dasharray="6 4"') + ring(140, 'rgba(0,0,0,.6)', 2.5) +   // стена арены с зубцами
    `<circle cx="${C}" cy="${C}" r="138" fill="url(#arSand)"/>` +
    ring(124, 'rgba(255,220,170,.06)', 1.5) + ring(100, 'rgba(0,0,0,.08)', 2) + rays(100, 136, 8, 'rgba(0,0,0,.06)', 2, .5) +   // разметка на песке
    `<circle class="ar-fire" cx="${C}" cy="${C}" r="80" fill="url(#arFire)" opacity=".55"/>`;
  for (let i = 0; i < 8; i++){ const a = Math.PI / 8 + i * Math.PI / 4, x = C + Math.cos(a) * 145, y = C + Math.sin(a) * 145;   // факелы на стене
    s += `<g class="ar-torch" style="animation-delay:${(i * .37).toFixed(2)}s"><circle cx="${f(x)}" cy="${f(y)}" r="14" fill="url(#arFire)"/><circle cx="${f(x)}" cy="${f(y)}" r="3.4" fill="#ffe7a8"/></g>`; }
  return s + `</svg>`;
})();

/* ---------- арена v4: сверху крупно колизей (вектор, туман Горна) — в центре только банк, взнос, таймер-кольцо и игроки;
   ниже — ряд мест (тап по свободному = вход); ещё ниже — крупный тикет и кусок колеса рангов со стрелкой: крутишь пальцем — подбираешь число.
   По бокам тикета — «Честность» и кубик (как круглые кнопки по краям на главной) ---------- */
const AR_SLOTS = 4;
// скрещённые мечи на кнопке входа — силуэт, как наковальня с молотом на кнопке крафта
const SWORDS = `<svg class="ar-swords" viewBox="0 0 64 64" aria-hidden="true"><g fill="#fff"><path d="M12 6l4-2 30 34-4 4z"/><path d="M38 40l6-6 4 4-6 6z"/><path d="M44 46l4-4 8 8-4 4z"/>` +
  `<path d="M52 6l-4-2-30 34 4 4z"/><path d="M26 40l-6-6-4 4 6 6z"/><path d="M20 46l-4-4-8 8 4 4z"/></g></svg>`;
const AR_SEAT_R = .43;   // места — по кругу на трибунах (доля стороны арены)
let arSeat = null, arSpin = 0;   // своё место; инерция колеса
/* дым у трибун: одна картинка клуба (assets/arena-puff.webp), 8 копий по кругу — каждая медленно и по-своему плавает,
   поворачивается и то густеет, то тает. Только по краю колизея и по бокам — не заходит на таймер, тикет и ставку. Только сдвиг, поворот и прозрачность — это делает видеокарта, без перерисовки и без WebGL
   (живой дым Горна грел iPhone в Telegram). Траектории случайные, но у всех копий одна картинка — один файл на загрузку */
function smokePuffs(box){
  if (box.childElementCount) return;
  // только по краю колизея (его радиус — 28% коробки дыма) и только по бокам: сверху таймер и тикет, снизу ставка — их дым не трогает
  const ANG = [-40, -12, 16, 40, 140, 168, 196, 220];
  for (let i = 0; i < ANG.length; i++){
    const a = (ANG[i] + (Math.random() - .5) * 10) * Math.PI / 180, r = 27 + Math.random() * 3, sz = 17 + Math.random() * 6;   // в % от коробки
    const im = document.createElement('img'); im.src = 'assets/arena-puff.webp'; im.alt = ''; im.className = 'puff';
    im.style.cssText = `left:${(50 + Math.cos(a) * r - sz / 2).toFixed(1)}%;top:${(50 + Math.sin(a) * r - sz / 2).toFixed(1)}%;width:${sz.toFixed(1)}%`;
    box.appendChild(im);
    const R = () => (Math.random() - .5) * 2, dx = R() * 12, dy = R() * 16, rot = R() * 50, s0 = .85 + Math.random() * .2;   // сдвиг — в % от самого клуба: плавают у края, не уходя к центру
    im.animate([{ transform: `translate(0,0) rotate(0deg) scale(${s0})`, opacity: .15 }, { transform: `translate(${dx}%,${dy}%) rotate(${rot / 2}deg) scale(${s0 + .12})`, opacity: .9, offset: .5 },
      { transform: `translate(${-dy / 2}%,${dx / 2}%) rotate(${rot}deg) scale(${s0})`, opacity: .2 }],
      { duration: 9000 + Math.random() * 7000, delay: -Math.random() * 16000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
  }
}
const AR_TIMER = .30;                                                       // радиус кольца таймера (доля стороны арены)
const tkDeg = n => ticketToP(n) / TIERS.length * 360;
const degTk = d => pToTicket(Math.min(TIERS.length - 1e-6, (((d % 360) + 360) % 360) / 360 * TIERS.length));
// колесо: огромный круг, видна только верхняя дуга (~44°); каждый ранг — 72°, деления каждые 2°, крупные — каждые 12°
const WH = { W: 360, H: 128, R: 470 };
function arWheel(lock){
  const { W, R } = WH, cx = W / 2, cy = R + 30, seg = 360 / TIERS.length, pt = (a, r) => { const q = (a - 90) * Math.PI / 180; return [cx + Math.cos(q) * r, cy + Math.sin(q) * r]; };
  const arc = (a0, a1, r) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  let g = '';
  TIERS.forEach((t, i) => { const a0 = i * seg + .4, a1 = (i + 1) * seg - .4;
    g += `<path d="${arc(a0, a1, R - 30)}" stroke="${t.c}" stroke-width="48" fill="none"/>`;
    for (let k = 0; k < 6; k++){ const a = i * seg + (k + .5) * seg / 6;                                           // подпись ранга — несколько раз по сегменту
      const [x, y] = pt(a, R - 30); g += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${a.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" class="ar-wt">${t.name}</text>`; } });
  for (let a = 0; a < 360; a += 2){ const big = a % 12 === 0, [x0, y0] = pt(a, R - 2), [x1, y1] = pt(a, R - (big ? 14 : 8));
    g += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="ar-wtk${big ? ' b' : ''}"/>`; }
  return `<svg class="ar-wheel${lock ? ' locked' : ''}" id="arWheel" viewBox="0 0 ${W} ${WH.H}">` +
    `<g id="arWg" style="transform-origin:${cx}px ${cy}px">${g}</g>` +
    `<path d="M${cx - 14} 2h28l-14 18z" class="ar-wp"/><rect x="${cx - 2}" y="16" width="4" height="62" rx="2" class="ar-wp"/>` +    // стрелка-указатель
    `</svg>`;
}
function renderArena(){
  const v = pvpView, me = v.entries.find(x => x.me), a = $('fxArena'), left = pvpLeft(v), lock = !!me && left <= PVP_LOCK;
  const key = [v.id, v.state, !!me, lock, pvpFee].join('|');
  if (key !== pvpKey){
    pvpKey = key; arenaSeats = [];
    const RT = AR_TIMER * 400;
    // раскладка — как на главной с крафтом, место в место: «шанс» и ранги → тикет (вместо множителей) → арена с местами по кругу
    // (вместо приза и гема) → кнопка с мечами (вместо наковальни; вход в бой) → плашка взноса (вместо ставки, не меняется) →
    // внизу «Честность · колесо · кубик» на местах «гифты · фишки · меню»
    a.innerHTML =
      `<button class="round ar-back" id="arBack" aria-label="${$t("Назад")}">${svg('<path d="M15 5l-7 7 7 7"/>')}</button>` +
      (v.state === 'open' && !lock ? `<button class="ar-go" id="arGo">${svg(FIRE)} QA</button>` : '') +
      `<div class="ar-head"><span class="ar-chance" id="arChance"><small>${$t("Шанс")}</small><b id="arChanceV"></b></span>` +
        `<div class="ar-tiers" id="arTiers">${TIERS.map((t, i) => `<button class="tier" data-ti="${i}" style="--c:${t.c}"${lock ? ' disabled' : ''}>${t.name}</button>`).join('')}</div></div>` +
      `<div class="digits tiered" id="arTk"></div>` +
      `<div class="ar-colw"><div class="ar-col" id="arPit">${ARENA_SVG}<div class="ar-fxs" id="arFxs"></div>` +
        `<svg class="ar-dial" viewBox="0 0 400 400"><circle class="ar-tbg" cx="200" cy="200" r="${RT}"/><circle class="ar-tfg" id="arRing" cx="200" cy="200" r="${RT}" transform="rotate(-90 200 200)"/></svg>` +
        `<div class="ar-bank" id="arBank"><b><img class="gm" src="assets/ton.svg" alt=""><span id="arBankV">${fmt(v.bank)}</span></b><span class="ar-time" id="arTime"></span></div>` +
        `<div class="ar-seats" id="arSeats"></div></div></div>` +
      `<button class="ar-sw" id="arJoin" aria-label="${$t("В бой")}"><span class="cb"></span></button>` +
      `<div class="ar-fee" id="arFee"><img src="assets/ton.svg" alt=""><b>${fmt(pvpFee)}</b></div>` +
      `<div class="ar-pick${lock ? ' locked' : ''}" id="arPick"><button class="round" id="arInfo" aria-label="${$t("Честность")}">${svg(IC.shield)}</button>` +
        `${arWheel(lock)}<button class="round" id="arDice" aria-label="${$t("Случайный")}"${lock ? ' disabled' : ''}>${svg(DICE)}</button></div>`;
    if (me && !pvpChange.wait) pvpGuess = me.guess;
    bindArena(); showTicket(pvpGuess); try { if (Telegram.WebApp.initData) $('arBack').hidden = true; } catch(_){}
    if (!S.lite) smokePuffs($('arFxs'));   // туман по краям — клубы-картинки (как в Арене, 16g-tab2.js)
  }
  seatsSync(v);
  const C = 2 * Math.PI * AR_TIMER * 400, ring = $('arRing');
  ring.style.strokeDasharray = C; ring.style.strokeDashoffset = (C * (1 - left / PVP_TIME)).toFixed(1);
  $('arTime').textContent = mmss(left); $('arPit').classList.toggle('hot', left <= 5);
}
// места — ряд под ареной: ты — на выбранном, остальные — по порядку входа; тап по свободному «+» — сразу вход
// всего 5 мест: 4 соперника — по кругу на трибунах, пятое — твоё, это кнопка с мечами (как кнопка крафта): вошёл — в ней твой аватар
function seatsSync(v){
  const box = $('arSeats'); if (!box) return;
  const meE = v.entries.find(x => x.me), others = v.entries.filter(x => !x.me).slice(0, AR_SLOTS);
  if (box.children.length !== AR_SLOTS){
    box.innerHTML = Array.from({ length: AR_SLOTS }, (_, i) => { const q = (i * 360 / AR_SLOTS + 45 - 90) * Math.PI / 180;
      return `<span class="ar-seat" style="left:${(50 + Math.cos(q) * AR_SEAT_R * 100).toFixed(2)}%;top:${(50 + Math.sin(q) * AR_SEAT_R * 100).toFixed(2)}%"></span>`; }).join('');
    arenaSeats = Array(AR_SLOTS).fill(undefined); }
  for (let i = 0; i < AR_SLOTS; i++){
    const x = others[i], id = x ? x.who : 'empty', el = box.children[i];
    if (arenaSeats[i] === id) continue;
    const was = x && arenaSeats.includes(id); arenaSeats[i] = id;
    el.className = 'ar-seat ' + (x ? 'taken' : 'empty');
    el.innerHTML = x ? pvpAva(x) + `<small>${x.who}</small>` : '';
    if (x && !was && pvpKey && !S.lite) coinToBank(el);
  }
  // своё место — кнопка: до входа мечи, после — твой аватар
  const jb = $('arJoin'), mine = !!meE;
  if (jb && (jb.classList.contains('in') !== mine || !jb.querySelector('.cb').children.length)){ jb.classList.toggle('in', mine); jb.disabled = mine;
    jb.querySelector('.cb').innerHTML = mine ? `<img class="orb" src="assets/orb.webp" alt="">${pvpAva(meE)}` : `<img class="orb" src="assets/orb.webp" alt=""><span class="core"></span>${SWORDS}`;
    if (mine && !S.lite) coinToBank(jb); }
  const bv = $('arBankV'); if (bv && bv.textContent !== fmt(v.bank)) setTimeout(() => { bv.textContent = fmt(v.bank); $('arBank').classList.remove('bump'); void bv.offsetWidth; $('arBank').classList.add('bump'); }, S.lite ? 0 : 520);
}
// новенький кидает монету: от его места — в банк в центре арены
function coinToBank(seat){
  const fx = $('fxArena'), c = document.createElement('img'); c.src = 'assets/gem-small.svg'; c.className = 'ar-coin'; fx.appendChild(c);
  const f = fx.getBoundingClientRect(), s = seat.getBoundingClientRect(), b = $('arBank').getBoundingClientRect(), k = f.width / fx.offsetWidth || 1;
  const x0 = (s.left + s.width / 2 - f.left) / k, y0 = (s.top - f.top) / k, x1 = (b.left + b.width / 2 - f.left) / k, y1 = (b.top + b.height / 2 - f.top) / k;
  seat.animate([{ scale: .3, opacity: 0 }, { scale: 1.15, opacity: 1, offset: .6 }, { scale: 1 }], { duration: 420, easing: 'cubic-bezier(.3,1.5,.5,1)' });
  c.animate([{ left: x0 + 'px', top: y0 + 'px', scale: .6, opacity: 0 }, { left: x0 + 'px', top: y0 - 24 + 'px', scale: 1, opacity: 1, offset: .25 }, { left: x1 + 'px', top: y1 + 'px', scale: .5, opacity: .9 }],
    { duration: 700, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' }).onfinish = () => c.remove();
  Sfx.coin(); haptic('light');
}

/* ---------- тикет: колесо рангов (крутишь — число бежит), точно — вверх/вниз по цифре ---------- */
function showTicket(n){
  const t = tierOfN(n), tkEl = $('arTk'); if (!tkEl) return;
  $('fxArena').style.setProperty('--tc', t.c);
  tkEl.innerHTML = tk(n).split('').map((d, k) => `<span class="lock" data-k="${k}"><i><b>${d}</b></i></span>`).join('');
  $('arTiers').querySelectorAll('.tier').forEach((b, i) => b.classList.toggle('on', i === tierOfTicket(n)));
  $('arChanceV').textContent = String(t.chance).replace('.', ',') + '%'; $('arChance').style.setProperty('--a', t.a); $('arChance').style.setProperty('--b', t.b);
  $('arWg').style.transform = `rotate(${(-tkDeg(n)).toFixed(3)}deg)`;
}
function setGuess(n, quiet){
  n = Math.max(0, Math.min(TICKETS - 1, Math.round(n)));
  const ti0 = tierOfTicket(pvpGuess), d0 = Math.floor(tkDeg(pvpGuess) / 2); pvpGuess = n; showTicket(n);
  if (!quiet){ if (Math.floor(tkDeg(n) / 2) !== d0) Sfx.tick(.35); if (tierOfTicket(n) !== ti0) selHaptic(); }   // щелчок на каждом делении колеса
  pvpChangeSoon();
}
// уже на арене: новый тикет отправляем, когда палец отпустил (через паузу) — не на каждое движение
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
// кубик: колесо прокручивается к новому тикету (чуть больше оборота — как рулетка), число бежит за ним
function sweepTo(n){
  const d0 = tkDeg(pvpGuess), d1 = tkDeg(n) + 360;
  if (S.lite) return setGuess(n);
  haptic('medium'); cancelAnimationFrame(arSpin);
  tween(900, k => { const v = k >= 1 ? n : degTk(d0 + (d1 - d0) * k); setGuess(v, k >= 1); }, EZ.out3).then(() => { setGuess(n, true); haptic('light'); });
}
function bindArena(){
  $('arBack').onclick = leaveArena;
  $('arInfo').onclick = arenaRules;
  $('arJoin').onclick = () => { if (!$('arJoin').disabled) pvpJoinClick(); };
  if ($('arGo')) $('arGo').onclick = pvpForceStart;
  if ($('arPick').classList.contains('locked')) return;
  $('arDice').onclick = () => sweepTo(pvpRand());
  $('arTiers').querySelectorAll('.tier').forEach((b, i) => b.onclick = () => { const t = TIERS[i]; sweepTo(t.from + Math.floor(Math.random() * (t.to - t.from + 1))); });
  // колесо: тянешь по горизонтали — оно крутится под пальцем; отпустил с разгона — докручивается по инерции
  const wh = $('arWheel'); let drag = false, lx = 0, vel = 0, lt = 0, deg = 0;
  const pxDeg = () => 180 / Math.PI / (WH.R * wh.getBoundingClientRect().width / WH.W);   // градусов колеса на пиксель пальца
  wh.onpointerdown = e => { drag = true; cancelAnimationFrame(arSpin); lx = e.clientX; lt = performance.now(); vel = 0; deg = tkDeg(pvpGuess); wh.setPointerCapture(e.pointerId); wh.classList.add('drag'); };
  wh.onpointermove = e => { if (!drag) return; const now = performance.now(), dx = e.clientX - lx; lx = e.clientX;
    const dd = -dx * pxDeg(); deg += dd; vel = vel * .6 + dd / Math.max(1, now - lt) * 1000 * .4; lt = now; setGuess(degTk(deg)); };
  wh.onpointerup = wh.onpointercancel = () => { if (!drag) return; drag = false; wh.classList.remove('drag');
    let last = performance.now(); const spin = now => { const dt = (now - last) / 1000; last = now; vel *= Math.pow(.04, dt); deg += vel * dt; setGuess(degTk(deg));
      if (Math.abs(vel) > 3) arSpin = requestAnimationFrame(spin); else haptic('light'); };
    if (Math.abs(vel) > 20) arSpin = requestAnimationFrame(spin); };
  // цифры: ведёшь пальцем вверх/вниз по разряду — ±1 в нём (точная настройка)
  $('arTk').onpointerdown = e => { const b = e.target.closest('[data-k]'); if (!b) return; let y0 = e.clientY, acc = 0; const k = +b.dataset.k, el = $('arTk'); el.setPointerCapture(e.pointerId);
    el.onpointermove = ev => { acc += y0 - ev.clientY; y0 = ev.clientY; while (Math.abs(acc) > 16){ const s = Math.sign(acc); acc -= s * 16;
      const p = 10 ** (4 - k), dg = Math.floor(pvpGuess / p) % 10, nd = (dg + s + 10) % 10; setGuess(pvpGuess + (nd - dg) * p); } };
    el.onpointerup = el.onpointercancel = () => { el.onpointermove = null; }; };
}
// правила и хеш зерна комнаты — в окне по кнопке-щиту, чтобы не загромождать арену
function arenaRules(){
  haptic();
  // шаги — тем же компонентом, что «Как устроена честность»: цветной номер, короткий заголовок, строка пояснения; цвета — рангов
  const steps = [[TIERS[0].c, $t("Загадай тикет"), $t("Крути колесо — от 00000 до 99999. Один тикет — один игрок.")],
    [TIERS[2].c, $t("Зайди в комнату"), $t("Взнос у всех одинаковый. Таймер 30 секунд идёт с первого игрока.")],
    [TIERS[1].c, $t("Ближе всех — крафтит банк"), $t("Весь банк уходит в крафт с выпавшим тикетом, множитель — по его рангу. Один в комнате — крафт твой.")],
    [TIERS[3].c, $t("Ничья — пополам"), $t("Двое одинаково близко, выше и ниже тикета: каждый крафтит свою половину.")],
    [TIERS[4].c, $t("За 5 секунд — стоп"), $t("Тикеты фиксируются, войти или сменить тикет уже нельзя.")]];
  // шторка снизу, как остальные экраны правил; закрывается свайпом или тапом мимо — кнопка «Понятно» не нужна
  const html = `<div class="ar-steps">` + steps.map(([c, t, d], i) => `<div class="pfi-step" style="--c:${c}"><i>${i + 1}</i><div><b>${t}</b><p>${d}</p></div></div>`).join('') +
    `<div class="pfi-step ar-pf" style="--c:#12D53D"><i>${svg(IC.shield)}</i><div><b>${$t("Честность")}</b><p>${$t("Хеш зерна комнаты известен до взносов. После старта зерно раскроется — исход можно проверить.")}</p><code>${pvpView.commitment}</code></div></div></div>`;
  swapDrawer('arRulesDrawer', () => { $('arRulesT').textContent = $t("Правила арены"); $('arRulesBody').innerHTML = html; });
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
// winPay — что выпало победителю с крафта на банк (для экрана проигрыша)
function pvpResult(v){
  const my = v.my, ti = tierOfTicket(v.ticket), win = my.won ? my : null, winner = v.entries.find(x => x.win);
  return { kind: 'craft', proof: v.proof, ticket: v.ticket, ti, mult: win ? win.mult : Math.round(Number(v.proof.result.multiplier_ppm) / 1e4) / 100,
    stake: win ? win.share : v.fee, tonStake: win ? win.share : v.fee, gifts: [], win: win ? win.win : 0, nft: win ? win.nft : null, change: win ? win.change : 0,
    pvp: { no: v.no, fee: v.fee, bank: v.bank, won: my.won, guess: my.guess, dist: my.dist, n: v.entries.length, ties: v.entries.filter(x => x.win).length,
      winner: winner.me ? null : winner.who, winnerGuess: winner.guess,
      share: Number(v.proof.result.share_nano) / 1e9, winPay: Math.floor(Number(v.proof.result.payout_nano) / 1e7) / 100, winNft: v.winNft || null, winChange: v.winChange || 0, players: v.entries.map(x => ({ who: x.who, me: x.me, guess: x.guess, dist: x.dist, win: x.win })) } };
}
async function pvpStart(v){
  ++pvpTok; clearTimeout(pvpPoll); tgBack(false); arSeat = null;   // опрос останавливаем; pvpGo остаётся true до следующей комнаты; во время боя «Назад» нет
  // бой всегда целиком и одинаковой длины у всех в комнате: ни «Быстрый крафт», ни экономный режим его не укорачивают —
  // иначе в экономном режиме исход было видно раньше соперников. В экономном только без тяжёлых украшений (свечение, частицы)
  const r = pvpResult(v), fast = false, a = $('fxArena');
  // все слетаются к банку, горнило вспыхивает
  if (!fast && arenaOn){   // только старый экран арены; в Арене (tab2) сразу заставка — без паузы и лишнего свиста
    $('arPit')?.classList.add('fire'); FullGlow.set(FIRE_GLOW); FullGlow.punch(0, 1); FX.gainTo = 1; Sfx.whoosh(); haptic('heavy');
    [...($('arSeats')?.children || [])].forEach((s, i) => s.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-120px) scale(.3)', opacity: 0 }], { duration: 520, delay: i * 30, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' }));
    await wait(560);
  }
  if (arenaOn) await a.animate([{ opacity: 1 }, { opacity: 0, filter: 'blur(6px)' }], { duration: 260, fill: 'forwards' }).finished;
  // заставка старта боя — удар молота по наковальне
  if (!fast){
    const box = $('fxIntro'), ham = box.querySelector('.fi-h'), anv = box.querySelector('.fi-a'), orb = box.querySelector('.fi-orb');
    // все анимации блока — и завершённые «залипшие» тоже — снимаем: иначе силуэты оставались висеть поверх итога
    const clear = () => document.getAnimations().forEach(x => { const t = x.effect?.target; if (t && (t === box || box.contains(t)) && !t.classList.contains('fi-sp')) x.cancel(); });
    clear(); orb.style.visibility = 'hidden'; box.classList.add('fire');                         // круг кнопки крафта на огненной арене чужой — только молот и наковальня
    box.style.opacity = 1; box.style.visibility = 'visible'; ham.style.rotate = '62deg';                 // конечное состояние ставим сразу, анимации — без «залипания»
    box.animate([{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.3,1.3,.5,1)' });
    await ham.animate([{ rotate: '40deg' }, { rotate: '62deg' }], { duration: 500, easing: 'cubic-bezier(.3,1.2,.5,1)' }).finished;
    await anvilHit(box, ham, anv, '62deg');
    clear(); box.style.opacity = ''; box.style.visibility = ''; ham.style.rotate = ''; orb.style.visibility = ''; box.classList.remove('fire');
  } else if (fast){ Sfx.lock(); FullGlow.punch(0, .8); }
  a.getAnimations().forEach(x => x.cancel());
  // игроки и их тикеты — по возрастанию, цвет — ранг тикета
  // сверху крупно — общий банк; внизу — 6 ровных ячеек (по местам арены), пустые места остаются пустыми
  const pl = [...r.pvp.players].sort((a, b) => a.guess - b.guess);
  $('fxPvp').innerHTML = `<div class="pvp-bank"><small>${$t("Общий банк")}</small><b><img src="assets/ton.svg" alt="">${fmt(r.pvp.bank)}</b></div><div class="pvp-avas">` +
    pl.map(x => `<span class="pvc pva${x.me ? ' me' : ''}" style="--tc:${tierOfN(x.guess).c}">${pvpAva(x)}<b>${tk(x.guess)}</b><i class="pvd"></i></span>`).join('') +
    `<span class="pvc pva empty"><img src="assets/helm.svg" alt=""></span>`.repeat(Math.max(0, PVP_MAX - pl.length)) + `</div>`;
  $('fx').classList.remove('arena'); arenaOn = false;  await reveal(r, fast);
}
// после того как тикет встал: подсветить победителя, показать разницу у каждого, потом — свой экран дропа
async function pvpAfter(r){
  const chips = [...$('fxPvp').querySelectorAll('.pvc:not(.empty)')], sorted = [...r.pvp.players].sort((a, b) => a.guess - b.guess);
  const tie = r.pvp.ties > 1;
  chips.forEach((c, i) => { const x = sorted[i]; c.querySelector('.pvd').textContent = '±' + x.dist.toLocaleString(LOC); c.classList.add(x.win ? 'win' : 'lose');
    if (x.win && tie) c.insertAdjacentHTML('beforeend', `<em class="pvtie">${$t("ничья")}</em>`); });
  haptic('heavy'); r.pvp.won ? Sfx.rank(3) : Sfx.lock();
  await wait(1700);
  if (r.pvp.won) return showDrop(r).then(() => pvpWinDrop(r));
  pvpLoseDrop(r);
}
// все игроки по близости к выпавшему тикету — строки как в истории; победитель — зелёный, ты — в рамке
// все игроки — тем же блоком, что «Топ по XP» и «Твои друзья» (.sect + .trow): место по близости к тикету, ник, тикет и расстояние, справа — итог.
// Блок стоит под подписью итога отдельно (#fxPl), чтобы на него не действовали крупные стили подписи
function pvlList(p, r){
  let el = $('fxPl'); if (!el){ el = document.createElement('div'); el.className = 'fx-pl'; el.id = 'fxPl'; $('fxWin').after(el); }
  el.innerHTML = pvlHTML(p, r);
}
// шапка — колонками, как подпись под призом: Банк (при ничьей — доля) · Множитель · Игроков
// победитель — отдельным блоком над списком (аватар, ник, тикет, приз); остальные — списком ниже
// игрок строкой: аватар, ник, тикет и расстояние; справа — итог
const pvlRow = (x, p, r) => { const nft = x.win ? (x.me ? r.nft : p.winNft) : null, ch = x.me ? r.change : p.winChange;
  return `<div class="trow${x.me ? ' me' : ''}${x.win ? ' win' : ''}">${pvpAva(x)}` +
    `<span class="tn"><b>${x.me ? $t("Ты") : '@' + x.who}</b><small>${$t("тикет")} <i class="tkc" style="color:${tierOfN(x.guess).c}">${tk(x.guess)}</i> · ±${x.dist.toLocaleString(LOC)}</small>` +
    `</span>` + pvlWin(x, p, r) + `</div>`; };
// сверху — статистика боя (Бой · Банк · Множитель · Игроков), ниже все игроки по близости к тикету — победитель первым
const pvlHTML = (p, r) => `<div class="sect pvls">` +
    fxStats([p.no ? [$t("Арена"), '#' + p.no.toLocaleString(LOC)] : null, [p.ties > 1 ? $t("Доля банка") : $t("Банк"), fxGv(p.share ?? p.bank)], [$t("Множитель"), 'x' + fmt(r.mult)], [$t("Игроков"), String(p.players.length)]]) +
    [...p.players].sort((a, b) => a.dist - b.dist).map(x => pvlRow(x, p, r)).join('') + `</div>`;
// итог в строке: проиграл — взнос серым; победил — общий выигрыш зелёным (с NFT — и картинка подарка)
function pvlWin(x, p, r){
  if (!x.win) return `<span class="tb2 lost"><i class="gm"></i>${fmt(p.fee)}</span>`;
  const nft = x.me ? r.nft : p.winNft, ch = x.me ? r.change : p.winChange;
  // NFT — справа две строки зелёным: цена подарка и сдача, рядом картинка
  if (nft) return `<span class="pvl-nft"><span class="pvl-v2"><b><i class="gm"></i>${fmt(nft.value)}</b>${ch > 0 ? `<b><i class="gm"></i>${fmt(ch)}</b>` : ''}</span><img src="${nft.nft.src}" alt="" style="background:linear-gradient(160deg,${nft.a},${nft.b})"></span>`;
  return `<span class="tb2 pos"><i class="gm"></i>${fmt(x.me ? r.win : (p.winPay ?? 0))}</span>`;
}
// выигрыш: обычный экран дропа (приз крупно — и GRAM, и NFT); под суммой — на что был крафт. Все игроки — в истории
function pvpWinDrop(r){
  const p = r.pvp, st = fxStats([[p.ties > 1 ? $t("Доля банка") : $t("Банк"), fxGv(p.share), 'g'], [$t("Множитель"), 'x' + fmt(r.mult)], fxWinCol(r), fxChange(r)]);
  const old = $('fxWin').querySelector('.fx-stats'); if (old) old.outerHTML = st; else $('fxWin').insertAdjacentHTML('beforeend', st);

}
function pvpLoseDrop(r){
  const p = r.pvp, w = p.players.find(x => x.win), wins = p.players.filter(x => x.win).length;
  // сверху — кто крафтил на банк и что ему выпало (тикет тот же, что выпал всем); ниже — все игроки по близости к тикету, как в истории
  $('fxDrop').innerHTML = '';   // победитель — первым в списке игроков, отдельный блок сверху не нужен
  $('fxWin').innerHTML = ''; pvlList(p, r);
  if (p.winPay > 0) setTimeout(() => pushLive(liveHTML(r.ticket, { who: '@' + w.who, stake: p.share, win: p.winPay, arena: { bank: p.bank, n: p.n } })), 300);
  $('fx').classList.add('pvpl', 'lost');
  $('fxBtns').innerHTML = `<button class="btn-main" id="pvpAgain">${$t("Вернуться")}</button>` + PF_LINK;
  $('fx').classList.add('done');
  if (!S.demo){ logCraft(r, 'lose'); xpTurn(p.fee); }
  $('pvpAgain').onclick = backToArena;
  if ($('pvpBack')) $('pvpBack').onclick = async () => { if (pvpLoseDrop.on) return; pvpLoseDrop.on = true; haptic(); await closeFx(); CRAFT.classList.remove('busy'); S.busy = false; pvpLoseDrop.on = false; restartAuto(); };
  $('fxPfIn').onclick = () => openPF(r);
  $('fxShare').onclick = () => shareWin($t("Сыграл в PvP крафт в Pawn"));
  setTimeout(() => { FX.hot = false; }, 900);
}
// «Снова на арену» — без выхода на главную: экран крафта превращается обратно в арену
async function backToArena(){
  haptic(); const fi = $('fxIn');
  await fi.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).finished;
  $('fx').classList.remove('done', 'fail', 'lost', 'pvpl'); $('fxDrop').innerHTML = $('fxWin').innerHTML = $('fxBtns').innerHTML = $('fxPvp').innerHTML = ''; Tilt.drop($('fxDrop'));
  $('fx').classList.add('arena'); arenaOn = true; FullGlow.set(FIRE_GLOW); FX.gainTo = .55; tgBack(true);
  $('fxArena').style.opacity = ''; await pvpLoad();
  fi.getAnimations().forEach(x => x.cancel());
}
