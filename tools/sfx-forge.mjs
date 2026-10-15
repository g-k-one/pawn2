// Три набора «мягкая кузница»: удар — сэмпл Kenney (CC0), звон — модальный синтез наковальни/колокола,
// все ноты из ре-мажорной пентатоники, общий фильтр и общая «комната». Каждое событие → MP3 моно.
// Нужны ffmpeg и распакованные паки Kenney (kenney.nl/assets: interface-sounds, impact-sounds, rpg-audio) в одной папке.
// node tools/sfx-forge.mjs <папка kenney> <папка вывода> — все три набора + manifest.json для примерочной;
// выбранные в примерочной варианты (PICK) копируются в assets/sfx под именами, которые ждёт Sfx в 05-craft.js
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, unlinkSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const [SRC, OUT] = process.argv.slice(2);
const SR = 44100;
mkdirSync(join(OUT, 'sfx'), { recursive: true });

/* ---------- звук как массив ---------- */
const buf = sec => new Float32Array(Math.ceil(sec * SR));
const cache = {};
function load(rel){
  if (cache[rel]) return cache[rel];
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', join(SRC, rel), '-af', 'silenceremove=start_periods=1:start_threshold=-50dB', '-ac', '1', '-ar', SR, '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  const x = new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length));
  let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v));
  for (let i = 0; i < x.length; i++) x[i] /= pk || 1;
  return cache[rel] = x;
}
const I = n => `kenney_interface-sounds/Audio/${n}.ogg`, M = n => `kenney_impact-sounds/Audio/${n}.ogg`, R = n => `kenney_rpg-audio/Audio/${n}.ogg`;

function pitch(x, semis){ const k = 2 ** (semis / 12), y = new Float32Array(Math.floor(x.length / k));
  for (let i = 0; i < y.length; i++){ const p = i * k, j = Math.floor(p), f = p - j; y[i] = (x[j] || 0) * (1 - f) + (x[j + 1] || 0) * f; } return y; }
