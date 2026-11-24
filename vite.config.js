import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function loadDotEnvToProcess(rootDir) {
  for (const name of ['.env', '.env.local']) {
    const filePath = path.join(rootDir, name);
    if (!fs.existsSync(filePath)) continue;
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function localApiPlugin() {
  const apiRoot = path.resolve(process.cwd(), 'api');
  loadDotEnvToProcess(process.cwd());

  return {
    name: 'ag-store-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlPath = (req.url || '').split('?')[0];
        if (!urlPath.startsWith('/api/')) return next();

        const rel = urlPath.replace(/^\/api\//, '').replace(/\/+$/, '');
        if (!rel || rel.includes('..') || rel.startsWith('_lib')) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: 'Not found' }));
          return;
        }

        const targetFile = path.join(apiRoot, `${rel}.js`);
        if (!fs.existsSync(targetFile)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: `API route not found: /api/${rel}` }));
          return;
        }

        try {
          const modUrl = `${pathToFileURL(targetFile).href}?t=${Date.now()}`;
          const mod = await import(modUrl);
          if (typeof mod.default === 'function') {
            await mod.default(req, res);
            return;
          }
          next();
        } catch (err) {
          console.error('[Local API Error]', urlPath, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: false, error: err?.message || 'Internal Server Error' }));
          }
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), localApiPlugin()],
  server: {
    port: 8888,
    strictPort: true,
    host: true
  },
  preview: {
    port: 8888,
    strictPort: true,
    host: true
  }
});
