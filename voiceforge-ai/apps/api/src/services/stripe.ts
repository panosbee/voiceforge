// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Stripe Service Layer
// Handles subscription management, checkout sessions, and webhooks.
// ═══════════════════════════════════════════════════════════════════

import Stripe from 'stripe';
import { env } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import type { Plan } from '@voiceforge/shared';

const log = createLogger('stripe');

// ── Stripe Client ────────────────────────────────────────────────

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }
  return stripeClient;
}

/** Check if Stripe is configured */
export function isStripeConfigured(): boolean {
  return !!env.STRIPE_SECRET_KEY;
}

// ── Price Mapping ────────────────────────────────────────────────

const PLAN_PRICE_MAP: Record<Plan, string> = {
  starter: env.STRIPE_STARTER_PRICE_ID,
  pro: env.STRIPE_PRO_PRICE_ID,
  business: env.STRIPE_BUSINESS_PRICE_ID,
};

// ═══════════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a Stripe customer for a VoiceForge customer.
 */
export async function createStripeCustomer(params: {
  email: string;
  name: string;
  businessName: string;
  customerId: string;
}): Promise<{ stripeCustomerId: string }> {
  const stripe = getStripe();

  log.info({ email: params.email, businessName: params.businessName }, 'Creating Stripe customer');

  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      voiceforge_customer_id: params.customerId,
      business_name: params.businessName,
    },
  });

  log.info({ stripeCustomerId: customer.id }, 'Stripe customer created');
  return { stripeCustomerId: customer.id };
}

// ═══════════════════════════════════════════════════════════════════
// CHECKOUT SESSIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a Stripe Checkout Session for plan subscription.
 */
export async function createCheckoutSession(params: {
  stripeCustomerId: string;
  plan: Plan;
  customerId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripe();
  const priceId = PLAN_PRICE_MAP[params.plan];

  if (!priceId) {
    throw new Error(`No Stripe price configured for plan: ${params.plan}`);
  }

  log.info({ plan: params.plan, stripeCustomerId: params.stripeCustomerId }, 'Creating checkout session');

  const session = await stripe.checkout.sessions.create({
    customer: params.stripeCustomerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      voiceforge_customer_id: params.customerId,
      plan: params.plan,
    },
    subscription_data: {
      metadata: {
        voiceforge_customer_id: params.customerId,
        plan: params.plan,
      },
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    locale: 'el',
  });

  log.info({ sessionId: session.id }, 'Checkout session created');

  return {
    sessionId: session.id,
    url: session.url!,
  };
}

// ═══════════════════════════════════════════════════════════════════
// CUSTOMER PORTAL
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a Stripe Billing Portal session for self-service management.
 */
export async function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

// ═══════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get subscription details for a Stripe customer.
 */
export async function getSubscription(
  stripeCustomerId: string,
): Promise<Stripe.Subscription | null> {
  const stripe = getStripe();

  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'active',
    limit: 1,
  });

  return subscriptions.data[0] ?? null;
}

/**
 * Cancel a subscription at period end.
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const stripe = getStripe();

  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });

  log.info({ subscriptionId }, 'Subscription set to cancel at period end');
}

/**
 * Reactivate a canceled-but-not-yet-expired subscription.
 */
export async function reactivateSubscription(subscriptionId: string): Promise<void> {
  const stripe = getStripe();

  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });

  log.info({ subscriptionId }, 'Subscription reactivated');
}

/**
 * Change subscription plan.
 */
export async function changePlan(
  subscriptionId: string,
  newPlan: Plan,
): Promise<void> {
  const stripe = getStripe();
  const priceId = PLAN_PRICE_MAP[newPlan];

  if (!priceId) {
    throw new Error(`No Stripe price configured for plan: ${newPlan}`);
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const currentItemId = subscription.items.data[0]?.id;

  if (!currentItemId) {
    throw new Error('Subscription has no items');
  }

  await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: currentItemId, price: priceId }],
    proration_behavior: 'create_prorations',
    metadata: { plan: newPlan },
  });

  log.info({ subscriptionId, newPlan }, 'Subscription plan changed');
}

// ═══════════════════════════════════════════════════════════════════
// WEBHOOK VERIFICATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Verify and construct a Stripe webhook event from raw body and signature.
 */
export function constructWebhookEvent(
  rawBody: string,
  signature: string,
): Stripe.Event {
  const stripe = getStripe();

  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }

  return stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}
