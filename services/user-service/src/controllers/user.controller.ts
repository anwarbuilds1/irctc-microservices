import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { success } from "../utils/response";
import asyncHandler from "../utils/async-handler";
import UnauthorizedError from "../exceptions/UnauthorizedError";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.registerUser(req.body);
  return success(res, result, "User registered successfully", 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.loginUser(req.body);
  return success(res, result, "Login successful", 200);
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError("Not authenticated");
  }
  const result = await userService.getUserProfile(req.user.id);
  return success(res, result, "User profile retrieved successfully", 200);
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError("Not authenticated");
  }
  const result = await userService.updateUserProfile(req.user.id, req.body);
  return success(res, result, "User profile updated successfully", 200);
});
