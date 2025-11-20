import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import mysql from 'mysql2/promise';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 3004;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005';
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:3002';
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpw',
  database: process.env.DB_DATABASE || 'order_db',
  waitForConnections: true,
  connectionLimit: 10,
});

// Wait for database to be ready
async function waitForDatabase(maxRetries = 30, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
      console.log('Database connection established');
      return true;
    } catch (err) {
      console.log(`Waiting for database... attempt ${i + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Could not connect to database after maximum retries');
}

// Ensure new schema pieces exist even on old DBs
async function ensureSchema() {
  const conn = await pool.getConnection();
  try {
    async function ensureColumn(table, column, ddl) {
      const [[row]] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      if (!row || row.cnt === 0) {
        await conn.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
      }
    }

    await ensureColumn('orders', 'shipping_name', 'shipping_name VARCHAR(255)');
    await ensureColumn('orders', 'shipping_phone', 'shipping_phone VARCHAR(50)');
    await ensureColumn('orders', 'shipping_address', 'shipping_address VARCHAR(512)');
    await ensureColumn('orders', 'shipping_city', 'shipping_city VARCHAR(100)');
    await ensureColumn('orders', 'shipping_district', 'shipping_district VARCHAR(100)');
    await ensureColumn('orders', 'shipping_ward', 'shipping_ward VARCHAR(100)');
    await ensureColumn('orders', 'billing_name', 'billing_name VARCHAR(255)');
    await ensureColumn('orders', 'billing_phone', 'billing_phone VARCHAR(50)');
    await ensureColumn('orders', 'billing_address', 'billing_address VARCHAR(512)');
    await ensureColumn('orders', 'coupon_code', 'coupon_code VARCHAR(50)');
    await ensureColumn('orders', 'discount_cents', 'discount_cents INT NOT NULL DEFAULT 0');
    await ensureColumn('orders', 'guest_email', 'guest_email VARCHAR(255)');

    // Modify user_id to allow NULL for guest orders
    await conn.query('ALTER TABLE orders MODIFY COLUMN user_id BIGINT').catch(() => {});

    // Create coupons table if not exists
    await conn.query(`CREATE TABLE IF NOT EXISTS coupons (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      code VARCHAR(5) NOT NULL UNIQUE,
      type ENUM('percentage','fixed','freeship') NOT NULL,
      value INT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      usage_limit INT NOT NULL DEFAULT 10,
      usage_count INT NOT NULL DEFAULT 0,
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    // Ensure usage_limit and usage_count columns exist in existing tables
    await ensureColumn('coupons', 'usage_limit', 'usage_limit INT NOT NULL DEFAULT 10');
    await ensureColumn('coupons', 'usage_count', 'usage_count INT NOT NULL DEFAULT 0');

    // Seed a few coupons if missing (5-character codes with usage limits)
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, usage_limit, start_date, end_date) VALUES ('SUM10','percentage',10,1,10,CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY))");
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, usage_limit, start_date, end_date) VALUES ('SAL50','fixed',50000,1,10,CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY))");
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, usage_limit, start_date, end_date) VALUES ('SHIP0','freeship',0,1,10,CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY))");
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, usage_limit, start_date, end_date) VALUES ('VIP20','percentage',20,1,5,CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY))");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('ensureSchema failed', e);
  } finally {
    conn.release();
  }
}

// Initialize database and schema
async function initializeService() {
  try {
    await waitForDatabase();
    await ensureSchema();
  } catch (err) {
    console.error('Failed to initialize service:', err);
    process.exit(1);
  }
}

initializeService();

