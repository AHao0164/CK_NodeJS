import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import mysql from 'mysql2/promise';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import CircuitBreaker from 'opossum';
import RedisLockManager from '../shared/RedisLockManager.js';
import RedisEventBus from '../shared/RedisEventBus.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Initialize Redis Lock Manager
const lockManager = new RedisLockManager();

// Initialize Redis Event Bus for async communication
const eventBus = new RedisEventBus();

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
    await ensureColumn('orders', 'points_used', 'points_used INT DEFAULT 0');
    await ensureColumn('orders', 'points_discount_cents', 'points_discount_cents INT DEFAULT 0');
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
    
    // Add max_usage, times_used, max_usage_per_user columns if not exists
    await ensureColumn('coupons', 'max_usage', 'max_usage INT DEFAULT NULL');
    await ensureColumn('coupons', 'times_used', 'times_used INT DEFAULT 0');
    await ensureColumn('coupons', 'max_usage_per_user', 'max_usage_per_user INT DEFAULT NULL');
    
    // Alter existing DATE columns to DATETIME
    await conn.query(`ALTER TABLE coupons MODIFY COLUMN start_date DATETIME`).catch(() => {});
    await conn.query(`ALTER TABLE coupons MODIFY COLUMN end_date DATETIME`).catch(() => {});

    // Delete old coupons with invalid format (not 5 characters)
    await conn.query("DELETE FROM coupons WHERE code IN ('SUMMER10', 'SALE100K', 'FREESHIP', 'SUMMER2025')").catch(() => {});
    
    // Seed new coupons with correct 5-character alphanumeric format
    // Format: 5 characters (A-Z, 0-9), max_usage: 1-10, no expiration date (NULL)
    // Note: For 'fixed' type, value is stored as VND * 100 (to match admin app behavior)
    // Example: 10,000 VND → stored as 1,000,000
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, start_date, end_date, max_usage, times_used) VALUES ('SUMMR','percentage',10,1,NULL,NULL,10,0)");
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, start_date, end_date, max_usage, times_used) VALUES ('SALE1','fixed',1000000,1,NULL,NULL,5,0)"); // 10,000 VND
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, start_date, end_date, max_usage, times_used) VALUES ('SHIP0','freeship',0,1,NULL,NULL,10,0)");
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, start_date, end_date, max_usage, times_used) VALUES ('NEW15','percentage',15,1,NULL,NULL,8,0)");
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, start_date, end_date, max_usage, times_used) VALUES ('WELCM','fixed',500000,1,NULL,NULL,10,0)"); // 5,000 VND
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, start_date, end_date, max_usage, times_used) VALUES ('VIP20','percentage',20,1,NULL,NULL,3,0)");
    await conn.query("INSERT IGNORE INTO coupons (code, type, value, active, start_date, end_date, max_usage, times_used) VALUES ('FLASH','fixed',2000000,1,NULL,NULL,5,0)"); // 20,000 VND
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

  console.log('🔵 Calling ensure-guest with payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await httpClient.post(`${AUTH_SERVICE_URL}/auth/ensure-guest`, payload);
    console.log('🔵 ensure-guest response:', JSON.stringify(response.data, null, 2));
    
    if (!response.data || !response.data.id) {
      throw new Error('Failed to ensure guest account: No user ID returned');
    }
    return response.data.id;
  } catch (error) {
    console.error('❌ ensure-guest API error:', error.message);
    console.error('   Response status:', error.response?.status);
    console.error('   Response data:', error.response?.data);
    throw new Error(`Failed to ensure guest account: ${error.message}`);
  }
}

// Helper: Record order status change in history
async function recordStatusHistory(orderId, oldStatus, newStatus, changedBy = 'SYSTEM', notes = null) {
  try {
    await pool.query(
      'INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes) VALUES (?, ?, ?, ?, ?)',
      [orderId, oldStatus, newStatus, changedBy, notes]
    );
    
    // 📤 Publish order.status_changed event
    try {
      await eventBus.publish('order.status_changed', {
        orderId,
        oldStatus,
        newStatus,
        changedBy,
        notes,
        timestamp: new Date().toISOString()
      });
      console.log(`📤 Published order.status_changed event for order #${orderId}: ${oldStatus} → ${newStatus}`);
    } catch (error) {
      console.error('Failed to publish order.status_changed event:', error.message);
      // Non-critical, don't fail the operation
    }
  } catch (error) {
    // Log error but don't fail the main operation
    console.error(`Failed to record status history for order ${orderId}:`, error.message);
  }
}

// Helper: Send order confirmation email
async function sendOrderConfirmationEmail(orderId, orderData) {
  try {
    if (!orderData.shipping_email) {
      console.log(`⚠️ No email for order #${orderId}, skipping confirmation email`);
      return;
    }

    await httpClient.post(`${AUTH_SERVICE_URL}/auth/send-order-confirmation`, {
      orderId,
      email: orderData.shipping_email,
      orderData
    });
    console.log(`✅ Confirmation email sent for order #${orderId}`);
  } catch (error) {
    // Log error but don't fail the main operation
    console.error(`Failed to send confirmation email for order #${orderId}:`, error.message);
  }
}

