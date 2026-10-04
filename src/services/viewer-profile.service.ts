import { prisma } from '../lib/prisma';
import { AppError, ValidationErrors } from '../utils/errors';

export interface UpdateViewerProfileInput {
  displayName?: string;
  bio?: string;
  birthDate?: Date;
  gender?: string;
  location?: string;
  language?: string;
  timezone?: string;
  profileVisibility?: string;
  activityVisibility?: boolean;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
}

export class ViewerProfileService {
  async getOrCreateProfile(userId: string) {
    let profile = await prisma.viewerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      profile = await prisma.viewerProfile.create({
        data: {
          userId,
        },
      });
    }

    return profile;
  }

  async getProfile(userId: string) {
    const profile = await prisma.viewerProfile.findUnique({
      where: { userId },
      include: {
        blockedUsers: {
          select: { blockedProfileId: true },
        },
        blockedByUsers: {
          select: { blockerProfileId: true },
        },
        subscriptions: {
          where: { status: 'active' },
          include: {
            creatorProfile: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Viewer profile not found');
    }

    return profile;
  }

  async updateProfile(userId: string, input: UpdateViewerProfileInput) {
    // Validate input
    if (input.displayName && input.displayName.length < 2) {
      throw new AppError(400, 'INVALID_DISPLAY_NAME', 'Display name must be at least 2 characters');
    }

    if (input.displayName && input.displayName.length > 50) {
      throw new AppError(400, 'DISPLAY_NAME_TOO_LONG', 'Display name cannot exceed 50 characters');
    }

    if (input.bio && input.bio.length > 500) {
      throw new AppError(400, 'BIO_TOO_LONG', 'Bio cannot exceed 500 characters');
    }

    if (input.timezone && !this.isValidTimezone(input.timezone)) {
      throw new AppError(400, 'INVALID_TIMEZONE', 'Invalid timezone');
    }

    if (input.gender && !['male', 'female', 'other'].includes(input.gender)) {
      throw new AppError(400, 'INVALID_GENDER', 'Invalid gender');
    }

    // Ensure profile exists
    await this.getOrCreateProfile(userId);

    // Update profile
    const profile = await prisma.viewerProfile.update({
      where: { userId },
      data: {
        ...(input.displayName && {
          // Also update user display name
          user: { update: { displayName: input.displayName } }
        }),
        bio: input.bio,
        birthDate: input.birthDate,
        gender: input.gender,
        location: input.location,
        language: input.language,
        timezone: input.timezone,
        profileVisibility: input.profileVisibility,
        activityVisibility: input.activityVisibility,
        emailNotifications: input.emailNotifications,
        pushNotifications: input.pushNotifications,
      },
      include: {
        user: { select: { id: true, email: true, displayName: true, avatar: true } },
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'profile.updated',
        resource: 'viewer_profile',
        resourceId: profile.id,
        status: 'success',
      },
    });

    return profile;
  }

  async getPublicProfile(userId: string) {
    const profile = await prisma.viewerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        bio: true,
        location: true,
        language: true,
        profileVisibility: true,
        followerCount: true,
        followingCount: true,
        createdAt: true,
      },
    });

    if (!profile) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Viewer profile not found');
    }

    // Check visibility
    if (profile.profileVisibility === 'private') {
      return {
        id: profile.id,
        userId: profile.userId,
        bio: '[Private Profile]',
        profileVisibility: 'private',
      };
    }

    return profile;
  }

  async blockUser(userId: string, blockedUserId: string) {
    if (userId === blockedUserId) {
      throw new AppError(400, 'CANNOT_BLOCK_SELF', 'Cannot block yourself');
    }

    // Get both profiles
    const blockerProfile = await this.getOrCreateProfile(userId);
    const blockedProfile = await this.getOrCreateProfile(blockedUserId);

    // Check if already blocked
    const existing = await prisma.userBlock.findUnique({
      where: {
        blockerProfileId_blockedProfileId: {
          blockerProfileId: blockerProfile.id,
          blockedProfileId: blockedProfile.id,
        },
      },
    });

    if (existing) {
      throw new AppError(400, 'ALREADY_BLOCKED', 'User already blocked');
    }

    // Create block
    const block = await prisma.userBlock.create({
      data: {
        blockerProfileId: blockerProfile.id,
        blockedProfileId: blockedProfile.id,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'user.blocked',
        resource: 'user_block',
        resourceId: block.id,
        status: 'success',
      },
    });

    return block;
  }

  async unblockUser(userId: string, blockedUserId: string) {
    const blockerProfile = await this.getOrCreateProfile(userId);
    const blockedProfile = await this.getOrCreateProfile(blockedUserId);

    const block = await prisma.userBlock.delete({
      where: {
        blockerProfileId_blockedProfileId: {
          blockerProfileId: blockerProfile.id,
          blockedProfileId: blockedProfile.id,
        },
      },
      select: { id: true },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'user.unblocked',
        resource: 'user_block',
        resourceId: block.id,
        status: 'success',
      },
    });

    return block;
  }

  async getBlockedUsers(userId: string) {
    const profile = await this.getOrCreateProfile(userId);

    const blocks = await prisma.userBlock.findMany({
      where: { blockerProfileId: profile.id },
      include: {
        blockedProfile: {
          select: {
            userId: true,
            user: {
              select: {
                displayName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    return blocks.map((block: any) => ({
      blockedUserId: block.blockedProfile.userId,
      displayName: block.blockedProfile.user.displayName,
      avatar: block.blockedProfile.user.avatar,
      blockedAt: block.createdAt,
    }));
  }

  async reportUser(
    userId: string,
    reportedUserId: string,
    category: string,
    description?: string,
    evidence?: string[]
  ) {
    if (userId === reportedUserId) {
      throw new AppError(400, 'CANNOT_REPORT_SELF', 'Cannot report yourself');
    }

    const validCategories = [
      'harassment',
      'spam',
      'inappropriate_content',
      'scam',
      'underage',
      'identity_theft',
      'other',
    ];

    if (!validCategories.includes(category)) {
      throw new AppError(400, 'INVALID_CATEGORY', 'Invalid report category');
    }

    const reporterProfile = await this.getOrCreateProfile(userId);

    // Check if user was recently reported by this person
    const recentReport = await prisma.userReport.findFirst({
      where: {
        reporterProfileId: reporterProfile.id,
        reportedUserId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    if (recentReport) {
      throw new AppError(429, 'DUPLICATE_REPORT', 'You already reported this user recently');
    }

    // Create report
    const report = await prisma.userReport.create({
      data: {
        reporterProfileId: reporterProfile.id,
        reportedUserId,
        contentType: 'profile',
        category,
        description,
        evidence: evidence || [],
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'user.reported',
        resource: 'user_report',
        resourceId: report.id,
        status: 'success',
      },
    });

    return {
      reportId: report.id,
      message: 'Report submitted successfully. Our team will review it shortly.',
    };
  }

  private isValidTimezone(timezone: string): boolean {
    // Basic validation - in production, use a proper timezone library
    const validTimezones = [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Hong_Kong',
      'Asia/Singapore',
      'Australia/Sydney',
    ];

    return validTimezones.includes(timezone);
  }
}

export const viewerProfileService = new ViewerProfileService();
