import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/password';
import { generateAccessToken, generateRefreshToken, TokenPayload } from '../utils/jwt';
import { generateTOTPSecret, verifyTOTPToken, verifyBackupCode, removeBackupCode } from '../utils/mfa';
import { AppError, AuthErrors, ValidationErrors, ServerErrors } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

export interface RegisterInput {
  email: string;
  password: string;
  confirmPassword: string;
  displayName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  ipAddress: string;
  userAgent: string;
}

export interface LoginResponse {
  userId: string;
  accessToken: string;
  refreshToken: string;
  mfaRequired?: boolean;
  mfaToken?: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<{ userId: string; emailVerificationToken: string }> {
    // Validate input
    if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      throw new AppError(
        ValidationErrors.INVALID_EMAIL.statusCode,
        ValidationErrors.INVALID_EMAIL.code,
        ValidationErrors.INVALID_EMAIL.message
      );
    }

    if (input.password !== input.confirmPassword) {
      throw new AppError(400, 'PASSWORD_MISMATCH', 'Passwords do not match');
    }

    const passwordValidation = validatePasswordStrength(input.password);
    if (!passwordValidation.valid) {
      throw new AppError(
        ValidationErrors.WEAK_PASSWORD.statusCode,
        ValidationErrors.WEAK_PASSWORD.code,
        'Password does not meet security requirements',
        { errors: passwordValidation.errors }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new AppError(
        ValidationErrors.EMAIL_ALREADY_EXISTS.statusCode,
        ValidationErrors.EMAIL_ALREADY_EXISTS.code,
        ValidationErrors.EMAIL_ALREADY_EXISTS.message
      );
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        displayName: input.displayName || input.email.split('@')[0],
        accountState: 'pending', // Email verification required
      },
    });

    // Generate email verification token
    const emailVerificationToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        email: user.email,
        token: emailVerificationToken,
        expiresAt,
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'user.register',
        resource: 'user',
        resourceId: user.id,
        status: 'success',
      },
    });

    return {
      userId: user.id,
      emailVerificationToken,
    };
  }

  async verifyEmail(token: string): Promise<void> {
    const verification = await prisma.emailVerification.findUnique({
      where: { token },
    });

    if (!verification) {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired email verification token');
    }

    if (new Date() > verification.expiresAt) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Email verification token has expired');
    }

    if (verification.usedAt) {
      throw new AppError(400, 'TOKEN_ALREADY_USED', 'Email verification token already used');
    }

    // Update user
    await prisma.user.update({
      where: { id: verification.userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        accountState: 'active',
      },
    });

    // Mark token as used
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: verification.userId,
        action: 'user.email_verified',
        resource: 'user',
        resourceId: verification.userId,
        status: 'success',
      },
    });
  }

  async login(input: LoginInput): Promise<LoginResponse> {
    // Check for rate limiting
    const recentAttempts = await prisma.loginAttempt.findMany({
      where: {
        email: input.email,
        createdAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
        },
      },
    });

    const failedAttempts = recentAttempts.filter((a: any) => !a.successful).length;
    if (failedAttempts >= 5) {
      await prisma.loginAttempt.create({
        data: {
          email: input.email,
          ipAddress: input.ipAddress,
          successful: false,
          reason: 'account_locked',
          userAgent: input.userAgent,
        },
      });

      throw new AppError(
        AuthErrors.ACCOUNT_LOCKED.statusCode,
        AuthErrors.ACCOUNT_LOCKED.code,
        AuthErrors.ACCOUNT_LOCKED.message
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      await prisma.loginAttempt.create({
        data: {
          email: input.email,
          ipAddress: input.ipAddress,
          successful: false,
          reason: 'invalid_credentials',
          userAgent: input.userAgent,
        },
      });

      throw new AppError(
        AuthErrors.INVALID_CREDENTIALS.statusCode,
        AuthErrors.INVALID_CREDENTIALS.code,
        AuthErrors.INVALID_CREDENTIALS.message
      );
    }

    // Check account status
    if (user.accountState === 'banned' || user.accountState === 'deleted') {
      throw new AppError(
        AuthErrors.FORBIDDEN.statusCode,
        AuthErrors.FORBIDDEN.code,
        `Account is ${user.accountState}`
      );
    }

    if (user.accountState === 'pending') {
      throw new AppError(
        AuthErrors.EMAIL_NOT_VERIFIED.statusCode,
        AuthErrors.EMAIL_NOT_VERIFIED.code,
        AuthErrors.EMAIL_NOT_VERIFIED.message
      );
    }

    // Verify password
    const passwordValid = await verifyPassword(input.password, user.passwordHash);

    if (!passwordValid) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: user.failedLoginAttempts + 1 },
      });

      if (user.failedLoginAttempts + 1 >= 5) {
        await prisma.user.update({
          where: { id: user.id },
          data: { accountLockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
        });
      }

      await prisma.loginAttempt.create({
        data: {
          email: input.email,
          ipAddress: input.ipAddress,
          successful: false,
          reason: 'invalid_password',
          userAgent: input.userAgent,
        },
      });

      throw new AppError(
        AuthErrors.INVALID_CREDENTIALS.statusCode,
        AuthErrors.INVALID_CREDENTIALS.code,
        AuthErrors.INVALID_CREDENTIALS.message
      );
    }

    // Check if account is locked
    if (user.accountLockedUntil && new Date() < user.accountLockedUntil) {
      throw new AppError(
        AuthErrors.ACCOUNT_LOCKED.statusCode,
        AuthErrors.ACCOUNT_LOCKED.code,
        AuthErrors.ACCOUNT_LOCKED.message
      );
    }

    // If MFA is enabled, return MFA token instead of session
    if (user.mfaEnabled) {
      // Generate temporary MFA token (shorter lived)
      const mfaToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        roles: user.roles.map((ur: any) => ur.role.name),
        sessionId: 'temp-mfa',
      });

      await prisma.loginAttempt.create({
        data: {
          email: input.email,
          ipAddress: input.ipAddress,
          successful: false, // Not fully successful yet
          reason: 'mfa_required',
          userAgent: input.userAgent,
        },
      });

      return {
        userId: user.id,
        accessToken: '', // Not provided until MFA verified
        refreshToken: '',
        mfaRequired: true,
        mfaToken,
      };
    }

    // Create session
    const sessionId = uuidv4();
    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshToken: generateRefreshToken({
          userId: user.id,
          email: user.email,
          roles: user.roles.map((ur: any) => ur.role.name),
          sessionId,
        }),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      roles: user.roles.map((ur: any) => ur.role.name),
      sessionId,
    });

    // Reset failed login attempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: input.ipAddress,
        lastLoginUserAgent: input.userAgent,
      },
    });

    // Log successful login
    await prisma.loginAttempt.create({
      data: {
        email: input.email,
        ipAddress: input.ipAddress,
        successful: true,
        userAgent: input.userAgent,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'user.login',
        resource: 'session',
        resourceId: sessionId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        status: 'success',
      },
    });

    return {
      userId: user.id,
      accessToken,
      refreshToken: session.refreshToken,
    };
  }

  async verifyMFA(userId: string, mfaCode: string, ipAddress: string, userAgent: string): Promise<LoginResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      throw new AppError(
        AuthErrors.ACCOUNT_NOT_FOUND.statusCode,
        AuthErrors.ACCOUNT_NOT_FOUND.code,
        AuthErrors.ACCOUNT_NOT_FOUND.message
      );
    }

    if (!user.mfaEnabled || !user.totpSecret) {
      throw new AppError(400, 'MFA_NOT_ENABLED', 'MFA is not enabled for this account');
    }

    // Check if it's a backup code
    let isValid = false;
    let isBackupCode = false;

    if (mfaCode.length === 8 && user.backupCodes.includes(mfaCode.toUpperCase())) {
      isValid = true;
      isBackupCode = true;
    } else if (mfaCode.length === 6 && verifyTOTPToken(user.totpSecret, mfaCode)) {
      isValid = true;
    }

    if (!isValid) {
      throw new AppError(
        AuthErrors.INVALID_MFA_CODE.statusCode,
        AuthErrors.INVALID_MFA_CODE.code,
        AuthErrors.INVALID_MFA_CODE.message
      );
    }

    // If backup code, remove it
    if (isBackupCode) {
      const updatedCodes = removeBackupCode(mfaCode, user.backupCodes);
      await prisma.user.update({
        where: { id: user.id },
        data: { backupCodes: updatedCodes },
      });
    }

    // Create session
    const sessionId = uuidv4();
    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshToken: generateRefreshToken({
          userId: user.id,
          email: user.email,
          roles: user.roles.map((ur: any) => ur.role.name),
          sessionId,
        }),
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      roles: user.roles.map((ur: any) => ur.role.name),
      sessionId,
    });

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        lastLoginUserAgent: userAgent,
      },
    });

    // Log MFA verification
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'user.mfa_verified',
        resource: 'session',
        resourceId: sessionId,
        ipAddress,
        userAgent,
        status: 'success',
      },
    });

    return {
      userId: user.id,
      accessToken,
      refreshToken: session.refreshToken,
    };
  }

  async setupMFA(userId: string): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(
        AuthErrors.ACCOUNT_NOT_FOUND.statusCode,
        AuthErrors.ACCOUNT_NOT_FOUND.code,
        AuthErrors.ACCOUNT_NOT_FOUND.message
      );
    }

    return generateTOTPSecret(user.email);
  }

  async confirmMFASetup(userId: string, mfaCode: string, secret: string, backupCodes: string[]): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(
        AuthErrors.ACCOUNT_NOT_FOUND.statusCode,
        AuthErrors.ACCOUNT_NOT_FOUND.code,
        AuthErrors.ACCOUNT_NOT_FOUND.message
      );
    }

    // Verify MFA code
    if (!verifyTOTPToken(secret, mfaCode)) {
      throw new AppError(
        AuthErrors.INVALID_MFA_CODE.statusCode,
        AuthErrors.INVALID_MFA_CODE.code,
        AuthErrors.INVALID_MFA_CODE.message
      );
    }

    // Enable MFA
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        totpSecret: secret,
        backupCodes,
      },
    });

    // Log MFA enablement
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'user.mfa_enabled',
        resource: 'user',
        resourceId: userId,
        status: 'success',
      },
    });
  }

  async logout(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });

    if (!session || session.revokedAt || new Date() > session.expiresAt) {
      throw new AppError(
        AuthErrors.INVALID_TOKEN.statusCode,
        AuthErrors.INVALID_TOKEN.code,
        AuthErrors.INVALID_TOKEN.message
      );
    }

    const accessToken = generateAccessToken({
      userId: session.user.id,
      email: session.user.email,
      roles: session.user.roles.map((ur: any) => ur.role.name),
      sessionId: session.id,
    });

    return { accessToken };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(
        AuthErrors.ACCOUNT_NOT_FOUND.statusCode,
        AuthErrors.ACCOUNT_NOT_FOUND.code,
        AuthErrors.ACCOUNT_NOT_FOUND.message
      );
    }

    // Verify current password
    const passwordValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordValid) {
      throw new AppError(
        AuthErrors.INVALID_CREDENTIALS.statusCode,
        AuthErrors.INVALID_CREDENTIALS.code,
        'Current password is incorrect'
      );
    }

    // Validate new password
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      throw new AppError(
        ValidationErrors.WEAK_PASSWORD.statusCode,
        ValidationErrors.WEAK_PASSWORD.code,
        'Password does not meet security requirements',
        { errors: passwordValidation.errors }
      );
    }

    // Hash and update
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
      },
    });

    // Revoke all existing sessions for security
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Log password change
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'user.password_changed',
        resource: 'user',
        resourceId: userId,
        status: 'success',
      },
    });
  }
}

export const authService = new AuthService();
