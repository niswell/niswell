import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export class StripeService {
  /**
   * Create a Stripe account for a creator
   */
  async createCreatorAccount(creatorProfileId: string, email: string) {
    const existing = await prisma.stripeAccount.findUnique({
      where: { creatorProfileId },
    });

    if (existing) {
      throw new AppError(400, 'ACCOUNT_EXISTS', 'Creator already has Stripe account');
    }

    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
    });

    return await prisma.stripeAccount.create({
      data: {
        creatorProfileId,
        stripeAccountId: account.id,
        accountStatus: 'pending',
      },
    });
  }

  /**
   * Get Stripe login link for creator
   */
  async getLoginLink(stripeAccountId: string): Promise<string> {
    const link = await stripe.accounts.createLoginLink(stripeAccountId);
    return link.url;
  }

  /**
   * Save payment method for viewer
   */
  async savePaymentMethod(viewerProfileId: string, stripePaymentMethodId: string) {
    const paymentMethod = await stripe.paymentMethods.retrieve(stripePaymentMethodId);

    const saved = await prisma.paymentMethod.create({
      data: {
        viewerProfileId,
        stripePaymentMethodId,
        type: paymentMethod.type,
        cardBrand: paymentMethod.card?.brand,
        cardLastFour: paymentMethod.card?.last4,
        cardExpMonth: paymentMethod.card?.exp_month,
        cardExpYear: paymentMethod.card?.exp_year,
      },
    });

    return saved;
  }

  /**
   * Process a tip payment
   */
  async processTip(
    payerProfileId: string,
    recipientProfileId: string,
    amount: number,
    paymentMethodId: string
  ) {
    const payer = await prisma.viewerProfile.findUnique({ where: { id: payerProfileId } });
    const recipient = await prisma.creatorProfile.findUnique({ where: { id: recipientProfileId } });
    const stripeAccount = await prisma.stripeAccount.findUnique({
      where: { creatorProfileId: recipientProfileId },
    });

    if (!payer || !recipient || !stripeAccount) {
      throw new AppError(400, 'INVALID_TRANSACTION', 'Invalid payer, recipient, or Stripe account');
    }

    if (!stripeAccount.chargesEnabled) {
      throw new AppError(400, 'PAYMENTS_DISABLED', 'Creator has not enabled payments');
    }

    // Calculate fees
    const stripeFeePercent = 0.029;
    const stripeFeeFixed = 0.3;
    const platformFeePercent = 0.1;

    const stripeFee = Math.round((amount * stripeFeePercent + stripeFeeFixed) * 100) / 100;
    const platformFee = Math.round(amount * platformFeePercent * 100) / 100;
    const creatorEarnings = amount - stripeFee - platformFee;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(amount * 100),
        currency: 'usd',
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        application_fee_amount: Math.round((stripeFee + platformFee) * 100),
      },
      {
        stripeAccount: stripeAccount.stripeAccountId,
      }
    );

    if (paymentIntent.status !== 'succeeded') {
      throw new AppError(400, 'PAYMENT_FAILED', paymentIntent.last_payment_error?.message || 'Payment failed');
    }

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        stripeTransactionId: paymentIntent.id,
        payerProfileId,
        recipientProfileId,
        type: 'tip',
        amount: new Prisma.Decimal(amount),
        platformFee: new Prisma.Decimal(platformFee),
        stripeFee: new Prisma.Decimal(stripeFee),
        creatorEarnings: new Prisma.Decimal(creatorEarnings),
        status: 'succeeded',
        processedAt: new Date(),
      },
    });

    // Update creator earnings
    await prisma.creatorProfile.update({
      where: { id: recipientProfileId },
      data: {
        totalEarnings: {
          increment: creatorEarnings,
        },
      },
    });

    return transaction;
  }

  /**
   * Process subscription payment
   */
  async processSubscription(
    payerProfileId: string,
    recipientProfileId: string,
    tier: string,
    price: number,
    paymentMethodId: string
  ) {
    const payer = await prisma.viewerProfile.findUnique({ where: { id: payerProfileId } });
    const recipient = await prisma.creatorProfile.findUnique({ where: { id: recipientProfileId } });
    const stripeAccount = await prisma.stripeAccount.findUnique({
      where: { creatorProfileId: recipientProfileId },
    });

    if (!payer || !recipient || !stripeAccount) {
      throw new AppError(400, 'INVALID_TRANSACTION', 'Invalid payer, recipient, or Stripe account');
    }

    // Calculate fees and earnings
    const stripeFeePercent = 0.029;
    const stripeFeeFixed = 0.3;
    const platformFeePercent = 0.15;

    const stripeFee = Math.round((price * stripeFeePercent + stripeFeeFixed) * 100) / 100;
    const platformFee = Math.round(price * platformFeePercent * 100) / 100;
    const creatorEarnings = price - stripeFee - platformFee;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(price * 100),
        currency: 'usd',
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        application_fee_amount: Math.round((stripeFee + platformFee) * 100),
      },
      {
        stripeAccount: stripeAccount.stripeAccountId,
      }
    );

    if (paymentIntent.status !== 'succeeded') {
      throw new AppError(400, 'PAYMENT_FAILED', paymentIntent.last_payment_error?.message || 'Payment failed');
    }

    // Create subscription
    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + 1);

    const subscription = await prisma.creatorSubscription.create({
      data: {
        subscriberProfileId: payerProfileId,
        creatorProfileId: recipientProfileId,
        tier,
        price: new Prisma.Decimal(price),
        renewalDate,
      },
    });

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        stripeTransactionId: paymentIntent.id,
        payerProfileId,
        recipientProfileId,
        type: 'subscription',
        amount: new Prisma.Decimal(price),
        platformFee: new Prisma.Decimal(platformFee),
        stripeFee: new Prisma.Decimal(stripeFee),
        creatorEarnings: new Prisma.Decimal(creatorEarnings),
        subscriptionTier: tier,
        subscriptionId: subscription.id,
        billingCycleStart: new Date(),
        billingCycleEnd: renewalDate,
        status: 'succeeded',
        processedAt: new Date(),
      },
    });

    // Update creator earnings
    await prisma.creatorProfile.update({
      where: { id: recipientProfileId },
      data: {
        totalEarnings: {
          increment: creatorEarnings,
        },
      },
    });

    return { subscription, transaction };
  }

  /**
   * Process refund
   */
  async refundTransaction(transactionId: string, reason: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'Transaction not found');
    }

    if (transaction.status === 'refunded') {
      throw new AppError(400, 'ALREADY_REFUNDED', 'Transaction already refunded');
    }

    if (!transaction.stripeTransactionId) {
      throw new AppError(400, 'NO_STRIPE_TRANSACTION', 'Cannot refund non-Stripe transaction');
    }

    // Get creator's Stripe account
    const stripeAccount = await prisma.stripeAccount.findUnique({
      where: { creatorProfileId: transaction.recipientProfileId },
    });

    if (!stripeAccount) {
      throw new AppError(400, 'NO_STRIPE_ACCOUNT', 'Creator has no Stripe account');
    }

    // Create refund
    const refund = await stripe.refunds.create(
      {
        payment_intent: transaction.stripeTransactionId,
      },
      {
        stripeAccount: stripeAccount.stripeAccountId,
      }
    );

    if (refund.status !== 'succeeded') {
      throw new AppError(400, 'REFUND_FAILED', 'Refund failed');
    }

    // Update transaction
    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'refunded',
      },
    });

    // Reverse creator earnings
    await prisma.creatorProfile.update({
      where: { id: transaction.recipientProfileId },
      data: {
        totalEarnings: {
          decrement: Number(transaction.creatorEarnings),
        },
      },
    });

    return updated;
  }

  /**
   * Create payout for creator
   */
  async createPayout(creatorProfileId: string, amount: number) {
    const creator = await prisma.creatorProfile.findUnique({
      where: { id: creatorProfileId },
    });

    const stripeAccount = await prisma.stripeAccount.findUnique({
      where: { creatorProfileId },
    });

    if (!creator || !stripeAccount) {
      throw new AppError(400, 'INVALID_CREATOR', 'Creator not found');
    }

    if (Number(creator.totalEarnings) < amount) {
      throw new AppError(400, 'INSUFFICIENT_BALANCE', 'Insufficient earnings balance');
    }

    if (amount < Number(creator.minimumPayoutAmount)) {
      throw new AppError(400, 'AMOUNT_TOO_LOW', `Minimum payout is ${creator.minimumPayoutAmount}`);
    }

    if (!stripeAccount.payoutsEnabled) {
      throw new AppError(400, 'PAYOUTS_DISABLED', 'Payouts are not enabled for this creator');
    }

    // Create payout via Stripe
    const payout = await stripe.payouts.create(
      {
        amount: Math.round(amount * 100),
        currency: 'usd',
      },
      {
        stripeAccount: stripeAccount.stripeAccountId,
      }
    );

    // Record payout
    const payoutRecord = await prisma.payout.create({
      data: {
        stripPayoutId: payout.id,
        creatorProfileId,
        amount: new Prisma.Decimal(amount),
        payoutPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        payoutPeriodEnd: new Date(),
        status: payout.status === 'paid' ? 'paid' : 'processing',
        bankAccount: stripeAccount.bankAccountLastFour,
      },
    });

    return payoutRecord;
  }

  /**
   * Handle webhook events
   */
  async handleWebhookEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'payment_intent.succeeded':
        return await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);

      case 'payment_intent.payment_failed':
        return await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);

      case 'charge.dispute.created':
        return await this.handleDisputeCreated(event.data.object as Stripe.Dispute);

      case 'payout.paid':
        return await this.handlePayoutPaid(event.data.object as Stripe.Payout);

      default:
        return null;
    }
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
    if (!paymentIntent.id) return;

    await prisma.transaction.updateMany({
      where: { stripeTransactionId: paymentIntent.id },
      data: { status: 'succeeded' },
    });
  }

  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
    if (!paymentIntent.id) return;

    const error = paymentIntent.last_payment_error?.message || 'Unknown error';

    await prisma.transaction.updateMany({
      where: { stripeTransactionId: paymentIntent.id },
      data: { status: 'failed', failureReason: error },
    });
  }

  private async handleDisputeCreated(dispute: Stripe.Dispute) {
    const transaction = await prisma.transaction.findUnique({
      where: { stripeTransactionId: dispute.payment_intent as string },
    });

    if (transaction) {
      await prisma.paymentDispute.create({
        data: {
          stripeDisputeId: dispute.id,
          transactionId: transaction.id,
          reason: dispute.reason || 'unknown',
          amount: new Prisma.Decimal(dispute.amount / 100),
          status: dispute.status,
          dueDateAt: dispute.evidence_due_by ? new Date(dispute.evidence_due_by * 1000) : null,
        },
      });

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { isDisputed: true },
      });
    }
  }

  private async handlePayoutPaid(payout: Stripe.Payout) {
    await prisma.payout.updateMany({
      where: { stripPayoutId: payout.id },
      data: { status: 'paid', completedAt: new Date() },
    });
  }
}

export const stripeService = new StripeService();
