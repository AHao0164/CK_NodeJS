import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import mysql from 'mysql2/promise';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Create uploads directory if not exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files
app.use('/uploads', express.static(uploadsDir));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Chỉ chấp nhận file ảnh (jpeg, jpg, png, gif, webp)'));
  }
});

const PORT = process.env.PORT || 3002;
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpw',
  database: process.env.DB_DATABASE || 'catalog_db',
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

// Initialize database connection
async function initializeService() {
  try {
    await waitForDatabase();
  } catch (err) {
    console.error('Failed to initialize service:', err);
    process.exit(1);
  }
}

initializeService();

// Upload endpoint (admin only, but we'll add guard later)
app.post('/admin/catalog/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Không có file nào được tải lên' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    return res.json({ imageUrl });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Upload thất bại' });
  }
});

app.get('/catalog/products', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10), 1), 100);
  const sort = String(req.query.sort || 'id_desc');
  
  // Filtering parameters
  const brandIds = req.query.brandIds ? String(req.query.brandIds).split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id)) : [];
  const categoryIds = req.query.categoryIds ? String(req.query.categoryIds).split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id)) : [];
  const minPrice = req.query.minPrice ? parseInt(req.query.minPrice, 10) : null;
  const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice, 10) : null;
  const minRating = req.query.minRating ? parseFloat(req.query.minRating) : null;
  
  const sortSql =
    sort === 'price_asc' ? 'p.price_cents ASC' :
    sort === 'price_desc' ? 'p.price_cents DESC' :
    sort === 'name_asc' ? 'p.name ASC' :
    sort === 'name_desc' ? 'p.name DESC' :
    sort === 'rating_desc' ? 'avg_rating DESC' :
    'p.id DESC';

  const offset = (page - 1) * pageSize;
  const whereClauses = [];
  const params = [];
  
  if (q) {
    whereClauses.push('(p.name LIKE ? OR b.name LIKE ? OR c.name LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  
  if (brandIds.length > 0) {
    whereClauses.push(`p.brand_id IN (${brandIds.map(() => '?').join(',')})`);
    params.push(...brandIds);
  }
  
  if (categoryIds.length > 0) {
    whereClauses.push(`p.category_id IN (${categoryIds.map(() => '?').join(',')})`);
    params.push(...categoryIds);
  }
  
  if (minPrice !== null) {
    whereClauses.push('p.price_cents >= ?');
    params.push(minPrice);
  }
  
  if (maxPrice !== null) {
    whereClauses.push('p.price_cents <= ?');
    params.push(maxPrice);
  }
  
  const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
  const havingSql = minRating ? 'HAVING avg_rating >= ?' : '';
  const havingParams = minRating ? [minRating] : [];

  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.description, p.price_cents, p.specs, p.image_url,
            b.name AS brand, b.id AS brand_id, c.name AS category, c.id AS category_id, 
            i.stock, IFNULL(AVG(r.rating), 0) AS avg_rating, COUNT(r.id) AS review_count
     FROM products p
     LEFT JOIN brands b ON b.id = p.brand_id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN inventory i ON i.product_id = p.id
     LEFT JOIN product_reviews r ON r.product_id = p.id
     ${whereSql}
     GROUP BY p.id, p.name, p.description, p.price_cents, p.specs, p.image_url, 
              b.name, b.id, c.name, c.id, i.stock
     ${havingSql}
     ORDER BY ${sortSql}
     LIMIT ? OFFSET ?`,
    [...params, ...havingParams, pageSize, offset]
  );

  // Count total with subquery to handle GROUP BY + HAVING
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM (
       SELECT p.id, IFNULL(AVG(r.rating), 0) AS avg_rating
       FROM products p 
       LEFT JOIN brands b ON b.id = p.brand_id 
       LEFT JOIN categories c ON c.id = p.category_id 
       LEFT JOIN product_reviews r ON r.product_id = p.id
       ${whereSql}
       GROUP BY p.id
       ${havingSql}
     ) AS filtered_products`,
    [...params, ...havingParams]
  );
  
  const total = countRows[0]?.total || 0;

  return res.json({ items: rows, page, pageSize, total });
});

