/* =========================================================
   TAB2 — новый режим, собираем из копии главной (тот же экран, класс mode-tab2 на body).
   Отличия от главной: ранги не листаются сами — только свайпом/тапом; выбор ранга = выбор тикета (наименьший в ранге);
   вместо множителей — выбранный тикет; вместо «Сделай ставку» — таймер комнаты; взнос всегда 0.5 GRAM.
   Комната — та же, что у PvP (API.pvpOpen / pvpJoin / pvpChange / pvpState): тап по наковальне или ставке — вход
   с выбранным тикетом, в кнопке вместо молота с наковальней — твоя аватарка, в плашке — общий банк комнаты.
   Таймер 30 с идёт с первого входа; за 5 с до старта тикет зафиксирован. По таймеру — бой (заставка с молотом
   и раскрытие с игроками, как в PvP). Отдельного таба PvP больше нет.
   ========================================================= */
// три комнаты — на 0.5, 1 и 2 GRAM; переключаются стрелками по бокам плашки ставки. Опрашиваем только комнату на экране
let t2Fee = PVP_FEES[0];
let t2Tier = 1, t2Main = null, t2Ticket = TIERS[1].from, t2End = 0, t2Prev = null, t2Room = null, t2Busy = false;   // t2Prev — ставка главной, вернём при выходе; t2Room — комната (как её видит игрок)
const t2Me = () => !!t2Room?.entries?.some(x => x.me);
// до старта ≤ 5 с — тикеты зафиксированы: колесо и ранги не крутятся, войти уже нельзя
const t2Locked = () => t2End > 0 && t2End - Date.now() <= PVP_LOCK * 1000;
// все места заняты (а тебя среди них нет) — войти нельзя, кнопка тоже с замком; тикет на следующую можно крутить
const t2Full = () => !t2Me() && (t2Room?.entries?.length || 0) >= PVP_MAX;
const isT2 = () => document.body.classList.contains('mode-tab2');
// поверх setTier / restartAuto / renderBet главной: в tab2 — свои надписи и без автолистания
const _setTier = setTier, _restartAuto = restartAuto, _renderBet = renderBet;
setTier = (i, opts = {}) => { if (isT2() && t2Locked() && !opts.keepTicket){ haptic('rigid'); return; }
  _setTier(i, opts); if (isT2() && !opts.keepTicket && !S.busy && !t2Go){ t2Ticket = TIERS[i].from; t2Show(); t2Change(); } };   // во время боя ранг ставит раскрытие — тикет игрока не трогаем
restartAuto = () => { if (isT2()){ clearInterval(auto); return; } _restartAuto(); };
// в комнате плашка ставки показывает общий банк: «Общий банк» в 2 строки перед GRAM
renderBet = bump => { if (!isT2()) return _renderBet(bump); const b = $('bet'); b.classList.remove('gifts'); b.classList.toggle('t2bank', t2Me()); b.dataset.full = t2Full() ? 1 : '';
  if (t2Full()){ b.innerHTML = `<span class="t2bl t2full">${$t("Все слоты заняты")}</span>`; return; }   // мест нет — в плашке только это, в 2 строки
  b.innerHTML = (t2Me() ? `<span class="t2bl">${$t("Общий банк")}</span>` : '') + `<img src="assets/ton.svg" width="49" height="41.34" alt=""><b class="ton">${fmt(t2Me() ? t2Room.bank : t2Fee)}</b>`; if (bump) b.querySelector('.ton').classList.add('bump'); };
