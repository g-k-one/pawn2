// Ключи перевода: все $t("…") и $n("…|…") в src/app и data-t в src/index.html. Показывает, чего нет в src/i18n/en.json.
// npm run i18n          — список недостающих (выход 1, если есть)
// npm run i18n -- --keys — все ключи в JSON (для заготовки словаря)
import { readFileSync, readdirSync } from 'node:fs';
const src = new URL('../src/', import.meta.url), read = f => readFileSync(new URL(f, src), 'utf8');
const keys = new Set();
for (const f of readdirSync(new URL('app/', src)).filter(f => f.endsWith('.js')))
  for (const m of read('app/' + f).matchAll(/\$[tn]\(("(?:[^"\\]|\\.)*")/g)) keys.add(JSON.parse(m[1]));
for (const m of read('index.html').matchAll(/data-t(?:="([^"]*)")?[^>]*>([^<]*)</g)) keys.add((m[1] || m[2]).trim());
for (const m of read('index.html').matchAll(/aria-label="([^"]*[А-Яа-яЁё][^"]*)"/g)) keys.add(m[1]);
const en = JSON.parse(read('i18n/en.json')), missing = [...keys].filter(k => !en[k]);
if (process.argv.includes('--keys')) { console.log(JSON.stringify([...keys].sort(), null, 1)); process.exit(0); }
const unused = Object.keys(en).filter(k => !keys.has(k));
console.log(`ключей: ${keys.size} · без перевода: ${missing.length} · лишних в словаре: ${unused.length}`);
missing.forEach(k => console.log('  нет:', k));
process.exit(missing.length ? 1 : 0);
