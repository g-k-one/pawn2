/* =========================================================
   PROVABLY FAIR: данные для проверки любого крафта или кейса
   ========================================================= */
/* внешний сайт для ручной проверки честности */
const VERIFY_URL = 'https://pawn-frontend.onrender.com/verify';
const PF_EXT = `<a class="pf-ext" href="${VERIFY_URL}" target="_blank" rel="noopener" data-act="verify">Проверить самому ↗</a>`;
const pfRow = (k, v) => `<div class="pf-row"><small>${k}</small><code>${v}</code></div>`;
const tk = n => n.toLocaleString('ru-RU');
function pfHTML(r){
  const isCase = r.kind === 'case', c = isCase ? caseById(r.caseId) : null, it = isCase ? c.items[r.idx] : null, t = isCase ? null : TIERS[r.ti];
  const col = isCase ? itemColor(it) : t.c, res = isCase ? itemName(it) : `${t.name} · x${r.mult}`;
  const rng = isCase ? `«${itemName(it)}» в кейсе — это тикеты от ${tk(it.from)} до ${tk(it.to)}. Тикет ${tk(r.ticket)} внутри — значит, приз верный.`
                     : `Ранг «${t.name}» — это тикеты от ${tk(t.from)} до ${tk(t.to)}. Тикет ${tk(r.ticket)} внутри — значит, ранг и множитель x${r.mult} верные.`;
  const P = r.proof;
  let tech = `<div class="pf-row"><small>Server seed — секретное зерно сервера</small><code class="pf-seed">${P.server_seed || 'раскроется при смене ключа'}</code></div>` + pfRow('Commitment — SHA-256 зерна, показан до игры', P.commitment) +
    pfRow('Client seed — твой ключ', P.client_seed) + pfRow('Эпоха', P.epoch_id) + pfRow('Nonce · домен · блок', `${P.nonce} · ${P.domain} · ${P.block_counter}`) + pfRow('Ролл', P.roll);
  return `<div class="pfres" style="--c:${col}"><small>Результат · тикет</small><b>${tk(r.ticket)}</b><span>${res}</span></div>` +
    `<div class="pfc" data-k="hash"><i></i><div><b>Результат не подменили</b><p>До игры мы показали «отпечаток» секретного ключа сервера. Теперь ключ открыт — сверим, что отпечаток тот же.</p><em>ждёт проверки</em></div></div>` +
    `<div class="pfc" data-k="ticket"><i></i><div><b>Тикет посчитан по формуле</b><p>Ключ сервера + твой ключ + номер игры (${r.proof.nonce}) по открытой формуле дают тикет ${tk(r.ticket)}.</p><em>ждёт проверки</em></div></div>` +
    `<div class="pfc" data-k="rule"><i></i><div><b>Приз выдан по правилам</b><p>${rng}</p><em>ждёт проверки</em></div></div>` +
    (r.manual ? '<p class="pfnote">Дебаг: тикет задан вручную, поэтому проверка не сойдётся. Это нормально.</p>' : r.debug ? '<p class="pfnote">Дебаг: исход выбран в настройках, ключ сервера подобран перебором — проверка сходится.</p>' : '') +
    (P.server_seed ? '' : '<p class="pfnote pf-pend">Зерно этой эпохи ещё не раскрыто — без него игру не проверить. Раскрытие сменит твой ключ и начнёт новую эпоху.</p>') +
    `<button class="btn-main pf-check">${P.server_seed ? 'Проверить здесь' : 'Раскрыть зерно и проверить'}</button><button class="btn-ghost pf-copy">Скачать доказательство</button>` + PF_EXT +
    `<details class="rules pftech"><summary>Технические данные</summary><div>${tech}</div></details>`;
}
function bindPF(root, r){
  root.querySelector('.pf-check').onclick = async e => {
    const btn = e.currentTarget; if (btn.classList.contains('wait')) return;
    if (!r.proof.server_seed){
      if (S.busy && !$('fx').classList.contains('done')) return;
      btn.classList.add('wait'); btn.textContent = 'Раскрываем…'; haptic();
      const ep = await revealEpoch(); await wait(S.lite ? 0 : 400);
      root.querySelector('.pf-pend')?.remove(); const sc = root.querySelector('.pf-seed'); if (sc) sc.textContent = r.proof.server_seed;
      notify({ type: 'ok', icon: 'ok', title: 'Зерно эпохи раскрыто', text: `Игр в эпохе: ${ep.proofs.length} · новый хеш уже загадан` });
    }
    btn.classList.add('wait'); btn.textContent = 'Проверяем…'; haptic();
    const res = await checkProof(r.proof);
    const cards = [...root.querySelectorAll('.pfc')];
    for (const el of cards){ await wait(S.lite ? 0 : 280); const ok = res[el.dataset.k];
      el.classList.add(ok ? 'ok' : 'no'); el.querySelector('em').textContent = ok ? 'проверено' : 'не совпало'; haptic(ok ? 'light' : 'rigid'); }
    const all = Object.values(res).every(Boolean);
    btn.classList.remove('wait'); btn.classList.add(all ? 'done' : 'bad'); btn.textContent = all ? 'Всё честно ✓' : 'Проверка не сошлась';
  };
  root.querySelector('.pf-copy').onclick = () => saveJson(`pawn-proof-${r.proof.reference}.json`, r.proof, 'Доказательство');
}
/* сохранить JSON: в просмотрщике Claude — через его загрузки, в обычном браузере — файлом; всегда ещё и в буфер.
   В Telegram файл из blob не скачать — только буфер; в бою файл отдаёт бэкенд по ссылке через Telegram.WebApp.downloadFile */
