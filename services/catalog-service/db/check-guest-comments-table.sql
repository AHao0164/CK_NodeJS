-- Check if guest_comments table exists and create if not
-- Run: mysql -u root -p catalog_db < check-guest-comments-table.sql

USE catalog_db;

-- Check if table exists
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Table guest_comments exists'
        ELSE '❌ Table guest_comments does NOT exist'
    END AS table_status
FROM information_schema.tables 
WHERE table_schema = 'catalog_db' 
AND table_name = 'guest_comments';

-- Create table if not exists
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

-- Verify table was created
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Table guest_comments created successfully'
        ELSE '❌ Failed to create table guest_comments'
    END AS creation_status
FROM information_schema.tables 
WHERE table_schema = 'catalog_db' 
AND table_name = 'guest_comments';



