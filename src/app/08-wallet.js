/* =========================================================
   КОШЕЛЁК: одна кнопка «Подключить кошелёк» → TON Connect; пополнение только GRAM.
   Вывод — только NFT, комиссия 0.3 GRAM за штуку. NFT можно и завести: передать подарок @pawngift
   ========================================================= */
S.wallet = null;
const WALLETS = [['Tonkeeper', '#45aef5', 'T'], ['Telegram Wallet', '#2aabee', 'W'], ['MyTonWallet', '#0098ea', 'M'], ['Tonhub', '#6c63ff', 'H']];
const OUT_FEE = .3, RELAYER = '@pawngift';
let walletTab = 'dep', depAmount = 10, outSel = new Set();
// баннер партнёра — Telegram Stars, тем же видом, что карточка «Передай подарок релееру» (только во вкладке «Пополнить»)
const PARTNER = `<div class="wwarn tgs"><i><img src="assets/tg-star.svg" alt=""></i><span><b>${$t("Выгодно купить и продать Stars")}</b>` +
  `<button class="pill-btn" data-act="partner">${$t("Открыть бота")}</button></span></div>`;
const WICO = '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M6 4h10.5A1.5 1.5 0 0118 5.5V7H6a1 1 0 000 2h13a2 2 0 012 2v7a2 2 0 01-2 2H6a3 3 0 01-3-3V7a3 3 0 013-3zm11 9a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>';
// как завести NFT: передать подарок релееру
// пополнение NFT-подарком — в том же заметном стиле, что и «Сначала напиши релееру» при выводе
const giftInHTML = (title = $t("Подарков пока нет")) => `<div class="wwarn ginw"><i>${svg(IC.gift)}</i><span><b>${title}</b>` +
  `<small>${$t("В профиле Telegram: подарок → «Передать» →")} <span class="acc">${RELAYER}</span>. ${$t("Он появится здесь после проверки.")}</small>` +
  `<button class="pill-btn" data-act="relayer">${$t("Передать подарок")}</button></span></div>`;
/* промокоды: GRAM сразу на баланс или бонус +% к ближайшему пополнению (потолок в GRAM и срок). Проверяет и применяет сервер (API.promo) */
S.bonus = null;                                              // { pct, max, until } — бонус к ближайшему пополнению
const bonusOn = () => S.bonus && S.bonus.until > Date.now() ? S.bonus : null;
const bonusOf = a => { const b = bonusOn(); return b ? Math.min(Math.floor(a * b.pct) / 100, b.max) : 0; };
const leftT = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = s / 3600 | 0, m = (s / 60 | 0) % 60, x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
const bonusHTML = () => { const b = bonusOn(); return b ? `<div class="wbonus"><i>${svg(NICON.ok)}</i><span><b>${$t("Бонус на одно пополнение")}</b><small><em id="bonusT">${leftT(b.until - Date.now())}</em> · ${$t("макс бонус {0} GRAM", fmt(b.max))}</small></span><strong>+${b.pct}%</strong></div>` : ''; };
const promoHTML = () => `<div class="promo"><input id="promoIn" placeholder="${$t("Промокод")}" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="32"><button class="pill-btn" data-act="promo">${$t("Применить")}</button></div>`;
// dbg — из дебага: код можно вводить повторно (на сервере тоже)
async function applyPromo(btn, dbgCode){
  const inp = $('promoIn'), code = dbgCode || inp?.value.trim().toUpperCase(); if (!code){ haptic('rigid'); inp?.focus(); return; }
  const r = await btnWait(btn, API.promo(code, !!dbgCode)); if (!r) return;
  if (!r.ok){ haptic('rigid'); return notify({ type: 'err', icon: 'err', title: r.error === 'used' ? $t("Промокод уже активирован") : r.error === 'expired' ? $t("Промокод больше не действует") : $t("Нет такого промокода"), text: code }); }
  haptic('medium'); if (inp) inp.value = '';
  if (r.kind === 'gram'){ setBalance(S.balance + r.amount); Sfx.coin(); S.hist.wallet.unshift({ type: 'promo', t: Date.now(), amount: r.amount, name: code, method: $t("промокод") });
    notify({ type: 'ok', img: 'assets/hero-gem.webp', title: `+${fmt(r.amount)} GRAM`, text: `${$t("Промокод")} ${code}` }); }
  else { S.bonus = { pct: r.pct, max: r.max, until: Date.now() + r.left }; S.hist.wallet.unshift({ type: 'promo', t: Date.now(), pct: r.pct, name: code, method: $t("бонус к пополнению") });
    notify({ type: 'ok', icon: 'ok', color: '#12D53D', title: $t("Бонус +{0}% к пополнению", r.pct), text: `${$t("макс бонус {0} GRAM", fmt(r.max))} · ${leftT(r.left)}` }); }
  if (openDrawer === $('walletDrawer')) renderWallet();
}
// таймер бонуса — пока открыто «Пополнить»; срок вышел — карточка исчезает
setInterval(() => { if (!S.bonus || openDrawer !== $('walletDrawer') || walletTab !== 'dep') return;
  if (!bonusOn()){ S.bonus = null; renderWallet(); return; } const el = $('bonusT'); if (el) el.textContent = leftT(S.bonus.until - Date.now()); }, 1000);