// Helper: Calculate and add loyalty points (10% of order total)
// Example: 1,000,000 VND = 100 points = 100,000 VND value
async function addLoyaltyPoints(userId, orderId, orderTotalCents) {
  try {
    if (!userId) {
      console.log(`⚠️ No userId for order #${orderId}, skipping loyalty points`);
      return;
    }

    // Calculate points: 10% of order total
    // 1 point = 1,000 VND
    // Example: 1,000,000 VND → 10% = 100,000 VND = 100 points
    // Note: orderTotalCents is in VND (despite the name), not actual cents
    const pointsEarned = Math.floor((orderTotalCents * 0.1) / 1000); // 10% of total, then convert to points (1 point = 1,000 VND)
    
    if (pointsEarned <= 0) {
      console.log(`ℹ️ No points to add for order #${orderId} (total: ${orderTotalCents} VND)`);
      return;
    }

    // Update user points in auth-service
    try {
      await httpClient.post(`${AUTH_SERVICE_URL}/auth/add-loyalty-points`, {
        userId,
        orderId,
        points: pointsEarned,
        description: `Tích lũy từ đơn hàng #${orderId}`
      });
      console.log(`✅ Added ${pointsEarned} loyalty points to user ${userId} for order #${orderId}`);
    } catch (error) {
      console.error(`Failed to add loyalty points:`, error.message);
    }
  } catch (error) {
    console.error(`Error in addLoyaltyPoints for order #${orderId}:`, error.message);
  }
}

