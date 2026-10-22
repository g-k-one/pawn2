// Запекает шум Горна в assets/fx/fx-noise.png: телефон не считает его при старте (≈25–80 мс на слабом).
// Запускать после правки noiseData() в src/app/16e-forge.js: `node tools/fx-noise.mjs`
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const srv = await serve(process.cwd(), 8794), br = await chromium.launch();
const page = await br.newPage();
await page.route('**/__n.html', r => r.fulfill({ contentType: 'text/html', body: '<script src="/src/app/16e-forge-atlas.js"></script><script src="/src/app/16e-forge.js"></script>' }));
await page.goto('http://localhost:8794/__n.html');
const d = Buffer.from(await page.evaluate(() => Array.from(Forge._noise())));
await br.close(); srv.close();
// PNG без цветовых меток (браузер не поправит байты): RGBA 8 бит, строки с фильтром 0
const N = 128, raw = Buffer.alloc(N * (N * 4 + 1));
for (let y = 0; y < N; y++) d.copy(raw, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4);
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
const chunk = (t, b) => { const h = Buffer.alloc(8); h.writeUInt32BE(b.length); h.write(t, 4); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([h.subarray(4), b]))); return Buffer.concat([h, b, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
await writeFile('assets/fx/fx-noise.png', png);
console.log('assets/fx/fx-noise.png —', (png.length / 1024).toFixed(1), 'КБ');