function syncBalBtn(){ const b = $('balAdd'); if (b) b.innerHTML = S.wallet ? svg('<path d="M12 6v12M6 12h12"/>') : svg(WICO); }
function openWallet(tab = 'dep'){ if (S.busy) return; if (S.demo){ notify({ type: 'demo', img: 'assets/fantik.webp', title: $t("В демо баланс бесконечный"), text: $t("Кошелёк работает только на GRAM") }); return; } walletTab = tab; outSel = new Set(); swapDrawer('walletDrawer', renderWallet); }
function walletBtn(){
  const go = $('walletGo'), n = outSel.size, fee = Math.round(Math.max(0, n - freeOuts()) * OUT_FEE * 100) / 100;   // премиум сезона: первые выводы без комиссии
  go.classList.remove('off');
  if (walletTab === 'dep'){ const bn = S.wallet ? bonusOf(depAmount) : 0;
    go.innerHTML = S.wallet ? `${$t("Пополнить на {0} GRAM", fmt(depAmount))}` + (bn ? `<small>${$t("+{0} GRAM бонусом", fmt(bn))}</small>` : '') : $t("Подключить кошелёк"); }
  // всегда две строки — шторка не прыгает при выборе. Комиссия видна ещё до выбора
  else { go.innerHTML = n ? `${$t("Вывести {0} NFT", n)}<small>${$t("по одному · комиссия {0} GRAM", fmt(fee))}</small>`
    : `${$t("Выбери подарки для вывода")}<small>${freeOuts() ? $t("без комиссии — ещё {0}, дальше {1} GRAM", freeOuts(), OUT_FEE) : $t("комиссия {0} GRAM за каждый", OUT_FEE)}</small>`; go.classList.toggle('off', !n); }
}
function renderWallet(){
  $('walletTabs').innerHTML = [['dep', $t("Пополнить")], ['out', $t("Вывести NFT")]].map(([k, t]) => `<button class="tab${k === walletTab ? ' on' : ''}" data-k="${k}">${t}</button>`).join('');
  const b = $('walletBody');
  if (walletTab === 'dep' && !S.wallet){
    b.innerHTML = bonusHTML() + `<div class="wcon"><span class="wico">${svg(WICO)}</span><b>${$t("Подключи кошелёк")}</b><p>${$t("Пополнение — только в GRAM, с твоего кошелька. Ключи остаются у тебя: каждую транзакцию ты подтверждаешь сам.")}</p></div>` +
      promoHTML() + `<div class="sec-t">${$t("Или пополни NFT-подарком")}</div>${giftInHTML($t("Передай подарок релееру"))}` + PARTNER;
  } else if (walletTab === 'dep'){
    b.innerHTML = bonusHTML() + `<div class="wchip"><i style="--c:${(WALLETS.find(w => w[0] === S.wallet.name) || [, '#0098ea'])[1]}">${S.wallet.name[0]}</i><span><b>${S.wallet.name}</b><small>${S.wallet.addr}</small></span><button data-act="off">${$t("Отключить")}</button></div>` +
      `<label class="amt"><input id="depIn" type="number" inputmode="decimal" min="1" step="1" value="${depAmount}"><span>GRAM</span></label>` +
      `<div class="presets">${[5, 10, 25, 50, 100].map(v => `<button class="pill-btn${v === depAmount ? ' on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>` + promoHTML() +
      `<div class="sec-t">${$t("Или пополни NFT-подарком")}</div>${giftInHTML($t("Передай подарок релееру"))}` + PARTNER;
  } else {
    b.innerHTML = `<div class="wwarn"><i>!</i><span><b>${$t("Сначала напиши")} ${RELAYER}</b><small>${$t("Перед выводом обязательно отправь любое сообщение релееру")} <span class="acc">${RELAYER}</span> ${$t("в Telegram — и только потом выводи.")}</small>` +
      `<button class="pill-btn" data-act="relayerMsg">${$t("Написать")} ${RELAYER}</button></span></div>` + (INV.length ? `<div style="height:12px"></div>` +
      `<div class="onft" id="onft">${INV.map(g => `<button class="cell${outSel.has(g.id) ? ' sel' : ''}" data-id="${g.id}"><span class="chk">${svg(NICON.ok)}</span>${cardHTML(g, 104)}</button>`).join('')}</div>`
      : giftInHTML());
    b.querySelectorAll('.cell').forEach(c => tiltCard(c, .5));
  }
  walletBtn(); fitAmt(); fitCards($('onft'), 104, 10);
}
$('walletTabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (!t) return; walletTab = t.dataset.k; outSel = new Set(); haptic(); renderWallet(); });
/* общие действия: партнёр, релеер */
function relayerFlow(){
  haptic();
  tgOpen('https://t.me/' + RELAYER.slice(1));
  notify({ type: 'info', icon: 'gift', title: `${$t("Передай подарок")} ${RELAYER}`, text: $t("Как только он придёт — покажем здесь") });
  // прототип: через пару секунд «приходит» подарок
  setTimeout(() => { const n = pick(NFTS.slice(0, 9)), bg = n.bg;
    const g = { id: 'r' + Date.now(), num: n.num, nft: n, a: bg[0], b: bg[1], p: bg[2], value: n.price }; INV = [g, ...INV];
    S.hist.wallet.unshift({ type: 'nftin', t: Date.now(), name: n.name, num: n.num, model: n.model, img: n.src, bg: n.bg, value: n.price, method: RELAYER });   // депозит NFT-подарком — в историю
    S.ach.nftDep = true; notify({ type: 'ok', img: n.src, title: `${n.name} ${$t("получен")}`, text: $t("Подарок уже в инвентаре") });
    if (openDrawer === $('giftsDrawer')) renderInv(); if (openDrawer === $('walletDrawer')) renderWallet(); checkAch(); }, 3500);
}
const PARTNER_URL = 'https://t.me/ludkadurova_bot?start=refXdaHSWzm';   // бот партнёра (реф-ссылка)
function partnerFlow(){ haptic(); if (!tgOpen(PARTNER_URL)){ try { window.open(PARTNER_URL, '_blank'); } catch(_){} } }
document.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'relayerMsg'){ haptic(); tgOpen('https://t.me/' + RELAYER.slice(1)); }
  else if (a.dataset.act === 'relayer') relayerFlow(); else if (a.dataset.act === 'partner') partnerFlow();
  else if (a.dataset.act === 'verify'){ haptic(); try { Telegram.WebApp.openLink(VERIFY_URL); e.preventDefault(); } catch(_){} } });
