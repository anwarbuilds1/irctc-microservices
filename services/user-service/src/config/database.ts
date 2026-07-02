import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "./env";
import logger from "./logger";

const pool = new Pool({ connectionString: env.DATABASE_URL });

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: [
    { emit: "event", level: "query" },
    { emit: "event", level: "info" },
    { emit: "event", level: "warn" },
    { emit: "event", level: "error" },
  ],
}) as any; // Cast as any to allow $on event handlers without strict type clashes in different Prisma CLI version setups

// Bind Prisma events to our structured pino logger
prisma.$on("query", (e: any) => {
  logger.debug(
    {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    },
    "Prisma Query executed",
  );
});

prisma.$on("info", (e: any) => {
  logger.info({ message: e.message }, "Prisma Info");
});

prisma.$on("warn", (e: any) => {
  logger.warn({ message: e.message }, "Prisma Warning");
});

prisma.$on("error", (e: any) => {
  logger.error({ message: e.message }, "Prisma Error");
});

export const closeDatabase = async () => {
  await prisma.$disconnect();
  await pool.end();
  logger.info("Database connections closed successfully.");
};
