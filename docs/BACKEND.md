# Перенос на бэкенд: контракт, данные, план

Документ для разработчика или ИИ-агента, который подключает этот фронтенд к серверу и переносит существующую базу Pawn.
Всё, что ниже помечено «мок», сейчас работает в браузере и должно переехать на сервер.

## 1. Как устроено сейчас

- Фронтенд — один файл `index.html`, собирается из `src/` (`npm run build`). Сервер для фронта не нужен, это статика.
- Вся «серверная» логика — в браузере: генерация server seed, ролл, баланс, инвентарь, история, задания.
- Граница с сервером уже выделена: **`src/app/17-api.js`**, объект `API`. Интерфейс вызывает только его. Замена мока на `fetch` к бэкенду — основная работа; остальной код трогать почти не нужно.
- Прогресс сохраняется в `localStorage` (`pawn-state-v1`, объект `Store` в том же файле). На сервере это заменяется загрузкой состояния игрока при старте (`GET /me`).
- Доказательства игр уже в формате `pawn-pf-v1` и проходят эталон `fair-verify.js` (тест `npm test`). Сервер должен выдавать **ровно такие же** объекты доказательств.

## 2. Целевая схема

```
Telegram → Mini App (этот index.html, статика/CDN)
              │  HTTPS, заголовок Authorization: tma <initData>
              ▼
           API бэкенда (pawn-backend) ── БД (Postgres)
              │                         ├─ TON: приём депозитов (наблюдение за адресом DEPOSIT_ADDR)
              │                         └─ Релеер @pawngift: приём и отправка NFT-подарков
              └─ медиа: /api/media/gift (уже есть — картинки моделей 128/256/512)
```

- Авторизация: фронт отправляет `Telegram.WebApp.initData`, сервер проверяет подпись HMAC по токену бота (стандартная проверка Mini App) и берёт `user.id`. Никаких паролей.
- Все суммы на сервере — целые nano (`1 GRAM = 1 000 000 000`), строками в JSON (как в доказательствах). Во фронте `nano(v)` в `05-craft.js`.
- Любая операция с деньгами — с ключом идемпотентности (`request_id`, UUID с клиента): повтор запроса не должен списать дважды.
- Баланс — только из ответа сервера. Фронт может показать изменение сразу (оптимистично), но после ответа берёт `balance_nano` сервера.

## 3. Контракт API (что нужно фронту)

Ниже — предложение. Если в существующем бэкенде эндпоинты называются иначе, менять нужно только `17-api.js`, форма данных для интерфейса — та, что описана в колонке «фронт ждёт».

### Старт
`GET /me` → состояние игрока (заменяет `Store.load()` и все заглушки на старте):
```json
{
  "user": { "id": 123, "username": "gk", "photo_url": "…" },
  "balance_nano": "345560000000",
  "xp": 340.5,
  "inventory": [ { "id": "inv_1", "collection": "Artisan Brick", "num": 45270, "model": "Alpaca", "backdrop": "Amber", "symbol": "Origami", "value_nano": "3500000000" } ],
  "fair": { "epoch_id": "uuid", "commitment": "sha256hex", "client_seed": "gk-1a2b3c4d", "games_in_epoch": 12, "nonce": 57 },
  "tasks": { "day": "2026-10-14", "early": 1, "turnover_nano": "10354000000", "crafts": 19, "done": ["early"] },
  "week": { "missed": [0], "restore_price_nano": "500000000" },
  "stock": { "beast": 0, "musk": 0 },
  "achievements": { "got": ["craft1"], "subscribed": false },
  "referrals": { "link": "https://t.me/pawn_bot?start=ref_…", "pending_nano": "840000000", "friends": [["kira.ton", 214, 45.34]] },
  "super_drop": { "target": 11111, "min_stake_nano": "500000000", "nft": { … }, "last": [["whale77", "Cat Globe", "2026-10-12T…"]] }
}
```
NFT в интерфейсе ищется в каталоге `relay.json` по `collection + num` (см. `giftOf()` в `00-data.js`); если подарка нет в каталоге — каталог нужно отдавать с сервера (`GET /catalog`, тот же формат, что `src/data/relay.json`).

