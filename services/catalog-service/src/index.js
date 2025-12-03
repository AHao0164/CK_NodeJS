import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import mysql from 'mysql2/promise';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Client } from '@elastic/elasticsearch';
import RedisLockManager from '../shared/RedisLockManager.js';
import { setupOrderEventHandlers } from './eventHandlers.js';
import { chatWithAI, generateProductRecommendations } from './ai/chatbot.js';
import { searchProductsByImageBuffer } from './ai/image-search.js';
import { analyzeReviewSentiment, getSentimentStatistics } from './ai/sentiment-analysis.js';
import { isAIAvailable } from './ai/gemini-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Redis Lock Manager
const lockManager = new RedisLockManager();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

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

// Initialize ElasticSearch client
const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  requestTimeout: 60000,
  pingTimeout: 3000,
});

const ES_INDEX_NAME = 'products';

// Ensure guest_comments table exists
async function ensureGuestCommentsTable() {
  try {
    // Check if table exists
    const [tables] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       AND table_name = 'guest_comments'`
    );
    
    if (tables[0].count === 0) {
      console.log('Creating guest_comments table...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS guest_comments (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          product_id BIGINT NOT NULL,
          guest_name VARCHAR(255) NOT NULL,
          comment TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          INDEX idx_product (product_id),
          INDEX idx_created (created_at)
        )
      `);
      console.log('guest_comments table created successfully');
    }
  } catch (error) {
    console.error('Failed to ensure guest_comments table:', error);
    // Don't throw - let the endpoint handle it
  }
}

