import type { Request, Response, NextFunction } from 'express';

// Express 5 类型已移除顶层 RenderOptions 导出（res.render 的 options 直接写为 object），
// 这里补一个本地类型别名，保证渲染传参可读且保持与内置签名兼容。
type RenderOptions = object;

// ------------------------------
// 模块扩展：给 Express req/res 补充类型
// ------------------------------
declare global {
  namespace Express {
    interface Request {
      /** 是否存在 hx‑request 请求头（原始header状态） */
      isHXRequest: boolean;
      /** 是否存在 hx‑history‑restore‑request 请求头（原始header状态） */
      isHistoryRestore: boolean;
      /** 衍生标记：有效的htmx片段请求，排除历史恢复回退场景 */
      isFragment: boolean;
    }

    interface Response {
      /**
       * 判断本次渲染是否应当输出片段（关闭layout）
       * @param viewName 待渲染模板名称
       */
      isFragmentRequest(viewName: string): boolean;
    }
  }
}

/**
 * 获取htmx两个核心请求标记
 * 分别独立判断：优先读取req已挂载属性；不存在则解析http header兜底
 */
function getHtmxRequestFlags(req: Request): {
  isHXRequest: boolean;
  isHistoryRestore: boolean;
} {
  let isHXRequest: boolean;
  if (req.isHXRequest !== undefined) {
    isHXRequest = req.isHXRequest;
  } else {
    isHXRequest = !!req.headers['hx-request'];
  }

  let isHistoryRestore: boolean;
  if (req.isHistoryRestore !== undefined) {
    isHistoryRestore = req.isHistoryRestore;
  } else {
    isHistoryRestore = !!req.headers['hx-history-restore-request'];
  }

  return {
    isHXRequest,
    isHistoryRestore,
  };
}

/**
 * 计算是否需要片段渲染
 * 业务规则：
 * 1. 如果是history‑restore回退，直接返回false，强制完整页面
 * 2. htmx请求 或者 模板以partials/开头 → true，输出片段
 */
function calcIsFragmentRequest(req: Request, viewName: string): boolean {
  const { isHXRequest, isHistoryRestore } = getHtmxRequestFlags(req);

  if (isHistoryRestore) {
    return false;
  }

  const isPartialView = viewName.startsWith('partials/');
  return isHXRequest || isPartialView;
}

/**
 * 标准中间件：请求入口，解析headers挂载到req，并在res挂载工具方法
 * app.use(injectFragmentFlagMiddleware)
 */
export function injectFragmentFlagMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { isHXRequest, isHistoryRestore } = getHtmxRequestFlags(req);

  req.isHXRequest = isHXRequest;
  req.isHistoryRestore = isHistoryRestore;
  req.isFragment = req.isHXRequest && !req.isHistoryRestore;

  // 闭包捕获当前req，挂载到res
  res.isFragmentRequest = (viewName: string): boolean => {
    return calcIsFragmentRequest(req, viewName);
  };

  next();
}

/**
 * 标准中间件：重写 res.render，自动注入 layout:false
 * app.use(fragmentRenderMiddleware)
 */
export function fragmentRenderMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const originalRender = res.render;

  res.render = function (
    this: Response,
    view: string,
    options?: RenderOptions | Record<string, unknown> | ((err: Error | null, html: string) => void),
    callback?: (err: Error | null, html: string) => void
  ): Response {
    let locals: RenderOptions | Record<string, unknown> | undefined;
    let cb: ((err: Error | null, html: string) => void) | undefined;

    // 处理express render多态参数
    if (typeof options === 'function') {
      cb = options;
      locals = undefined;
    } else {
      locals = options;
      cb = callback;
    }

    const needFragment = this.isFragmentRequest(view);
    const finalLocals = locals ?? {};

    // 用户没有手动设置layout时，自动关闭layout
    if (needFragment && finalLocals.layout === undefined) {
      Object.assign(finalLocals, { layout: false });
    }

    return originalRender.call(this, view, finalLocals, cb);
  };

  next();
}

/**
 * 保护partials路由中间件：禁止浏览器直接访问partial片段接口
 * app.use('/partials/*', protectPartialsRoute)
 */
export function protectPartialsRoute(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.isHXRequest) {
    res.status(403).send('Partial endpoint only allow htmx request');
    return;
  }
  next();
}

// import express from 'express';
// import {
//   injectFragmentFlagMiddleware,
//   fragmentRenderMiddleware,
//   protectPartialsRoute
// } from './fragment-middleware';

// const app = express();

// // ⚠️顺序不能乱：先注入标记，再重写render
// app.use(injectFragmentFlagMiddleware);
// app.use(fragmentRenderMiddleware);
// app.use('/partials/*', protectPartialsRoute);

// // 控制器示例
// app.get('/demo', (req, res) => {
//   // 请求层面原始标记
//   console.log('isHXRequest', req.isHXRequest);
//   console.log('isHistoryRestore', req.isHistoryRestore);
//   console.log('isFragment', req.isFragment);

//   // 预判本次render是否输出片段
//   const willFragment = res.isFragmentRequest('partials/card');
//   console.log('willFragment', willFragment);

//   res.render('partials/card');
// });

// app.listen(3000);