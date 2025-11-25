import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import mysql from 'mysql2/promise';
import axios from 'axios';
import nodemailer from 'nodemailer';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 3004;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005';
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:3002';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpw',
  database: process.env.DB_DATABASE || 'order_db',
  waitForConnections: true,
  connectionLimit: 10,
});

const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587', 10);
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER || 'no-reply@ck-nodejs.com';

let emailTransporter = null;
if (EMAIL_USER && EMAIL_PASS) {
  emailTransporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
  });
  emailTransporter.verify().catch(err => console.error('Email transporter verify failed', err));
}

function formatCurrency(cents) {
  return new Intl.NumberFormat('vi-VN').format(Math.max(0, cents / 100)) + ' ₫';
}

function headerUserId(req) {
  const value = req.headers['x-user-id'];
  return value ? parseInt(value, 10) : null;
}

function headerUserRole(req) {
  return req.headers['x-user-role'] || null;
}

async function insertStatusHistory(conn, orderId, status, note = null) {
  await conn.query(
    'INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)',
    [orderId, status, note]
  );
}

async function getLoyaltyBalanceForUpdate(conn, userId) {
  const [[row]] = await conn.query(
    'SELECT balance_cents FROM user_loyalty_points WHERE user_id = ? FOR UPDATE',
    [userId]
  );
  return row ? Number(row.balance_cents) : 0;
}

async function adjustLoyaltyBalance(userId, deltaCents, connParam = null) {
  if (!userId || deltaCents === 0) return;
  const conn = connParam || await pool.getConnection();
  const manageTxn = !connParam;
  try {
    if (manageTxn) await conn.beginTransaction();
    const [[row]] = await conn.query('SELECT balance_cents FROM user_loyalty_points WHERE user_id = ? FOR UPDATE', [userId]);
    const current = row ? Number(row.balance_cents) : 0;
    const next = Math.max(current + deltaCents, 0);
    if (row) {
      await conn.query('UPDATE user_loyalty_points SET balance_cents = ? WHERE user_id = ?', [next, userId]);
    } else {
      await conn.query('INSERT INTO user_loyalty_points (user_id, balance_cents) VALUES (?, ?)', [userId, next]);
    }
    if (manageTxn) await conn.commit();
    return next;
  } catch (e) {
    if (manageTxn) await conn.rollback();
    throw e;
  } finally {
    if (manageTxn) conn.release();
  }
}

async function getLoyaltyBalance(userId) {
  if (!userId) return 0;
  const [[row]] = await pool.query('SELECT balance_cents FROM user_loyalty_points WHERE user_id = ?', [userId]);
  return row ? Number(row.balance_cents) : 0;
}