app.get('/catalog/products/:id', async (req, res) => {
  const { id } = req.params;
  const [[product]] = await pool.query(
    `SELECT p.id, p.name, p.description, p.price_cents, p.specs,
            b.name AS brand, b.id AS brand_id, c.name AS category, c.id AS category_id
     FROM products p
     LEFT JOIN brands b ON b.id = p.brand_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ?`,
    [id]
  );
  if (!product) return res.status(404).json({ error: 'Not found' });
  
  // Get product images
  const [images] = await pool.query('SELECT url, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order', [id]);
  
  // Get inventory
  const [[inv]] = await pool.query('SELECT stock FROM inventory WHERE product_id = ?', [id]);
  
  // Get product variants
  const [variants] = await pool.query(
    `SELECT id, variant_name, variant_value, price_adjustment_cents, stock, sku, is_available 
     FROM product_variants WHERE product_id = ? ORDER BY variant_name, variant_value`,
    [id]
  );
  
  // Get product reviews with average rating
  const [[ratingStats]] = await pool.query(
    `SELECT IFNULL(AVG(rating), 0) AS avg_rating, COUNT(*) AS review_count
     FROM product_reviews WHERE product_id = ?`,
    [id]
  );
  
  const [reviews] = await pool.query(
    `SELECT id, user_id, rating, comment, author_name, created_at, updated_at
     FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT 50`,
    [id]
  );
  
  return res.json({ 
    ...product, 
    images, 
    stock: inv ? inv.stock : 0,
    variants,
    avg_rating: parseFloat(ratingStats.avg_rating),
    review_count: ratingStats.review_count,
    reviews
  });
});

// Public: list categories with product counts (for featured categories on FE)
app.get('/catalog/categories', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '8', 10), 1), 48);
    const [rows] = await pool.query(
      `SELECT c.id, c.name, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id, c.name
       ORDER BY product_count DESC, c.name ASC
       LIMIT ?`,
      [limit]
    );
    return res.json({ items: rows });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Public: get new products
app.get('/catalog/products-new', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '8', 10), 1), 24);
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price_cents, p.specs, p.image_url,
              b.name AS brand, c.name AS category, i.stock
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN inventory i ON i.product_id = p.id
       WHERE p.is_new = 1
       ORDER BY p.created_at DESC
       LIMIT ?`,
      [limit]
    );
    return res.json({ items: rows });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Public: get bestseller products
app.get('/catalog/products-bestsellers', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '8', 10), 1), 24);
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price_cents, p.specs, p.image_url,
              b.name AS brand, c.name AS category, i.stock, p.sales_count
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN inventory i ON i.product_id = p.id
       WHERE p.is_bestseller = 1
       ORDER BY p.sales_count DESC
       LIMIT ?`,
      [limit]
    );
    return res.json({ items: rows });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Public: products by category (for homepage sections)
app.get('/catalog/categories/:categoryId/products', async (req, res) => {
  const { categoryId } = req.params;
  const limit = Math.min(Math.max(parseInt(req.query.limit || '8', 10), 1), 24);
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price_cents, p.specs,
              b.name AS brand, c.name AS category, i.stock, p.image_url
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN inventory i ON i.product_id = p.id
       WHERE p.category_id = ?
       ORDER BY p.id DESC
       LIMIT ?`,
      [categoryId, limit]
    );
    return res.json({ items: rows });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

// Admin guard middleware (trust gateway to set x-user-role)
function requireAdmin(req, res, next) {
  if (req.path.startsWith('/admin')) {
    const role = req.headers['x-user-role'];
    if (role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  }
  return next();
}

app.use(requireAdmin);

// Admin: list products
app.get('/admin/catalog/products', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10), 1), 200);
  const sort = String(req.query.sort || 'id_desc');
  const sortSql =
    sort === 'price_asc' ? 'p.price_cents ASC' :
    sort === 'price_desc' ? 'p.price_cents DESC' :
    sort === 'name_asc' ? 'p.name ASC' :
    sort === 'name_desc' ? 'p.name DESC' :
    'p.id DESC';
  const offset = (page - 1) * pageSize;
  const whereClauses = [];
  const params = [];
  if (q) {
    whereClauses.push('(p.name LIKE ? OR b.name LIKE ? OR c.name LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.description, p.price_cents, p.specs, p.image_url,
            b.id AS brand_id, b.name AS brand, c.id AS category_id, c.name AS category, i.stock
     FROM products p
     LEFT JOIN brands b ON b.id = p.brand_id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN inventory i ON i.product_id = p.id
     ${whereSql}
     ORDER BY ${sortSql}
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM products p 
     LEFT JOIN brands b ON b.id = p.brand_id 
     LEFT JOIN categories c ON c.id = p.category_id 
     ${whereSql}`,
    params
  );

  return res.json({ items: rows, page, pageSize, total });
});

