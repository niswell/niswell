# Phase 3 Setup Guide: Complete Implementation

Step-by-step guide to get payments working on your live Render deployment.

---

## Step 1: Create Stripe Account & Get API Keys

### 1.1 Sign Up for Stripe
1. Go to https://stripe.com
2. Click **"Start now"**
3. Sign up with email
4. Complete onboarding (takes 5 minutes)

### 1.2 Get Your API Keys
1. Log in to Stripe Dashboard: https://dashboard.stripe.com
2. Go to **"Developers"** (top right) → **"API Keys"**
3. You'll see:
   - **Publishable Key** (starts with `pk_test_`)
   - **Secret Key** (starts with `sk_test_`)

**⚠️ Important:** Keep Secret Key safe! Don't share it.

---

## Step 2: Add Stripe Keys to Render

### 2.1 Open Render Dashboard
1. Go to https://dashboard.render.com
2. Click on **"niswell"** web service
3. Go to **"Environment"** tab

### 2.2 Add Stripe Variables
Add these three new environment variables:

```
STRIPE_SECRET_KEY = sk_test_xxxxxxxx (paste your secret key)
STRIPE_PUBLISHABLE_KEY = pk_test_xxxxxxxx (paste your publishable key)
STRIPE_WEBHOOK_SECRET = whsec_xxxxxxxx (we'll get this in Step 4)
```

For now, skip `STRIPE_WEBHOOK_SECRET` - we'll add it after creating the webhook.

### 2.3 Also Add (Optional but Recommended)
```
PLATFORM_FEE_PERCENT = 0.10
STRIPE_FEE_PERCENT = 0.029
STRIPE_FEE_FIXED = 0.30
```

**Click "Save"** - Render will auto-redeploy with new environment variables

---

## Step 3: Run Database Migration

The new payment models need to be created in your database.

### 3.1 Local Migration (Optional - for testing)
If you want to test locally first:

```bash
# Install dependencies
npm install stripe

# Run migration
npx prisma migrate deploy

# If you want to regenerate Prisma client
npx prisma generate
```

### 3.2 Remote Migration (On Render)
Since you're on Render, the migration will run automatically when you:
1. Rebuild the app
2. The build includes `prisma generate` and schema is deployed

**But let's trigger it manually to be safe:**

1. Go to Render dashboard
2. Click on **"niswell"** web service
3. Click **"Manual Deploy"**
4. Wait for build to complete

When the app starts, it will:
- ✅ Generate Prisma client with new models
- ✅ Create payment tables in PostgreSQL
- ✅ Ready for payment operations

---

## Step 4: Update server.ts to Include Payment Routes

### 4.1 Open server.ts
```bash
# Local development
nano src/server.ts
# or open in your editor
```

### 4.2 Add Payment Routes Import
Find the imports section (top of file) and add:

```typescript
import paymentRoutes from './routes/payment.routes';
```

### 4.3 Register Payment Routes
Find where other routes are registered:

```typescript
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/creator', creatorRoutes);

// ADD THIS LINE:
app.use('/api/payments', paymentRoutes);
```

### 4.4 Handle Stripe Webhooks (Raw Body)
Stripe webhooks need raw request body. Find your Express middleware and ensure:

```typescript
// This MUST come before json() middleware for webhooks
app.post(
  '/api/payments/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    // Handled by payment routes
  }
);
```

Or in payment.routes.ts, we already handle it with:
```typescript
router.post('/webhooks/stripe', async (req, res, next) => {
  const sig = req.headers['stripe-signature'] as string;
  // Webhook verified in route
});
```

### 4.5 Commit Changes
```bash
git add src/server.ts
git commit -m "Add payment routes to server configuration"
git push origin claude/install-ui-ux-pro-max-skill-c1mnla
```

---

## Step 5: Set Up Stripe Webhooks

Webhooks allow Stripe to notify your app of payment events.

### 5.1 Create Webhook Endpoint

**In Stripe Dashboard:**
1. Go to **"Developers"** → **"Webhooks"**
2. Click **"Add endpoint"**
3. Enter endpoint URL:
   ```
   https://niswell-app.onrender.com/api/payments/webhooks/stripe
   ```
4. Click **"Select events"**

### 5.2 Select Events
Check these events:
- ✅ `payment_intent.succeeded`
- ✅ `payment_intent.payment_failed`
- ✅ `charge.dispute.created`
- ✅ `payout.paid`

Click **"Add events"** → **"Create endpoint"**

### 5.3 Get Webhook Secret

**In Stripe Dashboard Webhooks page:**
1. Find your new endpoint
2. Click to expand it
3. Copy the **Signing secret** (starts with `whsec_`)

### 5.4 Add to Render

1. Go to Render dashboard
2. Go to **"niswell"** service → **"Environment"**
3. Add/update:
   ```
   STRIPE_WEBHOOK_SECRET = whsec_xxxxxxxx (paste the signing secret)
   ```
