import pino from "pino";

const logger = pino({
  base: {
    service: "user-service",
    environment: process.env.NODE_ENV,
  },
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
        }
      : undefined,
});

export default logger;
