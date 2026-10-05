import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateCreatorApplicationInput {
  bio?: string;
  categories: string[];
  languages: string[];
}

export interface UpdateCreatorProfileInput {
  bio?: string;
  categories?: string[];
  languages?: string[];
  geoBlockedCountries?: string[];
  minTipAmount?: number;
  payoutFrequency?: string;
  minimumPayoutAmount?: number;
}

export interface UpdateTipMenuInput {
  label: string;
  amount: number;
  icon?: string;
}

export interface UpdateStreamScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
  notifyFollowers?: boolean;
}

export class CreatorProfileService {
  async getOrCreateCreatorProfile(userId: string) {
    let profile = await prisma.creatorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      profile = await prisma.creatorProfile.create({
        data: {
          userId,
        },
      });
    }

    return profile;
  }

  async getCreatorProfile(userId: string) {
    const profile = await prisma.creatorProfile.findUnique({
      where: { userId },
      include: {
        application: true,
        verification: true,
        tipMenus: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
        schedules: {
          where: { isActive: true },
        },
      },
    });

    if (!profile) {
      throw new AppError(404, 'CREATOR_NOT_FOUND', 'Creator profile not found');
    }

    return profile;
  }

  async applyAsCreator(userId: string, input: CreateCreatorApplicationInput) {
    // Check if user is at least 18 years old (can be enhanced with actual verification)
    const userProfile = await prisma.viewerProfile.findUnique({
      where: { userId },
    });

    if (!userProfile) {
      throw new AppError(400, 'NO_VIEWER_PROFILE', 'Viewer profile required before creator application');
    }

    if (userProfile.birthDate) {
      const age = Math.floor((Date.now() - userProfile.birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18) {
        throw new AppError(403, 'TOO_YOUNG', 'Must be at least 18 years old to become a creator');
      }
    }

    // Check if already applied
    const existing = await prisma.creatorProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      const app = await prisma.creatorApplication.findUnique({
        where: { creatorProfileId: existing.id },
      });

      if (app?.status === 'pending') {
        throw new AppError(400, 'APPLICATION_PENDING', 'You already have a pending application');
      }
    }

    // Validate categories
    if (!input.categories || input.categories.length === 0) {
      throw new AppError(400, 'MISSING_CATEGORIES', 'At least one category is required');
    }

    const validCategories = ['fitness', 'music', 'gaming', 'art', 'education', 'lifestyle', 'other'];
    const invalidCategories = input.categories.filter((c) => !validCategories.includes(c));
    if (invalidCategories.length > 0) {
      throw new AppError(400, 'INVALID_CATEGORIES', `Invalid categories: ${invalidCategories.join(', ')}`);
    }

    // Create or update creator profile
    const creatorProfile = await this.getOrCreateCreatorProfile(userId);

    // Update profile with application data
    const updated = await prisma.creatorProfile.update({
      where: { id: creatorProfile.id },
      data: {
        bio: input.bio,
        categories: input.categories,
        languages: input.languages,
      },
    });

    // Create application
    const application = await prisma.creatorApplication.create({
      data: {
        creatorProfileId: updated.id,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'creator.application_submitted',
        resource: 'creator_application',
        resourceId: application.id,
        status: 'success',
      },
    });

    return {
      applicationId: application.id,
      status: application.status,
      message: 'Application submitted successfully. You will be notified when we review your application.',
    };
  }

  async getApplicationStatus(userId: string) {
    const profile = await prisma.creatorProfile.findUnique({
      where: { userId },
      include: {
        application: {
          select: {
            id: true,
            status: true,
            submittedAt: true,
            reviewedAt: true,
            reasonForRejection: true,
            revisionCount: true,
          },
        },
      },
    });

    if (!profile) {
      throw new AppError(404, 'CREATOR_NOT_FOUND', 'Creator profile not found');
    }

    return profile.application || { status: 'not_applied' };
  }

  async updateCreatorProfile(userId: string, input: UpdateCreatorProfileInput) {
    const profile = await this.getOrCreateCreatorProfile(userId);

    // Validate input
    if (input.minTipAmount && input.minTipAmount < 0.5) {
      throw new AppError(400, 'MIN_TIP_TOO_LOW', 'Minimum tip amount must be at least $0.50');
    }

    if (input.minimumPayoutAmount && input.minimumPayoutAmount < 10) {
      throw new AppError(400, 'MIN_PAYOUT_TOO_LOW', 'Minimum payout amount must be at least $10');
    }

    // Update profile
    const updated = await prisma.creatorProfile.update({
      where: { id: profile.id },
      data: {
        ...(input.bio && { bio: input.bio }),
        ...(input.categories && { categories: input.categories }),
        ...(input.languages && { languages: input.languages }),
        ...(input.geoBlockedCountries && { geoBlockedCountries: input.geoBlockedCountries }),
        ...(input.minTipAmount && { minTipAmount: new Decimal(input.minTipAmount) }),
        ...(input.payoutFrequency && { payoutFrequency: input.payoutFrequency }),
        ...(input.minimumPayoutAmount && { minimumPayoutAmount: new Decimal(input.minimumPayoutAmount) }),
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'creator.profile_updated',
        resource: 'creator_profile',
        resourceId: updated.id,
        status: 'success',
      },
    });

    return updated;
  }

  async addTipMenu(userId: string, input: UpdateTipMenuInput) {
    const profile = await this.getOrCreateCreatorProfile(userId);

    // Validate
    if (input.amount < 0.5) {
      throw new AppError(400, 'TIP_TOO_LOW', 'Minimum tip is $0.50');
    }

    if (input.amount > 10000) {
      throw new AppError(400, 'TIP_TOO_HIGH', 'Maximum tip is $10,000');
    }

    // Get max order
    const maxOrder = await prisma.tipMenu.aggregate({
      where: { creatorProfileId: profile.id },
      _max: { order: true },
    });

    const menu = await prisma.tipMenu.create({
      data: {
        creatorProfileId: profile.id,
        label: input.label,
        amount: new Decimal(input.amount),
        icon: input.icon,
        order: (maxOrder._max.order || 0) + 1,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'creator.tip_menu_added',
        resource: 'tip_menu',
        resourceId: menu.id,
        status: 'success',
      },
    });

    return menu;
  }

  async getTipMenus(userId: string) {
    const profile = await this.getOrCreateCreatorProfile(userId);

    return prisma.tipMenu.findMany({
      where: { creatorProfileId: profile.id },
      orderBy: { order: 'asc' },
    });
  }

  async updateTipMenu(userId: string, menuId: string, input: UpdateTipMenuInput) {
    const profile = await this.getOrCreateCreatorProfile(userId);

    // Verify ownership
    const menu = await prisma.tipMenu.findUnique({ where: { id: menuId } });
    if (!menu || menu.creatorProfileId !== profile.id) {
      throw new AppError(403, 'NOT_OWNER', 'Cannot modify this tip menu');
    }

    const updated = await prisma.tipMenu.update({
      where: { id: menuId },
      data: {
        label: input.label,
        amount: new Decimal(input.amount),
        icon: input.icon,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'creator.tip_menu_updated',
        resource: 'tip_menu',
        resourceId: menuId,
        status: 'success',
      },
    });

    return updated;
  }

  async deleteTipMenu(userId: string, menuId: string) {
    const profile = await this.getOrCreateCreatorProfile(userId);

    // Verify ownership
    const menu = await prisma.tipMenu.findUnique({ where: { id: menuId } });
    if (!menu || menu.creatorProfileId !== profile.id) {
      throw new AppError(403, 'NOT_OWNER', 'Cannot delete this tip menu');
    }

    await prisma.tipMenu.delete({ where: { id: menuId } });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'creator.tip_menu_deleted',
        resource: 'tip_menu',
        resourceId: menuId,
        status: 'success',
      },
    });
  }

  async addStreamSchedule(userId: string, input: UpdateStreamScheduleInput) {
    const profile = await this.getOrCreateCreatorProfile(userId);

    // Validate day of week
    if (input.dayOfWeek < 0 || input.dayOfWeek > 6) {
      throw new AppError(400, 'INVALID_DAY', 'Day of week must be 0-6');
    }

    // Validate time format
    if (!/^\d{2}:\d{2}$/.test(input.startTime) || !/^\d{2}:\d{2}$/.test(input.endTime)) {
      throw new AppError(400, 'INVALID_TIME_FORMAT', 'Time must be in HH:mm format');
    }

    // Check if already exists
    const existing = await prisma.streamSchedule.findUnique({
      where: {
        creatorProfileId_dayOfWeek: {
          creatorProfileId: profile.id,
          dayOfWeek: input.dayOfWeek,
        },
      },
    });

    if (existing) {
      throw new AppError(400, 'SCHEDULE_EXISTS', 'Schedule already exists for this day');
    }

    const schedule = await prisma.streamSchedule.create({
      data: {
        creatorProfileId: profile.id,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        timezone: input.timezone,
        notifyFollowers: input.notifyFollowers ?? true,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'creator.schedule_added',
        resource: 'stream_schedule',
        resourceId: schedule.id,
        status: 'success',
      },
    });

    return schedule;
  }

  async getStreamSchedules(userId: string) {
    const profile = await this.getOrCreateCreatorProfile(userId);

    return prisma.streamSchedule.findMany({
      where: { creatorProfileId: profile.id },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async deleteStreamSchedule(userId: string, scheduleId: string) {
    const profile = await this.getOrCreateCreatorProfile(userId);

    // Verify ownership
    const schedule = await prisma.streamSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule || schedule.creatorProfileId !== profile.id) {
      throw new AppError(403, 'NOT_OWNER', 'Cannot delete this schedule');
    }

    await prisma.streamSchedule.delete({ where: { id: scheduleId } });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'creator.schedule_deleted',
        resource: 'stream_schedule',
        resourceId: scheduleId,
        status: 'success',
      },
    });
  }

  async getEarningsDashboard(userId: string) {
    const profile = await this.getOrCreateCreatorProfile(userId);

    // In Phase 3, this will pull from ledger
    return {
      creatorProfileId: profile.id,
      totalEarnings: profile.totalEarnings,
      totalFollowers: profile.totalFollowers,
      totalStreams: profile.totalStreams,
      isMonetized: profile.isMonetized,
      verificationStatus: profile.verificationStatus,
      payoutFrequency: profile.payoutFrequency,
      minimumPayoutAmount: profile.minimumPayoutAmount,
    };
  }
}

export const creatorProfileService = new CreatorProfileService();
