/* =========================================================
   БОНУСЫ: кейсы · задания · супер дроп · друзья · топ
   ========================================================= */
let casesTab = 'tasks';
function openCases(tab){ if (tab) casesTab = tab; swapDrawer('casesDrawer', renderCases); }
const caseState = c => !c.need ? { ok: true } : c.need === 'daily' ? { ok: S.stock.beast > 0, n: S.stock.beast, txt: `${$t("3 задания дня · {0} из", tasksDone())} ${TASKS.length}`, k: tasksDone() / TASKS.length }
  : { ok: S.stock.musk > 0, n: S.stock.musk, txt: `${$t("7 дней заданий · {0} из 7", dayIdx() - S.week.missed.filter(d => d < dayIdx()).length)}`, k: (dayIdx() - S.week.missed.length) / 7 };
function caseCard(c){
  const st = caseState(c), free = !c.price;
  return `<div class="bcase${free ? ' free' : ''}" style="--c:${c.c}" data-info="${c.id}">${st.n > 1 ? `<em class="stk">×${st.n}</em>` : ''}${caseArt(c)}<b>${c.short}</b>` +
    (free ? `<small>${st.txt}</small><i class="prog"><b style="width:${Math.round(st.k * 100)}%"></b></i>` : `<small>${$t("NFT до {0} GRAM", RARE_TO)}</small>`) +
    `<button class="cbuy${free && !st.ok ? ' locked' : ''}" data-open="${c.id}">${free ? (st.ok ? $t("Открыть") : $t("Закрыт")) : `<img src="assets/gem-small.svg" alt="">${fmt(c.price)}`}</button></div>`;
}
const achRow = ([id, t, rw, ok, act, prog]) => {
  const done = !!S.ach.got[id], pr = !done && prog ? prog() : null;
  return `<div class="arow${done ? ' ok' : ''}"><i>${done ? svg(NICON.ok) : ''}</i><span>${pr ? `<small>${xpFmt(pr[0])} / ${xpFmt(pr[1])}</small>` : ''}<b>${t.replace('@pawnd', '<span class="acc">@pawnd</span>')}</b>` +
    `${done ? '' : `<button class="chk-btn" data-claim="${id}">${$t("Проверить")}</button>`}</span><em class="${rw.g != null ? 'g' : 'x'}">${rewHTML(rw)}</em></div>`;
};
function renderCases(){
  $('casesTabs').innerHTML = [['tasks', $t("Задания")], ['cases', $t("Кейсы")], ['super', $t("Супер дроп")], ['refs', $t("Рефералка")], ['top', $t("Топ")]].map(([k, t]) => `<button class="tab${k === casesTab ? ' on' : ''}" data-k="${k}">${t}</button>`).join('');
  $('casesTabs').querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  const b = $('casesBody');
  if (casesTab === 'cases'){
    b.innerHTML = `<div class="bgrid">${CASES.map(caseCard).join('')}</div>` +
      `<p class="bnote">${$t("Платные кейсы открываются за GRAM. Бесплатные — за задания: Мистер Бист за день, Илон Маск за неделю. Их можно копить и открывать по одному, когда захочешь.")}</p>`;
  } else if (casesTab === 'tasks'){
    const di = dayIdx(), dd = dailyDone(), td = tasksDone(), beast = caseById('beast'), musk = caseById('musk');
    b.innerHTML = `<div class="sect"><div class="sect-h hero" style="--c:${beast.c}"><span><b>${$t("Задания дня")}</b><small>${$t("Выполни все 3 — откроется кейс Мистера Биста")}</small><em class="cnt">${td} ${$t("из")} ${TASKS.length}</em></span>${caseArt(beast)}</div>` +
      TASKS.map(([k, t, n, rw]) => { const v = Math.min(n, S.tasks[k]), ok = v >= n;
        return `<div class="arow${ok ? ' ok' : ''}"><i>${ok ? svg(NICON.ok) : ''}</i><span>${n > 1 && !ok ? `<small>${fmt(v)} / ${n}</small>` : ''}<b>${t}</b></span><em class="${rw.g != null ? 'g' : 'x'}">${rewHTML(rw)}</em></div>`; }).join('') +
      `<button class="btn-main${S.stock.beast ? '' : ' off'}" data-open="beast">${S.stock.beast ? `${$t("Открыть кейс Биста")}${S.stock.beast > 1 ? ' ×' + S.stock.beast : ''}` : dd ? $t("Кейс за сегодня уже открыт") : `${$t("Ещё {0} {1} до кейса", TASKS.length - td, $n("задание|задания|заданий", TASKS.length - td))}`}</button></div>` +
      `<div class="sect"><div class="sect-h hero" style="--c:${musk.c}"><span><b>${$t("Неделя")}</b><small>${$t("Задания каждый день — откроется кейс Илона Маска")}</small><em class="cnt">${di - S.week.missed.filter(d => d < di).length} ${$t("из 7 дней")}</em></span>${caseArt(musk)}</div>` +
      `<div class="days">${DAYS.map((d, i) => { const miss = S.week.missed.includes(i) && i < di, ok = (i < di && !miss) || (i === di && dd);
        return `<span class="${miss ? 'miss' : ok ? 'ok' : i === di ? 'now' : ''}">${miss ? svg('<path d="M7 7l10 10M17 7L7 17"/>') : ok ? svg(NICON.ok) : d}</span>`; }).join('')}</div>` +
      (S.week.missed.length ? `<button class="btn-main" data-act="restore">${$t("Восстановить 1 день · {0} GRAM", S.week.restorePrice)}</button>` : `<button class="btn-main${S.stock.musk ? '' : ' off'}" data-open="musk">${$t("Открыть кейс Маска")}${S.stock.musk > 1 ? ' ×' + S.stock.musk : ''}</button>`) + `</div>` +
      `<div class="sect"><div class="sect-h"><span><b>${$t("Достижения")}</b><small>${$t("засчитываются по кнопке «Проверить»")}</small></span><em class="cnt">${ACH.filter(a => S.ach.got[a[0]]).length}/${ACH.length}</em></div>` + ACH.map(achRow).join('') + `</div>` + rulesHTML(RULES);
  } else if (casesTab === 'super'){
    const sd = SUPER.nft;
    b.innerHTML = `<div class="sdhero"><img class="sdlogo" src="assets/superdrop-logo.webp" alt="Super Drop"><div class="sdcard" id="sdCard">${cardHTML(sd, 236, true)}</div></div>` +
      `<div class="sdtarget"><small>${$t("Загаданный тикет")}</small><div class="sddig">${superDigits()}</div><p>${$t("Выбей его первым в крафте — и NFT твой")}</p></div>` +
      `<div class="stats"><div><small>${$t("Приз")}</small><b class="g">${fmt(sd.value)} GRAM</b></div><div><small>${$t("Мин. ставка")}</small><b class="g">${SUPER.min} GRAM</b></div><div><small>${$t("Попыток сегодня")}</small><b>${SUPER.tries.toLocaleString(LOC)}</b></div><div><small>${$t("Шанс за крафт")}</small><b>${$t("1 из 100 000")}</b></div></div>` +
      `<div class="sect"><div class="sect-h"><span><b>${$t("Прошлые супер дропы")}</b></span></div>${SUPER.last.map(([n, g, t]) => `<div class="trow"><span class="tav" style="--tc:${avc(n)}">${n[0].toUpperCase()}</span><span class="tn"><b>@${n}</b><small>${t}</small></span><span class="tb2">${g}</span></div>`).join('')}</div>` +
      rulesHTML([$t("Super Drop забирает тот, кто первым выбьет загаданный тикет."), $t("Учитываются крафты со ставкой от 0.5 GRAM."), $t("Обычный выигрыш крафта при этом тоже зачисляется на баланс."), $t("После выпадения загадывается новый тикет и новый NFT.")]);
    tiltCard($('sdCard'), 1.2); upgradeImg($('sdCard').querySelector('.nc-img'), sd.nft); Tilt.grab($('sdCard').querySelector('.nc-t'), () => openNft(sd));   // крутить пальцем, тап — в Telegram
  } else if (casesTab === 'refs'){
    b.innerHTML = `<div class="refpct"><div><b>10%</b><small>${$t("от первого депозита")}</small></div><div><b>5%</b><small>${$t("от активности")}</small></div></div>` +
      `<a class="banner amb" data-act="amb"><span><b>${$t("Программа для амбассадоров")}</b><small>${$t("больше процент для блогеров и комьюнити")}</small></span><img src="assets/referrals.webp" alt=""></a>` +
      `<div class="refbox rgap"><div class="refrow"><span>${svg(IC.users)} ${$t("Друзей:")} <b>${REF.friends.length}</b></span><span class="g"><img src="assets/gem-small.svg" alt="">${fmt(REF.total)} GRAM</span></div>` +
      `<div class="reflink"><code>${REF.link.replace('https://', '')}</code><button class="pill-btn" data-act="copyref">${$t("Копировать")}</button></div></div>` +
      // начисление за друзей: заголовок и «История» в одной строке сверху, сумма крупно, ниже — за что и когда следующее
      `<div class="refauto"><div class="ra-h"><b>${$t("Начислено вчера")}</b><button class="pill-btn" data-act="refhist">${$t("История")}</button></div>` +
      `<div class="ra-v"><img src="assets/gem-small.svg" alt="">+${fmt(REF.pending)}<small>GRAM</small></div><p>${$t("5% от активности друзей. Начисляется само — каждый день в 00:00 МСК")}</p></div>` +
      `<button class="btn-ghost" data-act="shareref" style="margin-top:8px">${$t("Пригласить друга")}</button>` +
      `<div class="sect rgap"><div class="sect-h"><span><b>${$t("Твои друзья")}</b></span></div>` + REF.friends.map(([n, cr, g]) => `<div class="trow"><span class="tav" style="--tc:${avc(n)}">${n[0].toUpperCase()}</span><span class="tn"><b>@${n}</b><small>${cr ? cr + (" " + $t("крафтов")) : $t("ещё не крафтил")}</small></span><span class="tb2 g"><img src="assets/gem-small.svg" alt="">${fmt(g)}</span></div>`).join('') + `</div>` +
      rulesHTML(REF_RULES);
  } else {
    const me = 34;
    const ri = rankOf(S.xp), nx = RANKS[ri + 1], kx = nx ? (S.xp - RANKS[ri][1]) / (nx[1] - RANKS[ri][1]) : 1;
    b.innerHTML = `<div class="tophero"><img class="ava" src="assets/avatar.webp" alt=""><div class="th"><div class="th-n"><b>GK</b><em>${me} ${$t("место")}</em></div><span class="th-r">${RANKS[ri][0]}</span>` +
      `<div class="th-x">${XPI}<i><b style="width:${(kx * 100).toFixed(1)}%"></b></i><small>${xpFmt(S.xp)} / ${xpFmt((nx || RANKS[ri])[1])}</small></div></div><span class="cupw"><img class="cup" src="assets/top.webp" alt=""></span></div>` +
      `<div class="sect">${TOP.map(([n, xp], i) => `<div class="trow"><em class="${i < 3 ? 'm' + i : ''}">${i + 1}</em><span class="tav" style="--tc:${avc(n)}">${n[0].toUpperCase()}</span><span class="tn"><b>@${n}</b><small>${RANKS[rankOf(xp)][0]}</small></span><span class="txp">${XPI}${xpFmt(xp)}</span></div>`).join('')}</div>` +
      rulesHTML(TOP_RULES);
  }
}
$('casesTabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (!t) return; casesTab = t.dataset.k; haptic(); renderCases(); $('casesBody').scrollTop = 0; });
$('casesBody').addEventListener('click', e => {
  const o = e.target.closest('[data-open]'), q = e.target.closest('[data-info]'), cl = e.target.closest('[data-claim]');
  if (cl){ claimAch(cl.dataset.claim, cl); return; }
  if (o){ e.stopPropagation(); if (o.classList.contains('off')){ haptic('rigid'); return; } tryOpenCase(caseById(o.dataset.open)); return; }
  if (q){ haptic(); caseInfo(caseById(q.dataset.info)); }
});
/* модалка (только для TON Connect) */
function modal(html, color){
  const m = $('modal'); m.className = 'modal on'; m.style.setProperty('--c', color || '#30A5FF'); $('modalBox').innerHTML = html;
  m.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
  $('modalBox').animate([{ opacity: 0, transform: 'scale(.94) translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1)' });
}
function closeModal(){ const m = $('modal'); if (!m.classList.contains('on') || m.dataset.lock) return; m.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 }).onfinish = () => { m.className = 'modal'; $('modalBox').innerHTML = ''; }; }
$('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
/* шторка кейса: крупно картинка, что внутри — большими плитками, правила — короткими строками */
let infoCase = null;
function caseInfo(c){ infoCase = c; swapDrawer('caseDrawer', renderCaseInfo); }
function renderCaseInfo(){
  const c = infoCase, st = caseState(c);
  $('caseBody').innerHTML = `<div class="cinfo-h" style="--c:${c.c}">${caseArt(c, 'lg')}<b>${c.name}</b>${c.price ? `<span class="cprice"><img src="assets/gem-small.svg" alt="">${fmt(c.price)} GRAM</span>` : `<button class="cprice go" data-act="totasks">${st.txt}<i>›</i></button>`}</div>` +
    `<div class="sec-t">${$t("Что внутри")}</div><div class="tgrid">${c.items.map(it => tileHTML(it, String(it.ch).replace('.', ',') + '%')).join('')}</div>` +
    `<div class="wwarn nftw"><i>!</i><span><b>${$t("NFT на плитке — для примера")}</b><small>${$t("Выпасть может другой подарок: редкий — случайный за {0}–{1} GRAM, обычный — по флору, сейчас {2} GRAM. Какой именно — узнаешь при открытии.", RARE_FROM, RARE_TO, NFT_FLOOR)}</small></span></div>` +
    `<div class="facts">` +
    `<div style="--c:#30A5FF"><b>${$t("Когда придёт")}</b><span>${$t("GRAM, XP и NFT — сразу")}</span></div><div style="--c:#12D53D"><b>${$t("Честно")}</b><span>${$t("каждое открытие проверяется в истории")}</span></div></div>`;
  $('caseGo').textContent = c.price ? `${$t("Открыть за {0} GRAM", fmt(c.price))}` : st.ok ? (st.n > 1 ? `${$t("Открыть 1 из")} ${st.n}` : $t("Открыть")) : $t("Пока закрыт");

  $('caseGo').classList.toggle('off', !st.ok && !S.dbg.freeCases);
}
$('caseGo').onclick = () => tryOpenCase(infoCase);
function tryOpenCase(c, m = 1){
  if (c.need && !S.dbg.freeCases && !caseState(c).ok){
    haptic('rigid');
    return notify({ type: 'warn', icon: 'gift', color: c.c, title: `${c.name} ${$t("закрыт")}`, text: c.need === 'daily' ? `${$t("Выполни все задания дня: {0}/", tasksDone())}${TASKS.length}` : $t("Выполняй задания дня всю неделю") });
  }
  caseRun(c, false, m);
}
document.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a) return; const act = a.dataset.act;
  if (act === 'copyref'){ try { navigator.clipboard.writeText(REF.link); } catch(_){} haptic(); notify({ type: 'ok', icon: 'ok', title: $t("Ссылка скопирована"), text: $t("Отправь её друзьям") }); }
  if (act === 'shareref'){ haptic(); if (!tgOpen('https://t.me/share/url?url=' + encodeURIComponent(REF.link) + '&text=' + encodeURIComponent($t("Крафти NFT вместе со мной в pawn")))) notify({ type: 'info', title: $t("Пригласить друга"), text: $t("Откроется окно «Поделиться» в Telegram") }); }
  if (act === 'amb'){ haptic(); tgOpen(AMBASSADORS); }
  if (act === 'totasks'){ haptic(); openCases('tasks'); }
  if (act === 'refhist'){ haptic(); openHistory('refs'); }
  if (act === 'claimref' && REF.pending){ const v = REF.pending; REF.pending = 0; haptic('medium'); setBalance(S.balance + v); Sfx.coin(); notify({ type: 'ok', img: 'assets/hero-gem.webp', title: `+${fmt(v)} GRAM`, text: $t("Бонус за друзей") }); renderCases(); }
  if (act === 'restore'){ if (S.balance < S.week.restorePrice) return notify({ type: 'err', icon: 'coin', title: $t("Недостаточно GRAM") }); setBalance(S.balance - S.week.restorePrice); S.hist.wallet.unshift({ type: 'restore', t: Date.now(), amount: S.week.restorePrice, name: `${$t("Пропущенный день:")} ${DAYS[S.week.missed[0]]}`, method: $t("неделя заданий") }); S.week.missed.shift(); haptic('medium'); notify({ type: 'ok', icon: 'ok', title: $t("День восстановлен"), text: $t("Неделя снова идёт к кейсу Маска") }); renderCases(); }
});

