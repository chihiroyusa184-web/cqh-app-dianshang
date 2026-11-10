import { createApp } from '../server.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';

const folder = await mkdtemp(join(tmpdir(), 'mall-system-demo-'));
const app = await createApp({ dataFile: join(folder, 'store.json'), managerKey: randomBytes(24).toString('hex') });
app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
const base = 'http://127.0.0.1:' + app.server.address().port;
async function api(path, body, admin = false) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (admin) headers.Authorization = 'Bearer ' + app.managerKey;
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, result: await response.json() };
}
try {
  const body = { items: [{ productId: 'P1001', quantity: 2 }], couponCode: 'SAVE20', idempotencyKey: 'demo-order-001' };
  const result = {
    scenario: '两件机械键盘 合计258元 使用SAVE20 应付238元',
    productsBefore: await api('/api/products'),
    quote: await api('/api/quote', body),
    order: await api('/api/orders', body),
    retry: await api('/api/orders', body),
    invalidCoupon: await api('/api/quote', { ...body, couponCode: 'EXPIRED' }),
    statistics: await api('/api/admin/stats', undefined, true),
    productsAfter: await api('/api/products')
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await new Promise(resolve => app.server.close(resolve));
  await rm(folder, { recursive: true, force: true });
}
