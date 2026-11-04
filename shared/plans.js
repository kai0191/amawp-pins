// Plan definitions. The Worker seeds these into the D1 `plans` table and reads the
// table at runtime, so a paid plan can be switched on later by editing one row
// (or this file) without code changes elsewhere.
export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    priceCents: 0,
    maxAccounts: 1,
    aiPins: false,            // "generate a whole pin with AI" (paid later)
    premiumTemplates: false,  // Pro-tier templates (paid later)
    bulkMax: 100,             // pins per bulk batch
    active: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceCents: 900,
    maxAccounts: 5,
    aiPins: true,
    premiumTemplates: true,
    bulkMax: 500,
    active: false, // coming soon: users join the waitlist instead
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    priceCents: 2900,
    maxAccounts: 25,
    aiPins: true,
    premiumTemplates: true,
    bulkMax: 2000,
    active: false,
  },
};

export const WAITLIST_FEATURES = [
  { id: 'more_accounts', label: 'More Pinterest accounts' },
  { id: 'ai_pins', label: 'One-click AI-generated pins' },
  { id: 'premium_templates', label: 'Premium templates' },
  { id: 'team', label: 'Team members' },
  { id: 'analytics', label: 'Deeper analytics' },
  { id: 'other', label: 'Something else' },
];

export function planFromRow(row) {
  if (!row) return PLANS.free;
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    maxAccounts: row.max_accounts,
    aiPins: !!row.ai_pins,
    premiumTemplates: !!row.premium_templates,
    bulkMax: row.bulk_max,
    active: !!row.active,
  };
}

/** Returns { ok: true } or { ok: false, code, message } */
export function checkCanConnect(plan, currentAccounts) {
  if (currentAccounts < plan.maxAccounts) return { ok: true };
  return {
    ok: false,
    code: 'PLAN_LIMIT',
    message: `Your ${plan.name} plan includes ${plan.maxAccounts} Pinterest account${plan.maxAccounts === 1 ? '' : 's'}. More accounts are coming soon with a paid plan.`,
  };
}

export function canUseTemplate(plan, template) {
  return template.tier !== 'pro' || !!plan.premiumTemplates;
}