app.post('/orders/checkout', async (req, res) => {
  const userIdHeader = req.headers['x-user-id'];
  const authenticatedUserId = userIdHeader ? parseInt(userIdHeader, 10) : null;
  const { items, shipping = {}, paymentMethod = 'COD', couponCode, pointsToUse } = req.body;
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
      console.log('🔵 Creating guest account for:', shipping.email);
      console.log('   Shipping data:', JSON.stringify(shipping, null, 2));
      
      // Ensure shipping object has all required fields for ensureUserForGuest
      const guestShippingData = {
        email: shipping.email,
        name: shipping.name,
        phone: shipping.phone,
        province: shipping.province || shipping.city || null,
        ward: shipping.ward || null,
        address: shipping.address || null
      };
      
      console.log('   Guest shipping data:', JSON.stringify(guestShippingData, null, 2));
      
      userId = await ensureUserForGuest(guestShippingData);
      console.log('✅ Guest account created/reused, userId:', userId);
    } catch (err) {
      console.error('❌ ensureUserForGuest error:', err);
      console.error('   Error message:', err.message);
      console.error('   Error response:', err.response?.data);
      console.error('   Error stack:', err.stack);
      return res.status(500).json({ 
        error: 'GUEST_ACCOUNT_ERROR',
        message: 'Không thể tạo tài khoản cho khách. Vui lòng thử lại hoặc đăng nhập.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
  
  // 🔒 CRITICAL: Prevent duplicate orders from multiple clicks
  // Lock by userId to ensure only one order creation at a time per user
  const orderLockKey = `order:create:${userId}`;
  
  console.log('🔵 Starting checkout process:', {
    userId,
    itemCount: items.length,
    paymentMethod,
    hasCoupon: !!couponCode,
    pointsToUse
  });
  
  try {
    const result = await lockManager.withLock(orderLockKey, async () => {
      console.log('🔵 Processing checkout inside lock...');
      return await processCheckout(userId, items, shipping, paymentMethod, couponCode, pointsToUse, pool, res);
    }, { ttlSeconds: 30, maxRetries: 1, throwOnFailure: false });
    
    if (!result) {
      console.error('❌ Checkout returned null/undefined');
      return res.status(500).json({ 
        error: 'CHECKOUT_FAILED',
        message: 'Không thể tạo đơn hàng. Vui lòng thử lại.'
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Order creation error:', error);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    
    // If it's a lock error, return 429
    if (error.message && error.message.includes('lock')) {
      return res.status(429).json({ 
        error: 'ORDER_IN_PROGRESS',
        message: 'Đơn hàng của bạn đang được xử lý. Vui lòng không click liên tục.' 
      });
    }
    
    // Otherwise, return 500
    return res.status(500).json({ 
      error: 'CHECKOUT_ERROR',
      message: 'Có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Extracted checkout logic for cleaner lock handling
async function processCheckout(userId, items, shipping, paymentMethod, couponCode, pointsToUse, pool, res) {
  
  // Note: Variable names use "*Cents" suffix but values are actually in VND (not cents)
  // This is a legacy naming convention - all monetary values in this service are in VND
  const shippingFeeCents = 30000; // 30,000 VND (not 30,000 cents)
  const subtotalCents = items.reduce((sum, it) => sum + (it.priceCents * it.quantity), 0); // All in VND
  let discountCents = 0; // In VND
  let appliedCoupon = null;
  let pointsDiscountCents = 0; // Discount from loyalty points (in VND)
  let pointsUsed = 0; // Points actually used
  
  // 🔒 CRITICAL: Coupon lock with SELECT FOR UPDATE to prevent over-usage
  if (couponCode) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // Validate code format: 5-character alphanumeric
      const normalizedCode = couponCode.toUpperCase().trim();
      if (!/^[A-Z0-9]{5}$/.test(normalizedCode)) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ error: 'INVALID_COUPON', details: ['Mã giảm giá phải có đúng 5 ký tự chữ và số'] });
      }
      
      // Use pessimistic lock with SELECT FOR UPDATE
      const [[c]] = await conn.query(
        'SELECT * FROM coupons WHERE code = ? AND active = 1 AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW()) FOR UPDATE',
        [normalizedCode]
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
          [userId, normalizedCode]
        );
        if (usage && usage.count >= c.max_usage_per_user) {
          await conn.rollback();
          conn.release();
          return res.status(400).json({ error: 'COUPON_USER_LIMIT', details: ['Bạn đã dùng mã này quá số lần cho phép'] });
        }
      }
      
      appliedCoupon = c;
      // Store normalized code for later use
      appliedCoupon.normalizedCode = normalizedCode;
      
      if (c.type === 'percentage') {
        discountCents = Math.floor((subtotalCents * c.value) / 100);
      } else if (c.type === 'fixed') {
        discountCents = Math.min(subtotalCents, c.value);
      } else if (c.type === 'freeship') {
        // Freeship: discount = shipping fee (will be applied later)
        discountCents = shippingFeeCents;
      }
      
      // Increment usage counter (will be committed with order)
      await conn.query(
        'UPDATE coupons SET times_used = times_used + 1 WHERE id = ?',
        [c.id]
      );
      
      await conn.commit();
      conn.release();
    } catch (e) {
      if (conn) {
        try {
          await conn.rollback();
        } catch (rollbackErr) {
          console.error('Rollback error:', rollbackErr);
        }
        try {
          conn.release();
        } catch (releaseErr) {
          console.error('Release error:', releaseErr);
        }
      }
      console.error('❌ Coupon validation error:', e);
      console.error('   Error message:', e.message);
      console.error('   Error code:', e.code);
      console.error('   Error stack:', e.stack);
      return res.status(500).json({ 
        error: 'COUPON_ERROR', 
        details: ['Lỗi xử lý mã giảm giá'],
        message: process.env.NODE_ENV === 'development' ? e.message : 'Lỗi xử lý mã giảm giá'
      });
    }
  }
  
  // Handle loyalty points usage (before order creation to calculate correct total)
  // Note: We'll update the orderId in points history after order is created
  if (pointsToUse && pointsToUse > 0 && userId) {
    try {
      const pointsResponse = await httpClient.post(
        `${AUTH_SERVICE_URL}/auth/use-loyalty-points`,
        { pointsToUse, orderId: null }, // orderId will be updated after order creation
        { headers: { 'x-user-id': userId.toString() } }
      );
      
      if (pointsResponse.data && pointsResponse.data.ok) {
        pointsDiscountCents = pointsResponse.data.discountAmount || 0; // In VND
        pointsUsed = pointsResponse.data.pointsUsed || 0;
        console.log(`✅ Used ${pointsUsed} points (${pointsDiscountCents} VND discount) for user ${userId}`);
      }
    } catch (error) {
      console.error('Failed to use loyalty points:', error.response?.data || error.message);
      // If points usage fails, return error to frontend
      return res.status(400).json({ 
        error: 'POINTS_ERROR', 
        details: ['Không thể sử dụng điểm thưởng. Vui lòng thử lại.'] 
      });
    }
  }
  
  // Calculate total: subtotal + shipping - coupon discount - points discount
  // Note: For freeship coupon, discountCents = shippingFeeCents, so shipping is effectively free
  const totalCents = subtotalCents + shippingFeeCents - discountCents - pointsDiscountCents; // All values in VND
  
  console.log('💰 Order calculation:', {
    subtotalCents,
    shippingFeeCents,
    discountCents,
    pointsDiscountCents,
    totalCents,
    couponCode: appliedCoupon?.code || null,
    couponType: appliedCoupon?.type || null,
    userId,
    shippingFields: {
      name: shipping.name,
      phone: shipping.phone,
      email: shipping.email,
      province: shipping.province,
      district: shipping.district,
      ward: shipping.ward,
      address: shipping.address
    }
  });
  
  const conn = await pool.getConnection();
  
  try {
    await conn.beginTransaction();
    
    // 🔒 STOCK LOGIC theo payment method:
    // - VNPay: Chỉ CHECK stock khi checkout, trừ sau khi thanh toán thành công
    // - COD: Chỉ CHECK stock khi checkout, trừ sau khi xác nhận OTP
    // Stock chỉ được trừ khi thanh toán xong, không trừ khi thêm vào giỏ hàng
    
    // ✅ Check stock availability for all items BEFORE creating order
    // This ensures customer cannot checkout if cart quantity exceeds available stock
    const stockErrors = [];
    for (const item of items) {
      try {
        const product = await catalogBreaker.fire(`${CATALOG_SERVICE_URL}/catalog/products/${item.productId}`);
        
        // Handle circuit breaker errors
        if (!product || product.error === 'SERVICE_UNAVAILABLE') {
          stockErrors.push(`Không thể kiểm tra tồn kho cho sản phẩm #${item.productId}`);
          continue;
        }
        
        // Check if product exists
        if (!product || !product.id) {
          stockErrors.push(`Sản phẩm #${item.productId} không tồn tại`);
          continue;
        }
        
        // Get stock - can be from product.stock or inventory table
        const availableStock = product.stock !== undefined ? (product.stock || 0) : 0;
        const requestedQuantity = item.quantity || 0;
        
        console.log(`🔍 Stock check for product #${item.productId} (${product.name || 'N/A'}): available=${availableStock}, requested=${requestedQuantity}`);
        
        if (availableStock < requestedQuantity) {
          stockErrors.push(
            `"${product.name || `Sản phẩm #${item.productId}`}" không đủ hàng. ` +
            `Còn ${availableStock} sản phẩm, bạn yêu cầu ${requestedQuantity}`
          );
        }
      } catch (productError) {
        console.error(`❌ Error checking stock for product ${item.productId}:`, productError.message);
        console.error('   Error stack:', productError.stack);
        stockErrors.push(`Không thể kiểm tra tồn kho cho sản phẩm #${item.productId}`);
      }
    }
    
    // If any stock errors, return error with details
    if (stockErrors.length > 0) {
      await conn.rollback();
      conn.release();
      console.log(`❌ Checkout blocked - Stock errors:`, stockErrors);
      return res.status(400).json({
        error: 'OUT_OF_STOCK',
        message: 'Một số sản phẩm trong giỏ hàng không đủ số lượng',
        details: stockErrors
      });
    }
    
    console.log(`✅ All stock checks passed for ${items.length} items`);
    
    console.log(`✅ Stock availability checked for ${paymentMethod} order (user ${userId}) - stock will be deducted after payment confirmation`);
    
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
    // - COD: Sau khi xác nhận OTP (trong /orders/confirm-cod)
    // - VNPay: Sau khi nhận IPN callback (trong /orders/confirm-vnpay)
    // KHÔNG trừ stock khi checkout, chỉ check availability
    const initialStatus = 'PENDING';
    const initialPaymentStatus = 'PENDING';
    
    // Ensure all shipping fields are strings (not undefined/null)
    const shippingProvince = (shipping.province || shipping.city || '').toString();
    const shippingDistrict = (shipping.district || shipping.city || '').toString();
    const shippingWard = (shipping.ward || '').toString();
    const shippingAddress = (shipping.address || '').toString();
    const shippingName = (shipping.name || '').toString();
    const shippingPhone = (shipping.phone || '').toString();
    const shippingEmail = (shipping.email || '').toString();
    const couponCodeValue = appliedCoupon ? (appliedCoupon.normalizedCode || appliedCoupon.code || '').toString() : null;
    
    console.log('📝 Inserting order with values:', {
      userId,
      totalCents,
      discountCents,
      shippingFeeCents,
      couponCode: couponCodeValue,
      shipping: {
        name: shippingName,
        phone: shippingPhone,
        email: shippingEmail,
        province: shippingProvince,
        district: shippingDistrict,
        ward: shippingWard,
        address: shippingAddress
      }
    });
    
    const [orderResult] = await conn.query(
      `INSERT INTO orders 
        (user_id, status, payment_method, payment_status, total_cents, discount_cents, shipping_fee_cents,
         points_used, points_discount_cents, coupon_code,
         shipping_name, shipping_phone, shipping_email, 
         shipping_province, shipping_district, shipping_ward, shipping_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, initialStatus, paymentMethod, initialPaymentStatus, totalCents, discountCents, shippingFeeCents,
       pointsUsed, pointsDiscountCents, couponCodeValue,
       shippingName, shippingPhone, shippingEmail,
       shippingProvince, shippingDistrict, shippingWard, shippingAddress]
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
    
    // Record initial status (PENDING) in history
    await conn.query(
      'INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes) VALUES (?, ?, ?, ?, ?)',
      [orderId, null, 'PENDING', 'SYSTEM', 'Đơn hàng được tạo']
    );
    
    await conn.commit();
    
    // 📤 Publish order.created event
    try {
      await eventBus.publish('order.created', {
        orderId,
        userId,
        status: initialStatus,
        paymentMethod,
        totalCents,
        discountCents,
        shippingFeeCents,
        items: productDetails.map(it => ({
          productId: it.productId,
          quantity: it.quantity,
          priceCents: it.priceCents
        })),
        createdAt: new Date().toISOString()
      });
      console.log(`📤 Published order.created event for order #${orderId}`);
    } catch (error) {
      console.error('Failed to publish order.created event:', error.message);
      // Non-critical, don't fail the order
    }
    
    // Update orderId in loyalty points history (if points were used)
    if (pointsUsed > 0 && userId) {
      try {
        // Get the latest points history entry for this user and update orderId
        await httpClient.post(
          `${AUTH_SERVICE_URL}/auth/update-points-history-order`,
          { userId, orderId },
          { headers: { 'x-user-id': userId.toString() } }
        );
      } catch (error) {
        console.error('Failed to update points history orderId:', error.message);
        // Non-critical error, don't fail the order
      }
    }
    
    // Note: Email will be sent when:
    // - COD: After OTP verification (confirm-cod endpoint)
    // - VNPay: After payment success (confirm-vnpay endpoint)
    
    return res.status(201).json({ 
      orderId, 
      totalCents, 
      subtotalCents,
      shippingFeeCents,
      discountCents 
    });
  } catch (e) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackErr) {
        console.error('❌ Rollback error:', rollbackErr);
      }
    }
    
    console.error('❌ Checkout error:', e);
    console.error('   Error name:', e.name);
    console.error('   Error message:', e.message);
    console.error('   Error code:', e.code);
    console.error('   Error sqlState:', e.sqlState);
    console.error('   Error sqlMessage:', e.sqlMessage);
    console.error('   Error stack:', e.stack);
    
    // Check for specific database errors
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        error: 'DUPLICATE_ORDER',
        message: 'Đơn hàng đã tồn tại. Vui lòng kiểm tra lại.'
      });
    }
    
    if (e.code === 'ER_NO_REFERENCED_ROW_2' || e.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ 
        error: 'INVALID_DATA',
        message: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin.'
      });
    }
    
    if (e.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(500).json({ 
        error: 'DATABASE_SCHEMA_ERROR',
        message: 'Lỗi cấu trúc database. Vui lòng liên hệ quản trị viên.'
      });
    }
    
    // Generic error response - Always include details for debugging
    return res.status(500).json({ 
      error: 'SERVER_ERROR', 
      message: e.message || 'Có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại.',
      details: {
        name: e.name,
        message: e.message,
        code: e.code,
        sqlState: e.sqlState,
        sqlMessage: e.sqlMessage,
        ...(process.env.NODE_ENV === 'development' ? { stack: e.stack } : {})
      }
    });
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseErr) {
        console.error('❌ Connection release error:', releaseErr);
      }
    }
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

