// Покадровая съёмка эффектов Горна: `node tools/fx-shots.mjs anvil,potion [папка]`
// Время ручное (16.7 мс на кадр), случайность с зерном — кадры повторяемы, можно сравнивать до/после.
// Итог: лист кадров <эффект>.png (тёмный фон как в приложении) + квадраты и перерисовка в консоли.
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { mkdir } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';

const names = (process.argv[2] || 'anvil,potion').split(','), out = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'design/rive/lab-fx/shots';
const PORT = 8799;
const TIMES = { anvil: [.02, .06, .12, .2, .3, .45, .6, .8, 1.1, 1.5], potion: [.04, .09, .14, .2, .3, .45, .7, .95, 1.2, 1.5] };
const html = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#0d0c14">
<script>
let T = 1000, Q = [], seed = 7; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
window.requestAnimationFrame = f => (Q.push(f), Q.length); performance.now = () => T;
const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(t, o){ return gc.call(this, t, Object.assign({}, o, { preserveDrawingBuffer: true })); };
window.adv = ms => { const end = T + ms; while (T < end){ T += 1000 / 60; const f = Q.splice(0); f.forEach(g => g(T)); } };
</script><script src="/src/app/16e-forge-atlas.js"></script><script src="/src/app/16e-forge.js"></script>
<script>window.F = Forge; Forge.auto = false;</script>`;

const srv = await serve(process.cwd(), PORT), br = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await br.newPage({ viewport: { width: 420, height: 420 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('page:', e.message)); page.on('console', m => m.type() === 'error' && console.log('console:', m.text()));
await page.route('**/__fx.html', r => r.fulfill({ contentType: 'text/html', body: html }));
await mkdir(out, { recursive: true });
for (const name of names){
  await page.goto(`http://localhost:${PORT}/__fx.html`);
  await page.evaluate(() => { F.preload('aura'); F.preload('potion'); });
  await page.waitForTimeout(400);
  const times = TIMES[name] || [.05, .15, .3, .5, .8, 1.2, 1.6, 2, 2.5, 3];
  const png = await page.evaluate(async ({ name, times }) => {
    F.play(name, { x: 210, y: 210, size: 360 }); const cv = document.querySelector('.fx-cv');
    const sheet = document.createElement('canvas'), N = times.length, cw = 280; sheet.width = cw * 5; sheet.height = cw * Math.ceil(N / 5);
    const g = sheet.getContext('2d'); g.fillStyle = '#0d0c14'; g.fillRect(0, 0, sheet.width, sheet.height); g.font = '12px sans-serif'; g.fillStyle = '#9a98b0';
    let t = 0; for (let i = 0; i < N; i++){ adv((times[i] - t) * 1000); t = times[i];
      g.drawImage(cv, 0, 0, cv.width, cv.height, (i % 5) * cw, Math.floor(i / 5) * cw, cw, cw); g.fillText(times[i].toFixed(2) + ' с', (i % 5) * cw + 6, Math.floor(i / 5) * cw + 16); }
    return sheet.toDataURL('image/png');
  }, { name, times });
  await writeFile(`${out}/${name}.png`, Buffer.from(png.split(',')[1], 'base64'));
  // время кадра: реальные замеры без подмены часов не нужны — считаем частицы, квадраты и перерисовку
  const st = await page.evaluate(n => { const r = []; F.play(n, { x: 210, y: 210, size: 360 }); for (let i = 0; i < 40; i++){ adv(17); r.push([F.stats.quads, F.stats.over]); } return r; }, name);
  const mq = Math.max(...st.map(r => r[0])), mo = Math.max(...st.map(r => r[1]));
  console.log(`${name}: до ${mq} квадратов за кадр, перерисовка до ×${mo.toFixed(2)} → ${out}/${name}.png`);
}
await br.close(); srv.close();
