-- ============================================
-- PAYMENT DATABASE SCHEMA
-- ============================================
-- Service: payment-service  
-- Database: payment_db
-- Purpose: Payment transaction tracking
-- ============================================

CREATE DATABASE IF NOT EXISTS payment_db;
USE payment_db;

-- Payment transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  amount_cents INT NOT NULL,
  
  -- Payment method details
  payment_method ENUM('COD','BANK_TRANSFER','CREDIT_CARD','MOMO','ZALOPAY') NOT NULL,
  payment_provider VARCHAR(100),
  
  -- Transaction details
  transaction_id VARCHAR(255) UNIQUE,
  status ENUM('PENDING','SUCCESS','FAILED','REFUNDED') DEFAULT 'PENDING',
  
  -- Banking info (for bank transfer)
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

-- ============================================
-- SEED DATA - PAYMENT METHODS
-- ============================================

INSERT INTO payment_methods (code, name, description, active) VALUES
('COD', 'Thanh toán khi nhận hàng', 'Thanh toán tiền mặt khi nhận hàng', 1),
('BANK_TRANSFER', 'Chuyển khoản ngân hàng', 'Chuyển khoản qua tài khoản ngân hàng', 1),
('MOMO', 'Ví MoMo', 'Thanh toán qua ví điện tử MoMo', 1),
('ZALOPAY', 'ZaloPay', 'Thanh toán qua ví điện tử ZaloPay', 1),
('CREDIT_CARD', 'Thẻ tín dụng/ghi nợ', 'Thanh toán bằng thẻ quốc tế', 0)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ============================================
-- NOTES
-- ============================================
-- Payment service integrates with external payment gateways
-- Stores transaction history for audit and reconciliation
-- Supports multiple payment methods
