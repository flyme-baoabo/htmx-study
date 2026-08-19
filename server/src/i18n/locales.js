/** 项目支持的语言白名单（供语言探测 / 路由校验 / 外部引用） */
export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'];

/**
 * 按语言键加载对应翻译 JSON（业务层工具，返回值直接可作模板变量 / 前端 window.I18n）。
 * @param {string} lang 语言码，如 'zh-CN'、'en-US'
 * @returns {Promise<object>} 语言包对象
 */
export async function loadI18n(lang = 'zh-CN') {
    const mod = await import(`../locales/${lang}.json`, { with: { type: 'json' } });
    return mod.default;
}