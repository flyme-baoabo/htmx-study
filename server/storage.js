import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 数据文件放在项目根目录下的 data/todos.json
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'todos.json');

// 读取：如果文件不存在，返回默认初始数据
export function loadTodos() {
  if (!existsSync(DATA_FILE)) {
    return { todos: [
      { id: 1, text: '学习 htmx', done: true },
      { id: 2, text: '接入 Vite + Express', done: false },
    ], nextId: 3 };
  }
  try {
    const raw = readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('读取数据文件失败，使用空数据启动:', err);
    return { todos: [], nextId: 1 };
  }
}

// 写入：原子性 —— 先保证目录存在，再整体覆盖写入
export function saveTodos({ todos, nextId }) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify({ todos, nextId }, null, 2), 'utf-8');
}