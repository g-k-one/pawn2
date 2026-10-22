// Лаборатория Объёма: один исходник design/extrude/lab.src.html → две страницы.
//   node tools/extrude-lab.mjs                 — design/extrude/index.html (движок и шрифт по ссылкам, для npm run serve)
//   node tools/extrude-lab.mjs --artifact out  — одна самодостаточная страница (движок и шрифт внутри) для артефакта
//   node tools/extrude-lab.mjs --vendor out.js — движок одним файлом для любого проекта: обычный <script>, даёт window.Extrude (описание — docs/EXTRUDE.md)
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('..', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8');
const src = read('design/extrude/lab.src.html');
const v = process.argv.indexOf('--vendor');
if (v >= 0){
  const out = '/* Объём (Extrude) — псевдо-3D текст на WebGL1. Без зависимостей. Описание API: docs/EXTRUDE.md в проекте pawn.\n' +
    '   Подключение: <script src="extrude.js"></script>, затем Extrude.mount(el, { text: … }). Источник: pawn/src/app/16l-extrude.js — правки там, сюда копировать сборкой. */\n' +
    read('src/app/16l-extrude.js') + '\nif (typeof window !== "undefined") window.Extrude = Extrude;\n';
  writeFileSync(process.argv[v + 1], out); console.log(process.argv[v + 1], out.length); process.exit(0);
}
const i = process.argv.indexOf('--artifact');
if (i < 0){
  const page = '<!doctype html>\n<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
    src.replace('__FONT_URL__', '../../assets/fonts/songer-extrabold.woff2').replace('<!--ENGINE-->', '<script src="../../src/app/16l-extrude.js"></script>') + '\n</html>\n';
  writeFileSync(new URL('design/extrude/index.html', root), page);
  console.log('design/extrude/index.html');
} else {
  const font = 'data:font/woff2;base64,' + readFileSync(new URL('assets/fonts/songer-extrabold.woff2', root)).toString('base64');
  const out = src.replace('__FONT_URL__', font).replace('<!--ENGINE-->', () => '<script>\n' + read('src/app/16l-extrude.js') + '\n</script>');
  writeFileSync(process.argv[i + 1], out);
  console.log(process.argv[i + 1], out.length);
}
