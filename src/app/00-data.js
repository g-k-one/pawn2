/* =========================================================
   ДАННЫЕ
   ========================================================= */
/* =========================================================
   ЯЗЫК: $t('русский шаблон {0}', значение) → строка на выбранном языке.
   Словарь src/i18n/en.json вшивается при сборке; нет перевода — остаётся русский. Смена языка — перезапуск
   ========================================================= */
const LANG = (() => { try { return localStorage.getItem('bm-lang') === 'en' ? 'en' : 'ru'; } catch(_){ return 'ru'; } })();
const EN = __I18N_EN__;
const LOC = LANG === 'en' ? 'en-US' : 'ru-RU';                // числа и даты — по языку
// множественное число: $n("задание|задания|заданий", n) — формы по-русски (1, 2–4, 5+); в en.json — "task|tasks"
const PLURAL = new Intl.PluralRules(LOC);
function $n(forms, n){ const f = $t(forms).split('|'), c = PLURAL.select(n); return f[LANG === 'en' ? (c === 'one' ? 0 : 1) : c === 'one' ? 0 : c === 'few' ? 1 : 2] || f[f.length - 1]; }
function $t(s, ...a){ const r = LANG === 'en' && EN[s] || s; return a.length ? r.replace(/\{(\d+)\}/g, (m, i) => a[i] ?? '') : r; }
document.documentElement.lang = LANG;
// Статика из index.html: data-t — первый текстовый узел, aria-label — как есть
if (LANG === 'en'){
  for (const el of document.querySelectorAll('[data-t]')){ const n = [...el.childNodes].find(n => n.nodeType === 3 && n.data.trim()); if (n) n.data = n.data.replace(n.data.trim(), $t(n.data.trim())); }
  for (const el of document.querySelectorAll('[aria-label]')) el.setAttribute('aria-label', $t(el.getAttribute('aria-label')));
}
const TIERS = [
  { name: $t("База"), key: 'base', zone: 'base', c: '#ffb835', a: '#ffbd4a', b: '#c06a00', chance: 56.563, min: .4,  max: .8,  glow: ['#ffb835', '#ff8a1e', '#d6d33a', '#ffe08a'] },
  { name: $t("Удача"), key: 'luck', zone: 'luck', c: '#12d53d', a: '#4cff30', b: '#00a07a', chance: 27,     min: .8,  max: 1.2, glow: ['#12d53d', '#11b89a', '#9cc23a', '#4fe39a'] },
  { name: $t("Мега"), key: 'mega_low', zone: 'mega', c: '#00d9ff', a: '#2bd8ff', b: '#4a6bff', chance: 12.99,  min: 1.5, max: 2,   glow: ['#00d9ff', '#2f7bff', '#16d3b0', '#8ff0ff'] },
  { name: $t("Ультра"), key: 'mega_high', zone: 'mega', c: '#eb57b0', a: '#ff6ae0', b: '#c9306e', chance: 3.247,  min: 2,   max: 3.5, glow: ['#eb57b0', '#a24bff', '#ff4f7a', '#ff9ad8'] },
  { name: $t("Джекпот"), key: 'jackpot', zone: 'jackpot', c: '#ff4c35', a: '#ff4c4c', b: '#a0103e', chance: 0.2,    min: 10,  max: 14,  glow: ['#ff4c35', '#ff9a1e', '#e5246b', '#ffb08a'] },
];
/* гифты, которые можно положить в крафт (заглушки из макета): добавляются по одному кнопкой «+», убираются тапом по карточке */
const MAX_GIFTS = 2;
/* PF-система: тикет 0…99 999, тир определяется диапазоном (накопленные шансы):
   База 0–56 562 · Удача 56 563–83 562 · Мега 83 563–96 552 · Ультра 96 553–99 799 · Джекпот 99 800–99 999 (в сумме 100%) */
