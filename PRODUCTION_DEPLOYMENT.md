# Production Deployment Guide

## 🚀 Launch Niswell to Production

### Architecture Diagram
```
┌─────────────────┐
│   Frontend      │ (Vercel/AWS S3)
│  React + TS    │ https://niswell.com
└────────┬────────┘
         │
         │ HTTP/WebSocket
         │
┌────────▼────────┐
│   Backend       │ (Render/AWS EC2)
│ Node/Express   │ https://api.niswell.com
└────────┬────────┘
         │
         │ PostgreSQL
         │
┌────────▼────────┐
│   Database      │ (AWS RDS)
│  PostgreSQL    │
└─────────────────┘
```

---

## Part 1: Backend Deployment (Render.com)

### Step 1: Prepare Repository

```bash
cd /home/user/niswell

# Ensure .gitignore has sensitive files
cat .gitignore

# Should include:
# .env
# node_modules/
# dist/
# .DS_Store

# Add production .env.production (don't commit secrets)
# Configure via Render dashboard instead
```

### Step 2: Create Render Service

**Visit**: https://render.com/dashboard

1. **Click "New +"** → **"Web Service"**

2. **Connect Repository**
   - Authorize GitHub
   - Select `niswell/niswell` repo
   - Branch: `main` (or your branch)

3. **Configure Service**
   ```
   Name: niswell-backend
   Environment: Node
   Region: US (Oregon)
   Branch: main
   Build Command: npm install
   Start Command: npm run start
   ```

4. **Environment Variables**
   - Click "Advanced"
   - Add environment variables:
   ```
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=postgresql://user:pass@hostname:5432/niswell
   JWT_SECRET=(generate random string)
   JWT_REFRESH_SECRET=(generate random string)
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   CORS_ORIGIN=https://niswell.com,https://www.niswell.com
   LOG_LEVEL=info
   ```

5. **Database Setup**
   - Click "New +" → "PostgreSQL"
   - Name: `niswell-db`
   - Region: same as backend
   - Copy connection string to `DATABASE_URL`

6. **Deploy**
   - Click "Create Web Service"
   - Wait for build & deployment
   - Note the URL: `https://niswell-XXXXX.onrender.com`

### Step 3: Run Migrations

After deployment, run migrations on production database:

```bash
# Connect to your production database
# (Render provides connection details)

# Run migrations
DATABASE_URL="your_production_url" npx prisma db push --accept-data-loss

# Generate Prisma client
npx prisma generate
```

### Step 4: Configure Webhooks

For Stripe webhooks:

1. Go to Stripe Dashboard
2. Developers → Webhooks
3. Add endpoint:
   ```
   URL: https://niswell-XXXXX.onrender.com/api/payments/webhooks/stripe
   Events: payment_intent.succeeded, payment_intent.payment_failed, etc.
   ```
4. Copy signing secret to `STRIPE_WEBHOOK_SECRET` in Render

### Step 5: Verify Backend

```bash
# Test health endpoint
curl https://niswell-XXXXX.onrender.com/health

# Expected response:
# {"status":"ok","timestamp":"2026-10-05T...","environment":"production"}
```

---

## Part 2: Frontend Deployment (Vercel)

### Step 1: Prepare Frontend

```bash
cd /home/user/niswell-frontend

# Ensure build works
npm run build

# Should complete successfully
# Creates 'build' folder with optimized assets
```

### Step 2: Deploy to Vercel

**Visit**: https://vercel.com/dashboard

1. **Click "Add New..."** → **"Project"**

2. **Import Repository**
   - Select `niswell/niswell-frontend` repo
   - Click "Import"

3. **Configure Project**
   ```
   Framework: Create React App
   Root Directory: ./
   Build Command: npm run build (default)
   Output Directory: build (default)
   Install Command: npm install (default)
   ```

4. **Environment Variables**
   - Add variables for production:
   ```
   REACT_APP_API_URL=https://niswell-XXXXX.onrender.com/api
   REACT_APP_WS_URL=https://niswell-XXXXX.onrender.com
   REACT_APP_ENV=production
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait for build complete
   - Note the URL: `https://niswell.vercel.app`

### Step 3: Configure Custom Domain

1. In Vercel dashboard → Project Settings
2. Domains tab
3. Add custom domain: `niswell.com`
4. Follow DNS instructions
5. Add `www` subdomain: `www.niswell.com`

