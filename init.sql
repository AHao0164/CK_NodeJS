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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
INSERT INTO brands (name) VALUES ('Apple'), ('Dell'), ('Lenovo') ON DUPLICATE KEY UPDATE name=VALUES(name);
INSERT INTO categories (name) VALUES ('Ultrabook'), ('Gaming'), ('Business') ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Seed a few products and inventory
INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'MacBook Air M2 13"', b.id, c.id, 'Chip M2, 8GB, 256GB SSD', 24990000, JSON_OBJECT('ram','8GB','ssd','256GB')
FROM brands b, categories c WHERE b.name='Apple' AND c.name='Ultrabook'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'Dell XPS 13', b.id, c.id, 'Intel i7, 16GB, 512GB SSD', 32990000, JSON_OBJECT('ram','16GB','ssd','512GB')
FROM brands b, categories c WHERE b.name='Dell' AND c.name='Ultrabook'
ON DUPLICATE KEY UPDATE products.name=products.name;

INSERT INTO products (name, brand_id, category_id, description, price_cents, specs)
SELECT 'Lenovo Legion 5', b.id, c.id, 'Ryzen 7, RTX 4060, 16GB', 35990000, JSON_OBJECT('gpu','RTX4060','ram','16GB')
FROM brands b, categories c WHERE b.name='Lenovo' AND c.name='Gaming'
ON DUPLICATE KEY UPDATE products.name=products.name;

-- Backfill inventory for all products if missing
INSERT IGNORE INTO inventory (product_id, stock)
SELECT id, 20 FROM products;

