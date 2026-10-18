/* =========================================================
   ЛЕНТА «ЛАЙВ»: новые выигрыши въезжают слева
   ========================================================= */
const liveEl = $('live');
const multOf = n => Math.round(Number(craftPpm(CRAFT_RULES, n)) / 1e4) / 100;
const NICKS = ['durov_fan', 'tonmaxi', 'giftlord', 'kira.ton', 'mr_snow', 'pepe2009', 'nftqueen', 'whale77', 'luckyfox', 'b0ris', 'anya_g', 'cryptocat'];
/* дроп ленты: ставка × множитель по тикету → GRAM-гем или NFT (как в настоящем крафте) */
function liveHTML(n, o = {}){
  const ti = tierOfTicket(n), t = TIERS[ti], mult = multOf(n);
  const stake = o.stake ?? [.5, 1, 1, 2, 2, 3, 5, 5, 10, 20][Math.random() * 10 | 0];
  const win = o.win ?? Math.round(stake * mult * 100) / 100;
  // свой выигрыш — тот NFT, что реально выдали (o.nft); чужие (заглушка ленты) — самый дорогой NFT не дороже выигрыша
  const nft = o.nft !== undefined ? (o.nft ? o.nft.nft : null) : win >= NFT_FROM ? NFTS.filter(x => x.price <= win).slice(-1)[0] : null;
  const img = nft ? nft.src : 'assets/hero-gem-128.webp', who = o.me ? $t("твой дроп") : o.who || '@' + pick(NICKS), ar = o.arena;
  const label = win >= 100 ? Math.round(win) : win >= 10 ? String(Math.round(win * 10) / 10) : fmt(win);
  // арена: значок «меч» в углу, в данных — банк и сколько игроков
  return `<div class="item${ti >= 3 ? ' hi' : ''}${o.me ? ' me' : ''}${ar ? ' iarena' : ''}${o.bets ? ' ibets' : ''}" style="--c:${t.c}" data-n="${n}" data-w="${win}" data-m="${mult}" data-who="${who}" data-img="${img}" data-nft="${nft ? nft.name : ''}"${ar ? ` data-bank="${ar.bank}" data-pl="${ar.n}"` : ''}>` +
    `<span class="glow"></span><img src="${img}" alt="">${ar ? '<span class="cbadge abadge"><img src="assets/sword.svg" alt=""></span>' : o.bets ? `<span class="cbadge abadge bbadge">${svg(TARGET)}</span>` : ''}<i>${label}</i>${ti >= 3 ? '<span class="shine"></span>' : ''}</div>`;
}
// открытие кейса в ленте: приз + маленький значок кейса
function liveCaseHTML(c, it, o = {}){
  const img = o.img || (it.t === 'nft' ? pick(it.rare ? RARE_POOL() : FLOOR_POOL()).src : itemImg(it));
  const v = it.t === 'gram' ? fmt(it.v) : it.t === 'xp' ? '+' + it.v : fmt(o.value || (it.rare ? pick(RARE_POOL()).price : NFT_FLOOR));
  return `<div class="item icase${it.rare ? ' hi' : ''}${it.t === 'xp' ? ' ixp' : ''}${o.me ? ' me' : ''}" style="--c:${itemColor(it)}" data-case="${c.id}" data-who="${o.me ? $t("твой кейс") : '@' + pick(NICKS)}" data-lbl="${o.label || itemName(it)}" data-img="${img}">` +
    `<span class="glow"></span><img src="${img}" alt=""><span class="cbadge"><img src="${c.img}" alt=""></span><i>${it.t === 'xp' ? '<img src="assets/xp.webp" alt="">' : ''}${v}</i>${it.rare ? '<span class="shine"></span>' : ''}</div>`;
}
// арена в ленте: банк = взнос комнаты × игроки, победитель крафтит на весь банк
const liveArena = () => { const pl = 2 + (Math.random() * 5 | 0), bank = Math.round(pick(PVP_FEES) * pl * 100) / 100; return liveHTML(Math.random() * TICKETS | 0, { stake: bank, arena: { bank, n: pl } }); };
const liveItem = () => { const q = Math.random(); if (q < .3){ const c = pick(CASES), it = weighted(c); return liveCaseHTML(c, it); } if (q < .45) return liveArena(); if (q < .55) return liveHTML(Math.random() * TICKETS | 0, { stake: pick([.5, 1, 2, 5]), bets: true }); return liveHTML(Math.random() * TICKETS | 0); };
liveEl.innerHTML = [67890, 1345, 97890, 76789, 99912, 40210, 88123].map(n => liveHTML(n)).join('');
function pushLive(html){
  liveEl.insertAdjacentHTML('afterbegin', html || liveItem());
  const el = liveEl.firstElementChild;
  if (!S.lite){
    liveEl.animate([{ transform: 'translateX(-62px)' }, { transform: 'translateX(0)' }], { duration: 520, easing: 'cubic-bezier(.3,1.25,.5,1)' });
    el.animate([{ opacity: 0, transform: 'translateY(-14px) scale(.6)', filter: 'brightness(2.2)' }, { opacity: 1, transform: 'none', filter: 'brightness(1)' }], { duration: 560, easing: 'cubic-bezier(.25,1.35,.5,1)' });
  }
  while (liveEl.children.length > Math.ceil((SW - 38) / 62) + 1) liveEl.lastElementChild.remove();
}
/* тап по дропу — кто, что и с каким тикетом */
liveEl.addEventListener('click', e => {
  const it = e.target.closest('.item'); if (!it) return;
  if (it.dataset.case){ const c = caseById(it.dataset.case); haptic(); notify({ img: it.dataset.img, color: c.c, title: c.name, text: `${it.dataset.who} ${$t("— выпало:")} ${it.dataset.lbl}` }); return; }
  const n = +it.dataset.n, t = TIERS[tierOfTicket(n)]; haptic();
  if (it.classList.contains('ibets')){ notify({ img: it.dataset.img, color: '#7c5cff', title: `${$t("Ставки")} · ${$t("тикет")} ${tk(n)}`, text: `${it.dataset.who} — ${it.dataset.nft || '+' + fmt(+it.dataset.w) + ' GRAM'}` }); return; }
  if (it.dataset.bank){ notify({ img: it.dataset.img, color: t.c, title: `${$t("Арена")} · ${t.name} · x${it.dataset.m}`,
    text: `${it.dataset.who} — ${it.dataset.nft || '+' + fmt(+it.dataset.w) + ' GRAM'} · ${$t("тикет")} ${tk(n)}` }); return; }
  notify({ img: it.dataset.img, color: t.c, title: `${t.name} · x${it.dataset.m}`, text: `${it.dataset.who} ${$t("— {0} · тикет", it.dataset.nft || '+' + fmt(+it.dataset.w) + ' GRAM')} ${tk(n)}` });
});
let liveN = 0;
/* ---------- дебаг → «Замер» → «Нагрузка»: лента «лайв» потоком и спам запросов ----------
   Поток — дроп в ленту каждые N мс (как будто играет толпа); на сервере ещё и боты играют по-настоящему (API.dbgLive) */
