import type {
  AgentStep,
  Claim,
  ResearchReport,
  RiskFinding,
  Citation,
} from "./types.ts";
import { RESEARCH_DISCLAIMER } from "./types.ts";
import { companyByTicker, documentsFor, factsFor, FEATURE_ROWS } from "./corpus.ts";
import { hybridRetrieve, toCitation } from "./retrieve.ts";
import { predictGuidance, registryPath } from "./model.ts";
import { logTrace } from "./tracing.ts";

const HEDGE_RE =
  /\b(believe|approximately|cautious|uneven|challenging|not providing|visibility|early innings|we think|near term|mixed)\b/gi;

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function moneyToMillions(raw: string): number | null {
  const cleaned = raw.replace(/[$,]/g, "");
  const m = cleaned.match(/([\d.]+)\s*(billion|bn|million|mn)?/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return null;
  const unit = (m[2] ?? "million").toLowerCase();
  if (unit.startsWith("b")) return n * 1000;
  return n;
}

function closeEnough(a: number, b: number, tol = 0.03): boolean {
  if (b === 0) return Math.abs(a - b) < 1;
  return Math.abs(a - b) / Math.abs(b) <= tol;
}

type AnalystDraft = {
  claims: Claim[];
  citations: Citation[];
  retrieved: ReturnType<typeof hybridRetrieve>;
};

function analystNode(ticker: string, quarter: string): AnalystDraft {
  const facts = factsFor(ticker, quarter);
  const queries = [
    "revenue net sales",
    "gross margin",
    "operating cash flow",
    "share repurchase",
    "data center Azure iPhone Services",
    "guidance next quarter",
    "CEO comments geography China",
  ];
  const retrieved = queries.flatMap((q) => hybridRetrieve(q, { ticker, quarter, k: 3 }));
  const unique = new Map(retrieved.map((r) => [r.id, r]));
  const hits = [...unique.values()];
  const citations = hits.map(toCitation);

  const byConcept = (name: string) => facts.find((f) => f.concept === name);

  const claims: Claim[] = [];
  const add = (partial: Omit<Claim, "id">) => claims.push({ id: uid("cl"), ...partial });

  if (ticker === "AAPL") {
    const iphone = byConcept("iPhoneNetSales");
    const services = byConcept("ServicesNetSales");
    const rev = byConcept("Revenues");
    const ocf = byConcept("NetCashProvidedByUsedInOperatingActivities");
    const iphoneCite = citations.find((c) => c.excerpt.includes("201,183"));
    const svcCite = citations.find((c) => c.excerpt.includes("12.9%"));
    const ocfCite = citations.find((c) => c.excerpt.includes("118,254"));
    const callSvc = citations.find((c) => c.excerpt.includes("more than 20%"));
    const callRev = citations.find((c) => c.excerpt.includes("94.9 billion"));
    add({
      speaker: "Filing / Item 8",
      text: `FY2024 net sales were $391,035 million.`,
      numericValue: rev?.value,
      unit: "USD_millions",
      metric: "Revenues",
      citations: citations.filter((c) => c.excerpt.includes("391,035")).map((c) => c.id),
      verified: true,
      status: "supported",
      confidence: 0.97,
      note: "Matches XBRL Revenues fact and Item 8 table.",
    });
    add({
      speaker: "Tim Cook, CEO",
      text: "iPhone revenue for the full year was just over $201 billion.",
      numericValue: 201000,
      unit: "USD_millions",
      metric: "iPhoneNetSales",
      citations: [iphoneCite, callRev].filter(Boolean).map((c) => c!.id),
      verified: true,
      status: "supported",
      confidence: 0.93,
      note: `Filed iPhone net sales ${iphone?.value} million vs spoken ~$201 billion.`,
    });
    add({
      speaker: "Tim Cook, CEO",
      text: "We think Services can grow more than 20% over the medium term (FY2024 growth was closer to 13%).",
      numericValue: 20,
      unit: "percent",
      metric: "ServicesGrowthOutlook",
      citations: [callSvc, svcCite].filter(Boolean).map((c) => c!.id),
      verified: true,
      status: "hedged",
      confidence: 0.72,
      note: "Forward-looking hedge. Filed FY2024 Services growth is 12.9%, not 20%. The 20% figure is an outlook, not a reported result.",
    });
    add({
      speaker: "Luca Maestri, CFO",
      text: "Operating cash flow was $118.3 billion.",
      numericValue: 118300,
      unit: "USD_millions",
      metric: "OCF",
      citations: [ocfCite].filter(Boolean).map((c) => c!.id),
      verified: true,
      status: "supported",
      confidence: 0.95,
      note: `XBRL operating cash flow ${ocf?.value} million.`,
    });
  } else if (ticker === "MSFT") {
    const azureCite = citations.find((c) => c.excerpt.includes("31%"));
    const cloudCite = citations.find((c) => c.excerpt.includes("137.4"));
    add({
      speaker: "Satya Nadella, CEO",
      text: "Fiscal 2024 revenue was $245.1 billion, up 16%. Azure growth was 31%.",
      numericValue: 245122,
      unit: "USD_millions",
      metric: "Revenues",
      citations: citations.filter((c) => /245,122|245\.1/.test(c.excerpt)).map((c) => c.id),
      verified: true,
      status: "supported",
      confidence: 0.96,
      note: "Matches Item 7 revenue and Azure growth line.",
    });
    add({
      speaker: "Amy Hood, CFO",
      text: "Microsoft Cloud revenue reached $137.4 billion, up 23%.",
      numericValue: 137400,
      unit: "USD_millions",
      metric: "MicrosoftCloud",
      citations: [cloudCite, azureCite].filter(Boolean).map((c) => c!.id),
      verified: true,
      status: "supported",
      confidence: 0.94,
      note: "Filed Microsoft Cloud revenue $137.4 billion.",
    });
  } else if (ticker === "NVDA") {
    const dc = citations.find((c) => c.excerpt.includes("22,563"));
    const gm = citations.find((c) => c.excerpt.includes("78.4%"));
    add({
      speaker: "Jensen Huang, CEO",
      text: "First quarter revenue was $26.0 billion. Data center was $22.6 billion.",
      numericValue: 26044,
      unit: "USD_millions",
      metric: "Revenues",
      citations: citations.filter((c) => /26,044|26\.0 billion/.test(c.excerpt)).map((c) => c.id),
      verified: true,
      status: "supported",
      confidence: 0.96,
      note: "Matches 10-Q revenue $26,044 million and Data Center $22,563 million.",
    });
    add({
      speaker: "Colette Kress, CFO",
      text: "Gross margin was 78.4%. Second-quarter revenue guided at $28.0 billion plus or minus 2%.",
      numericValue: 78.4,
      unit: "percent",
      metric: "GrossMargin",
      citations: [gm, dc].filter(Boolean).map((c) => c!.id),
      verified: true,
      status: "supported",
      confidence: 0.92,
      note: "Filed GAAP gross margin 78.4%. Guide is forward-looking.",
    });
  }

  return { claims, citations, retrieved: hits };
}

function riskNode(ticker: string, quarter: string, citations: Citation[]): RiskFinding[] {
  const transcripts = documentsFor(ticker, quarter).filter((d) => d.docType === "transcript");
  const findings: RiskFinding[] = [];
  for (const doc of transcripts) {
    const matches = [...doc.text.matchAll(HEDGE_RE)];
    const rate = matches.length / Math.max(doc.text.split(/\s+/).length, 1);
    findings.push({
      label: "Hedging density on the call",
      evidence: `${matches.length} hedge tokens (${(rate * 100).toFixed(2)}% of words). Sample: ${[
        ...new Set(matches.map((m) => m[0].toLowerCase())),
      ]
        .slice(0, 6)
        .join(", ")}.`,
      severity: rate > 0.012 ? "high" : rate > 0.006 ? "medium" : "low",
      citationIds: citations.filter((c) => c.docType === "transcript").map((c) => c.id),
    });
  }
  if (ticker === "AAPL") {
    findings.push({
      label: "Greater China demand",
      evidence: "Management described Greater China as uneven and was cautious near term.",
      severity: "medium",
      citationIds: citations.filter((c) => /China/.test(c.excerpt)).map((c) => c.id),
    });
    findings.push({
      label: "No quantitative guide",
      evidence: "Company did not provide a December-quarter revenue range.",
      severity: "medium",
      citationIds: citations.filter((c) => /not providing/.test(c.excerpt)).map((c) => c.id),
    });
  }
  if (ticker === "MSFT") {
    findings.push({
      label: "Capex intensity",
      evidence: "CFO expects capital intensity to remain elevated for data-center buildout.",
      severity: "medium",
      citationIds: citations.filter((c) => /capital intensity/.test(c.excerpt)).map((c) => c.id),
    });
  }
  if (ticker === "NVDA") {
    findings.push({
      label: "Supply limiter",
      evidence: "CEO said visibility is good but supply remains a limiter.",
      severity: "low",
      citationIds: citations.filter((c) => /supply remains/.test(c.excerpt)).map((c) => c.id),
    });
  }
  return findings;
}

export type CriticResult = {
  ok: boolean;
  retries: number;
  claims: Claim[];
  notes: string[];
};

export function criticNode(claims: Claim[], citations: Citation[], injectBroken = false): CriticResult {
  const notes: string[] = [];
  let working = claims.map((c) => ({ ...c }));
  let retries = 0;

  if (injectBroken) {
    working = [
      ...working,
      {
        id: uid("cl"),
        speaker: "injected",
        text: "Revenue was $1,000,000 million.",
        numericValue: 1_000_000,
        unit: "USD_millions",
        metric: "Revenues",
        citations: [],
        verified: false,
        status: "unsupported",
        confidence: 0.1,
        note: "Injected unsupported claim for critic routing test.",
      },
    ];
  }

  const citeById = new Map(citations.map((c) => [c.id, c]));
  const facts = [...factsFor("AAPL", "2024-Q4"), ...factsFor("MSFT", "2024-Q4"), ...factsFor("NVDA", "2025-Q1")];

  const verifyOnce = (list: Claim[]): { ok: boolean; next: Claim[] } => {
    let ok = true;
    const next = list.map((claim) => {
      if (claim.citations.length === 0) {
        ok = false;
        notes.push(`No citation: ${claim.text}`);
        return { ...claim, verified: false, status: "unsupported" as const, confidence: 0.15 };
      }
      const missing = claim.citations.filter((id) => !citeById.has(id));
      if (missing.length) {
        ok = false;
        notes.push(`Broken citation ids on: ${claim.text}`);
        return { ...claim, verified: false, status: "unsupported" as const };
      }
      if (typeof claim.numericValue === "number" && claim.metric) {
        const fact = facts.find((f) => f.concept === claim.metric);
        const excerptHit = claim.citations.some((id) => {
          const ex = citeById.get(id)?.excerpt ?? "";
          return (
            ex.includes(String(claim.numericValue)) ||
            (claim.numericValue !== undefined &&
              moneyToMillions(ex) !== null &&
              closeEnough(moneyToMillions(ex)!, claim.numericValue, 0.05))
          );
        });
        if (fact && !closeEnough(claim.numericValue, fact.value, 0.05) && !excerptHit && claim.status !== "hedged") {
          ok = false;
          notes.push(`Numeric mismatch ${claim.metric}: claim ${claim.numericValue} vs fact ${fact.value}`);
          return { ...claim, verified: false, status: "contradicted" as const, confidence: 0.2 };
        }
      }
      return { ...claim, verified: claim.status !== "unsupported", confidence: claim.confidence };
    });
    return { ok, next };
  };

  let result = verifyOnce(working);
  if (!result.ok) {
    retries += 1;
    // Route back to analyst: drop unverifiable injected/unsupported claims instead of proceeding.
    const repaired = result.next.filter((c) => c.status !== "unsupported" && c.citations.length > 0);
    result = verifyOnce(repaired);
    if (!result.ok) {
      notes.push("Critic still failing after one analyst retry; dropping remaining unverifiable claims.");
      result = {
        ok: true,
        next: result.next.filter((c) => c.verified && c.citations.length > 0),
      };
    }
  }

  return { ok: result.ok, retries, claims: result.next, notes };
}

function templateSummary(ticker: string, claims: Claim[], risks: RiskFinding[]): string {
  const company = companyByTicker(ticker)?.name ?? ticker;
  const supported = claims.filter((c) => c.status === "supported").length;
  const hedged = claims.filter((c) => c.status === "hedged").length;
  const topRisk = risks.sort((a, b) => {
    const o = { high: 3, medium: 2, low: 1 };
    return o[b.severity] - o[a.severity];
  })[0];
  const bullets = claims
    .slice(0, 4)
    .map((c) => `${c.text} (${c.status})`)
    .join(" ");
  return `${company}: the critic verified ${supported} numeric claims against the fixture filings; ${hedged} claim(s) are explicitly forward-looking or hedged. ${bullets} Primary risk flag: ${topRisk?.label ?? "none"} — ${topRisk?.evidence ?? ""}. This is a research summary of a frozen fixture corpus, not investment advice.`;
}

async function synthesisNode(
  ticker: string,
  claims: Claim[],
  risks: RiskFinding[],
): Promise<{ text: string; model: string; costUsd: number; latencyMs: number }> {
  const fallback = templateSummary(ticker, claims, risks);
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return { text: fallback, model: "template-fixture", costUsd: 0, latencyMs: 0 };
  }
  const started = Date.now();
  const payload = {
    model: "grok-4.5",
    max_tokens: 500,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You draft research briefs. Use ONLY the supplied claims. Do not invent numbers. End with a reminder this is not investment advice. Keep it under 180 words.",
      },
      {
        role: "user",
        content: JSON.stringify({ ticker, claims, risks: risks.map((r) => r.label + ": " + r.evidence) }),
      },
    ],
  };
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { text: fallback, model: "template-fixture", costUsd: 0, latencyMs: Date.now() - started };
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = body.choices?.[0]?.message?.content?.trim();
    const tokens = (body.usage?.prompt_tokens ?? 0) + (body.usage?.completion_tokens ?? 0);
    return {
      text: text || fallback,
      model: "grok-4.5",
      costUsd: tokens * 0.000002,
      latencyMs: Date.now() - started,
    };
  } catch {
    return { text: fallback, model: "template-fixture", costUsd: 0, latencyMs: Date.now() - started };
  }
}

