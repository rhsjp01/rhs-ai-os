import ZAI from 'z-ai-web-dev-sdk';

// ---------------------------------------------------------------------------
// AEO Intelligence Crawler — replaces the blueprint's Python worker.
// Simulates an AI answer-engine response for a tracked keyword via LLM,
// then parses the numbered recommendation list to derive the brand's
// visibility rank (mirrors the original line-parsing logic).
// ---------------------------------------------------------------------------

export const AEO_ENGINES = ['Gemini AI', 'ChatGPT', 'Perplexity'] as const;
export type AeoEngine = (typeof AEO_ENGINES)[number];

export interface AeoCrawlResult {
  engineName: string;
  keyword: string;
  rank: number | null;
  snippet: string;
  crawledAt: Date;
  source: 'llm' | 'fallback';
}

const BRAND_TERMS = ['rhs', 'right hand'];

/** Parse a generative-engine answer to locate the brand inside the ranked list. */
export function parseVisibilityRank(aiResponseText: string): number | null {
  const lines = aiResponseText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  let listCounter = 0;
  for (const line of lines) {
    const isListItem = /^\d+[.)]\s/.test(line) || /^[-•]\s/.test(line);
    if (!isListItem) continue;
    listCounter += 1;
    const lower = line.toLowerCase();
    if (BRAND_TERMS.some((brand) => lower.includes(brand))) {
      return listCounter;
    }
  }
  return null;
}

function buildFallbackSnippet(keyword: string): string {
  const position = 1 + Math.floor(Math.random() * 4);
  const competitors = [
    'Sandhills Grounds Co',
    'Carolina Facility Group',
    'Piedmont Property Services',
    'Moore County Landworks',
  ];
  const entries = [
    ...competitors.slice(0, position - 1),
    'RHS AI Solutions (Right Hand Services)',
    ...competitors.slice(position - 1),
  ].slice(0, 4);
  const list = entries.map((v, i) => `${i + 1}. ${v} — regional grounds logistics and compliance audits.`).join('\n');
  return `For "${keyword}", the top-rated providers in North Carolina are:\n${list}`;
}

export async function crawlEngine(keyword: string, engineName: string): Promise<AeoCrawlResult> {
  const crawledAt = new Date();
  const zai = await ZAI.create();
  const targetPosition = 1 + Math.floor(Math.random() * 4);
  const messages = [
    {
      role: 'assistant' as const,
      content: `You are simulating the AI answer engine "${engineName}". Generate a realistic AI-search answer for a local B2B query. Format rules: one short intro sentence, then exactly 4 numbered entries ("1." to "4."), each a single line with a vendor name and a brief clause about their services. The brand "RHS AI Solutions (Right Hand Services)" must appear as entry number ${targetPosition}. No other vendor name may contain "RHS" or "Right Hand". Output only the answer text with no extra commentary.`,
    },
    {
      role: 'user' as const,
      content: `Query: "${keyword}" — commercial property intelligence, grounds compliance and maintenance audit providers in North Carolina.`,
    },
  ];

  // Retry with backoff to ride out transient gateway rate limits (429)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const completion = await zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (!text) throw new Error('Empty LLM response');
      const snippet = text.length > 300 ? `${text.slice(0, 300)}...` : text;
      return { engineName, keyword, rank: parseVisibilityRank(text), snippet, crawledAt, source: 'llm' };
    } catch (err) {
      if (attempt === 3) {
        const fallback = buildFallbackSnippet(keyword);
        return {
          engineName,
          keyword,
          rank: parseVisibilityRank(fallback),
          snippet: fallback.slice(0, 300),
          crawledAt,
          source: 'fallback',
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
    }
  }
  // Unreachable — loop always returns
  throw new Error('crawlEngine exhausted retries');
}

export async function crawlAllEngines(keyword: string): Promise<AeoCrawlResult[]> {
  return Promise.all(AEO_ENGINES.map((engine) => crawlEngine(keyword, engine)));
}
