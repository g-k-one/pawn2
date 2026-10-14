/* =========================================================
   СТАВКА
   ========================================================= */
function renderBet(bump){
  const bet = $('bet');
  const hasG = S.gifts.length > 0;
  bet.classList.toggle('gifts', hasG);
  bet.innerHTML = hasG
    ? `<img src="assets/gift.svg" width="32" height="35" alt=""><b class="gsum">${fmt(giftSum())}</b><span class="plus"></span><img src="assets/gem-small.svg" width="34" height="29" alt=""><b class="ton">${fmt(S.ton)}</b>`
    : `<img src="${S.demo ? 'assets/fantik.webp' : 'assets/ton.svg'}" width="${S.demo ? 50 : 49}" height="${S.demo ? 50 : 41.34}" alt=""><b class="ton">${fmt(S.ton)}</b>`;
  if (bump) bet.querySelector('.ton').classList.add('bump');
  $('giftIco').src = hasG ? 'assets/gift-box.svg' : 'assets/gift-add.svg';
  $('giftCnt').hidden = !hasG; $('giftCnt').textContent = S.gifts.length;
  renderSlots();
  if (bump === 'gift') bet.querySelector('.gsum')?.classList.add('bump');
  showPrize();
}
document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
  if (S.busy) return;
  S.ton = Math.min(999, Math.round((S.ton + +b.dataset.add) * 100) / 100); haptic(); renderBet(true);
});
$('trash').onclick = () => { if (S.busy) return; S.ton = 0; S.gifts = []; haptic('medium'); renderBet(true); };
/* ---------- NFT-карточка ---------- */
const SKINS = ['Neon', 'Cactus', 'Midnight', 'Sakura', 'Gold Rush', 'Frost', 'Toxic', 'Ruby', 'Aurora', 'Onyx', 'Bubblegum', 'Lava'];
/* карточка NFT в духе Telegram: номер сверху, картинка, цена в теле карты. big — карточка выигрыша: коллекция, скин, номер */
function cardHTML(g, w, big){
  g.skin = g.skin || g.nft.model || pick(SKINS);
  const sy = g.nft.sym; if (sy) symLoad(sy);
  const num = '#' + g.num.toLocaleString('ru-RU');
  return `<div class="nc${big ? ' big' : ''}" style="--w:${w}px;--a:${g.a};--b:${g.b};--p:${g.p}"><div class="nc-t"><div class="nc-bg"></div><span class="nc-patw"><span class="nc-pat${sy && SYM_OK.has(sy) ? ' sym' : ''}"${sy ? ` data-sym="${sy}"${SYM_OK.has(sy) ? ` style="--symimg:${symImg(sy).replace(/"/g, '&quot;')}"` : ''}` : ''}></span></span>` +
    (big ? '' : `<span class="nc-num">${num}</span>`) + `<img class="nc-img" src="${g.nft.card || g.nft.src}" alt="${g.nft.name}"><span class="nc-gl"><i></i></span>` +
    (big ? `<span class="nc-cap"><b>${g.nft.name}</b><small>${g.skin} · ${num}</small></span>` : `<span class="nc-pr"><img src="assets/gem-small.svg" alt="">${fmt(g.value)}</span>`) + '</div></div>';
}
const priceHTML = v => `<img src="assets/gem-small.svg" alt="">${fmt(v)}`;
const tiltCard = (root, k) => Tilt.add(root.querySelector('.nc-t'), root.querySelector('.nc-img'), root.querySelector('.nc-gl i'), k, root.querySelector('.nc-pat'));

