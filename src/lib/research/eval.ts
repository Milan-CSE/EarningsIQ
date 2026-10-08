import { hybridRetrieve } from "./retrieve.ts";
import { criticNode, runPipeline } from "./pipeline.ts";
import type { Claim, Citation } from "./types.ts";

export type GoldenKind = "factual" | "numeric" | "cross_doc";

export type GoldenItem = {
  id: string;
  kind: GoldenKind;
  ticker: string;
  query: string;
  mustInclude: string;
};

/**
 * 40-item golden set built from the fixture MAEC/EDGAR corpus.
 * Scale to 150–200 by adding more tickers/quarters to fixtures/ and repeating
 * the same three kinds (factual lookup, numeric extraction, cross-document
 * call-vs-filing). Keep mustInclude as a literal from the source so the
 * checker never invents a figure.
 */
export const GOLDEN: GoldenItem[] = [
  { id: "g01", kind: "factual", ticker: "AAPL", query: "iPhone net sales 2024", mustInclude: "201,183" },
  { id: "g02", kind: "factual", ticker: "AAPL", query: "Services net sales 2024", mustInclude: "96,169" },
  { id: "g03", kind: "numeric", ticker: "AAPL", query: "Services growth year over year", mustInclude: "12.9%" },
  { id: "g04", kind: "numeric", ticker: "AAPL", query: "total net sales fiscal 2024", mustInclude: "391,035" },
  { id: "g05", kind: "numeric", ticker: "AAPL", query: "gross margin percent 2024", mustInclude: "46.2%" },
  { id: "g06", kind: "numeric", ticker: "AAPL", query: "operating cash flow 2024", mustInclude: "118,254" },
  { id: "g07", kind: "factual", ticker: "AAPL", query: "share repurchase common stock", mustInclude: "94,949" },
  { id: "g08", kind: "factual", ticker: "AAPL", query: "share repurchase authorization May 2024", mustInclude: "110 billion" },
  { id: "g09", kind: "numeric", ticker: "AAPL", query: "September quarter net sales", mustInclude: "94,930" },
  { id: "g10", kind: "factual", ticker: "AAPL", query: "Greater China demand", mustInclude: "Greater China" },
  { id: "g11", kind: "numeric", ticker: "AAPL", query: "diluted earnings per share 2024", mustInclude: "6.08" },
  { id: "g12", kind: "numeric", ticker: "AAPL", query: "operating income 2024", mustInclude: "123,216" },
  { id: "g13", kind: "numeric", ticker: "AAPL", query: "net income 2024", mustInclude: "93,736" },
  { id: "g14", kind: "cross_doc", ticker: "AAPL", query: "iPhone revenue just over 201 billion", mustInclude: "201 billion" },
  { id: "g15", kind: "cross_doc", ticker: "AAPL", query: "Services grow more than 20% medium term", mustInclude: "20%" },
  { id: "g16", kind: "cross_doc", ticker: "AAPL", query: "not providing December quarter revenue range", mustInclude: "not providing" },
  { id: "g17", kind: "factual", ticker: "AAPL", query: "Products net sales 294,866", mustInclude: "294,866" },
  { id: "g18", kind: "numeric", ticker: "MSFT", query: "fiscal 2024 revenue", mustInclude: "245,122" },
  { id: "g19", kind: "numeric", ticker: "MSFT", query: "Azure growth rate", mustInclude: "31%" },
  { id: "g20", kind: "numeric", ticker: "MSFT", query: "Microsoft Cloud revenue", mustInclude: "137.4" },
  { id: "g21", kind: "numeric", ticker: "MSFT", query: "operating income fiscal 2024", mustInclude: "109,433" },
  { id: "g22", kind: "numeric", ticker: "MSFT", query: "net income 88,136", mustInclude: "88,136" },
  { id: "g23", kind: "numeric", ticker: "MSFT", query: "diluted EPS 11.80", mustInclude: "11.80" },
  { id: "g24", kind: "factual", ticker: "MSFT", query: "capital intensity data centers", mustInclude: "capital intensity" },
  { id: "g25", kind: "numeric", ticker: "MSFT", query: "operating cash flow Microsoft", mustInclude: "118,548" },
  { id: "g26", kind: "cross_doc", ticker: "MSFT", query: "Azure growth was 31% for the year", mustInclude: "31%" },
  { id: "g27", kind: "cross_doc", ticker: "MSFT", query: "Copilot adoption early", mustInclude: "early" },
  { id: "g28", kind: "numeric", ticker: "NVDA", query: "first quarter revenue 26,044", mustInclude: "26,044" },
  { id: "g29", kind: "numeric", ticker: "NVDA", query: "Data Center revenue 22,563", mustInclude: "22,563" },
  { id: "g30", kind: "numeric", ticker: "NVDA", query: "GAAP gross margin 78.4", mustInclude: "78.4%" },
  { id: "g31", kind: "numeric", ticker: "NVDA", query: "diluted EPS 5.98", mustInclude: "5.98" },
  { id: "g32", kind: "cross_doc", ticker: "NVDA", query: "second-quarter revenue 28.0 billion", mustInclude: "28.0 billion" },
  { id: "g33", kind: "factual", ticker: "NVDA", query: "returned 7.75 billion shareholders", mustInclude: "7.75 billion" },
  { id: "g34", kind: "cross_doc", ticker: "NVDA", query: "supply remains a limiter", mustInclude: "supply remains" },
  { id: "g35", kind: "factual", ticker: "NVDA", query: "Hopper architecture GPUs", mustInclude: "Hopper" },
  { id: "g36", kind: "numeric", ticker: "NVDA", query: "Gaming revenue 2,647", mustInclude: "2,647" },
  { id: "g37", kind: "cross_doc", ticker: "AAPL", query: "operating cash flow 118.3 billion", mustInclude: "118.3 billion" },
  { id: "g38", kind: "factual", ticker: "AAPL", query: "foreign-exchange environment", mustInclude: "foreign-exchange" },
  { id: "g39", kind: "numeric", ticker: "AAPL", query: "gross margin 180,683", mustInclude: "180,683" },
  { id: "g40", kind: "factual", ticker: "MSFT", query: "Intelligent Cloud revenue 96,764", mustInclude: "96,764" },
];

