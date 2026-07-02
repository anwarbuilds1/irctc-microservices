import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

export default function requestId(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestId = req.header("x-request-id") || randomUUID();

  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);

  next();
}
