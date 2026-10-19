/* =========================================================
   СЕЗОН (баттл пасс, «Пасс») — прототип на моке. Заменяет неделю, бесплатные кейсы по запасу, достижения, звания и топ.
   Очки сезона — тот же XP (оборот 0.5 XP за 1 GRAM, задания дня, сторис), только считаются с начала сезона. XP из кейсов в сезон не идёт.
   Каждые SEASON.per XP — уровень. На уровне две награды: бесплатная и премиум (премиум покупается раз за сезон).
   У сезона тема (SEASON_THEMES): название, арт, цвета, финальные NFT и своё задание.
   Вернуть как было: Дебаг → Сезон → «Как было» (ключ bm-season). Старые экраны и данные не тронуты.
   В бою: прогресс, задания, награды и покупку проверяет сервер (docs/BACKEND.md, раздел «Сезон»)
   ========================================================= */
const SEASON = { epoch: Date.UTC(2026, 9, 12, 21), days: 28, lv: 30, per: 250, price: 10, taskXp: 30, bonusXp: 50, premMul: 1.2, chestXp: 500, freeOut: 3 };   // сезоны идут подряд от понедельника 13.10 00:00 МСК
const seasonNo = () => Math.floor((Date.now() - SEASON.epoch) / (SEASON.days * 864e5)) + 1;
const seasonLeft = () => SEASON.epoch + seasonNo() * SEASON.days * 864e5 - Date.now();
// темы сезонов: key — класс оформления экрана, cols — коллекции темы (показываем их для примера в NFT-наградах), task — задание темы на каждый день
const SEASON_THEMES = {
  1: { name: $t("Хэллоуин"), art: 'assets/season-halloween.webp', bg: 'radial-gradient(120% 140% at 85% 0%,#FF9A2E 0%,#E2531E 38%,#5B1A8C 100%)', key: 'hw', cols: ['Mad Pumpkin', 'Jester Hat', 'Flying Broom', 'Hex Pot', 'Witch Hat', 'Skull Flower', 'Eternal Candle'],
       task: ['h13', $t("Выбей тикет с «13» — чёртова дюжина"), 1, t => t.t13] },
};
const seasonTheme = (id = S.season.id) => SEASON_THEMES[id] || { name: '', art: 'assets/season-pass.webp', bg: '', key: '', cols: [], task: null };
/* NFT-награды — по цене, а не по коллекции: выдаём то, что есть у релеера в этой цене (конкретную коллекцию не гарантировать — неизвестно, сколько игроков дойдёт).
   free — 30-й уровень бесплатной дорожки, prem — премиум. Для примера на плитке — подарок темы в этой цене */
const SEASON_NFT = { free: [0, 4], prem: [RARE_FROM, RARE_TO] };
const nftPool = side => { const [lo, hi] = SEASON_NFT[side]; return NFTS.filter(n => n.price >= Math.max(lo, NFT_FROM) && n.price <= hi); };
const nftLabel = side => side === 'free' ? $t("NFT до {0} GRAM", SEASON_NFT.free[1]) : $t("NFT {0}–{1} GRAM", SEASON_NFT.prem[0], SEASON_NFT.prem[1]);
// награды по уровням: g — GRAM, c — кейс (открывается сразу), nft — подарок по цене, cos — косметика темы (остаётся навсегда). Черновик экономики: бесплатная ≈ 9 GRAM за сезон, премиум ≈ 22 GRAM за 10 GRAM
// dep — бонус к ближайшему пополнению [%, максимум GRAM] на 7 дней; out — выводы NFT без комиссии (не сгорают)
const B = 'beast', M = 'musk', D = 'durov', ST = 'satoshi';
const RW_FREE = [{ g: .1 }, { g: .15 }, { c: B }, { out: 1 }, { dep: [10, 1] }, { c: B }, { g: .15 }, { g: .2 }, { c: B }, { c: M }, { g: .2 }, { c: B }, { out: 1 }, { g: .2 }, { cos: 'badge' },
  { g: .25 }, { dep: [15, 2] }, { c: B }, { g: .25 }, { c: M }, { c: B }, { g: .3 }, { out: 1 }, { c: B }, { c: D }, { g: .3 }, { c: B }, { dep: [20, 3] }, { g: .3 }, { nft: 'free' }];
const RW_PREM = [{ g: .2 }, { c: D }, { g: .3 }, { dep: [20, 3] }, { c: D }, { out: 2 }, { g: .3 }, { c: M }, { g: .4 }, { cos: 'frame' }, { g: .4 }, { dep: [30, 5] }, { c: M }, { g: .5 }, { c: D },
  { out: 2 }, { g: .5 }, { c: M }, { g: .5 }, { c: ST }, { c: D }, { g: .6 }, { dep: [50, 10] }, { c: M }, { c: ST }, { cos: 'entry' }, { out: 3 }, { c: D }, { g: .6 }, { nft: 'prem' }];