### Provably fair
- `GET /fair/epoch` → `{ version: "pawn-pf-v1", epoch_id, commitment, client_seed }` — фронт: `API.receipt()`; это «подтверждение хеша до игры», которое игрок сохраняет.
- `POST /fair/rotate { client_seed? }` → раскрытое зерно прошлой эпохи и новая эпоха: `{ revealed: { epoch_id, server_seed, games: N }, epoch: { epoch_id, commitment, client_seed } }` — фронт: `API.rotateSeed()`; после ответа дописывает `server_seed` во все доказательства этой эпохи в истории.

### Крафт
`POST /craft { request_id, ton_bet_nano, gift_ids: [] }` — фронт: `API.craft(stake, gifts, tonStake)`.
Сервер проверяет: ставка 0.1–50 GRAM вместе с подарками, ≤ 2 подарков, подарки принадлежат игроку, хватает баланса. Списывает ставку, роллит, сохраняет игру.
Ответ — то, что сейчас возвращает `fair()` (`05-craft.js`):
```json
{
  "kind": "craft", "ticket": 61126, "ti": 1, "mult": 0.92, "stake": 1, "win": 0.92, "change": 0, "nft": null,
  "balance_nano": "344640000000",
  "proof": {
    "version": "pawn-pf-v1", "reference": "57", "request_id": "uuid", "epoch_id": "uuid", "commitment": "sha256hex",
    "client_seed": "gk-1a2b3c4d", "server_seed": "", "nonce": "57", "domain": "craft", "block_counter": "0", "roll": 61126,
    "rules_hash": "sha256 от JSON правил", "rules": { "version": "pawn-pf-v1", "target_rtp_ppm": "949996", "base_rtp_ppm": "949996", "multiplier_scale": "1000000", "segments": [ … ] },
    "inputs": { "bet_nano": "1000000000", "gifts": [ { "id": "inv_1", "value_nano": "…" } ], "ton_bet_nano": "1000000000" },
    "result": { "segment": "luck", "zone": "luck", "multiplier_ppm": "…", "payout_nano": "…", "ton_payout_nano": "…", "gift_payout_value_nano": "0" }
  }
}
```
- `nft` — подарок-выплата (если выигрыш ≥ порога): `{ id, collection, num, value_nano }`; `change` — сдача GRAM.
- `server_seed` пустой, пока эпоха не раскрыта.
- Супер дроп: если `ticket == super_drop.target` и ставка ≥ min — в ответе `super: { nft }`.
- Ошибка → HTTP 4xx/5xx с `{ error: "insufficient_balance" | "bet_limits" | "gift_not_owned" | … }`; ставка не списана. Интерфейс уже показывает экран неудачи и возвращает ставку.

`POST /craft/:request_id/claim { how: "take" | "sell" }` — фронт: `API.claimCraft(r, how)`. «Продать» — подарок сразу продаётся по оценке, GRAM на баланс; «Забрать» — в инвентарь. Начисления XP (0.5 × ставка) и прогресс заданий — на сервере.

### Кейсы
`POST /cases/:id/open { request_id, mult }` — фронт: `API.openCase(c, m)`. Цена списывается сервером; бесплатный кейс — из запаса (`stock`). Ответ — как `rollCase()` (`16-bonuses.js`): `{ kind: "case", caseId, ticket, idx, mult, proof, reward: { kind: "gram"|"xp"|"nft", amount, nft? }, balance_nano }`. Правила кейса в доказательстве (`rules.rewards`) — веса по диапазонам тикета, как в `caseRules()`.

