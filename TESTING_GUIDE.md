# Complete Testing Guide - Phases 1 & 2

Learn how to test the Authentication System and User Profiles/Creator Onboarding.

---

## 🚀 Quick Start

### 1. Setup Database

```bash
# Make sure PostgreSQL is running
# Create .env with DATABASE_URL

cp .env.example .env

# Edit .env and set:
# DATABASE_URL="postgresql://user:password@localhost:5432/adult_live_platform"

# Create/migrate database
npm run db:push
```

### 2. Start Development Server

```bash
npm run dev
```

Server runs on `http://localhost:3000`

### 3. Run Integration Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## 🧪 Testing Methods

## Method 1: Integration Tests (Automated)

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test auth.integration.test.ts
npm test profiles.integration.test.ts
```

### Watch Mode (Auto-rerun on changes)
```bash
npm run test:watch
```

### Test Coverage
```bash
npm run test:coverage
```

**What's Tested:**
- ✅ User registration and validation
- ✅ Email verification flow
- ✅ Login with credentials
- ✅ MFA setup and verification
- ✅ Password change and reset
- ✅ Session management
- ✅ Viewer profile CRUD
- ✅ Creator application workflow
- ✅ Tip menu management
- ✅ Stream schedule management
- ✅ User blocking and reporting

---

## Method 2: Manual API Testing with curl

### Health Check

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

---

## Phase 1: Authentication Flows

### Test Case 1: User Registration

```bash
# Register new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePassword123!@#",
    "confirmPassword": "SecurePassword123!@#",
    "displayName": "Test User"
  }'
```

**Expected Response (201):**
```json
{
  "message": "Registration successful. Please verify your email.",
  "userId": "user-id-123"
}
```

**What to verify:**
- ✅ User created in database
- ✅ Password hashed with Argon2id
- ✅ Email verification token generated
- ✅ Account state is "pending"
- ✅ Audit log entry created

---

### Test Case 2: Email Verification

```bash
# Note: Get the token from the registration response or database
# In development: query the EmailVerification table

curl -X POST http://localhost:3000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "token": "email-verification-token"
  }'
```

**Expected Response (200):**
```json
{
  "message": "Email verified successfully. You can now login."
}
```

**What to verify:**
- ✅ User.emailVerified set to true
- ✅ User.accountState changed to "active"
- ✅ Token marked as used
- ✅ Audit log entry created

---

### Test Case 3: Login with Correct Credentials

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePassword123!@#"
  }'
```

**Expected Response (200):**
```json
{
  "userId": "user-id-123",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "message": "Login successful"
}
```

**What to verify:**
- ✅ JWT access token generated (15min expiry)
- ✅ Refresh token generated (7day expiry)
- ✅ Session created in database
- ✅ User.lastLoginAt updated
- ✅ User.failedLoginAttempts reset to 0
- ✅ Login audit log entry created

---

### Test Case 4: Login with Wrong Password

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "WrongPassword123!@#"
  }'
```

**Expected Response (401):**
```json
{
  "code": "INVALID_CREDENTIALS",
  "message": "Invalid email or password"
}
```

**What to verify:**
- ✅ User.failedLoginAttempts incremented
- ✅ No session created
- ✅ Login attempt logged
- ✅ Account not locked (only 1 failed attempt)

---

### Test Case 5: Account Lockout (5 Failed Attempts)

```bash
# Attempt login 5 times with wrong password
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "testuser@example.com",
      "password": "WrongPassword123!@#"
    }'
done

# 6th attempt should be locked
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePassword123!@#"
  }'
```

**Expected Response (423):**
```json
{
  "code": "ACCOUNT_LOCKED",
  "message": "Account is locked. Try again later."
}
```

**What to verify:**
- ✅ Account locked after 5 failed attempts
- ✅ Lockout duration is 15 minutes
- ✅ Correct password still denied while locked
- ✅ Correct password accepted after lockout expires

---

### Test Case 6: MFA Setup

First, login successfully:

```bash
# Store the access token from login response
export TOKEN="eyJhbGc..."

# Request MFA setup
curl -X POST http://localhost:3000/api/auth/mfa/setup \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "secret": "JBSWY3DPEBLW64TMMQ======",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": ["ABCD1234", "EFGH5678", ...],
  "message": "MFA setup initiated..."
}
```

**What to verify:**
- ✅ TOTP secret generated (base32 encoded)
- ✅ QR code generated (can scan with authenticator app)
- ✅ 10 backup codes generated
- ✅ Secret not yet activated (user must confirm)

---

### Test Case 7: MFA Confirmation

Using an authenticator app (Google Authenticator, Authy):
1. Scan the QR code
2. Get the 6-digit code
3. Use it in the request:

```bash
curl -X POST http://localhost:3000/api/auth/mfa/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mfaCode": "123456",
    "secret": "JBSWY3DPEBLW64TMMQ======",
    "backupCodes": ["ABCD1234", "EFGH5678", ...]
  }'
