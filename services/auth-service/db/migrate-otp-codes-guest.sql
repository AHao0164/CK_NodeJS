-- Migration: Allow user_id to be NULL in otp_codes table for guest users
-- Run this script to update existing database

USE auth_db;

-- Step 1: Drop foreign key constraint if exists
SET @dbname = DATABASE();
SET @tablename = 'otp_codes';

-- Find foreign key constraint name
SET @fkName = (
  SELECT CONSTRAINT_NAME 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = @tablename 
    AND COLUMN_NAME = 'user_id' 
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);

-- Drop foreign key if exists
SET @preparedStatement = (SELECT IF(
  @fkName IS NOT NULL,
  CONCAT('ALTER TABLE ', @tablename, ' DROP FOREIGN KEY ', @fkName),
  'SELECT 1'
));
PREPARE dropFK FROM @preparedStatement;
EXECUTE dropFK;
DEALLOCATE PREPARE dropFK;

-- Step 2: Drop unique constraint if exists
SET @constraintname = 'unique_user_type';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (constraint_name = @constraintname)
  ) > 0,
  CONCAT('ALTER TABLE ', @tablename, ' DROP INDEX ', @constraintname),
  'SELECT 1'
));
PREPARE dropIfExists FROM @preparedStatement;
EXECUTE dropIfExists;
DEALLOCATE PREPARE dropIfExists;

-- Step 3: Modify user_id to allow NULL
ALTER TABLE otp_codes MODIFY COLUMN user_id BIGINT NULL;

-- Step 4: Add new unique constraint that includes email for guest users
ALTER TABLE otp_codes ADD UNIQUE KEY unique_user_type (user_id, type, email);

-- Step 5: Re-add foreign key constraint (only applies when user_id is NOT NULL)
ALTER TABLE otp_codes 
ADD CONSTRAINT fk_otp_codes_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 6: Add index for better query performance (ignore error if exists)
SET @indexExists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = @dbname 
    AND TABLE_NAME = @tablename 
    AND INDEX_NAME = 'idx_user_email'
);

SET @preparedStatement = (SELECT IF(
  @indexExists > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD INDEX idx_user_email (user_id, email)')
));
PREPARE addIndex FROM @preparedStatement;
EXECUTE addIndex;
DEALLOCATE PREPARE addIndex;

SELECT 'Migration completed: otp_codes table updated to support guest users' AS result;