### Кошелёк
- `POST /wallet/deposit { amount_nano, boc }` — фронт: `API.confirmDeposit(amount, boc)`; `boc` — подписанная транзакция из TON Connect. Сервер дожидается транзакции в сети на `DEPOSIT_ADDR` и зачисляет. Ответ `{ ok, status: "pending"|"done", balance_nano }`.
- `POST /wallet/withdraw { request_id, gift_id }` — фронт: `API.withdrawNft(g)`, **один подарок за запрос** (интерфейс сам шлёт их по очереди и показывает уведомление на каждый). Комиссия 0.3 GRAM за подарок. Ответ `{ ok: true, balance_nano }` или `{ ok: false, error: "relayer" }` (игрок не написал релееру — интерфейс останавливает очередь и предлагает написать) / `{ ok: false, error: "failed" }` (подарок возвращается в инвентарь, комиссия не списана).
- `POST /inventory/sell { request_id, gift_ids }` — фронт: `API.sellNfts(list)` → `{ ok, amount_nano, balance_nano }`.
- Депозит NFT — игрок передаёт подарок релееру; сервер видит его и кладёт в инвентарь. Фронту нужен способ узнать: опрос `GET /me` или push (WebSocket/SSE).

### Бонусы
Сейчас считаются во фронте прямо в модулях (не через `API`), при переносе добавить в `API`:
- `POST /achievements/:id/claim` (`claimAch`, `12-achievements.js`) — сервер проверяет условие и начисляет.
- `POST /tasks/restore-day` (кнопка восстановления дня, `16-bonuses.js`, `act === 'restore'`).
- `POST /referrals/claim` (`act === 'claimref'`).
- Задания дня и недели (`bumpTasks`, `11-tasks.js`) и выдача бесплатных кейсов в запас (`stockUp`) — на сервере по факту крафтов.
- Начисления за друзей — сервер, ежедневно в 00:00 МСК.

### Лента, топ, супер дроп
- `GET /live` или WebSocket — последние крафты и кейсы всех игроков (сейчас `04-live.js` генерирует случайные — в бою так нельзя, это противоречит честности).
- `GET /top` — топ по XP (сейчас `TOP`, `15-top.js`).
- `GET /super-drop` — текущий тикет, приз, прошлые победители.