const DL = window.claude?.use ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
async function saveJson(name, obj, what){
  const txt = JSON.stringify(obj, null, 2); let saved = false; haptic();
  try { navigator.clipboard.writeText(txt).catch(() => {}); } catch(_){}
  if (!window.Telegram?.WebApp?.initData){
    if (window.claude){ const dl = await DL; if (dl){ try { await dl.save({ filename: name, data: txt }); saved = true; } catch(_){} } }
    else try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); saved = true; } catch(_){}
  }
  notify({ type: 'ok', icon: 'ok', title: saved ? `${what}: файл сохранён` : `${what} скопировано`, text: saved ? `${name} · JSON ещё и в буфере` : 'Вставь JSON на сайте проверки' });
}
function openPF(r = S.lastFair){
  if (!r){ $('pfBody').innerHTML = '<p class="muted">Сделай первый крафт — здесь появятся данные для проверки.</p>'; showDrawer('pfDrawer'); return; }
  $('pfBody').innerHTML = pfHTML(r); bindPF($('pfBody'), r); showDrawer('pfDrawer');
}
// открыть одну шторку вместо другой
// открыть одну шторку вместо другой: шторка остаётся на месте, старое содержимое тает, новое проявляется из глубины
function swapDrawer(id, prep){
  const old = openDrawer, nw = $(id);
  if (!old){ prep?.(); return showDrawer(id); }
  if (old === nw) return prep?.();
  prep?.(); haptic();
  nw.classList.add('drag', 'open'); nw.style.transform = ''; nw.style.zIndex = 48; openDrawer = nw;
  nw.animate([{ opacity: 0, transform: 'translateY(10px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.25,.9,.3,1)' })
    .onfinish = () => { nw.classList.remove('drag'); nw.style.zIndex = ''; };
  old.classList.add('drag');
  old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' }).onfinish = () => {
    old.classList.remove('open'); old.style.transform = ''; requestAnimationFrame(() => { old.getAnimations().forEach(a => a.cancel()); old.classList.remove('drag'); }); };
}

