/**
 * Express 全局类型扩展。
 * 这些自定义属性都挂在运行时版本的 req / res 上（由各 middleware 赋值），
 * 这里补齐类型，方便路由与中间件在严格模式下直接使用，无需每次强转。
 */
declare global {
    namespace Express {
        interface Response {
            /**
             * 一次性完成「内容 -> app-layout 外壳 -> 外层 layout」两层嵌套渲染。
             * 由 middleware/render-page.ts 在该中间件作用域内挂载到 res 上。
             */
            renderPage(pageView: string, options?: Record<string, unknown>): void;
        }
    }
}

export {};