const TICKETS = 100000;
TIERS.reduce((from, t) => { t.from = from; t.to = from + Math.round(t.chance / 100 * TICKETS) - 1; return t.to + 1; }, 0);
// джекпот — всегда верхние тикеты (99 800–99 999); Ультра заканчивается прямо под ним
const JP = TIERS[TIERS.length - 1], JN = JP.to - JP.from + 1; JP.to = TICKETS - 1; JP.from = TICKETS - JN;
TIERS[TIERS.length - 2].to = JP.from - 1;
/* правила крафта в формате pawn-pf-v1 — тот же снимок, что отдаёт бэкенд (mega_low и mega_high — обе в зоне mega) */
const RTP_PPM = '949996';
const CRAFT_RULES = { version: 'pawn-pf-v1', target_rtp_ppm: RTP_PPM, base_rtp_ppm: RTP_PPM, multiplier_scale: '1000000',
  segments: TIERS.map(t => ({ key: t.key, zone: t.zone, start: t.from, end: t.to, min_multiplier_ppm: Math.round(t.min * 1e6), max_multiplier_ppm: Math.round(t.max * 1e6) })) };
/* множитель в ppm: линейно внутри сегмента, целочисленно — как в fair-verify.js */
function craftPpm(rules, roll){
  const sg = rules.segments.find(x => roll >= x.start && roll <= x.end), min = BigInt(sg.min_multiplier_ppm), max = BigInt(sg.max_multiplier_ppm), w = BigInt(sg.end - sg.start);
  const base = min + (w ? (max - min) * BigInt(roll - sg.start) / w : 0n), t = BigInt(rules.target_rtp_ppm), ref = BigInt(rules.base_rtp_ppm);
  return t === ref ? base : (base * t + ref / 2n) / ref;
}
const tierOfTicket = n => Math.max(0, TIERS.findIndex(t => n >= t.from && n <= t.to));
const AUTO_MS = 5000;

const S = { tier: 1, ton: 0, gifts: [], balance: 345.56, busy: false };
/* сохранённый прогресс прототипа (мок «базы» в localStorage, см. 17-api.js). Есть — стартовые заглушки истории не генерируются */
const SAVE_KEY = 'pawn-state-v1';
const SAVE = (() => { try { const v = JSON.parse(localStorage.getItem(SAVE_KEY)); return v && v.v === 1 ? v : null; } catch(_){ return null; } })();
const RELAY = __RELAY__;
/* NFT с релеера @pawngift: модель, фон (центр, край, узор), символ, средняя цена. Картинки — с cdn.changes.tg,
   если они не загрузились (нет сети) — подставляется локальная заглушка */
const LOCAL_NFT = ['bronze-cane', 'candy-cane', 'jelly-bunny', 'honey-bee', 'bday', 'smile-eggs', 'cat-ring', 'magic-ball', 'cat-globe', 'butterfly-egg', 'cheshire', 'genesis', 'agent'];
const FB = {};
const hashStr = t => [...t].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
// картинки моделей и символов скачаны с changes.tg и лежат в assets/g (модели 220px, символы 72px)
// с CDN: src — 128 px (лента, кейсы, история), card — 256 px (карточки), символ узора — 64 px; не загрузилось — локальная заглушка
const HI_PACKS = 20;                                          // запасные чёткие картинки разложены по стольким файлам
// свой CDN Pawn: модели 128/256/512 (узоры не отдаёт — их берём с api.changes.tg)
const mediaImg = (gift, model, size) => `https://pawn-backend.onrender.com/api/media/gift?path=${encodeURIComponent(`/gifts/models/${encodeURIComponent(gift.replace(/’/g, "'"))}/png/${encodeURIComponent(model.replace(/’/g, "'"))}.png`)}&size=${size}`;
const apiImg = (kind, gift, name, size) => `https://api.changes.tg/${kind}/${encodeURIComponent(gift.replace(/’/g, "'"))}/${encodeURIComponent(name.replace(/’/g, "'"))}.png?size=${size}`;
/* порог выплаты NFT = самый дешёвый подарок на релеере: выигрыш от этой суммы приходит подарком, меньше — GRAM.
   В бою каталог и цены отдаёт сервер — порог пересчитается сам */
