import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import mysql from 'mysql2/promise';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import RedisLockManager from '../shared/RedisLockManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Redis Lock Manager
const lockManager = new RedisLockManager();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Force UTF-8 for all responses
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

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
  charset: 'utf8mb4',
  connectTimeout: 10000,
  // Ensure proper charset handling
  charsetNumber: 45 // utf8mb4_general_ci
});

// Helper function to parse JSON fields from database
function parseJsonFields(product) {
  if (!product) return product;
  
  if (product.specs && typeof product.specs === 'string') {
    try { product.specs = JSON.parse(product.specs); } catch (e) { product.specs = {}; }
  }
  if (product.features && typeof product.features === 'string') {
    try { product.features = JSON.parse(product.features); } catch (e) { product.features = []; }
  }
  
  return product;
}

// Helper to parse array of products
function parseProductsArray(products) {
  if (!Array.isArray(products)) return products;
  return products.map(parseJsonFields);
}

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
  const categoryId = req.query.categoryId ? parseInt(req.query.categoryId, 10) : null;
  const brandId = req.query.brandId ? parseInt(req.query.brandId, 10) : null;
  const minPrice = req.query.minPrice ? parseInt(req.query.minPrice, 10) : null;
  const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice, 10) : null;
  
  const offset = (page - 1) * pageSize;
  const whereClauses = [];
  const params = [];
  const sortParams = [];
  
  // Smart sorting with relevance - count how many search terms match
  let sortSql;
  if (q && sort === 'id_desc') {
    const words = q.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
    if (words.length > 1) {
      // Multi-word: sort by number of matching terms (descending)
      const matchCases = words.map((_, idx) => 
        `CASE WHEN LOWER(CONCAT_WS(' ', p.name, p.description, b.name, c.name)) LIKE ? THEN 1 ELSE 0 END`
      ).join(' + ');
      sortSql = `(${matchCases}) DESC, p.id DESC`;
      words.forEach(word => {
        sortParams.push(`%${word}%`);
      });
    } else {
      // Single word: prioritize exact matches
      sortSql = `
        CASE 
          WHEN p.name LIKE ? THEN 1
          WHEN b.name LIKE ? THEN 2
          WHEN c.name LIKE ? THEN 3
          WHEN p.description LIKE ? THEN 4
          ELSE 5
        END,
        p.id DESC
      `;
      const exactMatch = `%${q}%`;
      sortParams.push(exactMatch, exactMatch, exactMatch, exactMatch);
    }
  } else {
    sortSql =
      sort === 'price_asc' ? 'p.price_cents ASC' :
        sort === 'price_desc' ? 'p.price_cents DESC' :
          sort === 'name_asc' ? 'p.name ASC' :
            sort === 'name_desc' ? 'p.name DESC' :
              'p.id DESC';
  }
  
  // Intelligent search - tìm kiếm siêu linh hoạt với relevance scoring
  if (q) {
    const originalQuery = q.toLowerCase().trim();
    const normalizedQuery = originalQuery.replace(/\s+/g, '');
    const words = originalQuery.split(/\s+/).filter(t => t.length >= 2);
    
    // Build một OR lớn cho tất cả các cách tìm
    const searchConditions = [];
    
    // Nếu chỉ có 1 từ hoặc là cụm ngắn, tìm rộng
    if (words.length === 1 || originalQuery.length <= 15) {
      // 1. Tìm cụm gốc (có khoảng trắng)
      searchConditions.push(`LOWER(p.name) LIKE ?`);
      searchConditions.push(`LOWER(p.description) LIKE ?`);
      searchConditions.push(`LOWER(b.name) LIKE ?`);
      searchConditions.push(`LOWER(c.name) LIKE ?`);
      searchConditions.push(`LOWER(p.sku) LIKE ?`);
      params.push(`%${originalQuery}%`, `%${originalQuery}%`, `%${originalQuery}%`, `%${originalQuery}%`, `%${originalQuery}%`);
      
      // 2. Tìm không khoảng trắng (laptopgaming -> "Laptop Gaming")
      searchConditions.push(`REPLACE(LOWER(p.name), ' ', '') LIKE ?`);
      searchConditions.push(`REPLACE(LOWER(c.name), ' ', '') LIKE ?`);
      searchConditions.push(`REPLACE(LOWER(p.description), ' ', '') LIKE ?`);
      searchConditions.push(`REPLACE(LOWER(b.name), ' ', '') LIKE ?`);
      params.push(`%${normalizedQuery}%`, `%${normalizedQuery}%`, `%${normalizedQuery}%`, `%${normalizedQuery}%`);
      
      // 3. Tìm trong JSON specs/features
      searchConditions.push(`JSON_SEARCH(LOWER(CAST(p.specs AS CHAR)), "one", ?) IS NOT NULL`);
      searchConditions.push(`JSON_SEARCH(LOWER(CAST(p.features AS CHAR)), "one", ?) IS NOT NULL`);
      params.push(`%${originalQuery}%`, `%${originalQuery}%`);
    } else {
      // Nhiều từ: tìm sản phẩm match TẤT CẢ các từ (AND logic cho mỗi từ)
      // Nhưng mỗi từ có thể match ở nhiều fields khác nhau (OR trong field)
      words.forEach(word => {
        searchConditions.push(`(
          LOWER(p.name) LIKE ? OR 
          LOWER(b.name) LIKE ? OR 
          LOWER(c.name) LIKE ? OR 
          LOWER(p.description) LIKE ? OR
          REPLACE(LOWER(c.name), ' ', '') LIKE ? OR
          JSON_SEARCH(LOWER(CAST(p.specs AS CHAR)), "one", ?) IS NOT NULL
        )`);
        const like = `%${word}%`;
        params.push(like, like, like, like, like, `%${word}%`);
      });
    }
    
    if (searchConditions.length > 0) {
      // Nếu nhiều từ, dùng AND để require tất cả từ match
      const joinOperator = words.length > 1 && originalQuery.length > 15 ? ' AND ' : ' OR ';
      whereClauses.push(`(${searchConditions.join(joinOperator)})`);
    }
  }
  
  // Filter theo category
  if (categoryId) {
    whereClauses.push('p.category_id = ?');
    params.push(categoryId);
  }
  
  // Filter theo brand
  if (brandId) {
    whereClauses.push('p.brand_id = ?');
    params.push(brandId);
  }
  
  // Filter theo giá (dùng giá sau discount)
  if (minPrice !== null) {
    whereClauses.push('(p.price_cents * (100 - p.discount_percent) / 100) >= ?');
    params.push(minPrice);
  }
  if (maxPrice !== null) {
    whereClauses.push('(p.price_cents * (100 - p.discount_percent) / 100) <= ?');
    params.push(maxPrice);
  }
  
  const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
  const finalParams = [...params, ...sortParams, pageSize, offset];

  // Debug logging
  if (q) {
    console.log('Search query:', q);
    console.log('WHERE SQL:', whereSql);
    console.log('Search params:', params.length, 'Sort params:', sortParams.length);
  }

  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.description, p.price_cents, p.discount_percent, p.specs, p.features, p.image_url,
            b.name AS brand, c.name AS category, i.stock, p.brand_id, p.category_id
     FROM products p
     LEFT JOIN brands b ON b.id = p.brand_id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN inventory i ON i.product_id = p.id
     ${whereSql}
     ORDER BY ${sortSql}
     LIMIT ? OFFSET ?`,
    finalParams
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM products p 
     LEFT JOIN brands b ON b.id = p.brand_id 
     LEFT JOIN categories c ON c.id = p.category_id 
     ${whereSql}`,
    params
  );

  // Parse JSON fields for all products
  parseProductsArray(rows);

  return res.json({ items: rows, page, pageSize, total });
});

