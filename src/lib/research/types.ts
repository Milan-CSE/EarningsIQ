export type DocType = "10-K" | "10-Q" | "8-K" | "transcript" | "xbrl" | "price";

export type Citation = {
  id: string;
  docId: string;
  docType: DocType;
  section: string;
  page?: number;
  charStart: number;
  charEnd: number;
  timestamp?: string;
  excerpt: string;
  sourceLabel: string;
};

export type Chunk = {
  id: string;
  docId: string;
  ticker: string;
  quarter: string;
  docType: DocType;
  section: string;
  page?: number;
  charStart: number;
  charEnd: number;
  timestamp?: string;
  text: string;
  table?: boolean;
};

export type Document = {
  id: string;
  ticker: string;
  quarter: string;
  docType: DocType;
  title: string;
  filed: string;
  sectionIndex: { heading: string; charStart: number }[];
  text: string;
  sourceLabel: string;
};

export type XbrlFact = {
  ticker: string;
  quarter: string;
  concept: string;
  value: number;
  unit: string;
  decimals: number;
  period: string;
};

export type PriceBar = {
  ticker: string;
  date: string;
  close: number;
  volume: number;
};

export type Claim = {
  id: string;
  speaker?: string;
  text: string;
  numericValue?: number;
  unit?: string;
  metric?: string;
  citations: string[];
  verified: boolean;
  status: "supported" | "contradicted" | "unsupported" | "hedged";
  confidence: number;
  note: string;
};

export type AgentName = "retrieval" | "analyst" | "risk" | "critic" | "synthesis";

export type AgentStep = {
  name: AgentName;
  status: "pending" | "running" | "ok" | "retry" | "failed";
  startedAt: string;
  endedAt?: string;
  summary: string;
  retries: number;
  costUsd: number;
  latencyMs: number;
};

export type RiskFinding = {
  label: string;
  evidence: string;
  severity: "low" | "medium" | "high";
  citationIds: string[];
};

export type GuidanceSignal = {
  disclaimer: string;
  pBeat: number;
  predictedClass: "beat" | "miss";
  modelName: string;
  modelVersion: string;
  alias: "staging" | "production";
  features: Record<string, number>;
};

export type ResearchReport = {
  jobId: string;
  ticker: string;
  quarter: string;
  companyName: string;
  generatedAt: string;
  disclaimer: string;
  dataMode: "fixture";
  executiveSummary: string;
  claims: Claim[];
  citations: Citation[];
  retrieved: Chunk[];
  risks: RiskFinding[];
  verification: {
    allCited: boolean;
    criticPasses: number;
    criticRetries: number;
    numericMismatches: number;
  };
  signal: GuidanceSignal | null;
  signalError?: string;
  trace: AgentStep[];
  costUsd: number;
  latencyMs: number;
  synthesisModel: string;
};

export type Company = {
  ticker: string;
  name: string;
  cik: string;
  sector: string;
  quarters: string[];
};

export const RESEARCH_DISCLAIMER =
  "EarningsIQ is a research and summarization tool. It is not investment advice, a solicitation, or a recommendation to buy, sell, or hold any security. All figures in this environment come from a frozen fixture corpus labeled as such — not a live EDGAR, market-data, or broker feed.";

export const FIXTURE_LABEL =
  "FIXTURE — frozen offline snapshot of public-company-style filings. Not a live EDGAR or market-data response.";