/* честный ролл кейса: тот же HMAC, тикет → предмет по диапазону */
// m — множитель запаса: суммы наград в правилах уже умножены, поэтому доказательство сходится на сайте проверки как есть
const caseRules = (c, m = 1) => ({ kind: c.id, price_nano: String(nano(c.price)), rewards: c.items.map(it => ({ kind: it.t, amount: String(it.t === 'gram' ? nano(it.v * m) : it.t === 'xp' ? it.v * m : 0),
  ...(it.t === 'nft' ? { nft_rarity: it.rare ? 'rare' : 'common' } : {}), weight: it.to - it.from + 1 })) });
async function rollCase(c, m = 1){
  const nonce = ++S.nonce, domain = 'case:' + c.id, ep = await epochP, { roll, block } = await rollOf(ep.seed, ep.id, domain, S.clientSeed, nonce);
  const rules = caseRules(c, m), idx = c.items.findIndex(it => roll >= it.from && roll <= it.to), rw = rules.rewards[idx];
  const proof = { ...proofBase(ep, nonce, domain, block, roll), rules_hash: await sha(enc(JSON.stringify(rules))), rules, inputs: { price_nano: rules.price_nano },
    result: { kind: rw.kind, amount: rw.amount, ...(rw.nft_rarity ? { nft_rarity: rw.nft_rarity } : {}) } };
  ep.proofs.push(proof);
  return { kind: 'case', caseId: c.id, proof, ticket: roll, idx, mult: m };
}
const weighted = c => { let x = Math.random() * 100; return c.items.find(it => (x -= it.ch) < 0) || c.items[c.items.length - 1]; };
const tileFoot = it => it.t === 'nft' ? (it.rare ? `${RARE_FROM}–${RARE_TO} GRAM` : `${$t("флор")} ${NFT_FLOOR}`) : it.t === 'gram' ? $t("на баланс") : $t("опыт");
/* открытие кейса — на том же чёрном экране с рамкой, что и крафт: лента предметов, затем экран дропа */
async function caseRun(c, again, m = 1){
  if (S.demo){ notify({ type: 'demo', icon: 'gift', title: $t("Кейсы — только на GRAM"), text: $t("Выключи демо в меню") }); return; }
  if (c.price > S.balance){ notify({ type: 'err', icon: 'coin', title: $t("Недостаточно GRAM"), text: $t("Пополни баланс — тапни по нему сверху") }); return; }
  if (!again){ if (S.busy) return; S.busy = true; CRAFT.classList.add('busy'); clearInterval(auto); if (openDrawer){ hideDrawer(); await wait(260); } }
  if (c.price) setBalance(S.balance - c.price);
  const N = 44, WIN = 38, strip = Array.from({ length: N }, () => weighted(c));
  $('fxCaseArt').innerHTML = caseArt(c, 'md'); $('fxCaseT').textContent = c.name + (m > 1 ? ` ×${m}` : ''); $('fxCaseT').style.setProperty('--c', c.c);
  $('fxStrip').innerHTML = strip.map(it => tileHTML(it, tileFoot(it))).join(''); $('fxStrip').style.transform = 'translateX(0)';
  $('fxCaseS').textContent = $t("Ждём честный результат…");
  $('fxDrop').innerHTML = ''; $('fxWin').innerHTML = ''; $('fxBtns').innerHTML = '';
  if (!again) await openFx(true, 'case', glowOf(c.c));
  else { $('fx').classList.remove('done', 'fail'); FullGlow.set(glowOf(c.c)); FX.hot = true; $('fxCase').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); }
  $('fx').style.setProperty('--tc', c.c);
  let r = null; try { [r] = await Promise.all([API.openCase(c, m), wait(550)]); } catch(_){}
  if (!r){
    if (c.price) setBalance(S.balance + c.price);
    return failScreen('case', { c });
  }
  if (c.need) S.stock[c.id] = Math.max(0, S.stock[c.id] - m);   // из запаса уходит столько, сколько открыто
  const it0 = c.items[r.idx], it = m > 1 ? { ...it0, v: it0.v == null ? it0.v : Math.round(it0.v * m * 100) / 100, mult: m } : it0, el = $('fxStrip');
  const g = it.t === 'nft' ? caseNft(it) : null;                // какой именно NFT выпал — известно сразу
  el.children[WIN].outerHTML = tileHTML(it, tileFoot(it), g);
  $('fxCaseS').textContent = '';
  const cols = strip.map(itemColor); cols[WIN] = itemColor(it);
  // сундук дрожит и подпрыгивает — ожидание перед прокрутом (только transform)
  if (!S.lite){ Sfx.whoosh(); haptic('medium');
    await $('fxCaseArt').animate([{ transform: 'none' }, { transform: 'rotate(-4deg) scale(1.02)' }, { transform: 'rotate(4deg) scale(1.04)' }, { transform: 'rotate(-3deg) scale(1.06)' },
      { transform: 'rotate(3deg) scale(1.08)' }, { transform: 'translateY(-10px) scale(1.12)' }, { transform: 'none' }], { duration: 700, easing: 'ease-in-out' }).finished; }
  const tw = el.children[1].offsetLeft - el.children[0].offsetLeft, box = el.parentElement.offsetWidth;
  const target = WIN * tw + (tw - 8) / 2 - box / 2 + (Math.random() - .5) * (tw - 8) * .7;
  let lastI = -1; const line = el.parentElement.querySelector('.mline');
  await tween(6000, k => {
    const x = target * k; el.style.transform = `translateX(${(-x).toFixed(1)}px)`;
    const i = Math.floor((x + box / 2) / tw);
    if (i !== lastI){                                            // только при смене плитки: класс, щелчок, цвет рамки
      el.children[lastI]?.classList.remove('cur'); el.children[i]?.classList.add('cur'); lastI = i;
      Sfx.tick(.6 + .4 * k, k); if (k > .55) haptic('soft');
      if (k > .5){ FullGlow.set(glowOf(cols[i] || c.c)); if (!S.lite) line.animate([{ transform: 'scaleY(1.08)', opacity: 1 }, { transform: 'none', opacity: .85 }], { duration: 180 }); }
    }
    FX.gainTo = .6 + .4 * k;
  }, k => 1 - (1 - k) ** 5);
  el.children[lastI]?.classList.remove('cur');
  el.children[WIN].classList.add('win'); haptic('heavy'); Sfx.lock();
  if (!S.lite) $('fxCase').animate([{ transform: 'scale(1.03)' }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.3,1.4,.5,1)' });
  FullGlow.set(glowOf(itemColor(it))); FullGlow.punch(0, .8); Sfx.rank(it.t === 'nft' ? (it.rare ? 4 : 3) : it.t === 'gram' ? 2 : 1);
  await wait(900);
  /* приз */
  let label = itemName(it), img = itemImg(it);
  if (g){ label = g.nft.name; img = g.nft.src; }
  S.hist.cases.unshift({ kind: 'case', t: Date.now(), r, label, img });
  caseDrop(c, it, r, g);
}
function caseDrop(c, it, r, g){
  const drop = $('fxDrop'); $('fx').style.setProperty('--tc', itemColor(it));
  if (g){ drop.innerHTML = `<div class="pz" id="pz">${cardHTML(g, 266, true)}</div>`; dropCard(g);
    $('fxWin').innerHTML = ''; }                                // цена уже на кнопке «Продать за …»
  else { const src = itemImg(it);
    drop.innerHTML = `<div class="pz"><div class="tw${it.t === 'xp' ? ' xpw' : ''}" id="pz"><img src="${src}" alt=""><span class="gl" style="--m:url('${src}')"><i></i></span></div></div>`;
    Tilt.add($('pz'), $('pz').querySelector('img'), $('pz').querySelector('.gl i'), 1.4);
    $('fxWin').innerHTML = `<b>${it.t === 'gram' ? '+' + fmt(it.v) + ' GRAM' : '+' + it.v + ' XP'}</b><span>${c.name}</span>`; }
  $('fxBtns').innerHTML = (g ? `<button class="btn-main" id="cSell">${$t("Продать за {0} GRAM", fmt(g.value))}</button><button class="btn-ghost" id="cTake">${$t("Забрать")}</button>` : `<button class="btn-main" id="cTake">${$t("Забрать")}</button>`) +
    (c.price ? `<button class="btn-ghost" id="cAgain">${$t("Ещё раз · {0} GRAM", fmt(c.price))}</button>` : S.stock[c.id] > 0 ? `<button class="btn-ghost" id="cAgain">${$t("Ещё один · осталось")} ${S.stock[c.id]}</button>` : '') + PF_LINK;
  $('fxPfIn').onclick = () => openPF(r);
  $('fxShare').onclick = () => shareWin(`${$t("Открыл {0} и выбил {1} в Pawn", c.name, g ? g.nft.name : itemName(it))}`, g);
  const take = async how => {
    if (caseDrop.on) return; caseDrop.on = true;
    if (g){ if (how === 'sell') setTimeout(() => setBalance(S.balance + g.value), 900); else INV = [g, ...INV]; }
    else if (it.t === 'gram') setTimeout(() => setBalance(S.balance + it.v), 900);
    else addXp(it.v);
    haptic('medium'); Sfx.coin(); await closeFx(); $('fx').classList.remove('case');
    setTimeout(() => pushLive(liveCaseHTML(c, it, { me: true, img: g ? g.nft.src : null, value: g ? g.value : null, label: g ? g.nft.name : null })), 300);
    notify({ type: 'ok', color: itemColor(it), img: g ? g.nft.src : itemImg(it), title: g ? (how === 'sell' ? `${$t("Продано: +{0} GRAM", fmt(g.value))}` : `${g.nft.name} ${$t("в инвентаре")}`) : (it.t === 'gram' ? `+${fmt(it.v)} GRAM` : `+${it.v} XP`), text: c.name });
    CRAFT.classList.remove('busy'); S.busy = false; caseDrop.on = false; restartAuto(); checkAch();
    openCases();
  };
  $('cTake').onclick = () => take('take');
  $('cSell') && ($('cSell').onclick = () => take('sell'));
  $('cAgain') && ($('cAgain').onclick = () => {
    if (c.price > S.balance){ notify({ type: 'err', icon: 'coin', title: $t("Недостаточно GRAM") }); return; }
    if (g) INV = [g, ...INV]; else if (it.t === 'gram') setBalance(S.balance + it.v); else addXp(it.v);
    caseRun(c, true);
  });
  $('fx').classList.add('done');
  if (!S.lite) setTimeout(burst, 200);
  setTimeout(() => { FX.hot = false; }, 1200);
}

