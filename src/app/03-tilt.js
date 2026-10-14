/* =========================================================
   ПСЕВДО-3D: карточки и NFT сами медленно поворачиваются, по ним едет голографическая фольга,
   картинка и узор фона смещаются в разные стороны (параллакс). Двигаем только transform и пару переменных у нескольких элементов
   ========================================================= */
const Tilt = (() => {
  const items = new Set();
  let ph = Math.random() * 10, last = 0, prev = 0;
  function frame(now){
    requestAnimationFrame(frame);
    const dt = prev ? Math.min(.1, (now - prev) / 1000) : 0; prev = now;
    // карточку крутят пальцем или она доворачивается обратно — тогда каждый кадр, даже в экономном режиме
    let hand = false;
    items.forEach(it => { if (!it.grab && (it.ux || it.uy)){ const f = Math.exp(-dt / .35); it.ux *= f; it.uy *= f; if (Math.abs(it.ux) + Math.abs(it.uy) < .003) it.ux = it.uy = 0; } if (it.grab || it.ux || it.uy) hand = true; });
    if (document.hidden || !items.size || (S.lite && !hand)) return;
    if (!hand && now - last < 32) return;        // 30 к/с хватает для медленного поворота — вдвое меньше работы
    last = now;
    const t = now / 1000;
    items.forEach(it => {
      if (!it.t.isConnected){ items.delete(it); return; }
      if (it.dr && !it.dr.classList.contains('open')) return;          // карточки в закрытой шторке не крутим
      // у каждой карточки свой сдвиг фазы — крутятся не синхронно; очень медленно (период ~9–12 с)
      const au = S.lite ? 0 : 1;                                       // в экономном режиме сама не крутится, только пальцем
      const x = Math.sin(t * .62 + it.o) * .75 * au + it.ux, y = Math.cos(t * .5 + it.o * 1.3) * .55 * au + it.uy, k = it.k;
      it.t.style.transform = `perspective(420px) rotateX(${(-y * 16 * k).toFixed(2)}deg) rotateY(${(x * 20 * k).toFixed(2)}deg)`;
      if (it.img) it.img.style.transform = `translate3d(${(x * 7 * k).toFixed(2)}px,${(y * 6 * k).toFixed(2)}px,0) scale(1.05)`;
      if (it.pat) it.pat.style.transform = `translate3d(${(-x * 4 * k).toFixed(2)}px,${(-y * 3 * k).toFixed(2)}px,0)`;
      // блик — мягкое пятно света, едет навстречу повороту (только transform, без перерисовки)
      if (it.gl) it.gl.style.transform = `translate3d(${(-x * 20).toFixed(1)}%,${(-7 - y * 15).toFixed(1)}%,0)`;
    });
  }
  requestAnimationFrame(frame);
  /* повернуть пальцем: тянешь — карточка следует, отпустил — плавно возвращается. Тап без сдвига — onTap */
  function grab(t, onTap){
    const it = [...items].find(i => i.t === t); if (!it) return;
    t.dataset.grab = 1;                                          // шторка не перехватывает этот жест как «закрыть»
    const cl = v => Math.max(-1.6, Math.min(1.6, v));
    let pid = null, x0 = 0, y0 = 0, u0 = 0, v0 = 0, moved = false;
    t.addEventListener('pointerdown', e => { pid = e.pointerId; x0 = e.clientX; y0 = e.clientY; u0 = it.ux; v0 = it.uy; moved = false; it.grab = true; try { t.setPointerCapture(pid); } catch(_){} });
    t.addEventListener('pointermove', e => { if (e.pointerId !== pid) return; const dx = (e.clientX - x0) / K, dy = (e.clientY - y0) / K;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true; if (!S.lite){ it.ux = cl(u0 + dx / 110); it.uy = cl(v0 + dy / 110); } });   // в экономном режиме не крутится — только тап
    const up = e => { if (e.pointerId !== pid) return; pid = null; it.grab = false; if (!moved && e.type === 'pointerup') onTap?.(); };
    t.addEventListener('pointerup', up); t.addEventListener('pointercancel', up);
  }
  return { add(t, img, gl, k = 1, pat = null){ if (t) items.add({ t, img, gl, k, pat, o: (ph += 1.7), dr: t.closest('.drawer'), ux: 0, uy: 0, grab: false }); }, drop(root){ items.forEach(it => { if (root.contains(it.t)) items.delete(it); }); }, grab };
})();