/* ---------- гифты в крафте: 1-й слева (меньше), 2-й справа. Тап — убрать ---------- */
function renderSlots(){
  const box = $('slots');
  box.querySelectorAll('.slot').forEach(el => {
    const idx = S.gifts.findIndex(g => g.id === el.dataset.id);
    if (idx < 0){ el.classList.add('out'); Tilt.drop(el); setTimeout(() => el.remove(), 260); }
    else el.className = 'slot slot-' + idx;
  });
  S.gifts.forEach((g, idx) => {
    if (box.querySelector(`.slot[data-id="${g.id}"]:not(.out)`)) return;
    const el = document.createElement('div');
    el.className = 'slot slot-' + idx; el.dataset.id = g.id; el.style.pointerEvents = 'auto';
    el.innerHTML = `<div class="in"><div class="sw">${cardHTML(g, 92)}</div></div>`;
    el.onclick = () => { if (S.busy) return; S.gifts = S.gifts.filter(x => x !== g); haptic(); renderBet('gift'); renderInv(); };
    box.appendChild(el); tiltCard(el, 1);
  });
}

/* ---------- шторки ---------- */
let openDrawer = null;
function showDrawer(id){
  openDrawer = $(id); openDrawer.classList.add('open'); $('backdrop').classList.add('on'); haptic();
}
function hideDrawer(){
  if (!openDrawer) return;
  openDrawer.classList.remove('open'); openDrawer.style.transform = ''; $('backdrop').classList.remove('on'); openDrawer = null;
}
$('backdrop').onclick = hideDrawer;
// тянуть вниз — закрыть: за шапку или за любое место, если содержимое прокручено к началу
document.querySelectorAll('.drawer').forEach(dr => {
  const body = dr.querySelector('.dr-b');
  let y0 = null, x0 = 0, dy = 0, t0 = 0, armed = false, moved = false;
  const start = (x, y, target) => { y0 = y; x0 = x; dy = 0; t0 = performance.now(); moved = false; armed = !!target.closest('.dr-h'); };
  // возвращает true, если жест наш (тогда гасим прокрутку)
  const move = (x, y) => {
    if (y0 === null) return false;
    const d = (y - y0) / K;
    if (!armed){
      if (Math.abs(x - x0) > 14 || d < -4){ y0 = null; return false; }
      if (d > 6 && (!body || body.scrollTop <= 0)){ armed = true; y0 = y; } else return false;
    }
    moved = true; dr.classList.add('drag');
    dy = Math.max(0, (y - y0) / K); dr.style.transform = `translateY(${dy}px)`;
    return true;
  };
  const end = () => {
    if (y0 === null && !armed) return; y0 = null;
    if (!armed) return; armed = false;
    const v = dy / Math.max(1, performance.now() - t0);
    dr.classList.remove('drag');
    if (dy > 80 || (dy > 24 && v > .45)) hideDrawer(); else dr.style.transform = '';
  };
  dr.addEventListener('touchstart', e => start(e.touches[0].clientX, e.touches[0].clientY, e.target), { passive: true });
  dr.addEventListener('touchmove', e => { if (move(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault(); }, { passive: false });
  dr.addEventListener('touchend', end); dr.addEventListener('touchcancel', end);
  // мышь (десктоп-превью)
  dr.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button) return; start(e.clientX, e.clientY, e.target); });
  window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') move(e.clientX, e.clientY); });
  window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') end(); });
  // клик после перетаскивания не должен выбирать подарок
  dr.addEventListener('click', e => { if (moved){ e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
});

/* ---------- шторка подарков: инвентарь, выбрать максимум 2 ---------- */
function updSel(){
  if (sellMode){ $('selCnt').textContent = INV.length + ' шт'; $('selHint').innerHTML = sellSel.size ? `На продажу <b>${sellSel.size}</b> · <b>${fmt(sellSum())} GRAM</b>` : 'Отметь подарки, которые хочешь продать'; return; }
  $('selCnt').textContent = INV.length ? INV.length + ' шт' : '';
  $('selHint').innerHTML = !INV.length ? '' : S.gifts.length ? `В крафте <b>${S.gifts.length} из ${MAX_GIFTS}</b> · тапни ещё раз, чтобы убрать` : `Выбери до ${MAX_GIFTS} подарков для крафта`;
}
// сетка карточек тянется на всю ширину: число колонок по ширине, карточки растут, пустых полей нет
function fitCards(grid, minW, gap){
  if (!grid) return; const W = grid.clientWidth; if (!W) return;
  const cols = Math.max(2, Math.floor((W + gap) / (minW + gap))), w = Math.floor((W - gap * (cols - 1)) / cols);
  grid.style.gridTemplateColumns = `repeat(${cols}, ${w}px)`; grid.style.columnGap = gap + 'px'; grid.style.justifyContent = 'space-between';
  grid.querySelectorAll('.nc').forEach(n => n.style.setProperty('--w', w + 'px'));
}
function renderInv(){
  const inv = $('inv');
  updSel();
  if (!INV.length){ inv.innerHTML = giftInHTML(); return; }
  inv.classList.toggle('selling', sellMode);
  inv.innerHTML = INV.map(g => `<button class="cell${(sellMode ? sellSel.has(g.id) : S.gifts.includes(g)) ? ' sel' : ''}" data-id="${g.id}"><span class="chk">${svg(NICON.ok)}</span>${cardHTML(g, 104)}</button>`).join('');
  fitCards(inv, 104, 10); inv.querySelectorAll('.cell').forEach(c => tiltCard(c, .6));
}
$('inv').addEventListener('click', e => {
  const c = e.target.closest('.cell'); if (!c) return;
  const g = INV.find(x => x.id === c.dataset.id);
  if (sellMode){ sellSel.has(g.id) ? sellSel.delete(g.id) : sellSel.add(g.id); haptic(); c.classList.toggle('sel', sellSel.has(g.id)); updSel(); giftsFoot(); return; }
  if (S.gifts.includes(g)) S.gifts = S.gifts.filter(x => x !== g);
  else if (S.gifts.length >= MAX_GIFTS){ c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); notify({ type: 'warn', icon: 'gift', title: 'Максимум 2 подарка', text: 'Убери один, чтобы выбрать другой' }); haptic('rigid'); return; }
  else S.gifts = [...S.gifts, g];
  haptic(); c.classList.toggle('sel', S.gifts.includes(g)); updSel();
  renderBet('gift');
});
$('giftBtn').onclick = () => { if (S.busy) return; sellMode = false; sellSel.clear(); giftsFoot(); if (S.demo){ haptic('rigid'); notify({ type: 'demo', icon: 'gift', title: 'Подарки — только на GRAM', text: 'Выключи демо в меню, чтобы крафтить из NFT' }); return; } renderInv(); showDrawer('giftsDrawer'); };
/* продажа подарков в любой момент: режим продажи прямо в шторке подарков */
let sellMode = false; const sellSel = new Set();
const sellSum = () => INV.filter(g => sellSel.has(g.id)).reduce((a, g) => a + g.value, 0);
function giftsFoot(){
  const f = $('giftsF'); f.className = 'dr-f ' + (sellMode ? 'two' : 'three');
  f.innerHTML = sellMode
    ? `<button class="btn-ghost" id="sellCancel">Отмена</button><button class="btn-main${sellSel.size ? '' : ' off'}" id="sellGo">${sellSel.size ? `Продать за ${fmt(sellSum())} GRAM` : 'Выбери подарки'}</button>`
    : `<button class="btn-ghost" id="giftsSell"${INV.length ? '' : ' disabled'}>Продать</button><button class="btn-ghost" id="giftsOut">Вывести</button><button class="btn-main" id="giftsDone">Готово</button>`;
}
$('giftsF').addEventListener('click', e => {
  const id = e.target.closest('button')?.id; if (!id) return;
  if (id === 'giftsDone') return hideDrawer();
  if (id === 'giftsOut'){ haptic(); return openWallet('out'); }
  if (id === 'giftsSell'){ if (!INV.length) return; haptic(); sellMode = true; sellSel.clear(); renderInv(); giftsFoot(); return; }
  if (id === 'sellCancel'){ haptic(); sellMode = false; sellSel.clear(); renderInv(); giftsFoot(); return; }
  if (id === 'sellGo'){
    if (!sellSel.size){ haptic('rigid'); return; }
    const list = INV.filter(g => sellSel.has(g.id)), sum = Math.round(sellSum() * 100) / 100;
    INV = INV.filter(g => !sellSel.has(g.id)); S.gifts = S.gifts.filter(g => INV.includes(g));
    setBalance(S.balance + sum); haptic('medium'); Sfx.coin();
    S.hist.wallet.unshift({ type: 'sell', t: Date.now(), amount: sum, name: list.length > 1 ? `${list.length} NFT` : list[0].nft.name, img: list[0].nft.src, bg: [list[0].a, list[0].b], method: 'продажа' });
    notify({ type: 'ok', img: list[0].nft.src, color: '#12D53D', title: `Продано: +${fmt(sum)} GRAM`, text: list.length > 1 ? `${list.length} подарка` : list[0].nft.name });
    sellMode = false; sellSel.clear(); renderInv(); giftsFoot(); renderBet();
  }
});
giftsFoot();

/* ---------- шторка меню (моковая) ---------- */
const IC = {
  box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  shield: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M4 13h16M12 9c-3 0-5-1-5-3s3-2 5 3c2-5 5-5 5-3s-2 3-5 3z"/>',
  users: '<g fill="currentColor" stroke="none"><circle cx="9" cy="7.5" r="3.6"/><path d="M2 19.5C2 15.6 5.1 13 9 13s7 2.6 7 6.5v.5H2z"/><circle cx="17.2" cy="8.5" r="2.9"/><path d="M17.6 12.7c2.7.3 4.4 2.3 4.4 5.3v2h-4.4v-.5c0-2.4-.9-4.6-2.6-6 .8-.5 1.7-.8 2.6-.8z"/></g>',
  check: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 12l3 3 5-6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  chat: '<path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H10l-4 3v-3H6a2 2 0 01-2-2z"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
};
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
// веер из последних призов для баннера истории
const histFan = () => { const L = [...new Set(S.hist.crafts.filter(c => c.r.nft).map(c => c.r.nft.nft.src))].slice(0, 3);
  for (let i = 0; L.length < 3; i++) if (!L.includes(NFTS[i].src)) L.push(NFTS[i].src); return L.map((src, i) => `<img src="${src}" alt="" style="--i:${i}">`).join(''); };
function renderMenu(){
  const sw = (id, c, ic, t, sub, on) => `<button class="mrow" id="${id}" style="--c:${c}"><i>${svg(ic)}</i><span class="mt">${t}${sub ? `<small>${sub}</small>` : ''}</span><span class="switch${on ? ' on' : ''}"></span></button>`;
  const row = (ic, t, c, e, extra = '') => `<button class="mrow" style="--c:${c}"${extra}><i>${svg(ic)}</i>${t}<em>${e}</em></button>`;
  $('menuBody').innerHTML =
    `<button class="mprof menu-top"><img src="assets/avatar.webp" alt=""><span><b>GK</b><small>${S.demo ? '∞ фантиков' : fmt(S.balance) + ' GRAM'}</small></span>${S.demo ? '' : '<em>Пополнить</em>'}</button>` +
    rankBar(S.xp) +
    `<button class="mbonus" data-go="cases"><span class="mb-t"><b>Бонусы</b><small>кейсы, задания, супер дроп и друзья</small><span class="mb-chips"><span>Задания ${tasksDone()}/${TASKS.length}</span>${dailyDone() ? '<span class="ok">Кейс готов</span>' : ''}</span></span><span class="mb-art">${caseArt(caseById('satoshi'))}${caseArt(caseById('durov'))}</span></button>` +
    `<div class="mban2"><button class="mb2 hist" data-go="hist"><span class="mb2-t"><b>История</b><small>игры, кошелёк и бонусы</small></span><span class="mb2-art">${histFan()}</span></button>` +
    `<button class="mb2 pf" data-go="pfi"><span class="mb2-t"><b>Честность</b><small>проверь любой результат</small></span><span class="mb2-art"><i class="mb2-sh">${svg(IC.shield)}</i><em>00000</em></span></button></div>` +
    `<div class="mgrp-t">Игра</div><div class="mgrp">` +
      sw('fastRow', '#FFB835', NICON.bolt, 'Быстрый крафт', 'сразу число и дроп', S.fast) +
      sw('liteRow', '#12D53D', NICON.leaf, 'Экономный режим', 'без анимаций — для слабых телефонов', S.lite) +
      sw('demoRow', '#AE3FC4', NICON.candy, 'Демо-режим', 'фантики вместо GRAM', S.demo) +
      sw('vibroRow', '#30A5FF', NICON.vibro, 'Вибрация', '', S.vibro) +
      sw('soundRow', '#F57A37', NICON.sound, 'Звук', '', S.sound) + `</div>` +
    `<div class="mgrp-t">Другое</div><div class="mgrp">` +
      row(IC.users, 'Рефералка', '#EB57B0', `${REF.friends.length} друзей`, ' data-go="refs"') +
      `<div class="mrow" style="--c:#AE3FC4"><i>${svg(IC.globe)}</i>Язык<span class="seg">${[['ru', 'RU'], ['en', 'EN']].map(([k, t]) => `<button data-lang="${k}"${S.lang === k ? ' class="on"' : ''}>${t}</button>`).join('')}</span></div>` +
      row(IC.chat, 'Поддержка', '#12D53D', '') +
      `<button class="mrow" id="dbgRow" style="--c:#EB57B0"><i>${svg(NICON.bug)}</i>Дебаг<em>${dbgLabel()}</em></button></div>` +
    `<div class="wwarn rg"><i>18+</i><span><b>Играй ответственно</b><small>Ставь только то, что готов потерять, и делай перерывы. Если игра перестала быть развлечением — остановись.</small></span></div>` +
    `<p class="credit">Картинки подарков — powered by <a href="https://t.me/GiftChanges" target="_blank" rel="noopener">@GiftChanges</a> (api.changes.tg)</p>`;
}
$('menuBtn').onclick = () => { renderMenu(); showDrawer('menuDrawer'); };
$('menuBody').addEventListener('click', e => {
  if (e.target.closest('.menu-top')){ openWallet('dep'); return; }
  const go = e.target.closest('[data-go]')?.dataset.go;
  if (go){ haptic(); if (go === 'cases') openCases('tasks'); else if (go === 'top') openCases('top'); else if (go === 'refs') openCases('refs'); else if (go === 'hist') openHistory(); else if (go === 'pfi') swapDrawer('pfiDrawer', renderPFInfo); return; }
  const lg = e.target.closest('[data-lang]');
  if (lg){ if (S.lang === lg.dataset.lang) return; S.lang = lg.dataset.lang; try { localStorage.setItem('bm-lang', S.lang); } catch(_){} haptic();
    lg.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === lg));
    I18N.set(S.lang); return; }
  const r = e.target.closest('.mrow'); if (!r || !r.matches('button')) return;
  if (r.id === 'fastRow') return toggleFast();
  if (r.id === 'vibroRow') return toggleVibro();
  if (r.id === 'soundRow') return toggleSound();
  if (r.id === 'liteRow') return setLite(!S.lite);
  if (r.id === 'dbgRow'){ swapDrawer('dbgDrawer', renderDbg); return; }
  if (r.id === 'demoRow'){ if (S.busy) return; return setDemo(!S.demo); }
  haptic();
  notify({ type: 'info', icon: 'info', title: r.childNodes[1].textContent.trim(), text: 'Скоро будет' });
});

