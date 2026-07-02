import pinoHttp from "pino-http";
import logger from "../config/logger";

const requestLogger = pinoHttp({
  logger,

  genReqId: (req) => req.headers["x-request-id"] as string,

  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        ip: req.remoteAddress,
        userAgent: req.headers["user-agent"],
      };
    },

    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },

  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} completed`;
  },

  customErrorMessage(req, res) {
    return `${req.method} ${req.url} failed`;
  },

  customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});

export default requestLogger;
