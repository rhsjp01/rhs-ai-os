// ---------------------------------------------------------------------------
// RHS AI Solutions OS — Tier policy engine
// Mirrors the freemium matrix: Free (5 properties / 1 keyword),
// Professional (50 / 10), Enterprise (unlimited). Admin role bypasses all.
// ---------------------------------------------------------------------------

export type TierKey =
  | 'free'
  | 'active'
  | 'pro_unlocked'
  | 'enterprise_unlocked'
  | 'past_due'
  | 'pending_zelle_audit';

export interface TierConfig {
  key: TierKey;
  label: string;
  shortLabel: string;
  propertyLimit: number;
  keywordLimit: number;
  monthlyPrice: number;
  /**
   * True only when money has actually been received for this state.
   * `active` is provisioned exclusively by the Zelle approval flow (verified
   * transfer) — billable. `pro_unlocked` is granted by the usage-based
   * auto-promotion (free upgrade) and `enterprise_unlocked` currently has no
   * paid provisioning path — both count toward capability, never revenue.
   * `pending_zelle_audit` / `past_due` / `free` are never revenue.
   */
  billable: boolean;
}

export const TIER_CONFIG: Record<TierKey, TierConfig> = {
  free: {
    key: 'free',
    label: 'Free — Discovery',
    shortLabel: 'FREE',
    propertyLimit: 5,
    keywordLimit: 1,
    monthlyPrice: 0,
    billable: false,
  },
  active: {
    key: 'active',
    label: 'Professional — Growth',
    shortLabel: 'PRO',
    propertyLimit: 50,
    keywordLimit: 10,
    monthlyPrice: 149,
    billable: true,
  },
  pro_unlocked: {
    key: 'pro_unlocked',
    label: 'Professional — Auto-Unlocked',
    shortLabel: 'PRO+',
    propertyLimit: 50,
    keywordLimit: 10,
    monthlyPrice: 149,
    billable: false, // usage-based free upgrade, not received revenue
  },
  enterprise_unlocked: {
    key: 'enterprise_unlocked',
    label: 'Enterprise — Full Use',
    shortLabel: 'ENTERPRISE',
    propertyLimit: Number.MAX_SAFE_INTEGER,
    keywordLimit: Number.MAX_SAFE_INTEGER,
    monthlyPrice: 499,
    billable: false, // no paid provisioning path exists yet — flip when one does
  },
  past_due: {
    key: 'past_due',
    label: 'Past Due',
    shortLabel: 'PAST DUE',
    propertyLimit: 5,
    keywordLimit: 1,
    monthlyPrice: 0,
    billable: false,
  },
  pending_zelle_audit: {
    key: 'pending_zelle_audit',
    label: 'Pending Zelle Audit',
    shortLabel: 'ZELLE',
    propertyLimit: 5,
    keywordLimit: 1,
    monthlyPrice: 149,
    billable: false, // unapproved, unpaid — pipeline, not revenue
  },
};

export function tierOf(status: string | null | undefined): TierKey {
  // Object.hasOwn (not `in`) — `in` walks the prototype chain, so values
  // like "constructor" would pass and poison the tier/mrr math with NaN.
  if (status && Object.hasOwn(TIER_CONFIG, status)) return status as TierKey;
  return 'free';
}

export const PAID_STATUSES: TierKey[] = ['active', 'pro_unlocked', 'enterprise_unlocked'];

export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'admin';
}

// Free-tier auto conversion threshold (matches the Supabase trigger blueprint).
// INTENTIONAL growth hook: free tenants are auto-promoted to pro_unlocked when
// their 5th property lands, so the free quota (5) is designed to hand off to
// the auto-upgrade at its ceiling rather than hard-block. Do not "fix" this
// asymmetry without deciding whether the hook should stay.
export const AUTO_PROMOTION_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// Platform-managed account policy. These emails are pre-provisioned by the
// seed / ops process with elevated roles; self-service registration rejects
// them outright so platform identities can never be squatted. Admin grants
// come from the DB only — never from a signup email match.
// ---------------------------------------------------------------------------
export const PLATFORM_MANAGED_EMAILS = [
  'jp@rhsaisolutions.com',
  'righthandservicesbyjp@gmail.com',
  'rhsjp01@gmail.com',
];

const CONSUMER_DOMAIN_BLACKLIST = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'live.com',
  'msn.com',
];

export function validateCorporateEmail(email: string): { isValid: boolean; reason?: string } {
  const sanitized = email.trim().toLowerCase();
  const domainMatch = sanitized.match(/@([^@]+)$/);
  if (!domainMatch) return { isValid: false, reason: 'Invalid email address format.' };
  const domain = domainMatch[1];
  if (CONSUMER_DOMAIN_BLACKLIST.includes(domain)) {
    return {
      isValid: false,
      reason:
        'Platform registration requires a valid corporate business email domain. Consumer addresses are restricted.',
    };
  }
  return { isValid: true };
}
