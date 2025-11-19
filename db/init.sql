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
CREATE TABLE IF NOT EXISTS inventory (
  product_id BIGINT PRIMARY KEY,
  stock INT NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Cart schema
USE cart_db;
CREATE TABLE IF NOT EXISTS carts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user (user_id)
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
  user_id BIGINT NOT NULL,
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- Coupons
CREATE TABLE IF NOT EXISTS coupons (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL UNIQUE,
  type ENUM('percentage','fixed','freeship') NOT NULL,
  value INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  start_date DATE,
  end_date DATE
);

-- Seed some coupons
INSERT INTO coupons (code, type, value, active, start_date, end_date)
VALUES ('SUMMER10', 'percentage', 10, 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY))
ON DUPLICATE KEY UPDATE value=VALUES(value);
INSERT INTO coupons (code, type, value, active, start_date, end_date)
VALUES ('SALE100K', 'fixed', 100000, 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY))
ON DUPLICATE KEY UPDATE value=VALUES(value);
INSERT INTO coupons (code, type, value, active, start_date, end_date)
VALUES ('FREESHIP', 'freeship', 0, 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY))
ON DUPLICATE KEY UPDATE active=VALUES(active);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  price_cents INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
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

