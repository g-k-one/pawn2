/* =========================================================
   PROVABLY FAIR: данные для проверки любого крафта или кейса
   ========================================================= */
/* внешний сайт для ручной проверки честности */
const VERIFY_URL = 'https://pawn-frontend.onrender.com/verify';
const PF_EXT = `<a class="pf-ext" href="${VERIFY_URL}" target="_blank" rel="noopener" data-act="verify">${$t("Проверить самому ↗")}</a>`;
const pfRow = (k, v) => `<div class="pf-row"><small>${k}</small><code>${v}</code></div>`;
const tk = n => n.toLocaleString(LOC);
function pfHTML(r){
  const isCase = r.kind === 'case', c = isCase ? caseById(r.caseId) : null, it = isCase ? c.items[r.idx] : null, t = isCase ? null : TIERS[r.ti];
  const col = isCase ? itemColor(it) : t.c, res = isCase ? itemName(it) : `${t.name} · x${r.mult}`;
  const rng = isCase ? `${$t("«{0}» в кейсе — это тикеты от {1} до {2}. Тикет {3} внутри — значит, приз верный.", itemName(it), tk(it.from), tk(it.to), tk(r.ticket))}`
                     : `${$t("Ранг «{0}» — это тикеты от {1} до {2}. Тикет {3} внутри — значит, ранг и множитель x{4} верные.", t.name, tk(t.from), tk(t.to), tk(r.ticket), r.mult)}`;
  const P = r.proof;
  let tech = `<div class="pf-row"><small>${$t("Server seed — секретное зерно сервера")}</small><code class="pf-seed">${P.server_seed || $t("раскроется при смене ключа")}</code></div>` + pfRow($t("Commitment — SHA-256 зерна, показан до игры"), P.commitment) +
    pfRow($t("Client seed — твой ключ"), P.client_seed) + pfRow($t("Эпоха"), P.epoch_id) + pfRow($t("Nonce · домен · блок"), `${P.nonce} · ${P.domain} · ${P.block_counter}`) + pfRow($t("Ролл"), P.roll);
  return `<div class="pfres" style="--c:${col}"><small>${$t("Результат · тикет")}</small><b>${tk(r.ticket)}</b><span>${res}</span></div>` +
    `<div class="pfc" data-k="hash"><i></i><div><b>${$t("Результат не подменили")}</b><p>${$t("До игры мы показали «отпечаток» секретного ключа сервера. Теперь ключ открыт — сверим, что отпечаток тот же.")}</p><em>${$t("ждёт проверки")}</em></div></div>` +
    `<div class="pfc" data-k="ticket"><i></i><div><b>${$t("Тикет посчитан по формуле")}</b><p>${$t("Ключ сервера + твой ключ + номер игры ({0}) по открытой формуле дают тикет {1}.", r.proof.nonce, tk(r.ticket))}</p><em>${$t("ждёт проверки")}</em></div></div>` +
    `<div class="pfc" data-k="rule"><i></i><div><b>${$t("Приз выдан по правилам")}</b><p>${rng}</p><em>${$t("ждёт проверки")}</em></div></div>` +
    (r.manual ? `<p class="pfnote">${$t("Дебаг: тикет задан вручную, поэтому проверка не сойдётся. Это нормально.")}</p>` : r.debug ? `<p class="pfnote">${$t("Дебаг: исход выбран в настройках, ключ сервера подобран перебором — проверка сходится.")}</p>` : '') +
    (P.server_seed ? '' : `<p class="pfnote pf-pend">${$t("Зерно этой эпохи ещё не раскрыто — без него игру не проверить. Раскрытие сменит твой ключ и начнёт новую эпоху.")}</p>`) +
    `<button class="btn-main pf-check">${P.server_seed ? $t("Проверить здесь") : $t("Раскрыть зерно и проверить")}</button><button class="btn-ghost pf-copy">${$t("Скопировать доказательство")}</button>` + PF_EXT +
    `<details class="rules pftech"><summary>${$t("Технические данные")}</summary><div>${tech}</div></details>`;
}
function bindPF(root, r){
  root.querySelector('.pf-check').onclick = async e => {
    const btn = e.currentTarget; if (btn.classList.contains('wait')) return;
    if (!r.proof.server_seed){
      if (S.busy && !$('fx').classList.contains('done')) return;
      btn.classList.add('wait'); btn.textContent = $t("Раскрываем…"); haptic();
      const ep = await API.rotateSeed(); await wait(S.lite ? 0 : 400);
      root.querySelector('.pf-pend')?.remove(); const sc = root.querySelector('.pf-seed'); if (sc) sc.textContent = r.proof.server_seed;
      notify({ type: 'ok', icon: 'ok', title: $t("Зерно эпохи раскрыто"), text: `${$t("Игр в эпохе: {0} · новый хеш уже загадан", ep.proofs.length)}` });
    }
    btn.classList.add('wait'); btn.textContent = $t("Проверяем…"); haptic();
    const res = await checkProof(r.proof);
    const cards = [...root.querySelectorAll('.pfc')];
    for (const el of cards){ await wait(S.lite ? 0 : 280); const ok = res[el.dataset.k];
      el.classList.add(ok ? 'ok' : 'no'); el.querySelector('em').textContent = ok ? $t("проверено") : $t("не совпало"); haptic(ok ? 'light' : 'rigid'); }
    const all = Object.values(res).every(Boolean);
    btn.classList.remove('wait'); btn.classList.add(all ? 'done' : 'bad'); btn.textContent = all ? $t("Всё честно ✓") : $t("Проверка не сошлась");
  };
  root.querySelector('.pf-copy').onclick = () => copyJson(r.proof, $t("Доказательство"));
}
/* скопировать JSON доказательства или подтверждения в буфер — его вставляют на сайте проверки.
   Старые WebView без navigator.clipboard — через скрытое поле и execCommand */
