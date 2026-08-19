import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import expressLayouts from 'express-ejs-layouts';
import i18next from 'i18next';
import I18nHttpMiddleware from 'i18next-http-middleware';

// 下面的为 Node 各版本 兼容写法，Node 18支持直接 import zhCN from './locales/zh-CN.json'，高版本 需要加上 with { type: 'json' }
// import { createRequire } from 'node:module';
// import { readFileSync } from 'node:fs';
// const require = createRequire(import.meta.url);
// const zhCN = JSON.parse(readFileSync(require.resolve('./locales/zh-CN.json'), 'utf8'));
// const enUS = JSON.parse(readFileSync(require.resolve('./locales/en-US.json'), 'utf8'));
import zhCN from './locales/zh-CN.json' with { type: 'json' };
import enUS from './locales/en-US.json' with { type: 'json' };

export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 创建 Express 应用（不含路由与前端中间件）。
 * 这样测试端可通过 createApp() + mountRoutes() 直接组合，
 * 生产端通过静态目录，开发端由 index.js 注入 Vite middleware。
 */
export async function createApp() {
    const app = express();

    // 视图引擎
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.set('layout', 'layout');
    app.use(expressLayouts);

    // 视图可见标志：开发(true) 由 Vite 提供前端资源；生产(false) 用 dist 静态资源
    app.locals.isDev = process.env.NODE_ENV !== 'production';

    // 请求体解析
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    await i18next
        .use(I18nHttpMiddleware.LanguageDetector) // 注册"语言探测器"插件：让 i18next 知道按 detection 规则去探测语言
        .init({

            resources: {                            // resources：静态翻译字典，key = 语言代码，value = 翻译内容对象
                'zh-CN': { translation: zhCN },       // 中文语言包
                'en-US': { translation: enUS },       // 英文语言包
            },
            fallbackLng: 'zh-CN',                   // 上面都探测不到 / 语言包缺失时，兜底用的语言
            /**
             * 语言码归一化：
             *  - supportedLngs(保留)：白名单，只允许这两种语言码启用。没有它，i18next 会接受任意语言码
             *    (如 Accept-Language: fr)，写回 lang cookie 会混入脏值；有了它只有 zh-CN/en-US 真正启用。
             *  - nonExplicitSupportedLngs(弃用)：仅配合 supportedLngs 才有意义——允许“无区域语言码”
             *    (如 Accept-Language: zh) 按前缀归一到 zh-CN。但现代浏览器发的是完整码
             *    (Accept-Language: zh-CN,zh;q=0.9)，靠 i18next 默认大小写不敏感匹配已能对上，用不上。
             *
             *  ⚠️ 重要经验(i18next 26.3.6)：supportedLngs 与 nonExplicitSupportedLngs 不可同时开启！
             *    二者同开会嵌套 key 解析失效：整页所有 t('todos.section_hint') 原样返回 key，
             *    req.i18n.exists() === false，即便 getResourceBundle('zh-CN','translation') 结构完全正常
             *    (顶层键 app/nav/hero/validation/todos/confirm 都在)。任一单独开启都正常。
             *    因此本项目保留 supportedLngs，弃用 nonExplicitSupportedLngs。
             */
            supportedLngs: SUPPORTED_LANGUAGES,
            // nonExplicitSupportedLngs: true, // 弃用：勿与 supportedLngs 同时开启，见上方注释
            detection: {
                order: [                              // order：按此优先级依次探测语言来源；排前面的先命中 (先看 URL 参数 ?lang=，再看 lang cookie，最后看 Accept-Language 头)
                    'querystring',
                    'cookie',
                    'header'
                ],
                caches: ['cookie'],                   // 一旦确定语言，就写回 cookie，后续 htmx 局部刷新靠它保持语言一致
                lookupCookie: 'lang',                 // 探测/写回时，cookie 的名字叫 lang（如 lang=en-US）
                lookupQuerystring: 'lang',            // 探测 URL 参数时，参数名也叫 lang（即 ?lang=en-US）
            },
        });

    app.use(I18nHttpMiddleware.handle(i18next)); // ① 每请求解析语言，挂 req.t() / req.i18n

    // ② 把 req.t 桥接到 res.locals，EJS 模板（含 partials）才能直接用 <%= t('...') %>
    app.use((req, res, next) => {
        res.locals.t = req.t; // 模板里的 t 即当前请求语言的翻译函数
        res.locals.currentLocale = req.i18n?.language || 'zh-CN'; // html lang 等场景需要
        next();
    });

    // 统一处理局部片段：凡是 partials 模板都走原始渲染（res.__render），
    // 彻底绕开 express-ejs-layouts 的布局包装，返回可被 htmx 替换的纯片段。
    // 这样路由里就不必每一处都写 layout: false 了。
    app.use((req, res, next) => {
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
    });

    return app;
}