const SEASON_RW = RW_FREE.map((free, i) => ({ l: i + 1, free, prem: RW_PREM[i] }));
const seasonNew = () => ({ id: seasonNo(), xp: 0, prem: false, got: {}, chests: 0 });
S.season = seasonNew();
if (SEASON_ON) DRAWER_NAMES.casesDrawer = $t("Сезонный пасс");   // «‹ Пасс» в кнопке «назад» у шторок, открытых из него
// новый сезон — с нуля; незабранное за пройденные уровни прошлого сезона не сгорает — выдаётся само (в бою — сервер при закрытии сезона)
function seasonFresh(){ if (S.season.id === seasonNo()) return; const old = S.season; S.season = seasonNew(); if (SEASON_ON && old.xp > 0) seasonSettle(old); }
function seasonSettle(old){
  const lv = Math.min(SEASON.lv, Math.floor(old.xp / SEASON.per)), sum = { g: 0, cases: 0, nft: [] };
  const give = rw => { if (rw.g) sum.g += rw.g;
    else if (rw.cos) cosGive((seasonTheme(old.id).key || 's') + '-' + rw.cos);   // косметика — сразу твоя
    else if (rw.out) S.freeOut = (S.freeOut || 0) + rw.out;
    else if (rw.dep) seasonDep(rw.dep);
    else if (rw.c && caseById(rw.c).price) sum.g += caseById(rw.c).price;   // платный кейс — его цену на баланс
    else if (rw.c){ S.stock[rw.c] = (S.stock[rw.c] || 0) + 1; sum.cases++; }   // бесплатные — в запас, открыть можно в «Кейсах»
    else if (rw.nft){ const n = nftPick(rw.nft); INV = [giftOf(n), ...INV]; sum.nft.push(n.name); } };
  SEASON_RW.filter(r => r.l <= lv).forEach(r => { if (!old.got['f' + r.l]) give(r.free); if (old.prem && !old.got['p' + r.l]) give(r.prem); });
  if (old.prem){ const ch = Math.max(0, Math.floor((old.xp - SEASON.lv * SEASON.per) / SEASON.chestXp) - (old.chests || 0)); S.stock.beast = (S.stock.beast || 0) + ch; sum.cases += ch; }
  sum.g = Math.round(sum.g * 100) / 100; if (sum.g) setBalance(Math.round((S.balance + sum.g) * 100) / 100);
  const parts = [sum.g ? `+${fmt(sum.g)} GRAM` : '', sum.cases ? `${sum.cases} ${$n("кейс|кейса|кейсов", sum.cases)}` : '', ...sum.nft].filter(Boolean);
  track('season_end', { season: old.id, lv, g: sum.g, cases: sum.cases, nft: sum.nft.length });
  if (parts.length) S.hist.rewards.unshift({ kind: 'season', title: $t("Сезон {0} завершён", old.id) + ' · ' + parts.join(', '), rw: { g: sum.g }, t: Date.now() });
  setTimeout(() => notify({ type: 'ok', icon: 'ok', color: '#F57A37', ms: 7000, title: $t("Сезон {0} завершён", old.id),
    text: parts.length ? $t("Незабранные награды — твои: {0}", parts.join(', ')) : $t("Начался сезон {0} — уровни с нуля", S.season.id) }), 2500);
}
const seasonLv = () => Math.min(SEASON.lv, Math.floor(S.season.xp / SEASON.per));
const seasonReady = () => SEASON_RW.filter(r => r.l <= seasonLv()).reduce((a, r) => a + (!S.season.got['f' + r.l]) + (S.season.prem && !S.season.got['p' + r.l]), 0) + seasonChests();
// сундуки после 30-го уровня (премиум): каждые 300 XP сверх максимума — кейс Мистера Биста
const seasonChests = () => S.season.prem ? Math.max(0, Math.floor((S.season.xp - SEASON.lv * SEASON.per) / SEASON.chestXp) - (S.season.chests || 0)) : 0;
// XP сезона: тот же addXp (src 'case' — из кейса — в сезон не идёт: иначе пасс выгоднее «покупать» кейсами), премиум — +20%
function seasonXp(v, src){
  if (!SEASON_ON || !(v > 0) || !S.season || src === 'case') return; seasonFresh();
  const was = seasonLv(); S.season.xp = Math.round((S.season.xp + v * (S.season.prem ? SEASON.premMul : 1)) * 10) / 10; const now = seasonLv();
  if (now > was) setTimeout(() => { notify({ type: 'ok', img: 'assets/xp.webp', color: '#F57A37', title: $t("Уровень сезона {0}", now), text: $t("Забери награду в Пассе") }); Sfx.rank?.(Math.min(4, now % 5)); track('season_level', { lv: now }); }, 1800);
}
const seasonTaskRw = rw => SEASON_ON ? { xp: SEASON.taskXp } : rw;   // старые задания (режим «как было») в сезоне не используются
const leftDays = ms => { const d = Math.ceil(ms / 864e5); return `${d} ${$n("день|дня|дней", d)}`; };

/* ---------- задания дня в сезоне: каждый день 3 из набора (одинаковые у всех, по дате МСК) + задание темы + 4-е для премиума ---------- */
const SEASON_TASKS = [
  ['early', $t("Сделай первый крафт до 12:00 МСК"), 1, t => t.early],
  ['crafts20', $t("Сделай 20 крафтов"), 20, t => t.crafts],
  ['turn30', $t("Набери 30 GRAM оборота"), 30, t => t.turnover],
  ['arena', $t("Сыграй бой на Арене"), 1, t => t.arena],
  ['bets3', $t("Сыграй 3 раунда Ставок"), 3, t => t.bets],
  ['luck5', $t("Поймай Удачу или выше 5 раз"), 5, t => t.luck],
  ['mega', $t("Поймай Мегу или выше"), 1, t => t.mega],
  ['case', $t("Открой любой кейс"), 1, t => t.cases],
  ['share', $t("Поделись выигрышем"), 1, t => t.shares],
];
const sDay = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
// набор дня: перемешивание по дате — у всех игроков одинаковый (в бою набор отдаёт сервер)
function seasonDaily(){
  let h = [...sDay()].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7); const pool = SEASON_TASKS.slice();
  for (let i = pool.length - 1; i > 0; i--){ h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return { day: pool.slice(0, 3), prem: pool[3] };
}
const stv = (t, f) => +(f(t) || 0);
function seasonTaskList(){ const d = seasonDaily(), th = seasonTheme().task;
  return [...d.day.map(x => ({ x, xp: SEASON.taskXp })), ...(th ? [{ x: th, xp: SEASON.bonusXp, theme: true }] : []), { x: d.prem, xp: SEASON.bonusXp, prem: true }]; }
const seasonTasksDone = () => seasonDaily().day.filter(([k, , n, f]) => stv(S.tasks, f) >= n).length;
// засчитать выполненные (после крафта, кейса, шеринга): XP — один раз за день, премиум-задание — только с премиумом
function seasonTasksCheck(){
  if (!SEASON_ON || S.demo) return; S.tasks.done ||= {};
  seasonTaskList().forEach(({ x: [k, t, n, f], xp, prem }) => { const key = 's:' + k + (prem ? ':p' : '');
    if (S.tasks.done[key] || stv(S.tasks, f) < n || (prem && !S.season.prem)) return;
    // XP и «Задание выполнено» — когда сервер подтвердил (он сам проверяет условие); отказал — задание остаётся невыполненным
    S.tasks.done[key] = 1; const t0 = Date.now();
    API.seasonTask(key, xp).then(() => { track('task_done', { id: k, prem: !!prem }); setTimeout(() => { addXp(xp); logReward('task', k, { xp }); notify({ type: 'ok', icon: 'ok', title: $t("Задание выполнено"), text: `${t} · +${xp} XP` }); }, Math.max(0, 1200 - (Date.now() - t0))); },
      () => { delete S.tasks.done[key]; }); });
}
// счётчики заданий: крафт, Арена, ставки, ранг — из итога игры; кейсы и шеринг — отдельно
function seasonCount(r){
  const T = S.tasks; if (r.pvp) T.arena = (T.arena || 0) + 1; else if (r.bets) T.bets = (T.bets || 0) + 1;
  if (tk(r.ticket).includes('13')) T.t13 = (T.t13 || 0) + 1;   // задание темы «чёртова дюжина»
  if (!r.bets && r.ti >= 1) T.luck = (T.luck || 0) + 1; if (!r.bets && r.ti >= 2) T.mega = (T.mega || 0) + 1;
  seasonTasksCheck();
}
const seasonBump = k => { if (!SEASON_ON || S.demo) return; S.tasks[k] = (S.tasks[k] || 0) + 1;
  if (k === 'shares') try { localStorage.setItem('tg-shares', JSON.stringify({ day: sDay(), n: S.tasks.shares })); } catch(_){}   // шеринг сервер не видит — счётчик дня храним на телефоне
  seasonTasksCheck(); };

