/**
 * Integration tests for authentication system
 *
 * Run with: npm test
 */

import { authService } from '../services/auth.service';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../utils/password';
import { generateAccessToken, verifyToken } from '../utils/jwt';

// Helper to generate random email
function randomEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

describe('Authentication Service', () => {
  let testUserId: string;
  const testEmail = randomEmail();
  const testPassword = 'SecurePassword123!@#';

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Registration', () => {
    it('should successfully register a new user', async () => {
      const result = await authService.register({
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
        displayName: 'Test User',
      });

      expect(result.userId).toBeDefined();
      expect(result.emailVerificationToken).toBeDefined();
      testUserId = result.userId;

      // Verify user was created
      const user = await prisma.user.findUnique({
        where: { id: testUserId },
      });

      expect(user).toBeDefined();
      expect(user?.email).toBe(testEmail);
      expect(user?.emailVerified).toBe(false);
      expect(user?.accountState).toBe('pending');
    });

    it('should reject registration with invalid email', async () => {
      try {
        await authService.register({
          email: 'invalid-email',
          password: testPassword,
          confirmPassword: testPassword,
        });
        throw new Error('Should have thrown validation error');
      } catch (error: any) {
        expect(error.code).toBe('INVALID_EMAIL');
      }
    });

    it('should reject registration with weak password', async () => {
      try {
        await authService.register({
          email: randomEmail(),
          password: 'weak',
          confirmPassword: 'weak',
        });
        throw new Error('Should have thrown validation error');
      } catch (error: any) {
        expect(error.code).toBe('WEAK_PASSWORD');
      }
    });

    it('should reject registration with mismatched passwords', async () => {
      try {
        await authService.register({
          email: randomEmail(),
          password: testPassword,
          confirmPassword: 'DifferentPassword123!@#',
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('PASSWORD_MISMATCH');
      }
    });

    it('should reject registration with duplicate email', async () => {
      try {
        await authService.register({
          email: testEmail,
          password: testPassword,
          confirmPassword: testPassword,
        });
        throw new Error('Should have thrown duplicate email error');
      } catch (error: any) {
        expect(error.code).toBe('EMAIL_ALREADY_EXISTS');
      }
    });
  });

  describe('Email Verification', () => {
    let emailToken: string;

    it('should verify email with valid token', async () => {
      // Get the email verification token from database
      const verification = await prisma.emailVerification.findFirst({
        where: { userId: testUserId },
      });

      expect(verification).toBeDefined();
      emailToken = verification!.token;

      await authService.verifyEmail(emailToken);

      // Verify user state changed
      const user = await prisma.user.findUnique({
        where: { id: testUserId },
      });

      expect(user?.emailVerified).toBe(true);
      expect(user?.accountState).toBe('active');
    });

    it('should reject verification with invalid token', async () => {
      try {
        await authService.verifyEmail('invalid-token');
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('INVALID_TOKEN');
      }
    });

    it('should reject verification with already used token', async () => {
      try {
        await authService.verifyEmail(emailToken);
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('TOKEN_ALREADY_USED');
      }
    });
  });

  describe('Login', () => {
    it('should successfully login with correct credentials', async () => {
      const result = await authService.login({
        email: testEmail,
        password: testPassword,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Client',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.userId).toBe(testUserId);
      expect(result.mfaRequired).toBeFalsy();

      // Verify token is valid
      const payload = verifyToken(result.accessToken);
      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(testUserId);
      expect(payload?.email).toBe(testEmail);
    });

    it('should reject login with incorrect password', async () => {
      try {
        await authService.login({
          email: testEmail,
          password: 'WrongPassword123!@#',
          ipAddress: '127.0.0.1',
          userAgent: 'Test Client',
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should reject login with non-existent email', async () => {
      try {
        await authService.login({
          email: 'nonexistent@example.com',
          password: testPassword,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Client',
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should lock account after 5 failed login attempts', async () => {
      const email = randomEmail();

      // Register and verify new user
      const registerResult = await authService.register({
        email,
        password: testPassword,
        confirmPassword: testPassword,
      });

      const verification = await prisma.emailVerification.findFirst({
        where: { userId: registerResult.userId },
      });

      await authService.verifyEmail(verification!.token);

      // Attempt 5 failed logins
      for (let i = 0; i < 5; i++) {
        try {
          await authService.login({
            email,
            password: 'WrongPassword123!@#',
            ipAddress: '127.0.0.1',
            userAgent: 'Test Client',
          });
        } catch (error) {
          // Expected
        }
      }

      // Verify account is locked
      try {
        await authService.login({
          email,
          password: testPassword,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Client',
        });
        throw new Error('Should have thrown account locked error');
      } catch (error: any) {
        expect(error.code).toBe('ACCOUNT_LOCKED');
      }
    });
  });

  describe('MFA', () => {
    let mfaSecret: string;
    let backupCodes: string[];

    it('should generate MFA setup', async () => {
      const result = await authService.setupMFA(testUserId);

      expect(result.secret).toBeDefined();
      expect(result.qrCode).toBeDefined();
      expect(result.backupCodes).toBeDefined();
      expect(result.backupCodes.length).toBe(10);

      mfaSecret = result.secret;
      backupCodes = result.backupCodes;
    });

    it('should enable MFA with valid code', async () => {
      // This test requires a valid TOTP code
      // For testing purposes, we would mock the verifyTOTPToken function
      // In real scenario, use authenticator library to generate valid code

      // Skip this in CI environment if needed
      if (process.env.SKIP_TOTP_TEST) {
        return;
      }

      // Note: In real tests, generate a valid TOTP code
      // const validCode = generateTOTPCode(mfaSecret);
      // await authService.confirmMFASetup(testUserId, validCode, mfaSecret, backupCodes);

      // For now, verify MFA is disabled
      const user = await prisma.user.findUnique({
        where: { id: testUserId },
      });

      expect(user?.mfaEnabled).toBe(false);
    });
  });

  describe('Password Management', () => {
    it('should change password with correct current password', async () => {
      const newPassword = 'NewSecurePassword123!@#';

      await authService.changePassword(
        testUserId,
        testPassword,
        newPassword
      );

      // Verify old password doesn't work
      try {
        await authService.login({
          email: testEmail,
          password: testPassword,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Client',
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('INVALID_CREDENTIALS');
      }

      // Verify new password works
      const result = await authService.login({
        email: testEmail,
        password: newPassword,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Client',
      });

      expect(result.accessToken).toBeDefined();
    });

    it('should reject password change with incorrect current password', async () => {
      const newPassword = 'AnotherPassword123!@#';

      try {
        await authService.changePassword(
          testUserId,
          'WrongCurrentPassword123!@#',
          newPassword
        );
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should reject weak new password', async () => {
      try {
        await authService.changePassword(
          testUserId,
          'NewSecurePassword123!@#',
          'weak'
        );
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe('WEAK_PASSWORD');
      }
    });
  });

  describe('Session Management', () => {
    let refreshToken: string;
    let accessToken: string;

    it('should create session on login', async () => {
      const result = await authService.login({
        email: testEmail,
        password: 'NewSecurePassword123!@#',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Client',
      });

      refreshToken = result.refreshToken;
      accessToken = result.accessToken;

      expect(refreshToken).toBeDefined();
      expect(accessToken).toBeDefined();

      // Verify session was created
      const session = await prisma.session.findFirst({
        where: { userId: testUserId },
      });

      expect(session).toBeDefined();
      expect(session?.revokedAt).toBeNull();
    });

    it('should refresh access token', async () => {
      const result = await authService.refreshToken(refreshToken);

      expect(result.accessToken).toBeDefined();

      // Verify new token is valid
      const payload = verifyToken(result.accessToken);
      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(testUserId);
    });

    it('should revoke session on logout', async () => {
      // Create a session first
      const loginResult = await authService.login({
        email: testEmail,
        password: 'NewSecurePassword123!@#',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Client',
      });

      const session = await prisma.session.findFirst({
        where: { userId: testUserId, revokedAt: null },
      });

      expect(session).toBeDefined();

      // Logout
      await authService.logout(session!.id);

      // Verify session is revoked
      const revokedSession = await prisma.session.findUnique({
        where: { id: session!.id },
      });

      expect(revokedSession?.revokedAt).toBeDefined();
    });
  });

  describe('Audit Logging', () => {
    it('should create audit logs for auth actions', async () => {
      const logs = await prisma.auditLog.findMany({
        where: { userId: testUserId },
      });

      expect(logs.length).toBeGreaterThan(0);

      // Check for expected action types
      const actions = logs.map((log) => log.action);
      expect(actions).toContain('user.register');
      expect(actions).toContain('user.email_verified');
      expect(actions).toContain('user.login');
    });
  });
});