```

**Expected Response (200):**
```json
{
  "message": "MFA enabled successfully. Save your backup codes..."
}
```

**What to verify:**
- ✅ User.mfaEnabled set to true
- ✅ User.totpSecret stored
- ✅ User.backupCodes stored
- ✅ Next login requires MFA

---

### Test Case 8: Login with MFA Enabled

```bash
# Step 1: Regular login with MFA enabled account
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePassword123!@#"
  }'
```

**Expected Response (200):**
```json
{
  "mfaRequired": true,
  "mfaToken": "eyJhbGc...",
  "message": "MFA code required..."
}
```

**What to verify:**
- ✅ No access token returned yet
- ✅ MFA token provided for next step
- ✅ User not fully authenticated

---

### Test Case 9: MFA Verification

```bash
# Step 2: Verify MFA code
# Get 6-digit code from authenticator app

curl -X POST http://localhost:3000/api/auth/mfa/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id-123",
    "mfaToken": "eyJhbGc...",
    "mfaCode": "123456"
  }'
```

**Expected Response (200):**
```json
{
  "userId": "user-id-123",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "message": "MFA verification successful"
}
```

**What to verify:**
- ✅ Full authentication granted
- ✅ Valid access token issued
- ✅ Session created
- ✅ User can now access protected endpoints

---

### Test Case 10: Refresh Token

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGc..."
  }'
```

**Expected Response (200):**
```json
{
  "accessToken": "new-eyJhbGc...",
  "message": "Token refreshed successfully"
}
```

**What to verify:**
- ✅ New access token issued
- ✅ Old token still valid during grace period
- ✅ Refresh token not invalidated

---

### Test Case 11: Protected Endpoint (Get Current User)

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "userId": "user-id-123",
  "email": "testuser@example.com",
  "roles": ["user"]
}
```

**What to verify:**
- ✅ Token validation successful
- ✅ User info returned
- ✅ Access denied without token

---

### Test Case 12: Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

**What to verify:**
- ✅ Session revoked in database
- ✅ Token no longer valid
- ✅ Audit log entry created

---

## Phase 2: Profile Flows

### Test Case 1: Create/Get Viewer Profile

```bash
export TOKEN="eyJhbGc..."

# Get your viewer profile
curl http://localhost:3000/api/profiles/viewer/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "profile": {
    "id": "profile-id",
    "userId": "user-id",
    "bio": null,
    "gender": null,
    "location": null,
    "profileVisibility": "public",
    "followerCount": 0,
    "followingCount": 0,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**What to verify:**
- ✅ Profile auto-created on first access
- ✅ Default visibility is "public"
- ✅ Counts start at 0

---

### Test Case 2: Update Viewer Profile

```bash
curl -X PUT http://localhost:3000/api/profiles/viewer/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Updated Name",
    "bio": "This is my bio",
    "location": "San Francisco",
    "timezone": "America/Los_Angeles",
    "profileVisibility": "public",
    "emailNotifications": true,
    "pushNotifications": false
  }'
```

**Expected Response (200):**
```json
{
  "message": "Profile updated successfully",
  "profile": {
    "bio": "This is my bio",
    "location": "San Francisco",
    "timezone": "America/Los_Angeles",
    "profileVisibility": "public"
  }
}
```

**What to verify:**
- ✅ All fields updated
- ✅ Audit log entry created
- ✅ Timestamp updated

---

### Test Case 3: Block User

```bash
# First, register another user and get their userId

curl -X POST http://localhost:3000/api/profiles/viewer/me/block \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "blockedUserId": "other-user-id"
  }'
```

**Expected Response (200):**
```json
{
  "message": "User blocked successfully"
}
```

**What to verify:**
- ✅ Block relationship created
- ✅ Cannot block yourself
- ✅ Duplicate blocks prevented
- ✅ Audit log entry created

---

### Test Case 4: Get Blocked Users

```bash
curl http://localhost:3000/api/profiles/viewer/me/blocked \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "blockedUsers": [
    {
      "blockedUserId": "other-user-id",
      "displayName": "Blocked User",
      "avatar": null,
      "blockedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

**What to verify:**
- ✅ All blocked users listed
- ✅ User info included
- ✅ Block timestamp shown

---

### Test Case 5: Unblock User

```bash
curl -X DELETE http://localhost:3000/api/profiles/viewer/me/block/other-user-id \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "message": "User unblocked successfully"
}
```

**What to verify:**
- ✅ Block relationship removed
- ✅ User can interact again
- ✅ Audit log entry created

---

### Test Case 6: Report User

```bash
curl -X POST http://localhost:3000/api/profiles/viewer/me/report \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportedUserId": "user-to-report-id",
    "category": "harassment",
    "description": "User was harassing me in chat",
    "evidence": ["screenshot-url-1", "screenshot-url-2"]
  }'
