/**
 * 零依赖结构化日志。
 *
 * 为什么不用第三方库（pino / winston）：
 *  - 本项目是研究/演示性质，日志量级很小，内置 console + JSON 序列化已足够。
 *  - 结构化体现在「每行是一个 JSON 对象」，便于 grep 单个 requestId / 字段定位问题。
 *  - 若要升级（文件、轮转、按级别过滤），再低成本替换成本文件即可，不影响调用方。
 */

type LogMeta = Record<string, unknown>;

function write(level: string, method: string, msg: string, meta: LogMeta = {}): void {
    const line = JSON.stringify({
        ts: new Date().toISOString(),
        level,
        msg,
        ...meta,
    });
    if (method === 'error' || method === 'warn') {
        console[method](line);
    } else {
        console.log(line);
    }
}

export const logger = {
    info: (msg: string, meta: LogMeta = {}): void => write('info', 'log', msg, meta),
    warn: (msg: string, meta: LogMeta = {}): void => write('warn', 'warn', msg, meta),
    error: (msg: string, meta: LogMeta = {}): void => write('error', 'error', msg, meta),
};