let liveFlood = null;
function setLiveFlood(ms){ clearInterval(liveFlood); S.dbg.liveMs = ms; liveFlood = ms ? setInterval(() => { if (!document.hidden) pushLive(); }, ms) : null; API.dbgLive(ms).catch(() => {}); }
const loadDbg = () => `<div class="dbg-l">${$t("Лента «лайв»")}</div><div class="dbg-g">` +
  [[0, $t("Обычно")], [600, $t("Поток · 0.6 с")], [250, $t("Шквал · 0.25 с")], [80, $t("Буря · 0.08 с")]].map(([ms, l]) => `<button class="dbg-c${(S.dbg.liveMs || 0) === ms ? ' on' : ''}" data-k="liveMs" data-v="${ms}" style="--c:${ms ? '#FF8A3C' : '#fff'}">${l}</button>`).join('') + `</div>` +
  `<div class="dbg-l">${$t("Спам запросов с телефона (разом)")}</div><div class="dbg-g">` + [20, 50, 100].map(n => `<button class="dbg-c" data-k="spam" data-v="${n}" style="--c:#30A5FF">${n}</button>`).join('') + `</div>` +
  `<div class="dbg-l">${$t("Всё сразу")}</div><div class="dbg-g"><button class="dbg-c" data-k="max" data-v="1" style="--c:#FF4C35">${$t("Максимальная нагрузка")}</button></div>` +
  `<div class="dbg-l">${$t("Спам крафтов с телефона (по 0.1 GRAM, разом)")}</div><div class="dbg-g">` + [10, 30, 50].map(n => `<button class="dbg-c" data-k="race" data-v="crafts:${n}" style="--c:#30A5FF">${n}</button>`).join('') + `</div>` +
  `<div class="dbg-l">${$t("Гонки — деньги не должны поехать")}</div><div class="dbg-g">` + [['cases', $t("10 кейсов на 3 GRAM")], ['withdraw', $t("Один NFT — два вывода")], ['promo', $t("Промокод 5 раз разом")]].map(([v, l]) => `<button class="dbg-c" data-k="race" data-v="${v}" style="--c:#EB57B0">${l}</button>`).join('') + `</div>` +
  `<div class="dbg-l">${$t("Игроки-боты на сервере")}</div><div class="dbg-g">` + [['20', $t("20 играют")], ['100', $t("100 играют + спам крафтов")], ['wipe', $t("Убрать ботов")]].map(([v, l]) => `<button class="dbg-c" data-k="bots" data-v="${v}" style="--c:${v === 'wipe' ? '#FF4C35' : '#12D53D'}">${l}</button>`).join('') + `</div>` +
  `<p class="dbg-n">${$t("Спам — запросы уходят на сервер одновременно, в уведомлении — сколько ждали ответа. Боты играют настоящие игры: их видно в ленте и топе.")} ` +
  `${$t("Спам крафтов: каждый крафт — отдельный запрос, «Продать» жмётся дважды разом; сервер должен засчитать один раз. Гонки тратят твои тестовые GRAM.")} ` +
  `${$t("Максимальная нагрузка: 300 ботов в 10 группах разом крафтят, ставят, открывают кейсы, вводят промокоды и пополняют, плюс спам крафтов и твои запросы. Арена пока не на сервере — в нагрузку не входит.")}</p>`;
