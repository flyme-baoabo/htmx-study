/**
 * 渲染配套类型（普通导出模块）。
 *
 * 与全局声明类型的分离：*This* 文件是普通 TS 模块，纯导出可复用的具名类型；
 * 全局的 Express.Request / Response 扩展则放在 types/express.d.ts 中一并声明。
 * 两边通过 `import type` 互相解耦，避免把「类型定义」和「全局环境注入」揉在一起。
 */

/**
 * res.render 的宽松业务 locals（可透传给模板的任意键值）。
 * 与 RenderPageOptions 不同：它只描述「透传数据」，不含渲染专用配置字段。
 */
export type RenderOptions = Record<string, string | number | boolean | object | null | undefined>;

/**
 * 单层布局壳配置（renderPage 的 layouts 数组元素）。
 */
export interface LayoutLayer {
    /** 模板名称，对应 views 下模板 */
    tplName: string;
    /** 接收上一层输出内容的插槽变量名 */
    slotKey: string;
}

/**
 * renderPage 入参选项（结构化配置 payload）。
 */
export interface RenderPageOptions {
    /** 中间布局外壳数组，由内向外执行 */
    layouts?: LayoutLayer[];
    /**
     * 最后一层是否开启 express-ejs-layouts 外层 layout。
     * true: 最后一层 res.render 传入 layout:'layouts'，最外层 layout.ejs 使用 <%- body %>
     * false: 最后一层传入 layout:false，不套全局 layout。
     */
    useOuterEjsLayout?: boolean;

    // 兼容旧接口参数
    /** 兼容老参数：单中间壳模板名 */
    pageShell?: string;
    pageShellSlot?: string;
    /**
     * 兼容老参数：是否启用最外层全局 layout（layout.ejs）。缺省视为 true。
     * 优先级用 useOuterEjsLayout > pageLayout > 默认 true 兜底。
     * - true: 最外层外壳 res.render 传 layout:'layouts/layout'，输出完整骨架页。
     * - false: 最外层外壳传 layout:false，输出仅「外壳+内容」的片段（无 html/head/body 骨架），
     *     供 htmx /body 整块替换场景；勿用于整页导航，否则缺骨架裸页。
     */
    pageLayout?: boolean;

    /** 其余透传给模板的业务 locals */
    [key: string]: any;
}