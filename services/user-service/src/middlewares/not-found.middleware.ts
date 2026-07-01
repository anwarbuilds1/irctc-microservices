import { NextFunction, Request, Response } from "express";
import NotFoundError from "../exceptions/NotFoundError";

export default function notFound(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  next(new NotFoundError());
}