// Initialize ElasticSearch index
async function initElasticSearchIndex() {
  try {
    const exists = await esClient.indices.exists({ index: ES_INDEX_NAME });
    if (!exists) {
      await esClient.indices.create({
        index: ES_INDEX_NAME,
        body: {
          settings: {
            analysis: {
              analyzer: {
                vietnamese_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'asciifolding']
                }
              }
            }
          },
          mappings: {
            properties: {
              id: { type: 'integer' },
              name: {
                type: 'text',
                analyzer: 'vietnamese_analyzer',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              description: {
                type: 'text',
                analyzer: 'vietnamese_analyzer'
              },
              sku: { type: 'keyword' },
              price_cents: { type: 'integer' },
              discount_percent: { type: 'integer' },
              brand_id: { type: 'integer' },
              brand: {
                type: 'text',
                analyzer: 'vietnamese_analyzer',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              category_id: { type: 'integer' },
              category: {
                type: 'text',
                analyzer: 'vietnamese_analyzer',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              stock: { type: 'integer' },
              image_url: { type: 'keyword' },
              specs: { type: 'object', enabled: false },
              features: { type: 'object', enabled: false },
              avg_rating: { type: 'float' },
              review_count: { type: 'integer' }
            }
          }
        }
      });
      console.log('ElasticSearch index created successfully');
    } else {
      console.log('ElasticSearch index already exists');
    }
  } catch (error) {
    console.error('Error initializing ElasticSearch index:', error.message);
    // Don't throw - allow service to continue with MySQL fallback
  }
}

// Sync product to ElasticSearch
async function syncProductToES(product) {
  try {
    if (!product || !product.id) return;
    
    const esDoc = {
      id: product.id,
      name: product.name || '',
      description: product.description || '',
      sku: product.sku || '',
      price_cents: product.price_cents || 0,
      discount_percent: product.discount_percent || 0,
      brand_id: product.brand_id || null,
      brand: product.brand || '',
      category_id: product.category_id || null,
      category: product.category || '',
      stock: product.stock || 0,
      image_url: product.image_url || '',
      specs: product.specs || {},
      features: product.features || [],
      avg_rating: product.avg_rating || 0,
      review_count: product.review_count || 0
    };

    await esClient.index({
      index: ES_INDEX_NAME,
      id: product.id.toString(),
      body: esDoc,
      refresh: false // Don't wait for refresh for better performance
    });
  } catch (error) {
    console.error(`Error syncing product ${product?.id} to ElasticSearch:`, error.message);
    // Don't throw - allow service to continue
  }
}

// Delete product from ElasticSearch
async function deleteProductFromES(productId) {
  try {
    await esClient.delete({
      index: ES_INDEX_NAME,
      id: productId.toString(),
      refresh: false
    });
  } catch (error) {
    if (error.statusCode !== 404) {
      console.error(`Error deleting product ${productId} from ElasticSearch:`, error.message);
    }
  }
}

// Bulk sync products to ElasticSearch
async function bulkSyncProductsToES(products) {
  try {
    if (!products || products.length === 0) return;
    
    const body = products.flatMap(product => [
      { index: { _index: ES_INDEX_NAME, _id: product.id.toString() } },
      {
        id: product.id,
        name: product.name || '',
        description: product.description || '',
        sku: product.sku || '',
        price_cents: product.price_cents || 0,
        discount_percent: product.discount_percent || 0,
        brand_id: product.brand_id || null,
        brand: product.brand || '',
        category_id: product.category_id || null,
        category: product.category || '',
        stock: product.stock || 0,
        image_url: product.image_url || '',
        specs: product.specs || {},
        features: product.features || [],
        avg_rating: product.avg_rating || 0,
        review_count: product.review_count || 0
      }
    ]);

    await esClient.bulk({ refresh: false, body });
    console.log(`Synced ${products.length} products to ElasticSearch`);
  } catch (error) {
    console.error('Error bulk syncing products to ElasticSearch:', error.message);
  }
}

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

// Search products using ElasticSearch with MySQL fallback
async function searchProductsWithES(params) {
  const { q, page, pageSize, sort, categoryId, brandId, minPrice, maxPrice, minRating } = params;
  const offset = (page - 1) * pageSize;
  
  try {
    // Build ElasticSearch query
    const mustClauses = [];
    const filterClauses = [];
    
    // Text search
    if (q && q.trim()) {
      mustClauses.push({
        multi_match: {
          query: q,
          fields: ['name^3', 'description^2', 'brand^2', 'category^2', 'sku'],
          type: 'best_fields',
          fuzziness: 'AUTO',
          operator: 'or'
        }
      });
    }
    
    // Filters
    if (categoryId) {
      filterClauses.push({ term: { category_id: categoryId } });
    }
    if (brandId) {
      filterClauses.push({ term: { brand_id: brandId } });
    }
    if (minPrice !== null || maxPrice !== null) {
      const priceRange = {};
      if (minPrice !== null) priceRange.gte = minPrice;
      if (maxPrice !== null) priceRange.lte = maxPrice;
      filterClauses.push({ range: { price_cents: priceRange } });
    }
    if (minRating !== null) {
      filterClauses.push({ range: { avg_rating: { gte: minRating } } });
    }
    
    // Build sort
    let sortClause = [];
    if (q && sort === 'id_desc') {
      // Use relevance score for search queries
      sortClause = [{ _score: { order: 'desc' } }, { id: { order: 'desc' } }];
    } else {
      switch (sort) {
        case 'price_asc':
          sortClause = [{ price_cents: { order: 'asc' } }];
          break;
        case 'price_desc':
          sortClause = [{ price_cents: { order: 'desc' } }];
          break;
        case 'name_asc':
          sortClause = [{ 'name.keyword': { order: 'asc' } }];
          break;
        case 'name_desc':
          sortClause = [{ 'name.keyword': { order: 'desc' } }];
          break;
        default:
          sortClause = [{ id: { order: 'desc' } }];
      }
    }
    
    const query = {
      index: ES_INDEX_NAME,
      body: {
        query: {
          bool: {
            must: mustClauses.length > 0 ? mustClauses : [{ match_all: {} }],
            filter: filterClauses
          }
        },
        sort: sortClause,
        from: offset,
        size: pageSize
      }
    };
    
    const response = await esClient.search(query);
    const total = typeof response.body.hits.total === 'object' 
      ? response.body.hits.total.value 
      : response.body.hits.total;
    const productIds = response.body.hits.hits.map(hit => hit._source.id);
    
    if (productIds.length === 0) {
      return { items: [], total: 0 };
    }
    
    // Fetch full product data from MySQL (with reviews, inventory, etc.)
    const placeholders = productIds.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price_cents, p.discount_percent, p.specs, p.features, p.image_url,
              b.name AS brand, c.name AS category, i.stock, p.brand_id, p.category_id,
              COALESCE(AVG(pr.rating), 0) AS avg_rating, COUNT(pr.id) AS review_count
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN inventory i ON i.product_id = p.id
       LEFT JOIN product_reviews pr ON pr.product_id = p.id
       WHERE p.id IN (${placeholders})
       GROUP BY p.id, p.name, p.description, p.price_cents, p.discount_percent, p.specs, p.features, p.image_url,
                b.name, c.name, i.stock, p.brand_id, p.category_id
       ORDER BY FIELD(p.id, ${placeholders})`,
      [...productIds, ...productIds]
    );
    
    // Apply minRating filter if needed (after getting review data)
    let filteredRows = rows;
    if (minRating !== null) {
      filteredRows = rows.filter(p => (p.avg_rating || 0) >= minRating);
    }
    
    parseProductsArray(filteredRows);

    // Fetch images for all products in batch
    let productImagesMap = {};
    if (productIds.length > 0) {
      const imagePlaceholders = productIds.map(() => '?').join(',');
      const [imageRows] = await pool.query(
        `SELECT product_id, url, sort_order 
         FROM product_images 
         WHERE product_id IN (${imagePlaceholders}) 
         ORDER BY product_id, sort_order`,
        productIds
      );
      
      // Group images by product_id
      imageRows.forEach(img => {
        if (!productImagesMap[img.product_id]) {
          productImagesMap[img.product_id] = [];
        }
        productImagesMap[img.product_id].push({ url: img.url, sort_order: img.sort_order });
      });
    }

    // Attach images array to each product
    filteredRows.forEach(product => {
      product.images = productImagesMap[product.id] || [];
    });
    
    return { items: filteredRows, total };
  } catch (error) {
    console.error('ElasticSearch search error:', error.message);
    // Fallback to MySQL search
    return null;
  }
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
  try {
    const q = String(req.query.q || '').trim();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10), 1), 100);
    const sort = String(req.query.sort || 'id_desc');
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId, 10) : null;
    const brandId = req.query.brandId ? parseInt(req.query.brandId, 10) : null;
    const minPrice = req.query.minPrice ? parseInt(req.query.minPrice, 10) : null;
    const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice, 10) : null;
    const minRating = req.query.minRating ? parseFloat(req.query.minRating) : null;
    
    // Try ElasticSearch first
    const esResult = await searchProductsWithES({
      q, page, pageSize, sort, categoryId, brandId, minPrice, maxPrice, minRating
    });
    
    if (esResult !== null) {
      return res.json({ items: esResult.items, page, pageSize, total: esResult.total });
    }
    
    // Fallback to MySQL search
    console.log('Falling back to MySQL search');
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
      // Sort by final price (after discount) for price sorting
      sortSql =
        sort === 'price_asc' ? '(p.price_cents * (100 - COALESCE(p.discount_percent, 0)) / 100) ASC' :
          sort === 'price_desc' ? '(p.price_cents * (100 - COALESCE(p.discount_percent, 0)) / 100) DESC' :
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
    
    // Filter by rating - need to use HAVING clause after GROUP BY
    let havingClause = '';
    const havingParams = [];
    if (minRating !== null && minRating >= 0 && minRating <= 5) {
      havingClause = 'HAVING AVG(pr.rating) >= ?';
      havingParams.push(minRating);
    }
    
    const finalParams = [...params, ...sortParams, ...havingParams, pageSize, offset];

    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price_cents, p.discount_percent, p.specs, p.features, p.image_url,
              b.name AS brand, c.name AS category, i.stock, p.brand_id, p.category_id,
              COALESCE(AVG(pr.rating), 0) AS avg_rating, COUNT(pr.id) AS review_count
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN inventory i ON i.product_id = p.id
       LEFT JOIN product_reviews pr ON pr.product_id = p.id
       ${whereSql}
       GROUP BY p.id, p.name, p.description, p.price_cents, p.discount_percent, p.specs, p.features, p.image_url,
                b.name, c.name, i.stock, p.brand_id, p.category_id
       ${havingClause}
       ORDER BY ${sortSql}, p.id DESC
       LIMIT ? OFFSET ?`,
      finalParams
    );

    // Count query with same filters
    let countQuery;
    let countParams;
    if (havingClause) {
      countQuery = `
        SELECT COUNT(*) AS total 
        FROM (
          SELECT p.id
          FROM products p
          LEFT JOIN brands b ON b.id = p.brand_id 
          LEFT JOIN categories c ON c.id = p.category_id
          LEFT JOIN product_reviews pr ON pr.product_id = p.id
          ${whereSql}
          GROUP BY p.id
          ${havingClause}
        ) AS filtered_products
      `;
      countParams = [...params, ...havingParams];
    } else {
      countQuery = `
        SELECT COUNT(DISTINCT p.id) AS total 
        FROM products p
        LEFT JOIN brands b ON b.id = p.brand_id 
        LEFT JOIN categories c ON c.id = p.category_id
        ${whereSql}
      `;
      countParams = [...params];
    }
    const [[{ total }]] = await pool.query(countQuery, countParams);

    // Parse JSON fields for all products
    parseProductsArray(rows);

    // Fetch images for all products in batch (more efficient than per-product queries)
    const productIds = rows.map(r => r.id);
    let productImagesMap = {};
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      const [imageRows] = await pool.query(
        `SELECT product_id, url, sort_order 
         FROM product_images 
         WHERE product_id IN (${placeholders}) 
         ORDER BY product_id, sort_order`,
        productIds
      );
      
      // Group images by product_id
      imageRows.forEach(img => {
        if (!productImagesMap[img.product_id]) {
          productImagesMap[img.product_id] = [];
        }
        productImagesMap[img.product_id].push({ url: img.url, sort_order: img.sort_order });
      });
    }

    // Attach images array to each product
    rows.forEach(product => {
      product.images = productImagesMap[product.id] || [];
    });

    return res.json({ items: rows, page, pageSize, total });
  } catch (error) {
    console.error('Error in /catalog/products:', error);
    return res.status(500).json({ error: 'Server error' });
  }
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
  
  // Get variants with inventory
  const [variants] = await pool.query(
    `SELECT v.id, v.name, v.sku, v.price_cents, v.discount_percent, v.image_url, v.attributes, v.display_order,
            COALESCE(vi.stock, 0) AS stock
     FROM product_variants v
     LEFT JOIN variant_inventory vi ON vi.variant_id = v.id
     WHERE v.product_id = ?
     ORDER BY v.display_order ASC, v.id ASC`,
    [id]
  );
  
  // Parse JSON fields
  parseJsonFields(product);
  
  // Parse variant attributes
  variants.forEach(v => {
    if (v.attributes && typeof v.attributes === 'string') {
      try {
        v.attributes = JSON.parse(v.attributes);
      } catch (e) {
        v.attributes = {};
      }
    }
  });
  
  return res.json({ 
    ...product, 
    images, 
    stock: inv ? inv.stock : 0,
    variants: variants.length > 0 ? variants : null // null if no variants, array if has variants
  });
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