app.post('/orders/checkout', async (req, res) => {
  const userIdHeader = req.headers['x-user-id'];
  let userId = userIdHeader ? parseInt(userIdHeader, 10) : null;
  const { items, shipping = {}, billing = {}, couponCode, guestEmail } = req.body;
  const errors = [];
  
  // Allow guest checkout with email
  if (!userId && !guestEmail) {
    errors.push('Vui lòng đăng nhập hoặc cung cấp email');
  }
  if (guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    errors.push('Email không hợp lệ');
  }
  if (!Array.isArray(items) || items.length === 0) errors.push('Giỏ hàng trống');
  if (Array.isArray(items)) {
    for (const it of items) {
      if (!it.productId || !it.quantity || it.quantity <= 0 || !it.priceCents || it.priceCents <= 0) {
        errors.push('Sản phẩm không hợp lệ');
        break;
      }
    }
  }
  if (!shipping.name || !shipping.phone || !shipping.address || !shipping.city) {
    errors.push('Thiếu thông tin địa chỉ giao hàng');
  }
  if (errors.length) return res.status(400).json({ error: 'VALIDATION_ERROR', details: errors });
  
  // Handle guest checkout: check if email already has an account
  if (!userId && guestEmail) {
    try {
      // Call auth service to check if user exists
      const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
      const { data } = await axios.get(`${authServiceUrl}/auth/check-email?email=${encodeURIComponent(guestEmail)}`);
      if (data.exists && data.userId) {
        userId = data.userId;
      }
      // If user doesn't exist, leave userId as null and use guest_email
    } catch (e) {
      // Continue as guest if auth service check fails
      console.error('Auth service check failed:', e.message);
    }
  }
  
  const subtotalCents = items.reduce((sum, it) => sum + (it.priceCents * it.quantity), 0);
  const shippingCents = subtotalCents > 0 ? 3000000 : 0; // 30,000 VND fixed shipping
  const taxCents = Math.floor(subtotalCents * 0.1); // 10% VAT
  const totalCents = subtotalCents + shippingCents + taxCents;
  
  let discountCents = 0;
  let appliedCoupon = null;
  if (couponCode) {
    // Validate 5-character alphanumeric format
    if (!/^[A-Z0-9]{5}$/i.test(couponCode)) {
      return res.status(400).json({ error: 'INVALID_COUPON', details: ['Mã giảm giá phải là chuỗi 5 ký tự chữ và số'] });
    }
    try {
      const conn2 = await pool.getConnection();
      try {
        await conn2.beginTransaction();
        const [[c]] = await conn2.query(
          'SELECT * FROM coupons WHERE UPPER(code) = UPPER(?) AND active = 1 AND (start_date IS NULL OR start_date <= CURDATE()) AND (end_date IS NULL OR end_date >= CURDATE()) FOR UPDATE',
          [couponCode]
        );
        if (!c) {
          await conn2.rollback();
          return res.status(400).json({ error: 'INVALID_COUPON', details: ['Mã giảm giá không hợp lệ hoặc đã hết hạn'] });
        }
        // Check usage limit
        if (c.usage_count >= c.usage_limit) {
          await conn2.rollback();
          return res.status(400).json({ error: 'COUPON_EXHAUSTED', details: ['Mã giảm giá đã hết lượt sử dụng'] });
        }
        appliedCoupon = c;
        if (c.type === 'percentage') discountCents = Math.floor((subtotalCents * c.value) / 100);
        if (c.type === 'fixed') discountCents = Math.min(totalCents, c.value);
        if (c.type === 'freeship') discountCents = shippingCents; // Miễn phí vận chuyển
        
        // Increment usage count
        await conn2.query('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?', [c.id]);
        await conn2.commit();
      } catch (e) {
        await conn2.rollback();
        throw e;
      } finally {
        conn2.release();
      }
    } catch (e) {
      // continue without coupon
      console.error('Coupon validation error:', e);
    }
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [orderResult] = await conn.query(
      `INSERT INTO orders 
        (user_id, guest_email, status, total_cents,
         shipping_name, shipping_phone, shipping_address, shipping_city, shipping_district, shipping_ward,
         billing_name, billing_phone, billing_address,
         coupon_code, discount_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [userId || null, (!userId && guestEmail) ? guestEmail : null, 'PENDING', totalCents,
       shipping.name || null, shipping.phone || null, shipping.address || null, shipping.city || null, shipping.district || null, shipping.ward || null,
       billing.name || null, billing.phone || null, billing.address || null,
       appliedCoupon ? appliedCoupon.code : null, discountCents]
    );
    const orderId = orderResult.insertId;
    for (const it of items) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price_cents) VALUES (?, ?, ?, ?)',
        [orderId, it.productId, it.quantity, it.priceCents]
      );
    }
    const { data: intent } = await axios.post(`${PAYMENT_SERVICE_URL}/payment/intents`, {
      orderId,
      amountCents: Math.max(0, totalCents - discountCents),
      currency: 'VND',
    });
    await conn.commit();
    return res.status(201).json({ orderId, paymentIntentId: intent.id, clientSecret: intent.clientSecret, totalCents, discountCents });
  } catch (e) {
    await conn.rollback();
    if (e && e.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(500).json({ error: 'Database schema mismatch: hãy cập nhật DB (docker compose up --build) để thêm cột shipping/billing/coupons' });
    }
    return res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

app.post('/orders/:orderId/pay', async (req, res) => {
  const { orderId } = req.params;
  const { intentId } = req.body;
  if (!intentId) return res.status(400).json({ error: 'Missing intentId' });
  try {
    // Confirm payment with mock service
    await axios.post(`${PAYMENT_SERVICE_URL}/payment/intents/${intentId}/confirm`);
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['PAID', orderId]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Payment confirm failed' });
  }
});

app.get('/orders/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const userIdHeader = req.headers['x-user-id'];
  const userId = userIdHeader ? parseInt(userIdHeader, 10) : null;
  const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, userId]);
  if (!order) return res.status(404).json({ error: 'Not found' });
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  // Enrich with product info from catalog service (batched)
  try {
    const productIds = [...new Set(items.map((it) => it.product_id))];
    const details = await Promise.all(
      productIds.map(async (pid) => {
        const { data } = await axios.get(`${CATALOG_SERVICE_URL}/catalog/products/${pid}`);
        return [pid, data];
      })
    );
    const byId = Object.fromEntries(details);
    const enriched = items.map((it) => ({
      ...it,
      product: byId[it.product_id] ? {
        id: byId[it.product_id].id,
        name: byId[it.product_id].name,
        brand: byId[it.product_id].brand,
        category: byId[it.product_id].category,
        image_url: byId[it.product_id].images?.[0]?.url || byId[it.product_id].image_url || null,
      } : null,
    }));
    return res.json({ ...order, items: enriched });
  } catch (e) {
    // Fallback to raw items if enrichment fails
    return res.json({ ...order, items });
  }
});

app.get('/orders', async (req, res) => {
  const userIdHeader = req.headers['x-user-id'];
  const userId = userIdHeader ? parseInt(userIdHeader, 10) : null;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const [orders] = await pool.query('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50', [userId]);
  return res.json(orders);
});

// Validate coupon code
app.get('/orders/coupons/:code', async (req, res) => {
  try {
    const { code } = req.params;
    // Validate 5-character alphanumeric format
    if (!/^[A-Z0-9]{5}$/i.test(code)) {
      return res.status(400).json({ error: 'INVALID_FORMAT', message: 'Mã giảm giá phải là chuỗi 5 ký tự chữ và số' });
    }
    const [[c]] = await pool.query(
      'SELECT code, type, value, usage_count, usage_limit FROM coupons WHERE UPPER(code) = UPPER(?) AND active = 1 AND (start_date IS NULL OR start_date <= CURDATE()) AND (end_date IS NULL OR end_date >= CURDATE())',
      [code]
    );
    if (!c) return res.status(404).json({ error: 'INVALID_COUPON', message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' });
    if (c.usage_count >= c.usage_limit) {
      return res.status(400).json({ error: 'COUPON_EXHAUSTED', message: 'Mã giảm giá đã hết lượt sử dụng', remaining: 0 });
    }
    return res.json({ ...c, remaining: c.usage_limit - c.usage_count });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin: coupons CRUD
app.get('/admin/coupons', async (req, res) => {
  const [rows] = await pool.query('SELECT id, code, type, value, active, usage_limit, usage_count, start_date, end_date FROM coupons ORDER BY id DESC LIMIT 500');
  return res.json(rows);
});

app.post('/admin/coupons', async (req, res) => {
  const { code, type, value = 0, active = 1, usageLimit = 10, startDate = null, endDate = null } = req.body || {};
  const allowed = ['percentage', 'fixed', 'freeship'];
  
  // Validate code format: exactly 5 alphanumeric characters
  if (!code || !/^[A-Z0-9]{5}$/i.test(code)) {
    return res.status(400).json({ error: 'Mã giảm giá phải là chuỗi 5 ký tự chữ và số' });
  }
  
  if (!allowed.includes(type)) return res.status(400).json({ error: 'Invalid type' });
  
  // Validate usage limit (max 10)
  const limit = Math.min(Math.max(1, parseInt(usageLimit) || 10), 10);
  
  try {
    await pool.query(
      'INSERT INTO coupons (code, type, value, active, usage_limit, start_date, end_date) VALUES (UPPER(?), ?, ?, ?, ?, ?, ?)', 
      [code, type, value, active ? 1 : 0, limit, startDate, endDate]
    );
    return res.status(201).json({ ok: true });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Coupon already exists' });
    return res.status(500).json({ error: 'Server error' });
  }
});

app.put('/admin/coupons/:id', async (req, res) => {
  const { id } = req.params;
  const { code, type, value, active, usageLimit, startDate, endDate } = req.body || {};
  const fields = [];
  const params = [];
  
  if (code) {
    // Validate code format: exactly 5 alphanumeric characters
    if (!/^[A-Z0-9]{5}$/i.test(code)) {
      return res.status(400).json({ error: 'Mã giảm giá phải là chuỗi 5 ký tự chữ và số' });
    }
    fields.push('code = UPPER(?)'); 
    params.push(code);
  }
  if (type) { fields.push('type = ?'); params.push(type); }
  if (value !== undefined) { fields.push('value = ?'); params.push(value); }
  if (active !== undefined) { fields.push('active = ?'); params.push(active ? 1 : 0); }
  if (usageLimit !== undefined) { 
    const limit = Math.min(Math.max(1, parseInt(usageLimit) || 10), 10);
    fields.push('usage_limit = ?'); 
    params.push(limit); 
  }
  if (startDate !== undefined) { fields.push('start_date = ?'); params.push(startDate); }
  if (endDate !== undefined) { fields.push('end_date = ?'); params.push(endDate); }
  if (fields.length === 0) return res.json({ ok: true });
  await pool.query(`UPDATE coupons SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
  return res.json({ ok: true });
});

app.delete('/admin/coupons/:id', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM coupons WHERE id = ?', [id]);
  return res.json({ ok: true });
});

// Admin guard middleware (trust gateway header)
function requireAdmin(req, res, next) {
  if (req.path.startsWith('/admin')) {
    const role = req.headers['x-user-role'];
    if (role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  }
  return next();
}

app.use(requireAdmin);

// Admin: list recent orders
app.get('/admin/orders', async (req, res) => {
  const [orders] = await pool.query('SELECT * FROM orders ORDER BY id DESC LIMIT 200');
  return res.json(orders);
});

// Admin: get order with items
app.get('/admin/orders/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return res.status(404).json({ error: 'Not found' });
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  return res.json({ ...order, items });
});

// Admin: update status
app.patch('/admin/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const allowed = ['PENDING', 'PAID', 'CANCELLED', 'SHIPPING', 'DELIVERED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
  return res.json({ ok: true });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Order service listening on ${PORT}`);
});


