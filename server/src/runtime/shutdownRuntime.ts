import { createGracefulShutdown, SHUTDOWN_SIGNALS } from '../utils/gracefulShutdown.js';
import type http from 'node:http';
import type { ViteDevServer } from 'vite';

type RegisterShutdownOptions = {
    server: http.Server;
    devViteServer?: ViteDevServer;
};

/**
 * 把退场逻辑注册到进程信号。
 *
 * 这里不负责重启新进程，只负责在收到(SHUTDOWN_SIGNALS) SIGTERM / SIGINT 时，
 * 调用 createGracefulShutdown 生成的关闭函数，让旧进程尽快释放
 * server 和开发环境下的 vite 资源。
 */
export function registerShutdown({ server, devViteServer }: RegisterShutdownOptions): void {
    const shutdown = createGracefulShutdown({
        server,
        closeApp: () => devViteServer?.close() ?? Promise.resolve(),
    });

    for (const signal of SHUTDOWN_SIGNALS) {
        process.once(signal, () => {
            void shutdown(signal);
        });
    }
}