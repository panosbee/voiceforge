import type { Industry, Plan, UserRole } from '../constants';

/** Customer record — represents a VoiceForge customer (business owner) */
export interface Customer {
  id: string;
  userId: string; // Supabase Auth user ID
  businessName: string;
  industry: Industry;
  ownerName: string;
  email: string;
  phone: string;
  plan: Plan;
  userRole: UserRole; // 'naive' | 'expert'
  telnyxAccountId: string | null; // Managed account UUID
  telnyxApiKeyEncrypted: string | null; // AES-256-GCM encrypted
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  googleCalendarConnected: boolean;
  googleOauthTokenEncrypted: string | null; // AES-256-GCM encrypted
  timezone: string; // e.g. "Europe/Athens"
  locale: string; // e.g. "el-GR"
  onboardingCompleted: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Payload for creating a new customer */
export interface CreateCustomerInput {
  businessName: string;
  industry: Industry;
  ownerName: string;
  email: string;
  phone: string;
  plan?: Plan;
  userRole?: UserRole;
  timezone?: string;
  locale?: string;
}

/** Public-facing customer profile (no encrypted fields) */
export interface CustomerProfile {
  id: string;
  businessName: string;
  industry: Industry;
  ownerName: string;
  email: string;
  phone: string;
  plan: Plan;
  userRole: UserRole;
  hasTelnyxAccount: boolean;
  hasElevenLabsAgents: boolean;
  hasStripeSubscription: boolean;
  googleCalendarConnected: boolean;
  agentCount: number;
  timezone: string;
  locale: string;
  onboardingCompleted: boolean;
  isActive: boolean;
  createdAt: string;
}