// AI Chatbot: Chat với AI để được tư vấn sản phẩm
app.post('/catalog/ai/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!isAIAvailable()) {
      return res.status(503).json({ 
        error: 'AI service not available. Please configure GEMINI_API_KEY.' 
      });
    }

    // Get available products for context
    // Try to find relevant products first based on keywords in the message
    const messageLower = message.toLowerCase();
    let productsQuery = `
      SELECT p.id, p.name, p.description, p.price_cents, p.discount_percent, p.image_url,
             b.name AS brand, c.name AS category
      FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN categories c ON c.id = p.category_id
    `;
    
    // Smart filtering based on common keywords
    const keywords = {
      'tai nghe': ['headset', 'tai nghe', 'headphone', 'earphone'],
      'bàn phím': ['keyboard', 'bàn phím', 'bàn phim'],
      'chuột': ['mouse', 'chuột'],
      'màn hình': ['monitor', 'màn hình', 'screen'],
      'laptop': ['laptop', 'notebook'],
      'pc': ['pc', 'máy tính', 'desktop']
    };
    
    let whereClause = '';
    let params = [];
    
    for (const [key, terms] of Object.entries(keywords)) {
      if (terms.some(term => messageLower.includes(term))) {
        const conditions = terms.map(term => 
          `(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(c.name) LIKE ?)`
        );
        whereClause = `WHERE (${conditions.join(' OR ')})`;
        terms.forEach(term => {
          params.push(`%${term}%`, `%${term}%`, `%${term}%`);
        });
        break;
      }
    }
    
    // If no specific match, get all products but prioritize by relevance
    // Giảm từ 100 xuống 50 để tăng tốc độ và tránh timeout
    if (!whereClause) {
      productsQuery += ` ORDER BY p.id DESC LIMIT 50`;
    } else {
      productsQuery += ` ${whereClause} ORDER BY p.id DESC LIMIT 50`;
    }
    
    const [products] = await pool.query(productsQuery, params);

    const chatResult = await chatWithAI(message, products);

    // Validate chatResult - ensure it's not undefined
    if (!chatResult || typeof chatResult !== 'object') {
      console.error('Chatbot returned invalid result:', chatResult);
      // Return 200 with error in body instead of 503 for better UX
      return res.status(200).json({ 
        error: 'AI service returned invalid response. Please try again.',
        response: 'Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này. Vui lòng thử lại sau.',
        suggestedProducts: [],
        searchKeywords: []
      });
    }

    // Check if chatResult has error
    if (chatResult.error) {
      console.error('Chatbot returned error:', chatResult.error);
      // Return 200 with error in body instead of 503 for better UX
      // Frontend can check error field to show appropriate message
      return res.status(200).json({ 
        error: chatResult.error || 'AI service temporarily unavailable. Please try again.',
        response: chatResult.response || 'Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này. Vui lòng thử lại sau.',
        suggestedProducts: [],
        searchKeywords: chatResult.searchKeywords || []
      });
    }

    // Fetch suggested products if any
    let suggestedProducts = [];
    if (chatResult.suggestedProductIds && Array.isArray(chatResult.suggestedProductIds) && chatResult.suggestedProductIds.length > 0) {
      try {
        const placeholders = chatResult.suggestedProductIds.map(() => '?').join(',');
        const [suggested] = await pool.query(
          `SELECT p.id, p.name, p.description, p.price_cents, p.discount_percent, p.image_url,
                  b.name AS brand, c.name AS category
           FROM products p
           LEFT JOIN brands b ON b.id = p.brand_id
           LEFT JOIN categories c ON c.id = p.category_id
           WHERE p.id IN (${placeholders})`,
          chatResult.suggestedProductIds
        );
        parseProductsArray(suggested);
        suggestedProducts = suggested;
      } catch (dbError) {
        console.error('Error fetching suggested products:', dbError);
        // Continue without suggested products
      }
    }

    return res.json({
      response: chatResult.response || 'Xin lỗi, tôi không thể trả lời câu hỏi này.',
      suggestedProducts: suggestedProducts,
      searchKeywords: chatResult.searchKeywords || [],
      reasoning: chatResult.reasoning || ''
    });
  } catch (error) {
    console.error('AI chat error:', error);
    console.error('Error stack:', error.stack);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to process chat request';
    let statusCode = 500;
    
    if (error.message?.includes('timeout') || error.message?.includes('TIMEOUT')) {
      errorMessage = 'Request timeout. Please try again.';
      statusCode = 504;
    } else if (error.message?.includes('quota') || error.message?.includes('rate limit') || error.message?.includes('429')) {
      errorMessage = 'AI service is busy. Please try again in a moment.';
      statusCode = 503;
    } else if (error.message?.includes('API_KEY') || error.message?.includes('401')) {
      errorMessage = 'AI service configuration error.';
      statusCode = 503;
    }
    
    return res.status(statusCode).json({ 
      error: errorMessage,
      response: 'Xin lỗi, có lỗi xảy ra khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.',
      suggestedProducts: [],
      searchKeywords: []
    });
  }
});