let NFT_FROM = 0;
const NFTS = RELAY.g.map(([ci, num, model, bi, sym, price, mf, sf]) => {
  const name = RELAY.c[ci], bd = RELAY.b[bi], local = `assets/nft/${LOCAL_NFT[hashStr(name) % LOCAL_NFT.length]}.webp`;
  let src, card, symSrc;
  if (CDN){ src = mediaImg(name, model, 128); card = mediaImg(name, model, 256); symSrc = apiImg('symbol', name, sym, 64); FB[src] = FB[card] = local; }
  else { src = card = mf && GIMG[mf] ? GIMG[mf] : local; symSrc = sf && GSYM[sf] ? GSYM[sf] : ''; }
  return { name, num, model, backdrop: bd[0], bg: [bd[1], bd[2], bd[3]], symbol: sym, sym: symSrc, price, src, card, mf, pack: ci % HI_PACKS };
});
NFT_FROM = Math.min(...NFTS.map(n => n.price));
/* крупные картинки (приз на главной, экран дропа, супер дроп) — чёткие с CDN changes.tg.
   Сначала показываем лёгкую 220 px, чёткую подменяем, когда она загрузилась и раскодировалась; не загрузилась — остаётся 220 px */
const HI_FMT = 'png', HI = {};   // PNG 1024: раскодируется за ~0.2 с вне главного потока; SVG того же качества — 1–2 с и рывки до 50 мс
const hiSrc = n => `https://cdn.changes.tg/gifts/models/${encodeURIComponent(n.name.replace(/’/g, "'"))}/${HI_FMT}/${encodeURIComponent(n.model.replace(/’/g, "'"))}.${HI_FMT}`;
function upgradeImg(img, n, gl){
  if (!img || !n?.model) return;
  const swap = u => { if (!u) return; const im = new Image(); im.src = u;
    return im.decode().then(() => { if (img.isConnected){ img.src = u; gl?.style.setProperty('--m', `url('${u}')`); } }); };
  if (!CDN) return void packImg(n).then(swap).catch(() => {});  // CDN закрыт (artifact) — берём 768 px из своих пачек
  const u = hiSrc(n); if (HI[u] === 0) return;
  swap(u).then(() => { HI[u] = 1; }, () => { HI[u] = 0; });
}
/* запасные чёткие картинки: 768 px webp, разложены по коллекциям в HI_PACKS файлов — грузится только пачка нужного приза */
const PACK = {};
function packImg(n){
  PACK[n.pack] ||= fetch(`assets/g/hi/p${n.pack}.json`).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  return PACK[n.pack].then(m => { const v = m[n.mf]; if (!v || v.startsWith('blob:')) return v || null;
    const bin = atob(v), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return m[n.mf] = URL.createObjectURL(new Blob([u8], { type: 'image/webp' })); });
}
document.addEventListener('error', e => { const t = e.target; if (t.tagName === 'IMG' && FB[t.getAttribute('src')]) t.src = FB[t.getAttribute('src')]; }, true);
/* узор карточки — символ коллекции кольцами вокруг центра; пока символ не загрузился (или без сети) — звёздочки */
const SYM_RINGS = [[27, 8, 10], [39, 12, 8], [51, 16, 6.5]];
const SYM_LAYERS = SYM_RINGS.flatMap(([R, n, sz], ri) => Array.from({ length: n }, (_, k) => { const a = (k + (ri % 2) * .5) / n * Math.PI * 2; return [50 + Math.cos(a) * R, 50 + Math.sin(a) * R, sz]; }));
document.documentElement.style.setProperty('--sympos', SYM_LAYERS.map(([x, y, sz]) => `${((x - sz / 2) / (100 - sz) * 100).toFixed(2)}% ${((y - sz / 2) / (100 - sz) * 100).toFixed(2)}%`).join(','));
document.documentElement.style.setProperty('--symsize', SYM_LAYERS.map(([, , sz]) => `${sz}% ${sz}%`).join(','));
const symImg = u => SYM_LAYERS.map(() => `url("${u}")`).join(',');
const SYM_OK = new Set(), SYM_TRY = new Set();
function symLoad(u){
  if (SYM_TRY.has(u)) return; SYM_TRY.add(u);
  const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => { SYM_OK.add(u); document.querySelectorAll('.nc-pat[data-sym]').forEach(el => { if (el.dataset.sym === u){ el.classList.add('sym'); el.style.setProperty('--symimg', symImg(u)); } }); };
  im.src = u;
}
const giftOf = (n, extra = {}) => ({ id: 'g' + Math.random().toString(36).slice(2, 9), num: n.num, nft: n, a: n.bg[0], b: n.bg[1], p: n.bg[2], value: n.price, skin: n.model, ...extra });
/* фоны карточек: центр → край (как в макете) */
/* фон карточки: центр, край градиента и цвет узора */
const CARD_BG = [['#e36692', '#c9497c', '#ffd1e3'], ['#5aa9ff', '#2f6fd6', '#cfe6ff'], ['#12D53D', '#1f9a5c', '#d4ffe6'], ['#ffc35a', '#d98a1f', '#fff0c2'],
  ['#AE3FC4', '#6a3ad6', '#e6d6ff'], ['#3fd6d0', '#1a8f9a', '#d0fffb'], ['#ff7a6b', '#c9352c', '#ffe0db']];
