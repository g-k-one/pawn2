/* =========================================================
   КЕЙСЫ: платные (Дуров, Сатоши) и бесплатные (Бист — за задания дня, Маск — за неделю)
   ========================================================= */
const CASES = [
  { id: 'durov', name: 'Кейс Павла Дурова', short: 'Павел Дуров', img: 'assets/chest-durov.webp', who: 'assets/who-durov.webp', c: '#30A5FF', price: 1, items: [
    { t: 'nft', rare: 1, ch: 1.48 }, { t: 'nft', ch: 5.69 }, { t: 'gram', v: 1.5, ch: 13.6 }, { t: 'gram', v: .7, ch: 27.2 }, { t: 'gram', v: .3, ch: 33.4 }, { t: 'xp', v: 25, ch: 18.63 }] },
  { id: 'satoshi', name: 'Кейс Сатоши Накамото', short: 'Сатоши', img: 'assets/chest-satoshi.webp', who: 'assets/who-satoshi.webp', c: '#FFB835', price: 2.5, items: [
    { t: 'nft', rare: 1, ch: 6.7 }, { t: 'nft', ch: 18.8 }, { t: 'gram', v: 25, ch: 2.28 }, { t: 'xp', v: 150, ch: 9.4 }, { t: 'xp', v: 100, ch: 23.1 }, { t: 'xp', v: 50, ch: 39.72 }] },
  { id: 'beast', name: 'Кейс Мистера Биста', short: 'Мистер Бист', img: 'assets/chest-beast.webp', who: 'assets/who-beast.webp', c: '#EB57B0', price: 0, need: 'daily', items: [
    { t: 'nft', ch: 1 }, { t: 'gram', v: .5, ch: 4 }, { t: 'gram', v: .1, ch: 25 }, { t: 'gram', v: .05, ch: 36 }, { t: 'xp', v: 50, ch: 9 }, { t: 'xp', v: 25, ch: 25 }] },
  { id: 'musk', name: 'Кейс Илона Маска', short: 'Илон Маск', img: 'assets/chest-musk.webp', who: 'assets/who-musk.webp', c: '#FF4C35', price: 0, need: 'weekly', items: [
    { t: 'nft', rare: 1, ch: .5 }, { t: 'nft', ch: 2.5 }, { t: 'gram', v: 1, ch: 25 }, { t: 'gram', v: .5, ch: 35 }, { t: 'xp', v: 250, ch: 12 }, { t: 'xp', v: 100, ch: 25 }] },
];
CASES.forEach(c => { c.items.reduce((from, it) => { it.from = from; it.to = Math.min(TICKETS - 1, from + Math.round(it.ch / 100 * TICKETS) - 1); return it.to + 1; }, 0); c.items[c.items.length - 1].to = TICKETS - 1; });
const caseById = id => CASES.find(c => c.id === id) || CASES[0];
const caseArt = (c, cls = '') => `<span class="cart ${cls}" style="--c:${c.c}"><img class="chest" src="${c.img}" alt=""><img class="who" src="${c.who}" alt=""></span>`;
const itemName = it => it.t === 'nft' ? (it.rare ? 'Редкий NFT' : 'Обычный NFT') : it.t === 'gram' ? `${fmt(it.v)} GRAM` : `+${it.v} XP`;
const itemColor = it => it.t === 'nft' ? (it.rare ? '#EB57B0' : '#00D9FF') : it.t === 'gram' ? '#30A5FF' : '#F57A37';
/* NFT в кейсах: редкий — случайный подарок с релеера ценой 11–14 GRAM, обычный — по флору (сейчас 3.5 GRAM). Выдаётся сразу */
const NFT_FLOOR = 3.5, RARE_FROM = 11, RARE_TO = 14;
const RARE_POOL = () => NFTS.filter(n => n.price >= RARE_FROM && n.price <= RARE_TO), FLOOR_POOL = () => NFTS.filter(n => n.price <= 5.5);
const itemImg = it => it.t === 'gram' ? 'assets/hero-gem.webp' : it.t === 'nft' ? (it.rare ? RARE_POOL()[0].src : FLOOR_POOL()[0].src) : 'assets/xp.webp';
function caseNft(it){
  // из запаса кейсов (×N) — NFT подороже: до цены обычного выигрыша × N
  const m = it.mult || 1, pool = m > 1 ? NFTS.filter(n => n.price <= (it.rare ? RARE_TO : NFT_FLOOR) * m).slice(-8) : it.rare ? RARE_POOL() : FLOOR_POOL(), n = pick(pool), bg = n.bg;
  return { id: 'c' + Date.now(), num: n.num, nft: n, a: bg[0], b: bg[1], p: bg[2], value: it.rare || m > 1 ? n.price : NFT_FLOOR }; }
const glowOf = c => [c, hexMix(c, '#000000', .3), hexMix(c, '#ffffff', .35), '#ffffff'];
const GIFT_Q = '';
function tileHTML(it, foot, g){
  const pool = it.rare ? RARE_POOL() : FLOOR_POOL();
  const img = it.t === 'nft' ? `<img class="tnft" data-pool="${it.rare ? 'rare' : 'floor'}" src="${g ? g.nft.src : pick(pool).src}" alt="">` : `<img src="${itemImg(it)}" alt="">`;
  return `<div class="ct${it.rare ? ' hi' : ''}${it.t === 'nft' ? ' isnft' : ''}${g ? ' fixed' : ''}" style="--c:${itemColor(it)}"><b>${it.t === 'nft' ? (it.rare ? 'Редкий' : 'Обычный') : itemName(it)}</b>${img}<small>${foot}</small>${it.rare ? '<span class="shine"></span>' : ''}</div>`;
}
// картинка NFT на плитках сама перелистывается — видно, что подарок будет случайный из диапазона
setInterval(() => {
  if (document.hidden || S.lite) return;
  document.querySelectorAll('.ct.isnft:not(.fixed) .tnft').forEach((im, i) => {
    if (!im.offsetParent || Math.random() < .4) return;
    const pool = im.dataset.pool === 'rare' ? RARE_POOL() : FLOOR_POOL(), cur = im.getAttribute('src'), next = pool.filter(n => n.src !== cur);
    if (!next.length) return;
    im.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.85)' }], { duration: 180, delay: i * 40, fill: 'forwards' }).onfinish = () => {
      im.src = pick(next).src; im.getAnimations().forEach(x => x.cancel()); im.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.3,1.4,.5,1)' }); };
  });
}, 1500);

