import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import mysql from 'mysql2/promise';
import axios from 'axios';
import RedisLockManager from '../shared/RedisLockManager.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Initialize Redis Lock Manager
const lockManager = new RedisLockManager();

const PORT = process.env.PORT || 3003;
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://catalog-service:3002';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpw',
  database: process.env.DB_DATABASE || 'cart_db',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  connectTimeout: 10000
});

// Execute SET NAMES utf8mb4 on each connection
pool.on('connection', (connection) => {
  connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
});

function getUserId(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  // Trust gateway to verify token; extract user id via header passed through gateway (optional simplification)
  // For MVP, accept `x-user-id` header if present
  const hdr = req.headers['x-user-id'];
  if (hdr) return parseInt(hdr, 10);
  // Fallback: anonymous carts could be implemented later
  return null;
}

app.get('/cart', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [items] = await pool.query('SELECT * FROM cart_items WHERE user_id = ?', [userId]);
    return res.json({ items });
  } catch (e) {
    console.error('Error fetching cart:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/cart/items', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { productId, quantity, priceCents } = req.body;
  if (!productId || !quantity) return res.status(400).json({ error: 'Missing fields' });
  
  try {
    // Validate stock availability
    // ⚠️ CHỈ CHECK số lượng đang thêm, KHÔNG tính số lượng đã có trong giỏ
    // Stock sẽ được check lại khi checkout và chỉ trừ khi thanh toán xong
    const productRes = await axios.get(`${CATALOG_SERVICE_URL}/catalog/products/${productId}`);
    const product = productRes.data;
    const availableStock = product.stock || 0;
    
    // Chỉ check số lượng đang thêm có <= stock hiện tại không
    if (quantity > availableStock) {
      return res.status(400).json({ 
        error: `Không đủ hàng trong kho. Chỉ còn ${availableStock} sản phẩm` 
      });
    }
    
    // Nếu hết hàng
    if (availableStock === 0) {
      return res.status(400).json({ 
        error: 'Sản phẩm đã hết hàng' 
      });
    }
    
    await pool.query(
      `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [userId, productId, quantity]
    );
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error('Error adding to cart:', e);
    if (e.response) {
      return res.status(e.response.status).json({ error: e.response.data?.error || 'Catalog service error' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/cart/items/:itemId', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { itemId } = req.params;
  const { quantity } = req.body;
  if (!quantity || quantity < 1) return res.status(400).json({ error: 'Invalid quantity' });
  
  try {
    // 🔒 Lock cart updates to prevent race conditions during checkout
    return await lockManager.withLock(`cart:update:${userId}`, async () => {
      // Get product_id from cart item
      const [[cartItem]] = await pool.query(
        'SELECT product_id FROM cart_items WHERE id = ? AND user_id = ?',
        [itemId, userId]
      );
      
      if (!cartItem) return res.status(404).json({ error: 'Cart item not found' });
      
      // Validate stock availability
      const productRes = await axios.get(`${CATALOG_SERVICE_URL}/catalog/products/${cartItem.product_id}`);
      const product = productRes.data;
      const availableStock = product.stock || 0;
    
      if (quantity > availableStock) {
        return res.status(400).json({ 
          error: `Không đủ hàng trong kho. Chỉ còn ${availableStock} sản phẩm` 
        });
      }
      
      await pool.query(
        `UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?`,
        [quantity, itemId, userId]
      );
      return res.json({ ok: true });
    }, { ttlSeconds: 5, throwOnFailure: false });
    
  } catch (e) {
    console.error('Error updating cart item:', e);
    if (e.response) {
      return res.status(e.response.status).json({ error: e.response.data?.error || 'Catalog service error' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/cart/items/:itemId', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { itemId } = req.params;
  try {
    await pool.query(
      `DELETE FROM cart_items WHERE id = ? AND user_id = ?`,
      [itemId, userId]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error('Error deleting cart item:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      service: 'cart-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      service: 'cart-service',
      error: error.message 
    });
  }
});

// Connect to Redis on startup
lockManager.connect().then(() => {
  console.log('✅ Cart service Redis lock manager ready');
}).catch(err => {
  console.error('❌ Redis connection failed:', err);
  console.warn('⚠️ Service will run WITHOUT distributed locks');
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Cart service listening on ${PORT}`);
});


