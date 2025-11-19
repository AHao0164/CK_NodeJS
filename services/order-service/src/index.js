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

    // Create coupons table if not exists
    await conn.query(`CREATE TABLE IF NOT EXISTS coupons (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      code VARCHAR(50) NOT NULL UNIQUE,
      type ENUM('percentage','fixed','freeship') NOT NULL,
      value INT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      start_date DATE,
      end_date DATE
    )`);

    // Seed a few coupons if missing
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, start_date, end_date) VALUES ('SUMMER10','percentage',10,1,CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY))");
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, start_date, end_date) VALUES ('SALE100K','fixed',100000,1,CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY))");
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, start_date, end_date) VALUES ('FREESHIP','freeship',0,1,CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY))");
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, start_date, end_date) VALUES ('SUMMER2024','percentage',15,1,CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY))");
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
  
  // Handle guest checkout: create or find user by email
  if (!userId && guestEmail) {
    try {
      // Call auth service to get or create guest user
      const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
      const { data } = await axios.post(`${authServiceUrl}/auth/guest`, {
        email: guestEmail,
        fullName: shipping.name || 'Guest User'
      });
      userId = data.userId;
    } catch (e) {
      return res.status(500).json({ error: 'Không thể tạo tài khoản guest', details: [e.message] });
    }
  }
  
  const totalCents = items.reduce((sum, it) => sum + (it.priceCents * it.quantity), 0);
  let discountCents = 0;
  let appliedCoupon = null;
  if (couponCode) {
    try {
      const [[c]] = await pool.query(
        'SELECT * FROM coupons WHERE code = ? AND active = 1 AND (start_date IS NULL OR start_date <= CURDATE()) AND (end_date IS NULL OR end_date >= CURDATE())',
        [couponCode]
      );
      if (!c) return res.status(400).json({ error: 'INVALID_COUPON', details: ['Mã giảm giá không hợp lệ hoặc đã hết hạn'] });
      appliedCoupon = c;
      if (c.type === 'percentage') discountCents = Math.floor((totalCents * c.value) / 100);
      if (c.type === 'fixed') discountCents = Math.min(totalCents, c.value);
      if (c.type === 'freeship') discountCents = 0; // phí ship 0 đã mặc định
    } catch (e) {
      // continue without coupon
    }
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [orderResult] = await conn.query(
      `INSERT INTO orders 
        (user_id, status, total_cents,
         shipping_name, shipping_phone, shipping_address, shipping_city, shipping_district, shipping_ward,
         billing_name, billing_phone, billing_address,
         coupon_code, discount_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [userId, 'PENDING', totalCents,
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
    const [[c]] = await pool.query(
      'SELECT code, type, value FROM coupons WHERE UPPER(code) = UPPER(?) AND active = 1 AND (start_date IS NULL OR start_date <= CURDATE()) AND (end_date IS NULL OR end_date >= CURDATE())',
      [code]
    );
    if (!c) return res.status(404).json({ error: 'INVALID_COUPON' });
    return res.json(c);
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin: coupons CRUD
app.get('/admin/coupons', async (req, res) => {
  const [rows] = await pool.query('SELECT id, code, type, value, active, start_date, end_date FROM coupons ORDER BY id DESC LIMIT 500');
  return res.json(rows);
});

app.post('/admin/coupons', async (req, res) => {
  const { code, type, value = 0, active = 1, startDate = null, endDate = null } = req.body || {};
  const allowed = ['percentage', 'fixed', 'freeship'];
  if (!code || !allowed.includes(type)) return res.status(400).json({ error: 'Invalid payload' });
  try {
    await pool.query('INSERT INTO coupons (code, type, value, active, start_date, end_date) VALUES (UPPER(?), ?, ?, ?, ?, ?)', [code, type, value, active ? 1 : 0, startDate, endDate]);
    return res.status(201).json({ ok: true });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Coupon already exists' });
    return res.status(500).json({ error: 'Server error' });
  }
});

app.put('/admin/coupons/:id', async (req, res) => {
  const { id } = req.params;
  const { code, type, value, active, startDate, endDate } = req.body || {};
  const fields = [];
  const params = [];
  if (code) { fields.push('code = UPPER(?)'); params.push(code); }
  if (type) { fields.push('type = ?'); params.push(type); }
  if (value !== undefined) { fields.push('value = ?'); params.push(value); }
  if (active !== undefined) { fields.push('active = ?'); params.push(active ? 1 : 0); }
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


