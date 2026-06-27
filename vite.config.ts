import { readdir, readFile, stat } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

const STATS_DIR = fileURLToPath(new URL('./stats', import.meta.url));
const USERCACHE_FILE = fileURLToPath(new URL('./usercache.json', import.meta.url));

/**
 * Dev-only middleware that serves the repo-local `stats/` directory in the
 * same shape the production `static-web-server` does:
 *
 *   GET /stats/            -> JSON directory listing
 *   GET /stats/<uuid>.json -> raw stats file
 *   GET /usercache.json    -> the MC server's user cache (uuid -> name)
 *
 * This mirrors SWS's `--directory-listing-format=json` contract so the app
 * code is identical in dev and prod.
 */
function statsDevServer(): Plugin {
  return {
    name: 'mc-stats-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';

        // Strip query string (the app appends ?t=<timestamp> cache busters).
        const pathname = decodeURIComponent(url.split('?')[0]);

        // Serve the repo-local usercache.json, mirroring the file the MC server
        // writes and that gets bind-mounted at /public/usercache.json in prod.
        // Absent file -> 404, so the app falls back to raw UUIDs just like prod.
        if (pathname === '/usercache.json') {
          try {
            const body = await readFile(USERCACHE_FILE);
            res.setHeader('content-type', 'application/json');
            res.end(body);
          } catch {
            res.statusCode = 404;
            res.end('Not found');
          }
          return;
        }

        if (!url.startsWith('/stats')) return next();
        const relative = normalize(pathname.replace(/^\/stats\/?/, '')).replace(/^(\.\.(\/|\\|$))+/, '');

        try {
          if (relative === '' || relative === '.') {
            const names = await readdir(STATS_DIR);
            const entries = await Promise.all(
              names.map(async name => {
                const info = await stat(join(STATS_DIR, name));
                return {
                  name: info.isDirectory() ? `${name}/` : name,
                  type: info.isDirectory() ? 'directory' : 'file',
                  mtime: info.mtime.toISOString().replace(/\.\d{3}Z$/, 'Z'),
                  ...(info.isFile() ? { size: info.size } : {}),
                };
              }),
            );
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(entries));
            return;
          }

          const filePath = join(STATS_DIR, relative);
          if (!filePath.startsWith(STATS_DIR)) {
            res.statusCode = 403;
            res.end('Forbidden');
            return;
          }
          const body = await readFile(filePath);
          res.setHeader('content-type', 'application/json');
          res.end(body);
        } catch {
          res.statusCode = 404;
          res.end('Not found');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), statsDevServer()],
  build: {
    outDir: 'dist',
  },
});
