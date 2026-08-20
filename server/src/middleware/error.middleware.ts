import type { Request, Response, NextFunction } from 'express';

/**
 * 业务错误（携带 HTTP 状态码）。
 * 让 controller 可以 `throw new HttpError(404, 'Todo Not Found!')`，
 * 错误统一交给全局 errorHandler 映射成对应状态码响应，controller 不再手写 send。
 */
export class HttpError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }
}

/**
 * 404 兜底：把所有未命中任何路由的请求集中到这里。
 * 对 htmx 请求返回片段友好的纯文本，其余按 JSON/文本返回。
 */
export function notFoundHandler(req: Request, res: Response): void {
    const message = `Not Found - ${req.method} ${req.originalUrl}`;
    if (isHtmxRequest(req) || prefersHtml(req)) {
        res.status(404).type('text').send(message);
        return;
    }
    res.status(404).json({ error: message });
}

/**
 * 全局错误处理中间件（必须 4 参，Express 才能识别为 error handler）。
 *
 * 拦截两类错误：
 *   1. Express 渲染管道的真实异常——fragmentRenderMiddleware 的 `nativeRender`（无回调
 *      → 自动 next(err)）以及 renderPageMiddleware 的 `try/catch → next(err)`（见
 *      render.middleware.ts 110 行）。
 *   2. controller 里显式 `throw new HttpError(...)`（经 next(err) 到达这里）。
 *
 * 处理策略：
 *   - instanceOf HttpError → 按其 status 映射（400/404 等业务状态码）；
 *   - 其余未知异常 → 记日志 + 500（技术故障）。
 */
export function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: NextFunction
): void {
    // 响应可能已发送（头已 flush）则只能交给 Express 默认处理，避免二次响应
    if (res.headersSent) {
        return next(err);
    }

    // 业务错误：所有 HttpError 都在这处理。
    // 涵盖各类 4xx / 5xx（及任意自定义状态码）——只要 controller `throw new HttpError(status, msg)`，
    // 响应状态码一律取 `err.status`，不做 4xx/5xx 之分的特判。
    // 响应形态按请求类型：htmx / 浏览器导航 → 纯文本片段；fetcth 等 API（Accept 非 html）→ JSON。
    if (err instanceof HttpError) {
        const body = err.message || 'Request Error';
        if (isHtmxRequest(req) || prefersHtml(req)) {
            // 供 htmx 直接插入 hx-target：htmx 默认不 swap 4xx/5xx，
            // 由客户端监听 htmx:beforeSwap 设 shouldSwap=true 后，
            // 这团纯文本才能按 hx-swap 进到目标元素（见 client/src/handleError.ts）。
            res.status(err.status).type('text').send(body);
        } else {
            res.status(err.status).json({ error: body });
        }
        return;
    }

    // 未知异常：记日志，统一 500
    const e = err instanceof Error ? err : new Error(String(err));
    console.error(`[error] ${req.method} ${req.originalUrl}`, e);

    const body = 'Internal Server Error';
    if (isHtmxRequest(req) || prefersHtml(req)) {
        res.status(500).type('text').send(body);
    } else {
        res.status(500).json({ error: body });
    }
}

/** 是否htmx请求（带 hx-request 头） */
function isHtmxRequest(req: Request): boolean {
    return !!req.headers['hx-request'];
}

/** 客户端是否偏好 HTML（浏览器导航 / htmx 片段） */
function prefersHtml(req: Request): boolean {
    const accept = String(req.headers.accept ?? '');
    return accept.includes('text/html') || accept.includes('application/xhtml+xml');
}