// Get order status history
app.get('/orders/:orderId/status-history', async (req, res) => {
  try {
    const { orderId } = req.params;
    const userIdHeader = req.headers['x-user-id'];
    const userId = userIdHeader ? parseInt(userIdHeader, 10) : null;
    
    // Verify order belongs to user (if authenticated) or allow guest access via email
    if (userId) {
      const [[order]] = await pool.query('SELECT id FROM orders WHERE id = ? AND user_id = ?', [orderId, userId]);
      if (!order) return res.status(404).json({ error: 'Order not found' });
    }
    
    const [history] = await pool.query(
      'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC',
      [orderId]
    );
    
    return res.json(history);
  } catch (error) {
    console.error('Get status history error:', error);
    return res.status(500).json({ error: 'Server error' });
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
    
    // Validate format: 5-character alphanumeric
    if (!code || !/^[A-Z0-9]{5}$/i.test(code)) {
      return res.status(400).json({ error: 'INVALID_COUPON', message: 'Mã giảm giá phải có đúng 5 ký tự chữ và số' });
    }
    
    const [[c]] = await pool.query(
      'SELECT code, type, value, max_usage, times_used FROM coupons WHERE UPPER(code) = UPPER(?) AND active = 1 AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW())',
      [code]
    );
    if (!c) return res.status(404).json({ error: 'INVALID_COUPON', message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' });
    
    // Check max usage limit
    if (c.max_usage && c.times_used >= c.max_usage) {
      return res.status(400).json({ error: 'COUPON_LIMIT_REACHED', message: 'Mã giảm giá đã hết lượt sử dụng' });
    }
    
    return res.json({ code: c.code, type: c.type, value: c.value });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin: coupons CRUD
app.get('/admin/coupons', async (req, res) => {
  const [rows] = await pool.query('SELECT id, code, type, value, active, start_date, end_date, max_usage, times_used FROM coupons ORDER BY id DESC LIMIT 500');
  return res.json(rows);
});

app.post('/admin/coupons', async (req, res) => {
  const { code, type, value = 0, active = 1, startDate = null, endDate = null, maxUsage = null } = req.body || {};
  const allowed = ['percentage', 'fixed', 'freeship'];
  
  // Validate required fields
  if (!code || !allowed.includes(type)) return res.status(400).json({ error: 'Invalid payload' });
  
  // Validate code format: 5-character alphanumeric
  const normalizedCode = code.toUpperCase().trim();
  if (!/^[A-Z0-9]{5}$/.test(normalizedCode)) {
    return res.status(400).json({ error: 'Mã giảm giá phải có đúng 5 ký tự chữ và số (A-Z, 0-9)' });
  }
  
  // Validate max_usage: maximum 10
  if (maxUsage !== null && maxUsage !== undefined) {
    const maxUsageNum = parseInt(maxUsage);
    if (isNaN(maxUsageNum) || maxUsageNum < 1 || maxUsageNum > 10) {
      return res.status(400).json({ error: 'Số lần sử dụng tối đa phải từ 1 đến 10' });
    }
  }
  
  try {
    await pool.query(
      'INSERT INTO coupons (code, type, value, active, start_date, end_date, max_usage, times_used) VALUES (?, ?, ?, ?, ?, ?, ?, 0)', 
      [normalizedCode, type, value, active ? 1 : 0, startDate || null, endDate || null, maxUsage || null]
    );
    return res.status(201).json({ ok: true });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Coupon already exists' });
    return res.status(500).json({ error: 'Server error' });
  }
});

app.put('/admin/coupons/:id', async (req, res) => {
  const { id } = req.params;
  const { code, type, value, active, startDate, endDate, maxUsage } = req.body || {};
  const fields = [];
  const params = [];
  
  if (code) {
    // Validate code format: 5-character alphanumeric
    const normalizedCode = code.toUpperCase().trim();
    if (!/^[A-Z0-9]{5}$/.test(normalizedCode)) {
      return res.status(400).json({ error: 'Mã giảm giá phải có đúng 5 ký tự chữ và số (A-Z, 0-9)' });
    }
    fields.push('code = ?'); 
    params.push(normalizedCode);
  }
  if (type) { fields.push('type = ?'); params.push(type); }
  if (value !== undefined) { fields.push('value = ?'); params.push(value); }
  if (active !== undefined) { fields.push('active = ?'); params.push(active ? 1 : 0); }
  if (startDate !== undefined) { fields.push('start_date = ?'); params.push(startDate); }
  if (endDate !== undefined) { fields.push('end_date = ?'); params.push(endDate); }
  if (maxUsage !== undefined && maxUsage !== null) {
    const maxUsageNum = parseInt(maxUsage);
    if (isNaN(maxUsageNum) || maxUsageNum < 1 || maxUsageNum > 10) {
      return res.status(400).json({ error: 'Số lần sử dụng tối đa phải từ 1 đến 10' });
    }
    fields.push('max_usage = ?'); 
    params.push(maxUsageNum);
  }
  
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
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
  try {
    const { status, page = '1', pageSize = '20', search } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSizeNum = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100); // Max 100 per page
    const offset = (pageNum - 1) * pageSizeNum;
    
    let whereClauses = [];
    const params = [];
    
    // Filter by status
    if (status && status !== 'ALL') {
      whereClauses.push('status = ?');
      params.push(status);
    }
    
    // Search by order ID or user ID
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      whereClauses.push('(id LIKE ? OR user_id LIKE ? OR shipping_name LIKE ? OR shipping_phone LIKE ? OR shipping_email LIKE ?)');
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    
    // Get total count for pagination
    const [[countResult]] = await pool.query(
      `SELECT COUNT(*) as total FROM orders ${whereSql}`,
      params
    );
    const total = countResult?.total || 0;
    
    // Get orders with pagination, sorted by created_at DESC (newest first)
    const [orders] = await pool.query(
      `SELECT * FROM orders ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSizeNum, offset]
    );
    
    return res.json({
      items: orders,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum)
      }
    });
  } catch (error) {
    console.error('Get admin orders error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
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
    const { status, notes } = req.body;
    const allowed = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    
    // Get current order status and items
    const [[currentOrder]] = await pool.query('SELECT status FROM orders WHERE id = ?', [orderId]);
    if (!currentOrder) return res.status(404).json({ error: 'Order not found' });
    
    const oldStatus = currentOrder.status;
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
    
    // Record status change in history
    const adminId = req.headers['x-user-id'] || 'ADMIN';
    const historyNotes = notes || `Admin cập nhật trạng thái từ ${oldStatus} sang ${status}`;
    await recordStatusHistory(orderId, oldStatus, status, `ADMIN_${adminId}`, historyNotes);
    
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
  const { orderId: providedOrderId, email } = req.body;
  
  // Find order: by orderId (for guest) or by userId (for authenticated users)
  let order, orderId;
  try {
    if (providedOrderId) {
      // Guest user: find by orderId and email
      if (!email) {
        return res.status(400).json({ error: 'Email is required for guest order confirmation' });
      }
      const [[orderData]] = await pool.query(
        `SELECT id, user_id, shipping_email FROM orders 
         WHERE id = ? AND payment_method = 'COD' AND status = 'PENDING' AND shipping_email = ?`,
        [providedOrderId, email]
      );
      
      if (!orderData) {
        return res.status(404).json({ error: 'Order not found or already processed' });
      }
      
      order = orderData;
      orderId = order.id;
    } else if (userId) {
      // Authenticated user: find latest PENDING COD order
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
    } else {
      return res.status(400).json({ error: 'Either orderId (for guest) or userId (for authenticated) is required' });
    }
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
          // Out of stock - cancel order with proper history and event
          await pool.query('UPDATE orders SET status = ?, payment_status = ? WHERE id = ?', ['CANCELLED', 'FAILED', orderId]);
          
          // Record status change in history
          await recordStatusHistory(orderId, 'PENDING', 'CANCELLED', 'SYSTEM', 'Hủy đơn do hết hàng sau khi xác nhận COD');
          
          // 📤 Publish order.status_changed event
          try {
            await eventBus.publish('order.status_changed', {
              orderId,
              oldStatus: 'PENDING',
              newStatus: 'CANCELLED',
              changedBy: 'SYSTEM',
              notes: 'Hủy đơn do hết hàng sau khi xác nhận COD',
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            console.error('Failed to publish order.status_changed event:', error.message);
          }
          
          await lockManager.releaseLock(lockKey, lockToken);
          console.log(`❌ COD order #${orderId} cancelled - Out of stock after confirmation`);
          return res.status(400).json({ 
            error: 'OUT_OF_STOCK',
            message: 'Sản phẩm đã hết hàng. Đơn hàng đã bị hủy.',
            orderId,
            cancelled: true
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
    
    // Record status change in history (will publish order.status_changed event)
    await recordStatusHistory(orderId, 'PENDING', 'CONFIRMED', 'SYSTEM', 'Xác nhận thanh toán COD thành công');
    
    // 📤 Publish order.payment_completed event
    try {
      await eventBus.publish('order.payment_completed', {
        orderId,
        paymentMethod: 'COD',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        userId: fullOrder?.user_id || null,
        totalCents: fullOrder?.total_cents || 0,
        timestamp: new Date().toISOString()
      });
      console.log(`📤 Published order.payment_completed event for COD order #${orderId}`);
    } catch (error) {
      console.error('Failed to publish order.payment_completed event:', error.message);
      // Non-critical
    }
    
    // Get full order data for email AFTER update to ensure we have latest data
    const [[fullOrder]] = await pool.query(
      'SELECT * FROM orders WHERE id = ?',
      [orderId]
    );
    const [orderItems] = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [orderId]
    );
    const orderDataForEmail = { ...fullOrder, items: orderItems };
    
    // Send confirmation email (async, don't wait)
    sendOrderConfirmationEmail(orderId, orderDataForEmail).catch(err => 
      console.error('Email sending error (non-blocking):', err.message)
    );
    
    // Add loyalty points (async, don't wait) - only for authenticated users
    const orderUserId = fullOrder.user_id;
    if (orderUserId) {
      addLoyaltyPoints(orderUserId, orderId, fullOrder.total_cents).catch(err =>
        console.error('Loyalty points error (non-blocking):', err.message)
      );
    }
    
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
    
    // Get order items for stock reservation
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
          // Out of stock - cancel order with proper history and event
          await pool.query('UPDATE orders SET status = ?, payment_status = ? WHERE id = ?', ['CANCELLED', 'FAILED', orderId]);
          
          // Record status change in history
          await recordStatusHistory(orderId, 'PENDING', 'CANCELLED', 'SYSTEM', 'Hủy đơn do hết hàng sau khi thanh toán VNPay thành công');
          
          // 📤 Publish order.status_changed event
          try {
            await eventBus.publish('order.status_changed', {
              orderId,
              oldStatus: 'PENDING',
              newStatus: 'CANCELLED',
              changedBy: 'SYSTEM',
              notes: 'Hủy đơn do hết hàng sau khi thanh toán VNPay thành công',
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            console.error('Failed to publish order.status_changed event:', error.message);
          }
          
          await lockManager.releaseLock(lockKey, lockToken);
          console.log(`❌ VNPay order #${orderId} cancelled - Out of stock after payment`);
          return res.status(400).json({ 
            error: 'OUT_OF_STOCK',
            message: 'Sản phẩm đã hết hàng. Đơn hàng đã bị hủy và sẽ được hoàn tiền.',
            orderId,
            cancelled: true
          });
        }
        
        console.log(`✅ Reserved inventory for VNPay order #${orderId}`);
      } catch (inventoryError) {
        console.error('Failed to reserve inventory:', inventoryError.message);
        await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['CANCELLED', orderId]);
        await lockManager.releaseLock(lockKey, lockToken);
        return res.status(500).json({ error: 'Failed to reserve inventory' });
      }
    }
    
    // Get full order data for email
    const [[fullOrder]] = await pool.query(
      'SELECT * FROM orders WHERE id = ?',
      [orderId]
    );
    const [orderItems] = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [orderId]
    );
    const orderDataForEmail = { ...fullOrder, items: orderItems };
    
    // Update order status to CONFIRMED and payment status to PAID
    await pool.query(
      'UPDATE orders SET status = ?, payment_status = ? WHERE id = ?',
      ['CONFIRMED', 'PAID', orderId]
    );
    
    // Record status change in history (will publish order.status_changed event)
    await recordStatusHistory(orderId, 'PENDING', 'CONFIRMED', 'SYSTEM', `Thanh toán VNPay thành công (TxnNo: ${transactionNo || 'N/A'})`);
    
    // 📤 Publish order.payment_completed event
    try {
      await eventBus.publish('order.payment_completed', {
        orderId,
        paymentMethod: 'VNPAY',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        transactionNo,
        bankCode,
        amount,
        userId: fullOrder?.user_id || null,
        totalCents: fullOrder?.total_cents || 0,
        timestamp: new Date().toISOString()
      });
      console.log(`📤 Published order.payment_completed event for VNPay order #${orderId}`);
    } catch (error) {
      console.error('Failed to publish order.payment_completed event:', error.message);
      // Non-critical
    }
    
    // Get userId from order
    const userId = fullOrder.user_id;
    
    // Send confirmation email (async, don't wait)
    sendOrderConfirmationEmail(orderId, orderDataForEmail).catch(err => 
      console.error('Email sending error (non-blocking):', err.message)
    );
    
    // Add loyalty points (async, don't wait)
    addLoyaltyPoints(userId, orderId, fullOrder.total_cents).catch(err =>
      console.error('Loyalty points error (non-blocking):', err.message)
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
    
    // Get current status before cancelling
    const [[currentOrder]] = await pool.query('SELECT status FROM orders WHERE id = ?', [orderId]);
    const oldStatus = currentOrder?.status || 'PENDING';
    
    // ✅ RESTORE STOCK:
    // Stock chỉ được trừ khi thanh toán thành công (confirm VNPay)
    // - PENDING: Không restore (chưa trừ stock - chỉ check khi checkout)
    // - CONFIRMED: Phải restore (đã trừ khi confirm VNPay)
    const needRestore = currentOrder?.status === 'CONFIRMED';
    
    if (needRestore) {
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
    } else {
      console.log(`ℹ️ VNPay order #${orderId} is ${oldStatus} - No stock to restore (stock not deducted yet)`);
    }
    
    // Update order status to CANCELLED
    await pool.query(
      'UPDATE orders SET status = ?, payment_status = ? WHERE id = ?',
      ['CANCELLED', 'FAILED', orderId]
    );
    
    // Record status change in history
    await recordStatusHistory(orderId, oldStatus, 'CANCELLED', 'SYSTEM', 'Hủy đơn do thanh toán VNPay thất bại');
    
    console.log(`❌ VNPay order #${orderId} cancelled due to payment failure`);
    return res.json({ ok: true });
    
  } catch (error) {
    console.error('Cancel VNPay order error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// User cancel order (PENDING or CONFIRMED status)
app.patch('/orders/:orderId/cancel', async (req, res) => {
  try {
    const { orderId } = req.params;
    const userIdHeader = req.headers['x-user-id'];
    const userId = userIdHeader ? parseInt(userIdHeader, 10) : null;
    
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    // Check if order exists and belongs to user (get payment_method in same query)
    const [[order]] = await pool.query(
      'SELECT id, user_id, status, payment_method FROM orders WHERE id = ?', 
      [orderId]
    );
    if (!order) return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    if (order.user_id !== userId) return res.status(403).json({ error: 'Không có quyền hủy đơn hàng này' });
    
    // Prevent cancelling delivered orders
    if (order.status === 'DELIVERED') {
      return res.status(400).json({ 
        error: 'CANNOT_CANCEL_DELIVERED',
        message: 'Không thể hủy đơn hàng đã giao thành công' 
      });
    }
    
    // Allow cancel if status is PENDING or CONFIRMED (not SHIPPING or DELIVERED)
    if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
      return res.status(400).json({ 
        error: 'CANNOT_CANCEL',
        message: 'Chỉ có thể hủy đơn hàng đang chờ xác nhận hoặc đã xác nhận (chưa ship)' 
      });
    }
    
    const oldStatus = order.status;
    
    // ✅ RESTORE STOCK:
    // Stock chỉ được trừ khi thanh toán thành công (confirm):
    // - VNPay PENDING: Không restore (chưa trừ stock - chỉ check khi checkout)
    // - VNPay CONFIRMED: Phải restore (đã trừ khi confirm VNPay)
    // - COD PENDING: Không restore (chưa trừ stock - chỉ check khi checkout)
    // - COD CONFIRMED: Phải restore (đã trừ khi confirm COD)
    // Chỉ restore stock nếu order đã CONFIRMED (đã trừ stock rồi)
    const needRestore = order.status === 'CONFIRMED';
    
    if (needRestore) {
      const [items] = await pool.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId]);
      
      if (items.length > 0) {
        try {
          const releaseItems = items.map(item => ({ 
            productId: item.product_id, 
            quantity: item.quantity 
          }));
          const releaseResponse = await httpClient.post(`${CATALOG_SERVICE_URL}/catalog/inventory/release`, {
            items: releaseItems
          });
          
          if (!releaseResponse.data || !releaseResponse.data.success) {
            console.error(`❌ Stock release returned failure for order #${orderId}`);
            return res.status(500).json({ 
              error: 'STOCK_RESTORE_FAILED',
              message: 'Không thể hoàn lại stock. Vui lòng thử lại hoặc liên hệ hỗ trợ.' 
            });
          }
          
          console.log(`✅ User cancelled ${order.payment_method} ${order.status} order #${orderId} - Restored ${items.length} products`);
        } catch (e) {
          console.error(`❌ Failed to restore stock for order #${orderId}:`, e.message);
          return res.status(500).json({ 
            error: 'STOCK_RESTORE_FAILED',
            message: 'Không thể hoàn lại stock. Vui lòng thử lại hoặc liên hệ hỗ trợ.' 
          });
        }
      }
    } else {
      console.log(`ℹ️ User cancelled ${order.payment_method} ${order.status} order #${orderId} - No stock to restore`);
    }
    
    // Update status to CANCELLED (keep payment_status as is: PENDING or FAILED)
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['CANCELLED', orderId]);
    
    // Record status change in history
    await recordStatusHistory(orderId, oldStatus, 'CANCELLED', `USER_${userId}`, 'Người dùng hủy đơn hàng');
    
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

// Admin: Create coupon (duplicate endpoint - keeping for backward compatibility)
app.post('/admin/coupons', async (req, res) => {
  try {
    const { code, type, value, active, startDate, endDate, maxUsage } = req.body;
    if (!code || !type) return res.status(400).json({ error: 'Missing required fields' });
    
    // Validate code format: 5-character alphanumeric
    const normalizedCode = code.toUpperCase().trim();
    if (!/^[A-Z0-9]{5}$/.test(normalizedCode)) {
      return res.status(400).json({ error: 'Mã giảm giá phải có đúng 5 ký tự chữ và số (A-Z, 0-9)' });
    }
    
    // Validate max_usage: maximum 10
    if (maxUsage !== null && maxUsage !== undefined) {
      const maxUsageNum = parseInt(maxUsage);
      if (isNaN(maxUsageNum) || maxUsageNum < 1 || maxUsageNum > 10) {
        return res.status(400).json({ error: 'Số lần sử dụng tối đa phải từ 1 đến 10' });
      }
    }
    
    const [result] = await pool.query(
      'INSERT INTO coupons (code, type, value, active, start_date, end_date, max_usage, times_used) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
      [normalizedCode, type, value || 0, active ? 1 : 0, startDate || null, endDate || null, maxUsage || null]
    );
    return res.status(201).json({ id: result.insertId, code: normalizedCode });
  } catch (error) {
    console.error('Create coupon error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Mã giảm giá đã tồn tại' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Update coupon (duplicate endpoint - keeping for backward compatibility)
app.put('/admin/coupons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { code, type, value, active, startDate, endDate, maxUsage } = req.body;
    
    // Validate code format if provided
    if (code) {
      const normalizedCode = code.toUpperCase().trim();
      if (!/^[A-Z0-9]{5}$/.test(normalizedCode)) {
        return res.status(400).json({ error: 'Mã giảm giá phải có đúng 5 ký tự chữ và số (A-Z, 0-9)' });
      }
    }
    
    // Validate max_usage if provided
    if (maxUsage !== null && maxUsage !== undefined) {
      const maxUsageNum = parseInt(maxUsage);
      if (isNaN(maxUsageNum) || maxUsageNum < 1 || maxUsageNum > 10) {
        return res.status(400).json({ error: 'Số lần sử dụng tối đa phải từ 1 đến 10' });
      }
    }
    
    const updateFields = [];
    const updateParams = [];
    
    if (code) {
      updateFields.push('code = ?');
      updateParams.push(code.toUpperCase().trim());
    }
    if (type) {
      updateFields.push('type = ?');
      updateParams.push(type);
    }
    if (value !== undefined) {
      updateFields.push('value = ?');
      updateParams.push(value || 0);
    }
    if (active !== undefined) {
      updateFields.push('active = ?');
      updateParams.push(active ? 1 : 0);
    }
    if (startDate !== undefined) {
      updateFields.push('start_date = ?');
      updateParams.push(startDate || null);
    }
    if (endDate !== undefined) {
      updateFields.push('end_date = ?');
      updateParams.push(endDate || null);
    }
    if (maxUsage !== undefined) {
      updateFields.push('max_usage = ?');
      updateParams.push(maxUsage || null);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updateParams.push(id);
    await pool.query(
      `UPDATE coupons SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
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
    
    // Validate format: 5-character alphanumeric
    const normalizedCode = code.toUpperCase().trim();
    if (!/^[A-Z0-9]{5}$/.test(normalizedCode)) {
      return res.status(400).json({ error: 'Mã giảm giá phải có đúng 5 ký tự chữ và số' });
    }
    
    const [[coupon]] = await pool.query(
      'SELECT * FROM coupons WHERE code = ? AND active = 1 AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW())',
      [normalizedCode]
    );
    
    if (!coupon) {
      return res.status(400).json({ error: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' });
    }
    
    // Check max usage limit
    if (coupon.max_usage && coupon.times_used >= coupon.max_usage) {
      return res.status(400).json({ error: 'Mã giảm giá đã hết lượt sử dụng' });
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
Promise.all([
  lockManager.connect(),
  eventBus.connect()
]).then(() => {
  console.log('✅ Order service Redis lock manager ready');
  console.log('✅ Order service Redis event bus ready');
}).catch(err => {
  console.error('❌ Redis connection failed:', err);
  console.warn('⚠️ Service will run WITHOUT distributed locks and event bus');
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Order service listening on ${PORT}`);
});


