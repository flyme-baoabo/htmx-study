import express from 'express';

const router = express.Router();

// 简单的内存数据存储（demo 用，重启即重置）
const todos = [
  { id: 1, text: '学习 htmx', done: true },
  { id: 2, text: '接入 Vite + Express', done: false },
];
let nextId = 3;

// 完整页面
router.get('/', (req, res) => {
  res.render('index', { title: 'htmx Study', todos });
});

// 局部片段：供 htmx 刷新列表（hx-get /todos -> #todo-list）
// layout: false —— 明确不套用 layout.ejs，只返回可被 htmx 替换的纯片段
router.get('/todos', (req, res) => {
  res.render('partials/list', { todos, layout: false });
});

// 添加待办：返回局部片段，htmx 用它替换 #todo-list
router.post('/todos', (req, res) => {
  const text = (req.body?.text || '').trim();
  if (text) {
    todos.unshift({ id: nextId++, text, done: false });
  }
  res.render('partials/list', { todos, layout: false });
});

// 切换完成状态：返回局部片段
router.post('/todos/:id/toggle', (req, res) => {
  const id = Number(req.params.id);
  const todo = todos.find((t) => t.id === id);
  if (todo) todo.done = !todo.done;
  res.render('partials/list', { todos, layout: false });
});

router.delete('/todos/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = todos.findIndex((t) => t.id === id);
  if (index !== -1) todos.splice(index, 1);   // 原地删除，别重新声明
  res.render('partials/list', { todos, layout: false });
})

export { router as homeRouter };