function t2Show(){ if (!isT2()) return; t2Ring();
  if (!S.busy && !t2Go && S.tier !== tierOfTicket(t2Ticket) && !t2Wheel.classList.contains('drag')) _setTier(tierOfTicket(t2Ticket));   // после боя — ранг снова по своему тикету
  t2Html($('range'), `<span class="xf">${tk(t2Ticket)}</span>`); t2Turn();
  const left = t2End ? Math.max(0, (t2End - Date.now()) / 1000) : PVP_TIME, p = $('prize');   // никто не зашёл — таймер стоит на 0:30
  if (p.className !== 'abs prize empty') p.className = 'abs prize empty';   // та же надпись, что «Сделай ставку» (размер, пульс), только внутри — обратный отсчёт
  t2Html(p, `<span class="xf">0:${String(Math.ceil(left)).padStart(2, '0')}</span>`);
}
// разметка меняется, только если текст другой: опрос идёт 4 раза в секунду, пересборка без нужды — лишняя работа телефону
function t2Html(el, h){ if (el.innerHTML !== h) el.innerHTML = h; }
// вход в tab2 и выход: автолистание стоп/старт, ставка, надписи
function t2Enter(){ t2GlowPatch(); clearInterval(auto); t2Prev = { ton: S.ton, gifts: S.gifts }; S.ton = t2Fee; S.gifts = []; renderSlots(); $('giftCnt').hidden = true; t2Main = S.tier; _setTier(t2Tier); if (tierOfTicket(t2Ticket) !== t2Tier) t2Ticket = TIERS[t2Tier].from; t2Smoke(true); t2Ava(t2Me()); renderBet(); t2Show(); t2Sync(); }   // вернулся на арену, а ты в комнате — снова аватарка и банк
function t2Leave(){ if (t2Prev){ S.ton = t2Prev.ton; S.gifts = t2Prev.gifts.filter(g => INV.includes(g)); t2Prev = null; } t2Ava(false); t2Smoke(false); t2Tier = S.tier; renderBet(); setTier(t2Main ?? S.tier, { keepPrize: false }); restartAuto(); }
// комната: таймер — до её старта; разыграна — открываем следующую (экран итога для tab2 — следующий шаг)
function t2Apply(room){ const was = t2Me(); t2Room = room; t2End = room?.endsAt || 0;
  if (was !== t2Me()){ t2Ava(t2Me()); renderBet(true); } else if (t2Me() && $('bet').querySelector('.ton').textContent !== fmt(room.bank)) renderBet(true);
  t2Seats(t2Quiet); t2Quiet = false; }
let t2Ver = 0, t2Joining = false;   // t2Ver растёт при входе: ответ опроса, ушедшего раньше входа, уже устарел — его не применяем
async function t2Sync(){ if (t2Busy || t2Go || t2Joining) return; t2Busy = true; const ver = t2Ver;
  try { let room = t2Room ? await API.pvpState(t2Fee) : null;
    if (room?.state === 'done' && room.my){ t2Go = true; t2Busy = false; return t2Fight(room); }
    if (!room || room.state !== 'open') room = await API.pvpOpen(t2Fee); if (ver === t2Ver && !t2Joining && (isT2() || t2Me())) t2Apply(room); } finally { t2Busy = false; if (ver !== t2Ver && !t2Joining) setTimeout(t2Sync); } }   // пока ходили, сменили комнату — сразу грузим новую
let t2Reveal = false;
const _reveal = reveal;   // перед каждым раскрытием убираем список игроков прошлого боя
reveal = (r, fast) => { $('fxPl')?.replaceChildren(); const p = _reveal(r, fast); if (t2Reveal){ t2Reveal = false; $('fxIn').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 }); $('fxIn').style.opacity = 1; } return p; };
// бой: ждём, пока закончится текущий крафт; если ты на другом табе — возвращаем в tab2; дальше — как в PvP
let t2Go = false;
function t2Fight(room){
  pvpWhenFree(async () => {
    if (openDrawer){ hideDrawer(); await wait(220); }   // бой начинается — все шторы и окна закрываем
    if ($('modal')?.classList.contains('on') && typeof closeModal === 'function') closeModal();
    if (!isT2()){ modeBusy = false; await switchMode('tab2'); }
    S.busy = true; CRAFT.classList.add('busy'); pvpGo = true; arenaOn = false;
    $('fxTop').style.visibility = 'hidden';   // ячейки тикета появятся вместе с раскрытием, не раньше
    await openFx(true, '', FIRE_GLOW);   // рамка раскрывается быстро — сразу заставка удара FX.gainTo = .55; $('fxIn').style.opacity = 0; t2Reveal = true;
    try { await pvpStart(room); } finally { t2Go = false; t2Room = null; t2End = 0; t2Ava(false); renderBet(); }   // дальше — следующая комната
  });
}
let t2Tick = 0;   // ты в комнате, но ушёл на крафт — комнату всё равно опрашиваем, бой начнётся
// экран боя/дропа поверх арены — арена под ним не звучит и не тратит силы: дым гаснет, зрители и места на паузе, комнату не опрашиваем (если ты не в ней)
const t2Hidden = () => $('fx').classList.contains('on');
setInterval(() => { if (t2Go && openDrawer) hideDrawer();   // во время боя шторы не открываются
  const hid = isT2() && t2Hidden(); document.body.classList.toggle('t2fxon', hid);
  t2Smoke(isT2() && !hid && !modeBusy);   // дым включаем после перехода — переход не дёргается; вне арены — на паузе
  if (!isT2() || hid){ if (t2Me() && ++t2Tick % 4 === 0) t2Sync(); return; } t2Show(); t2ArrowsSync(); if (!t2Room || (t2End && Date.now() >= t2End) || ++t2Tick % 4 === 0) t2Sync(); }, 250);   // один таймер на арену (стрелки — здесь же)   // раз в секунду — свежий банк
