# Phase 3: Payments & Monetization System

Complete payment and monetization platform for adult live creators.

---

## 🎯 Features Implemented

### Creator Payment Setup
- ✅ Stripe Express account creation
- ✅ Stripe dashboard login links
- ✅ Bank account verification
- ✅ Payout method configuration

### Payment Processing
- ✅ Tip processing with Stripe
- ✅ Subscription management
- ✅ Payment method saving
- ✅ Automatic fee calculations
- ✅ Commission splits (platform/stripe/creator)

### Earnings Management
- ✅ Creator earnings dashboard
- ✅ Transaction history
- ✅ Real-time balance tracking
- ✅ Payout requests
- ✅ Financial reports

### Security & Compliance
- ✅ PCI DSS compliance (via Stripe)
- ✅ Webhook verification
- ✅ Payment encryption
- ✅ Dispute handling
- ✅ Fraud detection ready

---

## 💾 Database Schema

### New Models

**StripeAccount**
- Creator's Stripe Express account
- Account verification status
- Bank account details
- Tax information

**PaymentMethod**
- Saved credit cards
- Bank accounts
- Multiple methods per viewer

**Transaction**
- Tips and subscriptions
- Fee calculations
- Status tracking
- Dispute records

**Payout**
- Creator payment requests
- Payout history
- Status tracking

**PaymentDispute**
- Chargeback/fraud disputes
- Evidence tracking
- Resolution timeline

**PaymentReport**
- Monthly financial reports
- Revenue breakdowns
- Creator earnings summary

---

## 🔑 Environment Variables Required

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Payment Configuration
PLATFORM_FEE_PERCENT=0.10        # 10% platform fee
STRIPE_FEE_PERCENT=0.029         # Stripe processing fee
STRIPE_FEE_FIXED=0.30            # Fixed fee per transaction
```

---

## 📋 API Endpoints

### Creator Payment Setup
```
POST   /api/payments/creator/setup       Create Stripe account
GET    /api/payments/creator/login-link  Get Stripe dashboard link
```

### Payment Methods
```
POST   /api/payments/methods             Save payment method
GET    /api/payments/methods             List payment methods
DELETE /api/payments/methods/:id         Delete payment method
```

### Transactions
```
POST   /api/payments/tips                Send a tip
POST   /api/payments/subscriptions       Subscribe to creator
GET    /api/payments/transactions        Get transaction history
```

### Earnings
```
GET    /api/payments/earnings            Creator earnings dashboard
POST   /api/payments/payouts             Request payout
GET    /api/payments/reports             Get financial reports
```

### Webhooks
```
POST   /api/payments/webhooks/stripe     Stripe webhook handler
```

---

## 💰 Fee Structure

### Tips (10% Platform Fee + Stripe)
- Platform Fee: 10%
- Stripe Fee: 2.9% + $0.30
- Creator Gets: Remaining

**Example: $10 tip**
- Platform Fee: $1.00
- Stripe Fee: $0.59
- Creator Earnings: $8.41

### Subscriptions (15% Platform Fee + Stripe)
- Platform Fee: 15%
- Stripe Fee: 2.9% + $0.30
- Creator Gets: Remaining

**Example: $10/month subscription**
- Platform Fee: $1.50
- Stripe Fee: $0.59
- Creator Earnings: $7.91

---

## 🔧 Setup Instructions

### 1. Install Dependencies
```bash
npm install stripe
```

### 2. Configure Stripe
1. Create Stripe account at https://stripe.com
2. Get API keys from dashboard
3. Set environment variables
4. Create webhook endpoint

### 3. Database Migration
```bash
npx prisma migrate dev --name add_payment_models
```

### 4. Register Routes
Add to `src/server.ts`:
```typescript
import paymentRoutes from './routes/payment.routes';
app.use('/api/payments', paymentRoutes);
```

### 5. Set Up Webhooks
1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://yourapp.com/api/payments/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.dispute.created`
   - `payout.paid`

---

## 🧪 Testing

### Manual Testing

**Create Stripe Account**
```bash
curl -X POST https://niswell-app.onrender.com/api/payments/creator/setup \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**Send a Tip**
```bash
curl -X POST https://niswell-app.onrender.com/api/payments/tips \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "creatorProfileId": "creator-id",
    "amount": 5.00,
    "paymentMethodId": "pm_..."
  }'
```

**Get Earnings**
```bash
curl https://niswell-app.onrender.com/api/payments/earnings \
  -H "Authorization: Bearer <token>"
```

### Automated Testing
```bash
npm test -- payments.test.ts
```

---

## 🔐 Security Considerations

1. **PCI Compliance**: Never store full card numbers (handled by Stripe)
2. **Webhook Verification**: Always verify Stripe signature
3. **Amount Validation**: Validate amounts server-side
4. **Rate Limiting**: Implement rate limiting on payment endpoints
5. **Fraud Detection**: Monitor for suspicious patterns

---

## 💡 Implementation Notes

### Fee Calculations
- All fees calculated server-side
- Stored with each transaction for audit trail
- Creator always sees exact earnings upfront

### Stripe Express Accounts
- Each creator has individual Stripe Express account
- Platform collects fees, creator gets share
- PCI compliance handled by Stripe
- Payouts go directly to creator's bank

### Transaction Status Flow
1. `pending` - Payment initiated
2. `processing` - Stripe processing
3. `succeeded` - Payment complete
4. `failed` - Payment failed
5. `refunded` - Refund processed

### Dispute Handling
- Disputes tracked in `PaymentDispute` model
- Evidence collection workflow
- Automatic dispute detection via webhooks
- Manual override for complex disputes

---

## 📊 Revenue Model

**Platform Revenue Sources:**
1. Tip transaction fees (10%)
2. Subscription transaction fees (15%)
3. Premium creator tiers (future)
4. Featured listings (future)

---

## 🚀 Next Steps (Phase 4+)

- [ ] Subscription management UI
- [ ] Advanced dispute resolution
- [ ] Tax report generation
- [ ] Creator payee verification
- [ ] Multiple payout methods
- [ ] Recurring billing optimization
- [ ] Revenue analytics dashboard
- [ ] Fraud detection ML model

---

## 📚 Files Created

- `prisma/schema.prisma` - Payment models (added)
- `src/services/stripe.service.ts` - Stripe integration
- `src/routes/payment.routes.ts` - Payment endpoints

## 🔗 Related Documentation

- `DEPLOYMENT_RENDER.md` - Deployment guide
- `TESTING_GUIDE.md` - Testing procedures
- `AUTH_SETUP.md` - Authentication docs