4. Click **"Save"** (auto-redeploys)

---

## Step 6: Test Payment Flow

### 6.1 Create Stripe Test Account (Creator)

**Endpoint:**
```bash
curl -X POST https://niswell-app.onrender.com/api/payments/creator/setup \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "accountId": "acct_test_xxxxx"
}
```

### 6.2 Get Stripe Dashboard Link

```bash
curl https://niswell-app.onrender.com/api/payments/creator/login-link \
  -H "Authorization: Bearer <CREATOR_TOKEN>"
```

This gives you a link to Stripe dashboard for that creator.

### 6.3 Create Test Payment Method

**Step 1: Create payment method in Stripe**
```bash
curl https://api.stripe.com/v1/payment_methods \
  -u sk_test_YOUR_KEY: \
  -d type=card \
  -d "card[number]=4242424242424242" \
  -d "card[exp_month]=12" \
  -d "card[exp_year]=2025" \
  -d "card[cvc]=314"
```

Response includes `id: pm_test_xxxxx`

**Step 2: Save payment method**
```bash
curl -X POST https://niswell-app.onrender.com/api/payments/methods \
  -H "Authorization: Bearer <VIEWER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethodId": "pm_test_xxxxx"
  }'
```

### 6.4 Send a Test Tip

```bash
curl -X POST https://niswell-app.onrender.com/api/payments/tips \
  -H "Authorization: Bearer <VIEWER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "creatorProfileId": "creator-profile-id",
    "amount": 5.00,
    "paymentMethodId": "pm_test_xxxxx"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "transactionId": "txn_xxxxx",
  "amount": "5.00"
}
```

### 6.5 Check Creator Earnings

```bash
curl https://niswell-app.onrender.com/api/payments/earnings \
  -H "Authorization: Bearer <CREATOR_TOKEN>"
```

**Expected Response:**
```json
{
  "totalEarnings": "4.11",
  "totalTips": "4.11",
  "totalSubscriptions": "0",
  "totalPaid": "0",
  "pendingBalance": "4.11",
  "transactions": [
    {
      "id": "txn_xxxxx",
      "amount": "5.00",
      "creatorEarnings": "4.11",
      "status": "succeeded"
    }
  ]
}
```

---

## Step 7: Verify Everything Works

### 7.1 Check Stripe Dashboard
1. Go to https://dashboard.stripe.com
2. Go to **"Payments"**
3. You should see your test transaction
4. Status should be **"Succeeded"**

### 7.2 Check Render Logs
1. Go to Render dashboard
2. Click **"niswell"** service
3. Click **"Logs"**
4. Look for successful payment processing logs

### 7.3 Check Database
1. Connect to your Render PostgreSQL
2. Query the transactions table:
   ```sql
   SELECT * FROM "Transaction" ORDER BY "createdAt" DESC LIMIT 5;
   ```

---

## 🧪 Stripe Test Cards

Use these card numbers for testing (only work in test mode):

**Successful Payment:**
- Number: `4242 4242 4242 4242`
- Exp: Any future date
- CVC: Any 3 digits

**Declined Payment:**
- Number: `4000 0000 0000 0002`
- Will fail with "card declined"

**Requires Authentication:**
- Number: `4000 0025 0000 3155`
- Will require 3D Secure

---

## ⚡ Common Issues & Fixes

### Issue: "STRIPE_SECRET_KEY not found"
**Fix:** Ensure you added the variable in Render Environment tab and redeployed

### Issue: "Webhook signature verification failed"
**Fix:** Ensure `STRIPE_WEBHOOK_SECRET` matches exactly from Stripe dashboard

### Issue: "Payment method not found"
**Fix:** Make sure payment method was created and saved before using

### Issue: "Creator has not enabled payments"
**Fix:** Ensure creator's Stripe account is active: check `chargesEnabled: true`

### Issue: Database tables not created
**Fix:** Run manual deploy to trigger Prisma migration

---

## 📋 Checklist

- [ ] Stripe account created
- [ ] API keys copied to Render
- [ ] Database migration completed
- [ ] server.ts updated with payment routes
- [ ] Webhook endpoint created in Stripe
- [ ] Webhook secret added to Render
- [ ] Payment route deployed
- [ ] Test payment sent successfully
- [ ] Earnings dashboard working
- [ ] Stripe dashboard shows transaction

---

## 🎉 You're Done!

Your platform now has complete payment processing! 

**What's working:**
- ✅ Creators can connect Stripe accounts
- ✅ Viewers can send tips
- ✅ Subscriptions process automatically
- ✅ Earnings tracked in real-time
- ✅ Payouts ready to process

**Next (Phase 4):**
- Real-time streaming with WebRTC
- Live chat and notifications
- Advanced monetization features

---

## 📞 Support

**Stripe Issues:** https://support.stripe.com
**Render Issues:** https://render.com/docs
**Database Issues:** Check PostgreSQL logs in Render dashboard

Happy payment processing! 🚀
