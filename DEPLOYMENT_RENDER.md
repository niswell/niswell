# Deployment Guide - Render

Deploy the Adult Live Platform to Render for free in 10 minutes.

---

## 🚀 Quick Start (5 Steps)

### Step 1: Create Render Account

1. Go to https://render.com
2. Click **"Sign up"**
3. Choose **"GitHub"** option
4. Authorize Render to access your repos

---

### Step 2: Create New Web Service

1. Go to https://dashboard.render.com
2. Click **"New +"** button
3. Select **"Web Service"**
4. Search for `niswell` repo
5. Select `niswell/niswell`
6. Click **"Connect"**

---

### Step 3: Configure Web Service

On the configuration page, set:

```
Name: niswell-app
Environment: Node
Branch: claude/install-ui-ux-pro-max-skill-c1mnla
Build Command: npm install && npm run build
Start Command: node dist/server.js
```

Click **"Create Web Service"**

---

### Step 4: Add PostgreSQL Database

1. Click **"New +"** → **"PostgreSQL"**
2. Name it: `niswell-db`
3. Render creates it automatically
4. Database URL auto-links to your web service

---

### Step 5: Set Environment Variables

1. Go to your web service dashboard
2. Click **"Environment"** tab
3. Add these variables:

```
NODE_ENV=production
PORT=3000
API_URL=https://<your-render-url>.onrender.com

JWT_SECRET=<generate-random-secret>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

ARGON2_MEMORY=65540
ARGON2_TIME=3
ARGON2_PARALLELISM=4

CORS_ORIGIN=https://<your-render-url>.onrender.com

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

LOGIN_ATTEMPT_LIMIT=5
LOGIN_ATTEMPT_WINDOW_MS=900000
LOGIN_LOCKOUT_DURATION_MS=900000
```

**DATABASE_URL** is auto-added by PostgreSQL service

Click **"Deploy"** - Done! 🎉

---

## 📝 Detailed Setup Instructions

### 1. GitHub Setup

Ensure code is pushed:

```bash
git status
git push origin claude/install-ui-ux-pro-max-skill-c1mnla
```

**Branch deployed:** `claude/install-ui-ux-pro-max-skill-c1mnla`

---

### 2. Render Account Creation

**Steps:**
1. Go to https://render.com
2. Click **"Sign up"**
3. Click **"GitHub"** button
4. Authorize Render app
5. Done! 🎉

---

### 3. Create Web Service from GitHub

**Step-by-step:**

1. Go to https://dashboard.render.com
2. Click **"New +"** in top right
3. Select **"Web Service"**
4. Under "Connect a repository", search for `niswell`
5. Click the `niswell/niswell` repo
6. Click **"Connect"**

**Configuration page:**

Fill in these fields:

| Field | Value |
|-------|-------|
| Name | niswell-app |
| Environment | Node |
| Region | Oregon (or your region) |
| Branch | claude/install-ui-ux-pro-max-skill-c1mnla |
| Build Command | `npm install && npm run build` |
| Start Command | `node dist/server.js` |

- Uncheck **"Auto-deploy"** for now (we'll do it manually first)
- Click **"Create Web Service"**

Render starts building! ⏳

---

### 4. Add PostgreSQL Database

**Step-by-step:**

1. In dashboard, click **"New +"**
2. Select **"PostgreSQL"**
3. Configure:

| Field | Value |
|-------|-------|
| Name | niswell-db |
| Database | postgres |
| User | postgres |
| Region | Oregon (same as web service) |

- Click **"Create Database"**

Render creates the database automatically. The `DATABASE_URL` is automatically added to your web service's environment variables!

---

### 5. Set Environment Variables

**Finding your Render URL:**
- Go to your web service
- Look for the URL at the top (like `https://niswell-app.onrender.com`)
- Copy it

**Setting variables:**

1. Click on your web service (niswell-app)
2. Go to **"Environment"** tab on left sidebar
3. Click **"Add Environment Variable"**
4. Add each variable:

```
NODE_ENV: production
PORT: 3000
API_URL: https://niswell-app.onrender.com

JWT_SECRET: <generate-random-secret>
JWT_ACCESS_EXPIRY: 15m
JWT_REFRESH_EXPIRY: 7d

ARGON2_MEMORY: 65540
ARGON2_TIME: 3
ARGON2_PARALLELISM: 4

CORS_ORIGIN: https://niswell-app.onrender.com

RATE_LIMIT_WINDOW_MS: 900000
RATE_LIMIT_MAX_REQUESTS: 100

LOGIN_ATTEMPT_LIMIT: 5
LOGIN_ATTEMPT_WINDOW_MS: 900000
LOGIN_LOCKOUT_DURATION_MS: 900000
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste as `JWT_SECRET`

---

### 6. Deploy

1. After setting environment variables, Render auto-redeploys
2. Watch the **"Logs"** tab for build progress
3. When you see `"Server running on port 3000"`, it's live! ✅

---

## 🧪 Testing Your Deployment

### 1. Check if Server is Running

```bash
curl https://<your-render-url>.onrender.com/health
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
curl -X POST https://<your-render-url>.onrender.com/api/auth/register \
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
curl -X POST https://<your-render-url>.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!@#"
  }'
