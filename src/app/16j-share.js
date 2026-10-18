/* =========================================================
   ШЕРИНГ ВЫИГРЫША — картинка 1080×1350 (подходит и для чата, и для истории) + текст по поводу, всегда с реф-ссылкой.
   Картинка — как карточка подарка, только крупно: фон и узор подарка, сам скин, название, «Скрафтил в Pawn» и котелок.
   «Отправить в Telegram» — сервер готовит сообщение с картинкой и кнопкой «Играть» (savePreparedInlineMessage),
   Telegram сам открывает выбор чата (WebApp.shareMessage). Без сервера (мок, браузер) — старый способ ссылкой.
   Тексты — из «Pawn: развитие и метрики» (раздел «Шеринг»)
   ========================================================= */
const SHW = 1080, SHH = 1350;
let shCtx = null, shImg = '';
const shLoad = (src, cors) => new Promise(ok => { if (!src) return ok(null); const im = new Image(); if (cors) im.crossOrigin = 'anonymous';
  const t = setTimeout(() => ok(null), 4000); im.onload = () => { clearTimeout(t); ok(im); }; im.onerror = () => { clearTimeout(t); ok(null); }; im.src = src; });
const shBrag = m => m.text.split('\n')[0];   // первая строка — для шеринга ссылкой (приглашение shareWin допишет сам)
const shLines = (...a) => a.join('\n');      // текст сообщения — короткими строками с эмодзи

// что за повод: фон, приз, название, заголовок и текст сообщения (подстановки — как в документе)
function shareModel(c){
  const L = REF.link, rankBg = C => [hexMix(C, '#ffffff', .12), hexMix(C, '#000000', .55), '#ffffff'];
  if (c.kind === 'case'){ const g = c.g, it = c.it, prize = g ? `${g.nft.name} #${g.num}` : itemName(it);
    return { nft: g, bg: g ? g.nft.bg : rankBg(itemColor(it)), img: g ? null : itemImg(it), title: g ? prize : itemName(it), head: $t("Выбил в Pawn"),
      text: shLines($t("📦 Открыл {0} и выбил {1} в Pawn!", c.c.name, prize), $t("🆓 Бесплатные кейсы — за задания дня 👉 {0}", L)) }; }
  const r = c.r, t = TIERS[r.ti], stake = fmt(r.stake), win = fmt(r.win);
  const base = { nft: r.nft, bg: r.nft ? r.nft.nft.bg : rankBg(t.c), img: null, title: r.nft ? `${r.nft.nft.name} #${r.nft.num}` : `${win} GRAM` };
  if (r.pvp?.won) return { ...base, head: $t("Победил на Арене Pawn"),
    text: shLines($t("⚔️ Забрал банк Арены Pawn — {0} GRAM у {1} соперников!", fmt(r.pvp.bank), r.pvp.n - 1), $t("🛡 Сразись со мной 👉 {0}", L)) };
  if (r.bets) return { ...base, head: $t("Выиграл в Pawn"),
    text: r.nft ? shLines($t("🔮 Выбил {0} на Ставках в Pawn!", r.nft.nft.name), $t("💎 Поставил {0} GRAM — забрал подарок", stake), $t("👉 Попробуй сам: {0}", L))
      : shLines($t("🔮 Ставки в Pawn: {0} → {1} GRAM", stake, win), $t("🎁 Забирай +10% к первому пополнению 👉 {0}", L)) };
  if (r.ti === 4) return { ...base, head: $t("Скрафтил в Pawn"),
    text: shLines($t("🎰 Джекпот ×{0} в Pawn!", r.mult), $t("💎 Поставил {0} — забрал {1} GRAM", stake, win), $t("🔐 Каждый исход можно проверить — попробуй сам 👉 {0}", L)) };
  if (r.nft) return { ...base, head: $t("Скрафтил в Pawn"),
    text: shLines($t("🎁 Выбил {0} за {1} GRAM в Pawn!", r.nft.nft.name, stake), $t("💎 Ставь GRAM или свои подарки — забирай подарки подороже"), $t("👉 {0}", L)) };
  return { ...base, head: $t("Скрафтил в Pawn"),
    text: shLines($t("🔥 {0} ×{1} в Pawn: {2} → {3} GRAM", t.name, r.mult, stake, win), $t("🎁 Забирай +10% к первому пополнению 👉 {0}", L)) };
}

