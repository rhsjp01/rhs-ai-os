import { RhsApp } from '@/components/rhs/app-shell';
import { APP_URL, ORG_URL } from './layout';

// ---------------------------------------------------------------------------
// Structured data — explicit brand hierarchy: RHS AI Solutions is a business
// name (DBA) of Right Hand Services by JP, a North Carolina sole
// proprietorship — not a division or subsidiary. Feature claims mirror the
// live product surface and are labeled for what they actually are: aerial
// imagery is AI-generated (illustrative, not satellite/survey data) and AEO
// ranks are simulated estimates from an LLM simulation, not live engine
// queries. Pricing matches the published tier matrix in src/lib/tiers.ts.
// ---------------------------------------------------------------------------
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${ORG_URL}/#organization`,
      name: 'Right Hand Services by JP',
      legalName: 'Right Hand Services by JP',
      alternateName: ['RHS AI Solutions', 'RHS AI'],
      url: ORG_URL,
      description:
        'Right Hand Services by JP is a North Carolina sole proprietorship providing property, vegetation and right-of-way services. RHS AI Solutions is a business name of Right Hand Services by JP, under which it builds the RHS AI Solutions OS property intelligence platform.',
      brand: {
        '@type': 'Brand',
        name: 'RHS AI Solutions',
      },
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Candor',
        addressRegion: 'NC',
        addressCountry: 'US',
      },
      knowsAbout: [
        'property intelligence',
        'AI-generated site visualizations',
        'right-of-way compliance',
        'vegetation management',
        'answer engine optimization',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${APP_URL}/#website`,
      url: APP_URL,
      name: 'RHS AI Solutions OS',
      description:
        'Control center for the RHS AI Solutions OS — property intelligence with AI-generated aerial visualizations, a shared compliance ledger, simulated AEO visibility estimates, smart invoicing and tiered SaaS billing.',
      publisher: { '@id': `${ORG_URL}/#organization` },
      inLanguage: 'en-US',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${APP_URL}/#app`,
      name: 'RHS AI Solutions OS',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Property Management Software',
      operatingSystem: 'Web browser',
      url: APP_URL,
      publisher: { '@id': `${ORG_URL}/#organization` },
      description:
        'Multi-tenant B2B platform for property intelligence and operational compliance: AI-generated aerial site visualizations (illustrative — not satellite or survey data), a shared compliance ledger, simulated answer-engine visibility (AEO) tracking, smart invoicing, and tiered SaaS billing.',
      featureList: [
        'AI site intelligence with AI-generated aerial visualizations (illustrative, not survey data)',
        'Multi-tenant compliance ledger with severity and resolution tracking',
        'AEO visibility tracking with simulated answer-engine estimates (Gemini, ChatGPT, Perplexity)',
        'Smart invoicing with payment status and revenue analytics',
        'Tiered SaaS billing (Free Discovery, Professional, Enterprise)',
      ],
      offers: [
        {
          '@type': 'Offer',
          name: 'Free — Discovery',
          description: '5 property audit tokens, 1 AEO keyword, view-only compliance ledger.',
          price: '0',
          priceCurrency: 'USD',
        },
        {
          '@type': 'Offer',
          name: 'Professional — Growth',
          description: '50 properties, 10 AEO keywords, full compliance ledger and invoicing.',
          price: '149',
          priceCurrency: 'USD',
        },
        {
          '@type': 'Offer',
          name: 'Enterprise — Full Use',
          description: 'Unlimited properties and AEO keywords, full platform access.',
          price: '499',
          priceCurrency: 'USD',
        },
      ],
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <noscript>
        <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
          <div className="max-w-xl space-y-4 text-center">
            <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest">
              RHS AI Solutions · a business name of Right Hand Services by JP · Candor, NC
            </p>
            <h1 className="text-2xl font-black">
              RHS AI Solutions OS — Property Intelligence &amp; Operational Compliance
            </h1>
            <p className="text-sm text-neutral-400">
              A multi-tenant B2B platform for property and vegetation management
              companies. Sign in with a corporate email to access your workspace.
            </p>
            <ul className="text-sm text-neutral-300 list-disc list-inside space-y-1 text-left">
              <li>AI site intelligence with AI-generated aerial visualizations (illustrative, not survey data)</li>
              <li>Compliance ledger with severity, resolution and due-date tracking</li>
              <li>AEO visibility tracking with simulated answer-engine estimates (Gemini, ChatGPT, Perplexity)</li>
              <li>Smart invoicing with payment status and revenue analytics</li>
              <li>Tiered SaaS billing: Free Discovery, Professional ($149/mo), Enterprise ($499/mo)</li>
            </ul>
            <p className="text-xs text-neutral-500 font-mono">
              JavaScript is required to sign in and operate the control center. Sample
              screening audits are complimentary; full audits require an active workspace.
            </p>
          </div>
        </div>
      </noscript>
      <RhsApp />
    </>
  );
}
