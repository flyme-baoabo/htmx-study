import type { Request, Response, NextFunction } from 'express';
import type { LayoutLayer, RenderPageOptions } from '../types/render.js';

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
        if (Array.isArray(layouts) && layouts.length === 0 && pageShell && pageShellSlot) {
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
                    // 最后一层：渲染出完整 HTML 字符串，再由外层 layout 包裹后主动 send。
                    // 不要走 res.render(…, {layout})：若全局注册了 express-ejs-layouts，
                    // 其 res.render 劫持可能让响应缓冲却永不 end，导致请求一直 pending。
                    const innerHtml = await renderToHtml(res, tplName, {
                        ...pageOptions,
                        [slotKey]: currentHtml,
                        layout: false
                    });

                    const finalHtml = outerFlag
                        ? await renderToHtml(res, 'layouts/layout', {
                              ...pageOptions,
                              body: innerHtml,
                              layout: false
                          })
                        : innerHtml;

                    res.status(200).type('html').send(finalHtml);
                    // 直接返回，防止执行到 catch / res.send 造成重复响应
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