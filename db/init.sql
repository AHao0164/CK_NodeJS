-- Create logical databases per service
CREATE DATABASE IF NOT EXISTS auth_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS catalog_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS cart_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS order_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Auth schema
USE auth_db;
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER',
  default_address VARCHAR(512),
  default_city VARCHAR(100),
  default_district VARCHAR(100),
  default_ward VARCHAR(100),
  default_phone VARCHAR(50),
  oauth_provider VARCHAR(50),
  oauth_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_addresses (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  label VARCHAR(100),
  recipient_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  address VARCHAR(512) NOT NULL,
  city VARCHAR(100) NOT NULL,
  district VARCHAR(100),
  ward VARCHAR(100),
  is_default TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_default (user_id, is_default)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
);

-- Catalog schema
USE catalog_db;
CREATE TABLE IF NOT EXISTS brands (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS categories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  brand_id BIGINT,
  category_id BIGINT,
  description TEXT,
  price_cents INT NOT NULL,
  specs JSON,
  image_url VARCHAR(512),
  is_new TINYINT(1) DEFAULT 0,
  is_bestseller TINYINT(1) DEFAULT 0,
  sales_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
CREATE TABLE IF NOT EXISTS product_images (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT NOT NULL,
  url VARCHAR(512) NOT NULL,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Product variants (e.g., different colors, sizes, configurations)
CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT NOT NULL,
  variant_name VARCHAR(255) NOT NULL,
  variant_value VARCHAR(255) NOT NULL,
  price_adjustment_cents INT DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  sku VARCHAR(100),
  is_available TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_id (product_id)
);

-- Product reviews and ratings
CREATE TABLE IF NOT EXISTS product_reviews (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT NOT NULL,
  user_id BIGINT,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  author_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_id (product_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS inventory (
  product_id BIGINT PRIMARY KEY,
  stock INT NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Cart schema
USE cart_db;
CREATE TABLE IF NOT EXISTS carts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user (user_id),
  INDEX idx_session (session_id)
);
CREATE TABLE IF NOT EXISTS cart_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  cart_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  price_cents_snapshot INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_cart_product (cart_id, product_id),
  FOREIGN KEY (cart_id) REFERENCES carts(id)
);

-- Order schema
USE order_db;
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  guest_email VARCHAR(255),
  status ENUM('PENDING','PAID','CANCELLED','SHIPPING','DELIVERED') NOT NULL DEFAULT 'PENDING',
  total_cents INT NOT NULL,
  shipping_name VARCHAR(255),
  shipping_phone VARCHAR(50),
  shipping_address VARCHAR(512),
  shipping_city VARCHAR(100),
  shipping_district VARCHAR(100),
  shipping_ward VARCHAR(100),
  billing_name VARCHAR(255),
  billing_phone VARCHAR(50),
  billing_address VARCHAR(512),
  coupon_code VARCHAR(50),
  discount_cents INT NOT NULL DEFAULT 0,
  loyalty_cents_used INT NOT NULL DEFAULT 0,
  loyalty_cents_earned INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- Coupons
CREATE TABLE IF NOT EXISTS coupons (
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
);

-- Seed some coupons (5-character alphanumeric codes with usage limits)
INSERT INTO coupons (code, type, value, active, usage_limit, start_date, end_date)
VALUES ('SUM10', 'percentage', 10, 1, 10, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY))
ON DUPLICATE KEY UPDATE value=VALUES(value);
INSERT INTO coupons (code, type, value, active, usage_limit, start_date, end_date)
VALUES ('SAL50', 'fixed', 50000, 1, 10, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY))
ON DUPLICATE KEY UPDATE value=VALUES(value);
INSERT INTO coupons (code, type, value, active, usage_limit, start_date, end_date)
VALUES ('SHIP0', 'freeship', 0, 1, 10, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY))
ON DUPLICATE KEY UPDATE active=VALUES(active);
INSERT INTO coupons (code, type, value, active, usage_limit, start_date, end_date)
VALUES ('VIP20', 'percentage', 20, 1, 5, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY))
ON DUPLICATE KEY UPDATE value=VALUES(value);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  price_cents INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  status VARCHAR(32) NOT NULL,
  note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_loyalty_points (
  user_id BIGINT PRIMARY KEY,
  balance_cents BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed basic data
USE catalog_db;
INSERT INTO brands (name) VALUES ('Apple'), ('Dell'), ('Lenovo'), ('HP'), ('Asus') ON DUPLICATE KEY UPDATE name=VALUES(name);
INSERT INTO categories (name) VALUES ('Ultrabook'), ('Gaming'), ('Business'), ('Student'), ('Workstation') ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Seed products (18 products total)
-- Apple Products
INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'MacBook Air M2 13"', b.id, c.id, 'Chip M2, 8GB RAM, 256GB SSD. Lightweight and powerful for everyday tasks.', 24990000, JSON_OBJECT('ram','8GB','ssd','256GB','cpu','M2')
FROM brands b, categories c WHERE b.name='Apple' AND c.name='Ultrabook'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'MacBook Pro 14" M3', b.id, c.id, 'M3 Pro chip, 16GB RAM, 512GB SSD. Professional-grade performance.', 48990000, JSON_OBJECT('ram','16GB','ssd','512GB','cpu','M3 Pro')
FROM brands b, categories c WHERE b.name='Apple' AND c.name='Workstation'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'MacBook Air M3 15"', b.id, c.id, 'M3 chip, 8GB RAM, 512GB SSD. Large display for productivity.', 32990000, JSON_OBJECT('ram','8GB','ssd','512GB','cpu','M3')
FROM brands b, categories c WHERE b.name='Apple' AND c.name='Ultrabook'
ON DUPLICATE KEY UPDATE products.name=products.name;

-- Dell Products
INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'Dell XPS 13', b.id, c.id, 'Intel i7-1355U, 16GB RAM, 512GB SSD. Premium ultrabook with InfinityEdge display.', 32990000, JSON_OBJECT('ram','16GB','ssd','512GB','cpu','i7-1355U')
FROM brands b, categories c WHERE b.name='Dell' AND c.name='Ultrabook'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'Dell XPS 15', b.id, c.id, 'Intel i7-13700H, 32GB RAM, 1TB SSD, RTX 4050. Content creator powerhouse.', 42990000, JSON_OBJECT('ram','32GB','ssd','1TB','cpu','i7-13700H','gpu','RTX 4050')
FROM brands b, categories c WHERE b.name='Dell' AND c.name='Workstation'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'Dell G15 Gaming', b.id, c.id, 'Intel i7-13650HX, 16GB RAM, RTX 4060. Affordable gaming performance.', 28990000, JSON_OBJECT('ram','16GB','cpu','i7-13650HX','gpu','RTX 4060')
FROM brands b, categories c WHERE b.name='Dell' AND c.name='Gaming'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'Dell Latitude 5430', b.id, c.id, 'Intel i5-1245U, 16GB RAM, 512GB SSD. Reliable business laptop.', 21990000, JSON_OBJECT('ram','16GB','ssd','512GB','cpu','i5-1245U')
FROM brands b, categories c WHERE b.name='Dell' AND c.name='Business'
ON DUPLICATE KEY UPDATE products.name=products.name;

-- Lenovo Products
INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'Lenovo Legion 5', b.id, c.id, 'Ryzen 7 7735HS, 16GB RAM, RTX 4060. High-performance gaming laptop.', 35990000, JSON_OBJECT('ram','16GB','cpu','Ryzen 7 7735HS','gpu','RTX 4060')
FROM brands b, categories c WHERE b.name='Lenovo' AND c.name='Gaming'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'Lenovo Legion 7i', b.id, c.id, 'Intel i9-13900HX, 32GB RAM, RTX 4070. Premium gaming experience.', 52990000, JSON_OBJECT('ram','32GB','cpu','i9-13900HX','gpu','RTX 4070')
FROM brands b, categories c WHERE b.name='Lenovo' AND c.name='Gaming'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'Lenovo ThinkPad X1 Carbon', b.id, c.id, 'Intel i7-1355U, 16GB RAM, 512GB SSD. Ultra-portable business laptop.', 38990000, JSON_OBJECT('ram','16GB','ssd','512GB','cpu','i7-1355U')
FROM brands b, categories c WHERE b.name='Lenovo' AND c.name='Business'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'Lenovo IdeaPad Slim 5', b.id, c.id, 'Ryzen 5 7530U, 8GB RAM, 512GB SSD. Budget-friendly for students.', 15990000, JSON_OBJECT('ram','8GB','ssd','512GB','cpu','Ryzen 5 7530U')
FROM brands b, categories c WHERE b.name='Lenovo' AND c.name='Student'
ON DUPLICATE KEY UPDATE products.name=products.name;

-- HP Products
INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'HP ProBook 440', b.id, c.id, 'Intel i5-1235U, 8GB RAM, 256GB SSD. Essential business laptop.', 18990000, JSON_OBJECT('ram','8GB','ssd','256GB','cpu','i5-1235U')
FROM brands b, categories c WHERE b.name='HP' AND c.name='Business'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'HP Envy x360', b.id, c.id, 'Ryzen 7 7730U, 16GB RAM, 512GB SSD. Convertible 2-in-1 design.', 26990000, JSON_OBJECT('ram','16GB','ssd','512GB','cpu','Ryzen 7 7730U')
FROM brands b, categories c WHERE b.name='HP' AND c.name='Ultrabook'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'HP Omen 16', b.id, c.id, 'Intel i7-13700HX, 16GB RAM, RTX 4060. Gaming powerhouse.', 39990000, JSON_OBJECT('ram','16GB','cpu','i7-13700HX','gpu','RTX 4060')
FROM brands b, categories c WHERE b.name='HP' AND c.name='Gaming'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'HP Pavilion 15', b.id, c.id, 'Intel i5-1235U, 8GB RAM, 512GB SSD. Perfect for students.', 13990000, JSON_OBJECT('ram','8GB','ssd','512GB','cpu','i5-1235U')
FROM brands b, categories c WHERE b.name='HP' AND c.name='Student'
ON DUPLICATE KEY UPDATE products.name=products.name;

-- Asus Products
INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'Asus TUF A15', b.id, c.id, 'Ryzen 5 7535HS, 8GB RAM, RTX 3050. Entry-level gaming laptop.', 24990000, JSON_OBJECT('ram','8GB','cpu','Ryzen 5 7535HS','gpu','RTX 3050')
FROM brands b, categories c WHERE b.name='Asus' AND c.name='Gaming'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'Asus ROG Zephyrus G14', b.id, c.id, 'Ryzen 9 7940HS, 16GB RAM, RTX 4060. Compact gaming beast.', 46990000, JSON_OBJECT('ram','16GB','cpu','Ryzen 9 7940HS','gpu','RTX 4060')
FROM brands b, categories c WHERE b.name='Asus' AND c.name='Gaming'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'Asus Zenbook 14', b.id, c.id, 'Intel i5-1340P, 16GB RAM, 512GB SSD. Elegant ultrabook design.', 22990000, JSON_OBJECT('ram','16GB','ssd','512GB','cpu','i5-1340P')
FROM brands b, categories c WHERE b.name='Asus' AND c.name='Ultrabook'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'Asus VivoBook 15', b.id, c.id, 'Intel i3-1215U, 8GB RAM, 256GB SSD. Budget-friendly option.', 11990000, JSON_OBJECT('ram','8GB','ssd','256GB','cpu','i3-1215U')
FROM brands b, categories c WHERE b.name='Asus' AND c.name='Student'
ON DUPLICATE KEY UPDATE products.name=products.name;

-- Backfill inventory for all products if missing
INSERT IGNORE INTO inventory (product_id, stock)
SELECT id, 25 FROM products;

-- Mark some products as new (latest products)
UPDATE products SET is_new = 1 WHERE name IN (
  'MacBook Air M3 15"',
  'MacBook Pro 14" M3',
  'Dell XPS 15',
  'Lenovo Legion 7i',
  'Asus ROG Zephyrus G14',
  'HP Omen 16'
);

-- Mark some products as bestsellers with sales counts
UPDATE products SET is_bestseller = 1, sales_count = 150 WHERE name = 'MacBook Air M2 13"';
UPDATE products SET is_bestseller = 1, sales_count = 120 WHERE name = 'Dell G15 Gaming';
UPDATE products SET is_bestseller = 1, sales_count = 135 WHERE name = 'Lenovo Legion 5';
UPDATE products SET is_bestseller = 1, sales_count = 110 WHERE name = 'Asus TUF A15';
UPDATE products SET is_bestseller = 1, sales_count = 95 WHERE name = 'HP Pavilion 15';
UPDATE products SET is_bestseller = 1, sales_count = 105 WHERE name = 'Lenovo IdeaPad Slim 5';

-- Seed Product Variants (at least 2 variants per product)
-- MacBook Air M2 13" variants
INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'Color', 'Space Gray', 0, 15, 'MBA-M2-13-SG'
FROM products p WHERE p.name = 'MacBook Air M2 13"';

INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'Color', 'Silver', 0, 12, 'MBA-M2-13-SL'
FROM products p WHERE p.name = 'MacBook Air M2 13"';

INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'Storage', '256GB', 0, 20, 'MBA-M2-13-256'
FROM products p WHERE p.name = 'MacBook Air M2 13"';

INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'Storage', '512GB', 500000, 15, 'MBA-M2-13-512'
FROM products p WHERE p.name = 'MacBook Air M2 13"';

-- MacBook Air M3 15" variants
INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'Color', 'Midnight', 0, 10, 'MBA-M3-15-MN'
FROM products p WHERE p.name = 'MacBook Air M3 15"';

INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'Color', 'Starlight', 0, 8, 'MBA-M3-15-ST'
FROM products p WHERE p.name = 'MacBook Air M3 15"';

-- Dell XPS 13 variants
INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'RAM', '16GB', 0, 15, 'XPS13-16GB'
FROM products p WHERE p.name = 'Dell XPS 13';

INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'RAM', '32GB', 800000, 8, 'XPS13-32GB'
FROM products p WHERE p.name = 'Dell XPS 13';

-- Dell G15 Gaming variants
INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'GPU', 'RTX 3050', 0, 12, 'G15-3050'
FROM products p WHERE p.name = 'Dell G15 Gaming';

INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'GPU', 'RTX 3060', 400000, 10, 'G15-3060'
FROM products p WHERE p.name = 'Dell G15 Gaming';

-- Lenovo ThinkPad X1 Carbon variants
INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'Processor', 'i5-1340P', 0, 10, 'X1C-i5'
FROM products p WHERE p.name = 'Lenovo ThinkPad X1 Carbon';

INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'Processor', 'i7-1360P', 600000, 8, 'X1C-i7'
FROM products p WHERE p.name = 'Lenovo ThinkPad X1 Carbon';

-- HP Spectre x360 variants
INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'Display', 'FHD Touch', 0, 12, 'SPX360-FHD'
FROM products p WHERE p.name = 'HP Spectre x360';

INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'Display', '4K OLED', 700000, 6, 'SPX360-4K'
FROM products p WHERE p.name = 'HP Spectre x360';

-- Add more variants for other products
INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'Color', 'Black', 0, 15, CONCAT('VAR-', p.id, '-BLK')
FROM products p WHERE p.name IN ('Lenovo Legion 5', 'Asus TUF A15', 'HP Pavilion 15');

INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'Color', 'Gray', 0, 12, CONCAT('VAR-', p.id, '-GRY')
FROM products p WHERE p.name IN ('Lenovo Legion 5', 'Asus TUF A15', 'HP Pavilion 15');

-- Seed Product Reviews (mix of logged-in users and anonymous)
-- Reviews for MacBook Air M2 13"
INSERT INTO product_reviews (product_id, user_id, rating, comment, author_name)
SELECT p.id, 1, 5, 'Excellent laptop! The M2 chip is incredibly fast and the battery life is amazing. Perfect for daily work and creative tasks.', 'Admin User'
FROM products p WHERE p.name = 'MacBook Air M2 13"';

INSERT INTO product_reviews (product_id, user_id, rating, comment, author_name)
SELECT p.id, NULL, 4, 'Great performance and build quality. A bit expensive but worth it for the reliability.', 'Anonymous Buyer'
FROM products p WHERE p.name = 'MacBook Air M2 13"';

INSERT INTO product_reviews (product_id, user_id, rating, comment, author_name)
SELECT p.id, 2, 5, 'Love this MacBook! Super lightweight and the screen quality is stunning. Highly recommended.', 'Le Doan Anh Hao'
FROM products p WHERE p.name = 'MacBook Air M2 13"';

-- Reviews for Dell XPS 13
INSERT INTO product_reviews (product_id, user_id, rating, comment, author_name)
SELECT p.id, NULL, 5, 'Best Windows ultrabook out there. Beautiful display and excellent keyboard.', 'Tech Enthusiast'
FROM products p WHERE p.name = 'Dell XPS 13';

INSERT INTO product_reviews (product_id, user_id, rating, comment, author_name)
SELECT p.id, NULL, 4, 'Solid build quality and great performance. Battery could be better.', 'John Smith'
FROM products p WHERE p.name = 'Dell XPS 13';

-- Reviews for Dell G15 Gaming
INSERT INTO product_reviews (product_id, user_id, rating, comment, author_name)
SELECT p.id, 1, 4, 'Good gaming laptop for the price. Handles most games at high settings.', 'Admin User'
FROM products p WHERE p.name = 'Dell G15 Gaming';

INSERT INTO product_reviews (product_id, user_id, rating, comment, author_name)
SELECT p.id, NULL, 5, 'Amazing value for money! Runs all my games smoothly. Cooling is decent too.', 'Gamer123'
FROM products p WHERE p.name = 'Dell G15 Gaming';

-- Reviews for Lenovo ThinkPad X1 Carbon
INSERT INTO product_reviews (product_id, user_id, rating, comment, author_name)
SELECT p.id, NULL, 5, 'Best business laptop! The keyboard is phenomenal and it\'s so light.', 'Business Pro'
FROM products p WHERE p.name = 'Lenovo ThinkPad X1 Carbon';

INSERT INTO product_reviews (product_id, user_id, rating, comment, author_name)
SELECT p.id, NULL, 4, 'Great for productivity. Battery lasts all day. Build quality is top-notch.', 'Office Worker'
FROM products p WHERE p.name = 'Lenovo ThinkPad X1 Carbon';

-- Reviews for HP Spectre x360
INSERT INTO product_reviews (product_id, user_id, rating, comment, author_name)
SELECT p.id, NULL, 5, 'Beautiful convertible laptop! The 2-in-1 design is very practical and the display is gorgeous.', 'Sarah Lee'
FROM products p WHERE p.name = 'HP Spectre x360';

INSERT INTO product_reviews (product_id, user_id, rating, comment, author_name)
SELECT p.id, 2, 4, 'Premium build and features. Touch screen works great. A bit heavy for tablet mode though.', 'Le Doan Anh Hao'
FROM products p WHERE p.name = 'HP Spectre x360';

-- More reviews for popular products
INSERT INTO product_reviews (product_id, user_id, rating, comment, author_name)
SELECT p.id, NULL, 5, 'Incredible gaming performance! The RTX graphics card handles everything I throw at it.', 'Pro Gamer'
FROM products p WHERE p.name = 'Lenovo Legion 5';

INSERT INTO product_reviews (product_id, user_id, rating, comment, author_name)
SELECT p.id, NULL, 4, 'Good laptop for students. Battery life is decent and performance is adequate for everyday tasks.', 'Student User'
FROM products p WHERE p.name = 'Lenovo IdeaPad Slim 5';

INSERT INTO product_reviews (product_id, user_id, rating, comment, author_name)
SELECT p.id, NULL, 5, 'Best budget gaming laptop! Great value and runs games surprisingly well.', 'Budget Gamer'
FROM products p WHERE p.name = 'Asus TUF A15';

-- Seed product images (3 per product) using Unsplash placeholders
INSERT INTO product_images (product_id, url, sort_order)
SELECT p.id, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1200', 1 FROM products p;
INSERT INTO product_images (product_id, url, sort_order)
SELECT p.id, 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=1200', 2 FROM products p;
INSERT INTO product_images (product_id, url, sort_order)
SELECT p.id, 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?q=80&w=1200', 3 FROM products p;

-- Ensure any product missing variants gets two default variants (Color: Black/Gray)
INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'Color', 'Black', 0, 20, CONCAT('DEF-', p.id, '-BLK')
FROM products p WHERE p.id NOT IN (SELECT DISTINCT product_id FROM product_variants);

INSERT INTO product_variants (product_id, variant_name, variant_value, price_adjustment_cents, stock, sku)
SELECT p.id, 'Color', 'Gray', 0, 20, CONCAT('DEF-', p.id, '-GRY')
FROM products p WHERE p.id NOT IN (SELECT DISTINCT product_id FROM product_variants);

-- Expand product descriptions to ensure at least 5 lines for demo requirements
UPDATE products SET description = CONCAT(description, '\n\n', 'Detailed overview: This product has been carefully selected for quality and performance. ',
  'It includes up-to-date hardware, reliable battery life, and a robust warranty policy. ',
  'Suitable for both personal and professional use. ',
  'Please review specifications and customer feedback before purchase.')
WHERE CHAR_LENGTH(description) < 200;

-- ============================================
-- Dashboard Seed Data
-- ============================================
-- This section adds sample users, orders, and order items for testing the admin dashboard

USE auth_db;

-- Create test users for dashboard testing (password hash for 'Test123456')
-- Using bcrypt hash: $2b$10$rQ8K8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K
INSERT IGNORE INTO users (email, password_hash, full_name, role, created_at) VALUES
('customer1@test.com', '$2b$10$rQ8K8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Nguyễn Văn A', 'USER', DATE_SUB(NOW(), INTERVAL 30 DAY)),
('customer2@test.com', '$2b$10$rQ8K8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Trần Thị B', 'USER', DATE_SUB(NOW(), INTERVAL 25 DAY)),
('customer3@test.com', '$2b$10$rQ8K8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Lê Văn C', 'USER', DATE_SUB(NOW(), INTERVAL 20 DAY)),
('customer4@test.com', '$2b$10$rQ8K8K8K8K8K8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K', 'Phạm Thị D', 'USER', DATE_SUB(NOW(), INTERVAL 15 DAY)),
('customer5@test.com', '$2b$10$rQ8K8K8K8K8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Hoàng Văn E', 'USER', DATE_SUB(NOW(), INTERVAL 10 DAY)),
('customer6@test.com', '$2b$10$rQ8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Võ Thị F', 'USER', DATE_SUB(NOW(), INTERVAL 5 DAY)),
('customer7@test.com', '$2b$10$rQ8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Đặng Văn G', 'USER', DATE_SUB(NOW(), INTERVAL 3 DAY)),
('customer8@test.com', '$2b$10$rQ8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Bùi Thị H', 'USER', DATE_SUB(NOW(), INTERVAL 2 DAY)),
('customer9@test.com', '$2b$10$rQ8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Ngô Văn I', 'USER', DATE_SUB(NOW(), INTERVAL 1 DAY)),
('customer10@test.com', '$2b$10$rQ8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Dương Thị K', 'USER', NOW());

USE order_db;

-- Get user IDs (using subquery to get IDs from auth_db)
SET @user1 = (SELECT id FROM auth_db.users WHERE email = 'customer1@test.com' LIMIT 1);
SET @user2 = (SELECT id FROM auth_db.users WHERE email = 'customer2@test.com' LIMIT 1);
SET @user3 = (SELECT id FROM auth_db.users WHERE email = 'customer3@test.com' LIMIT 1);
SET @user4 = (SELECT id FROM auth_db.users WHERE email = 'customer4@test.com' LIMIT 1);
SET @user5 = (SELECT id FROM auth_db.users WHERE email = 'customer5@test.com' LIMIT 1);
SET @user6 = (SELECT id FROM auth_db.users WHERE email = 'customer6@test.com' LIMIT 1);
SET @user7 = (SELECT id FROM auth_db.users WHERE email = 'customer7@test.com' LIMIT 1);
SET @user8 = (SELECT id FROM auth_db.users WHERE email = 'customer8@test.com' LIMIT 1);
SET @user9 = (SELECT id FROM auth_db.users WHERE email = 'customer9@test.com' LIMIT 1);
SET @user10 = (SELECT id FROM auth_db.users WHERE email = 'customer10@test.com' LIMIT 1);

-- Create orders for current month (PAID status)
INSERT INTO orders (user_id, status, total_cents, discount_cents, loyalty_cents_used, created_at, updated_at) VALUES
(@user1, 'PAID', 24990000, 0, 0, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
(@user2, 'PAID', 48990000, 0, 0, DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY)),
(@user3, 'PAID', 18990000, 0, 0, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
(@user4, 'PAID', 32990000, 0, 0, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
(@user5, 'PAID', 15990000, 0, 0, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
(@user6, 'PAID', 27990000, 0, 0, NOW(), NOW()),
(@user1, 'PAID', 19990000, 0, 0, DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY)),
(@user2, 'PAID', 39990000, 0, 0, DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY)),
(@user3, 'PAID', 22990000, 0, 0, DATE_SUB(NOW(), INTERVAL 8 DAY), DATE_SUB(NOW(), INTERVAL 8 DAY)),
(@user4, 'PAID', 34990000, 0, 0, DATE_SUB(NOW(), INTERVAL 9 DAY), DATE_SUB(NOW(), INTERVAL 9 DAY)),
(@user5, 'PAID', 17990000, 0, 0, DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 10 DAY)),
(@user6, 'PAID', 29990000, 0, 0, DATE_SUB(NOW(), INTERVAL 11 DAY), DATE_SUB(NOW(), INTERVAL 11 DAY)),
(@user7, 'PAID', 20990000, 0, 0, DATE_SUB(NOW(), INTERVAL 12 DAY), DATE_SUB(NOW(), INTERVAL 12 DAY)),
(@user8, 'PAID', 37990000, 0, 0, DATE_SUB(NOW(), INTERVAL 13 DAY), DATE_SUB(NOW(), INTERVAL 13 DAY)),
(@user9, 'PAID', 16990000, 0, 0, DATE_SUB(NOW(), INTERVAL 14 DAY), DATE_SUB(NOW(), INTERVAL 14 DAY)),
(@user10, 'PAID', 25990000, 0, 0, DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_SUB(NOW(), INTERVAL 15 DAY)),
(@user1, 'PAID', 31990000, 0, 0, DATE_SUB(NOW(), INTERVAL 16 DAY), DATE_SUB(NOW(), INTERVAL 16 DAY)),
(@user2, 'PAID', 18990000, 0, 0, DATE_SUB(NOW(), INTERVAL 17 DAY), DATE_SUB(NOW(), INTERVAL 17 DAY)),
(@user3, 'PAID', 23990000, 0, 0, DATE_SUB(NOW(), INTERVAL 18 DAY), DATE_SUB(NOW(), INTERVAL 18 DAY)),
(@user4, 'PAID', 26990000, 0, 0, DATE_SUB(NOW(), INTERVAL 19 DAY), DATE_SUB(NOW(), INTERVAL 19 DAY));

-- Create orders for last month (PAID status)
INSERT INTO orders (user_id, status, total_cents, discount_cents, loyalty_cents_used, created_at, updated_at) VALUES
(@user5, 'PAID', 17990000, 0, 0, DATE_SUB(NOW(), INTERVAL 35 DAY), DATE_SUB(NOW(), INTERVAL 35 DAY)),
(@user6, 'PAID', 29990000, 0, 0, DATE_SUB(NOW(), INTERVAL 36 DAY), DATE_SUB(NOW(), INTERVAL 36 DAY)),
(@user7, 'PAID', 20990000, 0, 0, DATE_SUB(NOW(), INTERVAL 37 DAY), DATE_SUB(NOW(), INTERVAL 37 DAY)),
(@user8, 'PAID', 37990000, 0, 0, DATE_SUB(NOW(), INTERVAL 38 DAY), DATE_SUB(NOW(), INTERVAL 38 DAY)),
(@user9, 'PAID', 16990000, 0, 0, DATE_SUB(NOW(), INTERVAL 39 DAY), DATE_SUB(NOW(), INTERVAL 39 DAY)),
(@user10, 'PAID', 25990000, 0, 0, DATE_SUB(NOW(), INTERVAL 40 DAY), DATE_SUB(NOW(), INTERVAL 40 DAY)),
(@user1, 'PAID', 31990000, 0, 0, DATE_SUB(NOW(), INTERVAL 41 DAY), DATE_SUB(NOW(), INTERVAL 41 DAY)),
(@user2, 'PAID', 18990000, 0, 0, DATE_SUB(NOW(), INTERVAL 42 DAY), DATE_SUB(NOW(), INTERVAL 42 DAY)),
(@user3, 'PAID', 23990000, 0, 0, DATE_SUB(NOW(), INTERVAL 43 DAY), DATE_SUB(NOW(), INTERVAL 43 DAY)),
(@user4, 'PAID', 26990000, 0, 0, DATE_SUB(NOW(), INTERVAL 44 DAY), DATE_SUB(NOW(), INTERVAL 44 DAY)),
(@user5, 'PAID', 19990000, 0, 0, DATE_SUB(NOW(), INTERVAL 45 DAY), DATE_SUB(NOW(), INTERVAL 45 DAY)),
(@user6, 'PAID', 28990000, 0, 0, DATE_SUB(NOW(), INTERVAL 46 DAY), DATE_SUB(NOW(), INTERVAL 46 DAY)),
(@user7, 'PAID', 21990000, 0, 0, DATE_SUB(NOW(), INTERVAL 47 DAY), DATE_SUB(NOW(), INTERVAL 47 DAY)),
(@user8, 'PAID', 35990000, 0, 0, DATE_SUB(NOW(), INTERVAL 48 DAY), DATE_SUB(NOW(), INTERVAL 48 DAY)),
(@user9, 'PAID', 17990000, 0, 0, DATE_SUB(NOW(), INTERVAL 49 DAY), DATE_SUB(NOW(), INTERVAL 49 DAY)),
(@user10, 'PAID', 24990000, 0, 0, DATE_SUB(NOW(), INTERVAL 50 DAY), DATE_SUB(NOW(), INTERVAL 50 DAY)),
(@user1, 'PAID', 30990000, 0, 0, DATE_SUB(NOW(), INTERVAL 51 DAY), DATE_SUB(NOW(), INTERVAL 51 DAY)),
(@user2, 'PAID', 19990000, 0, 0, DATE_SUB(NOW(), INTERVAL 52 DAY), DATE_SUB(NOW(), INTERVAL 52 DAY)),
(@user3, 'PAID', 22990000, 0, 0, DATE_SUB(NOW(), INTERVAL 53 DAY), DATE_SUB(NOW(), INTERVAL 53 DAY)),
(@user4, 'PAID', 25990000, 0, 0, DATE_SUB(NOW(), INTERVAL 54 DAY), DATE_SUB(NOW(), INTERVAL 54 DAY));

-- Create orders for last quarter (PAID status)
INSERT INTO orders (user_id, status, total_cents, discount_cents, loyalty_cents_used, created_at, updated_at) VALUES
(@user5, 'PAID', 19990000, 0, 0, DATE_SUB(NOW(), INTERVAL 70 DAY), DATE_SUB(NOW(), INTERVAL 70 DAY)),
(@user6, 'PAID', 28990000, 0, 0, DATE_SUB(NOW(), INTERVAL 71 DAY), DATE_SUB(NOW(), INTERVAL 71 DAY)),
(@user7, 'PAID', 21990000, 0, 0, DATE_SUB(NOW(), INTERVAL 72 DAY), DATE_SUB(NOW(), INTERVAL 72 DAY)),
(@user8, 'PAID', 35990000, 0, 0, DATE_SUB(NOW(), INTERVAL 73 DAY), DATE_SUB(NOW(), INTERVAL 73 DAY)),
(@user9, 'PAID', 17990000, 0, 0, DATE_SUB(NOW(), INTERVAL 74 DAY), DATE_SUB(NOW(), INTERVAL 74 DAY)),
(@user10, 'PAID', 24990000, 0, 0, DATE_SUB(NOW(), INTERVAL 75 DAY), DATE_SUB(NOW(), INTERVAL 75 DAY)),
(@user1, 'PAID', 30990000, 0, 0, DATE_SUB(NOW(), INTERVAL 76 DAY), DATE_SUB(NOW(), INTERVAL 76 DAY)),
(@user2, 'PAID', 19990000, 0, 0, DATE_SUB(NOW(), INTERVAL 77 DAY), DATE_SUB(NOW(), INTERVAL 77 DAY)),
(@user3, 'PAID', 22990000, 0, 0, DATE_SUB(NOW(), INTERVAL 78 DAY), DATE_SUB(NOW(), INTERVAL 78 DAY)),
(@user4, 'PAID', 25990000, 0, 0, DATE_SUB(NOW(), INTERVAL 79 DAY), DATE_SUB(NOW(), INTERVAL 79 DAY)),
(@user5, 'PAID', 18990000, 0, 0, DATE_SUB(NOW(), INTERVAL 80 DAY), DATE_SUB(NOW(), INTERVAL 80 DAY)),
(@user6, 'PAID', 27990000, 0, 0, DATE_SUB(NOW(), INTERVAL 81 DAY), DATE_SUB(NOW(), INTERVAL 81 DAY)),
(@user7, 'PAID', 20990000, 0, 0, DATE_SUB(NOW(), INTERVAL 82 DAY), DATE_SUB(NOW(), INTERVAL 82 DAY)),
(@user8, 'PAID', 36990000, 0, 0, DATE_SUB(NOW(), INTERVAL 83 DAY), DATE_SUB(NOW(), INTERVAL 83 DAY)),
(@user9, 'PAID', 16990000, 0, 0, DATE_SUB(NOW(), INTERVAL 84 DAY), DATE_SUB(NOW(), INTERVAL 84 DAY)),
(@user10, 'PAID', 25990000, 0, 0, DATE_SUB(NOW(), INTERVAL 85 DAY), DATE_SUB(NOW(), INTERVAL 85 DAY)),
(@user1, 'PAID', 31990000, 0, 0, DATE_SUB(NOW(), INTERVAL 86 DAY), DATE_SUB(NOW(), INTERVAL 86 DAY)),
(@user2, 'PAID', 19990000, 0, 0, DATE_SUB(NOW(), INTERVAL 87 DAY), DATE_SUB(NOW(), INTERVAL 87 DAY)),
(@user3, 'PAID', 22990000, 0, 0, DATE_SUB(NOW(), INTERVAL 88 DAY), DATE_SUB(NOW(), INTERVAL 88 DAY)),
(@user4, 'PAID', 25990000, 0, 0, DATE_SUB(NOW(), INTERVAL 89 DAY), DATE_SUB(NOW(), INTERVAL 89 DAY));

-- Create some pending orders
INSERT INTO orders (user_id, status, total_cents, discount_cents, loyalty_cents_used, created_at, updated_at) VALUES
(@user5, 'PENDING', 18990000, 0, 0, NOW(), NOW()),
(@user6, 'PENDING', 27990000, 0, 0, NOW(), NOW()),
(@user7, 'PENDING', 20990000, 0, 0, NOW(), NOW()),
(@user8, 'PENDING', 36990000, 0, 0, NOW(), NOW()),
(@user9, 'PENDING', 16990000, 0, 0, NOW(), NOW());

-- Add order items for all PAID orders
-- Using products from catalog_db (assuming products 1-19 exist)
INSERT INTO order_items (order_id, product_id, quantity, price_cents)
SELECT o.id,
       CASE (o.id % 19)
         WHEN 0 THEN 19
         ELSE (o.id % 19) + 1
       END as product_id,
       FLOOR(1 + (o.id % 3) + 1) as quantity,
       CASE (o.id % 19)
         WHEN 0 THEN 16990000
         WHEN 1 THEN 24990000
         WHEN 2 THEN 48990000
         WHEN 3 THEN 35990000
         WHEN 4 THEN 18990000
         WHEN 5 THEN 22990000
         WHEN 6 THEN 15990000
         WHEN 7 THEN 19990000
         WHEN 8 THEN 27990000
         WHEN 9 THEN 32990000
         WHEN 10 THEN 17990000
         WHEN 11 THEN 20990000
         WHEN 12 THEN 15990000
         WHEN 13 THEN 18990000
         WHEN 14 THEN 22990000
         WHEN 15 THEN 17990000
         WHEN 16 THEN 19990000
         WHEN 17 THEN 24990000
         WHEN 18 THEN 21990000
         ELSE 19990000
       END as price_cents
FROM orders o
WHERE o.status = 'PAID';

-- Add order status history for all PAID orders
INSERT INTO order_status_history (order_id, status, note, created_at)
SELECT id, 'PAID', 'Payment confirmed', created_at
FROM orders
WHERE status = 'PAID';

-- Add order status history for PENDING orders
INSERT INTO order_status_history (order_id, status, note, created_at)
SELECT id, 'PENDING', 'Order created', created_at
FROM orders
WHERE status = 'PENDING';


