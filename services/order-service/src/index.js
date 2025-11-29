import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import mysql from 'mysql2/promise';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import CircuitBreaker from 'opossum';
import RedisLockManager from '../shared/RedisLockManager.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Initialize Redis Lock Manager
const lockManager = new RedisLockManager();

const PORT = process.env.PORT || 3004;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005';
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:3002';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

// Configure axios with timeout and retry
const httpClient = axios.create({
  timeout: 8000, // 8 second timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add retry logic for transient failures
axiosRetry(httpClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           error.response?.status === 503 || 
           error.response?.status === 429;
  }
});

// Circuit breaker for catalog service
const catalogBreaker = new CircuitBreaker(
  async (url) => {
    const response = await httpClient.get(url);
    return response.data;
  },
  {
    timeout: 8000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    name: 'catalog-service'
  }
);

catalogBreaker.fallback(() => ({
  error: 'SERVICE_UNAVAILABLE',
  message: 'Dịch vụ sản phẩm tạm thời không khả dụng. Vui lòng thử lại sau.'
}));

catalogBreaker.on('open', () => console.log('🔴 Catalog Circuit Breaker OPEN'));
catalogBreaker.on('halfOpen', () => console.log('🟡 Catalog Circuit Breaker HALF_OPEN'));
catalogBreaker.on('close', () => console.log('🟢 Catalog Circuit Breaker CLOSED'));

// Circuit breaker for payment service
const paymentBreaker = new CircuitBreaker(
  async (url, data) => {
    const response = await httpClient.post(url, data);
    return response.data;
  },
  {
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    name: 'payment-service'
  }
);

paymentBreaker.fallback(() => ({
  error: 'SERVICE_UNAVAILABLE',
  message: 'Dịch vụ thanh toán tạm thời không khả dụng. Vui lòng thử lại sau.'
}));

paymentBreaker.on('open', () => console.log('🔴 Payment Circuit Breaker OPEN'));
paymentBreaker.on('halfOpen', () => console.log('🟡 Payment Circuit Breaker HALF_OPEN'));
paymentBreaker.on('close', () => console.log('🟢 Payment Circuit Breaker CLOSED'));
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpw',
  database: process.env.DB_DATABASE || 'order_db',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  connectTimeout: 10000
});

// Execute SET NAMES utf8mb4 on each connection
pool.on('connection', (connection) => {
  connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
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

    await ensureColumn('orders', 'payment_method', "payment_method ENUM('COD','VNPAY') DEFAULT 'COD'");
    await ensureColumn('orders', 'payment_status', "payment_status ENUM('PENDING','PAID','FAILED') DEFAULT 'PENDING'");
    await ensureColumn('orders', 'shipping_name', 'shipping_name VARCHAR(255)');
    await ensureColumn('orders', 'shipping_phone', 'shipping_phone VARCHAR(50)');
    await ensureColumn('orders', 'shipping_email', 'shipping_email VARCHAR(255)');
    await ensureColumn('orders', 'shipping_province', 'shipping_province VARCHAR(100)');
    await ensureColumn('orders', 'shipping_district', 'shipping_district VARCHAR(100)');
    await ensureColumn('orders', 'shipping_ward', 'shipping_ward VARCHAR(100)');
    await ensureColumn('orders', 'shipping_address', 'shipping_address TEXT');
    await ensureColumn('orders', 'shipping_fee_cents', 'shipping_fee_cents INT DEFAULT 0');
    await ensureColumn('orders', 'discount_cents', 'discount_cents INT DEFAULT 0');
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
      start_date DATETIME,
      end_date DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Add created_at column if not exists (for existing databases)
    await ensureColumn('coupons', 'created_at', 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    
    // Alter existing DATE columns to DATETIME
    await conn.query(`ALTER TABLE coupons MODIFY COLUMN start_date DATETIME`).catch(() => {});
    await conn.query(`ALTER TABLE coupons MODIFY COLUMN end_date DATETIME`).catch(() => {});

    // Seed a few coupons if missing
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, start_date, end_date) VALUES ('SUMMER10','percentage',10,1,NOW(), DATE_ADD(NOW(), INTERVAL 365 DAY))");
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, start_date, end_date) VALUES ('SALE100K','fixed',10000,1,NOW(), DATE_ADD(NOW(), INTERVAL 365 DAY))");
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, start_date, end_date) VALUES ('FREESHIP','freeship',0,1,NOW(), DATE_ADD(NOW(), INTERVAL 365 DAY))");
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, start_date, end_date) VALUES ('SUMMER2025','percentage',15,1,NOW(), DATE_ADD(NOW(), INTERVAL 365 DAY))");
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

