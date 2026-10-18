/* =========================================================
   СУПЕР ДРОП: кто первым выбьет загаданный тикет, забирает NFT. Учитываются крафты от 0.5 GRAM
   ========================================================= */
const SUPER = { target: 11111, min: .5, nft: null, last: [['whale77', 'Cat Globe', $t("2 д назад")], ['kira.ton', 'Butterfly Egg', $t("5 д назад")]] };
function newSuper(first){
  const n = first ? NFTS[NFTS.length - 1] : pick(NFTS.slice(-6, -1)), bg = n.bg;
  SUPER.nft = { id: 'sd' + Date.now(), num: n.num, nft: n, a: bg[0], b: bg[1], p: bg[2], value: n.price, skin: n.model };
  if (!first) SUPER.target = Math.random() * TICKETS | 0;
}
newSuper(true);
const superDigits = () => String(SUPER.target).padStart(5, '0').split('').map(d => `<b>${d}</b>`).join('');

