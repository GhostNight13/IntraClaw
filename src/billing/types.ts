export type SubscriptionPlan = 'free' | 'pro' | 'team' | 'agency';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive' | 'payment_failed';

export interface Subscription {
  id: number;
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  createdAt: string;
}

/**
 * Plan definitions.
 * - tasksPerMonth / loopTicksPerDay: -1 = unlimited
 * - maxAgents: concurrent agents allowed per user
 */
export interface PlanFeatures {
  name: string;
  priceEur: number;
  tasksPerMonth: number;
  channels: number;
  loopTicksPerDay: number;
  maxAgents: number;
  vectorMemory: boolean;
  stripeToolAccess: boolean;
  priorityQueue: boolean;
  customSkills: boolean;
  whiteLabel: boolean;
}

export const PLANS: Record<SubscriptionPlan, PlanFeatures> = {
  free:   { name: 'Free',   priceEur: 0,  tasksPerMonth: 50, channels: 1,  loopTicksPerDay: 10, maxAgents: 1, vectorMemory: false, stripeToolAccess: false, priorityQueue: false, customSkills: false, whiteLabel: false },
  pro:    { name: 'Pro',    priceEur: 15, tasksPerMonth: -1, channels: -1, loopTicksPerDay: -1, maxAgents: 1, vectorMemory: true,  stripeToolAccess: true,  priorityQueue: true,  customSkills: false, whiteLabel: false },
  team:   { name: 'Team',   priceEur: 79, tasksPerMonth: -1, channels: -1, loopTicksPerDay: -1, maxAgents: 3, vectorMemory: true,  stripeToolAccess: true,  priorityQueue: true,  customSkills: false, whiteLabel: false },
  agency: { name: 'Agency', priceEur: 49, tasksPerMonth: -1, channels: -1, loopTicksPerDay: -1, maxAgents: 5, vectorMemory: true,  stripeToolAccess: true,  priorityQueue: true,  customSkills: true,  whiteLabel: true  },
};
