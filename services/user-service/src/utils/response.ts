import { Response } from "express";

export function success(
  res: Response,
  data: unknown,
  message = "Success",
  status = 200,
) {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
}