```

### 4. Monitor Logs

1. Go to your web service dashboard
2. Click **"Logs"** tab
3. See real-time server output

---

## 🔍 Troubleshooting

### Build Fails with "npm ERR"

**Solution:**
1. Check that `package.json` exists at root
2. Ensure `package-lock.json` is committed
3. View full build logs in Render dashboard
4. Common issue: Node version mismatch

**Fix:**
```bash
# Update package-lock.json locally
npm install
git add package-lock.json
git commit -m "Update package-lock.json"
git push origin claude/install-ui-ux-pro-max-skill-c1mnla
```

---

### Database Connection Error

**Error:** `Error: connect ECONNREFUSED`

**Solution:**
1. Verify PostgreSQL service is running (check dashboard)
2. Check `DATABASE_URL` is set in Environment
3. Manually trigger migration:
   - In web service logs, check if prisma ran
   - If not, rebuild with "Manual Deploy"

---

### "Cannot find module" Error

**Solution:**
1. Ensure all dependencies are in `package.json`
2. Check `npm install` runs during build
3. Verify build command is: `npm install && npm run build`

---

### Environment Variables Show as Undefined

**Solution:**
1. Ensure variables are added in Environment tab
2. Click **"Manual Deploy"** to redeploy after adding variables
3. Wait 2-3 minutes for new deployment
4. Check logs to verify variables loaded

---

## 📊 Monitor Your App

### Real-time Logs

1. Web service dashboard
2. Click **"Logs"** tab
3. See all server output live

### Metrics

1. Click **"Metrics"** tab
2. View:
   - CPU usage
   - Memory usage
   - Network I/O
   - Request count

### Environment Variables

1. Click **"Environment"** tab
2. View all configured variables
3. Edit or add new ones
4. Click **"Save"** to redeploy

---

## 🔄 Auto-Deploy from Git

After first manual deploy:

1. Go to your web service
2. Click **"Settings"** tab
3. Under "Deploy Hook", find the webhook URL
4. Render auto-deploys on push to `claude/install-ui-ux-pro-max-skill-c1mnla`

**To deploy changes:**
```bash
git commit -m "Your changes"
git push origin claude/install-ui-ux-pro-max-skill-c1mnla
```

Render detects the push and auto-deploys! 🚀

---

## 🚀 Your Deployment URL

After successful deployment:

- **Main URL:** `https://niswell-app.onrender.com`
- **API:** `https://niswell-app.onrender.com/api`
- **Health:** `https://niswell-app.onrender.com/health`

Example URLs:
- Main: `https://niswell-app.onrender.com`
- Auth API: `https://niswell-app.onrender.com/api/auth`
- Profiles API: `https://niswell-app.onrender.com/api/profiles`
- Creator API: `https://niswell-app.onrender.com/api/creator`

---

## 🔐 Security Checklist

Before going public:

- [ ] Change `JWT_SECRET` to random value
- [ ] Set `NODE_ENV=production`
- [ ] Verify `DATABASE_URL` is private (not visible in code)
- [ ] Enable HTTPS (Render auto-enables)
- [ ] Set `CORS_ORIGIN` to your domain
- [ ] Configure rate limiting values
- [ ] Review all environment variables
- [ ] Check database backup settings

---

## 📈 Scaling

Render free tier includes:

- ✅ $7/month free credit
- ✅ 1 web service (512 MB RAM)
- ✅ 1 PostgreSQL database
- ✅ Auto-sleep after 15 min inactivity
- ✅ Up to 100GB bandwidth/month

**When you need more:**
- Upgrade to paid plan (~$7-15/month)
- Scales automatically
- No downtime during upgrade

---

## 📚 Useful Render Links

- Dashboard: https://dashboard.render.com
- Service Logs: https://dashboard.render.com/services
- PostgreSQL Docs: https://render.com/docs/databases
- Environment Variables: https://render.com/docs/environment-variables
- Deployment: https://render.com/docs/deploys

---

## ✅ Deployment Checklist

- [ ] GitHub account with `niswell/niswell` repo
- [ ] Render account created
- [ ] Web service created and connected to GitHub
- [ ] PostgreSQL database created
- [ ] Environment variables configured
- [ ] Build completes successfully
- [ ] Server responding to requests
- [ ] Database migrations run
- [ ] All tests passing

---

## 🎉 Your App is Live!

Once deployment completes:

1. Copy your Render URL
2. Test with curl commands above
3. Share with others
4. Monitor logs for errors
5. Update CORS_ORIGIN if using custom domain

**You can now test the entire platform in production!** 🚀

---

## 🆘 Render vs Railway - Key Differences

| Feature | Render | Railway |
|---------|--------|---------|
| Free Tier | Yes ($7/month credit) | Paid (was free) |
| Database Included | Yes, free PostgreSQL | Yes, free PostgreSQL |
| Deploy Method | Git-based | Git-based |
| Auto-sleep | Yes (15 min) | No |
| Ease of Use | Very Easy | Very Easy |
| Support | Good | Good |

**Note:** Render apps auto-sleep after 15 minutes of inactivity. When a request comes in, it wakes up (takes ~30 seconds). For production, upgrade to paid plan to disable auto-sleep.

---

*Render Deployment Guide*
*Adult Live Platform - Phases 1 & 2*
