// 以过程和数据变换组织业务；金额统一为整数分。
export function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    fail('购物车必须包含1至50条商品记录');
  }
  const quantities = new Map();
  for (const item of items) {
    if (!item || typeof item.productId !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1) {
      fail('商品编号不能为空，数量必须为正整数');
    }
    const quantity = (quantities.get(item.productId) || 0) + item.quantity;
    if (quantity > 99) fail('同一商品购买数量不能超过99');
    quantities.set(item.productId, quantity);
  }
  return [...quantities].sort(([a], [b]) => a.localeCompare(b)).map(([productId, quantity]) => ({ productId, quantity }));
}

export function normalizeRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('请求必须是JSON对象');
  if (body.couponCode !== undefined && typeof body.couponCode !== 'string') fail('优惠券码必须是字符串');
  return { items: normalizeItems(body.items), couponCode: (body.couponCode || '').trim().toUpperCase() };
}

export function validateCoupon(coupon) {
  if (!coupon || typeof coupon !== 'object' || !/^[A-Z0-9_-]{3,20}$/.test(coupon.code || '')) fail('券码应为3至20位大写字母、数字、下划线或连字符');
  if (!['fixed', 'percent'].includes(coupon.type)) fail('优惠券类型必须为fixed或percent');
  if (!Number.isInteger(coupon.minimum) || coupon.minimum < 0 || coupon.minimum > 100000000) fail('使用门槛必须为0至100000000的整数分');
  if (!Number.isInteger(coupon.value) || coupon.value <= 0 || coupon.value > (coupon.type === 'percent' ? 10000 : 100000000)) fail('优惠值无效，比例折扣按万分比填写');
  if (!Number.isInteger(coupon.maxDiscount) || coupon.maxDiscount < 0 || coupon.maxDiscount > 100000000) fail('优惠上限必须为非负整数分');
  if (typeof coupon.expiresAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(coupon.expiresAt) || !Number.isFinite(Date.parse(coupon.expiresAt))) fail('到期时间必须是包含时区的ISO日期');
  if (typeof coupon.enabled !== 'boolean') fail('启用状态必须为布尔值');
  return { code: coupon.code, type: coupon.type, minimum: coupon.minimum, value: coupon.value, maxDiscount: coupon.maxDiscount, expiresAt: coupon.expiresAt, enabled: coupon.enabled };
}

export function quote(state, request, now = new Date()) {
  const normalized = normalizeRequest(request);
  const lines = normalized.items.map(({ productId, quantity }) => {
    const product = state.products.find(item => item.id === productId);
    if (!product) fail('商品不存在：' + productId, 404);
    if (product.stock < quantity) fail('库存不足：' + product.name, 409);
    return { productId, name: product.name, unitPrice: product.price, quantity, lineTotal: product.price * quantity };
  });
  const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
  let discount = 0;
  if (normalized.couponCode) {
    const coupon = state.coupons.find(item => item.code === normalized.couponCode);
    if (!coupon || !coupon.enabled) fail('优惠券不存在或已停用');
    if (Date.parse(coupon.expiresAt) <= now.getTime()) fail('优惠券已过期');
    if (subtotal < coupon.minimum) fail('订单金额未达到优惠券使用门槛');
    discount = coupon.type === 'fixed' ? coupon.value : Math.floor(subtotal * coupon.value / 10000);
    if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
    discount = Math.min(discount, subtotal);
  }
  return { lines, couponCode: normalized.couponCode, subtotal, discount, total: subtotal - discount };
}

export function createOrder(state, body, { now = new Date(), id } = {}) {
  const normalized = normalizeRequest(body);
  const key = body.idempotencyKey;
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(key)) fail('下单标识必须为8至80位字母、数字、下划线或连字符');
  const fingerprint = JSON.stringify(normalized);
  const previous = state.orders.find(order => order.idempotencyKey === key);
  if (previous) {
    if (previous.fingerprint !== fingerprint) fail('同一下单标识不能用于不同的订单内容', 409);
    return { order: previous, replayed: true };
  }
  const amount = quote(state, normalized, now);
  if (typeof id !== 'string' || !id) throw new Error('订单编号不能为空');
  const order = { id, createdAt: now.toISOString(), status: 'created', ...amount, idempotencyKey: key, fingerprint };
  // 校验全部成功后才更新库存，持久化由事务层完成。
  for (const line of amount.lines) state.products.find(product => product.id === line.productId).stock -= line.quantity;
  state.orders.push(order);
  return { order, replayed: false };
}

export function statistics(state) {
  return {
    orderCount: state.orders.length,
    grossAmount: state.orders.reduce((sum, item) => sum + item.subtotal, 0),
    discountAmount: state.orders.reduce((sum, item) => sum + item.discount, 0),
    payableAmount: state.orders.reduce((sum, item) => sum + item.total, 0),
    soldQuantity: state.orders.reduce((sum, item) => sum + item.lines.reduce((count, line) => count + line.quantity, 0), 0)
  };
}

export function initialState() {
  return {
    products: [
      { id: 'P1001', name: '机械键盘', price: 12900, stock: 20 },
      { id: 'P1002', name: '无线鼠标', price: 5900, stock: 50 },
      { id: 'P1003', name: 'USB扩展器', price: 2900, stock: 80 }
    ],
    coupons: [
      { code: 'SAVE20', type: 'fixed', minimum: 20000, value: 2000, maxDiscount: 0, enabled: true, expiresAt: '2099-12-31T15:59:59Z' },
      { code: 'OFF10', type: 'percent', minimum: 10000, value: 1000, maxDiscount: 3000, enabled: true, expiresAt: '2099-12-31T15:59:59Z' },
      { code: 'EXPIRED', type: 'fixed', minimum: 0, value: 1000, maxDiscount: 0, enabled: true, expiresAt: '2020-01-01T00:00:00Z' }
    ],
    orders: []
  };
}