// в кнопке: аватарка вместо молота с наковальней — ты в комнате
function t2Ava(on){ CB.classList.toggle('t2in', on); if (on && !CB.querySelector('.t2ava')) CB.insertAdjacentHTML('beforeend', `<img class="t2ava" src="assets/avatar.webp" alt="">`); }
CB.insertAdjacentHTML('beforeend', `<img class="t2lockico" src="assets/lock.svg" alt="">`);   // за 5 с до старта — замок вместо щита с мечом (и вместо аватарки)
// тап по наковальне / ставке: в tab2 крафт не начинаем — входим в комнату с выбранным тикетом
const _craftClick = $('craft').onclick;
$('craft').onclick = async () => {
  if (!isT2()) return _craftClick();
  if (t2Joining || !t2Room){ if (hamAnim) settle(); return; }
  // уже в комнате: тап по кнопке или плашке — короткое напоминание, как выиграть, и сколько до старта (кнопка отзывается толчком)
  if (t2Me()){ if (hamAnim) settle(); haptic('light'); CB.animate([{ scale: 1 }, { scale: .92 }, { scale: 1 }], { duration: 220, easing: 'ease-out' });
    const left = t2End ? Math.max(0, Math.ceil((t2End - Date.now()) / 1000)) : 0;
    notify({ type: 'info', icon: 'fire', key: 't2wait', title: left ? $t("Ты в бою · старт через 0:{0}", String(left).padStart(2, '0')) : $t("Ты в бою"), text: $t("Чей тикет окажется ближе — тот крафтит на весь банк") }); return; }
  if (t2Locked() || t2Full()){ if (hamAnim) settle(); haptic('rigid'); notify({ type: 'err', icon: 'fire', title: t2Full() ? $t("Арена заполнена") : $t("Комната уже стартует"), text: $t("Следующая откроется сразу после старта") }); return; }
  strike(.6, REST + 8).then(settle);   // удар мечом по щиту — как молотом по наковальне на крафте
  if (t2Fee > S.balance){ haptic('rigid'); notify({ type: 'err', icon: 'coin', title: $t("Недостаточно GRAM"), text: $t("Пополни баланс — тапни по нему сверху") }); return; }
  t2Joining = true; CB.classList.add('t2wait'); let r;   // пока сервер отвечает — кнопка в ожидании
  try { r = await API.pvpJoin(t2Fee, t2Ticket); } catch(_){ r = { ok: false, error: 'net' }; } finally { t2Joining = false; t2Ver++; CB.classList.remove('t2wait'); }
  if (!r.ok){ haptic('rigid'); notify({ type: 'err', icon: 'fire', title: r.error === 'taken' ? $t("Этот тикет уже занят") : r.error === 'full' ? $t("Арена заполнена") : $t("Комната уже стартует"), text: r.error === 'taken' ? $t("Сдвинь ползунок или выбери случайный") : r.error === 'full' ? $t("Следующая откроется сразу после старта") : $t("Открываем следующую") }); if (r.error !== 'taken') t2Sync(); return; }
  setBalance(S.balance - t2Fee); haptic('medium'); Sfx.coin(); t2Apply(r.room);
  notify({ type: 'ok', icon: 'ok', title: $t("Ты на арене"), text: $t("Крути колесо и угадай тикет — самый близкий крафтит на весь банк") });
  CB.animate([{ scale: .85 }, { scale: 1.08 }, { scale: 1 }], { duration: 360, easing: 'cubic-bezier(.3,1.4,.5,1)' });
};
// уже в комнате: новый тикет с колеса отправляем, когда палец отпустил (как в PvP); за 5 с до старта тикет зафиксирован
function t2Change(){ if (!t2Me() || t2Locked()) return; clearTimeout(t2Change.t);
  t2Change.t = setTimeout(async () => { const r = await API.pvpChange(t2Fee, t2Ticket).catch(() => ({ ok: false })); if (r.ok) return t2Apply(r.room); haptic('rigid');
    const me = t2Room?.entries.find(x => x.me); if (me){ t2Ticket = me.guess; _setTier(tierOfTicket(me.guess)); t2Show(); } }, 450); }
// фон при нажатии на наковальню: на главной рамка вспыхивает цветом ранга и уходит в огонь кузни, в tab2 — сразу оранжево-красный, как кнопка
const T2_GLOW = ['#ff5a1f', '#b8280a', '#ff9a5c', '#ffd2b8'];
let t2Glow = false;   // FullGlow объявлен позже (18-glow-start) — подменяем при первом входе в tab2
function t2GlowPatch(){ if (t2Glow) return; t2Glow = true; const set = FullGlow.set;
  // только старт боя (NEUTRAL или мгновенная установка) — цвета арены; цвета рангов при раскрытии — свои.
  // Цвета рамки панели (closeFx при возврате с итога) не подменяем — иначе в момент подмены рамка перекрашивалась
  FullGlow.set = (c, now, tau) => set(isT2() && (c === NEUTRAL || (now === true && c !== Glow.get())) ? T2_GLOW : c, now, tau); }