const msStat = a => { a = a.slice().sort((x, y) => x - y); const q = p => Math.round(a[Math.min(a.length - 1, Math.floor(p * a.length))] || 0); return $t("обычно {0} мс · 9 из 10 до {1} мс · худший {2} мс", q(.5), q(.9), q(1)); };
async function loadSpam(n){
  haptic('medium'); const t0 = performance.now(), r = await API.dbgSpam(n).catch(() => null);
  if (!r) return notify({ type: 'err', icon: 'err', title: $t("Нет связи"), text: $t("Попробуй ещё раз") });
  notify({ type: r.err ? 'warn' : 'ok', icon: r.err ? 'warn' : 'ok', ms: 9000, title: `${$t("{0} запросов за {1} мс", n, Math.round(performance.now() - t0))}${r.err ? ` · ${$t("ошибок")}: ${r.err}` : ''}`, text: (r.mock ? $t("Мок: сервера нет — только задержка сети") + ' · ' : '') + msStat(r.ms) });
}
// гонки и спам крафтов: сервер должен списать и начислить ровно столько, сколько положено, при любом числе одновременных запросов
async function loadRace(v){
  haptic('medium'); const [kind, n] = v.split(':'), r = await API.dbgRace(kind, +n || 0).catch(e => ({ fail: e?.message }));
  if (r.mock) return notify({ type: 'info', icon: 'info', title: $t("Гонки — только с сервером"), text: $t("В моке сервера нет") });
  if (r.fail || !r.ok) return notify({ type: 'err', icon: 'err', title: r.why || $t("Сервер не ответил"), text: r.fail || $t("Попробуй ещё раз") });
  if (r.balance != null) setBalance(r.balance);
  notify({ type: r.pass ? 'ok' : 'err', icon: r.pass ? 'ok' : 'err', ms: 12000, title: (r.pass ? '✓ ' : '✗ ') + r.title, text: r.text + (r.ms ? ` · ${msStat(r.ms)}` : '') });
}
async function loadMax(){
  haptic('heavy'); notify({ type: 'warn', icon: 'warn', title: $t("Максимальная нагрузка пошла"), text: $t("300 ботов и твои запросы — около 15 секунд") });
  const r = await API.dbgMax().catch(e => ({ fail: e?.message }));
  if (r.mock) return notify({ type: 'info', icon: 'info', title: $t("Боты — только с сервером"), text: $t("В моке играет только лента") });
  if (r.fail || !r.ok) return notify({ type: 'err', icon: 'err', title: $t("Сервер не ответил"), text: r.fail || $t("Попробуй ещё раз") });
  if (r.balance != null) setBalance(r.balance);
  const pass = !r.bad && !r.errors;
  notify({ type: pass ? 'ok' : 'err', icon: pass ? 'ok' : 'err', ms: 15000, title: `${pass ? '✓' : '✗'} ${$t("{0} игроков · {1} игр за {2} с", r.players, r.games, (r.wall / 1000).toFixed(1))}`,
    text: (r.bad ? $t("Проблемы с деньгами: {0}", r.bad) : $t("Деньги сходятся")) + (r.errors ? ` · ${$t("ошибок")}: ${r.errors}` : '') +
      ` · ${$t("крафт ботов")}: ${msStat(r.craft)} · ${$t("твои запросы")}: ${msStat(r.mine)}` + (r.own ? ` · ${r.own}` : '') });
}
async function loadBots(v){
  haptic('medium'); const r = await API.dbgBots(v === 'wipe' ? { wipe: true } : { players: +v, rounds: 3, spam: v === '100' ? 50 : 0 }).catch(e => ({ fail: e?.message }));
  if (r.mock) return notify({ type: 'info', icon: 'info', title: $t("Боты — только с сервером"), text: $t("В моке играет только лента") });
  if (r.fail || !r.ok) return notify({ type: 'err', icon: 'err', title: $t("Сервер не ответил"), text: r.fail || $t("Попробуй ещё раз") });
  if (r.wiped != null) return notify({ type: 'ok', icon: 'ok', title: $t("Ботов убрали: {0}", r.wiped) });
  notify({ type: r.bad ? 'err' : 'ok', icon: r.bad ? 'err' : 'ok', ms: 10000, title: $t("{0} игр за {1} мс", r.games, r.ms), text: (r.bad ? $t("Проблемы с деньгами: {0}", r.bad) : $t("Деньги сходятся")) + (r.errors ? ` · ${$t("ошибок")}: ${r.errors}` : '') + ` · ${$t("крафт")}: ${msStat(r.craft)}` });
}
setInterval(() => { if (document.hidden || S.pfOff.live || (S.lite && ++liveN % 2)) return; pushLive(); }, 3200);   // в экономном режиме — вдвое реже

