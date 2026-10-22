// Горн для других проектов: `npm run forge` → папка dist-forge/ (её и копировать в другой проект).
//   forge.js            — ядро + карта атласов, один файл (глобальный Forge); forge.min.js — то же сжато
//   forge-<пакет>.js    — пакеты эффектов, подключаются после ядра (порядок — как в списке PACKS); *.min.js — сжатые
//   fx/                 — картинки (атласы, шум, полосы); ищутся рядом с forge.js сами, иначе Forge.base = '…/fx/'
//   README.md, demo.html — как подключать и живой пример
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url)).replace(/\\/g, '/'), out = root + 'dist-forge/';
// порядок важен: пакет берёт инструменты у тех, что подключены раньше (hits — у image; motion — у image и hits; matter — у hits; remaster — у hits и matter и заменяет эффекты classic)
const PACKS = ['classic', 'particles', 'image', 'hits', 'motion', 'glass', 'matter', 'remaster'];
const ver = JSON.parse(readFileSync(root + 'package.json', 'utf8')).version || '0', date = new Date().toISOString().slice(0, 10);
const head = n => `/* Горн (Forge) — движок эффектов на WebGL${n ? ' · пакет «' + n + '»' : ''} · сборка ${date}. Описание — README.md рядом. */\n`;

rmSync(out, { recursive: true, force: true }); mkdirSync(out + 'fx', { recursive: true });
// ядро: карта атласов + движок + сам находит папку fx рядом со своим файлом
const core = head() + readFileSync(root + 'src/app/16e-forge-atlas.js', 'utf8') + '\n' + readFileSync(root + 'src/app/16e-forge.js', 'utf8') +
  "\n;(() => { try { const s = document.currentScript && document.currentScript.src; if (s) Forge.base = s.replace(/[^/]*$/, '') + 'fx/'; } catch (_){} })();\n" +
  'if (typeof window !== \'undefined\') window.Forge = Forge;\n';
writeFileSync(out + 'forge.js', core);
const files = [['forge.js', core]];
for (const p of PACKS){ const src = head(p) + readFileSync(root + `src/forge/${p}.js`, 'utf8'); writeFileSync(out + `forge-${p}.js`, src); files.push([`forge-${p}.js`, src]); }
// сжатые копии
for (const [f, src] of files){ const r = await build({ stdin: { contents: src, loader: 'js' }, write: false, minify: true, target: 'es2020', legalComments: 'none' });
  writeFileSync(out + f.replace(/\.js$/, '.min.js'), head(f === 'forge.js' ? '' : f.slice(6, -3)) + r.outputFiles[0].text); }
// картинки — только те атласы, что нужны эффектам (плюс шум и полосы)
const used = new Set([...[root + 'src/app/16e-forge.js', ...PACKS.map(p => root + `src/forge/${p}.js`)].flatMap(f => [...readFileSync(f, 'utf8').matchAll(/atlas: '(\w+)'/g)].map(m => 'fx-' + m[1] + '.webp')), 'fx-noise.png', 'fx-strips.webp']);
for (const f of readdirSync(root + 'assets/fx')) if (used.has(f)) cpSync(root + 'assets/fx/' + f, out + 'fx/' + f);
cpSync(root + 'docs/FORGE.md', out + 'README.md');
// пример: все пакеты, витрина по клику; картинка для эффектов картинки — своя, иначе они пропускаются
writeFileSync(out + 'demo.html', `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Горн — пример</title>
<style>body{margin:0;background:#120e0c;color:#f1e9e2;font:15px system-ui,sans-serif;padding:16px}button{margin:3px;padding:6px 12px;border-radius:999px;border:1px solid #30251f;background:#1c1613;color:inherit;cursor:pointer}#st{width:360px;height:360px;max-width:100%;border-radius:16px;background:#0d0a09;margin:12px 0}</style>
<p>Тап по названию — эффект в квадрате. Эффекты картинки (glitch, glass, …) показывают картинку из поля ниже.</p>
<p><input id="img" placeholder="адрес картинки для эффектов картинки" style="width:min(420px,100%)"></p>
<div id="st"></div><div id="list"></div>
<script src="forge.js"></script>
${PACKS.map(p => `<script src="forge-${p}.js"></script>`).join('\n')}
<script>
  let h = null; const st = document.getElementById('st');
  document.getElementById('list').innerHTML = Forge.list().map(e => '<button data-n="' + e.name + '">' + e.name + '</button>').join('');
  document.getElementById('list').onclick = ev => { const n = ev.target.dataset.n; if (!n) return; h && h.kill();
    const m = Forge.meta(n); h = Forge.play(n, { el: st, loop: !m.period, img: document.getElementById('img').value || undefined }); };
</script>
`);
const kb = f => (statSync(out + f).size / 1024).toFixed(0) + ' КБ';
console.log('dist-forge/ готов: forge.js ' + kb('forge.js') + ' (сжато ' + kb('forge.min.js') + ') · пакетов ' + PACKS.length + ' · fx/ ' + readdirSync(out + 'fx').length + ' картинок');
