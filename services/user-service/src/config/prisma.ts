import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { env } from './env';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var prismaPgPool: pg.Pool | undefined;
}

export class PrismaService {
  private static instance: PrismaService | null = null;
  private client: PrismaClient;
  private pool?: pg.Pool;

  private constructor() {
    // If a global instance exists (typically in development hot-reloading), use it
    if (process.env.NODE_ENV !== 'production' && global.prisma) {
      this.client = global.prisma;
      this.pool = global.prismaPgPool;
      logger.info('Reusing existing Prisma client instance from global scope.');
      return;
    }

    const connectionString = env.DATABASE_URL;
    if (!connectionString) {
      logger.error('DATABASE_URL is not defined in environment variables.');
      throw new Error('DATABASE_URL is required to initialize Prisma Client.');
    }

    // Configure PG connection pool and Prisma adapter
    this.pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(this.pool);

    this.client = new PrismaClient({
      adapter,
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });

    this.setupListeners();

    // Cache the instance on the global object in development
    if (process.env.NODE_ENV !== 'production') {
      global.prisma = this.client;
      global.prismaPgPool = this.pool;
    }
  }

  private setupListeners(): void {
    const clientAny = this.client as any;

    clientAny.$on('query', (e: any) => {
      logger.debug(`Prisma Query: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`);
    });

    clientAny.$on('info', (e: any) => {
      logger.info(`Prisma Info: ${e.message}`);
    });

    clientAny.$on('warn', (e: any) => {
      logger.warn(`Prisma Warning: ${e.message}`);
    });

    clientAny.$on('error', (e: any) => {
      logger.error(`Prisma Error: ${e.message}`);
    });
  }

  /**
   * Retrieves the singleton instance of the PrismaService
   */
  public static getInstance(): PrismaService {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaService();
    }
    return PrismaService.instance;
  }

  /**
   * Retrieves the Prisma client
   */
  public getClient(): PrismaClient {
    return this.client;
  }

  /**
   * Gracefully disconnects the Prisma client and closes the pg Pool connection
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
      logger.info('Prisma client disconnected gracefully.');
    }
    const pool = this.pool || global.prismaPgPool;
    if (pool) {
      await pool.end();
      logger.info('Postgres connection pool ended gracefully.');
    }
  }
}

// Export the singleton Prisma client instance
export const prisma = PrismaService.getInstance().getClient();
