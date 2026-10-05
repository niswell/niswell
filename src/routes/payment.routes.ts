import { Router } from 'express';
import { z } from 'zod';
import { stripeService } from '../services/stripe.service';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import Stripe from 'stripe';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Validation schemas
const tipSchema = z.object({
  creatorProfileId: z.string(),
  amount: z.number().min(1).max(10000),
  paymentMethodId: z.string(),
});

const subscriptionSchema = z.object({
  creatorProfileId: z.string(),
  tier: z.string(),
  price: z.number().min(1).max(10000),
  paymentMethodId: z.string(),
});

const payoutSchema = z.object({
  amount: z.number().min(10).max(100000),
});

// ============= CREATOR PAYMENT SETUP =============

/**
 * Create Stripe account for creator
 * POST /api/payments/creator/setup
 */
router.post('/creator/setup', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user!;
    const creator = await prisma.creatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!creator) {
      throw new AppError(404, 'CREATOR_NOT_FOUND', 'Creator profile not found');
    }

    const account = await stripeService.createCreatorAccount(creator.id, user.email);
    res.json({ success: true, accountId: account.stripeAccountId });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Stripe login link for creator
 * GET /api/payments/creator/login-link
 */
router.get('/creator/login-link', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user!;
    const stripeAccount = await prisma.stripeAccount.findFirst({
      where: {
        creatorProfile: {
          user: { id: user.id },
        },
      },
    });

    if (!stripeAccount) {
      throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Stripe account not found');
    }

    const loginLink = await stripeService.getLoginLink(stripeAccount.stripeAccountId);
    res.json({ loginUrl: loginLink });
  } catch (error) {
    next(error);
  }
});

// ============= PAYMENT METHODS =============

/**
 * Save payment method
 * POST /api/payments/methods
 */
router.post('/methods', authenticateToken, async (req, res, next) => {
  try {
    const { paymentMethodId } = z.object({ paymentMethodId: z.string() }).parse(req.body);
    const user = req.user!;

    const viewer = await prisma.viewerProfile.findUnique({
      where: { userId: user.id },
    });

    if (!viewer) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Viewer profile not found');
    }

    const method = await stripeService.savePaymentMethod(viewer.id, paymentMethodId);
    res.json({ success: true, method });
  } catch (error) {
    next(error);
  }
});

/**
 * Get payment methods
 * GET /api/payments/methods
 */
router.get('/methods', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user!;
    const viewer = await prisma.viewerProfile.findUnique({
      where: { userId: user.id },
    });

    if (!viewer) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Viewer profile not found');
    }

    const methods = await prisma.paymentMethod.findMany({
      where: { viewerProfileId: viewer.id, deletedAt: null },
    });

    res.json({ methods });
  } catch (error) {
    next(error);
  }
});

// ============= TIPS & SUBSCRIPTIONS =============

/**
 * Send a tip
 * POST /api/payments/tips
 */
router.post('/tips', authenticateToken, async (req, res, next) => {
  try {
    const input = tipSchema.parse(req.body);
    const user = req.user!;

    const viewer = await prisma.viewerProfile.findUnique({
      where: { userId: user.id },
    });

    if (!viewer) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Viewer profile not found');
    }

    const transaction = await stripeService.processTip(
      viewer.id,
      input.creatorProfileId,
      input.amount,
      input.paymentMethodId
    );

    res.json({ success: true, transactionId: transaction.id, amount: transaction.amount });
  } catch (error) {
    next(error);
  }
});

/**
 * Subscribe to creator
 * POST /api/payments/subscriptions
 */
router.post('/subscriptions', authenticateToken, async (req, res, next) => {
  try {
    const input = subscriptionSchema.parse(req.body);
    const user = req.user!;

    const viewer = await prisma.viewerProfile.findUnique({
      where: { userId: user.id },
    });

    if (!viewer) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Viewer profile not found');
    }

    const result = await stripeService.processSubscription(
      viewer.id,
      input.creatorProfileId,
      input.tier,
      input.price,
      input.paymentMethodId
    );

    res.json({ success: true, subscription: result.subscription });
  } catch (error) {
    next(error);
  }
});

/**
 * Get transaction history
 * GET /api/payments/transactions
 */
router.get('/transactions', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user!;
    const viewer = await prisma.viewerProfile.findUnique({
      where: { userId: user.id },
    });

    if (!viewer) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Viewer profile not found');
    }

    const transactions = await prisma.transaction.findMany({
      where: { payerProfileId: viewer.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ transactions });
  } catch (error) {
    next(error);
  }
});

// ============= CREATOR EARNINGS =============

/**
 * Get creator earnings dashboard
 * GET /api/payments/earnings
 */
router.get('/earnings', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user!;
    const creator = await prisma.creatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!creator) {
      throw new AppError(404, 'CREATOR_NOT_FOUND', 'Creator profile not found');
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        recipientProfileId: creator.id,
        status: 'succeeded',
      },
      orderBy: { createdAt: 'desc' },
    });

    const payouts = await prisma.payout.findMany({
      where: { creatorProfileId: creator.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    const totalTips = transactions
      .filter((t: any) => t.type === 'tip')
      .reduce((sum: number, t: any) => sum + Number(t.creatorEarnings), 0);

    const totalSubscriptions = transactions
      .filter((t: any) => t.type === 'subscription')
      .reduce((sum: number, t: any) => sum + Number(t.creatorEarnings), 0);

    const totalPaid = payouts
      .filter((p: any) => p.status === 'paid')
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

    const pendingBalance = Number(creator.totalEarnings) - totalPaid;

    res.json({
      totalEarnings: creator.totalEarnings,
      totalTips,
      totalSubscriptions,
      totalPaid,
      pendingBalance,
      transactions,
      payouts,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Request payout
 * POST /api/payments/payouts
 */
router.post('/payouts', authenticateToken, async (req, res, next) => {
  try {
    const { amount } = payoutSchema.parse(req.body);
    const user = req.user!;

    const creator = await prisma.creatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!creator) {
      throw new AppError(404, 'CREATOR_NOT_FOUND', 'Creator profile not found');
    }

    const payout = await stripeService.createPayout(creator.id, amount);
    res.json({ success: true, payout });
  } catch (error) {
    next(error);
  }
});

/**
 * Get payment reports
 * GET /api/payments/reports
 */
router.get('/reports', authenticateToken, async (req, res, next) => {
  try {
    const user = req.user!;
    const creator = await prisma.creatorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!creator) {
      throw new AppError(404, 'CREATOR_NOT_FOUND', 'Creator profile not found');
    }

    const reports = await prisma.paymentReport.findMany({
      where: { creatorProfileId: creator.id },
      orderBy: { reportPeriodStart: 'desc' },
    });

    res.json({ reports });
  } catch (error) {
    next(error);
  }
});

// ============= WEBHOOKS =============

/**
 * Handle Stripe webhooks
 * POST /api/payments/webhooks/stripe
 */
router.post('/webhooks/stripe', async (req, res, next) => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (error) {
      throw new AppError(400, 'WEBHOOK_ERROR', 'Webhook signature verification failed');
    }

    await stripeService.handleWebhookEvent(event);
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

export default router;
