/**
 * Integration tests for Phase 2: User Profiles & Creator Onboarding
 *
 * Run with: npm test
 */

import { viewerProfileService } from '../services/viewer-profile.service';
import { creatorProfileService } from '../services/creator-profile.service';
import { authService } from '../services/auth.service';
import { prisma } from '../lib/prisma';

// Helper to generate random email
function randomEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

// Helper to register and verify a test user
async function createTestUser() {
  const email = randomEmail();
  const password = 'TestPassword123!@#';

  const result = await authService.register({
    email,
    password,
    confirmPassword: password,
    displayName: 'Test User',
  });

  const verification = await prisma.emailVerification.findFirst({
    where: { userId: result.userId },
  });

  await authService.verifyEmail(verification!.token);

  return {
    userId: result.userId,
    email,
    password,
  };
}

describe('Phase 2: Viewer & Creator Profiles', () => {
  let testUser: any;

  beforeAll(async () => {
    testUser = await createTestUser();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Viewer Profile', () => {
    it('should create viewer profile automatically', async () => {
      const profile = await viewerProfileService.getOrCreateProfile(testUser.userId);

      expect(profile).toBeDefined();
      expect(profile.userId).toBe(testUser.userId);
      expect(profile.profileVisibility).toBe('public');
    });

    it('should update viewer profile', async () => {
      const updated = await viewerProfileService.updateProfile(testUser.userId, {
        bio: 'Test bio',
        location: 'San Francisco',
        language: 'en',
        timezone: 'America/Los_Angeles',
      });

      expect(updated.bio).toBe('Test bio');
      expect(updated.location).toBe('San Francisco');
      expect(updated.timezone).toBe('America/Los_Angeles');
    });

    it('should reject bio longer than 500 characters', async () => {
      try {
        await viewerProfileService.updateProfile(testUser.userId, {
          bio: 'x'.repeat(501),
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('BIO_TOO_LONG');
      }
    });

    it('should reject invalid timezone', async () => {
      try {
        await viewerProfileService.updateProfile(testUser.userId, {
          timezone: 'Invalid/Timezone',
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('INVALID_TIMEZONE');
      }
    });

    it('should get public profile with visibility respect', async () => {
      const user2 = await createTestUser();

      // Set private profile
      await viewerProfileService.updateProfile(user2.userId, {
        bio: 'Secret bio',
        profileVisibility: 'private',
      });

      const publicProfile = await viewerProfileService.getPublicProfile(user2.userId);

      expect(publicProfile.profileVisibility).toBe('private');
      expect(publicProfile.bio).toBe('[Private Profile]');
    });

    it('should block and unblock users', async () => {
      const user2 = await createTestUser();

      // Block user
      await viewerProfileService.blockUser(testUser.userId, user2.userId);

      let blocked = await viewerProfileService.getBlockedUsers(testUser.userId);
      expect(blocked.length).toBe(1);
      expect(blocked[0].blockedUserId).toBe(user2.userId);

      // Unblock user
      await viewerProfileService.unblockUser(testUser.userId, user2.userId);

      blocked = await viewerProfileService.getBlockedUsers(testUser.userId);
      expect(blocked.length).toBe(0);
    });

    it('should reject blocking yourself', async () => {
      try {
        await viewerProfileService.blockUser(testUser.userId, testUser.userId);
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('CANNOT_BLOCK_SELF');
      }
    });

    it('should reject duplicate block', async () => {
      const user2 = await createTestUser();

      await viewerProfileService.blockUser(testUser.userId, user2.userId);

      try {
        await viewerProfileService.blockUser(testUser.userId, user2.userId);
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('ALREADY_BLOCKED');
      }

      // Cleanup
      await viewerProfileService.unblockUser(testUser.userId, user2.userId);
    });

    it('should report user with valid category', async () => {
      const user2 = await createTestUser();

      const result = await viewerProfileService.reportUser(
        testUser.userId,
        user2.userId,
        'spam',
        'Spamming inappropriate content'
      );

      expect(result.reportId).toBeDefined();
      expect(result.message).toContain('submitted successfully');
    });

    it('should reject report with invalid category', async () => {
      const user2 = await createTestUser();

      try {
        await viewerProfileService.reportUser(
          testUser.userId,
          user2.userId,
          'invalid_category'
        );
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('INVALID_CATEGORY');
      }
    });

    it('should prevent duplicate reports within 24 hours', async () => {
      const user2 = await createTestUser();

      // First report
      await viewerProfileService.reportUser(testUser.userId, user2.userId, 'spam');

      // Second report should fail
      try {
        await viewerProfileService.reportUser(testUser.userId, user2.userId, 'spam');
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('DUPLICATE_REPORT');
      }
    });
  });

  describe('Creator Profile & Application', () => {
    let creatorUser: any;

    beforeEach(async () => {
      creatorUser = await createTestUser();
    });

    it('should create creator profile', async () => {
      const profile = await creatorProfileService.getOrCreateCreatorProfile(creatorUser.userId);

      expect(profile).toBeDefined();
      expect(profile.userId).toBe(creatorUser.userId);
      expect(profile.verificationStatus).toBe('pending');
      expect(profile.isMonetized).toBe(false);
    });

    it('should submit creator application', async () => {
      const result = await creatorProfileService.applyAsCreator(creatorUser.userId, {
        bio: 'Professional streamer',
        categories: ['gaming', 'music'],
        languages: ['en', 'es'],
      });

      expect(result.applicationId).toBeDefined();
      expect(result.status).toBe('pending');
    });

    it('should reject application with empty categories', async () => {
      try {
        await creatorProfileService.applyAsCreator(creatorUser.userId, {
          categories: [],
          languages: ['en'],
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('MISSING_CATEGORIES');
      }
    });

    it('should reject application with invalid categories', async () => {
      try {
        await creatorProfileService.applyAsCreator(creatorUser.userId, {
          categories: ['invalid_category'],
          languages: ['en'],
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('INVALID_CATEGORIES');
      }
    });

    it('should reject duplicate pending application', async () => {
      // First application
      await creatorProfileService.applyAsCreator(creatorUser.userId, {
        categories: ['gaming'],
        languages: ['en'],
      });

      // Second application should fail
      try {
        await creatorProfileService.applyAsCreator(creatorUser.userId, {
          categories: ['music'],
          languages: ['en'],
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('APPLICATION_PENDING');
      }
    });

    it('should get application status', async () => {
      await creatorProfileService.applyAsCreator(creatorUser.userId, {
        categories: ['gaming'],
        languages: ['en'],
      });

      const status = await creatorProfileService.getApplicationStatus(creatorUser.userId);

      expect(status).toBeDefined();
      expect(status.status).toBe('pending');
      expect(status.submittedAt).toBeDefined();
    });

    it('should update creator profile', async () => {
      const updated = await creatorProfileService.updateCreatorProfile(creatorUser.userId, {
        bio: 'Updated bio',
        minTipAmount: 2.50,
        payoutFrequency: 'weekly',
      });

      expect(updated.bio).toBe('Updated bio');
      expect(updated.minTipAmount.toNumber()).toBe(2.50);
      expect(updated.payoutFrequency).toBe('weekly');
    });

    it('should reject minimum tip below $0.50', async () => {
      try {
        await creatorProfileService.updateCreatorProfile(creatorUser.userId, {
          minTipAmount: 0.25,
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('MIN_TIP_TOO_LOW');
      }
    });
  });

  describe('Tip Menu', () => {
    let creatorUser: any;

    beforeEach(async () => {
      creatorUser = await createTestUser();
      await creatorProfileService.getOrCreateCreatorProfile(creatorUser.userId);
    });

    it('should add tip menu item', async () => {
      const menu = await creatorProfileService.addTipMenu(creatorUser.userId, {
        label: 'Small Tip',
        amount: 5.0,
        icon: '💰',
      });

      expect(menu).toBeDefined();
      expect(menu.label).toBe('Small Tip');
      expect(menu.amount.toNumber()).toBe(5.0);
    });

    it('should reject tip below minimum', async () => {
      try {
        await creatorProfileService.addTipMenu(creatorUser.userId, {
          label: 'Tiny Tip',
          amount: 0.25,
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('TIP_TOO_LOW');
      }
    });

    it('should reject tip above maximum', async () => {
      try {
        await creatorProfileService.addTipMenu(creatorUser.userId, {
          label: 'Huge Tip',
          amount: 50000,
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('TIP_TOO_HIGH');
      }
    });

    it('should get all tip menus', async () => {
      await creatorProfileService.addTipMenu(creatorUser.userId, {
        label: 'Tip 1',
        amount: 5.0,
      });

      await creatorProfileService.addTipMenu(creatorUser.userId, {
        label: 'Tip 2',
        amount: 10.0,
      });

      const menus = await creatorProfileService.getTipMenus(creatorUser.userId);

      expect(menus.length).toBe(2);
      expect(menus[0].order).toBeLessThan(menus[1].order);
    });

    it('should update tip menu', async () => {
      const menu = await creatorProfileService.addTipMenu(creatorUser.userId, {
        label: 'Original',
        amount: 5.0,
      });

      const updated = await creatorProfileService.updateTipMenu(creatorUser.userId, menu.id, {
        label: 'Updated',
        amount: 7.5,
      });

      expect(updated.label).toBe('Updated');
      expect(updated.amount.toNumber()).toBe(7.5);
    });

    it('should delete tip menu', async () => {
      const menu = await creatorProfileService.addTipMenu(creatorUser.userId, {
        label: 'To Delete',
        amount: 5.0,
      });

      await creatorProfileService.deleteTipMenu(creatorUser.userId, menu.id);

      const menus = await creatorProfileService.getTipMenus(creatorUser.userId);
      expect(menus.find((m) => m.id === menu.id)).toBeUndefined();
    });
  });

  describe('Stream Schedule', () => {
    let creatorUser: any;

    beforeEach(async () => {
      creatorUser = await createTestUser();
      await creatorProfileService.getOrCreateCreatorProfile(creatorUser.userId);
    });

    it('should add stream schedule', async () => {
      const schedule = await creatorProfileService.addStreamSchedule(creatorUser.userId, {
        dayOfWeek: 0,
        startTime: '14:00',
        endTime: '20:00',
        timezone: 'UTC',
      });

      expect(schedule).toBeDefined();
      expect(schedule.dayOfWeek).toBe(0);
      expect(schedule.startTime).toBe('14:00');
    });

    it('should reject invalid day of week', async () => {
      try {
        await creatorProfileService.addStreamSchedule(creatorUser.userId, {
          dayOfWeek: 7,
          startTime: '14:00',
          endTime: '20:00',
          timezone: 'UTC',
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('INVALID_DAY');
      }
    });

    it('should reject invalid time format', async () => {
      try {
        await creatorProfileService.addStreamSchedule(creatorUser.userId, {
          dayOfWeek: 0,
          startTime: '2:00',
          endTime: '20:00',
          timezone: 'UTC',
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('INVALID_TIME_FORMAT');
      }
    });

    it('should reject duplicate schedule for same day', async () => {
      await creatorProfileService.addStreamSchedule(creatorUser.userId, {
        dayOfWeek: 0,
        startTime: '14:00',
        endTime: '20:00',
        timezone: 'UTC',
      });

      try {
        await creatorProfileService.addStreamSchedule(creatorUser.userId, {
          dayOfWeek: 0,
          startTime: '10:00',
          endTime: '16:00',
          timezone: 'UTC',
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('SCHEDULE_EXISTS');
      }
    });

    it('should get all schedules', async () => {
      await creatorProfileService.addStreamSchedule(creatorUser.userId, {
        dayOfWeek: 0,
        startTime: '14:00',
        endTime: '20:00',
        timezone: 'UTC',
      });

      await creatorProfileService.addStreamSchedule(creatorUser.userId, {
        dayOfWeek: 3,
        startTime: '10:00',
        endTime: '16:00',
        timezone: 'UTC',
      });

      const schedules = await creatorProfileService.getStreamSchedules(creatorUser.userId);

      expect(schedules.length).toBe(2);
      expect(schedules[0].dayOfWeek).toBe(0);
      expect(schedules[1].dayOfWeek).toBe(3);
    });

    it('should delete stream schedule', async () => {
      const schedule = await creatorProfileService.addStreamSchedule(creatorUser.userId, {
        dayOfWeek: 0,
        startTime: '14:00',
        endTime: '20:00',
        timezone: 'UTC',
      });

      await creatorProfileService.deleteStreamSchedule(creatorUser.userId, schedule.id);

      const schedules = await creatorProfileService.getStreamSchedules(creatorUser.userId);
      expect(schedules.find((s) => s.id === schedule.id)).toBeUndefined();
    });
  });

  describe('Earnings Dashboard', () => {
    let creatorUser: any;

    beforeEach(async () => {
      creatorUser = await createTestUser();
    });

    it('should get creator earnings dashboard', async () => {
      const dashboard = await creatorProfileService.getEarningsDashboard(creatorUser.userId);

      expect(dashboard).toBeDefined();
      expect(dashboard.totalEarnings).toBeDefined();
      expect(dashboard.isMonetized).toBe(false);
    });
  });
});
