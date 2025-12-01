-- Add missing user profile fields to users table
-- Run this after initial schema creation if upgrading existing database

-- Check and add province column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE table_schema = DATABASE()
   AND table_name = 'users'
   AND column_name = 'province') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN province VARCHAR(100) AFTER phone'
));
PREPARE alterStatement FROM @preparedStatement;
EXECUTE alterStatement;
DEALLOCATE PREPARE alterStatement;

-- Check and add ward column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE table_schema = DATABASE()
   AND table_name = 'users'
   AND column_name = 'ward') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN ward VARCHAR(100) AFTER province'
));
PREPARE alterStatement FROM @preparedStatement;
EXECUTE alterStatement;
DEALLOCATE PREPARE alterStatement;

-- Check and add address_detail column
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE table_schema = DATABASE()
   AND table_name = 'users'
   AND column_name = 'address_detail') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN address_detail TEXT AFTER ward'
));
PREPARE alterStatement FROM @preparedStatement;
EXECUTE alterStatement;
DEALLOCATE PREPARE alterStatement;

-- Update test users with complete profile info
UPDATE users SET 
  phone = '0912345678',
  province = 'Hà Nội',
  ward = 'Hoàn Kiếm',
  address_detail = '123 Nguyễn Huệ'
WHERE email = 'user1@example.com';

UPDATE users SET 
  phone = '0987654321',
  province = 'Hồ Chí Minh',
  ward = 'Quận 1',
  address_detail = '456 Lê Lợi'
WHERE email = 'user2@example.com';