// Helper: ensure we have a user id for guest checkout (create or reuse account based on email)
async function ensureUserForGuest(shipping) {
  if (!shipping || !shipping.email) {
    throw new Error('Email is required for guest checkout');
  }

  const payload = {
    email: shipping.email,
    fullName: shipping.name || null,
    phone: shipping.phone || null,
    province: shipping.province || null,
    ward: shipping.ward || null,
    addressDetail: shipping.address || null
  };

  const { data } = await httpClient.post(`${AUTH_SERVICE_URL}/auth/ensure-guest`, payload);
  if (!data || !data.id) {
    throw new Error('Failed to ensure guest account');
  }
  return data.id;
}

app.post('/orders/checkout', async (req, res) => {
  const userIdHeader = req.headers['x-user-id'];
  const authenticatedUserId = userIdHeader ? parseInt(userIdHeader, 10) : null;
  const { items, shipping = {}, paymentMethod = 'COD', couponCode } = req.body;
  const errors = [];
  if (!Array.isArray(items) || items.length === 0) errors.push('Giỏ hàng trống');
  if (Array.isArray(items)) {
    for (const it of items) {
      if (!it.productId || !it.quantity || it.quantity <= 0 || !it.priceCents || it.priceCents <= 0) {
        console.log('Invalid item:', JSON.stringify(it, null, 2));
        errors.push('Sản phẩm không hợp lệ');
        break;
      }
    }
  }
  if (!shipping.name || !shipping.phone || !shipping.address || !shipping.email) {
    console.log('Shipping validation failed:', JSON.stringify(shipping, null, 2));
    errors.push('Thiếu thông tin địa chỉ giao hàng');
  }
  // Guest checkout: must provide at least an email to tie orders to an account
  if (!authenticatedUserId && !shipping.email) {
    errors.push('Email bắt buộc cho khách chưa đăng nhập');
  }

  if (errors.length) {
    console.log('Validation errors:', errors);
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: errors });
  }
  
  let userId = authenticatedUserId;

  // If not authenticated, auto-create or reuse an account based on email
  if (!userId) {
    try {
      userId = await ensureUserForGuest(shipping);
    } catch (err) {
      console.error('ensureUserForGuest error:', err.message);
      return res.status(500).json({ 
        error: 'GUEST_ACCOUNT_ERROR',
        message: 'Không thể tạo tài khoản cho khách. Vui lòng thử lại hoặc đăng nhập.'
      });
    }
  }
  
  // 🔒 CRITICAL: Prevent duplicate orders from multiple clicks
  // Lock by userId to ensure only one order creation at a time per user
  const orderLockKey = `order:create:${userId}`;
  
  try {
    return await lockManager.withLock(orderLockKey, async () => {
      return await processCheckout(userId, items, shipping, paymentMethod, couponCode, pool, res);
    }, { ttlSeconds: 30, maxRetries: 1, throwOnFailure: false });
  } catch (error) {
    console.error('Order creation lock error:', error);
    return res.status(429).json({ 
      error: 'ORDER_IN_PROGRESS',
      message: 'Đơn hàng của bạn đang được xử lý. Vui lòng không click liên tục.' 
    });
  }
});