// AI Image Search: Tìm sản phẩm bằng hình ảnh
app.post('/catalog/ai/search-by-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    if (!isAIAvailable()) {
      return res.status(503).json({ 
        error: 'AI service not available. Please configure GEMINI_API_KEY.' 
      });
    }

    // Get available products for matching - Giảm từ 100 xuống 50 để tăng tốc độ
    const [products] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price_cents, p.discount_percent, p.image_url,
              b.name AS brand, c.name AS category, p.specs, p.features
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       LIMIT 50`
    );

    parseProductsArray(products);

    // Analyze image
    const imageBuffer = fs.readFileSync(req.file.path);
    const mimeType = req.file.mimetype;
    const searchResult = await searchProductsByImageBuffer(imageBuffer, mimeType, products);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Nếu có error (ví dụ: hình ảnh không liên quan đến điện tử)
    if (searchResult.error) {
      const statusCode = searchResult.isRelevant === false ? 200 : 500;
      return res.status(statusCode).json({ 
        error: searchResult.error,
        description: searchResult.description || searchResult.error,
        matches: [],
        products: [],
        searchKeywords: []
      });
    }

    // Fetch matched products
    let matchedProducts = [];
    if (searchResult.matches && searchResult.matches.length > 0) {
      const productIds = searchResult.matches.map(m => m.productId);
      const placeholders = productIds.map(() => '?').join(',');
      const [matched] = await pool.query(
        `SELECT p.id, p.name, p.description, p.price_cents, p.discount_percent, p.image_url,
                b.name AS brand, c.name AS category
         FROM products p
         LEFT JOIN brands b ON b.id = p.brand_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.id IN (${placeholders})`,
        productIds
      );
      parseProductsArray(matched);
      
      // Sort by similarity
      matchedProducts = productIds.map(id => 
        matched.find(p => p.id === id)
      ).filter(Boolean);
    }

    return res.json({
      description: searchResult.description,
      features: searchResult.features || [],
      matches: searchResult.matches || [],
      products: matchedProducts,
      searchKeywords: searchResult.searchKeywords || []
    });
  } catch (error) {
    console.error('Image search error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: 'Failed to analyze image' });
  }
});

// AI Sentiment Analysis: Phân tích cảm xúc của reviews
app.post('/catalog/ai/analyze-sentiment', async (req, res) => {
  try {
    const { reviewText, productId } = req.body;

    if (!reviewText && !productId) {
      return res.status(400).json({ error: 'Either reviewText or productId is required' });
    }

    if (!isAIAvailable()) {
      return res.status(503).json({ 
        error: 'AI service not available. Please configure GEMINI_API_KEY.' 
      });
    }

    let analysis;

    if (productId) {
      // Analyze all reviews for a product
      const [reviews] = await pool.query(
        `SELECT id, comment, rating, user_id, created_at 
         FROM product_reviews 
         WHERE product_id = ? 
         ORDER BY created_at DESC`,
        [productId]
      );

      if (reviews.length === 0) {
        return res.status(404).json({ error: 'No reviews found for this product' });
      }

      const statistics = await getSentimentStatistics(reviews);
      const individualAnalyses = await Promise.all(
        reviews.map(r => analyzeReviewSentiment(r.comment || ''))
      );

      analysis = {
        productId: parseInt(productId),
        statistics: statistics,
        reviews: reviews.map((r, idx) => ({
          reviewId: r.id,
          sentiment: individualAnalyses[idx].sentiment,
          score: individualAnalyses[idx].score,
          confidence: individualAnalyses[idx].confidence,
          keywords: individualAnalyses[idx].keywords || [],
          summary: individualAnalyses[idx].summary || ''
        }))
      };
    } else {
      // Analyze single review text
      const result = await analyzeReviewSentiment(reviewText);
      analysis = {
        sentiment: result.sentiment,
        score: result.score,
        confidence: result.confidence,
        keywords: result.keywords || [],
        summary: result.summary || ''
      };
    }

    return res.json(analysis);
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return res.status(500).json({ error: 'Failed to analyze sentiment' });
  }
});

// AI Product Recommendations: Đề xuất sản phẩm dựa trên preferences
app.post('/catalog/ai/recommendations', async (req, res) => {
  try {
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'string') {
      return res.status(400).json({ error: 'Preferences text is required' });
    }

    if (!isAIAvailable()) {
      return res.status(503).json({ 
        error: 'AI service not available. Please configure GEMINI_API_KEY.' 
      });
    }

    // Get available products
    const [products] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price_cents, p.discount_percent, p.image_url,
              b.name AS brand, c.name AS category,
              COALESCE(AVG(pr.rating), 0) AS avg_rating
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN product_reviews pr ON pr.product_id = p.id
       GROUP BY p.id, p.name, p.description, p.price_cents, p.discount_percent, p.image_url,
                b.name, c.name
       LIMIT 50`
    );

    parseProductsArray(products);

    const recommendations = await generateProductRecommendations(preferences, products);

    // Fetch recommended products
    let recommendedProducts = [];
    if (recommendations.recommendations && recommendations.recommendations.length > 0) {
      const productIds = recommendations.recommendations.map(r => r.productId);
      const placeholders = productIds.map(() => '?').join(',');
      const [recommended] = await pool.query(
        `SELECT p.id, p.name, p.description, p.price_cents, p.discount_percent, p.image_url,
                b.name AS brand, c.name AS category
         FROM products p
         LEFT JOIN brands b ON b.id = p.brand_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.id IN (${placeholders})`,
        productIds
      );
      parseProductsArray(recommended);
      
      recommendedProducts = productIds.map(id => {
        const product = recommended.find(p => p.id === id);
        const rec = recommendations.recommendations.find(r => r.productId === id);
        return product ? { ...product, reason: rec?.reason || '' } : null;
      }).filter(Boolean);
    }

    return res.json({
      recommendations: recommendedProducts,
      preferences: preferences
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    return res.status(500).json({ error: 'Failed to generate recommendations' });
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

// Guest cart endpoint (no authentication required)
app.post('/catalog/guest-cart', async (req, res) => {
  const { guestCartId, productId, quantity, priceCents } = req.body;
  if (!productId || !quantity || !priceCents) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  let currentGuestCartId = guestCartId;
  if (!currentGuestCartId) {
    // Generate a new ID for the guest cart (simple nanoid-like)
    currentGuestCartId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[product]] = await conn.query(
      `SELECT p.id, i.stock 
       FROM products p
       LEFT JOIN inventory i ON i.product_id = p.id
       WHERE p.id = ?`,
      [productId]
    );
    
    if (!product) {
      await conn.rollback();
      return res.status(404).json({ error: 'Sản phẩm không tồn tại' });
    }
    
    const availableStock = product.stock || 0;
    
    // Stock sẽ được check lại khi checkout và chỉ trừ khi thanh toán xong
    if (availableStock === 0) {
      await conn.rollback();
      return res.status(400).json({ 
        error: 'Sản phẩm đã hết hàng' 
      });
    }
    
    // Chỉ check số lượng đang thêm có <= stock hiện tại không
    if (quantity > availableStock) {
      await conn.rollback();
      return res.status(400).json({ 
        error: `Không đủ hàng trong kho. Chỉ còn ${availableStock} sản phẩm` 
      });
    }

    // Ensure guest cart exists or create it
    await conn.query(
      'INSERT IGNORE INTO guest_carts (id, created_at) VALUES (?, NOW())',
      [currentGuestCartId]
    );

    // Add/update item in guest_cart_items
    await conn.query(
      `INSERT INTO guest_cart_items (guest_cart_id, product_id, quantity, price_cents)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [currentGuestCartId, productId, quantity, priceCents]
    );

    const [items] = await conn.query(
      'SELECT * FROM guest_cart_items WHERE guest_cart_id = ?',
      [currentGuestCartId]
    );
    
    await conn.commit();
    return res.status(201).json({ guestCartId: currentGuestCartId, items });
  } catch (e) {
    await conn.rollback();
    console.error('Error adding to guest cart:', e);
    if (e.response) {
      return res.status(e.response.status).json({ error: e.response.data?.error || 'Catalog service error' });
    }
    return res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
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
    let productSku = sku || `SKU${Date.now()}`;
    
    // Check if SKU already exists, if so, generate a new one
    if (sku) {
      const [existing] = await conn.query('SELECT id FROM products WHERE sku = ?', [productSku]);
      if (existing.length > 0) {
        productSku = `${sku}-${Date.now()}`;
      }
    }
    
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
    
    // Sync to ElasticSearch
    const [productRows] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price_cents, p.discount_percent, p.specs, p.features, p.image_url,
              b.name AS brand, c.name AS category, i.stock, p.brand_id, p.category_id,
              COALESCE(AVG(pr.rating), 0) AS avg_rating, COUNT(pr.id) AS review_count
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN inventory i ON i.product_id = p.id
       LEFT JOIN product_reviews pr ON pr.product_id = p.id
       WHERE p.id = ?
       GROUP BY p.id, p.name, p.description, p.price_cents, p.discount_percent, p.specs, p.features, p.image_url,
                b.name, c.name, i.stock, p.brand_id, p.category_id`,
      [productId]
    );
    if (productRows.length > 0) {
      parseProductsArray(productRows);
      await syncProductToES(productRows[0]);
    }
    
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
    
    // Sync to ElasticSearch
    const [productRows] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price_cents, p.discount_percent, p.specs, p.features, p.image_url,
              b.name AS brand, c.name AS category, i.stock, p.brand_id, p.category_id,
              COALESCE(AVG(pr.rating), 0) AS avg_rating, COUNT(pr.id) AS review_count
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN inventory i ON i.product_id = p.id
       LEFT JOIN product_reviews pr ON pr.product_id = p.id
       WHERE p.id = ?
       GROUP BY p.id, p.name, p.description, p.price_cents, p.discount_percent, p.specs, p.features, p.image_url,
                b.name, c.name, i.stock, p.brand_id, p.category_id`,
      [id]
    );
    if (productRows.length > 0) {
      parseProductsArray(productRows);
      await syncProductToES(productRows[0]);
    }
    
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
    
    // Temporarily disable foreign key checks to avoid constraint issues
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    
    try {
      // Step 1: Get review IDs first
      const [reviews] = await conn.query('SELECT id FROM product_reviews WHERE product_id = ?', [id]);
      const reviewIds = reviews.map(r => r.id);
      
      // Step 2: Delete review_comments if any reviews exist
      if (reviewIds.length > 0) {
        const placeholders = reviewIds.map(() => '?').join(',');
        await conn.query(`DELETE FROM review_comments WHERE review_id IN (${placeholders})`, reviewIds);
      }
      
      // Step 3: Delete product_reviews
      await conn.query('DELETE FROM product_reviews WHERE product_id = ?', [id]);
      
      // Step 4: Delete product_images
      await conn.query('DELETE FROM product_images WHERE product_id = ?', [id]);
      
      // Step 5: Get variant IDs first
      const [variants] = await conn.query('SELECT id FROM product_variants WHERE product_id = ?', [id]);
      const variantIds = variants.map(v => v.id);
      
      // Step 6: Delete variant_inventory if any variants exist
      if (variantIds.length > 0) {
        const placeholders = variantIds.map(() => '?').join(',');
        await conn.query(`DELETE FROM variant_inventory WHERE variant_id IN (${placeholders})`, variantIds);
      }
      
      // Step 7: Delete product_variants
      await conn.query('DELETE FROM product_variants WHERE product_id = ?', [id]);
      
      // Step 8: Delete inventory
      await conn.query('DELETE FROM inventory WHERE product_id = ?', [id]);
      
      // Step 9: Delete guest_cart_items (if exists)
      try {
        await conn.query('DELETE FROM guest_cart_items WHERE product_id = ?', [id]);
      } catch (e) {
        // Table might not exist, ignore
        console.warn('Could not delete guest_cart_items:', e.message);
      }
      
      // Step 10: Finally delete the product itself
      await conn.query('DELETE FROM products WHERE id = ?', [id]);
      
      // Re-enable foreign key checks
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      
      await conn.commit();
      
      // Delete from ElasticSearch
      await deleteProductFromES(id);
      
      return res.json({ ok: true });
    } catch (innerError) {
      // Re-enable foreign key checks even on error
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      throw innerError;
    }
  } catch (e) {
    await conn.rollback();
    // Ensure foreign key checks are re-enabled even on error
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (fkError) {
      console.warn('Could not re-enable foreign key checks:', fkError.message);
    }
    
    const errorDetails = {
      message: e.message,
      code: e.code,
      sqlState: e.sqlState,
      sqlMessage: e.sqlMessage,
      stack: e.stack
    };
    
    console.error('Delete product error:', errorDetails);
    console.error('Full error object:', e);
    
    return res.status(500).json({ 
      error: 'Server error: ' + (e.message || 'Unknown error'),
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
    });
  } finally {
    conn.release();
  }
});

// Admin: create product variant
app.post('/admin/catalog/products/:productId/variants', async (req, res) => {
  const { productId } = req.params;
  const { name, sku, priceCents, discountPercent, imageUrl, attributes, stock, displayOrder } = req.body;
  
  if (!name || !priceCents) {
    return res.status(400).json({ error: 'Missing required fields: name and priceCents' });
  }
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Check if product exists
    const [[product]] = await conn.query('SELECT id FROM products WHERE id = ?', [productId]);
    if (!product) {
      await conn.rollback();
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Insert variant
    const variantSku = sku || `VAR${productId}-${Date.now()}`;
    const [result] = await conn.query(
      'INSERT INTO product_variants (product_id, name, sku, price_cents, discount_percent, image_url, attributes, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [productId, name, variantSku, priceCents, discountPercent || 0, imageUrl || null, attributes ? JSON.stringify(attributes) : null, displayOrder || 0]
    );
    const variantId = result.insertId;
    
    // Insert variant inventory
    if (stock !== undefined && stock !== null) {
      await conn.query('INSERT INTO variant_inventory (variant_id, stock) VALUES (?, ?)', [variantId, stock]);
    }
    
    await conn.commit();
    return res.status(201).json({ id: variantId, sku: variantSku });
  } catch (e) {
    await conn.rollback();
    console.error('Create variant error:', e);
    return res.status(500).json({ error: 'Server error: ' + e.message });
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
    
    // Temporarily disable foreign key checks
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    
    try {
      const placeholders = ids.map(() => '?').join(',');
      
      // Get all review IDs for these products
      const [allReviews] = await conn.query(`SELECT id FROM product_reviews WHERE product_id IN (${placeholders})`, ids);
      const reviewIds = allReviews.map(r => r.id);
      
      // Delete review_comments
      if (reviewIds.length > 0) {
        const reviewPlaceholders = reviewIds.map(() => '?').join(',');
        await conn.query(`DELETE FROM review_comments WHERE review_id IN (${reviewPlaceholders})`, reviewIds);
      }
      
      // Get all variant IDs
      const [allVariants] = await conn.query(`SELECT id FROM product_variants WHERE product_id IN (${placeholders})`, ids);
      const variantIds = allVariants.map(v => v.id);
      
      // Delete variant_inventory
      if (variantIds.length > 0) {
        const variantPlaceholders = variantIds.map(() => '?').join(',');
        await conn.query(`DELETE FROM variant_inventory WHERE variant_id IN (${variantPlaceholders})`, variantIds);
      }
      
      // Delete all related data
      await conn.query(`DELETE FROM product_reviews WHERE product_id IN (${placeholders})`, ids);
      await conn.query(`DELETE FROM product_images WHERE product_id IN (${placeholders})`, ids);
      await conn.query(`DELETE FROM product_variants WHERE product_id IN (${placeholders})`, ids);
      await conn.query(`DELETE FROM inventory WHERE product_id IN (${placeholders})`, ids);
      
      // Try to delete guest_cart_items (might not exist)
      try {
        await conn.query(`DELETE FROM guest_cart_items WHERE product_id IN (${placeholders})`, ids);
      } catch (e) {
        console.warn('Could not delete guest_cart_items:', e.message);
      }
      
      // Finally delete products
      await conn.query(`DELETE FROM products WHERE id IN (${placeholders})`, ids);
      
      // Re-enable foreign key checks
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      
      await conn.commit();
      return res.json({ ok: true, deletedCount: ids.length });
    } catch (innerError) {
      // Re-enable foreign key checks even on error
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      throw innerError;
    }
  } catch (e) {
    await conn.rollback();
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (fkError) {
      console.warn('Could not re-enable foreign key checks:', fkError.message);
    }
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

// Public: Get reviews for a product with pagination and rating filter
app.get('/catalog/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id, 10);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const ratingFilter = req.query.rating ? parseInt(req.query.rating, 10) : null;

    // Try to get reviews with user info, fallback to reviews without user info if JOIN fails
    let reviews = [];
    try {
      let query = `
        SELECT r.id, r.product_id, r.user_id, r.rating, r.comment, r.admin_reply, 
               r.created_at, r.updated_at,
               u.full_name as user_name, u.email as user_email
        FROM product_reviews r
        LEFT JOIN auth_db.users u ON r.user_id = u.id
        WHERE r.product_id = ?
      `;
      const params = [productId];

      if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
        query += ' AND r.rating = ?';
        params.push(ratingFilter);
      }

      query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      [reviews] = await pool.query(query, params);
    } catch (joinError) {
      // Fallback: Get reviews without user info if JOIN fails
      console.warn('Failed to JOIN with auth_db.users, using fallback query:', joinError.message);
      let query = `
        SELECT r.id, r.product_id, r.user_id, r.rating, r.comment, r.admin_reply, 
               r.created_at, r.updated_at,
               NULL as user_name, NULL as user_email
        FROM product_reviews r
        WHERE r.product_id = ?
      `;
      const params = [productId];

      if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
        query += ' AND r.rating = ?';
        params.push(ratingFilter);
      }

      query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      [reviews] = await pool.query(query, params);
    }

    // Load comments for each review
    for (const review of reviews) {
      try {
        let commentsQuery = `
          SELECT rc.id, rc.user_id, rc.is_admin, rc.comment, rc.created_at,
                 u.full_name as user_name, u.email as user_email
          FROM review_comments rc
          LEFT JOIN auth_db.users u ON rc.user_id = u.id
          WHERE rc.review_id = ?
          ORDER BY rc.created_at ASC
        `;
        const [comments] = await pool.query(commentsQuery, [review.id]);
        review.comments = comments || [];
      } catch (commentError) {
        // Fallback: Get comments without user info
        console.warn('Failed to load comments with user info:', commentError.message);
        try {
          const [comments] = await pool.query(
            `SELECT rc.id, rc.user_id, rc.is_admin, rc.comment, rc.created_at,
                    NULL as user_name, NULL as user_email
             FROM review_comments rc
             WHERE rc.review_id = ?
             ORDER BY rc.created_at ASC`,
            [review.id]
          );
          review.comments = comments || [];
        } catch (fallbackError) {
          console.error('Failed to load comments:', fallbackError);
          review.comments = [];
        }
      }
    }

    // Load guest comments (comments without rating from non-logged-in users)
    let guestComments = [];
    try {
      const [gc] = await pool.query(
        `SELECT id, product_id, comment, guest_name, created_at
         FROM guest_comments
         WHERE product_id = ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [productId, limit, offset]
      );
      guestComments = gc || [];
    } catch (guestError) {
      console.warn('Failed to load guest comments:', guestError.message);
      guestComments = [];
    }

    // Get average rating and total count (ALL reviews, unfiltered)
    let stats = { avg_rating: null, total_reviews: 0 };
    try {
      const [[statsResult]] = await pool.query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
         FROM product_reviews WHERE product_id = ?`,
        [productId]
      );
      stats = statsResult || stats;
    } catch (statsError) {
      console.warn('Failed to get review stats:', statsError.message);
    }

    // Get filtered count (for pagination)
    let filteredCount = 0;
    try {
      let filteredCountQuery = 'SELECT COUNT(*) as filtered_count FROM product_reviews WHERE product_id = ?';
      const filteredParams = [productId];
      if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
        filteredCountQuery += ' AND rating = ?';
        filteredParams.push(ratingFilter);
      }
      const [[filteredCountResult]] = await pool.query(filteredCountQuery, filteredParams);
      filteredCount = filteredCountResult?.filtered_count || 0;
    } catch (countError) {
      console.warn('Failed to get filtered count:', countError.message);
    }

    // Get rating distribution (ALL reviews, unfiltered)
    let distribution = {};
    try {
      const [dist] = await pool.query(
        `SELECT rating, COUNT(*) as count
         FROM product_reviews WHERE product_id = ?
         GROUP BY rating ORDER BY rating DESC`,
        [productId]
      );
      distribution = (dist || []).reduce((acc, d) => {
        acc[d.rating] = d.count;
        return acc;
      }, {});
    } catch (distError) {
      console.warn('Failed to get rating distribution:', distError.message);
    }

    return res.json({
      reviews: reviews || [],
      guestComments: guestComments,
      stats: {
        average: stats.avg_rating ? parseFloat(parseFloat(stats.avg_rating).toFixed(1)) : 0,
        total: stats.total_reviews || 0,
        filtered: filteredCount
      },
      distribution: distribution
    });
  } catch (e) {
    console.error('Get reviews error:', e);
    console.error('Error stack:', e.stack);
    return res.status(500).json({ 
      error: 'Server error',
      message: process.env.NODE_ENV === 'development' ? e.message : 'Failed to load reviews'
    });
  }
});

// Public: Submit a guest comment (no authentication required, no rating)
app.post('/catalog/products/:id/guest-comments', async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id, 10);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const { comment, guestName } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    // Ensure table exists before proceeding
    await ensureGuestCommentsTable();

    // Check if product exists
    let product = null;
    try {
      const [[productResult]] = await pool.query('SELECT id FROM products WHERE id = ?', [productId]);
      product = productResult;
    } catch (productError) {
      console.error('Failed to check product existence:', productError);
      return res.status(500).json({ 
        error: 'Failed to verify product',
        message: process.env.NODE_ENV === 'development' ? productError.message : 'Server error'
      });
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Insert guest comment
    // guest_name is NOT NULL, so use a default value if not provided
    const name = (guestName?.trim() || 'Khách').substring(0, 255); // Limit length to match VARCHAR(255)
    const commentText = comment.trim().substring(0, 65535); // Limit to TEXT field max
    
    let result;
    try {
      [result] = await pool.query(
        'INSERT INTO guest_comments (product_id, comment, guest_name) VALUES (?, ?, ?)',
        [productId, commentText, name]
      );
    } catch (insertError) {
      console.error('Failed to insert guest comment:', insertError);
      console.error('Error code:', insertError.code);
      console.error('Error message:', insertError.message);
      console.error('Error sqlState:', insertError.sqlState);
      console.error('Error sqlMessage:', insertError.sqlMessage);
      console.error('Stack:', insertError.stack);
      
      // Check if it's a foreign key constraint error
      if (insertError.code === 'ER_NO_REFERENCED_ROW_2' || 
          insertError.code === 'ER_ROW_IS_REFERENCED_2' ||
          insertError.code === '1452') {
        return res.status(404).json({ error: 'Product not found' });
      }
      // Check if table doesn't exist
      if (insertError.code === 'ER_NO_SUCH_TABLE' || insertError.code === '42S02') {
        console.error('Table guest_comments does not exist. Please run database migrations.');
        console.error('Run: mysql -u root -p catalog_db < services/catalog-service/db/migrate-guest-comments.sql');
        return res.status(500).json({ 
          error: 'Database table not found',
          message: process.env.NODE_ENV === 'development' 
            ? `Table guest_comments does not exist. Error: ${insertError.message}` 
            : 'Server error'
        });
      }
      // Check for other MySQL errors
      if (insertError.code && insertError.code.startsWith('ER_')) {
        return res.status(500).json({ 
          error: 'Database error',
          message: process.env.NODE_ENV === 'development' 
            ? `MySQL Error (${insertError.code}): ${insertError.message}` 
            : 'Failed to post comment'
        });
      }
      return res.status(500).json({ 
        error: 'Failed to post comment',
        message: process.env.NODE_ENV === 'development' 
          ? insertError.message || 'Unknown error' 
          : 'Server error'
      });
    }
    
    // Emit WebSocket event for real-time update (non-blocking)
    try {
      if (typeof emitReviewUpdate === 'function') {
        emitReviewUpdate(productId, { type: 'new_guest_comment', productId: productId });
      }
    } catch (wsError) {
      console.warn('Failed to emit WebSocket event (non-critical):', wsError.message);
      // Don't fail the request if WebSocket fails
    }
    
    return res.json({ 
      message: 'Comment posted successfully', 
      commentId: result.insertId 
    });
  } catch (e) {
    console.error('Submit guest comment error:', e);
    console.error('Error stack:', e.stack);
    return res.status(500).json({ 
      error: 'Server error',
      message: process.env.NODE_ENV === 'development' ? e.message : 'Failed to post comment'
    });
  }
});

// Protected: Submit a review (requires authentication for rating)
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
    
    // Emit WebSocket event for real-time update
    emitReviewUpdate(id, { type: 'new_review', productId: id });
    
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

// Get comments for a review (public endpoint, no auth required)
app.get('/catalog/reviews/:reviewId/comments', async (req, res) => {
  try {
    const { reviewId } = req.params;
    
    // Get comments for this review
    let commentsQuery = `
      SELECT rc.id, rc.user_id, rc.is_admin, rc.comment, rc.created_at,
             u.full_name as user_name, u.email as user_email
      FROM review_comments rc
      LEFT JOIN auth_db.users u ON rc.user_id = u.id
      WHERE rc.review_id = ?
      ORDER BY rc.created_at ASC
    `;
    
    try {
      const [comments] = await pool.query(commentsQuery, [reviewId]);
      return res.json({ comments: comments || [] });
    } catch (joinError) {
      // Fallback: Get comments without user info
      console.warn('Failed to load comments with user info:', joinError.message);
      const [comments] = await pool.query(
        `SELECT rc.id, rc.user_id, rc.is_admin, rc.comment, rc.created_at,
                NULL as user_name, NULL as user_email
         FROM review_comments rc
         WHERE rc.review_id = ?
         ORDER BY rc.created_at ASC`,
        [reviewId]
      );
      return res.json({ comments: comments || [] });
    }
  } catch (e) {
    console.error('Get comments error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Protected: Post a comment on a review (user or admin)
// Protected: Add comment to a review
app.post('/catalog/reviews/:reviewId/comments', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { userId, comment, isAdmin } = req.body;

    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    // Check if review exists and get product_id
    const [[review]] = await pool.query('SELECT id, product_id FROM product_reviews WHERE id = ?', [reviewId]);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    // Insert comment
    const [result] = await pool.query(
      'INSERT INTO review_comments (review_id, user_id, is_admin, comment) VALUES (?, ?, ?, ?)',
      [reviewId, userId, isAdmin ? 1 : 0, comment.trim()]
    );

    // Emit WebSocket event for real-time update
    emitReviewUpdate(review.product_id, { type: 'new_comment', reviewId, productId: review.product_id });

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
          await conn.rollback();
          await lockManager.releaseLock(lockKey, lockToken);
          conn.release();
          console.log(`Out of stock for product ${productId}: have ${currentStock}, need ${quantity}`);
          return res.json({ 
            success: false, 
            error: `Không đủ hàng cho sản phẩm ID ${productId}. Còn ${currentStock}, yêu cầu ${quantity}`,
            outOfStock: true
          });
        }

        await conn.query(
          'UPDATE inventory SET stock = stock - ? WHERE product_id = ?',
          [quantity, productId]
        );

        console.log(`Reserved ${quantity} units of product ${productId}. Stock: ${currentStock} → ${currentStock - quantity}`);
        await lockManager.releaseLock(lockKey, lockToken);

      } catch (error) {
        await lockManager.releaseLock(lockKey, lockToken);
        throw error;
      }
    }

    await conn.commit();
    console.log(`Successfully reserved inventory for ${items.length} product(s)`);
    return res.json({ success: true });

  } catch (error) {
    await conn.rollback();
    console.error('Inventory reservation error:', error);
    return res.status(500).json({ 
      error: error.message || 'Không thể đặt trước hàng. Vui lòng thử lại.',
      success: false 
    });
  } finally {
    conn.release();
  }
});

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

// Ensure guest cart tables exist
async function ensureGuestCartSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS guest_carts (
        id VARCHAR(255) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS guest_cart_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        guest_cart_id VARCHAR(255) NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        price_cents INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY (guest_cart_id, product_id),
        FOREIGN KEY (guest_cart_id) REFERENCES guest_carts(id) ON DELETE CASCADE,
        INDEX idx_guest_cart_id (guest_cart_id),
        INDEX idx_product_id (product_id)
      )
    `);
    console.log('Guest cart tables ready');
  } catch (e) {
    console.error('Error ensuring guest cart schema:', e);
  }
}

