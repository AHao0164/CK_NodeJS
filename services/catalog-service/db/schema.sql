-- ============================================
-- CATALOG DATABASE SCHEMA
-- ============================================
-- Service: catalog-service
-- Database: catalog_db
-- Purpose: Product catalog, categories, brands, reviews
-- ============================================

CREATE DATABASE IF NOT EXISTS catalog_db;
USE catalog_db;

-- ============================================
-- CORE CATALOG TABLES
-- ============================================

-- Brands table
CREATE TABLE IF NOT EXISTS brands (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(255),
  description TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_display_order (display_order),
  INDEX idx_name (name)
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(255),
  description TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_display_order (display_order),
  INDEX idx_name (name)
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  sku VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  brand_id BIGINT,
  category_id BIGINT,
  description TEXT,
  price_cents INT NOT NULL,
  discount_percent INT DEFAULT 0,
  specs JSON,
  features JSON,
  image_url VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_brand (brand_id),
  INDEX idx_category (category_id),
  INDEX idx_price (price_cents),
  INDEX idx_name (name),
  FULLTEXT idx_search (name, description)
);

-- Product images table
CREATE TABLE IF NOT EXISTS product_images (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT NOT NULL,
  url VARCHAR(512) NOT NULL,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (product_id),
  INDEX idx_sort (product_id, sort_order)
);

-- Inventory table (for products without variants)
CREATE TABLE IF NOT EXISTS inventory (
  product_id BIGINT PRIMARY KEY,
  stock INT NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_stock (stock)
);

-- Product variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  price_cents INT NOT NULL,
  discount_percent INT DEFAULT 0,
  image_url VARCHAR(512),
  attributes JSON, -- e.g., {"color": "Black", "size": "256GB", "ram": "16GB"}
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (product_id),
  INDEX idx_sku (sku),
  INDEX idx_display_order (product_id, display_order)
);

-- Variant inventory table (independent stock tracking per variant)
CREATE TABLE IF NOT EXISTS variant_inventory (
  variant_id BIGINT PRIMARY KEY,
  stock INT NOT NULL DEFAULT 0,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  INDEX idx_stock (stock)
);

-- ============================================
-- BANNERS & PROMOTIONS
-- ============================================

-- Banners table
CREATE TABLE IF NOT EXISTS banners (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  image_url VARCHAR(512) NOT NULL,
  link_url VARCHAR(512),
  active TINYINT(1) NOT NULL DEFAULT 1,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active_order (active, display_order)
);

-- ============================================
-- REVIEWS & RATINGS
-- ============================================

-- Product reviews table
CREATE TABLE IF NOT EXISTS product_reviews (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  admin_reply TEXT,
  replied_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (product_id),
  INDEX idx_user (user_id),
  INDEX idx_rating (rating),
  INDEX idx_created (created_at)
);

-- Review comments table (for discussions)
CREATE TABLE IF NOT EXISTS review_comments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  review_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  is_admin TINYINT(1) DEFAULT 0,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES product_reviews(id) ON DELETE CASCADE,
  INDEX idx_review (review_id),
  INDEX idx_created (created_at)
);

-- Guest comments table (comments from non-logged-in users, no rating)
CREATE TABLE IF NOT EXISTS guest_comments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT NOT NULL,
  guest_name VARCHAR(255) NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (product_id),
  INDEX idx_created (created_at)
);

-- ============================================
-- SEED DATA - SAMPLE BRANDS & CATEGORIES
-- ============================================

-- Insert sample brands
INSERT INTO brands (name, description, display_order) VALUES 
('Apple', 'Công nghệ cao cấp từ Mỹ', 1),
('Dell', 'Laptop & PC tin cậy', 2),
('Asus', 'Gaming và đồ họa chuyên nghiệp', 3),
('Lenovo', 'Thương hiệu toàn cầu', 4),
('HP', 'Giải pháp văn phòng', 5),
('MSI', 'Chuyên gaming cao cấp', 6),
('Acer', 'Đa dạng sản phẩm', 7)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Insert sample categories
INSERT INTO categories (name, description, display_order) VALUES
('Laptop Gaming', 'Laptop hiệu năng cao cho game thủ', 1),
('Laptop Văn phòng', 'Laptop cho công việc văn phòng', 2),
('Laptop Đồ họa', 'Laptop chuyên đồ họa, thiết kế', 3),
('Laptop Sinh viên', 'Laptop phù hợp sinh viên', 4),
('PC Gaming', 'Máy tính bàn gaming', 5),
('PC Văn phòng', 'Máy tính bàn văn phòng', 6),
('Linh kiện', 'Linh kiện máy tính', 7),
('Phụ kiện', 'Phụ kiện máy tính', 8)
ON DUPLICATE KEY UPDATE name=VALUES(name);
