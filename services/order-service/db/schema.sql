-- ============================================
-- ORDER DATABASE SCHEMA
-- ============================================
-- Service: order-service
-- Database: order_db
-- Purpose: Order management and tracking
-- ============================================

CREATE DATABASE IF NOT EXISTS order_db;
USE order_db;

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  total_cents INT NOT NULL,
  discount_cents INT DEFAULT 0,
  points_used INT DEFAULT 0,
  points_discount_cents INT DEFAULT 0,
  coupon_code VARCHAR(20),
  status ENUM('PENDING','CONFIRMED','SHIPPING','DELIVERED','CANCELLED') DEFAULT 'PENDING',
  payment_method ENUM('COD','BANK_TRANSFER','CREDIT_CARD','MOMO','ZALOPAY','VNPAY') DEFAULT 'COD',
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
-- NOTES
-- ============================================
-- Order service handles complete order lifecycle
-- Status flow: PENDING → CONFIRMED → SHIPPING → DELIVERED
-- Can be cancelled at any stage before SHIPPING
