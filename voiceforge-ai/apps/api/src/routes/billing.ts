// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Billing Routes
// Stripe checkout, portal, subscription management, webhooks
// ═══════════════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { customers } from '../db/schema/index.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { createLogger } from '../config/logger.js';
import { env } from '../config/env.js';
import * as stripeService from '../services/stripe.js';
import type { ApiResponse, Plan } from '@voiceforge/shared';

const log = createLogger('billing');

export const billingRoutes = new Hono<{ Variables: { user: AuthUser } }>();
export const billingWebhookRoutes = new Hono();

// ── Validation ───────────────────────────────────────────────────

const checkoutSchema = z.object({
  plan: z.enum(['starter', 'pro', 'business']),
});

const changePlanSchema = z.object({
  plan: z.enum(['starter', 'pro', 'business']),
});

// ── Helpers ──────────────────────────────────────────────────────

async function getCustomerByUserId(userId: string) {
  return db.query.customers.findFirst({
    where: eq(customers.userId, userId),
  });
}

// ═══════════════════════════════════════════════════════════════════
// Authenticated billing routes
// ═══════════════════════════════════════════════════════════════════

billingRoutes.use('*', authMiddleware);

// ── GET /billing/subscription — Current subscription info ────────

billingRoutes.get('/subscription', async (c) => {
  const user = c.get('user');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  if (!customer.stripeSubscriptionId) {
    return c.json<ApiResponse>({
      success: true,
      data: {
        plan: customer.plan,
        status: 'no_subscription',
        hasStripeSubscription: false,
      },
    });
  }

  try {
    const subscription = await stripeService.getSubscription(customer.stripeCustomerId!);

    return c.json<ApiResponse>({
      success: true,
      data: {
        plan: customer.plan,
        status: subscription?.status ?? 'unknown',
        hasStripeSubscription: true,
        currentPeriodEnd: subscription?.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
      },
    });
  } catch (error) {
    log.error({ error }, 'Failed to fetch subscription');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'STRIPE_ERROR', message: 'Failed to fetch subscription info' } },
      500,
    );
  }
});

// ── POST /billing/checkout — Create Stripe Checkout Session ──────

billingRoutes.post('/checkout', zValidator('json', checkoutSchema), async (c) => {
  const user = c.get('user');
  const { plan } = c.req.valid('json');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer) {
    return c.json<ApiResponse>({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
  }

  try {
    // Create Stripe customer if not exists
    let stripeCustomerId = customer.stripeCustomerId;
    if (!stripeCustomerId) {
      const result = await stripeService.createStripeCustomer({
        email: customer.email,
        name: customer.ownerName,
        businessName: customer.businessName,
        customerId: customer.id,
      });
      stripeCustomerId = result.stripeCustomerId;

      await db
        .update(customers)
        .set({ stripeCustomerId, updatedAt: new Date() })
        .where(eq(customers.id, customer.id));
    }

    const session = await stripeService.createCheckoutSession({
      stripeCustomerId,
      plan: plan as Plan,
      customerId: customer.id,
      successUrl: `${env.FRONTEND_URL}/dashboard/settings?billing=success`,
      cancelUrl: `${env.FRONTEND_URL}/dashboard/settings?billing=canceled`,
    });

    return c.json<ApiResponse>({ success: true, data: session });
  } catch (error) {
    log.error({ error }, 'Failed to create checkout session');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'STRIPE_ERROR', message: 'Failed to create checkout' } },
      500,
    );
  }
});

// ── POST /billing/portal — Create Stripe Customer Portal ─────────

billingRoutes.post('/portal', async (c) => {
  const user = c.get('user');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer?.stripeCustomerId) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'No billing account found' } },
      400,
    );
  }

  try {
    const session = await stripeService.createPortalSession(
      customer.stripeCustomerId,
      `${env.FRONTEND_URL}/dashboard/settings`,
    );
    return c.json<ApiResponse>({ success: true, data: session });
  } catch (error) {
    log.error({ error }, 'Failed to create portal session');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'STRIPE_ERROR', message: 'Failed to create billing portal' } },
      500,
    );
  }
});

// ── POST /billing/change-plan — Change subscription plan ─────────