async function fetchOrderDetail(orderId) {
  const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return null;
  if (order.user_id) {
    const [[userRow]] = await pool.query('SELECT email FROM auth_db.users WHERE id = ?', [order.user_id]);
    if (userRow) order.user_email = userRow.email;
  }
  const [items] = await pool.query(
    `SELECT oi.*, p.name, p.brand, p.category, p.image_url
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
    [orderId]
  );
  const [statusHistory] = await pool.query(
    'SELECT status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC',
    [orderId]
  );
  return { ...order, items, status_history: statusHistory };
}

async function sendOrderConfirmationEmail(orderDetails) {
  if (!emailTransporter) {
    console.warn('Email transporter not configured; skipping order email');
    return;
  }
  const order = orderDetails.order;
  const items = orderDetails.items || [];
  const statusHistory = orderDetails.status_history || [];
  const recipient = order.user_email || order.guest_email;
  if (!recipient) return;
  const rows = items.map((it) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;">${it.product?.name || 'Unknown'}</td>
      <td style="padding:8px;border:1px solid #ddd;">${it.quantity}</td>
      <td style="padding:8px;border:1px solid #ddd;">${formatCurrency(it.price_cents)}</td>
      <td style="padding:8px;border:1px solid #ddd;">${formatCurrency(it.price_cents * it.quantity)}</td>
    </tr>
  `).join('');
  const statusRows = statusHistory.map((s) => `
    <tr>
      <td style="padding:6px;border:1px solid #ddd;">${s.status}</td>
      <td style="padding:6px;border:1px solid #ddd;">${new Date(s.created_at).toLocaleString('vi-VN')}</td>
      <td style="padding:6px;border:1px solid #ddd;">${s.note || '—'}</td>
    </tr>
  `).join('');
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h2>Đơn hàng #${order.id} đã được xác nhận</h2>
      <p>Cảm ơn bạn đã mua hàng! Dưới đây là chi tiết đơn:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border:1px solid #ddd;">Sản phẩm</th>
            <th style="text-align:left;padding:8px;border:1px solid #ddd;">Số lượng</th>
            <th style="text-align:left;padding:8px;border:1px solid #ddd;">Đơn giá</th>
            <th style="text-align:left;padding:8px;border:1px solid #ddd;">Tổng</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p><strong>Tổng cộng:</strong> ${formatCurrency(order.total_cents)}</p>
      ${order.coupon_code ? `<p>Mã giảm giá: ${order.coupon_code} (Giảm ${formatCurrency(order.discount_cents)})</p>` : ''}
      ${order.loyalty_cents_used ? `<p>Đã dùng điểm: ${formatCurrency(order.loyalty_cents_used)}</p>` : ''}
      ${order.loyalty_cents_earned ? `<p>Điểm nhận được: ${formatCurrency(order.loyalty_cents_earned)}</p>` : ''}
      <h3>Lịch sử trạng thái</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:6px;border:1px solid #ddd;">Trạng thái</th>
            <th style="padding:6px;border:1px solid #ddd;">Thời gian</th>
            <th style="padding:6px;border:1px solid #ddd;">Ghi chú</th>
          </tr>
        </thead>
        <tbody>${statusRows}</tbody>
      </table>
      <p style="margin-top:24px;">Trân trọng,</p>
      <p>CK-NodeJS Shop</p>
    </div>
  `;
  try {
    await emailTransporter.sendMail({
      from: `"CK-NodeJS Shop" <${EMAIL_FROM}>`,
      to: recipient,
      subject: `Xác nhận đơn hàng #${order.id} - CK-NodeJS Shop`,
      html
    });
  } catch (emailError) {
    console.error('Order confirmation email failed:', emailError);
  }
}

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
    await ensureColumn('orders', 'loyalty_cents_used', 'loyalty_cents_used INT NOT NULL DEFAULT 0');
    await ensureColumn('orders', 'loyalty_cents_earned', 'loyalty_cents_earned INT NOT NULL DEFAULT 0');

    // Modify user_id to allow NULL for guest orders
    await conn.query('ALTER TABLE orders MODIFY COLUMN user_id BIGINT').catch(() => {});

    // Create order status history table if not exists
    await conn.query(`CREATE TABLE IF NOT EXISTS order_status_history (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      order_id BIGINT NOT NULL,
      status VARCHAR(32) NOT NULL,
      note VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )`);

    // Create loyalty table if not exists
    await conn.query(`CREATE TABLE IF NOT EXISTS user_loyalty_points (
      user_id BIGINT PRIMARY KEY,
      balance_cents BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

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
  let pointsToUseCents = Number(req.body.pointsToUseCents || 0);
  if (!Number.isFinite(pointsToUseCents) || pointsToUseCents < 0) pointsToUseCents = 0;
  const errors = [];
  
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
  if (pointsToUseCents > 0 && !userId) {
    errors.push('Vui lòng đăng nhập để sử dụng điểm tích lũy');
  }
  if (errors.length) return res.status(400).json({ error: 'VALIDATION_ERROR', details: errors });
  
  if (!userId && guestEmail) {
    try {
      const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
      const { data } = await axios.get(`${authServiceUrl}/auth/check-email?email=${encodeURIComponent(guestEmail)}`);
      if (data.exists && data.userId) {
        userId = data.userId;
      }
    } catch (e) {
      console.error('Auth service check failed:', e.message);
    }
  }
  
  const subtotalCents = items.reduce((sum, it) => sum + (it.priceCents * it.quantity), 0);
  const shippingCents = subtotalCents > 0 ? 3000000 : 0;
  const taxCents = Math.floor(subtotalCents * 0.1);
  const totalCents = subtotalCents + shippingCents + taxCents;
  
  let discountCents = 0;
  let appliedCoupon = null;
  if (couponCode) {
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
        if (c.usage_count >= c.usage_limit) {
          await conn2.rollback();
          return res.status(400).json({ error: 'COUPON_EXHAUSTED', details: ['Mã giảm giá đã hết lượt sử dụng'] });
        }
        appliedCoupon = c;
        if (c.type === 'percentage') discountCents = Math.floor((subtotalCents * c.value) / 100);
        if (c.type === 'fixed') discountCents = Math.min(totalCents, c.value);
        if (c.type === 'freeship') discountCents = shippingCents;
        await conn2.query('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?', [c.id]);
        await conn2.commit();
      } catch (e) {
        await conn2.rollback();
        throw e;
      } finally {
        conn2.release();
      }
    } catch (e) {
      console.error('Coupon validation error:', e);
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let loyaltyBalance = 0;
    let loyaltyUsed = 0;
    if (pointsToUseCents > 0 && userId) {
      loyaltyBalance = await getLoyaltyBalanceForUpdate(conn, userId);
    }
    const maxLoyaltyUse = Math.max(totalCents - discountCents, 0);
    loyaltyUsed = Math.min(pointsToUseCents, loyaltyBalance, maxLoyaltyUse);
    const payableCents = Math.max(totalCents - discountCents - loyaltyUsed, 0);
    const loyaltyEarned = userId ? Math.floor(payableCents * 0.1) : 0;
    const [orderResult] = await conn.query(
      `INSERT INTO orders 
        (user_id, guest_email, status, total_cents,
         shipping_name, shipping_phone, shipping_address, shipping_city, shipping_district, shipping_ward,
         billing_name, billing_phone, billing_address,
         coupon_code, discount_cents, loyalty_cents_used, loyalty_cents_earned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [userId || null, (!userId && guestEmail) ? guestEmail : null, 'PENDING', totalCents,
       shipping.name || null, shipping.phone || null, shipping.address || null, shipping.city || null, shipping.district || null, shipping.ward || null,
       billing.name || null, billing.phone || null, billing.address || null,
       appliedCoupon ? appliedCoupon.code : null, discountCents, loyaltyUsed, loyaltyEarned]
    );
    const orderId = orderResult.insertId;
    for (const it of items) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price_cents) VALUES (?, ?, ?, ?)',
        [orderId, it.productId, it.quantity, it.priceCents]
      );
    }
    await insertStatusHistory(conn, orderId, 'PENDING');
    const { data: intent } = await axios.post(`${PAYMENT_SERVICE_URL}/payment/intents`, {
      orderId,
      amountCents: Math.max(0, payableCents),
      currency: 'VND',
    });
    await conn.commit();
    return res.status(201).json({
      orderId,
      paymentIntentId: intent.id,
      clientSecret: intent.clientSecret,
      totalCents,
      discountCents,
      loyaltyCentsUsed: loyaltyUsed,
      loyaltyCentsEarned: loyaltyEarned,
      payableCents
    });
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
    await axios.post(`${PAYMENT_SERVICE_URL}/payment/intents/${intentId}/confirm`);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[order]] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);
      if (!order) {
        await conn.rollback();
        return res.status(404).json({ error: 'Order not found' });
      }
      await conn.query('UPDATE orders SET status = ? WHERE id = ?', ['PAID', orderId]);
      await insertStatusHistory(conn, orderId, 'PAID');
      await adjustLoyaltyBalance(order.user_id, (order.loyalty_cents_earned || 0) - (order.loyalty_cents_used || 0), conn);
      await conn.commit();
    } catch (inner) {
      await conn.rollback();
      throw inner;
    } finally {
      conn.release();
    }
    const orderDetails = await fetchOrderDetail(orderId);
    await sendOrderConfirmationEmail(orderDetails);
    return res.json({ ok: true, order: orderDetails });
  } catch (e) {
    console.error('Payment confirm failed:', e);
    return res.status(500).json({ error: 'Payment confirm failed' });
  }
});

