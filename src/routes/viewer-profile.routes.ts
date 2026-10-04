import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { viewerProfileService } from '../services/viewer-profile.service';
import { AppError } from '../utils/errors';
import { z } from 'zod';

const router = Router();

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  birthDate: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  location: z.string().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  profileVisibility: z.enum(['public', 'private']).optional(),
  activityVisibility: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
});

const reportSchema = z.object({
  reportedUserId: z.string(),
  category: z.enum([
    'harassment',
    'spam',
    'inappropriate_content',
    'scam',
    'underage',
    'identity_theft',
    'other',
  ]),
  description: z.string().max(1000).optional(),
  evidence: z.array(z.string()).optional(),
});

function asyncHandler(fn: Function) {
  return (req: Request, res: Response) => {
    Promise.resolve(fn(req, res)).catch((err) => {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: err.errors,
        });
      }

      if (err instanceof AppError) {
        return res.status(err.statusCode).json({
          code: err.code,
          message: err.message,
        });
      }

      console.error('Error:', err);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
    });
  };
}

/**
 * GET /api/profiles/viewer/me
 * Get current user's viewer profile
 */
router.get(
  '/viewer/me',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const profile = await viewerProfileService.getProfile(req.user.userId);

    res.json({
      profile,
    });
  })
);

/**
 * PUT /api/profiles/viewer/me
 * Update current user's viewer profile
 */
router.put(
  '/viewer/me',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const input = updateProfileSchema.parse(req.body);

    const profile = await viewerProfileService.updateProfile(req.user.userId, {
      ...input,
      birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
    });

    res.json({
      message: 'Profile updated successfully',
      profile,
    });
  })
);

/**
 * GET /api/profiles/viewer/:userId
 * Get public viewer profile
 */
router.get(
  '/viewer/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const profile = await viewerProfileService.getPublicProfile(userId);

    res.json({
      profile,
    });
  })
);

/**
 * POST /api/profiles/viewer/me/block
 * Block a user
 */
router.post(
  '/viewer/me/block',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const { blockedUserId } = req.body;

    if (!blockedUserId) {
      throw new AppError(400, 'MISSING_USER_ID', 'blockedUserId is required');
    }

    await viewerProfileService.blockUser(req.user.userId, blockedUserId);

    res.json({
      message: 'User blocked successfully',
    });
  })
);

/**
 * DELETE /api/profiles/viewer/me/block/:userId
 * Unblock a user
 */
router.delete(
  '/viewer/me/block/:userId',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const { userId } = req.params;

    await viewerProfileService.unblockUser(req.user.userId, userId);

    res.json({
      message: 'User unblocked successfully',
    });
  })
);

/**
 * GET /api/profiles/viewer/me/blocked
 * Get list of blocked users
 */
router.get(
  '/viewer/me/blocked',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const blocked = await viewerProfileService.getBlockedUsers(req.user.userId);

    res.json({
      blockedUsers: blocked,
      count: blocked.length,
    });
  })
);

/**
 * POST /api/profiles/viewer/me/report
 * Report a user or content
 */
router.post(
  '/viewer/me/report',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const input = reportSchema.parse(req.body);

    const result = await viewerProfileService.reportUser(
      req.user.userId,
      input.reportedUserId,
      input.category,
      input.description,
      input.evidence
    );

    res.status(201).json(result);
  })
);

export default router;
