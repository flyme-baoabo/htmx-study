import type { Request, Response, NextFunction } from 'express';

/**
 * render-fragment 中间件：统一处理局部片段渲染。
 * 凡是 partials 模板都走原始渲染（res.__render），
 * 彻底绕开 express-ejs-layouts 布局包装，返回可被 htmx 替换的纯片段。
 * 这样路由里就不必每一处都写 layout: false 了。
 *
 * ⚠️ 注册顺序：必须在 render-page 之前挂载（renderPage 内部调用 res.render，需要经过本包装）。
 */
export default function fragmentRenderMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const layoutRender = res.render; // expressLayouts 包装后的 render

    res.render = function (
        this: Response,
        view: string,
        options?: object | ((err: Error, html: string) => void),
        callback?: (err: Error, html: string) => void
    ): void {
        // 判断依据是“视图名”而非 req.url：partials/ 开头的模板都是局部片段
        if (view.startsWith('partials/')) {
            // 直接调用 express-layouts 保存的原始 render，不套任何布局，返回可被 htmx 替换的纯片段
            // res.__render 的类型由 express.d.ts 扩展补充
            if (typeof options === 'function') {
                return res.__render!(view, options);
            }
            return res.__render!(view, options || {}, callback);
        }
        // 非片段：转发给 express-layouts 包装后的 render 原样处理
        if (typeof options === 'function') {
            return layoutRender(view, options);
        }
        return layoutRender(view, options, callback);
    };

    next();
}