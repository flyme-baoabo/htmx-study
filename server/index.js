import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { createApp } from './app.js';
import { mountRoutes } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 3002;

async function main() {
  const app = createApp();
  const server = http.createServer(app);

  if (!isProd) {
    // 开发模式：把 Vite 作为 Express 中间件挂载，复用 HMR 管线
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: 'custom',
    });
    app.locals.isDev = true;
    app.use(vite.middlewares);
  } else {
    // 生产模式：直接服务构建产物
    app.locals.isDev = false;
    app.use(express.static(path.join(__dirname, '../dist')));
  }

  mountRoutes(app);

  server.listen(port, () => {
    console.log(`htmx-study → http://localhost:${port} (${isProd ? 'production' : 'dev'})`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});