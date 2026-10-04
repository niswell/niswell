import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export interface TOTPSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export async function generateTOTPSecret(email: string): Promise<TOTPSetup> {
  const secret = speakeasy.generateSecret({
    name: `Adult Live Platform (${email})`,
    issuer: 'Adult Live Platform',
    length: 32,
  });

  if (!secret.base32) {
    throw new Error('Failed to generate TOTP secret');
  }

  // Generate QR code
  const qrCode = await QRCode.toDataURL(secret.otpauth_url || '');

  // Generate backup codes
  const backupCodes = generateBackupCodes(10);

  return {
    secret: secret.base32,
    qrCode,
    backupCodes,
  };
}

export function verifyTOTPToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2, // Allow 2 windows of time drift
  });
}

export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase()
      .padEnd(8, '0');
    codes.push(code);
  }

  return codes;
}

export function verifyBackupCode(code: string, backupCodes: string[]): boolean {
  return backupCodes.includes(code.toUpperCase());
}

export function removeBackupCode(code: string, backupCodes: string[]): string[] {
  return backupCodes.filter((c) => c !== code.toUpperCase());
}

export function validateMFACode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function validateBackupCode(code: string): boolean {
  return /^[A-Z0-9]{8}$/.test(code);
}