async function copyJson(obj, what){
  haptic(); const txt = JSON.stringify(obj, null, 2); let ok = false;
  try { await navigator.clipboard.writeText(txt); ok = true; } catch(_){}
  if (!ok) try { const t = document.createElement('textarea'); t.value = txt; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove(); } catch(_){}
  notify(ok ? { type: 'ok', icon: 'ok', title: `${what} ${$t("скопировано")}`, text: $t("Вставь JSON на сайте проверки") }
            : { type: 'err', icon: 'err', title: $t("Не удалось скопировать"), text: $t("Разреши доступ к буферу обмена и попробуй ещё раз") });
}
function openPF(r = S.lastFair){
  if (!r){ $('pfBody').innerHTML = `<p class="muted">${$t("Сделай первый крафт — здесь появятся данные для проверки.")}</p>`; showDrawer('pfDrawer'); return; }
  $('pfBody').innerHTML = pfHTML(r); bindPF($('pfBody'), r); showDrawer('pfDrawer');
}
// открыть одну шторку вместо другой
// открыть одну шторку вместо другой: шторка остаётся на месте, старое содержимое тает, новое проявляется из глубины
function swapDrawer(id, prep, back){
  const old = openDrawer, nw = $(id);
  if (!old){ prep?.(); return showDrawer(id); }
  if (old === nw) return prep?.();
  if (!back) drawerStack.push(old.id);
  prep?.(); haptic(); setBack(nw);
  nw.classList.add('drag', 'open'); nw.style.transform = ''; nw.style.zIndex = 48; openDrawer = nw;
  nw.animate([{ opacity: 0, transform: 'translateY(10px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.25,.9,.3,1)' })
    .onfinish = () => { nw.classList.remove('drag'); nw.style.zIndex = ''; };
  old.classList.add('drag');
  old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' }).onfinish = () => {
    old.classList.remove('open'); old.style.transform = ''; old.querySelector('.dr-back')?.remove(); requestAnimationFrame(() => { old.getAnimations().forEach(a => a.cancel()); old.classList.remove('drag'); }); };
}

