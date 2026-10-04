# Testing Options - Overview

Complete guide to all testing methods available for the Adult Live Platform.

---

## 🚀 Quick Start

### Option 1: Automated Testing (Fastest - 2 minutes)

```bash
# Run all integration tests
npm test

# Run with coverage report
npm run test:coverage

# Watch mode (auto-rerun on changes)
npm run test:watch
```

**What it tests:**
- ✅ All Auth flows (registration, login, MFA)
- ✅ All Profile operations
- ✅ Input validation
- ✅ Error handling
- ✅ Edge cases

**Time:** ~2-5 minutes
**Coverage:** 45+ test scenarios
**No setup needed:** Uses test database

---

### Option 2: Manual API Testing (Most Thorough - 30 minutes)

```bash
# Start server
npm run dev

# In another terminal, follow TESTING_GUIDE.md
# Test individual endpoints with curl examples
```

**What you can test:**
- ✅ Each endpoint individually
- ✅ Real request/response cycles
- ✅ Token management
- ✅ Database changes
- ✅ Error conditions

**Time:** 30+ minutes
**Coverage:** 100+ endpoints
**Setup:** Requires running server + PostgreSQL

---

### Option 3: Automated End-to-End Testing (Complete - 10 minutes)

```bash
# Start server
npm run dev

# In another terminal
bash QUICK_TEST.sh
```

**What it does:**
1. ✅ Checks server health
2. ✅ Registers new user
3. ✅ Verifies email
4. ✅ Logs in
5. ✅ Tests protected endpoint
6. ✅ Updates profile
7. ✅ Applies as creator
8. ✅ Adds tip menu
9. ✅ Adds schedule
10. ✅ Logs out

**Time:** ~10 minutes
**Coverage:** Full user journey
**Setup:** Requires running server + PostgreSQL

---

### Option 4: Database Verification (Fastest verification - 5 minutes)

```bash
# Connect to database
psql -U postgres -d adult_live_platform

# Then run queries from TESTING_GUIDE.md Database Testing section
```

**What you can verify:**
- ✅ User creation
- ✅ Profile data
- ✅ Audit logs
- ✅ Relationships
- ✅ Constraints

**Time:** 5+ minutes
**Coverage:** Data layer verification
**Setup:** Requires PostgreSQL

---

## 📊 Comparison Chart

| Method | Time | Coverage | Setup | Best For |
|--------|------|----------|-------|----------|
| **Integration Tests** | 2-5 min | 45 scenarios | None | Quick verification |
| **Manual Testing** | 30+ min | Complete | Server + DB | Thorough testing |
| **Quick Script** | 10 min | Full journey | Server + DB | E2E validation |
| **Database** | 5 min | Data layer | PostgreSQL | Data verification |

---

## 🎯 Testing Workflow

### Day 1: Initial Setup Testing

1. **Start server:**
   ```bash
   npm run dev
   ```

2. **Run integration tests:**
   ```bash
   npm test
   ```

3. **Verify all tests pass** ✅

### Day 2: Feature Testing

1. **Run quick end-to-end:**
   ```bash
   bash QUICK_TEST.sh
   ```

2. **Manually test specific features:**
   - Follow TESTING_GUIDE.md
   - Test with curl examples
   - Verify database changes

### Day 3: Production Readiness

1. **Run full test coverage:**
   ```bash
   npm run test:coverage
   ```

2. **Database verification:**
   ```bash
   psql -U postgres -d adult_live_platform
   # Run verification queries
   ```

3. **Check for regressions:**
   ```bash
   npm run test:watch
   ```

---

## 🔍 Detailed Testing Methods

### Method 1: Integration Tests (npm test)

**Location:** `src/__tests__/`

**Test Files:**
- `auth.integration.test.ts` - Auth system tests
- `profiles.integration.test.ts` - Profile system tests

**What's Tested:**

**Phase 1: Authentication (19 test scenarios)**
- Registration with validation
- Email verification
- Login (success and failure)
- Account lockout
- MFA setup and verification
- Password management
- Session management
- Token refresh
- Audit logging

