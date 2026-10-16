/* =========================================================
   ЦЕЗАРЬ — заставка старта арены на Rive: ночной колизей, из-за дальней стены встаёт огромный Цезарь, хохочет
   и бьёт молниями из глаз в песок; перед нами спиной стоят маленькие гладиаторы, ждут боя, от удара вздрагивают.
   Вся сцена — один файл assets/caesar/caesar.riv (3 с, 60 fps, state machine «SM» играет «Intro» сам).
   Исходник — design/rive/caesar: gen.mjs пишет scene.rml, rive CLI собирает .riv (см. README там).
   Звук и вибрация — по кадрам сцены (HA_F, ZAP_F) из кода. Рантайм @rive-app/webgl2 лежит рядом с игрой (assets/rive): CDN не всегда доступен,
   а просмотрщик artifact чужой wasm не пускает. Молнии и свечения рисует Rive Renderer (WebGL2).
   Нет сети или WebGL2, лайт-режим или «Быстрый крафт» — гладиаторы с мечами / молот.
   ========================================================= */
const RIVE_JS = 'assets/rive/rive.js', RIVE_WASM = 'assets/rive/rive.wasm';   // @rive-app/webgl2 2.44.0
const HA_F = [50, 66, 82, 142, 158], ZAP_F = 112, CAESAR_F = 180;     // кадры сцены (60 fps): «ха», удар молнии, конец
let caesarP = null;
const riveRT = () => new Promise((res, rej) => { if (window.rive) return res(window.rive); const sc = document.createElement('script'); sc.src = RIVE_JS;
  sc.onload = () => { window.rive.RuntimeLoader.setWasmUrl(RIVE_WASM); res(window.rive); };
  sc.onerror = () => rej(new Error('rive runtime')); document.head.appendChild(sc); });
// рантайм, его wasm и сама сцена грузятся заранее (при входе на арену); в памяти — байты .riv, экземпляр создаётся на каждый бой
function caesarLoad(){
  if (S.lite) return Promise.resolve(null);
  // просмотрщик artifact не отдаёт .riv — там лежит та же сцена текстом (base64, caesar.riv.txt)
  const riv = () => fetch('assets/caesar/caesar.riv').then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
    .catch(() => fetch('assets/caesar/caesar.riv.txt').then(r => { if (!r.ok) throw new Error('caesar.riv ' + r.status); return r.text(); })
      .then(t => Uint8Array.from(atob(t.trim()), c => c.charCodeAt(0)).buffer));
  return caesarP ||= Promise.all([riveRT(), riv()])
    .then(([rive, buf]) => new Promise((res, rej) => { rive.RuntimeLoader.awaitInstance().then(() => res({ rive, buf }), rej); }))
    .catch(e => { caesarP = null; console.warn('caesar', e); return null; });
}
// true — заставка сыграна; false — не загрузилась (ждём до 3 с: при «Старт сейчас» сразу после входа на арену рантайм ещё грузится)
async function caesarIntro(){
  const R = await Promise.race([caesarLoad(), wait(3000).then(() => null)]); if (!R) return false;
  const { rive, buf } = R, fx = $('fx'), cv = document.createElement('canvas'), dpr = Math.min(2, devicePixelRatio || 1);
  cv.className = 'glad-cv'; cv.width = fx.clientWidth * dpr; cv.height = fx.clientHeight * dpr; fx.appendChild(cv);
  let r;
  const ok = await new Promise(res => {
    try {
      r = new rive.Rive({ buffer: buf.slice(0), canvas: cv, stateMachine: 'SM', autoplay: true,
        layout: new rive.Layout({ fit: rive.Fit.Cover, alignment: rive.Alignment.BottomCenter }),
        onLoad: () => res(true), onLoadError: () => res(false) });
    } catch (e){ console.warn('caesar', e); res(false); }
    setTimeout(() => res(false), 1500);
  });
  if (!ok){ r?.cleanup(); cv.remove(); return false; }
  // звук и вибрация — по таймлайну сцены
  const at = f => wait(f / 60 * 1000);
  Sfx.whoosh(); haptic('medium');
  HA_F.forEach(f => at(f).then(() => Sfx.ha()));
  at(ZAP_F).then(() => { Sfx.thunder(); haptic('heavy'); FullGlow.punch(0, 1.2); });
  await at(CAESAR_F);
  await cv.animate([{ opacity: 1 }, { opacity: 0, filter: 'blur(4px)' }], { duration: 300 }).finished;
  r.cleanup(); cv.remove(); return true;
}
