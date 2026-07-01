import pinoHttp from "pino-http";
import logger from "../config/logger";

const requestLogger = pinoHttp({
  logger,
});

export default requestLogger;