// награда на плитке: крупная картинка и подпись; на премиум-дорожке — по тёмному золоту
const FLOOR_NFT = () => NFTS.slice().sort((a, b) => a.price - b.price)[0];
// пример на плитке — подарок темы в этой цене; при получении — любой из стока в этой цене (в бою выбирает сервер)
const themeNft = (side, id) => { const P = nftPool(side).sort((a, b) => a.price - b.price), cols = seasonTheme(id).cols; return P.find(n => cols.includes(n.name)) || P[0] || FLOOR_NFT(); };
const nftPick = side => { const P = nftPool(side); return P.length ? P[Math.random() * P.length | 0] : FLOOR_NFT(); };
const COS = { badge: [$t("Значок «Тыква»"), $t("у твоего имени в меню")], frame: [$t("Рамка «Золото»"), $t("вокруг аватарки — видят все, и на Арене")],
  entry: [$t("Вход «Зелье»"), $t("всплеск зелья и призраки, когда входишь на Арену — видят все в комнате")] };
const COS_IMG = { frame: 'assets/frame-gold.webp', entry: 'assets/fx-potion-icon.webp' };   // картинка награды на дорожке; значок — арт темы
/* оформление: что есть у игрока (S.cos) и что надето (S.equip). Рамки — картинки поверх аватарки (k — во сколько раз больше аватарки) */
const COS_ITEMS = {
  'gold-frame': { slot: 'frame', name: $t("Хэллоуин"), img: 'assets/frame-hw.webp', k: 1.55, how: $t("за премиум в Пассе"), why: $t("Дают сразу за покупку премиума в Пассе") },   // за покупку — тыквенная
  'hw-frame': { slot: 'frame', name: $t("Золото"), img: 'assets/frame-gold.webp', k: 1.72, lv: 10, prem: true },   // золотая — заслужить на 10-м уровне
  'hw-badge': { slot: 'badge', name: $t("Тыква"), img: 'assets/season-halloween.webp', icon: 'pumpkin', lv: 15 },
  'hw-entry': { slot: 'entry', name: $t("Зелье"), img: 'assets/fx-potion-icon.webp', lv: 26, prem: true },   // эффект входа на Арену (Горн, potion)
 };
// откуда берётся: коротко на плитке и подробно по тапу
const cosHow = c => c.how || (c.prem ? $t("{0} ур. премиум-Пасса", c.lv) : $t("{0} ур. Пасса", c.lv));
const cosWhy = c => c.why || $t("Награда Пасса на {0} уровне{1}. Уровни растут от XP за игры", c.lv, c.prem ? $t(" — с премиумом") : '');
const COS_SLOTS = [['frame', $t("Рамка")], ['badge', $t("Значок у имени")], ['entry', $t("Вход на Арену")]];
S.cos = {}; S.equip = {};
const cosOn = slot => SEASON_ON && S.equip[slot] && S.cos[S.equip[slot]] ? COS_ITEMS[S.equip[slot]] : null;
const frameHTML = () => { const f = cosOn('frame'); return f ? `<img class="ava-fr" src="${f.img}" style="--k:${f.k}" alt="">` : ''; };
function cosApply(){
  document.body.classList.remove('cos-skin-hw');   // скин кнопки крафта убран: в режимах у кнопки свой цвет и иконка
  document.querySelectorAll('.balance .ava-w, .cb .t2ava').forEach(w => { w.querySelector('.ava-fr')?.remove(); w.insertAdjacentHTML('beforeend', frameHTML()); });   // шапка и аватарка в кнопке Арены
}
// получил предмет — сразу надеваем, если слот пустой
function cosGive(id){ S.cos[id] = 1; const sl = COS_ITEMS[id]?.slot; if (sl && !S.equip[sl]) S.equip[sl] = id; cosApply(); }
// значок у имени — векторная иконка (картинка в размере текста не читается)
const BADGE_SVG = { pumpkin: '<svg class="cos-badge" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M12.6 2.2c1.6-.4 2.6.3 2.8 1.2-1 .1-1.8.6-2.3 1.6 2.8-.6 5.4.4 6.9 2.4 2.1 2.6 2.1 7.9-.4 10.9-1.9 2.3-4.4 3.2-7.6 3.2s-5.7-.9-7.6-3.2c-2.5-3-2.5-8.3-.4-10.9 1.4-1.9 3.8-2.9 6.4-2.5.3-1.2 1-2.2 2.2-2.5zM6.2 9.8l4.4 2.5-4.4 1.5zm11.6 0l-4.4 2.5 4.4 1.5zM6.4 15c3.7 2.8 7.5 2.8 11.2 0l-1.2 3-1.9-1.2-1.4 1.6-1.1-1.4-1.1 1.4-1.4-1.6-1.9 1.2z"/></svg>' };
const cosBadge = () => { const b = cosOn('badge'); return b ? BADGE_SVG[b.icon] || '' : ''; };
// шторка «Оформление»: превью, слоты, «пусто» и всё, что можно получить
function renderCos(){
  const pv = `<div class="cos-pv"><span class="ava-w big"><img src="assets/avatar.webp" alt="">${frameHTML()}</span><b>${cosBadge()}GK</b></div>`;
  $('cosBody').innerHTML = pv + COS_SLOTS.map(([sl, t]) => `<div class="sec-t">${t}</div><div class="cos-g">` +
    `<button class="cos-i${S.equip[sl] ? '' : ' on'}" data-cos="${sl}:"><span class="cos-img"><span class="cos-none"></span></span><b>${$t("Пусто")}</b><small>${({ frame: $t("без рамки"), badge: $t("без значка"), entry: $t("без эффекта") })[sl]}</small></button>` +
    Object.entries(COS_ITEMS).filter(([, c]) => c.slot === sl).map(([id, c]) => { const has = !!S.cos[id], on = S.equip[sl] === id;
      return `<button class="cos-i${on ? ' on' : ''}${has ? '' : ' lock'}" data-cos="${sl}:${id}"><span class="cos-img${sl === 'frame' ? ' fr' : ''}">${sl === 'frame' ? `<img class="cos-av" src="assets/avatar.webp" alt=""><img class="cos-fr" src="${c.img}" style="--k:${c.k}" alt="">` : `<img src="${c.img}" alt="">`}</span><b>${c.name}</b><small>${has ? (on ? $t("надето") : $t("есть · надеть")) : cosHow(c)}</small></button>`; }).join('') + `</div>`).join('');
}
function openCos(){ track('screen', { id: 'cos' }); swapDrawer('cosDrawer', renderCos); }
$('cosDrawer').addEventListener('click', e => { const b = e.target.closest('[data-cos]'); if (!b) return; const [sl, id] = b.dataset.cos.split(':');
  if (id && !S.cos[id]){ haptic('rigid'); return notify({ type: 'info', img: COS_ITEMS[id].img, title: COS_ITEMS[id].name, text: cosWhy(COS_ITEMS[id]) }); }
  S.equip[sl] = id || null; API.cosEquip(sl, id || null).catch(() => {}); haptic(); track('cos_equip', { slot: sl, id: id || null }); cosApply(); { const sc = $('cosBody').scrollTop; renderCos(); $('cosBody').scrollTop = sc; }   // выбор не прокручивает список наверх
  if (sl === 'entry' && id) entryFx($('cosBody').querySelector(`[data-cos="entry:${id}"] .cos-img`), id); });   // надел эффект — сразу показываем на его плитке
