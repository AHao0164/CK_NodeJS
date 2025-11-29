-- Migration script to add product_variants and variant_inventory tables
-- Run this if the tables don't exist yet

USE catalog_db;

-- Product variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  price_cents INT NOT NULL,
  discount_percent INT DEFAULT 0,
  image_url VARCHAR(512),
  attributes JSON, -- e.g., {"color": "Black", "size": "256GB", "ram": "16GB"}
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product (product_id),
  INDEX idx_sku (sku),
  INDEX idx_display_order (product_id, display_order)
);

-- Variant inventory table (independent stock tracking per variant)
CREATE TABLE IF NOT EXISTS variant_inventory (
  variant_id BIGINT PRIMARY KEY,
  stock INT NOT NULL DEFAULT 0,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  INDEX idx_stock (stock)
);

SELECT '✅ Migration completed: product_variants and variant_inventory tables created' AS status;