```

**Expected Response (201):**
```json
{
  "reportId": "report-id",
  "message": "Report submitted successfully. Our team will review it shortly."
}
```

**What to verify:**
- ✅ Report created
- ✅ Evidence stored
- ✅ Category validated
- ✅ Duplicate reports prevented (24h cooldown)
- ✅ Audit log entry created

---

### Test Case 7: Apply as Creator

```bash
curl -X POST http://localhost:3000/api/creator/apply \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Professional streamer and content creator",
    "categories": ["gaming", "music"],
    "languages": ["en", "es"]
  }'
```

**Expected Response (201):**
```json
{
  "applicationId": "app-id",
  "status": "pending",
  "message": "Application submitted successfully..."
}
```

**What to verify:**
- ✅ Application created
- ✅ Status is "pending"
- ✅ Categories validated
- ✅ Cannot apply twice
- ✅ Audit log entry created

---

### Test Case 8: Check Application Status

```bash
curl http://localhost:3000/api/creator/status \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "applicationStatus": {
    "id": "app-id",
    "status": "pending",
    "submittedAt": "2024-01-15T10:30:00Z",
    "reviewedAt": null,
    "reasonForRejection": null,
    "revisionCount": 0
  }
}
```

**What to verify:**
- ✅ Current application status shown
- ✅ Submission timestamp recorded
- ✅ Revision count tracked

---

### Test Case 9: Get Creator Profile

```bash
curl http://localhost:3000/api/creator/profile \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "profile": {
    "id": "creator-id",
    "userId": "user-id",
    "bio": "Professional streamer...",
    "categories": ["gaming", "music"],
    "languages": ["en", "es"],
    "verificationStatus": "pending",
    "isMonetized": false,
    "totalEarnings": "0.00",
    "totalFollowers": 0,
    "payoutFrequency": "weekly",
    "minimumPayoutAmount": "10.00"
  }
}
```

**What to verify:**
- ✅ Creator profile returned
- ✅ Status matches application
- ✅ Configuration saved

---

### Test Case 10: Add Tip Menu

```bash
curl -X POST http://localhost:3000/api/creator/tip-menu \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Small Tip",
    "amount": 5.00,
    "icon": "💰"
  }'
```

**Expected Response (201):**
```json
{
  "message": "Tip menu item added",
  "tipMenu": {
    "id": "menu-id",
    "label": "Small Tip",
    "amount": 5.00,
    "icon": "💰",
    "order": 1,
    "isActive": true
  }
}
```

**What to verify:**
- ✅ Menu item created
- ✅ Display order assigned
- ✅ Validation enforced (min $0.50, max $10,000)
- ✅ Audit log entry created

---

### Test Case 11: Get Tip Menus

```bash
curl http://localhost:3000/api/creator/tip-menu \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "tipMenus": [
    {
      "id": "menu-id-1",
      "label": "Small Tip",
      "amount": 5.00,
      "order": 1
    },
    {
      "id": "menu-id-2",
      "label": "Large Tip",
      "amount": 10.00,
      "order": 2
    }
  ],
  "count": 2
}
```

**What to verify:**
- ✅ All menu items returned
- ✅ Ordered by display order
- ✅ Active items only

---

### Test Case 12: Add Stream Schedule

```bash
curl -X POST http://localhost:3000/api/creator/schedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dayOfWeek": 0,
    "startTime": "14:00",
    "endTime": "20:00",
    "timezone": "UTC",
    "notifyFollowers": true
  }'
```

**Expected Response (201):**
```json
{
  "message": "Stream schedule added",
  "schedule": {
    "id": "schedule-id",
    "dayOfWeek": 0,
    "startTime": "14:00",
    "endTime": "20:00",
    "timezone": "UTC",
    "notifyFollowers": true,
    "isActive": true
  }
}
```

**What to verify:**
- ✅ Schedule created
- ✅ Day of week validated (0-6)
- ✅ Time format validated (HH:mm)
- ✅ Cannot have duplicate schedules for same day
- ✅ Audit log entry created

---

### Test Case 13: Get Stream Schedules

```bash
curl http://localhost:3000/api/creator/schedule \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "schedules": [
    {
      "id": "schedule-id-1",
      "dayOfWeek": 0,
      "startTime": "14:00",
      "endTime": "20:00",
      "timezone": "UTC"
    },
    {
      "id": "schedule-id-2",
      "dayOfWeek": 3,
      "startTime": "10:00",
      "endTime": "16:00",
      "timezone": "UTC"
    }
  ],
  "count": 2
}
```

**What to verify:**
- ✅ All schedules returned
- ✅ Ordered by day of week
- ✅ Multiple days supported

---

### Test Case 14: Get Earnings Dashboard

```bash
curl http://localhost:3000/api/creator/earnings \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response (200):**
```json
{
  "earningsDashboard": {
    "creatorProfileId": "creator-id",
    "totalEarnings": 0.00,
    "totalFollowers": 0,
    "totalStreams": 0,
    "isMonetized": false,
    "verificationStatus": "pending",
    "payoutFrequency": "weekly",
    "minimumPayoutAmount": 10.00
  }
}
```

