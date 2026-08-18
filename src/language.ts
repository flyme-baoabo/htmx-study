import htmx from 'htmx.org';

/**
 * 自定义语言切换下拉菜单。
 * 依赖 + 交互：
 *  - 点击 .lang-trigger 展开/收起 .lang-menu
 *  - 点击菜单项（<a href>）跳转；跳转期间面板不刷屏
 *  - 点击外部 / Esc 关闭面板
 *  - 键盘方向键可切换高亮项（可选增强）
 */
const CONTAINER_SELECTOR = '.change-language';

function initLanguageSwitcher(): void {
    document.querySelectorAll<HTMLElement>(CONTAINER_SELECTOR).forEach((container) => {
        const trigger = container.querySelector<HTMLButtonElement>('.lang-trigger')!;
        const menu = container.querySelector<HTMLUListElement>('.lang-menu')!;
        const arrow = container.querySelector<SVGSVGElement>('.lang-arrow')!;

        // 元素缺失说明模板结构不完整，直接跳过（对当前容器不做任何绑定）。
        if (!trigger || !menu) return;

        // 让菜单宽度与触发器一致：直接读取触发器的渲染宽度再赋给第一个菜单。
        // 用匹配的 offsetWidth 更可靠，因为按钮有 padding/inner 结构，仅 ui 类 w-32 会漂移。
        menu.style.width = `${trigger.offsetWidth}px`;

        const items = Array.from(menu.querySelectorAll<HTMLAnchorElement>('[data-lang]'));

        function setOpen(open: boolean): void {
            menu.hidden = !open;                                      // hidden = true → 面板收起
            trigger.setAttribute('aria-expanded', String(open));            // 无障碍：同步展开状态
            arrow.classList.toggle('rotate-180', open);              // 箭头随展开状态旋转
        }

        // 点击某个菜单项：收起面板，并交给 switchLanguage 做无感语言切换（细节见其实现）。

        const handleItemClick = async (e: MouseEvent): Promise<void> => {
            e.preventDefault();         // ① 拦掉 <a> 默认整页跳转
            const lang = (e.currentTarget as HTMLAnchorElement).dataset.lang; // ② 取本次点的语言
            if (!lang) return;
            setOpen(false);             // ③ 先收起（和 switchLanguage 顺序无关，可先close再await）
            await switchLanguage(lang); // ④ 无感刷新
        };


        // 点击触发按钮：stopPropagation 防止事件冒泡到 document 而被“外部点击”分支立即关闭。
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            setOpen(Boolean(menu.hidden)); // 当前是收起→展开，展开→收起
        });

        items.forEach((item) => item.addEventListener('click', handleItemClick));

        // 点击面板或按钮以外的任意位置 → 收起。利用 document 冒泡捕获“外部点击”。
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target as Node)) setOpen(false);
        });

        // 面板内按 Esc → 收起，并把焦点还给触发按钮（键盘可用性）。
        menu.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                setOpen(false);
                trigger.focus();
            }
        });

        // 展开状态下，↑ / ↓ 在菜单项间循环移动焦点（无障碍方向键导航）。
        trigger.addEventListener('keydown', (e) => {
            if (menu.hidden || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
            e.preventDefault();
            if (!items.length) return;

            const current = menu.querySelector<HTMLAnchorElement>('a:focus'); // 当前聚焦项
            const idx = current ? items.indexOf(current) : -1;                  // -1 表示尚无聚焦项
            const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
            items[next].focus(); // 取模实现首尾循环
        });
    });
}


async function switchLanguage(lang: string): Promise<void> {
    // 1. POST 只设 cookie（不 swap，返回什么都不处理）
    try {
        const changeRes = await htmx.ajax('post', '/change-language', { values: { lang }, swap: 'none' });
        console.log('切换语言成功', changeRes);
    } catch (e) {
        console.error('切换语言失败', e);
        return;               // 不继续 GET，避免 旧语言误换
    }

    // 2. GET 拿新语言的纯片段，整块换进 #root
    // await htmx.ajax() 表示「该请求的 DOM swap 已完成」，所以紧跟着的 DOM 操作 / 重绑都可靠；本方案无需额外监听 afterSwap。

    const getBodyRes = await htmx.ajax('get', '/body', {
        target: '#root',
        swap: 'innerHTML', // 整个 #root 替换
    });
    console.log('获取新语言片段成功', getBodyRes);


    // 3. 同步 <html lang>（第 2 步 swap 已完成，现在写 DOM 正确）
    document.documentElement.lang = lang;

    // 4. #root 已换新 DOM，重新绑定语言菜单
    initLanguageSwitcher();
}

initLanguageSwitcher();