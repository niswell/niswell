# Integration Testing & Launch Guide

## 🧪 Full End-to-End Testing

### Prerequisites
- Node.js 16+ installed
- PostgreSQL running locally
- Backend & Frontend repos ready

---

## Step 1: Setup Database

```bash
# Create database (if not exists)
createdb niswell

# Run migrations
cd /home/user/niswell
npx prisma db push
npx prisma generate

# (Optional) Seed test data
npx prisma db seed
```

---

## Step 2: Start Backend Service

```bash
cd /home/user/niswell

# Install dependencies (if needed)
npm install

# Start development server
npm run dev

# Expected output:
# ✓ Database connection established
# ✓ Database migrations completed
# ✓ Server running on http://localhost:3000
# ✓ Environment: development
# ✓ API URL: http://localhost:3000/api
# ✓ Health check: http://localhost:3000/health
# ✓ WebSocket ready for streaming
```

**Verify Backend:**
```bash
# In another terminal
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2026-10-05T...","environment":"development"}
```

---

## Step 3: Start Frontend Service

```bash
cd /home/user/niswell-frontend

# Install dependencies (if needed)
npm install

# Start development server
npm start

# Opens http://localhost:3000 in browser
# Expected: Niswell landing page loads
```

---

## Step 4: Integration Test Cases

### A. Authentication Flow

**Test 1: User Registration**
```
1. Navigate to http://localhost:3000/register
2. Fill form:
   - Email: testuser@example.com
   - Display Name: Test User
   - Account Type: Creator
   - Password: Nqw9xKp2mL#2024!
   - Confirm: Nqw9xKp2mL#2024!
3. Click "Register"
4. Expected: Redirected to dashboard, access token in Redux
5. Open DevTools → Redux tab → Check auth.user has userId
```

**Test 2: User Login**
```
1. Logout (if needed)
2. Navigate to http://localhost:3000/login
3. Enter credentials from Test 1
4. Click "Login"
5. Expected: Redirected to dashboard, token in Redux store
6. Check Network tab: Auth header present on API calls
```

**Test 3: Protected Routes**
```
1. Visit http://localhost:3000/dashboard while logged in
   → Should show creator dashboard
2. Logout
3. Try http://localhost:3000/dashboard
   → Should redirect to /login
```

---

### B. Streaming Flow

**Test 4: Stream Creation**
```
1. Go to Dashboard (/dashboard)
2. Fill "Stream Configuration":
   - Title: "My First Test Stream"
   - Description: "Testing the streaming platform"
   - Select options as desired
3. Click "Go Live"
4. Expected:
   - Form shows "Stream Started!" message
   - Redux store updates (isStreaming: true)
   - activeStream has the new stream data
5. Check Network → POST /api/streams/start succeeded
```

**Test 5: Stream Viewing**
```
1. Note the stream ID from Test 4
2. Navigate to /stream/{stream-id}
3. Expected:
   - StreamContainer loads
   - LIVE badge visible
   - Video player shows (in real scenario with WebRTC)
   - Viewer count displays (1234 mock data)
   - "Stream controls" appear on hover
4. Check Console → WebSocket connection message
```

**Test 6: Stream Controls**
```
1. In stream page, hover over video player
2. Test each control:
   - Toggle mute (speaker icon)
   - Quality selector → select 720p
   - Fullscreen toggle
   - Audio/video enable/disable
3. Expected: UI updates reflect changes
```

---

### C. Chat System Flow

**Test 7: Send Chat Messages**
```
1. On stream page, scroll to chat sidebar
2. Type message: "Hello stream!"
3. Press Enter
4. Expected:
   - Message appears in chat immediately
   - Message shows your name and "You" badge
   - Timestamps appear
5. Check Redux → chat.messages has your message
6. Check Network → Socket.io event "chat:send-message"
```

**Test 8: Typing Indicator**
```
1. Start typing in message input
2. Expected:
   - "3 bouncing dots" animation appears above input
   - Shows "You are typing"
3. Stop typing
   - Indicator disappears after 1-3 seconds
4. Check Socket.io events: chat:typing-start/stop
```

