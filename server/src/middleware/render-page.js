/**
 * render-page 中间件：在 res 上挂载 res.renderPage(...)，一次性完成
 * 「页面内容 + app-layout 外壳」两层嵌套。
 *
 *   - 整页  (pageLayout = true / layout = '布局名')：内容 -> app-layout.ejs -> 由 express-ejs-layouts 套指定的外层布局（layout.ejs）
 *   - 片段  (pageLayout = false)：内容 -> app-layout.ejs（不套 layout.ejs，供语言切换 /body 整块替换 #root）
 *   - 业务路由统一用 res.renderPage('视图', { ... })，不必再手写两层嵌套。
 *   - 新增页面（/list、/signin、/signup…）只需新增一个内容视图即可复用同一套 shell；
 *     登录/注册类页面传 { showHeader: false } 可隐藏顶栏。
 *   - layout 选项：默认由 pageLayout 推导（true→'layout'，false→false）；
 *     也可显式传布局名（如 layout: 'layout-admin'）或 layout: false 关闭外层布局。
 *
 * ⚠️ 注册顺序：必须在 render-fragment 之后挂载。
 */
export default function renderPageMiddleware(req, res, next) {
    res.renderPage = async function (pageView, options = {}) {
        // pageLayout: 布尔开关（true→用默认布局；false→不套外层布局）
        // layout:     布局名覆盖（'layout'/'layout-admin' 等）；显式传 false 则关闭
        const {
            pageShell = 'layouts/app-layout',
            pageShellSlot = 'outletContent',
            pageLayout = true,
            layout = pageLayout ? 'layouts/layout' : false,
            ...pageOptions
        } = options;

        try {
            // ① 先把页面内容渲成纯字符串
            const contentHtml = await new Promise((resolve, reject) => {
                res.render(pageView, { ...pageOptions, layout: false }, (err, html) => {
                    if (err) reject(err);
                    else resolve(html);
                });
            });
            // ② 再用 app-layout 外壳包裹内容；layout 决定继续套哪个外层布局（false=只发 app-layout 片段）
            // 不传回调 → Express 自动 send + 自动 caught 错误进 next(err)
            res.render(pageShell, {
                ...pageOptions,              // title / todos / i18nJson / currentPage 等原样透传给外壳与 layout
                [pageShellSlot]: contentHtml,  // 页面内容注入 <main id="outlet">（命名避开 express-layouts 的 body/content 内部变量）
                layout,
            });
        } catch (err) {
            return next(err);
        }
    };

    next();
}
