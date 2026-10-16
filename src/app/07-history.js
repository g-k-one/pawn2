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
let histTab = 'crafts';
function openHistory(tab = histTab){ histTab = tab; swapDrawer('histDrawer', () => renderHist()); }
function renderHist(detail){
  const tabs = [['crafts', $t("Крафты")], ['cases', $t("Кейсы")], ['rewards', $t("Награды")], ['wallet', $t("Кошелёк")], ['refs', $t("Рефералка")], ['stats', $t("Статистика")]];
  requestAnimationFrame(() => $('histTabs').querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
  $('histTabs').innerHTML = tabs.map(([k, t]) => `<button class="tab${k === histTab ? ' on' : ''}" data-k="${k}">${t}</button>`).join('');
  const b = $('histBody');
  if (detail){
    const rec = detail;
    b.innerHTML = `<button class="back" id="hBack">${$t("‹ Назад")}</button>` + (rec.kind === 'case' ? caseRecHead(rec) : craftRecHead(rec)) + pfHTML(rec.r);
    bindPF(b, rec.r); $('hBack').onclick = () => renderHist(); b.scrollTop = 0; return;
  }
  if (histTab === 'crafts'){
    const L = S.hist.crafts;
    b.innerHTML = L.length ? L.map((c, i) => craftCard(c, i)).join('') : `<p class="hempty">${$t("Крафтов пока нет")}</p>`;
  } else if (histTab === 'cases'){
    const L = S.hist.cases;
    b.innerHTML = L.length ? L.map((c, i) => caseCard2(c, i)).join('') : `<p class="hempty">${$t("Кейсы ещё не открывались")}</p>`;
  } else if (histTab === 'refs'){
    const L = S.hist.refs, sum = L.reduce((a, x) => a + x.amount, 0);
    b.innerHTML = `<div class="hstat-hero one"><div style="--c:#30A5FF"><small>${$t("Получено за друзей")}</small><b style="color:var(--blue)">+${fmt(sum)}${GU}</b><span>${$t("Начисляется само в 00:00 МСК")}</span></div></div>` +
      L.map(x => { const act = x.type === 'act', c = act ? '#30A5FF' : '#12D53D';
        return `<div class="hcard w" style="--c:${c}"><span class="hk-ic">${svg(act ? IC.users : '<path d="M12 5v14M5 12l7 7 7-7"/>')}</span><span class="hk-v"><b>${act ? $t("5% от активности") : $t("10% от депозита @") + x.name}</b><small>${act ? `${x.n} ${$n("друг|друга|друзей", x.n)} · ` : ($t("первый депозит ·") + " ")}${new Date(x.t).toLocaleDateString(LOC, { day: 'numeric', month: 'short' })}${act ? ', 00:00' : ''}</small></span><b class="hk-amt" style="color:${c}">+${fmt(x.amount)}${GU}</b></div>`; }).join('');
  } else if (histTab === 'rewards'){
    const L = S.hist.rewards;
    b.innerHTML = L.length ? L.map(x => { const g = x.rw.g != null, c = g ? '#30A5FF' : '#F57A37';
      return `<div class="hcard w" style="--c:${c}">${hpic(g ? 'assets/gem-small.svg' : 'assets/xp.webp')}<span class="hk-v"><b>${rewardTitle(x)}</b><small>${x.kind === 'task' ? $t("Задание дня") : $t("Достижение")} · ${tAgo(x.t)}</small></span>` +
        `<b class="hk-amt" style="color:${c}">${g ? '+' + fmt(x.rw.g) + GU : '+' + x.rw.xp + ' XP'}</b></div>`; }).join('') : `<p class="hempty">${$t("Наград пока нет")}</p>`;
  } else if (histTab === 'wallet'){
    const L = S.hist.wallet, lab = { dep: $t("Пополнение"), nftin: $t("Депозит NFT"), nft: $t("Вывод NFT"), sell: $t("Продажа NFT"), restore: $t("Восстановление дня") };
    b.innerHTML = L.length ? L.map(w => { const dep = w.type === 'dep' || w.type === 'sell' || w.type === 'nftin', c = dep ? '#12D53D' : '#F57A37';
      return `<div class="hcard w" style="--c:${c}">${w.img ? hpic(w.img, w.bg) : `<span class="hk-ic">${svg(w.type === 'restore' ? '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4M9.5 15l2 2 3.5-4"/>' : dep ? '<path d="M12 5v14M5 12l7 7 7-7"/>' : '<path d="M12 19V5M5 12l7-7 7 7"/>')}</span>`}` +
        `<span class="hk-v"><b>${w.name || lab[w.type]}</b><small>${w.name ? lab[w.type] + ' · ' : ''}${w.status && retitle(w.status) !== $t("выполнено") ? `<i class="pend">${retitle(w.status)}</i> · ` : ''}${tAgo(w.t)}</small></span>` +
        `<b class="hk-amt" style="color:${c}">${w.amount != null ? (dep ? '+' : '−') + fmt(w.amount) + GU : w.value ? '≈' + fmt(w.value) + GU : 'NFT'}</b></div>`; }).join('') : `<p class="hempty">${$t("Операций пока нет")}</p>`;
  } else {
    // PvP: «поставлено» — свой взнос, а не банк; проигрыш в PvP в ранги не идёт
    const C = S.hist.crafts, n = C.length, staked = C.reduce((a, c) => a + (c.r.pvp ? c.r.pvp.fee : c.r.stake), 0), won = C.reduce((a, c) => a + c.r.win, 0);
    const best = C.reduce((a, c) => c.r.mult > a.mult ? c.r : a, { mult: 0 }), dep = S.hist.wallet.filter(w => w.type === 'dep').reduce((a, w) => a + w.amount, 0);
    const nftList = t => S.hist.wallet.filter(w => w.type === t), sumV = L => L.reduce((a, w) => a + (w.value || 0), 0), nftOut = nftList('nft').length, nftIn = nftList('nftin').length;
    const by = TIERS.map((t, i) => C.filter(c => c.r.ti === i && !(c.r.pvp && !c.r.pvp.won) && !c.r.bets).length);
    // статистика: итог крупно → крафты (+ RTP и ранги) → кейсы и кошелёк. Цвет — только у итога и сумм GRAM
    const G = v => `${fmt(v)}${GU}`;
    const tile = (k, v, sub, cls = '') => `<div class="${cls}"><small>${k}</small><b>${v}</b>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;
    // главное — сколько выиграно; итог не показываем — поставлено и выиграно рядом, разницу видно и так.
    // Полоска — какая доля поставленного вернулась (это и есть личный RTP)
    const back = staked ? Math.round(won / staked * 100) : 0;
    b.innerHTML = `<div class="hstat-hero one net"><div style="--c:#12D53D"><small>${$t("Выиграно в крафтах")}</small><b>${G(won)}</b>` +
        `<i class="nbar"><b style="width:${Math.min(100, back)}%"></b></i>` +
        `<span>${$t("Поставлено {0} GRAM · вернулось {1}%", fmt(staked), back)}</span></div></div>` +
      `<div class="hsec">${$t("Крафты")}</div><div class="hstat n">${tile($t("Крафтов"), n)}${tile($t("Лучший множитель"), best.mult ? 'x' + best.mult : '—')}` +
        `${tile($t("Поставлено"), G(staked), '', 'g')}${tile($t("Выиграно"), G(won), '', 'g')}</div>` +
      `<div class="pfi-rtp"><b>${(+RTP_PPM / 1e4).toFixed(0)}%</b><span><b>${$t("Целевой RTP")}</b><small>${n ? `${$t("Твой RTP за {0} {1} — {2}%.", n, $n("крафт|крафта|крафтов", n), Math.round(won / staked * 100))} ` : ''}${$t("Крафт на длинной дистанции возвращает игрокам 95% ставок; на коротком отрезке твой может быть выше или ниже.")}</small></span></div>` +
      `<div class="hsec">${$t("Ранги в твоих крафтах")}</div><div class="bars">${TIERS.map((t, i) => { const pc = n ? by[i] / n * 100 : 0;
        return `<div style="--c:${t.c}"><span>${t.name}</span><i><b style="width:${Math.max(pc, 1.5).toFixed(1)}%"></b><em style="left:${t.chance}%"></em></i><small>${by[i]} · ${pc.toFixed(0)}%</small></div>`; }).join('')}</div>` +
      `<p class="hnote">${$t("Белая черта — честный шанс ранга. Чем больше крафтов, тем ближе к ней твои доли.")}</p>` +
      `<div class="hsec">${$t("Кейсы и кошелёк")}</div><div class="hstat n">${tile($t("Кейсов открыто"), S.hist.cases.length)}${tile($t("Пополнено"), G(dep), '', 'g')}` +
        `${tile($t("NFT пришло"), nftIn + ' ' + $t("шт"), `≈ ${fmt(sumV(nftList('nftin')))} GRAM`)}${tile($t("NFT выведено"), nftOut + ' ' + $t("шт"), `≈ ${fmt(sumV(nftList('nft')))} GRAM`)}</div>`;
  }
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
  const wp = (r.super ? hpic(r.super.nft.src, giftBg(r.super)) : '') + (r.nft ? hpic(r.nft.nft.src, giftBg(r.nft)) : hpic('assets/hero-gem.webp'));
  return `<button class="hcard" data-i="${i}" style="--c:${t.c}"><span class="hk-h"><em>${t.name} · x${r.mult}</em>${r.super ? `<em class="sd">${$t("Супер дроп")}</em>` : ''}<small>${tAgo(c.t)}</small></span>` +
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
$('histTabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (!t) return; histTab = t.dataset.k; haptic(); renderHist(); $('histBody').scrollTop = 0; });
$('histBody').addEventListener('click', e => {
  const r = e.target.closest('button.hcard'); if (!r) return; haptic();
  renderHist((histTab === 'cases' ? S.hist.cases : S.hist.crafts)[+r.dataset.i]);
});
// что было в ставке: NFT-подарки (картинка, название, оценка) и GRAM
function stakeChips(r){
  const g = r.gifts || [], ton = r.tonStake != null ? r.tonStake : r.stake;
  return g.map(x => `<span class="hchip nft"><img src="${x.nft.src}" alt=""><span><b>${x.nft.name}</b><small>NFT · ${fmt(x.value)} GRAM</small></span></span>`).join('') +
    (ton > 0 || !g.length ? `<span class="hchip"><img src="assets/gem-small.svg" alt="" class="gm"><span><b>${fmt(ton)}${GU}</b></span></span>` : '');
}
// что получено: NFT (забран или продан) и/или GRAM на баланс
function winChips(r, how){
  if (!r.nft) return `<span class="hchip"><img src="assets/gem-small.svg" alt="" class="gm"><span><b class="pos">+${fmt(r.win)}${GU}</b><small>${$t("на баланс")}</small></span></span>`;
  return `<span class="hchip nft"><img src="${r.nft.nft.src}" alt=""><span><b>${r.nft.nft.name}</b><small>${how === 'sell' ? `${$t("продан за {0} GRAM", fmt(r.nft.value))}` : `NFT · ${fmt(r.nft.value)} GRAM`}</small></span></span>` +
    (r.change > 0 ? `<span class="hchip"><img src="assets/gem-small.svg" alt="" class="gm"><span><b class="pos">+${fmt(r.change)}${GU}</b><small>${$t("сдача на баланс")}</small></span></span>` : '');
}
const hdRow = (src, bg, name, sub, val, pos) => `<div class="hd-row">${hpic(src, bg)}<span><b>${name}</b>${sub ? `<small>${sub}</small>` : ''}</span><em${pos ? ' class="pos"' : ''}>${val}</em></div>`;
function craftRecHead(c){ if (c.r.pvp) return pvpRecHead(c); if (c.r.bets) return betsRecHead(c); const r = c.r, t = TIERS[r.ti], { g, ton } = stakeOf(r);
  const st = g.map(x => hdRow(x.nft.src, giftBg(x), x.nft.name, 'NFT · #' + x.num, fmt(x.value) + GU)).join('') + (ton > 0 || !g.length ? hdRow('assets/gem-small.svg', null, 'GRAM', '', fmt(ton) + GU) : '');
  let wn = r.nft ? hdRow(r.nft.nft.src, giftBg(r.nft), r.nft.nft.name, c.how === 'sell' ? $t("продан") : $t("в инвентаре"), fmt(r.nft.value) + GU, 1) + (r.change > 0 ? hdRow('assets/hero-gem.webp', null, $t("Сдача на баланс"), '', '+' + fmt(r.change) + GU, 1) : '')
    : hdRow('assets/hero-gem.webp', null, $t("На баланс"), '', '+' + fmt(r.win) + GU, 1);
  if (r.super) wn = hdRow(r.super.nft.src, giftBg(r.super), r.super.nft.name, $t("Супер дроп"), fmt(r.super.value) + GU, 1) + wn;
  return `<div class="hdet" style="--c:${t.c}"><div class="hk-h"><em>${t.name} · x${r.mult}</em><small>${tAgo(c.t)}</small></div>` +
    `<div class="hd-sec"><span>${$t("Ставка")}</span><b>${fmt(r.stake)}${GU}</b></div>${st}<div class="hd-sec"><span>${$t("Выигрыш")}</span><b class="pos">+${fmt(r.win)}${GU}</b></div>${wn}</div>`;
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
  const right = won ? (r.nft ? hpic(r.nft.nft.src, giftBg(r.nft)) : hpic('assets/hero-gem.webp')) + `<span class="hk-v"><b class="pos">+${fmt(r.win)}</b><small>${r.nft ? (c.how === 'sell' ? $t("NFT продан") : $t("NFT забран")) : $t("банк {0} GRAM", fmt(p.bank))}</small></span>`
    : `<span class="hp pvp-x">@</span><span class="hk-v"><b>0</b><small>${$t("банк забрал @{0}", p.winner)}</small></span>`;
  return `<button class="hcard" data-i="${i}" style="--c:${won ? t.c : '#8a8a96'}"><span class="hk-h"><em>${svg(IC.fire)} PvP · ${won ? `${t.name} · x${r.mult}` : $t("проигрыш")}</em><small>${tAgo(c.t)}</small></span>` +
    `<span class="hk-b"><span class="hk-s"><span class="hps">${hpic('assets/gem-small.svg')}</span><span class="hk-v"><b>${fmt(p.fee)}</b><small>${$t("взнос · тикет {0}", tk(p.guess))}</small></span></span>` +
    `<i class="hk-ar">${svg(ARW)}</i><span class="hk-s win">${right}</span></span></button>`;
}
// предикты: слева — сколько поставил и на сколько исходов, справа — выплата; в шапке — выпавший тикет и ранг
function betsCard(c, i){
  const r = c.r, t = TIERS[r.ti], n = r.bets.length, w = r.bets.filter(b => b.won).length;
  return `<button class="hcard" data-i="${i}" style="--c:${r.win > 0 ? '#7c5cff' : '#8a8a96'}"><span class="hk-h"><em>${svg(IC.target)} ${$t("Предикты")} · ${tk(r.ticket)} · ${t.name}</em><small>${tAgo(c.t)}</small></span>` +
    `<span class="hk-b"><span class="hk-s"><span class="hps">${hpic('assets/gem-small.svg')}</span><span class="hk-v"><b>${fmt(r.stake)}</b><small>${n} ${$n("ставка|ставки|ставок", n)}</small></span></span>` +
    `<i class="hk-ar">${svg(ARW)}</i><span class="hk-s win">${hpic('assets/hero-gem.webp')}<span class="hk-v"><b${r.win > 0 ? ' class="pos"' : ''}>${r.win > 0 ? '+' + fmt(r.win) : '0'}</b><small>${$t("сбылось {0} из {1}", w, n)}</small></span></span></span></button>`;
}
function betsRecHead(c){ const r = c.r, t = TIERS[r.ti];
  const rows = r.bets.map(b => hdRow('assets/gem-small.svg', null, betLabel(b.bet, b.sel), `${fmt(b.amount)} GRAM · x${fmt(betMult(b.bet, b.sel))}`, b.won ? '+' + fmt(b.pay) + GU : '—', b.won)).join('');
  return `<div class="hdet" style="--c:${r.win > 0 ? '#7c5cff' : '#8a8a96'}"><div class="hk-h"><em>${svg(IC.target)} ${$t("Предикты")} · ${$t("тикет")} ${tk(r.ticket)} · ${t.name}</em><small>${tAgo(c.t)}</small></div>` +
    `<div class="hd-sec"><span>${$t("Ставка")}</span><b>${fmt(r.stake)}${GU}</b></div>${rows}<div class="hd-sec"><span>${$t("Выплата")}</span><b class="pos">+${fmt(r.win)}${GU}</b></div></div>`;
}
// подробно: взнос, банк, все игроки по близости к тикету, крафт на банк (если выиграл); ниже — проверка честности
function pvpRecHead(c){ const r = c.r, p = r.pvp, t = TIERS[r.ti];
  const rows = [...p.players].sort((a, b) => a.dist - b.dist).map(x => hdRow(x.me ? 'assets/avatar.webp' : 'assets/gem-small.svg', null, x.me ? $t("Ты") : '@' + x.who, `${$t("тикет")} ${tk(x.guess)} · ±${x.dist.toLocaleString(LOC)}`, x.win ? $t("ближе всех") : '', x.win)).join('');
  return `<div class="hdet" style="--c:${p.won ? t.c : '#8a8a96'}"><div class="hk-h"><em>${svg(IC.fire)} PvP · ${$t("тикет")} ${tk(r.ticket)} · ${t.name}</em><small>${tAgo(c.t)}</small></div>` +
    `<div class="hd-sec"><span>${$t("Взнос")}</span><b>${fmt(p.fee)}${GU}</b></div><div class="hd-sec"><span>${$t("Банк · игроков {0}", p.n)}</span><b>${fmt(p.bank)}${GU}</b></div>${rows}` +
    (p.won ? `<div class="hd-sec"><span>${$t("Крафт на банк · x{0}", r.mult)}</span><b class="pos">+${fmt(r.win)}${GU}</b></div>` : '') + `</div>`;
}