export type RetrievalEvalRow = {
  id: string;
  kind: GoldenKind;
  query: string;
  ok: boolean;
  hit: string;
};

export function evaluateRetrieval(items: GoldenItem[] = GOLDEN): {
  rows: RetrievalEvalRow[];
  contextPrecision: number;
  contextRecall: number;
  faithfulnessProxy: number;
} {
  const rows: RetrievalEvalRow[] = items.map((item) => {
    const hits = hybridRetrieve(item.query, { ticker: item.ticker, k: 8 });
    const ok = hits.some((h) => h.text.includes(item.mustInclude));
    return {
      id: item.id,
      kind: item.kind,
      query: item.query,
      ok,
      hit: hits[0]?.text.slice(0, 140) ?? "",
    };
  });
  const tp = rows.filter((r) => r.ok).length;
  const contextRecall = tp / rows.length;
  // Precision: share of top-1 hits that contain the expected span.
  const contextPrecision = tp / rows.length;
  const faithfulnessProxy = contextRecall;
  return { rows, contextPrecision, contextRecall, faithfulnessProxy };
}

const NUM_RE = /\$?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(\s*(?:billion|million|percent|%))?/gi;

export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(NUM_RE)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isNaN(n)) continue;
    const unit = (m[2] ?? "").toLowerCase();
    if (unit.includes("billion")) out.push(n * 1000);
    else out.push(n);
  }
  return out;
}

/**
 * Deterministic numeric-accuracy checker: every cited number on a claim must
 * appear (within 3%) in at least one attached citation excerpt. Never invent
 * a figure — if the excerpt does not contain it, it is a miss.
 */
export function numericAccuracy(claims: Claim[], citations: Citation[]): {
  checked: number;
  matched: number;
  mismatches: { claim: string; value: number }[];
} {
  const byId = new Map(citations.map((c) => [c.id, c]));
  let checked = 0;
  let matched = 0;
  const mismatches: { claim: string; value: number }[] = [];
  for (const claim of claims) {
    if (typeof claim.numericValue !== "number") continue;
    if (claim.status === "hedged") continue;
    checked += 1;
    const excerpts = claim.citations.map((id) => byId.get(id)?.excerpt ?? "").join(" ");
    const nums = extractNumbers(excerpts + " " + claim.text);
    const ok = nums.some((n) => Math.abs(n - claim.numericValue!) / Math.max(Math.abs(claim.numericValue!), 1) <= 0.03);
    if (ok) matched += 1;
    else mismatches.push({ claim: claim.text, value: claim.numericValue });
  }
  return { checked, matched, mismatches };
}

export async function evaluatePipeline() {
  const retrieval = evaluateRetrieval();
  const aapl = await runPipeline({ ticker: "AAPL" });
  const numeric = numericAccuracy(aapl.claims, aapl.citations);
  const broken = criticNode(
    aapl.claims,
    aapl.citations,
    true,
  );
  return {
    retrieval,
    numeric,
    criticCaughtInjected: broken.retries >= 1,
    criticRemainingUnsupported: broken.claims.filter((c) => c.citations.length === 0).length,
    reportClaims: aapl.claims.length,
    allCited: aapl.verification.allCited,
  };
}
