import express from 'express';
import { loadI18n } from '../i18n/locales.js';
import { PAGE_META } from '../views.js';
import { list as listTodos } from '../list.js';

const router = express.Router();

// 整页路由：按页面注册表 PAGE_META 生成 GET /<path>。
// 每个页面都加载所需 i18n，用 res.renderPage 组合「内容 -> app-layout -> layout.ejs」。
for (const [path, meta] of Object.entries(PAGE_META)) {
    router.get(path, async (req, res, next) => {
        const lang = res.locals.currentLocale || 'zh-CN';
        const i18nJson = await loadI18n(lang);
        res.renderPage(meta.view, {
            title: meta.title,
            todos: listTodos(),
            i18nJson,
            currentPage: path,
        });
    });
}

export { router as pagesRouter };