app.get('/catalog/products/:id', async (req, res) => {
  const { id } = req.params;
  const [[product]] = await pool.query(
    `SELECT p.id, p.name, p.description, p.price_cents, p.discount_percent, p.specs, p.features, p.image_url,
            b.id AS brand_id, b.name AS brand, c.id AS category_id, c.name AS category
     FROM products p
     LEFT JOIN brands b ON b.id = p.brand_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ?`,
    [id]
  );
  if (!product) return res.status(404).json({ error: 'Not found' });
  const [images] = await pool.query('SELECT url, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order', [id]);
  const [[inv]] = await pool.query('SELECT stock FROM inventory WHERE product_id = ?', [id]);
  
  // Parse JSON fields
  parseJsonFields(product);
  
  return res.json({ ...product, images, stock: inv ? inv.stock : 0 });
});

// Public: get related products (same brand first, then category)
app.get('/catalog/products/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit || '8', 10), 1), 20);
    
    // Get product's category and brand
    const [[product]] = await pool.query(
      'SELECT category_id, brand_id FROM products WHERE id = ?',
      [id]
    );
    
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    // Ưu tiên: cùng brand > cùng category > sản phẩm khác
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.price_cents, p.discount_percent, p.image_url, p.brand_id, p.category_id
       FROM products p
       WHERE p.id != ?
       ORDER BY 
         CASE 
           WHEN p.brand_id = ? THEN 1
           WHEN p.category_id = ? THEN 2
           ELSE 3
         END,
         p.id DESC
       LIMIT ?`,
      [id, product.brand_id, product.category_id, limit]
    );
    
    return res.json({ products: rows });
  } catch (e) {
    console.error('Get related products error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Public: get active banners for homepage
app.get('/catalog/banners', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, title, subtitle, image_url, link_url FROM banners WHERE active = 1 ORDER BY display_order ASC, id DESC LIMIT 6'
    );
    return res.json(rows);
  } catch (error) {
    console.error('Get public banners error:', error);
    // Return empty array if error - không ảnh hưởng frontend
    return res.json([]);
  }
});

// Public: list categories with product counts (for featured categories on FE)
app.get('/catalog/categories', async (req, res) => {
  try {
    const limit = req.query.limit ? Math.min(Math.max(parseInt(req.query.limit, 10), 1), 100) : null;
    const includeProducts = req.query.includeProducts === 'true';
    
    let query = `
      SELECT c.id, c.name, c.icon, c.description, c.display_order
      ${includeProducts ? ', COUNT(p.id) AS product_count' : ''}
      FROM categories c
      ${includeProducts ? 'LEFT JOIN products p ON p.category_id = c.id' : ''}
      ${includeProducts ? 'GROUP BY c.id, c.name, c.icon, c.description, c.display_order' : ''}
      ORDER BY c.display_order ASC, c.name ASC
    `;
    
    if (limit) {
      query += ' LIMIT ?';
      const [rows] = await pool.query(query, [limit]);
      return res.json({ items: rows });
    } else {
      const [rows] = await pool.query(query);
      return res.json({ items: rows });
    }
  } catch (e) {
    console.error('Get categories error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Public: list brands (for menu)
app.get('/catalog/brands', async (req, res) => {
  try {
    const limit = req.query.limit ? Math.min(Math.max(parseInt(req.query.limit, 10), 1), 100) : null;
    
    let query = 'SELECT id, name, icon, description, display_order FROM brands ORDER BY display_order ASC, name ASC';
    
    if (limit) {
      query += ' LIMIT ?';
      const [rows] = await pool.query(query, [limit]);
      return res.json({ items: rows });
    } else {
      const [rows] = await pool.query(query);
      return res.json({ items: rows });
    }
  } catch (e) {
    console.error('Get brands error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Public: products by category (for homepage sections)
app.get('/catalog/categories/:categoryId/products', async (req, res) => {
  const { categoryId } = req.params;
  const limit = Math.min(Math.max(parseInt(req.query.limit || '8', 10), 1), 24);
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price_cents, p.specs, p.features,
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
    
    // Parse JSON fields
    parseProductsArray(rows);
    
    return res.json({ items: rows });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      service: 'catalog-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      service: 'catalog-service',
      error: error.message 
    });
  }
});

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
  const brandId = req.query.brandId ? parseInt(req.query.brandId, 10) : null;
  const categoryId = req.query.categoryId ? parseInt(req.query.categoryId, 10) : null;
  
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
    whereClauses.push('(p.name LIKE ? OR p.sku LIKE ? OR b.name LIKE ? OR c.name LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (brandId) {
    whereClauses.push('p.brand_id = ?');
    params.push(brandId);
  }
  if (categoryId) {
    whereClauses.push('p.category_id = ?');
    params.push(categoryId);
  }
  const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const [rows] = await pool.query(
    `SELECT p.id, p.sku, p.name, p.description, p.price_cents, p.discount_percent, p.specs, p.features, p.image_url,
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

  // Parse JSON fields for all products
  parseProductsArray(rows);

  return res.json({ items: rows, page, pageSize, total });
});

