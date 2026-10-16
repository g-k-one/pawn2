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
  $('range').innerHTML = `<span class="xf">${tk(t2Ticket)}</span>`; t2Turn();
  const left = t2End ? Math.max(0, (t2End - Date.now()) / 1000) : PVP_TIME, p = $('prize');   // никто не зашёл — таймер стоит на 0:30
  p.className = 'abs prize empty';   // та же надпись, что «Сделай ставку» (размер, пульс), только внутри — обратный отсчёт
  p.innerHTML = `<span class="xf">0:${String(Math.ceil(left)).padStart(2, '0')}</span>`;
}
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
  if (isT2()) t2Smoke(!hid && !modeBusy);   // дым включаем после перехода — переход не дёргается
  if (!isT2() || hid){ if (t2Me() && ++t2Tick % 4 === 0) t2Sync(); return; } t2Show(); if (!t2Room || (t2End && Date.now() >= t2End) || ++t2Tick % 4 === 0) t2Sync(); }, 250);   // раз в секунду — свежий банк
// в кнопке: аватарка вместо молота с наковальней — ты в комнате
function t2Ava(on){ CB.classList.toggle('t2in', on); if (on && !CB.querySelector('.t2ava')) CB.insertAdjacentHTML('beforeend', `<img class="t2ava" src="assets/avatar.webp" alt="">`); }
CB.insertAdjacentHTML('beforeend', `<img class="t2lockico" src="assets/lock.svg" alt="">`);   // за 5 с до старта — замок вместо щита с мечом (и вместо аватарки)
// тап по наковальне / ставке: в tab2 крафт не начинаем — входим в комнату с выбранным тикетом
const _craftClick = $('craft').onclick;
$('craft').onclick = async () => {
  if (!isT2()) return _craftClick();
  if (t2Me() || t2Joining || !t2Room){ if (hamAnim) settle(); return; }
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
  t2Change.t = setTimeout(async () => { const r = await API.pvpChange(t2Fee, t2Ticket); if (r.ok) return t2Apply(r.room); haptic('rigid');
    const me = t2Room?.entries.find(x => x.me); if (me){ t2Ticket = me.guess; _setTier(tierOfTicket(me.guess)); t2Show(); } }, 450); }
// фон при нажатии на наковальню: на главной рамка вспыхивает цветом ранга и уходит в огонь кузни, в tab2 — сразу оранжево-красный, как кнопка
const T2_GLOW = ['#ff5a1f', '#b8280a', '#ff9a5c', '#ffd2b8'];
let t2Glow = false;   // FullGlow объявлен позже (18-glow-start) — подменяем при первом входе в tab2
function t2GlowPatch(){ if (t2Glow) return; t2Glow = true; const set = FullGlow.set;
  FullGlow.set = (c, now) => set(isT2() && (c === NEUTRAL || now === true) ? T2_GLOW : c, now); }   // только старт крафта; цвета рангов при раскрытии — свои

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
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('class', 'abs t2w'); el.id = 't2Wheel'; el.setAttribute('viewBox', '0 0 390 100');
  el.innerHTML = `<defs>${defs}</defs><g id="t2Wg" style="transform-origin:${cx}px ${cy}px">${g}</g><path class="t2p" d="M${cx - 10} 0h20l-10 28z"/>`;
  $('bet').parentNode.appendChild(el); return el;
})();
let t2Deg = 0;   // угол колеса — копится без обрезки, чтобы при переходе через 0 оно не крутилось назад через весь круг
function t2Turn(){ if (t2Wheel.classList.contains('drag') || t2Wheel.classList.contains('spin')) return;
  const d = tkDeg(t2Ticket); t2Deg += ((d - t2Deg) % 360 + 540) % 360 - 180; $('t2Wg').style.transform = `rotate(${(-t2Deg).toFixed(3)}deg)`; }