/* узор: звёздочки и точки, одна плитка-маска; цвет задаётся --p */
/* узор как у коллекционных подарков Telegram: символы кольцами вокруг центра, к краю мельче и прозрачнее */
(() => {
  const star = (x, y, r, o) => `<path opacity="${o}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${r.toFixed(2)})" d="M0-1l.28.72L1 0 .28.28 0 1-.28.28-1 0-.28-.28z"/>`;
  let p = '';
  [[24, 7, 4.4, .9], [33, 11, 3.7, .75], [42, 15, 3.1, .6], [51, 19, 2.6, .45], [60, 23, 2.2, .3]].forEach(([R, n, sz, o], ri) => {
    for (let k = 0; k < n; k++){ const a = (k + (ri % 2) * .5) / n * Math.PI * 2; p += star(50 + Math.cos(a) * R, 50 + Math.sin(a) * R, sz, o); }
  });
  document.documentElement.style.setProperty('--pat', `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${p}</svg>`)}")`);
})();
const pick = a => a[Math.random() * a.length | 0];
/* инвентарь для прототипа: случайные NFT, фон и цена */
let INV = Array.from({ length: 9 }, (_, i) => giftOf(pick(NFTS.filter(x => x.price <= 30)), { id: 'g' + i }));
/* картинки ленты по тирам: GRAM-гем у низких, NFT подороже у высоких */
const LIVE_IMG = TIERS.map((_, i) => i < 2 ? ['assets/hero-gem.webp'] : i === 2 ? ['assets/hero-gem.webp', ...NFTS.slice(0, 4).map(n => n.src)] : i === 3 ? NFTS.slice(3, 10).map(n => n.src) : NFTS.slice(9).map(n => n.src));
const $ = id => document.getElementById(id);
const fmt = v => (Math.round(v * 100) / 100).toString();
// «GRAM» после числа — мельче самого числа, одинаково во всех суммах: `${fmt(v)}${GU}`
const GU = '<i class="u">GRAM</i>';
const SUPPORT = 'https://t.me/m2gdev';                          // чат поддержки
const AMBASSADORS = 'https://t.me/+havEPmstLkpjMzVi';            // программа для амбассадоров
function tgOpen(url){
  try { Telegram.WebApp.openTelegramLink(url); return true; } catch(_){}           // SDK есть только на верхнем уровне мини-аппа
  try { return !!window.open(url, '_blank'); } catch(_){ return false; }
}
const haptic = (t = 'light') => { if (S.vibro === false) return; try { Telegram.WebApp.HapticFeedback.impactOccurred(t); } catch(_){ navigator.vibrate?.(8); } };

/* ---------- масштаб сцены ---------- */
const stage = $('stage');
/* фуллскрин: ширина макета = ширина экрана. Высота сцены подстраивается под экран;
   если экран совсем короткий (меньше 790 «макетных» px), уменьшаем масштаб, чтобы всё влезло */
/* адаптив по ширине: масштаб берём от ширины, но не больше 1.15 — на широких экранах
   макет не раздувается, а растягивается: фон, панель, лента и нижняя панель — на всю ширину, центр — по центру */
