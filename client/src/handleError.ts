/**
 * 全局 htmx 请求错误处理。
 *
 * 背景：htmx 对 4xx/5xx 响应默认不执行 swap（内容不会进 hx-target），
 * 只触发 htmx:responseError / htmx:sendError。服务端 errorHandler 返回的
 * 纯文本片断（res.status(err.status).type('text').send(body)）从而游离在页面上。
 *
 * 这里统一接管：在 beforeSwap 阶段把 4xx/5xx 也放行（shouldSwap = true），
 * htmx 就会像处理 2xx 一样把响应体按 hx-swap 插进 hx-target。
 * 这样服务端无需改动，错误信息即可就地替换目标内容。
 */
export function handleError(): void {
    document.body.addEventListener('htmx:beforeSwap', (event: Event) => {
        const detail = (event as CustomEvent).detail as {
            xhr: XMLHttpRequest;
            shouldSwap: boolean;
            isError: boolean;
        };
        // 4xx/5xx：让错误响应体也能按 hx-swap 进目标，避免「错误悬空」
        if (detail.xhr.status >= 400) {
            detail.shouldSwap = true;
        }
    });

    // 网络级 / 无响应体错误：退化为控制台提示
    document.body.addEventListener('htmx:responseError', (event: Event) => {
        const detail = (event as CustomEvent).detail as { xhr: XMLHttpRequest };
        console.error(`[htmx] ${detail.xhr.status} ${detail.xhr.responseText}`, detail.xhr);
    });

    // 网络级失败：连响应都没收到（断网/超时/被拦截），xhr 无有效状态与响应体，
    // 拿不到服务端错误文本，只能记日志兜底——无法也不参与 swap。
    document.body.addEventListener('htmx:sendError', (event: Event) => {
        const detail = (event as CustomEvent).detail as { xhr: XMLHttpRequest };
        console.error(`[htmx] send failed`, detail.xhr);
    });
}