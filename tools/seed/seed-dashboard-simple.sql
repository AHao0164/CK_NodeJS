-- Seed Dashboard Data
-- This script adds sample users, orders, and order items for testing the dashboard

USE auth_db;

-- Create test users if they don't exist
INSERT IGNORE INTO users (email, password_hash, full_name, role, created_at) VALUES
('customer1@test.com', '$2b$10$rQ8K8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Nguyễn Văn A', 'USER', NOW() - INTERVAL 30 DAY),
('customer2@test.com', '$2b$10$rQ8K8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Trần Thị B', 'USER', NOW() - INTERVAL 25 DAY),
('customer3@test.com', '$2b$10$rQ8K8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Lê Văn C', 'USER', NOW() - INTERVAL 20 DAY),
('customer4@test.com', '$2b$10$rQ8K8K8K8K8K8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Phạm Thị D', 'USER', NOW() - INTERVAL 15 DAY),
('customer5@test.com', '$2b$10$rQ8K8K8K8K8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Hoàng Văn E', 'USER', NOW() - INTERVAL 10 DAY),
('customer6@test.com', '$2b$10$rQ8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Võ Thị F', 'USER', NOW() - INTERVAL 5 DAY),
('customer7@test.com', '$2b$10$rQ8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Đặng Văn G', 'USER', NOW() - INTERVAL 3 DAY),
('customer8@test.com', '$2b$10$rQ8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Bùi Thị H', 'USER', NOW() - INTERVAL 2 DAY),
('customer9@test.com', '$2b$10$rQ8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Ngô Văn I', 'USER', NOW() - INTERVAL 1 DAY),
('customer10@test.com', '$2b$10$rQ8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'Dương Thị K', 'USER', NOW());

-- Get user IDs
SET @user1 = (SELECT id FROM users WHERE email = 'customer1@test.com' LIMIT 1);
SET @user2 = (SELECT id FROM users WHERE email = 'customer2@test.com' LIMIT 1);
SET @user3 = (SELECT id FROM users WHERE email = 'customer3@test.com' LIMIT 1);
SET @user4 = (SELECT id FROM users WHERE email = 'customer4@test.com' LIMIT 1);
SET @user5 = (SELECT id FROM users WHERE email = 'customer5@test.com' LIMIT 1);
SET @user6 = (SELECT id FROM users WHERE email = 'customer6@test.com' LIMIT 1);
SET @user7 = (SELECT id FROM users WHERE email = 'customer7@test.com' LIMIT 1);
SET @user8 = (SELECT id FROM users WHERE email = 'customer8@test.com' LIMIT 1);
SET @user9 = (SELECT id FROM users WHERE email = 'customer9@test.com' LIMIT 1);
SET @user10 = (SELECT id FROM users WHERE email = 'customer10@test.com' LIMIT 1);

USE order_db;

-- Create orders with different statuses and dates
-- Current month orders (PAID)
INSERT INTO orders (user_id, status, total_cents, discount_cents, loyalty_cents_used, created_at, updated_at) VALUES
(@user1, 'PAID', 24990000, 0, 0, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
(@user2, 'PAID', 48990000, 0, 0, DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY)),
(@user3, 'PAID', 18990000, 0, 0, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
(@user4, 'PAID', 32990000, 0, 0, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
(@user5, 'PAID', 15990000, 0, 0, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
(@user6, 'PAID', 27990000, 0, 0, NOW(), NOW()),
(@user1, 'PAID', 19990000, 0, 0, DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY)),
(@user2, 'PAID', 39990000, 0, 0, DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY)),
(@user3, 'PAID', 22990000, 0, 0, DATE_SUB(NOW(), INTERVAL 8 DAY), DATE_SUB(NOW(), INTERVAL 8 DAY)),
(@user4, 'PAID', 34990000, 0, 0, DATE_SUB(NOW(), INTERVAL 9 DAY), DATE_SUB(NOW(), INTERVAL 9 DAY));

-- Last month orders (PAID)
INSERT INTO orders (user_id, status, total_cents, discount_cents, loyalty_cents_used, created_at, updated_at) VALUES
(@user5, 'PAID', 17990000, 0, 0, DATE_SUB(NOW(), INTERVAL 35 DAY), DATE_SUB(NOW(), INTERVAL 35 DAY)),
(@user6, 'PAID', 29990000, 0, 0, DATE_SUB(NOW(), INTERVAL 36 DAY), DATE_SUB(NOW(), INTERVAL 36 DAY)),
(@user7, 'PAID', 20990000, 0, 0, DATE_SUB(NOW(), INTERVAL 37 DAY), DATE_SUB(NOW(), INTERVAL 37 DAY)),
(@user8, 'PAID', 37990000, 0, 0, DATE_SUB(NOW(), INTERVAL 38 DAY), DATE_SUB(NOW(), INTERVAL 38 DAY)),
(@user9, 'PAID', 16990000, 0, 0, DATE_SUB(NOW(), INTERVAL 39 DAY), DATE_SUB(NOW(), INTERVAL 39 DAY)),
(@user10, 'PAID', 25990000, 0, 0, DATE_SUB(NOW(), INTERVAL 40 DAY), DATE_SUB(NOW(), INTERVAL 40 DAY)),
(@user1, 'PAID', 31990000, 0, 0, DATE_SUB(NOW(), INTERVAL 41 DAY), DATE_SUB(NOW(), INTERVAL 41 DAY)),
(@user2, 'PAID', 18990000, 0, 0, DATE_SUB(NOW(), INTERVAL 42 DAY), DATE_SUB(NOW(), INTERVAL 42 DAY)),
(@user3, 'PAID', 23990000, 0, 0, DATE_SUB(NOW(), INTERVAL 43 DAY), DATE_SUB(NOW(), INTERVAL 43 DAY)),
(@user4, 'PAID', 26990000, 0, 0, DATE_SUB(NOW(), INTERVAL 44 DAY), DATE_SUB(NOW(), INTERVAL 44 DAY));

-- Last quarter orders (PAID)
INSERT INTO orders (user_id, status, total_cents, discount_cents, loyalty_cents_used, created_at, updated_at) VALUES
(@user5, 'PAID', 19990000, 0, 0, DATE_SUB(NOW(), INTERVAL 70 DAY), DATE_SUB(NOW(), INTERVAL 70 DAY)),
(@user6, 'PAID', 28990000, 0, 0, DATE_SUB(NOW(), INTERVAL 71 DAY), DATE_SUB(NOW(), INTERVAL 71 DAY)),
(@user7, 'PAID', 21990000, 0, 0, DATE_SUB(NOW(), INTERVAL 72 DAY), DATE_SUB(NOW(), INTERVAL 72 DAY)),
(@user8, 'PAID', 35990000, 0, 0, DATE_SUB(NOW(), INTERVAL 73 DAY), DATE_SUB(NOW(), INTERVAL 73 DAY)),
(@user9, 'PAID', 17990000, 0, 0, DATE_SUB(NOW(), INTERVAL 74 DAY), DATE_SUB(NOW(), INTERVAL 74 DAY)),
(@user10, 'PAID', 24990000, 0, 0, DATE_SUB(NOW(), INTERVAL 75 DAY), DATE_SUB(NOW(), INTERVAL 75 DAY)),
(@user1, 'PAID', 30990000, 0, 0, DATE_SUB(NOW(), INTERVAL 76 DAY), DATE_SUB(NOW(), INTERVAL 76 DAY)),
(@user2, 'PAID', 19990000, 0, 0, DATE_SUB(NOW(), INTERVAL 77 DAY), DATE_SUB(NOW(), INTERVAL 77 DAY)),
(@user3, 'PAID', 22990000, 0, 0, DATE_SUB(NOW(), INTERVAL 78 DAY), DATE_SUB(NOW(), INTERVAL 78 DAY)),
(@user4, 'PAID', 25990000, 0, 0, DATE_SUB(NOW(), INTERVAL 79 DAY), DATE_SUB(NOW(), INTERVAL 79 DAY));

-- Pending orders
INSERT INTO orders (user_id, status, total_cents, discount_cents, loyalty_cents_used, created_at, updated_at) VALUES
(@user5, 'PENDING', 18990000, 0, 0, NOW(), NOW()),
(@user6, 'PENDING', 27990000, 0, 0, NOW(), NOW()),
(@user7, 'PENDING', 20990000, 0, 0, NOW(), NOW()),
(@user8, 'PENDING', 36990000, 0, 0, NOW(), NOW()),
(@user9, 'PENDING', 16990000, 0, 0, NOW(), NOW());

-- Get product IDs from catalog (assuming products 1-19 exist)
-- Create order items for all orders
-- We'll use a simple approach: get order IDs and add items

-- Add order items for current month orders
INSERT INTO order_items (order_id, product_id, quantity, price_cents)
SELECT o.id, 
       FLOOR(1 + RAND() * 19) as product_id,
       FLOOR(1 + RAND() * 3) as quantity,
       CASE FLOOR(1 + RAND() * 19)
         WHEN 1 THEN 24990000
         WHEN 2 THEN 48990000
         WHEN 3 THEN 35990000
         WHEN 4 THEN 18990000
         WHEN 5 THEN 22990000
         WHEN 6 THEN 15990000
         WHEN 7 THEN 19990000
         WHEN 8 THEN 27990000
         WHEN 9 THEN 32990000
         WHEN 10 THEN 17990000
         WHEN 11 THEN 20990000
         WHEN 12 THEN 15990000
         WHEN 13 THEN 18990000
         WHEN 14 THEN 22990000
         WHEN 15 THEN 17990000
         WHEN 16 THEN 19990000
         WHEN 17 THEN 24990000
         WHEN 18 THEN 21990000
         WHEN 19 THEN 16990000
         ELSE 19990000
       END as price_cents
FROM orders o
WHERE o.status = 'PAID' AND o.created_at >= DATE_SUB(NOW(), INTERVAL 10 DAY);

-- Add order items for last month orders
INSERT INTO order_items (order_id, product_id, quantity, price_cents)
SELECT o.id, 
       FLOOR(1 + RAND() * 19) as product_id,
       FLOOR(1 + RAND() * 3) as quantity,
       CASE FLOOR(1 + RAND() * 19)
         WHEN 1 THEN 24990000
         WHEN 2 THEN 48990000
         WHEN 3 THEN 35990000
         WHEN 4 THEN 18990000
         WHEN 5 THEN 22990000
         WHEN 6 THEN 15990000
         WHEN 7 THEN 19990000
         WHEN 8 THEN 27990000
         WHEN 9 THEN 32990000
         WHEN 10 THEN 17990000
         WHEN 11 THEN 20990000
         WHEN 12 THEN 15990000
         WHEN 13 THEN 18990000
         WHEN 14 THEN 22990000
         WHEN 15 THEN 17990000
         WHEN 16 THEN 19990000
         WHEN 17 THEN 24990000
         WHEN 18 THEN 21990000
         WHEN 19 THEN 16990000
         ELSE 19990000
       END as price_cents
FROM orders o
WHERE o.status = 'PAID' AND o.created_at >= DATE_SUB(NOW(), INTERVAL 45 DAY) AND o.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- Add order items for last quarter orders
INSERT INTO order_items (order_id, product_id, quantity, price_cents)
SELECT o.id, 
       FLOOR(1 + RAND() * 19) as product_id,
       FLOOR(1 + RAND() * 3) as quantity,
       CASE FLOOR(1 + RAND() * 19)
         WHEN 1 THEN 24990000
         WHEN 2 THEN 48990000
         WHEN 3 THEN 35990000
         WHEN 4 THEN 18990000
         WHEN 5 THEN 22990000
         WHEN 6 THEN 15990000
         WHEN 7 THEN 19990000
         WHEN 8 THEN 27990000
         WHEN 9 THEN 32990000
         WHEN 10 THEN 17990000
         WHEN 11 THEN 20990000
         WHEN 12 THEN 15990000
         WHEN 13 THEN 18990000
         WHEN 14 THEN 22990000
         WHEN 15 THEN 17990000
         WHEN 16 THEN 19990000
         WHEN 17 THEN 24990000
         WHEN 18 THEN 21990000
         WHEN 19 THEN 16990000
         ELSE 19990000
       END as price_cents
FROM orders o
WHERE o.status = 'PAID' AND o.created_at >= DATE_SUB(NOW(), INTERVAL 80 DAY) AND o.created_at < DATE_SUB(NOW(), INTERVAL 60 DAY);

-- Add order status history for PAID orders
INSERT INTO order_status_history (order_id, status, note, created_at)
SELECT id, 'PAID', 'Payment confirmed', created_at
FROM orders
WHERE status = 'PAID';

SELECT 'Seed data completed!' as message;
SELECT COUNT(*) as total_paid_orders FROM orders WHERE status = 'PAID';
SELECT COUNT(*) as total_users FROM auth_db.users WHERE role = 'USER';
SELECT COUNT(*) as total_order_items FROM order_items;

