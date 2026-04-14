export type SubscriptionPlan = 'free' | 'pro' | 'team';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive';

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

export const PLANS = {
  free:  { name: 'Free',  priceEur: 0,  tasksPerMonth: 50,   channels: 1 },
  pro:   { name: 'Pro',   priceEur: 19, tasksPerMonth: -1,   channels: -1 },  // -1 = unlimited
  team:  { name: 'Team',  priceEur: 79, tasksPerMonth: -1,   channels: -1 },
} as const;
