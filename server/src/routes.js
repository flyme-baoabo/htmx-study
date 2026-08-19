import { homeRouter } from './routes/home.js';

/** 挂载业务路由到 app */
export function mountRoutes(app) {
    app.use('/', homeRouter);
}