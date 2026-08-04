import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export class RedisService {
  private static instance: RedisService | null = null;
  private client: Redis;
  private readonly maxRetries = 10;

  private constructor() {
    const redisUrl = env.REDIS_URL;
    if (!redisUrl) {
      logger.warn('REDIS_URL is not defined in environment variables. Falling back to default connection settings.');
    }

    const options: RedisOptions = {
      // Prevent commands from being queued indefinitely when connection is offline
      maxRetriesPerRequest: null,
      retryStrategy: (times: number) => {
        if (times > this.maxRetries) {
          logger.error(`Redis connection failed after ${this.maxRetries} retry attempts. Stopping retries.`);
          return null; // stop retrying and return error
        }
        
        // Exponential backoff with a cap at 3000ms
        const delay = Math.min(times * 100, 3000);
        logger.warn(`Redis connection lost. Retrying connection (attempt ${times}/${this.maxRetries}) in ${delay}ms...`);
        return delay;
      },
    };

    // Instantiate Redis client
    this.client = redisUrl ? new Redis(redisUrl, options) : new Redis(options);

    this.setupListeners();
  }

  private setupListeners(): void {
    this.client.on('connect', () => {
      logger.info('Redis client initiating connection.');
    });

    this.client.on('ready', () => {
      logger.info('Redis client connected and ready to use.');
    });

    this.client.on('error', (err) => {
      logger.error(err, 'Redis client error');
    });

    this.client.on('close', () => {
      logger.warn('Redis client connection closed.');
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });
  }

  /**
   * Retrieves the singleton instance of the RedisService
   */
  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * Retrieves the configured ioredis client
   */
  public getClient(): Redis {
    return this.client;
  }

  /**
   * Gracefully disconnects the Redis client
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      const status = this.client.status;
      if (status !== 'end' && status !== 'close') {
        try {
          await this.client.quit();
          logger.info('Redis client disconnected gracefully.');
        } catch (err) {
          logger.error(err, 'Failed to close Redis connection gracefully');
        }
      } else {
        logger.info(`Redis client connection is already in '${status}' state.`);
      }
    }
  }
}

// Export the singleton Redis client instance
export const redis = RedisService.getInstance().getClient();
