import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import AppError from "../exceptions/AppError";

export default function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // 1. Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.issues.map((e: any) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
  }

  // 2. Handle Custom Application Errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // 3. Handle Prisma Database Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const targets = (err.meta?.target as string[]) || [];
      const field = targets.join(", ");
      return res.status(409).json({
        success: false,
        message: `A record with this ${field || "unique field"} already exists.`,
      });
    }
  }

  // 4. Handle invalid JSON payloads
  if (err instanceof SyntaxError && "status" in err && err.status === 400) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON payload",
    });
  }

  // 5. Handle JWT exceptions
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token has expired",
    });
  }

  // 6. Handle unexpected/internal errors
  req.log.error({ err }, "An unexpected error occurred");

  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
}
