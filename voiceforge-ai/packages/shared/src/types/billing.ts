import type { Plan } from '../constants';

/** Billing subscription */
export interface Subscription {
  id: string;
  customerId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  plan: Plan;
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  minutesUsed: number;
  minutesIncluded: number;
  createdAt: Date;
}

/** Usage record for billing */
export interface UsageRecord {
  id: string;
  customerId: string;
  periodStart: Date;
  periodEnd: Date;
  totalCalls: number;
  totalMinutes: number;
  includedMinutes: number;
  overageMinutes: number;
  overageCost: number; // in cents
}
