# Phase 1: Authentication System Setup

Production-grade authentication system for Adult Live Platform with email/password, TOTP MFA, JWT tokens, and security controls.

## 📋 Project Structure

```
src/
├── app.ts                      # Express application setup
├── server.ts                   # Server entry point
├── utils/
│   ├── password.ts            # Password hashing & validation (Argon2id)
│   ├── jwt.ts                 # JWT token generation & verification
│   ├── mfa.ts                 # MFA (TOTP) utilities
│   └── errors.ts              # Error definitions
├── middleware/
│   └── auth.ts                # Authentication & authorization middleware
├── services/
│   └── auth.service.ts        # Authentication business logic
├── routes/
│   └── auth.routes.ts         # API endpoints
├── lib/
│   └── prisma.ts              # Prisma client
└── __tests__/
    └── auth.integration.test.ts # Integration tests

prisma/
└── schema.prisma              # PostgreSQL database schema
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
# Edit .env with your values:
# - DATABASE_URL: PostgreSQL connection string
# - JWT_SECRET: Strong random secret for token signing
```

### 3. Setup Database

```bash
# Create/migrate database schema
npm run db:push

# Or use migrations:
npm run db:migrate
```

### 4. Start Development Server

```bash
npm run dev
```

Server runs on `http://localhost:3000`

## 🔐 API Endpoints

### Authentication

**POST /api/auth/register**
Register a new user account
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!@#",
  "confirmPassword": "SecurePassword123!@#",
  "displayName": "John Doe"
}
```

Response:
```json
{
  "message": "Registration successful. Please verify your email.",
  "userId": "user-id"
}
```

---

**POST /api/auth/verify-email**
Verify email address
```json
{
  "token": "email-verification-token"
}
```

Response:
```json
{
  "message": "Email verified successfully. You can now login."
}
```

---

**POST /api/auth/login**
Login with credentials
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!@#"
}
```

Response (without MFA):
```json
{
  "userId": "user-id",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "message": "Login successful"
}
```

Response (with MFA enabled):
```json
{
  "mfaRequired": true,
  "mfaToken": "eyJhbGc...",
  "message": "MFA code required..."
}
```

---

**POST /api/auth/mfa/verify**
Verify MFA code
```json
{
  "userId": "user-id",
  "mfaToken": "mfa-token-from-login",
  "mfaCode": "123456"  // 6-digit TOTP or 8-char backup code
}
```

Response:
```json
{
  "userId": "user-id",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "message": "MFA verification successful"
}
```

---

**POST /api/auth/mfa/setup**
Initiate MFA setup (requires auth)
```bash
curl -X POST http://localhost:3000/api/auth/mfa/setup \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

Response:
```json
{
  "secret": "JBSWY3DPEBLW64TMMQ======",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": ["ABCD1234", "EFGH5678", ...],
  "message": "MFA setup initiated..."
}
```

---

**POST /api/auth/mfa/confirm**
Confirm MFA setup (requires auth)
```json
{
  "mfaCode": "123456",
  "secret": "JBSWY3DPEBLW64TMMQ======",
  "backupCodes": ["ABCD1234", "EFGH5678", ...]
}
```

Response:
```json
{
  "message": "MFA enabled successfully. Save your backup codes..."
}
```

---

**POST /api/auth/refresh**
Get new access token
```json
{
  "refreshToken": "refresh-token"
}
```

Response:
```json
{
  "accessToken": "new-eyJhbGc...",
  "message": "Token refreshed successfully"
}
```

---

**POST /api/auth/logout**
Revoke current session (requires auth)
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

Response:
```json
{
  "message": "Logged out successfully"
}
```

---

**POST /api/auth/password/change**
Change password (requires auth)
```json
{
  "currentPassword": "CurrentPassword123!@#",
  "newPassword": "NewPassword123!@#",
  "confirmNewPassword": "NewPassword123!@#"
}
```

Response:
```json
{
  "message": "Password changed successfully. All existing sessions revoked."
}
```

---

**GET /api/auth/me**
Get current user info (requires auth)
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

Response:
```json
{
  "userId": "user-id",
  "email": "user@example.com",
  "roles": ["user", "creator"]
}
```

---

**GET /health**
Health check
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "environment": "development"
}
```

## 🔒 Security Features

✅ **Password Security**
- Argon2id hashing (memory-hard algorithm)
- Password strength validation (12+ chars, uppercase, lowercase, numbers, special chars)
- Common pattern detection
- Constant-time comparison

