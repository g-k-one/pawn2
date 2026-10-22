// Статический сервер для локального просмотра и тестов: `npm run serve` → http://localhost:8765
// Корень — папка проекта (или первая переданная папка, например dist).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = process.argv[2] || fileURLToPath(new URL('..', import.meta.url)), port = +process.env.PORT || 8765;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
export function serve(dir = root, p = port){
  dir = dir.replace(/^\/([A-Za-z]:)/, '$1');   // Windows: URL.pathname даёт /C:/… — без ведущего слэша
  const srv = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    try { const body = await readFile(join(dir, /[\\/]$/.test(path) ? path + 'index.html' : path));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream', 'content-length': body.length }); res.end(body); }
    catch { res.writeHead(404); res.end('not found'); }
  });
  return new Promise(r => srv.listen(p, () => r(srv)));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) serve().then(() => console.log(`http://localhost:${port}`));
