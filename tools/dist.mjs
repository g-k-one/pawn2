// Сборка для продакшена: `npm run dist` → папка dist/ (её и выкладывать на хостинг).
// Без assets/g (40 МБ запасных картинок подарков): в проде картинки идут с CDN, а запас нужен только там,
// где CDN закрыт (просмотрщик artifact). Если CDN не ответит — у карточек останутся локальные заглушки assets/nft.
import { execFileSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname, out = root + 'dist/';
execFileSync('node', [root + 'tools/build.mjs'], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out);
cpSync(root + 'index.html', out + 'index.html');
cpSync(root + 'assets', out + 'assets', { recursive: true, filter: p => p !== root + 'assets/g' && !p.startsWith(root + 'assets/g/') });
if (existsSync(root + 'tonconnect-manifest.json')) cpSync(root + 'tonconnect-manifest.json', out + 'tonconnect-manifest.json');
// самопроверка: всё, на что ссылается приложение (кроме запасного assets/g), должно лежать в dist
const refs = new Set(readFileSync(out + 'index.html', 'utf8').match(/assets\/[\w./-]+\.(?:svg|webp|png|woff2|json)/g));
const lost = [...refs].filter(f => !f.startsWith('assets/g/') && !existsSync(out + f));
if (lost.length){ console.error('нет в dist:', lost.join(', ')); process.exit(1); }
console.log('dist/ готов: index.html + assets (без assets/g), файлов по ссылкам: ' + refs.size + '');
