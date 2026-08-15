import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from './errors';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
}

/**
 * Generates a signed Access Token (JWT).
 */
export const generateAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '15m',
  });
};

/**
 * Generates a signed Refresh Token (JWT).
 */
export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

/**
 * Verifies a token and returns the payload.
 * Throws UnauthorizedError if token is invalid or expired.
 */
export const verifyToken = <T extends object>(token: string): T => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as T;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired authentication token');
  }
};
