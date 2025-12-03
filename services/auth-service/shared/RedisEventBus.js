import { createClient } from 'redis';

class RedisEventBus {
  constructor(redisUrl) {
    const url = redisUrl || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
    
    // Publisher client (for sending messages)
    this.publisher = createClient({ url });
    this.publisher.on('error', (err) => console.error('Redis Publisher Error:', err));
    
    // Subscriber client (for receiving messages)
    this.subscriber = createClient({ url });
    this.subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));
    
    this.isConnected = false;
    this.subscriptions = new Map(); // Map<channel, Set<handlers>>
  }

  async connect() {
    if (!this.isConnected) {
      await Promise.all([
        this.publisher.connect(),
        this.subscriber.connect()
      ]);
      this.isConnected = true;
      console.log('Redis Event Bus connected');
    }
  }

  async disconnect() {
    if (this.isConnected) {
      // Unsubscribe from all channels
      if (this.subscriptions.size > 0) {
        const channels = Array.from(this.subscriptions.keys());
        await this.subscriber.unsubscribe(channels);
      }
      
      await Promise.all([
        this.publisher.quit(),
        this.subscriber.quit()
      ]);
      this.isConnected = false;
      console.log('Redis Event Bus disconnected');
    }
  }

  async publish(channel, payload) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const message = JSON.stringify({
        event: channel,
        timestamp: new Date().toISOString(),
        data: payload
      });

      const subscribers = await this.publisher.publish(channel, message);
      console.log(`Published event: ${channel} (${subscribers} subscribers)`);
      return subscribers;
    } catch (error) {
      console.error(`Error publishing event ${channel}:`, error.message);
      throw error;
    }
  }

  async subscribe(channel, handler) {
    if (!this.isConnected) {
      await this.connect();
    }

    // Track subscription
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      
      // Subscribe to channel
      await this.subscriber.subscribe(channel, (message, ch) => {
        try {
          const event = JSON.parse(message);
          const handlers = this.subscriptions.get(ch);
          
          if (handlers) {
            handlers.forEach(h => {
              // Execute handler asynchronously to avoid blocking
              Promise.resolve(h(event.data, event)).catch(err => {
                console.error(`Error in event handler for ${channel}:`, err);
              });
            });
          }
        } catch (error) {
          console.error(`Error parsing event message from ${channel}:`, error.message);
        }
      });
      
      console.log(`Subscribed to channel: ${channel}`);
    }

    // Add handler
    this.subscriptions.get(channel).add(handler);
  }

  async unsubscribe(channel, handler = null) {
    if (!this.subscriptions.has(channel)) {
      return;
    }

    const handlers = this.subscriptions.get(channel);
    
    if (handler) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        await this.subscriber.unsubscribe(channel);
        this.subscriptions.delete(channel);
        console.log(`📭 Unsubscribed from channel: ${channel}`);
      }
    } else {
      await this.subscriber.unsubscribe(channel);
      this.subscriptions.delete(channel);
      console.log(`📭 Unsubscribed from channel: ${channel} (all handlers)`);
    }
  }

  getSubscribedChannels() {
    return Array.from(this.subscriptions.keys());
  }
}

export default RedisEventBus;

