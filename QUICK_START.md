# 🚀 Quick Start - Running Niswell Locally

## Prerequisites

### Required
- Node.js 16+ (check with: `node --version`)
- npm (comes with Node.js)

### Database (Choose One)

#### Option A: PostgreSQL with Docker (Easiest)
```bash
docker run --name niswell-db \
  -e POSTGRES_USER=niswell \
  -e POSTGRES_PASSWORD=niswell \
  -e POSTGRES_DB=niswell \
  -p 5432:5432 \
  -d postgres:15

# Test connection
docker exec niswell-db psql -U niswell -d niswell -c "SELECT 1"
```

#### Option B: Install PostgreSQL Locally
- **Mac**: `brew install postgresql && brew services start postgresql`
- **Linux**: `sudo apt install postgresql && sudo service postgresql start`
- **Windows**: Download from https://www.postgresql.org/download/windows/

---

## Quick Start (3 Commands)

### Terminal 1: Start Backend
```bash
cd /home/user/niswell
npm run dev
```

**Expected Output:**
```
✓ Database connection established
✓ Database migrations completed
✓ Server running on http://localhost:3000
✓ Environment: development
✓ WebSocket ready for streaming
```

### Terminal 2: Start Frontend
```bash
cd /home/user/niswell-frontend
npm start
```

**Expected Output:**
```
Compiled successfully!
On Your Network:  http://192.168.x.x:3000
Local:            http://localhost:3000
```

Browser will open automatically to `http://localhost:3000` ✅

---

## Testing the Platform

### 1. Visit Landing Page
- URL: http://localhost:3000
- Should see Niswell landing page with features

### 2. Register User
- Click "Join Niswell" or navigate to `/register`
- Fill form:
  ```
  Email: testuser@niswell.com
  Display Name: Test User
  Account Type: Creator
  Password: Nqw9xKp2mL#2024!
  Confirm: Nqw9xKp2mL#2024!
  ```
- Click "Register"
- Should redirect to dashboard

### 3. Access Dashboard
- URL: http://localhost:3000/dashboard
- See analytics and stream setup form

### 4. Create Stream
- Click "Go Live" button
- Fill stream info:
  ```
  Title: Test Stream
  Description: Testing locally
  ```
- Click "Go Live"

### 5. View Stream
- Note stream ID from dashboard
- Navigate to: http://localhost:3000/stream/{stream-id}
- See video player, chat, and stream controls

### 6. Test Chat
- Type message in chat sidebar
- Press Enter
- Message appears in real-time

### 7. Test Controls
- Hover over video player
- Try:
  - Mute button
  - Quality selector
  - Fullscreen toggle
  - Audio/video toggle

---

## Troubleshooting

### Backend won't start: "Can't reach database server"

**Solution 1: Docker**
```bash
docker ps  # Check if niswell-db is running
docker start niswell-db  # If stopped, restart
docker logs niswell-db  # Check for errors
```

**Solution 2: Local PostgreSQL**
```bash
# Mac
brew services restart postgresql

# Linux
sudo service postgresql restart

# Windows
# Open Services app and restart PostgreSQL service
```

**Solution 3: Check .env**
```bash
cat /home/user/niswell/.env
# DATABASE_URL should point to your database
```

### Frontend won't start: Port 3000 already in use

```bash
# Mac/Linux: Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Chat not working

1. Open DevTools (F12)
2. Go to Network tab
3. Filter "WS" (WebSocket)
4. Should see Socket.io connection
5. If not, check browser console for errors

### API calls returning 404

1. Check backend is running: `curl http://localhost:3000/health`
2. Check CORS_ORIGIN in `.env` includes `http://localhost:3000`
3. Check frontend .env has correct API URL:
   ```bash
   cat /home/user/niswell-frontend/.env.local
   # Should have: REACT_APP_API_URL=http://localhost:3000/api
   ```

---

## Development Commands

### Backend
```bash
npm run dev          # Start with auto-reload
npm run build        # TypeScript compile
npm run lint         # Run linter
npm run db:push      # Apply schema to database
npm run db:studio    # Open Prisma Studio (GUI)
```

### Frontend
```bash
npm start            # Start dev server
npm run build        # Production build
npm run test         # Run tests
npm run lint         # Run linter
```

---

## Stopping Services

### Graceful Shutdown

In each terminal, press: `Ctrl + C`

### Clean Up Docker

```bash
docker stop niswell-db
docker rm niswell-db
```

---

## Next Steps

### Ready for Integration Testing?
See: `INTEGRATION_TEST_GUIDE.md` for 20+ test cases

### Want to Deploy?
See: `PRODUCTION_DEPLOYMENT.md` for Render + Vercel setup

---

## Architecture Verification

| Component | URL | Status |
|-----------|-----|--------|
| Frontend | http://localhost:3000 | ✅ React |
| Backend API | http://localhost:3000/api | ✅ Express |
| Health Check | http://localhost:3000/health | ✅ Live |
| WebSocket | ws://localhost:3000/socket.io | ✅ Socket.io |

---

**Happy testing! 🎉**
