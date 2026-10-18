/* =========================================================
   ИСТОРИЯ: крафты, кейсы, кошелёк, статистика
   ========================================================= */
S.hist = { crafts: [], cases: [], wallet: [], refs: [], rewards: [] };
// награды заданий и достижений: храним id, а название берём при показе — на текущем языке
const logReward = (kind, id, rw) => S.hist.rewards.unshift({ kind, id, rw, t: Date.now() });
// текст, сохранённый раньше на одном языке, показываем на текущем: русский ключ → $t, английский → ищем его русский ключ
const retitle = s => { if (!s || EN[s]) return $t(s || ''); const k = Object.keys(EN).find(k => EN[k] === s); return k ? $t(k) : s; };
const rewardTitle = x => x.id ? ((x.kind === 'task' ? TASKS : ACH).find(a => a[0] === x.id) || [, x.id])[1] : retitle(x.title);
// начисления за друзей: 5% от активности — каждый день в 00:00 МСК, 10% от первого депозита друга — сразу
(() => { const day = 864e5, mid = new Date(); mid.setHours(0, 0, 0, 0);
  [.84, 1.12, .37, 2.05, .66, .91, 1.48].forEach((v, i) => S.hist.refs.push({ type: 'act', t: mid - i * day, amount: v, n: 7 - (i > 3 ? 2 : 0) }));
  S.hist.refs.splice(2, 0, { type: 'first', t: mid - 1.4 * day, amount: .5, name: 'kira.ton' });
  S.hist.refs.splice(6, 0, { type: 'first', t: mid - 4.6 * day, amount: .21, name: 'b0ris' }); })();
S.xp = 340;
const tAgo = ms => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? $t("только что") : m < 60 ? `${m} ${$t("мин назад")}` : m < 1440 ? `${Math.round(m / 60)} ${$t("ч назад")}` : `${Math.round(m / 1440)} ${$t("д назад")}`; };
// группы табов истории: внутри «Бонусов» и «Финансов» — таблетки
const HGROUP = { cases: 'bonus', rewards: 'bonus', wallet: 'fin', refs: 'fin' }, HLAST = { bonus: 'cases', fin: 'wallet' };
const HSUBS = { bonus: [['cases', () => $t("Кейсы")], ['rewards', () => $t("Награды")]], fin: [['wallet', () => $t("Кошелёк")], ['refs', () => $t("Рефералка")]] };
let histTab = 'games', gameSeg = 'crafts';   // игры — один таб, внутри таблетка «Крафты · Арена · Ставки»
function openHistory(tab = histTab){ if (tab === 'crafts' || tab === 'arena' || tab === 'bets'){ gameSeg = tab; tab = 'games'; } histTab = tab; swapDrawer('histDrawer', () => renderHist()); }
// какая это игра и её порядковый номер среди игр того же вида (у арены — номер комнаты, он общий для всех игроков)
const gameKind = c => c.r.pvp ? 'arena' : c.r.bets ? 'bets' : 'crafts';
const gameNo = c => { if (c.r.pvp) return c.r.pvp.no; if (c.r.no) return c.r.no; const k = gameKind(c), L = S.hist.crafts.filter(x => gameKind(x) === k); return L.length - L.indexOf(c); };
const noTag = c => { const n = gameNo(c); return n ? '#' + n.toLocaleString(LOC) + ' · ' : ''; };
// одна строка истории (награда, кошелёк, рефералка) — в том же виде, что игры: плашка-тип и время сверху, ниже картинка, что это и сумма
// ровно как карточка крафта: слева иконка и что это, стрелка, справа сумма цветом, под ней единица, рядом картинка
const hline = (c, tag, time, pic, title, sub, val, unit, vc, left) => `<div class="hcard hl" style="--c:${c}"><span class="hk-h"><em>${tag}</em><small>${time}</small></span>` +
  `<span class="hk-b"><span class="hk-s">${left ? `<span class="hk-ic">${left}</span>` : ''}<span class="hk-v hl-t"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span></span>` +
  `<i class="hk-ar">${svg(ARW)}</i><span class="hk-s win">${pic}<span class="hk-v"><b style="color:${vc || c}">${val}</b><small>${unit}</small></span></span></span></div>`;