/* колесо тикета внизу — как в PvP, только проще: цельный круг, ранг — 72°, цвет — градиент плашки шанса этого ранга.
   Дуга проходит под круглыми кнопками, не задевая их. Стрелка — белый треугольник от низа плашки ставки */
const T2W = { R: 210, B: 44, top: 16 };   // радиус внешнего края, толщина кольца, отступ кольца от низа ставки (px)
const t2Wheel = (() => {
  const { R, B, top } = T2W, cx = 195, cy = top + R, rm = R - B / 2, seg = 360 / TIERS.length, pt = (a, r) => { const q = (a - 90) * Math.PI / 180; return [cx + Math.cos(q) * r, cy + Math.sin(q) * r]; };
  let defs = '', g = '';
  TIERS.forEach((t, i) => { const a0 = i * seg, a1 = (i + 1) * seg + .5, [x0, y0] = pt(a0, rm), [x1, y1] = pt(a1, rm);   // +.5° — внахлёст, без щели между рангами
    defs += `<linearGradient id="t2g${i}" gradientUnits="userSpaceOnUse" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"><stop offset="0" stop-color="${t.a}"/><stop offset="1" stop-color="${t.b}"/></linearGradient>`;
    const [p0x, p0y] = pt(a0, R), [p1x, p1y] = pt(a1, R);
    g += `<path d="M${cx} ${cy}L${p0x.toFixed(1)} ${p0y.toFixed(1)}A${R} ${R} 0 0 1 ${p1x.toFixed(1)} ${p1y.toFixed(1)}Z" fill="url(#t2g${i})"/>`; });
  // диск — отдельный слой (div с картинкой круга), крутим его целиком: поворот делает видеокарта.
  // Раньше крутилась группа внутри SVG — iPhone перерисовывал весь круг с градиентами каждый кадр, колесо лагало
  const el = document.createElement('div'); el.className = 'abs t2w'; el.id = 't2Wheel';
  el.innerHTML = `<div class="t2disc" id="t2Wg" style="left:${cx - R}px;top:${cy - R}px;width:${2 * R}px;height:${2 * R}px"><svg viewBox="${cx - R} ${cy - R} ${2 * R} ${2 * R}" aria-hidden="true"><defs>${defs}</defs>${g}</svg></div>` +
    `<svg class="t2ptr" viewBox="0 0 390 100" aria-hidden="true"><path class="t2p" d="M${cx - 10} 0h20l-10 28z"/></svg>`;
  $('bet').parentNode.appendChild(el); return el;
})();
let t2Deg = 0;   // угол колеса — копится без обрезки, чтобы при переходе через 0 оно не крутилось назад через весь круг
function t2Turn(){ if (t2Wheel.classList.contains('drag') || t2Wheel.classList.contains('spin')) return;
  const d = tkDeg(t2Ticket); t2Deg += ((d - t2Deg) % 360 + 540) % 360 - 180; $('t2Wg').style.transform = `rotate(${(-t2Deg).toFixed(3)}deg)`; }
// тикет с колеса: ранг сверху подсвечивается сам, тикет не сбрасывается на начало ранга
function t2Set(n){ if (t2Locked() || !isT2()) return;   // ушёл с арены, а колесо ещё крутится — главный экран не трогаем
  n = Math.max(0, Math.min(TICKETS - 1, Math.round(n))); const ti = tierOfTicket(n), d0 = Math.floor(tkDeg(t2Ticket) / 2);
  const now = performance.now();
  t2Ticket = n; if (Math.floor(tkDeg(n) / 2) !== d0 && now - t2TickT > 30){ t2TickT = now; Sfx.tick(.35); }   // щелчок — не чаще раза в 30 мс: на быстром вращении их были десятки за кадр
  // смена ранга при вращении: приз крафта не рисуем (keepPrize), а число тикета и таймер возвращаем сразу — иначе на кадр мелькали «NFT» и множители крафта.
  // Ранг перерисовывает весь верх (подписи, шанс, цвет рамки) — на быстром вращении не чаще ~8 раз в секунду, последний — всегда (t2TierSoon)
  if (ti !== S.tier) t2TierSoon(ti);
  $('t2Wg').style.transform = `rotate(${(-t2Deg).toFixed(3)}deg)`; t2ShowSoon();
}
// пока колесо крутится, крупное число тикета перерисовываем не чаще ~11 раз в секунду (каждое движение пальца — лишняя
// перерисовка большого текста, на iPhone колесо подлагивало); последнее значение показывается всегда — по таймеру хвостом
let t2ShowT = 0, t2ShowTm = 0, t2TickT = 0, t2TierT = 0, t2TierTm = 0;
function t2TierSoon(ti){ const go = () => { t2TierT = performance.now(); const t = tierOfTicket(t2Ticket); if (t !== S.tier){ selHaptic(); setTier(t, { keepTicket: true, keepPrize: true }); t2ShowT = performance.now(); t2Show(); } };
  clearTimeout(t2TierTm); const dt = performance.now() - t2TierT; if (dt > 120) go(); else t2TierTm = setTimeout(go, 120 - dt); }
