# Pawn — Telegram Mini App

Крафт NFT-подарков с provably-fair исходом (протокол `pawn-pf-v1`), кейсы, задания, рефералка.
Сейчас это готовый фронтенд-прототип: вся «серверная» часть замокана в браузере. Как подключить бэкенд — `docs/BACKEND.md`.

## Где посмотреть
- Сайт (обновляется сам после каждого merge в `main`): https://g-k-one.github.io/pawn2/
- Выкладка — `.github/workflows/pages.yml` (собирает `npm run dist` и публикует на GitHub Pages).

## Быстрый старт
```bash
npm install
npm run build     # src/ → index.html (минифицированно); npm run dev — без минификации
npm run serve     # http://localhost:8765
npm test          # сквозные тесты в headless Chromium
```
Для тестов нужен Chromium для Playwright: `npx playwright install chromium` (один раз).

## Команды
| Команда | Что делает |
|---|---|
| `npm run build` / `npm run dev` | Собрать `index.html` из `src/` |
| `npm run serve` | Локальный сервер |
| `npm test` | Тесты: запуск, крафт + проверка доказательства эталоном, кейс, вывод NFT, сохранение, английский |
| `npm run i18n` | Ключи без английского перевода |
| `npm run check` | Переводы + сборка + тесты (то же, что в CI) |
| `npm run dist` | Папка `dist/` для хостинга (без запасных картинок `assets/g`) |

## Где что
- `src/` — исходники: `index.html`, `styles.css`, `boot.js`, `app/*.js` (склеиваются по порядку), `data/relay.json` (каталог NFT), `i18n/en.json`.
- `src/app/17-api.js` — граница с сервером (мок) — сюда подключается бэкенд.
- `index.html` в корне — собранный файл, руками не правится.
- `assets/` — картинки, шрифты; `assets/g` — запасные картинки подарков на случай, если CDN недоступен.
- `tests/` — тесты и копия эталонного проверяльщика `fair-verify.js`.
- `docs/BACKEND.md` — контракт API, схема БД, план переноса. `docs/HANDOFF.md` — как передать проект.
- `CLAUDE.md` — все правила продукта и устройство кода (для людей и ИИ-агентов).