billingRoutes.post('/change-plan', zValidator('json', changePlanSchema), async (c) => {
  const user = c.get('user');
  const { plan } = c.req.valid('json');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer?.stripeSubscriptionId) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'No active subscription' } },
      400,
    );
  }

  try {
    await stripeService.changePlan(customer.stripeSubscriptionId, plan as Plan);

    // Update plan in our DB
    await db
      .update(customers)
      .set({ plan: plan as Plan, updatedAt: new Date() })
      .where(eq(customers.id, customer.id));

    log.info({ customerId: customer.id, newPlan: plan }, 'Plan changed');
    return c.json<ApiResponse>({ success: true });
  } catch (error) {
    log.error({ error }, 'Failed to change plan');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'STRIPE_ERROR', message: 'Failed to change plan' } },
      500,
    );
  }
});

// ── POST /billing/cancel — Cancel subscription ───────────────────

billingRoutes.post('/cancel', async (c) => {
  const user = c.get('user');

  const customer = await getCustomerByUserId(user.sub);
  if (!customer?.stripeSubscriptionId) {
    return c.json<ApiResponse>(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'No active subscription' } },
      400,
    );
  }

  try {
    await stripeService.cancelSubscription(customer.stripeSubscriptionId);
    log.info({ customerId: customer.id }, 'Subscription cancellation requested');
    return c.json<ApiResponse>({ success: true });
  } catch (error) {
    log.error({ error }, 'Failed to cancel subscription');
    return c.json<ApiResponse>(
      { success: false, error: { code: 'STRIPE_ERROR', message: 'Failed to cancel subscription' } },
      500,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════
// Stripe Webhook Handler (no JWT auth — uses Stripe signature)
// ═══════════════════════════════════════════════════════════════════

billingWebhookRoutes.post('/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400);
  }

  try {
    const rawBody = await c.req.text();
    const event = stripeService.constructWebhookEvent(rawBody, signature);

    log.info({ eventType: event.type, eventId: event.id }, 'Stripe webhook received');

    switch (event.type) {
      // ── Checkout completed → activate subscription ──────────
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.metadata?.voiceforge_customer_id;
        const plan = session.metadata?.plan as Plan;
        const subscriptionId = session.subscription as string;
        const stripeCustomerId = session.customer as string;

        if (customerId && plan && subscriptionId) {
          await db
            .update(customers)
            .set({
              plan,
              stripeCustomerId,
              stripeSubscriptionId: subscriptionId,
              isActive: true,
              updatedAt: new Date(),
            })
            .where(eq(customers.id, customerId));

          log.info({ customerId, plan, subscriptionId }, 'Subscription activated via checkout');
        }
        break;
      }

      // ── Subscription updated (plan change, renewal) ─────────
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.metadata?.voiceforge_customer_id;
        const plan = subscription.metadata?.plan as Plan;

        if (customerId) {
          const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
          };

          if (plan) updateData.plan = plan;
          if (subscription.status === 'active') updateData.isActive = true;
          if (subscription.status === 'past_due') updateData.isActive = true; // grace period
          if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
            updateData.isActive = false;
          }

          await db
            .update(customers)
            .set(updateData)
            .where(eq(customers.id, customerId));

          log.info({ customerId, status: subscription.status }, 'Subscription updated');
        }
        break;
      }

      // ── Subscription deleted ────────────────────────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.metadata?.voiceforge_customer_id;

        if (customerId) {
          await db
            .update(customers)
            .set({
              isActive: false,
              stripeSubscriptionId: null,
              plan: 'starter',
              updatedAt: new Date(),
            })
            .where(eq(customers.id, customerId));

          log.info({ customerId }, 'Subscription deleted — reverted to starter');
        }
        break;
      }

      // ── Invoice payment failed ──────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const stripeCustomerId = invoice.customer as string;

        log.warn(
          { stripeCustomerId, invoiceId: invoice.id },
          'Invoice payment failed — customer may lose access',
        );
        // TODO: Send email notification about payment failure
        break;
      }

      default:
        log.debug({ eventType: event.type }, 'Unhandled Stripe event');
    }

    return c.json({ received: true });
  } catch (error) {
    log.error({ error }, 'Stripe webhook error');
    return c.json({ error: 'Webhook processing failed' }, 400);
  }
});
