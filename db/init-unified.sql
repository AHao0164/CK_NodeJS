CREATE DATABASE IF NOT EXISTS auth_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE auth_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) DEFAULT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  province VARCHAR(100),
  ward VARCHAR(100),
  address_detail TEXT,
  role ENUM('USER','ADMIN') DEFAULT 'USER',
  is_verified TINYINT(1) DEFAULT 0,
  oauth_provider VARCHAR(50) DEFAULT NULL,
  oauth_id VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_oauth (oauth_provider, oauth_id)
);

-- OTP verification table
CREATE TABLE IF NOT EXISTS otp_verifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(10) NOT NULL,
  purpose ENUM('signup','reset_password','verify_email') DEFAULT 'signup',
  expires_at TIMESTAMP NOT NULL,
  used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_purpose (email, purpose),
  INDEX idx_expires (expires_at)
);

-- OTP codes table for COD verification
CREATE TABLE IF NOT EXISTS otp_codes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  type ENUM('COD','EMAIL_VERIFY','PASSWORD_RESET') DEFAULT 'COD',
  expires_at TIMESTAMP NOT NULL,
  used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_type (user_id, type),
  INDEX idx_email (email),
  INDEX idx_expires (expires_at)
);

-- Password reset tokens table (for token-based password reset)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires (expires_at)
);

-- Addresses table
CREATE TABLE IF NOT EXISTS addresses (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  province VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  ward VARCHAR(100) NOT NULL,
  address_detail TEXT NOT NULL,
  is_default TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_default (user_id, is_default)
);

-- Terms and policies
CREATE TABLE IF NOT EXISTS terms_policies (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  type ENUM('terms','privacy','other') NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  version VARCHAR(20) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed: Default admin user (email: tenho051512@gmail.com, password: admin123456)
-- Bcrypt hash for 'admin123456'
INSERT INTO users (email, password_hash, full_name, role, is_verified) 
VALUES ('tenho051512@gmail.com', '$2a$10$rFM0h0Hw2rcy8Htsg/jNeefLsgCffCGietAgmZlbx.K7Q4wTuM6za', 'System Administrator', 'ADMIN', 1)
ON DUPLICATE KEY UPDATE email=email;

-- Seed: Terms and privacy (UTF-8 safe)
INSERT INTO terms_policies (type, title, content, version, active) VALUES
('terms', 'Điều khoản sử dụng', 'Chào mừng bạn đến với GearUp! Vui lòng đọc kỹ các điều khoản và điều kiện sử dụng dịch vụ của chúng tôi.', '1.0', 1),
('privacy', 'Chính sách bảo mật', 'Chúng tôi cam kết bảo vệ thông tin cá nhân của bạn theo quy định pháp luật Việt Nam.', '1.0', 1)
ON DUPLICATE KEY UPDATE type=type;

-- ============================================
-- CATALOG SERVICE DATABASE
-- ============================================

CREATE DATABASE IF NOT EXISTS catalog_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE catalog_db;

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

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  product_id BIGINT PRIMARY KEY,
  stock INT NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_stock (stock)
);

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

-- Review comments table
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

-- Seed: Sample brands
INSERT INTO brands (name, description, display_order) VALUES 
('Apple', 'Công nghệ cao cấp từ Mỹ', 1),
('Dell', 'Laptop & PC tin cậy', 2),
('Asus', 'Gaming và đồ họa chuyên nghiệp', 3),
('Lenovo', 'Thương hiệu toàn cầu', 4),
('HP', 'Giải pháp văn phòng', 5),
('MSI', 'Chuyên gaming cao cấp', 6),
('Acer', 'Đa dạng sản phẩm', 7)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Seed: Sample categories
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

-- ============================================
-- CART SERVICE DATABASE
-- ============================================

CREATE DATABASE IF NOT EXISTS cart_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cart_db;

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_product (user_id, product_id),
  INDEX idx_user_id (user_id),
  INDEX idx_product_id (product_id),
  INDEX idx_updated (updated_at)
);

-- ============================================
-- ORDER SERVICE DATABASE
-- ============================================

CREATE DATABASE IF NOT EXISTS order_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE order_db;

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  total_cents INT NOT NULL,
  status ENUM('PENDING','CONFIRMED','SHIPPING','DELIVERED','CANCELLED') DEFAULT 'PENDING',
  payment_method ENUM('COD','VNPAY') DEFAULT 'COD',
  payment_status ENUM('PENDING','PAID','FAILED') DEFAULT 'PENDING',
  
  -- Shipping info
  shipping_name VARCHAR(255) NOT NULL,
  shipping_phone VARCHAR(20) NOT NULL,
  shipping_province VARCHAR(100) NOT NULL,
  shipping_district VARCHAR(100) NOT NULL,
  shipping_ward VARCHAR(100) NOT NULL,
  shipping_address TEXT NOT NULL,
  shipping_fee_cents INT DEFAULT 0,
  
  -- Tracking
  tracking_number VARCHAR(100),
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP NULL,
  shipped_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_payment (payment_status),
  INDEX idx_created (created_at),
  INDEX idx_tracking (tracking_number)
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  product_image VARCHAR(512),
  price_cents INT NOT NULL,
  quantity INT NOT NULL,
  subtotal_cents INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order_id (order_id),
  INDEX idx_product_id (product_id)
);

-- Order status history table
CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  notes TEXT,
  changed_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order_id (order_id),
  INDEX idx_created (created_at)
);

-- ============================================
-- PAYMENT SERVICE DATABASE
-- ============================================

CREATE DATABASE IF NOT EXISTS payment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE payment_db;

-- Payment transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  amount_cents INT NOT NULL,
  
  -- Payment method details
  payment_method ENUM('COD','VNPAY') NOT NULL,
  payment_provider VARCHAR(100),
  
  -- Transaction details
  transaction_id VARCHAR(255) UNIQUE,
  status ENUM('PENDING','SUCCESS','FAILED','REFUNDED') DEFAULT 'PENDING',
  
  -- Banking info
  bank_code VARCHAR(50),
  bank_account VARCHAR(100),
  
  -- Gateway response
  gateway_response JSON,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  refunded_at TIMESTAMP NULL,
  
  INDEX idx_order_id (order_id),
  INDEX idx_user_id (user_id),
  INDEX idx_transaction_id (transaction_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
);

-- Payment methods configuration
CREATE TABLE IF NOT EXISTS payment_methods (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  active TINYINT(1) DEFAULT 1,
  config JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_active (active)
);

-- Seed: Payment methods
INSERT INTO payment_methods (code, name, description, active) VALUES
('COD', 'Thanh toán khi nhận hàng', 'Thanh toán tiền mặt khi nhận hàng', 1),
('VNPAY', 'Thanh toán VNPay', 'Thanh toán trực tuyến qua VNPay', 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================
-- END OF INIT SCRIPT
-- ============================================