// Admin: sync all products to ElasticSearch
app.post('/admin/catalog/sync-elasticsearch', async (req, res) => {
  try {
    console.log('Starting full ElasticSearch sync...');
    
    // Fetch all products with full data
    const [products] = await pool.query(
      `SELECT p.id, p.name, p.description, p.price_cents, p.discount_percent, p.specs, p.features, p.image_url,
              b.name AS brand, c.name AS category, i.stock, p.brand_id, p.category_id,
              COALESCE(AVG(pr.rating), 0) AS avg_rating, COUNT(pr.id) AS review_count
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN inventory i ON i.product_id = p.id
       LEFT JOIN product_reviews pr ON pr.product_id = p.id
       GROUP BY p.id, p.name, p.description, p.price_cents, p.discount_percent, p.specs, p.features, p.image_url,
                b.name, c.name, i.stock, p.brand_id, p.category_id`
    );
    
    parseProductsArray(products);
    await bulkSyncProductsToES(products);
    
    return res.json({ 
      success: true, 
      message: `Synced ${products.length} products to ElasticSearch`,
      count: products.length 
    });
  } catch (error) {
    console.error('Error syncing to ElasticSearch:', error);
    return res.status(500).json({ error: 'Sync failed: ' + error.message });
  }
});

// Connect to Redis on startup and setup event handlers
Promise.all([
  lockManager.connect(),
  setupOrderEventHandlers(pool).then(() => {
    console.log('Catalog service event handlers ready');
  })
]).then(() => {
  console.log('Catalog service Redis lock manager ready');
}).catch(err => {
  console.error('Redis connection failed:', err);
  console.warn('Service will run WITHOUT distributed locks and event handlers');
});

// Initialize ElasticSearch on startup
initElasticSearchIndex().then(() => {
  console.log('ElasticSearch initialization completed');
}).catch(err => {
  console.error('ElasticSearch initialization failed:', err);
  console.warn('Service will run with MySQL search only');
});

// Ensure guest_comments table exists on startup
ensureGuestCommentsTable().then(() => {
  console.log('Guest comments table verified');
}).catch(err => {
  console.error('Failed to verify guest comments table:', err);
});

// Ensure schema on startup
ensureGuestCartSchema();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Join product room to receive updates
  socket.on('join-product', (productId) => {
    socket.join(`product-${productId}`);
    console.log(`Client ${socket.id} joined product-${productId}`);
  });
  
  // Leave product room
  socket.on('leave-product', (productId) => {
    socket.leave(`product-${productId}`);
    console.log(`Client ${socket.id} left product-${productId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Helper function to emit review updates
function emitReviewUpdate(productId, reviewData) {
  io.to(`product-${productId}`).emit('review-updated', reviewData);
}

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Catalog service listening on ${PORT}`);
});


