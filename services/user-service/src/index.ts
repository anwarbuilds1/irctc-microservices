import { app } from './app';
import { config, logger } from './config';

// Start server
const server = app.listen(config.PORT, () => {
    logger.info(`User Service started in ${config.NODE_ENV} mode on port ${config.PORT}
    Health Check: http://localhost:${config.PORT}/api/v1/health
    `);
});

// Graceful shutdown
const shutdown = () => {
    logger.info('Shutting down gracefully...');
    server.close(async () => {
        try {
            const { RedisService } = await import('./config/redis');
            const { PrismaService } = await import('./config/prisma');

            await Promise.all([
                RedisService.getInstance().disconnect(),
                PrismaService.getInstance().disconnect()
            ]);
        } catch (err) {
            logger.error(err, 'Error during database/cache disconnection');
        }
        logger.info('Closed out remaining connections.');
        process.exit(0);
    });

    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