/* ---------- как это работает ---------- */
function renderPFInfo(){
  const ENV = '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>';
  const steps = [
    ['#00D9FF', 'До игры', 'Сервер загадывает результат секретным ключом и сразу показывает тебе его «отпечаток» — короткий код. По отпечатку ключ не угадать, но и подменить ключ потом не выйдет.'],
    ['#AE3FC4', 'Твой вклад', 'В расчёте участвует и твой ключ. Его можно сменить в любой момент — поэтому мы не можем заранее подобрать результат под тебя.'],
    ['#12D53D', 'Раскрытие', 'Когда ты меняешь свой ключ, секретное зерно за всю эпоху раскрывается. Отпечаток совпал — значит, результаты не меняли. Любую игру эпохи можно пересчитать прямо здесь, в браузере.'],
  ];
  $('pfiBody').innerHTML = `<div class="pfi-hero"><h4>Что такое Provably Fair</h4><p>Это способ доказать, что мы не подкручиваем результат. Любой крафт и кейс можно проверить самому — без доверия к нам.</p></div>` +
    `<div class="pfi-rtp"><b>${(+RTP_PPM / 1e4).toFixed(0)}%</b><span><b>Целевой RTP</b><small>На длинной дистанции игрокам возвращается 95% от суммы ставок. Это значение записано в правилах каждого доказательства — target_rtp_ppm.</small></span></div>` +
    `<div class="pfi-env"><i>${svg(ENV)}</i><div><b>Как запечатанный конверт</b><p>Перед игрой мы кладём результат в конверт и отдаём его тебе. После игры конверт вскрывают — внутри то же, что было до игры.</p></div></div>` +
    `<div class="pfi-t">Как это работает</div>` +
    steps.map(([c, t, d], i) => `<div class="pfi-step" style="--c:${c}"><i>${i + 1}</i><div><b>${t}</b><p>${d}</p></div></div>`).join('') +
    `<div class="pfi-t">Тикет и ранги</div><p class="pfi-p">Каждая игра даёт тикет — число от 0 до 99 999. В какой диапазон он попал, такой и ранг. Шанс ранга — ровно доля его диапазона.</p>` +
    `<div class="rng">${TIERS.map(t => `<div style="--c:${t.c}"><b>${t.name}</b><span>${tk(t.from)}–${tk(t.to)}</span><em>${t.chance}%</em></div>`).join('')}</div>` +
    `<div class="pfi-t">Текущая эпоха</div><p class="pfi-p">Зерно сервера загадано заранее — вот его отпечаток. Все игры эпохи считаются от него. Сохрани подтверждение сейчас: после раскрытия сайт проверки сверит его с доказательством.</p>` +
    `<div class="pf-row"><small>Commitment · игр в эпохе: <span id="epN">…</span></small><code id="nextHash">…</code></div><button class="btn-ghost" id="saveReceipt">Сохранить подтверждение</button>` +
    `<div class="pfi-t">Твой ключ</div><div class="cseed"><code id="cseedV">${S.clientSeed}</code></div>` +
    `<p class="pfi-p" style="margin-top:10px">Смена ключа раскрывает зерно текущей эпохи — все её игры можно проверить — и начинает новую эпоху с новым хешем.</p><button class="btn-ghost" id="cseedNew">Сменить ключ и раскрыть зерно</button>` +
    `<details class="rules"><summary>Формула для разработчиков</summary><ol><li>Ключ HMAC-SHA256 — 32 байта server seed, сообщение — JSON ["pawn-pf-v1", эпоха, домен, client seed, nonce, блок]</li><li>Из хеша по очереди берутся восемь 32-битных чисел; первое меньше 4 294 900 000 по модулю 100 000 = тикет</li><li>Не подошло ни одно — номер блока +1</li><li>SHA-256(server seed) должен совпасть с отпечатком, показанным до игры</li></ol></details>` +
    `<div class="pfi-btns"><button class="btn-main" id="pfiLast">Проверить последний крафт</button><button class="btn-ghost" id="pfiHist">Вся история</button></div>` + PF_EXT;
  const epFill = () => epochP.then(e => { if (!$('nextHash')) return; $('nextHash').textContent = e.commitment; $('epN').textContent = e.proofs.length; $('cseedV').textContent = S.clientSeed; });
  epFill();
  $('saveReceipt').onclick = async () => { const rc = await receiptNow(); saveJson(`pawn-receipt-${rc.epoch_id.slice(0, 8)}.json`, rc, 'Подтверждение'); };
  $('cseedNew').onclick = async () => { if (S.busy) return; haptic('medium'); const e = await revealEpoch(); epFill();
    notify({ type: 'ok', icon: 'ok', title: 'Зерно раскрыто', text: `Игр в эпохе: ${e.proofs.length} — их можно проверить. Новый хеш уже загадан, сохрани подтверждение` }); };
  $('pfiLast').onclick = () => swapDrawer('pfDrawer', () => { const r = S.lastFair || S.hist.crafts[0]?.r; if (r){ $('pfBody').innerHTML = pfHTML(r); bindPF($('pfBody'), r); } });
  $('pfiHist').onclick = () => openHistory('crafts');
}

