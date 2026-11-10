import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { createOrder, initialState, normalizeItems, quote, statistics, validateCoupon } from '../src/domain.js';
import { openStore } from '../src/store.js';
import { createApp } from '../server.js';

const now = new Date('2026-11-10T04:00:00Z');
const request = (quantity = 2, couponCode = 'SAVE20') => ({ items: [{ productId: 'P1001', quantity }], couponCode });

test('满减计算 258元减20元 得238元', () => {
  const result = quote(initialState(), request(), now);
  assert.equal(result.subtotal, 25800); assert.equal(result.discount, 2000); assert.equal(result.total, 23800);
});
test('满减门槛 下界19999失败 20000成功', () => {
  const state = initialState(); state.products[0].price = 19999;
  assert.throws(() => quote(state, request(1), now), /未达到/);
  state.products[0].price = 20000; assert.equal(quote(state, request(1), now).total, 18000);
});
test('九折计算使用整数分 向下取整优惠', () => {
  const state = initialState(); state.products[0].price = 12901;
  const result = quote(state, request(1, 'OFF10'), now);
  assert.equal(result.discount, 1290); assert.equal(result.total, 11611);
});
test('比例优惠受3000分上限约束', () => assert.equal(quote(initialState(), request(5, 'OFF10'), now).discount, 3000));
test('无券订单保持原价', () => assert.equal(quote(initialState(), request(1, ''), now).total, 12900));
test('优惠额不会超过订单原价', () => {
  const state = initialState(); state.coupons[0].minimum = 0; state.coupons[0].value = 999999;
  assert.equal(quote(state, request(1), now).total, 0);
});
test('券码忽略首尾空格并规范为大写', () => assert.equal(quote(initialState(), request(2, ' save20 '), now).discount, 2000));
test('不存在 已停用 已过期的券均拒绝', () => {
  const state = initialState();
  assert.throws(() => quote(state, request(2, 'UNKNOWN'), now), /不存在/);
  assert.throws(() => quote(state, request(2, 'EXPIRED'), now), /过期/);
  state.coupons[0].enabled = false; assert.throws(() => quote(state, request(), now), /停用/);
});
test('到期时刻等于当前时刻即失效', () => {
  const state = initialState(); state.coupons[0].expiresAt = now.toISOString();
  assert.throws(() => quote(state, request(), now), /过期/);
});
test('数量0 负数 小数 字符串以及空购物车均拒绝', () => {
  for (const quantity of [0, -1, 1.5, '2', 100]) assert.throws(() => normalizeItems([{ productId: 'P1001', quantity }]));
  assert.throws(() => normalizeItems([])); assert.throws(() => normalizeItems(null));
});
test('重复商品合并数量 防止绕过库存校验和99上限', () => {
  const items = [{ productId: 'P1001', quantity: 11 }, { productId: 'P1001', quantity: 10 }];
  assert.equal(normalizeItems(items)[0].quantity, 21);
  assert.throws(() => quote(initialState(), { items }, now), /库存不足/);
  assert.throws(() => normalizeItems([{ productId: 'P1001', quantity: 60 }, { productId: 'P1001', quantity: 40 }]), /99/);
});
test('不存在的商品及库存不足均拒绝', () => {
  assert.throws(() => quote(initialState(), { items: [{ productId: 'BAD', quantity: 1 }] }, now), /不存在/);
  assert.throws(() => quote(initialState(), request(21, ''), now), /库存不足/);
});
test('订单保存金额快照 并扣减库存', () => {
  const state = initialState(); const result = createOrder(state, { ...request(), idempotencyKey: 'order-key-01' }, { now, id: 'ORD-1' });
  assert.equal(result.order.total, 23800); assert.equal(state.products[0].stock, 18); assert.equal(state.orders.length, 1);
  assert.deepEqual(statistics(state), { orderCount: 1, grossAmount: 25800, discountAmount: 2000, payableAmount: 23800, soldQuantity: 2 });
});
test('相同下单标识重试不重复扣库存 内容改变返回冲突', () => {
  const state = initialState(), body = { ...request(), idempotencyKey: 'order-key-02' };
  createOrder(state, body, { now, id: 'ORD-2' });
  assert.equal(createOrder(state, body, { now, id: 'ORD-3' }).replayed, true);
  assert.equal(state.products[0].stock, 18); assert.equal(state.orders.length, 1);
  assert.throws(() => createOrder(state, { ...body, couponCode: '' }, { now, id: 'ORD-4' }), /不同的订单/);
});
test('非法订单失败后不改变内存库存和订单', () => {
  const state = initialState(), before = structuredClone(state);
  assert.throws(() => createOrder(state, { ...request(99), idempotencyKey: 'order-key-03' }, { now, id: 'ORD-5' }));
  assert.deepEqual(state, before);
});
test('优惠券管理校验类型 范围以及时区', () => {
  const coupon = initialState().coupons[1]; assert.deepEqual(validateCoupon(coupon), coupon);
  assert.throws(() => validateCoupon({ ...coupon, value: 10001 }));
  assert.throws(() => validateCoupon({ ...coupon, minimum: -1 }));
  assert.throws(() => validateCoupon({ ...coupon, expiresAt: '2099-12-31T23:59:59' }));
});

