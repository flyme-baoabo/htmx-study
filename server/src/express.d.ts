/**
 * Express 全局类型扩展。
 * 注意：res.renderPage、res.isFragmentRequest、req.isHXRequest 等
 * 已由 middleware/render.middleware.ts 与 middleware/fragment.middleware.ts 自行 declare global，
 * 此处不再重复声明 renderPage，仅保留引用，避免签名不一致冲突。
 */
import type { RenderPageOptions } from './middleware/render.middleware.js';

declare global {
    namespace Express {
        interface Response {
            /**
             * 一次性完成「内容 -> app-layout 外壳 -> 外层 layout」两层嵌套渲染。
             * 由 middleware/render.middleware.ts 在该中间件作用域内挂载到 res 上。
             */
            renderPage(pageView: string, options: RenderPageOptions): Promise<void>;
        }
    }
}

export {};