// Admin: create product
app.post('/admin/catalog/products', async (req, res) => {
  const { name, brandId, categoryId, description, priceCents, specs, stock, imageUrl } = req.body;
  if (!name || !priceCents) return res.status(400).json({ error: 'Missing required fields: name and priceCents' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      'INSERT INTO products (name, brand_id, category_id, description, price_cents, specs, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, brandId || null, categoryId || null, description || null, priceCents, specs ? JSON.stringify(specs) : null, imageUrl || null]
    );
    const productId = result.insertId;
    await conn.query('INSERT INTO inventory (product_id, stock) VALUES (?, ?) ON DUPLICATE KEY UPDATE stock=VALUES(stock)', [productId, Number.isInteger(stock) ? stock : 0]);
    await conn.commit();
    return res.status(201).json({ id: productId });
  } catch (e) {
    await conn.rollback();
    console.error('Create product error:', e);
    return res.status(500).json({ error: 'Server error: ' + e.message });
  } finally {
    conn.release();
  }
});

// Admin: update product
app.put('/admin/catalog/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, brandId, categoryId, description, priceCents, specs, stock, imageUrl } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE products SET 
        name = COALESCE(?, name), 
        brand_id = ?, 
        category_id = ?, 
        description = ?, 
        price_cents = COALESCE(?, price_cents), 
        specs = ?,
        image_url = COALESCE(?, image_url)
       WHERE id = ?`,
      [name || null, brandId || null, categoryId || null, description || null, priceCents || null, specs ? JSON.stringify(specs) : null, imageUrl || null, id]
    );
    if (stock !== undefined) {
      await conn.query('INSERT INTO inventory (product_id, stock) VALUES (?, ?) ON DUPLICATE KEY UPDATE stock=VALUES(stock)', [id, stock]);
    }
    await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error('Update product error:', e);
    return res.status(500).json({ error: 'Server error: ' + e.message });
  } finally {
    conn.release();
  }
});

// Admin: delete product
app.delete('/admin/catalog/products/:id', async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM product_images WHERE product_id = ?', [id]);
    await conn.query('DELETE FROM inventory WHERE product_id = ?', [id]);
    await conn.query('DELETE FROM products WHERE id = ?', [id]);
    await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    return res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// Admin: brands
app.get('/admin/catalog/brands', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM brands ORDER BY name');
  return res.json(rows);
});
app.post('/admin/catalog/brands', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  await pool.query('INSERT INTO brands (name) VALUES (?)', [name]);
  return res.status(201).json({ ok: true });
});
app.delete('/admin/catalog/brands/:id', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM brands WHERE id = ?', [id]);
  return res.json({ ok: true });
});

// Admin: categories
app.get('/admin/catalog/categories', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM categories ORDER BY name');
  return res.json(rows);
});
app.post('/admin/catalog/categories', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  await pool.query('INSERT INTO categories (name) VALUES (?)', [name]);
  return res.status(201).json({ ok: true });
});
app.delete('/admin/catalog/categories/:id', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM categories WHERE id = ?', [id]);
  return res.json({ ok: true });
});

// Admin: inventory set
app.patch('/admin/catalog/inventory/:productId', async (req, res) => {
  const { productId } = req.params;
  const { stock } = req.body;
  if (stock === undefined || stock < 0) return res.status(400).json({ error: 'Invalid stock' });
  await pool.query('INSERT INTO inventory (product_id, stock) VALUES (?, ?) ON DUPLICATE KEY UPDATE stock=VALUES(stock)', [productId, stock]);
  return res.json({ ok: true });
});

// Public: Get all brands (for filtering)
app.get('/catalog/brands', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.name, COUNT(p.id) AS product_count
       FROM brands b
       LEFT JOIN products p ON p.brand_id = b.id
       GROUP BY b.id, b.name
       ORDER BY b.name ASC`
    );
    return res.json({ items: rows });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Public: Get price range for filtering