✅ **MFA**
- TOTP (Time-based One-Time Password) support
- 10 backup codes for account recovery
- QR code generation for authenticator apps
- Window tolerance (±2 time steps)

✅ **Session Management**
- JWT tokens with short expiry (15 min access, 7 days refresh)
- Session revocation capability
- Device tracking
- Last activity monitoring

✅ **Rate Limiting**
- Global rate limiting (100 requests/15 min)
- Login attempt limiting (5 failures = 15 min lockout)
- Per-IP and per-user tracking

✅ **Account Protection**
- Email verification required
- Account state enforcement (pending, active, restricted, suspended, banned)
- Failed login tracking
- Automatic account lockout after 5 failed attempts

✅ **Audit Logging**
- All auth actions logged
- IP address and user agent tracking
- Compliance-ready audit trail
- Action timestamps

✅ **Data Protection**
- CORS validation
- Helmet security headers
- Input validation (Zod schemas)
- Error message redaction

## 🧪 Testing

Run all tests:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

Coverage report:
```bash
npm run test:coverage
```

### Test Scenarios Covered

- ✅ User registration with validation
- ✅ Email verification flow
- ✅ Login with correct/incorrect credentials
- ✅ Account lockout after failed attempts
- ✅ MFA setup and verification
- ✅ Backup code usage
- ✅ Password change
- ✅ Session management
- ✅ Token refresh
- ✅ Logout
- ✅ Audit logging

## 📊 Database Schema

### Key Tables

**users**
- Account credentials and profile
- Account state and security flags
- MFA configuration
- Email verification status
- Login attempt tracking

**sessions**
- Active user sessions
- JWT token storage
- Device and IP tracking
- Expiry and revocation

**roles**
- Role definitions
- Permission associations

**permissions**
- Resource-based permissions
- Action-based access control

**audit_logs**
- All user actions logged
- IP addresses and user agents
- Change tracking
- Timestamps

**password_resets & email_verifications**
- Secure token storage
- Token expiry
- Single-use enforcement

## 🔧 Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/adult_platform

# JWT
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Server
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Security
ARGON2_MEMORY=65540
ARGON2_TIME=3
ARGON2_PARALLELISM=4
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Login Protection
LOGIN_ATTEMPT_LIMIT=5
LOGIN_ATTEMPT_WINDOW_MS=900000
LOGIN_LOCKOUT_DURATION_MS=900000
```

## 🐳 Docker Setup (Optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Build and run:
```bash
docker build -t adult-platform-auth .
docker run -p 3000:3000 --env-file .env adult-platform-auth
```

## 📝 Next Steps

After Phase 1 is complete:

1. **Phase 2:** User Profiles & Creator Onboarding
   - Viewer profile management
   - Creator application workflow
   - Verification status tracking

2. **Phase 3:** Payments & Wallet System
   - Credit purchase and wallet
   - Immutable ledger
   - Tip system
   - Payouts

3. **Phase 4:** Live Streaming
   - Stream management
   - Real-time chat
   - Private sessions

4. **Phase 5:** Moderation & Admin
   - Content moderation
   - Admin console
   - Compliance tools

## 🐛 Troubleshooting

### Database Connection Error
- Ensure PostgreSQL is running
- Check DATABASE_URL format
- Verify credentials

### Token Verification Failing
- Verify JWT_SECRET is consistent
- Check token expiry
- Ensure Authorization header format: `Bearer TOKEN`

### MFA Code Not Working
- Verify device time is synchronized
- Try a different code (they change every 30s)
- Use backup codes if TOTP fails

### Rate Limiting Issues
- Check RATE_LIMIT_WINDOW_MS
- Verify client IP is correctly detected
- Check X-Forwarded-For header if behind proxy

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Argon2 Documentation](https://github.com/P-H-C/phc-winner-argon2)

## ✅ Production Checklist

Before deploying to production:

- [ ] Change all environment variables and secrets
- [ ] Enable HTTPS only (redirect HTTP to HTTPS)
- [ ] Set up proper logging and monitoring
- [ ] Run security audit / penetration test
- [ ] Setup backup and disaster recovery
- [ ] Configure rate limiting appropriately
- [ ] Setup email delivery for verification tokens
- [ ] Setup metrics and alerting
- [ ] Test all error scenarios
- [ ] Document runbooks for incident response
- [ ] Setup CI/CD pipeline
- [ ] Enable database replication/failover

---

**Generated by Claude Code**
**Adult Live Platform Phase 1 - Authentication System**
**Version 1.0 - October 2024**