### Step 4: Enable HTTPS

- Vercel auto-enables SSL for all domains
- Verify by visiting `https://niswell.com`

### Step 5: Verify Frontend

```bash
# Test in browser
https://niswell.com

# Expected: Landing page loads with styling
```

---

## Part 3: Connect Services

### Update CORS on Backend

In Render dashboard:
1. Select `niswell-backend` service
2. Environment tab
3. Update `CORS_ORIGIN`:
   ```
   https://niswell.com,https://www.niswell.com,https://niswell.vercel.app
   ```

### Test Integration

1. Visit `https://niswell.com`
2. Go to login page
3. Network tab: Check API calls go to backend
4. Try login:
   ```
   Email: testuser@example.com
   Password: TestPassword123!
   ```
5. Expected: Auth token returned, redirected to dashboard

---

## Part 4: Database Backup & Monitoring

### Automated Backups

**On Render (PostgreSQL)**:
1. Select database
2. Backups tab
3. Enable automatic backups (daily)
4. Retention: 30 days

### Monitor Database

```bash
# Connect to production database
psql postgresql://user:pass@hostname:5432/niswell

# Check table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Check active connections
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;
```

---

## Part 5: Domain & SSL

### Purchase Domain (Namecheap/GoDaddy/Route53)

1. Register `niswell.com`
2. Set nameservers to:
   - Vercel for frontend: `ns1.vercel.com`, etc.
   - Or use Route53 for both

### Configure DNS

**Option A: Use Vercel DNS**
```
Domain: niswell.com
DNS Records:
  A     niswell.com          → 76.76.19.165 (Vercel)
  CNAME www.niswell.com      → niswell.vercel.app
  CNAME api.niswell.com      → niswell-XXXXX.onrender.com
```

**Option B: Use AWS Route53**
```
Hosted Zone: niswell.com
Records:
  A     niswell.com          → Vercel IP
  CNAME www.niswell.com      → niswell.vercel.app
  CNAME api.niswell.com      → niswell-XXXXX.onrender.com
```

### SSL Certificate

- **Vercel**: Automatic for vercel.com domains
- **Custom domains**: Automatic via Let's Encrypt
- **Render**: Automatic HTTPS for all services

---

## Part 6: Monitoring & Logging

### Backend Logs (Render)

```
Dashboard → niswell-backend → Logs
Real-time logs show:
- Requests
- Errors
- Database queries
- WebSocket connections
```

### Frontend Monitoring (Vercel)

```
Dashboard → niswell → Analytics
Shows:
- Page load times
- Error rates
- Visitor analytics
- Deployment history
```

### Add Error Tracking (Sentry)

1. Create Sentry account at sentry.io
2. Create project (Node.js for backend)
3. Create project (React for frontend)

**Backend Setup**:
```bash
npm install @sentry/node
```

Add to `server.ts`:
```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

**Frontend Setup**:
```bash
npm install @sentry/react
```

Add to `App.tsx`:
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.REACT_APP_ENV,
  tracesSampleRate: 0.1,
});
```

---

## Part 7: Performance Optimization

### Backend Optimization

```typescript
// Add caching headers
app.use((req, res, next) => {
  res.set('Cache-Control', 'public, max-age=3600');
  next();
});

// Add compression
import compression from 'compression';
app.use(compression());

// Add rate limiting
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);
```

### Frontend Optimization

```bash
# Analyze bundle
npm run build -- --analyze

# Results in 'build/report.html'
# Look for large dependencies to replace
```

### CDN Configuration

**For Frontend (Vercel)**:
- Automatic CDN distribution
- 280+ edge locations globally
- Automatic caching

**For Static Assets**:
- Images: Optimize with next/image
- Videos: Host on CloudFlare Stream or Mux
- Fonts: Use Google Fonts

---

## Part 8: Security Hardening

### Backend Security

```typescript
// Helmet for headers
import helmet from 'helmet';
app.use(helmet());

// Rate limiting
app.use(rateLimit({...}));

// Input validation (zod)
import { z } from 'zod';

// HTTPS redirect
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && 
      req.header('x-forwarded-proto') !== 'https') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});
```

### Frontend Security