app.get('/orders/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const guestEmailParam = (req.query.guestEmail || '').trim().toLowerCase();
  const userId = headerUserId(req);
  const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return res.status(404).json({ error: 'Not found' });
  const isOwner = userId && order.user_id === userId;
  const isGuestAllowed = guestEmailParam && order.guest_email && order.guest_email.toLowerCase() === guestEmailParam;
  if (!isOwner && !isGuestAllowed) {
    return res.status(404).json({ error: 'Not found' });
  }
  const orderDetails = await fetchOrderDetail(orderId);
  return res.json(orderDetails);
});

app.get('/orders', async (req, res) => {
  const userIdHeader = req.headers['x-user-id'];
  const userId = userIdHeader ? parseInt(userIdHeader, 10) : null;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const [orders] = await pool.query('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50', [userId]);
  
  // Enrich each order with items
  const enrichedOrders = await Promise.all(orders.map(async (order) => {
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    // Enrich items with product info from catalog service
    const enrichedItems = await Promise.all(items.map(async (item) => {
      try {
        const { data } = await axios.get(`${CATALOG_SERVICE_URL}/catalog/products/${item.product_id}`);
        return {
          ...item,
          product: {
            id: data.id,
            name: data.name,
            brand: data.brand,
            category: data.category,
            image_url: data.images?.[0]?.url || data.image_url || null
          }
        };
      } catch (e) {
        return { ...item, product: null };
      }
    }));
    return { ...order, items: enrichedItems };
  }));
  
  return res.json(enrichedOrders);
});

