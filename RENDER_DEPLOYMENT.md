# 🚀 Deploy Niswell to Render (Step-by-Step)

## Complete Deployment Guide

This guide will get your Niswell platform live on Render in about 15 minutes!

---

## Part 1: Prerequisites

### What You Need
- ✅ GitHub account (already have repos)
- ✅ Render account (free - https://render.com)
- ✅ Stripe account (for payments)
- ⏱️ ~15 minutes of time

### What You'll Get
- 🌐 Backend: `niswell-backend.onrender.com`
- 🌐 Frontend: `niswell-frontend.onrender.com`
- 🎬 Live streaming platform!

---

## Part 2: Deploy Backend to Render

### Step 1: Go to Render Dashboard
1. Visit https://render.com/dashboard
2. Sign in or create account
3. Click **"New +"** → **"Web Service"**

### Step 2: Connect Repository
1. Click **"Connect a repository"**
2. Select **GitHub** as provider
3. Find and select `niswell/niswell` repo
4. Click **"Connect"**

### Step 3: Configure Backend Service

Fill in these settings:

```
Name:                 niswell-backend
Environment:          Node
Region:               US (Oregon)
Branch:               claude/install-ui-ux-pro-max-skill-c1mnla
Build Command:        npm install
Start Command:        npm run start
```

**DO NOT DEPLOY YET** - Need to add database first!

### Step 4: Add PostgreSQL Database

1. Click **"New +"** again → **"PostgreSQL"**
2. Fill in:
   ```
   Name:     niswell-db
   Region:   US (Oregon)  (MUST be same as backend)
   ```
3. Click **"Create Database"**
4. **Wait for database to be ready** (~2 minutes)
5. Copy the `DATABASE_URL` connection string

### Step 5: Add Environment Variables to Backend

Back on the backend service page:

1. Scroll to **"Environment"** section
2. Click **"Add Environment Variable"**
3. Add these variables:

```
NODE_ENV              = production
PORT                  = 3000
DATABASE_URL          = (paste from PostgreSQL)
JWT_SECRET            = (generate: use 32 random chars)
JWT_REFRESH_SECRET    = (generate: use 32 random chars)
TOTP_ISSUER           = Niswell
LOG_LEVEL             = info
CORS_ORIGIN           = https://niswell-frontend.onrender.com
```

**For JWT secrets**, generate random strings:
```bash
# Generate a random string (run in terminal):
openssl rand -base64 32
```

### Step 6: Deploy Backend

1. Click **"Create Web Service"**
2. **Wait for deployment** (~3-5 minutes)
3. Look for green checkmark and "Your service is live"
4. Note the URL: `https://niswell-XXXXX.onrender.com`
5. Test it: Visit `https://niswell-XXXXX.onrender.com/health`
   - Should see: `{"status":"ok","timestamp":"...","environment":"production"}`

---

## Part 3: Deploy Frontend to Render

### Step 1: Configure Frontend

Update frontend environment for production:

```bash
# Open /home/user/niswell-frontend/.env.production
REACT_APP_API_URL=https://niswell-XXXXX.onrender.com/api
REACT_APP_WS_URL=https://niswell-XXXXX.onrender.com
REACT_APP_ENV=production
```

Replace `niswell-XXXXX` with your actual backend domain.

### Step 2: Push to GitHub

```bash
cd /home/user/niswell-frontend
git add .env.production
git commit -m "Add production environment config for Render"
git push origin master
```

### Step 3: Deploy to Render

1. On Render dashboard, click **"New +"** → **"Static Site"**
2. Connect repository:
   - Select `niswell/niswell-frontend` repo
   - Click **"Connect"**

3. Configure settings:
   ```
   Name:              niswell-frontend
   Root Directory:    (leave blank)
   Build Command:     npm run build
   Publish Directory: build
   Branch:            master
   ```

4. Click **"Create Static Site"**
5. **Wait for deployment** (~5 minutes)
6. Note the URL: `https://niswell-frontend.onrender.com`

### Step 4: Update Backend CORS

The frontend URL has changed! Update backend:

1. Go back to backend service (`niswell-backend`)
2. Go to **Environment** tab
3. Click edit on `CORS_ORIGIN`
4. Update to: `https://niswell-frontend.onrender.com`
5. Click **Save**
6. Backend auto-redeploys (~1 minute)

---

## Part 4: Run Database Migrations

The database is created, but tables aren't yet. Let's run migrations:

### Option 1: Using Render Shell (Easy)

1. Go to `niswell-backend` service
2. Click **"Shell"** tab
3. Run this command:
   ```bash
   npx prisma db push --accept-data-loss
   ```
4. You should see:
   ```
   ✓ Database migrated successfully
   ```

### Option 2: Using Local CLI

```bash
# Get DATABASE_URL from Render PostgreSQL service
export DATABASE_URL="postgresql://user:pass@host:port/db"

# Run migrations
npx prisma db push --accept-data-loss
npx prisma generate
```

---

## Part 5: Configure Stripe (Optional but Recommended)

If you want payment processing:

1. Go to Stripe Dashboard (https://dashboard.stripe.com)
2. Get your keys:
   - Publishable Key: `pk_test_...` or `pk_live_...`
   - Secret Key: `sk_test_...` or `sk_live_...`

3. Add to backend environment:
   ```
   STRIPE_SECRET_KEY         = sk_test_...
   STRIPE_PUBLISHABLE_KEY    = pk_test_...
   STRIPE_WEBHOOK_SECRET     = (leave for now)
   ```

4. Backend auto-redeploys

---

## Part 6: Verify Deployment

### Test Backend API

```bash
# Replace XXXXX with your domain
curl https://niswell-XXXXX.onrender.com/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-10-05T...","environment":"production"}
```

### Test Frontend

1. Visit `https://niswell-frontend.onrender.com`
2. Should see Niswell landing page with full styling
3. Network tab should show API calls to backend domain

### Test Authentication

1. Click "Register" or navigate to `/register`
2. Fill in form:
   ```
   Email: testuser@niswell.com
   Display Name: Test User
   Account Type: Creator
   Password: Nqw9xKp2mL#2024!
   Confirm: Nqw9xKp2mL#2024!
   ```
3. Should register successfully
4. Redirect to dashboard
5. Check Redux: Should have user data

### Test Streaming Features

1. On dashboard, click "Go Live"
2. Enter stream info and create
3. Navigate to stream page
4. See video player, chat, and controls
5. Chat should work in real-time

---

## Troubleshooting

### Backend stuck on "Deploying"

**Solution:**
1. Check logs: Click backend → "Logs" tab
2. Look for errors (database connection, etc.)
3. Wait 5-10 minutes (sometimes takes longer first time)

### "Can't connect to database"

**Check:**
1. Database URL in environment variables
2. Database status: Should be "Available"
3. PostgreSQL is in same region (Oregon)

**Fix:**
1. Delete and recreate database
2. Re-run migrations

### Frontend showing "API connection error"

**Check:**
1. `REACT_APP_API_URL` in .env.production is correct
2. Backend is deployed and running
3. CORS_ORIGIN includes frontend URL

**Fix:**
1. Rebuild frontend
2. Clear browser cache (Cmd+Shift+R)

### Chat/WebSocket not working

**Check:**
1. `REACT_APP_WS_URL` in .env.production is correct
2. Backend Socket.io is initialized
3. Network tab: WebSocket connection should show

---

## Performance & Monitoring

### Check Performance

1. Backend logs: `niswell-backend` → "Logs" tab
2. Frontend analytics: Bottom of Static Site page
3. Browser DevTools: Performance tab

### Monitor Usage

**CPU/Memory:**
- Backend page shows live metrics
- Restart if memory > 80%

**Database:**
- PostgreSQL page shows connection count
- Max connections: Check in service details

### Scale Up When Needed

**CPU overloaded?**
1. Click backend service
2. Click "Update"
3. Change plan from "Starter" to "Standard"

**Database overloaded?**
1. Click PostgreSQL service
2. Same process - upgrade plan

---

## Custom Domain (Optional)

To use `niswell.com` instead of `onrender.com`:

### Frontend Domain

1. Frontend service → Settings
2. Custom Domains → Add Domain
3. Enter `niswell.com`
4. Follow DNS instructions
5. Update `CORS_ORIGIN` on backend

### Backend Domain

1. Backend service → Settings
2. Custom Domains → Add Domain
3. Enter `api.niswell.com`
4. Follow DNS instructions

---

## Deployment Complete! 🎉

| Component | URL | Status |
|-----------|-----|--------|
| Frontend | https://niswell-frontend.onrender.com | ✅ Live |
| Backend | https://niswell-XXXXX.onrender.com | ✅ Live |
| Database | PostgreSQL (Render) | ✅ Active |
| WebSocket | Same as backend | ✅ Ready |

---

## Next Steps

1. **Share the link**: `https://niswell-frontend.onrender.com`
2. **Test with friends**: Invite people to beta test
3. **Monitor logs**: Watch for errors
4. **Collect feedback**: Fix issues found
5. **Scale up**: Upgrade if needed
6. **Add custom domain**: Make it official

---

## Cost Estimate

```
Starter Plan (First Month):
- Backend web: $7
- PostgreSQL: $15
- Frontend static: Free
- Total: ~$22/month

Standard Plan (When scaling):
- Backend web: $21
- PostgreSQL: $100+
- Total: ~$120+/month
```

---

## Need Help?

- **Render Docs**: https://render.com/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **Check logs**: Service → Logs tab
- **Restart service**: Service → Restart

---

**Your Niswell platform is now LIVE! 🚀**

Share the link: https://niswell-frontend.onrender.com