/* эффект входа на Арену «Зелье» — Горн (potion): разовый, холст сам убирается после. В экономном режиме — без эффекта */
function entryFx(el, id){
  if (!el || id !== 'hw-entry' || S.lite || !el.isConnected || typeof Forge === 'undefined') return;
  const r = el.getBoundingClientRect(); if (!r.width) return;
  Forge.play('potion', { x: r.left + r.width / 2, y: r.top + r.height / 2, size: Math.max(r.width, 48) * 2.6 }); Sfx.coin?.(); haptic('medium');
}
// эффект входа игрока на Арене: свой — из надетого; соперник — с сервера (eq.entry), в моке — у части ботов
const ENTRY_ROOM = 2;   // комната 2 GRAM — витрина: «Зелье» при входе у всех
const entryOf = (x, fee) => fee === ENTRY_ROOM && SEASON_ON ? 'hw-entry' : x.me ? (cosOn('entry') ? S.equip.entry : null) : x.eq ? x.eq.entry || null : SEASON_ON && [...x.who].reduce((a, c) => a + c.charCodeAt(0) * 3, 0) % 4 === 0 ? 'hw-entry' : null;
function srwHTML(rw){
  if (rw.cos) return `<img class="scos" src="${COS_IMG[rw.cos] || seasonTheme().art}" alt=""><b>${COS[rw.cos][0]}</b>`;
  if (rw.dep) return `<img src="assets/hw-caul.webp" alt=""><b>+${rw.dep[0]}% ${$t("к пополнению")}</b>`;
  if (rw.out) return `<img src="assets/hw-ghost.webp" alt=""><b>${$t("Вывод без комиссии")}${rw.out > 1 ? ' ×' + rw.out : ''}</b>`;
  if (rw.c){ const c = caseById(rw.c); return `<img src="${c.img}" alt=""><b>${c.short}</b>`; }
  if (rw.nft){ const n = themeNft(rw.nft); return `<i class="sc-ex">${$t("пример")}</i><img class="snft" src="${n.src}" alt=""><b>${$t("Случайный")} ${nftLabel(rw.nft)}</b>`; }   // картинка — заглушка, NFT выпадет случайный
  return `<img src="assets/hero-gem-128.webp" alt=""><b>${rw.g} GRAM</b>`;
}
const LOCK_I = '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';
function scell(r, track){
  const k = (track === 'free' ? 'f' : 'p') + r.l, got = S.season.got[k], open = r.l <= seasonLv(), lock = track === 'prem' && !S.season.prem;
  const st = got ? 'got' : lock ? 'lock' : open ? 'ready' : 'soon';
  // «Забрать» — поверх центра картинки награды, высота плитки не меняется
  const h = srwHTML(r[track]).replace(/^(<i[^>]*>[^<]*<\/i>)?(<img[^>]*>)/, (m, ex = '', img) => `${ex}<span class="sc-pic">${img}${st === 'ready' ? `<em class="sc-go" data-sclaim="${k}">${$t("Забрать")}</em>` : ''}</span>`);
  return `<button class="scell ${track} ${st}" data-sinfo="${k}">${h}` +   // тап по плитке — подробности
    (st === 'ready' ? '' : got ? `<i class="sc-ic ok">${svg(NICON.ok)}</i>` : lock ? `<i class="sc-ic">${svg(LOCK_I)}</i>` : '') + `</button>`;
}
const caseEV = c => c.items.reduce((a, it) => a + it.ch / 100 * (it.t === 'gram' ? it.v : it.t === 'nft' ? (it.rare ? (RARE_FROM + RARE_TO) / 2 : NFT_FLOOR) : 0), 0);
const rwValue = rw => rw.cos || rw.dep ? 0 : rw.out ? rw.out * OUT_FEE : rw.g || (rw.c ? caseEV(caseById(rw.c)) : rw.nft ? (Math.max(NFT_FROM, SEASON_NFT[rw.nft][0]) + SEASON_NFT[rw.nft][1]) / 2 : 0);
// максимум премиум-дорожки: GRAM + средняя ценность кейсов + выводы + бонусы к пополнению по максимуму + NFT по верхней цене − цена пропуска
const premMax = () => Math.round(SEASON_RW.reduce((a, r) => { const rw = r.prem; return a + (rw.dep ? rw.dep[1] : rw.nft ? SEASON_NFT.prem[1] : rwValue(rw)); }, 0) - SEASON.price);
// одна строка выгоды — одинаковая в шапке и в шторке покупки
const premValLine = () => `<span class="hx-val"><small>${$t("Выгода до")}</small><span><i class="gm"></i>${premMax()} GRAM</span></span>`;
const trackValue = side => Math.round(SEASON_RW.reduce((a, r) => a + rwValue(r[side]), 0));
// что даёт премиум — в карточке пропуска и в шторке покупки
const PREM_PERKS = () => { const th = seasonTheme(); return [
  [$t("Сразу — кейс Сатоши"), $t("открывается в момент покупки")],
  [$t("Вторая дорожка наград"), $t("кейсы Дурова, Маска и Сатоши, бонусы до +50% к пополнению, {0} на 30-м", nftLabel('prem'))],
  [$t("+20% XP сезона"), $t("уровни растут быстрее")],
  [$t("4-е задание дня"), $t("+{0} XP каждый день", SEASON.bonusXp)],
  [$t("Сундуки после 30-го"), $t("кейс Мистера Биста каждые {0} XP", SEASON.chestXp)],
  [$t("{0} вывода NFT без комиссии", SEASON.freeOut), $t("экономия {0} GRAM", fmt(SEASON.freeOut * OUT_FEE))],
  [$t("Рамка «Хэллоуин»"), $t("навсегда · надевается в «Оформлении»")]]; };
