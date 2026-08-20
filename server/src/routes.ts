import { pagesRouter } from './routes/pages.js';
import { localeRouter } from './routes/locale.js';
import { listRouter } from './routes/list.js';
import type { Express } from 'express';

/** 挂载业务路由到 app */
export function mountRoutes(app: Express): void {
    app.use('/', pagesRouter);
    app.use('/', localeRouter);
    app.use('/', listRouter);
}