// Admin: create product
app.post('/admin/catalog/products', async (req, res) => {
  const { name, brandId, categoryId, description, priceCents, discountPercent, specs, features, stock, imageUrl, images, sku } = req.body;
  if (!name || !priceCents) return res.status(400).json({ error: 'Missing required fields: name and priceCents' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Generate SKU if not provided
    const productSku = sku || `SKU${Date.now()}`;
    const [result] = await conn.query(
      'INSERT INTO products (sku, name, brand_id, category_id, description, price_cents, discount_percent, specs, features, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [productSku, name, brandId || null, categoryId || null, description || null, priceCents, discountPercent || 0, specs ? JSON.stringify(specs) : null, features ? JSON.stringify(features) : null, imageUrl || null]
    );
    const productId = result.insertId;
    
    // Insert product images if provided
    if (images && Array.isArray(images) && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        await conn.query('INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)', [productId, images[i], i]);
      }
    }
    
    await conn.query('INSERT INTO inventory (product_id, stock) VALUES (?, ?) ON DUPLICATE KEY UPDATE stock=VALUES(stock)', [productId, Number.isInteger(stock) ? stock : 0]);
    await conn.commit();
    return res.status(201).json({ id: productId, sku: productSku });
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
  const { name, brandId, categoryId, description, priceCents, discountPercent, specs, features, stock, imageUrl, images, sku } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE products SET 
        sku = COALESCE(?, sku),
        name = COALESCE(?, name), 
        brand_id = ?, 
        category_id = ?, 
        description = ?, 
        price_cents = COALESCE(?, price_cents),
        discount_percent = ?,
        specs = ?,
        features = ?,
        image_url = COALESCE(?, image_url)
       WHERE id = ?`,
      [sku || null, name || null, brandId || null, categoryId || null, description || null, priceCents || null, discountPercent !== undefined ? discountPercent : 0, specs ? JSON.stringify(specs) : null, features ? JSON.stringify(features) : null, imageUrl || null, id]
    );
    
    // Update product images if provided
    if (images !== undefined) {
      // Delete old images
      await conn.query('DELETE FROM product_images WHERE product_id = ?', [id]);
      // Insert new images
      if (Array.isArray(images) && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          await conn.query('INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)', [id, images[i], i]);
        }
      }
    }
    
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

// Admin: delete multiple products
app.post('/admin/catalog/products/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid ids array' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const placeholders = ids.map(() => '?').join(',');
    await conn.query(`DELETE FROM product_images WHERE product_id IN (${placeholders})`, ids);
    await conn.query(`DELETE FROM inventory WHERE product_id IN (${placeholders})`, ids);
    await conn.query(`DELETE FROM products WHERE id IN (${placeholders})`, ids);
    await conn.commit();
    return res.json({ ok: true, deletedCount: ids.length });
  } catch (e) {
    await conn.rollback();
    console.error('Bulk delete error:', e);
    return res.status(500).json({ error: 'Server error: ' + e.message });
  } finally {
    conn.release();
  }
});

// Admin: brands
app.get('/admin/catalog/brands', async (req, res) => {
  const search = String(req.query.search || '').trim();
  const whereClauses = [];
  const params = [];
  
  if (search) {
    whereClauses.push('name LIKE ?');
    params.push(`%${search}%`);
  }
  
  const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
  const [rows] = await pool.query(`SELECT * FROM brands ${whereSql} ORDER BY display_order ASC, name ASC`, params);
  return res.json(rows);
});

app.post('/admin/catalog/brands', async (req, res) => {
  const { name, icon, description, displayOrder } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Auto-generate next display_order if not provided
    let finalOrder = displayOrder;
    if (finalOrder === undefined || finalOrder === null) {
      const [[maxRow]] = await conn.query('SELECT MAX(display_order) as max_order FROM brands');
      finalOrder = (maxRow.max_order || 0) + 1;
    }
    
    // Handle duplicate display_order: shift others down
    if (finalOrder !== null && finalOrder !== undefined) {
      await conn.query(
        'UPDATE brands SET display_order = display_order + 1 WHERE display_order >= ?',
        [finalOrder]
      );
    }
    
    await conn.query(
      'INSERT INTO brands (name, icon, description, display_order) VALUES (?, ?, ?, ?)',
      [name, icon || null, description || null, finalOrder]
    );
    
    await conn.commit();
    return res.status(201).json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error('Create brand error:', e);
    return res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

app.put('/admin/catalog/brands/:id', async (req, res) => {
  const { id } = req.params;
  const { name, icon, description, displayOrder } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Get current display_order
    const [[current]] = await conn.query('SELECT display_order FROM brands WHERE id = ?', [id]);
    if (!current) {
      await conn.rollback();
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    // Handle display_order change with duplicate priority
    if (displayOrder !== undefined && displayOrder !== current.display_order) {
      // Remove from old position
      await conn.query(
        'UPDATE brands SET display_order = display_order - 1 WHERE display_order > ?',
        [current.display_order]
      );
      
      // Make space at new position (shift others down)
      await conn.query(
        'UPDATE brands SET display_order = display_order + 1 WHERE display_order >= ? AND id != ?',
        [displayOrder, id]
      );
    }
    
    await conn.query(
      'UPDATE brands SET name = ?, icon = ?, description = ?, display_order = ? WHERE id = ?',
      [name, icon || null, description || null, displayOrder !== undefined ? displayOrder : current.display_order, id]
    );
    
    await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error('Update brand error:', e);
    return res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

app.delete('/admin/catalog/brands/:id', async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Get display_order before delete
    const [[brand]] = await conn.query('SELECT display_order FROM brands WHERE id = ?', [id]);
    if (!brand) {
      await conn.rollback();
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    await conn.query('DELETE FROM brands WHERE id = ?', [id]);
    
    // Reorder: shift all items after deleted one up
    await conn.query(
      'UPDATE brands SET display_order = display_order - 1 WHERE display_order > ?',
      [brand.display_order]
    );
    
    await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    return res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Bulk delete brands
app.post('/admin/catalog/brands/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid ids array' });
  }
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const placeholders = ids.map(() => '?').join(',');
    await conn.query(`DELETE FROM brands WHERE id IN (${placeholders})`, ids);
    
    // Reorder: compact display_order sequence
    const [allBrands] = await conn.query('SELECT id FROM brands ORDER BY display_order ASC, name ASC');
    for (let i = 0; i < allBrands.length; i++) {
      await conn.query('UPDATE brands SET display_order = ? WHERE id = ?', [i, allBrands[i].id]);
    }
    
    await conn.commit();
    return res.json({ ok: true, deletedCount: ids.length });
  } catch (e) {
    await conn.rollback();
    console.error('Bulk delete brands error:', e);
    return res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Admin: categories
app.get('/admin/catalog/categories', async (req, res) => {
  const search = String(req.query.search || '').trim();
  const whereClauses = [];
  const params = [];
  
  if (search) {
    whereClauses.push('name LIKE ?');
    params.push(`%${search}%`);
  }
  
  const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
  const [rows] = await pool.query(`SELECT * FROM categories ${whereSql} ORDER BY display_order ASC, name ASC`, params);
  return res.json(rows);
});

app.post('/admin/catalog/categories', async (req, res) => {
  const { name, icon, description, displayOrder } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Auto-generate next display_order if not provided
    let finalOrder = displayOrder;
    if (finalOrder === undefined || finalOrder === null) {
      const [[maxRow]] = await conn.query('SELECT MAX(display_order) as max_order FROM categories');
      finalOrder = (maxRow.max_order || 0) + 1;
    }
    
    // Handle duplicate display_order: shift others down
    if (finalOrder !== null && finalOrder !== undefined) {
      await conn.query(
        'UPDATE categories SET display_order = display_order + 1 WHERE display_order >= ?',
        [finalOrder]
      );
    }
    
    await conn.query(
      'INSERT INTO categories (name, icon, description, display_order) VALUES (?, ?, ?, ?)',
      [name, icon || null, description || null, finalOrder]
    );
    
    await conn.commit();
    return res.status(201).json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error('Create category error:', e);
    return res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

app.put('/admin/catalog/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name, icon, description, displayOrder } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Get current display_order
    const [[current]] = await conn.query('SELECT display_order FROM categories WHERE id = ?', [id]);
    if (!current) {
      await conn.rollback();
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Handle display_order change with duplicate priority
    if (displayOrder !== undefined && displayOrder !== current.display_order) {
      // Remove from old position
      await conn.query(
        'UPDATE categories SET display_order = display_order - 1 WHERE display_order > ?',
        [current.display_order]
      );
      
      // Make space at new position (shift others down)
      await conn.query(
        'UPDATE categories SET display_order = display_order + 1 WHERE display_order >= ? AND id != ?',
        [displayOrder, id]
      );
    }
    
    await conn.query(
      'UPDATE categories SET name = ?, icon = ?, description = ?, display_order = ? WHERE id = ?',
      [name, icon || null, description || null, displayOrder !== undefined ? displayOrder : current.display_order, id]
    );
    
    await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error('Update category error:', e);
    return res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

app.delete('/admin/catalog/categories/:id', async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Get display_order before delete
    const [[category]] = await conn.query('SELECT display_order FROM categories WHERE id = ?', [id]);
    if (!category) {
      await conn.rollback();
      return res.status(404).json({ error: 'Category not found' });
    }
    
    await conn.query('DELETE FROM categories WHERE id = ?', [id]);
    
    // Reorder: shift all items after deleted one up
    await conn.query(
      'UPDATE categories SET display_order = display_order - 1 WHERE display_order > ?',
      [category.display_order]
    );
    
    await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    return res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Bulk delete categories
app.post('/admin/catalog/categories/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid ids array' });
  }
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const placeholders = ids.map(() => '?').join(',');
    await conn.query(`DELETE FROM categories WHERE id IN (${placeholders})`, ids);
    
    // Reorder: compact display_order sequence
    const [allCategories] = await conn.query('SELECT id FROM categories ORDER BY display_order ASC, name ASC');
    for (let i = 0; i < allCategories.length; i++) {
      await conn.query('UPDATE categories SET display_order = ? WHERE id = ?', [i, allCategories[i].id]);
    }
    
    await conn.commit();
    return res.json({ ok: true, deletedCount: ids.length });
  } catch (e) {
    await conn.rollback();
    console.error('Bulk delete categories error:', e);
    return res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Admin: inventory set (WITH LOCK to prevent race conditions)
app.patch('/admin/catalog/inventory/:productId', async (req, res) => {
  const { productId } = req.params;
  const { stock } = req.body;
  if (stock === undefined || stock < 0) return res.status(400).json({ error: 'Invalid stock' });
  
  try {
    // Use distributed lock to prevent concurrent inventory updates
    await lockManager.withLock(`inventory:${productId}`, async () => {
      await pool.query('INSERT INTO inventory (product_id, stock) VALUES (?, ?) ON DUPLICATE KEY UPDATE stock=VALUES(stock)', [productId, stock]);
    }, { ttlSeconds: 5 });
    
    return res.json({ ok: true });
  } catch (error) {
    console.error('Inventory update error:', error);
    return res.status(500).json({ error: 'Không thể cập nhật kho hàng. Vui lòng thử lại.' });
  }
});

// ============ BANNERS API ============
// Get all banners
app.get('/admin/banners', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM banners ORDER BY display_order ASC, id DESC'
    );
    return res.json(rows);
  } catch (error) {
    console.error('Get banners error:', error);
    return res.status(500).json({ error: 'Failed to load banners' });
  }
});

// Get single banner
app.get('/admin/banners/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM banners WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Banner not found' });
    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load banner' });
  }
});

// Create banner
app.post('/admin/banners', async (req, res) => {
  try {
    const { title, subtitle, imageUrl, linkUrl, active, displayOrder } = req.body;
    if (!title || !imageUrl) {
      return res.status(400).json({ error: 'Title and image are required' });
    }
    const [result] = await pool.query(
      'INSERT INTO banners (title, subtitle, image_url, link_url, active, display_order) VALUES (?, ?, ?, ?, ?, ?)',
      [title, subtitle || '', imageUrl, linkUrl || '', active ? 1 : 0, displayOrder || 0]
    );
    return res.json({ id: result.insertId, ok: true });
  } catch (error) {
    console.error('Create banner error:', error);
    return res.status(500).json({ error: 'Failed to create banner' });
  }
});

// Update banner
app.put('/admin/banners/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, imageUrl, linkUrl, active, displayOrder } = req.body;
    if (!title || !imageUrl) {
      return res.status(400).json({ error: 'Title and image are required' });
    }
    await pool.query(
      'UPDATE banners SET title=?, subtitle=?, image_url=?, link_url=?, active=?, display_order=? WHERE id=?',
      [title, subtitle || '', imageUrl, linkUrl || '', active ? 1 : 0, displayOrder || 0, id]
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error('Update banner error:', error);
    return res.status(500).json({ error: 'Failed to update banner' });
  }
});

// Patch banner (partial update, e.g., toggle active)
app.patch('/admin/banners/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    if (active !== undefined) {
      await pool.query('UPDATE banners SET active=? WHERE id=?', [active ? 1 : 0, id]);
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update banner' });
  }
});

// Delete banner
app.delete('/admin/banners/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM banners WHERE id=?', [req.params.id]);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Delete banner error:', error);
    return res.status(500).json({ error: 'Failed to delete banner' });
  }
});

// ============================
// PRODUCT REVIEWS APIs
// ============================

// Public: Get reviews for a product with pagination and rating filter
app.get('/catalog/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const ratingFilter = req.query.rating ? parseInt(req.query.rating, 10) : null;

    let query = `
      SELECT r.id, r.product_id, r.user_id, r.rating, r.comment, r.admin_reply, 
             r.created_at, r.updated_at,
             u.full_name as user_name, u.email as user_email
      FROM product_reviews r
      LEFT JOIN auth_db.users u ON r.user_id = u.id
      WHERE r.product_id = ?
    `;
    const params = [id];

    if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
      query += ' AND r.rating = ?';
      params.push(ratingFilter);
    }

    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [reviews] = await pool.query(query, params);

    // Load comments for each review
    for (const review of reviews) {
      const [comments] = await pool.query(
        `SELECT rc.id, rc.user_id, rc.is_admin, rc.comment, rc.created_at,
                u.full_name as user_name, u.email as user_email
         FROM review_comments rc
         LEFT JOIN auth_db.users u ON rc.user_id = u.id
         WHERE rc.review_id = ?
         ORDER BY rc.created_at ASC`,
        [review.id]
      );
      review.comments = comments;
    }

    // Get average rating and total count (ALL reviews, unfiltered)
    const [[stats]] = await pool.query(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
       FROM product_reviews WHERE product_id = ?`,
      [id]
    );

    // Get filtered count (for pagination)
    let filteredCountQuery = 'SELECT COUNT(*) as filtered_count FROM product_reviews WHERE product_id = ?';
    const filteredParams = [id];
    if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
      filteredCountQuery += ' AND rating = ?';
      filteredParams.push(ratingFilter);
    }
    const [[filteredCount]] = await pool.query(filteredCountQuery, filteredParams);

    // Get rating distribution (ALL reviews, unfiltered)
    const [distribution] = await pool.query(
      `SELECT rating, COUNT(*) as count
       FROM product_reviews WHERE product_id = ?
       GROUP BY rating ORDER BY rating DESC`,
      [id]
    );

    return res.json({
      reviews,
      stats: {
        average: stats.avg_rating ? parseFloat(parseFloat(stats.avg_rating).toFixed(1)) : 0,
        total: stats.total_reviews || 0,
        filtered: filteredCount.filtered_count || 0
      },
      distribution: distribution.reduce((acc, d) => {
        acc[d.rating] = d.count;
        return acc;
      }, {})
    });
  } catch (e) {
    console.error('Get reviews error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Protected: Submit a review (requires authentication)
app.post('/catalog/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, rating, comment } = req.body;

    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if product exists
    const [[product]] = await pool.query('SELECT id FROM products WHERE id = ?', [id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Always create new review (allow multiple reviews from same user)
    const [result] = await pool.query(
      'INSERT INTO product_reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
      [id, userId, rating, comment || null]
    );
    return res.json({ message: 'Review created', reviewId: result.insertId });
  } catch (e) {
    console.error('Submit review error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Protected: Get all reviews by user (for notifications page)
app.get('/catalog/products/reviews/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const [reviews] = await pool.query(
      `SELECT r.id, r.product_id, r.user_id, r.rating, r.comment, r.admin_reply,
              r.created_at, r.updated_at,
              p.name as product_name,
              u.full_name as user_name, u.email as user_email
       FROM product_reviews r
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN auth_db.users u ON r.user_id = u.id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [userId]
    );

    // Load comments for each review
    for (const review of reviews) {
      const [comments] = await pool.query(
        `SELECT rc.id, rc.user_id, rc.is_admin, rc.comment, rc.created_at,
                u.full_name as user_name, u.email as user_email
         FROM review_comments rc
         LEFT JOIN auth_db.users u ON rc.user_id = u.id
         WHERE rc.review_id = ?
         ORDER BY rc.created_at ASC`,
        [review.id]
      );
      review.comments = comments;
    }

    return res.json(reviews);
  } catch (e) {
    console.error('Get user reviews error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Get all reviews with filters and user info
app.get('/admin/reviews', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const ratingFilter = req.query.rating ? parseInt(req.query.rating, 10) : null;
    const hasReply = req.query.hasReply === 'true' ? true : req.query.hasReply === 'false' ? false : null;

    let query = `
      SELECT r.id, r.product_id, r.user_id, r.rating, r.comment, r.admin_reply,
             r.created_at, r.updated_at, p.name as product_name,
             u.full_name as user_name, u.email as user_email
      FROM product_reviews r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN auth_db.users u ON r.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
      query += ' AND r.rating = ?';
      params.push(ratingFilter);
    }

    if (hasReply === true) {
      query += ' AND (r.admin_reply IS NOT NULL OR EXISTS (SELECT 1 FROM review_comments WHERE review_id = r.id))';
    } else if (hasReply === false) {
      query += ' AND r.admin_reply IS NULL AND NOT EXISTS (SELECT 1 FROM review_comments WHERE review_id = r.id)';
    }

    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [reviews] = await pool.query(query, params);

    // Load comments for each review
    for (const review of reviews) {
      const [comments] = await pool.query(
        `SELECT rc.id, rc.user_id, rc.is_admin, rc.comment, rc.created_at,
                u.full_name as user_name, u.email as user_email
         FROM review_comments rc
         LEFT JOIN auth_db.users u ON rc.user_id = u.id
         WHERE rc.review_id = ?
         ORDER BY rc.created_at ASC`,
        [review.id]
      );
      review.comments = comments;
      review.has_comments = comments.length > 0;
    }

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM product_reviews r WHERE 1=1';
    const countParams = [];
    if (ratingFilter) {
      countQuery += ' AND r.rating = ?';
      countParams.push(ratingFilter);
    }
    if (hasReply === true) {
      countQuery += ' AND (r.admin_reply IS NOT NULL OR EXISTS (SELECT 1 FROM review_comments WHERE review_id = r.id))';
    } else if (hasReply === false) {
      countQuery += ' AND r.admin_reply IS NULL AND NOT EXISTS (SELECT 1 FROM review_comments WHERE review_id = r.id)';
    }

    const [[{ total }]] = await pool.query(countQuery, countParams);

    return res.json({ reviews, total });
  } catch (e) {
    console.error('Get admin reviews error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Reply to a review
app.patch('/admin/reviews/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminReply } = req.body;

    if (adminReply === undefined) {
      return res.status(400).json({ error: 'adminReply is required' });
    }

    const [result] = await pool.query(
      'UPDATE product_reviews SET admin_reply = ?, replied_at = IF(? IS NOT NULL, NOW(), NULL), updated_at = NOW() WHERE id = ?',
      [adminReply || null, adminReply, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    return res.json({ message: 'Reply updated successfully' });
  } catch (e) {
    console.error('Reply to review error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Protected: Post a comment on a review (user or admin)
app.post('/catalog/reviews/:reviewId/comments', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { userId, comment, isAdmin } = req.body;

    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    // Check if review exists
    const [[review]] = await pool.query('SELECT id FROM product_reviews WHERE id = ?', [reviewId]);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    // Insert comment
    const [result] = await pool.query(
      'INSERT INTO review_comments (review_id, user_id, is_admin, comment) VALUES (?, ?, ?, ?)',
      [reviewId, userId, isAdmin ? 1 : 0, comment.trim()]
    );

    return res.json({ message: 'Comment posted', commentId: result.insertId });
  } catch (e) {
    console.error('Post comment error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Delete a review
app.delete('/admin/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM product_reviews WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    return res.json({ message: 'Review deleted successfully' });
  } catch (e) {
    console.error('Delete review error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Update product stock (for inventory management)
app.patch('/admin/products/:id/stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { delta } = req.body; // positive to increase, negative to decrease
    
    if (typeof delta !== 'number') {
      return res.status(400).json({ error: 'Invalid delta value' });
    }
    
    // Update stock with safeguard against negative values
    await pool.query(
      'UPDATE products SET stock = GREATEST(0, stock + ?) WHERE id = ?',
      [delta, id]
    );
    
    const [[product]] = await pool.query('SELECT stock FROM products WHERE id = ?', [id]);
    return res.json({ ok: true, stock: product?.stock || 0 });
  } catch (e) {
    console.error('Update stock error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 🔒 CRITICAL: Reserve inventory for order (WITH DISTRIBUTED LOCK)
// Called by order-service during checkout
app.post('/catalog/inventory/reserve', async (req, res) => {
  const conn = await pool.getConnection();
  
  try {
    const { items } = req.body; // [{ productId, quantity }]
    
    if (!items || !Array.isArray(items)) {
      conn.release();
      return res.status(400).json({ error: 'Invalid items array', success: false });
    }

    await conn.beginTransaction();

    for (const item of items) {
      const { productId, quantity } = item;

      // 🔒 CRITICAL: Distributed lock để prevent concurrent reservations
      const lockKey = `inventory:reserve:${productId}`;
      const lockToken = await lockManager.acquireLock(lockKey, 5000);
      
      if (!lockToken) {
        await conn.rollback();
        conn.release();
        console.log(`⏳ Failed to acquire lock for product ${productId}`);
        return res.status(409).json({ 
          error: 'Product is being processed', 
          success: false 
        });
      }

      try {
        // SELECT FOR UPDATE for pessimistic locking at DB level
        const [[inventory]] = await conn.query(
          'SELECT stock FROM inventory WHERE product_id = ? FOR UPDATE',
          [productId]
        );

        const currentStock = inventory ? inventory.stock : 0;

        if (currentStock < quantity) {
          // ❌ OUT OF STOCK
          await conn.rollback();
          await lockManager.releaseLock(lockKey, lockToken);
          conn.release();
          console.log(`❌ Out of stock for product ${productId}: have ${currentStock}, need ${quantity}`);
          return res.json({ 
            success: false, 
            error: `Không đủ hàng cho sản phẩm ID ${productId}. Còn ${currentStock}, yêu cầu ${quantity}`,
            outOfStock: true
          });
        }

        // ✅ Deduct stock
        await conn.query(
          'UPDATE inventory SET stock = stock - ? WHERE product_id = ?',
          [quantity, productId]
        );

        console.log(`✅ Reserved ${quantity} units of product ${productId}. Stock: ${currentStock} → ${currentStock - quantity}`);
        await lockManager.releaseLock(lockKey, lockToken);

      } catch (error) {
        await lockManager.releaseLock(lockKey, lockToken);
        throw error;
      }
    }

    await conn.commit();
    console.log(`✅ Successfully reserved inventory for ${items.length} product(s)`);
    return res.json({ success: true });

  } catch (error) {
    await conn.rollback();
    console.error('❌ Inventory reservation error:', error);
    return res.status(500).json({ 
      error: error.message || 'Không thể đặt trước hàng. Vui lòng thử lại.',
      success: false 
    });
  } finally {
    conn.release();
  }
});

// 🔓 Release reserved inventory (called when order is cancelled)
app.post('/catalog/inventory/release', async (req, res) => {
  try {
    const { items } = req.body; // [{ productId, quantity }]
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid items array' });
    }

    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      for (const item of items) {
        const { productId, quantity } = item;

        // Use distributed lock
        await lockManager.withLock(`inventory:release:${productId}`, async () => {
          await conn.query(
            'UPDATE inventory SET stock = stock + ? WHERE product_id = ?',
            [quantity, productId]
          );
        }, { ttlSeconds: 5 });
      }

      await conn.commit();
      return res.json({ success: true, message: 'Inventory released' });

    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }

  } catch (error) {
    console.error('Inventory release error:', error);
    return res.status(500).json({ 
      error: 'Không thể hoàn trả hàng. Vui lòng liên hệ admin.',
      success: false 
    });
  }
});

// Connect to Redis on startup
lockManager.connect().then(() => {
  console.log('✅ Catalog service Redis lock manager ready');
}).catch(err => {
  console.error('❌ Redis connection failed:', err);
  console.warn('⚠️ Service will run WITHOUT distributed locks');
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Catalog service listening on ${PORT}`);
});