// бесплатные выводы NFT для премиума — сколько осталось в этом сезоне
const premOuts = () => SEASON_ON && S.season?.prem ? Math.max(0, SEASON.freeOut - (S.season.outs || 0)) : 0;
const freeOuts = () => premOuts() + (S.freeOut || 0);   // + выводы без комиссии из наград уровней (не сгорают)
function useFreeOut(){ if (premOuts()) S.season.outs = (S.season.outs || 0) + 1; else if (S.freeOut) S.freeOut--; }
// бонус к пополнению из награды: на 7 дней, больший заменяет меньший
function seasonDep([pct, max]){ if (!bonusOn() || bonusOn().pct < pct) S.bonus = { pct, max, until: Date.now() + 7 * 864e5 }; }
// шапка сезона: тема, уровень крупно, полоса до следующего; без премиума — карточка пропуска
function seasonHero(){
  const lv = seasonLv(), max = lv >= SEASON.lv, over = Math.max(0, S.season.xp - SEASON.lv * SEASON.per), th = seasonTheme(), need = Math.ceil((lv + 1) * SEASON.per - S.season.xp);
  // после 30-го полоса показывает путь до следующего сундука (премиум) — XP продолжает копиться
  const k = max ? (S.season.prem ? (over % SEASON.chestXp) / SEASON.chestXp : 1) : (S.season.xp - lv * SEASON.per) / SEASON.per;
  // слева — сезон, уровень и полоса (летучая мышь сидит на полосе), справа — арт темы во всю высоту; снизу — премиум во всю ширину карточки
  return `<div class="shero"${th.bg ? ` style="background:${th.bg}"` : ''}><div class="hx-top"><div class="hx-l"><em>${$t("Сезон {0}", S.season.id)}${th.name ? ' · ' + th.name : ''}</em><b>${$t("Уровень {0}", lv)}</b>${max ? `<span class="hx-xp">${xpFmt(S.season.xp)} XP</span>` : ''}` +
    `<div class="hx-bar"><i><b style="width:${(k * 100).toFixed(1)}%"></b></i></div>` +
    `<small>${max ? (S.season.prem ? $t("Все уровни пройдены · ещё {0} XP до сундука", xpFmt(SEASON.chestXp - over % SEASON.chestXp)) : $t("Все уровни пройдены · сундуки — с премиумом")) : $t("Ещё {0} XP до уровня {1}", xpFmt(need), lv + 1)}</small></div><img class="hx-art" src="${th.art}" alt=""></div>` +
    // куплен — тот же блок, но с отметкой «активен» и сиянием; кнопка ведёт к тем же подробностям
    (S.season.prem ? `<button class="hx-prem on" data-sact="buyask"><span class="hx-lc"><img src="assets/season-pass-on.webp" alt=""></span><div><b class="hx-pt">${$t("Премиум активен")}</b>${premValLine()}</div><em>${$t("Что даёт премиум")} ›</em></button>` :
      `<button class="hx-prem" data-sact="buyask"><span class="hx-lc"><img src="assets/season-pass.webp" alt=""></span><div><b class="hx-pt">${$t("Премиум-пропуск")}</b>${premValLine()}` +
      `</div><em>${$t("Что даёт премиум")} ›</em></button>`) + `</div>`;
}
// коротко — для карточки в шапке
const PREM_SHORT = () => [$t("Кейс Сатоши сразу"), $t("Вторая дорожка наград"), $t("+20% XP и 4-е задание дня"), $t("{0} вывода NFT без комиссии", SEASON.freeOut)];
// шкала уровней: одна линия, заливка — ровно до текущего XP (новый уровень — на кружке)
// заполнение отрезка шкалы от уровня L к L+1 (0…1)
const seasonSeg = L => { const lv = seasonLv(); return L < lv ? 1 : L === lv && lv < SEASON.lv ? (S.season.xp - lv * SEASON.per) / SEASON.per : 0; };
function seasonLine(){
  const T = document.querySelector('#casesBody .strack'); if (!T) return; const N = [...T.querySelectorAll('.st-n')]; if (!N.length) return;
  const top = T.getBoundingClientRect().top, y = n => { const r = n.getBoundingClientRect(); return r.top - top + r.height / 2; }, lv = seasonLv(), k = lv >= SEASON.lv ? 0 : (S.season.xp - lv * SEASON.per) / SEASON.per;
  const y0 = y(N[0]) - 64, yl = y(N[N.length - 1]), fill = lv === 0 ? y0 + k * 64 : lv >= N.length ? yl : y(N[lv - 1]) + k * (y(N[lv]) - y(N[lv - 1]));
  T.style.setProperty('--l0', y0 + 'px'); T.style.setProperty('--l1', (yl - y0) + 'px'); T.style.setProperty('--lf', Math.max(0, fill - y0) + 'px');
}
function taskRow({ x: [k, t, n, f], xp, prem, theme }){
  const v = Math.min(n, stv(S.tasks, f)), lock = prem && !S.season.prem, ok = !lock && v >= n;
  return `<div class="arow${ok ? ' ok' : ''}${lock ? ' plock' : ''}${theme ? ' theme' : ''}"><i>${ok ? svg(NICON.ok) : lock ? svg(LOCK_I) : ''}</i><span>${prem ? `<small class="pm">${$t("Премиум")}</small>` : theme ? `<small class="th"><img src="${seasonTheme().art}" alt="">${$t("Задание сезона")}</small>` : n > 1 && !ok ? `<small>${fmt(v)} / ${n}</small>` : ''}<b>${t}${theme ? ` <button class="thq" data-sact="thq" aria-label="?">?</button>` : ''}</b></span><em class="x">${rewHTML({ xp })}</em></div>`;
}
function renderSeason(b){
  seasonFresh(); document.body.classList.toggle('sprem', !!S.season.prem);
  ['casesDrawer', 'passDrawer'].forEach(id => $(id).dataset.theme = seasonTheme().key || '');   // оформление темы (фон, цвета) — у «Пасса» и его шторок
  const L = seasonTaskList(), ready = seasonReady(), lv = seasonLv(), ch = seasonChests(), over = Math.max(0, S.season.xp - SEASON.lv * SEASON.per);
  b.innerHTML = seasonHero() +
    `<div class="sect"><div class="sect-h"><span><b>${$t("Задания дня")}</b><small>${$t("Новые — каждый день в 00:00 МСК")}</small></span><em class="cnt">${seasonTasksDone()} ${$t("из")} 3</em></div>` + L.map(taskRow).join('') + `</div>` +
    sdBanner() + casesBanner() +
    // дорожка: шкала уровней по центру (под номером — сколько XP до уровня), слева бесплатные награды, справа премиум
    `<div class="strack"><div class="st-h"><b>${$t("Бесплатно")}</b><span></span><b class="p">${$t("Премиум")}</b></div>` +
      SEASON_RW.map(r => { const t = seasonSeg(r.l - 1), b = seasonSeg(r.l), nx = r.l === lv + 1, me = r.l === lv && lv > 0;
        // линия по строке: верхняя половина — путь к этому уровню, нижняя — к следующему; «ты здесь» — у текущего уровня, у следующего — сколько осталось
        return `<div class="st-row${r.l <= lv ? ' open' : ''}${nx ? ' next' : ''}${r.l === 1 ? ' first' : r.l === SEASON.lv ? ' last' : ''}" style="--t:${r.l === 1 ? (lv > 0 ? 1 : seasonSeg(0)) : 0};--b:${b}">${r.l === 1 && seasonTheme().key === 'hw' ? '<img class="st-bat" src="assets/hw-bat.webp" alt="">' : ''}${scell(r, 'free')}` +
          `<em class="st-n">${r.l}${me ? `<img class="st-me" src="assets/avatar.webp" alt="">` : ''}<small>${nx ? $t("ещё {0} XP", xpFmt(Math.ceil(r.l * SEASON.per - S.season.xp))) : xpFmt(r.l * SEASON.per)}</small></em>${scell(r, 'prem')}</div>`; }).join('') + `</div>` +
    // после 30-го: сундуки премиума
    `<div class="schest${S.season.prem ? '' : ' lock'}"><img src="${caseById('beast').img}" alt=""><span><b>${$t("Сундуки после 30-го уровня")}</b><small>${!S.season.prem ? $t("Кейс Мистера Биста каждые {0} XP · только с премиумом", SEASON.chestXp) : lv < SEASON.lv ? $t("Кейс Мистера Биста каждые {0} XP после 30-го уровня", SEASON.chestXp) : $t("Ещё {0} XP до следующего · получено {1}", xpFmt(SEASON.chestXp - over % SEASON.chestXp), S.season.chests || 0)}</small>${S.season.prem && lv >= SEASON.lv ? `<i class="sch-bar"><b style="width:${((over % SEASON.chestXp) / SEASON.chestXp * 100).toFixed(1)}%"></b></i>` : ''}</span>` +
      (ch ? `<button class="pill-btn" data-sact="chest">${$t("Забрать · {0}", ch)}</button>` : S.season.prem ? '' : `<i class="sc-ic">${svg(LOCK_I)}</i>`) + `</div>` +
    rulesHTML([$t("Сезон длится {0} дней. XP сезона — за оборот (0.5 XP за 1 GRAM), задания дня и сторис. XP из кейсов в сезон не идёт.", SEASON.days), $t("Каждые {0} XP — новый уровень и награды.", SEASON.per),
      $t("Премиум покупается один раз за сезон и открывает вторую дорожку, в том числе уже пройденные уровни."), $t("Кейсы из наград открываются сразу, со своим доказательством честности."), $t("В конце сезона XP и уровни обнуляются. Незабранные награды за пройденные уровни выдаются сами: GRAM — на баланс, бесплатные кейсы — в запас, NFT — в инвентарь.")]) +
    // «Забрать всё» — закреплена внизу экрана, пока есть незабранные награды
    (ready ? `<button class="btn-main claim st-all" data-sact="all">${$t("Забрать всё · {0}", ready)}</button>` : '');
}
// забрать награду: GRAM — на баланс, кейс — открывается сразу, NFT — подарок темы в инвентарь
const seasonClaimAll = { on: false };
async function seasonClaim(k, btn){
  const r = SEASON_RW[+k.slice(1) - 1], rw = k[0] === 'f' ? r.free : r.prem;
  const res = await btnWait(btn, API.seasonClaim(S.season.id, k)); if (!res?.ok) return false;
  S.season.got[k] = 1; track('season_claim', { k }); haptic('medium');
  if (openDrawer?.id === 'passDrawer') swapDrawer('casesDrawer', renderCases, true);   // забрали из шторки награды — назад в «Пасс»
  if (rw.g){ setBalance(Math.round((S.balance + rw.g) * 100) / 100); Sfx.coin(); notify({ type: 'ok', img: 'assets/hero-gem.webp', title: `+${rw.g} GRAM`, text: $t("Награда {0} уровня", r.l) }); }
  if (rw.cos){ cosGive((seasonTheme().key || 's') + '-' + rw.cos); Sfx.coin(); notify({ type: 'ok', img: seasonTheme().art, title: COS[rw.cos][0], text: $t("Теперь твой — {0}", COS[rw.cos][1]) }); }
  if (rw.dep){ seasonDep(rw.dep); Sfx.coin(); notify({ type: 'ok', img: 'assets/hw-caul.webp', title: `+${rw.dep[0]}% ${$t("к пополнению")}`, text: $t("До {0} GRAM · 7 дней", rw.dep[1]) }); }
  if (rw.out){ S.freeOut = (S.freeOut || 0) + rw.out; Sfx.coin(); notify({ type: 'ok', img: 'assets/hw-ghost.webp', title: $t("Вывод без комиссии") + (rw.out > 1 ? ' ×' + rw.out : ''), text: $t("Всего без комиссии: {0}", freeOuts()) }); }
  if (rw.nft){ const n = nftPick(rw.nft), g = giftOf(n); INV = [g, ...INV];
    notify({ type: 'ok', img: n.src, title: `${n.name} #${n.num}`, text: $t("NFT в инвентаре · награда {0} уровня", r.l) }); }
  S.hist.rewards.unshift({ kind: 'season', title: $t("Сезон: уровень {0}", r.l), rw: rw.g ? { g: rw.g } : { xp: 0 }, t: Date.now() });
  renderCases();
  if (rw.c) caseRun({ ...caseById(rw.c), price: 0, season: true });   // кейс из награды — бесплатно (сервер открывает «ожидающий»)
  return true;
}
// шторка награды: что это, сколько стоит, когда откроется
function seasonInfo(k){
  const r = SEASON_RW[+k.slice(1) - 1], side = k[0] === 'f' ? 'free' : 'prem', rw = r[side], got = S.season.got[k], open = r.l <= seasonLv(), lock = side === 'prem' && !S.season.prem;
  let img, title, about;
  if (rw.c){ const c = caseById(rw.c); img = c.img; title = c.name; about = $t("Кейс откроется сразу — со своим доказательством честности. Средняя ценность ≈{0} GRAM.", fmt(Math.round(caseEV(c) * 100) / 100)); }
  else if (rw.dep){ img = 'assets/hw-caul.webp'; title = `+${rw.dep[0]}% ${$t("к пополнению")}`; about = $t("Бонус к ближайшему пополнению: +{0}%, но не больше {1} GRAM. Действует 7 дней.", rw.dep[0], rw.dep[1]); }
  else if (rw.out){ img = 'assets/hw-ghost.webp'; title = $t("Вывод без комиссии") + (rw.out > 1 ? ' ×' + rw.out : ''); about = $t("Столько выводов NFT без комиссии {0} GRAM. Не сгорают в конце сезона.", OUT_FEE); }
  else if (rw.cos){ img = COS_IMG[rw.cos] || seasonTheme().art; title = COS[rw.cos][0]; about = $t("Косметика темы: {0}. Остаётся у тебя навсегда — после сезона её уже не получить.", COS[rw.cos][1]); }
  else if (rw.nft){ const n = themeNft(rw.nft); img = n.src; title = nftLabel(rw.nft); about = $t("Подарок из стока релеера в этой цене — какой именно, узнаешь при получении. На картинке — для примера: {0}.", n.name); }
  else { img = 'assets/hero-gem.webp'; title = `${rw.g} GRAM`; about = $t("GRAM сразу на баланс."); }
  const st = got ? $t("Получено") : lock ? $t("Нужен премиум-пропуск") : open ? $t("Готово — забирай") : $t("Ещё {0} XP до {1} уровня", xpFmt(r.l * SEASON.per - S.season.xp), r.l), stc = got ? 'got' : lock ? 'lock' : open ? 'ok' : 'soon';
  // карточка награды: картинка на панели цвета дорожки, название, метки «уровень · дорожка» и статус, пояснение отдельным блоком
  $('passBody').innerHTML = `<div class="srw-card${side === 'prem' ? ' p' : ''}"><div class="srw-pic"><img src="${img}" alt=""></div><b>${title}</b>` +
    `<div class="srw-tags"><span>${$t("Уровень {0}", r.l)}</span>${side === 'free' ? `<span>${$t("Бесплатно")}</span>` : ''}</div></div>` +
    `<div class="srw-st ${stc}">${st}</div><p class="srw-about">${about}</p>` + (rw.c ? `<button class="btn-ghost srw-in" data-sact="caseinfo" data-c="${rw.c}">${$t("Что внутри кейса")}</button>` : '');
  $('passFoot').innerHTML = !got && open && !lock ? `<button class="btn-main claim" data-sclaim="${k}">${$t("Забрать")}</button>` : lock ? `<button class="btn-main gold" data-sact="buyask">${$t("Открыть премиум · {0} GRAM", SEASON.price)}</button>` : `<button class="btn-ghost" data-sact="buyno">${$t("Понятно")}</button>`;
  swapDrawer('passDrawer'); track('screen', { id: 'season_reward' });
}
// что такое сезонный пасс — коротко, по пунктам
function seasonHelp(){
  const th = seasonTheme(), P = [[$t("Копи XP"), $t("за игру (0.5 XP за 1 GRAM оборота), задания дня и сторис")], [$t("Расти в уровнях"), $t("каждые {0} XP — уровень, всего {1}", SEASON.per, SEASON.lv)],
    [$t("Забирай награды"), $t("на каждом уровне: GRAM, кейсы, бонусы к пополнению, NFT")], [$t("Премиум — вторая дорожка"), $t("наград больше, плюс +20% XP и сундуки после 30-го")],
    [$t("Сезон — {0} дней", SEASON.days), $t("потом всё с нуля и новая тема; незабранное за пройденные уровни выдаётся само")]];
  $('passBody').innerHTML = `<div class="pass-h"><img src="${th.art}" alt=""><b>${$t("Сезонный пасс")}</b><small>${$t("Сезон {0}", S.season.id)}${th.name ? ' · ' + th.name : ''} · ${$t("ещё {0}", leftDays(seasonLeft()))}</small></div>` +
    `<div class="pass-l">${P.map(([a, b], i) => `<div><i class="num">${i + 1}</i><span><b>${a}</b><small>${b}</small></span></div>`).join('')}</div>`;
  $('passFoot').innerHTML = `<button class="btn-ghost" data-sact="buyno">${$t("Понятно")}</button>`;
  swapDrawer('passDrawer'); track('screen', { id: 'season_help' });
}
$('casesTabs').addEventListener('click', e => { if (e.target.closest('[data-sact="phelp"]')){ e.stopPropagation(); haptic(); seasonHelp(); } }, true);
// пояснение к заданию сезона
function seasonTaskHelp(){
  const th = seasonTheme();
  $('passBody').innerHTML = `<div class="pass-h"><img src="${th.art}" alt=""><b>${$t("Чёртова дюжина")}</b><small>${$t("Задание сезона · {0}", th.name)}</small></div>` +
    `<p class="pass-n">${$t("Номер тикета — пять цифр, как на барабане. Задание выполнено, если в нём где-то подряд стоят 1 и 3: например 01350 или 84513. Подходит любой крафт, бой на Арене или раунд Ставок. Новое задание — каждый день.")}</p>`;
  $('passFoot').innerHTML = `<button class="btn-ghost" data-sact="buyno">${$t("Понятно")}</button>`;
  swapDrawer('passDrawer');
}
// шторка подтверждения покупки премиума: что даёт и сколько стоит
function seasonBuyAsk(){
  const th = seasonTheme();
  $('passBody').innerHTML = `<div class="pass-h glow"><img src="assets/season-pass${S.season.prem ? '-on' : ''}.webp" alt=""><b>${$t("Премиум-пропуск")}</b><small>${$t("Сезон {0}", S.season.id)}${th.name ? ' · ' + th.name : ''} · ${$t("ещё {0}", leftDays(seasonLeft()))}</small></div>` +
    // выгода = награды премиум-дорожки минус цена пропуска
    `<div class="pass-v1">${premValLine()}<small>${$t("если дойти до 30-го уровня")}</small></div>` +
    `<div class="pass-l">${PREM_PERKS().map(([a, b]) => `<div><i>${svg(NICON.ok)}</i><span><b>${a}</b><small>${b}</small></span></div>`).join('')}</div>` +
    `<p class="pass-n">${$t("Сумма — если дойти до 30-го уровня: GRAM, средняя ценность кейсов и цена NFT. Уже пройденные уровни откроются сразу. Покупка — один раз на сезон, деньги не возвращаются.")}</p>`;
  $('passFoot').innerHTML = S.season.prem ? `<button class="btn-ghost" data-sact="buyno">${$t("Понятно")}</button>` : `<button class="btn-main gold" data-sact="buy">${$t("Купить за {0} GRAM", SEASON.price)}</button><button class="btn-ghost" data-sact="buyno">${$t("Не сейчас")}</button>`;
  swapDrawer('passDrawer'); track('screen', { id: 'pass_buy' });
}
let seasonBuying = false;
async function seasonBuy(btn){
  if (S.season.prem || seasonBuying) return;   // покупка — один раз: повторный тап и второй запрос не проходят (сервер тоже проверяет)
  seasonBuying = true; try { await seasonBuy1(btn); } finally { seasonBuying = false; }
}
async function seasonBuy1(btn){
  if (S.demo) return notify({ type: 'demo', icon: 'coin', title: $t("Премиум — только на GRAM"), text: $t("Выключи демо в меню") });
  if (S.balance < SEASON.price) return notify({ type: 'err', icon: 'coin', title: $t("Недостаточно GRAM"), text: $t("Пополни баланс — тапни по нему сверху") });
  const res = await btnWait(btn, API.seasonBuy(S.season.id)); if (!res?.ok) return;
  setBalance(Math.round((S.balance - SEASON.price) * 100) / 100); S.season.prem = true; cosGive('gold-frame'); track('pass_buy', { season: S.season.id }); haptic('medium'); Sfx.coin();
  S.hist.wallet.unshift({ type: 'pass', t: Date.now(), amount: SEASON.price, name: $t("Премиум сезона {0}", S.season.id), method: $t("сезон") });
  notify({ type: 'ok', icon: 'ok', color: '#F57A37', title: $t("Премиум активен"), text: $t("Забирай награды второй дорожки") });
  seasonTasksCheck(); swapDrawer('casesDrawer', renderCases);
  setTimeout(() => caseRun({ ...caseById('satoshi'), price: 0, season: true }), 700);   // подарок за покупку — кейс Сатоши сразу
}
// сундук после 30-го — открывается сразу, как кейс из награды
async function seasonChest(btn){
  const res = await btnWait(btn, API.seasonClaim(S.season.id, 'chest')); if (!res?.ok) return;
  S.season.chests = (S.season.chests || 0) + 1; track('season_claim', { k: 'chest' }); renderCases(); caseRun({ ...caseById('beast'), price: 0, season: true });
}
const seasonClick = e => {
  const c = e.target.closest('[data-sclaim]'); if (c && !c.classList.contains('ld')){ e.stopPropagation(); seasonClaim(c.dataset.sclaim, c); return; }
  const inf = e.target.closest('[data-sinfo]'); if (inf){ e.stopPropagation(); haptic(); seasonInfo(inf.dataset.sinfo); return; }
  const a = e.target.closest('[data-sact]'); if (!a || a.classList.contains('ld')) return; e.stopPropagation(); haptic();
  const act = a.dataset.sact;
  if (act === 'buyask') seasonBuyAsk();
  if (act === 'buy') seasonBuy(a);
  if (act === 'buyno') swapDrawer('casesDrawer', renderCases);
  if (act === 'chest') seasonChest(a);
  if (act === 'thq') seasonTaskHelp();
  if (act === 'legcase'){ hideDrawer(); setTimeout(() => caseRun({ ...caseById('satoshi'), price: 0, season: true }), 300); }   // кейс в подарок — без списания
  if (act === 'phelp') seasonHelp();
  if (act === 'caseinfo') caseInfo(caseById(a.dataset.c));
  if (act === 'all'){ const ks = SEASON_RW.filter(r => r.l <= seasonLv()).flatMap(r => ['f' + r.l, ...(S.season.prem ? ['p' + r.l] : [])]).filter(k => !S.season.got[k]);
    // сначала всё, кроме кейсов (без экранов), кейсы — по одному: они открываются своим экраном
    (async () => { if (seasonClaimAll.on) return; seasonClaimAll.on = true; try {   // уже забирается — второй тап (кнопка перерисовалась) не запускает вторую очередь
      for (const k of ks){ const r = SEASON_RW[+k.slice(1) - 1], rw = k[0] === 'f' ? r.free : r.prem; if (!rw.c && !(await seasonClaim(k, a))) return; }   // отказ — стоп, одна ошибка вместо 60
      const cs = ks.find(k => { const r = SEASON_RW[+k.slice(1) - 1]; return (k[0] === 'f' ? r.free : r.prem).c; }); if (cs) await seasonClaim(cs, a); } finally { seasonClaimAll.on = false; } })(); }
};
$('casesBody').addEventListener('click', seasonClick, true);
$('casesFoot').addEventListener('click', seasonClick, true);
$('passDrawer').addEventListener('click', seasonClick, true);
// баннер кейсов — как у супер дропа: тап открывает кейсы внутри «Пасса»
const casesBanner = () => `<button class="sdban cban" data-go="cases"><span class="sdb-t"><small>${$t("Кейсы")}</small><b>${$t("до {0} GRAM", RARE_TO)}</b>` +
  `<em>${$t("NFT в кейсах · от {0} GRAM", Math.min(...CASES.filter(c => c.price).map(c => c.price)))}</em></span><span class="cb-art">${CASES.map((c, i) => `<img src="${c.img}" style="--i:${i}" alt="">`).join('')}</span></button>`;   // 4 кейса по очереди, покачиваются
