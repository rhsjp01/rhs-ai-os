// Shared frontend types mirroring the API contracts.

export interface CompanyInfo {
  id: string;
  name: string;
  subscriptionStatus: string;
}

export interface AuthResponse {
  /** Session token — Bearer fallback when cookies are blocked (e.g. embedded iframes). */
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
    companyId: string | null;
    company: (CompanyInfo & { subscriptionStatus: string }) | null;
  };
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
    companyId: string | null;
    company: CompanyInfo | null;
  };
  isAdmin: boolean;
  tier: { key: string; label: string; shortLabel: string; monthlyPrice: number };
  quota: {
    propertyCount: number;
    propertyLimit: number | null;
    keywordCount: number;
    keywordLimit: number | null;
  };
}

export interface ActivityEventRow {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  companyName?: string;
}

export interface OverviewResponse {
  isAdmin: boolean;
  propertyCount: number;
  propertyLimit: number | null;
  avgTurf: number | null;
  avgDrainage: number | null;
  pendingCompliance: number;
  criticalCompliance: number;
  paidRevenue: number;
  outstanding: number;
  mrr: number;
  pipelineMrr: number;
  atRiskMrr: number;
  paidCompanies: number;
  totalCompanies: number;
  conversionRate: number;
  aeoAvgRank: number | null;
  aeoTracked: number;
  keywordLimit: number | null;
  tier: { key: string; label: string; shortLabel: string; monthlyPrice: number };
  propertyScores: Array<{ name: string; turf: number; drainage: number }>;
  revenueTrend: Array<{ label: string; revenue: number }>;
  recentEvents: ActivityEventRow[];
}

export interface PropertyRow {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  turfConditionScore: number | null;
  drainageScore: number | null;
  satelliteImageUrl: string | null;
  satelliteLastAnalyzed: string | null;
  openComplianceCount: number;
  companyName: string;
  companyStatus: string;
  createdAt: string;
}

export interface ComplianceRow {
  id: string;
  propertyId: string;
  propertyName: string;
  companyName: string;
  logType: string;
  severity: string | null;
  description: string | null;
  resolutionStatus: string;
  dueDate: string | null;
  loggedByName: string;
  createdAt: string;
}

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  issuedDate: string;
  propertyName: string | null;
  companyName: string;
}

export interface AeoRecordRow {
  id: string;
  engineName: string;
  keyword: string;
  searchVisibilityRank: number | null;
  aiRecommendationSnippet: string | null;
  lastCrawledAt: string;
}

export interface AdminMetricsResponse {
  totals: {
    companies: number;
    demoCompanies: number;
    freeCount: number;
    proCount: number;
    enterpriseCount: number;
    pendingZelle: number;
    pastDueCount: number;
    totalProperties: number;
    conversionRate: number;
    mrr: number;
    pipelineMrr: number;
    atRiskMrr: number;
    paidVolume: number;
  };
  companies: Array<{
    id: string;
    name: string;
    subscriptionStatus: string;
    tierLabel: string;
    billable: boolean;
    isDemo: boolean;
    propertyCount: number;
    userCount: number;
    invoiceCount: number;
    createdAt: string;
  }>;
  alerts: ActivityEventRow[];
  revenueByMonth: Array<{ label: string; revenue: number }>;
  tierDistribution: Array<{ name: string; value: number }>;
}

export interface ZelleQueueItem {
  id: string;
  name: string;
  reference: string;
  propertyCount: number;
  userCount: number;
  requestedAt: string;
}

export interface DigestResponse {
  metrics: {
    reportDate: string;
    totalProperties: number;
    freeTierCount: number;
    proTierCount: number;
    pendingZelle: number;
    conversionRate: string;
    estimatedMrr: string;
    pipelineMrr: string;
    totalTenants: number;
  };
  html: string;
}

export interface CheckoutResult {
  status: string;
  amount: number;
  gateway?: string;
  instructions?: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    amount: number;
    status: string;
    issuedDate: string;
  };
}
