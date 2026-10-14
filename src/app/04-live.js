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
  const nft = win >= NFT_FROM ? NFTS.filter(x => x.price <= win).slice(-1)[0] : null;
  const img = nft ? nft.src : 'assets/hero-gem.webp', who = o.me ? 'твой дроп' : '@' + pick(NICKS);
  const label = win >= 100 ? Math.round(win) : win >= 10 ? String(Math.round(win * 10) / 10) : fmt(win);
  return `<div class="item${ti >= 3 ? ' hi' : ''}${o.me ? ' me' : ''}" style="--c:${t.c}" data-n="${n}" data-w="${win}" data-m="${mult}" data-who="${who}" data-img="${img}" data-nft="${nft ? nft.name : ''}">` +
    `<span class="glow"></span><img src="${img}" alt=""><i><img src="assets/gem-small.svg" alt="">${label}</i>${ti >= 3 ? '<span class="shine"></span>' : ''}</div>`;
}
// открытие кейса в ленте: приз + маленький значок кейса
function liveCaseHTML(c, it, o = {}){
  const img = o.img || (it.t === 'nft' ? pick(it.rare ? RARE_POOL() : FLOOR_POOL()).src : itemImg(it));
  const v = it.t === 'gram' ? fmt(it.v) : it.t === 'xp' ? '+' + it.v : fmt(o.value || (it.rare ? pick(RARE_POOL()).price : NFT_FLOOR));
  return `<div class="item icase${it.rare ? ' hi' : ''}${it.t === 'xp' ? ' ixp' : ''}${o.me ? ' me' : ''}" style="--c:${itemColor(it)}" data-case="${c.id}" data-who="${o.me ? 'твой кейс' : '@' + pick(NICKS)}" data-lbl="${o.label || itemName(it)}" data-img="${img}">` +
    `<span class="glow"></span><img src="${img}" alt=""><span class="cbadge"><img src="${c.img}" alt=""></span><i><img src="${it.t === 'xp' ? 'assets/xp.webp' : 'assets/gem-small.svg'}" alt="">${v}</i>${it.rare ? '<span class="shine"></span>' : ''}</div>`;
}
const liveItem = () => { if (Math.random() < .3){ const c = pick(CASES), it = weighted(c); return liveCaseHTML(c, it); } return liveHTML(Math.random() * TICKETS | 0); };
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
  if (it.dataset.case){ const c = caseById(it.dataset.case); haptic(); notify({ img: it.dataset.img, color: c.c, title: c.name, text: `${it.dataset.who} — выпало: ${it.dataset.lbl}` }); return; }
  const n = +it.dataset.n, t = TIERS[tierOfTicket(n)]; haptic();
  notify({ img: it.dataset.img, color: t.c, title: `${t.name} · x${it.dataset.m}`, text: `${it.dataset.who} — ${it.dataset.nft || '+' + fmt(+it.dataset.w) + ' GRAM'} · тикет ${n.toLocaleString('ru-RU')}` });
});
setInterval(() => { if (!document.hidden) pushLive(); }, 3200);

