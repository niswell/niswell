import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { creatorProfileService } from '../services/creator-profile.service';
import { AppError } from '../utils/errors';
import { z } from 'zod';

const router = Router();

const creatorApplicationSchema = z.object({
  bio: z.string().max(500).optional(),
  categories: z.array(z.string()).min(1, 'At least one category required'),
  languages: z.array(z.string()).min(1, 'At least one language required'),
});

const updateCreatorProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  categories: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  geoBlockedCountries: z.array(z.string()).optional(),
  minTipAmount: z.number().min(0.5).optional(),
  payoutFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  minimumPayoutAmount: z.number().min(10).optional(),
});

const tipMenuSchema = z.object({
  label: z.string().min(1).max(50),
  amount: z.number().min(0.5).max(10000),
  icon: z.string().optional(),
});

const scheduleSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string(),
  notifyFollowers: z.boolean().optional(),
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
 * POST /api/creator/apply
 * Apply to become a creator
 */
router.post(
  '/apply',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const input = creatorApplicationSchema.parse(req.body);

    const result = await creatorProfileService.applyAsCreator(req.user.userId, input);

    res.status(201).json(result);
  })
);

/**
 * GET /api/creator/status
 * Get creator application status
 */
router.get(
  '/status',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const status = await creatorProfileService.getApplicationStatus(req.user.userId);

    res.json({
      applicationStatus: status,
    });
  })
);

/**
 * GET /api/creator/profile
 * Get current creator profile
 */
router.get(
  '/profile',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const profile = await creatorProfileService.getCreatorProfile(req.user.userId);

    res.json({
      profile,
    });
  })
);

/**
 * PUT /api/creator/profile
 * Update creator profile
 */
router.put(
  '/profile',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const input = updateCreatorProfileSchema.parse(req.body);

    const profile = await creatorProfileService.updateCreatorProfile(req.user.userId, input);

    res.json({
      message: 'Creator profile updated successfully',
      profile,
    });
  })
);

/**
 * POST /api/creator/tip-menu
 * Add tip menu item
 */
router.post(
  '/tip-menu',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const input = tipMenuSchema.parse(req.body);

    const menu = await creatorProfileService.addTipMenu(req.user.userId, input);

    res.status(201).json({
      message: 'Tip menu item added',
      tipMenu: menu,
    });
  })
);

/**
 * GET /api/creator/tip-menu
 * Get tip menu items
 */
router.get(
  '/tip-menu',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const menus = await creatorProfileService.getTipMenus(req.user.userId);

    res.json({
      tipMenus: menus,
      count: menus.length,
    });
  })
);

/**
 * PUT /api/creator/tip-menu/:menuId
 * Update tip menu item
 */
router.put(
  '/tip-menu/:menuId',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const { menuId } = req.params;
    const input = tipMenuSchema.parse(req.body);

    const menu = await creatorProfileService.updateTipMenu(req.user.userId, menuId, input);

    res.json({
      message: 'Tip menu item updated',
      tipMenu: menu,
    });
  })
);

/**
 * DELETE /api/creator/tip-menu/:menuId
 * Delete tip menu item
 */
router.delete(
  '/tip-menu/:menuId',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const { menuId } = req.params;

    await creatorProfileService.deleteTipMenu(req.user.userId, menuId);

    res.json({
      message: 'Tip menu item deleted',
    });
  })
);

/**
 * POST /api/creator/schedule
 * Add stream schedule
 */
router.post(
  '/schedule',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const input = scheduleSchema.parse(req.body);

    const schedule = await creatorProfileService.addStreamSchedule(req.user.userId, input);

    res.status(201).json({
      message: 'Stream schedule added',
      schedule,
    });
  })
);

/**
 * GET /api/creator/schedule
 * Get stream schedules
 */
router.get(
  '/schedule',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const schedules = await creatorProfileService.getStreamSchedules(req.user.userId);

    res.json({
      schedules,
      count: schedules.length,
    });
  })
);

/**
 * DELETE /api/creator/schedule/:scheduleId
 * Delete stream schedule
 */
router.delete(
  '/schedule/:scheduleId',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const { scheduleId } = req.params;

    await creatorProfileService.deleteStreamSchedule(req.user.userId, scheduleId);

    res.json({
      message: 'Stream schedule deleted',
    });
  })
);

/**
 * GET /api/creator/earnings
 * Get creator earnings dashboard
 */
router.get(
  '/earnings',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const dashboard = await creatorProfileService.getEarningsDashboard(req.user.userId);

    res.json({
      earningsDashboard: dashboard,
    });
  })
);

export default router;
