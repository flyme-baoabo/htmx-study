/**
 * 页面注册表：URL 路径 -> 页面内容视图 + 标题。
 * 渲染链由 res.renderPage 统一处理（内容 -> app-layout -> layout.ejs）。
 *
 * 语言切换 /body 靠它按当前 path 找到对应视图，保证无感切换后重绘的是“当前页”。
 * 新增页面（/signin、/signup…）只需在此登记，整页路由与 /body 重绘自动生效。
 */
export const PAGE_META = {
    '/': { view: 'index', title: 'htmx Study' },
    '/list': { view: 'listPage', title: '待办清单 - htmx Study' },
};

/** 按 path 取页面元信息；未知 path 兜底到首页。 */
export function metaForPath(path) {
    return PAGE_META[String(path || '/')] || PAGE_META['/'];
}