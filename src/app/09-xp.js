/* =========================================================
   ОПЫТ И ЗВАНИЯ: 1 XP за каждые 2 GRAM оборота + XP из кейсов, заданий и достижений. Топ не сбрасывается
   ========================================================= */
const PAL = ['#12D53D', '#FFB835', '#00D9FF', '#30A5FF', '#AE3FC4', '#EB57B0', '#FF4C35', '#F57A37'];
const avc = n => PAL[[...n].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PAL.length];
const RANKS = [[$t("Новичок"), 0], [$t("Подмастерье"), 300], [$t("Лудоволк"), 1000], [$t("Лудик"), 2600], [$t("Барон"), 3300], [$t("Криптобарон"), 9000], [$t("ПАВНЕД"), 22000]];
const rankOf = xp => RANKS.reduce((a, r, i) => xp >= r[1] ? i : a, 0);
const xpFmt = v => Math.floor(v).toLocaleString(LOC);
const XPI = '<img class="xpimg" src="assets/xp.webp" alt="XP">';
function addXp(v){
  const was = rankOf(S.xp); S.xp = Math.round((S.xp + v) * 10) / 10; const now = rankOf(S.xp);
  if (now > was) setTimeout(() => { notify({ type: 'ok', img: 'assets/xp.webp', color: '#F57A37', title: `${$t("Новое звание:")} ${RANKS[now][0]}`, text: `${xpFmt(S.xp)} XP` }); Sfx.rank(Math.min(4, now - 1)); }, 1800);
}
// XP за оборот (крафт, арена, ставки): 0.5 XP за 1 GRAM. В истории (Финансы → Кошелёк) — одна строка за день по Москве: оборот и XP, растёт за день
const xpDay = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
function xpTurn(gram){
  if (!(gram > 0)) return; addXp(gram * .5);
  const d = xpDay(), L = S.hist.wallet, i = L.findIndex(w => w.type === 'xp' && w.day === d), e = i >= 0 ? L.splice(i, 1)[0] : { type: 'xp', day: d, turn: 0, xp: 0 };
  e.turn = Math.round((e.turn + gram) * 100) / 100; e.xp = Math.round((e.xp + gram * .5) * 100) / 100; e.t = Date.now(); L.unshift(e);
}
function rankBar(xp){
  const i = rankOf(xp), nx = RANKS[i + 1], k = nx ? (xp - RANKS[i][1]) / (nx[1] - RANKS[i][1]) : 1;
  return `<div class="rkbar" data-go="top">${XPI}<div><span><b>${RANKS[i][0]}</b>${nx ? `${xpFmt(xp)} / ${xpFmt(nx[1])} XP` : `${xpFmt(xp)} ${$t("XP · максимум")}`}</span><i><b style="width:${(k * 100).toFixed(1)}%"></b></i>${nx ? `<small>${$t("до звания «{0}»", nx[0])}</small>` : ''}</div></div>`;
}
const rewHTML = rw => rw.g != null ? `+<i class="gm"></i>${rw.g}` : `${XPI}+${rw.xp}`;
const rewText = rw => rw.g != null ? `+${rw.g} GRAM` : `+${rw.xp} XP`;
function grant(rw){ if (rw.g != null) setBalance(S.balance + rw.g); if (rw.xp) addXp(rw.xp); }

