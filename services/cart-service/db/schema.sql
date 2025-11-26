-- ============================================
-- CART DATABASE SCHEMA
-- ============================================
-- Service: cart-service
-- Database: cart_db
-- Purpose: Shopping cart management
-- ============================================

CREATE DATABASE IF NOT EXISTS cart_db;
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
-- NOTES
-- ============================================
-- This service stores cart data temporarily
-- When user checks out, cart is cleared and order is created in order-service
