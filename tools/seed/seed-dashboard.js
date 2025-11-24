import axios from 'axios';
import mysql from 'mysql2/promise';

const API_BASE = process.env.API_BASE || 'http://localhost:8080';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'rootpw';

// Create connection pools
const orderPool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: 'order_db',
});

const authPool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: 'auth_db',
});

const catalogPool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: 'catalog_db',
});

async function login(email, password) {
  const { data, status } = await axios.post(`${API_BASE}/auth/login`, { email, password });
  if (status >= 400) throw new Error('Login failed');
  return data.token;
}

async function createUsers() {
  console.log('📝 Creating users...');
  const users = [
    { email: 'customer1@test.com', password: 'Test123456', fullName: 'Nguyễn Văn A' },
    { email: 'customer2@test.com', password: 'Test123456', fullName: 'Trần Thị B' },
    { email: 'customer3@test.com', password: 'Test123456', fullName: 'Lê Văn C' },
    { email: 'customer4@test.com', password: 'Test123456', fullName: 'Phạm Thị D' },
    { email: 'customer5@test.com', password: 'Test123456', fullName: 'Hoàng Văn E' },
    { email: 'customer6@test.com', password: 'Test123456', fullName: 'Võ Thị F' },
    { email: 'customer7@test.com', password: 'Test123456', fullName: 'Đặng Văn G' },
    { email: 'customer8@test.com', password: 'Test123456', fullName: 'Bùi Thị H' },
    { email: 'customer9@test.com', password: 'Test123456', fullName: 'Ngô Văn I' },
    { email: 'customer10@test.com', password: 'Test123456', fullName: 'Dương Thị K' },
  ];

  let created = 0;
  for (const user of users) {
    try {
      await axios.post(`${API_BASE}/auth/signup`, user);
      console.log(`  ✓ Created user: ${user.email}`);
      created++;
    } catch (e) {
      if (e.response?.status === 409) {
        console.log(`  - User already exists: ${user.email}`);
      } else {
        console.warn(`  ⚠ Failed to create ${user.email}:`, e.message);
      }
    }
  }
  console.log(`  📊 Total: ${created} new users created`);
}

async function getProducts() {
  const { data } = await axios.get(`${API_BASE}/catalog/products`);
  return data.items || data || [];
}

async function getUsers() {
  const [rows] = await authPool.query('SELECT id, email, full_name FROM users WHERE role = "USER" LIMIT 10');
  return rows;
}

async function getCoupons() {
  try {
    const [rows] = await orderPool.query('SELECT code FROM coupons WHERE active = 1 LIMIT 5');
    return rows.map(r => r.code);
  } catch (e) {
    return [];
  }
}