$('walletBody').addEventListener('click', e => {
  const p = e.target.closest('.presets .pill-btn'), c = e.target.closest('.onft .cell');
  const pr = e.target.closest('[data-act="promo"]'); if (pr){ applyPromo(pr); return; }
  if (e.target.closest('[data-act="off"]')){ haptic(); tcUI ? tcUI.disconnect().catch(() => {}) : (S.wallet = null, renderWallet()); syncBalBtn(); return; }
  if (p){ depAmount = +p.dataset.v; haptic(); $('walletBody').querySelectorAll('.presets .pill-btn').forEach(x => x.classList.toggle('on', x === p)); $('depIn').value = depAmount; fitAmt(); walletBtn(); }
  // выбор подарка — без перерисовки, чтобы карточки не дёргались
  if (c){ const id = c.dataset.id; outSel.has(id) ? outSel.delete(id) : outSel.add(id); c.classList.toggle('sel', outSel.has(id)); haptic(); walletBtn(); }
});
/* поле суммы шириной ровно по тексту — «10 GRAM» стоит по центру как одна группа */
const amtCtx = document.createElement('canvas').getContext('2d');
function fitAmt(){ const el = $('depIn'); if (!el) return; const cs = getComputedStyle(el); amtCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  el.style.width = Math.ceil(amtCtx.measureText(el.value || '0').width + 4) + 'px'; }
$('walletBody').addEventListener('input', e => { if (e.target.id === 'depIn'){ fitAmt(); depAmount = Math.max(0, Math.round(+e.target.value * 100) / 100 || 0); walletBtn(); } });
/* TON Connect (макет): выбор кошелька в отдельном окне */
/* TON Connect — настоящий: @tonconnect/ui с CDN. Манифест должен лежать по TC_MANIFEST (файл tonconnect-manifest.json в корне репозитория),
   DEPOSIT_ADDR — кошелёк Pawn для пополнений. Подключение восстанавливается само при следующем запуске */