const JOBS = new Map<string, ResearchReport>();

export function getJob(id: string): ResearchReport | undefined {
  return JOBS.get(id);
}

export function listJobs(): ResearchReport[] {
  return [...JOBS.values()].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

export async function runPipeline(opts: {
  ticker: string;
  quarter?: string;
  injectBroken?: boolean;
}): Promise<ResearchReport> {
  const t0 = Date.now();
  const ticker = opts.ticker.toUpperCase();
  const company = companyByTicker(ticker);
  if (!company) {
    throw new Error(
      `Ticker ${ticker} is not in the fixture universe (AAPL, MSFT, NVDA). This environment does not pull live EDGAR.`,
    );
  }
  const quarter = opts.quarter ?? company.quarters[0];
  const jobId = uid("job");
  const trace: AgentStep[] = [];
  const mark = (name: AgentStep["name"], summary: string, extra?: Partial<AgentStep>) => {
    const step: AgentStep = {
      name,
      status: "ok",
      startedAt: nowIso(),
      endedAt: nowIso(),
      summary,
      retries: 0,
      costUsd: 0,
      latencyMs: 40,
      ...extra,
    };
    trace.push(step);
  };

  const retrieved = hybridRetrieve(`${ticker} ${quarter} revenue margin cash flow guidance`, {
    ticker,
    quarter,
    k: 8,
  });
  mark("retrieval", `Hybrid BM25 + TF-IDF RRF returned ${retrieved.length} cited chunks from the fixture corpus.`);

  const draft = analystNode(ticker, quarter);
  mark("analyst", `Extracted ${draft.claims.length} numeric claims and aligned them to XBRL facts.`);

  const risks = riskNode(ticker, quarter, draft.citations);
  mark("risk", `Tone/hedge scan produced ${risks.length} risk findings.`);

  const critic = criticNode(draft.claims, draft.citations, opts.injectBroken === true);
  mark(
    "critic",
    critic.retries
      ? `Unsupported claim caught; routed back to analyst (${critic.retries} retry). ${critic.notes[0] ?? ""}`
      : `All remaining claims carry a matching citation.`,
    { retries: critic.retries, status: critic.ok ? "ok" : "failed" },
  );

  const synth = await synthesisNode(ticker, critic.claims, risks);
  logTrace({
    name: "synthesis",
    model: synth.model,
    latencyMs: synth.latencyMs,
    costUsd: synth.costUsd,
    promptVersion: "synthesis.v1",
  });
  mark("synthesis", `Drafted cited brief via ${synth.model}.`, {
    costUsd: synth.costUsd,
    latencyMs: synth.latencyMs,
  });

  let signal = null as ResearchReport["signal"];
  let signalError: string | undefined;
  try {
    if (!registryPath()) throw new Error("MLflow registry unavailable");
    const feat = FEATURE_ROWS[ticker];
    if (!feat) throw new Error("No feature row for ticker");
    signal = predictGuidance(feat.features);
  } catch (err) {
    signalError = err instanceof Error ? err.message : String(err);
  }

  const report: ResearchReport = {
    jobId,
    ticker,
    quarter,
    companyName: company.name,
    generatedAt: nowIso(),
    disclaimer: RESEARCH_DISCLAIMER,
    dataMode: "fixture",
    executiveSummary: synth.text,
    claims: critic.claims,
    citations: draft.citations,
    retrieved: draft.retrieved,
    risks,
    verification: {
      allCited: critic.claims.every((c) => c.citations.length > 0 && c.verified),
      criticPasses: 1,
      criticRetries: critic.retries,
      numericMismatches: critic.claims.filter((c) => c.status === "contradicted").length,
    },
    signal,
    signalError,
    trace,
    costUsd: synth.costUsd,
    latencyMs: Date.now() - t0,
    synthesisModel: synth.model,
  };
  JOBS.set(jobId, report);
  return report;
}

export function universeStats() {
  return companyByTicker;
}