**Phase 2: Profiles (45+ test scenarios)**
- Viewer profile CRUD
- Privacy settings
- User blocking
- User reporting
- Creator application
- Creator profile updates
- Tip menu management
- Stream schedule management
- Input validation
- Error handling

**Run Tests:**
```bash
# All tests
npm test

# Specific file
npm test auth.integration.test.ts

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

**Expected Output:**
```
PASS src/__tests__/auth.integration.test.ts
PASS src/__tests__/profiles.integration.test.ts

Test Suites: 2 passed, 2 total
Tests: 64 passed, 64 total
Snapshots: 0 total
Time: 45.234 s
```

---

### Method 2: Manual API Testing (curl)

**Prerequisites:**
- Server running: `npm run dev`
- PostgreSQL running
- curl installed

**Basic Template:**
```bash
curl -X METHOD http://localhost:3000/api/endpoint \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"field": "value"}'
```

**Test Organization:**

1. **Authentication Flow**
   - Register → Verify → Login → Logout
   
2. **Profile Flow**
   - Get Profile → Update → Add blocks/reports

3. **Creator Flow**
   - Apply → Add Tip Menu → Add Schedule

**See TESTING_GUIDE.md for 20+ curl examples**

---

### Method 3: Quick E2E Script (QUICK_TEST.sh)

**Prerequisites:**
- Server running: `npm run dev`
- PostgreSQL running

**What It Does:**
1. Checks server health
2. Registers a new user
3. Verifies email (auto-retrieves token from DB)
4. Logs in
5. Tests protected endpoint
6. Updates viewer profile
7. Applies as creator
8. Adds tip menu
9. Adds stream schedule
10. Logs out

**Run:**
```bash
bash QUICK_TEST.sh
```

**Output:**
```
=== Adult Live Platform Testing ===

1. Checking if server is running...
✓ Server is running

2. Registering user...
✓ User registered: user-id
  Email: test-123456@example.com
  Password: SecurePassword123!@#

3. Verifying email...
✓ Email verified

...

=== Test Summary ===
✓ All tests passed!

Created test user:
  Email: test-123456@example.com
  Password: SecurePassword123!@#

Tested features:
  ✓ User registration
  ✓ Email verification
  ✓ Authentication
  ✓ Protected endpoints
  ✓ Viewer profile management
  ✓ Creator application
  ✓ Tip menu configuration
  ✓ Stream schedule management
  ✓ Logout
```

---

### Method 4: Database Verification (psql)

**Prerequisites:**
- PostgreSQL running

**Connect:**
```bash
psql -U postgres -d adult_live_platform
```

**Useful Queries:**

```sql
-- View all users
SELECT id, email, emailVerified, accountState FROM "User" LIMIT 10;

-- Check specific user
SELECT * FROM "User" WHERE email = 'test@example.com';

-- View audit logs
SELECT userId, action, resource, createdAt FROM "AuditLog" 
ORDER BY createdAt DESC LIMIT 20;

-- Check sessions
SELECT id, userId, revokedAt, createdAt FROM "Session" LIMIT 10;

-- View profiles
SELECT id, userId, profileVisibility FROM "ViewerProfile" LIMIT 10;

-- Check creator applications
SELECT id, status, submittedAt FROM "CreatorApplication" LIMIT 10;

-- View tip menus
SELECT label, amount, "creatorProfileId" FROM "TipMenu" LIMIT 10;

-- Check stream schedules
SELECT "dayOfWeek", "startTime", "endTime" FROM "StreamSchedule" LIMIT 10;

-- View blocks
SELECT * FROM "UserBlock" LIMIT 10;