### PvP крафт (эксперимент, `16a-pvp.js`, включается в «Дебаг»)
Комната на взнос (0.5/1/5 GRAM) живёт `PVP_TIME = 30` с: все вносят одинаковый взнос и загадывают тикет 00000–99999 (один тикет — один игрок). По таймеру выпадает честный тикет — он же тикет крафта. Ближе всех (минимальный `|тикет − загаданный|`) крафтит на весь банк **с этим тикетом**: множитель — ранга выпавшего тикета (`payoutOf` в `05-craft.js`, те же правила, что у крафта). Ничья — банк поровну (доля до сотых вниз), тикет тот же. Один в комнате — крафт твой. Отдельной комиссии нет: весь банк уходит в крафт, RTP 95%.
- `GET /pvp?fee_nano` → `API.pvpOpen(fee)`: текущая комната `{id, fee, commitment, state, endsAt, bank, entries[]}`. Хеш зерна — до первого взноса. Чужие тикеты до розыгрыша не отдавать. Разыгранную комнату не отдавать, кроме случая, когда игрок в ней и ещё не получил итог.
- `POST /pvp/join {fee_nano, guess}` → `API.pvpJoin(fee, guess)`: взнос списывает сервер; `{ok:false, error:'taken'|'closed'|'already'}` — тикет занят, комната стартует (меньше 1 с), уже в комнате.
- `POST /pvp/change {fee_nano, guess}` → `API.pvpChange(fee, guess)`: сменить тикет после входа, пока до старта больше 5 с (`PVP_LOCK`); `{ok:false, error:'locked'|'taken'|'closed'}`. Список тикетов фиксируется за 5 с до розыгрыша.
- `GET /pvp/:id` → `API.pvpState(fee)`: состояние; после таймера — тикет, победители, `my` (выиграл ли, доля, множитель, выплата, NFT/сдача) и доказательство. Выплату победителю сервер зачисляет так же, как у крафта (`claimCraft`: забрать/продать NFT).
- Честность: тикет = HMAC(зерно комнаты, `["pawn-pf-v1", id комнаты, "pvp", SHA-256(JSON тикетов в порядке входа), "0", блок]`), зерно раскрывается сразу после розыгрыша; в доказательстве — правила крафта (`rules.craft`), доля и выплата. Проверка в приложении — `checkProof` (ветка `domain === 'pvp'`); **сайт проверки `fair-verify.js` домен `pvp` пока не знает** — добавить. Сервер не должен иметь возможности дописать «своих» участников после взносов игроков (иначе он меняет хеш списка): только живые игроки, вход закрывается за 1 с до старта.
- История: и победа, и проигрыш пишутся в `S.hist.crafts` с `r.pvp` (взнос, банк, игроки и их тикеты, кто выиграл); в статистике «поставлено» — взнос.
- Сейчас мок: соседи по комнате — заглушки (ники `NICKS`, случайные тикеты и время входа), комната живёт только в памяти.
- **Реалтайм (обязательно для боя).** Комнату видят все её игроки одновременно, поэтому:
  - Источник правды — сервер: состав, банк, `endsAt`, розыгрыш. Клиент ничего не решает сам.
  - Время: сервер отдаёт `endsAt` и своё `now`; клиент считает поправку часов (`offset = serverNow − Date.now()`) и рисует таймер по ней — иначе у игроков с «уехавшими» часами старт разный.
  - Доставка событий: WebSocket (или SSE) на комнату — `join` (ник, аватар, без тикета), `bank`, `start` (тикет, победители, доказательство). Фолбэк — опрос `GET /pvp/:id` раз в 1–2 с (так сейчас работает мок через `API.pvpState`).
  - Вход идемпотентный (ключ запроса), повторный `join` после обрыва связи не списывает взнос дважды.
  - Переподключение: после обрыва клиент запрашивает состояние комнаты целиком и догоняет; если старт уже прошёл — сразу получает итог и проигрывает анимацию сам.
  - Анимацию синхронизировать не нужно: у каждого она своя, важен только одинаковый итог.
  - Нагрузка: комнаты по взносам, в каждой — подписчики только этой комнаты.

### Аналитика
`track(name, props)` в `17-api.js` копит события в `window.__pawnEvents`: `app_open, craft, claim, case_open, seed_rotate, withdraw, deposit, sell, pvp_open, pvp_join`. В бою — отправлять пачками на сервер или в счётчик.

## 4. Схема БД (предложение)

Сверить с существующей базой: если таблицы уже есть — сопоставить поля, а не создавать заново.

| Таблица | Поля | Заметки |
|---|---|---|
| users | id (telegram id), username, photo_url, lang, xp, created_at, referrer_id | |
| ledger | id, user_id, delta_nano, kind (deposit, craft_bet, craft_win, sell, withdraw_fee, case_price, case_win, task, ach, ref, restore), ref_id, request_id UNIQUE, created_at | баланс = сумма по ledger (или кэш в users с транзакцией) |
| inventory | id, user_id, collection, num, model, backdrop, symbol, value_nano, source (deposit, craft, case, super), status (owned, in_craft, withdrawing, withdrawn, sold), created_at | |
| fair_epochs | id uuid, user_id, server_seed (секрет!), commitment, client_seed, created_at, revealed_at | seed не отдавать до раскрытия |
| games | id, user_id, request_id UNIQUE, epoch_id, nonce, domain, block_counter, roll, rules_hash, rules jsonb, inputs jsonb, result jsonb, how (take/sell), created_at | из этих полей собирается доказательство |
| deposits | id, user_id, tx_hash UNIQUE, amount_nano, status, created_at | |
| withdrawals | id, user_id, inventory_id, fee_nano, status (pending, sent, failed), error, created_at | один подарок — одна строка |
| tasks_daily | user_id, day (дата МСК), early, turnover_nano, crafts, done jsonb, stocked | |
| case_stock | user_id, case_id, count | |
| achievements | user_id, ach_id, claimed_at | |
| referral_accruals | id, user_id, friend_id, kind (first, activity), amount_nano, created_at | |
| super_drop | id, target, min_stake_nano, nft, winner_id, won_at | |