let K = 1, SW = 390, fitW = 0, fitH = 0;
function fit(){
  // после обновления страницы (всё из кэша) Telegram на iPhone успевает отдать нулевой размер окна:
  // из него получались бесконечные ширина и сдвиг, браузер их отбрасывал, и сцена оставалась прижатой к центру экрана.
  // Нулевой или явно недоустановившийся размер пропускаем — пересчитаем, когда придёт настоящий (см. recheck ниже)
  const vw = innerWidth || document.documentElement.clientWidth, vh = innerHeight || document.documentElement.clientHeight;
  if (vw < 200 || vh < 300) return;
  fitW = vw; fitH = vh;
  let k = Math.min(vw / 390, 1.15), H = vh / k;
  if (H < 790){ k = vh / 790; H = 790; }
  if (vw / k < 390){ k = vw / 390; H = vh / k; }   // никогда не обрезаем по бокам
  K = k; SW = Math.max(390, vw / k);
  stage.style.width = SW + 'px'; stage.style.marginLeft = -SW / 2 + 'px';   // центр сцены всегда по центру экрана, даже когда она шире него
  stage.style.height = H + 'px';
  stage.style.transform = `scale(${k})`;
  // баланс: в макете 43 px сверху; на коротких экранах поджимается вместе с зазором
  // верх контента в Telegram fullscreen: статус-бар + кнопки Telegram
  let tgTop = 0, tgRow = 0; try { const tg = Telegram.WebApp; if (tg.isFullscreen){ const st = tg.safeAreaInset?.top || 0, ct = tg.contentSafeAreaInset?.top || 0; tgTop = st + ct; if (ct) tgRow = st + ct / 2; } } catch(_){}
  stage.style.setProperty('--tgTop', tgTop / k + 'px');
  // строка кнопок Telegram (Close/Back и ⌄•••): её центр — для заголовков экранов вроде арены; класс — чтобы прятать свои «Назад»
  stage.style.setProperty('--tgRow', tgRow / k + 'px'); document.body.classList.toggle('tgfull', !!tgRow);
  // уведомления — на уровне ленты «лайв»: выше их перекрывают кнопки и шапка Telegram
  stage.style.setProperty('--noteTop', Math.max(tgTop / k + 8, H - 844 + 106) + 'px');
  // Telegram fullscreen: баланс — точно по центру строки с кнопками Telegram («Close» и «⌄ •••»), под статус-баром и островом.
  // Вне Telegram (браузер): +16 px на высоких экранах от выреза/острова, на коротких (SE) прибавка плавно уходит, чтобы не наехать на ленту
  const island = Math.max(0, 16 - Math.max(0, 844 - H)), bh = document.querySelector('.balance')?.offsetHeight || 40;
  stage.style.setProperty('--balTop', (tgRow ? tgRow / k - bh / 2
    : H >= 844 ? 43 + island + Math.min(40, (H - 844) * .35) : 43 + island - (844 - H) * .75) + 'px');
}
try { const tg = Telegram.WebApp; tg.ready(); tg.expand(); tg.disableVerticalSwipes?.(); tg.setHeaderColor?.('#0b0b0b'); tg.setBackgroundColor?.('#0b0b0b');
  ['safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged', 'viewportChanged'].forEach(ev => tg.onEvent(ev, () => fit())); } catch(_){}
fit(); addEventListener('resize', fit);
// после обновления страницы браузер может вернуть прошлую прокрутку окна — у нас её быть не должно
try { history.scrollRestoration = 'manual'; } catch(_){}
scrollTo(0, 0);
// iPhone/Telegram после «••• → Reload Page» может вернуть прошлое увеличение и сдвиг страницы — сцена тогда крупнее и уезжает вправо.
// Масштаб у нас всегда 1: если он не 1 или страница сдвинута — переставляем viewport (iOS от этого сбрасывает зум) и прокрутку
const vpMeta = document.querySelector('meta[name=viewport]'), VP = vpMeta?.content || '';
let unzoomT = 0;
function unzoom(){
  if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;   // открыта клавиатура — сдвиг законный, не мешаем
  const v = window.visualViewport, zoomed = v && (Math.abs(v.scale - 1) > .01 || Math.abs(v.offsetLeft) > .5);
  if (!zoomed && !scrollX && !scrollY) return;
  if (zoomed && vpMeta && performance.now() - unzoomT > 500){ unzoomT = performance.now(); vpMeta.content = VP.replace('initial-scale=1', 'initial-scale=1.001'); requestAnimationFrame(() => { vpMeta.content = VP; }); }
  scrollTo(0, 0);
}
window.visualViewport?.addEventListener('scroll', unzoom); window.visualViewport?.addEventListener('resize', unzoom);
// диагностика для скриншота: версия сборки (видно, свежая или из кэша Telegram), размер окна, как посчиталась сцена, зум и сдвиг
const diagLine = () => { const v = window.visualViewport;
  return `${$t("Сборка")} __BUILD__ · ${innerWidth}×${innerHeight} · K ${K.toFixed(3)} · ${$t("сцена")} ${Math.round(SW)}` +
    (v ? ` · zoom ${v.scale.toFixed(2)} · ${Math.round(v.offsetLeft)},${Math.round(v.offsetTop)}` : '') + ` · scroll ${Math.round(scrollX)},${Math.round(scrollY)}`; };