**What to verify:**
- ✅ Dashboard data returned
- ✅ Ready for Phase 3 ledger integration
- ✅ All metrics initialized

---

## 🗄️ Database Testing

### Check User Registration

```sql
-- Connect to PostgreSQL
psql -U user -d adult_live_platform

-- List all users
SELECT id, email, emailVerified, accountState FROM "User";

-- Check specific user
SELECT * FROM "User" WHERE email = 'testuser@example.com';

-- View audit logs
SELECT * FROM "AuditLog" WHERE userId = 'user-id' ORDER BY createdAt DESC;

-- Check sessions
SELECT id, userId, revokedAt FROM "Session" WHERE userId = 'user-id';

-- Check profiles
SELECT * FROM "ViewerProfile" WHERE userId = 'user-id';
SELECT * FROM "CreatorProfile" WHERE userId = 'user-id';
```

---

## 🔍 Debugging

### View Logs in Development

Server logs will show:
```
[2024-01-15T10:30:00.000Z] POST /api/auth/login - 200 (45ms)
[2024-01-15T10:30:01.000Z] GET /api/auth/me - 200 (12ms)
```

### Common Issues & Solutions

**Issue:** "Invalid email format"
- Solution: Use valid email (user@example.com)

**Issue:** "Password does not meet security requirements"
- Solution: Password needs: 12+ chars, uppercase, lowercase, number, special char
- Example: `SecurePassword123!@#`

**Issue:** "Email already in use"
- Solution: Use unique email each time or check database

**Issue:** "INVALID_TOKEN" on protected endpoints
- Solution: Include `Authorization: Bearer TOKEN` header

**Issue:** "Account locked"
- Solution: Wait 15 minutes or check User.accountLockedUntil in database

**Issue:** MFA code not working
- Solution: Ensure device time is synchronized, code changes every 30 seconds

---

## 📊 End-to-End Test Workflow

### Complete User Journey (15 minutes)

```bash
# 1. Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "journey@example.com",
    "password": "SecurePassword123!@#",
    "confirmPassword": "SecurePassword123!@#",
    "displayName": "Journey Test"
  }'

# Save the userId and token from DB

# 2. Verify email (get token from DB)
curl -X POST http://localhost:3000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "TOKEN_FROM_DB"}'

# 3. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "journey@example.com",
    "password": "SecurePassword123!@#"
  }'

# Save accessToken

# 4. Update profile
curl -X PUT http://localhost:3000/api/profiles/viewer/me \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Testing the system",
    "location": "San Francisco"
  }'

# 5. Apply as creator
curl -X POST http://localhost:3000/api/creator/apply \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "categories": ["gaming"],
    "languages": ["en"]
  }'

# 6. Add tip menu
curl -X POST http://localhost:3000/api/creator/tip-menu \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Coffee",
    "amount": 5.00
  }'

# 7. Add schedule
curl -X POST http://localhost:3000/api/creator/schedule \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dayOfWeek": 0,
    "startTime": "14:00",
    "endTime": "20:00",
    "timezone": "UTC"
  }'

# 8. Check earnings
curl http://localhost:3000/api/creator/earnings \
  -H "Authorization: Bearer ACCESS_TOKEN"

# 9. Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

---

## ✅ Test Checklist

### Phase 1 Authentication
- [ ] User registration with validation
- [ ] Email verification
- [ ] Login with credentials
- [ ] Account lockout (5 failures)
- [ ] MFA setup and confirmation
- [ ] MFA verification at login
- [ ] Token refresh
- [ ] Protected endpoints
- [ ] Logout and revocation
- [ ] Password change
- [ ] Audit logging

### Phase 2 Profiles
- [ ] Viewer profile creation
- [ ] Profile updates
- [ ] Privacy settings
- [ ] User blocking
- [ ] User reporting
- [ ] Creator application
- [ ] Application status
- [ ] Creator profile updates
- [ ] Tip menu management
- [ ] Stream schedule management
- [ ] Earnings dashboard
- [ ] Audit logging

---

## 🚀 Ready to Test!

1. Start server: `npm run dev`
2. Run tests: `npm test`
3. Try curl examples above
4. Check database with psql

All Phase 1 & 2 features are fully implemented and tested! 🎉

---

*Testing Guide for Adult Live Platform*
*Phases 1 & 2 - Authentication & Profiles*