app.get('/catalog/price-range', async (req, res) => {
  try {
    const [[result]] = await pool.query(
      `SELECT MIN(price_cents) AS min_price, MAX(price_cents) AS max_price FROM products`
    );
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// Public: Add product review (requires authentication for rating, but comment can be anonymous)
app.post('/catalog/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, rating, comment, authorName } = req.body;
    
    // Validate: rating requires userId, but comment doesn't
    if (rating && !userId) {
      return res.status(400).json({ error: 'User must be logged in to rate products' });
    }
    
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    if (!comment && !rating) {
      return res.status(400).json({ error: 'Must provide either comment or rating' });
    }
    
    // Check if product exists
    const [[product]] = await pool.query('SELECT id FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Insert review
    const [result] = await pool.query(
      `INSERT INTO product_reviews (product_id, user_id, rating, comment, author_name)
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId || null, rating || null, comment || null, authorName || 'Anonymous']
    );
    
    // Get the newly created review
    const [[newReview]] = await pool.query(
      `SELECT id, user_id, rating, comment, author_name, created_at, updated_at
       FROM product_reviews WHERE id = ?`,
      [result.insertId]
    );
    
    // Broadcast to WebSocket clients
    broadcastReviewUpdate(id, newReview);
    
    return res.status(201).json({ 
      id: result.insertId,
      review: newReview,
      message: 'Review added successfully'
    });
  } catch (e) {
    console.error('Add review error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Public: Get reviews for a product
app.get('/catalog/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    
    const [reviews] = await pool.query(
      `SELECT id, user_id, rating, comment, author_name, created_at, updated_at
       FROM product_reviews 
       WHERE product_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [id, limit, offset]
    );
    
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM product_reviews WHERE product_id = ?`,
      [id]
    );
    
    return res.json({ items: reviews, total });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Catalog service listening on ${PORT}`);
});

// WebSocket server for real-time review updates
const wss = new WebSocketServer({ server, path: '/ws/reviews' });

// Store active connections per product
const productConnections = new Map();

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      // Subscribe to product reviews
      if (data.type === 'subscribe' && data.productId) {
        ws.productId = data.productId;
        
        if (!productConnections.has(data.productId)) {
          productConnections.set(data.productId, new Set());
        }
        productConnections.get(data.productId).add(ws);
        
        console.log(`Client subscribed to product ${data.productId}`);
        ws.send(JSON.stringify({ type: 'subscribed', productId: data.productId }));
      }
    } catch (e) {
      console.error('WebSocket message error:', e);
    }
  });
  
  ws.on('close', () => {
    if (ws.productId && productConnections.has(ws.productId)) {
      productConnections.get(ws.productId).delete(ws);
      if (productConnections.get(ws.productId).size === 0) {
        productConnections.delete(ws.productId);
      }
    }
  });
});

// Broadcast review update to all clients watching a product
export function broadcastReviewUpdate(productId, review) {
  if (productConnections.has(productId)) {
    const message = JSON.stringify({
      type: 'review_added',
      productId,
      review
    });
    
    productConnections.get(productId).forEach(client => {
      if (client.readyState === 1) { // OPEN
        client.send(message);
      }
    });
  }
}


