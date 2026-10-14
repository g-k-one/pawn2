/* =========================================================
   ДОСТИЖЕНИЯ — разовые. Засчитываются только по кнопке «Проверить» у каждого пункта
   ========================================================= */
S.ach = { got: {}, subscribed: false, nftDep: false };
const caught = ti => S.hist.crafts.some(c => c.r.ti === ti);
const ncr = () => S.hist.crafts.length;
const ACH = [
  ['craft1', 'Сделать первый крафт', { g: .05 }, () => ncr() >= 1],
  ['case1', 'Открыть первый кейс', { g: .05 }, () => S.hist.cases.length >= 1],
  ['sub', 'Подписаться на канал @pawnd', { g: .05 }, () => S.ach.subscribed, 'sub'],
  ['luck1', 'Поймать первую Удачу', { xp: 20 }, () => caught(1)],
  ['mega1', 'Поймать первую Мегу', { xp: 50 }, () => caught(2)],
  ['jp1', 'Поймать первый Джекпот', { xp: 500 }, () => caught(4)],
  ['nft1', 'Выиграть первый NFT-гифт', { xp: 60 }, () => S.hist.crafts.some(c => c.r.nft)],
  ['dep1', 'Первый депозит от 1 GRAM', { g: .3 }, () => S.hist.wallet.some(w => w.type === 'dep' && w.amount >= 1)],
  ['depnft', 'Первый депозит NFT-гифтом', { g: .5 }, () => S.ach.nftDep, 'relayer'],
  ['out1', 'Вывести первый NFT-гифт', { g: .25 }, () => S.hist.wallet.some(w => w.type === 'nft')],
  ['ref1', 'Пригласить первого друга', { xp: 40 }, () => REF.friends.length >= 1],
  ['ref10', 'Пригласить 10 друзей', { xp: 100 }, () => REF.friends.length >= 10, null, () => [REF.friends.length, 10]],
  ['ref100', 'Пригласить 100 друзей', { xp: 1000 }, () => REF.friends.length >= 100, null, () => [REF.friends.length, 100]],
  ['refcraft', 'Один из друзей сделал первый крафт', { xp: 60 }, () => REF.friends.some(f => f[1] > 0)],
  ['refdep', 'Один из друзей сделал первый депозит', { xp: 100 }, () => REF.friends.some(f => f[2] > 0)],
  ['craft10', 'Сделать 10 крафтов', { g: .1 }, () => ncr() >= 10, null, () => [ncr(), 10]],
  ['craft100', 'Сделать 100 крафтов', { g: .2 }, () => ncr() >= 100, null, () => [ncr(), 100]],
  ['craft500', 'Сделать 500 крафтов', { g: .5 }, () => ncr() >= 500, null, () => [ncr(), 500]],
  ['craft1000', 'Сделать 1000 крафтов', { g: .7 }, () => ncr() >= 1000, null, () => [ncr(), 1000]],
  ['craft5000', 'Сделать 5000 крафтов', { g: 1 }, () => ncr() >= 5000, null, () => [ncr(), 5000]],
  ['rank1', 'Получить звание «Лудик»', { g: .3 }, () => S.xp >= 2600, null, () => [Math.floor(S.xp), 2600]],
  ['rank2', 'Получить звание «Криптобарон»', { g: 1.5 }, () => S.xp >= 9000, null, () => [Math.floor(S.xp), 9000]],
  ['rank3', 'Получить звание «ПАВНЕД»', { g: 3 }, () => S.xp >= 22000, null, () => [Math.floor(S.xp), 22000]],
];
// старое (уже сделанное до сессии) отмечаем как полученное без наград
function checkAch(silent){ if (silent) ACH.forEach(a => { if (a[3]()) S.ach.got[a[0]] = 1; }); }
function claimAch(id, btn){
  const a = ACH.find(x => x[0] === id); if (!a || S.ach.got[id]) return;
  const [, t, rw, ok, act, prog] = a;
  btn.classList.add('wait'); btn.textContent = 'Проверяем…';
  setTimeout(() => {
    if (ok()){ S.ach.got[id] = 1; grant(rw); logReward('ach', t, rw); haptic('medium'); Sfx.coin(); notify({ type: 'ok', icon: 'ok', color: '#12D53D', title: 'Достижение получено', text: `${t} · ${rewText(rw)}` }); }
    else { haptic('rigid'); const pr = prog ? prog() : null; notify({ type: 'warn', icon: 'info', title: 'Ещё не выполнено', text: pr ? `${t}: ${xpFmt(pr[0])} из ${xpFmt(pr[1])}` : t });
      if (act === 'sub'){ try { Telegram.WebApp.openTelegramLink('https://t.me/pawnd'); } catch(_){} setTimeout(() => { S.ach.subscribed = true; }, 1500); }
      if (act === 'relayer') relayerFlow(); }
    renderCases();
  }, 700);
}
const RULES = ['Задания и награды обновляются в 00:00 МСК для каждого игрока.', 'Задания делятся на три уровня: лёгкое, среднее и тяжёлое.', 'Кейс Мистера Биста открывается, когда выполнены все 3 задания дня.',
  'Кейс Илона Маска открывается, когда задания дня выполнены каждый день недели — с понедельника по воскресенье.', 'Пропущенный день можно восстановить за GRAM.', 'Все награды из кейсов — GRAM, XP и NFT — зачисляются сразу.', 'Достижения засчитываются один раз — по кнопке «Проверить».'];
const rulesHTML = list => `<details class="rules"><summary>Правила</summary><ol>${list.map(r => `<li>${r}</li>`).join('')}</ol></details>`;

