import { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyToken, AccessTokenPayload } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';
import { redis } from '../config/redis';

// Extend Express Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        sessionId: string;
      };
    }
  }
}

/**
 * Middleware to protect routes and verify the active session in Redis.
 */
export const requireAuth: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token is required');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Authentication token is invalid');
    }

    // Verify token structure and signature
    const decoded = verifyToken<AccessTokenPayload>(token);

    // Verify session is active in Redis
    const sessionExists = await redis.exists(`auth:session:${decoded.sessionId}`);
    if (!sessionExists) {
      throw new UnauthorizedError('Session has expired or is invalid. Please log in again.');
    }

    // Attach user payload to request object
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      sessionId: decoded.sessionId,
    };

    next();
  } catch (error) {
    next(error);
  }
};
