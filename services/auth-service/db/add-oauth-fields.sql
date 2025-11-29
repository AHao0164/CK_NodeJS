-- Add OAuth fields for Google and Facebook
-- This migration adds oauth_provider and oauth_id columns
-- Also adds password_reset_tokens table for token-based password reset

-- Add oauth_provider and oauth_id columns (if not exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255) DEFAULT NULL;

-- Make password_hash nullable for OAuth users
ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) DEFAULT NULL;

-- Add index for OAuth lookup
CREATE INDEX IF NOT EXISTS idx_oauth ON users(oauth_provider, oauth_id);

-- Create password_reset_tokens table for token-based password reset
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires (expires_at)
);

