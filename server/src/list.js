import { loadTodos, saveTodos } from './storage.js';

// 待办数据仓库（模块级单例）：
// 启动时只 load 一次，内存中的 todos / nextId 是全应用共享的同一份引用，
// 供页面渲染（pages / session 重绘）与数据路由（todos CRUD）共同读写。
const loaded = loadTodos();
const todos = loaded.todos;
let nextId = loaded.nextId;

// 每次增删改后，把最新内存状态写回磁盘
function persist() {
    saveTodos({ todos, nextId });
}

/** 列表（外部只读引用） */
export function list() {
    return todos;
}

/** 新增：返回新条目 */
export function create(text) {
    const item = { id: nextId++, text, done: false };
    todos.unshift(item);
    persist();
    return item;
}

/** 切换完成状态：返回该条目（找不到返回 undefined） */
export function toggle(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return undefined;
    todo.done = !todo.done;
    persist();
    return todo;
}

/** 删除：返回是否删到了（找不到 false） */
export function remove(id) {
    const index = todos.findIndex((t) => t.id === id);
    if (index === -1) return false;
    todos.splice(index, 1);
    persist();
    return true;
}