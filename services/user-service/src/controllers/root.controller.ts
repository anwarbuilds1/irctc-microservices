import { Request, Response } from "express";

export const getRoot = (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    service: "user-service",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    documentation: "/api/v1/health",
    message: "User Service is running successfully 🚀",
  });
};