const TC_MANIFEST = 'https://pawn-frontend.onrender.com/tonconnect-manifest.json';
const DEPOSIT_ADDR = '';                                     // TODO: адрес кошелька Pawn для пополнений
let tcUI = null;
const shortAddr = a => a.slice(0, 6) + '…' + a.slice(-4);
function tcLoad(){
  return tcLoad.p ||= new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://unpkg.com/@tonconnect/ui@2.0.9/dist/tonconnect-ui.min.js'; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); })
    .then(() => { const T = window.TON_CONNECT_UI; tcUI = new T.TonConnectUI({ manifestUrl: TC_MANIFEST });
      tcUI.onStatusChange(w => { const was = S.wallet;
        S.wallet = w ? { name: w.device.appName, addr: shortAddr(T.toUserFriendlyAddress(w.account.address)) } : null;
        syncBalBtn(); if (openDrawer === $('walletDrawer')) renderWallet();
        if (S.wallet && !was) notify({ type: 'ok', icon: 'ok', title: $t("Кошелёк подключён"), text: `${S.wallet.name} · ${S.wallet.addr}` }); });
      return tcUI; })
    .catch(e => { tcLoad.p = null; throw e; });
}
async function tonConnect(){
  try { await (await tcLoad()).openModal(); }
  catch(_){ notify({ type: 'err', icon: 'err', title: $t("TON Connect не загрузился"), text: $t("Проверь интернет и попробуй ещё раз") }); }
}
setTimeout(() => tcLoad().catch(() => {}), 3000);              // заранее: восстановить прошлое подключение
$('walletGo').onclick = async () => {
  const btn = $('walletGo'); if (btn.disabled) return;
  if (walletTab === 'dep' && !S.wallet){ tonConnect(); return; }
  if (walletTab === 'dep'){
    if (depAmount < 1){ notify({ type: 'err', icon: 'coin', title: $t("Минимум 1 GRAM") }); return; }
    if (!DEPOSIT_ADDR && !S.wallet.fake){ notify({ type: 'warn', icon: 'warn', title: $t("Адрес для пополнений не задан"), text: $t("Прототип: впиши DEPOSIT_ADDR в коде") }); return; }
    btn.disabled = true; btn.classList.add('wait'); btn.textContent = `${$t("Подтверди в {0}…", S.wallet.name)}`;
    let tx = null;
    if (S.wallet.fake) await wait(900);   // дебаг-кошелёк: подтверждение «в кошельке» без настоящей транзакции
    else try { tx = await tcUI.sendTransaction({ validUntil: Math.floor(Date.now() / 1000) + 300, messages: [{ address: DEPOSIT_ADDR, amount: String(nano(depAmount)) }] }); }
    catch(_){ btn.disabled = false; btn.classList.remove('wait'); walletBtn(); notify({ type: 'err', icon: 'err', title: $t("Платёж отменён") }); return; }
    btn.disabled = false; btn.classList.remove('wait'); hideDrawer();   // в бою баланс зачисляет бэкенд после подтверждения в сети
    if (!(await API.confirmDeposit(depAmount, tx?.boc).catch(() => ({ ok: false }))).ok) return notify({ type: 'err', icon: 'err', title: $t("Пополнение не прошло"), text: $t("Если GRAM списались — они придут после подтверждения в сети") });
    const bn = bonusOf(depAmount), pct = S.bonus?.pct; if (bn) S.bonus = null;   // бонус промокода — к этому пополнению, один раз
    S.hist.wallet.unshift({ type: 'dep', t: Date.now(), amount: depAmount, method: S.wallet.name });
    if (bn) S.hist.wallet.unshift({ type: 'bonus', t: Date.now() + 1, amount: bn, name: `+${pct}%`, method: $t("бонус к пополнению") });
    setTimeout(() => { setBalance(S.balance + depAmount + bn); Sfx.coin(); notify({ type: 'ok', img: 'assets/hero-gem.webp', title: `+${fmt(depAmount + bn)} GRAM`, text: `${$t("Пополнение с")} ${S.wallet.name}` + (bn ? ` · ${$t("бонус +{0}%", pct)}` : '') }); checkAch(); }, 250);
  } else {
    const list = INV.filter(g => outSel.has(g.id)), fee = Math.round(Math.max(0, list.length - freeOuts()) * OUT_FEE * 100) / 100;
    if (!list.length){ haptic('rigid'); btn.animate([{ translate: '-5px 0' }, { translate: '5px 0' }, { translate: '0 0' }], { duration: 200, iterations: 2 }); return; }
    if (fee > S.balance){ notify({ type: 'err', icon: 'coin', title: $t("Не хватает на комиссию"), text: `${$t("Нужно {0} GRAM — пополни баланс", fmt(fee))}` }); return; }
    btn.disabled = true; btn.classList.add('wait'); btn.textContent = $t("Отправляем…");
    // выбранные карточки улетают вверх
    $('walletBody').querySelectorAll('.onft .cell.sel').forEach((c, i) => c.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-40px) scale(.8)' }], { duration: 380, delay: i * 60, easing: 'cubic-bezier(.5,0,.8,.5)', fill: 'forwards' }));
    await wait(520 + list.length * 60);
    btn.disabled = false; btn.classList.remove('wait');
    // NFT выводятся по одному: отдельный запрос, своя комиссия и свой нотиф на каждый
    INV = INV.filter(g => !outSel.has(g.id)); S.gifts = S.gifts.filter(g => !outSel.has(g.id)); outSel = new Set(); renderBet(); hideDrawer();
    for (let i = 0; i < list.length; i++){
      const g = list[i]; await wait(450);
      const res = await API.withdrawNft(g).catch(() => ({ ok: false, error: 'failed' }));
      if (res.error === 'relayer'){ INV.unshift(...list.slice(i)); haptic('rigid');   // релеер не получил сообщение — дальше не выводим, всё остаётся у игрока
        notify({ type: 'err', icon: 'err', ms: 6000, title: `${$t("Сначала напиши")} ${RELAYER}`, text: $t("Без сообщения релееру вывод не пройдёт. NFT остались у тебя, комиссия не списана"), action: { label: $t("Написать"), fn: () => tgOpen('https://t.me/' + RELAYER.slice(1)) } }); break; }
      if (!res.ok){ INV.unshift(g); haptic('rigid');                                  // этот не прошёл — вернулся в инвентарь
        notify({ type: 'err', key: 'out' + g.id, img: g.nft.src, ms: 5000, title: `${g.nft.name} #${g.num} ${$t("не выведен")}`, text: $t("NFT остался в инвентаре, комиссия не списана — попробуй ещё раз") }); continue; }
      const f = freeOuts() ? 0 : OUT_FEE; if (!f) useFreeOut();   // вывод без комиссии: премиум сезона или награда уровня
      S.hist.wallet.unshift({ type: 'nft', t: Date.now(), name: g.nft.name, num: g.num ?? g.nft.num, model: g.nft.model, img: g.nft.src, bg: [g.a, g.b], value: g.value, fee: f, method: f ? `${$t("в Telegram · комиссия {0} GRAM", f)}` : $t("в Telegram · без комиссии (премиум)"), status: $t("в пути") });
      if (f) setBalance(Math.round((S.balance - f) * 100) / 100);
      notify({ type: 'ok', key: 'out' + g.id, img: g.nft.src, title: `${g.nft.name} #${g.num} ${$t("отправлен")}`, text: f ? `${$t("Придёт в профиль Telegram · комиссия {0} GRAM", fmt(f))}` : $t("Придёт в профиль Telegram · без комиссии") });
    }
    checkAch();
  }
};
// тап по балансу — пополнение; долгое нажатие (0.8 с) — строка диагностики (сборка, экран, зум) для скриншота:
// она нужна, когда сцена уехала и до меню «Дебаг» не дотянуться
{ const bal = document.querySelector('.balance'); let lp = 0, fired = false;
  const stop = () => clearTimeout(lp);
  bal.addEventListener('pointerdown', () => { fired = false; stop(); lp = setTimeout(() => { fired = true; haptic('medium'); notify({ type: 'info', title: $t("Диагностика"), text: diagLine(), ms: 15000 }); }, 800); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => bal.addEventListener(t, stop));
  bal.addEventListener('contextmenu', e => e.preventDefault());
  bal.addEventListener('click', () => { if (fired){ fired = false; return; } openWallet('dep'); }); }