async function createOrders() {
  console.log('📦 Creating orders...');
  
  const products = await getProducts();
  const users = await getUsers();
  const coupons = await getCoupons();
  
  if (products.length === 0) {
    console.error('❌ No products found! Please seed catalog first.');
    return;
  }
  
  if (users.length === 0) {
    console.error('❌ No users found! Please create users first.');
    return;
  }

  // Create orders for different time periods
  const now = new Date();
  const orders = [];
  
  // Orders for this year (various months) - 12 orders
  for (let i = 0; i < 12; i++) {
    const orderDate = new Date(now.getFullYear(), i, 15, 10 + (i % 8), 30);
    if (orderDate <= now) {
      orders.push({
        user: users[i % users.length],
        date: orderDate,
        products: products.slice(i % products.length, (i % products.length) + (i % 3 + 1)),
        status: 'PAID',
        coupon: i % 4 === 0 && coupons.length > 0 ? coupons[i % coupons.length] : null,
      });
    }
  }
  
  // Orders for this month (various days) - 20 orders
  for (let i = 0; i < 20; i++) {
    const day = Math.min(i + 1, 28); // Avoid day 29-31 issues
    const orderDate = new Date(now.getFullYear(), now.getMonth(), day, 9 + (i % 12), 15 + (i % 45));
    if (orderDate <= now) {
      orders.push({
        user: users[i % users.length],
        date: orderDate,
        products: products.slice(i % products.length, (i % products.length) + (i % 3 + 1)),
        status: 'PAID',
        coupon: i % 5 === 0 && coupons.length > 0 ? coupons[i % coupons.length] : null,
      });
    }
  }
  
  // Orders for this week - 7 orders
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  for (let i = 0; i < 7; i++) {
    const orderDate = new Date(weekStart);
    orderDate.setDate(weekStart.getDate() + i);
    orderDate.setHours(10 + i, 30);
    if (orderDate <= now) {
      orders.push({
        user: users[i % users.length],
        date: orderDate,
        products: products.slice(i % products.length, (i % products.length) + 2),
        status: 'PAID',
      });
    }
  }
  
  // Orders for last month - 15 orders
  for (let i = 0; i < 15; i++) {
    const day = Math.min(i + 1, 28);
    const orderDate = new Date(now.getFullYear(), now.getMonth() - 1, day, 14 + (i % 6), 0);
    orders.push({
      user: users[i % users.length],
      date: orderDate,
      products: products.slice(i % products.length, (i % products.length) + (i % 2 + 1)),
      status: 'PAID',
      coupon: i % 6 === 0 && coupons.length > 0 ? coupons[i % coupons.length] : null,
    });
  }
  
  // Orders for last quarter (3 months ago) - 10 orders
  for (let i = 0; i < 10; i++) {
    const month = now.getMonth() - 2 - (i % 2);
    const day = Math.min(i + 1, 28);
    const orderDate = new Date(now.getFullYear(), month, day, 16, 0);
    orders.push({
      user: users[i % users.length],
      date: orderDate,
      products: products.slice(i % products.length, (i % products.length) + 2),
      status: 'PAID',
    });
  }
  
  // Orders for last year - 8 orders
  for (let i = 0; i < 8; i++) {
    const month = i;
    const day = Math.min(i * 3 + 1, 28);
    const orderDate = new Date(now.getFullYear() - 1, month, day, 11, 0);
    orders.push({
      user: users[i % users.length],
      date: orderDate,
      products: products.slice(i % products.length, (i % products.length) + 1),
      status: 'PAID',
    });
  }
  
  // Some pending orders - 8 orders
  for (let i = 0; i < 8; i++) {
    const orderDate = new Date(now);
    orderDate.setHours(now.getHours() - i, now.getMinutes() - i * 10);
    orders.push({
      user: users[i % users.length],
      date: orderDate,
      products: products.slice(i % products.length, (i % products.length) + 1),
      status: 'PENDING',
    });
  }
  
  // Some shipping orders - 5 orders
  for (let i = 0; i < 5; i++) {
    const orderDate = new Date(now);
    orderDate.setDate(now.getDate() - (i + 1));
    orders.push({
      user: users[i % users.length],
      date: orderDate,
      products: products.slice(i % products.length, (i % products.length) + 2),
      status: 'SHIPPING',
    });
  }
  
  // Some delivered orders - 5 orders
  for (let i = 0; i < 5; i++) {
    const orderDate = new Date(now);
    orderDate.setDate(now.getDate() - (i + 3));
    orders.push({
      user: users[i % users.length],
      date: orderDate,
      products: products.slice(i % products.length, (i % products.length) + 1),
      status: 'DELIVERED',
    });
  }

  let created = 0;
  for (const orderData of orders) {
    try {
      const conn = await orderPool.getConnection();
      try {
        await conn.beginTransaction();
        
        // Calculate totals
        let subtotalCents = 0;
        orderData.products.forEach((p, idx) => {
          subtotalCents += p.price_cents * (idx + 1); // quantity = index + 1
        });
        const shippingCents = 3000000;
        const taxCents = Math.floor(subtotalCents * 0.1);
        let discountCents = 0;
        
        // Apply coupon if exists
        if (orderData.coupon) {
          try {
            const [[coupon]] = await conn.query(
              'SELECT type, value FROM coupons WHERE code = ? AND active = 1',
              [orderData.coupon]
            );
            if (coupon) {
              if (coupon.type === 'percentage') {
                discountCents = Math.floor(subtotalCents * coupon.value / 100);
              } else if (coupon.type === 'fixed') {
                discountCents = Math.min(coupon.value, subtotalCents);
              } else if (coupon.type === 'freeship') {
                discountCents = shippingCents;
              }
            }
          } catch (e) {
            // Ignore coupon errors
          }
        }
        
        const totalCents = subtotalCents + shippingCents + taxCents;
        const finalTotal = totalCents - discountCents;
        
        // Insert order
        const loyaltyEarned = orderData.status === 'PAID' ? Math.floor(finalTotal * 0.1) : 0;
        const [orderResult] = await conn.query(
          `INSERT INTO orders 
            (user_id, status, total_cents, discount_cents, loyalty_cents_used, loyalty_cents_earned,
             shipping_name, shipping_phone, shipping_address, shipping_city, coupon_code,
             created_at)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderData.user.id,
            orderData.status,
            totalCents,
            discountCents,
            loyaltyEarned,
            orderData.user.full_name || 'Customer',
            '0901234567',
            '123 Test Street',
            'Ho Chi Minh City',
            orderData.coupon || null,
            orderData.date,
          ]
        );
        
        const orderId = orderResult.insertId;
        
        // Insert order items - tạo nhiều items với quantities khác nhau để có best-selling products
        for (let idx = 0; idx < orderData.products.length; idx++) {
          const product = orderData.products[idx];
          // Tạo quantity đa dạng: 1, 2, hoặc 3 để có sản phẩm bán chạy rõ ràng
          const quantity = (idx % 3) + 1;
          await conn.query(
            'INSERT INTO order_items (order_id, product_id, quantity, price_cents) VALUES (?, ?, ?, ?)',
            [orderId, product.id, quantity, product.price_cents]
          );
        }
        
        // Đôi khi thêm sản phẩm phổ biến nhiều lần để tạo best-seller
        if (orderData.status === 'PAID' && Math.random() > 0.7 && products.length > 0) {
          const popularProduct = products[0]; // Sản phẩm đầu tiên sẽ là best-seller
          await conn.query(
            'INSERT INTO order_items (order_id, product_id, quantity, price_cents) VALUES (?, ?, ?, ?)',
            [orderId, popularProduct.id, 2, popularProduct.price_cents]
          );
        }
        
        // Insert status history
        await conn.query(
          'INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)',
          [orderId, orderData.status, 'Created by seed script']
        );
        
        // Insert status history based on status
        if (orderData.status === 'PAID') {
          await conn.query(
            'INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)',
            [orderId, 'PAID', 'Payment confirmed']
          );
        } else if (orderData.status === 'SHIPPING') {
          await conn.query(
            'INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)',
            [orderId, 'PAID', 'Payment confirmed']
          );
          await conn.query(
            'INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)',
            [orderId, 'SHIPPING', 'Order shipped']
          );
        } else if (orderData.status === 'DELIVERED') {
          await conn.query(
            'INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)',
            [orderId, 'PAID', 'Payment confirmed']
          );
          await conn.query(
            'INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)',
            [orderId, 'SHIPPING', 'Order shipped']
          );
          await conn.query(
            'INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)',
            [orderId, 'DELIVERED', 'Order delivered']
          );
        }
        
        await conn.commit();
        created++;
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    } catch (e) {
      console.warn(`  ⚠ Failed to create order:`, e.message);
    }
  }
  
  console.log(`  ✓ Created ${created} orders`);
}

async function main() {
  console.log('🌱 Starting dashboard seed data...\n');
  
  try {
    await createUsers();
    console.log('');
    await createOrders();
    console.log('');
    console.log('✅ Dashboard seed completed!');
    console.log('\n📊 Summary:');
    const [orderCount] = await orderPool.query('SELECT COUNT(*) as count FROM orders WHERE status = "PAID"');
    const [pendingCount] = await orderPool.query('SELECT COUNT(*) as count FROM orders WHERE status = "PENDING"');
    const [shippingCount] = await orderPool.query('SELECT COUNT(*) as count FROM orders WHERE status = "SHIPPING"');
    const [deliveredCount] = await orderPool.query('SELECT COUNT(*) as count FROM orders WHERE status = "DELIVERED"');
    const [userCount] = await authPool.query('SELECT COUNT(*) as count FROM users WHERE role = "USER"');
    const [revenue] = await orderPool.query('SELECT COALESCE(SUM(total_cents - discount_cents), 0) as revenue FROM orders WHERE status = "PAID"');
    const [productCount] = await orderPool.query('SELECT COUNT(DISTINCT product_id) as count FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id WHERE o.status = "PAID"');
    
    console.log(`  - Total Users: ${userCount[0].count}`);
    console.log(`  - Paid Orders: ${orderCount[0].count}`);
    console.log(`  - Pending Orders: ${pendingCount[0].count}`);
    console.log(`  - Shipping Orders: ${shippingCount[0].count}`);
    console.log(`  - Delivered Orders: ${deliveredCount[0].count}`);
    console.log(`  - Total Revenue: ${(revenue[0].revenue / 1000000).toFixed(2)}M VNĐ`);
    console.log(`  - Unique Products Sold: ${productCount[0].count}`);
    console.log('\n💡 Refresh your admin dashboard to see the data!');
  } catch (e) {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  } finally {
    await orderPool.end();
    await authPool.end();
    await catalogPool.end();
  }
}

main();

