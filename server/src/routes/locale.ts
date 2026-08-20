import express from 'express';
import { SUPPORTED_LANGUAGES, loadI18n } from '../i18n/locales.js';
import { metaForPath } from '../views.js';
import { list as listTodos } from '../list.js';

const router = express.Router();

// 语言会话路由（locale menu）：处理“当前语言”的切换与无感重绘。
// 起名 locale 而非 session，是为避免与“用户登录会话”混淆。

// 语言切换（前端 POST 后拿到当前语言包，更新前端 I18n 字典）
router.post('/change-language', async (req, res) => {
    const lang = String(req.body?.lang || '');
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
        return res.status(400).json({ isSuccess: false, message: `Unsupported language: ${lang}` });
    }
    res.cookie('lang', lang, {
        httpOnly: false,
        path: '/'
    });
    const i18nJson = await loadI18n(lang);
    res.status(200).json({ i18nJson, isSuccess: true });
});

// 语言无感切换：按当前 path 重绘 app-layout 片段（不套外层 layout.ejs），供 htmx 整块替换 #root。
// 前端会带 ?path=<location.pathname>，据此还原“当前页”的内容。
router.get('/body', async (req, res, next) => {
    const lang = res.locals.currentLocale || 'zh-CN';
    const i18nJson = await loadI18n(lang);
    const meta = metaForPath(req.query.path);
    res.renderPage(meta.view, {
        title: meta.title,
        todos: listTodos(),
        i18nJson,
        currentPage: String(req.query.path || '/'),
        pageLayout: false,
    });
});

export { router as localeRouter };