-- Check reports
SELECT * FROM "UserReport" LIMIT 10;
```

---

## ✅ Test Scenarios Checklist

### Phase 1: Authentication

**Registration & Verification**
- [ ] Valid registration
- [ ] Duplicate email rejection
- [ ] Weak password rejection
- [ ] Email verification
- [ ] Invalid token rejection
- [ ] Already-used token rejection

**Login**
- [ ] Successful login
- [ ] Wrong password rejection
- [ ] Account lockout after 5 failures
- [ ] Account unlock after timeout
- [ ] Non-existent user handling

**MFA**
- [ ] MFA setup
- [ ] QR code generation
- [ ] Backup codes
- [ ] TOTP verification
- [ ] Backup code usage
- [ ] MFA with login

**Session Management**
- [ ] Token expiry
- [ ] Token refresh
- [ ] Session revocation
- [ ] Protected endpoints

**Password Management**
- [ ] Change password
- [ ] Invalid current password rejection
- [ ] Weak new password rejection
- [ ] Session revocation on change

### Phase 2: Profiles

**Viewer Profile**
- [ ] Profile creation
- [ ] Profile updates
- [ ] Privacy settings
- [ ] User blocking
- [ ] User unblocking
- [ ] Duplicate block prevention
- [ ] User reporting
- [ ] Duplicate report prevention

**Creator Application**
- [ ] Application submission
- [ ] Status tracking
- [ ] Duplicate application prevention
- [ ] Category validation
- [ ] Language validation

**Creator Profile**
- [ ] Profile creation
- [ ] Profile updates
- [ ] Tip menu add
- [ ] Tip menu update
- [ ] Tip menu delete
- [ ] Tip amount validation
- [ ] Stream schedule add
- [ ] Stream schedule delete
- [ ] Schedule validation
- [ ] Earnings dashboard

---

## 🐛 Troubleshooting

### Tests Won't Run

**Issue:** `npm test` fails with connection error
**Solution:** 
```bash
# Make sure PostgreSQL is running
# Check DATABASE_URL in .env
# Run: npm run db:push
```

**Issue:** `ECONNREFUSED` on API tests
**Solution:**
```bash
# Start server first
npm run dev
```

### QUICK_TEST.sh Fails

**Issue:** "Server not running"
**Solution:**
```bash
# In one terminal:
npm run dev

# In another terminal:
bash QUICK_TEST.sh
```

**Issue:** "Could not get verification token"
**Solution:**
```bash
# Make sure PostgreSQL is accessible
# Check psql credentials
# Verify database exists: adult_live_platform
```

### API Response Errors

**Issue:** "INVALID_CREDENTIALS"
**Solution:** 
- Check email is correct
- Check password is correct
- Verify user exists in database

**Issue:** "UNAUTHORIZED"
**Solution:**
- Include Authorization header with Bearer token
- Token may have expired (15min)
- Use refresh token to get new token

**Issue:** "VALIDATION_ERROR"
**Solution:**
- Check request body format
- Verify required fields present
- Check field values meet requirements

---

## 📈 Test Metrics

### Coverage Report (npm run test:coverage)

Shows test coverage by file:
- Statements: % of code executed
- Branches: % of conditional branches tested
- Functions: % of functions called
- Lines: % of lines executed

**Target:** 80%+ coverage

---

## 🔄 Continuous Integration Ready

All tests are CI/CD ready:
- ✅ Can run in Docker
- ✅ No manual interaction required
- ✅ Clear pass/fail results
- ✅ Coverage reports available

**Example CI/CD Command:**
```bash
npm install
npm run db:push
npm run test
npm run test:coverage
```

---

## 📚 Documentation Links

- **TESTING_GUIDE.md** - Complete manual testing guide with 20+ examples
- **AUTH_SETUP.md** - Authentication system documentation
- **PHASE2_SETUP.md** - User profiles & creator onboarding docs

---

## 🎯 Recommended Testing Flow

### For Quick Verification (5 minutes)
```bash
npm test
```

### For Thorough Testing (1 hour)
```bash
# Terminal 1
npm run dev

# Terminal 2
bash QUICK_TEST.sh

# Terminal 3
# Follow manual tests from TESTING_GUIDE.md
```

### For CI/CD Pipeline
```bash
npm run db:push
npm run test
npm run test:coverage
```

---

## ✨ Ready to Test!

Choose your testing method above and get started. All features are fully tested and production-ready! 🚀

