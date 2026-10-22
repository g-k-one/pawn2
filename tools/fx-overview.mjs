// Обзор эффектов строками: по 6 кадров на эффект, по 8 эффектов на лист — быстро увидеть слабые.
// `node tools/fx-overview.mjs [имена через запятую (можно имя:пресет) | все] [папка]` → <папка>/overview-N.png
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const arg = process.argv[2] || 'classic', out = process.argv[3] || 'design/rive/lab-fx/shots', PORT = 8791;
const html = readFileSync(new URL('./fx-shots.mjs', import.meta.url), 'utf8').match(/const html = `([\s\S]*?)`;/)[1];
const srv = await serve(process.cwd(), PORT), br = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await br.newPage({ viewport: { width: 300, height: 300 } });
page.on('pageerror', e => console.log('ошибка:', e.message));
await page.route('**/__fx.html', r => r.fulfill({ contentType: 'text/html', body: html }));
await page.goto(`http://localhost:${PORT}/__fx.html`);
await page.evaluate(async () => { ['aura', 'fire', 'boom', 'portal', 'bolt', 'coins', 'confetti', 'charge', 'sparkle', 'smoke', 'shock', 'comets', 'toon', 'potion'].forEach(a => F.preload(a)); await new Promise(r => setTimeout(r, 1500)); });
// какие эффекты: список, пакет или все
const pick = arg === 'все' ? await page.evaluate(() => F.names) : arg.split(',');
await mkdir(out, { recursive: true });
const per = 8;
for (let s = 0; s * per < pick.length; s++){
  const list = pick.slice(s * per, s * per + per);
  const png = await page.evaluate(async ({ list }) => {
    const cw = 150, cols = 6, sh = document.createElement('canvas'); sh.width = cw * cols + 110; sh.height = cw * list.length;
    const g = sh.getContext('2d'); g.fillStyle = '#0d0c14'; g.fillRect(0, 0, sh.width, sh.height); g.font = '13px sans-serif';
    for (let r = 0; r < list.length; r++){ const n = list[r]; F.stopAll(); adv(700);
      const m = F.meta(n.split(':')[0]), P = m.period || 2.4, ts = [.06, .16, .3, .48, .7, .92].map(k => k * P);
      F.play(n, { x: 150, y: 150, size: 300, img: '/assets/nft/agent.webp', loop: !m.period });
      await new Promise(r => setTimeout(r, 200)); const cv = document.querySelector('.fx-cv'); let t = 0;
      for (let i = 0; i < cols; i++){ adv((ts[i] - t) * 1000); t = ts[i]; g.drawImage(cv, 0, 0, cv.width, cv.height, 110 + i * cw, r * cw, cw, cw); }
      g.fillStyle = '#e8e6f0'; g.fillText(n, 6, r * cw + 20); g.fillStyle = '#8c8aa0'; g.fillText((m.period ? m.period + ' с' : 'цикл'), 6, r * cw + 38); }
    return sh.toDataURL('image/png'); }, { list });
  const f = `${out}/overview-${s + 1}.png`; await writeFile(f, Buffer.from(png.split(',')[1], 'base64')); console.log(f, '—', list.join(', '));
}
await br.close(); srv.close();