```typescript
// Content Security Policy
// Add to vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

### Database Security

```sql
-- Create read-only user for analytics
CREATE USER niswell_readonly WITH PASSWORD 'strong_password';
GRANT CONNECT ON DATABASE niswell TO niswell_readonly;
GRANT USAGE ON SCHEMA public TO niswell_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO niswell_readonly;

-- Enable SSL connections
require_secure_connection = on
```

---

## Part 9: Testing Production

### Health Checks

```bash
# Backend
curl -I https://api.niswell.com/health
# Expected: 200 OK

# Frontend
curl -I https://niswell.com/
# Expected: 200 OK (or 307 redirect to www)
```

### API Testing

```bash
# Register user
curl -X POST https://api.niswell.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@niswell.com",
    "password": "TestPassword123!",
    "confirmPassword": "TestPassword123!",
    "displayName": "Test User",
    "role": "creator"
  }'

# Login
curl -X POST https://api.niswell.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@niswell.com",
    "password": "TestPassword123!"
  }'

# Create stream
curl -X POST https://api.niswell.com/api/streams/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Production Test Stream",
    "description": "Testing in production"
  }'
```

### Load Testing

```bash
# Install autocannon
npm install -g autocannon

# Test backend
autocannon -c 100 -d 30 https://api.niswell.com/health

# Expected: 
# Throughput > 1000 req/s
# Latency < 100ms
```

---

## Part 10: Post-Launch Operations

### Daily Tasks
- [ ] Check error logs (Sentry)
- [ ] Monitor performance (Vercel Analytics)
- [ ] Review API metrics
- [ ] Check database connections

### Weekly Tasks
- [ ] Review user feedback
- [ ] Analyze usage patterns
- [ ] Performance optimization
- [ ] Security audit

### Monthly Tasks
- [ ] Release updates
- [ ] Database cleanup
- [ ] Capacity planning
- [ ] Budget review (Render, Vercel, AWS costs)

---

## Part 11: Scaling Strategy

### When to Scale

**Backend (Render)**:
- At 80% CPU usage → Upgrade Pro plan
- At 500+ concurrent connections → Add load balancer
- At 10GB+ database → Consider read replicas

**Frontend (Vercel)**:
- Auto-scales with Vercel infrastructure
- No manual scaling needed

**Database (AWS RDS)**:
- At 80% storage → Increase storage
- At 80% connections → Enable connection pooling
- Performance degradation → Scale instance

### Optimization Order

1. Frontend: Enable service worker caching
2. Backend: Add Redis for session caching
3. Database: Add read replicas
4. Global: Add CloudFlare CDN
5. Streaming: Use Mux or CloudFlare Stream

---

## Launch Checklist

- [ ] Backend deployed and verified
- [ ] Frontend deployed and verified
- [ ] Database migrations completed
- [ ] SSL/HTTPS working
- [ ] CORS configured correctly
- [ ] Environment variables set
- [ ] Error logging enabled
- [ ] Backups configured
- [ ] Domain DNS pointing correctly
- [ ] Stripe webhooks configured
- [ ] All API endpoints tested
- [ ] Authentication flow works
- [ ] Chat/WebSocket working
- [ ] Performance metrics good
- [ ] Security hardening done
- [ ] Monitoring tools active
- [ ] Documentation updated

---

## Estimated Costs (Monthly)

```
Render Backend:        $7 (Starter) → $21 (Pro)
PostgreSQL Database:  $15 (Starter) → $100+ (Production)
Vercel Frontend:       $0 (Hobby) → $20 (Pro)
CloudFlare CDN:       $0 (Free) → $200+ (Pro)
Sentry Monitoring:    $29 (Team tier)
Stripe Processing:    2.2% + $0.30 per transaction
AWS Route53 (DNS):    $0.50 per hosted zone/month

TOTAL ESTIMATE: $50-100/month for MVP
                $500-1000/month for scale
```

---

## Going Live Timeline

```
Day 1-2:  Backend deployment & testing
Day 2-3:  Frontend deployment & testing
Day 3-4:  Integration testing & fixes
Day 4-5:  Security & performance hardening
Day 5-6:  Beta user onboarding
Day 6-7:  Monitoring & optimization
Day 8:    Public launch! 🎉
```

---

**Niswell is ready to launch! 🚀**

Follow this guide step-by-step for a smooth production deployment.
