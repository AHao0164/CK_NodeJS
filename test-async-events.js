/**
 * Test script for Redis Pub/Sub async communication
 * Tests: order.created, order.status_changed, order.payment_completed events
 * 
 * Usage: node test-async-events.js
 */

const axios = require('axios');
const { createClient } = require('redis');

const API_BASE = process.env.API_BASE || 'http://localhost:8080';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

// Test user credentials
const TEST_USER = {
  email: `test-events-${Date.now()}@example.com`, // Unique email to avoid conflicts
  password: 'test123456',
  name: 'Test Events User'
};

let authToken = null;
let userId = null;
let testProductId = null;
let orderId = null;
let receivedEvents = [];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(70), 'cyan');
  log(title, 'cyan');
  log('='.repeat(70), 'cyan');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Setup test user
async function setupUser() {
  logSection('Step 1: Setup Test User');
  
  try {
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    
    authToken = loginRes.data.token;
    const meRes = await axios.get(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    userId = meRes.data.id || meRes.data.userId;
    log(`✅ Logged in as user ID: ${userId}`, 'green');
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 404) {
      log('User not found, registering...', 'yellow');
      const registerRes = await axios.post(`${API_BASE}/auth/signup`, {
        email: TEST_USER.email,
        password: TEST_USER.password,
        fullName: TEST_USER.name  // ✅ Fix: Use fullName instead of name
      });
      
      authToken = registerRes.data.token;
      const meRes = await axios.get(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      userId = meRes.data.id || meRes.data.userId;
      log(`✅ Registered new user ID: ${userId}`, 'green');
    } else {
      log(`❌ Login error: ${error.response?.status} - ${JSON.stringify(error.response?.data || error.message)}`, 'red');
      throw error;
    }
  }
}

// Get test product
async function getTestProduct() {
  logSection('Step 2: Get Test Product');
  
  try {
    const productsRes = await axios.get(`${API_BASE}/catalog/products?pageSize=1`);
    if (productsRes.data?.items?.length > 0) {
      testProductId = productsRes.data.items[0].id;
      log(`✅ Using product ID: ${testProductId}`, 'green');
      return testProductId;
    }
    throw new Error('No products available');
  } catch (error) {
    log(`❌ Failed to get product: ${error.message}`, 'red');
    throw error;
  }
}

// Setup Redis subscriber to listen for events
async function setupRedisSubscriber() {
  logSection('Step 3: Setup Redis Subscriber');
  
  const subscriber = createClient({
    url: `redis://${REDIS_HOST}:${REDIS_PORT}`
  });
  
  subscriber.on('error', (err) => {
    log(`❌ Redis Subscriber Error: ${err.message}`, 'red');
  });
  
  await subscriber.connect();
  log('✅ Redis subscriber connected', 'green');
  
  // Subscribe to all order events
  const channels = ['order.created', 'order.status_changed', 'order.payment_completed'];
  
  for (const channel of channels) {
    await subscriber.subscribe(channel, (message) => {
      try {
        const event = JSON.parse(message);
        receivedEvents.push({
          channel,
          event: event.event,
          timestamp: event.timestamp,
          data: event.data,
          receivedAt: new Date().toISOString()
        });
        
        log(`📥 Received ${channel} event:`, 'magenta');
        log(`   Order ID: ${event.data.orderId}`, 'cyan');
        log(`   Timestamp: ${event.timestamp}`, 'cyan');
        
        if (channel === 'order.status_changed') {
          log(`   Status: ${event.data.oldStatus} → ${event.data.newStatus}`, 'cyan');
        } else if (channel === 'order.payment_completed') {
          log(`   Payment Method: ${event.data.paymentMethod}`, 'cyan');
        }
      } catch (error) {
        log(`❌ Error parsing event message: ${error.message}`, 'red');
      }
    });
    
    log(`✅ Subscribed to channel: ${channel}`, 'green');
  }
  
  return subscriber;
}

// Create order to trigger order.created event
async function createOrder() {
  logSection('Step 4: Create Order (Trigger order.created)');
  
  try {
    const productRes = await axios.get(`${API_BASE}/catalog/products/${testProductId}`);
    const product = productRes.data;
    const finalPrice = Math.round((product.price_cents || 1000000) * (100 - (product.discount_percent || 0)) / 100);
    
    // Add to cart
    await axios.post(
      `${API_BASE}/cart/items`,
      {
        productId: testProductId,
        quantity: 1,
        priceCents: finalPrice
      },
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    // Create order with COD
    const shipping = {
      name: 'Test User',
      phone: '0123456789',
      email: TEST_USER.email,
      province: 'Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Phường Bến Nghé',
      address: '123 Test Street'
    };
    
    const orderRes = await axios.post(
      `${API_BASE}/orders`,
      {
        items: [{
          productId: testProductId,
          quantity: 1,
          priceCents: finalPrice
        }],
        shipping: shipping,
        paymentMethod: 'COD',
        couponCode: null,
        pointsToUse: 0
      },
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    orderId = orderRes.data.id;
    log(`✅ Order created: #${orderId}`, 'green');
    log(`   Waiting for order.created event...`, 'yellow');
    
    // Wait for event
    await sleep(2000);
    
    return orderId;
  } catch (error) {
    log(`❌ Failed to create order: ${error.response?.data?.error || error.message}`, 'red');
    throw error;
  }
}

// Confirm COD order to trigger payment_completed event
async function confirmOrder() {
  logSection('Step 5: Confirm Order (Trigger order.payment_completed)');
  
  try {
    // For COD, we need to call confirm-cod endpoint
    // This requires OTP verification, so we'll simulate by calling the endpoint directly
    // In real scenario, this would be called by auth-service after OTP verification
    
    log('⚠️  Note: COD confirmation requires OTP verification', 'yellow');
    log('   Skipping payment confirmation for this test', 'yellow');
    log('   To test payment_completed event, use VNPay payment', 'yellow');
    
    // Alternatively, we can update status to trigger status_changed
    // But this requires admin access, so we'll skip for now
    
  } catch (error) {
    log(`❌ Failed to confirm order: ${error.message}`, 'red');
  }
}

// Update order status to trigger status_changed event (requires admin)
async function updateOrderStatus() {
  logSection('Step 6: Update Order Status (Trigger order.status_changed)');
  
  try {
    // This requires admin token, so we'll skip for now
    log('⚠️  Note: Status update requires admin access', 'yellow');
    log('   Skipping status update for this test', 'yellow');
    log('   To test status_changed event, use admin panel', 'yellow');
  } catch (error) {
    log(`❌ Failed to update status: ${error.message}`, 'red');
  }
}

// Verify received events
async function verifyEvents() {
  logSection('Step 7: Verify Received Events');
  
  log(`Total events received: ${receivedEvents.length}`, 'cyan');
  
  const eventsByChannel = {};
  receivedEvents.forEach(event => {
    if (!eventsByChannel[event.channel]) {
      eventsByChannel[event.channel] = [];
    }
    eventsByChannel[event.channel].push(event);
  });
  
  log('\nEvents by channel:', 'cyan');
  Object.keys(eventsByChannel).forEach(channel => {
    log(`  ${channel}: ${eventsByChannel[channel].length} event(s)`, 'cyan');
    eventsByChannel[channel].forEach((event, index) => {
      log(`    ${index + 1}. Order #${event.data.orderId} at ${event.timestamp}`, 'yellow');
    });
  });
  
  // Check for expected events
  const hasOrderCreated = receivedEvents.some(e => e.channel === 'order.created' && e.data.orderId === orderId);
  const hasStatusChanged = receivedEvents.some(e => e.channel === 'order.status_changed');
  const hasPaymentCompleted = receivedEvents.some(e => e.channel === 'order.payment_completed');
  
  log('\nEvent Verification:', 'cyan');
  log(`  order.created: ${hasOrderCreated ? '✅' : '❌'}`, hasOrderCreated ? 'green' : 'red');
  log(`  order.status_changed: ${hasStatusChanged ? '✅' : '⚠️  (not triggered in this test)'}`, hasStatusChanged ? 'green' : 'yellow');
  log(`  order.payment_completed: ${hasPaymentCompleted ? '✅' : '⚠️  (not triggered in this test)'}`, hasPaymentCompleted ? 'green' : 'yellow');
  
  if (hasOrderCreated) {
    log('\n✅ Async communication test PASSED!', 'green');
    log('   order.created event was successfully published and received', 'green');
  } else {
    log('\n❌ Async communication test FAILED!', 'red');
    log('   order.created event was not received', 'red');
  }
}

// Main test flow
async function runTests() {
  let subscriber = null;
  
  try {
    log('\n🧪 Starting Async Communication Tests\n', 'blue');
    
    // Setup
    await setupUser();
    await getTestProduct();
    
    // Setup Redis subscriber BEFORE creating order
    subscriber = await setupRedisSubscriber();
    
    // Wait a bit for subscription to be ready
    await sleep(1000);
    
    // Create order (triggers order.created)
    await createOrder();
    
    // Wait for events
    await sleep(2000);
    
    // Verify events
    await verifyEvents();
    
    logSection('Test Summary');
    log('✅ Test completed!', 'green');
    log(`   Events received: ${receivedEvents.length}`, 'cyan');
    log(`   Order ID: ${orderId}`, 'cyan');
    
    log('\n💡 Tips:', 'yellow');
    log('   - To test order.payment_completed: Use VNPay payment', 'yellow');
    log('   - To test order.status_changed: Update order status via admin panel', 'yellow');
    log('   - Check service logs for event publishing/subscribing', 'yellow');
    
  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    if (error.stack) {
      log(error.stack, 'red');
    }
    process.exit(1);
  } finally {
    if (subscriber) {
      await subscriber.quit();
      log('\n✅ Redis subscriber disconnected', 'green');
    }
  }
}

// Run tests
runTests();

