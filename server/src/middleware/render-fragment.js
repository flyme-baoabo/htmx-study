/**
 * render-fragment 中间件：统一处理局部片段渲染。
 * 凡是 partials 模板都走原始渲染（res.__render），
 * 彻底绕开 express-ejs-layouts 的布局包装，返回可被 htmx 替换的纯片段。
 * 这样路由里就不必每一处都写 layout: false 了。
 *
 * ⚠️ 注册顺序：必须在 render-page 之前挂载（renderPage 内部调用 res.render，需要经过本包装）。
 */
export default function fragmentRenderMiddleware(req, res, next) {
    const layoutRender = res.render; // expressLayouts 包装后的 render

    res.render = function (view, options, callback) {
        // 判断依据是“视图名”而非 req.url：partials/ 开头的模板都是局部片段
        if (typeof view === 'string' && view.startsWith('partials/')) {
            // 直接调用库存原 render，不套任何布局，返回可被 htmx 替换的纯片段
            return res.__render.call(this, view, options, callback);
        }
        return layoutRender.call(this, view, options, callback);
    };

    next();
}