// Extracted checkout logic for cleaner lock handling
async function processCheckout(userId, items, shipping, paymentMethod, couponCode, pool, res) {
  
  const shippingFeeCents = 30000; // Default 30k VND
  const subtotalCents = items.reduce((sum, it) => sum + (it.priceCents * it.quantity), 0);
  let discountCents = 0;
  let appliedCoupon = null;
  
  // 🔒 CRITICAL: Coupon lock with SELECT FOR UPDATE to prevent over-usage
  if (couponCode) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Use pessimistic lock with SELECT FOR UPDATE
      const [[c]] = await conn.query(
        'SELECT * FROM coupons WHERE code = ? AND active = 1 AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW()) FOR UPDATE',
        [couponCode]
      );
      
      if (!c) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ error: 'INVALID_COUPON', details: ['Mã giảm giá không hợp lệ hoặc đã hết hạn'] });
      }
      
      // Check max usage limit
      if (c.max_usage && c.times_used >= c.max_usage) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ error: 'COUPON_LIMIT_REACHED', details: ['Mã giảm giá đã hết lượt sử dụng'] });
      }
      
      // Check per-user limit
      if (c.max_usage_per_user) {
        const [[usage]] = await conn.query(
          'SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND coupon_code = ?',
          [userId, couponCode]
        );
        if (usage && usage.count >= c.max_usage_per_user) {
          await conn.rollback();
          conn.release();
          return res.status(400).json({ error: 'COUPON_USER_LIMIT', details: ['Bạn đã dùng mã này quá số lần cho phép'] });
        }
      }
      
      appliedCoupon = c;
      if (c.type === 'percentage') discountCents = Math.floor((subtotalCents * c.value) / 100);
      if (c.type === 'fixed') discountCents = Math.min(subtotalCents, c.value);
      if (c.type === 'freeship') discountCents = 0;
      
      // Increment usage counter (will be committed with order)
      await conn.query(
        'UPDATE coupons SET times_used = times_used + 1 WHERE id = ?',
        [c.id]
      );
      
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      console.error('Coupon validation error:', e);
      return res.status(500).json({ error: 'COUPON_ERROR', details: ['Lỗi xử lý mã giảm giá'] });
    } finally {
      conn.release();
    }
  }
  
  const totalCents = subtotalCents + shippingFeeCents - discountCents;
  const conn = await pool.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // 🔒 STOCK LOGIC theo payment method:
    // - VNPay: TRỪ STOCK NGAY khi tạo order (để user không phải chờ)
    // - COD: Chỉ CHECK stock, trừ sau khi xác nhận OTP
    
    if (paymentMethod === 'VNPAY') {
      // VNPay: Reserve inventory immediately
      try {
        const reservePayload = {
          items: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        };
        
        const reserveResponse = await httpClient.post(
          `${CATALOG_SERVICE_URL}/catalog/inventory/reserve`,
          reservePayload
        );
        
        if (!reserveResponse.data.success) {
          throw new Error(reserveResponse.data.error || 'Không đủ hàng');
        }
        
        console.log(`✅ Reserved inventory for VNPay order (user ${userId})`);
      } catch (stockError) {
        await conn.rollback();
        conn.release();
        
        console.error('VNPay stock reservation failed:', stockError.message);
        return res.status(400).json({ 
          error: 'Sản phẩm đã hết hàng hoặc không đủ số lượng', 
          message: 'Vui lòng giảm số lượng hoặc chọn sản phẩm khác'
        });
      }
    } else {
      // COD: Just check availability, don't reserve yet
      for (const item of items) {
        try {
          const product = await catalogBreaker.fire(`${CATALOG_SERVICE_URL}/catalog/products/${item.productId}`);
          
          if (!product || product.stock < item.quantity) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({
              error: 'OUT_OF_STOCK',
              message: `Sản phẩm "${product?.name || item.productId}" không đủ hàng. Còn ${product?.stock || 0}, yêu cầu ${item.quantity}`
            });
          }
        } catch (productError) {
          console.error(`Error checking stock for product ${item.productId}:`, productError.message);
          await conn.rollback();
          conn.release();
          return res.status(500).json({
            error: 'STOCK_CHECK_FAILED',
            message: 'Không thể kiểm tra tồn kho. Vui lòng thử lại.'
          });
        }
      }
      
      console.log(`✅ Stock availability checked for COD order (user ${userId})`);
    }
    
    // Fetch product details for order_items using circuit breaker
    const productDetails = await Promise.all(
      items.map(async (it) => {
        try {
          const data = await catalogBreaker.fire(`${CATALOG_SERVICE_URL}/catalog/products/${it.productId}`);
          if (data.error === 'SERVICE_UNAVAILABLE') {
            return { ...it, product: null };
          }
          return { ...it, product: data };
        } catch (e) {
          console.error(`Error fetching product ${it.productId}:`, e.message);
          return { ...it, product: null };
        }
      })
    );
    
    // Tất cả orders đều bắt đầu với PENDING
    // Stock chỉ trừ khi thanh toán thành công:
    // - COD: Sau khi xác nhận OTP
    // - VNPay: Sau khi nhận IPN callback
    const initialStatus = 'PENDING';
    const initialPaymentStatus = 'PENDING';
    
    const [orderResult] = await conn.query(
      `INSERT INTO orders 
        (user_id, status, payment_method, payment_status, total_cents, discount_cents, shipping_fee_cents,
         shipping_name, shipping_phone, shipping_email, 
         shipping_province, shipping_district, shipping_ward, shipping_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, initialStatus, paymentMethod, initialPaymentStatus, totalCents, discountCents, shippingFeeCents,
       shipping.name, shipping.phone, shipping.email,
       shipping.province || '', shipping.district || '', shipping.ward || '', shipping.address]
    );
    
    const orderId = orderResult.insertId;
    
    for (const it of productDetails) {
      const productName = it.product?.name || 'Sản phẩm';
      const productImage = it.product?.images?.[0]?.url || it.product?.image_url || null;
      const subtotal = it.priceCents * it.quantity;
      
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, product_name, product_image, quantity, price_cents, subtotal_cents) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [orderId, it.productId, productName, productImage, it.quantity, it.priceCents, subtotal]
      );
    }
    
    await conn.commit();
    return res.status(201).json({ 
      orderId, 
      totalCents, 
      subtotalCents,
      shippingFeeCents,
      discountCents 
    });
  } catch (e) {
    await conn.rollback();
    console.error('Checkout error:', e);
    return res.status(500).json({ error: 'Server error', details: e.message });
  } finally {
    conn.release();
  }
}

app.post('/orders/:orderId/pay', async (req, res) => {
  const { orderId } = req.params;
  const { intentId } = req.body;
  if (!intentId) return res.status(400).json({ error: 'Missing intentId' });
  try {
    // Confirm payment using circuit breaker
    const result = await paymentBreaker.fire(`${PAYMENT_SERVICE_URL}/payment/intents/${intentId}/confirm`, {});
    if (result.error === 'SERVICE_UNAVAILABLE') {
      return res.status(503).json({ 
        error: 'SERVICE_UNAVAILABLE',
        message: 'Dịch vụ thanh toán tạm thời không khả dụng. Vui lòng thử lại sau.'
      });
    }
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['PAID', orderId]);
    return res.json({ ok: true });
  } catch (e) {
    console.error('Payment confirm error:', e.message);
    return res.status(500).json({ 
      error: 'PAYMENT_FAILED',
      message: 'Xác nhận thanh toán thất bại. Vui lòng liên hệ hỗ trợ.'
    });
  }
});

app.get('/orders/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const userIdHeader = req.headers['x-user-id'];
  const userId = userIdHeader ? parseInt(userIdHeader, 10) : null;
  const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, userId]);
  if (!order) return res.status(404).json({ error: 'Not found' });
  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  // Enrich with product info from catalog service (batched) using circuit breaker
  try {
    const productIds = [...new Set(items.map((it) => it.product_id))];
    const details = await Promise.all(
      productIds.map(async (pid) => {
        try {
          const data = await catalogBreaker.fire(`${CATALOG_SERVICE_URL}/catalog/products/${pid}`);
          return [pid, data];
        } catch (e) {
          return [pid, null];
        }
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
  const [orders] = await pool.query(
    'SELECT id, status, payment_method, payment_status, total_cents, discount_cents, shipping_fee_cents, created_at FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50',
    [userId]
  );
  return res.json(orders);
});

// Validate coupon code
app.get('/orders/coupons/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const [[c]] = await pool.query(
      'SELECT code, type, value FROM coupons WHERE UPPER(code) = UPPER(?) AND active = 1 AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW())',
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
  const { status } = req.query;
  let query = 'SELECT * FROM orders';
  const params = [];
  
  if (status && status !== 'ALL') {
    query += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY id DESC LIMIT 200';
  const [orders] = await pool.query(query, params);
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
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const allowed = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    
    // Get current order status and items
    const [[currentOrder]] = await pool.query('SELECT status FROM orders WHERE id = ?', [orderId]);
    if (!currentOrder) return res.status(404).json({ error: 'Order not found' });
    
    const [items] = await pool.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId]);
    
    // ⚠️ Stock changes handled by payment confirmation endpoints:
    // - COD: /orders/confirm-cod (after OTP verification)
    // - VNPay: /orders/confirm-vnpay (after payment callback)
    //
    // Admin status update logic:
    // 1. ANY_STATUS → CANCELLED: PHẢI restore stock (vì stock đã trừ ngay khi checkout)
    // 2. DELIVERED → CANCELLED: Không cho phép (đã giao hàng thành công)
    
    // Prevent cancelling delivered orders
    if (status === 'CANCELLED' && currentOrder.status === 'DELIVERED') {
      return res.status(400).json({ 
        error: 'CANNOT_CANCEL_DELIVERED',
        message: 'Không thể hủy đơn hàng đã giao thành công' 
      });
    }
    
    // ✅ RESTORE STOCK khi admin cancel:
    // - VNPay: Restore cho TẤT CẢ status (PENDING/CONFIRMED/SHIPPING) vì đã trừ khi tạo
    // - COD PENDING: Không restore (chưa trừ)
    // - COD CONFIRMED/SHIPPING: Restore (đã trừ sau OTP)
    if (status === 'CANCELLED') {
      const needRestore = (currentOrder.payment_method === 'VNPAY') || 
                          (currentOrder.payment_method === 'COD' && 
                           (currentOrder.status === 'CONFIRMED' || currentOrder.status === 'SHIPPING'));
      
      if (needRestore && items.length > 0) {
        try {
          const releaseItems = items.map(item => ({ 
            productId: item.product_id, 
            quantity: item.quantity 
          }));
          await httpClient.post(`${CATALOG_SERVICE_URL}/catalog/inventory/release`, {
            items: releaseItems
          });
          console.log(`✅ Admin cancelled ${currentOrder.payment_method} ${currentOrder.status} order #${orderId} - Restored ${items.length} products`);
        } catch (e) {
          console.error(`Failed to restore stock:`, e.message);
          return res.status(500).json({ 
            error: 'STOCK_RESTORE_FAILED',
            message: 'Không thể hoàn lại stock. Vui lòng thử lại.' 
          });
        }
      } else {
        console.log(`ℹ️ Admin cancelled ${currentOrder.payment_method} ${currentOrder.status} order #${orderId} - No stock to restore`);
      }
    }
    
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Confirm COD order after OTP verification (called by auth-service)
app.post('/orders/confirm-cod', async (req, res) => {
  const userIdHeader = req.headers['x-user-id'];
  const userId = userIdHeader ? parseInt(userIdHeader, 10) : null;
  
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  // Find the latest PENDING COD order for this user
  let order, orderId;
  try {
    const [[orderData]] = await pool.query(
      `SELECT id FROM orders 
       WHERE user_id = ? AND payment_method = 'COD' AND status = 'PENDING' 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    
    if (!orderData) {
      return res.status(404).json({ error: 'No pending COD order found' });
    }
    
    order = orderData;
    orderId = order.id;
  } catch (error) {
    console.error('Find order error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
  
  // 🔒 CRITICAL: Lock order để prevent race condition khi 2 users confirm cùng lúc
  const lockKey = `order:confirm:${orderId}`;
  const lockToken = await lockManager.acquireLock(lockKey, 10000);
  
  if (!lockToken) {
    console.log(`⏳ Order #${orderId} is being processed by another request`);
    return res.status(409).json({ error: 'Order is being processed' });
  }
  
  try {
    // Double-check order status (có thể đã bị process bởi request khác)
    const [[currentOrder]] = await pool.query(
      'SELECT status FROM orders WHERE id = ?',
      [orderId]
    );
    
    if (!currentOrder || currentOrder.status !== 'PENDING') {
      console.log(`⚠️ Order #${orderId} already processed (status: ${currentOrder?.status})`);
      await lockManager.releaseLock(lockKey, lockToken);
      return res.status(400).json({ 
        error: 'Order already processed',
        status: currentOrder?.status 
      });
    }
    
    // Get order items
    const [items] = await pool.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
      [orderId]
    );
    
    // Reserve inventory (trừ stock) - ĐÃ CÓ LOCK BÊN TRONG
    if (items.length > 0) {
      try {
        const reservePayload = {
          items: items.map(item => ({
            productId: item.product_id,
            quantity: item.quantity
          }))
        };
        
        const reserveResponse = await httpClient.post(
          `${CATALOG_SERVICE_URL}/catalog/inventory/reserve`,
          reservePayload
        );
        
        if (!reserveResponse.data.success) {
          // Out of stock - cancel order
          await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['CANCELLED', orderId]);
          await lockManager.releaseLock(lockKey, lockToken);
          console.log(`❌ Order #${orderId} cancelled - Out of stock`);
          return res.status(400).json({ 
            error: 'OUT_OF_STOCK',
            message: 'Sản phẩm đã hết hàng. Đơn hàng đã bị hủy.' 
          });
        }
        
        console.log(`✅ Reserved inventory for COD order #${orderId}`);
      } catch (inventoryError) {
        console.error('Failed to reserve inventory:', inventoryError.message);
        await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['CANCELLED', orderId]);
        await lockManager.releaseLock(lockKey, lockToken);
        return res.status(500).json({ error: 'Failed to reserve inventory' });
      }
    }
    
    // Update order status to CONFIRMED and payment status to PAID
    await pool.query(
      'UPDATE orders SET status = ?, payment_status = ? WHERE id = ?',
      ['CONFIRMED', 'PAID', orderId]
    );
    
    console.log(`✅ COD order #${orderId} confirmed and stock reserved`);
    await lockManager.releaseLock(lockKey, lockToken);
    return res.json({ ok: true, orderId });
    
  } catch (error) {
    console.error('Confirm COD order error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Confirm VNPay order after payment success (called by payment-service)
app.post('/orders/confirm-vnpay', async (req, res) => {
  const { orderId, transactionNo, amount, bankCode } = req.body;
  
  if (!orderId) {
    return res.status(400).json({ error: 'Missing orderId' });
  }
  
  // 🔒 CRITICAL: Lock order để prevent duplicate IPN processing
  const lockKey = `order:confirm:${orderId}`;
  const lockToken = await lockManager.acquireLock(lockKey, 10000);
  
  if (!lockToken) {
    console.log(`⏳ Order #${orderId} is being processed by another request`);
    return res.status(409).json({ error: 'Order is being processed' });
  }
  
  try {
    // Find the order and check current status
    const [[order]] = await pool.query(
      'SELECT id, status, payment_method FROM orders WHERE id = ?',
      [orderId]
    );
    
    if (!order) {
      await lockManager.releaseLock(lockKey, lockToken);
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Only process if order is still PENDING
    if (order.status !== 'PENDING') {
      console.log(`⚠️ Order #${orderId} already processed (status: ${order.status})`);
      await lockManager.releaseLock(lockKey, lockToken);
      return res.json({ ok: true, message: 'Order already processed' });
    }
    
    // ℹ️ Stock đã được trừ khi tạo order VNPay
    // Không cần reserve lại ở đây, chỉ cần update status thành CONFIRMED
    
    // Update order status to CONFIRMED and payment status to PAID
    await pool.query(
      'UPDATE orders SET status = ?, payment_status = ? WHERE id = ?',
      ['CONFIRMED', 'PAID', orderId]
    );
    
    console.log(`✅ VNPay order #${orderId} confirmed (TxnNo: ${transactionNo})`);
    await lockManager.releaseLock(lockKey, lockToken);
    return res.json({ ok: true, orderId });
    
  } catch (error) {
    console.error('Confirm VNPay order error:', error);
    await lockManager.releaseLock(lockKey, lockToken);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Cancel VNPay order after payment failure (called by payment-service)
app.post('/orders/:orderId/cancel-vnpay', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log(`🔍 Attempting to cancel VNPay order #${orderId}`);
    
    // Get order items to restore stock
    const [items] = await pool.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
      [orderId]
    );
    
    console.log(`📦 Found ${items.length} items to restore for order #${orderId}:`, items);
    
    // Restore stock if any items exist
    if (items.length > 0) {
      try {
        const releasePayload = {
          items: items.map(item => ({
            productId: item.product_id,
            quantity: item.quantity
          }))
        };
        
        console.log(`🔄 Calling catalog-service to release stock:`, releasePayload);
        
        const releaseResponse = await httpClient.post(
          `${CATALOG_SERVICE_URL}/catalog/inventory/release`,
          releasePayload
        );
        
        console.log(`✅ Stock restored for cancelled VNPay order #${orderId}`, releaseResponse.data);
      } catch (releaseError) {
        console.error(`❌ Failed to restore stock for order #${orderId}:`, releaseError.message);
        if (releaseError.response) {
          console.error(`Response status: ${releaseError.response.status}`, releaseError.response.data);
        }
        // Continue with cancellation even if stock restoration fails
      }
    }
    
    // Update order status to CANCELLED
    await pool.query(
      'UPDATE orders SET status = ?, payment_status = ? WHERE id = ?',
      ['CANCELLED', 'FAILED', orderId]
    );
    
    console.log(`❌ VNPay order #${orderId} cancelled due to payment failure`);
    return res.json({ ok: true });
    
  } catch (error) {
    console.error('Cancel VNPay order error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// User cancel order (only PENDING status)
app.patch('/orders/:orderId/cancel', async (req, res) => {
  try {
    const { orderId } = req.params;
    const userIdHeader = req.headers['x-user-id'];
    const userId = userIdHeader ? parseInt(userIdHeader, 10) : null;
    
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    // Check if order exists and belongs to user
    const [[order]] = await pool.query('SELECT id, user_id, status FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    if (order.user_id !== userId) return res.status(403).json({ error: 'Không có quyền hủy đơn hàng này' });
    
    // Allow cancel if status is PENDING or CONFIRMED
    if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
      return res.status(400).json({ error: 'Chỉ có thể hủy đơn hàng đang chờ xác nhận hoặc đã xác nhận (chưa ship)' });
    }
    
    // Get payment method to determine if stock needs restoration
    const [[orderDetails]] = await pool.query(
      'SELECT payment_method FROM orders WHERE id = ?', 
      [orderId]
    );
    
    // ✅ RESTORE STOCK:
    // - VNPay PENDING: Phải restore (đã trừ khi tạo order)
    // - VNPay CONFIRMED: Phải restore (đã trừ khi tạo order)
    // - COD PENDING: Không restore (chưa trừ stock)
    // - COD CONFIRMED: Phải restore (đã trừ sau OTP)
    const needRestore = (orderDetails.payment_method === 'VNPAY') || 
                        (orderDetails.payment_method === 'COD' && order.status === 'CONFIRMED');
    
    if (needRestore) {
      const [items] = await pool.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId]);
      
      if (items.length > 0) {
        try {
          const releaseItems = items.map(item => ({ 
            productId: item.product_id, 
            quantity: item.quantity 
          }));
          await httpClient.post(`${CATALOG_SERVICE_URL}/catalog/inventory/release`, {
            items: releaseItems
          });
          console.log(`✅ Restored stock for cancelled ${orderDetails.payment_method} order #${orderId} (${order.status})`);
        } catch (e) {
          console.error(`❌ Failed to restore stock for order #${orderId}:`, e.message);
          // Continue cancellation even if stock restoration fails
        }
      }
    } else {
      console.log(`ℹ️ Order #${orderId} is COD PENDING - no stock to restore`);
    }
    
    // Update status to CANCELLED (keep payment_status as is: PENDING or FAILED)
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['CANCELLED', orderId]);
    
    return res.json({ ok: true, message: 'Đã hủy đơn hàng thành công' });
  } catch (error) {
    console.error('Cancel order error:', error);
    return res.status(500).json({ error: 'Lỗi khi hủy đơn hàng' });
  }
});

// Admin: Get all coupons
app.get('/admin/coupons', async (req, res) => {
  try {
    const [coupons] = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
    return res.json(coupons);
  } catch (error) {
    console.error('Get coupons error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Create coupon
app.post('/admin/coupons', async (req, res) => {
  try {
    const { code, type, value, active, startDate, endDate } = req.body;
    if (!code || !type) return res.status(400).json({ error: 'Missing required fields' });
    
    const [result] = await pool.query(
      'INSERT INTO coupons (code, type, value, active, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
      [code, type, value || 0, active ? 1 : 0, startDate || null, endDate || null]
    );
    return res.status(201).json({ id: result.insertId, code });
  } catch (error) {
    console.error('Create coupon error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Mã giảm giá đã tồn tại' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Update coupon
app.put('/admin/coupons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { code, type, value, active, startDate, endDate } = req.body;
    
    await pool.query(
      'UPDATE coupons SET code = ?, type = ?, value = ?, active = ?, start_date = ?, end_date = ? WHERE id = ?',
      [code, type, value || 0, active ? 1 : 0, startDate || null, endDate || null, id]
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error('Update coupon error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Delete coupon
app.delete('/admin/coupons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM coupons WHERE id = ?', [id]);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Delete coupon error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Delete expired coupons immediately
app.delete('/admin/coupons/expired/bulk', async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM coupons WHERE end_date < NOW()'
    );
    return res.json({ ok: true, deleted: result.affectedRows });
  } catch (error) {
    console.error('Delete expired coupons error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Auto-disable expired coupons
app.post('/admin/coupons/auto-disable', async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE coupons SET active = 0 WHERE active = 1 AND end_date < NOW()'
    );
    return res.json({ ok: true, disabled: result.affectedRows });
  } catch (error) {
    console.error('Auto-disable coupons error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Public: Validate coupon (for frontend preview)
app.post('/coupons/validate', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing coupon code' });
    
    const [[coupon]] = await pool.query(
      'SELECT * FROM coupons WHERE code = ? AND active = 1 AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW())',
      [code]
    );
    
    if (!coupon) {
      return res.status(400).json({ error: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' });
    }
    
    return res.json({ 
      valid: true, 
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value
      }
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Cron job: Auto-disable expired coupons (runs every hour)
setInterval(async () => {
  try {
    const [result] = await pool.query(
      'UPDATE coupons SET active = 0 WHERE active = 1 AND end_date < CURDATE()'
    );
    if (result.affectedRows > 0) {
      console.log(`[CRON] Auto-disabled ${result.affectedRows} expired coupons`);
    }
  } catch (error) {
    console.error('[CRON] Auto-disable coupons error:', error);
  }
}, 3600000); // Run every hour

// Cron job: Auto-delete expired coupons (runs every hour)
setInterval(async () => {
  try {
    const [result] = await pool.query(
      'DELETE FROM coupons WHERE end_date < NOW()'
    );
    if (result.affectedRows > 0) {
      console.log(`[CRON] Auto-deleted ${result.affectedRows} expired coupons`);
    }
  } catch (error) {
    console.error('[CRON] Auto-delete expired coupons error:', error);
  }
}, 5000); // Run every 5 seconds

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      service: 'order-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      service: 'order-service',
      error: error.message 
    });
  }
});

// Connect to Redis on startup
lockManager.connect().then(() => {
  console.log('✅ Order service Redis lock manager ready');
}).catch(err => {
  console.error('❌ Redis connection failed:', err);
  console.warn('⚠️ Service will run WITHOUT distributed locks');
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Order service listening on ${PORT}`);
});