function t2ShowSoon(){ const now = performance.now(); clearTimeout(t2ShowTm);
  if (now - t2ShowT > 90){ t2ShowT = now; t2Show(); } else t2ShowTm = setTimeout(() => { t2ShowT = performance.now(); t2Show(); }, 90 - (now - t2ShowT)); }
{ const wh = t2Wheel; let drag = false, lx = 0, vel = 0, lt = 0, spin = 0, k = 1;
  // градусов колеса на пиксель пальца — меряем один раз при касании (замер размера на каждом движении заставлял пересчитывать раскладку)
  const pxDeg = () => k;
  wh.addEventListener('pointerdown', e => { if (S.busy) return; if (t2Locked()){ haptic('rigid'); return; } drag = true; k = 180 / Math.PI / (T2W.R * wh.getBoundingClientRect().width / 390); cancelAnimationFrame(spin); wh.classList.remove('spin'); lx = e.clientX; lt = performance.now(); vel = 0;
    wh.setPointerCapture(e.pointerId); wh.classList.add('drag'); clearInterval(auto); });
  wh.addEventListener('pointermove', e => { if (!drag) return; if (t2Locked() || !isT2()){ vel = 0; drag = false; wh.classList.remove('drag'); return; } const now = performance.now(), dd = -(e.clientX - lx) * pxDeg(); lx = e.clientX;
    t2Deg += dd; vel = vel * .6 + dd / Math.max(1, now - lt) * 1000 * .4; lt = now; t2Set(degTk(t2Deg)); });
  var up = () => { if (!drag) return; drag = false; wh.classList.remove('drag');
    if (Math.abs(vel) <= 20 || t2Locked() || !isT2()){ haptic('light'); t2Change(); return; }
    wh.classList.add('spin'); let last = performance.now();
    const step = now => { if (t2Locked() || !isT2()){ wh.classList.remove('spin'); return; } const dt = (now - last) / 1000; last = now; vel *= Math.pow(.04, dt); t2Deg += vel * dt; t2Set(degTk(t2Deg));
      if (Math.abs(vel) > 3 && !t2Locked()) spin = requestAnimationFrame(step); else { wh.classList.remove('spin'); haptic('light'); t2Change(); } };
    spin = requestAnimationFrame(step); };
  wh.addEventListener('pointerup', up); wh.addEventListener('pointercancel', up); }

// силуэт шлема гладиатора на пустом месте
const T2_HELM = `<img class="t2helm" src="assets/helm.svg" alt="">`;
/* зрители: за колизеем — кольца трибун с публикой (точки-головы приглушённых цветов, дальше — темнее), кое-где вспышки камер */
// маска трибун (.t2art): сверху тает 17%→31% высоты, по бокам — от 120 до 176 px от центра; координаты — в единицах svg (−200…600)
const t2MaskAt = (x, y) => { const lin = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a))), W = 152 * 800 / 198, px = Math.abs((x + 200) / 800 * W - W / 2);
  return lin((y + 200) / 800, .17, .31) * (1 - lin(px, 120, 176)); };