// карточка пасса в меню: тема, уровень, полоса до следующего, задания и готовые награды — одним блоком
function seasonMenuCard(){
  seasonFresh(); const th = seasonTheme(), lv = seasonLv(), k = lv >= SEASON.lv ? 1 : (S.season.xp - lv * SEASON.per) / SEASON.per, ready = seasonReady();
  return `<button class="mpass" data-go="cases"${th.bg ? ` style="background:${th.bg}"` : ''}><img class="mp-art" src="${th.art}" alt=""><span class="mp-t"><small>${$t("Сезонный пасс")} · ${th.name || $t("Сезон {0}", S.season.id)}</small>` +
    `<b>${$t("Уровень {0}", lv)}</b><i class="mp-bar"><b style="width:${(k * 100).toFixed(1)}%"></b></i>` +
    `<span class="mb-chips">${S.season.prem ? `<span class="pm">${$t("Премиум")}</span>` : ''}${ready ? `<span class="ok">${$t("награды: {0}", ready)}</span>` : ''}<span>${$t("Задания {0}/", seasonTasksDone())}3</span><span>${$t("ещё {0}", leftDays(seasonLeft()))}</span></span></span></button>`;
}
/* ---------- переход со старых бонусов (разово; в бою — сервер при запуске сезонов) ----------
   Звание: заработанное до сезонов остаётся значком у имени (без прогресса), новые игроки его не получают.
   Прежний топ по XP: один раз — призы по месту (1 — редкий NFT, 2–10 — 5 GRAM, 11–100 — кейс Сатоши) */