// длинные списки истории — порциями: сначала 30 карточек, следующие дорисовываются при прокрутке к низу (до 200 записей не строим разом)
const H_PAGE = 30; let histMore = null;
function hPage(L, fn){ histMore = L.length > H_PAGE ? { L, fn, n: H_PAGE } : null; return L.slice(0, H_PAGE).map((x, i) => fn(x, i)).join(''); }
$('histBody').addEventListener('scroll', e => { const b = e.currentTarget; if (!histMore || b.scrollTop + b.clientHeight < b.scrollHeight - 400) return;
  const { L, fn, n } = histMore; b.insertAdjacentHTML('beforeend', L.slice(n, n + H_PAGE).map((x, i) => fn(x, n + i)).join(''));
  histMore.n += H_PAGE; if (histMore.n >= L.length) histMore = null; }, { passive: true });
function renderHist(detail){ histMore = null;
  // 4 таба: Игры (Крафты · Арена · Ставки), Бонусы (Кейсы · Награды), Финансы (Кошелёк · Рефералка), Статистика
  const grp = HGROUP[histTab] || histTab, tabs = [['games', $t("Игры")], ['bonus', $t("Бонусы")], ['fin', $t("Финансы")], ['stats', $t("Статистика")]];
  requestAnimationFrame(() => $('histTabs').querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
  $('histTabs').innerHTML = tabs.map(([k, t]) => `<button class="tab${k === grp ? ' on' : ''}" data-k="${k}">${t}</button>`).join('');
  const sub = HSUBS[grp] ? `<div class="bseg seg hseg">${HSUBS[grp].map(([k, t]) => `<button class="${k === histTab ? 'on' : ''}" data-sub="${k}">${t()}</button>`).join('')}</div>` : '';
  const b = $('histBody');
  if (detail){
    const rec = detail;
    b.innerHTML = `<button class="back" id="hBack">${$t("‹ Назад")}</button>` + (rec.kind === 'case' ? caseRecHead(rec) : craftRecHead(rec)) + pfHTML(rec.r);
    bindPF(b, rec.r); $('hBack').onclick = () => renderHist(); b.scrollTop = 0; return;
  }
  if (histTab === 'games'){
    const seg = `<div class="bseg seg hseg">${[['crafts', $t("Крафты")], ['arena', $t("Арены")], ['bets', $t("Ставки")]].map(([k, t]) => `<button class="${k === gameSeg ? 'on' : ''}" data-seg="${k}">${t}</button>`).join('')}</div>`;
    const L = S.hist.crafts.map((c, i) => [c, i]).filter(([c]) => gameKind(c) === gameSeg);
    const empty = { crafts: $t("Крафтов пока нет"), arena: $t("Боёв на арене пока нет"), bets: $t("Ставок пока нет") }[gameSeg];
    b.innerHTML = seg + (L.length ? hPage(L, ([c, i]) => craftCard(c, i)) : `<p class="hempty">${empty}</p>`);
  } else if (histTab === 'cases'){
    const L = S.hist.cases;
    b.innerHTML = L.length ? hPage(L, (c, i) => caseCard2(c, i)) : `<p class="hempty">${$t("Кейсы ещё не открывались")}</p>`;
  } else if (histTab === 'refs'){
    const L = S.hist.refs, sum = L.reduce((a, x) => a + x.amount, 0);
    b.innerHTML = hPage(L, x => { const act = x.type === 'act', c = act ? '#30A5FF' : '#12D53D';
        return hline(c, act ? $t("Активность друзей") : $t("Депозит друга"), new Date(x.t).toLocaleDateString(LOC, { day: 'numeric', month: 'short' }) + (act ? ', 00:00' : ''),
          hpic('assets/gem-small.svg'), act ? $t("5% от активности") : '@' + x.name, act ? `${x.n} ${$n("друг|друга|друзей", x.n)}` : $t("первый депозит"), '+' + fmt(x.amount), 'GRAM', '#12D53D', act ? svg(IC.users) : `<span class="tav" style="--tc:${avc(x.name)}">${x.name[0].toUpperCase()}</span>`); });
  } else if (histTab === 'rewards'){
    const L = S.hist.rewards;
    b.innerHTML = L.length ? hPage(L, x => { const g = x.rw.g != null, c = g ? '#30A5FF' : '#F57A37';
      return hline(c, x.kind === 'task' ? $t("Задание дня") : $t("Достижение"), tAgo(x.t), hpic(g ? 'assets/gem-small.svg' : 'assets/xp.webp'), rewardTitle(x), '', '+' + (g ? fmt(x.rw.g) : x.rw.xp), g ? 'GRAM' : 'XP', g ? '#12D53D' : '#F57A37', svg(x.kind === 'task' ? IC.check : '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>')); }) : `<p class="hempty">${$t("Наград пока нет")}</p>`;
  } else if (histTab === 'wallet'){
    // комиссия за вывод NFT — отдельной строкой сразу под выводом (списание GRAM — своя операция)
    const L = S.hist.wallet.flatMap(w => w.type === 'nft' ? [w, { type: 'fee', t: w.t, amount: w.fee ?? OUT_FEE, name: w.name, num: w.num, model: w.model }] : [w]);
    const lab = { dep: $t("Пополнение"), nftin: $t("Депозит NFT"), nft: $t("Вывод NFT"), sell: $t("Продажа NFT"), restore: $t("Восстановление дня"), fee: $t("Комиссия за вывод") };
    b.innerHTML = L.length ? hPage(L, w => { if (w.type === 'xp') return hline('#F57A37', $t("Опыт за игры"), w.day === xpDay() ? $t("сегодня") : new Date(w.day + 'T12:00:00').toLocaleDateString(LOC, { day: 'numeric', month: 'short' }),
        hpic('assets/xp.webp'), $t("Оборот {0} GRAM", fmt(w.turn)), $t("0.5 XP за 1 GRAM"), '+' + fmt(w.xp), 'XP', '#F57A37', svg('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z"/>'));
      const dep = w.type === 'dep' || w.type === 'sell' || w.type === 'nftin', c = dep ? '#12D53D' : '#F57A37';
      return hline(c, lab[w.type], tAgo(w.t), w.img ? hpic(w.img, w.bg) : hpic('assets/gem-small.svg'),
        w.name ? w.name + (w.num ? ' #' + w.num : '') : (w.type === 'restore' ? $t("День недели") : $t("На баланс")), [w.model, w.status && retitle(w.status) !== $t("выполнено") ? `<i class="pend">${retitle(w.status)}</i>` : ''].filter(Boolean).join(' · '), w.amount != null ? (dep ? '+' : '−') + fmt(w.amount) : w.value ? '≈' + fmt(w.value) : 'NFT', w.amount != null || w.value ? 'GRAM' : '', dep ? '#12D53D' : '#F57A37', `${svg(w.type === 'restore' ? '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4M9.5 15l2 2 3.5-4"/>' : dep ? '<path d="M12 5v14M5 12l7 7 7-7"/>' : '<path d="M12 19V5M5 12l7-7 7 7"/>')}`); }) : `<p class="hempty">${$t("Операций пока нет")}</p>`;
  } else {
    // PvP: «поставлено» — свой взнос, а не банк; проигрыш в PvP в ранги не идёт
    // крафты — отдельно; арена и ставки — своими блоками ниже. Сверху — итог по всем играм
    const ALL = S.hist.crafts, C = ALL.filter(c => gameKind(c) === 'crafts'), A = ALL.filter(c => c.r.pvp), BT = ALL.filter(c => c.r.bets);
    const n = C.length, staked = C.reduce((a, c) => a + c.r.stake, 0), won = C.reduce((a, c) => a + c.r.win, 0);
    const allIn = ALL.reduce((a, c) => a + (c.r.pvp ? c.r.pvp.fee : c.r.stake), 0), allWon = ALL.reduce((a, c) => a + c.r.win, 0);
    const aWins = A.filter(c => c.r.pvp.won), aIn = A.reduce((a, c) => a + c.r.pvp.fee, 0), aWon = aWins.reduce((a, c) => a + c.r.win, 0);
    const bAll = BT.reduce((a, c) => a + c.r.bets.length, 0), bHit = BT.reduce((a, c) => a + c.r.bets.filter(x => x.won).length, 0), bIn = BT.reduce((a, c) => a + c.r.stake, 0), bWon = BT.reduce((a, c) => a + c.r.win, 0);
    const best = C.reduce((a, c) => c.r.mult > a.mult ? c.r : a, { mult: 0 }), dep = S.hist.wallet.filter(w => w.type === 'dep').reduce((a, w) => a + w.amount, 0);
    const nftList = t => S.hist.wallet.filter(w => w.type === t), sumV = L => L.reduce((a, w) => a + (w.value || 0), 0), nftOut = nftList('nft').length, nftIn = nftList('nftin').length;
    const by = TIERS.map((t, i) => C.filter(c => c.r.ti === i && !(c.r.pvp && !c.r.pvp.won) && !c.r.bets).length);
    // статистика: итог крупно → крафты (+ RTP и ранги) → кейсы и кошелёк. Цвет — только у итога и сумм GRAM
    const G = v => `${fmt(v)}${GU}`;
    const tile = (k, v, sub, cls = '') => `<div class="${cls}"><small>${k}</small><b>${v}</b>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;
    // главное — сколько выиграно; итог не показываем — поставлено и выиграно рядом, разницу видно и так.
    // Полоска — какая доля поставленного вернулась (это и есть личный RTP)
    const back = allIn ? Math.round(allWon / allIn * 100) : 0;
    b.innerHTML = `<div class="hstat-hero one net"><div style="--c:#12D53D"><small>${$t("Выиграно в играх")}</small><b>${G(allWon)}</b>` +
        `<i class="nbar"><b style="width:${Math.min(100, back)}%"></b></i>` +
        `<span>${$t("Крафты, арены и ставки")} · ${$t("поставлено {0} GRAM · вернулось {1}%", fmt(allIn), back)}</span></div></div>` +
      `<div class="hsec">${$t("Крафты")}</div><div class="hstat n">${tile($t("Крафтов"), n)}${tile($t("Лучший множитель"), best.mult ? 'x' + best.mult : '—')}` +
        `${tile($t("Поставлено"), G(staked), '', 'g')}${tile($t("Выиграно"), G(won), '', 'g')}</div>` +
      `<div class="pfi-rtp"><b>${(+RTP_PPM / 1e4).toFixed(0)}%</b><span><b>${$t("Целевой RTP")}</b><small>${n ? `${$t("Твой RTP за {0} {1} — {2}%.", n, $n("крафт|крафта|крафтов", n), Math.round(won / staked * 100))} ` : ''}${$t("Крафт на длинной дистанции возвращает игрокам 95% ставок; на коротком отрезке твой может быть выше или ниже.")}</small></span></div>` +
      `<div class="hsec">${$t("Ранги в твоих крафтах")}</div><div class="bars">${TIERS.map((t, i) => { const pc = n ? by[i] / n * 100 : 0;
        return `<div style="--c:${t.c}"><span>${t.name}</span><i><b style="width:${Math.max(pc, 1.5).toFixed(1)}%"></b><em style="left:${t.chance}%"></em></i><small>${by[i]} · ${pc.toFixed(0)}%</small></div>`; }).join('')}</div>` +
      `<p class="hnote">${$t("Белая черта — честный шанс ранга. Чем больше крафтов, тем ближе к ней твои доли.")}</p>` +
      `<div class="hsec">${$t("Арены")}</div><div class="hstat n">${tile($t("Боёв"), A.length)}${tile($t("Побед"), aWins.length, A.length ? Math.round(aWins.length / A.length * 100) + '%' : '')}` +
        `${tile($t("Взносы"), G(aIn), '', 'g')}${tile($t("Выиграно"), G(aWon), '', 'g')}</div>` +
      `<div class="hsec">${$t("Ставки")}</div><div class="hstat n">${tile($t("Ставок"), bAll)}${tile($t("Сбылось"), bHit, bAll ? Math.round(bHit / bAll * 100) + '%' : '')}` +
        `${tile($t("Поставлено"), G(bIn), '', 'g')}${tile($t("Выиграно"), G(bWon), '', 'g')}</div>` + betsRtpCard(bIn ? Math.round(bWon / bIn * 100) : null) +
      `<div class="hsec">${$t("Кейсы и кошелёк")}</div><div class="hstat n">${tile($t("Кейсов открыто"), S.hist.cases.length)}${tile($t("Пополнено"), G(dep), '', 'g')}` +
        `${tile($t("NFT пришло"), nftIn + ' ' + $t("шт"), `≈ ${fmt(sumV(nftList('nftin')))} GRAM`)}${tile($t("NFT выведено"), nftOut + ' ' + $t("шт"), `≈ ${fmt(sumV(nftList('nft')))} GRAM`)}</div>`;
  }
  if (sub) b.insertAdjacentHTML('afterbegin', sub);   // таблетки «Кейсы · Награды» / «Кошелёк · Рефералка»
}
const ARW = '<path d="M5 12h14M13 6l6 6-6 6"/>';
const hpic = (src, bg) => { const g = /gem/.test(src), x = /xp\.webp/.test(src); if (x) src = 'assets/xp-w.svg'; return `<span class="hp${g ? ' g' : x ? ' x' : ''}"${bg ? ` style="background:linear-gradient(160deg,${bg[0]},${bg[1]})"` : ''}><img src="${g ? 'assets/gem-small.svg' : src}" alt=""${/^https?:/.test(src) ? ' loading="lazy" decoding="async"' : ''}></span>`; };
const giftBg = g => [g.a, g.b];
function stakeOf(r){ const g = r.gifts || [], ton = r.tonStake != null ? r.tonStake : r.stake; return { g, ton }; }
// карточка крафта: ранг сверху, ниже «что поставил → что получил» крупно
function craftCard(c, i){
  if (c.r.pvp) return pvpCard(c, i);
  if (c.r.bets) return betsCard(c, i);
  const r = c.r, t = TIERS[r.ti], { g, ton } = stakeOf(r);
  const sp = g.map(x => hpic(x.nft.src, giftBg(x))).join('') + (ton > 0 || !g.length ? hpic('assets/gem-small.svg') : '');
  const wp = (r.super ? hpic(r.super.nft.src, giftBg(r.super)) : '') + (r.nft ? hpic(r.nft.nft.src, giftBg(r.nft)) : hpic('assets/hero-gem-128.webp'));
  return `<button class="hcard" data-i="${i}" style="--c:${t.c}"><span class="hk-h"><em>${noTag(c)}${t.name} · x${r.mult}</em>${r.super ? `<em class="sd">${$t("Супер дроп")}</em>` : ''}<small>${tAgo(c.t)}</small></span>` +
    `<span class="hk-b"><span class="hk-s"><span class="hps">${sp}</span><span class="hk-v"><b>${fmt(r.stake)}</b><small>${g.length ? `${g.length} NFT${ton > 0 ? ' + GRAM' : ''}` : 'GRAM'}</small></span></span>` +
    `<i class="hk-ar">${svg(ARW)}</i>` +
    `<span class="hk-s win"><span class="hps">${wp}</span><span class="hk-v"><b class="pos">+${fmt(r.win)}</b><small>${r.nft ? (c.how === 'sell' ? $t("NFT продан") : $t("NFT забран")) : 'GRAM'}</small></span></span></span></button>`;
}
function caseCard2(c, i){
  const cs = caseById(c.r.caseId), it = cs.items[c.r.idx], col = it.t === 'xp' ? '#F57A37' : '#12D53D';   // выигрыш — зелёный, как в крафтах; XP — оранжевый
  const m = c.r.mult || 1, val = it.t === 'gram' ? '+' + fmt(it.v * m) : it.t === 'xp' ? '+' + it.v * m : (c.label || itemName(it));
  return `<button class="hcard" data-i="${i}" style="--c:${cs.c}"><span class="hk-h"><em>${cs.short}</em><small>${tAgo(c.t)}</small></span>` +
    `<span class="hk-b"><span class="hk-s">${caseArt(cs, 'xs')}<span class="hk-v"><b>${cs.price ? fmt(cs.price) : '0'}</b><small>${cs.price ? 'GRAM' : $t("бесплатно")}</small></span></span>` +
    `<i class="hk-ar">${svg(ARW)}</i>` +
    `<span class="hk-s win">${hpic(c.img || itemImg(it))}<span class="hk-v"><b style="color:${col}">${val}</b><small>${it.t === 'nft' ? (it.rare ? $t("редкий NFT") : $t("обычный NFT")) : it.t === 'gram' ? 'GRAM' : 'XP'}</small></span></span></span></button>`;
}
$('histTabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (!t) return; histTab = HLAST[t.dataset.k] || t.dataset.k; haptic(); renderHist(); $('histBody').scrollTop = 0; });
$('histBody').addEventListener('click', e => {
  const sb = e.target.closest('[data-sub]'); if (sb){ histTab = HLAST[HGROUP[sb.dataset.sub]] = sb.dataset.sub; haptic(); renderHist(); $('histBody').scrollTop = 0; return; }
  const sg = e.target.closest('[data-seg]'); if (sg){ gameSeg = sg.dataset.seg; haptic(); renderHist(); $('histBody').scrollTop = 0; return; }
  const r = e.target.closest('button.hcard'); if (!r) return; haptic();
  renderHist((histTab === 'cases' ? S.hist.cases : S.hist.crafts)[+r.dataset.i]);
});
// что было в ставке: NFT-подарки (картинка, название, оценка) и GRAM
function stakeChips(r){
  const g = r.gifts || [], ton = r.tonStake != null ? r.tonStake : r.stake;
  return g.map(x => `<span class="hchip nft"><img src="${x.nft.src}" alt=""><span><b>${x.nft.name}</b><small>NFT · ${fmt(x.value)} GRAM</small></span></span>`).join('') +
    (ton > 0 || !g.length ? `<span class="hchip"><i class="gm gb"></i><span><b>${fmt(ton)}${GU}</b></span></span>` : '');
}
// что получено: NFT (забран или продан) и/или GRAM на баланс
function winChips(r, how){
  if (!r.nft) return `<span class="hchip"><i class="gm gp"></i><span><b class="pos">+${fmt(r.win)}${GU}</b><small>${$t("на баланс")}</small></span></span>`;
  return `<span class="hchip nft"><img src="${r.nft.nft.src}" alt=""><span><b>${r.nft.nft.name}</b><small>${how === 'sell' ? `${$t("продан за {0} GRAM", fmt(r.nft.value))}` : `NFT · ${fmt(r.nft.value)} GRAM`}</small></span></span>` +
    (r.change > 0 ? `<span class="hchip"><i class="gm gp"></i><span><b class="pos">+${fmt(r.change)}${GU}</b><small>${$t("сдача на баланс")}</small></span></span>` : '');
}
// раздел подробностей: заголовок и строки под ним. Если строка одна — сумму в заголовке не пишем (она и так в строке, без дубля)
const hdSec = (label, val, rows = '') => `<div class="hd-sec"><span>${label}</span>${(rows.match(/class="hd-row"/g) || []).length === 1 ? '' : val}</div>${rows}`;
const hdRow = (src, bg, name, sub, val, pos) => `<div class="hd-row">${hpic(src, bg)}<span><b>${name}</b>${sub ? `<small>${sub}</small>` : ''}</span><em${pos ? ' class="pos"' : ''}>${val}</em></div>`;
function craftRecHead(c){ if (c.r.pvp) return pvpRecHead(c); if (c.r.bets) return betsRecHead(c); const r = c.r, t = TIERS[r.ti], { g, ton } = stakeOf(r);
  const st = g.map(x => hdRow(x.nft.src, giftBg(x), `${x.nft.name} #${x.num}`, x.nft.model, fmt(x.value) + GU)).join('') + (ton > 0 || !g.length ? hdRow('assets/gem-small.svg', null, 'GRAM', '', fmt(ton) + GU) : '');
  const wn = winRows(c);
  // порядковый номер игры (nonce доказательства) — только внутри
  return `<div class="hdet" style="--c:${t.c}"><div class="hk-h"><em>${noTag(c)}${t.name} · x${r.mult}</em><small>${tAgo(c.t)}</small></div>` +
    hdSec($t("Ставка"), `<b>${fmt(r.stake)}${GU}</b>`, st) + hdSec($t("Выигрыш"), `<b class="pos">+${fmt(r.win)}${GU}</b>`, wn) + `</div>`;
}
// что получено с крафта: NFT (в инвентаре / продан) и сдача, или GRAM на баланс; супер дроп — сверху
function winRows(c){ const r = c.r;
  let wn = r.nft ? hdRow(r.nft.nft.src, giftBg(r.nft), `${r.nft.nft.name} #${r.nft.num ?? r.nft.nft.num}`, `${r.nft.nft.model} · ${c.how === 'sell' ? $t("продан") : $t("в инвентаре")}`, fmt(r.nft.value) + GU, 1) + (r.change > 0 ? hdRow('assets/hero-gem-128.webp', null, $t("Сдача на баланс"), '', '+' + fmt(r.change) + GU, 1) : '')
    : hdRow('assets/hero-gem-128.webp', null, $t("На баланс"), '', '+' + fmt(r.win) + GU, 1);
  if (r.super) wn = hdRow(r.super.nft.src, giftBg(r.super), r.super.nft.name, $t("Супер дроп"), fmt(r.super.value) + GU, 1) + wn;
  return wn;
}
function caseRecHead(c){ const cs = caseById(c.r.caseId), it = cs.items[c.r.idx], m = c.r.mult || 1;
  return `<div class="hdet" style="--c:${cs.c}"><div class="hk-h"><em>${cs.name}</em><small>${tAgo(c.t)}</small></div>` +
    `<div class="hd-case">${caseArt(cs, 'sm')}<span><b>${cs.price ? fmt(cs.price) + GU : $t("Бесплатно")}</b><small>${$t("стоимость открытия")}</small></span></div>` +
    `<div class="hd-sec"><span>${$t("Выпало")}</span></div>${hdRow(c.img || itemImg(it), null, c.label || itemName(it), it.t === 'nft' ? (it.rare ? $t("редкий NFT") : $t("обычный NFT")) : '', it.t === 'gram' ? '+' + fmt(it.v * m) + GU : it.t === 'xp' ? '+' + it.v * m + ' XP' : '', 1)}</div>`;
}
function logCraft(r, how){ S.hist.crafts.unshift({ kind: 'craft', t: Date.now(), r, how }); }
// PvP: слева — взнос и твой тикет, справа — что получил (победа) или кто забрал банк (проигрыш)
function pvpCard(c, i){
  const r = c.r, p = r.pvp, t = TIERS[r.ti], won = p.won;
  const right = won ? (r.nft ? hpic(r.nft.nft.src, giftBg(r.nft)) : hpic('assets/hero-gem-128.webp')) + `<span class="hk-v"><b class="pos">+${fmt(r.win)}</b><small>${r.nft ? (c.how === 'sell' ? $t("NFT продан") : $t("NFT забран")) : 'GRAM'}</small></span>`
    : `<span class="hp pvp-w">${pvpAva({ who: p.winner })}</span><span class="hk-v"><b>0</b><small>GRAM</small></span>`;
  return `<button class="hcard" data-i="${i}" style="--c:${won ? t.c : '#8a8a96'}"><span class="hk-h"><em>${noTag(c)}${t.name} · x${r.mult}</em><small>${tAgo(c.t)}</small></span>` +
    `<span class="hk-b"><span class="hk-s"><span class="hps">${hpic('assets/gem-small.svg')}</span><span class="hk-v"><b>${fmt(p.fee)}</b><small>GRAM</small></span></span>` +
    `<i class="hk-ar">${svg(ARW)}</i><span class="hk-s win">${right}</span></span></button>`;
}
// предикты: слева — сколько поставил и на сколько исходов, справа — выплата; в шапке — выпавший тикет и ранг
function betsCard(c, i){
  const r = c.r, t = TIERS[r.ti], n = r.bets.length, w = r.bets.filter(b => b.won).length;
  return `<button class="hcard" data-i="${i}" style="--c:${r.win > 0 ? t.c : '#8a8a96'}"><span class="hk-h"><em>${noTag(c)}${t.name} · ${tk(r.ticket)}</em><small>${tAgo(c.t)}</small></span>` +
    `<span class="hk-b"><span class="hk-s"><span class="hps">${hpic('assets/gem-small.svg')}</span><span class="hk-v"><b>${fmt(r.stake)}</b><small>${n} ${$n("ставка|ставки|ставок", n)}</small></span></span>` +
    // справа — как у крафта и арены: какой NFT дали (забран / продан) или GRAM
    `<i class="hk-ar">${svg(ARW)}</i><span class="hk-s win">${r.nft ? hpic(r.nft.nft.src, giftBg(r.nft)) : hpic('assets/hero-gem-128.webp')}<span class="hk-v"><b${r.win > 0 ? ' class="pos"' : ''}>${r.win > 0 ? '+' + fmt(r.win) : '0'}</b><small>${r.nft ? (c.how === 'sell' ? $t("NFT продан") : $t("NFT забран")) : $t("сбылось {0} из {1}", w, n)}</small></span></span></span></button>`;
}
function betsRecHead(c){ const r = c.r, t = TIERS[r.ti];
  const rows = r.bets.map(b => hdRow('assets/gem-small.svg', null, betLabel(b.bet, b.sel), `${fmt(b.amount)} GRAM · x${fmt(betMult(b.bet, b.sel))}`, b.won ? '+' + fmt(b.pay) + GU : '—', b.won)).join('');
  return `<div class="hdet" style="--c:${r.win > 0 ? t.c : '#8a8a96'}"><div class="hk-h"><em>${noTag(c)}${t.name} · ${tk(r.ticket)}</em><small>${tAgo(c.t)}</small></div>` +
    hdSec($t("Ставка"), `<b>${fmt(r.stake)}${GU}</b>`, rows) + hdSec($t("Выплата"), `<b${r.win > 0 ? ' class="pos"' : ''}>${r.win > 0 ? '+' + fmt(r.win) : '0'}${GU}</b>`, r.win > 0 ? winRows(c) : '') + `</div>`;   // что получено: NFT и сдача или GRAM — как у крафта и арены
}
// подробно: взнос, банк, все игроки по близости к тикету, крафт на банк (если выиграл); ниже — проверка честности
function pvpRecHead(c){ const r = c.r, p = r.pvp, t = TIERS[r.ti];
  return `<div class="hdet" style="--c:${p.won ? t.c : '#8a8a96'}"><div class="hk-h"><em>${p.no ? '#' + p.no.toLocaleString(LOC) + ' · ' : ''}${t.name} · x${r.mult}</em><small>${tAgo(c.t)}</small></div>` +
    // как у крафта и ставок: разделы с плашками внутри одной карточки — взнос, выигрыш, игроки
    hdSec($t("Взнос"), `<b>${fmt(p.fee)}${GU}</b>`, hdRow('assets/gem-small.svg', null, 'GRAM', '', fmt(p.fee) + GU)) +
    hdSec($t("Выигрыш"), `<b${p.won ? ' class="pos"' : ''}>${p.won ? '+' + fmt(r.win) : '0'}${GU}</b>`, p.won ? winRows(c) : '') +
    `<div class="hd-sec"><span>${$t("Игроки")}</span></div>` + pvlHTML(p, r) + `</div>`;
}