const T2_CROWD = (() => {
  let rnd = 7; const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647, cols = ['#b5652a', '#d9833a', '#8a4a22', '#e8a05a', '#a0502a', '#c9773a', '#6e3a1c', '#f0b06a'];   // зрители — оттенки оранжевого, в тон арене
  // «живые» зрители и вспышки — не по одному (анимация каждой точки внутри SVG перерисовывает весь колизей каждый кадр — грело iPhone),
  // а группами: каждая группа — свой слой, гаснет и загорается целиком (это делает видеокарта, без перерисовки)
  let s = `<svg class="ar-art t2crowd" viewBox="-200 -200 800 800" aria-hidden="true">`, flash = ['', ''], live = ['', '', ''], nl = 0, nf = 0;
  for (let k = 0; k < 6; k++){ const r = 224 + k * 16, n = Math.floor(2 * Math.PI * r / 22), op = (.66 - k * .08).toFixed(2);
    s += `<circle cx="200" cy="200" r="${r + 6}" fill="none" stroke="rgba(40,26,16,${(.55 - k * .06).toFixed(2)})" stroke-width="15"/><g opacity="${op}">`;
    for (let i = 0; i < n; i++){ if (R() < .3) continue; const a = (i + R() * .4) / n * 2 * Math.PI, rr = r + R() * 4;
      const x = (200 + Math.cos(a) * rr).toFixed(1), y = (200 + Math.sin(a) * rr).toFixed(1);
      // каждый четвёртый зритель то уходит, то возвращается — места на трибунах живут
      const dot = `<circle cx="${x}" cy="${y}" r="${(3 + R() * 1.2).toFixed(1)}" fill="${cols[Math.floor(R() * cols.length)]}"`;
      // живые зрители и вспышки — в своём слое без маски: их мерцание не заставляет телефон каждый кадр пересобирать замаскированные трибуны.
      // Таять к краям им помогает своя прозрачность — ровно та, что дала бы маска трибун в этой точке (см. .t2art в styles.css)
      const ma = t2MaskAt(+x, +y), lv = R() < .3, fl = R() < .03;   // мерцает почти треть зрителей — заметно
      if (lv && ma > .05) live[nl++ % 3] += `${dot} opacity="${(op * ma).toFixed(2)}"/>`; else s += dot + '/>';
      if (fl && ma > .05) flash[nf++ % 2] += `<circle cx="${x}" cy="${y}" r="6" fill="#fff" opacity="${ma.toFixed(2)}"/>`; }
    s += `</g>`; }
  const layer = (cls, body) => `<svg class="ar-art t2crowd ${cls}" viewBox="-200 -200 800 800" aria-hidden="true">${body}</svg>`;
  return { still: s + `</svg>`, live: live.map((b, i) => layer('t2fan f' + i, b)).join('') + flash.map((b, i) => layer('t2flash f' + i, b)).join('') };
})();
/* арена: крупный колизей (тот же вектор, что в PvP) на месте приза — кольцо таймера вокруг, дым Горна по краям, 4 места соперников в ряд */
const T2A = { y: 492, r: 152, ring: 138, slots: 5, seat: 60, gap: 18, rows: [[2, -36], [3, 38]] };   // центр по высоте, радиус колизея, кольцо таймера; места: размер, зазор, ряды [сколько, сдвиг по высоте]
const t2Arena = (() => {
  const el = document.createElement('div'); el.className = 'abs t2a'; el.id = 't2Arena'; el.style.setProperty('--r', T2A.r + 'px'); el.style.top = T2A.y + 'px';
  const C = 2 * Math.PI * T2A.ring, d = T2A.ring * 2 + 20;
  el.innerHTML = `<div class="t2art">${T2_CROWD.still}${ARENA_SVG}</div><div class="t2art t2live">${T2_CROWD.live}</div><div class="t2fx" id="t2Fx"></div>` +
    `<svg class="t2ring" viewBox="0 0 ${d} ${d}" style="width:${d}px;height:${d}px"><circle class="ar-tbg" cx="${d / 2}" cy="${d / 2}" r="${T2A.ring}"/>` +
    `<circle class="ar-tfg" id="t2Ring" cx="${d / 2}" cy="${d / 2}" r="${T2A.ring}" transform="rotate(-90 ${d / 2} ${d / 2})" style="stroke-dasharray:${C.toFixed(1)}"/></svg>` +
    `<div class="t2seats" id="t2Seats">${T2A.rows.flatMap(([n, dy], ri) => Array.from({ length: n }, (_, i) => { const x = (i - (n - 1) / 2) * (T2A.seat + T2A.gap);
      return `<span class="ar-seat empty" style="left:${x}px;top:${dy}px;--d:${((ri * 2 + i) * .35).toFixed(2)}s">${T2_HELM}</span>`; })).join('')}</div>`;
  $('bet').parentNode.insertBefore(el, $('prize')); return el;
})();
/* «запекание» арены: неподвижная часть (трибуны с неподвижными зрителями и колизей — ~490 векторных элементов с градиентами и маской)
   один раз рисуется в картинку, пока приложение простаивает после запуска. При входе на арену телефону нужно показать готовую картинку,
   а не обсчитать и нарисовать сотни фигур — без чёрного экрана и просадки. Огонь в центре — отдельный маленький слой поверх
   (мерцает весь слой — анимацию считает видеокарта). Не вышло (старый браузер) — остаётся вектор, как раньше */
