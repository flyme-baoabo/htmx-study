import type http from 'node:http';
import type net from 'node:net';

export const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'] as const;

export type ShutdownSignal = (typeof SHUTDOWN_SIGNALS)[number];

type GracefulShutdownOptions = {
    server: http.Server;
    closeApp?: () => Promise<void>;
    forceExitAfterMs?: number;
};

/**
 * 退场阶段：为 http.Server 创建可重入的优雅关闭函数。
 *
 * 这段逻辑只负责“旧进程怎么尽快退出”，不负责重启新进程。
 * 在 watch 重启或用户 Ctrl+C 时，旧进程收到 SIGTERM / SIGINT 后：
 * 1. 停止接受新连接
 * 2. 主动结束已有 socket
 * 3. 并行关闭外部资源（如开发环境下的 Vite HMR / watcher）
 * 4. 在超时后强制 destroy 剩余连接，避免旧进程长期占住端口
 *
 * 它的目标是让 server 和开发环境下的 Vite 相关资源尽快释放，
 * 以便后续由 node --watch 拉起的新进程更快重新监听端口。
 */
export function createGracefulShutdown({
    server,
    closeApp,
    forceExitAfterMs = 1500,
}: GracefulShutdownOptions): (signal: ShutdownSignal) => Promise<void> {
    const sockets = new Set<net.Socket>();
    let isShuttingDown = false;

    server.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });

    return async (signal: ShutdownSignal): Promise<void> => {
        if (isShuttingDown) return;
        isShuttingDown = true;

        // 兜底：如果优雅关闭卡住，强制销毁连接并退出，避免 watch 新进程长期撞上旧端口。
        const forceExitTimer = setTimeout(() => {
            for (const socket of sockets) socket.destroy();
            process.exit(1);
        }, forceExitAfterMs);
        forceExitTimer.unref();

        try {
            const closeServerPromise = new Promise<void>((resolve, reject) => {
                server.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });

                // 先停止监听，再尽快收掉 idle / active 连接，缩短端口释放窗口。
                server.closeIdleConnections?.();
                server.closeAllConnections?.();
                for (const socket of sockets) socket.end();
            });

            await Promise.all([closeServerPromise, closeApp?.()]);

            clearTimeout(forceExitTimer);
            process.exit(0);
        } catch (err) {
            clearTimeout(forceExitTimer);
            console.error(`graceful shutdown failed on ${signal}`, err);
            for (const socket of sockets) socket.destroy();
            process.exit(1);
        }
    };
}