**Test 9: Message Actions**
```
1. Hover over your chat message
2. Click three dots (⋯) menu
3. Test "Pin" action:
   - Message gets pinned badge (📌)
   - Pinned section shows at top
4. Test "Delete" action (on own message):
   - Message removed from chat
   - Redux state updates
5. Click "Unpin" on pinned message:
   - Pin badge removed
```

**Test 10: Pinned Messages**
```
1. Pin a message (see Test 9)
2. Expected:
   - Pinned section visible with message count
   - Click to collapse/expand
   - Shows sender, message preview
   - Unpin button appears on hover
3. Pin 3 messages total
   - Section shows "Pinned Messages (3)"
4. Scroll pinned section
   - Shows message history
```

---

### D. Creator Dashboard

**Test 11: Analytics Display**
```
1. Go to Dashboard (/dashboard)
2. Verify Analytics Cards:
   - Total Viewers: 1234
   - Total Earnings: $542.50
   - Active Streams: 3
   - Avg Watch Time: 2h 15m
3. Each card shows change percentage
4. Icons display correctly
```

**Test 12: Stream Setup Form**
```
1. Fill form with:
   - Title: "Test Stream 2"
   - Description: "Another test"
   - Uncheck "Allow Chat" option
   - Uncheck "Allow Tips" option
2. Click "Go Live"
3. Expected: Form shows success message
4. Check Redux → streamSettings updated
```

---

### E. Socket.io & WebRTC

**Test 13: WebSocket Connection**
```
1. Open DevTools → Network tab
2. Go to stream page
3. Look for WebSocket connection:
   - URL: ws://localhost:3000/socket.io/
   - Status: 101 Switching Protocols
4. Messages show Socket.io events flowing
```

**Test 14: Real-time Updates**
```
1. Open two browser windows:
   - Window A: http://localhost:3000/stream/{id}
   - Window B: Same stream page
2. In Window A: Send chat message
3. In Window B: Message appears instantly
4. Expected: No page refresh needed
5. Check WebSocket messages in DevTools
```

---

## Step 5: Error Scenarios

### Test 15: Handle Connection Errors
```
1. Start stream page
2. Stop backend server (Ctrl+C)
3. Expected in frontend:
   - Error message appears
   - Chat disabled
   - Reconnecting indicator
4. Restart backend
5. Expected: Auto-reconnect works
```

### Test 16: Invalid Credentials
```
1. Try login with:
   - Email: nonexistent@test.com
   - Password: WrongPassword123!
2. Expected:
   - Error message displays
   - No redirect
   - Stay on login page
3. Check Redux → auth.error has message
```

### Test 17: Network Latency
```
1. Open DevTools → Network tab
2. Click "Slow 3G" throttle
3. Send chat message
4. Expected:
   - Message still sends (with delay)
   - Typing indicator works
   - No app crash
5. Disable throttle
```

---

## Step 6: Performance Checks

### Test 18: Load Times
```
1. Open DevTools → Performance tab
2. Record page load for /dashboard
3. Expected metrics:
   - First Contentful Paint: < 2s
   - Largest Contentful Paint: < 3s
   - Cumulative Layout Shift: < 0.1
4. Check Console for errors (should be minimal)
```

### Test 19: Memory Leaks
```
1. Open DevTools → Memory tab
2. Take heap snapshot
3. Send 50 messages in chat
4. Take second snapshot
5. Compare snapshots
6. Expected: No significant memory growth
```

---

## Step 7: Responsive Design

### Test 20: Mobile View
```
1. Open DevTools → Toggle Device Toolbar
2. Test on iPhone 12 (390x844):
   - Navigate all pages
   - Send chat message
   - Stream page layout
3. Expected:
   - No horizontal scroll
   - Touch-friendly buttons
   - Chat sidebar stacks properly
4. Test on iPad (768px)
5. Test on Desktop (1920px)
```

---

## Step 8: API Integration