syncBalBtn();
/* ---------- стартовая история: настоящие seed, чтобы проверка работала и на старых записях ---------- */
(async () => {
  if (SAVE) return;                                         // прогресс восстановлен из сохранения — заглушки не нужны
  const stakes = [1, 2, .5, 5, 1, 3, 2, 10];
  for (let i = 0; i < stakes.length; i++){ let gifts = [], ton = stakes[i];
    if (stakes[i] >= 3){ const n = pick(NFTS.slice(0, 5)), bg = n.bg, v = Math.round(stakes[i] * .7 * 100) / 100; gifts = [{ id: 's' + i, num: n.num, nft: n, a: bg[0], b: bg[1], p: bg[2], value: v }]; ton = Math.round((stakes[i] - v) * 100) / 100; }
    const r = await fair(stakes[i], gifts, ton); r.gifts = gifts; r.tonStake = ton;
    S.hist.crafts.push({ kind: 'craft', t: Date.now() - (i + 1) * 47 * 60000, r, how: r.nft ? (i % 2 ? 'sell' : 'take') : 'gram' }); }
  for (let i = 0; i < 3; i++){ const c = CASES[i % 2], r = await rollCase(c), it = c.items[r.idx]; S.hist.cases.push({ kind: 'case', t: Date.now() - (i + 1) * 5 * 3600000, r, label: it.t === 'nft' ? (it.rare ? NFTS[9].name : NFTS[1].name) : null, img: it.t === 'nft' ? (it.rare ? NFTS[9].src : NFTS[1].src) : null }); }
  S.lastFair = null;
  await revealEpoch(false);                                // прошлые игры — в уже раскрытой эпохе
  S.hist.wallet.push({ type: 'dep', t: Date.now() - 26 * 3600000, amount: 250, method: 'Tonkeeper' }, { type: 'nft', t: Date.now() - 50 * 3600000, name: NFTS[40].name, img: NFTS[40].src, bg: NFTS[40].bg, value: NFTS[40].price, method: $t("в Telegram · комиссия 0.3 GRAM") },
    { type: 'nftin', t: Date.now() - 74 * 3600000, name: NFTS[12].name, img: NFTS[12].src, bg: NFTS[12].bg, value: NFTS[12].price, method: '@pawngift' },
    { type: 'dep', t: Date.now() - 98 * 3600000, amount: 150, method: 'Telegram Wallet' });
  S.hist.rewards.push({ kind: 'task', id: TASKS[0][0], rw: TASKS[0][3], t: Date.now() - 3 * 3600000 });   // утреннее задание уже выполнено
  checkAch(true);                                          // то, что уже было сделано, отмечаем без наград
})();

