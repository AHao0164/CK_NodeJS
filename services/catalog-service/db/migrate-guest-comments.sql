-- Migration: Add guest_comments table
-- Run this script to add the missing guest_comments table to existing database

USE catalog_db;

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
