/* загрузчик: картинки подарков берём с CDN changes.tg по одной, по мере надобности. Если CDN недоступен
   (например, в просмотрщике artifact внешние картинки закрыты) — подтягиваем запасные JSON со всеми картинками */
/* ловушка ошибок запуска: если приложение упало или не стартовало, на экране — красная плашка с текстом ошибки.
   Нужна для iPhone/Telegram «Reload Page», где после перезагрузки код не запускался, а консоли на телефоне нет */
(() => {
  // ошибки только копим; плашку показываем, лишь если приложение так и не запустилось (window.APP_OK) —
  // не загрузившийся, например, TON Connect работе не мешает, и пугать им не надо
  const list = [];
  const show = m => { if (m) list.push(m); if (window.APP_OK || !window.bootDone) return; let b = document.getElementById('oops');
    if (!b){ b = document.createElement('div'); b.id = 'oops'; b.style.cssText = 'position:fixed;left:8px;right:8px;top:110px;z-index:99999;padding:10px 12px;border-radius:14px;background:#ff4c35;color:#fff;font:600 13px/1.35 system-ui,sans-serif;word-break:break-word;white-space:pre-wrap'; document.body.appendChild(b); }
    b.textContent = 'Ошибка запуска\n' + list.join('\n') + '\n' + location.origin + location.pathname + ' · search ' + location.search.length + ' · hash ' + location.hash.length +
      ' · TG ' + !!window.Telegram + ' · proxy ' + !!window.TelegramWebviewProxy + ' · ' + innerWidth + '×' + innerHeight; };
  window.bootOops = show;
  addEventListener('error', e => { const t = e.target;
    if (t && t !== window && t.tagName !== 'SCRIPT') return;                        // картинки, которые не загрузились, — не ошибка запуска
    show(t && t.tagName === 'SCRIPT' ? 'не загрузился скрипт ' + (t.src || '') : (e.message || 'error') + ' @' + e.lineno + ':' + e.colno + (e.error && e.error.stack ? '\n' + String(e.error.stack).slice(0, 300) : '')); }, true);
  addEventListener('unhandledrejection', e => show('promise: ' + (e.reason && (e.reason.message || e.reason))));
})();
(async () => {
  const bar = document.getElementById('bootBar'), set = k => { if (bar) bar.style.width = (k * 100).toFixed(0) + '%'; };
  async function load(url, w0, w1){
    const r = await fetch(url); if (!r.ok) throw new Error(r.status);
    const total = +r.headers.get('content-length') || 0, rd = r.body && total ? r.body.getReader() : null;
    if (!rd){ const j = await r.json(); set(w1); return j; }
    const parts = []; let got = 0;
    for (;;){ const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; set(w0 + (w1 - w0) * Math.min(1, got / total)); }
    return JSON.parse(new TextDecoder().decode(await new Blob(parts).arrayBuffer()));
  }
  try { if (localStorage.getItem('bm-lang') === 'en') document.querySelector('.boot-in b').textContent = 'Loading gifts'; } catch(_){}
  window.GIMG = {}; window.GSYM = {};
  window.CDN = await new Promise(res => { const im = new Image(), t = setTimeout(() => res(false), 2500);
    im.onload = () => { clearTimeout(t); res(true); }; im.onerror = () => { clearTimeout(t); res(false); };
    im.src = 'https://pawn-backend.onrender.com/api/media/gift?path=%2Fgifts%2Fmodels%2FBerry%2520Box%2Fpng%2FOriginal.png&size=128'; });
  if (!CDN) try {
    const [m, s] = await Promise.all([load('assets/g/models.json', 0, .85), load('assets/g/syms.json', .85, 1)]);
    // модели и символы — в разных словарях: ключ считается по имени, и модель с символом могут совпасть (Watermelon)
    const blobs = (src, dst) => { for (const [k, v] of Object.entries(src)){
      const bin = atob(v), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      dst[k] = URL.createObjectURL(new Blob([u8], { type: 'image/webp' })); } };
    blobs(m, GIMG); blobs(s, GSYM);
  } catch (e){ console.warn('gift images not loaded', e); }
  const app = document.createElement('script'); app.textContent = document.getElementById('app').textContent; document.body.appendChild(app);
  setTimeout(() => { if (!window.APP_OK){ window.bootDone = 1; window.bootOops('приложение не запустилось (нет APP_OK через 4 с)'); } }, 4000);
  const b = document.getElementById('boot'); b.classList.add('off'); setTimeout(() => b.remove(), 500);
})();
