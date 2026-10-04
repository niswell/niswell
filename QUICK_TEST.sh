#!/bin/bash

# Quick Testing Script for Adult Live Platform
# Tests Phase 1 (Auth) and Phase 2 (Profiles)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000"
EMAIL="test-$(date +%s)@example.com"
PASSWORD="SecurePassword123!@#"

echo -e "${BLUE}=== Adult Live Platform Testing ===${NC}\n"

# Check if server is running
echo -e "${BLUE}1. Checking if server is running...${NC}"
if ! curl -s $API_URL/health > /dev/null; then
    echo -e "${RED}Server not running! Start it with: npm run dev${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}\n"

# Register user
echo -e "${BLUE}2. Registering user...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST $API_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"confirmPassword\": \"$PASSWORD\",
    \"displayName\": \"Test User\"
  }")

USER_ID=$(echo $REGISTER_RESPONSE | grep -o '"userId":"[^"]*' | cut -d'"' -f4)
if [ -z "$USER_ID" ]; then
    echo -e "${RED}✗ Registration failed${NC}"
    echo $REGISTER_RESPONSE
    exit 1
fi
echo -e "${GREEN}✓ User registered: $USER_ID${NC}"
echo -e "  Email: $EMAIL"
echo -e "  Password: $PASSWORD\n"

# Get verification token from database (simulate email link)
echo -e "${BLUE}3. Verifying email...${NC}"
VERIFY_TOKEN=$(psql -U postgres -d adult_live_platform -t -c "SELECT token FROM \"EmailVerification\" WHERE \"userId\" = '$USER_ID' LIMIT 1;" 2>/dev/null || echo "")

if [ -z "$VERIFY_TOKEN" ]; then
    echo -e "${RED}✗ Could not get verification token from database${NC}"
    echo "Make sure PostgreSQL is running and database is initialized"
    exit 1
fi

VERIFY_RESPONSE=$(curl -s -X POST $API_URL/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$VERIFY_TOKEN\"}")

if echo $VERIFY_RESPONSE | grep -q "verified successfully"; then
    echo -e "${GREEN}✓ Email verified${NC}\n"
else
    echo -e "${RED}✗ Email verification failed${NC}"
    echo $VERIFY_RESPONSE
    exit 1
fi

# Login
echo -e "${BLUE}4. Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}✗ Login failed${NC}"
    echo $LOGIN_RESPONSE
    exit 1
fi
echo -e "${GREEN}✓ Logged in successfully${NC}"
echo -e "  Access Token: ${ACCESS_TOKEN:0:20}...\n"

# Get current user
echo -e "${BLUE}5. Testing protected endpoint (GET /api/auth/me)...${NC}"
ME_RESPONSE=$(curl -s $API_URL/api/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo $ME_RESPONSE | grep -q "$EMAIL"; then
    echo -e "${GREEN}✓ Protected endpoint works${NC}\n"
else
    echo -e "${RED}✗ Protected endpoint failed${NC}"
    echo $ME_RESPONSE
    exit 1
fi

# Update viewer profile
echo -e "${BLUE}6. Updating viewer profile...${NC}"
PROFILE_UPDATE=$(curl -s -X PUT $API_URL/api/profiles/viewer/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Test Creator",
    "bio": "Testing the platform",
    "location": "San Francisco",
    "timezone": "America/Los_Angeles"
  }')

if echo $PROFILE_UPDATE | grep -q "Profile updated successfully"; then
    echo -e "${GREEN}✓ Profile updated${NC}\n"
else
    echo -e "${RED}✗ Profile update failed${NC}"
    echo $PROFILE_UPDATE
    exit 1
fi

# Apply as creator
echo -e "${BLUE}7. Applying as creator...${NC}"
APPLY_RESPONSE=$(curl -s -X POST $API_URL/api/creator/apply \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Professional content creator",
    "categories": ["gaming", "music"],
    "languages": ["en", "es"]
  }')

APP_ID=$(echo $APPLY_RESPONSE | grep -o '"applicationId":"[^"]*' | cut -d'"' -f4)
if [ -z "$APP_ID" ]; then
    echo -e "${RED}✗ Creator application failed${NC}"
    echo $APPLY_RESPONSE
    exit 1
fi
echo -e "${GREEN}✓ Creator application submitted${NC}"
echo -e "  Application ID: $APP_ID\n"

# Add tip menu
echo -e "${BLUE}8. Adding tip menu...${NC}"
TIP_RESPONSE=$(curl -s -X POST $API_URL/api/creator/tip-menu \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Small Tip",
    "amount": 5.00,
    "icon": "💰"
  }')

TIP_ID=$(echo $TIP_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1)
if [ -z "$TIP_ID" ]; then
    echo -e "${RED}✗ Tip menu creation failed${NC}"
    echo $TIP_RESPONSE
    exit 1
fi
echo -e "${GREEN}✓ Tip menu added${NC}\n"

# Add stream schedule
echo -e "${BLUE}9. Adding stream schedule...${NC}"
SCHEDULE_RESPONSE=$(curl -s -X POST $API_URL/api/creator/schedule \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dayOfWeek": 0,
    "startTime": "14:00",
    "endTime": "20:00",
    "timezone": "UTC",
    "notifyFollowers": true
  }')

if echo $SCHEDULE_RESPONSE | grep -q "Stream schedule added"; then
    echo -e "${GREEN}✓ Stream schedule added${NC}\n"
else
    echo -e "${RED}✗ Stream schedule creation failed${NC}"
    echo $SCHEDULE_RESPONSE
    exit 1
fi

# Get creator profile
echo -e "${BLUE}10. Getting creator profile...${NC}"
CREATOR_RESPONSE=$(curl -s $API_URL/api/creator/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo $CREATOR_RESPONSE | grep -q "Professional content creator"; then
    echo -e "${GREEN}✓ Creator profile retrieved${NC}\n"
else
    echo -e "${RED}✗ Creator profile retrieval failed${NC}"
    echo $CREATOR_RESPONSE
    exit 1
fi

# Logout
echo -e "${BLUE}11. Testing logout...${NC}"
LOGOUT_RESPONSE=$(curl -s -X POST $API_URL/api/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo $LOGOUT_RESPONSE | grep -q "Logged out successfully"; then
    echo -e "${GREEN}✓ Logout successful${NC}\n"
else
    echo -e "${RED}✗ Logout failed${NC}"
    echo $LOGOUT_RESPONSE
    exit 1
fi

# Summary
echo -e "${BLUE}=== Test Summary ===${NC}"
echo -e "${GREEN}✓ All tests passed!${NC}"
echo ""
echo "Created test user:"
echo "  Email: $EMAIL"
echo "  Password: $PASSWORD"
echo ""
echo "Tested features:"
echo "  ✓ User registration"
echo "  ✓ Email verification"
echo "  ✓ Authentication"
echo "  ✓ Protected endpoints"
echo "  ✓ Viewer profile management"
echo "  ✓ Creator application"
echo "  ✓ Tip menu configuration"
echo "  ✓ Stream schedule management"
echo "  ✓ Logout"
echo ""
echo -e "${BLUE}Ready to test more features!${NC}"
echo "See TESTING_GUIDE.md for complete testing documentation"