/* ---------- как это работает ---------- */
function renderPFInfo(){
  const ENV = '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>';
  const steps = [
    ['#00D9FF', $t("До игры"), $t("Сервер загадывает результат секретным ключом и сразу показывает тебе его «отпечаток» — короткий код. По отпечатку ключ не угадать, но и подменить ключ потом не выйдет.")],
    ['#EB57B0', $t("Твой вклад"), $t("В расчёте участвует и твой ключ. Его можно сменить в любой момент — поэтому мы не можем заранее подобрать результат под тебя.")],
    ['#12D53D', $t("Раскрытие"), $t("Когда ты меняешь свой ключ, секретное зерно за всю эпоху раскрывается. Отпечаток совпал — значит, результаты не меняли. Любую игру эпохи можно пересчитать прямо здесь, в браузере.")],
  ];
  $('pfiBody').innerHTML = `<div class="pfi-hero"><i>${svg(IC.shield)}</i><div><h4>${$t("Что такое Provably Fair")}</h4><p>${$t("Это способ доказать, что мы не подкручиваем результат. Любой крафт и кейс можно проверить самому — без доверия к нам.")}</p></div></div>` +
    `<div class="pfi-rtp"><b>${(+RTP_PPM / 1e4).toFixed(0)}%</b><span><b>${$t("Целевой RTP")}</b><small>${$t("Крафт на длинной дистанции возвращает игрокам 95% от суммы ставок. Это значение записано в правилах каждого доказательства крафта — target_rtp_ppm.")}</small></span></div>` +
    `<div class="pfi-env"><i>${svg(ENV)}</i><div><b>${$t("Как запечатанный конверт")}</b><p>${$t("Перед игрой мы кладём результат в конверт и отдаём его тебе. После игры конверт вскрывают — внутри то же, что было до игры.")}</p></div></div>` +
    `<div class="pfi-t">${$t("Как это работает")}</div>` +
    steps.map(([c, t, d], i) => `<div class="pfi-step" style="--c:${c}"><i>${i + 1}</i><div><b>${t}</b><p>${d}</p></div></div>`).join('') +
    `<div class="pfi-t">${$t("Тикет и ранги")}</div><p class="pfi-p">${$t("Каждая игра даёт тикет — число от 0 до 99 999. В какой диапазон он попал, такой и ранг. Шанс ранга — ровно доля его диапазона.")}</p>` +
    `<div class="rng">${TIERS.map(t => `<div style="--c:${t.c}"><b>${t.name}</b><span>${tk(t.from)} – ${tk(t.to)}</span><em>${t.chance}%</em></div>`).join('')}</div>` +
    `<div class="pfi-t">${$t("Текущая эпоха")}</div><p class="pfi-p">${$t("Зерно сервера загадано заранее — вот его отпечаток. Все игры эпохи считаются от него. Сохрани подтверждение сейчас: после раскрытия сайт проверки сверит его с доказательством.")}</p>` +
    `<div class="pf-row"><small>${$t("Commitment · игр в эпохе:")} <span id="epN">…</span></small><code id="nextHash">…</code></div><button class="btn-ghost" id="saveReceipt">${$t("Скопировать подтверждение")}</button>` +
    `<div class="pfi-t">${$t("Твой ключ")}</div><div class="cseed"><code id="cseedV">${S.clientSeed}</code></div>` +
    `<p class="pfi-p" style="margin-top:10px">${$t("Смена ключа раскрывает зерно текущей эпохи — все её игры можно проверить — и начинает новую эпоху с новым хешем.")}</p><button class="btn-ghost" id="cseedNew">${$t("Сменить ключ и раскрыть зерно")}</button>` +
    `<details class="rules"><summary>${$t("Формула для разработчиков")}</summary><ol><li>${$t("Ключ HMAC-SHA256 — 32 байта server seed, сообщение — JSON [\"pawn-pf-v1\", эпоха, домен, client seed, nonce, блок]")}</li><li>${$t("Из хеша по очереди берутся восемь 32-битных чисел; первое меньше 4 294 900 000 по модулю 100 000 = тикет")}</li><li>${$t("Не подошло ни одно — номер блока +1")}</li><li>${$t("SHA-256(server seed) должен совпасть с отпечатком, показанным до игры")}</li></ol></details>` +
    `<div class="pfi-btns"><button class="btn-main" id="pfiLast">${$t("Проверить последний крафт")}</button><button class="btn-ghost" id="pfiHist">${$t("Вся история")}</button></div>` + PF_EXT;
  const epFill = () => epochP.then(e => { if (!$('nextHash')) return; $('nextHash').textContent = e.commitment; $('epN').textContent = e.proofs.length; $('cseedV').textContent = S.clientSeed; });
  epFill();
  $('saveReceipt').onclick = async () => { const rc = await API.receipt(); copyJson(rc, $t("Подтверждение")); };
  $('cseedNew').onclick = async () => { if (S.busy) return; haptic('medium'); const e = await API.rotateSeed(); epFill();
    notify({ type: 'ok', icon: 'ok', title: $t("Зерно раскрыто"), text: `${$t("Игр в эпохе: {0} — их можно проверить. Новый хеш уже загадан, сохрани подтверждение", e.proofs.length)}` }); };
  $('pfiLast').onclick = () => swapDrawer('pfDrawer', () => { const r = S.lastFair || S.hist.crafts[0]?.r; if (r){ $('pfBody').innerHTML = pfHTML(r); bindPF($('pfBody'), r); } });
  $('pfiHist').onclick = () => openHistory('crafts');
}