function legacyRank(){ if (S.legacyRank === undefined) S.legacyRank = S.xp >= RANKS[1][1] ? rankOf(S.xp) : null; return S.legacyRank; }
// звание у имени — по общему XP (растёт всегда: игра, задания, кейсы); сезон его не сбрасывает
const legacyBadge = () => SEASON_ON ? `<i class="lrank">${RANKS[rankOf(S.xp)][0]}</i>` : '';
// призы прежнему топу-20 (один раз, при первом заходе после перехода): 1 — редкий NFT, 2–5 — NFT по флору, 6–10 — 2 GRAM, 11–20 — 1 GRAM. Показываем шторкой
function legacyTopGrant(place){
  if (!SEASON_ON || S.legacyTop || !(place >= 1 && place <= 20)) return; S.legacyTop = { place, t: Date.now() }; track('legacy_top', { place });
  const log = (txt, rw) => S.hist.rewards.unshift({ kind: 'legacy', title: $t("Прежний топ: {0} место", place) + ' · ' + txt, rw, t: Date.now() });
  let img, prize, go = null;
  // каждому призёру — свой подарок: случайный из пула (в бою сервер берёт свободный экземпляр из стока релеера, не один на всех)
  const pick = P => P.length ? P[Math.random() * P.length | 0] : FLOOR_NFT();
  if (place === 1){ const n = pick(NFTS.filter(n => n.price >= RARE_FROM && n.price <= RARE_TO)); INV = [giftOf(n), ...INV]; img = n.src; prize = `${n.name} #${n.num}`; log(prize, { xp: 0 }); }
  else if (place <= 5){ const n = pick(NFTS.filter(n => n.price <= FLOOR_NFT().price * 1.2)); INV = [giftOf(n), ...INV]; img = n.src; prize = `${n.name} #${n.num}`; log(prize, { xp: 0 }); }
  else { const g = place <= 10 ? 2 : 1; setBalance(Math.round((S.balance + g) * 100) / 100); img = 'assets/hero-gem.webp'; prize = `+${g} GRAM`; log(prize, { g }); }
  $('passBody').innerHTML = `<div class="pass-h glow"><img src="${img}" alt=""><b>${$t("{0} место в топе", place)}</b><small>${$t("Спасибо, что с нами с первых дней! Топ по XP теперь сменил сезонный пасс — держи подарок за прежнее место.")}</small></div>` +
    `<div class="pass-v1"><span class="hx-val"><small>${$t("Твой приз")}</small><span>${prize}</span></span></div>`;
  $('passFoot').innerHTML = go ? `<button class="btn-main gold" data-sact="legcase">${$t("Открыть кейс")}</button>` : `<button class="btn-main gold" data-sact="buyno">${$t("Забрать")}</button>`;
  setTimeout(() => { haptic('medium'); Sfx.coin?.(); openDrawer ? swapDrawer('passDrawer') : showDrawer('passDrawer'); }, 600);   // поверх открытой шторки — сменой, а не второй шторкой (иначе первая не закрывается)
}