app.get('/orders/loyalty', async (req, res) => {
  const userId = headerUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const balanceCents = await getLoyaltyBalance(userId);
  return res.json({ balanceCents });
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

// Admin: coupons CRUD with orders where applied
app.get('/admin/coupons', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, code, type, value, active, usage_limit, usage_count, start_date, end_date, created_at FROM coupons ORDER BY id DESC LIMIT 500');
    
    // Get orders for each coupon
    const couponsWithOrders = await Promise.all(rows.map(async (coupon) => {
      const [orders] = await pool.query(
        'SELECT id, total_cents, discount_cents, created_at, status FROM orders WHERE coupon_code = ? ORDER BY created_at DESC LIMIT 50',
        [coupon.code]
      );
      return {
        ...coupon,
        orders: orders
      };
    }));
    
    return res.json(couponsWithOrders);
  } catch (e) {
    console.error('Get coupons error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
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

// Admin: Dashboard statistics - Simple
app.get('/admin/dashboard/simple', async (req, res) => {
  try {
    // Total users - get from auth-service API
    let totalUsers = 0;
    let newUsersCount = 0;
    try {
      // Forward admin headers to auth-service
      const { data: userStats } = await axios.get(`${AUTH_SERVICE_URL}/admin/dashboard/users`, {
        headers: {
          'x-user-id': req.headers['x-user-id'],
          'x-user-role': req.headers['x-user-role'],
        }
      });
      totalUsers = userStats.totalUsers || 0;
      newUsersCount = userStats.newUsers || 0;
    } catch (e) {
      console.error('Failed to get user stats from auth-service:', e.message);
      // Fallback: count from orders
      const [userCount] = await pool.query('SELECT COUNT(DISTINCT user_id) as count FROM orders WHERE user_id IS NOT NULL');
      totalUsers = userCount[0]?.count || 0;
      const [newUsers] = await pool.query(`
        SELECT COUNT(DISTINCT user_id) as count 
        FROM orders 
        WHERE user_id IS NOT NULL 
        AND MONTH(created_at) = MONTH(CURRENT_DATE()) 
        AND YEAR(created_at) = YEAR(CURRENT_DATE())
      `);
      newUsersCount = newUsers[0]?.count || 0;
    }
    
    // Total orders
    const [orderCount] = await pool.query('SELECT COUNT(*) as count FROM orders');
    const totalOrders = orderCount[0]?.count || 0;
    
    // Total revenue (from PAID orders)
    const [revenue] = await pool.query(`
      SELECT COALESCE(SUM(total_cents - discount_cents - loyalty_cents_used), 0) as revenue 
      FROM orders 
      WHERE status = 'PAID'
    `);
    const totalRevenue = revenue[0]?.revenue || 0;
    
    // Best selling products
    const [topProducts] = await pool.query(`
      SELECT 
        oi.product_id,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.quantity * oi.price_cents) as total_revenue
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'PAID'
      GROUP BY oi.product_id
      ORDER BY total_quantity DESC
      LIMIT 10
    `);
    
    // Get product names from catalog service
    const enrichedProducts = await Promise.all(topProducts.map(async (p) => {
      try {
        const { data } = await axios.get(`${CATALOG_SERVICE_URL}/catalog/products/${p.product_id}`);
        return {
          product_id: p.product_id,
          name: data.name || `Product #${p.product_id}`,
          quantity: Number(p.total_quantity) || 0,
          revenue: Number(p.total_revenue) || 0
        };
      } catch (e) {
        console.error(`Failed to get product ${p.product_id} from catalog:`, e.message);
        return {
          product_id: p.product_id,
          name: `Product #${p.product_id}`,
          quantity: Number(p.total_quantity) || 0,
          revenue: Number(p.total_revenue) || 0
        };
      }
    }));
    
    console.log(`Dashboard simple: ${totalUsers} users, ${totalOrders} orders, ${totalRevenue} revenue, ${enrichedProducts.length} products`);
    if (enrichedProducts.length > 0) {
      console.log('Sample enriched product:', JSON.stringify(enrichedProducts[0], null, 2));
      console.log('All enriched products:', JSON.stringify(enrichedProducts.slice(0, 3), null, 2));
    }
    
    const response = {
      totalUsers,
      newUsers: newUsersCount,
      totalOrders,
      totalRevenue,
      bestSellingProducts: enrichedProducts
    };
    
    console.log('Response bestSellingProducts count:', response.bestSellingProducts.length);
    
    // Set cache control headers
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    return res.json(response);
  } catch (e) {
    console.error('Dashboard simple stats error:', e);
    return res.status(500).json({ error: 'Server error', details: e.message, stack: e.stack });
  }
});

// Admin: Dashboard statistics - Advanced
app.get('/admin/dashboard/advanced', async (req, res) => {
  try {
    const { interval = 'year', startDate, endDate } = req.query;
    
    let dateFilter = '';
    let groupBy = '';
    let dateFormat = '';
    
    if (startDate && endDate) {
      dateFilter = `AND DATE(created_at) BETWEEN ? AND ?`;
      groupBy = 'DATE(created_at)';
      dateFormat = 'DATE(created_at)';
    } else {
      switch (interval) {
        case 'year':
          groupBy = 'YEAR(created_at)';
          dateFormat = 'YEAR(created_at)';
          break;
        case 'quarter':
          groupBy = 'YEAR(created_at), QUARTER(created_at)';
          dateFormat = "CONCAT(YEAR(created_at), '-Q', QUARTER(created_at))";
          break;
        case 'month':
          groupBy = 'YEAR(created_at), MONTH(created_at)';
          dateFormat = "CONCAT(YEAR(created_at), '-', LPAD(MONTH(created_at), 2, '0'))";
          break;
        case 'week':
          groupBy = 'YEAR(created_at), WEEK(created_at)';
          dateFormat = "CONCAT(YEAR(created_at), '-W', LPAD(WEEK(created_at), 2, '0'))";
          break;
        default:
          groupBy = 'YEAR(created_at)';
          dateFormat = 'YEAR(created_at)';
      }
    }
    
    const params = [];
    if (dateFilter) {
      params.push(startDate, endDate);
    }
    
    // Orders, revenue, profit by time period
    const [stats] = await pool.query(`
      SELECT 
        ${dateFormat} as period,
        COUNT(*) as orders_count,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN total_cents - discount_cents - loyalty_cents_used ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN (total_cents - discount_cents - loyalty_cents_used) * 0.3 ELSE 0 END), 0) as profit
      FROM orders
      WHERE 1=1 ${dateFilter}
      GROUP BY ${groupBy}
      ORDER BY period ASC
    `, params);
    
    // Products sold by period
    let orderDateFilter = dateFilter ? dateFilter.replace('created_at', 'o.created_at') : '';
    let orderDateFormat = dateFormat.replace(/created_at/g, 'o.created_at');
    let orderGroupBy = groupBy.replace(/created_at/g, 'o.created_at');
    
    const [productsStats] = await pool.query(`
      SELECT 
        ${orderDateFormat} as period,
        COUNT(DISTINCT oi.product_id) as unique_products,
        SUM(oi.quantity) as total_products_sold
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'PAID' ${orderDateFilter}
      GROUP BY ${orderGroupBy}
      ORDER BY period ASC
    `, params);
    
    // Product types/categories sold by period
    const [categoryStats] = await pool.query(`
      SELECT 
        ${orderDateFormat} as period,
        p.category_id,
        COUNT(DISTINCT oi.product_id) as products_count,
        SUM(oi.quantity) as quantity_sold
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      LEFT JOIN catalog_db.products p ON p.id = oi.product_id
      WHERE o.status = 'PAID' ${orderDateFilter}
      GROUP BY ${orderGroupBy}, p.category_id
      ORDER BY period ASC, quantity_sold DESC
    `, params);
    
    return res.json({
      revenueProfit: stats || [],
      productsSold: productsStats || [],
      categoriesSold: categoryStats || []
    });
  } catch (e) {
    console.error('Dashboard advanced stats error:', e);
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
});

// Admin: list recent orders with pagination and filters
app.get('/admin/orders', async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate, timeRange } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let dateFilter = '';
    const params = [];
    
    if (timeRange) {
      const now = new Date();
      let start = new Date();
      
      switch (timeRange) {
        case 'today':
          start.setHours(0, 0, 0, 0);
          dateFilter = 'AND DATE(created_at) = CURDATE()';
          break;
        case 'yesterday':
          start.setDate(start.getDate() - 1);
          start.setHours(0, 0, 0, 0);
          const yesterdayEnd = new Date(start);
          yesterdayEnd.setHours(23, 59, 59, 999);
          dateFilter = 'AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
          break;
        case 'thisWeek':
          start.setDate(start.getDate() - start.getDay());
          start.setHours(0, 0, 0, 0);
          dateFilter = 'AND YEARWEEK(created_at) = YEARWEEK(CURRENT_DATE)';
          break;
        case 'thisMonth':
          start.setDate(1);
          start.setHours(0, 0, 0, 0);
          dateFilter = 'AND MONTH(created_at) = MONTH(CURRENT_DATE) AND YEAR(created_at) = YEAR(CURRENT_DATE)';
          break;
      }
    } else if (startDate && endDate) {
      dateFilter = 'AND DATE(created_at) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    
    const [orders] = await pool.query(
      `SELECT * FROM orders WHERE 1=1 ${dateFilter} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM orders WHERE 1=1 ${dateFilter}`,
      params
    );
    const total = countResult[0]?.total || 0;
    
    return res.json({
      items: orders,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (e) {
    console.error('Admin orders list error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin: get order with items and user info
app.get('/admin/orders/:orderId', async (req, res) => {
  try {
  const { orderId } = req.params;
  const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return res.status(404).json({ error: 'Not found' });
    
    // Get user info if exists
    let userInfo = null;
    if (order.user_id) {
      try {
        const [[user]] = await pool.query('SELECT id, email, full_name FROM auth_db.users WHERE id = ?', [order.user_id]);
        if (user) userInfo = user;
      } catch (e) {
        console.error('Failed to fetch user info:', e);
      }
    }
    
    // Get order items with product info
    const [items] = await pool.query(`
      SELECT oi.*, p.name, p.brand, p.category, p.image_url
      FROM order_items oi
      LEFT JOIN catalog_db.products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
    `, [orderId]);
    
    // Get status history
    const [statusHistory] = await pool.query(
      'SELECT status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC',
      [orderId]
    );
    
    return res.json({ 
      ...order, 
      items, 
      status_history: statusHistory,
      user: userInfo
    });
  } catch (e) {
    console.error('Get order detail error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update status
app.patch('/admin/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const allowed = ['PENDING', 'PAID', 'CANCELLED', 'SHIPPING', 'DELIVERED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
  await insertStatusHistory(pool, orderId, status, req.body.note || null);
  return res.json({ ok: true });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Order service listening on ${PORT}`);
});


