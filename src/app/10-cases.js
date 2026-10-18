/* =========================================================
   КЕЙСЫ: платные (Дуров, Сатоши) и бесплатные (Бист — за задания дня, Маск — за неделю)
   ========================================================= */
const CASES = [
  { id: 'durov', name: $t("Кейс Павла Дурова"), short: $t("Павел Дуров"), img: 'assets/chest-durov.webp', who: 'assets/who-durov.webp', c: '#30A5FF', price: 1, items: [
    { t: 'nft', rare: 1, ch: 1.48 }, { t: 'nft', ch: 5.69 }, { t: 'gram', v: 1.5, ch: 13.6 }, { t: 'gram', v: .7, ch: 27.2 }, { t: 'gram', v: .3, ch: 33.4 }, { t: 'xp', v: 25, ch: 18.63 }] },
  { id: 'satoshi', name: $t("Кейс Сатоши Накамото"), short: $t("Сатоши"), img: 'assets/chest-satoshi.webp', who: 'assets/who-satoshi.webp', c: '#FFB835', price: 2.5, items: [
    { t: 'nft', rare: 1, ch: 6.7 }, { t: 'nft', ch: 18.8 }, { t: 'gram', v: 25, ch: 2.28 }, { t: 'xp', v: 150, ch: 9.4 }, { t: 'xp', v: 100, ch: 23.1 }, { t: 'xp', v: 50, ch: 39.72 }] },
  { id: 'beast', name: $t("Кейс Мистера Биста"), short: $t("Мистер Бист"), img: 'assets/chest-beast.webp', who: 'assets/who-beast.webp', c: '#EB57B0', price: 0, need: 'daily', items: [
    { t: 'nft', rare: 1, ch: .05 }, { t: 'nft', ch: .95 }, { t: 'gram', v: .75, ch: 8 }, { t: 'gram', v: .25, ch: 14 }, { t: 'gram', v: .1, ch: 26 }, { t: 'gram', v: .05, ch: 28 },
    { t: 'xp', v: 100, ch: 4 }, { t: 'xp', v: 50, ch: 9 }, { t: 'xp', v: 25, ch: 10 }] },
  { id: 'musk', name: $t("Кейс Илона Маска"), short: $t("Илон Маск"), img: 'assets/chest-musk.webp', who: 'assets/who-musk.webp', c: '#FF4C35', price: 0, need: 'weekly', items: [
    { t: 'nft', rare: 1, ch: 1 }, { t: 'nft', ch: 8 }, { t: 'gram', v: 2, ch: 13 }, { t: 'gram', v: 1, ch: 24 }, { t: 'gram', v: .5, ch: 24 }, { t: 'gram', v: .3, ch: 19 },
    { t: 'xp', v: 750, ch: 2 }, { t: 'xp', v: 300, ch: 4 }, { t: 'xp', v: 150, ch: 5 }] },
];
CASES.forEach(c => { c.items.reduce((from, it) => { it.from = from; it.to = Math.min(TICKETS - 1, from + Math.round(it.ch / 100 * TICKETS) - 1); return it.to + 1; }, 0); c.items[c.items.length - 1].to = TICKETS - 1; });
const caseById = id => CASES.find(c => c.id === id) || CASES[0];
const caseArt = (c, cls = '') => `<span class="cart ${cls}" style="--c:${c.c}"><img class="chest" src="${c.img}" alt=""><img class="who" src="${c.who}" alt=""></span>`;
const itemName = it => it.t === 'nft' ? (it.rare ? $t("Редкий NFT") : $t("Обычный NFT")) : it.t === 'gram' ? `${fmt(it.v)} GRAM` : `+${it.v} XP`;
const itemColor = it => it.t === 'nft' ? (it.rare ? '#EB57B0' : '#00D9FF') : it.t === 'gram' ? '#30A5FF' : '#F57A37';
/* NFT в кейсах: редкий — случайный подарок с релеера ценой 11–14 GRAM, обычный — по флору (сейчас 3.5 GRAM). Выдаётся сразу */
const NFT_FLOOR = NFT_FROM, RARE_FROM = 11, RARE_TO = 14;   // флор — самый дешёвый подарок на релеере
const RARE_POOL = () => NFTS.filter(n => n.price >= RARE_FROM && n.price <= RARE_TO), FLOOR_POOL = () => NFTS.filter(n => n.price <= 5.5);
const itemImg = it => it.t === 'gram' ? 'assets/hero-gem.webp' : it.t === 'nft' ? (it.rare ? RARE_POOL()[0].src : FLOOR_POOL()[0].src) : 'assets/xp.webp';
function caseNft(it){
  // из запаса кейсов (×N) — NFT подороже: до цены обычного выигрыша × N
  const m = it.mult || 1, pool = m > 1 ? NFTS.filter(n => n.price <= (it.rare ? RARE_TO : NFT_FLOOR) * m).slice(-8) : it.rare ? RARE_POOL() : FLOOR_POOL(), n = pick(pool), bg = n.bg;
  return { id: 'c' + Date.now(), num: n.num, nft: n, a: bg[0], b: bg[1], p: bg[2], value: it.rare || m > 1 ? n.price : NFT_FLOOR }; }
const glowOf = c => [c, hexMix(c, '#000000', .15), hexMix(c, '#ffffff', .1), c];   // насыщенно: без белых провалов в палитре рамки   // насыщенно: без белых провалов в палитре рамки
const GIFT_Q = '';
function tileHTML(it, foot, g){
  const pool = it.rare ? RARE_POOL() : FLOOR_POOL();
  const img = it.t === 'nft' ? `<img class="tnft" data-pool="${it.rare ? 'rare' : 'floor'}" src="${g ? g.nft.src : pick(pool).src}" alt="">` : `<img src="${itemImg(it)}" alt="">`;
  return `<div class="ct${it.rare ? ' hi' : ''} is${it.t}${g ? ' fixed' : ''}" style="--c:${itemColor(it)}"><b>${it.t === 'nft' ? (it.rare ? $t("Редкий") : $t("Обычный")) : itemName(it)}</b>${img}<small>${foot}</small>${it.rare ? '<span class="shine"></span>' : ''}</div>`;
}
// картинка NFT на плитках сама перелистывается — видно, что подарок будет случайный из диапазона
setInterval(() => {
  if (document.hidden || S.lite) return;
  document.querySelectorAll('.tgrid .ct.isnft:not(.fixed) .tnft').forEach((im, i) => {   // только в «Что внутри»: в ленте прокрутки картинки не меняются
    if (!im.offsetParent || Math.random() < .4) return;
    const pool = im.dataset.pool === 'rare' ? RARE_POOL() : FLOOR_POOL(), cur = im.getAttribute('src'), next = pool.filter(n => n.src !== cur);
    if (!next.length) return;
    im.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.85)' }], { duration: 180, delay: i * 40, fill: 'forwards' }).onfinish = () => {
      im.src = pick(next).src; im.getAnimations().forEach(x => x.cancel()); im.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.3,1.4,.5,1)' }); };
  });
}, 1500);

