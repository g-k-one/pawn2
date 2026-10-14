// Сквозные тесты в headless Chromium: `npm test` (сначала `npm run build`).
// Проверяют главные сценарии и то, что доказательства из приложения проходят эталонный fair-verify.js.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';
import { verifyProof } from './vendor/fair-verify.js';

const PORT = 8799, URL_ = `http://localhost:${PORT}/index.html`;
let srv, browser;
before(async () => { srv = await serve(new URL('..', import.meta.url).pathname, PORT); browser = await chromium.launch(); });
after(async () => { await browser?.close(); srv?.close(); });

// новая страница: онбординг и вопрос про экономный режим пропущены, быстрый крафт, внешние CDN закрыты (как в artifact)
async function open({ lang = 'ru', ctx } = {}){
  ctx ||= await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(l => { try { localStorage.setItem('bm-onb-done', '1'); localStorage.setItem('bm-lite-asked', '1'); localStorage.setItem('bm-fast', '1'); localStorage.setItem('bm-lang', l); } catch(_){} }, lang);
  await page.route(/changes\.tg|pawn-backend|tonconnect/, r => r.abort());
  await page.goto(URL_);
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(800);
  return { page, ctx, errors };
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('pawn-state-v1')));
const waitSave = async (page, fn) => { for (let i = 0; i < 40; i++){ const s = await saved(page); if (s && fn(s)) return s; await page.waitForTimeout(250); } throw new Error('state not saved'); };
const notes = page => page.$$eval('#notes .note:not(.bye) b', a => a.map(x => x.textContent));
async function craftOnce(page){
  await page.click('[data-add="1"]'); await page.click('#craft');
  await page.waitForSelector('#fx.done', { timeout: 20000 }); await page.waitForTimeout(400);
  await page.click('#fxTake'); await page.waitForTimeout(1500);
}
async function rotateSeed(page){
  if (await page.$('#backdrop.on')) { await page.mouse.click(195, 8); await page.waitForTimeout(500); }   // после кейса снова открыты бонусы
  await page.click('#menuBtn'); await page.waitForTimeout(400); await page.click('[data-go="pfi"]'); await page.waitForTimeout(500);
  await page.click('#cseedNew'); await page.waitForTimeout(800); await page.mouse.click(195, 8); await page.waitForTimeout(500);
}
async function verified(proof){ const steps = await verifyProof(proof, null); const bad = steps.filter(s => s.status !== 'verified'); assert.deepEqual(bad, [], JSON.stringify(bad)); }

test('запуск без ошибок', async () => {
  const { page, ctx, errors } = await open();
  assert.ok(await page.$('#craft')); assert.match(await page.textContent('#bal'), /\d/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('крафт: ставка списывается, результат в истории, доказательство проходит fair-verify.js', async () => {
  const { page, ctx, errors } = await open();
  const s0 = await waitSave(page, s => s.hist.crafts.length);
  await craftOnce(page);
  const s1 = await waitSave(page, s => s.hist.crafts.length === s0.hist.crafts.length + 1);
  const r = s1.hist.crafts[0].r;
  assert.equal(r.stake, 1);
  assert.equal(Math.round((s1.balance - (s0.balance - 1)) * 100) / 100, r.nft ? r.change : r.win, 'баланс = было − ставка + выигрыш');
  assert.equal(r.proof.server_seed, '', 'зерно до смены ключа не раскрыто');
  await rotateSeed(page);
  const s2 = await waitSave(page, s => s.hist.crafts[0].r.proof.server_seed);
  await verified(s2.hist.crafts[0].r.proof);
  assert.deepEqual(errors, []); await ctx.close();
});

test('кейс: открытие и проверка доказательства', async () => {
  const { page, ctx, errors } = await open();
  const s0 = await waitSave(page, s => s.hist.cases.length);
  await page.click('#menuBtn'); await page.waitForTimeout(400); await page.click('[data-go="cases"]'); await page.waitForTimeout(500);
  await page.click('#casesTabs [data-k="cases"]'); await page.waitForTimeout(400); await page.click('[data-info="durov"]'); await page.waitForTimeout(500);
  await page.click('#caseGo');
  await page.waitForSelector('#fx.done', { timeout: 20000 }); await page.waitForTimeout(400); await page.click('#cTake'); await page.waitForTimeout(1500);
  await waitSave(page, s => s.hist.cases.length === s0.hist.cases.length + 1);
  await rotateSeed(page);
  const s2 = await waitSave(page, s => s.hist.cases[0].r.proof.server_seed);
  await verified(s2.hist.cases[0].r.proof);
  assert.deepEqual(errors, []); await ctx.close();
});

test('вывод NFT: по одному, уведомление на каждый, комиссия за каждый', async () => {
  const { page, ctx, errors } = await open();
  const s0 = await waitSave(page, s => s.inv.length >= 3);
  await page.click('#menuBtn'); await page.waitForTimeout(400); await page.click('[data-go="withdraw"]'); await page.waitForTimeout(600);   // пункт «Вывод NFT» в меню
  assert.equal(await page.textContent('#walletTabs .tab.on'), 'Вывести NFT');
  for (let i = 0; i < 3; i++) await page.click(`#onft .cell >> nth=${i}`);
  await page.click('#walletGo');
  const seen = new Set();
  for (let t = 0; t < 40; t++){ (await notes(page)).forEach(n => seen.add(n)); await page.waitForTimeout(100); }
  assert.equal([...seen].filter(n => /отправлен/.test(n)).length, 3);
  const s1 = await waitSave(page, s => s.inv.length === s0.inv.length - 3);
  assert.equal(Math.round((s0.balance - s1.balance) * 100) / 100, 0.9);
  assert.deepEqual(errors, []); await ctx.close();
});

test('прогресс сохраняется после перезагрузки', async () => {
  const { page, ctx } = await open();
  const s0 = await waitSave(page, s => s.hist.crafts.length);
  await craftOnce(page);
  const s1 = await waitSave(page, s => s.hist.crafts.length === s0.hist.crafts.length + 1);
  await page.reload(); await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }); await page.waitForTimeout(800);
  assert.equal(await page.textContent('#bal'), String(s1.balance));
  const s2 = await saved(page);
  assert.equal(s2.hist.crafts.length, s1.hist.crafts.length);
  await ctx.close();
});

test('английский: на главной и в меню нет русского текста', async () => {
  const { page, ctx, errors } = await open({ lang: 'en' });
  const cyr = () => page.evaluate(() => { const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) if (/[А-Яа-яЁё]/.test(n.data) && !/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) && n.parentNode.offsetParent !== null) out.push(n.data.trim()); return out; });
  assert.deepEqual(await cyr(), []);
  await page.click('#menuBtn'); await page.waitForTimeout(500);
  assert.deepEqual(await cyr(), []);
  assert.deepEqual(errors, []); await ctx.close();
});
