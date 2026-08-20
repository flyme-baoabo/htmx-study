import http from 'node:http';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApp } from './app.js';
import { mountRoutes } from './routes.js';
import { clientDistDir } from './paths.js';
import type { Express } from 'express';

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 3006;

async function main(): Promise<void> {
    const app = await createApp();
    const server = http.createServer(app);

    if (!isProd && typeof server === 'object') {
        // 开发模式：把 Vite 作为 Express 中间件挂载，复用 HMR 管线
        const vite = await createViteServer({
            server: { middlewareMode: true, hmr: { server } as never },
            appType: 'custom',
        });
        (app as Express).locals.isDev = true;
        app.use(vite.middlewares);
    } else {
        // 生产模式：直接服务构建产物
        (app as Express).locals.isDev = false;
        app.use(express.static(clientDistDir));
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