### Test 21: API Endpoint Connectivity
```bash
# Test all major endpoints
curl -X GET http://localhost:3000/health
curl -X GET http://localhost:3000/api/auth/refresh \
  -H "Authorization: Bearer YOUR_TOKEN"
curl -X GET http://localhost:3000/api/streams/active \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Step 9: Production Deployment

### Deploy Backend (Render.com example)
```bash
# 1. Push to GitHub
cd /home/user/niswell
git push origin main

# 2. Create new Web Service on Render
# - Connect GitHub repo
# - Set Environment Variables (from .env)
# - Build command: npm install
# - Start command: npm run start
# - Add PostgreSQL database

# 3. Set DATABASE_URL in Render dashboard
# 4. Deploy
```

### Deploy Frontend (Vercel example)
```bash
# 1. Push to GitHub
cd /home/user/niswell-frontend
git push origin main

# 2. Import to Vercel
# - Select niswell-frontend repo
# - Set environment variables:
#   - REACT_APP_API_URL=https://your-backend.onrender.com/api
#   - REACT_APP_WS_URL=https://your-backend.onrender.com
# - Deploy

# 3. Update CORS in backend .env
# Add frontend URL to CORS_ORIGIN
```

---

## Step 10: Post-Launch Monitoring

### Monitor Backend
```bash
# Check logs
tail -f /var/log/niswell.log

# Monitor performance
# Use: New Relic, DataDog, or CloudWatch
```

### Monitor Frontend
```bash
# Check browser console in production
# Use: Sentry, LogRocket, or Bugsnag
```

---

## Troubleshooting Common Issues

### Frontend can't connect to backend
**Problem:** API calls return 404
**Solution:**
1. Verify backend is running: `curl http://localhost:3000/health`
2. Check CORS_ORIGIN in backend .env includes frontend URL
3. Verify `REACT_APP_API_URL` in frontend .env.local

### Socket.io connection fails
**Problem:** WebSocket connection error
**Solution:**
1. Check backend WebSocket is initialized
2. Verify Socket.io transports: `['websocket', 'polling']`
3. Try polling in DevTools Network → check Socket.io-protocol

### Chat messages not appearing
**Problem:** Messages sent but not displayed
**Solution:**
1. Check Socket.io connection (Network tab)
2. Verify Redux state: `window.__REDUX_DEVTOOLS_EXTENSION__`
3. Check browser console for errors
4. Verify `streamId` is passed to ChatWindow

### Video stream not showing
**Problem:** Black video player
**Solution:**
1. Check WebRTC peer connections
2. Verify local/remote streams exist
3. Check console for `getUserMedia` errors
4. In real scenario, verify peer offers/answers

---

## Test Completion Checklist

- [ ] User registration works
- [ ] User login works
- [ ] Protected routes redirect
- [ ] Stream creation succeeds
- [ ] Stream viewing loads
- [ ] Chat messages send/receive
- [ ] Typing indicators work
- [ ] Message pinning works
- [ ] Dashboard displays
- [ ] Analytics show correctly
- [ ] Socket.io connects
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Performance metrics good
- [ ] Error handling works

---

## Launch Checklist

### Pre-Launch
- [ ] All tests pass
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] HTTPS/WSS configured
- [ ] CORS properly set
- [ ] Error logging configured
- [ ] Rate limiting enabled

### Launch
- [ ] Deploy backend to production
- [ ] Deploy frontend to production
- [ ] Update DNS records
- [ ] Monitor logs for errors
- [ ] Test production URLs
- [ ] Announce to beta users

### Post-Launch
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Respond to user feedback
- [ ] Fix critical issues
- [ ] Scale infrastructure if needed

---

## Success Criteria

✅ **Platform is live when:**
- Both services responding on production URLs
- Authentication flow works end-to-end
- Streaming video displays (mock or real)
- Chat messages send/receive in real-time
- Dashboard shows creator statistics
- No critical errors in logs
- Response times < 2s
- Mobile and desktop working

---

**Ready to launch Niswell! 🚀**
