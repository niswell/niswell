export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Auth errors
export const AuthErrors = {
  INVALID_CREDENTIALS: {
    statusCode: 401,
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  },
  MFA_REQUIRED: {
    statusCode: 403,
    code: 'MFA_REQUIRED',
    message: 'Multi-factor authentication required',
  },
  INVALID_MFA_CODE: {
    statusCode: 401,
    code: 'INVALID_MFA_CODE',
    message: 'Invalid MFA code',
  },
  ACCOUNT_NOT_FOUND: {
    statusCode: 404,
    code: 'ACCOUNT_NOT_FOUND',
    message: 'Account not found',
  },
  ACCOUNT_LOCKED: {
    statusCode: 423,
    code: 'ACCOUNT_LOCKED',
    message: 'Account is locked. Try again later.',
  },
  EMAIL_NOT_VERIFIED: {
    statusCode: 403,
    code: 'EMAIL_NOT_VERIFIED',
    message: 'Email not verified. Check your email for verification link.',
  },
  INVALID_TOKEN: {
    statusCode: 401,
    code: 'INVALID_TOKEN',
    message: 'Invalid or expired token',
  },
  UNAUTHORIZED: {
    statusCode: 401,
    code: 'UNAUTHORIZED',
    message: 'Unauthorized',
  },
  FORBIDDEN: {
    statusCode: 403,
    code: 'FORBIDDEN',
    message: 'Forbidden',
  },
  TOKEN_EXPIRED: {
    statusCode: 401,
    code: 'TOKEN_EXPIRED',
    message: 'Token expired',
  },
  SESSION_EXPIRED: {
    statusCode: 401,
    code: 'SESSION_EXPIRED',
    message: 'Session expired',
  },
  RATE_LIMIT_EXCEEDED: {
    statusCode: 429,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
  },
};

// Validation errors
export const ValidationErrors = {
  INVALID_EMAIL: {
    statusCode: 400,
    code: 'INVALID_EMAIL',
    message: 'Invalid email format',
  },
  WEAK_PASSWORD: {
    statusCode: 400,
    code: 'WEAK_PASSWORD',
    message: 'Password does not meet security requirements',
  },
  EMAIL_ALREADY_EXISTS: {
    statusCode: 409,
    code: 'EMAIL_ALREADY_EXISTS',
    message: 'Email already in use',
  },
  INVALID_INPUT: {
    statusCode: 400,
    code: 'INVALID_INPUT',
    message: 'Invalid input',
  },
};

// Server errors
export const ServerErrors = {
  INTERNAL_ERROR: {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  },
  DATABASE_ERROR: {
    statusCode: 500,
    code: 'DATABASE_ERROR',
    message: 'Database error',
  },
};

export function throwAuthError(errorKey: keyof typeof AuthErrors, details?: any): never {
  const error = AuthErrors[errorKey];
  throw new AppError(error.statusCode, error.code, error.message, details);
}

export function throwValidationError(errorKey: keyof typeof ValidationErrors, details?: any): never {
  const error = ValidationErrors[errorKey];
  throw new AppError(error.statusCode, error.code, error.message, details);
}

export function throwServerError(errorKey: keyof typeof ServerErrors, details?: any): never {
  const error = ServerErrors[errorKey];
  throw new AppError(error.statusCode, error.code, error.message, details);
}
