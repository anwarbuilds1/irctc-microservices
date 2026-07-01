import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";

import routes from "./routes";
import requestLogger from "./middlewares/validate.middleware";
import notFound from "./middlewares/not-found.middleware";
import errorHandler from "./middlewares/error.middleware";

const app = express();

app.use(helmet());

app.use(cors());

app.use(requestLogger);

app.use(cookieParser());

app.use(express.json());

app.use("/api/v1", routes);

app.use(notFound);

app.use(errorHandler);

export default app;
