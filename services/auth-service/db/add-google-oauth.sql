-- Add google_id column for Google OAuth users (if not exists, will fail silently)
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE DEFAULT NULL;

-- Make password_hash nullable for Google OAuth users
ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) DEFAULT NULL;
