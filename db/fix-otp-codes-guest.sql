-- Quick fix: Allow user_id to be NULL in otp_codes for guest users
-- Run this if you get "Column 'user_id' cannot be null" error

USE auth_db;

-- Step 1: Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

-- Step 2: Drop foreign key constraint (ignore error if doesn't exist)
SET @fkName = (
  SELECT CONSTRAINT_NAME 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'otp_codes' 
    AND COLUMN_NAME = 'user_id' 
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);

SET @sql = IF(@fkName IS NOT NULL, 
  CONCAT('ALTER TABLE otp_codes DROP FOREIGN KEY ', @fkName), 
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 3: Drop unique constraint if exists
SET @constraintExists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'otp_codes' 
    AND CONSTRAINT_NAME = 'unique_user_type'
);

SET @sql = IF(@constraintExists > 0,
  'ALTER TABLE otp_codes DROP INDEX unique_user_type',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 4: Modify user_id to allow NULL
ALTER TABLE otp_codes MODIFY COLUMN user_id BIGINT NULL;

-- Step 5: Add new unique constraint that includes email for guest users
ALTER TABLE otp_codes ADD UNIQUE KEY unique_user_type (user_id, type, email);

-- Step 6: Re-add foreign key constraint (only applies when user_id is NOT NULL)
ALTER TABLE otp_codes 
ADD CONSTRAINT fk_otp_codes_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 7: Add index for better query performance (ignore if exists)
SET @indexExists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'otp_codes' 
    AND INDEX_NAME = 'idx_user_email'
);

SET @sql = IF(@indexExists = 0,
  'ALTER TABLE otp_codes ADD INDEX idx_user_email (user_id, email)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 8: Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

SELECT '✅ Migration completed: otp_codes table now supports guest users (user_id can be NULL)' AS result;

