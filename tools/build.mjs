// Сборка: src/ → index.html (один файл, как раньше). `npm run build` — минифицированно, `npm run dev` — как есть, для отладки.
// Стили — src/styles.css, загрузчик картинок — src/boot.js, приложение — src/app/*.js по порядку внутри одного замыкания,
// данные подарков — src/data/relay.json (подставляется вместо __RELAY__).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { transform } from 'esbuild';
const dev = process.argv.includes('--dev');
const root = new URL('../', import.meta.url), src = new URL('src/', root);
const read = f => readFileSync(new URL(f, src), 'utf8');
const parts = readdirSync(new URL('app/', src)).filter(f => f.endsWith('.js')).sort();
let app = '(() => {\n' + parts.map(f => read('app/' + f)).join('') + '})();';
app = app.replace('__RELAY__', () => JSON.stringify(JSON.parse(read('data/relay.json'))));
app = app.replace('__I18N_EN__', () => JSON.stringify(JSON.parse(read('i18n/en.json'))));
const min = async (code, loader) => dev ? code : (await transform(code, { loader, minify: true, target: ['es2020', 'safari14'], charset: 'utf8', legalComments: 'none' })).code;
const [css, boot, js] = await Promise.all([min(read('styles.css'), 'css'), min(read('boot.js'), 'js'), min(app, 'js')]);
const html = read('index.html').replace('/*CSS*/', () => css.replace(/\n$/, '')).replace('/*BOOT*/', () => boot.replace(/\n$/, '')).replace('/*APP*/', () => js.replace(/\n$/, ''));
writeFileSync(new URL('index.html', root), html);
console.log(`index.html: ${(html.length / 1024).toFixed(0)} КБ${dev ? ' (без минификации)' : ''} · модулей приложения: ${parts.length}`);
