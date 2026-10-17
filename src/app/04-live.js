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
setInterval(() => { if (document.hidden || S.pfOff.live || (S.lite && ++liveN % 2)) return; pushLive(); }, 3200);   // в экономном режиме — вдвое реже

