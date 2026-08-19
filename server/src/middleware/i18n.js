import i18next from 'i18next';
import I18nHttpMiddleware from 'i18next-http-middleware';

/**
 * 每请求解析语言，挂 req.t() / req.i18n。需在 initI18n() 完成后挂载。
 * @returns {import('express').RequestHandler}
 */
export function i18nRequest() {
    return I18nHttpMiddleware.handle(i18next);
}

/**
 * 请求级桥接：把 req.t 接到 res.locals。
 * EJS 模板（含 partials）才能直接用 <%= t('...') %>，并暴露 currentLocale。
 * @type {import('express').RequestHandler}
 */
export function localeBridge(req, res, next) {
    res.locals.t = req.t; // 模板里的 t 即当前请求语言的翻译函数
    res.locals.currentLocale = req.i18n?.language || 'zh-CN'; // html lang 等场景需要
    next();
}