Индексы: `games(user_id, created_at desc)`, `ledger(user_id)`, уникальные `request_id`.

## 5. Порядок переноса

1. Бэкенд отдаёт `GET /me` и каталог NFT → в `17-api.js` `Store.load()` заменяется загрузкой с сервера, заглушки на старте (баланс 345.56, 9 случайных NFT, стартовая история в `16-bonuses.js`, `REF`, `TOP`, `S.tasks`, `S.week`) убираются.
2. Provably fair на сервере: эпохи, ролл (`rollOf` — образец), правила (`CRAFT_RULES`, `caseRules`). Проверка: доказательства с сервера проходят `tests/vendor/fair-verify.js`.
3. `API.craft`, `claimCraft`, `openCase`, `rotateSeed`, `receipt` → запросы. Убрать из фронта генерацию seed (`newEpoch`, `fair`, `rollCase` остаются только для проверки в браузере — `checkProof`).
4. Кошелёк: `confirmDeposit`, `withdrawNft`, `sellNfts`; вписать `DEPOSIT_ADDR` (адрес кошелька Pawn, его даёт владелец); вывод — только NFT, вывода GRAM нет; проверить, что манифест `TC_MANIFEST` доступен.
5. Бонусы (задания, достижения, рефералка, восстановление дня) → новые методы в `API`.
6. Лента, топ, супер дроп — с сервера.
7. Дебаг-панель (принудительный исход) — только на тестовом стенде; в проде скрыть (сейчас она в меню всегда).
8. Перенос данных из старой БД: игроки, балансы (сверить сумму!), инвентарь, XP, история игр (старые доказательства Random.org — показывать без проверки pawn-pf-v1, как на сайте проверки), рефералы.
9. Прогнать `npm test` (тесты придётся научить ходить в тестовый бэкенд или в мок-сервер).

## 6. Где мок и заглушки (искать по коду)

| Что | Где |
|---|---|
| Стартовый баланс 345.56 | `00-data.js`, `const S` |
| Инвентарь из 9 случайных NFT | `00-data.js`, `let INV` |
| Стартовая история крафтов, кейсов, кошелька | `16-bonuses.js`, «стартовая история» |
| Начисления за друзей | `07-history.js`, `S.hist.refs` |
| Друзья, ссылка, бонус к получению | `14-referrals.js`, `REF` |
| Топ | `15-top.js`, `TOP` |
| Лента «лайв» (случайные ники и выигрыши) | `04-live.js` |
| Супер дроп: тикет, приз, прошлые победители | `13-super-drop.js`, `SUPER` |
| Прогресс заданий и недели на старте | `11-tasks.js`, `S.tasks`, `S.week` |
| Подписка на канал засчитывается через 1.5 с | `12-achievements.js`, `act === 'sub'` |
| Депозит NFT через релеер (имитация) | `08-wallet.js`, `relayerFlow` |
| Адрес для депозитов не задан | `08-wallet.js`, `DEPOSIT_ADDR` |
| Подбор NFT под выигрыш с задержкой | `16-bonuses.js`, `pickNft` |
| Сохранение прогресса в браузере | `17-api.js`, `Store` |

## 7. Открытые вопросы

- Откуда цены NFT (оценка `value`): сейчас из `relay.json`; в бою — актуальный флор/оценка с сервера. Порог выплаты NFT = самый дешёвый подарок на релеере (`NFT_FROM` считается из каталога) — сервер должен считать так же.
- Время сброса заданий — 00:00 МСК (сервер должен считать по Москве, не по UTC).
