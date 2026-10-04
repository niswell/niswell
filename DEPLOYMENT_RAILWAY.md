# Deployment Guide - Railway.app

Deploy the Adult Live Platform to Railway in 10 minutes.

---

## 🚀 Quick Start (5 Steps)

### Step 1: Create Railway Account

1. Go to https://railway.app
2. Sign up with GitHub (recommended)
3. Authorize Railway to access your repos

---

### Step 2: Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Search for `niswell/niswell`
4. Click to import

---

### Step 3: Add PostgreSQL Database

1. In Railway dashboard, click **"Add"**
2. Select **"PostgreSQL"**
3. Railway auto-creates it

---

### Step 4: Configure Environment Variables

Railway will auto-detect your repo and Node.js. Add these variables:

1. Click on your project
2. Go to **Variables**
3. Add the following:

```
NODE_ENV=production
PORT=3000
API_URL=https://<your-railway-url>

JWT_SECRET=<generate-random-secret>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

ARGON2_MEMORY=65540
ARGON2_TIME=3
ARGON2_PARALLELISM=4

CORS_ORIGIN=https://<your-railway-url>

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

LOGIN_ATTEMPT_LIMIT=5
LOGIN_ATTEMPT_WINDOW_MS=900000
LOGIN_LOCKOUT_DURATION_MS=900000
```

**For DATABASE_URL:** Railway creates it automatically. Copy from the PostgreSQL plugin environment.

---

### Step 5: Deploy

1. Click **"Deploy"** button
2. Wait for deployment (2-3 minutes)
3. Your URL is shown in Railway dashboard

**Your app is live!** 🎉

---

## 📝 Detailed Setup Instructions

### 1. GitHub Setup

Before deploying, ensure your code is pushed:

```bash
# Check status
git status

# Push to branch
git push origin claude/install-ui-ux-pro-max-skill-c1mnla
```

**Branch deployed:** `claude/install-ui-ux-pro-max-skill-c1mnla`

---

### 2. Railway Account Creation

**Option A: GitHub Sign-up (Recommended)**
- Go to https://railway.app
- Click "Sign up"
- Click "GitHub" button
- Authorize Railway
- Done! 🎉

**Option B: Email Sign-up**
- Go to https://railway.app
- Click "Sign up"
- Enter email and password
- Verify email
- Done! 🎉

---

### 3. Create Project from GitHub

**Step-by-step:**

1. After logging in, click **"New Project"** button
2. Click **"Deploy from GitHub repo"**
3. Search for `niswell/niswell`
4. Click the repo when it appears
5. Railway scans the repo
6. Select branch: `claude/install-ui-ux-pro-max-skill-c1mnla`
7. Click **"Deploy"**

**Railway detects automatically:**
- ✅ Node.js runtime
- ✅ npm dependencies
- ✅ TypeScript compilation
- ✅ Start command

---

### 4. Add PostgreSQL Database

**Step-by-step:**

1. In project dashboard, click **"Add"** button
2. Select **"Database"**
3. Click **"PostgreSQL"**
4. Railway creates database automatically
5. Database environment variables auto-populated

**Auto-created variables:**
- `DATABASE_URL` - Full connection string
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` - Individual values

---

### 5. Set Environment Variables

Railway has two variable types:
- **Service variables** - For your Node.js app
- **Database variables** - Auto-set by PostgreSQL plugin

**Add these variables to your Node.js service:**

1. Click on the Node.js service in dashboard
2. Click **"Variables"** tab
3. Click **"New Variable"**
4. Add each one:

```
NODE_ENV=production
PORT=3000
```

**For DATABASE_URL:**
- Copy from PostgreSQL plugin
- It looks like: `postgresql://user:password@host:port/dbname`

**JWT Secret Generation:**
```bash
# Generate a random JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste as `JWT_SECRET` in Railway.

**Example environment setup:**

```
NODE_ENV: production
PORT: 3000
API_URL: https://niswell-app.up.railway.app
JWT_SECRET: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
JWT_ACCESS_EXPIRY: 15m
JWT_REFRESH_EXPIRY: 7d
ARGON2_MEMORY: 65540
ARGON2_TIME: 3
ARGON2_PARALLELISM: 4
CORS_ORIGIN: https://niswell-app.up.railway.app
RATE_LIMIT_WINDOW_MS: 900000
RATE_LIMIT_MAX_REQUESTS: 100
LOGIN_ATTEMPT_LIMIT: 5
LOGIN_ATTEMPT_WINDOW_MS: 900000
LOGIN_LOCKOUT_DURATION_MS: 900000
DATABASE_URL: postgresql://user:pass@host:port/db
```

---

### 6. Database Migration

Railway automatically runs deployment steps. Ensure your `package.json` has:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "db:push": "prisma db push"
  }
}
```

To run migrations after deployment:

