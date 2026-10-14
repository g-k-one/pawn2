/* =========================================================
   ЗАДАНИЯ ДНЯ (кейс Биста) и НЕДЕЛЯ (кейс Маска)
   ========================================================= */
S.tasks = { early: 1, turnover: 10.354, crafts: 19, done: { early: 1 } };
const TASKS = [['early', $t("Сделай первый крафт до 12:00 МСК"), 1, { xp: 10 }], ['turnover', $t("Набери 20 GRAM оборота"), 20, { g: .04 }], ['crafts', $t("Сделай 50 крафтов"), 50, { xp: 60 }]];
const DAYS = [$t("ПН"), $t("ВТ"), $t("СР"), $t("ЧТ"), $t("ПТ"), $t("СБ"), $t("ВС")];
const dayIdx = () => (new Date().getDay() + 6) % 7;
S.week = { missed: [0], restorePrice: .5 };                       // какие дни недели пропущены (0 = понедельник)
const dailyDone = () => TASKS.every(([k, , n]) => S.tasks[k] >= n);
const tasksDone = () => TASKS.filter(([k, , n]) => S.tasks[k] >= n).length;
const weekDone = () => dayIdx() === 6 && dailyDone() && !S.week.missed.length;
/* бесплатные кейсы копятся: за выполненный день +1 кейс Биста, за неделю +1 Маска. Открываются по одному */
S.stock = { beast: 0, musk: 0 };
function stockUp(id){ S.stock[id]++; const c = caseById(id);
  setTimeout(() => notify({ type: 'ok', img: c.img, color: c.c, title: `${c.name} ${$t("в запасе ×")}${S.stock[id]}`, text: $t("Открой сейчас или копи на потом") }), 2600); }
function bumpTasks(r){
  if (S.demo) return;
  S.tasks.crafts++; S.tasks.turnover = Math.round((S.tasks.turnover + r.stake) * 1000) / 1000;
  if (dailyDone() && !S.tasks.stocked){ S.tasks.stocked = 1; stockUp('beast'); if (weekDone()) stockUp('musk'); }
  TASKS.forEach(([k, t, n, rw]) => { if (S.tasks[k] >= n && !S.tasks.done[k]){ S.tasks.done[k] = 1; setTimeout(() => { grant(rw); logReward('task', t, rw); notify({ type: 'ok', icon: 'ok', title: $t("Задание выполнено"), text: `${t} · ${rewText(rw)}` }); }, 1600); } });
}

