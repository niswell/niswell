import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../utils/errors';
import { generateAccessToken } from '../utils/jwt';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  confirmPassword: z.string(),
  displayName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string(),
});

const mfaSchema = z.object({
  mfaCode: z.string().regex(/^(\d{6}|[A-Z0-9]{8})$/, 'Invalid MFA code format'),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(12, 'Password must be at least 12 characters'),
  confirmNewPassword: z.string(),
});

// Helper function to get client IP
function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

function getUserAgent(req: Request): string {
  return req.headers['user-agent'] || 'unknown';
}

// Error handler wrapper
function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * POST /auth/register
 * Register a new user account
 */
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const body = registerSchema.parse(req.body);

    const result = await authService.register({
      email: body.email,
      password: body.password,
      confirmPassword: body.confirmPassword,
      displayName: body.displayName,
      accountType: (req.body as any).accountType,
    });

    // Get user and create session for immediate access
    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      throw new AppError(500, 'USER_NOT_FOUND', 'Failed to create user');
    }

    // Create session
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        userAgent: getUserAgent(req),
        ipAddress: getClientIp(req),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Generate access token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      roles: user.roles.map((ur: any) => ur.role.name),
      sessionId: session.id,
    });

    res.status(201).json({
      message: 'Registration successful',
      userId: result.userId,
      accessToken,
    });
  })
);

/**
 * POST /auth/verify-email
 * Verify email address
 */
router.post(
  '/verify-email',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;

    if (!token) {
      throw new AppError(400, 'MISSING_TOKEN', 'Email verification token is required');
    }

    await authService.verifyEmail(token);

    res.json({
      message: 'Email verified successfully. You can now login.',
    });
  })
);

/**
 * POST /auth/login
 * Login with email and password
 */
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const body = loginSchema.parse(req.body);

    const result = await authService.login({
      email: body.email,
      password: body.password,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    if (result.mfaRequired) {
      return res.status(200).json({
        mfaRequired: true,
        mfaToken: result.mfaToken,
        message: 'MFA code required. Please use the mfaToken in the MFA verification endpoint.',
      });
    }

    res.json({
      userId: result.userId,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      message: 'Login successful',
    });
  })
);

/**
 * POST /auth/mfa/verify
 * Verify MFA code (TOTP or backup code)
 */
router.post(
  '/mfa/verify',
  asyncHandler(async (req: Request, res: Response) => {
    const body = mfaSchema.parse(req.body);
    const { userId, mfaToken } = req.body;

    if (!userId || !mfaToken) {
      throw new AppError(400, 'MISSING_MFA_DATA', 'userId and mfaToken are required');
    }

    const result = await authService.verifyMFA(
      userId,
      body.mfaCode,
      getClientIp(req),
      getUserAgent(req)
    );

    res.json({
      userId: result.userId,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      message: 'MFA verification successful',
    });
  })
);

/**
 * POST /auth/mfa/setup
 * Initiate MFA setup (get QR code and backup codes)
 */
router.post(
  '/mfa/setup',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const result = await authService.setupMFA(req.user.userId);

    res.json({
      secret: result.secret,
      qrCode: result.qrCode,
      backupCodes: result.backupCodes,
      message: 'MFA setup initiated. Scan QR code with authenticator app, then confirm with a code.',
    });
  })
);

/**
 * POST /auth/mfa/confirm
 * Confirm MFA setup with verification code
 */
router.post(
  '/mfa/confirm',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const { mfaCode, secret, backupCodes } = req.body;

    if (!mfaCode || !secret || !backupCodes) {
      throw new AppError(400, 'MISSING_FIELDS', 'mfaCode, secret, and backupCodes are required');
    }

    await authService.confirmMFASetup(req.user.userId, mfaCode, secret, backupCodes);

    res.json({
      message: 'MFA enabled successfully. Save your backup codes in a secure location.',
    });
  })
);

/**
 * POST /auth/logout
 * Logout and revoke session
 */
router.post(
  '/logout',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.sessionId) {
      throw new AppError(400, 'NO_SESSION', 'No active session');
    }

    await authService.logout(req.sessionId);

    res.json({
      message: 'Logged out successfully',
    });
  })
);

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError(400, 'MISSING_REFRESH_TOKEN', 'Refresh token is required');
    }

    const result = await authService.refreshToken(refreshToken);

    res.json({
      accessToken: result.accessToken,
      message: 'Token refreshed successfully',
    });
  })
);

/**
 * POST /auth/password/change
 * Change password for authenticated user
 */
router.post(
  '/password/change',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const body = passwordChangeSchema.parse(req.body);

    if (body.newPassword !== body.confirmNewPassword) {
      throw new AppError(400, 'PASSWORD_MISMATCH', 'Passwords do not match');
    }

    await authService.changePassword(
      req.user.userId,
      body.currentPassword,
      body.newPassword
    );

    res.json({
      message: 'Password changed successfully. All existing sessions have been revoked.',
    });
  })
);

/**
 * GET /auth/me
 * Get current user info
 */
router.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    res.json({
      userId: req.user.userId,
      email: req.user.email,
      roles: req.user.roles,
    });
  })
);

// Global error handler for validation errors
router.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      details: err.details,
    });
  }

  console.error('Unexpected error:', err);
  return res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  });
});

export default router;
