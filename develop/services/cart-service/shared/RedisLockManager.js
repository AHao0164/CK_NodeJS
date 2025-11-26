import { createClient } from 'redis';

/**
 * Redis Distributed Lock Manager
 * Implements distributed locking pattern for microservices
 */
class RedisLockManager {
  constructor(redisUrl) {
    this.client = createClient({
      url: redisUrl || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
    });
    
    this.client.on('error', (err) => console.error('Redis Client Error:', err));
    this.client.on('connect', () => console.log('✅ Redis Lock Manager connected'));
    
    this.isConnected = false;
  }

  async connect() {
    if (!this.isConnected) {
      await this.client.connect();
      this.isConnected = true;
    }
  }

  async disconnect() {
    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  /**
   * Acquire a distributed lock with automatic expiration
   * @param {string} lockKey - Unique identifier for the lock
   * @param {number} ttlSeconds - Time-to-live in seconds (default: 10s)
   * @param {number} maxRetries - Maximum retry attempts (default: 5)
   * @param {number} retryDelayMs - Delay between retries in milliseconds (default: 100ms)
   * @returns {Promise<string|null>} Lock token if acquired, null if failed
   */
  async acquireLock(lockKey, ttlSeconds = 10, maxRetries = 5, retryDelayMs = 100) {
    const lockToken = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullKey = `lock:${lockKey}`;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // SET NX (Not eXists) with expiration - atomic operation
        const result = await this.client.set(fullKey, lockToken, {
          NX: true, // Only set if key doesn't exist
          EX: ttlSeconds // Expire after N seconds
        });

        if (result === 'OK') {
          console.log(`🔒 Lock acquired: ${lockKey} (token: ${lockToken})`);
          return lockToken;
        }

        // Lock exists, check if it's expired (safety check)
        const ttl = await this.client.ttl(fullKey);
        if (ttl === -1) {
          // Key exists but no expiration - this shouldn't happen, but handle it
          console.warn(`⚠️ Lock ${lockKey} exists without TTL, setting expiration`);
          await this.client.expire(fullKey, ttlSeconds);
        }

        // Wait before retry with exponential backoff
        const delay = retryDelayMs * Math.pow(1.5, attempt);
        console.log(`⏳ Lock ${lockKey} busy, retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
        await this.sleep(delay);
      } catch (error) {
        console.error(`❌ Error acquiring lock ${lockKey}:`, error.message);
        throw error;
      }
    }

    console.log(`❌ Failed to acquire lock: ${lockKey} after ${maxRetries} attempts`);
    return null;
  }

  /**
   * Release a distributed lock safely (only if we own it)
   * @param {string} lockKey - Lock identifier
   * @param {string} lockToken - Token received from acquireLock
   * @returns {Promise<boolean>} True if released, false otherwise
   */
  async releaseLock(lockKey, lockToken) {
    const fullKey = `lock:${lockKey}`;

    try {
      // Lua script for atomic check-and-delete
      // Only delete if the token matches (we own the lock)
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.client.eval(luaScript, {
        keys: [fullKey],
        arguments: [lockToken]
      });

      if (result === 1) {
        console.log(`🔓 Lock released: ${lockKey} (token: ${lockToken})`);
        return true;
      } else {
        console.warn(`⚠️ Lock ${lockKey} not released - token mismatch or already expired`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error releasing lock ${lockKey}:`, error.message);
      return false;
    }
  }

  /**
   * Execute a function with automatic lock acquisition and release
   * @param {string} lockKey - Lock identifier
   * @param {Function} fn - Async function to execute
   * @param {object} options - Lock options
   * @returns {Promise<any>} Result of the function
   */
  async withLock(lockKey, fn, options = {}) {
    const {
      ttlSeconds = 10,
      maxRetries = 5,
      retryDelayMs = 100,
      throwOnFailure = true
    } = options;

    const lockToken = await this.acquireLock(lockKey, ttlSeconds, maxRetries, retryDelayMs);

    if (!lockToken) {
      if (throwOnFailure) {
        throw new Error(`Failed to acquire lock: ${lockKey}`);
      }
      return null;
    }

    try {
      // Execute the protected function
      const result = await fn();
      return result;
    } finally {
      // Always release the lock
      await this.releaseLock(lockKey, lockToken);
    }
  }

