import express from 'express';
import { list, create, toggle, remove } from '../list.js';

const router = express.Router();

// 待办数据路由，返回可被 htmx 替换的局部片段（partials/ 模板由 middleware 绕过 layout 渲染）。
// 页面路由（/、/list 整页渲染）在 routes/pages.js，清单数据（增删改）集中在本模块。

// 局部片段：供 htmx 刷新列表（hx-get /todos -> #todo-list）
router.get('/todos', (req, res) => {
    res.render('partials/list', { todos: list() });
});

// 添加待办：返回局部片段，htmx 用它替换 #todo-list
router.post('/todos', (req, res) => {
    const text = (req.body?.text ?? '').toString().trim();
    if (!text) return res.status(400).send('The to-do item cannot be empty!');

    const newItem = create(text);

    if (list().length === 1) {
        // 空→第一条：原来是空列表占位，必须整体替换才能去掉“暂无待办”
        res.setHeader('HX-Reswap', 'outerHTML'); // 覆盖 hx-swap="afterbegin"
        return res.render('partials/list', { todos: list() });
    }

    res.render('partials/item', newItem);
});

// 切换完成状态：返回局部片段
router.post('/todos/:id/toggle', (req, res) => {
    const item = toggle(Number(req.params.id));
    if (item) {
        res.render('partials/item', item);
    } else {
        res.status(404).send('Todo Not Found!'); // 找不到时显式兜底，避免挂起
    }
});

router.delete('/todos/:id', (req, res) => {
    remove(Number(req.params.id));

    if (list().length === 0) {
        // 删光最后一条：留 `#todo-list` 的空白占位回来
        res.set('HX-Retarget', '#todo-list'); // 覆盖 closest .todo-item
        res.setHeader('HX-Reswap', 'outerHTML'); // 覆盖 hx-swap="delete"
        return res.render('partials/list', { todos: list() });
    }
    res.status(200).end();
});

export { router as listRouter };