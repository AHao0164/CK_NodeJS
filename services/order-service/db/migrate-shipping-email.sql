-- Migration: Add shipping_email column to orders table
-- Run this script to add the missing column to existing database

USE order_db;

-- Add shipping_email column (ignore error if exists)
SET @dbname = DATABASE();
SET @tablename = 'orders';
SET @columnname = 'shipping_email';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(255) AFTER shipping_phone')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SELECT 'Migration completed: shipping_email column added (if it did not exist)' AS result;