// iPhone/Telegram: на старте WebView иногда отдаёт размер окна до того, как он устоялся, и resize потом не приходит —
// сцена остаётся посчитанной под чужую ширину и уезжает вбок. Поэтому следим за размером сами и пересчитываем,
// когда он реально поменялся (через resize — чтобы подстроились и все, кто его слушает)
// Сравниваем с размером, под который сцена посчитана в последний раз (fitW/fitH), — так ловится и случай,
// когда первый расчёт был пропущен из-за нулевого размера. Первые 3 с проверяем каждый кадр: на старте размер скачет
{ const recheck = () => { unzoom(); const vw = innerWidth || document.documentElement.clientWidth, vh = innerHeight || document.documentElement.clientHeight;
    if (vw === fitW && vh === fitH) return; fit(); if (fitW === vw && fitH === vh) dispatchEvent(new Event('resize')); };
  try { new ResizeObserver(recheck).observe(document.documentElement); } catch(_){}
  window.visualViewport?.addEventListener('resize', recheck);
  addEventListener('load', recheck); addEventListener('pageshow', recheck); addEventListener('orientationchange', () => setTimeout(recheck, 300));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recheck(); });
  const t0 = performance.now(); (function watch(){ recheck(); if (performance.now() - t0 < 3000) requestAnimationFrame(watch); })();
  [3500, 6000].forEach(t => setTimeout(recheck, t)); }
stage.addEventListener('scroll', () => { stage.scrollTop = 0; stage.scrollLeft = 0; });
// Сторож: сцена должна стоять по центру видимой области. Если уехала (бывает на iPhone после «Reload Page») —
// пересчитываем; если и это не помогло — показываем плашку с цифрами вне сцены (до баланса тогда не дотянуться)
{ let box = null, bad = 0;
  const geo = () => { const s = stage.getBoundingClientRect(), v = window.visualViewport, de = document.documentElement;
    const vw = v ? v.width : de.clientWidth, cx = (s.left + s.right) / 2, want = (v ? v.offsetLeft : 0) + vw / 2;
    return { off: cx - want, txt: `${diagLine()} · stage ${Math.round(s.left)}..${Math.round(s.right)} · client ${de.clientWidth}×${de.clientHeight} · vv ${v ? Math.round(v.width) + '×' + Math.round(v.height) : '-'} · screen ${screen.width}×${screen.height} · dpr ${devicePixelRatio} · body ${document.body.offsetWidth}` }; };
  const check = () => {
    let g = geo(); if (Math.abs(g.off) <= 4){ bad = 0; box?.remove(); box = null; return; }
    unzoom(); fit(); dispatchEvent(new Event('resize'));                     // попытка починить
    g = geo(); if (Math.abs(g.off) <= 4){ bad = 0; return; }
    if (++bad < 2) return;                                                  // два раза подряд — значит, не мимолётное
    if (!box){ box = document.createElement('div'); box.style.cssText = 'position:fixed;left:8px;top:110px;z-index:9999;max-width:260px;padding:10px 12px;border-radius:14px;background:#ff4c35;color:#fff;font:600 13px/1.35 system-ui,sans-serif;white-space:normal;word-break:break-word';
      document.body.appendChild(box); }
    box.textContent = `${$t("Диагностика")} · ${$t("сдвиг")} ${Math.round(g.off)} · ${g.txt}`;
  };
  const start = () => [600, 1500, 3000, 5000, 8000].forEach(t => setTimeout(check, t));
  document.readyState === 'complete' ? start() : addEventListener('load', start);   // приложение может стартовать и после load (загрузчик)
  addEventListener('resize', () => setTimeout(check, 300)); }

