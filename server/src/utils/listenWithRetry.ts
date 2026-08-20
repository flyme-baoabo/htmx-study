import type http from 'node:http';

/**
 * 入场阶段：为新进程执行带重试的 listen。
 *
 * 这段逻辑只负责“新进程启动时端口还没完全释放怎么办”。
 * 若旧进程刚收到 SIGTERM、仍在退场，新的 server.listen(port) 可能先遇到 EADDRINUSE。
 * 此时稍等再试，让新进程不要因为旧进程晚几百毫秒释放端口而直接崩掉。
 *
 * 注意：这里重试的是当前进程里的 server.listen(port)，不是重启进程本身。
 * 真正结束旧进程并拉起新进程的是 node --watch-path=server ... 这条启动链路。
 *
 * 注意：SIGINT 是用户手动结束当前进程，只走退场，不会自动拉起新进程，
 * 所以通常不会进入这里的重试分支。
 *
 * @param server 已创建的 http.Server
 * @param port 要监听的端口
 * @param onListening 成功监听后的回调
 */
export function listenWithRetry(
    server: http.Server,
    port: number,
    onListening?: () => void
): void {
    const retry = (): void => {
        const handleListening = (): void => {
            server.off('error', handleError);
            console.log(`htmx-study → http://localhost:${port}`);
            onListening?.();
        };

        const handleError = (err: NodeJS.ErrnoException): void => {
            server.off('listening', handleListening);
            if (err?.code === 'EADDRINUSE') {
                // 旧进程还没完全退场：等端口释放后再重试本次 server.listen。
                console.warn(`端口 ${port} 仍被占用，500ms 后自动重试…`);
                setTimeout(retry, 500);
            } else {
                console.error(err);
                process.exit(1);
            }
        };

        server.once('listening', handleListening);
        server.once('error', handleError);
        server.listen(port);
    };
    retry();
}