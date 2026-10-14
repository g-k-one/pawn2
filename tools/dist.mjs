// Сборка для продакшена: `npm run dist` → папка dist/ (её и выкладывать на хостинг).
// Без assets/g (40 МБ запасных картинок подарков): в проде картинки идут с CDN, а запас нужен только там,
// где CDN закрыт (просмотрщик artifact). Если CDN не ответит — у карточек останутся локальные заглушки assets/nft.
import { execFileSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname, out = root + 'dist/';
execFileSync('node', [root + 'tools/build.mjs'], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true }); mkdirSync(out);
cpSync(root + 'index.html', out + 'index.html');
cpSync(root + 'assets', out + 'assets', { recursive: true, filter: p => !p.startsWith(root + 'assets/g') });
if (existsSync(root + 'tonconnect-manifest.json')) cpSync(root + 'tonconnect-manifest.json', out + 'tonconnect-manifest.json');
console.log('dist/ готов: index.html + assets (без assets/g)');
