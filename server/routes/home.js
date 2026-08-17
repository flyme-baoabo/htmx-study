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
  if (text) {
    todos.unshift({ id: nextId++, text, done: false });
    persist();
  }
  res.render('partials/list', { todos });
});

// 切换完成状态：返回局部片段
router.post('/todos/:id/toggle', (req, res) => {
  const id = Number(req.params.id);
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    todo.done = !todo.done;
    persist();
  }
  res.render('partials/list', { todos });
});

router.delete('/todos/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = todos.findIndex((t) => t.id === id);
  if (index !== -1) {
    todos.splice(index, 1); // 原地删除
    persist();
  }
  res.render('partials/list', { todos });
})

export { router as homeRouter };