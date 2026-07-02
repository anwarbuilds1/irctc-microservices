import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";

import { env } from "./config/env";
import routes from "./routes";
import requestLogger from "./middlewares/request-logger.middleware";
import notFound from "./middlewares/not-found.middleware";
import errorHandler from "./middlewares/error.middleware";
import requestId from "./middlewares/request-id.middleware";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: env.ALLOWED_ORIGINS === "*" ? true : env.ALLOWED_ORIGINS.split(","),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
  }),
);


app.use(requestId);

app.use(requestLogger);

app.use(cookieParser());

app.use(express.json());

app.use("/api/v1", routes);

app.use(notFound);

app.use(errorHandler);

export default app;
