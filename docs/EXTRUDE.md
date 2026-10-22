# Объём (Extrude) — псевдо-3D текст

Движок объёмных надписей на WebGL1 без зависимостей. Буквы с толщиной, фаской, градиентами, металлом, свечением, тенью; крутятся пальцем; 61 анимация, 5 способов смены текста, счётчик, 6 сцен игровых моментов. Рисует только пока что-то движется — в покое ни одного кадра.

- **Исходник:** `src/app/16l-extrude.js` (в Pawn склеивается в приложение).
- **Для другого проекта:** `node tools/extrude-lab.mjs --vendor путь/extrude.js` — один файл, обычный `<script>`, даёт `window.Extrude`. Правки — только в исходнике, в проекты копировать сборкой.
- **Лаборатория:** `design/extrude/lab.src.html` → `node tools/extrude-lab.mjs` → `design/extrude/index.html` (`npm run serve`, потом `/design/extrude/`). Вкладка «Код» отдаёт готовые настройки.
- **Основания решений:** `reports/Оптимизация и пресеты объёмного текста.md`, `reports/Сложные эффекты объёмного текста.md`.

## Подключение

```html
<div id="title" style="width:360px;height:200px"></div>
<script src="extrude.js"></script>
<script>
  const t = Extrude.mount(document.getElementById('title'), { text: 'WIN!', face: ['#fff4b8', '#ffc93a', '#c97a0c'], metal: .85, bevel: 3.5 });
  t.play('slam', { onLand: () => navigator.vibrate?.(10) }).then(() => t.shine());
</script>
```

Холст занимает весь элемент; размер шрифта подбирается сам (`size: 0`). Элемент меняет размер — надпись подстраивается в том же кадре, буквы пересобираются только при большом изменении.

## Настройки (`mount(el, opts)`, `t.set(opts)`)

| Группа | Ключи |
|---|---|
| Текст | `text` (`\n` — новая строка), `font` (строка CSS с `{s}` на месте размера), `size`, `fit` (по какой строке подбирать размер), `charset` (знаки заранее — смена текста из них без пересборки) |
| Форма | `depth` (толщина px), `bevel` (фаска px), `skew` (курсив), `arc` (радиус дуги px, `< 0` — улыбкой), `curve` (выпуклость лица), `pad` |
| Лицо | `face` (до 4 цветов), `faceAngle`, `pattern` (`'stripes'`, `'dots'`, `'grid'`), `patternColor`, `patternSize`, `patternAmount` |
| Боковины | `side` (до 4 цветов, от лица вглубь), `sideEmit`, `ambient` |
| Материал | `metal`, `gloss`, `holo`, `rim`, `rimColor`, `light: [x, y, z]` |
| Отделка | `strokes: [{ color, width, inset }]` (до 2), `innerGlow: { color, size }`, `glow: { color, size, strength }`, `shadow: { x, y, blur, opacity }` |
| Поза | `yaw`, `pitch`, `persp`, `spin`, `spring`, `drag`, `onMove(yaw, pitch)` |
| Прочее | `shine: { color, width, time }`, `shineEvery`, `flashColor`, `quality` (`'auto'` / `'high'` / `'low'`), `lite` (один неподвижный кадр) |

Цвета, свет, материал меняются без пересборки букв; шрифт, текст с новыми знаками и размеры отделки — с пересборкой (идёт в фоновом потоке, интерфейс не замирает; дождаться — `await t.ready`).

## Методы

- `t.play(имя, { speed, from, each, time, only, onLand, layer })` → Promise. `from`: `'start' | 'end' | 'center' | 'edges' | 'random'`; `each` — шаг между буквами, с; `onLand(i)` — удар буквы (звук, вибрация).
- Появление, уход, смена текста и счётчик — база (сменяют друг друга); «жизнь» и акцент идут **слоем поверх** — можно волну и толчок одновременно.
- `t.swap(текст, { style })` — меняются только изменившиеся знаки: `'roll' | 'flip' | 'morph' | 'pop' | 'scramble'`.
- `t.count(до, { from, time, format, onTick, onLand, wave })` — накрутка числа (только вверх, до указанного).
- `t.scene(имя, { …тексты, onLand })` — `'countdown' { steps }`, `'combo' { from, to, prefix }`, `'levelup' | 'record' | 'fight' | 'win' { text }`.
- `t.skip()` — доиграть всё мгновенно; `t.stop()` — прервать, буквы на место.
- `t.shine()`, `t.rainbow(сила, сдвиг, шаг)`, `t.rotate(yaw, pitch, kick)`, `t.destroy()`.
- `t.groups` — имена пресетов по группам: `in`, `idle`, `accent`, `out`, `swap`, `scene`. `t.stats` — `{ frames, scale }`. `Extrude.defaults` — все настройки по умолчанию.

## Пресеты

- **Появление (20):** rise, slide, pop, drop, flip, spin, spiral, type, smear, toss, gather, slam, ignite, swing, boom, march, unfold, zoom, elastic, dice.
- **Жизнь (12):** wave, breathe, float, glow, jelly, chase, rainflow, flicker, orbit, pendulum, bob, sway — тихие и конечные (2–4 с).
- **Акцент (16):** punch, shake, jiggle, squash, hop, flash, twirl, glitch, ripple, heartbeat, stamp, spark, wobble, bounce, pulse3d, shiver.
- **Уход (13):** fade, fall, scatter, implode, flipout, zoomout, out, blast, sink, swirl, drain, fly, tumble.

## Правила использования

- **Не больше 2–3 надписей на экране**: у каждой свой контекст WebGL, а iOS держит около 16 и молча гасит самый старый. Убираешь надпись — `t.destroy()`.
- `prefers-reduced-motion` и `lite` — анимации сразу в конечный кадр.
- Вспышки — не чаще 3 в секунду (доступность).
- Без WebGL или если шейдер не собрался — в элементе остаётся обычный текст.