async function t2Bake(){
  const art = t2Arena.querySelector('.t2art:not(.t2live)'); if (!art || art.dataset.baked) return;
  const svgs = [...art.querySelectorAll(':scope > svg')]; if (!svgs.length) return;
  try {
    const N = Math.round(T2A.r * 800 / 198 * Math.min(2, devicePixelRatio || 1)), cv = document.createElement('canvas'); cv.width = cv.height = N;
    const ctx = cv.getContext('2d'); let fire = '';
    for (const sv of svgs){
      const c = sv.cloneNode(true); c.querySelectorAll('.ar-torch').forEach(x => x.remove());   // факелы на арене скрыты
      const f = c.querySelector('.ar-fire');
      if (f){ const g = c.querySelector('#arFire'); f.removeAttribute('class');
        fire = `<svg class="ar-art t2fire" viewBox="${c.getAttribute('viewBox')}" aria-hidden="true"><defs>${g ? g.outerHTML : ''}</defs>${f.outerHTML}</svg>`; f.remove(); }
      c.setAttribute('width', N); c.setAttribute('height', N);
      const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c));
      await im.decode(); ctx.drawImage(im, 0, 0, N, N);
    }
    // готовый холст и есть картинка — без перекодирования в webp (кодирование занимало сотни мс главного потока)
    cv.className = 'ar-art t2baked'; cv.setAttribute('aria-hidden', 'true');
    svgs.forEach(x => x.remove()); art.prepend(cv); if (fire) art.insertAdjacentHTML('beforeend', fire); art.dataset.baked = '1';
  } catch(_){}
}
// прогрев: после запекания один раз невидимо раскладываем экраны Арены и Ставок — первый вход в режим без пустого кадра
// (картинки декодированы, раскладка посчитана; повторные входы и так быстрые)
async function modesWarm(){ await t2Bake(); if (document.body.classList.contains('mode-tab2') || document.body.classList.contains('mode-tab3')) return;
  document.body.classList.add('warm'); document.body.offsetWidth;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); document.body.classList.remove('warm'); }
setTimeout(() => (window.requestIdleCallback || (f => f()))(modesWarm, { timeout: 3000 }), 1500);
let t2SeatIds = [];
// дым у трибун — клубы-картинки, плавают сами (smokePuffs, 16a-pvp.js); в экономном режиме и вне арены — скрыт
function t2Smoke(on){ const box = $('t2Fx'), show = on && !S.lite; if (!box.childElementCount && !show) return; smokePuffs(box);
  if (box.hidden === !show) return; box.hidden = !show; box.getAnimations({ subtree: true }).forEach(a => show ? a.play() : a.pause()); }   // скрыт — анимации клубов на паузе
// за 5 с до старта закрыто для всех: колесо, ранги и вход (кнопка и ставка приглушены); бой начался — тем, кто не в нём, сразу открывается следующая комната
function t2Ring(){ t2Wheel.classList.toggle('locked', t2Locked()); document.body.classList.toggle('t2lock', t2Locked() || t2Full()); if (!!$('bet').dataset.full !== t2Full()) renderBet(); const left = t2End ? Math.max(0, (t2End - Date.now()) / 1000) : PVP_TIME, C = 2 * Math.PI * T2A.ring, hot = t2End > 0 && left <= 5;
  $('t2Ring').style.strokeDashoffset = (C * (1 - Math.min(1, left / PVP_TIME))).toFixed(1); t2Arena.classList.toggle('hot', hot); }
// места соперников: по порядку входа; новенький — с лёгким «пружинящим» появлением
let t2Quiet = false;
function t2Seats(quiet){
  const others = (t2Room?.entries || []).filter(x => !x.me).slice(0, T2A.slots), box = $('t2Seats');
  for (let i = 0; i < T2A.slots; i++){ const x = others[i], id = x ? x.who : '', el = box.children[i]; if (t2SeatIds[i] === id) continue; t2SeatIds[i] = id;
    el.className = 'ar-seat ' + (x ? 'taken' : 'empty'); el.innerHTML = x ? pvpAva(x) + `<small>${x.who}</small>` : T2_HELM;
    if (x && !S.lite && !t2Hidden() && !quiet){ el.animate([{ scale: .3, opacity: 0 }, { scale: 1.15, opacity: 1, offset: .6 }, { scale: 1 }], { duration: 420, easing: 'cubic-bezier(.3,1.5,.5,1)' }); Sfx.coin(); haptic('light'); } }
}
// кнопка подарков в tab2 и tab3 — «Честность»: значок «i» в круге, открывает правила комнаты и хеш её зерна
$('giftBtn').insertAdjacentHTML('beforeend', `<svg class="t2shield" viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="12.5" stroke="#fff" stroke-width="2.66667"/><circle cx="24" cy="17.9" r="1.8" fill="#fff"/><path d="M24 22.6v8" stroke="#fff" stroke-width="2.66667" stroke-linecap="round"/></svg>`);
$('giftBtn').addEventListener('click', e => { if (!isT2()) return; e.stopImmediatePropagation(); if (!t2Room) return;
  const v = pvpView; pvpView = t2Room; try { arenaRules(); } finally { pvpView = v; } }, true);
