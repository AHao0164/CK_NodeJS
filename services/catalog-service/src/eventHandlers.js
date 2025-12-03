import RedisEventBus from '../shared/RedisEventBus.js';

let eventBus = null;

export function initializeEventBus() {
  eventBus = new RedisEventBus();
  return eventBus;
}

export async function setupOrderEventHandlers(pool) {
  if (!eventBus) {
    eventBus = initializeEventBus();
    await eventBus.connect();
  }

  // Subscribe to order.created event
  await eventBus.subscribe('order.created', async (data) => {
    console.log('Received order.created event:', data);
  });

  // Subscribe to order.status_changed event
  await eventBus.subscribe('order.status_changed', async (data) => {
    console.log('Received order.status_changed event:', data);
    const { orderId, oldStatus, newStatus } = data;
    
    // If order is cancelled, stock will be restored by order-service
    if (newStatus === 'CANCELLED') {
      console.log(`Order #${orderId} cancelled - stock restoration handled by order-service`);
    }
  });

  // Subscribe to order.payment_completed event
  await eventBus.subscribe('order.payment_completed', async (data) => {
    console.log('Received order.payment_completed event:', data);
    const { orderId, paymentMethod, items } = data;
    
    // Stock is already reserved, this is just for logging/analytics
    console.log(`Payment completed for order #${orderId} (${paymentMethod})`);
  });

  console.log('Catalog service subscribed to order events');
}

