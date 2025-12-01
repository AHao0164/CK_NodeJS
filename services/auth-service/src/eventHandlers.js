import RedisEventBus from '../shared/RedisEventBus.js';

/**
 * Event handlers for auth-service
 * Subscribes to order events for loyalty points and user analytics
 */

let eventBus = null;

export function initializeEventBus() {
  eventBus = new RedisEventBus();
  return eventBus;
}

export async function setupOrderEventHandlers() {
  if (!eventBus) {
    eventBus = initializeEventBus();
    await eventBus.connect();
  }

  // Subscribe to order.payment_completed event
  await eventBus.subscribe('order.payment_completed', async (data) => {
    console.log('📥 Received order.payment_completed event:', data);
    const { orderId, userId, totalCents, paymentMethod } = data;
    
    // Loyalty points are already added by order-service via HTTP call
    // This event is for additional processing if needed (analytics, notifications, etc.)
    if (userId) {
      console.log(`ℹ️ Payment completed for user ${userId}, order #${orderId} (${paymentMethod})`);
    }
  });

  // Subscribe to order.status_changed event
  await eventBus.subscribe('order.status_changed', async (data) => {
    console.log('📥 Received order.status_changed event:', data);
    const { orderId, oldStatus, newStatus } = data;
    
    // Could be used for user notifications, analytics, etc.
    if (newStatus === 'DELIVERED') {
      console.log(`ℹ️ Order #${orderId} delivered - could trigger user notification`);
    }
  });

  console.log('✅ Auth service subscribed to order events');
}

