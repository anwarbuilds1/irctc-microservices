import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { asyncHandler } from '../utils/async-handler';
import { sendResponse } from '../utils/response';
import { BadRequestError } from '../utils/errors';

const authService = new AuthService();

/**
 * Handles user registration.
 */
export const signup = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.signup(req.body);
  return sendResponse({
    res,
    statusCode: 201,
    message: result.message,
    data: { email: result.email },
  });
});

/**
 * Handles verification of signup OTP.
 */
export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const result = await authService.verifyOtp(email, otp);
  return sendResponse({
    res,
    statusCode: 200,
    message: result.message,
  });
});

/**
 * Handles resending of verification OTP.
 */
export const resendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await authService.resendOtp(email);
  return sendResponse({
    res,
    statusCode: 200,
    message: result.message,
  });
});

/**
 * Handles user login.
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  
  // Set refresh token in httpOnly cookie for extra security in addition to returning it
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return sendResponse({
    res,
    statusCode: 200,
    message: 'Login successful',
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    },
  });
});

/**
 * Handles user logout.
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.sessionId) {
    throw new BadRequestError('No active session found to logout');
  }

  const result = await authService.logout(req.user.sessionId);
  
  res.clearCookie('refreshToken');

  return sendResponse({
    res,
    statusCode: 200,
    message: result.message,
  });
});

/**
 * Handles access token refresh.
 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  // Support reading refresh token from request body or secure cookies
  const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
  
  if (!refreshToken) {
    throw new BadRequestError('Refresh token is required');
  }

  const result = await authService.refresh(refreshToken);

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return sendResponse({
    res,
    statusCode: 200,
    message: 'Tokens refreshed successfully',
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  });
});
