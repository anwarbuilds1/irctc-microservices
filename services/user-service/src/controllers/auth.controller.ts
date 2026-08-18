import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { asyncHandler } from '../utils/async-handler';
import { sendResponse } from '../utils/response';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

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
  const clientInfo = {
    userAgent: req.headers['user-agent'],
    ipAddress: typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.ip || 'Unknown IP',
  };

  const result = await authService.login(req.body, clientInfo);
  
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
  if (!req.user?.id || !req.user?.sessionId) {
    throw new BadRequestError('No active session found to logout');
  }

  const result = await authService.logout(req.user.id, req.user.sessionId);
  
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

  const clientInfo = {
    userAgent: req.headers['user-agent'],
    ipAddress: typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.ip || 'Unknown IP',
  };

  const result = await authService.refresh(refreshToken, clientInfo);

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

/**
 * Retrieves all active sessions/devices for the logged-in user.
 */
export const getActiveSessions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError('User not authenticated');
  }

  const sessions = await authService.getActiveSessions(req.user.id);
  
  // Mark the current session
  const enrichedSessions = sessions.map(session => ({
    ...session,
    isCurrent: session.sessionId === req.user?.sessionId,
  }));

  return sendResponse({
    res,
    statusCode: 200,
    message: 'Active sessions retrieved successfully',
    data: enrichedSessions,
  });
});

/**
 * Revokes a specific session/device for the logged-in user.
 */
export const revokeSession = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { sessionId } = req.params;
  if (!sessionId) {
    throw new BadRequestError('Session ID is required');
  }

  await authService.revokeSession(req.user.id, sessionId);

  // If the user is revoking their own current session, clear their cookie
  if (sessionId === req.user.sessionId) {
    res.clearCookie('refreshToken');
  }

  return sendResponse({
    res,
    statusCode: 200,
    message: 'Session revoked successfully',
  });
});

/**
 * Handles user authentication via Google OAuth.
 */
export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { idToken, deviceName } = req.body;

  const clientInfo = {
    userAgent: req.headers['user-agent'],
    ipAddress: typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.ip || 'Unknown IP',
  };

  const result = await authService.googleLogin(idToken, clientInfo, deviceName);

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return sendResponse({
    res,
    statusCode: 200,
    message: 'Google login successful',
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    },
  });
});