// экран проигрыша: «Снова на арену» — просто закрыть итог, арена и есть tab2; «На главную» — закрыть и перейти на крафт
const _backToArena = backToArena, _pvpLoseDrop = pvpLoseDrop;
// новую комнату грузим, пока экран итогов ещё закрывает арену: иначе при возврате на миг видна сыгранная (серая, закрытая) комната
const t2Close = async () => { haptic(); await Promise.race([Promise.resolve(t2Sync()), wait(450)]); t2Show(); t2ArrowsSync(); await closeFx(); CRAFT.classList.remove('busy'); S.busy = false; t2Sync(); };
backToArena = () => isT2() ? t2Close() : _backToArena();
pvpLoseDrop = r => { _pvpLoseDrop(r); };
// тикет зафиксирован — свайп по рангам на сцене не начинается (иначе полоска под рангами тянулась за пальцем)
$('scene').addEventListener('pointerdown', e => { if (isT2() && t2Locked() && !e.target.closest('button:not(.tier), .bar, .bet, #t2Wheel')){ e.stopImmediatePropagation(); haptic('rigid'); } }, true);

// стрелки комнат: ∨ дешевле, ∧ дороже — как барабан взноса (вверх — дороже). Пока ты в комнате — скрыты (ты всегда в одной комнате, бой не теряется); по краям — тусклые
const t2Arrows = (() => {
  const mk = (id, d) => { const b = document.createElement('button'); b.className = 'abs t2arr'; b.id = id; b.setAttribute('aria-label', d < 0 ? $t("Дешевле") : $t("Дороже"));
    b.innerHTML = svg(d < 0 ? '<path d="M5 9l7 7 7-7"/>' : '<path d="M5 15l7-7 7 7"/>'); b.onclick = () => t2Room2(d); $('bet').parentNode.appendChild(b); return b; };
  return [mk('t2Prev', -1), mk('t2Next', 1)];
})();
function t2ArrowsSync(){ const i = PVP_FEES.indexOf(t2Fee), hide = t2Me() || t2Locked() || t2Go;
  const set = (el, k, v) => { if (el[k] !== v) el[k] = v; };   // только если поменялось — иначе каждый опрос будит пересчёт стилей
  set(t2Arrows[0], 'hidden', hide); set(t2Arrows[1], 'hidden', hide); set(t2Arrows[0], 'disabled', i <= 0); set(t2Arrows[1], 'disabled', i >= PVP_FEES.length - 1); }
function t2Room2(d){
  const i = PVP_FEES.indexOf(t2Fee) + d; if (i < 0 || i >= PVP_FEES.length || t2Me() || t2Joining){ haptic('rigid'); return; }
  t2Fee = PVP_FEES[i]; S.ton = t2Fee; haptic('light'); Sfx.tick(.5);
  t2Ver++; t2Quiet = true;   // старая комната остаётся на экране, пока не придёт новая: таймер не прыгает, места новой встают без анимации входа
  // плашка остаётся на месте: число меняется, как цифры на барабане — старое уходит вверх (вниз — при «назад»), новое выезжает с другой стороны; плашка — лёгкий толчок
  const b = $('bet'), old = b.querySelector('.ton'), r0 = old?.getBoundingClientRect(), br = b.getBoundingClientRect();
  renderBet(); const nw = b.querySelector('.ton');
  if (old && nw && !S.lite){
    const ghost = old.cloneNode(true); ghost.classList.add('t2ghost'); b.appendChild(ghost);
    ghost.style.left = (r0.left - br.left) / K + 'px'; ghost.style.top = (r0.top - br.top) / K + 'px';
    ghost.animate([{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: `0 ${-d * 26}px` }], { duration: 200, easing: 'cubic-bezier(.5,0,.8,.5)', fill: 'forwards' }).onfinish = () => ghost.remove();
    nw.animate([{ opacity: 0, translate: `0 ${d * 26}px` }, { opacity: 0, translate: `0 ${d * 26}px`, offset: .3 }, { opacity: 1, translate: '0 0' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.15)' });
    b.animate([{ scale: 1 }, { scale: .96, offset: .3 }, { scale: 1 }], { duration: 320, easing: 'cubic-bezier(.3,1.4,.5,1)' });
  }
  t2ArrowsSync(); t2Show(); t2Sync();
}
// в Арене свайп по экрану не листает ранги — он крутит колесо (в любом месте); ранги — только тапом
$('scene').addEventListener('pointerdown', e => {
  if (!isT2() || S.busy || e.target.closest('button, .tier, .bar, .bet, .live, #t2Wheel, #modes')) return;
  e.stopImmediatePropagation();
  t2Wheel.dispatchEvent(new PointerEvent('pointerdown', { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, bubbles: true }));
}, true);