// узор как у коллекционных подарков: символ кольцами вокруг скина, к краю мельче и прозрачнее
function shPattern(x, im, color, cx, cy){
  const t = document.createElement('canvas'); t.width = t.height = 128; const q = t.getContext('2d');
  q.drawImage(im, 0, 0, 128, 128); q.globalCompositeOperation = 'source-in'; q.fillStyle = color; q.fillRect(0, 0, 128, 128);
  [[340, 8, 118, .3], [490, 12, 98, .23], [640, 16, 80, .16], [790, 20, 66, .11], [940, 24, 56, .07]].forEach(([R, n, s, o], ri) => {
    x.globalAlpha = o;
    for (let k = 0; k < n; k++){ const a = (k + (ri % 2) * .5) / n * Math.PI * 2; x.drawImage(t, cx + Math.cos(a) * R - s / 2, cy + Math.sin(a) * R - s / 2, s, s); } });
  x.globalAlpha = 1;
}

// крупная надпись в одну строку: уменьшаем шрифт, пока не влезет
function shFit(x, text, size, y){
  let s = size; do { x.font = `800 ${s}px SONGER`; } while (x.measureText(text).width > SHW - 120 && (s -= 4) > 40);
  x.fillText(text, SHW / 2, y);
}

// рисуем картинку
async function shareDraw(m){
  await document.fonts.load('800 120px SONGER').catch(() => {});
  const cv = document.createElement('canvas'); cv.width = SHW; cv.height = SHH; const x = cv.getContext('2d'), [c0, c1, cp] = m.bg, cx = SHW / 2, cy = 590;
  // фон подарка на всю картинку
  const g = x.createRadialGradient(cx, cy, 40, cx, cy, 980); g.addColorStop(0, c0); g.addColorStop(1, c1);
  x.fillStyle = g; x.fillRect(0, 0, SHW, SHH);
  // узор: символ подарка; у GRAM и XP — гем
  const n = m.nft?.nft, sym = n ? await shLoad(n.sym, true) : await shLoad('assets/gem-white.svg');
  if (sym) shPattern(x, sym, cp || '#ffffff', cx, cy);
  // котелок Pawn сверху, позади скина — наложением
  const logo = await shLoad('assets/logo.svg'); if (logo){ const h = 140, w = logo.width / logo.height * h; x.globalCompositeOperation = 'overlay'; x.drawImage(logo, cx - w / 2, 50, w, h); x.globalCompositeOperation = 'source-over'; }
  // название и «Скрафтил в Pawn» — снизу, крупно, белым с тенью
  x.save(); x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 24; x.shadowOffsetY = 6;
  shFit(x, m.title.toUpperCase(), 116, 1150);
  x.globalAlpha = .85; shFit(x, m.head.toUpperCase(), 84, 1270); x.restore();
  // скин — максимально крупно и поверх всего
  const S = n ? 1060 : 900, my = n ? 620 : cy, im = n ? (await shLoad(hiSrc(n), true) || await shLoad(n.card, true) || await shLoad(FB[n.src] || n.src)) : await shLoad(m.img || 'assets/hero-gem.webp');
  if (im){ x.save(); x.shadowColor = 'rgba(0,0,0,.3)'; x.shadowBlur = 60; x.shadowOffsetY = 24; x.drawImage(im, cx - S / 2, my - S / 2, S, S); x.restore(); }
  return cv.toDataURL('image/jpeg', .88);
}

// шторка «Поделиться»
async function shareOpen(ctx){
  haptic(); shCtx = ctx; const m = shareModel(ctx);
  $('shareBody').innerHTML = `<div class="share-prev sk"></div>`;
  $('shareFoot').innerHTML = `<button class="btn-main" id="shSend">${$t("Отправить в Telegram")}</button><button class="btn-ghost" id="shLink">${$t("Поделиться ссылкой")}</button>`;
  showDrawer('shareDrawer'); track('share_open', { kind: ctx.kind });
  shImg = await shareDraw(m);
  $('shareBody').innerHTML = `<img class="share-prev" src="${shImg}" alt="">`;
  $('shSend').onclick = () => shareSend(m);
  $('shLink').onclick = () => { track('share', { kind: ctx.kind, how: 'link' }); shareWin(shBrag(m), m.nft); };
}
async function shareSend(m){
  const r = await btnWait($('shSend'), API.shareCard(shImg.split(',')[1], m.text, REF.link)); if (!r) return;
  if (!r.id || !window.Telegram?.WebApp?.shareMessage){ track('share', { kind: shCtx.kind, how: 'link' }); return shareWin(shBrag(m), m.nft); }   // мок или старый Telegram — ссылкой
  Telegram.WebApp.shareMessage(r.id, sent => { if (!sent) return; track('share', { kind: shCtx.kind, how: 'message' }); hideDrawer(); notify({ type: 'ok', icon: 'ok', title: $t("Отправлено"), text: $t("Спасибо, что делишься!") }); });
}
