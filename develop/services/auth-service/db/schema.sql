-- ============================================
-- AUTH DATABASE SCHEMA
-- ============================================
-- Service: auth-service
-- Database: auth_db
-- Purpose: User authentication and authorization
-- ============================================

CREATE DATABASE IF NOT EXISTS auth_db;
USE auth_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  province VARCHAR(100),
  ward VARCHAR(100),
  address_detail TEXT,
  role ENUM('USER','ADMIN') DEFAULT 'USER',
  is_verified TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
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

-- ============================================
-- SEED DATA - DEFAULT ADMIN USER
-- ============================================

-- Insert default admin (password: admin123)
INSERT INTO users (email, password_hash, full_name, role, is_verified) 
VALUES ('admin@gearup.vn', '$2a$10$lR0xD5sHMZQvQxLKyDa/ge4bub6k8O6.sZt.Asei3NN/QXD5ETgyC', 'Admin GearUp', 'ADMIN', 1)
ON DUPLICATE KEY UPDATE email=email;

-- Insert sample terms and conditions
INSERT INTO terms_policies (type, title, content, version, active) VALUES
('terms', 'Điều khoản sử dụng', 'Nội dung điều khoản sử dụng...', '1.0', 1),
('privacy', 'Chính sách bảo mật', 'Nội dung chính sách bảo mật...', '1.0', 1)
ON DUPLICATE KEY UPDATE type=type;