/* ---------- подбор NFT под выигрыш: на бэкенде может занять время — показываем заглушку ---------- */
function pickNft(r){
  const ms = S.dbg.nftDelay != null ? S.dbg.nftDelay : 600 + Math.random() * 1200;
  return new Promise(res => setTimeout(() => res(r.nft), ms));
}

/* ---------- баланс: плавно доезжает, под ним всплывает изменение. В демо баланс бесконечный ---------- */
function setBalance(v){
  const d = Math.round((v - S.balance) * 100) / 100;
  if (!S.demo){ S.balance = Math.round(v * 100) / 100; countTo($('bal'), S.balance); }
  if (!d) return;
  const el = document.createElement('div'), b = $('bal').getBoundingClientRect(), st = $('stage').getBoundingClientRect(), k = K;
  el.className = 'bal-delta'; el.textContent = (d > 0 ? '+' : '') + fmt(d); el.style.color = d > 0 ? (S.demo ? '#c9a4ff' : '#12d53d') : '#ff4c35';
  // под балансом, по центру — по бокам от него сейф-зона Telegram
  el.style.left = ((b.left + b.width / 2 - st.left) / k) + 'px'; el.style.top = ((b.bottom - st.top) / k + 6) + 'px'; el.style.translate = '-50% 0';
  $('stage').appendChild(el);
  el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none', offset: .2 }, { opacity: 0, transform: 'translateY(-18px)' }], { duration: 1500, easing: 'ease-out' }).onfinish = () => el.remove();
  $('bal').animate([{ scale: 1 }, { scale: 1.12 }, { scale: 1 }], { duration: 350 });
}
/* ---------- кнопка крафта: замах, удар, искры, ударная волна ---------- */
const CB = $('cb'), HAM = $('hammer'), ANV = $('anvil'), CRAFT = $('craft');
const REST = 14, WIND = 42, HIT = -16;                 // углы молота: покой, замах, касание наковальни
let hamAnim = null;
function hamTo(frames, opts){ hamAnim?.cancel(); hamAnim = HAM.animate(frames, { fill: 'forwards', ...opts }); return hamAnim.finished.catch(() => {}); }
function windUp(){ CRAFT.classList.add('live'); return hamTo([{ rotate: getRot() + 'deg' }, { rotate: WIND + 'deg' }], { duration: 220, easing: 'cubic-bezier(.2,.9,.3,1.2)' }); }
function getRot(){ return parseFloat(getComputedStyle(HAM).rotate) || REST; }
/* удар силы power (0..1): молот падает, наковальня приседает, шар сжимается, искры и волна */
async function strike(power = .5, back = WIND){
  CRAFT.classList.add('live');
  await hamTo([{ rotate: getRot() + 'deg' }, { rotate: HIT + 'deg' }], { duration: 90 + 40 * (1 - power), easing: 'cubic-bezier(.7,0,1,.6)' });
  ANV.animate([{ transform: 'none' }, { transform: `translateY(${1 + 2 * power}px) scale(${1 + .08 * power},${1 - .14 * power})` }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
  CB.animate([{ scale: 1 }, { scale: 1 - .07 * power }, { scale: 1 + .05 * power }, { scale: 1 }], { duration: 380, easing: 'ease-out' });
  if (!S.lite){
    CB.querySelector('.orb').animate([{ filter: 'brightness(1)' }, { filter: `brightness(${1.3 + .9 * power}) saturate(1.2)` }, { filter: 'brightness(1)' }], { duration: 420 });
    sparks(Math.round(5 + 18 * power), power);
    shock(power);
  }
  haptic(power > .7 ? 'heavy' : 'medium');
  return hamTo([{ rotate: HIT + 'deg' }, { rotate: (HIT + 10) + 'deg', offset: .25 }, { rotate: back + 'deg' }], { duration: 260, easing: 'cubic-bezier(.3,1.4,.5,1)' });
}
function settle(){ return hamTo([{ rotate: getRot() + 'deg' }, { rotate: REST + 'deg' }], { duration: 420, easing: 'cubic-bezier(.3,1.5,.5,1)' }).then(() => { hamAnim?.cancel(); hamAnim = null; CRAFT.classList.remove('live'); }); }
function shock(power){
  const r = document.createElement('i'); r.className = 'ring'; CB.appendChild(r);
  r.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--tier');
  r.animate([{ transform: 'scale(.7)', opacity: .9 }, { transform: `scale(${1.4 + 1.2 * power})`, opacity: 0 }], { duration: 450 + 350 * power, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => r.remove();
}
/* искры из точки удара — веером вверх, цветом тира */
function sparks(n = 14, power = .6){
  for (let i = 0; i < n; i++){
    const sp = document.createElement('i'); sp.className = 'spark'; CB.appendChild(sp);
    const a = -Math.PI * (.05 + .9 * Math.random()), d = (25 + Math.random() * 70) * (.6 + power), sz = .4 + Math.random() * (.6 + power);
    sp.animate([{ transform: `scale(${sz})`, opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d + 20}px) scale(0)`, opacity: 0 }],
      { duration: 380 + Math.random() * 420, easing: 'cubic-bezier(.15,.7,.4,1)' }).onfinish = () => sp.remove();
  }
}
/* палец лёг — замах; убрал без крафта — лёгкий удар и обратно в покой */
CRAFT.addEventListener('pointerdown', () => { if (!S.busy) windUp(); });
CRAFT.addEventListener('pointerleave', () => { if (!S.busy && hamAnim) settle(); });
/* синяя плашка ставки — тоже кнопка крафта */
$('bet').addEventListener('pointerdown', () => { if (!S.busy && total() > 0) windUp(); });
$('bet').addEventListener('pointerleave', () => { if (!S.busy && hamAnim) settle(); });
$('bet').addEventListener('click', () => $('craft').onclick());
const wait = ms => new Promise(r => setTimeout(r, ms));
function countTo(el, to){
  const from = parseFloat(el.textContent) || 0, t0 = performance.now();
  (function f(t){ const k = Math.min(1, (t - t0) / 600); el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); })(t0);
}