function biquad(x, type, fc, q = .707){
  const w = 2 * Math.PI * fc / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
  let b0, b1, b2; if (type === 'lp'){ b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a, y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++){ const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
const lp = (x, fc) => biquad(biquad(x, 'lp', fc), 'lp', fc);
const hp = (x, fc) => biquad(x, 'hp', fc);
function cut(x, sec, fade = .03){ const n = Math.min(x.length, Math.round(sec * SR)), f = Math.round(fade * SR), y = x.slice(0, n);
  for (let i = 0; i < f && i < n; i++) y[n - 1 - i] *= i / f; return y; }
function mix(out, x, at, g = 1){ const o = Math.round(at * SR); for (let i = 0; i < x.length && o + i < out.length; i++) out[o + i] += x[i] * g; return out; }

/* ---------- звон: модальный синтез ---------- */
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const N = { D4: 62, E4: 64, Fs4: 66, A4: 69, B4: 71, D5: 74, E5: 76, Fs5: 78, A5: 81, B5: 83, D6: 86, E6: 88, Fs6: 90, A6: 93, C4: 60, Cs5: 73 };
function ring(v, note, len = 1, g = 1){
  const f0 = hz(N[note] ?? note), dur = Math.max(...v.dec) * len * 1.2 + .05, y = buf(dur), att = Math.round(v.att * SR);
  v.ratio.forEach((r, k) => { const f = f0 * r; if (f > 15000) return; const d = v.dec[k] * len, ph = Math.random() * 6.28, det = 1 + (k ? .0015 : 0);
    for (let i = 0; i < y.length; i++){ const t = i / SR; y[i] += v.amp[k] * Math.exp(-t / d * 4.6) * Math.sin(2 * Math.PI * f * det * t + ph); } });
  for (let i = 0; i < att; i++) y[i] *= .5 - .5 * Math.cos(Math.PI * i / att);
  const z = lp(y, v.lp); for (let i = 0; i < z.length; i++) z[i] *= g; return z;
}
// мехи: шумовой вдох, фильтр «дышит» вверх (открыть) или вниз (закрыть)
function bellows(dur, up, fc){ const y = buf(dur); let s = 0;
  for (let i = 0; i < y.length; i++){ const t = i / dur / SR; s = s * .985 + (Math.random() * 2 - 1) * .015; y[i] = s * Math.sin(Math.PI * t) ** 1.5 * 6; }
  const a = lp(y, fc * (up ? 1 : .8)), b = lp(y, fc * (up ? 1.8 : .5)), z = new Float32Array(y.length);
  for (let i = 0; i < y.length; i++){ const k = i / y.length; z[i] = up ? a[i] * (1 - k) + b[i] * k : b[i] * (1 - k) + a[i] * k; } return z; }

/* ---------- общая комната: короткий ревер Шрёдера ---------- */
function room(x, wet, size = 1){
  const y = new Float32Array(x.length + Math.round(.9 * SR)); y.set(x);
  const combs = [1557, 1617, 1491, 1422].map(n => Math.round(n * size)), fb = .72, acc = new Float32Array(y.length);
  for (const d of combs){ const line = new Float32Array(d); let p = 0, lpz = 0;
    for (let i = 0; i < y.length; i++){ const o = line[p]; lpz = o * .6 + lpz * .4; line[p] = y[i] + lpz * fb; p = (p + 1) % d; acc[i] += o / 4; } }
  for (const d of [225, 556]){ const line = new Float32Array(d); let p = 0;
    for (let i = 0; i < acc.length; i++){ const b = line[p], v = acc[i] + b * .5; line[p] = v; acc[i] = b - v * .5; p = (p + 1) % d; } }
  const z = new Float32Array(y.length); for (let i = 0; i < z.length; i++) z[i] = y[i] + acc[i] * wet;
  let end = z.length; while (end > 1 && Math.abs(z[end - 1]) < 1e-4) end--; return cut(z, end / SR, .05);
}

/* ---------- наборы ---------- */
const KITS = [
  { id: 'anvil', name: 'Тёплая наковальня', about: 'Короткий звон наковальни, удар мягким молотком',
    v: { ratio: [1, 2.76, 5.4, 8.93], amp: [1, .45, .2, .07], dec: [1.1, .45, .2, .1], att: .004, lp: 5200 },
    tick: () => lp(pitch(load(M('impactMetal_light_003')), -9), 2800), tickLen: .07,
    hit: () => lp(load(M('impactMetal_heavy_003')), 3800), thud: () => lp(pitch(load(M('impactPlate_medium_003')), -3), 1400),
    coins: () => lp(load(R('handleCoins2')), 4200), latch: () => lp(load(R('metalLatch')), 3200), wet: .22, size: 1 },
  { id: 'bell', name: 'Медный колокольчик', about: 'Звон мягче и длиннее, как у медной чаши',
    v: { ratio: [1, 2.0, 2.4, 3.0, 4.2], amp: [1, .5, .3, .2, .08], dec: [1.7, 1.0, .8, .5, .3], att: .006, lp: 4800 },
    tick: () => lp(pitch(load(M('impactTin_medium_001')), 2), 3400), tickLen: .08,
    hit: () => lp(load(M('impactBell_heavy_000')), 3000), thud: () => lp(pitch(load(M('impactPlate_light_002')), -4), 1500),
    coins: () => lp(load(R('handleCoins2')), 3800), latch: () => lp(load(R('metalLatch')), 2800), wet: .28, size: 1.12 },
  { id: 'felt', name: 'Кузня в войлоке', about: 'Самый тихий: металл через войлок, глухо и тепло',
    v: { ratio: [1, 2.76, 5.4], amp: [1, .28, .07], dec: [.8, .28, .1], att: .009, lp: 2400 },
    tick: () => lp(load(M('impactPlate_light_001')), 1500), tickLen: .06,
    hit: () => lp(load(M('impactMetal_medium_001')), 1700), thud: () => lp(pitch(load(M('impactPlate_heavy_003')), -2), 900),
    coins: () => lp(load(R('handleCoins2')), 2400), latch: () => lp(load(R('metalLatch')), 1800), wet: .18, size: .9 },
];

/* события: одинаковая «партитура» для всех наборов — меняется только голос */
const score = {
  tap:    k => mix(buf(.15), cut(k.tick(), k.tickLen), 0, .8),
  tabs:   k => { const o = buf(.4); mix(o, cut(k.tick(), k.tickLen), 0, .6); return mix(o, ring(k.v, 'A6', .12, .25), .005); },
  drawer: [k => { const o = buf(.6); mix(o, bellows(.32, true, 700), 0, .9); return mix(o, ring(k.v, 'D6', .15, .2), .24); },
           k => { const o = buf(.6); mix(o, bellows(.26, false, 700), 0, .8); return mix(o, cut(k.thud(), .12), .2, .35); }],
  bet:    k => { const o = buf(.5); mix(o, cut(k.tick(), k.tickLen), 0, .5); mix(o, ring(k.v, 'B5', .18, .35), .004); return mix(o, cut(k.coins(), .12), .01, .18); },
  trash:  k => { const o = buf(.7); mix(o, cut(k.thud(), .25), 0, .9); mix(o, ring(k.v, 'A4', .2, .3), .01); return mix(o, ring(k.v, 'D4', .25, .3), .09); },
  hammer: k => { const o = buf(2); mix(o, cut(k.hit(), .5, .2), 0, .9); mix(o, ring(k.v, 'D4', 1, .8), 0); return mix(o, ring(k.v, 'A5', .6, .25), .002); },
  drum:   [k => mix(buf(.08), cut(hp(k.tick(), 300), .035, .015), 0, .6),
           k => { const o = buf(.8); mix(o, cut(k.thud(), .1), 0, .5); return mix(o, ring(k.v, 'A5', .3, .5), 0); }],
  winGram:k => { const o = buf(1.6); ['D5', 'Fs5', 'A5'].forEach((n, i) => mix(o, ring(k.v, n, .45, .5), i * .085)); return mix(o, cut(k.coins(), .4, .2), .17, .3); },
  winNft: k => { const o = buf(2.4); ['D5', 'A5', 'D6', 'Fs6'].forEach((n, i) => mix(o, ring(k.v, n, .7, .45), i * .12)); mix(o, ring(k.v, 'D4', 1, .35), 0); return mix(o, cut(k.coins(), .5, .25), .36, .2); },
  jackpot:k => { const o = buf(4);
    mix(o, cut(k.hit(), .5, .2), 0, .9); mix(o, ring(k.v, 'D4', 1.2, .7), 0);
    ['A4', 'D5', 'Fs5', 'A5', 'D6', 'Fs6'].forEach((n, i) => mix(o, ring(k.v, n, .6, .4), .32 + i * .09));
    mix(o, cut(k.hit(), .5, .2), .95, .8); ['D4', 'A4', 'D5', 'Fs5', 'A5'].forEach(n => mix(o, ring(k.v, n, 1.6, .3), .95));
    return mix(o, cut(k.coins(), .6, .3), 1.05, .3); },
  case:   k => { const o = buf(1.6); mix(o, cut(k.latch(), .12), 0, .7); mix(o, bellows(.35, true, 900), .06, .6); mix(o, ring(k.v, 'A4', .6, .4), .3); return mix(o, ring(k.v, 'D5', .6, .35), .3); },
  error:  k => { const o = buf(.8); mix(o, cut(k.thud(), .12), 0, .5); mix(o, ring(k.v, 'E4', .22, .45), 0); return mix(o, ring(k.v, 'C4', .28, .45), .13); },
  rank:   k => { const o = buf(2.4); mix(o, cut(k.hit(), .3, .15), 0, .5); ['D5', 'E5', 'A5'].forEach((n, i) => mix(o, ring(k.v, n, .5, .45), .05 + i * .14));
    ['D5', 'Fs5', 'A5', 'D6'].forEach(n => mix(o, ring(k.v, n, 1, .22), .5)); return o; },
};
const EVENTS = [
  ['tap', 'Тап по кнопке', 'ui'], ['tabs', 'Вкладки', 'ui'], ['drawer', 'Шторки', 'ui', ['Открыть', 'Закрыть']], ['bet', 'Ставка', 'ui'],
  ['trash', 'Корзина', 'ui'], ['hammer', 'Удар молота', 'game'], ['drum', 'Барабан', 'game', ['Щелчок', 'Цифра встала']],
  ['winGram', 'Выигрыш GRAM', 'game'], ['winNft', 'Выигрыш NFT', 'game'], ['jackpot', 'Джекпот', 'game'], ['case', 'Кейс', 'game'],
  ['error', 'Ошибка', 'ui'], ['rank', 'Новое звание', 'game'],
];
const TARGET = { ui: -24, game: -18 };   // средняя громкость (RMS) dBFS
const MAXLEN = { tap: .22, tabs: .35, bet: .45, 'drum-1': .1 };   // короткие звуки не должны тянуть хвост — иначе частые щелчки сливаются
// выбор заказчика в примерочной (15.10.2026): файл набора → имя в assets/sfx
const PICK = { 'tap-felt': 'tap', 'tabs-felt': 'tabs', 'drawer-felt-1': 'drawer-open', 'drawer-felt-2': 'drawer-close', 'bet-bell': 'bet', 'trash-felt': 'trash',
  'hammer-bell': 'hammer', 'drum-anvil-1': 'drum-tick', 'drum-anvil-2': 'drum-lock', 'winGram-bell': 'win-gram', 'winNft-anvil': 'win-nft',
  'jackpot-bell': 'jackpot', 'case-anvil': 'case', 'error-bell': 'error', 'rank-anvil': 'rank' };

function write(x, kind, name){
  let pk = 0, ss = 0, n = 0; for (const v of x){ pk = Math.max(pk, Math.abs(v)); if (Math.abs(v) > 1e-3){ ss += v * v; n++; } }
  const rms = 20 * Math.log10(Math.sqrt(ss / Math.max(1, n))), gdb = Math.min(TARGET[kind] - rms, -1 - 20 * Math.log10(pk)), g = 10 ** (gdb / 20);
  const wav = join(OUT, name + '.f32');
  writeFileSync(wav, Buffer.from(Float32Array.from(x, v => v * g).buffer));
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', SR, '-ac', '1', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '80k', join(OUT, 'sfx', name + '.mp3')]);
  if (r.status) throw new Error(String(r.stderr)); unlinkSync(wav);
}

const manifest = EVENTS.map(([id, nm, kind, parts]) => ({ id, name: nm, kind, parts: parts || null, seq: id === 'drum', v: [] }));
KITS.forEach((k, ki) => manifest.forEach(e => {
  const fns = Array.isArray(score[e.id]) ? score[e.id] : [score[e.id]];
  const files = fns.map((fn, p) => { const name = `${e.id}-${k.id}${fns.length > 1 ? '-' + (p + 1) : ''}`;
    const dry = fn(k); let end = dry.length; while (end > 1 && Math.abs(dry[end - 1]) < 1e-4) end--;
    let w = room(dry.slice(0, end), e.id === 'drum' && p === 0 ? k.wet * .3 : k.wet, k.size); const ml = MAXLEN[e.id] ?? MAXLEN[e.id + '-' + (p + 1)]; if (ml) w = cut(w, ml, ml * .4);
    write(w, e.kind, name); return name + '.mp3'; });
  e.v.push({ label: k.name, kit: k.id, files, src: [] });
}));
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ kits: KITS.map(k => ({ id: k.id, name: k.name, about: k.about })), events: manifest }, null, 1));
const APP = new URL('../assets/sfx/', import.meta.url);
mkdirSync(APP, { recursive: true });
for (const [f, to] of Object.entries(PICK)) copyFileSync(join(OUT, 'sfx', f + '.mp3'), new URL(to + '.mp3', APP));
console.log('готово:', manifest.length * KITS.length, 'событий, в assets/sfx —', Object.keys(PICK).length, 'файлов');
