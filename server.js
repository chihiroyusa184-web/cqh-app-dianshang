import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { openStore } from './src/store.js';
import { createOrder, fail, quote, statistics, validateCoupon } from './src/domain.js';

const root = dirname(fileURLToPath(import.meta.url));
function send(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}
async function readJson(request) {
  if (!(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) fail('请求内容类型应为application/json', 415);
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32768) fail('请求体不能超过32KB', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('JSON格式错误'); }
}
function checkManager(request, managerKey) {
  const actual = Buffer.from(request.headers.authorization || '');
  const expected = Buffer.from('Bearer ' + managerKey);
  if (!managerKey || actual.length !== expected.length || !timingSafeEqual(actual, expected)) fail('管理令牌无效', 401);
}
function publicOrder(order) {
  const { idempotencyKey, fingerprint, ...result } = order;
  return result;
}

export async function createApp({ dataFile = join(root, 'data', 'store.json'), managerKey = randomBytes(24).toString('hex') } = {}) {
  const store = await openStore(dataFile);
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const path = url.pathname;
      if (request.method === 'GET' && path === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
        response.end(await readFile(join(root, 'public', 'index.html')));
      } else if (request.method === 'GET' && path === '/api/products') {
        const keyword = (url.searchParams.get('keyword') || '').trim().toLowerCase();
        const products = store.snapshot().products.filter(product => product.name.toLowerCase().includes(keyword));
        send(response, 200, products);
      } else if (request.method === 'GET' && path === '/api/coupons') {
        send(response, 200, store.snapshot().coupons.filter(item => item.enabled && Date.parse(item.expiresAt) > Date.now()));
      } else if (request.method === 'POST' && path === '/api/quote') {
        send(response, 200, quote(store.snapshot(), await readJson(request)));
      } else if (request.method === 'POST' && path === '/api/orders') {
        const body = await readJson(request);
        const result = await store.transact(state => createOrder(state, body, { id: 'ORD-' + randomUUID() }));
        send(response, result.replayed ? 200 : 201, { order: publicOrder(result.order), replayed: result.replayed });
      } else if (path.startsWith('/api/admin/')) {
        checkManager(request, managerKey);
        if (request.method === 'GET' && path === '/api/admin/orders') {
          send(response, 200, store.snapshot().orders.map(publicOrder));
        } else if (request.method === 'GET' && path === '/api/admin/stats') {
          send(response, 200, statistics(store.snapshot()));
        } else if (request.method === 'GET' && path === '/api/admin/coupons') {
          send(response, 200, store.snapshot().coupons);
        } else if (request.method === 'POST' && path === '/api/admin/coupons') {
          const coupon = validateCoupon(await readJson(request));
          await store.transact(state => {
            const index = state.coupons.findIndex(item => item.code === coupon.code);
            if (index < 0) state.coupons.push(coupon); else state.coupons[index] = coupon;
          });
          send(response, 200, coupon);
        } else fail('接口不存在', 404);
      } else fail('接口不存在', 404);
    } catch (error) {
      if (!response.headersSent) send(response, error.status || 500, { error: error.status ? error.message : '服务器处理失败' });
      else response.end();
    }
  });
  return { server, store, managerKey };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const app = await createApp({ dataFile: process.env.DATA_FILE || undefined, managerKey: process.env.MANAGER_KEY || undefined });
  app.server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  app.server.listen(port, '127.0.0.1', () => {
    console.log('电商促销系统：http://127.0.0.1:' + app.server.address().port);
    console.log('本次本地演示的管理令牌：' + app.managerKey);
    console.log('金额统一以分保存；当前订单状态为已创建，不代表已支付。');
  });
}
