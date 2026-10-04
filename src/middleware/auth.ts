import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload, decodeToken } from '../utils/jwt';
import { AppError, AuthErrors } from '../utils/errors';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: TokenPayload;
  sessionId?: string;
}

export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      throw new AppError(
        AuthErrors.INVALID_TOKEN.statusCode,
        AuthErrors.INVALID_TOKEN.code,
        AuthErrors.INVALID_TOKEN.message
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      throw new AppError(
        AuthErrors.INVALID_TOKEN.statusCode,
        AuthErrors.INVALID_TOKEN.code,
        AuthErrors.INVALID_TOKEN.message
      );
    }

    // Verify session is still active
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session || session.revokedAt || new Date() > session.expiresAt) {
      throw new AppError(
        AuthErrors.SESSION_EXPIRED.statusCode,
        AuthErrors.SESSION_EXPIRED.code,
        AuthErrors.SESSION_EXPIRED.message
      );
    }

    // Verify user account status
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || user.deletedAt) {
      throw new AppError(
        AuthErrors.ACCOUNT_NOT_FOUND.statusCode,
        AuthErrors.ACCOUNT_NOT_FOUND.code,
        AuthErrors.ACCOUNT_NOT_FOUND.message
      );
    }

    if (user.accountState === 'banned' || user.accountState === 'suspended') {
      throw new AppError(
        AuthErrors.FORBIDDEN.statusCode,
        AuthErrors.FORBIDDEN.code,
        `Account ${user.accountState}`
      );
    }

    // Update last activity
    await prisma.session.update({
      where: { id: payload.sessionId },
      data: { lastActivityAt: new Date() },
    });

    req.user = payload;
    req.sessionId = payload.sessionId;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
        details: error.details,
      });
    } else {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
    }
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(AuthErrors.UNAUTHORIZED.statusCode).json({
        code: AuthErrors.UNAUTHORIZED.code,
        message: AuthErrors.UNAUTHORIZED.message,
      });
      return;
    }

    const hasRole = allowedRoles.some((role) => req.user!.roles.includes(role));

    if (!hasRole) {
      res.status(AuthErrors.FORBIDDEN.statusCode).json({
        code: AuthErrors.FORBIDDEN.code,
        message: AuthErrors.FORBIDDEN.message,
      });
      return;
    }

    next();
  };
}

export function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        req.user = payload;
      }
    }

    next();
  } catch (error) {
    next();
  }
}

export function rateLimit(windowMs: number, maxRequests: number) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip}`;
    const now = Date.now();
    const data = requests.get(key);

    if (data && now < data.resetTime) {
      data.count++;

      if (data.count > maxRequests) {
        res.status(429).json({
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
        });
        return;
      }
    } else {
      requests.set(key, { count: 1, resetTime: now + windowMs });
    }

    next();
  };
}