1. Click on your Node.js service
2. Click **"Logs"**
3. Check for migration output

**Or manually run migrations:**

```bash
# In Railway UI, go to "Deploy" tab
# Click "Commands"
# Run: npm run db:push
```

---

## 🧪 Testing Your Deployment

### 1. Check if Server is Running

```bash
curl https://<your-railway-url>/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "environment": "production"
}
```

### 2. Test Registration

```bash
curl -X POST https://<your-railway-url>/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!@#",
    "confirmPassword": "SecurePassword123!@#",
    "displayName": "Test User"
  }'
```

### 3. Test Login

```bash
curl -X POST https://<your-railway-url>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!@#"
  }'
```

### 4. Monitor Logs

In Railway dashboard:
1. Click your project
2. Click **"Logs"**
3. See real-time server output

---

## 🔍 Troubleshooting

### Build Fails

**Issue:** "npm ERR! code ENOENT"
**Solution:**
1. Ensure `package.json` exists at root
2. Run `npm install` locally first
3. Push changes to GitHub
4. Re-deploy from Railway

### Database Connection Error

**Issue:** "Error: connect ECONNREFUSED"
**Solution:**
1. Verify PostgreSQL plugin is added
2. Check `DATABASE_URL` is set correctly
3. Run migrations: `npm run db:push`
4. Check logs for errors

### Server Won't Start

**Issue:** "Cannot find module"
**Solution:**
1. Check all dependencies in `package.json`
2. Run `npm install` locally
3. Ensure build succeeds: `npm run build`
4. Push to GitHub and re-deploy

### Environment Variables Not Working

**Issue:** Environment variables show as `undefined`
**Solution:**
1. Ensure variables are set in Railway UI
2. Click "Redeploy" after adding variables
3. Restart the service
4. Check in logs with: `console.log(process.env.VARIABLE_NAME)`

---

## 📊 Monitor Your App

### Real-time Logs

1. Click your project in Railway dashboard
2. Click **"Logs"** tab
3. See all server output in real-time

### Metrics

1. Click **"Metrics"** tab
2. View:
   - CPU usage
   - Memory usage
   - Network I/O
   - Request count

### Environment Variables

1. Click **"Variables"** tab
2. View all configured variables
3. Edit or add new ones
4. Changes auto-redeploy service

---

## 🚀 Your Deployment URL

After deployment completes, Railway provides:
- **Main URL:** `https://<project-name>.up.railway.app`
- **API:** `https://<project-name>.up.railway.app/api`
- **Health:** `https://<project-name>.up.railway.app/health`

Example:
- Main: `https://niswell-app.up.railway.app`
- Auth API: `https://niswell-app.up.railway.app/api/auth`
- Profiles API: `https://niswell-app.up.railway.app/api/profiles`
- Creator API: `https://niswell-app.up.railway.app/api/creator`

---

## 🔐 Security Checklist

Before going public:

- [ ] Change `JWT_SECRET` to random value
- [ ] Set `NODE_ENV=production`
- [ ] Verify `DATABASE_URL` is private
- [ ] Enable HTTPS (Railway auto-enables)
- [ ] Set `CORS_ORIGIN` to your domain
- [ ] Configure rate limiting values
- [ ] Review all environment variables

---

## 📈 Scaling

Railway free tier includes:
- ✅ $5/month credit
- ✅ Up to 3 active projects
- ✅ PostgreSQL database
- ✅ 500MB memory
- ✅ 1GB disk

**When you need more:**
- Railway charges per resource usage
- Scales automatically
- No additional configuration needed

---

## 🔄 Auto-Deploy from Git

After first deployment, Railway auto-deploys on:
- Push to the connected branch
- New commits to `claude/install-ui-ux-pro-max-skill-c1mnla`

**To deploy changes:**
```bash
git commit -m "Your changes"
git push origin claude/install-ui-ux-pro-max-skill-c1mnla
```

Railway detects the push and auto-deploys! 🚀

---

## 📚 Useful Railway Links

- Dashboard: https://railway.app/dashboard
- Project Settings: https://railway.app/project/{projectId}/settings
- PostgreSQL Docs: https://docs.railway.app/databases/postgresql
- Environment Variables: https://docs.railway.app/variables

---

## ✅ Deployment Checklist

- [ ] GitHub account with `niswell/niswell` repo
- [ ] Railway account created
- [ ] Project imported from GitHub
- [ ] PostgreSQL database added
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Server responding to requests
- [ ] All tests passing

---

## 🎉 Your App is Live!

Once deployment completes:
1. Copy your Railway URL
2. Test with curl commands above
3. Share with others
4. Monitor logs for errors
5. Update CORS_ORIGIN if using custom domain

**You can now test the entire platform in production!** 🚀

---

*Railway Deployment Guide*
*Adult Live Platform - Phases 1 & 2*