async function fixture(t) {
  const folder = await mkdtemp(join(tmpdir(), 'mall-system-test-'));
  const dataFile = join(folder, 'store.json');
  const managerKey = randomBytes(24).toString('hex');
  const app = await createApp({ dataFile, managerKey });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(async () => { await new Promise(resolve => app.server.close(resolve)); await rm(folder, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + app.server.address().port;
  async function api(path, body, admin = false) {
    const headers = body === undefined ? {} : { 'Content-Type': 'application/json' };
    if (admin) headers.Authorization = 'Bearer ' + managerKey;
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  return { ...app, api, base, dataFile };
}

test('HTTP创建订单 重试 管理统计以及持久化重开', async t => {
  const { api, dataFile } = await fixture(t);
  const body = { ...request(), idempotencyKey: 'http-order-01' };
  const first = await api('/api/orders', body); assert.equal(first.status, 201); assert.equal(first.body.order.total, 23800);
  const replay = await api('/api/orders', body); assert.equal(replay.status, 200); assert.equal(replay.body.replayed, true);
  assert.equal((await api('/api/admin/stats', undefined, true)).body.orderCount, 1);
  const reopened = await openStore(dataFile); assert.equal(reopened.snapshot().products[0].stock, 18);
  const retry = await reopened.transact(state => createOrder(state, body, { now, id: 'ORD-NEW' })); assert.equal(retry.replayed, true);
});
test('并发争抢最后一件库存 只允许一个订单成功', async t => {
  const { api, store } = await fixture(t);
  await store.transact(state => { state.products[0].stock = 1; });
  const results = await Promise.all(['concurrent-01', 'concurrent-02'].map(idempotencyKey => api('/api/orders', { ...request(1, ''), idempotencyKey })));
  assert.deepEqual(results.map(item => item.status).sort(), [201, 409]);
  assert.equal(store.snapshot().products[0].stock, 0); assert.equal(store.snapshot().orders.length, 1);
});
test('事务抛错不会写入磁盘 后续合法请求仍可提交', async t => {
  const { store, dataFile } = await fixture(t), before = await readFile(dataFile, 'utf8');
  await assert.rejects(store.transact(state => { state.products[0].stock = -100; throw new Error('rollback'); }), /rollback/);
  assert.equal(await readFile(dataFile, 'utf8'), before);
  await store.transact(state => { state.products[0].stock = 19; }); assert.equal(store.snapshot().products[0].stock, 19);
});
test('管理接口拒绝未授权请求 允许保存停用优惠券', async t => {
  const { api } = await fixture(t);
  assert.equal((await api('/api/admin/orders')).status, 401);
  assert.equal((await api('/api/admin/stats')).status, 401);
  const coupon = { ...initialState().coupons[0], code: 'NEW20', enabled: false };
  assert.equal((await api('/api/admin/coupons', coupon, true)).status, 200);
  const coupons = await api('/api/coupons'); assert.equal(coupons.body.some(item => item.code === 'NEW20'), false);
  assert.equal((await api('/api/admin/coupons', undefined, true)).body.some(item => item.code === 'NEW20'), true);
});
test('HTTP拒绝畸形JSON及错误内容类型 不暴露内部错误', async t => {
  const { base, api } = await fixture(t);
  const response = await fetch(base + '/api/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(response.status, 400);
  assert.equal((await fetch(base + '/api/quote', { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await api('/api/unknown')).status, 404);
});
