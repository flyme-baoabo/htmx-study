import type { Request, Response, NextFunction } from 'express';

/**
 * 单层布局壳配置
 */
export interface LayoutLayer {
    /** 模板名称，对应views下模板 */
    tplName: string;
    /** 接收上一层输出html的插槽变量名 */
    slotKey: string;
}

/**
 * renderPage 入参选项
 */
export interface RenderPageOptions {
    /** 中间布局外壳数组，由内向外执行 */
    layouts?: LayoutLayer[];
    /**
     * 最后一层是否开启 express‑ejs‑layouts 外层layout
     * true: 最后一层res.render传入 layout:'layout'，最外层layout.ejs 使用 <%- body %>
     * false: 最后一层传入 layout:false，不套全局layout
     */
    useOuterEjsLayout?: boolean;

    // 兼容旧接口参数
    /** 兼容老参数：单中间壳模板名 */
    pageShell?: string;
    pageShellSlot?: string;
    /**
     * 兼容老参数：是否启用最外层全局 layout（layout.ejs）。缺省视为 true。
     * 优先级用 useOuterEjsLayout > pageLayout > 默认 true 兜底。
     * - true：最外层外壳 res.render 传 layout:'layouts/layout'，输出完整骨架页。
     * - false：最外层外壳传 layout:false，输出仅「外壳+内容」的片段（无 <html>/<head>/<body> 骨架），
     *     供 htmx /body 整块替换 #root 场景；勿用于整页导航，否则缺骨架裸页。
     */
    pageLayout?: boolean;

    /** 其余透传给模板的业务locals */
    [key: string]: any;
}

/**
 * 将 res.render promisify，获取渲染后的html字符串
 * 注意：项目不要注册 express‑ejs‑layouts 中间件劫持，否则结果会被干扰
 */
function renderToHtml(res: Response, view: string, locals: Record<string, any>): Promise<string> {
    return new Promise((resolve, reject) => {
        res.render(view, locals, (err, html) => {
            if (err) return reject(err);
            resolve(html);
        });
    });
}

/**
 * renderPageMiddleware
 *
 * 核心逻辑：
 * 1. 先渲染业务页面，layout:false 拿到初始html片段
 * 2. 遍历layouts数组：
 *    - 非最后一层：renderToHtml 获取字符串，循环拼装，layout强制false
 *    - 最后一层：直接调用 res.render，根据 useOuterEjsLayout 设置 layout 参数，由框架输出响应
 * 3. layouts为空时直接输出业务页面html
 * 4. 兼容旧 pageShell / pageLayout 调用方式
 *
 * @example
 * res.renderPage('admin/dashboard', {
 *   layouts: [
 *     { tplName: 'admin/wrapper', slotKey: 'innerHtml' },
 *     { tplName: 'app-layout', slotKey: 'outletContent' }
 *   ],
 *   useOuterEjsLayout: true,
 *   title: '管理后台'
 * })
 */
export default function renderPageMiddleware(req: Request, res: Response, next: NextFunction) {
    /**
     * @param pageView 业务页面模板路径
     * @param options 渲染配置与locals变量
     */
    res.renderPage = async function renderPage(pageView: string, options: RenderPageOptions) {
        const {
            layouts = [],
            useOuterEjsLayout,
            pageShell = 'layouts/app-layout',
            pageShellSlot = 'outletContent',
            pageLayout,
            ...pageOptions
        } = options;

        let stack: LayoutLayer[] = [...layouts];

        // 兼容旧调用：不传layouts，使用 pageShell
        if (!Array.isArray(layouts) && pageShell && pageShellSlot) {
            stack = [{ tplName: pageShell, slotKey: pageShellSlot }];
        }

        // 优先级：useOuterEjsLayout > pageLayout > 默认true
        const outerFlag = useOuterEjsLayout ?? pageLayout ?? true;

        try {
            // 渲染业务页面本体，关闭布局，拿到原始html片段
            let currentHtml = await renderToHtml(res, pageView, {
                ...pageOptions,
                layout: false
            });

            const len = stack.length;

            for (let i = 0; i < len; i++) {
                const layer = stack[i];
                const { tplName, slotKey } = layer;
                const isLastLayer = i === len - 1;

                if (!isLastLayer) {
                    // 中间层：拿到html字符串继续拼装，强制 layout:false
                    currentHtml = await renderToHtml(res, tplName, {
                        ...pageOptions,
                        [slotKey]: currentHtml,
                        layout: false
                    });
                } else {
                    // 最后一层：直接 res.render，不再走renderToHtml
                    const finalLayoutOpt = outerFlag ? 'layouts/layout' : false;

                    res.render(tplName, {
                        ...pageOptions,
                        [slotKey]: currentHtml,
                        layout: finalLayoutOpt
                    }, (err) => {
                        if (err) return next(err);
                    });
                    // 直接返回，防止后续执行 res.send 造成重复响应
                    return;
                }
            }

            // layouts为空：没有任何外壳，直接输出业务页面渲染结果
            res.send(currentHtml);

        } catch (err) {
            next(err);
        }
    };

    next();
}


// ---------- 扩展Express类型，给Response增加renderPage方法 ----------
declare global {
    namespace Express {
        interface Response {
            renderPage(pageView: string, options: RenderPageOptions): Promise<void>;
        }
    }
}