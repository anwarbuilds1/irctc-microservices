import app from "./app";
import { env } from "./config/env";
import logger from "./config/logger";
import { closeDatabase } from "./config/database";

const startServer = async () => {
  try {
    const server = app.listen(env.PORT, () => {
      logger.info(
        {
          service: "user-service",
          port: env.PORT,
          environment: env.NODE_ENV,
        },
        "🚀 User Service started successfully",
      );
    });

    process.on("SIGINT", async () => {
      logger.info("Received SIGINT. Shutting down gracefully...");

      server.close(async () => {
        logger.info("HTTP server closed.");
        await closeDatabase();
        process.exit(0);
      });
    });

    process.on("SIGTERM", async () => {
      logger.info("Received SIGTERM. Shutting down gracefully...");

      server.close(async () => {
        logger.info("HTTP server closed.");
        await closeDatabase();
        process.exit(0);
      });
    });

  } catch (error) {
    logger.fatal({ error }, "Failed to start User Service");

    process.exit(1);
  }
};

process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Uncaught Exception");

  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled Promise Rejection");

  process.exit(1);
});

startServer();