  /**
   * Check if a lock is currently held
   * @param {string} lockKey - Lock identifier
   * @returns {Promise<boolean>} True if locked, false otherwise
   */
  async isLocked(lockKey) {
    const fullKey = `lock:${lockKey}`;
    const exists = await this.client.exists(fullKey);
    return exists === 1;
  }

  /**
   * Get remaining TTL of a lock
   * @param {string} lockKey - Lock identifier
   * @returns {Promise<number>} Remaining seconds, -1 if no expiration, -2 if key doesn't exist
   */
  async getLockTTL(lockKey) {
    const fullKey = `lock:${lockKey}`;
    return await this.client.ttl(fullKey);
  }

  /**
   * Rate limiting using Redis
   * @param {string} key - Rate limit key (e.g., user:123:login)
   * @param {number} maxRequests - Maximum requests allowed
   * @param {number} windowSeconds - Time window in seconds
   * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
   */
  async rateLimit(key, maxRequests, windowSeconds) {
    const fullKey = `ratelimit:${key}`;
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);

    try {
      // Remove old entries outside the window
      await this.client.zRemRangeByScore(fullKey, 0, windowStart);

      // Count requests in current window
      const currentCount = await this.client.zCard(fullKey);

      if (currentCount >= maxRequests) {
        // Get the oldest request timestamp to calculate reset time
        const oldestRequests = await this.client.zRange(fullKey, 0, 0, { REV: false });
        const resetAt = oldestRequests.length > 0 
          ? parseInt(oldestRequests[0]) + (windowSeconds * 1000)
          : now + (windowSeconds * 1000);

        return {
          allowed: false,
          remaining: 0,
          resetAt: Math.ceil(resetAt / 1000)
        };
      }

      // Add current request
      await this.client.zAdd(fullKey, { score: now, value: `${now}-${Math.random()}` });
      await this.client.expire(fullKey, windowSeconds);

      return {
        allowed: true,
        remaining: maxRequests - currentCount - 1,
        resetAt: Math.ceil((now + (windowSeconds * 1000)) / 1000)
      };
    } catch (error) {
      console.error(`❌ Rate limit error for ${key}:`, error.message);
      // Fail open - allow the request if Redis is down
      return { allowed: true, remaining: maxRequests, resetAt: Math.ceil((now + (windowSeconds * 1000)) / 1000) };
    }
  }

  /**
   * Increment a counter atomically
   * @param {string} key - Counter key
   * @param {number} ttlSeconds - Expiration time (optional)
   * @returns {Promise<number>} New counter value
   */
  async incrementCounter(key, ttlSeconds = null) {
    const fullKey = `counter:${key}`;
    const value = await this.client.incr(fullKey);
    
    if (ttlSeconds && value === 1) {
      // Set expiration only on first increment
      await this.client.expire(fullKey, ttlSeconds);
    }
    
    return value;
  }

  /**
   * Get counter value
   * @param {string} key - Counter key
   * @returns {Promise<number>} Counter value
   */
  async getCounter(key) {
    const fullKey = `counter:${key}`;
    const value = await this.client.get(fullKey);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * Helper function to sleep
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear all locks (use with caution, mainly for testing)
   * @returns {Promise<number>} Number of locks cleared
   */
  async clearAllLocks() {
    const keys = await this.client.keys('lock:*');
    if (keys.length === 0) return 0;
    return await this.client.del(keys);
  }
}

// Singleton instance
let lockManagerInstance = null;

export function getLockManager() {
  if (!lockManagerInstance) {
    lockManagerInstance = new RedisLockManager();
  }
  return lockManagerInstance;
}

export default RedisLockManager;
