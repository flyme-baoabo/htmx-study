import express from 'express';
import { loadTodos, saveTodos } from '../storage.js';

const router = express.Router();

// 启动时从 data/todos.json 读取（服务重启不丢失）
const loaded = loadTodos();
const todos = loaded.todos;
let nextId = loaded.nextId;

// 每次增删改后，把最新内存状态写回磁盘
function persist() {
  saveTodos({ todos, nextId });
}

// 完整页面
router.get('/', (req, res) => {
  res.render('index', { title: 'htmx Study', todos });
});

// 局部片段：供 htmx 刷新列表（hx-get /todos -> #todo-list）
// layout: false —— 明确不套用 layout.ejs，只返回可被 htmx 替换的纯片段
router.get('/todos', (req, res) => {
  res.render('partials/list', { todos });
});

// 添加待办：返回局部片段，htmx 用它替换 #todo-list
router.post('/todos', (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).send('The to-do item cannot be empty!');
  const newItem = { id: nextId++, text, done: false }
  todos.unshift({ id: nextId++, text, done: false });
  persist();
  
  if (todos.length === 1) {
    // 空→第一条：原来是空列表占位，必须整体替换才能去掉“暂无待办”
    res.setHeader('HX-Reswap', 'outerHTML'); // 覆盖 hx-swap="afterbegin"
    return res.render('partials/list', { todos });
  }

  res.render('partials/item', todos[0]);
});

// 切换完成状态：返回局部片段
router.post('/todos/:id/toggle', (req, res) => {
  const id = Number(req.params.id);
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    todo.done = !todo.done;
    persist();
    res.render('partials/item', todo);
  } else {
    res.status(404).send('Todo Not Found!'); // 找不到时显式兜底，避免挂起
  }
});

router.delete('/todos/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = todos.findIndex((t) => t.id === id);
  if (index !== -1) {
    todos.splice(index, 1); // 原地删除
    persist();
  }
  
  if (todos.length === 0) {
    // 删光最后一条：留 `#todo-list` 的空白占位回来
    res.set('HX-Retarget', '#todo-list'); // 覆盖 closest .todo-item
    res.setHeader('HX-Reswap', 'outerHTML'); // 覆盖 hx-swap="delete">
    return res.render('partials/list', { todos });
  }
  res.sendStatus(200);
})

export { router as homeRouter };