// тикет с колеса: ранг сверху подсвечивается сам, тикет не сбрасывается на начало ранга
function t2Set(n){ if (t2Locked() || !isT2()) return;   // ушёл с арены, а колесо ещё крутится — главный экран не трогаем
  n = Math.max(0, Math.min(TICKETS - 1, Math.round(n))); const ti = tierOfTicket(n), d0 = Math.floor(tkDeg(t2Ticket) / 2);
  t2Ticket = n; if (Math.floor(tkDeg(n) / 2) !== d0) Sfx.tick(.35);
  if (ti !== S.tier){ selHaptic(); setTier(ti, { keepTicket: true }); }
  $('t2Wg').style.transform = `rotate(${(-t2Deg).toFixed(3)}deg)`; t2Show();
}
{ const wh = t2Wheel; let drag = false, lx = 0, vel = 0, lt = 0, spin = 0;
  const pxDeg = () => 180 / Math.PI / (T2W.R * wh.getBoundingClientRect().width / 390);   // градусов колеса на пиксель пальца
  wh.addEventListener('pointerdown', e => { if (S.busy) return; if (t2Locked()){ haptic('rigid'); return; } drag = true; cancelAnimationFrame(spin); wh.classList.remove('spin'); lx = e.clientX; lt = performance.now(); vel = 0;
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
const T2_CROWD = (() => {
  let rnd = 7; const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647, cols = ['#a0714a', '#7a5a9a', '#4a7a9a', '#9a4a4a', '#d0a878', '#5a8a5a', '#c08a5a', '#8a8a9a'];
  let s = `<svg class="ar-art t2crowd" viewBox="-200 -200 800 800" aria-hidden="true">`, flash = '', live = '';
  for (let k = 0; k < 6; k++){ const r = 224 + k * 16, n = Math.floor(2 * Math.PI * r / 22), op = (.66 - k * .08).toFixed(2);
    s += `<circle cx="200" cy="200" r="${r + 6}" fill="none" stroke="rgba(40,26,16,${(.55 - k * .06).toFixed(2)})" stroke-width="15"/><g opacity="${op}">`;
    for (let i = 0; i < n; i++){ if (R() < .3) continue; const a = (i + R() * .4) / n * 2 * Math.PI, rr = r + R() * 4;
      const x = (200 + Math.cos(a) * rr).toFixed(1), y = (200 + Math.sin(a) * rr).toFixed(1);
      // каждый четвёртый зритель то уходит, то возвращается — места на трибунах живут
      const dot = `<circle cx="${x}" cy="${y}" r="${(3 + R() * 1.2).toFixed(1)}" fill="${cols[Math.floor(R() * cols.length)]}"`;
      if (R() < .12) live += `${dot} opacity="${op}" class="t2fan" style="animation-duration:${(5 + R() * 6).toFixed(1)}s;animation-delay:-${(R() * 11).toFixed(1)}s"/>`; else s += dot + '/>';
      if (R() < .02) flash += `<circle class="t2flash" cx="${x}" cy="${y}" r="6" style="animation-delay:${(R() * 6).toFixed(2)}s"/>`; }
    s += `</g>`; }
  return s + `</svg><svg class="ar-art t2crowd" viewBox="-200 -200 800 800" aria-hidden="true">${live}${flash}</svg>`;
})();
/* арена: крупный колизей (тот же вектор, что в PvP) на месте приза — кольцо таймера вокруг, дым Горна по краям, 4 места соперников в ряд */
const T2A = { y: 492, r: 152, ring: 138, slots: 5, seat: 60, gap: 18, rows: [[2, -36], [3, 38]] };   // центр по высоте, радиус колизея, кольцо таймера; места: размер, зазор, ряды [сколько, сдвиг по высоте]
const t2Arena = (() => {
  const el = document.createElement('div'); el.className = 'abs t2a'; el.id = 't2Arena'; el.style.setProperty('--r', T2A.r + 'px'); el.style.top = T2A.y + 'px';
  const C = 2 * Math.PI * T2A.ring, d = T2A.ring * 2 + 20;
  el.innerHTML = `<div class="t2art">${T2_CROWD}${ARENA_SVG}</div><div class="t2fx" id="t2Fx"></div>` +
    `<svg class="t2ring" viewBox="0 0 ${d} ${d}" style="width:${d}px;height:${d}px"><circle class="ar-tbg" cx="${d / 2}" cy="${d / 2}" r="${T2A.ring}"/>` +
    `<circle class="ar-tfg" id="t2Ring" cx="${d / 2}" cy="${d / 2}" r="${T2A.ring}" transform="rotate(-90 ${d / 2} ${d / 2})" style="stroke-dasharray:${C.toFixed(1)}"/></svg>` +
    `<div class="t2seats" id="t2Seats">${T2A.rows.flatMap(([n, dy], ri) => Array.from({ length: n }, (_, i) => { const x = (i - (n - 1) / 2) * (T2A.seat + T2A.gap);
      return `<span class="ar-seat empty" style="left:${x}px;top:${dy}px;--d:${((ri * 2 + i) * .35).toFixed(2)}s">${T2_HELM}</span>`; })).join('')}</div>`;
  $('bet').parentNode.insertBefore(el, $('prize')); return el;
})();
let t2Fx = null, t2Forge = null, t2SeatIds = [];
function t2Smoke(on){ if (!on || S.lite){ t2Fx?.kill(); t2Fx = null; return; }
  if (!t2Forge){ t2Forge = makeForge($('t2Fx')); t2Forge.maxDpr = .6; }   // дым и так размытый — рисуем в 0.6 пикселя: вчетверо меньше работы, края мягче
  if (!t2Fx || !t2Fx.alive()){ const w = $('t2Fx').offsetWidth; if (!w) return; t2Fx = t2Forge.play('arena', { el: $('t2Fx'), loop: true, size: w * .72 }); t2Fx?.set('dense', 2.2); } }
// за 5 с до старта закрыто для всех: колесо, ранги и вход (кнопка и ставка приглушены); бой начался — тем, кто не в нём, сразу открывается следующая комната
function t2Ring(){ t2Wheel.classList.toggle('locked', t2Locked()); document.body.classList.toggle('t2lock', t2Locked() || t2Full()); if (!!$('bet').dataset.full !== t2Full()) renderBet(); const left = t2End ? Math.max(0, (t2End - Date.now()) / 1000) : PVP_TIME, C = 2 * Math.PI * T2A.ring, hot = t2End > 0 && left <= 5;
  $('t2Ring').style.strokeDashoffset = (C * (1 - Math.min(1, left / PVP_TIME))).toFixed(1); t2Arena.classList.toggle('hot', hot); t2Fx?.set('hot', hot ? 1 : 0); }
// места соперников: по порядку входа; новенький — с лёгким «пружинящим» появлением
let t2Quiet = false;
function t2Seats(quiet){
  const others = (t2Room?.entries || []).filter(x => !x.me).slice(0, T2A.slots), box = $('t2Seats');
  for (let i = 0; i < T2A.slots; i++){ const x = others[i], id = x ? x.who : '', el = box.children[i]; if (t2SeatIds[i] === id) continue; t2SeatIds[i] = id;
    el.className = 'ar-seat ' + (x ? 'taken' : 'empty'); el.innerHTML = x ? pvpAva(x) + `<small>${x.who}</small>` : T2_HELM;
    if (x && !S.lite && !t2Hidden() && !quiet){ el.animate([{ scale: .3, opacity: 0 }, { scale: 1.15, opacity: 1, offset: .6 }, { scale: 1 }], { duration: 420, easing: 'cubic-bezier(.3,1.5,.5,1)' }); Sfx.coin(); haptic('light'); } }
}
// кнопка подарков в tab2 — «Честность»: щит с галочкой, открывает правила комнаты и хеш её зерна
$('giftBtn').insertAdjacentHTML('beforeend', `<svg class="t2shield" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 12.5l10 4v7.5c0 5.6-4 9.6-10 12-6-2.4-10-6.4-10-12v-7.5z" stroke="#fff" stroke-width="2.66667" stroke-linejoin="round"/><path d="M19.5 24.5l3 3 6-6" stroke="#fff" stroke-width="2.66667" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
$('giftBtn').addEventListener('click', e => { if (!isT2()) return; e.stopImmediatePropagation(); if (!t2Room) return;
  const v = pvpView; pvpView = t2Room; try { arenaRules(); } finally { pvpView = v; } }, true);
// экран проигрыша: «Снова на арену» — просто закрыть итог, арена и есть tab2; «На главную» — закрыть и перейти на крафт
const _backToArena = backToArena, _pvpLoseDrop = pvpLoseDrop;
const t2Close = async () => { haptic(); await closeFx(); CRAFT.classList.remove('busy'); S.busy = false; t2Sync(); };
backToArena = () => isT2() ? t2Close() : _backToArena();
pvpLoseDrop = r => { _pvpLoseDrop(r); };
// тикет зафиксирован — свайп по рангам на сцене не начинается (иначе полоска под рангами тянулась за пальцем)
$('scene').addEventListener('pointerdown', e => { if (isT2() && t2Locked() && !e.target.closest('button:not(.tier), .bar, .bet, #t2Wheel')){ e.stopImmediatePropagation(); haptic('rigid'); } }, true);

// стрелки комнат: пока ты в комнате — скрыты (ты всегда в одной комнате, бой не теряется); по краям — тусклые
const t2Arrows = (() => {
  const mk = (id, d) => { const b = document.createElement('button'); b.className = 'abs t2arr'; b.id = id; b.setAttribute('aria-label', d < 0 ? $t("Назад") : $t("Дальше"));
    b.innerHTML = svg(d < 0 ? '<path d="M15 5l-7 7 7 7"/>' : '<path d="M9 5l7 7-7 7"/>'); b.onclick = () => t2Room2(d); $('bet').parentNode.appendChild(b); return b; };
  return [mk('t2Prev', -1), mk('t2Next', 1)];
})();
function t2ArrowsSync(){ const i = PVP_FEES.indexOf(t2Fee), hide = t2Me() || t2Locked() || t2Go;
  t2Arrows[0].hidden = t2Arrows[1].hidden = hide; t2Arrows[0].disabled = i <= 0; t2Arrows[1].disabled = i >= PVP_FEES.length - 1; }
function t2Room2(d){
  const i = PVP_FEES.indexOf(t2Fee) + d; if (i < 0 || i >= PVP_FEES.length || t2Me() || t2Joining){ haptic('rigid'); return; }
  t2Fee = PVP_FEES[i]; S.ton = t2Fee; haptic('light'); Sfx.tick(.5);
  t2Ver++; t2Quiet = true;   // старая комната остаётся на экране, пока не придёт новая: таймер не прыгает, места новой встают без анимации входа
  renderBet(true); $('bet').animate([{ translate: `${d * 14}px 0`, opacity: .4 }, { translate: '0 0', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.3,1.3,.5,1)' });
  t2ArrowsSync(); t2Show(); t2Sync();
}
setInterval(() => isT2() && t2ArrowsSync(), 250);
// в Арене свайп по экрану не листает ранги — он крутит колесо (в любом месте); ранги — только тапом
$('scene').addEventListener('pointerdown', e => {
  if (!isT2() || S.busy || e.target.closest('button, .tier, .bar, .bet, .live, #t2Wheel, #modes')) return;
  e.stopImmediatePropagation();
  t2Wheel.dispatchEvent(new PointerEvent('pointerdown', { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, bubbles: true }));
}, true);
