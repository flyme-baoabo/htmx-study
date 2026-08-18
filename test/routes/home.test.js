import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../server/app.js';
import { mountRoutes } from '../../server/routes.js';

// 组装一个不含前端中间件的 app 供 supertest 驱动
const buildApp = async () => {
  const app = await createApp();
  mountRoutes(app);
  return app;
};

describe('GET /', () => {
  it('返回 200 且渲染页面', async () => {
    const res = await request(await buildApp()).get('/');
    assert.equal(res.status, 200);
    assert.match(res.text, /待办清单/);
  });
});

describe('GET /todos', () => {
  it('返回待办列表局部片段', async () => {
    const res = await request(await buildApp()).get('/todos');
    assert.equal(res.status, 200);
    assert.match(res.text, /todo-list/);
  });
});

describe('POST /todos', () => {
  it('新增待办并返回局部片段', async () => {
    const res = await request(await buildApp())
      .post('/todos')
      .type('form')
      .send({ text: '写一轮测试' });
    assert.equal(res.status, 200);
    assert.match(res.text, /写一轮测试/);
  });
});

describe('POST /todos/:id/toggle', () => {
  it('切换完成状态', async () => {
    const res = await request(await buildApp()).post('/todos/1/toggle');
    assert.equal(res.status, 200);
    assert.match(res.text, /学习 htmx/);
  });
});