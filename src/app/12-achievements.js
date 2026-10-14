/* =========================================================
   ДОСТИЖЕНИЯ — разовые. Засчитываются только по кнопке «Проверить» у каждого пункта
   ========================================================= */
S.ach = { got: {}, subscribed: false, nftDep: false };
const caught = ti => S.hist.crafts.some(c => c.r.ti === ti);
const ncr = () => S.hist.crafts.length;
const ACH = [
  ['craft1', $t("Сделать первый крафт"), { g: .05 }, () => ncr() >= 1],
  ['case1', $t("Открыть первый кейс"), { g: .05 }, () => S.hist.cases.length >= 1],
  ['sub', $t("Подписаться на канал @pawnd"), { g: .05 }, () => S.ach.subscribed, 'sub'],
  ['luck1', $t("Поймать первую Удачу"), { xp: 20 }, () => caught(1)],
  ['mega1', $t("Поймать первую Мегу"), { xp: 50 }, () => caught(2)],
  ['jp1', $t("Поймать первый Джекпот"), { xp: 500 }, () => caught(4)],
  ['nft1', $t("Выиграть первый NFT-гифт"), { xp: 60 }, () => S.hist.crafts.some(c => c.r.nft)],
  ['dep1', $t("Первый депозит от 1 GRAM"), { g: .3 }, () => S.hist.wallet.some(w => w.type === 'dep' && w.amount >= 1)],
  ['depnft', $t("Первый депозит NFT-гифтом"), { g: .5 }, () => S.ach.nftDep, 'relayer'],
  ['out1', $t("Вывести первый NFT-гифт"), { g: .25 }, () => S.hist.wallet.some(w => w.type === 'nft')],
  ['ref1', $t("Пригласить первого друга"), { xp: 40 }, () => REF.friends.length >= 1],
  ['ref10', $t("Пригласить 10 друзей"), { xp: 100 }, () => REF.friends.length >= 10, null, () => [REF.friends.length, 10]],
  ['ref100', $t("Пригласить 100 друзей"), { xp: 1000 }, () => REF.friends.length >= 100, null, () => [REF.friends.length, 100]],
  ['refcraft', $t("Один из друзей сделал первый крафт"), { xp: 60 }, () => REF.friends.some(f => f[1] > 0)],
  ['refdep', $t("Один из друзей сделал первый депозит"), { xp: 100 }, () => REF.friends.some(f => f[2] > 0)],
  ['craft10', $t("Сделать 10 крафтов"), { g: .1 }, () => ncr() >= 10, null, () => [ncr(), 10]],
  ['craft100', $t("Сделать 100 крафтов"), { g: .2 }, () => ncr() >= 100, null, () => [ncr(), 100]],
  ['craft500', $t("Сделать 500 крафтов"), { g: .5 }, () => ncr() >= 500, null, () => [ncr(), 500]],
  ['craft1000', $t("Сделать 1000 крафтов"), { g: .7 }, () => ncr() >= 1000, null, () => [ncr(), 1000]],
  ['craft5000', $t("Сделать 5000 крафтов"), { g: 1 }, () => ncr() >= 5000, null, () => [ncr(), 5000]],
  ['rank1', $t("Получить звание «Лудик»"), { g: .3 }, () => S.xp >= 2600, null, () => [Math.floor(S.xp), 2600]],
  ['rank2', $t("Получить звание «Криптобарон»"), { g: 1.5 }, () => S.xp >= 9000, null, () => [Math.floor(S.xp), 9000]],
  ['rank3', $t("Получить звание «ПАВНЕД»"), { g: 3 }, () => S.xp >= 22000, null, () => [Math.floor(S.xp), 22000]],
];
// старое (уже сделанное до сессии) отмечаем как полученное без наград
function checkAch(silent){ if (silent) ACH.forEach(a => { if (a[3]()) S.ach.got[a[0]] = 1; }); }
function claimAch(id, btn){
  const a = ACH.find(x => x[0] === id); if (!a || S.ach.got[id]) return;
  const [, t, rw, ok, act, prog] = a;
  btn.classList.add('wait'); btn.textContent = $t("Проверяем…");
  setTimeout(() => {
    if (ok()){ S.ach.got[id] = 1; grant(rw); logReward('ach', t, rw); haptic('medium'); Sfx.coin(); notify({ type: 'ok', icon: 'ok', color: '#12D53D', title: $t("Достижение получено"), text: `${t} · ${rewText(rw)}` }); }
    else { haptic('rigid'); const pr = prog ? prog() : null; notify({ type: 'warn', icon: 'info', title: $t("Ещё не выполнено"), text: pr ? `${t}${$t(": {0} из", xpFmt(pr[0]))} ${xpFmt(pr[1])}` : t });
      if (act === 'sub'){ tgOpen('https://t.me/pawnd'); setTimeout(() => { S.ach.subscribed = true; }, 1500); }
      if (act === 'relayer') relayerFlow(); }
    renderCases();
  }, 700);
}
const RULES = [$t("Задания и награды обновляются в 00:00 МСК для каждого игрока."), $t("Задания делятся на три уровня: лёгкое, среднее и тяжёлое."), $t("Кейс Мистера Биста открывается, когда выполнены все 3 задания дня."),
  $t("Кейс Илона Маска открывается, когда задания дня выполнены каждый день недели — с понедельника по воскресенье."), $t("Пропущенный день можно восстановить за GRAM."), $t("Все награды из кейсов — GRAM, XP и NFT — зачисляются сразу."), $t("Достижения засчитываются один раз — по кнопке «Проверить».")];
const rulesHTML = list => `<details class="rules"><summary>${$t("Правила")}</summary><ol>${list.map(r => `<li>${r}</li>`).join('')}</ol></details>`;

